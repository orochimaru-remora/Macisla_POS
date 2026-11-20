// Local SQLite + disk object store mirror matching Cloudflare D1 (pos_docs) + R2 contracts.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createLocalStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, 'macisla_pos.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pos_docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_pos_docs_collection
      ON pos_docs (collection, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pos_docs_collection_created
      ON pos_docs (collection, created_at DESC);
  `);

  const stmtListRecent = db.prepare('SELECT data FROM pos_docs WHERE collection = ? ORDER BY updated_at DESC');
  const stmtGet = db.prepare('SELECT data FROM pos_docs WHERE collection = ? AND id = ?');
  const stmtPut = db.prepare(`
    INSERT INTO pos_docs (collection, id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `);
  const stmtDel = db.prepare('DELETE FROM pos_docs WHERE collection = ? AND id = ?');

  return {
    db,
    close() {
      db.close();
    },
    async list(collection) {
      return stmtListRecent.all(collection).map((r) => JSON.parse(r.data));
    },
    async listRange(collection, { sinceIso = null, untilIso = null, limit = null } = {}) {
      const clauses = ['collection = ?'];
      const params = [collection];
      if (sinceIso) {
        clauses.push('created_at >= ?');
        params.push(sinceIso);
      }
      if (untilIso) {
        clauses.push('created_at <= ?');
        params.push(untilIso);
      }
      let sql = `SELECT data FROM pos_docs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`;
      if (limit != null && Number.isFinite(Number(limit)) && Number(limit) > 0) {
        sql += ' LIMIT ?';
        params.push(Math.floor(Number(limit)));
      }
      return db.prepare(sql).all(...params).map((r) => JSON.parse(r.data));
    },
    async get(collection, id) {
      const row = stmtGet.get(collection, String(id));
      return row ? JSON.parse(row.data) : null;
    },
    async put(collection, id, doc) {
      const now = new Date().toISOString();
      const createdAt = doc?.created_date || now;
      stmtPut.run(collection, String(id), JSON.stringify(doc), createdAt, now);
      return doc;
    },
    async del(collection, id) {
      stmtDel.run(collection, String(id));
    },
    async putObject(key, arrayBuffer, contentType) {
      const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
      const fullPath = path.join(uploadsDir, safe);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, Buffer.from(arrayBuffer));
      fs.writeFileSync(`${fullPath}.meta`, JSON.stringify({ contentType }));
      return key;
    },
    async getObject(key) {
      const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
      const fullPath = path.join(uploadsDir, safe);
      if (!fs.existsSync(fullPath)) return null;
      let contentType = 'application/octet-stream';
      try {
        contentType = JSON.parse(fs.readFileSync(`${fullPath}.meta`, 'utf8')).contentType || contentType;
      } catch {
        // ignore
      }
      return { body: fs.readFileSync(fullPath), contentType };
    },
  };
}
