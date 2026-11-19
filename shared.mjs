/**
 * Macisla_POS Shared Helpers, Default Catalog, Analytics & RFC 4180 CSV Exporter
 * Used by both Cloudflare Pages Edge (`functions/api/[[route]].js`) and Local Node (`storage.js` / `server.js`).
 */

export const DEFAULT_STORE_SETTINGS = {
  storeName: 'MACISLA BARBERSHOP & GROOMING',
  storeTagline: 'Point of Sale & Inventory System',
  storeAddress: 'Jl. Senopati No. 88, Jakarta Selatan',
  storePhone: '+62 812-8888-9900',
  currencySymbol: 'Rp',
  taxRatePercent: 0,
  receiptWidth: '80mm',
  receiptFooter: 'Thank you for visiting Macisla! Keep Sharp · See You Next Cut.'
};

export const DEFAULT_POS_ITEMS = [
  { id: 'itm-svc-001', sku: 'SVC-101', name: 'Signature Gentleman Haircut', category: 'Haircuts & Styling', itemType: 'Service', costPrice: 0, price: 85000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-svc-002', sku: 'SVC-102', name: 'Skin Fade & Precision Contour', category: 'Haircuts & Styling', itemType: 'Service', costPrice: 0, price: 95000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-svc-003', sku: 'SVC-103', name: 'Executive Cut + Beard Sculpt', category: 'Haircuts & Styling', itemType: 'Service', costPrice: 0, price: 125000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-svc-004', sku: 'SVC-104', name: 'Junior Gentleman Haircut', category: 'Haircuts & Styling', itemType: 'Service', costPrice: 0, price: 65000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-brd-001', sku: 'BRD-201', name: 'Royal Hot Towel Straight-Razor Shave', category: 'Beard & Shave', itemType: 'Service', costPrice: 0, price: 65000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-brd-002', sku: 'BRD-202', name: 'Beard Trim & Line-Up Taper', category: 'Beard & Shave', itemType: 'Service', costPrice: 0, price: 45000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-trt-001', sku: 'TRT-301', name: 'Hair Wash & Peppermint Scalp Massage', category: 'Hair Care & Treatments', itemType: 'Service', costPrice: 10000, price: 45000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-trt-002', sku: 'TRT-302', name: 'Charcoal Black Mask & Detox Facial', category: 'Hair Care & Treatments', itemType: 'Service', costPrice: 15000, price: 60000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-trt-003', sku: 'TRT-303', name: 'Keratin & Argan Hair Spa Treatment', category: 'Hair Care & Treatments', itemType: 'Service', costPrice: 25000, price: 90000, stock: 999, minStock: 0, active: 1 },
  { id: 'itm-prd-001', sku: 'PRD-401', name: 'Macisla Matte Styling Clay (100g)', category: 'Grooming Products', itemType: 'Product', costPrice: 65000, price: 135000, stock: 28, minStock: 5, active: 1 },
  { id: 'itm-prd-002', sku: 'PRD-402', name: 'Sea Salt Volume Texture Spray (150ml)', category: 'Grooming Products', itemType: 'Product', costPrice: 50000, price: 110000, stock: 22, minStock: 5, active: 1 },
  { id: 'itm-prd-003', sku: 'PRD-403', name: 'Gravity-Defying Texture Powder (30g)', category: 'Grooming Products', itemType: 'Product', costPrice: 55000, price: 120000, stock: 19, minStock: 5, active: 1 },
  { id: 'itm-prd-004', sku: 'PRD-404', name: 'Classic Water-Based Pomade (100g)', category: 'Grooming Products', itemType: 'Product', costPrice: 60000, price: 125000, stock: 16, minStock: 5, active: 1 },
  { id: 'itm-prd-005', sku: 'PRD-405', name: 'Moroccan Argan Beard & Hair Oil (50ml)', category: 'Grooming Products', itemType: 'Product', costPrice: 62000, price: 130000, stock: 4, minStock: 5, active: 1 },
  { id: 'itm-bev-001', sku: 'BEV-501', name: 'Cold BrewSpecialty Coffee Can', category: 'Beverages & Add-ons', itemType: 'Product', costPrice: 12000, price: 28000, stock: 36, minStock: 8, active: 1 },
  { id: 'itm-bev-002', sku: 'BEV-502', name: 'Sparkling Lemon Tonic Water', category: 'Beverages & Add-ons', itemType: 'Product', costPrice: 10000, price: 22000, stock: 30, minStock: 8, active: 1 }
];

export function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return `"${str}"`;
}

