# Macisla_POS (`pos.macisla.com`)

**100% original [Posnic POS](https://github.com/Posnic/POS) frontend UI/UX & workflow**, routed to a lightweight **Cloudflare Pages Functions + Cloudflare D1 + Cloudflare R2** backend (zero MongoDB, zero Express/VPS required).

## Architecture

- **Frontend (Unmodified Posnic Build)**: `login.html`, `dashboard.html`, `script/`, `style/`, `static/`, `fonts/`, `languages/`, `sw.js` — served directly from Cloudflare Pages CDN edge (`_routes.json` excludes all static assets from Worker invocations).
- **Cloudflare Backend (`functions/[[path]].js` + `posnic-engine.mjs`)**: Implements Posnic's REST API protocol (`{ type: "success", data: ... }`) on top of **Cloudflare D1** (`macisla`, UUID `9d540277-0b77-42eb-bbea-405145543d95`) and **Cloudflare R2** (`macisla` bucket, `pos/*` prefix).
- **Local Dev Server (`server.js` + `storage.js`)**: Runs the exact same `posnic-engine.mjs` against a local SQLite database (`data/macisla_pos.db`) using Node's built-in `node:sqlite` (zero npm dependencies).

## Quick Start (Local)

```bash
npm start
# Open http://127.0.0.1:3088/login.html
```

Default logins (and one-click demo buttons on `login.html`):
- **Admin**: `admin` / `admin`
- **Manager**: `manager` / `manager`
- **Cashier**: `cashier` / `cashier`

## Deploy to `pos.macisla.com` (Cloudflare Pages)

1. Connect `orochimaru-remora/Macisla_POS` in **Cloudflare Dashboard → Workers & Pages → Create → Pages**.
2. Build command: *(leave empty)* · Build output directory: `.`
3. Bind your existing Cloudflare resources in **Settings → Bindings** (already declared in `wrangler.toml`):
   - **D1 Database**: Variable `DB` → `macisla` (`9d540277-0b77-42eb-bbea-405145543d95`)
   - **R2 Bucket**: Variable `R2_BUCKET` → `macisla`
4. Add custom domain `pos.macisla.com` under **Custom domains**.
5. Optional: run `wrangler d1 execute macisla --remote --file=schema.sql` (the table also self-initializes automatically on the first request).

## Run Tests

```bash
npm test
```
