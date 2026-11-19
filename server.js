/**
 * Macisla_POS Standalone Local Development & Shop Counter Server
 * Zero external npm dependencies required — uses Node built-in `http`, `fs`, and `node:sqlite`.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const mw = require('./functions/_middleware.js');

// Load optional .dev.vars or .env
for (const envFile of [path.join(__dirname, '.dev.vars'), path.join(__dirname, '.env')]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const idx = t.indexOf('=');
      if (idx > 0) {
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    });
  }
}

const PORT = Number(process.env.POS_PORT || process.env.PORT) || 3088;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, status, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...mw.SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();

  // Block sensitive internal files
  const lower = pathname.toLowerCase();
  if (
    lower.startsWith('/.env') ||
    lower.startsWith('/.dev.vars') ||
    lower.startsWith('/.git') ||
    lower.startsWith('/data') ||
    lower.endsWith('.db') ||
    lower.endsWith('.sql') ||
    lower.endsWith('.toml')
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...mw.SECURITY_HEADERS });
    return res.end('Not Found');
  }

  const expectedPin = mw.getExpectedPin(process.env);
  const signingSecret = expectedPin ? mw.getSigningSecret(process.env, expectedPin) : '';
  const clientIp = req.socket?.remoteAddress || '127.0.0.1';

  // PIN verification route
  if (pathname === '/api/verify-pin' && method === 'POST') {
    if (!expectedPin) {
      return sendJson(res, 503, { ok: false, error: 'PIN not configured' });
    }
    const lock = mw.getPinLockoutStatus(clientIp);
    if (lock.locked) {
      return sendJson(res, 429, {
        ok: false,
        locked: true,
        retryAfterSeconds: lock.retryAfterSeconds,
        error: `Locked for ${Math.ceil(lock.retryAfterSeconds / 60)}m`
      });
    }
    const body = await readJsonBody(req);
    const submitted = String(body.pin || '').trim();
    if (submitted !== expectedPin) {
      const fail = mw.recordPinFailure(clientIp);
      return sendJson(res, fail.locked ? 429 : 401, {
        ok: false,
        locked: fail.locked,
        remainingAttempts: fail.remainingAttempts,
        error: fail.locked ? 'Locked for 15 minutes' : `Invalid PIN (${fail.remainingAttempts} left)`
      });
    }
    mw.clearPinFailures(clientIp);
    const token = await mw.createSessionToken(signingSecret);
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': `${mw.COOKIE_NAME}=${token}; Path=/; Max-Age=${mw.SESSION_DURATION_SEC}; HttpOnly; SameSite=Lax`
    });
  }

  // Enforce PIN gate if BARBER_PIN / POS_PIN is configured
  if (expectedPin) {
    const token = mw.parseCookie(req.headers.cookie || '', mw.COOKIE_NAME);
    const valid = await mw.verifySessionToken(token, signingSecret);
    if (!valid) {
      if (pathname.startsWith('/api/')) {
        return sendJson(res, 401, { ok: false, error: 'POS PIN session required' });
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...mw.SECURITY_HEADERS });
      return res.end(mw.renderPinGateHtml());
    }
  }

  try {
    // 1. GET /api/pos/bootstrap
    if (pathname === '/api/pos/bootstrap' && method === 'GET') {
      return sendJson(res, 200, storage.getBootstrapData());
    }

    // 2. GET & POST /api/pos/items
    if (pathname === '/api/pos/items' && method === 'GET') {
      return sendJson(res, 200, { ok: true, items: storage.getItems() });
    }
    if (pathname === '/api/pos/items' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = storage.saveItem(body);
      return sendJson(res, 200, { ok: true, ...result, items: storage.getItems() });
    }

    // 3. GET & POST /api/pos/customers
    if (pathname === '/api/pos/customers' && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      return sendJson(res, 200, { ok: true, customers: storage.getCustomers(q) });
    }
    if (pathname === '/api/pos/customers' && method === 'POST') {
      const body = await readJsonBody(req);
      const customer = storage.saveCustomer(body);
      return sendJson(res, 200, { ok: true, customer, customers: storage.getCustomers() });
    }

    // 4. GET & POST /api/pos/transactions
    if (pathname === '/api/pos/transactions' && method === 'GET') {
      const limit = url.searchParams.get('limit') || 250;
      return sendJson(res, 200, { ok: true, transactions: storage.getTransactions(limit) });
    }
    if (pathname === '/api/pos/transactions' && method === 'POST') {
      const body = await readJsonBody(req);
      if (body.action === 'void' && body.id) {
        const out = storage.voidTransaction(body.id);
        return sendJson(res, 200, { ok: true, ...out });
      }
      if (Array.isArray(body.transactions)) {
        const synced = body.transactions.map(t => storage.saveTransaction(t));
        return sendJson(res, 200, { ok: true, syncedCount: synced.length, transactions: synced });
      }
      const transaction = storage.saveTransaction(body);
      return sendJson(res, 200, { ok: true, transaction });
    }

    // 5. GET & POST /api/pos/settings
    if (pathname === '/api/pos/settings' && method === 'GET') {
      return sendJson(res, 200, { ok: true, settings: storage.getSettings() });
    }
    if (pathname === '/api/pos/settings' && method === 'POST') {
      const body = await readJsonBody(req);
      const settings = storage.saveSettings(body);
      return sendJson(res, 200, { ok: true, settings });
    }

    // 6. CSV Exports
    if (pathname === '/api/pos/export/sales.csv' && method === 'GET') {
      const csv = storage.buildSalesCsvExport(storage.getTransactions(5000));
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csv.filename}"`,
        ...mw.SECURITY_HEADERS
      });
      return res.end(csv.csvContent);
    }

    if (pathname === '/api/pos/export/inventory.csv' && method === 'GET') {
      const csv = storage.buildInventoryCsvExport(storage.getItems());
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csv.filename}"`,
        ...mw.SECURITY_HEADERS
      });
      return res.end(csv.csvContent);
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { ok: false, error: `Unknown API route: ${pathname}` });
    }

    // Serve static files or SPA index.html
    const spaRoutes = ['/', '/register', '/inventory', '/customers', '/reports', '/settings'];
    const targetFile = spaRoutes.includes(pathname)
      ? path.join(__dirname, 'index.html')
      : path.join(__dirname, pathname.replace(/^\/+/, ''));

    if (!path.resolve(targetFile).startsWith(path.resolve(__dirname))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        ...mw.SECURITY_HEADERS
      });
      return fs.createReadStream(targetFile).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain', ...mw.SECURITY_HEADERS });
    res.end('Not Found');
  } catch (err) {
    console.error('[Macisla_POS Server] Error:', err);
    sendJson(res, 400, { ok: false, error: err.message || 'Bad request' });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════════╗');
    console.log('  ║  💳 MACISLA POS — Standalone Register & Back-Office    ║');
    console.log('  ║  🗄️  Storage: Cloudflare D1 + R2 + Local SQLite        ║');
    console.log('  ║  🖨️  Printer: 80mm / 58mm Thermal (@media print)       ║');
    console.log(`  ║  🌐 Live URL: http://${HOST}:${PORT}                    ║`);
    console.log('  ╚════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

module.exports = server;
