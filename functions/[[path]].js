// Cloudflare Pages Function: injects boot context on /dashboard*, redirects /login* away,
// passes static assets to Cloudflare Pages CDN, and routes all API requests to D1 + R2.
import { handlePosnicRequest } from '../posnic-engine.mjs';

const STATIC_EXT = /\.(?:html|js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|otf|webmanifest|txt|xml|mp3|wav)$/i;

function createD1Store(db, r2) {
  let schemaReady = false;

  async function ensureTable() {
    if (schemaReady) return;
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS pos_docs (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (collection, id)
        )`
      )
      .run();
    await db
      .prepare('CREATE INDEX IF NOT EXISTS idx_pos_docs_collection ON pos_docs (collection, updated_at DESC)')
      .run();
    schemaReady = true;
  }

  return {
    async list(collection) {
      await ensureTable();
      const { results } = await db
        .prepare('SELECT data FROM pos_docs WHERE collection = ? ORDER BY updated_at DESC')
        .bind(collection)
        .all();
      return (results || []).map((r) => JSON.parse(r.data));
    },
    async get(collection, id) {
      await ensureTable();
      const row = await db
        .prepare('SELECT data FROM pos_docs WHERE collection = ? AND id = ?')
        .bind(collection, String(id))
        .first();
      return row ? JSON.parse(row.data) : null;
    },
    async put(collection, id, doc) {
      await ensureTable();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO pos_docs (collection, id, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        )
        .bind(collection, String(id), JSON.stringify(doc), now, now)
        .run();
      return doc;
    },
    async del(collection, id) {
      await ensureTable();
      await db.prepare('DELETE FROM pos_docs WHERE collection = ? AND id = ?').bind(collection, String(id)).run();
    },
    async putObject(key, arrayBuffer, contentType) {
      if (!r2) return null;
      await r2.put(key, arrayBuffer, { httpMetadata: { contentType } });
      return key;
    },
    async getObject(key) {
      if (!r2) return null;
      const obj = await r2.get(key);
      if (!obj) return null;
      return { body: obj.body, contentType: obj.httpMetadata?.contentType || 'application/octet-stream' };
    },
  };
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const p = url.pathname;

  if (p === '/login' || p === '/login.html') {
    return Response.redirect(new URL('/dashboard#/sales/new', url.origin).toString(), 302);
  }

  if (p === '/dashboard' || p === '/dashboard.html') {
    const assetRes = await next();
    const ct = (assetRes.headers.get('content-type') || '').toLowerCase();
    if (!assetRes.ok || !ct.includes('text/html')) return assetRes;

    const headers = new Headers(assetRes.headers);
    headers.set('cache-control', 'no-store');
    headers.delete('content-length');
    headers.delete('etag');
    const cleanRes = new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers,
    });

    if (typeof HTMLRewriter !== 'undefined') {
      return new HTMLRewriter()
        .on('head', {
          element(el) {
            el.prepend('<script src="/static/macisla-boot.js"></script>', { html: true });
          },
        })
        .transform(cleanRes);
    }
    return cleanRes;
  }

  if (
    p === '/' ||
    p === '/index.html' ||
    p.startsWith('/script/') ||
    p.startsWith('/style/') ||
    p.startsWith('/static/') ||
    p.startsWith('/fonts/') ||
    p.startsWith('/languages/') ||
    STATIC_EXT.test(p)
  ) {
    return next();
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'Cloudflare D1 binding (DB) is not configured.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  return handlePosnicRequest(request, createD1Store(env.DB, env.R2_BUCKET), env);
}
