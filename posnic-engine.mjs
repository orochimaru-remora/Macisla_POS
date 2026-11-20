// Macisla POS — Posnic REST API Engine for Cloudflare D1 + R2 and Local SQLite
import {
  SEED_DATA,
  DEFAULT_BRANCH_ID,
  DEFAULT_REGISTER_ID,
  DEFAULT_CASH_REGISTER_ID,
  DEFAULT_ADMIN_ID,
  DEFAULT_CUSTOMER_ID,
  DEFAULT_SUPPLIER_ID,
  DEFAULT_TAX_ID,
} from './seed-data.mjs';

export {
  DEFAULT_BRANCH_ID,
  DEFAULT_REGISTER_ID,
  DEFAULT_CASH_REGISTER_ID,
  DEFAULT_ADMIN_ID,
  DEFAULT_CUSTOMER_ID,
  DEFAULT_SUPPLIER_ID,
  DEFAULT_TAX_ID,
};

const CRUD_COLLECTIONS = new Set([
  'categories',
  'customers',
  'suppliers',
  'users',
  'expenses',
  'receivings',
  'quotes',
  'invoices',
  'coupons',
  'variants',
  'stocklogs',
  'taxes',
  'payments',
  'units',
  'denominations',
  'registers',
  'branches',
]);

const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

const ALLOWED_IMAGE_MIMES = new Set(Object.values(MIME_BY_EXT));
const MAX_UPLOAD_FILES = 12;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function isObjectId(v) {
  return typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
}

export function newObjectId(date = new Date()) {
  const ts = Math.floor(date.getTime() / 1000).toString(16).padStart(8, '0');
  let rand = '';
  for (let i = 0; i < 16; i++) rand += Math.floor(Math.random() * 16).toString(16);
  return ts + rand;
}

const nowIso = () => new Date().toISOString();

function num(v, fallback = 0) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const parsed = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasNumericValue(v) {
  if (v === undefined || v === null) return false;
  const cleaned = String(v).replace(/,/g, '').trim();
  return cleaned !== '' && Number.isFinite(Number(cleaned));
}

function bool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1 || v === 'enable' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 0 || v === 'disable' || v === 'no') return false;
  return fallback;
}

function sanitizeUser(u) {
  if (!u || typeof u !== 'object') return u;
  const clean = { ...u };
  delete clean.password;
  delete clean.retype_password;
  delete clean.app_key;
  delete clean.old_password;
  delete clean.new_password;
  delete clean.confirm_password;
  return clean;
}

function fullAcl(role = 'super_admin') {
  const isCashier = role === 'cashier';
  const rw = { read: true, write: true, delete: !isCashier };
  const ro = { read: true, write: !isCashier, delete: false };
  return {
    dashboard: { read: true, write: true, delete: !isCashier },
    sales: { read: true, write: true, delete: !isCashier, session_filter: false },
    item: isCashier ? ro : rw,
    category: isCashier ? ro : rw,
    customer: rw,
    supplier: isCashier ? ro : rw,
    receiving: isCashier ? ro : rw,
    expense: isCashier ? ro : rw,
    user: isCashier ? { read: false, write: false, delete: false } : rw,
    branch: isCashier ? ro : rw,
    register: rw,
    setting: isCashier ? ro : rw,
    report: { read: true, write: !isCashier, delete: false },
    quote: rw,
    invoice: rw,
    coupon: isCashier ? ro : rw,
    tax: isCashier ? ro : rw,
    payment: isCashier ? ro : rw,
    unit: isCashier ? ro : rw,
    variant: isCashier ? ro : rw,
    stocklog: isCashier ? ro : rw,
    kot: rw,
    pos: {
      discount: true,
      price_override: !isCashier,
      void_sale: !isCashier,
      refund_sale: !isCashier,
      open_drawer: true,
      discount_max_percent: isCashier ? 20 : 100,
    },
  };
}

const PRINT_A4_TEMPLATE = `<div class="receipt-a4" style="font-family:Arial,sans-serif;padding:16px;">
  <h3 class="print_store_name" style="margin:0 0 4px;">Macisla Main Store</h3>
  <div class="print_store_address" style="font-size:12px;color:#555;">Jl. Senopati No. 88, Jakarta</div>
  <hr/>
  <div id="print_items_body"></div>
  <hr/>
  <div class="footer-content" style="text-align:center;font-size:12px;">Thank you for visiting Macisla!</div>
</div>`;

const PRINT_THERMAL_TEMPLATE = `<div class="receipt-thermal" style="font-family:monospace;width:80mm;padding:6px;">
  <div class="print_store_name" style="text-align:center;font-weight:bold;font-size:15px;">Macisla Main Store</div>
  <div class="print_store_address" style="text-align:center;font-size:11px;">Jl. Senopati No. 88, Jakarta</div>
  <hr style="border-top:1px dashed #000;"/>
  <div id="print_items_body"></div>
  <hr style="border-top:1px dashed #000;"/>
  <div class="footer-content" style="text-align:center;font-size:11px;">Thank you for visiting Macisla!</div>
</div>`;

const COUNTRIES = [
  { id: 102, sortname: 'ID', name: 'Indonesia', phonecode: 62 },
  { id: 101, sortname: 'IN', name: 'India', phonecode: 91 },
  { id: 231, sortname: 'US', name: 'United States', phonecode: 1 },
  { id: 230, sortname: 'GB', name: 'United Kingdom', phonecode: 44 },
  { id: 196, sortname: 'SG', name: 'Singapore', phonecode: 65 },
  { id: 132, sortname: 'MY', name: 'Malaysia', phonecode: 60 },
  { id: 13, sortname: 'AU', name: 'Australia', phonecode: 61 },
];

const STATES_BY_COUNTRY = {
  102: [
    { id: 1690, name: 'DKI Jakarta', country_id: 102 },
    { id: 1691, name: 'Jawa Barat', country_id: 102 },
    { id: 1692, name: 'Banten', country_id: 102 },
    { id: 1693, name: 'Bali', country_id: 102 },
    { id: 1694, name: 'Jawa Timur', country_id: 102 },
  ],
  101: [
    { id: 1, name: 'Maharashtra', country_id: 101 },
    { id: 2, name: 'Karnataka', country_id: 101 },
    { id: 3, name: 'Tamil Nadu', country_id: 101 },
    { id: 4, name: 'Delhi', country_id: 101 },
  ],
  231: [
    { id: 10, name: 'California', country_id: 231 },
    { id: 11, name: 'New York', country_id: 231 },
    { id: 12, name: 'Texas', country_id: 231 },
  ],
};

const CURRENCIES = [
  { currency_text: 'IDR', currency_sign: 'Rp', country: 'Indonesia', name: 'Indonesian Rupiah' },
  { currency_text: 'USD', currency_sign: '$', country: 'United States', name: 'US Dollar' },
  { currency_text: 'SGD', currency_sign: 'S$', country: 'Singapore', name: 'Singapore Dollar' },
  { currency_text: 'MYR', currency_sign: 'RM', country: 'Malaysia', name: 'Malaysian Ringgit' },
  { currency_text: 'INR', currency_sign: '₹', country: 'India', name: 'Indian Rupee' },
  { currency_text: 'EUR', currency_sign: '€', country: 'Europe', name: 'Euro' },
  { currency_text: 'GBP', currency_sign: '£', country: 'United Kingdom', name: 'British Pound' },
];

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: '(UTC+07:00) Asia/Jakarta' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Asia/Singapore' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Asia/Kolkata' },
  { value: 'UTC', label: '(UTC+00:00) UTC' },
  { value: 'America/New_York', label: '(UTC-05:00) America/New_York' },
];

const DATE_FORMATS = [
  { client_dateformat: 'YYYY-MM-DD', server_dateformat: 'YYYY-MM-DD', dateformat_text: 'YYYY-MM-DD' },
  { client_dateformat: 'DD/MM/YYYY', server_dateformat: 'DD/MM/YYYY', dateformat_text: 'DD/MM/YYYY' },
  { client_dateformat: 'MM/DD/YYYY', server_dateformat: 'MM/DD/YYYY', dateformat_text: 'MM/DD/YYYY' },
];

// Seed once only on an empty DB so edits, deletions, and sales made in the UI never get overwritten on deploy.
export async function ensureSeeded(store) {
  const existingBranches = await store.list('branches');
  if (existingBranches.length > 0) return;

  for (const [col, docs] of Object.entries(SEED_DATA)) {
    for (const raw of docs) {
      let doc = { ...raw };
      if (col === 'branches') {
        doc.print_a4html ||= PRINT_A4_TEMPLATE;
        doc.print_standard_html ||= PRINT_THERMAL_TEMPLATE;
      } else if (col === 'users') {
        doc = sanitizeUser(doc);
        doc.access ||= fullAcl(doc.usertype || doc.role || 'super_admin');
      }
      await store.put(col, String(doc._id || doc.id), doc);
    }
  }

  const existingCounters = await store.get('meta', 'counters');
  if (!existingCounters) {
    await store.put('meta', 'counters', {
      _id: 'counters',
      sale_seq: 1000,
      receiving_seq: 1000,
      quote_seq: 1000,
      invoice_seq: 1000,
    });
  }
}

function jsonResp(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

const ok = (data = {}, message = 'Success', extra = {}) =>
  jsonResp({ type: 'success', status: true, message, data, ...extra }, 200);

const fail = (message = 'Error', status = 400, data = null) =>
  jsonResp({ type: 'error', status: false, message, data }, status);

async function parseBody(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return { data: {}, files: [] };
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/x-www-form-urlencoded')) {
    const data = {};
    for (const [k, v] of new URLSearchParams(await request.text()).entries()) data[k] = v;
    return { data, files: [] };
  }
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const data = {};
    const files = [];
    for (const [k, v] of fd.entries()) {
      if (typeof v === 'object' && v && typeof v.arrayBuffer === 'function') files.push({ field: k, file: v });
      else data[k] = v;
    }
    return { data, files };
  }
  const text = await request.text();
  if (!text.trim()) return { data: {}, files: [] };
  try {
    return { data: JSON.parse(text), files: [] };
  } catch {
    return { data: {}, files: [] };
  }
}

function parseQuery(url) {
  const out = {};
  for (const [k, v] of url.searchParams.entries()) out[k] = v;
  return out;
}

const TZ_FALLBACK_MS = {
  'Asia/Jakarta': 7 * 3600_000,
  'Asia/Singapore': 8 * 3600_000,
  'Asia/Kolkata': 5.5 * 3600_000,
  UTC: 0,
};

function tzOffsetMs(timeZone = 'Asia/Jakarta') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const m = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10)) * 60_000;
    }
  } catch {
    // ignore
  }
  return TZ_FALLBACK_MS[timeZone] ?? 7 * 3600_000;
}

// Convert Posnic datepicker wall-clock strings (e.g. '2026/11/20 12:00 AM' in shop TZ) to UTC ms.
function parseFilterDate(raw, { endOfDay = false, timeZone = 'Asia/Jakarta' } = {}) {
  let s = String(raw || '').trim();
  if (!s) return NaN;
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(s);
  const slashMdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (slashMdy) {
    s = `${slashMdy[3]}/${slashMdy[1].padStart(2, '0')}/${slashMdy[2].padStart(2, '0')}${slashMdy[4]}`;
  }
  const hasTime = /\d{1,2}:\d{2}/.test(s);
  if (hasExplicitTz) {
    return Date.parse(s);
  }
  const normalized = s.replace(/-/g, '/');
  let ms = Date.parse(`${normalized} UTC`);
  if (Number.isNaN(ms)) ms = Date.parse(s);
  if (Number.isNaN(ms)) return NaN;
  ms -= tzOffsetMs(timeZone);
  if (!hasTime && endOfDay) ms += 23 * 3600_000 + 59 * 60_000 + 59_999;
  return ms;
}