export function normalizeTransactionPayload(payload = {}, defaultTaxRate = 0) {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    throw new Error('Transaction must contain at least one item');
  }

  const items = rawItems.map(it => {
    const price = Math.max(0, Math.round(Number(it.price) || 0));
    const costPrice = Math.max(0, Math.round(Number(it.costPrice ?? it.cost_price) || 0));
    const qty = Math.max(1, Math.round(Number(it.qty) || 1));
    return {
      id: String(it.id || 'item').trim(),
      sku: String(it.sku || 'ITEM').trim(),
      name: String(it.name || 'Item').trim(),
      category: String(it.category || 'Haircuts & Styling').trim(),
      itemType: (it.itemType || it.item_type) === 'Product' ? 'Product' : 'Service',
      costPrice,
      price,
      qty,
      lineTotal: price * qty
    };
  });

  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const discount = Math.max(0, Math.min(subtotal, Math.round(Number(payload.discount) || 0)));
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Number.isFinite(Number(payload.taxRate ?? payload.tax_rate))
    ? Math.max(0, Math.min(100, Number(payload.taxRate ?? payload.tax_rate)))
    : Math.max(0, Number(defaultTaxRate) || 0);
  const taxAmount = Math.round((taxable * taxRate) / 100);
  const total = taxable + taxAmount;

  const allowedMethods = ['Cash', 'QRIS', 'Card', 'Transfer'];
  const paymentMethod = allowedMethods.includes(payload.paymentMethod || payload.payment_method)
    ? (payload.paymentMethod || payload.payment_method)
    : 'Cash';

  const rawPaid = Number(payload.amountPaid ?? payload.amount_paid);
  const amountPaid = Number.isFinite(rawPaid) && rawPaid >= total ? Math.round(rawPaid) : total;
  const changeDue = Math.max(0, amountPaid - total);

  const id = String(payload.id || `INV-${Date.now().toString(36).toUpperCase()}`).trim();
  const sessionId = String(payload.sessionId || payload.session_id || '').trim();
  const customerPhone = String(payload.customerPhone || payload.customer_phone || payload.customer?.phone || '').trim();
  const customerName = String(payload.customerName || payload.customer_name || payload.customer?.name || 'Walk-in Customer').trim() || 'Walk-in Customer';
  const customerId = String(
    payload.customerId ||
    payload.customer_id ||
    (customerPhone ? `cust_${customerPhone.replace(/[^a-zA-Z0-9]/g, '')}` : '')
  ).trim();
  const cashierName = String(payload.cashierName || payload.cashier_name || 'General Counter').trim() || 'General Counter';
  const status = payload.status === 'VOIDED' ? 'VOIDED' : 'COMPLETED';
  const notes = String(payload.notes || '').trim();
  const date = payload.date || new Date().toISOString();
  const createdAt = payload.createdAt || payload.created_at || new Date().toISOString();

  return {
    id,
    sessionId,
    customerId,
    customerName,
    customerPhone,
    cashierName,
    items,
    subtotal,
    discount,
    taxRate,
    taxAmount,
    total,
    paymentMethod,
    amountPaid,
    changeDue,
    status,
    notes,
    date,
    createdAt
  };
}

export function computePosAnalytics(transactions = [], items = []) {
  const txList = (Array.isArray(transactions) ? transactions : []).filter(t => t.status !== 'VOIDED');
  const voidedCount = (Array.isArray(transactions) ? transactions : []).filter(t => t.status === 'VOIDED').length;
  const todayIso = new Date().toISOString().slice(0, 10);

  let totalRevenue = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let todayRevenue = 0;
  let todayCount = 0;
  const byMethod = { Cash: 0, QRIS: 0, Card: 0, Transfer: 0 };
  const byCashier = {};
  const itemSalesMap = {};

  for (const tx of txList) {
    const tot = Math.max(0, Math.round(Number(tx.total) || 0));
    const disc = Math.max(0, Math.round(Number(tx.discount) || 0));
    const tax = Math.max(0, Math.round(Number(tx.taxAmount ?? tx.tax_amount) || 0));
    totalRevenue += tot;
    totalDiscount += disc;
    totalTax += tax;

    const method = tx.paymentMethod || tx.payment_method || 'Cash';
    byMethod[method] = (byMethod[method] || 0) + tot;

    const cashier = tx.cashierName || tx.cashier_name || 'General Counter';
    if (!byCashier[cashier]) {
      byCashier[cashier] = { name: cashier, bills: 0, revenue: 0 };
    }
    byCashier[cashier].bills += 1;
    byCashier[cashier].revenue += tot;

    if (String(tx.date || '').slice(0, 10) === todayIso) {
      todayRevenue += tot;
      todayCount += 1;
    }

    const lineItems = Array.isArray(tx.items) ? tx.items : [];
    for (const li of lineItems) {
      const key = li.sku || li.id || li.name;
      if (!itemSalesMap[key]) {
        itemSalesMap[key] = {
          sku: li.sku || '',
          name: li.name || 'Item',
          category: li.category || 'Service',
          qtySold: 0,
          revenue: 0
        };
      }
      const q = Math.max(1, Number(li.qty) || 1);
      const p = Math.max(0, Number(li.price) || 0);
      itemSalesMap[key].qtySold += q;
      itemSalesMap[key].revenue += q * p;
    }
  }

  const topItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const cashierBreakdown = Object.values(byCashier).sort((a, b) => b.revenue - a.revenue);

  const catalogList = Array.isArray(items) ? items : [];
  const productItems = catalogList.filter(i => (i.itemType || i.item_type) === 'Product');
  const lowStockItems = productItems.filter(i => Number(i.stock) <= Number(i.minStock ?? i.min_stock ?? 5));
  const inventoryValue = productItems.reduce((sum, i) => sum + Math.max(0, Number(i.stock) || 0) * Math.max(0, Number(i.price) || 0), 0);

  return {
    totalBills: txList.length,
    voidedCount,
    totalRevenue,
    totalDiscount,
    totalTax,
    avgTicket: txList.length > 0 ? Math.round(totalRevenue / txList.length) : 0,
    todayCount,
    todayRevenue,
    byMethod,
    cashierBreakdown,
    topItems,
    inventory: {
      totalItems: catalogList.length,
      serviceCount: catalogList.length - productItems.length,
      productCount: productItems.length,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(i => ({ id: i.id, sku: i.sku, name: i.name, stock: i.stock, minStock: i.minStock ?? i.min_stock ?? 5 })),
      inventoryValue
    }
  };
}

