-- Macisla POS — Cloudflare D1 JSON document store
-- Auto-initialized on first request; can also be applied manually via:
--   wrangler d1 execute macisla --remote --file=schema.sql

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
