-- Macisla_POS — Cloudflare D1 & Local SQLite Schema (pos.macisla.com)
-- Shares `customers` and `sessions` with Macisla D1 (UUID: 9d540277-0b77-42eb-bbea-405145543d95)

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  preferences TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_items (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'Service',
  cost_price INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_transactions (
  id TEXT PRIMARY KEY,
  session_id TEXT DEFAULT '',
  customer_id TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  cashier_name TEXT DEFAULT 'General Counter',
  items_json TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,
  change_due INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pos_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_pos_items_category ON pos_items(category);
CREATE INDEX IF NOT EXISTS idx_pos_items_sku ON pos_items(sku);
CREATE INDEX IF NOT EXISTS idx_pos_tx_date ON pos_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_tx_customer_phone ON pos_transactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_pos_tx_status ON pos_transactions(status);
