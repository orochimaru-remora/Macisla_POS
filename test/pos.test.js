import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';
import { onRequest } from '../functions/[[path]].js';
import { onRequest as passMiddleware } from '../functions/_middleware.js';
import { ensureSeeded } from '../posnic-engine.mjs';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'macisla-pos-test-'));
}

test('Zero-login boot, no marketing popups, item editing + R2 upload persistence, and unlocked reports', async () => {
  const dir = createTempDir();
  const { server, store } = startServer({ port: 0, host: '127.0.0.1', dataDir: dir });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Login redirects directly to /dashboard#/sales/new; dashboard injects macisla-boot.js
    const loginRes = await fetch(`${base}/login.html`, { redirect: 'manual' });
    assert.equal(loginRes.status, 302);
    assert.equal(loginRes.headers.get('location'), '/dashboard#/sales/new');

    const dashHtml = await fetch(`${base}/dashboard`).then((r) => r.text());
    assert.match(dashHtml, /\/static\/macisla-boot\.js/);

    const bootJs = await fetch(`${base}/static/macisla-boot.js`).then((r) => r.text());
    assert.match(bootJs, /userplan:\s*'premium'/);
    assert.match(bootJs, /posnic_desktop_nudge_done:\s*'1'/);

    // 2. Runtime-info returns local mode (disables desktop-nudge and demo popups)
    const runtime = await fetch(`${base}/runtime-info`).then((r) => r.json());
    assert.equal(runtime.demo, false);
    assert.equal(runtime.mode, 'local');
    assert.equal(runtime.edition, 'local');

    // 3. Starter state: strictly the 3 Macisla services, 0 fake starter sales
    const initialSales = await fetch(`${base}/sales`).then((r) => r.json());
    assert.equal(initialSales.data.total, 0);

    const tileRes = await fetch(`${base}/items/onlineSalesItemsAjaxLists?limit=48&offset=0`).then((r) => r.json());
    assert.equal(tileRes.data.items.length, 3);
    const essential = tileRes.data.items.find((i) => i.itemid === 'MCS-001');
    assert.equal(essential.name, 'The Essential (The AI Precision Cut)');
    assert.equal(essential.selling_price, 100000);

    // Taxes & Units have tax_id / unit_id + suggestions required by items_v2
    const unitRes = await fetch(`${base}/setting/getUnitAjaxList`).then((r) => r.json());
    assert.ok(Array.isArray(unitRes.suggestions));
    assert.ok(unitRes.suggestions.some((u) => u.unit_id && u.unit_value === 'session'));
    const taxRes = await fetch(`${base}/setting/getTaxAll`).then((r) => r.json());
    assert.ok(taxRes.data.some((t) => t.tax_id));

    // 4. R2/upload multi-image + items/getItemDetails + PUT /items/:id/details persistence
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const uploadRes = await fetch(`${base}/items/uploadItemMultiImage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items_image: [{ name: 'cut.png', size: 68, data: pngBase64, cover: 'yes' }] }),
    }).then((r) => r.json());
    assert.equal(uploadRes.type, 'success');
    const uploadedPath = uploadRes.data[0].name;
    assert.match(uploadedPath, /^\/r2\/pos\/items\//);

    const fetchedImg = await fetch(`${base}${uploadedPath}`);
    assert.equal(fetchedImg.status, 200);

    const detailsBefore = await fetch(`${base}/items/getItemDetails?id=${essential._id}`).then((r) => r.json());
    assert.equal(detailsBefore.type, 'success');
    assert.equal(detailsBefore.data.available_quantity, 99);

    const editRes = await fetch(`${base}/items/${essential._id}/details`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'The Essential Updated',
        selling_price: 115000,
        sku_id: 'MCS-001-U',
        available_quantity: 1, // stripped by /details so live stock (99) is preserved
        cover_image: uploadedPath,
        image: [{ name: uploadedPath, size: 68, cover: 'yes' }],
        tax_type: 'exclusive',
      }),
    }).then((r) => r.json());
    assert.equal(editRes.type, 'success');
    assert.equal(editRes.data.name, 'The Essential Updated');
    assert.equal(editRes.data.selling_price, 115000);
    assert.equal(editRes.data.itemid, 'MCS-001-U');
    assert.equal(editRes.data.available_quantity, 99);
    assert.equal(editRes.data.image, uploadedPath);
    assert.equal(editRes.data.multi_image.length, 1);

    // Re-running ensureSeeded MUST NOT overwrite saved user edits
    await ensureSeeded(store);
    const persisted = await fetch(`${base}/items/getItemDetails?id=${essential._id}`).then((r) => r.json());
    assert.equal(persisted.data.name, 'The Essential Updated');
    assert.equal(persisted.data.selling_price, 115000);

    // Create + Delete temporary item
    const created = await fetch(`${base}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Temp Pomade', selling_price: 90000, image: [] }),
    }).then((r) => r.json());
    assert.equal(created.data.image, 'item.svg');
    const delRes = await fetch(`${base}/items`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [created.data._id] }),
    }).then((r) => r.json());
    assert.equal(delRes.data.count, 1);

    // 5. Sales checkout + hold + cancel + unlocked reports with timezone date filter
    const sale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Walk-in Customer',
        payment_mode: 'QRIS',
        sales_total: 230000,
        items: [{ item_id: essential._id, item_name: persisted.data.name, item_quantity: 2, selling_price: 115000, item_price_total: 230000 }],
      }),
    }).then((r) => r.json());
    assert.equal(sale.type, 'success');

    const hold = await fetch(`${base}/sales/hold`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Parked Guest', sales_total: 130000, items: [{ item_id: '665000000000000000000102', item_name: 'The Signature', item_quantity: 1, selling_price: 130000 }] }),
    }).then((r) => r.json());
    assert.equal(hold.type, 'success');

    const heldList = await fetch(`${base}/sales/getLatestSales?type=hold`).then((r) => r.json());
    assert.equal(JSON.parse(heldList.data).length, 1);

    const overview = await fetch(`${base}/dashboard/getOverview?filter=day`).then((r) => r.json());
    assert.equal(overview.data.kpis.total_sales, 230000);

    for (const reportPath of [
      'sales/salesReports?page=1&limit=10',
      'sales/salesSummaryReports',
      'sales/dailySalesReports',
      'sales/itemSalesReportTable?page=1&limit=10',
      'sales/categorySalesReportTable?page=1&limit=10',
      'sales/customerSalesReportTable?page=1&limit=10',
      'sales/paymentSaleTypeReport',
      'sales/paymentSalesTranscationReportTable?page=1&limit=10',
      'sales/taxSalesReports',
      'sales/userReportTable?page=1&limit=10',
      'items/itemStockReportTable?page=1&limit=10',
      'registers/registerReportTable?page=1&limit=10',
      'expenses/expensesReportTable?page=1&limit=10',
      'receivings/receivingReportTable?page=1&limit=10',
    ]) {
      const rep = await fetch(`${base}/${reportPath}`).then((r) => r.json());
      assert.equal(rep.type, 'success', `${reportPath} failed`);
    }

    const cancelled = await fetch(`${base}/sales/cancel/${sale.data.sales_id}`, { method: 'POST' }).then((r) => r.json());
    assert.equal(cancelled.data.sale_process, 'Cancel');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Cloudflare Functions: middleware passes through and [[path]].js uses pos_docs without raw JSON on /dashboard', async () => {
  const mw = await passMiddleware({
    request: new Request('https://macisla-pos.pages.dev/dashboard'),
    env: { POS_ACCESS_KEY: 'ignored-now' },
    next: async () => new Response('allowed', { status: 200 }),
  });
  assert.equal(mw.status, 200);

  const loginRedirect = await onRequest({
    request: new Request('https://macisla-pos.pages.dev/login'),
    env: {},
    next: async () => new Response('unused'),
  });
  assert.equal(loginRedirect.status, 302);
  assert.match(loginRedirect.headers.get('location'), /\/dashboard#\/sales\/new$/);

  const dashRes = await onRequest({
    request: new Request('https://macisla-pos.pages.dev/dashboard'),
    env: {},
    next: async () => new Response('<html><head><title>Posnic</title></head><body></body></html>', { headers: { 'content-type': 'text/html' } }),
  });
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.headers.get('cache-control'), 'no-store');

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
          if (sql.includes('INSERT INTO pos_docs')) mem.set(`${args[0]}:${args[1]}`, args[2]);
          else if (sql.includes('DELETE FROM pos_docs')) mem.delete(`${args[0]}:${args[1]}`);
          return { success: true };
        },
        async all() {
          const results = [];
          for (const [k, v] of mem.entries()) if (k.startsWith(`${args[0]}:`)) results.push({ data: v });
          return { results };
        },
        async first() {
          const v = mem.get(`${args[0]}:${args[1]}`);
          return v ? { data: v } : null;
        },
      };
    },
  };

  const apiRes = await onRequest({
    request: new Request('https://macisla-pos.pages.dev/items'),
    env: { DB: mockDb },
    next: async () => new Response('not-called', { status: 404 }),
  });
  assert.equal(apiRes.status, 200);
  const items = await apiRes.json();
  assert.equal(items.data.list.length, 3);
});
