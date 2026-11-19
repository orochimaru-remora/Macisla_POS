// Local SQLite + Disk R2 mirror adapter for Posnic Engine (zero npm deps)
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createLocalStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const dbPath = path.join(dataDir, 'macisla_pos.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS posnic_docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_posnic_docs_collection
      ON posnic_docs (collection, updated_at DESC);
  `);

  const stmtList = db.prepare('SELECT data FROM posnic_docs WHERE collection = ? ORDER BY updated_at DESC');
  const stmtGet = db.prepare('SELECT data FROM posnic_docs WHERE collection = ? AND id = ?');
  const stmtPut = db.prepare(`
    INSERT INTO posnic_docs (collection, id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `);
  const stmtDel = db.prepare('DELETE FROM posnic_docs WHERE collection = ? AND id = ?');

  return {
    db,
    close() {
      db.close();
    },
    async list(collection) {
      return stmtList.all(collection).map((r) => JSON.parse(r.data));
    },
    async get(collection, id) {
      const row = stmtGet.get(collection, String(id));
      return row ? JSON.parse(row.data) : null;
    },
    async put(collection, id, doc) {
      const now = new Date().toISOString();
      stmtPut.run(collection, String(id), JSON.stringify(doc), now, now);
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
