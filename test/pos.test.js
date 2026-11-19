import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';
import { onRequest } from '../functions/[[path]].js';
import { onRequest as authMiddleware } from '../functions/_middleware.js';

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
    assert.equal(login.data.plan, 'premium');
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
    assert.equal(tileRes.data.items.length, 3);

    const essential = tileRes.data.items.find((i) => i.itemid === 'MCS-001');
    assert.ok(essential);
    assert.equal(essential.selling_price, 100000);

    // 6. Save a new sale and verify it appears in getLatestSales & GET /sales
    const createSale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customer_id: '665000000000000000000301',
        customer_name: 'Walk-in Customer',
        payment_mode: 'QRIS',
        payment_status: 'Paid',
        sales_total: essential.selling_price * 4,
        items: [
          {
            item_id: essential._id,
            item_name: essential.name,
            item_quantity: 4,
            selling_price: essential.selling_price,
            item_price_total: essential.selling_price * 4,
            company_price: essential.company_price,
          },
        ],
      }),
    }).then((r) => r.json());
    assert.equal(createSale.type, 'success');
    assert.ok(createSale.data.sales_id);

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

    // 8. Unlocked premium reports return real aggregated D1/SQLite data
    const salesRep = await fetch(`${base}/sales/salesReports?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(salesRep.type, 'success');
    assert.ok(salesRep.data.total >= 3);
    assert.ok(salesRep.data.list[0].items_total > 0);

    const summaryRep = await fetch(`${base}/sales/salesSummaryReports`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(summaryRep.type, 'success');
    assert.ok(summaryRep.data.net_sales >= 800000);
    assert.ok(summaryRep.data.gross_profit > 0);

    const dailyRep = await fetch(`${base}/sales/dailySalesReports`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(dailyRep.type, 'success');
    assert.ok(dailyRep.data.product_details.length >= 3);
    assert.ok(dailyRep.data.payment_details.length >= 2);

    const itemRep = await fetch(`${base}/sales/itemSalesReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(itemRep.type, 'success');
    assert.ok(itemRep.data.list[0].total_amount > 0);

    const stockRep = await fetch(`${base}/items/itemStockReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(stockRep.type, 'success');
    assert.ok(stockRep.data.selling_total > 0);

    const catRep = await fetch(`${base}/sales/categorySalesReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(catRep.type, 'success');
    assert.ok(catRep.data.total >= 2);

    const custRep = await fetch(`${base}/sales/customerSalesReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(custRep.type, 'success');
    assert.ok(custRep.data.total >= 2);

    const payTypeRep = await fetch(`${base}/sales/paymentSaleTypeReport`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(payTypeRep.type, 'success');
    assert.ok(payTypeRep.data.payment.length >= 2);

    const payTxRep = await fetch(`${base}/sales/paymentSalesTranscationReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(payTxRep.type, 'success');
    assert.ok(payTxRep.data.list[0].updated_date.$date.$numberLong);

    const userRep = await fetch(`${base}/sales/userReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(userRep.type, 'success');
    assert.ok(userRep.data.summary.sales >= 3);

    const regRep = await fetch(`${base}/registers/registerReportTable?page=1&limit=10`, { headers: authHeaders }).then((r) => r.json());
    assert.equal(regRep.type, 'success');
    assert.ok(Array.isArray(regRep.data.data));
    assert.ok(regRep.data.list[0].register_amount > 500000);
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

test('Auto-login removes login wall, lands on #/sales/new, and auto-syncs edited items/categories to seed-data.mjs', async () => {
  const dir = createTempDir();
  const tempSeedPath = path.join(dir, 'seed-data.mjs');
  const { server } = startServer({ port: 0, host: '127.0.0.1', dataDir: dir, seedFilePath: tempSeedPath });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Root index.html redirects straight to POS billing screen (#/sales/new)
    const idxHtml = await fetch(`${base}/`).then((r) => r.text());
    assert.match(idxHtml, /dashboard\.html#\/sales\/new/);

    const dashHtml = await fetch(`${base}/dashboard.html`).then((r) => r.text());
    assert.match(dashHtml, /ensureAutoPosnicLogin/);

    // 2. Adding a new item in the UI auto-writes seed-data.mjs on disk
    const added = await fetch(`${base}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Macisla Signature Espresso',
        selling_price: 42000,
        company_price: 14000,
        category_name: 'Beverages',
        image: [],
      }),
    }).then((r) => r.json());
    assert.equal(added.type, 'success');
    assert.equal(added.data.image, 'item.svg');

    assert.equal(fs.existsSync(tempSeedPath), true);
    const seedSrc = fs.readFileSync(tempSeedPath, 'utf8');
    assert.match(seedSrc, /Macisla Signature Espresso/);
    assert.match(seedSrc, /42000/);

    // 2b. Deleting an item via Posnic's DELETE /items { data: [id] } removes it from DB & seed-data.mjs
    const delRes = await fetch(`${base}/items`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [added.data._id] }),
    }).then((r) => r.json());
    assert.equal(delRes.type, 'success');
    assert.equal(delRes.data.count, 1);

    const afterDel = await fetch(`${base}/items?page=1&limit=100`).then((r) => r.json());
    assert.equal(afterDel.data.list.some((it) => it._id === added.data._id), false);
    const seedAfterDel = fs.readFileSync(tempSeedPath, 'utf8');
    assert.doesNotMatch(seedAfterDel, /Macisla Signature Espresso/);

    // 2c. Bulk delete via PosnicPro.deleteTableRowData: DELETE /categories/delete { data: [id] }
    const catAdded = await fetch(`${base}/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Temp Category' }),
    }).then((r) => r.json());
    const catDel = await fetch(`${base}/categories/delete`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [catAdded.data._id] }),
    }).then((r) => r.json());
    assert.equal(catDel.type, 'success');
    assert.equal(catDel.data.count, 1);

    // 3. Auxiliary subroutes (priceSheet / ssoClientLogin) do NOT pollute items or users
    await fetch(`${base}/items/priceSheet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'pricePreference' }),
    });
    await fetch(`${base}/users/ssoClientLogin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const allItems = await fetch(`${base}/items?page=1&limit=100`).then((r) => r.json());
    assert.equal(allItems.data.list.some((it) => it._id === 'priceSheet'), false);
    const allUsers = await fetch(`${base}/users?page=1&limit=100`).then((r) => r.json());
    assert.equal(allUsers.data.list.some((u) => u._id === 'ssoClientLogin'), false);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Cloudflare edge middleware protects pos.macisla.com via POS_ACCESS_KEY or Cloudflare Access', async () => {
  const env = { POS_ACCESS_KEY: 'shop-secret-999' };
  const passNext = async () => new Response('allowed', { status: 200 });

  // 1. Unauthenticated browser & API requests are blocked with 401
  const blockedPage = await authMiddleware({
    request: new Request('https://pos.macisla.com/dashboard.html', { headers: { accept: 'text/html' } }),
    env,
    next: passNext,
  });
  assert.equal(blockedPage.status, 401);
  assert.match(await blockedPage.text(), /Shop passcode/i);

  const blockedApi = await authMiddleware({
    request: new Request('https://pos.macisla.com/sales'),
    env,
    next: passNext,
  });
  assert.equal(blockedApi.status, 401);

  // 2. Cloudflare Zero Trust Access header passes straight through
  const cfAccessOk = await authMiddleware({
    request: new Request('https://pos.macisla.com/dashboard.html', {
      headers: { 'cf-access-authenticated-user-email': 'owner@macisla.com' },
    }),
    env,
    next: passNext,
  });
  assert.equal(cfAccessOk.status, 200);

  // 3. Valid passcode unlock sets 30-day HttpOnly cookie and unlocks subsequent requests
  const unlockRes = await authMiddleware({
    request: new Request('https://pos.macisla.com/__pos_unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'shop-secret-999' }),
    }),
    env,
    next: passNext,
  });
  assert.equal(unlockRes.status, 303);
  const setCookie = unlockRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /macisla_pos_auth=/);
  assert.match(setCookie, /HttpOnly/i);

  const cookiePair = setCookie.split(';')[0];
  const unlockedApi = await authMiddleware({
    request: new Request('https://pos.macisla.com/sales', { headers: { cookie: cookiePair } }),
    env,
    next: passNext,
  });
  assert.equal(unlockedApi.status, 200);
});
