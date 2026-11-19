import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';
import { onRequest } from '../functions/[[path]].js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'macisla-pos-test-'));
}

test('Original Posnic static UI + full POS login, dashboard, checkout, hold, and stock pipeline', async () => {
  const dir = createTempDir();
  const { server } = startServer({ port: 0, host: '127.0.0.1', dataDir: dir });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Original Posnic HTML & fonts served cleanly
    const loginHtml = await fetch(`${base}/login.html`);
    assert.equal(loginHtml.status, 200);
    const loginBody = await loginHtml.text();
    assert.match(loginBody, /Posnic/i);

    const dashHtml = await fetch(`${base}/dashboard.html`);
    assert.equal(dashHtml.status, 200);

    const fontRes = await fetch(`${base}/fonts/fontawesome-webfont.woff2`);
    assert.equal(fontRes.status, 200);

    // 2. Runtime-info disables Posnic's demo upsell popup ("Making this shop yours?")
    const runtimeRes = await fetch(`${base}/runtime-info`).then((r) => r.json());
    assert.equal(runtimeRes.demo, false);
    assert.equal(runtimeRes.version, '1.9.2');

    // 3. Exact Posnic login sequence: verify -> default branch -> register -> ACL -> settings
    const login = await fetch(`${base}/users/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    }).then((r) => r.json());
    assert.equal(login.type, 'success');
    assert.equal(login.data.usertype, 'super_admin');
    assert.ok(login.data.jwt_token);

    const authHeaders = {
      authorization: `Bearer ${login.data.jwt_token}`,
      'content-type': 'application/json',
    };

    const branchSet = await fetch(`${base}/users/userDefaultBranchSet?id=${login.data.branchId}`, {
      headers: authHeaders,
    }).then((r) => r.json());
    assert.equal(branchSet.type, 'success');
    assert.equal(branchSet.data.branch_name, 'Macisla Main Store');

    const regSelect = await fetch(`${base}/branches/userRegisterBranchSelect?id=${login.data.branchId}`, {
      headers: authHeaders,
    }).then((r) => r.json());
    assert.equal(regSelect.type, 'success');
    assert.equal(regSelect.data.open_register.register_status, 'Opened');

    const acl = await fetch(`${base}/users/getUserAccessDetails`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(acl.type, 'success');
    assert.equal(acl.data.sales.write, true);

    const storeSettings = await fetch(`${base}/branches/getOneStore?id=${login.data.branchId}`, {
      headers: authHeaders,
    }).then((r) => r.json());
    assert.equal(storeSettings.type, 'success');
    assert.ok(Array.isArray(storeSettings.data.register));
    assert.ok(storeSettings.data.sms_auto_send_time.includes(' '));

    // 4. Dashboard overview KPIs & Best Sellers
    const overview = await fetch(`${base}/dashboard/getOverview?filter=day`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(overview.type, 'success');
    assert.ok(overview.data.kpis.total_sales >= 470000);
    assert.ok(overview.data.topItems.length >= 2);

    // 5. POS item tile grid & barcode lookup
    const tileRes = await fetch(`${base}/items/onlineSalesItemsAjaxLists?paginate=true&tile_page=true&limit=48&offset=0`, {
      headers: authHeaders,
    }).then((r) => r.json());
    assert.equal(tileRes.type, 'success');
    assert.equal(tileRes.data.items.length, 10);

    const clay = tileRes.data.items.find((i) => i.itemid === 'MCS-005');
    assert.ok(clay);
    const initialStock = clay.available_quantity;

    // 6. Save a new sale and verify stock decrements + appears in getLatestSales & GET /sales
    const createSale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customer_id: '665000000000000000000301',
        customer_name: 'Walk-in Customer',
        payment_mode: 'QRIS',
        payment_status: 'Paid',
        sales_total: clay.selling_price * 2,
        items: [
          {
            item_id: clay._id,
            item_name: clay.name,
            item_quantity: 2,
            selling_price: clay.selling_price,
            item_price_total: clay.selling_price * 2,
            company_price: clay.company_price,
          },
        ],
      }),
    }).then((r) => r.json());
    assert.equal(createSale.type, 'success');
    assert.ok(createSale.data.sales_id);

    const clayAfter = await fetch(`${base}/items/${clay._id}`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(clayAfter.data.available_quantity, initialStock - 2);

    const latest = await fetch(`${base}/sales/getLatestSales`, { headers: authHeaders }).then((r) => r.json());
    const parsedLatest = JSON.parse(latest.data);
    assert.ok(parsedLatest.some((s) => s.sales_document_id === createSale.data.sales_id));

    // 7. Park / Hold sale
    const holdRes = await fetch(`${base}/sales/hold`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customer_name: 'Parked Customer',
        sales_total: 120000,
        items: [{ item_id: '665000000000000000000101', item_name: 'Signature Gentleman Cut', item_quantity: 1, selling_price: 120000 }],
      }),
    }).then((r) => r.json());
    assert.equal(holdRes.type, 'success');

    const heldList = await fetch(`${base}/sales/getLatestSales?type=hold`, { headers: authHeaders }).then((r) => r.json());
    const parsedHeld = JSON.parse(heldList.data);
    assert.equal(parsedHeld.length, 1);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Cloudflare Pages Function (functions/[[path]].js) passes static assets to next() and routes API to D1', async () => {
  let nextCalled = false;
  await onRequest({
    request: new Request('https://pos.macisla.com/dashboard.html'),
    env: {},
    next: async () => {
      nextCalled = true;
      return new Response('ok');
    },
  });
  assert.equal(nextCalled, true);

  // Mock Cloudflare D1 binding
  const mem = new Map();
  const mockDb = {
    prepare(sql) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO posnic_docs')) {
            mem.set(`${args[0]}:${args[1]}`, args[2]);
          } else if (sql.includes('DELETE FROM posnic_docs')) {
            mem.delete(`${args[0]}:${args[1]}`);
          }
          return { success: true };
        },
        async all() {
          const results = [];
          for (const [k, v] of mem.entries()) {
            if (k.startsWith(`${args[0]}:`)) results.push({ data: v });
          }
          return { results };
        },
        async first() {
          const v = mem.get(`${args[0]}:${args[1]}`);
          return v ? { data: v } : null;
        },
      };
    },
  };

  const res = await onRequest({
    request: new Request('https://pos.macisla.com/dashboard/getOverview?filter=day'),
    env: { DB: mockDb },
    next: async () => new Response('not-called', { status: 404 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.type, 'success');
  assert.ok(body.data.kpis.total_sales > 0);
});