export function buildSalesCsvExport(transactions = []) {
  const headers = [
    'Invoice ID',
    'Status',
    'Date (ISO)',
    'Date (Local WIB)',
    'Customer Name',
    'Customer Phone',
    'Barber / Cashier',
    'Line Items',
    'Subtotal (IDR)',
    'Discount (IDR)',
    'Tax Rate (%)',
    'Tax Amount (IDR)',
    'Grand Total (IDR)',
    'Payment Method',
    'Amount Paid (IDR)',
    'Change Due (IDR)',
    'Notes'
  ];

  const rows = (Array.isArray(transactions) ? transactions : []).map(tx => {
    const d = new Date(tx.date);
    const localStr = !isNaN(d.getTime())
      ? d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) + ' (WIB)'
      : (tx.date || '');
    const itemsText = (Array.isArray(tx.items) ? tx.items : [])
      .map(it => `[${it.sku || 'ITEM'}] ${it.name} x${it.qty} @ ${it.price}`)
      .join('; ');

    return [
      escapeCsvCell(tx.id),
      escapeCsvCell(tx.status || 'COMPLETED'),
      escapeCsvCell(tx.date || ''),
      escapeCsvCell(localStr),
      escapeCsvCell(tx.customerName || tx.customer_name || 'Walk-in Customer'),
      escapeCsvCell(tx.customerPhone || tx.customer_phone || ''),
      escapeCsvCell(tx.cashierName || tx.cashier_name || 'General Counter'),
      escapeCsvCell(itemsText),
      escapeCsvCell(Math.round(Number(tx.subtotal) || 0)),
      escapeCsvCell(Math.round(Number(tx.discount) || 0)),
      escapeCsvCell(Number(tx.taxRate ?? tx.tax_rate) || 0),
      escapeCsvCell(Math.round(Number(tx.taxAmount ?? tx.tax_amount) || 0)),
      escapeCsvCell(Math.round(Number(tx.total) || 0)),
      escapeCsvCell(tx.paymentMethod || tx.payment_method || 'Cash'),
      escapeCsvCell(Math.round(Number(tx.amountPaid ?? tx.amount_paid) || 0)),
      escapeCsvCell(Math.round(Number(tx.changeDue ?? tx.change_due) || 0)),
      escapeCsvCell(tx.notes || '')
    ].join(',');
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  return {
    csvContent,
    filename: `macisla_pos_sales_${nowStr}.csv`,
    count: rows.length
  };
}

export function buildInventoryCsvExport(items = []) {
  const headers = [
    'Item ID',
    'SKU / Barcode',
    'Item Name',
    'Category',
    'Type',
    'Cost Price (IDR)',
    'Selling Price (IDR)',
    'Current Stock',
    'Min Stock Alert',
    'Stock Value (IDR)'
  ];

  const rows = (Array.isArray(items) ? items : []).map(it => {
    const isProd = (it.itemType || it.item_type) === 'Product';
    const stock = isProd ? Math.max(0, Number(it.stock) || 0) : 0;
    const price = Math.max(0, Number(it.price) || 0);
    return [
      escapeCsvCell(it.id),
      escapeCsvCell(it.sku),
      escapeCsvCell(it.name),
      escapeCsvCell(it.category),
      escapeCsvCell(isProd ? 'Product' : 'Service'),
      escapeCsvCell(Math.max(0, Number(it.costPrice ?? it.cost_price) || 0)),
      escapeCsvCell(price),
      escapeCsvCell(isProd ? stock : 'N/A (Service)'),
      escapeCsvCell(isProd ? (it.minStock ?? it.min_stock ?? 5) : 'N/A'),
      escapeCsvCell(isProd ? stock * price : 0)
    ].join(',');
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  return {
    csvContent,
    filename: `macisla_pos_inventory_${nowStr}.csv`,
    count: rows.length
  };
}