function reportDateBounds(query = {}, timeZone = 'Asia/Jakarta') {
  const s = String(query.starting_date || '').trim();
  const e = String(query.ending_date || '').trim();
  let sinceIso = null;
  let untilIso = null;
  if (s) {
    const ms = parseFilterDate(s, { endOfDay: false, timeZone });
    if (Number.isFinite(ms)) sinceIso = new Date(ms - 86_400_000).toISOString();
  }
  if (e) {
    const ms = parseFilterDate(e, { endOfDay: true, timeZone });
    if (Number.isFinite(ms)) untilIso = new Date(ms + 86_400_000).toISOString();
  }
  return { sinceIso, untilIso };
}

function inReportDateRange(isoDate, query = {}, timeZone = 'Asia/Jakarta') {
  const s = String(query.starting_date || '').trim();
  const e = String(query.ending_date || '').trim();
  if (!s && !e) return true;
  const ts = new Date(isoDate || Date.now()).getTime();
  if (!Number.isFinite(ts)) return true;
  if (s) {
    const startMs = parseFilterDate(s, { endOfDay: false, timeZone });
    if (Number.isFinite(startMs) && ts < startMs) return false;
  }
  if (e) {
    const endMs = parseFilterDate(e, { endOfDay: true, timeZone });
    if (Number.isFinite(endMs) && ts > endMs) return false;
  }
  return true;
}

function periodStartMs(filter, timeZone = 'Asia/Jakarta') {
  if (!filter || filter === 'all') return null;
  const offset = tzOffsetMs(timeZone);
  const localNow = new Date(Date.now() + offset);
  if (filter === 'day') localNow.setUTCHours(0, 0, 0, 0);
  else if (filter === 'week') {
    localNow.setUTCDate(localNow.getUTCDate() - 6);
    localNow.setUTCHours(0, 0, 0, 0);
  } else if (filter === 'month') {
    localNow.setUTCDate(1);
    localNow.setUTCHours(0, 0, 0, 0);
  } else if (filter === 'year') {
    localNow.setUTCMonth(0, 1);
    localNow.setUTCHours(0, 0, 0, 0);
  } else {
    return null;
  }
  return localNow.getTime() - offset;
}

function inFilterPeriod(isoDate, filter, timeZone = 'Asia/Jakarta') {
  const startMs = periodStartMs(filter, timeZone);
  if (startMs === null) return true;
  const ts = new Date(isoDate || Date.now()).getTime();
  return !Number.isFinite(ts) || ts >= startMs;
}

async function listDocs(store, collection, rangeOpts = {}) {
  if (typeof store.listRange === 'function') {
    return store.listRange(collection, rangeOpts);
  }
  return store.list(collection);
}

function calcPriceBreakdown({ base, discountAmount = 0, discountPercent = 0, taxRate = 0, taxType = 'exclusive' }) {
  const discount = discountAmount > 0 ? discountAmount : (base * discountPercent) / 100;
  const afterDisc = Math.max(0, base - discount);
  const isInc = String(taxType || 'exclusive').toLowerCase().includes('inc');
  const tax = taxRate > 0 ? (isInc ? afterDisc - afterDisc / (1 + taxRate / 100) : (afterDisc * taxRate) / 100) : 0;
  const total = isInc ? afterDisc : afterDisc + tax;
  return { base, discount, tax, total };
}

function unescapeRegexLiteral(s) {
  return String(s).replace(/\\([.*+?^${}()|[\]\\])/g, '$1');
}

// Parse Posnic's (?=.*tok) lookahead or plain pattern safely without runtime RegExp execution.
function extractSearchTokens(rawPattern) {
  const p = String(rawPattern || '');
  const tokens = [];
  const lookaheadRe = /\(\?=\.\*([^)]*)\)/g;
  let m;
  while ((m = lookaheadRe.exec(p)) !== null) {
    const tok = unescapeRegexLiteral(m[1]).trim().toLowerCase();
    if (tok) tokens.push(tok);
  }
  if (tokens.length > 0) return { exact: false, tokens };
  const exact = p.startsWith('^') && p.endsWith('$');
  const stripped = unescapeRegexLiteral(p.replace(/^\^/, '').replace(/\$$/, '')).trim().toLowerCase();
  return { exact, tokens: stripped ? [stripped] : [] };
}

function itemMargin(r) {
  const sell = num(r.selling_price);
  const cost = num(r.company_price);
  return sell > 0 && cost > 0 ? (sell - cost) / sell : -1;
}

const ITEM_SORTS = {
  recent: (a, b) => String(b.updated_date || b.created_date || '').localeCompare(String(a.updated_date || a.created_date || '')),
  created_desc: (a, b) => String(b.created_date || b.updated_date || '').localeCompare(String(a.created_date || a.updated_date || '')),
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  name_asc: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  name_desc: (a, b) => String(b.name || '').localeCompare(String(a.name || '')),
  price_asc: (a, b) => num(a.selling_price ?? a.sales_total) - num(b.selling_price ?? b.sales_total),
  price_desc: (a, b) => num(b.selling_price ?? b.sales_total) - num(a.selling_price ?? a.sales_total),
  cost_desc: (a, b) => num(b.company_price) - num(a.company_price),
  stock_asc: (a, b) => num(a.available_quantity) - num(b.available_quantity),
  stock_desc: (a, b) => num(b.available_quantity) - num(a.available_quantity),
  margin_asc: (a, b) => itemMargin(a) - itemMargin(b),
  margin_desc: (a, b) => itemMargin(b) - itemMargin(a),
};

function applyListFilters(rows, query, searchFields = ['name'], timeZone = 'Asia/Jakarta') {
  let out = rows.slice();
  if (query.filters) {
    try {
      const f = typeof query.filters === 'string' ? JSON.parse(query.filters) : query.filters;
      if (f && typeof f === 'object') {
        for (const [field, cond] of Object.entries(f)) {
          if (cond == null || cond === '') continue;
          if (field === 'stockLevel') {
            if (cond === 'out') out = out.filter((r) => r.track_inventory && num(r.available_quantity) <= 0);
            else if (cond === 'low') out = out.filter((r) => r.track_inventory && num(r.available_quantity) > 0 && num(r.available_quantity) <= num(r.low_stock, 5));
            else if (cond === 'in') out = out.filter((r) => !r.track_inventory || num(r.available_quantity) > 0);
          } else if (field === 'saleItems' && Array.isArray(cond)) {
            const want = new Set(cond.map(String));
            out = out.filter((r) => want.has(String(r._id)));
          } else if (field === 'category_id') {
            out = out.filter((r) => String(r.category_id || '') === String(cond));
          } else if (typeof cond === 'object' && cond.$regex) {
            const { exact, tokens } = extractSearchTokens(cond.$regex);
            if (tokens.length > 0) {
              out = out.filter((r) => {
                if (field === 'all') {
                  const joined = searchFields.map((sf) => String(r[sf] ?? '')).join(' ').toLowerCase();
                  return tokens.every((t) => joined.includes(t));
                }
                const val = String(r[field] ?? r.name ?? r.sales_id ?? '').toLowerCase();
                return exact ? val === tokens[0] : tokens.every((t) => val.includes(t));
              });
            }
          } else if (typeof cond === 'object' && (cond.$gte !== undefined || cond.$lte !== undefined)) {
            if (/date/i.test(field)) {
              const minMs = cond.$gte ? parseFilterDate(cond.$gte, { endOfDay: false, timeZone }) : -Infinity;
              const maxMs = cond.$lte ? parseFilterDate(cond.$lte, { endOfDay: true, timeZone }) : Infinity;
              out = out.filter((r) => {
                const ts = new Date(r[field] || r.updated_date || r.created_date || Date.now()).getTime();
                return ts >= minMs && ts <= maxMs;
              });
            } else {
              const minVal = cond.$gte !== undefined ? num(cond.$gte, -Infinity) : -Infinity;
              const maxVal = cond.$lte !== undefined ? num(cond.$lte, Infinity) : Infinity;
              out = out.filter((r) => {
                const val = num(r[field], 0);
                return val >= minVal && val <= maxVal;
              });
            }
          } else if (typeof cond === 'string') {
            const needle = cond.toLowerCase();
            out = out.filter((r) => String(r[field] ?? '').toLowerCase().includes(needle));
          }
        }
      }
    } catch {
      // ignore malformed filter JSON
    }
  }
  const q = String(query.q || query.query || query.search || '').trim().toLowerCase();
  if (q) {
    out = out.filter((r) => searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)));
  }
  const sortFn = ITEM_SORTS[String(query.sort || '').toLowerCase()] || ITEM_SORTS.created_desc;
  out.sort(sortFn);

  const total = out.length;
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(query.limit || '25', 10) || 25));
  const list = out.slice((page - 1) * limit, page * limit);
  return { list, total, page, limit, allFiltered: out };
}

function normalizeItemsPayload(rawItems) {
  if (!rawItems) return [];
  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(rawItems) ? rawItems : [];
}

function paginateReport(rows, query = {}) {
  const total = rows.length;
  const per_page = Math.max(1, Math.min(500, parseInt(query.limit || '10', 10) || 10));
  const total_pages = Math.max(1, Math.ceil(total / per_page));
  const current_page = Math.min(total_pages, Math.max(1, parseInt(query.page || '1', 10) || 1));
  return {
    list: rows.slice((current_page - 1) * per_page, current_page * per_page),
    total,
    total_pages,
    current_page,
    per_page,
  };
}

function getSessionUserFromRequest(request, users) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || token.split('.')[0]));
      const found = users.find((u) => u._id === payload.sid || u.user_name === payload.username);
      if (found) return found;
    } catch {
      // fall through
    }
  }
  return users[0];
}

function makeToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sid: user._id,
      username: user.user_name,
      usertype: user.usertype,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  return `${header}.${payload}.macisla`;
}

