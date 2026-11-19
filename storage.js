// Local SQLite + Disk R2 mirror + Real-Time seed-data.mjs Auto-Sync adapter (zero npm deps)
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SYNC_COLLECTIONS, computeSeedVersion } from './seed-data.mjs';

const SYNC_SET = new Set(SYNC_COLLECTIONS);

export function formatSeedDataModule(snapshot) {
  return `// Macisla_POS — Canonical Catalog & Store Settings Seed Data
// Auto-updated in real time when you add/edit items, categories, customers, or settings
// in the local POS UI (\`http://127.0.0.1:3088\`). Commit & push to deploy changes to Cloudflare D1.

export const SYNC_COLLECTIONS = ${JSON.stringify(SYNC_COLLECTIONS, null, 2)};

export const DEFAULT_BRANCH_ID = '665000000000000000000010';
export const DEFAULT_REGISTER_ID = '665000000000000000000021';
export const DEFAULT_CASH_REGISTER_ID = '665000000000000000000020';
export const DEFAULT_ADMIN_ID = '665000000000000000000001';
export const DEFAULT_CUSTOMER_ID = '665000000000000000000301';
export const DEFAULT_SUPPLIER_ID = '665000000000000000000401';
export const DEFAULT_TAX_ID = '665000000000000000000501';

export function computeSeedVersion(data) {
  const str = JSON.stringify(data);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'seed-' + (h >>> 0).toString(16).padStart(8, '0');
}

export const SEED_DATA = ${JSON.stringify(snapshot, null, 2)};

export const SEED_VERSION = computeSeedVersion(SEED_DATA);
`;
}

export function createLocalStore(dataDir, { seedFilePath = null } = {}) {
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

  const stmtList = db.prepare('SELECT id, data FROM posnic_docs WHERE collection = ? ORDER BY id ASC');
  const stmtListRecent = db.prepare('SELECT data FROM posnic_docs WHERE collection = ? ORDER BY updated_at DESC');
  const stmtGet = db.prepare('SELECT data FROM posnic_docs WHERE collection = ? AND id = ?');
  const stmtPut = db.prepare(`
    INSERT INTO posnic_docs (collection, id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `);
  const stmtDel = db.prepare('DELETE FROM posnic_docs WHERE collection = ? AND id = ?');
  const stmtDelCollection = db.prepare('DELETE FROM posnic_docs WHERE collection = ?');

  let syncPaused = false;

  function flushSeedFile() {
    if (!seedFilePath || syncPaused) return;
    const snapshot = {};
    for (const col of SYNC_COLLECTIONS) {
      let rows = stmtList.all(col).map((r) => JSON.parse(r.data));
      // Keep counters & seed_version runtime-only so sales don't dirty git diff
      if (col === 'meta') {
        rows = rows.filter((d) => d._id !== 'counters' && d._id !== 'seed_version');
      }
      snapshot[col] = rows;
    }
    const content = formatSeedDataModule(snapshot);
    const tmpPath = `${seedFilePath}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, seedFilePath);
    const now = new Date().toISOString();
    const version = computeSeedVersion(snapshot);
    stmtPut.run('meta', 'seed_version', JSON.stringify({ _id: 'seed_version', version, synced_at: now }), now, now);
  }

  return {
    db,
    close() {
      db.close();
    },
    setSyncPaused(paused) {
      syncPaused = Boolean(paused);
    },
    exportSeedNow() {
      flushSeedFile();
    },
    async list(collection) {
      return stmtListRecent.all(collection).map((r) => JSON.parse(r.data));
    },
    async get(collection, id) {
      const row = stmtGet.get(collection, String(id));
      return row ? JSON.parse(row.data) : null;
    },
    async put(collection, id, doc) {
      const now = new Date().toISOString();
      stmtPut.run(collection, String(id), JSON.stringify(doc), now, now);
      if (SYNC_SET.has(collection) && !(collection === 'meta' && (id === 'counters' || id === 'seed_version'))) {
        flushSeedFile();
      }
      return doc;
    },
    async del(collection, id) {
      stmtDel.run(collection, String(id));
      if (SYNC_SET.has(collection)) {
        flushSeedFile();
      }
    },
    async replaceCollection(collection, docs) {
      const now = new Date().toISOString();
      if (collection === 'meta') {
        for (const d of docs) {
          const id = String(d._id || d.id);
          stmtPut.run(collection, id, JSON.stringify(d), now, now);
        }
        return;
      }
      stmtDelCollection.run(collection);
      for (const d of docs) {
        const id = String(d._id || d.id);
        stmtPut.run(collection, id, JSON.stringify(d), now, now);
      }
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
