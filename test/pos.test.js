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

    // 2. Runtime-info returns local mode and omits wildcard CORS (#2)
    const runtimeRaw = await fetch(`${base}/runtime-info`);
    assert.equal(runtimeRaw.headers.get('access-control-allow-origin'), null);
    const runtime = await runtimeRaw.json();
    assert.equal(runtime.demo, false);
    assert.equal(runtime.mode, 'local');
    assert.equal(runtime.edition, 'local');

    // Client error beacon & unknown CRUD collections must not write to pos_docs (#2)
    const errRes = await fetch(`${base}/client-errors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'test error' }),
    });
    assert.equal(errRes.status, 200);
    assert.equal((await store.list('client-errors')).length, 0);

    const unknownWrite = await fetch(`${base}/not_a_collection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ evil: true }),
    });
    assert.equal(unknownWrite.status, 404);
    assert.equal((await store.list('not_a_collection')).length, 0);

    // 3. Starter state: strictly the 3 Macisla services, 0 fake starter sales
    const initialSales = await fetch(`${base}/sales`).then((r) => r.json());
    assert.equal(initialSales.data.total, 0);

    const tileRes = await fetch(`${base}/items/onlineSalesItemsAjaxLists?limit=48&offset=0`).then((r) => r.json());
    assert.equal(tileRes.data.items.length, 3);
    const essential = tileRes.data.items.find((i) => i.itemid === 'MCS-001');
    assert.equal(essential.name, 'The Essential (The AI Precision Cut)');
    assert.equal(essential.selling_price, 100000);

    // Default customer & supplier return customer_*/supplier_* fields expected by PosnicPro (#5)
    const defCust = await fetch(`${base}/setting/getDefaultCustomer`).then((r) => r.json());
    assert.equal(defCust.data.customer.customer_id, '665000000000000000000301');
    assert.equal(defCust.data.customer.customer_phone, '0000000000');
    const defSup = await fetch(`${base}/setting/getDefaultSupplier`).then((r) => r.json());
    assert.equal(defSup.data.supplier.supplier_id, '665000000000000000000401');

    // No plaintext passwords in users API (#6)
    const usersList = await fetch(`${base}/users`).then((r) => r.json());
    assert.equal(usersList.data.list[0].password, undefined);

    // Bracket regex filters succeed safely and honor sibling filters (#7)
    const bracketFilter = encodeURIComponent(JSON.stringify({ name: { $regex: '[' }, category_id: '665000000000000000000201' }));
    const filteredItems = await fetch(`${base}/items?filters=${bracketFilter}`).then((r) => r.json());
    assert.equal(filteredItems.type, 'success');
    assert.equal(filteredItems.data.total, 0);

    // Taxes & Units have tax_id / unit_id + suggestions required by items_v2
    const unitRes = await fetch(`${base}/setting/getUnitAjaxList`).then((r) => r.json());
    assert.ok(Array.isArray(unitRes.suggestions));
    assert.ok(unitRes.suggestions.some((u) => u.unit_id && u.unit_value === 'session'));
    const taxRes = await fetch(`${base}/setting/getTaxAll`).then((r) => r.json());
    assert.ok(taxRes.data.some((t) => t.tax_id));

    // 4. R2/upload security & item edit persistence (#1)
    assert.equal((await fetch(`${base}/r2/other/secret.txt`)).status, 403);
    const svgUpload = await fetch(`${base}/items/uploadItemMultiImage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items_image: [{ name: 'xss.svg', size: 10, data: 'PHN2Zy8+' }] }),
    });
    assert.equal(svgUpload.status, 400);
    const badB64Upload = await fetch(`${base}/items/uploadItemMultiImage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items_image: [{ name: 'bad.png', size: 10, data: '!!!not-base64!!!' }] }),
    });
    assert.equal(badB64Upload.status, 400);

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
    assert.equal(fetchedImg.headers.get('x-content-type-options'), 'nosniff');

    const editRes = await fetch(`${base}/items/${essential._id}/details`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'The Essential Updated',
        selling_price: 115000,
        sku_id: 'MCS-001-U',
        available_quantity: 1,
        cover_image: uploadedPath,
        image: [{ name: uploadedPath, size: 68, cover: 'yes' }],
        tax_type: 'exclusive',
      }),
    }).then((r) => r.json());
    assert.equal(editRes.data.available_quantity, 99);
    await ensureSeeded(store);
    const persisted = await fetch(`${base}/items/getItemDetails?id=${essential._id}`).then((r) => r.json());
    assert.equal(persisted.data.name, 'The Essential Updated');

    // 5. Tracked item sale edit uses delta (no double deduction) & preserves created_date (#3), zero-total & inclusive tax (#4)
    const pomade = await fetch(`${base}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Macisla Clay',
        selling_price: 105000,
        available_quantity: 10,
        inventory: true,
        tax: 5,
        tax_type: 'inclusive',
      }),
    }).then((r) => r.json());
    assert.equal(pomade.data.available_quantity, 10);

    const trackedSale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Walk-in Customer',
        payment_mode: 'Cash',
        sales_total: 315000,
        items: [{ item_id: pomade.data._id, item_name: pomade.data.name, item_quantity: 3, selling_price: 105000, item_price_total: 315000, tax: 5, tax_type: 'inclusive' }],
      }),
    }).then((r) => r.json());
    const afterSell = await fetch(`${base}/items/getItemDetails?id=${pomade.data._id}`).then((r) => r.json());
    assert.equal(afterSell.data.available_quantity, 7);

    const origSale = await fetch(`${base}/sales/${trackedSale.data.sales_id}`).then((r) => r.json());
    await fetch(`${base}/sales/${trackedSale.data.sales_id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sales_description: 'Edited qty 3 -> 4',
        sales_total: 420000,
        items: [{ item_id: pomade.data._id, item_name: pomade.data.name, item_quantity: 4, selling_price: 105000, item_price_total: 420000, tax: 5, tax_type: 'inclusive' }],
      }),
    });
    const afterEditStock = await fetch(`${base}/items/getItemDetails?id=${pomade.data._id}`).then((r) => r.json());
    assert.equal(afterEditStock.data.available_quantity, 6);
    const editedSale = await fetch(`${base}/sales/${trackedSale.data.sales_id}`).then((r) => r.json());
    assert.equal(editedSale.data.created_date, origSale.data.created_date);

    // Daily report uses inclusive tax math cleanly (420000 * 5 / 105 = 20000) (#4)
    const dailyInc = await fetch(`${base}/sales/dailySalesReports`).then((r) => r.json());
    assert.equal(Math.round(dailyInc.data.product_details[0].product_tax), 20000);

    // Explicit sales_total: 0 is preserved for comped sales (#4)
    const zeroSale = await fetch(`${base}/sales`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'VIP Comp',
        sales_total: 0,
        items: [{ item_id: essential._id, item_name: persisted.data.name, item_quantity: 1, selling_price: 115000, item_price_total: 0 }],
      }),
    }).then((r) => r.json());
    const zeroDoc = await fetch(`${base}/sales/${zeroSale.data.sales_id}`).then((r) => r.json());
    assert.equal(zeroDoc.data.sales_total, 0);

    // Bounded listRange respects created_at dates & limits (#8)
    const limited = await store.listRange('sales', { limit: 1 });
    assert.equal(limited.length, 1);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Cloudflare Functions: middleware passes through and [[path]].js uses pos_docs without raw JSON on /dashboard', async () => {
  const mw = await passMiddleware({
    request: new Request('https://macisla-pos.pages.dev/dashboard'),
    env: {},
    next: async () => new Response('allowed', { status: 200 }),
  });
  assert.equal(mw.status, 200);

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