function normalizeItemDoc(body, existing, { cats = [], sups = [], units = [], branchId, userName, id }) {
  const name = String(body.name || body.item_name || existing?.name || 'Untitled Item').trim();
  const cat =
    cats.find((c) => c._id === (body.category_id ?? existing?.category_id)) ||
    cats.find((c) => body.category_name && c.name === body.category_name);
  const sup =
    sups.find((s) => s._id === (body.supplier_id ?? existing?.supplier_id)) ||
    sups.find((s) => body.supplier_name && s.name === body.supplier_name);
  const unitDoc = units.find(
    (u) =>
      u._id === (body.unit_id ?? existing?.unit_id) ||
      u.unit_short === (body.unit ?? existing?.unit)
  );

  const kind = String(body.item_kind ?? existing?.item_kind ?? 'product');
  const tracked =
    kind === 'service'
      ? false
      : bool(body.inventory ?? body.track_inventory, existing?.track_inventory ?? true);

  let multiImage = Array.isArray(existing?.multi_image) ? existing.multi_image : [];
  if (Array.isArray(body.image)) {
    multiImage = body.image
      .map((p) =>
        typeof p === 'string'
          ? { name: p, cover: 'no' }
          : { name: String(p?.name || ''), size: num(p?.size), cover: p?.cover || 'no' }
      )
      .filter((p) => p.name);
  } else if (Array.isArray(body.multi_image)) {
    multiImage = body.multi_image;
  }

  const coverFromMulti = multiImage.find((p) => p.cover === 'yes')?.name || multiImage[0]?.name;
  const coverImage =
    (typeof body.cover_image === 'string' && body.cover_image.trim()) ||
    (typeof body.image === 'string' && body.image.trim()) ||
    coverFromMulti ||
    (Array.isArray(body.image) && body.image.length === 0 ? 'item.svg' : '') ||
    existing?.image ||
    'item.svg';

  const sellingPrice =
    body.selling_price !== undefined ? num(body.selling_price) : num(existing?.selling_price);
  const rawSku = body.sku_id ?? body.itemid;
  const sku =
    rawSku !== undefined
      ? String(rawSku || '').trim()
      : existing?.itemid ?? `SKU-${Date.now().toString().slice(-5)}`;

  const merged = {
    ...(existing || {}),
    ...body,
    _id: id,
    id,
    name,
    item_name: name,
    itemid: sku,
    barcode_id: String(body.barcode_id ?? existing?.barcode_id ?? '').trim(),
    category_id: cat?._id ?? body.category_id ?? existing?.category_id ?? '',
    category_name: cat?.name ?? body.category_name ?? existing?.category_name ?? 'General',
    supplier_id: sup?._id ?? body.supplier_id ?? existing?.supplier_id ?? DEFAULT_SUPPLIER_ID,
    supplier_name: sup?.name ?? body.supplier_name ?? existing?.supplier_name ?? 'Macisla Supply Co.',
    selling_price: sellingPrice,
    mrp_price:
      body.mrp_price !== undefined
        ? num(body.mrp_price)
        : existing?.mrp_price ?? sellingPrice,
    company_price:
      body.company_price !== undefined ? num(body.company_price) : num(existing?.company_price),
    available_quantity:
      body.available_quantity !== undefined
        ? num(body.available_quantity)
        : num(existing?.available_quantity, 0),
    low_stock: body.low_stock !== undefined ? num(body.low_stock, 5) : num(existing?.low_stock, 5),
    item_kind: kind,
    track_inventory: tracked,
    inventory: tracked,
    negative_stock: bool(body.negative_stock, existing?.negative_stock ?? false),
    available_for_sale:
      body.available_for_sale !== undefined
        ? bool(body.available_for_sale, true)
        : existing?.available_for_sale !== false,
    service_unit: body.service_unit ?? existing?.service_unit ?? 'fixed',
    unit: unitDoc?.unit_short ?? body.unit ?? existing?.unit ?? 'qty',
    unit_id: unitDoc?._id ?? body.unit_id ?? existing?.unit_id ?? '',
    tax_id: body.tax_id !== undefined ? String(body.tax_id || '') : existing?.tax_id || '',
    tax_name: body.tax_name !== undefined ? String(body.tax_name || '') : existing?.tax_name || '',
    tax: body.tax !== undefined ? num(body.tax) : num(existing?.tax),
    tax_type: String(body.tax_type ?? existing?.tax_type ?? 'exclusive').toLowerCase(),
    discount_amount:
      body.discount_amount !== undefined ? num(body.discount_amount) : num(existing?.discount_amount),
    discount_percentage:
      body.discount_percentage !== undefined
        ? num(body.discount_percentage)
        : num(existing?.discount_percentage),
    hsncode: String(body.hsn_code ?? body.hsncode ?? existing?.hsncode ?? ''),
    hsndescription: String(body.hsn_description ?? body.hsndescription ?? existing?.hsndescription ?? ''),
    sort_order: num(body.position ?? body.sort_order ?? existing?.sort_order, 0),
    multi_image: multiImage,
    image: coverImage,
    cover_image: coverImage,
    tile_color: body.tile_color ?? existing?.tile_color ?? '#2563EB',
    tile_shape: body.tile_shape ?? existing?.tile_shape ?? 'rounded',
    description: body.description !== undefined ? String(body.description || '') : existing?.description || '',
    tags: Array.isArray(body.tags) ? body.tags : existing?.tags || [],
    barcodes: Array.isArray(body.barcodes) ? body.barcodes : existing?.barcodes || [],
    selling_units: Array.isArray(body.selling_units) ? body.selling_units : existing?.selling_units || [],
    stock_locations: Array.isArray(body.stock_locations) ? body.stock_locations : existing?.stock_locations || [],
    branch_id: branchId || DEFAULT_BRANCH_ID,
    status: existing?.status || 'Active',
    created_by: existing?.created_by || userName || 'admin',
    created_date: existing?.created_date || nowIso(),
    updated_date: nowIso(),
  };

  delete merged.sku_id;
  delete merged.hsn_code;
  delete merged.hsn_description;
  delete merged.position;
  return merged;
}

function decodeBase64Bytes(rawData) {
  let b64 = String(rawData || '').trim();
  let mime = '';
  const dataUri = b64.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUri) {
    mime = dataUri[1].toLowerCase();
    b64 = dataUri[2];
  }
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return null;
  }
}

async function saveUploadedFile(entry, store, folder) {
  if (!entry || !entry.file) return { url: '' };
  if (!store.putObject) return { error: 'Object storage is not configured' };
  const ext = String(entry.file.name || '').split('.').pop().toLowerCase();
  const mime = String(entry.file.type || MIME_BY_EXT[ext] || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    return { error: 'Only PNG, JPEG, GIF, BMP, or WebP images are allowed' };
  }
  const buf = await entry.file.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_UPLOAD_BYTES) {
    return { error: 'Image must be non-empty and under 5 MB' };
  }
  const key = `pos/${folder}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${ext || 'png'}`;
  await store.putObject(key, buf, mime);
  return { url: `/r2/${key}` };
}

