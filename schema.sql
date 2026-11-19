-- Macisla_POS (Original Posnic UI on Cloudflare D1 + R2)
-- Run locally: automatically initialized by storage.js
-- Run on Cloudflare D1: wrangler d1 execute macisla --remote --file=schema.sql

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
