/**
 * Macisla_POS Standalone Register & Back-Office Frontend Controller (pos.macisla.com)
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const posState = {
  currentView: 'register',
  mode: 'local_sqlite',
  items: [],
  transactions: [],
  customers: [],
  settings: {
    storeName: 'MACISLA BARBERSHOP & GROOMING',
    storeTagline: 'Point of Sale & Inventory System',
    storeAddress: 'Jl. Senopati No. 88, Jakarta Selatan',
    storePhone: '+62 812-8888-9900',
    currencySymbol: 'Rp',
    taxRatePercent: 0,
    receiptWidth: '80mm',
    receiptFooter: 'Thank you for visiting Macisla! Keep Sharp · See You Next Cut.'
  },
  analytics: null,
  selectedCategory: 'ALL',
  cart: [],
  discount: 0,
  paymentMethod: 'Cash',
  amountPaid: 0,
  selectedCustomer: null,
  heldBills: JSON.parse(localStorage.getItem('macisla_pos_held_bills') || '[]'),
  offlineQueue: JSON.parse(localStorage.getItem('macisla_pos_offline_queue') || '[]'),
  lastReceipt: null
};

const posApp = {
  async init() {
    this.setupDialogLightDismissFallback();
    this.setupKeyboardShortcuts();
    this.updateHeldBillsBadge();
    this.updateOfflineQueueUI();

    await this.bootstrapFromServer();
    await this.syncOfflineQueue();

    window.addEventListener('online', () => this.syncOfflineQueue());
  },

  // Progressive enhancement fallback for <dialog closedby="any"> (modern-web-guidance: dialog)
  setupDialogLightDismissFallback() {
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.addEventListener('close', () => {
        dialog.returnValue = '';
      });
    }
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
      }
    }
  },

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') { e.preventDefault(); this.switchView('register'); }
      if (e.key === 'F2') { e.preventDefault(); this.switchView('inventory'); }
      if (e.key === 'F3') { e.preventDefault(); this.switchView('customers'); }
      if (e.key === 'F4') { e.preventDefault(); this.switchView('reports'); }
      if (e.key === 'F5') { e.preventDefault(); this.switchView('settings'); }
      if (e.key === 'F9' && posState.currentView === 'register') {
        e.preventDefault();
        this.completeSale(true);
      }
      if (e.key === '/' && posState.currentView === 'register' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        document.getElementById('reg-search-input')?.focus();
      }
    });
  },

  formatMoney(val) {
    const sym = posState.settings?.currencySymbol || 'Rp';
    const num = Math.max(0, Math.round(Number(val) || 0));
    return `${sym} ${num.toLocaleString('id-ID')}`;
  },

  async bootstrapFromServer() {
    try {
      const resp = await fetch('/api/pos/bootstrap');
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) {
          posState.mode = data.mode || 'local_sqlite';
          posState.items = Array.isArray(data.items) ? data.items : [];
          posState.transactions = Array.isArray(data.transactions) ? data.transactions : [];
          posState.customers = Array.isArray(data.customers) ? data.customers : [];
          if (data.settings) posState.settings = { ...posState.settings, ...data.settings };
          posState.analytics = data.analytics || null;
          if (!posState.lastReceipt && posState.transactions.length > 0) {
            posState.lastReceipt = posState.transactions[0];
          }
        }
      }
    } catch (err) {
      console.warn('[POS] Bootstrap offline fallback:', err.message);
    }
    this.renderAll();
  },

  renderAll() {
    const dbBadge = document.getElementById('sidebar-db-mode');
    if (dbBadge) {
      dbBadge.textContent = posState.mode === 'cloudflare_d1' ? '☁️ Cloudflare D1' : '💾 Local SQLite + D1';
    }
    const storeBadge = document.getElementById('topbar-store-name');
    if (storeBadge) storeBadge.textContent = posState.settings.storeName;

    const lowStockItems = posState.items.filter(i => i.itemType === 'Product' && Number(i.stock) <= Number(i.minStock ?? 5));
    const lowAlert = document.getElementById('topbar-low-stock-alert');
    if (lowAlert) {
      if (lowStockItems.length > 0) {
        lowAlert.style.display = 'inline-flex';
        lowAlert.textContent = `⚠️ ${lowStockItems.length} Low Stock Item${lowStockItems.length === 1 ? '' : 's'}`;
      } else {
        lowAlert.style.display = 'none';
      }
    }

    this.renderCustomerSelect();
    this.renderCategoryBar();
    this.renderRegisterCatalog();
    this.renderCart();
    this.renderInventoryTable();
    this.renderCustomersTable();
    this.renderReportsTable();
    this.populateSettingsForm();
  },

  switchView(view) {
    posState.currentView = view;
    const views = ['register', 'inventory', 'customers', 'reports', 'settings'];
    const titles = {
      register: 'POS Register & Billing',
      inventory: 'Items & Stock Management',
      customers: 'Customer Directory & Spend History',
      reports: 'Sales Ledger & Shift Z-Report',
      settings: 'Store & Thermal Receipt Printer Settings'
    };
    for (const v of views) {
      document.getElementById(`view-${v}`)?.classList.toggle('active', v === view);
      const btn = document.getElementById(`nav-${v}`);
      if (btn) {
        if (v === view) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      }
    }
    const titleEl = document.getElementById('topbar-view-title');
    if (titleEl) titleEl.textContent = titles[view] || 'MACISLA POS';
  },

  // ─── REGISTER & CATALOG ─────────────────────────────────────────────────────
  renderCategoryBar() {
    const bar = document.getElementById('reg-category-bar');
    if (!bar) return;
    const categories = ['ALL', ...new Set(posState.items.map(i => i.category))];
    bar.innerHTML = categories.map(cat => {
      const active = cat === posState.selectedCategory;
      const label = cat === 'ALL' ? 'All Items' : cat;
      return `<button type="button" class="btn ${active ? 'btn-primary' : ''}" style="white-space:nowrap;" onclick="posApp.setCategory('${escapeHtml(cat)}')">${escapeHtml(label)}</button>`;
    }).join('');
  },

  setCategory(cat) {
    posState.selectedCategory = cat;
    this.renderCategoryBar();
    this.renderRegisterCatalog();
  },

  handleSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = (e.target.value || '').trim().toLowerCase();
      if (!q) return;
      const exactSku = posState.items.find(i => i.sku.toLowerCase() === q);
      if (exactSku) {
        this.addToCart(exactSku.id);
        e.target.value = '';
        this.renderRegisterCatalog();
      }
    }
  },

  renderRegisterCatalog() {
    const grid = document.getElementById('reg-catalog-grid');
    if (!grid) return;
    const q = (document.getElementById('reg-search-input')?.value || '').trim().toLowerCase();

    const filtered = posState.items.filter(item => {
      const catMatch = posState.selectedCategory === 'ALL' || item.category === posState.selectedCategory;
      const searchMatch = !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2.5rem;color:var(--text-muted);font-size:0.85rem;">No matching services or products found.</p>`;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const isProd = item.itemType === 'Product';
      const isLow = isProd && Number(item.stock) <= Number(item.minStock ?? 5);
      const stockBadge = isProd
        ? `<span class="badge ${isLow ? 'badge-amber' : 'badge-blue'}">Stock: ${item.stock}</span>`
        : `<span class="badge badge-green">Service</span>`;

      return `
        <button type="button" class="item-tile" onclick="posApp.addToCart('${escapeHtml(item.id)}')">
          <div style="width:100%;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:6px;">
              <span style="font-family:monospace;font-size:0.68rem;color:var(--text-muted);">${escapeHtml(item.sku)}</span>
              ${stockBadge}
            </div>
            <div style="font-weight:700;font-size:0.82rem;line-height:1.3;">${escapeHtml(item.name)}</div>
          </div>
          <div style="width:100%;display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-weight:800;font-size:0.88rem;color:#34d399;">${this.formatMoney(item.price)}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);">+ Add</span>
          </div>
        </button>
      `;
    }).join('');
  },

  renderCustomerSelect() {
    const sel = document.getElementById('reg-customer-select');
    if (!sel) return;
    const currentPhone = posState.selectedCustomer?.phone || '';
    sel.innerHTML = `<option value="">👤 Walk-in Customer</option>` +
      posState.customers.map(c =>
        `<option value="${escapeHtml(c.phone)}" ${c.phone === currentPhone ? 'selected' : ''}>👤 ${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`
      ).join('');
  },

  handleCustomerSelect(phone) {
    if (!phone) {
      posState.selectedCustomer = null;
      return;
    }
    posState.selectedCustomer = posState.customers.find(c => c.phone === phone) || null;
  },

  addToCart(itemId) {
    const item = posState.items.find(i => i.id === itemId);
    if (!item) return;
    const existing = posState.cart.find(c => c.id === itemId);
    if (existing) {
      existing.qty += 1;
    } else {
      posState.cart.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        itemType: item.itemType,
        costPrice: item.costPrice,
        price: item.price,
        qty: 1
      });
    }
    this.syncTenderAndRenderCart(true);
  },

  changeCartQty(itemId, delta) {
    const idx = posState.cart.findIndex(c => c.id === itemId);
    if (idx === -1) return;
    posState.cart[idx].qty += delta;
    if (posState.cart[idx].qty <= 0) {
      posState.cart.splice(idx, 1);
    }
    this.syncTenderAndRenderCart(true);
  },

  clearCart() {
    posState.cart = [];
    posState.discount = 0;
    posState.amountPaid = 0;
    posState.selectedCustomer = null;
    const discEl = document.getElementById('reg-discount-input');
    if (discEl) discEl.value = '0';
    this.renderCustomerSelect();
    this.syncTenderAndRenderCart(true);
  },

  applyPercentDiscount(pct) {
    const subtotal = posState.cart.reduce((s, i) => s + i.price * i.qty, 0);
    posState.discount = Math.round((subtotal * pct) / 100);
    const discEl = document.getElementById('reg-discount-input');
    if (discEl) discEl.value = String(posState.discount);
    this.syncTenderAndRenderCart(true);
  },

  updateDiscount(val) {
    posState.discount = Math.max(0, Math.round(Number(val) || 0));
    this.syncTenderAndRenderCart(true);
  },

  setPaymentMethod(method) {
    posState.paymentMethod = ['Cash', 'QRIS', 'Card', 'Transfer'].includes(method) ? method : 'Cash';
    ['Cash', 'QRIS', 'Card', 'Transfer'].forEach(m => {
      const btn = document.getElementById(`pay-btn-${m}`);
      if (btn) btn.className = m === posState.paymentMethod ? 'btn btn-primary' : 'btn';
    });
    this.syncTenderAndRenderCart(true);
  },

  updateAmountPaid(val) {
    posState.amountPaid = Math.max(0, Math.round(Number(val) || 0));
    this.syncTenderAndRenderCart(false);
  },

  setQuickTender(amount) {
    const { total } = this.getCartTotals();
    posState.amountPaid = amount === 'exact' ? total : Math.max(total, Number(amount) || total);
    const paidEl = document.getElementById('reg-amount-paid');
    if (paidEl) paidEl.value = String(posState.amountPaid);
    this.syncTenderAndRenderCart(false);
  },

  getCartTotals() {
    const subtotal = posState.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const discount = Math.min(subtotal, Math.max(0, Math.round(Number(posState.discount) || 0)));
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = Math.max(0, Number(posState.settings.taxRatePercent) || 0);
    const taxAmount = Math.round((taxable * taxRate) / 100);
    const total = taxable + taxAmount;
    const amountPaid = posState.amountPaid >= total ? posState.amountPaid : total;
    const changeDue = Math.max(0, amountPaid - total);
    const itemCount = posState.cart.reduce((sum, i) => sum + i.qty, 0);
    return { subtotal, discount, taxRate, taxAmount, total, amountPaid, changeDue, itemCount };
  },

  syncTenderAndRenderCart(autoSetPaid = true) {
    const { total } = this.getCartTotals();
    if (autoSetPaid) {
      posState.amountPaid = total;
      const paidEl = document.getElementById('reg-amount-paid');
      if (paidEl) paidEl.value = String(total);
    }
    this.renderCart();
  },

  renderCart() {
    const box = document.getElementById('reg-cart-items');
    const { subtotal, taxRate, taxAmount, total, changeDue, itemCount } = this.getCartTotals();

    const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    setTxt('reg-item-count', String(itemCount));
    setTxt('reg-subtotal', this.formatMoney(subtotal));
    setTxt('reg-tax-rate', String(taxRate));
    setTxt('reg-tax-amount', this.formatMoney(taxAmount));
    setTxt('reg-grand-total', this.formatMoney(total));
    setTxt('reg-change-due', this.formatMoney(changeDue));

    if (!box) return;
    if (posState.cart.length === 0) {
      box.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:2.75rem 0.5rem;">Tap an item on the left or scan a barcode/SKU to build the bill.</p>`;
      return;
    }

    box.innerHTML = posState.cart.map(item => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.45rem 0.55rem;border-radius:8px;background:var(--bg-card);border:1px solid var(--border);font-size:0.78rem;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
          <div style="font-size:0.68rem;color:var(--text-muted);">${escapeHtml(item.sku)} · ${this.formatMoney(item.price)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button type="button" class="btn" style="padding:2px 8px;" onclick="posApp.changeCartQty('${escapeHtml(item.id)}', -1)" aria-label="Decrease quantity">−</button>
          <span style="min-width:22px;text-align:center;font-weight:800;">${item.qty}</span>
          <button type="button" class="btn" style="padding:2px 8px;" onclick="posApp.changeCartQty('${escapeHtml(item.id)}', 1)" aria-label="Increase quantity">+</button>
          <span style="min-width:78px;text-align:right;font-weight:800;color:#34d399;">${this.formatMoney(item.price * item.qty)}</span>
        </div>
      </div>
    `).join('');
  },

  // ─── HOLD & RECALL BILLS ────────────────────────────────────────────────────
  holdCurrentBill() {
    if (posState.cart.length === 0) return;
    const held = {
      id: `HOLD-${Date.now().toString(36).toUpperCase()}`,
      savedAt: new Date().toISOString(),
      customer: posState.selectedCustomer,
      cart: posState.cart.map(i => ({ ...i })),
      discount: posState.discount
    };
    posState.heldBills.unshift(held);
    localStorage.setItem('macisla_pos_held_bills', JSON.stringify(posState.heldBills));
    this.updateHeldBillsBadge();
    this.clearCart();
  },

  updateHeldBillsBadge() {
    const el = document.getElementById('held-bills-count');
    if (el) el.textContent = String(posState.heldBills.length);
  },

  openHeldBillsModal() {
    const list = document.getElementById('held-bills-list');
    if (list) {
      if (posState.heldBills.length === 0) {
        list.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:1.5rem;font-size:0.82rem;">No held bills.</p>`;
      } else {
        list.innerHTML = posState.heldBills.map((h, idx) => {
          const sum = h.cart.reduce((s, i) => s + i.price * i.qty, 0) - (h.discount || 0);
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem;border-radius:10px;background:var(--bg-card);border:1px solid var(--border);font-size:0.8rem;">
              <div>
                <div style="font-weight:700;">${escapeHtml(h.customer?.name || 'Walk-in Customer')} · ${this.formatMoney(sum)}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">${h.cart.length} items · ${new Date(h.savedAt).toLocaleTimeString()}</div>
              </div>
              <div style="display:flex;gap:0.4rem;">
                <button type="button" class="btn btn-primary" onclick="posApp.recallHeldBill(${idx})">Recall</button>
                <button type="button" class="btn btn-danger" onclick="posApp.removeHeldBill(${idx})">✕</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
    document.getElementById('dialog-held')?.showModal();
  },

  recallHeldBill(idx) {
    const h = posState.heldBills[idx];
    if (!h) return;
    posState.cart = h.cart;
    posState.discount = h.discount || 0;
    posState.selectedCustomer = h.customer || null;
    posState.heldBills.splice(idx, 1);
    localStorage.setItem('macisla_pos_held_bills', JSON.stringify(posState.heldBills));
    this.updateHeldBillsBadge();
    this.renderCustomerSelect();
    this.syncTenderAndRenderCart(true);
    document.getElementById('dialog-held')?.close();
  },

  removeHeldBill(idx) {
    posState.heldBills.splice(idx, 1);
    localStorage.setItem('macisla_pos_held_bills', JSON.stringify(posState.heldBills));
    this.updateHeldBillsBadge();
    this.openHeldBillsModal();
  },

  // ─── CHECKOUT, OFFLINE SYNC & 80MM PRINTING ─────────────────────────────────
  async completeSale(shouldPrint = true) {
    if (posState.cart.length === 0) {
      alert('Add at least one service or product to the register bill.');
      return;
    }
    const { subtotal, discount, taxRate, taxAmount, total, amountPaid, changeDue } = this.getCartTotals();
    const cashierName = document.getElementById('reg-cashier-select')?.value || 'General Counter';
    const tx = {
      id: `INV-${Date.now().toString(36).toUpperCase()}`,
      customerName: posState.selectedCustomer?.name || 'Walk-in Customer',
      customerPhone: posState.selectedCustomer?.phone || '',
      cashierName,
      items: posState.cart.map(i => ({ ...i, lineTotal: i.price * i.qty })),
      subtotal,
      discount,
      taxRate,
      taxAmount,
      total,
      paymentMethod: posState.paymentMethod,
      amountPaid,
      changeDue,
      status: 'COMPLETED',
      date: new Date().toISOString()
    };

    posState.lastReceipt = tx;
    this.populateReceiptHtml(tx);

    let savedOnline = false;
    try {
      const resp = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) savedOnline = true;
      }
    } catch (_) {}

    if (!savedOnline) {
      posState.offlineQueue.push(tx);
      localStorage.setItem('macisla_pos_offline_queue', JSON.stringify(posState.offlineQueue));
      this.updateOfflineQueueUI();
    }

    // Deduct local product stock immediately
    for (const li of tx.items) {
      if (li.itemType === 'Product') {
        const match = posState.items.find(i => i.id === li.id);
        if (match) match.stock = Math.max(0, Number(match.stock) - li.qty);
      }
    }

    posState.transactions.unshift(tx);
    this.clearCart();
    this.renderAll();

    if (shouldPrint) {
      this.triggerThermalPrint();
    }
  },

  async syncOfflineQueue() {
    if (!Array.isArray(posState.offlineQueue) || posState.offlineQueue.length === 0) {
      this.updateOfflineQueueUI();
      return;
    }
    try {
      const resp = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: posState.offlineQueue })
      });
      if (resp.ok) {
        posState.offlineQueue = [];
        localStorage.setItem('macisla_pos_offline_queue', '[]');
        await this.bootstrapFromServer();
      }
    } catch (_) {}
    this.updateOfflineQueueUI();
  },

  updateOfflineQueueUI() {
    const count = posState.offlineQueue.length;
    const sideEl = document.getElementById('sidebar-queue-count');
    const topBtn = document.getElementById('btn-sync-offline');
    const topCnt = document.getElementById('top-offline-count');
    if (sideEl) {
      sideEl.textContent = count > 0 ? `${count} Queued` : '0 Pending';
      sideEl.style.color = count > 0 ? '#fbbf24' : '#34d399';
    }
    if (topBtn && topCnt) {
      topBtn.style.display = count > 0 ? 'inline-flex' : 'none';
      topCnt.textContent = String(count);
    }
  },

  populateReceiptHtml(tx) {
    const s = posState.settings;
    const dateStr = new Date(tx.date || Date.now()).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const lines = (tx.items || []).map(it => `
      <div style="display:flex;justify-content:space-between;margin:3px 0;">
        <span>${escapeHtml(it.name)} x${it.qty}</span>
        <span>${this.formatMoney(it.price * it.qty)}</span>
      </div>
    `).join('');

    const html = `
      <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
        <div style="font-weight:800;font-size:14px;">${escapeHtml(s.storeName)}</div>
        <div style="font-size:11px;">${escapeHtml(s.storeTagline)}</div>
        <div style="font-size:10px;">${escapeHtml(s.storeAddress)}</div>
        <div style="font-size:10px;">Tel: ${escapeHtml(s.storePhone)}</div>
      </div>
      <div style="font-size:11px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;"><span>Invoice:</span><strong>${escapeHtml(tx.id)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${escapeHtml(dateStr)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Client:</span><span>${escapeHtml(tx.customerName)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Cashier:</span><span>${escapeHtml(tx.cashierName || 'Counter')}</span></div>
      </div>
      <div style="font-size:11px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        ${lines}
      </div>
      <div style="font-size:11px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${this.formatMoney(tx.subtotal)}</span></div>
        ${tx.discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${this.formatMoney(tx.discount)}</span></div>` : ''}
        ${tx.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Tax (${tx.taxRate}%)</span><span>${this.formatMoney(tx.taxAmount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-top:4px;"><span>TOTAL</span><span>${this.formatMoney(tx.total)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Paid (${escapeHtml(tx.paymentMethod)})</span><span>${this.formatMoney(tx.amountPaid)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Change</span><span>${this.formatMoney(tx.changeDue)}</span></div>
      </div>
      <div style="text-align:center;font-size:10px;padding-top:4px;">
        <div>${escapeHtml(s.receiptFooter)}</div>
        <div style="margin-top:2px;">pos.macisla.com</div>
      </div>
    `;

    const preview = document.getElementById('thermal-receipt-sheet');
    const printBox = document.getElementById('print-only-container');
    if (preview) preview.innerHTML = html;
    if (printBox) printBox.innerHTML = html;
  },

  openReceiptModal(txId = null) {
    const tx = txId
      ? posState.transactions.find(t => t.id === txId)
      : (posState.lastReceipt || posState.transactions[0]);
    if (tx) {
      this.populateReceiptHtml(tx);
    }
    document.getElementById('dialog-receipt')?.showModal();
  },

  triggerThermalPrint() {
    if (!document.getElementById('print-only-container')?.innerHTML && posState.lastReceipt) {
      this.populateReceiptHtml(posState.lastReceipt);
    }
    window.print();
  },

  // ─── VIEW 2: INVENTORY TABLE & ITEM MODAL ───────────────────────────────────
  renderInventoryTable() {
    const tbody = document.getElementById('inv-table-body');
    const q = (document.getElementById('inv-search-input')?.value || '').trim().toLowerCase();
    const products = posState.items.filter(i => i.itemType === 'Product');
    const lowStock = products.filter(i => Number(i.stock) <= Number(i.minStock ?? 5));
    const stockVal = products.reduce((s, i) => s + Math.max(0, Number(i.stock)) * Math.max(0, Number(i.price)), 0);

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('inv-kpi-total', String(posState.items.length));
    setTxt('inv-kpi-split', `${posState.items.length - products.length} Services / ${products.length} Products`);
    setTxt('inv-kpi-low', String(lowStock.length));
    setTxt('inv-kpi-value', this.formatMoney(stockVal));

    if (!tbody) return;
    const filtered = posState.items.filter(i =>
      !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );

    tbody.innerHTML = filtered.map(item => {
      const isProd = item.itemType === 'Product';
      const isLow = isProd && Number(item.stock) <= Number(item.minStock ?? 5);
      return `
        <tr>
          <th scope="row">${escapeHtml(item.sku)}</th>
          <td style="font-weight:700;">${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td><span class="badge ${isProd ? 'badge-blue' : 'badge-green'}">${escapeHtml(item.itemType)}</span></td>
          <td style="text-align:right;font-weight:700;color:#34d399;">${this.formatMoney(item.price)}</td>
          <td style="text-align:center;">
            ${isProd ? `<span class="badge ${isLow ? 'badge-amber' : 'badge-green'}">${item.stock} pcs</span>` : '<span style="color:var(--text-muted);">∞</span>'}
          </td>
          <td style="text-align:right;">
            ${isProd ? `<button type="button" class="btn" style="padding:3px 7px;font-size:0.72rem;" onclick="posApp.adjustStock('${escapeHtml(item.id)}', 10)">+10 Stock</button>` : ''}
            <button type="button" class="btn" style="padding:3px 7px;font-size:0.72rem;" onclick="posApp.openItemModal('${escapeHtml(item.id)}')">Edit</button>
            <button type="button" class="btn btn-danger" style="padding:3px 7px;font-size:0.72rem;" onclick="posApp.deleteItem('${escapeHtml(item.id)}')">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openItemModal(itemId = null) {
    const item = itemId ? posState.items.find(i => i.id === itemId) : null;
    document.getElementById('item-id').value = item?.id || '';
    document.getElementById('item-sku').value = item?.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`;
    document.getElementById('item-type').value = item?.itemType || 'Service';
    document.getElementById('item-name').value = item?.name || '';
    document.getElementById('item-category').value = item?.category || 'Haircuts & Styling';
    document.getElementById('item-cost').value = String(item?.costPrice ?? 0);
    document.getElementById('item-price').value = String(item?.price ?? 85000);
    document.getElementById('item-stock').value = String(item?.stock ?? 20);
    document.getElementById('item-min-stock').value = String(item?.minStock ?? 5);
    document.getElementById('dialog-item')?.showModal();
  },

  async submitItemModal(e) {
    e.preventDefault();
    const payload = {
      id: document.getElementById('item-id').value || undefined,
      sku: document.getElementById('item-sku').value,
      itemType: document.getElementById('item-type').value,
      name: document.getElementById('item-name').value,
      category: document.getElementById('item-category').value,
      costPrice: Number(document.getElementById('item-cost').value) || 0,
      price: Number(document.getElementById('item-price').value) || 0,
      stock: Number(document.getElementById('item-stock').value) || 0,
      minStock: Number(document.getElementById('item-min-stock').value) || 5
    };
    const resp = await fetch('/api/pos/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      await this.bootstrapFromServer();
    }
    document.getElementById('dialog-item')?.close();
  },

  async adjustStock(itemId, delta) {
    await fetch('/api/pos/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_stock', id: itemId, delta })
    });
    await this.bootstrapFromServer();
  },

  async deleteItem(itemId) {
    await fetch('/api/pos/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: itemId })
    });
    await this.bootstrapFromServer();
  },

  // ─── VIEW 3: CUSTOMERS TABLE & MODAL ────────────────────────────────────────
  renderCustomersTable() {
    const tbody = document.getElementById('cust-table-body');
    if (!tbody) return;
    const q = (document.getElementById('cust-search-input')?.value || '').trim().toLowerCase();
    const list = posState.customers.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No customers found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <th scope="row">${escapeHtml(c.phone)}</th>
        <td style="font-weight:700;">${escapeHtml(c.name)}</td>
        <td style="color:var(--text-muted);">${escapeHtml(c.preferences || c.notes || '—')}</td>
        <td style="text-align:center;"><span class="badge badge-blue">${c.posBills || 0} bills</span></td>
        <td style="text-align:right;font-weight:700;color:#34d399;">${this.formatMoney(c.totalSpent || 0)}</td>
        <td style="text-align:right;">
          <button type="button" class="btn btn-primary" style="padding:3px 8px;font-size:0.72rem;" onclick="posApp.startBillForCustomer('${escapeHtml(c.phone)}')">
            💳 Load in Register
          </button>
        </td>
      </tr>
    `).join('');
  },

  openCustomerModal() {
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-preferences').value = '';
    document.getElementById('dialog-customer')?.showModal();
  },

  async submitCustomerModal(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('cust-name').value,
      phone: document.getElementById('cust-phone').value,
      preferences: document.getElementById('cust-preferences').value
    };
    const resp = await fetch('/api/pos/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      await this.bootstrapFromServer();
      if (data.customer) {
        posState.selectedCustomer = data.customer;
        this.renderCustomerSelect();
      }
    }
    document.getElementById('dialog-customer')?.close();
  },

  startBillForCustomer(phone) {
    posState.selectedCustomer = posState.customers.find(c => c.phone === phone) || null;
    this.renderCustomerSelect();
    this.switchView('register');
  },

  // ─── VIEW 4: SALES REPORTS, VOID & SHIFT Z-REPORT ──────────────────────────
  renderReportsTable() {
    const tbody = document.getElementById('rep-table-body');
    const q = (document.getElementById('rep-search-input')?.value || '').trim().toLowerCase();
    const methodFilter = document.getElementById('rep-method-filter')?.value || 'ALL';
    const todayIso = new Date().toISOString().slice(0, 10);

    const activeTx = posState.transactions.filter(t => t.status !== 'VOIDED');
    const totalRev = activeTx.reduce((s, t) => s + Number(t.total || 0), 0);
    const todayRev = activeTx.filter(t => String(t.date || '').slice(0, 10) === todayIso).reduce((s, t) => s + Number(t.total || 0), 0);
    const cashRev = activeTx.filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + Number(t.total || 0), 0);
    const avgTicket = activeTx.length > 0 ? Math.round(totalRev / activeTx.length) : 0;

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('rep-kpi-today', this.formatMoney(todayRev));
    setTxt('rep-kpi-total', this.formatMoney(totalRev));
    setTxt('rep-kpi-bills', `${activeTx.length} (${this.formatMoney(avgTicket)})`);
    setTxt('rep-kpi-methods', `${this.formatMoney(cashRev)} / ${this.formatMoney(totalRev - cashRev)}`);

    if (!tbody) return;
    const filtered = posState.transactions.filter(tx => {
      const mMatch = methodFilter === 'ALL' || tx.paymentMethod === methodFilter;
      const sMatch = !q || tx.id.toLowerCase().includes(q) || (tx.customerName || '').toLowerCase().includes(q);
      return mMatch && sMatch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No transactions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(tx => {
      const isVoid = tx.status === 'VOIDED';
      const dateStr = new Date(tx.date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      return `
        <tr style="${isVoid ? 'opacity:0.55;' : ''}">
          <th scope="row">${escapeHtml(tx.id)} ${isVoid ? '<span class="badge badge-red">VOID</span>' : ''}</th>
          <td>${escapeHtml(dateStr)}</td>
          <td style="font-weight:600;">${escapeHtml(tx.customerName)}</td>
          <td>${escapeHtml(tx.cashierName || 'General Counter')}</td>
          <td><span class="badge badge-blue">${escapeHtml(tx.paymentMethod)}</span></td>
          <td style="text-align:right;font-weight:800;color:${isVoid ? '#f87171' : '#34d399'};">${this.formatMoney(tx.total)}</td>
          <td style="text-align:right;">
            <button type="button" class="btn" style="padding:3px 7px;font-size:0.72rem;" onclick="posApp.openReceiptModal('${escapeHtml(tx.id)}')">🖨️ Receipt</button>
            ${!isVoid ? `<button type="button" class="btn btn-danger" style="padding:3px 7px;font-size:0.72rem;" onclick="posApp.voidBill('${escapeHtml(tx.id)}')">Void</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  async voidBill(txId) {
    await fetch('/api/pos/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'void', id: txId })
    });
    await this.bootstrapFromServer();
  },

  printShiftZReport() {
    const activeTx = posState.transactions.filter(t => t.status !== 'VOIDED');
    const totalRev = activeTx.reduce((s, t) => s + Number(t.total || 0), 0);
    const cashRev = activeTx.filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + Number(t.total || 0), 0);
    const qrisRev = activeTx.filter(t => t.paymentMethod === 'QRIS').reduce((s, t) => s + Number(t.total || 0), 0);
    const cardRev = activeTx.filter(t => t.paymentMethod === 'Card').reduce((s, t) => s + Number(t.total || 0), 0);
    const transRev = activeTx.filter(t => t.paymentMethod === 'Transfer').reduce((s, t) => s + Number(t.total || 0), 0);

    const html = `
      <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
        <div style="font-weight:800;font-size:14px;">${escapeHtml(posState.settings.storeName)}</div>
        <div style="font-weight:700;font-size:12px;">SHIFT CLOSE (Z-REPORT)</div>
        <div style="font-size:10px;">Printed: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
      </div>
      <div style="font-size:11px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;"><span>Completed Bills:</span><strong>${activeTx.length}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Cash Drawer:</span><span>${this.formatMoney(cashRev)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>QRIS Total:</span><span>${this.formatMoney(qrisRev)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Card Total:</span><span>${this.formatMoney(cardRev)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Bank Transfer:</span><span>${this.formatMoney(transRev)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-top:5px;"><span>NET REVENUE:</span><span>${this.formatMoney(totalRev)}</span></div>
      </div>
      <div style="text-align:center;font-size:10px;">pos.macisla.com · End of Report</div>
    `;
    document.getElementById('thermal-receipt-sheet').innerHTML = html;
    document.getElementById('print-only-container').innerHTML = html;
    document.getElementById('dialog-receipt')?.showModal();
  },

  // ─── VIEW 5: STORE SETTINGS ─────────────────────────────────────────────────
  populateSettingsForm() {
    const s = posState.settings;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('set-store-name', s.storeName);
    setVal('set-store-tagline', s.storeTagline);
    setVal('set-store-address', s.storeAddress);
    setVal('set-store-phone', s.storePhone);
    setVal('set-tax-rate', String(s.taxRatePercent ?? 0));
    setVal('set-receipt-width', s.receiptWidth || '80mm');
    setVal('set-currency', s.currencySymbol || 'Rp');
    setVal('set-receipt-footer', s.receiptFooter);
  },

  async saveSettingsForm(e) {
    e.preventDefault();
    const payload = {
      storeName: document.getElementById('set-store-name').value,
      storeTagline: document.getElementById('set-store-tagline').value,
      storeAddress: document.getElementById('set-store-address').value,
      storePhone: document.getElementById('set-store-phone').value,
      taxRatePercent: Number(document.getElementById('set-tax-rate').value) || 0,
      receiptWidth: document.getElementById('set-receipt-width').value,
      currencySymbol: document.getElementById('set-currency').value || 'Rp',
      receiptFooter: document.getElementById('set-receipt-footer').value
    };
    const resp = await fetch('/api/pos/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.settings) posState.settings = data.settings;
      this.renderAll();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  posApp.init();
});
