// Macisla_POS — Canonical Catalog & Store Settings Seed Data
// Auto-updated in real time when you add/edit items, categories, customers, or settings
// in the local POS UI (`http://127.0.0.1:3088`). Commit & push to deploy changes to Cloudflare D1.

export const SYNC_COLLECTIONS = [
  'branches',
  'users',
  'registers',
  'taxes',
  'payments',
  'units',
  'denominations',
  'categories',
  'suppliers',
  'customers',
  'items',
  'meta',
];

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

export const SEED_DATA = {
  "branches": [
    {
      "_id": "665000000000000000000010",
      "id": "665000000000000000000010",
      "branch_name": "Macisla Main Store",
      "name": "Macisla Main Store",
      "branch_image": "store.png",
      "logo": "store.png",
      "store_address": "Jl. Senopati No. 88, Kebayoran Baru",
      "address": "Jl. Senopati No. 88, Kebayoran Baru",
      "printing_address": "Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan",
      "store_email": "pos@macisla.com",
      "branch_email": "pos@macisla.com",
      "store_telephone": "+62 812-8888-9900",
      "branch_phone": "+62 812-8888-9900",
      "store_alternativephone": "",
      "place": "Kebayoran Baru",
      "city": "Jakarta Selatan",
      "state": "DKI Jakarta",
      "country": "Indonesia",
      "country_id": 102,
      "pincode": "12190",
      "website": "https://pos.macisla.com",
      "languge": "English",
      "currency": "IDR",
      "currency_text": "IDR",
      "currency_type": "Rp",
      "currency_value": [
        {
          "currency_sign": "Rp",
          "currency_text": "IDR"
        }
      ],
      "time_zone": "Asia/Jakarta",
      "time_format": "enable",
      "client_dateformat": "YYYY-MM-DD",
      "server_dateformat": "YYYY-MM-DD",
      "dateformat_text": "YYYY-MM-DD",
      "sales_prefix": "S",
      "receiving_prefix": "P",
      "invoice_prefix": "INV-",
      "invoice_due_days": 30,
      "invoice_terms": "Thank you for your business.",
      "print_type": "thermal",
      "print_size": "80mm",
      "print_character": "42",
      "bill_print_copies": 1,
      "print_url": false,
      "print_logoimg": true,
      "print_sale_notes": true,
      "customer_print": true,
      "printall": false,
      "roundOff": false,
      "keyboard_view": false,
      "stock_management": true,
      "stock_management_log": true,
      "table_options": false,
      "cash_register_enable": true,
      "enable_multi_payment": true,
      "sale_quick_edit_enable": true,
      "allow_sale_date_edit": true,
      "allow_payment_correction": true,
      "allow_sale_hard_delete": true,
      "module_tax_enable": true,
      "module_credit_enable": true,
      "module_marketing_enable": true,
      "module_messaging_enable": false,
      "module_channels_enable": false,
      "module_online_ordering_enable": false,
      "module_kiosk_enable": false,
      "module_captain_enable": false,
      "module_mobile_pos_enable": false,
      "module_billing_outlets_enable": false,
      "module_delivery_partners_enable": false,
      "module_webshop_enable": false,
      "module_recyclebin_enable": true,
      "module_demo_data_enable": false,
      "module_themes_enable": true,
      "module_cashbook_enable": true,
      "quick_sale_enable": true,
      "quotes_enable": true,
      "invoices_enable": true,
      "staff_shifts_enable": true,
      "staff_roster_enable": true,
      "staff_tips_enable": false,
      "ai_enabled": false,
      "ask_posnic_enabled": false,
      "customer_checkbox": true,
      "supplier_checkbox": true,
      "tax_checkbox": true,
      "default_customer": "665000000000000000000301",
      "default_supplier": "665000000000000000000401",
      "default_tax": "665000000000000000000501",
      "tax_percentage": 0,
      "discount_amount": "0",
      "discount_percentage": "0",
      "indian_gst": "gst_off",
      "branch_gstin_number": "",
      "notification_range": 5,
      "sms_auto_send_time": "09:00 PM",
      "sms_retry_period": "15",
      "sms_max_retries": "3",
      "payment_gateway": {
        "status": "false",
        "key": "",
        "secret": ""
      },
      "phonepe_payment_gateway": {
        "merchantId": "",
        "saltKey": ""
      },
      "email_fields": [],
      "register": [
        {
          "_id": "665000000000000000000021",
          "register_name": "Main Counter Register"
        }
      ],
      "header_print": "Macisla Main Store",
      "footer_print": "Thank you for visiting Macisla! pos.macisla.com",
      "regular_body_print": null,
      "thermal_body_print": null,
      "online_ordering": {
        "store_id": "macisla",
        "enabled": false
      },
      "first_run_done": true,
      "first_run_decided": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "users": [
    {
      "_id": "665000000000000000000001",
      "id": "665000000000000000000001",
      "name": "admin",
      "user_name": "admin",
      "username": "admin",
      "firstname": "Macisla",
      "lastname": "Admin",
      "email": "admin@macisla.com",
      "phone": "+62 812-8888-9900",
      "password": "admin",
      "usertype": "super_admin",
      "role": "super_admin",
      "image": "user.svg",
      "status": "Active",
      "branch_id": [
        "665000000000000000000010"
      ],
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000002",
      "id": "665000000000000000000002",
      "name": "manager",
      "user_name": "manager",
      "username": "manager",
      "firstname": "Shop",
      "lastname": "Manager",
      "email": "manager@macisla.com",
      "phone": "+62 812-8888-9901",
      "password": "manager",
      "usertype": "manager",
      "role": "manager",
      "image": "user.svg",
      "status": "Active",
      "branch_id": [
        "665000000000000000000010"
      ],
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000003",
      "id": "665000000000000000000003",
      "name": "cashier",
      "user_name": "cashier",
      "username": "cashier",
      "firstname": "Front",
      "lastname": "Cashier",
      "email": "cashier@macisla.com",
      "phone": "+62 812-8888-9902",
      "password": "cashier",
      "usertype": "cashier",
      "role": "cashier",
      "image": "user.svg",
      "status": "Active",
      "branch_id": [
        "665000000000000000000010"
      ],
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "registers": [
    {
      "_id": "665000000000000000000021",
      "id": "665000000000000000000021",
      "register_id": "665000000000000000000021",
      "cash_register_id": "665000000000000000000020",
      "register_name": "Main Counter Register",
      "branch_id": "665000000000000000000010",
      "branch_name": "Macisla Main Store",
      "register_status": "Opened",
      "opening_balance": 500000,
      "opened_at": "2026-11-19T00:00:00.000Z",
      "opened_by": "admin",
      "in_use": true,
      "in_use_by": "admin",
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "taxes": [
    {
      "_id": "665000000000000000000501",
      "id": "665000000000000000000501",
      "tax_name": "No Tax (0%)",
      "tax_value": 0,
      "tax_type": "Exclusive",
      "is_default": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000502",
      "id": "665000000000000000000502",
      "tax_name": "PPN 11%",
      "tax_value": 11,
      "tax_type": "Exclusive",
      "is_default": false,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000503",
      "id": "665000000000000000000503",
      "tax_name": "Service 5%",
      "tax_value": 5,
      "tax_type": "Inclusive",
      "is_default": false,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "payments": [
    {
      "_id": "665000000000000000000601",
      "id": "665000000000000000000601",
      "payment_value": "Cash",
      "payment_name": "Cash",
      "active": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000602",
      "id": "665000000000000000000602",
      "payment_value": "QRIS",
      "payment_name": "QRIS",
      "active": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000603",
      "id": "665000000000000000000603",
      "payment_value": "Card",
      "payment_name": "Card",
      "active": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    },
    {
      "_id": "665000000000000000000604",
      "id": "665000000000000000000604",
      "payment_value": "Transfer",
      "payment_name": "Bank Transfer",
      "active": true,
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "units": [
    { "_id": "665000000000000000000701", "id": "665000000000000000000701", "unit_name": "qty", "unit_short": "qty", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000702", "id": "665000000000000000000702", "unit_name": "pcs", "unit_short": "pcs", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000703", "id": "665000000000000000000703", "unit_name": "session", "unit_short": "session", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000704", "id": "665000000000000000000704", "unit_name": "bottle", "unit_short": "bottle", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000705", "id": "665000000000000000000705", "unit_name": "box", "unit_short": "box", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000706", "id": "665000000000000000000706", "unit_name": "kg", "unit_short": "kg", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" }
  ],
  "denominations": [
    { "_id": "665000000000000000000801", "id": "665000000000000000000801", "denom_value": "100000", "denomination": 100000, "value": 100000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000802", "id": "665000000000000000000802", "denom_value": "50000", "denomination": 50000, "value": 50000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000803", "id": "665000000000000000000803", "denom_value": "20000", "denomination": 20000, "value": 20000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000804", "id": "665000000000000000000804", "denom_value": "10000", "denomination": 10000, "value": 10000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000805", "id": "665000000000000000000805", "denom_value": "5000", "denomination": 5000, "value": 5000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000806", "id": "665000000000000000000806", "denom_value": "2000", "denomination": 2000, "value": 2000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000807", "id": "665000000000000000000807", "denom_value": "1000", "denomination": 1000, "value": 1000, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" }
  ],
  "categories": [
    { "_id": "665000000000000000000201", "id": "665000000000000000000201", "name": "Haircuts & Grooming", "category_name": "Haircuts & Grooming", "description": "Haircuts, fades, styling, beard trims & hot towel treatments", "image": "category.svg", "tile_color": "#2563EB", "tile_shape": "rounded", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000202", "id": "665000000000000000000202", "name": "Hair Care Products", "category_name": "Hair Care Products", "description": "Pomades, matte clay, sea salt spray, beard oil & shampoo", "image": "category.svg", "tile_color": "#0D9488", "tile_shape": "rounded", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000203", "id": "665000000000000000000203", "name": "Beverages", "category_name": "Beverages", "description": "Specialty coffee, cold brew & refreshments", "image": "category.svg", "tile_color": "#D97706", "tile_shape": "rounded", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000204", "id": "665000000000000000000204", "name": "General", "category_name": "General", "description": "General retail items", "image": "category.svg", "tile_color": "#64748B", "tile_shape": "rounded", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" }
  ],
  "suppliers": [
    {
      "_id": "665000000000000000000401",
      "id": "665000000000000000000401",
      "name": "Macisla Supply Co.",
      "supplier_name": "Macisla Supply Co.",
      "company_name": "Macisla Supply Co.",
      "phone": "+62 21-555-0199",
      "email": "supply@macisla.com",
      "address": "Jl. Kemang Raya No. 12, Jakarta",
      "city": "Jakarta",
      "state": "DKI Jakarta",
      "country": "Indonesia",
      "created_date": "2026-11-19T00:00:00.000Z",
      "updated_date": "2026-11-19T00:00:00.000Z"
    }
  ],
  "customers": [
    { "_id": "665000000000000000000301", "id": "665000000000000000000301", "name": "Walk-in Customer", "customer_name": "Walk-in Customer", "phone": "0000000000", "email": "walkin@macisla.com", "address": "Jakarta", "city": "Jakarta", "state": "DKI Jakarta", "country": "Indonesia", "customer_balance": 0, "wallet_amount": 0, "partial_balance": 0, "is_default": true, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000302", "id": "665000000000000000000302", "name": "Andi Pratama", "customer_name": "Andi Pratama", "phone": "+62 812-1111-2233", "email": "andi@example.com", "address": "Jl. Dharmawangsa No. 4, Jakarta", "city": "Jakarta", "state": "DKI Jakarta", "country": "Indonesia", "customer_balance": 0, "wallet_amount": 0, "partial_balance": 0, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000303", "id": "665000000000000000000303", "name": "Budi Santoso", "customer_name": "Budi Santoso", "phone": "+62 813-4444-5566", "email": "budi@example.com", "address": "Jl. Gunawarman No. 19, Jakarta", "city": "Jakarta", "state": "DKI Jakarta", "country": "Indonesia", "customer_balance": 0, "wallet_amount": 0, "partial_balance": 0, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000304", "id": "665000000000000000000304", "name": "Rina Kusuma", "customer_name": "Rina Kusuma", "phone": "+62 811-7777-8899", "email": "rina@example.com", "address": "SCBD Lot 8, Jakarta", "city": "Jakarta", "state": "DKI Jakarta", "country": "Indonesia", "customer_balance": 0, "wallet_amount": 0, "partial_balance": 0, "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" }
  ],
  "items": [
    { "_id": "665000000000000000000101", "id": "665000000000000000000101", "name": "Signature Gentleman Cut", "item_name": "Signature Gentleman Cut", "itemid": "MCS-001", "barcode_id": "8990001000017", "category_id": "665000000000000000000201", "category_name": "Haircuts & Grooming", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 120000, "mrp_price": 120000, "company_price": 35000, "available_quantity": 99, "low_stock": 5, "track_inventory": false, "negative_stock": true, "available_for_sale": true, "item_kind": "service", "unit": "session", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#2563EB", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000102", "id": "665000000000000000000102", "name": "Skin Fade & Hot Towel", "item_name": "Skin Fade & Hot Towel", "itemid": "MCS-002", "barcode_id": "8990001000024", "category_id": "665000000000000000000201", "category_name": "Haircuts & Grooming", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 150000, "mrp_price": 150000, "company_price": 45000, "available_quantity": 99, "low_stock": 5, "track_inventory": false, "negative_stock": true, "available_for_sale": true, "item_kind": "service", "unit": "session", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#1D4ED8", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000103", "id": "665000000000000000000103", "name": "Beard Trim & Lineup", "item_name": "Beard Trim & Lineup", "itemid": "MCS-003", "barcode_id": "8990001000031", "category_id": "665000000000000000000201", "category_name": "Haircuts & Grooming", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 75000, "mrp_price": 75000, "company_price": 20000, "available_quantity": 99, "low_stock": 5, "track_inventory": false, "negative_stock": true, "available_for_sale": true, "item_kind": "service", "unit": "session", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#3B82F6", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000104", "id": "665000000000000000000104", "name": "AI Face Shape Styling Consult", "item_name": "AI Face Shape Styling Consult", "itemid": "MCS-004", "barcode_id": "8990001000048", "category_id": "665000000000000000000201", "category_name": "Haircuts & Grooming", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 50000, "mrp_price": 50000, "company_price": 10000, "available_quantity": 99, "low_stock": 5, "track_inventory": false, "negative_stock": true, "available_for_sale": true, "item_kind": "service", "unit": "session", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#6366F1", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000105", "id": "665000000000000000000105", "name": "Macisla Matte Clay 100g", "item_name": "Macisla Matte Clay 100g", "itemid": "MCS-005", "barcode_id": "8990001000055", "category_id": "665000000000000000000202", "category_name": "Hair Care Products", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 165000, "mrp_price": 165000, "company_price": 72000, "available_quantity": 28, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "pcs", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#0D9488", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000106", "id": "665000000000000000000106", "name": "Water-Based Shine Pomade", "item_name": "Water-Based Shine Pomade", "itemid": "MCS-006", "barcode_id": "8990001000062", "category_id": "665000000000000000000202", "category_name": "Hair Care Products", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 145000, "mrp_price": 145000, "company_price": 65000, "available_quantity": 22, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "pcs", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#0F766E", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000107", "id": "665000000000000000000107", "name": "Sea Salt Texture Spray 150ml", "item_name": "Sea Salt Texture Spray 150ml", "itemid": "MCS-007", "barcode_id": "8990001000079", "category_id": "665000000000000000000202", "category_name": "Hair Care Products", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 135000, "mrp_price": 135000, "company_price": 58000, "available_quantity": 18, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "bottle", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#14B8A6", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000108", "id": "665000000000000000000108", "name": "Cedarwood Beard Oil 30ml", "item_name": "Cedarwood Beard Oil 30ml", "itemid": "MCS-008", "barcode_id": "8990001000086", "category_id": "665000000000000000000202", "category_name": "Hair Care Products", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 155000, "mrp_price": 155000, "company_price": 68000, "available_quantity": 4, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "bottle", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#059669", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000109", "id": "665000000000000000000109", "name": "Iced Americano", "item_name": "Iced Americano", "itemid": "MCS-009", "barcode_id": "8990001000093", "category_id": "665000000000000000000203", "category_name": "Beverages", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 35000, "mrp_price": 35000, "company_price": 11000, "available_quantity": 50, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "qty", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#D97706", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "665000000000000000000110", "id": "665000000000000000000110", "name": "Oat Milk Latte", "item_name": "Oat Milk Latte", "itemid": "MCS-010", "barcode_id": "8990001000109", "category_id": "665000000000000000000203", "category_name": "Beverages", "supplier_id": "665000000000000000000401", "supplier_name": "Macisla Supply Co.", "selling_price": 45000, "mrp_price": 45000, "company_price": 16000, "available_quantity": 40, "low_stock": 5, "track_inventory": true, "negative_stock": false, "available_for_sale": true, "item_kind": "product", "unit": "qty", "tax": 0, "tax_type": "Exclusive", "tax_name": "No Tax (0%)", "discount_amount": 0, "discount_percentage": 0, "image": "item.svg", "tile_color": "#B45309", "tile_shape": "rounded", "branch_id": "665000000000000000000010", "status": "Active", "created_by": "admin", "created_date": "2026-11-19T00:00:00.000Z", "updated_date": "2026-11-19T00:00:00.000Z" }
  ],
  "meta": [
    { "_id": "theme", "theme": "light", "theme_name": "default", "primary_color": "#506fe4", "updated_date": "2026-11-19T00:00:00.000Z" },
    { "_id": "stock_preference", "preference": "track" }
  ]
};

export const SEED_VERSION = computeSeedVersion(SEED_DATA);
