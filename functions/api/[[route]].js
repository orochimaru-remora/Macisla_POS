/**
 * Cloudflare Pages Functions — Unified POS API Router for pos.macisla.com
 * Bindings:
 * - env.DB: Cloudflare D1 Database (`macisla` UUID: 9d540277-0b77-42eb-bbea-405145543d95)
 * - env.BUCKET: Cloudflare R2 Bucket (`macisla`)
 */

import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_POS_ITEMS,
  normalizeTransactionPayload,
  computePosAnalytics,
  buildSalesCsvExport,
  buildInventoryCsvExport
} from '../../shared.mjs';

const ALLOWED_ORIGINS = [
  'https://pos.macisla.com',
  'https://app.macisla.com',
  'https://macisla.com',
  'https://macisla.pages.dev',
  'http://localhost:3000',
  'http://localhost:3088',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3088'
];

function corsHeaders(origin = '') {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.pages.dev'));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://pos.macisla.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin)
    }
  });
}

let d1Ready = false;
async function ensurePosD1Tables(db) {
  if (!db || d1Ready) return;
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          phone TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          notes TEXT DEFAULT '',
          preferences TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS pos_items (
          id TEXT PRIMARY KEY,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          item_type TEXT NOT NULL DEFAULT 'Service',
          cost_price INTEGER NOT NULL DEFAULT 0,
          price INTEGER NOT NULL,
          stock INTEGER NOT NULL DEFAULT 0,
          min_stock INTEGER NOT NULL DEFAULT 5,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS pos_transactions (
          id TEXT PRIMARY KEY,
          session_id TEXT DEFAULT '',
          customer_id TEXT DEFAULT '',
          customer_name TEXT NOT NULL,
          customer_phone TEXT DEFAULT '',
          cashier_name TEXT DEFAULT 'General Counter',
          items_json TEXT NOT NULL,
          subtotal INTEGER NOT NULL,
          discount INTEGER NOT NULL DEFAULT 0,
          tax_rate REAL NOT NULL DEFAULT 0,
          tax_amount INTEGER NOT NULL DEFAULT 0,
          total INTEGER NOT NULL,
          payment_method TEXT NOT NULL,
          amount_paid INTEGER NOT NULL,
          change_due INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'COMPLETED',
          notes TEXT DEFAULT '',
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS pos_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_pos_items_category ON pos_items(category)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_pos_tx_date ON pos_transactions(date DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_pos_tx_customer_phone ON pos_transactions(customer_phone)')
    ]);

    const countRow = await db.prepare('SELECT COUNT(*) AS count FROM pos_items').first();
    if (!countRow || Number(countRow.count) === 0) {
      const now = new Date().toISOString();
      const seedStmts = DEFAULT_POS_ITEMS.map(item =>
        db.prepare(`
          INSERT OR IGNORE INTO pos_items (
            id, sku, name, category, item_type, cost_price, price, stock, min_stock, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          item.id, item.sku, item.name, item.category, item.itemType,
          item.costPrice, item.price, item.stock, item.minStock, 1, now, now
        )
      );
      await db.batch(seedStmts);
    }
    d1Ready = true;
  } catch (err) {
    console.warn('[D1 POS] Table initialization warning:', err);
  }
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

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const origin = request.headers.get('Origin') || '';

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    if (env.DB) {
      await ensurePosD1Tables(env.DB);
    }

    // 1. GET /api/pos/bootstrap (All-in-one POS hydration)
    if (pathname === '/api/pos/bootstrap' && method === 'GET') {
      if (!env.DB) {
        return jsonResponse({
          ok: true,
          mode: 'edge_memory_fallback',
          items: DEFAULT_POS_ITEMS,
          transactions: [],
          customers: [],
          settings: DEFAULT_STORE_SETTINGS,
          analytics: computePosAnalytics([], DEFAULT_POS_ITEMS)
        }, 200, origin);
      }

      const [itemsRes, txRes, custRes, setRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM pos_items WHERE active = 1 ORDER BY category ASC, name ASC').all(),
        env.DB.prepare('SELECT * FROM pos_transactions ORDER BY date DESC LIMIT 250').all(),
        env.DB.prepare(`
          SELECT c.*,
            (SELECT COUNT(*) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS pos_bills,
            (SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS total_spent
          FROM customers c
          ORDER BY c.updated_at DESC
          LIMIT 200
        `).all(),
        env.DB.prepare("SELECT value FROM pos_settings WHERE key = 'store_settings'").first()
      ]);

      const items = (itemsRes.results || []).map(mapItemRow);
      const transactions = (txRes.results || []).map(mapTxRow);
      const customers = (custRes.results || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes || '',
        preferences: c.preferences || '',
        posBills: Number(c.pos_bills || 0),
        totalSpent: Number(c.total_spent || 0),
        updatedAt: c.updated_at
      }));

      let settings = { ...DEFAULT_STORE_SETTINGS };
      if (setRes?.value) {
        try { settings = { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(setRes.value) }; } catch (_) {}
      }

      return jsonResponse({
        ok: true,
        mode: 'cloudflare_d1',
        r2Bound: Boolean(env.BUCKET),
        items: items.length > 0 ? items : DEFAULT_POS_ITEMS,
        transactions,
        customers,
        settings,
        analytics: computePosAnalytics(transactions, items.length > 0 ? items : DEFAULT_POS_ITEMS)
      }, 200, origin);
    }

    // 2. GET & POST /api/pos/items
    if (pathname === '/api/pos/items' && method === 'GET') {
      if (!env.DB) return jsonResponse({ ok: true, items: DEFAULT_POS_ITEMS }, 200, origin);
      const res = await env.DB.prepare('SELECT * FROM pos_items WHERE active = 1 ORDER BY category ASC, name ASC').all();
      const items = (res.results || []).map(mapItemRow);
      return jsonResponse({ ok: true, items: items.length ? items : DEFAULT_POS_ITEMS }, 200, origin);
    }

    if (pathname === '/api/pos/items' && method === 'POST') {
      if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding (env.DB) is not available' }, 503, origin);
      const body = await request.json().catch(() => ({}));
      const now = new Date().toISOString();

      if (body.action === 'delete' && body.id) {
        await env.DB.prepare('DELETE FROM pos_items WHERE id = ?').bind(String(body.id).trim()).run();
        return jsonResponse({ ok: true, deletedId: body.id }, 200, origin);
      }

      if (body.action === 'adjust_stock' && body.id) {
        const delta = Math.round(Number(body.delta) || 0);
        await env.DB.prepare('UPDATE pos_items SET stock = MAX(0, stock + ?), updated_at = ? WHERE id = ?')
          .bind(delta, now, String(body.id).trim())
          .run();
        const updated = await env.DB.prepare('SELECT * FROM pos_items WHERE id = ?').bind(String(body.id).trim()).first();
        return jsonResponse({ ok: true, item: updated ? mapItemRow(updated) : null }, 200, origin);
      }

      const name = String(body.name || '').trim();
      if (!name) return jsonResponse({ ok: false, error: 'Item name is required' }, 400, origin);
      const sku = String(body.sku || `SKU-${Date.now().toString(36).toUpperCase()}`).trim().toUpperCase();
      const category = String(body.category || 'Haircuts & Styling').trim();
      const itemType = (body.itemType || body.item_type) === 'Product' ? 'Product' : 'Service';
      const costPrice = Math.max(0, Math.round(Number(body.costPrice ?? body.cost_price) || 0));
      const price = Math.max(0, Math.round(Number(body.price) || 0));
      const stock = itemType === 'Product' ? Math.max(0, Math.round(Number(body.stock) || 0)) : 999;
      const minStock = itemType === 'Product' ? Math.max(0, Math.round(Number(body.minStock ?? body.min_stock ?? 5))) : 0;
      const id = String(body.id || `itm-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).trim();

      await env.DB.prepare(`
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
      `).bind(id, sku, name, category, itemType, costPrice, price, stock, minStock, now, now).run();

      return jsonResponse({
        ok: true,
        item: { id, sku, name, category, itemType, costPrice, price, stock, minStock, active: 1 }
      }, 200, origin);
    }

    // 3. GET & POST /api/pos/customers
    if (pathname === '/api/pos/customers' && method === 'GET') {
      if (!env.DB) return jsonResponse({ ok: true, customers: [] }, 200, origin);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      let sql = `
        SELECT c.*,
          (SELECT COUNT(*) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS pos_bills,
          (SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t WHERE t.customer_phone = c.phone AND t.status != 'VOIDED') AS total_spent
        FROM customers c
      `;
      const params = [];
      if (q) {
        sql += ' WHERE LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ?';
        params.push(`%${q}%`, `%${q}%`);
      }
      sql += ' ORDER BY c.updated_at DESC LIMIT 200';
      const res = await env.DB.prepare(sql).bind(...params).all();
      const customers = (res.results || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes || '',
        preferences: c.preferences || '',
        posBills: Number(c.pos_bills || 0),
        totalSpent: Number(c.total_spent || 0),
        updatedAt: c.updated_at
      }));
      return jsonResponse({ ok: true, customers }, 200, origin);
    }

    if (pathname === '/api/pos/customers' && method === 'POST') {
      if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding is not available' }, 503, origin);
      const body = await request.json().catch(() => ({}));
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      if (!name || !phone) {
        return jsonResponse({ ok: false, error: 'Customer name and phone are required' }, 400, origin);
      }
      const notes = String(body.notes || '').trim();
      const preferences = String(body.preferences || '').trim();
      const id = String(body.id || `cust_${phone.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString(36)}`).trim();
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone) DO UPDATE SET
          name = excluded.name,
          notes = excluded.notes,
          preferences = excluded.preferences,
          updated_at = excluded.updated_at
      `).bind(id, phone, name, notes, preferences, now, now).run();

      return jsonResponse({
        ok: true,
        customer: { id, name, phone, notes, preferences, posBills: 0, totalSpent: 0, updatedAt: now }
      }, 200, origin);
    }

    // 4. GET & POST /api/pos/transactions
    if (pathname === '/api/pos/transactions' && method === 'GET') {
      if (!env.DB) return jsonResponse({ ok: true, transactions: [] }, 200, origin);
      const res = await env.DB.prepare('SELECT * FROM pos_transactions ORDER BY date DESC LIMIT 300').all();
      return jsonResponse({ ok: true, transactions: (res.results || []).map(mapTxRow) }, 200, origin);
    }

    if (pathname === '/api/pos/transactions' && method === 'POST') {
      if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding is not available' }, 503, origin);
      const body = await request.json().catch(() => ({}));

      // Void / Refund Bill & restore product stock
      if (body.action === 'void' && body.id) {
        const txId = String(body.id).trim();
        const existing = await env.DB.prepare('SELECT * FROM pos_transactions WHERE id = ?').bind(txId).first();
        if (!existing) return jsonResponse({ ok: false, error: 'Transaction not found' }, 404, origin);
        if (existing.status !== 'VOIDED') {
          await env.DB.prepare("UPDATE pos_transactions SET status = 'VOIDED' WHERE id = ?").bind(txId).run();
          let items = [];
          try { items = JSON.parse(existing.items_json || '[]'); } catch (_) {}
          for (const li of items) {
            if ((li.itemType || li.item_type) === 'Product' && li.id) {
              await env.DB.prepare('UPDATE pos_items SET stock = stock + ? WHERE id = ?')
                .bind(Math.max(1, Number(li.qty) || 1), li.id)
                .run();
            }
          }
        }
        return jsonResponse({ ok: true, voidedId: txId }, 200, origin);
      }

      const persistSale = async (rawTx) => {
        const tx = normalizeTransactionPayload(rawTx);
        const now = new Date().toISOString();

        if (tx.customerPhone) {
          await env.DB.prepare(`
            INSERT INTO customers (id, phone, name, notes, preferences, created_at, updated_at)
            VALUES (?, ?, ?, '', '', ?, ?)
            ON CONFLICT(phone) DO UPDATE SET
              name = excluded.name,
              updated_at = excluded.updated_at
          `).bind(tx.customerId || `cust_${Date.now().toString(36)}`, tx.customerPhone, tx.customerName, now, now).run();
        }

        const alreadyExists = await env.DB.prepare('SELECT id FROM pos_transactions WHERE id = ?').bind(tx.id).first();

        await env.DB.prepare(`
          INSERT INTO pos_transactions (
            id, session_id, customer_id, customer_name, customer_phone, cashier_name,
            items_json, subtotal, discount, tax_rate, tax_amount, total,
            payment_method, amount_paid, change_due, status, notes, date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            notes = excluded.notes
        `).bind(
          tx.id, tx.sessionId, tx.customerId, tx.customerName, tx.customerPhone, tx.cashierName,
          JSON.stringify(tx.items), tx.subtotal, tx.discount, tx.taxRate, tx.taxAmount, tx.total,
          tx.paymentMethod, tx.amountPaid, tx.changeDue, tx.status, tx.notes, tx.date, tx.createdAt
        ).run();

        if (!alreadyExists && tx.status !== 'VOIDED') {
          for (const li of tx.items) {
            if (li.itemType === 'Product' && li.id) {
              await env.DB.prepare('UPDATE pos_items SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?')
                .bind(li.qty, now, li.id)
                .run();
            }
          }
        }

        // Archive receipt JSON to R2 if bound
        if (env.BUCKET) {
          try {
            const day = tx.date.slice(0, 10);
            await env.BUCKET.put(`pos-receipts/${day}/${tx.id}.json`, JSON.stringify(tx, null, 2), {
              httpMetadata: { contentType: 'application/json' }
            });
          } catch (_) {}
        }

        return tx;
      };

      if (Array.isArray(body.transactions)) {
        const synced = [];
        for (const t of body.transactions) {
          synced.push(await persistSale(t));
        }
        return jsonResponse({ ok: true, syncedCount: synced.length, transactions: synced }, 200, origin);
      }

      const transaction = await persistSale(body);
      return jsonResponse({ ok: true, transaction }, 200, origin);
    }

    // 5. GET & POST /api/pos/settings
    if (pathname === '/api/pos/settings' && method === 'GET') {
      if (!env.DB) return jsonResponse({ ok: true, settings: DEFAULT_STORE_SETTINGS }, 200, origin);
      const row = await env.DB.prepare("SELECT value FROM pos_settings WHERE key = 'store_settings'").first();
      let settings = { ...DEFAULT_STORE_SETTINGS };
      if (row?.value) {
        try { settings = { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(row.value) }; } catch (_) {}
      }
      return jsonResponse({ ok: true, settings }, 200, origin);
    }

    if (pathname === '/api/pos/settings' && method === 'POST') {
      if (!env.DB) return jsonResponse({ ok: false, error: 'D1 binding is not available' }, 503, origin);
      const body = await request.json().catch(() => ({}));
      const settings = {
        ...DEFAULT_STORE_SETTINGS,
        storeName: String(body.storeName || DEFAULT_STORE_SETTINGS.storeName).trim(),
        storeTagline: String(body.storeTagline || DEFAULT_STORE_SETTINGS.storeTagline).trim(),
        storeAddress: String(body.storeAddress || DEFAULT_STORE_SETTINGS.storeAddress).trim(),
        storePhone: String(body.storePhone || DEFAULT_STORE_SETTINGS.storePhone).trim(),
        currencySymbol: String(body.currencySymbol || 'Rp').trim(),
        taxRatePercent: Math.max(0, Math.min(100, Number(body.taxRatePercent) || 0)),
        receiptWidth: body.receiptWidth === '58mm' ? '58mm' : '80mm',
        receiptFooter: String(body.receiptFooter || DEFAULT_STORE_SETTINGS.receiptFooter).trim()
      };
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO pos_settings (key, value, updated_at)
        VALUES ('store_settings', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(JSON.stringify(settings), now).run();

      return jsonResponse({ ok: true, settings }, 200, origin);
    }

    // 6. GET /api/pos/export/sales.csv & /api/pos/export/inventory.csv
    if (pathname === '/api/pos/export/sales.csv' && method === 'GET') {
      let txList = [];
      if (env.DB) {
        const res = await env.DB.prepare('SELECT * FROM pos_transactions ORDER BY date DESC LIMIT 5000').all();
        txList = (res.results || []).map(mapTxRow);
      }
      const csv = buildSalesCsvExport(txList);
      return new Response(csv.csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csv.filename}"`,
          ...corsHeaders(origin)
        }
      });
    }

    if (pathname === '/api/pos/export/inventory.csv' && method === 'GET') {
      let items = DEFAULT_POS_ITEMS;
      if (env.DB) {
        const res = await env.DB.prepare('SELECT * FROM pos_items WHERE active = 1 ORDER BY category ASC, name ASC').all();
        if (res.results?.length) items = res.results.map(mapItemRow);
      }
      const csv = buildInventoryCsvExport(items);
      return new Response(csv.csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csv.filename}"`,
          ...corsHeaders(origin)
        }
      });
    }

    return jsonResponse({ ok: false, error: `Route not found: ${pathname}` }, 404, origin);
  } catch (err) {
    console.error('[POS Edge API] Error:', err);
    return jsonResponse({ ok: false, error: err.message || 'Internal server error' }, 500, origin);
  }
}
