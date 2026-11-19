# Macisla POS (`pos.macisla.com`)

Standalone Posnic-style Point of Sale, Retail Inventory, Customer Directory, Shift Z-Report, and 80mm Thermal Receipt system built natively on **Cloudflare Pages + Cloudflare D1 + Cloudflare R2** with a zero-dependency **Local Node + SQLite (`node:sqlite`)** server for offline shop operation.

---

## Modules Included

1. **💳 POS Register (`F1`)** — Fast barcode/SKU scan (`/` to focus, `Enter` to add exact SKU), category tabs, service & retail product tiles with live stock badges, customer picker (`customers` shared with Macisla D1), Barber/Staff assignment, **Hold / Recall Bills**, percentage/Rp discounts, `Cash` / `QRIS` / `Card` / `Transfer` tender pad, and **Complete & Print 80mm Receipt (`F9`)**.
2. **📦 Items & Stock (`F2`)** — Full service and retail inventory table with SKU, cost price, selling price, live stock count, low-stock alerts (`stock <= min_stock`), `+10 Stock` quick restock, Add/Edit/Delete modal, and **Export Inventory CSV**.
3. **👥 Customers (`F3`)** — Shared Cloudflare D1 `customers` directory showing visit/bill counts, lifetime POS spend, notes/preferences, and 1-click **Load in Register**.
4. **📊 Sales & Z-Report (`F4`)** — Today's & All-Time net revenue, average ticket, Cash vs. Cashless split, searchable Invoice ledger, **Reprint 80mm Receipt**, **Void Bill (automatically restores product stock)**, **Print 80mm Shift Close (Z-Report)**, and **Export Sales CSV**.
5. **⚙️ Store & Printer (`F5`)** — Store header/address/phone/footer settings, default tax/service %, 80mm/58mm thermal layout selector, and Chrome `--kiosk-printing` instructions.

---

## Local Run & Test

```bash
node --test test/pos.test.js
node server.js
# Opens on http://127.0.0.1:3088
```

## Deploying to `pos.macisla.com` on Cloudflare Pages

1. Create a Cloudflare Pages project connected to `orochimaru-remora/Macisla_POS`.
2. Bind D1 database `DB` (`macisla` — `9d540277-0b77-42eb-bbea-405145543d95`) and R2 bucket `BUCKET` (`macisla`), or deploy via `npx wrangler pages deploy .`.
3. Add custom domain `pos.macisla.com` and optional environment variable `BARBER_PIN` (4-digit cashier PIN).
