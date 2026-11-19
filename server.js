// Local development server for Macisla_POS (serves 100% original Posnic frontend + D1-compatible SQLite backend)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalStore } from './storage.js';
import { handlePosnicRequest } from './posnic-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.POS_PORT || process.env.PORT || 3088);
const HOST = process.env.POS_HOST || '127.0.0.1';
const DATA_DIR = process.env.POS_DATA_DIR || path.join(__dirname, 'data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function resolveStaticFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean === '/' || clean === '') clean = '/index.html';
  if (clean.startsWith('/public/')) clean = clean.slice('/public'.length);

  // Never expose backend files or data directory over HTTP
  const blocked = ['/server.js', '/storage.js', '/posnic-engine.mjs', '/package.json', '/wrangler.toml', '/schema.sql', '/_routes.json'];
  if (blocked.includes(clean) || clean.startsWith('/functions/') || clean.startsWith('/data/') || clean.startsWith('/test/') || clean.startsWith('/.git')) {
    return null;
  }

  const candidate = path.resolve(__dirname, '.' + clean);
  if (!candidate.startsWith(__dirname)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  return null;
}

export function startServer({ port = PORT, host = HOST, dataDir = DATA_DIR } = {}) {
  const store = createLocalStore(dataDir);

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method || 'GET').toUpperCase();
      const rawUrl = req.url || '/';

      if (method === 'GET' || method === 'HEAD') {
        const staticFile = resolveStaticFile(rawUrl);
        if (staticFile) {
          const ext = path.extname(staticFile).toLowerCase();
          const headers = {
            'content-type': MIME[ext] || 'application/octet-stream',
            'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
          };
          res.writeHead(200, headers);
          if (method === 'HEAD') return res.end();
          return fs.createReadStream(staticFile).pipe(res);
        }
      }

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = Buffer.concat(chunks);

      const fullUrl = `http://${req.headers.host || `${host}:${port}`}${rawUrl}`;
      const webReq = new Request(fullUrl, {
        method,
        headers: req.headers,
        body: method === 'GET' || method === 'HEAD' || bodyBuf.length === 0 ? undefined : bodyBuf,
      });

      const webRes = await handlePosnicRequest(webReq, store, {});
      const outHeaders = {};
      webRes.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });
      res.writeHead(webRes.status, outHeaders);
      const ab = await webRes.arrayBuffer();
      res.end(Buffer.from(ab));
    } catch (err) {
      console.error('[Macisla_POS]', err);
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ type: 'error', message: err.message || 'Internal Server Error' }));
    }
  });

  server.on('close', () => store.close());
  return { server, store };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = startServer();
  server.listen(PORT, HOST, () => {
    console.log(`Macisla_POS (Original Posnic UI + Cloudflare D1/R2 Adapter) listening on http://${HOST}:${PORT}`);
  });
}
