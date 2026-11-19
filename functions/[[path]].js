// Cloudflare Pages Function: routes Posnic API requests to Cloudflare D1 + R2
// while letting static Posnic frontend files fall through to Cloudflare Pages CDN.
import { handlePosnicRequest } from '../posnic-engine.mjs';

const STATIC_EXT = /\.(?:html|js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|otf|webmanifest|txt|xml|mp3|wav)$/i;

function createD1Store(db, r2) {
  let schemaReady = false;

  async function ensureTable() {
    if (schemaReady) return;
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS posnic_docs (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (collection, id)
        )`
      )
      .run();
    schemaReady = true;
  }

  return {
    async list(collection) {
      await ensureTable();
      const { results } = await db
        .prepare('SELECT data FROM posnic_docs WHERE collection = ? ORDER BY updated_at DESC')
        .bind(collection)
        .all();
      return (results || []).map((r) => JSON.parse(r.data));
    },
    async get(collection, id) {
      await ensureTable();
      const row = await db
        .prepare('SELECT data FROM posnic_docs WHERE collection = ? AND id = ?')
        .bind(collection, String(id))
        .first();
      return row ? JSON.parse(row.data) : null;
    },
    async put(collection, id, doc) {
      await ensureTable();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO posnic_docs (collection, id, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        )
        .bind(collection, String(id), JSON.stringify(doc), now, now)
        .run();
      return doc;
    },
    async del(collection, id) {
      await ensureTable();
      await db
        .prepare('DELETE FROM posnic_docs WHERE collection = ? AND id = ?')
        .bind(collection, String(id))
        .run();
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
      return {
        body: obj.body,
        contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      };
    },
  };
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const p = url.pathname;

  // Serve static Posnic frontend files straight from Cloudflare Pages CDN
  if (
    p === '/' ||
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

  const store = createD1Store(env.DB, env.R2_BUCKET);
  return handlePosnicRequest(request, store, env);
}
