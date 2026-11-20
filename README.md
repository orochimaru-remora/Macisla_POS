# Macisla POS (`https://macisla-pos.pages.dev`)

Posnic POS frontend running on **Cloudflare Pages Functions + Cloudflare D1 (`pos_docs`) + Cloudflare R2 (`pos/*`)** — zero MongoDB, zero login screen, zero marketing popups, editable items saved in D1/R2, and all Reports unlocked.

## Architecture

- **Boot & UI Overrides (`static/macisla-boot.js` + `functions/[[path]].js`)**: Injects `/static/macisla-boot.js` into `/dashboard` via `HTMLRewriter` so the browser enters `#/sales/new` directly as `admin`, locks `userplan=premium`, and permanently suppresses desktop/demo marketing nudges.
- **Pass-through Middleware (`functions/_middleware.js`)**: Zero passcode gate. Add Cloudflare Zero Trust Access in Cloudflare Dashboard later if you want perimeter auth without touching code.
- **API & Persistence (`posnic-engine.mjs` + `schema.sql`)**: Serves Posnic's REST API backed by Cloudflare D1 table `pos_docs` and R2 bucket `R2_BUCKET`. Seeds the starter catalog (3 Macisla services, 0 fake sales) once when empty.
- **Local Dev (`server.js` + `storage.js`)**: Runs the same engine against local SQLite (`data/macisla_pos.db`) and `data/uploads/`.

## Local Commands

```bash
npm start   # http://127.0.0.1:3088
npm test    # node --test test/pos.test.js
```

## Cloudflare Pages Setup (`wrangler.toml`)

- **D1 binding**: `DB` -> `macisla` (`9d540277-0b77-42eb-bbea-405145543d95`)
- **R2 binding**: `R2_BUCKET` -> `macisla`
- Build command: *(empty)* · Output directory: `.`
