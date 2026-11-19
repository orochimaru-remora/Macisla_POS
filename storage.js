/**
 * Macisla_POS Hybrid Storage Engine
 * - Local SQLite (`node:sqlite` -> `data/macisla_pos.db`) for zero-dependency offline/local operation
 * - Optional Cloudflare D1 REST API sync when `CLOUDFLARE_API_TOKEN` is set
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { DatabaseSync } = require('node:sqlite');
const {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_POS_ITEMS,
  normalizeTransactionPayload,
  computePosAnalytics,
  buildSalesCsvExport,
  buildInventoryCsvExport
} = require('./shared.mjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'macisla_pos.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Seed default catalog items & sample customers if empty
(() => {
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM pos_items').get();
  if (!countRow || Number(countRow.count) === 0) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO pos_items (
        id, sku, name, category, item_type, cost_price, price, stock, min_stock, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const it of DEFAULT_POS_ITEMS) {
      stmt.run(it.id, it.sku, it.name, it.category, it.itemType, it.costPrice, it.price, it.stock, it.minStock, now, now);
    }
  }

  const custCount = db.prepare('SELECT COUNT(*) AS count FROM customers').get();
  if (!custCount || Number(custCount.count) === 0) {
    const now = new Date().toISOString();
    const cStmt = db.prepare(`
      INSERT OR IGNORE INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    cStmt.run('cust_6281280001001', '+62 812-8000-1001', 'Reza Pratama', 'VIP Regular', 'Low skin fade, textured quiff', now, now);
    cStmt.run('cust_6281280001002', '+62 812-8000-1002', 'Dimas Saputra', 'Prefers hot towel shave', 'Classic side part + matte clay', now, now);
    cStmt.run('cust_6281280001003', '+62 812-8000-1003', 'Kevin Wijaya', 'Monthly hair spa', 'French crop high drop fade', now, now);
  }
})();

const PROD_D1_UUID = '9d540277-0b77-42eb-bbea-405145543d95';
const PROD_ACCOUNT_ID = '672d76857199f1694ac0f389ab4d30e2';

function getD1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || PROD_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || PROD_D1_UUID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  return {
    accountId,
    databaseId,
    apiToken,
    isConfigured: Boolean(accountId && databaseId && apiToken)
  };
}

function queryD1(sql, params = []) {
  return new Promise((resolve, reject) => {
    const { accountId, databaseId, apiToken, isConfigured } = getD1Config();
    if (!isConfigured) return reject(new Error('Cloudflare D1 API token not configured'));
    const payload = JSON.stringify({ sql, params });
    const req = https.request(
      {
        hostname: 'api.cloudflare.com',
        port: 443,
        path: `/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        method: 'POST',
        family: 4,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 12000
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!parsed.success) return reject(new Error(parsed.errors?.[0]?.message || 'D1 query failed'));
            resolve(parsed.result?.[0]?.results || []);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('D1 query timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function mapItemRow(r) {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    itemType: r.item_type || 'Service',
    costPrice: Math.round(Number(r.cost_price) || 0),
    price: Math.round(Number(r.price) || 0),
    stock: Math.round(Number(r.stock) || 0),
    minStock: Math.round(Number(r.min_stock ?? 5)),
    active: Number(r.active ?? 1)
  };
}

function mapTxRow(r) {
  let items = [];
  try { items = JSON.parse(r.items_json || '[]'); } catch (_) {}
  return {
    id: r.id,
    sessionId: r.session_id || '',
    customerId: r.customer_id || '',
    customerName: r.customer_name || 'Walk-in Customer',
    customerPhone: r.customer_phone || '',
    cashierName: r.cashier_name || 'General Counter',
    items,
    subtotal: Math.round(Number(r.subtotal) || 0),
    discount: Math.round(Number(r.discount) || 0),
    taxRate: Number(r.tax_rate) || 0,
    taxAmount: Math.round(Number(r.tax_amount) || 0),
    total: Math.round(Number(r.total) || 0),
    paymentMethod: r.payment_method || 'Cash',
    amountPaid: Math.round(Number(r.amount_paid) || 0),
    changeDue: Math.round(Number(r.change_due) || 0),
    status: r.status || 'COMPLETED',
    notes: r.notes || '',
    date: r.date,
    createdAt: r.created_at
  };
}

function getItems() {
  const rows = db.prepare('SELECT * FROM pos_items WHERE active = 1 ORDER BY category ASC, name ASC').all();
  return rows.map(mapItemRow);
}

function saveItem(body = {}) {
  const now = new Date().toISOString();
  if (body.action === 'delete' && body.id) {
    db.prepare('DELETE FROM pos_items WHERE id = ?').run(String(body.id).trim());
    queryD1('DELETE FROM pos_items WHERE id = ?', [String(body.id).trim()]).catch(() => {});
    return { deletedId: body.id };
  }

  if (body.action === 'adjust_stock' && body.id) {
    const delta = Math.round(Number(body.delta) || 0);
    const id = String(body.id).trim();
    db.prepare('UPDATE pos_items SET stock = MAX(0, stock + ?), updated_at = ? WHERE id = ?').run(delta, now, id);
    queryD1('UPDATE pos_items SET stock = MAX(0, stock + ?), updated_at = ? WHERE id = ?', [delta, now, id]).catch(() => {});
    const row = db.prepare('SELECT * FROM pos_items WHERE id = ?').get(id);
    return { item: row ? mapItemRow(row) : null };
  }

  const name = String(body.name || '').trim();
  if (!name) throw new Error('Item name is required');
  const sku = String(body.sku || `SKU-${Date.now().toString(36).toUpperCase()}`).trim().toUpperCase();
  const category = String(body.category || 'Haircuts & Styling').trim();
  const itemType = (body.itemType || body.item_type) === 'Product' ? 'Product' : 'Service';
  const costPrice = Math.max(0, Math.round(Number(body.costPrice ?? body.cost_price) || 0));
  const price = Math.max(0, Math.round(Number(body.price) || 0));
  const stock = itemType === 'Product' ? Math.max(0, Math.round(Number(body.stock) || 0)) : 999;
  const minStock = itemType === 'Product' ? Math.max(0, Math.round(Number(body.minStock ?? body.min_stock ?? 5))) : 0;
  const id = String(body.id || `itm-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).trim();

  db.prepare(`
    INSERT INTO pos_items (
      id, sku, name, category, item_type, cost_price, price, stock, min_stock, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sku = excluded.sku,
      name = excluded.name,
      category = excluded.category,
      item_type = excluded.item_type,
      cost_price = excluded.cost_price,
      price = excluded.price,
      stock = excluded.stock,
      min_stock = excluded.min_stock,
      active = 1,
      updated_at = excluded.updated_at
  `).run(id, sku, name, category, itemType, costPrice, price, stock, minStock, now, now);

  queryD1(
    `INSERT INTO pos_items (
      id, sku, name, category, item_type, cost_price, price, stock, min_stock, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sku = excluded.sku, name = excluded.name, category = excluded.category,
      item_type = excluded.item_type, cost_price = excluded.cost_price, price = excluded.price,
      stock = excluded.stock, min_stock = excluded.min_stock, active = 1, updated_at = excluded.updated_at`,
    [id, sku, name, category, itemType, costPrice, price, stock, minStock, now, now]
  ).catch(() => {});

  return { item: { id, sku, name, category, itemType, costPrice, price, stock, minStock, active: 1 } };
}

function getCustomers(q = '') {
  const clean = String(q || '').trim().toLowerCase();
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS pos_bills,
      (SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS total_spent
    FROM customers c
  `;
  const params = [];
  if (clean) {
    sql += ' WHERE LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ?';
    params.push(`%${clean}%`, `%${clean}%`);
  }
  sql += ' ORDER BY c.updated_at DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params);
  return rows.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes || '',
    preferences: c.preferences || '',
    posBills: Number(c.pos_bills || 0),
    totalSpent: Number(c.total_spent || 0),
    updatedAt: c.updated_at
  }));
}

function saveCustomer(body = {}) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!name || !phone) throw new Error('Customer name and phone are required');
  const notes = String(body.notes || '').trim();
  const preferences = String(body.preferences || '').trim();
  const id = String(body.id || `cust_${phone.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString(36)}`).trim();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = excluded.name,
      notes = excluded.notes,
      preferences = excluded.preferences,
      updated_at = excluded.updated_at
  `).run(id, phone, name, notes, preferences, now, now);

  queryD1(
    `INSERT INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       name = excluded.name, notes = excluded.notes, preferences = excluded.preferences, updated_at = excluded.updated_at`,
    [id, phone, name, notes, preferences, now, now]
  ).catch(() => {});

  return { id, name, phone, notes, preferences, posBills: 0, totalSpent: 0, updatedAt: now };
}

function getTransactions(limit = 250) {
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 250));
  const rows = db.prepare('SELECT * FROM pos_transactions ORDER BY date DESC LIMIT ?').all(safeLimit);
  return rows.map(mapTxRow);
}

function saveTransaction(rawTx = {}) {
  const settings = getSettings();
  const tx = normalizeTransactionPayload(rawTx, settings.taxRatePercent);
  const now = new Date().toISOString();

  if (tx.customerPhone) {
    db.prepare(`
      INSERT INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
      VALUES (?, ?, ?, '', '', ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(tx.customerId || `cust_${Date.now().toString(36)}`, tx.customerPhone, tx.customerName, now, now);
  }

  const existing = db.prepare('SELECT id FROM pos_transactions WHERE id = ?').get(tx.id);

  db.prepare(`
    INSERT INTO pos_transactions (
      id, session_id, customer_id, customer_name, customer_phone, cashier_name,
      items_json, subtotal, discount, tax_rate, tax_amount, total,
      payment_method, amount_paid, change_due, status, notes, date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      notes = excluded.notes
  `).run(
    tx.id, tx.sessionId, tx.customerId, tx.customerName, tx.customerPhone, tx.cashierName,
    JSON.stringify(tx.items), tx.subtotal, tx.discount, tx.taxRate, tx.taxAmount, tx.total,
    tx.paymentMethod, tx.amountPaid, tx.changeDue, tx.status, tx.notes, tx.date, tx.createdAt
  );

  if (!existing && tx.status !== 'VOIDED') {
    const stockStmt = db.prepare('UPDATE pos_items SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?');
    for (const li of tx.items) {
      if (li.itemType === 'Product' && li.id) {
        stockStmt.run(li.qty, now, li.id);
      }
    }
  }

  queryD1(
    `INSERT INTO pos_transactions (
      id, session_id, customer_id, customer_name, customer_phone, cashier_name,
      items_json, subtotal, discount, tax_rate, tax_amount, total,
      payment_method, amount_paid, change_due, status, notes, date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, notes = excluded.notes`,
    [
      tx.id, tx.sessionId, tx.customerId, tx.customerName, tx.customerPhone, tx.cashierName,
      JSON.stringify(tx.items), tx.subtotal, tx.discount, tx.taxRate, tx.taxAmount, tx.total,
      tx.paymentMethod, tx.amountPaid, tx.changeDue, tx.status, tx.notes, tx.date, tx.createdAt
    ]
  ).catch(() => {});

  return tx;
}

function voidTransaction(txId) {
  const cleanId = String(txId || '').trim();
  const existing = db.prepare('SELECT * FROM pos_transactions WHERE id = ?').get(cleanId);
  if (!existing) throw new Error('Transaction not found');
  if (existing.status !== 'VOIDED') {
    db.prepare("UPDATE pos_transactions SET status = 'VOIDED' WHERE id = ?").run(cleanId);
    let items = [];
    try { items = JSON.parse(existing.items_json || '[]'); } catch (_) {}
    const restoreStmt = db.prepare('UPDATE pos_items SET stock = stock + ? WHERE id = ?');
    for (const li of items) {
      if ((li.itemType || li.item_type) === 'Product' && li.id) {
        restoreStmt.run(Math.max(1, Number(li.qty) || 1), li.id);
      }
    }
    queryD1("UPDATE pos_transactions SET status = 'VOIDED' WHERE id = ?", [cleanId]).catch(() => {});
  }
  return { voidedId: cleanId };
}

function getSettings() {
  const row = db.prepare("SELECT value FROM pos_settings WHERE key = 'store_settings'").get();
  if (row?.value) {
    try {
      return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(row.value) };
    } catch (_) {}
  }
  return { ...DEFAULT_STORE_SETTINGS };
}

function saveSettings(body = {}) {
  const current = getSettings();
  const settings = {
    ...current,
    storeName: String(body.storeName ?? current.storeName).trim(),
    storeTagline: String(body.storeTagline ?? current.storeTagline).trim(),
    storeAddress: String(body.storeAddress ?? current.storeAddress).trim(),
    storePhone: String(body.storePhone ?? current.storePhone).trim(),
    currencySymbol: String(body.currencySymbol ?? current.currencySymbol).trim(),
    taxRatePercent: Math.max(0, Math.min(100, Number(body.taxRatePercent ?? current.taxRatePercent) || 0)),
    receiptWidth: body.receiptWidth === '58mm' ? '58mm' : '80mm',
    receiptFooter: String(body.receiptFooter ?? current.receiptFooter).trim()
  };
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pos_settings (key, value, updated_at)
    VALUES ('store_settings', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(settings), now);

  return settings;
}

function getBootstrapData() {
  const items = getItems();
  const transactions = getTransactions(250);
  const customers = getCustomers();
  const settings = getSettings();
  const { isConfigured } = getD1Config();
  return {
    ok: true,
    mode: isConfigured ? 'hybrid_d1_sqlite' : 'local_sqlite',
    items,
    transactions,
    customers,
    settings,
    analytics: computePosAnalytics(transactions, items)
  };
}

module.exports = {
  db,
  getItems,
  saveItem,
  getCustomers,
  saveCustomer,
  getTransactions,
  saveTransaction,
  voidTransaction,
  getSettings,
  saveSettings,
  getBootstrapData,
  buildSalesCsvExport,
  buildInventoryCsvExport
};
