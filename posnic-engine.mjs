// Macisla_POS — Original Posnic API Engine for Cloudflare D1 + R2 & Local SQLite
// Serves the 100% unmodified Posnic frontend while routing all persistence to D1/SQLite & R2.

export const DEFAULT_BRANCH_ID = '665000000000000000000010';
export const DEFAULT_REGISTER_ID = '665000000000000000000021';
export const DEFAULT_CASH_REGISTER_ID = '665000000000000000000020';
export const DEFAULT_ADMIN_ID = '665000000000000000000001';
export const DEFAULT_CUSTOMER_ID = '665000000000000000000301';
export const DEFAULT_SUPPLIER_ID = '665000000000000000000401';
export const DEFAULT_TAX_ID = '665000000000000000000501';

export function newObjectId(date = new Date()) {
  const ts = Math.floor(date.getTime() / 1000).toString(16).padStart(8, '0');
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += Math.floor(Math.random() * 16).toString(16);
  }
  return ts + rand;
}

function nowIso() {
  return new Date().toISOString();
}

function num(v, fallback = 0) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const cleaned = String(v ?? '').replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1' || v === 1 || v === 'enable' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 0 || v === 'disable' || v === 'no') return false;
  return fallback;
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

export async function ensureSeeded(store) {
  const existingBranches = await store.list('branches');
  if (existingBranches.length > 0) return;

  const now = nowIso();
  const catIds = {
    haircuts: '665000000000000000000201',
    haircare: '665000000000000000000202',
    beverages: '665000000000000000000203',
    general: '665000000000000000000204',
  };

  // Branch & Store Settings
  await store.put('branches', DEFAULT_BRANCH_ID, {
    _id: DEFAULT_BRANCH_ID,
    id: DEFAULT_BRANCH_ID,
    branch_name: 'Macisla Main Store',
    name: 'Macisla Main Store',
    branch_image: 'store.png',
    logo: 'store.png',
    store_address: 'Jl. Senopati No. 88, Kebayoran Baru',
    address: 'Jl. Senopati No. 88, Kebayoran Baru',
    printing_address: 'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan',
    store_email: 'pos@macisla.com',
    branch_email: 'pos@macisla.com',
    store_telephone: '+62 812-8888-9900',
    branch_phone: '+62 812-8888-9900',
    store_alternativephone: '',
    place: 'Kebayoran Baru',
    city: 'Jakarta Selatan',
    state: 'DKI Jakarta',
    country: 'Indonesia',
    country_id: 102,
    pincode: '12190',
    website: 'https://pos.macisla.com',
    languge: 'English',
    currency: 'IDR',
    currency_text: 'IDR',
    currency_type: 'Rp',
    currency_value: [{ currency_sign: 'Rp', currency_text: 'IDR' }],
    time_zone: 'Asia/Jakarta',
    time_format: 'enable',
    client_dateformat: 'YYYY-MM-DD',
    server_dateformat: 'YYYY-MM-DD',
    dateformat_text: 'YYYY-MM-DD',
    sales_prefix: 'S',
    receiving_prefix: 'P',
    invoice_prefix: 'INV-',
    invoice_due_days: 30,
    invoice_terms: 'Thank you for your business.',
    print_type: 'thermal',
    print_size: '80mm',
    print_character: '42',
    bill_print_copies: 1,
    print_url: false,
    print_logoimg: true,
    print_sale_notes: true,
    customer_print: true,
    printall: false,
    roundOff: false,
    keyboard_view: false,
    stock_management: true,
    stock_management_log: true,
    table_options: false,
    cash_register_enable: true,
    enable_multi_payment: true,
    sale_quick_edit_enable: true,
    allow_sale_date_edit: true,
    allow_payment_correction: true,
    allow_sale_hard_delete: true,
    module_tax_enable: true,
    module_credit_enable: true,
    module_marketing_enable: true,
    module_messaging_enable: false,
    module_channels_enable: false,
    module_online_ordering_enable: false,
    module_kiosk_enable: false,
    module_captain_enable: false,
    module_mobile_pos_enable: false,
    module_billing_outlets_enable: false,
    module_delivery_partners_enable: false,
    module_webshop_enable: false,
    module_recyclebin_enable: true,
    module_demo_data_enable: false,
    module_themes_enable: true,
    module_cashbook_enable: true,
    quick_sale_enable: true,
    quotes_enable: true,
    invoices_enable: true,
    staff_shifts_enable: true,
    staff_roster_enable: true,
    staff_tips_enable: false,
    ai_enabled: false,
    ask_posnic_enabled: false,
    customer_checkbox: true,
    supplier_checkbox: true,
    tax_checkbox: true,
    default_customer: DEFAULT_CUSTOMER_ID,
    default_supplier: DEFAULT_SUPPLIER_ID,
    default_tax: DEFAULT_TAX_ID,
    tax_percentage: 0,
    discount_amount: '0',
    discount_percentage: '0',
    indian_gst: 'gst_off',
    branch_gstin_number: '',
    notification_range: 5,
    sms_auto_send_time: '09:00 PM',
    sms_retry_period: '15',
    sms_max_retries: '3',
    payment_gateway: { status: 'false', key: '', secret: '' },
    phonepe_payment_gateway: { merchantId: '', saltKey: '' },
    email_fields: [],
    register: [{ _id: DEFAULT_REGISTER_ID, register_name: 'Main Counter Register' }],
    header_print: 'Macisla Main Store',
    footer_print: 'Thank you for visiting Macisla! pos.macisla.com',
    print_a4html: PRINT_A4_TEMPLATE,
    print_standard_html: PRINT_THERMAL_TEMPLATE,
    regular_body_print: null,
    thermal_body_print: null,
    online_ordering: { store_id: 'macisla', enabled: false },
    first_run_done: true,
    first_run_decided: true,
    created_date: now,
    updated_date: now,
  });

  // Users (match Posnic's 3 demo mode buttons: admin, manager, cashier)
  const seedUsers = [
    {
      _id: DEFAULT_ADMIN_ID,
      id: DEFAULT_ADMIN_ID,
      name: 'admin',
      user_name: 'admin',
      username: 'admin',
      firstname: 'Macisla',
      lastname: 'Admin',
      email: 'admin@macisla.com',
      phone: '+62 812-8888-9900',
      password: 'admin',
      usertype: 'super_admin',
      role: 'super_admin',
      image: 'user.svg',
      status: 'Active',
      branch_id: [DEFAULT_BRANCH_ID],
      access: fullAcl('super_admin'),
      created_date: now,
      updated_date: now,
    },
    {
      _id: '665000000000000000000002',
      id: '665000000000000000000002',
      name: 'manager',
      user_name: 'manager',
      username: 'manager',
      firstname: 'Shop',
      lastname: 'Manager',
      email: 'manager@macisla.com',
      phone: '+62 812-8888-9901',
      password: 'manager',
      usertype: 'manager',
      role: 'manager',
      image: 'user.svg',
      status: 'Active',
      branch_id: [DEFAULT_BRANCH_ID],
      access: fullAcl('manager'),
      created_date: now,
      updated_date: now,
    },
    {
      _id: '665000000000000000000003',
      id: '665000000000000000000003',
      name: 'cashier',
      user_name: 'cashier',
      username: 'cashier',
      firstname: 'Front',
      lastname: 'Cashier',
      email: 'cashier@macisla.com',
      phone: '+62 812-8888-9902',
      password: 'cashier',
      usertype: 'cashier',
      role: 'cashier',
      image: 'user.svg',
      status: 'Active',
      branch_id: [DEFAULT_BRANCH_ID],
      access: fullAcl('cashier'),
      created_date: now,
      updated_date: now,
    },
  ];
  for (const u of seedUsers) await store.put('users', u._id, u);

  // Cash Register
  await store.put('registers', DEFAULT_REGISTER_ID, {
    _id: DEFAULT_REGISTER_ID,
    id: DEFAULT_REGISTER_ID,
    register_id: DEFAULT_REGISTER_ID,
    cash_register_id: DEFAULT_CASH_REGISTER_ID,
    register_name: 'Main Counter Register',
    branch_id: DEFAULT_BRANCH_ID,
    branch_name: 'Macisla Main Store',
    register_status: 'Opened',
    opening_balance: 500000,
    opened_at: now,
    opened_by: 'admin',
    in_use: true,
    in_use_by: 'admin',
    created_date: now,
    updated_date: now,
  });

  // Taxes
  const seedTaxes = [
    { _id: DEFAULT_TAX_ID, id: DEFAULT_TAX_ID, tax_name: 'No Tax (0%)', tax_value: 0, tax_type: 'Exclusive', is_default: true },
    { _id: '665000000000000000000502', id: '665000000000000000000502', tax_name: 'PPN 11%', tax_value: 11, tax_type: 'Exclusive', is_default: false },
    { _id: '665000000000000000000503', id: '665000000000000000000503', tax_name: 'Service 5%', tax_value: 5, tax_type: 'Inclusive', is_default: false },
  ];
  for (const t of seedTaxes) await store.put('taxes', t._id, { ...t, created_date: now, updated_date: now });

  // Payment methods
  const seedPayments = [
    { _id: '665000000000000000000601', id: '665000000000000000000601', payment_value: 'Cash', payment_name: 'Cash', active: true },
    { _id: '665000000000000000000602', id: '665000000000000000000602', payment_value: 'QRIS', payment_name: 'QRIS', active: true },
    { _id: '665000000000000000000603', id: '665000000000000000000603', payment_value: 'Card', payment_name: 'Card', active: true },
    { _id: '665000000000000000000604', id: '665000000000000000000604', payment_value: 'Transfer', payment_name: 'Bank Transfer', active: true },
  ];
  for (const p of seedPayments) await store.put('payments', p._id, { ...p, created_date: now, updated_date: now });

  // Units
  const seedUnits = ['qty', 'pcs', 'session', 'bottle', 'box', 'kg'].map((u, idx) => ({
    _id: `66500000000000000000070${idx + 1}`,
    id: `66500000000000000000070${idx + 1}`,
    unit_name: u,
    unit_short: u,
    created_date: now,
    updated_date: now,
  }));
  for (const u of seedUnits) await store.put('units', u._id, u);

  // Denominations (IDR banknotes)
  const seedDenoms = [100000, 50000, 20000, 10000, 5000, 2000, 1000].map((val, idx) => ({
    _id: `66500000000000000000080${idx + 1}`,
    id: `66500000000000000000080${idx + 1}`,
    denom_value: String(val),
    denomination: val,
    value: val,
    created_date: now,
    updated_date: now,
  }));
  for (const d of seedDenoms) await store.put('denominations', d._id, d);

  // Categories
  const seedCategories = [
    { _id: catIds.haircuts, id: catIds.haircuts, name: 'Haircuts & Grooming', category_name: 'Haircuts & Grooming', description: 'Haircuts, fades, styling, beard trims & hot towel treatments', image: 'category.svg', tile_color: '#2563EB', tile_shape: 'rounded' },
    { _id: catIds.haircare, id: catIds.haircare, name: 'Hair Care Products', category_name: 'Hair Care Products', description: 'Pomades, matte clay, sea salt spray, beard oil & shampoo', image: 'category.svg', tile_color: '#0D9488', tile_shape: 'rounded' },
    { _id: catIds.beverages, id: catIds.beverages, name: 'Beverages', category_name: 'Beverages', description: 'Specialty coffee, cold brew & refreshments', image: 'category.svg', tile_color: '#D97706', tile_shape: 'rounded' },
    { _id: catIds.general, id: catIds.general, name: 'General', category_name: 'General', description: 'General retail items', image: 'category.svg', tile_color: '#64748B', tile_shape: 'rounded' },
  ];
  for (const c of seedCategories) await store.put('categories', c._id, { ...c, created_date: now, updated_date: now });

  // Suppliers
  await store.put('suppliers', DEFAULT_SUPPLIER_ID, {
    _id: DEFAULT_SUPPLIER_ID,
    id: DEFAULT_SUPPLIER_ID,
    name: 'Macisla Supply Co.',
    supplier_name: 'Macisla Supply Co.',
    company_name: 'Macisla Supply Co.',
    phone: '+62 21-555-0199',
    email: 'supply@macisla.com',
    address: 'Jl. Kemang Raya No. 12, Jakarta',
    city: 'Jakarta',
    state: 'DKI Jakarta',
    country: 'Indonesia',
    created_date: now,
    updated_date: now,
  });

  // Customers
  const seedCustomers = [
    {
      _id: DEFAULT_CUSTOMER_ID,
      id: DEFAULT_CUSTOMER_ID,
      name: 'Walk-in Customer',
      customer_name: 'Walk-in Customer',
      phone: '0000000000',
      email: 'walkin@macisla.com',
      address: 'Jakarta',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
      customer_balance: 0,
      wallet_amount: 0,
      partial_balance: 0,
      is_default: true,
    },
    {
      _id: '665000000000000000000302',
      id: '665000000000000000000302',
      name: 'Andi Pratama',
      customer_name: 'Andi Pratama',
      phone: '+62 812-1111-2233',
      email: 'andi@example.com',
      address: 'Jl. Dharmawangsa No. 4, Jakarta',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
      customer_balance: 0,
      wallet_amount: 0,
      partial_balance: 0,
    },
    {
      _id: '665000000000000000000303',
      id: '665000000000000000000303',
      name: 'Budi Santoso',
      customer_name: 'Budi Santoso',
      phone: '+62 813-4444-5566',
      email: 'budi@example.com',
      address: 'Jl. Gunawarman No. 19, Jakarta',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
      customer_balance: 0,
      wallet_amount: 0,
      partial_balance: 0,
    },
    {
      _id: '665000000000000000000304',
      id: '665000000000000000000304',
      name: 'Rina Kusuma',
      customer_name: 'Rina Kusuma',
      phone: '+62 811-7777-8899',
      email: 'rina@example.com',
      address: 'SCBD Lot 8, Jakarta',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
      customer_balance: 0,
      wallet_amount: 0,
      partial_balance: 0,
    },
  ];
  for (const c of seedCustomers) await store.put('customers', c._id, { ...c, created_date: now, updated_date: now });

  // Items
  const seedItems = [
    { id: '665000000000000000000101', sku: 'MCS-001', barcode: '8990001000017', name: 'Signature Gentleman Cut', catId: catIds.haircuts, catName: 'Haircuts & Grooming', sell: 120000, cost: 35000, qty: 99, track: false, kind: 'service', unit: 'session', color: '#2563EB' },
    { id: '665000000000000000000102', sku: 'MCS-002', barcode: '8990001000024', name: 'Skin Fade & Hot Towel', catId: catIds.haircuts, catName: 'Haircuts & Grooming', sell: 150000, cost: 45000, qty: 99, track: false, kind: 'service', unit: 'session', color: '#1D4ED8' },
    { id: '665000000000000000000103', sku: 'MCS-003', barcode: '8990001000031', name: 'Beard Trim & Lineup', catId: catIds.haircuts, catName: 'Haircuts & Grooming', sell: 75000, cost: 20000, qty: 99, track: false, kind: 'service', unit: 'session', color: '#3B82F6' },
    { id: '665000000000000000000104', sku: 'MCS-004', barcode: '8990001000048', name: 'AI Face Shape Styling Consult', catId: catIds.haircuts, catName: 'Haircuts & Grooming', sell: 50000, cost: 10000, qty: 99, track: false, kind: 'service', unit: 'session', color: '#6366F1' },
    { id: '665000000000000000000105', sku: 'MCS-005', barcode: '8990001000055', name: 'Macisla Matte Clay 100g', catId: catIds.haircare, catName: 'Hair Care Products', sell: 165000, cost: 72000, qty: 28, track: true, kind: 'product', unit: 'pcs', color: '#0D9488' },
    { id: '665000000000000000000106', sku: 'MCS-006', barcode: '8990001000062', name: 'Water-Based Shine Pomade', catId: catIds.haircare, catName: 'Hair Care Products', sell: 145000, cost: 65000, qty: 22, track: true, kind: 'product', unit: 'pcs', color: '#0F766E' },
    { id: '665000000000000000000107', sku: 'MCS-007', barcode: '8990001000079', name: 'Sea Salt Texture Spray 150ml', catId: catIds.haircare, catName: 'Hair Care Products', sell: 135000, cost: 58000, qty: 18, track: true, kind: 'product', unit: 'bottle', color: '#14B8A6' },
    { id: '665000000000000000000108', sku: 'MCS-008', barcode: '8990001000086', name: 'Cedarwood Beard Oil 30ml', catId: catIds.haircare, catName: 'Hair Care Products', sell: 155000, cost: 68000, qty: 4, track: true, kind: 'product', unit: 'bottle', color: '#059669' },
    { id: '665000000000000000000109', sku: 'MCS-009', barcode: '8990001000093', name: 'Iced Americano', catId: catIds.beverages, catName: 'Beverages', sell: 35000, cost: 11000, qty: 50, track: true, kind: 'product', unit: 'qty', color: '#D97706' },
    { id: '665000000000000000000110', sku: 'MCS-010', barcode: '8990001000109', name: 'Oat Milk Latte', catId: catIds.beverages, catName: 'Beverages', sell: 45000, cost: 16000, qty: 40, track: true, kind: 'product', unit: 'qty', color: '#B45309' },
  ];
  for (const it of seedItems) {
    await store.put('items', it.id, {
      _id: it.id,
      id: it.id,
      name: it.name,
      item_name: it.name,
      itemid: it.sku,
      barcode_id: it.barcode,
      category_id: it.catId,
      category_name: it.catName,
      supplier_id: DEFAULT_SUPPLIER_ID,
      supplier_name: 'Macisla Supply Co.',
      selling_price: it.sell,
      mrp_price: it.sell,
      company_price: it.cost,
      available_quantity: it.qty,
      low_stock: 5,
      track_inventory: it.track,
      negative_stock: !it.track,
      available_for_sale: true,
      item_kind: it.kind,
      unit: it.unit,
      tax: 0,
      tax_type: 'Exclusive',
      tax_name: 'No Tax (0%)',
      discount_amount: 0,
      discount_percentage: 0,
      image: 'item.svg',
      tile_color: it.color,
      tile_shape: 'rounded',
      branch_id: DEFAULT_BRANCH_ID,
      status: 'Active',
      created_by: 'admin',
      created_date: now,
      updated_date: now,
    });
  }

  // Sample Sales (today) so Dashboard & Sales History look alive immediately
  const sale1Id = newObjectId(new Date(Date.now() - 55 * 60 * 1000));
  const sale2Id = newObjectId(new Date(Date.now() - 25 * 60 * 1000));
  await store.put('sales', sale1Id, {
    _id: sale1Id,
    id: sale1Id,
    sales_document_id: sale1Id,
    sales_id: 'S-1001',
    branch_id: DEFAULT_BRANCH_ID,
    register_id: DEFAULT_REGISTER_ID,
    user_id: DEFAULT_ADMIN_ID,
    user_name: 'admin',
    sold_by: 'Macisla Admin',
    customer_id: '665000000000000000000302',
    customer_name: 'Andi Pratama',
    customer_phone: '+62 812-1111-2233',
    customer_email: 'andi@example.com',
    customer_address: 'Jl. Dharmawangsa No. 4, Jakarta',
    payment_mode: 'QRIS',
    payment_status: 'Paid',
    sale_process: 'Add',
    items: [
      {
        item_id: '665000000000000000000102',
        item_name: 'Skin Fade & Hot Towel',
        barcode_id: '8990001000024',
        item_quantity: 1,
        selling_price: 150000,
        item_price: 150000,
        item_price_total: 150000,
        company_price_total: 45000,
        item_discount: 0,
        item_discount_percentage: 0,
        tax: 0,
        tax_type: 'Exclusive',
        category_id: catIds.haircuts,
        category_name: 'Haircuts & Grooming',
        item_unit: 'session',
      },
      {
        item_id: '665000000000000000000105',
        item_name: 'Macisla Matte Clay 100g',
        barcode_id: '8990001000055',
        item_quantity: 1,
        selling_price: 165000,
        item_price: 165000,
        item_price_total: 165000,
        company_price_total: 72000,
        item_discount: 0,
        item_discount_percentage: 0,
        tax: 0,
        tax_type: 'Exclusive',
        category_id: catIds.haircare,
        category_name: 'Hair Care Products',
        item_unit: 'pcs',
      },
    ],
    number_of_items: 2,
    sales_sub_total: 315000,
    sales_total: 315000,
    total_amount: 315000,
    sales_total_company_price: 117000,
    tax: 0,
    discount: 0,
    extra_discount: 0,
    extra_discount_type: 'price',
    date: now,
    string_date: now,
    created_date: now,
    updated_date: now,
  });

  await store.put('sales', sale2Id, {
    _id: sale2Id,
    id: sale2Id,
    sales_document_id: sale2Id,
    sales_id: 'S-1002',
    branch_id: DEFAULT_BRANCH_ID,
    register_id: DEFAULT_REGISTER_ID,
    user_id: DEFAULT_ADMIN_ID,
    user_name: 'admin',
    sold_by: 'Macisla Admin',
    customer_id: DEFAULT_CUSTOMER_ID,
    customer_name: 'Walk-in Customer',
    customer_phone: '0000000000',
    customer_email: 'walkin@macisla.com',
    customer_address: 'Jakarta',
    payment_mode: 'Cash',
    payment_status: 'Paid',
    sale_process: 'Add',
    items: [
      {
        item_id: '665000000000000000000101',
        item_name: 'Signature Gentleman Cut',
        barcode_id: '8990001000017',
        item_quantity: 1,
        selling_price: 120000,
        item_price: 120000,
        item_price_total: 120000,
        company_price_total: 35000,
        item_discount: 0,
        item_discount_percentage: 0,
        tax: 0,
        tax_type: 'Exclusive',
        category_id: catIds.haircuts,
        category_name: 'Haircuts & Grooming',
        item_unit: 'session',
      },
      {
        item_id: '665000000000000000000109',
        item_name: 'Iced Americano',
        barcode_id: '8990001000093',
        item_quantity: 1,
        selling_price: 35000,
        item_price: 35000,
        item_price_total: 35000,
        company_price_total: 11000,
        item_discount: 0,
        item_discount_percentage: 0,
        tax: 0,
        tax_type: 'Exclusive',
        category_id: catIds.beverages,
        category_name: 'Beverages',
        item_unit: 'qty',
      },
    ],
    number_of_items: 2,
    sales_sub_total: 155000,
    sales_total: 155000,
    total_amount: 155000,
    sales_total_company_price: 46000,
    tax: 0,
    discount: 0,
    extra_discount: 0,
    extra_discount_type: 'price',
    date: now,
    string_date: now,
    created_date: now,
    updated_date: now,
  });

  // Theme & meta settings
  await store.put('meta', 'theme', {
    _id: 'theme',
    theme: 'light',
    theme_name: 'default',
    primary_color: '#506fe4',
    updated_date: now,
  });
  await store.put('meta', 'counters', {
    _id: 'counters',
    sale_seq: 1002,
    receiving_seq: 1000,
    quote_seq: 1000,
    invoice_seq: 1000,
  });
  await store.put('meta', 'stock_preference', {
    _id: 'stock_preference',
    preference: 'track',
  });
}

