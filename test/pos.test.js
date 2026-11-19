const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../shared.mjs');
const storage = require('../storage.js');
const mw = require('../functions/_middleware.js');
const edgeApi = require('../functions/api/[[route]].js');

test('1: PIN security gate locks out IP after 5 failed attempts and signs valid token', async () => {
  const env = { BARBER_PIN: '0101', SESSION_SECRET: 'k'.repeat(64) };
  const ip = '198.51.100.77';
  mw.clearPinFailures(ip);

  for (let i = 1; i <= 4; i++) {
    const res = await mw.onRequest({
      request: new Request('https://pos.macisla.com/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify({ pin: '9999' })
      }),
      env,
      next: async () => new Response('ok')
    });
    assert.equal(res.status, 401);
  }

  const fifth = await mw.onRequest({
    request: new Request('https://pos.macisla.com/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ pin: '9999' })
    }),
    env,
    next: async () => new Response('ok')
  });
  assert.equal(fifth.status, 429);
  mw.clearPinFailures(ip);

  const secret = mw.getSigningSecret(env, '0101');
  const token = await mw.createSessionToken(secret);
  assert.equal(await mw.verifySessionToken(token, secret), true);
  assert.equal(await mw.verifySessionToken(token, 'wrong'), false);
});

test('2: Inventory stock deduction on product sale and stock restoration on void', () => {
  const itemsBefore = storage.getItems();
  const clay = itemsBefore.find(i => i.sku === 'PRD-401');
  assert.ok(clay, 'Default catalog must include PRD-401 clay product');
  const initialStock = clay.stock;

  const txId = `INV-TEST-${Date.now()}`;
  const saved = storage.saveTransaction({
    id: txId,
    customerName: 'Test Buyer',
    customerPhone: '+62811000999',
    cashierName: 'Andi (Senior Barber)',
    items: [
      { id: clay.id, sku: clay.sku, name: clay.name, category: clay.category, itemType: 'Product', price: clay.price, qty: 2 }
    ],
    discount: 10000,
    paymentMethod: 'Cash',
    amountPaid: 300000
  });

  assert.equal(saved.subtotal, clay.price * 2);
  assert.equal(saved.total, clay.price * 2 - 10000);

  const afterSale = storage.getItems().find(i => i.sku === 'PRD-401');
  assert.equal(afterSale.stock, initialStock - 2, 'Product stock must decrement by sold quantity');

  // Void transaction and verify stock is restored
  storage.voidTransaction(txId);
  const afterVoid = storage.getItems().find(i => i.sku === 'PRD-401');
  assert.equal(afterVoid.stock, initialStock, 'Voiding bill must restore product stock');

  // Cleanup test rows
  storage.db.prepare('DELETE FROM pos_transactions WHERE id = ?').run(txId);
  storage.db.prepare('DELETE FROM customers WHERE phone = ?').run('+62811000999');
});

test('3: Analytics calculation and RFC 4180 CSV formula-injection escaping', () => {
  assert.equal(shared.escapeCsvCell('=1+1'), '"\'=1+1"');
  assert.equal(shared.escapeCsvCell('@SUM(A1)'), '"\'@SUM(A1)"');

  const sampleTx = [
    {
      id: 'INV-1',
      status: 'COMPLETED',
      date: new Date().toISOString(),
      customerName: 'Reza',
      cashierName: 'Andi',
      paymentMethod: 'QRIS',
      subtotal: 85000,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 85000,
      amountPaid: 85000,
      changeDue: 0,
      items: [{ sku: 'SVC-101', name: 'Signature Haircut', category: 'Haircuts & Styling', price: 85000, qty: 1 }]
    }
  ];

  const analytics = shared.computePosAnalytics(sampleTx, shared.DEFAULT_POS_ITEMS);
  assert.equal(analytics.totalBills, 1);
  assert.equal(analytics.totalRevenue, 85000);
  assert.equal(analytics.byMethod.QRIS, 85000);

  const csv = shared.buildSalesCsvExport(sampleTx);
  assert.ok(csv.csvContent.includes('"Invoice ID","Status"'));
  assert.ok(csv.csvContent.includes('"INV-1","COMPLETED"'));
});

test('4: Cloudflare Pages Edge Router (/api/pos/bootstrap and /api/pos/transactions)', async () => {
  const bootstrapRes = await edgeApi.onRequest({
    request: new Request('https://pos.macisla.com/api/pos/bootstrap'),
    env: {}
  });
  assert.equal(bootstrapRes.status, 200);
  const bData = await bootstrapRes.json();
  assert.equal(bData.ok, true);
  assert.ok(Array.isArray(bData.items) && bData.items.length >= 10);
});