export async function handlePosnicRequest(request, store, _env = {}) {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  await ensureSeeded(store);

  const url = new URL(request.url);
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/api') pathname = '/';
  else if (pathname.startsWith('/api/')) pathname = pathname.slice(4);

  const query = parseQuery(url);
  const { data: body, files } = await parseBody(request);
  const segs = pathname.split('/').filter(Boolean);
  const root = segs[0] || '';
  const sub = segs[1] || '';
  const sub2 = segs[2] || '';

  // ── 1. Health, Runtime Info, Client Telemetry, Brand, Events & R2 Media ───────
  if (pathname === '/health') {
    return ok({ ok: true, service: 'macisla-pos', engine: 'cloudflare-d1-r2', version: '1.9.2' });
  }
  if (pathname === '/runtime-info') {
    return jsonResp({
      demo: false,
      version: '1.9.2',
      edition: 'local',
      mode: 'local',
      cloud: false,
      features: { account: false, demo: false },
    });
  }
  if (pathname === '/brand.json') {
    return jsonResp({ enabled: false, name: 'Macisla POS' });
  }
  if (pathname === '/client-errors') {
    return ok({ ok: true });
  }
  if (pathname === '/events') {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'hello', ts: Date.now() })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }
  if (root === 'r2' && sub && method === 'GET') {
    let key = '';
    try {
      key = decodeURIComponent(segs.slice(1).join('/'));
    } catch {
      return fail('Invalid object key', 400);
    }
    if (!key.startsWith('pos/') || key.includes('..') || key.includes('\\')) {
      return fail('Forbidden object path', 403);
    }
    const obj = store.getObject ? await store.getObject(key) : null;
    if (!obj) return fail('Object not found', 404);
    const contentType = ALLOWED_IMAGE_MIMES.has(obj.contentType) ? obj.contentType : 'application/octet-stream';
    return new Response(obj.body, {
      status: 200,
      headers: {
        'content-type': contentType,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'cache-control': 'public, max-age=31536000',
      },
    });
  }
  if (root === 'roles') {
    return ok([]);
  }

  const branches = await store.list('branches');
  const branch = branches.find((b) => b._id === DEFAULT_BRANCH_ID) || branches[0];
  const branchTz = branch?.time_zone || 'Asia/Jakarta';
  const users = await store.list('users');
  const currentUser = getSessionUserFromRequest(request, users);

  // ── 2. Users & Session ───────────────────────────────────────────────────────
  if (root === 'users') {
    if (sub === 'verify' && method === 'POST') {
      const matched = currentUser || users[0];
      return ok(
        {
          sid: matched._id,
          usertype: matched.usertype || 'super_admin',
          firstname: matched.firstname || matched.name,
          lastname: matched.lastname || '',
          user_name: matched.user_name || matched.name,
          user_image: matched.image || 'user.svg',
          register_status: 'Opened',
          branch_image: branch.branch_image || 'store.png',
          branch_name: branch.branch_name,
          branch_phone: branch.branch_phone,
          branch_email: branch.branch_email,
          branch_address: branch.store_address,
          branch_timezone: branchTz,
          branch_timeformat: branch.time_format || 'enable',
          currency_type: branch.currency_type || 'Rp',
          branchCount: branches.length,
          branchId: branch._id,
          print_type: [
            {
              branch_id: { $oid: branch._id },
              printing_design: branch.print_type || 'thermal',
              printing_max_char: String(branch.print_character || '42'),
              printing_size: branch.print_size || '80mm',
            },
          ],
          plan: 'premium',
          userACLPlan: true,
          outstanding_customers: [],
          jwt_token: makeToken(matched),
        },
        'Successfully login'
      );
    }
    if (sub === 'getUserAccessDetails') {
      return ok(currentUser?.access || fullAcl(currentUser?.usertype || 'super_admin'));
    }
    if (sub === 'getUserDetails') {
      const doc = users.find((u) => u._id === query.id) || currentUser;
      return doc ? ok(sanitizeUser(doc)) : fail('User not found', 404);
    }
    if (sub === 'userDefaultBranchSet' || sub === 'userBranchSelection') {
      const targetBranch = branches.find((b) => b._id === query.id) || branch;
      const customers = await store.list('customers');
      const defCust = customers.find((c) => c._id === targetBranch.default_customer) || customers[0] || {};
      return ok({
        branch_id: targetBranch._id,
        branch_name: targetBranch.branch_name,
        branch_logo: targetBranch.logo || 'store.png',
        branch_phone: targetBranch.branch_phone || '',
        branch_email: targetBranch.branch_email || '',
        branch_address: targetBranch.store_address || '',
        customer_id: defCust._id || DEFAULT_CUSTOMER_ID,
        customer_name: defCust.name || 'Walk-in Customer',
        customer_phone: defCust.phone || '0000000000',
        customer_email: defCust.email || 'walkin@macisla.com',
        customer_address: defCust.address || 'Jakarta',
        user_id: currentUser?._id || DEFAULT_ADMIN_ID,
      });
    }
    if (sub === 'userVerify') return ok({ verified: true }, 'Verified');
    if (sub === 'logOut') return ok({ logged_out: true }, 'Logged out');
    if (sub === 'getUserAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const regs = await store.list('registers');
      const reg = regs[0] || {};
      const suggestions = users
        .filter((u) => !q || String(u.name || u.firstname || '').toLowerCase().includes(q))
        .map((u) => ({
          name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.name,
          userid: u._id,
          id: u._id,
          registerid: reg._id || DEFAULT_REGISTER_ID,
          registername: reg.register_name || 'Main Counter Register',
        }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }
    if (sub === 'uploadUserImage' && method === 'POST') {
      const uploaded = await saveUploadedFile(files[0], store, 'users');
      if (uploaded.error) return fail(uploaded.error, 400);
      return ok(uploaded.url || 'user.svg', 'Image uploaded');
    }
    if (sub === 'userProfile' && method === 'POST') {
      const updated = sanitizeUser({
        ...currentUser,
        firstname: body.name || currentUser.firstname,
        lastname: body.lastname ?? currentUser.lastname,
        image: body.image || currentUser.image || 'user.svg',
        updated_date: nowIso(),
      });
      await store.put('users', updated._id, updated);
      return ok({ firstname: updated.firstname, lastname: updated.lastname, imagename: updated.image }, 'Profile updated');
    }
    if (sub === 'userstatusReportTable') {
      const safeUsers = users.map(sanitizeUser);
      return ok({ list: safeUsers, total: safeUsers.length });
    }
    if (!sub && method === 'POST') {
      const id = newObjectId();
      const uname = String(body.username || body.name || body.app_name || 'staff').trim();
      const doc = sanitizeUser({
        ...body,
        _id: id,
        id,
        name: uname,
        username: uname,
        user_name: uname,
        activate: body.activate !== undefined ? bool(body.activate, true) : String(body.status || '').toLowerCase() !== 'inactive',
        access: body.access || fullAcl(body.usertype || 'manager'),
        image: body.image || 'user.svg',
        created_date: nowIso(),
        updated_date: nowIso(),
      });
      await store.put('users', id, doc);
      return ok(doc, 'User saved');
    }
  }

  // ── 3. Branches & Registers ──────────────────────────────────────────────────
  if (root === 'branches') {
    if (sub === 'userRegisterBranchSelect') {
      const regs = await store.list('registers');
      const openReg = regs.find((r) => r.register_status === 'Opened') || regs[0];
      return ok({
        cash_register_enable: branch.cash_register_enable !== false,
        open_register: openReg
          ? {
              register_status: 'Opened',
              resume_required: false,
              cash_register_id: openReg.cash_register_id || DEFAULT_CASH_REGISTER_ID,
              register_id: openReg._id,
              register_name: openReg.register_name,
            }
          : null,
        register_data: regs.map((r) => ({
          register_id: r._id,
          register_name: r.register_name,
          in_use: true,
          in_use_by: currentUser?.user_name || 'admin',
          in_use_by_me: true,
        })),
      });
    }
    if (sub === 'getBranchList') {
      return ok(branches.map((b) => ({ id: b._id, _id: b._id, branch_name: b.branch_name || b.name, branch_image: b.branch_image || b.logo || 'store.png' })));
    }
    if (sub === 'getOneStore' || sub === 'getBranchDetails') {
      const target = branches.find((b) => b._id === query.id) || branch;
      const regs = await store.list('registers');
      return ok({
        ...target,
        register: regs.map((r) => ({ _id: r._id, register_name: r.register_name })),
        sms_auto_send_time: target.sms_auto_send_time || '09:00 PM',
        payment_gateway: target.payment_gateway || { status: 'false', key: '', secret: '' },
        currency_value: target.currency_value || [{ currency_sign: target.currency_type || 'Rp', currency_text: target.currency_text || 'IDR' }],
        email_fields: Array.isArray(target.email_fields) ? target.email_fields : [],
        print_a4html: target.print_a4html || PRINT_A4_TEMPLATE,
        print_standard_html: target.print_standard_html || PRINT_THERMAL_TEMPLATE,
      });
    }
  }

  if (root === 'registers') {
    const regs = await store.list('registers');
    if (sub === 'getCashRegister' || sub === 'registerCheckTime') {
      const active = regs[0];
      return ok({
        register_status: active?.register_status || 'Opened',
        register_id: active?._id || DEFAULT_REGISTER_ID,
        cash_register_id: active?.cash_register_id || DEFAULT_CASH_REGISTER_ID,
        register_name: active?.register_name || 'Main Counter Register',
        opening_balance: active?.opening_balance || 500000,
        opened_at: active?.opened_at || nowIso(),
        exceeded: false,
      });
    }
    if (sub === 'registerAdd' && (method === 'POST' || method === 'PUT')) {
      const active = regs[0] || { _id: DEFAULT_REGISTER_ID, register_name: 'Main Counter Register' };
      const updated = {
        ...active,
        register_status: 'Opened',
        opening_balance: num(body.opening_balance ?? body.opening_float ?? body.amount, active.opening_balance || 0),
        opened_at: nowIso(),
        updated_date: nowIso(),
      };
      await store.put('registers', updated._id, updated);
      return ok(updated, 'Register opened');
    }
    if (sub === 'registerClose' && (method === 'POST' || method === 'PUT')) {
      const active = regs[0];
      if (active) {
        await store.put('registers', active._id, { ...active, register_status: 'Closed', closed_at: nowIso(), updated_date: nowIso() });
      }
      return ok({ register_status: 'Closed' }, 'Register closed');
    }
    if (sub === 'registerReportTable') {
      const completed = (await listDocs(store, 'sales')).filter((s) => s.sale_process !== 'Hold' && !/cancel/i.test(String(s.sale_process || '')));
      const byMode = new Map();
      let grand = 0;
      for (const s of completed) {
        const amt = num(s.sales_total ?? s.total_amount);
        grand += amt;
        const m = s.payment_mode || 'Cash';
        byMode.set(m, (byMode.get(m) || 0) + amt);
      }
      const rows = regs.map((r) => ({
        ...r,
        id: r._id,
        open_date: r.opened_at || r.created_date,
        close_date: r.closed_at || null,
        opening_float: num(r.opening_balance, 500000),
        register_amount: num(r.opening_balance, 500000) + grand,
        countedAmount: [],
      }));
      return ok({
        ...paginateReport(rows, query),
        data: Array.from(byMode.entries()).map(([payment_mode, sale_total]) => ({ payment_mode, sale_total })),
      });
    }
    if (sub === 'registerSaleDetails' || sub === 'getRegisterReportDetails') {
      const salesAll = (await listDocs(store, 'sales', { limit: 200 })).filter((s) => s.sale_process !== 'Hold');
      return ok({ ...paginateReport(salesAll, query), sales: salesAll });
    }
  }

  // ── 4. Dashboard ─────────────────────────────────────────────────────────────
  if (root === 'dashboard') {
    const filter = query.filter || 'day';
    const pStart = periodStartMs(filter, branchTz);
    const rangeOpts = pStart !== null ? { sinceIso: new Date(pStart - 60_000).toISOString() } : {};

    const [rawSales, rawReceivings, rawExpenses] = await Promise.all([
      listDocs(store, 'sales', rangeOpts),
      listDocs(store, 'receivings', rangeOpts),
      listDocs(store, 'expenses', rangeOpts),
    ]);

    const sales = rawSales.filter(
      (s) => s.sale_process !== 'Hold' && !/cancel/i.test(String(s.sale_process || '')) && inFilterPeriod(s.created_date || s.date, filter, branchTz)
    );
    const receivings = rawReceivings.filter((r) => inFilterPeriod(r.created_date || r.date, filter, branchTz));
    const expenses = rawExpenses.filter((e) => inFilterPeriod(e.created_date || e.date, filter, branchTz));

    let total_sales = 0, total_tax = 0, total_cash = 0, total_upi = 0, total_card = 0, cogs = 0;
    const itemMap = new Map();
    for (const s of sales) {
      const amt = num(s.sales_total ?? s.total_amount);
      total_sales += amt;
      total_tax += num(s.tax);
      cogs += num(s.sales_total_company_price);
      const pm = String(s.payment_mode || 'Cash').toLowerCase();
      if (pm.includes('cash')) total_cash += amt;
      else if (pm.includes('card')) total_card += amt;
      else total_upi += amt;

      for (const li of normalizeItemsPayload(s.items)) {
        const name = li.item_name || li.name || 'Item';
        const prev = itemMap.get(name) || { item_name: name, total_qty: 0, total_amount: 0 };
        prev.total_qty += num(li.item_quantity || li.quantity, 1);
        prev.total_amount += hasNumericValue(li.item_price_total)
          ? num(li.item_price_total)
          : num(li.item_price ?? li.selling_price) * num(li.item_quantity, 1);
        itemMap.set(name, prev);
      }
    }

    const total_purchase = receivings.reduce((acc, r) => acc + num(r.receiving_total ?? r.total_amount), 0);
    const total_expenses = expenses.reduce((acc, e) => acc + num(e.amount ?? e.expense_amount), 0);
    const gross_profit = total_sales - cogs;
    const net_profit = gross_profit - total_expenses;
    const margin_percent = total_sales > 0 ? Number(((net_profit / total_sales) * 100).toFixed(1)) : 0;
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.total_amount - a.total_amount).slice(0, 8);
    const profit = {
      revenue: total_sales, cogs, gross_profit, expenses: total_expenses, net_profit, margin_percent,
      sales_count: sales.length, purchases: total_purchase, cash_flow: total_sales - total_purchase - total_expenses, cost_reliable: true,
    };

    if (sub === 'getOverview') {
      return ok({ kpis: { total_sales, total_purchase, total_expenses, total_tax, total_upi, total_cash, total_card }, topItems, profit });
    }
    if (sub === 'getProfitSummary') return ok(profit);
    if (sub === 'getDashboardBestSellingProducts') return ok({ best_selling_products: topItems });
    if (sub === 'getDashboardTopPerformers') {
      return ok({
        user_name: currentUser ? `${currentUser.firstname} ${currentUser.lastname}`.trim() : 'Macisla Admin',
        email: currentUser?.email || 'admin@macisla.com',
        user_type: currentUser?.usertype || 'super_admin',
        sales_count: sales.length,
        sales_amount: total_sales,
      });
    }
    if (sub === 'getDashboardExpiredProducts') return ok({ expired_stock_items: [] });
    if (sub === 'getPendingActivities') return ok([]);
    if (sub === 'setupChecklist') {
      const [items, taxes] = await Promise.all([store.list('items'), store.list('taxes')]);
      return ok({
        checks: [
          { key: 'outlet', done: Boolean(branch?.branch_name) },
          { key: 'items', done: items.length > 0 },
          { key: 'receipt', done: true },
          { key: 'employees', done: users.length > 0 },
          { key: 'taxes', done: taxes.length > 0 },
        ],
      });
    }
  }

  // ── 5. Items (`/items/*`) ────────────────────────────────────────────────────
  if (root === 'items') {
    const items = await store.list('items');

    if (sub === 'onlineSalesItemsAjaxLists') {
      const catId = String(query.category_id || '').trim();
      const offset = Math.max(0, parseInt(query.offset || '0', 10) || 0);
      const limit = Math.max(1, parseInt(query.limit || '48', 10) || 48);
      let filtered = items.filter((it) => it.available_for_sale !== false);
      if (catId) filtered = filtered.filter((it) => String(it.category_id) === catId);
      const slice = filtered.slice(offset, offset + limit);
      return ok({ items: slice, next_offset: offset + limit < filtered.length ? offset + limit : null, total: filtered.length });
    }

    if (sub === 'getOnlineItemsAjaxList' || sub === 'getCustomerSearchItemsAjaxList' || sub === 'getReceivingItemsAjaxList' || sub === 'search') {
      const q = String(query.query || query.q || '').trim().toLowerCase();
      const type = String(query.type || '').toLowerCase();
      const matched = items.filter((it) => {
        if (!q) return true;
        if (type === 'barcode') return String(it.barcode_id || '').toLowerCase() === q || String(it.itemid || '').toLowerCase() === q;
        return ['name', 'itemid', 'barcode_id', 'category_name'].some((f) => String(it[f] || '').toLowerCase().includes(q));
      });
      const suggestions = matched.slice(0, 30).map((it) => ({ ...it, value: it.name, item_id: it._id, item_name: it.name }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }

    if (sub === 'getItemDetails') {
      const targetId = String(query.id || '').trim();
      const found = targetId ? await store.get('items', targetId) : null;
      return found ? ok(found) : fail('Item not found', 404);
    }

    if (sub === 'getItemsByCategoryId') {
      const catId = String(query.category_id || query.id || '').trim();
      return ok(catId ? items.filter((it) => String(it.category_id) === catId) : items);
    }

    if (sub === 'bySupplier' || sub === 'getItemsBySupplier') {
      const supId = String(query.supplier_id || '').trim();
      let matched = supId ? items.filter((it) => String(it.supplier_id) === supId) : items;
      if (bool(query.low_only)) matched = matched.filter((it) => it.track_inventory && num(it.available_quantity) <= num(it.low_stock, 5));
      return ok(matched);
    }

    if (sub === 'family') {
      const famId = String(query.family_id || '').trim();
      return ok(famId ? items.filter((it) => String(it.variant_family_id) === famId) : []);
    }

    if (sub === 'pricePreview' && method === 'POST') {
      return ok(
        calcPriceBreakdown({
          base: num(body.price),
          discountAmount: num(body.discount_amount),
          discountPercent: num(body.discount_percentage),
          taxRate: num(body.tax),
          taxType: body.tax_type,
        })
      );
    }

    if (sub === 'uploadItemMultiImage' && method === 'POST') {
      if (!store.putObject) return fail('R2 object storage is not configured', 500);
      const pending = Array.isArray(body.items_image) ? body.items_image : [];
      if (!pending.length || pending.length > MAX_UPLOAD_FILES) {
        return fail(`Upload between 1 and ${MAX_UPLOAD_FILES} images`, 400);
      }
      const parsedEntries = [];
      for (const entry of pending) {
        const cleanName = String(entry?.name || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '-');
        const ext = (cleanName.split('.').pop() || '').toLowerCase();
        const extMime = MIME_BY_EXT[ext] || '';
        const decoded = decodeBase64Bytes(entry?.data || '');
        if (!decoded) return fail('Invalid base64 image data', 400);
        const contentType = decoded.mime || extMime;
        if (!ALLOWED_IMAGE_MIMES.has(contentType) || (decoded.mime && !ALLOWED_IMAGE_MIMES.has(decoded.mime))) {
          return fail('Only PNG, JPEG, GIF, BMP, or WebP images are allowed', 400);
        }
        if (!decoded.bytes.byteLength || decoded.bytes.byteLength > MAX_UPLOAD_BYTES) {
          return fail('Each image must be non-empty and under 5 MB', 400);
        }
        parsedEntries.push({
          cleanName,
          bytes: decoded.bytes,
          contentType,
          size: num(entry?.size, decoded.bytes.byteLength),
          cover: entry?.cover === 'yes' ? 'yes' : 'no',
        });
      }
      const out = [];
      for (const item of parsedEntries) {
        const key = `pos/items/${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${item.cleanName}`;
        await store.putObject(key, item.bytes.buffer, item.contentType);
        out.push({ name: `/r2/${key}`, size: item.size, cover: item.cover });
      }
      return ok(out, 'Images uploaded');
    }

    if (sub === 'uploadItemImage' && method === 'POST') {
      const uploaded = await saveUploadedFile(files[0], store, 'items');
      if (uploaded.error) return fail(uploaded.error, 400);
      return ok(uploaded.url || 'item.svg', 'Image uploaded');
    }

    if (sub === 'createFamily' && method === 'POST') {
      const rows = Array.isArray(body.items) ? body.items : Array.isArray(body) ? body : [];
      if (!rows.length) return fail('No variant items provided', 400);
      const [cats, sups, units] = await Promise.all([store.list('categories'), store.list('suppliers'), store.list('units')]);
      const famId = newObjectId();
      const created = [];
      const docs = [];
      for (const row of rows) {
        const id = newObjectId();
        const doc = normalizeItemDoc(
          { ...row, variant_family_id: famId, variant_axis: body.variant_axis, variant_parent_name: body.variant_parent_name },
          null,
          { cats, sups, units, branchId: DEFAULT_BRANCH_ID, userName: currentUser?.user_name, id }
        );
        await store.put('items', id, doc);
        created.push(id);
        docs.push(doc);
      }
      return ok({ id: created[0], created, items: docs, variant_family_id: famId }, 'Variant family saved');
    }

    if (sub === 'instanceItemInsert' && method === 'POST') {
      const [cats, sups, units] = await Promise.all([store.list('categories'), store.list('suppliers'), store.list('units')]);
      const id = newObjectId();
      const doc = normalizeItemDoc(body, null, { cats, sups, units, branchId: DEFAULT_BRANCH_ID, userName: currentUser?.user_name, id });
      await store.put('items', id, doc);
      return ok({ ...doc, item_id: id }, 'Item added successfully');
    }

    if (sub === 'quickPatch' && method === 'POST') {
      const targetId = String(body.id || body.item_id || '').trim();
      const existing = targetId ? await store.get('items', targetId) : null;
      if (!existing) return fail('Item not found', 404);
      const [cats, sups, units] = await Promise.all([store.list('categories'), store.list('suppliers'), store.list('units')]);
      const updated = normalizeItemDoc(body, existing, { cats, sups, units, branchId: DEFAULT_BRANCH_ID, userName: currentUser?.user_name, id: targetId });
      await store.put('items', targetId, updated);
      return ok(updated, 'Item updated successfully');
    }

    if ((sub === 'stockAdjustment' || sub === 'updateItemQuantity') && method === 'POST') {
      const targetId = String(body.item_id || body.id || '').trim();
      const existing = targetId ? await store.get('items', targetId) : null;
      if (!existing) return fail('Item not found', 404);
      const opening = num(existing.available_quantity);
      const delta = body.delta !== undefined ? num(body.delta) : body.quantity !== undefined ? num(body.quantity) - opening : 0;
      const closing = Math.max(0, body.available_quantity !== undefined ? num(body.available_quantity) : body.quantity !== undefined ? num(body.quantity) : opening + delta);
      const updated = { ...existing, available_quantity: closing, updated_date: nowIso() };
      await store.put('items', targetId, updated);
      const logId = newObjectId();
      await store.put('stocklogs', logId, {
        _id: logId, id: logId, item_id: targetId, item_name: existing.name,
        process: body.reason || 'Stock adjustment', reference: body.reference || body.remarks || '-',
        count: closing - opening, opening_balance: opening, closing_balance: closing,
        created_date: nowIso(), updated_date: nowIso(),
      });
      return ok(updated, 'Stock updated');
    }

    if (sub === 'itemLowStockTable') {
      const low = items.filter((it) => it.track_inventory && num(it.available_quantity) <= num(it.low_stock, 5));
      return ok({ list: low, total: low.length, low_stock_count: low.length });
    }
    if (sub === 'itemStockReportTable') {
      let company_total = 0, selling_total = 0;
      const rows = items.map((it) => {
        const qty = num(it.available_quantity), cp = num(it.company_price), sp = num(it.selling_price);
        company_total += cp * qty;
        selling_total += sp * qty;
        return { _id: it._id, name: it.name, itemid: it.itemid || '', available_quantity: qty, company_price: cp, company_total: cp * qty, selling_price: sp, selling_total: sp * qty };
      });
      return ok({ ...paginateReport(rows, query), company_total, selling_total });
    }
    if (sub === 'categoryItemsReportTable' || sub === 'supplierItemsReportTable' || sub === 'itemReportTable') {
      const rows = items.map((it) => ({
        _id: it._id, name: it.name, category_name: it.category_name || 'General',
        supplier_name: it.supplier_name || 'Macisla Supply Co.',
        available_quantity: num(it.available_quantity), selling_price: num(it.selling_price), company_price: num(it.company_price),
      }));
      return ok(paginateReport(rows, query));
    }
    if (sub === 'quantityCount') return ok({ count: items.length });
    if (sub === 'demo' && sub2 === 'status') return ok({ on: false, total: 0, counts: {} });
    if (sub === 'demo') return ok({ removed: 0 }, 'Demo disabled');
    if (sub === 'icon-suggestion') return ok({ icon: '' });
    if (sub === 'aiAvailability') return ok({ available: false });
    if (sub === 'getJSONhsncode') return ok({ hsn: [] });
    if (sub === 'catalogue-sharing') return ok({ enabled: false, branches: [] });
    if (sub === 'stockPreference') {
      if (method === 'PUT' || method === 'POST') {
        await store.put('meta', 'stock_preference', { _id: 'stock_preference', preference: body.preference || 'track' });
        return ok({ preference: body.preference || 'track' }, 'Preference saved');
      }
      return ok({ preference: (await store.get('meta', 'stock_preference'))?.preference || 'track' });
    }
    if (['priceSheet', 'priceGrid', 'expiryReport', 'expiryReminders'].includes(sub) || sub.startsWith('priceHistory')) {
      return ok({ list: [], total: 0 });
    }
    if (sub === 'deleteInstant') {
      const delIds = Array.isArray(body?.data) ? body.data : [body?.id || query.id].filter(Boolean);
      for (const delId of delIds) await store.del('items', String(delId));
      return ok({ deleted: true, count: delIds.length });
    }

    if (!sub && method === 'GET') {
      const { list, total } = applyListFilters(items, query, ['name', 'itemid', 'barcode_id', 'category_name', 'supplier_name'], branchTz);
      const summary = {
        total: items.length,
        inactive: items.filter((i) => i.status === 'Inactive' || i.available_for_sale === false).length,
        out: items.filter((i) => i.track_inventory && num(i.available_quantity) <= 0).length,
        low: items.filter((i) => i.track_inventory && num(i.available_quantity) > 0 && num(i.available_quantity) <= num(i.low_stock, 5)).length,
      };
      return ok({ list, total, summary });
    }
    if (!sub && method === 'POST') {
      const [cats, sups, units] = await Promise.all([store.list('categories'), store.list('suppliers'), store.list('units')]);
      const id = newObjectId();
      const doc = normalizeItemDoc(body, null, { cats, sups, units, branchId: DEFAULT_BRANCH_ID, userName: currentUser?.user_name, id });
      await store.put('items', id, doc);
      return ok(doc, 'Item added successfully');
    }
    if (isObjectId(sub) && method === 'GET' && !sub2) {
      const doc = await store.get('items', sub);
      return doc ? ok(doc) : fail('Item not found', 404);
    }
    if (isObjectId(sub) && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
      const existing = await store.get('items', sub);
      if (!existing) return fail('Item not found', 404);
      const payload = { ...body };
      if (sub2 === 'details') delete payload.available_quantity;
      const [cats, sups, units] = await Promise.all([store.list('categories'), store.list('suppliers'), store.list('units')]);
      const updated = normalizeItemDoc(payload, existing, { cats, sups, units, branchId: DEFAULT_BRANCH_ID, userName: currentUser?.user_name, id: sub });
      await store.put('items', sub, updated);
      return ok(updated, 'Item updated successfully');
    }
  }

  // ── 6. Categories, Customers, Suppliers ──────────────────────────────────────
  if (root === 'categories') {
    const categories = await store.list('categories');
    const items = await store.list('items');
    if (sub === 'getCategoriesWithValidItems') {
      return ok(
        categories.map((c) => ({
          id: c._id, _id: c._id, category_name: c.name || c.category_name,
          category_img: c.image || 'category.svg', name: c.name || c.category_name,
          image: c.image || 'category.svg', tile_color: c.tile_color || '#2563EB',
        }))
      );
    }
    if (sub === 'getCategoryAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const suggestions = categories
        .filter((c) => !q || String(c.name || '').toLowerCase().includes(q))
        .map((c) => ({ id: c._id, _id: c._id, value: c.name, name: c.name, category_name: c.name }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }
    if (!sub && method === 'GET') {
      const enriched = categories.map((c) => ({ ...c, items_count: items.filter((i) => String(i.category_id) === String(c._id)).length }));
      const { list, total } = applyListFilters(enriched, query, ['name', 'description'], branchTz);
      return ok({ list, total });
    }
    if (!sub && method === 'POST') {
      const id = newObjectId();
      const name = String(body.name || body.category_name || 'Untitled Category').trim();
      const doc = { ...body, _id: id, id, name, category_name: name, created_date: nowIso(), updated_date: nowIso() };
      await store.put('categories', id, doc);
      return ok(doc, 'Category added successfully');
    }
  }

  if (root === 'customers') {
    const customers = await store.list('customers');
    if (sub === 'getCustomersAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const suggestions = customers
        .filter((c) => !q || String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').toLowerCase().includes(q))
        .map((c) => ({ ...c, id: c._id, value: c.name, customer_id: c._id, customer_name: c.name }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }
    if (sub === 'getCustomerDetails') {
      const doc = customers.find((c) => c._id === query.id);
      return doc ? ok(doc) : fail('Customer not found', 404);
    }
    if (sub === 'customerOutstandingReportTable') return ok(paginateReport([], query));
    if (!sub && method === 'POST') {
      const id = newObjectId();
      const name = String(body.name || body.customer_name || 'Customer').trim();
      const doc = { ...body, _id: id, id, name, customer_name: name, created_date: nowIso(), updated_date: nowIso() };
      await store.put('customers', id, doc);
      return ok(doc, 'Customer added successfully');
    }
  }

  if (root === 'suppliers') {
    const suppliers = await store.list('suppliers');
    if (sub === 'getSuppliersAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const suggestions = suppliers
        .filter((s) => !q || String(s.name || '').toLowerCase().includes(q))
        .map((s) => ({ ...s, id: s._id, value: s.name, supplier_id: s._id, supplier_name: s.name }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }
    if (!sub && method === 'POST') {
      const id = newObjectId();
      const name = String(body.name || body.supplier_name || 'Supplier').trim();
      const doc = { ...body, _id: id, id, name, supplier_name: name, created_date: nowIso(), updated_date: nowIso() };
      await store.put('suppliers', id, doc);
      return ok(doc, 'Supplier added successfully');
    }
  }

  // ── 7. Sales & Unlocked Reports (`/sales/*`) ─────────────────────────────────
  if (root === 'sales') {
    if (sub === 'getLatestSales') {
      const wantHold = String(query.type || '').toLowerCase() === 'hold';
      const sales = await listDocs(store, 'sales', wantHold ? {} : { limit: 60 });
      const rows = sales
        .filter((s) => (wantHold ? s.sale_process === 'Hold' : s.sale_process !== 'Hold'))
        .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
        .slice(0, 25)
        .map((s) => ({
          sales_document_id: s._id,
          sales_id: s.sales_id,
          customer_name: s.customer_name || 'Walk-in Customer',
          number_of_items: s.number_of_items || normalizeItemsPayload(s.items).length,
          total_amount: num(s.sales_total ?? s.total_amount),
          payment_status: s.payment_status || 'Paid',
          sale_process: s.sale_process || 'Add',
          parked_at: s.parked_at || s.created_date,
        }));
      return ok(JSON.stringify(rows));
    }

    if (sub === 'parked' && sub2 === 'clear' && method === 'POST') {
      const sales = await store.list('sales');
      let cleared = 0;
      for (const s of sales) {
        if (s.sale_process === 'Hold') {
          await store.del('sales', s._id);
          cleared++;
        }
      }
      return ok({ cleared }, `${cleared} parked sales cleared`);
    }

    if (sub === 'servingPeriods') {
      return ok({ restaurant_enabled: branch.table_options === true, serving_periods: [] });
    }
    if (sub === 'historyFilterOptions') {
      return ok({ payment_modes: ['Cash', 'QRIS', 'Card', 'Transfer'], users: users.map((u) => ({ id: u._id, name: u.user_name })) });
    }

    if (sub === 'hold' && (method === 'POST' || method === 'PUT')) {
      const maybeId = String(body.sales_id || '').trim();
      const existing = isObjectId(maybeId) ? await store.get('sales', maybeId) : null;
      const saved = await saveSale(body, store, branch, currentUser, { hold: true, existing });
      return ok({ sales_id: saved._id, id: saved._id, _id: saved._id }, 'Sale parked successfully');
    }

    if (sub === 'cancel' && isObjectId(sub2)) {
      const existing = await store.get('sales', sub2);
      if (!existing) return fail('Sale not found', 404);
      const updated = { ...existing, sale_process: 'Cancel', payment_status: 'Cancelled', updated_date: nowIso() };
      await store.put('sales', sub2, updated);
      await applyStockDelta(saleItemStockMap(existing), new Map(), store);
      return ok(updated, 'Sale cancelled');
    }

    if (sub === 'returnSales' && method === 'POST') {
      const saved = await saveSale({ ...body, sale_process: 'Return', payment_status: 'Refunded' }, store, branch, currentUser, { hold: false });
      return ok({ sales_id: saved._id, id: saved._id, _id: saved._id, bill_no: saved.sales_id }, 'Return processed');
    }

    if (!sub && method === 'POST') {
      const maybeId = String(body.sales_id || '').trim();
      const existing = isObjectId(maybeId) ? await store.get('sales', maybeId) : null;
      const saved = await saveSale(body, store, branch, currentUser, { hold: false, existing });
      return ok(
        {
          sales_id: saved._id, id: saved._id, _id: saved._id, bill_no: saved.sales_id,
          sms: false, whatsapp: false, print: false, mail: false,
          phone: saved.customer_phone || '', name: saved.customer_name || 'Walk-in Customer', customer_balance: 0,
        },
        'Sales details added successfully'
      );
    }

    if (!sub && method === 'GET') {
      const sales = await listDocs(store, 'sales');
      const nonHold = sales.filter((s) => s.sale_process !== 'Hold');
      const { list, total, allFiltered } = applyListFilters(nonHold, query, ['sales_id', 'customer_name', 'sold_by', 'payment_mode'], branchTz);
      const payTotals = new Map();
      let grandTotal = 0, cancelled = 0;
      for (const s of allFiltered) {
        if (/cancel/i.test(String(s.sale_process || '')) || /cancel/i.test(String(s.payment_status || ''))) {
          cancelled++;
          continue;
        }
        const amt = num(s.sales_total ?? s.total_amount);
        grandTotal += amt;
        const pm = s.payment_mode || 'Cash';
        payTotals.set(pm, (payTotals.get(pm) || 0) + amt);
      }
      return ok({
        list,
        total,
        summary: {
          count: allFiltered.length,
          cancelled,
          currencies: [
            {
              currencyCode: branch.currency_type || 'Rp',
              currencySymbol: branch.currency_type || 'Rp',
              currencyDigits: 2,
              total: grandTotal,
              payments: Array.from(payTotals.entries()).map(([methodName, amount]) => ({ method: methodName, amount })),
            },
          ],
        },
      });
    }

    if (isObjectId(sub) && method === 'GET') {
      const sale = await store.get('sales', sub);
      return sale ? ok(sale) : fail('Sale not found', 404);
    }
    if (isObjectId(sub) && (method === 'PUT' || method === 'PATCH')) {
      const existing = await store.get('sales', sub);
      if (!existing) return fail('Sale not found', 404);
      const saved = await saveSale(body, store, branch, currentUser, { hold: false, existing });
      return ok(saved, 'Sale updated');
    }

    if (SALES_REPORT_SUBROUTES.has(sub)) {
      const sales = await listDocs(store, 'sales', reportDateBounds(query, branchTz));
      return buildSalesReportResponse(sub, sales, query, store, branch, branchTz);
    }
  }

  // ── 8. Settings (`/setting/*` and `/settings/*`) ────────────────────────────
  if (root === 'setting' || root === 'settings') {
    if (sub === 'group' && sub2) {
      const metaKey = `settings_group_${sub2}`;
      if (method === 'PUT' || method === 'POST') {
        const nextValues = body.values && typeof body.values === 'object' ? body.values : body;
        await store.put('meta', metaKey, { _id: metaKey, values: nextValues, updated_date: nowIso() });
        return ok({ values: nextValues }, 'Settings saved');
      }
      const saved = await store.get('meta', metaKey);
      return ok({ values: saved?.values || {} });
    }
    if (sub === 'getThemeSettings') {
      return ok((await store.get('meta', 'theme')) || { theme: 'light', theme_name: 'default', primary_color: '#506fe4' });
    }
    if (sub === 'updateThemeSettings' && (method === 'POST' || method === 'PUT')) {
      const next = { _id: 'theme', ...body, updated_date: nowIso() };
      await store.put('meta', 'theme', next);
      return ok(next, 'Theme updated');
    }
    if (sub === 'getTaxAll' || sub === 'getTaxAjaxList') {
      const taxes = (await store.list('taxes')).map((t) => ({ ...t, tax_id: t.tax_id || t._id }));
      return jsonResp({ type: 'success', status: true, message: 'Success', suggestions: taxes, data: taxes });
    }
    if (sub === 'getPaymentAll') return ok(await store.list('payments'));
    if (sub === 'getDenomAll') return ok(await store.list('denominations'));
    if (sub === 'getUnitAll' || sub === 'getUnitAjaxList') {
      const units = (await store.list('units')).map((u) => ({
        ...u,
        unit_id: u.unit_id || u._id,
        unit_value: u.unit_value || u.unit_short || u.unit_name,
      }));
      return jsonResp({ type: 'success', status: true, message: 'Success', suggestions: units, data: units });
    }
    if (sub === 'getDefaultCustomer') {
      const customers = await store.list('customers');
      const c = customers.find((x) => x._id === branch.default_customer) || customers[0] || {};
      const cid = c._id || DEFAULT_CUSTOMER_ID;
      const cname = c.customer_name || c.name || 'Walk-in Customer';
      return ok({
        customer_id: cid,
        customer_name: cname,
        customer: {
          ...c,
          _id: cid,
          id: cid,
          customer_id: cid,
          customer_name: cname,
          customer_phone: c.customer_phone || c.phone || '0000000000',
          customer_email: c.customer_email || c.email || 'walkin@macisla.com',
          customer_address: c.customer_address || c.address || 'Jakarta',
          customer_state: c.customer_state || c.state || '',
          customer_country: c.customer_country || c.country || 'Indonesia',
          customer_gst_type: c.customer_gst_type || '',
          customer_gst_number: c.customer_gst_number || '',
          customer_balance: num(c.customer_balance),
          customer_partial: num(c.partial_balance ?? c.customer_partial),
        },
      });
    }
    if (sub === 'getDefaultSupplier') {
      const suppliers = await store.list('suppliers');
      const s = suppliers.find((x) => x._id === branch.default_supplier) || suppliers[0] || {};
      const sid = s._id || DEFAULT_SUPPLIER_ID;
      const sname = s.supplier_name || s.name || 'Macisla Supply Co.';
      return ok({
        supplier_id: sid,
        supplier_name: sname,
        supplier: {
          ...s,
          _id: sid,
          id: sid,
          supplier_id: sid,
          supplier_name: sname,
          supplier_phone: s.supplier_phone || s.phone || '+62 21-555-0199',
          supplier_email: s.supplier_email || s.email || 'supply@macisla.com',
          supplier_address: s.supplier_address || s.address || 'Jl. Kemang Raya No. 12, Jakarta',
          supplier_state: s.supplier_state || s.state || 'DKI Jakarta',
          supplier_gst_type: s.supplier_gst_type || '',
          supplier_gst_number: s.supplier_gst_number || '',
        },
      });
    }
    if (sub === 'getJSONCountry') return ok(COUNTRIES);
    if (sub === 'getJSONState') return ok(STATES_BY_COUNTRY[Number(query.id || query.country_id || 102)] || STATES_BY_COUNTRY[102]);
    if (sub === 'getJSONCurrency') return ok(CURRENCIES);
    if (sub === 'getJSONTimeZone') return ok(TIMEZONES);
    if (sub === 'getJSONDate') return ok(DATE_FORMATS);
    if (sub === 'starterLocale') return ok({ country: branch.country, currency: branch.currency_type, timezone: branchTz });
    if (sub === 'taxProfile') return ok({ country: branch.country || 'Indonesia', tax_label: 'PPN', gst_enabled: false });
    if (sub === 'modifierGroups' || sub === 'priceLists') return ok([]);
    if (sub === 'wording') return ok({ profile: 'retail', overrides: {} });
    if (method === 'PUT' || method === 'POST') {
      const merged = { ...branch, ...body, updated_date: nowIso() };
      await store.put('branches', branch._id, merged);
      return ok({ ...merged, url: merged.print_url || false, customer: merged.default_customer, supplier: merged.default_supplier }, 'Settings updated successfully');
    }
    return ok(branch);
  }

  // ── 9. Expenses, Receivings & Auxiliary Modules ──────────────────────────────
  if (root === 'expenses' && sub === 'expensesReportTable') {
    const rawExpenses = await listDocs(store, 'expenses', reportDateBounds(query, branchTz));
    const expenses = rawExpenses.filter((e) => inReportDateRange(e.created_date || e.date, query, branchTz));
    const rows = expenses.map((e) => ({
      ...e,
      amount: num(e.amount ?? e.expense_amount),
      type: e.type || e.expense_type || 'General',
      category: e.category || e.expense_category || 'Operations',
      recipientname: e.recipientname || e.recipient || '-',
      approvedby: e.approvedby || e.approved_by || currentUser?.user_name || 'admin',
      description: e.description || e.note || '',
    }));
    return ok(paginateReport(rows, query));
  }
  if (root === 'receivings' && ['receivingReportTable', 'returnReceivingReportTable', 'supplierReceivingReportTable'].includes(sub)) {
    const rawRecs = await listDocs(store, 'receivings', reportDateBounds(query, branchTz));
    const recs = rawRecs.filter((r) => inReportDateRange(r.created_date || r.date, query, branchTz));
    let purchased = 0, paid = 0;
    const rows = recs.map((r) => {
      const tot = num(r.receiving_total ?? r.total_amount);
      purchased += tot;
      paid += /unpaid/i.test(String(r.payment_status || '')) ? 0 : tot;
      return {
        ...r,
        receiving_id: r.receiving_id || `P-${String(r._id).slice(-4)}`,
        string_date: r.string_date || r.date || r.created_date,
        supplier_name: r.supplier_name || 'Macisla Supply Co.',
        supplier_phone: r.supplier_phone || '',
        items: normalizeItemsPayload(r.items),
        items_total: tot,
      };
    });
    return ok({
      ...paginateReport(rows, query),
      summary: { count: rows.length, purchased, paid, outstanding: Math.max(0, purchased - paid), unknown: 0 },
    });
  }
  if (root === 'receivings' && !sub && method === 'POST') {
    const id = newObjectId();
    const doc = { ...body, _id: id, id, created_date: nowIso(), updated_date: nowIso() };
    await store.put('receivings', id, doc);
    const recvEffects = new Map();
    for (const li of normalizeItemsPayload(body.items)) {
      const itemId = String(li.item_id?._id || li.item_id || li.product_id || li._id || '').trim();
      if (itemId) recvEffects.set(itemId, (recvEffects.get(itemId) || 0) + num(li.item_quantity ?? li.quantity, 1));
    }
    await applyStockDelta(new Map(), recvEffects, store);
    return ok(doc, 'Receiving saved successfully');
  }
  if (root === 'shifts') return ok({ rows: [], active_shift: null });
  if (root === 'roster') return ok([]);
  if (root === 'table' || root === 'kot') return ok({ list: [], total: 0, tables: [] });
  if (root === 'stocklogs') {
    const logs = await store.list('stocklogs');
    return ok(applyListFilters(logs, query, ['item_name', 'process', 'reference'], branchTz));
  }

  // ── 10. Allowlisted Generic CRUD ─────────────────────────────────────────────
  const collection = root || 'misc';
  if (!CRUD_COLLECTIONS.has(collection)) {
    return method === 'GET' ? ok({ list: [], total: 0 }) : fail('Unknown resource', 404);
  }

  if (!sub && method === 'GET') {
    const docs = await store.list(collection);
    const cleaned = collection === 'users' ? docs.map(sanitizeUser) : docs;
    const { list, total } = applyListFilters(cleaned, query, ['name', 'title', 'phone', 'email', 'description', 'sales_id'], branchTz);
    return ok({ list, total });
  }
  if (sub && method === 'GET') {
    const doc = await store.get(collection, sub);
    if (!doc) return ok({ list: [], total: 0 });
    return ok(collection === 'users' ? sanitizeUser(doc) : doc);
  }
  if (!sub && method === 'POST') {
    const id = newObjectId();
    const baseDoc = collection === 'users' ? sanitizeUser(body) : body;
    const doc = { ...baseDoc, _id: id, id, created_date: nowIso(), updated_date: nowIso() };
    await store.put(collection, id, doc);
    return ok(doc, 'Saved successfully');
  }
  if (sub && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
    const existing = await store.get(collection, sub);
    if (!existing && !isObjectId(sub)) return ok({ ok: true });
    const baseBody = collection === 'users' ? sanitizeUser(body) : body;
    const updated = { ...(existing || { created_date: nowIso() }), ...baseBody, _id: sub, id: sub, updated_date: nowIso() };
    const finalDoc = collection === 'users' ? sanitizeUser(updated) : updated;
    await store.put(collection, sub, finalDoc);
    return ok(finalDoc, 'Updated successfully');
  }
  if (method === 'DELETE') {
    const rawIds = [];
    if (sub && sub !== 'delete') rawIds.push(sub);
    if (Array.isArray(body?.data)) rawIds.push(...body.data);
    else if (typeof body?.data === 'string' && body.data) rawIds.push(body.data);
    if (Array.isArray(body?.ids)) rawIds.push(...body.ids);
    if (body?.id) rawIds.push(body.id);
    if (query?.id) rawIds.push(query.id);
    const uniqueIds = [...new Set(rawIds.map((x) => String(x?._id || x?.id || x || '').trim()).filter(Boolean))];
    for (const delId of uniqueIds) await store.del(collection, delId);
    return ok({ deleted: true, count: uniqueIds.length, ids: uniqueIds, ok: 1 }, 'Deleted successfully');
  }

  return ok({});
}

const SALES_REPORT_SUBROUTES = new Set([
  'salesReports', 'instantSalesReports', 'instantSaleDetails', 'dailySalesReports', 'salesSummaryReports',
  'customerSalesReportTable', 'customerSaleDetails', 'itemSalesReportTable', 'itemSaleDetails',
  'itemExpiryReportTable', 'categorySalesReportTable', 'categorySaleDetails', 'paymentSaleTypeReport',
  'paymentSalesTranscationReportTable', 'paymentReturnSalesTranscationReportTable', 'taxSalesReports',
  'taxSummaryReportTable', 'taxPayable', 'taxPayableRegister', 'gstOneReportTable', 'gstThreeReportTable',
  'userReportTable', 'userSalesDetails', 'returnSalesReportTable', 'pendingSalesReportTable',
  'supplierSalesReportTable', 'salesGraphicalReports', 'itemGraphicalReports', 'userGraphicalReports',
  'paymentGraphicalReports',
]);

async function buildSalesReportResponse(sub, sales, query, store, branch, branchTz) {
  const completedSales = sales.filter(
    (s) => s.sale_process !== 'Hold' && !/cancel/i.test(String(s.sale_process || '')) && inReportDateRange(s.created_date || s.date, query, branchTz)
  );

  if (sub === 'salesReports' || sub === 'instantSalesReports') {
    const tender = String(query.tender || '').trim().toLowerCase();
    const filtered = tender ? completedSales.filter((s) => String(s.payment_mode || '').toLowerCase() === tender) : completedSales;
    const formatted = filtered.map((s) => {
      const lineItems = normalizeItemsPayload(s.items).map((li) => ({
        ...li,
        item_sku: li.item_sku || li.itemid || li.barcode_id || '',
        item_price: num(li.item_price ?? li.selling_price),
        item_quantity: num(li.item_quantity ?? li.quantity, 1),
        item_discount: num(li.item_discount),
        item_discount_percentage: num(li.item_discount_percentage),
        tax: num(li.tax),
        tax_type: String(li.tax_type || 'exclusive').toLowerCase(),
        total_amount: hasNumericValue(li.item_price_total)
          ? num(li.item_price_total)
          : hasNumericValue(li.total_amount)
            ? num(li.total_amount)
            : num(li.item_price ?? li.selling_price) * num(li.item_quantity, 1),
      }));
      return {
        ...s,
        string_date: s.string_date || s.date || s.created_date,
        items: lineItems,
        number_of_items: lineItems.length,
        items_total: num(s.sales_total ?? s.total_amount),
        extra_discount: num(s.extra_discount),
      };
    });
    return ok(paginateReport(formatted, query));
  }

  if (sub === 'instantSaleDetails') {
    const found = completedSales.find((s) => s._id === query.id || s.sales_id === query.id);
    return found ? ok(found) : fail('Sale not found', 404);
  }

  if (sub === 'salesSummaryReports') {
    let discounts = 0, cogs = 0, refunds = 0, net_sales = 0, net_sales_tax = 0;
    for (const s of completedSales) {
      const amt = num(s.sales_total ?? s.total_amount);
      discounts += num(s.discount) + num(s.extra_discount);
      cogs += num(s.sales_total_company_price);
      if (/return/i.test(String(s.sale_process || ''))) refunds += amt;
      else {
        net_sales += amt;
        net_sales_tax += num(s.tax);
      }
    }
    return ok({
      discounts, gross_profit: net_sales - cogs, refunds, cogs,
      sales_exclude_tax: Math.max(0, net_sales - net_sales_tax),
      sales_include_tax: net_sales, net_sales, net_sales_tax, order_type_summary: [],
    });
  }

  if (sub === 'dailySalesReports') {
    const allItems = await store.list('items');
    const stockById = new Map(allItems.map((it) => [String(it._id), it]));
    const prodMap = new Map(), payMap = new Map();
    let totalExtraDiscount = 0;
    for (const s of completedSales) {
      totalExtraDiscount += num(s.extra_discount);
      const pm = s.payment_mode || 'Cash';
      payMap.set(pm, (payMap.get(pm) || 0) + num(s.sales_total ?? s.total_amount));
      for (const li of normalizeItemsPayload(s.items)) {
        const key = String(li.item_id || li.item_name || 'item');
        const qty = num(li.item_quantity ?? li.quantity, 1);
        const subTot = num(li.item_price ?? li.selling_price) * qty;
        const tot = hasNumericValue(li.item_price_total)
          ? num(li.item_price_total)
          : hasNumericValue(li.total_amount)
            ? num(li.total_amount)
            : subTot;
        const unitDisc = num(li.item_discount);
        const discPct = num(li.item_discount_percentage);
        const breakdown = calcPriceBreakdown({
          base: subTot,
          discountAmount: unitDisc > 0 ? unitDisc * qty : 0,
          discountPercent: unitDisc > 0 ? 0 : discPct,
          taxRate: num(li.tax),
          taxType: li.tax_type,
        });
        const cost = num(li.company_price_total) || num(li.company_price) * qty;
        const itemDoc = stockById.get(String(li.item_id));
        const prev = prodMap.get(key) || {
          product_name: li.item_name || li.name || 'Item',
          product_sku: itemDoc?.itemid || li.itemid || li.barcode_id || '',
          product_qty: 0, product_subtotal: 0, product_discount: 0, product_tax: 0, product_total: 0, product_profit: 0,
          closing_stock: itemDoc?.track_inventory ? num(itemDoc.available_quantity) : null,
        };
        prev.product_qty += qty;
        prev.product_subtotal += subTot;
        prev.product_discount += breakdown.discount;
        prev.product_tax += breakdown.tax;
        prev.product_total += tot;
        prev.product_profit += tot - cost;
        prodMap.set(key, prev);
      }
    }
    return ok({
      branch_details: {
        date: nowIso(), from_date: query.starting_date || nowIso().slice(0, 10), to_date: query.ending_date || nowIso().slice(0, 10),
        branch_name: branch.branch_name, branch_address: branch.store_address || '', branch_phone: branch.branch_phone || '',
        branch_email: branch.branch_email || '', period_label: 'Full day', serving_periods: [],
      },
      product_details: Array.from(prodMap.values()),
      payment_details: Array.from(payMap.entries()).map(([payment_mode, sale_payment]) => ({ payment_mode, sale_payment })),
      extra_discount: { total_sale_extra_discount: totalExtraDiscount, by_type: [] },
      spoilage_details: [],
    });
  }

  if (sub === 'itemSalesReportTable' || sub === 'categorySalesReportTable') {
    const byCat = sub === 'categorySalesReportTable';
    const map = new Map();
    for (const s of completedSales) {
      for (const li of normalizeItemsPayload(s.items)) {
        const key = byCat ? (li.category_name || 'General') : String(li.item_id || li.item_name || 'item');
        const qty = num(li.item_quantity ?? li.quantity, 1);
        const tot = hasNumericValue(li.item_price_total)
          ? num(li.item_price_total)
          : hasNumericValue(li.total_amount)
            ? num(li.total_amount)
            : num(li.item_price ?? li.selling_price) * qty;
        const cost = num(li.company_price_total) || num(li.company_price) * qty;
        const prev = map.get(key) || { name: byCat ? key : (li.item_name || li.name || 'Item'), item_quantity: 0, sales_count: 0, sales_profit: 0, total_amount: 0 };
        prev.item_quantity += qty;
        prev.sales_count += 1;
        prev.total_amount += tot;
        prev.sales_profit += tot - cost;
        map.set(key, prev);
      }
    }
    return ok(paginateReport(Array.from(map.values()).map((r) => ({ ...r, sales_avg: r.sales_count > 0 ? r.total_amount / r.sales_count : 0 })), query));
  }

  if (sub === 'customerSalesReportTable') {
    const map = new Map();
    for (const s of completedSales) {
      const cid = String(s.customer_id || s.customer_name || 'walkin');
      const amt = num(s.sales_total ?? s.total_amount);
      const prev = map.get(cid) || { customer_id: cid, customer_name: s.customer_name || 'Walk-in Customer', customer_phone: s.customer_phone || '0000000000', sales_count: 0, refund_payment: 0, sales_payment: 0 };
      prev.sales_count += 1;
      if (/return/i.test(String(s.sale_process || ''))) prev.refund_payment += amt;
      else prev.sales_payment += amt;
      map.set(cid, prev);
    }
    return ok(paginateReport(Array.from(map.values()), query));
  }

  if (sub === 'paymentSaleTypeReport') {
    const map = new Map();
    for (const s of completedSales) {
      const pm = s.payment_mode || 'Cash';
      const amt = num(s.sales_total ?? s.total_amount);
      const prev = map.get(pm) || { sales_payment_mode: pm, sales_payment: 0, partial_amount: 0, outstanding_amount: 0, refund_payment: 0, sales_count: 0 };
      prev.sales_count += 1;
      if (/return/i.test(String(s.sale_process || ''))) prev.refund_payment += amt;
      else prev.sales_payment += amt;
      map.set(pm, prev);
    }
    return ok({ payment: Array.from(map.values()), currencyDigits: 2 });
  }

  if (sub === 'paymentSalesTranscationReportTable' || sub === 'paymentReturnSalesTranscationReportTable') {
    const wantRet = sub.startsWith('paymentReturn');
    const modeFilter = String(query.payment_mode || 'All').toLowerCase();
    const filtered = completedSales.filter((s) => {
      const isRet = /return/i.test(String(s.sale_process || ''));
      if (wantRet !== isRet) return false;
      return !modeFilter || modeFilter === 'all' || String(s.payment_mode || '').toLowerCase() === modeFilter;
    });
    const rows = filtered.map((s) => {
      const ts = new Date(s.updated_date || s.created_date || Date.now()).getTime();
      return {
        _id: s._id, sales_id: s.sales_id,
        updated_date: { $date: { $numberLong: String(Number.isFinite(ts) ? ts : Date.now()) } },
        user_name: s.sold_by || s.user_name || 'admin',
        customer_name: s.customer_name || 'Walk-in Customer',
        payment_mode: s.payment_mode || 'Cash',
        items_total: num(s.sales_total ?? s.total_amount),
        report_amount: num(s.sales_total ?? s.total_amount),
        currencyDigits: 2,
      };
    });
    return ok(paginateReport(rows, query));
  }

  if (sub === 'taxSalesReports') {
    const tax_details = completedSales.map((s) => ({
      _id: {
        items: normalizeItemsPayload(s.items).map((li) => ({
          ...li, item_price: num(li.item_price ?? li.selling_price), item_quantity: num(li.item_quantity ?? li.quantity, 1),
          tax: num(li.tax), tax_type: String(li.tax_type || 'exclusive').toLowerCase(), tax_name: li.tax_name || `Tax ${num(li.tax)}%`, tax_fields: null,
        })),
      },
    }));
    return ok({ tax_details });
  }

  if (sub === 'userReportTable') {
    const map = new Map();
    let totalSalesCount = 0, totalAmount = 0;
    for (const s of completedSales) {
      const uname = s.sold_by || s.user_name || 'admin';
      const amt = num(s.sales_total ?? s.total_amount);
      const cost = num(s.sales_total_company_price);
      totalSalesCount += 1;
      totalAmount += amt;
      const prev = map.get(uname) || { user_name: uname, sales_count: 0, refund_payment: 0, sales_profit: 0, sales_payment: 0 };
      prev.sales_count += 1;
      if (/return/i.test(String(s.sale_process || ''))) prev.refund_payment += amt;
      else {
        prev.sales_payment += amt;
        prev.sales_profit += amt - cost;
      }
      map.set(uname, prev);
    }
    const rows = Array.from(map.values()).map((r) => ({ ...r, sales_avg: r.sales_count > 0 ? r.sales_payment / r.sales_count : 0 }));
    return ok({ ...paginateReport(rows, query), summary: { sales: totalSalesCount, amount: totalAmount } });
  }

  if (sub === 'userSalesDetails') {
    const userId = String(query.user_id || '').trim();
    const matched = userId ? completedSales.filter((s) => String(s.user_id) === userId) : completedSales;
    const totalSum = matched.reduce((acc, s) => acc + num(s.sales_total ?? s.total_amount), 0);
    return ok({ table: { data: paginateReport(matched.map((s) => ({ ...s, items_total: num(s.sales_total ?? s.total_amount) })), query) }, total: matched.length ? [totalSum] : [] });
  }

  if (sub === 'returnSalesReportTable') return ok(paginateReport(completedSales.filter((s) => /return/i.test(String(s.sale_process || ''))), query));
  if (sub === 'pendingSalesReportTable') return ok(paginateReport(completedSales.filter((s) => /unpaid|partial/i.test(String(s.payment_status || ''))), query));
  if (sub.endsWith('GraphicalReports')) return ok([]);
  return ok(paginateReport([], query));
}

function saleItemStockMap(saleDoc) {
  const map = new Map();
  if (!saleDoc || saleDoc.sale_process === 'Hold' || /cancel/i.test(String(saleDoc.sale_process || ''))) {
    return map;
  }
  const sign = /return/i.test(String(saleDoc.sale_process || '')) ? +1 : -1;
  for (const li of normalizeItemsPayload(saleDoc.items)) {
    const itemId = String(li.item_id?._id || li.item_id || li.product_id || li._id || '').trim();
    if (!itemId) continue;
    map.set(itemId, (map.get(itemId) || 0) + sign * num(li.item_quantity ?? li.quantity, 1));
  }
  return map;
}

async function applyStockDelta(oldMap, newMap, store) {
  const itemIds = new Set([...oldMap.keys(), ...newMap.keys()]);
  const now = nowIso();
  for (const itemId of itemIds) {
    const delta = (newMap.get(itemId) || 0) - (oldMap.get(itemId) || 0);
    if (delta === 0) continue;
    const item = await store.get('items', itemId);
    if (item && item.track_inventory) {
      const nextQty = Math.max(0, num(item.available_quantity) + delta);
      await store.put('items', item._id, { ...item, available_quantity: nextQty, updated_date: now });
    }
  }
}

async function saveSale(body, store, branch, currentUser, { hold = false, existing = null } = {}) {
  const existingId = String(body.sales_id || '').trim();
  const id = existing?._id || (isObjectId(existingId) ? existingId : newObjectId());
  let billNo = body.alternative_id || existing?.sales_id;
  if (!billNo) {
    const counters = (await store.get('meta', 'counters')) || { _id: 'counters', sale_seq: 1000 };
    counters.sale_seq = num(counters.sale_seq, 1000) + 1;
    await store.put('meta', 'counters', counters);
    billNo = `${branch.sales_prefix || 'S'}-${counters.sale_seq}`;
  }

  const lineItems = normalizeItemsPayload(body.items).map((li) => {
    const qty = num(li.item_quantity ?? li.quantity, 1);
    const unitPrice = num(li.sale_inline_item_price ?? li.item_price ?? li.selling_price);
    const total = hasNumericValue(li.item_price_total) ? num(li.item_price_total) : unitPrice * qty;
    return {
      ...li,
      item_id: String(li.item_id?._id || li.item_id || li.product_id || li._id || ''),
      item_name: li.item_name || li.name || 'Item',
      item_quantity: qty,
      selling_price: unitPrice,
      item_price: unitPrice,
      item_price_total: total,
      company_price_total: hasNumericValue(li.company_price_total)
        ? num(li.company_price_total)
        : num(li.company_price) * qty,
      item_discount: num(li.sale_inline_discount_value ?? li.item_discount ?? li.discount_amount),
      item_discount_percentage: num(li.sale_inline_discount_pervalue ?? li.item_discount_percentage ?? li.discount_percentage),
      tax: num(li.tax),
      tax_type: String(li.tax_type || 'exclusive').toLowerCase(),
    };
  });

  const lineSum = lineItems.reduce((sum, li) => sum + num(li.item_price_total), 0);
  const computedTotal = hasNumericValue(body.sales_total) ? num(body.sales_total) : lineSum;
  const computedSubTotal = hasNumericValue(body.sales_sub_total) ? num(body.sales_sub_total) : lineSum;
  const computedCost = hasNumericValue(body.sales_total_company_price)
    ? num(body.sales_total_company_price)
    : lineItems.reduce((sum, li) => sum + num(li.company_price_total), 0);

  const now = nowIso();
  const createdDate = existing?.created_date || now;
  const saleDate = body.date || existing?.date || createdDate;
  const stringDate = body.date || existing?.string_date || saleDate;

  const doc = {
    ...(existing || {}),
    _id: id, id, sales_document_id: id, sales_id: billNo,
    branch_id: branch._id, register_id: body.register_id || existing?.register_id || DEFAULT_REGISTER_ID,
    user_id: existing?.user_id || currentUser?._id || DEFAULT_ADMIN_ID,
    user_name: existing?.user_name || currentUser?.user_name || 'admin',
    sold_by: existing?.sold_by || (currentUser ? `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() : 'Macisla Admin'),
    customer_id: body.customer_id || existing?.customer_id || DEFAULT_CUSTOMER_ID,
    customer_name: body.customer_name || existing?.customer_name || 'Walk-in Customer',
    customer_phone: body.customer_phone ?? existing?.customer_phone ?? '0000000000',
    customer_email: body.customer_email ?? existing?.customer_email ?? '',
    customer_address: body.customer_address ?? existing?.customer_address ?? '',
    payment_mode: hold ? '' : body.payment_mode || existing?.payment_mode || 'Cash',
    payment_status: hold ? 'Unpaid' : body.payment_status || existing?.payment_status || 'Paid',
    sale_process: hold ? 'Hold' : body.sale_process || (existing && existing.sale_process !== 'Hold' ? existing.sale_process : 'Add'),
    items: lineItems,
    number_of_items: lineItems.length,
    sales_sub_total: computedSubTotal,
    sales_total: computedTotal,
    total_amount: computedTotal,
    sales_total_company_price: computedCost,
    tax: hasNumericValue(body.tax) ? num(body.tax) : num(existing?.tax),
    discount: hasNumericValue(body.discount) ? num(body.discount) : num(existing?.discount),
    extra_discount: hasNumericValue(body.extra_discount) ? num(body.extra_discount) : num(existing?.extra_discount),
    extra_discount_type: body.extra_discount_type || existing?.extra_discount_type || 'price',
    sales_description: body.sales_description ?? existing?.sales_description ?? '',
    payment_description: body.payment_description ?? existing?.payment_description ?? '',
    discount_description: body.discount_description ?? existing?.discount_description ?? '',
    date: saleDate,
    string_date: stringDate,
    parked_at: hold ? existing?.parked_at || now : undefined,
    created_date: createdDate,
    updated_date: now,
  };

  await store.put('sales', id, doc);
  await applyStockDelta(saleItemStockMap(existing), saleItemStockMap(doc), store);
  return doc;
}