function jsonResp(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With, X-Branch-Id, X-Device-Id',
      ...extraHeaders,
    },
  });
}

function ok(data = {}, message = 'Success', extra = {}) {
  return jsonResp({ type: 'success', status: true, message, data, ...extra }, 200);
}

function fail(message = 'Error', status = 400, data = null) {
  return jsonResp({ type: 'error', status: false, message, data }, status);
}

async function parseBody(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return { data: {}, files: [] };
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    const text = await request.text();
    if (!text.trim()) return { data: {}, files: [] };
    try {
      return { data: JSON.parse(text), files: [] };
    } catch {
      return { data: {}, files: [] };
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const data = {};
    for (const [k, v] of params.entries()) data[k] = v;
    return { data, files: [] };
  }
  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    const data = {};
    const files = [];
    for (const [k, v] of fd.entries()) {
      if (typeof v === 'object' && v && typeof v.arrayBuffer === 'function') {
        files.push({ field: k, file: v });
      } else {
        data[k] = v;
      }
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
  for (const [k, v] of url.searchParams.entries()) {
    out[k] = v;
  }
  return out;
}

function applyListFilters(rows, query, searchFields = ['name']) {
  let out = rows.slice();
  const rawFilters = query.filters;
  if (rawFilters) {
    try {
      const f = typeof rawFilters === 'string' ? JSON.parse(rawFilters) : rawFilters;
      if (f && typeof f === 'object') {
        for (const [field, cond] of Object.entries(f)) {
          if (cond == null || cond === '') continue;
          if (typeof cond === 'object' && cond.$regex) {
            const re = new RegExp(cond.$regex, cond.$options || 'i');
            out = out.filter((r) => re.test(String(r[field] ?? r.name ?? r.sales_id ?? '')));
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
    out = out.filter((r) =>
      searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))
    );
  }
  const sort = String(query.sort || '').toLowerCase();
  if (sort === 'name_asc') {
    out.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else if (sort === 'name_desc') {
    out.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  } else if (sort === 'price_asc') {
    out.sort((a, b) => num(a.selling_price || a.sales_total) - num(b.selling_price || b.sales_total));
  } else if (sort === 'price_desc') {
    out.sort((a, b) => num(b.selling_price || b.sales_total) - num(a.selling_price || a.sales_total));
  } else {
    out.sort((a, b) => String(b.created_date || b.updated_date || '').localeCompare(String(a.created_date || a.updated_date || '')));
  }
  const total = out.length;
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(query.limit || '25', 10) || 25));
  const start = (page - 1) * limit;
  const list = out.slice(start, start + limit);
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

function inFilterPeriod(isoDate, filter) {
  if (!filter || filter === 'all') return true;
  const dt = new Date(isoDate || Date.now());
  if (Number.isNaN(dt.getTime())) return true;
  const now = new Date();
  const start = new Date(now);
  if (filter === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (filter === 'week') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (filter === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (filter === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    return true;
  }
  return dt >= start;
}

function getSessionUserFromRequest(request, users) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1] || parts[0]));
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
  const payload = btoa(JSON.stringify({
    sid: user._id,
    username: user.user_name,
    usertype: user.usertype,
    iat: Math.floor(Date.now() / 1000),
  }));
  return `${header}.${payload}.macisla`;
}

export async function handlePosnicRequest(request, store, env = {}) {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With, X-Branch-Id, X-Device-Id',
      },
    });
  }

  await ensureSeeded(store);

  const url = new URL(request.url);
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  // Support both `/route` and `/api/route`
  if (pathname === '/api') pathname = '/';
  else if (pathname.startsWith('/api/')) pathname = pathname.slice(4);

  const query = parseQuery(url);
  const { data: body, files } = await parseBody(request);
  const segs = pathname.split('/').filter(Boolean);
  const root = segs[0] || '';
  const sub = segs[1] || '';
  const sub2 = segs[2] || '';

  // ── 1. Health, Runtime Info, Brand & SSE Events ──────────────────────────────
  if (pathname === '/health') {
    return ok({ ok: true, service: 'macisla-pos', engine: 'cloudflare-d1-r2', version: '1.9.2' });
  }
  if (pathname === '/runtime-info') {
    return jsonResp({
      demo: true,
      version: '1.9.2',
      edition: 'cloud',
      mode: 'cloud',
      cloud: false,
      features: { account: false, demo: true },
    });
  }
  if (pathname === '/brand.json') {
    return jsonResp({ enabled: false, name: 'Macisla POS' });
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
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'access-control-allow-origin': '*',
      },
    });
  }

  // ── 2. R2 Media Serving (`/r2/<key>`) ────────────────────────────────────────
  if (root === 'r2' && sub && method === 'GET') {
    const key = segs.slice(1).join('/');
    if (store.getObject) {
      const obj = await store.getObject(key);
      if (obj) {
        return new Response(obj.body, {
          status: 200,
          headers: {
            'content-type': obj.contentType || 'application/octet-stream',
            'cache-control': 'public, max-age=31536000',
          },
        });
      }
    }
    return fail('Object not found', 404);
  }

  const branches = await store.list('branches');
  const branch = branches.find((b) => b._id === DEFAULT_BRANCH_ID) || branches[0];
  const users = await store.list('users');
  const currentUser = getSessionUserFromRequest(request, users);

  // ── 3. Users & Auth (`/users/*`) ─────────────────────────────────────────────
  if (root === 'users') {
    if (sub === 'verify' && method === 'POST') {
      const username = String(body.username || body.name || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const matched = users.find(
        (u) =>
          (String(u.user_name || u.name || '').toLowerCase() === username ||
            String(u.email || '').toLowerCase() === username) &&
          (String(u.password || '') === password || !password)
      );
      if (!matched) {
        return fail('Invalid username or password. Try admin / admin.', 401);
      }
      const token = makeToken(matched);
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
          branch_timezone: branch.time_zone || 'Asia/Jakarta',
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
          plan: 'free',
          userACLPlan: true,
          outstanding_customers: [],
          jwt_token: token,
        },
        'Successfully login'
      );
    }

    if (sub === 'getUserAccessDetails') {
      return ok(currentUser?.access || fullAcl(currentUser?.usertype || 'super_admin'));
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

    if (sub === 'userVerify') {
      return ok({ verified: true }, 'Verified');
    }

    if (sub === 'logOut') {
      return ok({ logged_out: true }, 'Logged out');
    }

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
      const imgUrl = await saveUploadedFile(files[0], store, 'users');
      return ok(imgUrl || 'user.svg', 'Image uploaded');
    }

    if (sub === 'userProfile' && method === 'POST') {
      const updated = {
        ...currentUser,
        firstname: body.name || currentUser.firstname,
        lastname: body.lastname ?? currentUser.lastname,
        image: body.image || currentUser.image || 'user.svg',
        updated_date: nowIso(),
      };
      await store.put('users', updated._id, updated);
      return ok({
        firstname: updated.firstname,
        lastname: updated.lastname,
        imagename: updated.image,
      }, 'Profile updated');
    }

    if (sub === 'userstatusReportTable') {
      return ok({ list: users, total: users.length });
    }
  }

  // ── 4. Branches (`/branches/*`) ──────────────────────────────────────────────
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
      return ok(
        branches.map((b) => ({
          id: b._id,
          _id: b._id,
          branch_name: b.branch_name || b.name,
          branch_image: b.branch_image || b.logo || 'store.png',
        }))
      );
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

  // ── 5. Registers (`/registers/*`) ────────────────────────────────────────────
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
        opening_balance: num(body.opening_balance || body.amount, active.opening_balance || 0),
        opened_at: nowIso(),
        updated_date: nowIso(),
      };
      await store.put('registers', updated._id, updated);
      return ok(updated, 'Register opened');
    }
    if (sub === 'registerClose' && (method === 'POST' || method === 'PUT')) {
      const active = regs[0];
      if (active) {
        await store.put('registers', active._id, {
          ...active,
          register_status: 'Closed',
          closed_at: nowIso(),
          updated_date: nowIso(),
        });
      }
      return ok({ register_status: 'Closed' }, 'Register closed');
    }
    if (sub === 'registerReportTable') {
      return ok({ list: regs, total: regs.length });
    }
  }

  // ── 6. Dashboard (`/dashboard/*`) ────────────────────────────────────────────
  if (root === 'dashboard') {
    const filter = query.filter || 'day';
    const sales = (await store.list('sales')).filter(
      (s) => s.sale_process !== 'Hold' && !/cancel/i.test(String(s.sale_process || '')) && inFilterPeriod(s.created_date || s.date, filter)
    );
    const receivings = (await store.list('receivings')).filter((r) => inFilterPeriod(r.created_date || r.date, filter));
    const expenses = (await store.list('expenses')).filter((e) => inFilterPeriod(e.created_date || e.date, filter));

    let total_sales = 0;
    let total_tax = 0;
    let total_cash = 0;
    let total_upi = 0;
    let total_card = 0;
    let cogs = 0;
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
        prev.total_amount += num(li.item_price_total || li.selling_price) || num(li.item_price) * num(li.item_quantity, 1);
        itemMap.set(name, prev);
      }
    }

    const total_purchase = receivings.reduce((acc, r) => acc + num(r.receiving_total ?? r.total_amount), 0);
    const total_expenses = expenses.reduce((acc, e) => acc + num(e.amount ?? e.expense_amount), 0);
    const gross_profit = total_sales - cogs;
    const net_profit = gross_profit - total_expenses;
    const margin_percent = total_sales > 0 ? Number(((net_profit / total_sales) * 100).toFixed(1)) : 0;
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.total_amount - a.total_amount).slice(0, 8);

    if (sub === 'getOverview') {
      return ok({
        kpis: {
          total_sales,
          total_purchase,
          total_expenses,
          total_tax,
          total_upi,
          total_cash,
          total_card,
        },
        topItems,
        profit: {
          revenue: total_sales,
          cogs,
          gross_profit,
          expenses: total_expenses,
          net_profit,
          margin_percent,
          sales_count: sales.length,
          purchases: total_purchase,
          cash_flow: total_sales - total_purchase - total_expenses,
          cost_reliable: true,
        },
      });
    }
    if (sub === 'getProfitSummary') {
      return ok({
        revenue: total_sales,
        cogs,
        gross_profit,
        expenses: total_expenses,
        net_profit,
        margin_percent,
        sales_count: sales.length,
        purchases: total_purchase,
        cash_flow: total_sales - total_purchase - total_expenses,
        cost_reliable: true,
      });
    }
    if (sub === 'getDashboardBestSellingProducts') {
      return ok({ best_selling_products: topItems });
    }
    if (sub === 'getDashboardTopPerformers') {
      return ok({
        user_name: currentUser ? `${currentUser.firstname} ${currentUser.lastname}`.trim() : 'Macisla Admin',
        email: currentUser?.email || 'admin@macisla.com',
        user_type: currentUser?.usertype || 'super_admin',
        sales_count: sales.length,
        sales_amount: total_sales,
      });
    }
    if (sub === 'getDashboardExpiredProducts') {
      return ok({ expired_stock_items: [] });
    }
    if (sub === 'getPendingActivities') {
      return ok([]);
    }
    if (sub === 'setupChecklist') {
      const items = await store.list('items');
      const taxes = await store.list('taxes');
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

  // ── 7. Items (`/items/*`) ────────────────────────────────────────────────────
  if (root === 'items') {
    const items = await store.list('items');

    if (sub === 'onlineSalesItemsAjaxLists') {
      const catId = String(query.category_id || '').trim();
      const offset = Math.max(0, parseInt(query.offset || '0', 10) || 0);
      const limit = Math.max(1, parseInt(query.limit || '48', 10) || 48);
      let filtered = items.filter((it) => it.available_for_sale !== false);
      if (catId) filtered = filtered.filter((it) => String(it.category_id) === catId);
      const slice = filtered.slice(offset, offset + limit);
      const next_offset = offset + limit < filtered.length ? offset + limit : null;
      return ok({ items: slice, next_offset, total: filtered.length });
    }

    if (sub === 'getOnlineItemsAjaxList' || sub === 'getCustomerSearchItemsAjaxList' || sub === 'getReceivingItemsAjaxList') {
      const q = String(query.query || '').trim().toLowerCase();
      const type = String(query.type || '').toLowerCase();
      const matched = items.filter((it) => {
        if (!q) return true;
        if (type === 'barcode') {
          return String(it.barcode_id || '').toLowerCase() === q || String(it.itemid || '').toLowerCase() === q;
        }
        return (
          String(it.name || '').toLowerCase().includes(q) ||
          String(it.itemid || '').toLowerCase().includes(q) ||
          String(it.barcode_id || '').toLowerCase().includes(q) ||
          String(it.category_name || '').toLowerCase().includes(q)
        );
      });
      const suggestions = matched.slice(0, 30).map((it) => ({
        ...it,
        value: it.name,
        item_id: it._id,
        item_name: it.name,
      }));
      return jsonResp({ type: 'success', suggestions, data: suggestions });
    }

    if (sub === 'pricePreview' && method === 'POST') {
      const base = num(body.price);
      const discAmt = num(body.discount_amount);
      const discPct = num(body.discount_percentage);
      const discount = discAmt > 0 ? discAmt : (base * discPct) / 100;
      const afterDisc = Math.max(0, base - discount);
      const taxRate = num(body.tax);
      const taxType = String(body.tax_type || 'Exclusive').toLowerCase();
      const tax = taxType.includes('inc')
        ? afterDisc - afterDisc / (1 + taxRate / 100)
        : (afterDisc * taxRate) / 100;
      const total = taxType.includes('inc') ? afterDisc : afterDisc + tax;
      return ok({ base, discount, tax, total });
    }

    if (sub === 'itemLowStockTable') {
      const low = items.filter((it) => it.track_inventory && num(it.available_quantity) <= num(it.low_stock, 5));
      return ok({ list: low, total: low.length, low_stock_count: low.length });
    }

    if (sub === 'quantityCount') {
      return ok({ count: items.length });
    }

    if (sub === 'demo' && sub2 === 'status') {
      return ok({ on: false, total: 0, counts: {} });
    }
    if (sub === 'demo' && sub2 === 'remove') {
      return ok({ removed: 0 }, 'Demo items removed');
    }

    if (sub === 'stockPreference') {
      if (method === 'PUT' || method === 'POST') {
        await store.put('meta', 'stock_preference', { _id: 'stock_preference', preference: body.preference || 'track' });
        return ok({ preference: body.preference || 'track' }, 'Preference saved');
      }
      const pref = await store.get('meta', 'stock_preference');
      return ok({ preference: pref?.preference || 'track' });
    }

    if (sub === 'uploadItemImage' && method === 'POST') {
      const imgUrl = await saveUploadedFile(files[0], store, 'items');
      return ok(imgUrl || 'item.svg', 'Image uploaded');
    }

    if (!sub && method === 'GET') {
      const { list, total } = applyListFilters(items, query, ['name', 'itemid', 'barcode_id', 'category_name', 'supplier_name']);
      const summary = {
        total: items.length,
        inactive: items.filter((i) => i.status === 'Inactive' || i.available_for_sale === false).length,
        out: items.filter((i) => i.track_inventory && num(i.available_quantity) <= 0).length,
        low: items.filter((i) => i.track_inventory && num(i.available_quantity) > 0 && num(i.available_quantity) <= num(i.low_stock, 5)).length,
      };
      return ok({ list, total, summary });
    }

    if (!sub && method === 'POST') {
      const id = newObjectId();
      const cats = await store.list('categories');
      const cat = cats.find((c) => c._id === body.category_id || c.name === body.category_name);
      const doc = {
        _id: id,
        id,
        name: String(body.name || body.item_name || 'Untitled Item').trim(),
        item_name: String(body.name || body.item_name || 'Untitled Item').trim(),
        itemid: body.itemid || `SKU-${Date.now().toString().slice(-5)}`,
        barcode_id: body.barcode_id || String(Date.now()).slice(-13),
        category_id: cat?._id || body.category_id || '',
        category_name: cat?.name || body.category_name || 'General',
        supplier_id: body.supplier_id || DEFAULT_SUPPLIER_ID,
        supplier_name: body.supplier_name || 'Macisla Supply Co.',
        selling_price: num(body.selling_price),
        mrp_price: num(body.mrp_price ?? body.selling_price),
        company_price: num(body.company_price),
        available_quantity: num(body.available_quantity, 0),
        low_stock: num(body.low_stock, 5),
        track_inventory: bool(body.track_inventory ?? body.inventory, true),
        negative_stock: bool(body.negative_stock, false),
        available_for_sale: body.available_for_sale !== false,
        item_kind: body.item_kind || 'product',
        unit: body.unit || 'qty',
        tax: num(body.tax, 0),
        tax_type: body.tax_type || 'Exclusive',
        discount_amount: num(body.discount_amount, 0),
        discount_percentage: num(body.discount_percentage, 0),
        image: body.image || 'item.svg',
        tile_color: body.tile_color || '#2563EB',
        tile_shape: body.tile_shape || 'rounded',
        description: body.description || '',
        branch_id: DEFAULT_BRANCH_ID,
        status: 'Active',
        created_by: currentUser?.user_name || 'admin',
        created_date: nowIso(),
        updated_date: nowIso(),
      };
      await store.put('items', id, doc);
      return ok(doc, 'Item added successfully');
    }
  }

  // ── 8. Categories (`/categories/*`) ──────────────────────────────────────────
  if (root === 'categories') {
    const categories = await store.list('categories');
    const items = await store.list('items');

    if (sub === 'getCategoriesWithValidItems') {
      return ok(
        categories.map((c) => ({
          id: c._id,
          _id: c._id,
          category_name: c.name || c.category_name,
          category_img: c.image || 'category.svg',
          name: c.name || c.category_name,
          image: c.image || 'category.svg',
          tile_color: c.tile_color || '#2563EB',
        }))
      );
    }

    if (sub === 'getCategoryAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const matched = categories
        .filter((c) => !q || String(c.name || '').toLowerCase().includes(q))
        .map((c) => ({
          id: c._id,
          _id: c._id,
          value: c.name,
          name: c.name,
          category_name: c.name,
        }));
      return jsonResp({ type: 'success', suggestions: matched, data: matched });
    }

    if (!sub && method === 'GET') {
      const enriched = categories.map((c) => ({
        ...c,
        items_count: items.filter((i) => String(i.category_id) === String(c._id)).length,
      }));
      const { list, total } = applyListFilters(enriched, query, ['name', 'description']);
      return ok({ list, total });
    }
  }

  // ── 9. Customers (`/customers/*`) ────────────────────────────────────────────
  if (root === 'customers') {
    const customers = await store.list('customers');
    if (sub === 'getCustomersAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const matched = customers
        .filter((c) => !q || String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').toLowerCase().includes(q))
        .map((c) => ({
          ...c,
          id: c._id,
          value: c.name,
          customer_id: c._id,
          customer_name: c.name,
        }));
      return jsonResp({ type: 'success', suggestions: matched, data: matched });
    }
    if (sub === 'customerOutstandingReportTable') {
      return ok({ list: [], total: 0 });
    }
  }

  // ── 10. Suppliers (`/suppliers/*`) ───────────────────────────────────────────
  if (root === 'suppliers') {
    const suppliers = await store.list('suppliers');
    if (sub === 'getSuppliersAjaxList') {
      const q = String(query.query || '').toLowerCase();
      const matched = suppliers
        .filter((s) => !q || String(s.name || '').toLowerCase().includes(q))
        .map((s) => ({
          ...s,
          id: s._id,
          value: s.name,
          supplier_id: s._id,
          supplier_name: s.name,
        }));
      return jsonResp({ type: 'success', suggestions: matched, data: matched });
    }
  }

  // ── 11. Sales (`/sales/*`) ───────────────────────────────────────────────────
  if (root === 'sales') {
    const sales = await store.list('sales');

    if (sub === 'getLatestSales') {
      const wantHold = String(query.type || '').toLowerCase() === 'hold';
      const rows = sales
        .filter((s) => (wantHold ? s.sale_process === 'Hold' : true))
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

    if (sub === 'hold' && (method === 'POST' || method === 'PUT')) {
      const saved = await saveSale(body, store, branch, currentUser, { hold: true });
      return ok(
        {
          sales_id: saved._id,
          id: saved._id,
          _id: saved._id,
        },
        'Sale parked successfully'
      );
    }

    if (!sub && method === 'POST') {
      const saved = await saveSale(body, store, branch, currentUser, { hold: false });
      return ok(
        {
          sales_id: saved._id,
          id: saved._id,
          _id: saved._id,
          bill_no: saved.sales_id,
          sms: false,
          whatsapp: false,
          print: false,
          mail: false,
          phone: saved.customer_phone || '',
          name: saved.customer_name || 'Walk-in Customer',
          customer_balance: 0,
        },
        'Sales details added successfully'
      );
    }

    if (!sub && method === 'GET') {
      const nonHold = sales.filter((s) => s.sale_process !== 'Hold');
      const { list, total, allFiltered } = applyListFilters(nonHold, query, ['sales_id', 'customer_name', 'sold_by', 'payment_mode']);
      const payTotals = new Map();
      let grandTotal = 0;
      let cancelled = 0;
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
      const summary = {
        count: allFiltered.length,
        cancelled,
        currencies: [
          {
            currencyCode: branch.currency_type || 'Rp',
            currencySymbol: branch.currency_type || 'Rp',
            currencyDigits: 2,
            total: grandTotal,
            payments: Array.from(payTotals.entries()).map(([methodName, amount]) => ({
              method: methodName,
              amount,
            })),
          },
        ],
      };
      return ok({ list, total, summary });
    }

    if (
      ['salesReports', 'dailySalesReports', 'salesSummaryReports', 'customerSalesReportTable', 'itemSalesReportTable', 'categorySalesReportTable', 'paymentSalesTranscationReportTable'].includes(sub)
    ) {
      return ok({ list: sales, total: sales.length });
    }
  }

  // ── 12. Settings (`/setting/*` and `/settings/*`) ────────────────────────────
  if (root === 'setting' || root === 'settings') {
    if (sub === 'getThemeSettings') {
      const theme = (await store.get('meta', 'theme')) || { theme: 'light', theme_name: 'default', primary_color: '#506fe4' };
      return ok(theme);
    }
    if (sub === 'updateThemeSettings' && (method === 'POST' || method === 'PUT')) {
      const next = { _id: 'theme', ...body, updated_date: nowIso() };
      await store.put('meta', 'theme', next);
      return ok(next, 'Theme updated');
    }
    if (sub === 'getTaxAll' || sub === 'getTaxAjaxList') {
      const taxes = await store.list('taxes');
      return ok(taxes);
    }
    if (sub === 'getPaymentAll') {
      const payments = await store.list('payments');
      return ok(payments);
    }
    if (sub === 'getDenomAll') {
      const denoms = await store.list('denominations');
      return ok(denoms);
    }
    if (sub === 'getUnitAll' || sub === 'getUnitAjaxList') {
      const units = await store.list('units');
      return ok(units);
    }
    if (sub === 'getDefaultCustomer') {
      const customers = await store.list('customers');
      const cust = customers.find((c) => c._id === branch.default_customer) || customers[0] || {};
      return ok({
        customer_id: cust._id || DEFAULT_CUSTOMER_ID,
        customer_name: cust.name || 'Walk-in Customer',
        customer: cust,
      });
    }
    if (sub === 'getDefaultSupplier') {
      const suppliers = await store.list('suppliers');
      const sup = suppliers.find((s) => s._id === branch.default_supplier) || suppliers[0] || {};
      return ok({
        supplier_id: sup._id || DEFAULT_SUPPLIER_ID,
        supplier_name: sup.name || 'Macisla Supply Co.',
        supplier: sup,
      });
    }
    if (sub === 'getJSONCountry') return ok(COUNTRIES);
    if (sub === 'getJSONState') {
      const cid = Number(query.id || query.country_id || 102);
      return ok(STATES_BY_COUNTRY[cid] || STATES_BY_COUNTRY[102]);
    }
    if (sub === 'getJSONCurrency') return ok(CURRENCIES);
    if (sub === 'getJSONTimeZone') return ok(TIMEZONES);
    if (sub === 'getJSONDate') return ok(DATE_FORMATS);
    if (sub === 'starterLocale') {
      return ok({ country: branch.country, currency: branch.currency_type, timezone: branch.time_zone });
    }
    if (sub === 'taxProfile') {
      return ok({ country: branch.country || 'Indonesia', tax_label: 'PPN', gst_enabled: false });
    }
    if (sub === 'modifierGroups' || sub === 'priceLists') {
      return ok([]);
    }
    if (sub === 'wording') {
      return ok({ profile: 'retail', overrides: {} });
    }
    if (method === 'PUT' || method === 'POST') {
      const merged = { ...branch, ...body, updated_date: nowIso() };
      await store.put('branches', branch._id, merged);
      return ok(
        {
          ...merged,
          url: merged.print_url || false,
          customer: merged.default_customer,
          supplier: merged.default_supplier,
        },
        'Settings updated successfully'
      );
    }
    return ok(branch);
  }

  // ── 13. Shifts, Roster, Table/KOT, Stocklogs, Generic Collection CRUD ────────
  if (root === 'shifts') {
    return ok({ rows: [], active_shift: null });
  }
  if (root === 'roster') {
    return ok([]);
  }
  if (root === 'table' || root === 'kot') {
    return ok({ list: [], total: 0, tables: [] });
  }
  if (root === 'stocklogs') {
    const logs = await store.list('stocklogs');
    return ok({ list: logs, total: logs.length });
  }

  // Generic CRUD for all Posnic document collections
  const collection = root || 'misc';
  if (!sub && method === 'GET') {
    const docs = await store.list(collection);
    const { list, total } = applyListFilters(docs, query, ['name', 'title', 'phone', 'email', 'description', 'sales_id']);
    return ok({ list, total });
  }
  if (sub && method === 'GET') {
    const doc = await store.get(collection, sub);
    if (doc) return ok(doc);
    // Graceful empty response for auxiliary GET subroutes (e.g. reports/xxx)
    return ok({ list: [], total: 0 });
  }
  if (!sub && method === 'POST') {
    const id = newObjectId();
    const doc = {
      ...body,
      _id: id,
      id,
      created_date: nowIso(),
      updated_date: nowIso(),
    };
    await store.put(collection, id, doc);
    return ok(doc, 'Saved successfully');
  }
  if (sub && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
    const existing = (await store.get(collection, sub)) || { _id: sub, id: sub, created_date: nowIso() };
    const updated = { ...existing, ...body, _id: sub, id: sub, updated_date: nowIso() };
    await store.put(collection, sub, updated);
    return ok(updated, 'Updated successfully');
  }
  if (sub && method === 'DELETE') {
    await store.del(collection, sub);
    return ok({ deleted: true, id: sub }, 'Deleted successfully');
  }

  return ok({});
}

async function saveSale(body, store, branch, currentUser, { hold = false } = {}) {
  const existingId = String(body.sales_id || '').trim();
  const isUpdate = existingId.length === 24 && /^[a-f0-9]+$/i.test(existingId);
  const id = isUpdate ? existingId : newObjectId();
  const counters = (await store.get('meta', 'counters')) || { _id: 'counters', sale_seq: 1002 };
  let billNo = body.alternative_id;
  if (!billNo || !isUpdate) {
    counters.sale_seq = num(counters.sale_seq, 1002) + 1;
    await store.put('meta', 'counters', counters);
    billNo = `${branch.sales_prefix || 'S'}-${counters.sale_seq}`;
  }

  const rawItems = normalizeItemsPayload(body.items);
  const lineItems = rawItems.map((li) => {
    const qty = num(li.item_quantity ?? li.quantity, 1);
    const unitPrice = num(li.sale_inline_item_price ?? li.item_price ?? li.selling_price);
    const total = num(li.item_price_total) || unitPrice * qty;
    return {
      ...li,
      item_id: String(li.item_id?._id || li.item_id || li.product_id || li._id || ''),
      item_name: li.item_name || li.name || 'Item',
      item_quantity: qty,
      selling_price: unitPrice,
      item_price: unitPrice,
      item_price_total: total,
      company_price_total: num(li.company_price_total ?? li.company_price) * (li.company_price_total ? 1 : qty),
      item_discount: num(li.sale_inline_discount_value ?? li.item_discount ?? li.discount_amount),
      item_discount_percentage: num(li.sale_inline_discount_pervalue ?? li.item_discount_percentage ?? li.discount_percentage),
      tax: num(li.tax),
      tax_type: li.tax_type || 'Exclusive',
    };
  });

  const computedTotal =
    num(body.sales_total) ||
    lineItems.reduce((sum, li) => sum + num(li.item_price_total), 0);
  const computedCost =
    num(body.sales_total_company_price) ||
    lineItems.reduce((sum, li) => sum + num(li.company_price_total), 0);

  const now = nowIso();
  const doc = {
    _id: id,
    id,
    sales_document_id: id,
    sales_id: billNo,
    branch_id: branch._id,
    register_id: body.register_id || DEFAULT_REGISTER_ID,
    user_id: currentUser?._id || DEFAULT_ADMIN_ID,
    user_name: currentUser?.user_name || 'admin',
    sold_by: currentUser ? `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() : 'Macisla Admin',
    customer_id: body.customer_id || DEFAULT_CUSTOMER_ID,
    customer_name: body.customer_name || 'Walk-in Customer',
    customer_phone: body.customer_phone || '0000000000',
    customer_email: body.customer_email || '',
    customer_address: body.customer_address || '',
    payment_mode: hold ? '' : (body.payment_mode || 'Cash'),
    payment_status: hold ? 'Unpaid' : (body.payment_status || 'Paid'),
    sale_process: hold ? 'Hold' : (body.sale_process || 'Add'),
    items: lineItems,
    number_of_items: lineItems.length,
    sales_sub_total: num(body.sales_sub_total) || computedTotal,
    sales_total: computedTotal,
    total_amount: computedTotal,
    sales_total_company_price: computedCost,
    tax: num(body.tax),
    discount: num(body.discount),
    extra_discount: num(body.extra_discount),
    extra_discount_type: body.extra_discount_type || 'price',
    sales_description: body.sales_description || '',
    payment_description: body.payment_description || '',
    discount_description: body.discount_description || '',
    date: body.date || now,
    string_date: body.date || now,
    parked_at: hold ? now : undefined,
    created_date: now,
    updated_date: now,
  };

  await store.put('sales', id, doc);

  // Decrement inventory for tracked items on finalized sales
  if (!hold) {
    for (const li of lineItems) {
      if (!li.item_id) continue;
      const item = await store.get('items', li.item_id);
      if (item && item.track_inventory) {
        const nextQty = Math.max(0, num(item.available_quantity) - num(li.item_quantity, 1));
        await store.put('items', item._id, {
          ...item,
          available_quantity: nextQty,
          updated_date: now,
        });
      }
    }
  }

  return doc;
}

async function saveUploadedFile(entry, store, folder) {
  if (!entry || !entry.file || !store.putObject) return '';
  const ext = String(entry.file.name || 'file.png').split('.').pop() || 'png';
  const key = `pos/${folder}/${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${ext}`;
  const buf = await entry.file.arrayBuffer();
  await store.putObject(key, buf, entry.file.type || 'application/octet-stream');
  return `/r2/${key}`;
}
