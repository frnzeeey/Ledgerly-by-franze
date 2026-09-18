// script/main.js
// Rebuilt POS - fully integrated, annotated, mobile-friendly
// - Discounts (PH law + Owner)
// - Auto-sorting (unitType) with orange headers
// - Product manager (add/edit/delete)
// - Cart, totals, VAT extraction, receipts, PDF export
// - Modal fixes + responsive behavior

/* ========== CONFIG ========== */
const DEFAULT_STORE_NAME = "Ledgerly POS";
const DEFAULT_STORE_ADDRESS = "By Franze";
const LS_SETTINGS = 'pos_settings_v1';
const LS_PRODUCTS = 'pos_products_v1';
const LS_SALES = 'pos_sales_v1';
const LS_MOVEMENTS = 'pos_stock_movements_v1';

/* ========== UTILITIES ========== */
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const fmt = v => '₱' + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[tag]));
}

/* ========== STATE ========== */
let products = JSON.parse(localStorage.getItem(LS_PRODUCTS) || '[]');
let sales = JSON.parse(localStorage.getItem(LS_SALES) || '[]');
let movements = JSON.parse(localStorage.getItem(LS_MOVEMENTS) || '[]');
let settings = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
let cart = [];
let editingId = null;
let currentDiscount = { type: 'none', amount: 0, label: '' };

/* ========== DOM CACHE ========== */
const productGrid = qs('#productGrid');
const pmList = qs('#pmList');
const searchInput = qs('#searchInput');
const pName = qs('#pName');
const pPrice = qs('#pPrice');
const pStock = qs('#pStock');
const pUnitType = qs('#pUnitType'); // NEW 🟠
const pThreshold = qs('#pThreshold');
const pSku = qs('#pSku');
const pBarcode = qs('#pBarcode');
const saveProductBtn = qs('#saveProductBtn');
const importSampleBtn = qs('#importSampleBtn');
const cartItems = qs('#cartItems');
const subtotalEl = qs('#subtotal');
const taxRateEl = qs('#taxRate');
const taxAmountEl = qs('#taxAmount');
const totalAmountEl = qs('#totalAmount');
const cashInput = qs('#cashInput');
const changeAmt = qs('#changeAmt');
const completeSaleBtn = qs('#completeSaleBtn');
const printReceiptBtn = qs('#printReceiptBtn');
const openReceiptBtn = qs('#openReceiptBtn');
const cartCount = qs('#cartCount');
const clearCartBtn = qs('#clearCartBtn');
const loadDemoBtn = qs('#loadDemoBtn');
const resetAllBtn = qs('#resetAllBtn');
const historyList = qs('#historyList');
const todayTotalEl = qs('#todayTotal');
const exportSalesBtn = qs('#exportSalesBtn');
const clearSalesBtn = qs('#clearSalesBtn');
const discountBtn = qs('#discountBtn');
const discountModal = qs('#discountModal');
const closeDiscountModal = qs('#closeDiscountModal');
const lawDiscountBtn = qs('#lawDiscountBtn');
const ownerDiscountOpenBtn = qs('#ownerDiscountOpenBtn');
const ownerDiscountModal = qs('#ownerDiscountModal');
const closeOwnerModal = qs('#closeOwnerModal');
const ownerDiscountInput = qs('#ownerDiscountInput');
const applyOwnerDiscountBtn = qs('#applyOwnerDiscountBtn');
const discountInfo = qs('#discountInfo');
const clearDiscountBtn = qs('#clearDiscountBtn');
const themeToggle = qs('#themeToggle');
const paymentMethod = qs('#paymentMethod');
const paymentReference = qs('#paymentReference');
const inventoryLog = qs('#inventoryLog');
const reportSummary = qs('#reportSummary');
const reportDetails = qs('#reportDetails');
const exportReportsBtn = qs('#exportReportsBtn');
const customerName = qs('#customerName');
const saleNotes = qs('#saleNotes');
const storeNameInput = qs('#storeNameInput');
const storeAddressInput = qs('#storeAddressInput');
const defaultTaxInput = qs('#defaultTaxInput');
const saveSettingsBtn = qs('#saveSettingsBtn');
const backupDataBtn = qs('#backupDataBtn');
const restoreDataBtn = qs('#restoreDataBtn');
const restoreDataInput = qs('#restoreDataInput');

/* ========== THEME ========== */
function updateThemeToggle(){
  const dark = document.documentElement.dataset.theme === 'dark';
  if (!themeToggle) return;
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  const icon = themeToggle.querySelector('.theme-icon');
  const label = themeToggle.querySelector('.theme-label');
  if (icon) icon.textContent = dark ? '☀' : '☾';
  if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
}

if (themeToggle) themeToggle.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('ledgerly-theme', dark ? 'light' : 'dark');
  updateThemeToggle();
});

if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
  const name = (storeNameInput?.value || '').trim();
  const address = (storeAddressInput?.value || '').trim();
  const tax = Number(defaultTaxInput?.value);
  if (!name || !address) return alert('Enter a store name and address');
  if (!Number.isFinite(tax) || tax < 0 || tax > 100) return alert('Enter a valid tax rate from 0 to 100');
  settings = { name, address, tax };
  saveSettings();
  if (taxRateEl) taxRateEl.value = tax;
  alert('Store settings saved.');
});

function downloadBackup(){
  const payload = { version: 1, exportedAt: new Date().toISOString(), products, sales, movements, settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `ledgerly-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
}
if (backupDataBtn) backupDataBtn.addEventListener('click', downloadBackup);
if (restoreDataBtn) restoreDataBtn.addEventListener('click', () => restoreDataInput?.click());
if (restoreDataInput) restoreDataInput.addEventListener('change', async () => {
  const file = restoreDataInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.sales) || !Array.isArray(parsed.movements)) throw new Error('Invalid backup structure');
    if (!confirm('Restore this backup and replace current local data?')) return;
    products = parsed.products; sales = parsed.sales; movements = parsed.movements; settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
    saveProducts(); saveSales(); saveMovements(); saveSettings();
    renderProducts(searchInput?.value || ''); renderPMList(); renderHistory(); renderInventoryLog(); renderReports();
    if (storeNameInput) storeNameInput.value = storeName();
    if (storeAddressInput) storeAddressInput.value = storeAddress();
    if (defaultTaxInput) defaultTaxInput.value = settings.tax ?? 12;
    alert('Backup restored.');
  } catch (error) {
    console.error('Backup restore failed', error);
    alert('Could not restore that backup file.');
  } finally {
    restoreDataInput.value = '';
  }
});
updateThemeToggle();

/* ========== TABS ========== */
qsa('.tab').forEach(t => t.addEventListener('click', () => {
  qsa('.tab').forEach(b => b.classList.remove('active'));
  t.classList.add('active');
  qsa('.content-section').forEach(s => s.classList.remove('active'));
  const name = t.dataset.tab;
  const target = qs('#tab-' + name);
  if (target) target.classList.add('active');
}));

/* ========== LOCAL STORAGE HELPERS ========== */
function saveProducts(){ localStorage.setItem(LS_PRODUCTS, JSON.stringify(products)); }
function saveSales(){ localStorage.setItem(LS_SALES, JSON.stringify(sales)); }
function saveMovements(){ localStorage.setItem(LS_MOVEMENTS, JSON.stringify(movements)); }
function saveSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }
function storeName(){ return settings.name || DEFAULT_STORE_NAME; }
function storeAddress(){ return settings.address || DEFAULT_STORE_ADDRESS; }
function logMovement(product, qty, type, note){
  movements.unshift({ timestamp:new Date().toISOString(), productId:product.id, productName:product.name, qty, type, note });
  movements = movements.slice(0, 200); saveMovements(); renderInventoryLog();
}
function renderInventoryLog(){
  if (!inventoryLog) return;
  inventoryLog.innerHTML = movements.slice(0, 12).map(m =>
    `<div class="movement-row"><strong>${escapeHtml(m.productName)}</strong> <span>${m.type === 'sale' ? '-' : '+'}${m.qty}</span><small>${escapeHtml(m.note || m.type)} · ${new Date(m.timestamp).toLocaleString()}</small></div>`
  ).join('') || '<div>No stock movements yet.</div>';
}

/* ========== PRODUCT CRUD & SAMPLES ========== */
function loadSampleProducts(){
  const sample = [
    { id:'P1001', name:'Mineral Water 500ml', sku:'WATER500', barcode:'4800001001', price:25, stock:50, threshold:5, unitType:'piece' },
    { id:'P1002', name:'Rice Sack', sku:'RICE-SACK', barcode:'4800001002', price:2500, stock:30, threshold:3, unitType:'sack' },
    { id:'P1003', name:'Brown Sugar', sku:'SUGAR-KG', barcode:'4800001003', price:80, stock:40, threshold:5, unitType:'kilo' },
    { id:'P1004', name:'Soda Can', sku:'SODA-CAN', barcode:'4800001004', price:45, stock:80, threshold:10, unitType:'piece' }
  ];
  products = sample.concat(products);
  saveProducts();
  renderProducts();
  renderPMList();
  alert('Sample products loaded!');
}
if (importSampleBtn) importSampleBtn.addEventListener('click', loadSampleProducts);
if (loadDemoBtn) loadDemoBtn.addEventListener('click', loadSampleProducts);

function loadProductForEdit(id){
  const p = products.find(x=>x.id===id);
  if (!p) return;
  editingId = id;
  if (pName) pName.value = p.name;
  if (pPrice) pPrice.value = p.price;
  if (pStock) pStock.value = p.stock;
  if (pUnitType) pUnitType.value = p.unitType || 'piece';
  if (pThreshold) pThreshold.value = p.threshold ?? 5;
  if (pSku) pSku.value = p.sku || '';
  if (pBarcode) pBarcode.value = p.barcode || '';
  const btn = qsa('.tab').find(b => b.dataset.tab === 'products');
  if (btn) btn.click();
}

if (saveProductBtn) saveProductBtn.addEventListener('click', () => {
  const name = (pName?.value||'').trim();
  const price = parseFloat(pPrice?.value||0);
  const stock = Math.max(0, parseInt(pStock?.value||0));
  const unitType = pUnitType?.value || 'piece';
  const threshold = Math.max(0, parseInt(pThreshold?.value || 0));
  const sku = (pSku?.value || '').trim();
  const barcode = (pBarcode?.value || '').trim();

  if (!name) return alert('Enter product name');
  if (isNaN(price) || price < 0) return alert('Invalid price');

  if (editingId){
    const p = products.find(x=>x.id===editingId);
    if (p){ const oldStock = Number(p.stock || 0); p.name = name; p.price = price; p.stock = stock; p.unitType = unitType; p.threshold = threshold; p.sku = sku; p.barcode = barcode; if (oldStock !== stock) logMovement(p, Math.abs(stock-oldStock), stock > oldStock ? 'adjustment' : 'sale', 'Manual stock adjustment'); }
    editingId = null;
  } else {
    const product = { id: 'P'+Date.now(), name, price, stock, threshold, sku, barcode, unitType };
    products.push(product); logMovement(product, stock, 'adjustment', 'Opening stock');
  }

  if (pName) pName.value=''; if (pPrice) pPrice.value=''; if (pStock) pStock.value=''; if (pThreshold) pThreshold.value='5'; if (pSku) pSku.value=''; if (pBarcode) pBarcode.value=''; if (pUnitType) pUnitType.value='piece';
  saveProducts();
  renderProducts(searchInput?.value || '');
  renderPMList();
});

/* ========== GROUP/SORT (NEW) ========== */
function groupProducts(list){
  const normalized = (list||[]).map(p=>({ ...p, unitType: p.unitType || 'piece' }));
  const groups = {
    sack: normalized.filter(p=>p.unitType==='sack'),
    kilo: normalized.filter(p=>p.unitType==='kilo'),
    piece: normalized.filter(p=>p.unitType==='piece')
  };
  return [
    { label:'Per Sack', key:'sack', items:groups.sack },
    { label:'Per Kilo', key:'kilo', items:groups.kilo },
    { label:'Per Piece', key:'piece', items:groups.piece }
  ];
}

/* ========== RENDER PRODUCTS (POS) ========== */
function renderProducts(filter=''){
  if (!productGrid) return;
  productGrid.innerHTML = '';
  const q = (filter||'').toLowerCase();
  const list = products.filter(p => [p.name, p.sku, p.barcode].some(v => String(v || '').toLowerCase().includes(q)));
  if (!list || list.length===0){
    productGrid.innerHTML = '<div class="muted">No products found. Add products or load demo.</div>';
    return;
  }

  const grouped = groupProducts(list);
  grouped.forEach(g=>{
    if (!g.items || g.items.length===0) return;
    const header = document.createElement('div'); header.className='group-header'; header.textContent = g.label;
    productGrid.appendChild(header);
    g.items.forEach(p=>{
      const card = document.createElement('div'); card.className='product-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="min-width:0">
            <h4 style="margin:0">${escapeHtml(p.name)}</h4>
            <div class="muted" style="font-size:12px">${p.unitType||'piece'} · SKU ${escapeHtml(p.sku || '—')}</div>
          </div>
          <div style="text-align:right">
            <div>${fmt(p.price)}</div>
            <div class="muted ${p.stock <= (p.threshold ?? 5) ? 'stock-warning' : ''}" style="font-size:12px">Stock: ${p.stock}${p.stock <= (p.threshold ?? 5) ? ' · Low stock' : ''}</div>
          </div>
        </div>
        <div class="actions" style="margin-top:8px">
          <button class="btn addBtn" ${(p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0) ? 'disabled' : ''}>${(p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0) ? 'Out of stock' : 'Add'}</button>
          <button class="btn-muted editBtn">Edit</button>
        </div>`;
      productGrid.appendChild(card);
      card.querySelector('.addBtn')?.addEventListener('click', ()=> addToCart(p.id));
      card.querySelector('.editBtn')?.addEventListener('click', ()=> loadProductForEdit(p.id));
    });
  });
}

/* ========== RENDER PRODUCT MANAGER ========== */
function renderPMList(){
  if (!pmList) return;
  pmList.innerHTML = '';
  if (!products || products.length===0){
    pmList.innerHTML = '<div class="muted">No products yet.</div>';
    return;
  }
  const grouped = groupProducts(products);
  grouped.forEach(g=>{
    if (!g.items || g.items.length===0) return;
    const header = document.createElement('div'); header.className='group-header'; header.textContent=g.label;
    pmList.appendChild(header);
    g.items.forEach(p=>{
      const r = document.createElement('div'); r.className='pm-row';
      r.style.display='flex'; r.style.justifyContent='space-between'; r.style.alignItems='center';
      r.style.padding='8px'; r.style.marginBottom='8px'; r.style.borderRadius='8px'; r.style.background='rgba(255,255,255,0.02)';
      r.innerHTML = `
        <div style="min-width:0">
          <strong style="display:block">${escapeHtml(p.name)}</strong>
          <div class="muted" style="font-size:12px">${fmt(p.price)} · Stock: ${p.stock} · threshold ${p.threshold ?? 5} · ${p.unitType||'piece'} · ${escapeHtml(p.sku || 'no SKU')}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-muted small edit">Edit</button>
          <button class="danger btn deleteBtn" data-id="${p.id}">Delete</button>
        </div>`;
      pmList.appendChild(r);
      r.querySelector('.edit')?.addEventListener('click', ()=> loadProductForEdit(p.id));
      r.querySelector('.deleteBtn')?.addEventListener('click', ()=>{
        if (!confirm('Delete product?')) return;
        products = products.filter(x=>x.id !== p.id);
        saveProducts();
        renderProducts(searchInput?.value || '');
        renderPMList();
      });
    });
  });
}

/* ========== CART FUNCTIONS ========== */
function addToCart(productId){
  const p = products.find(x => x.id === productId);
  if (!p) return alert('Product not found');
  if (p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0) return alert('This product is out of stock');
  const existing = cart.find(i => i.id === productId);
  if (existing){
    if (p.stock !== null && (existing.qty + 1) > p.stock) return alert('Stock limit reached');
    existing.qty += 1;
  } else {
    cart.push({ id: p.id, name: p.name, price: +p.price, qty: 1 });
  }
  renderCart();
  updateTotals();
}

function changeQty(id, newQty){
  const p = products.find(x => x.id === id);
  if (newQty < 1){
    cart = cart.filter(i => i.id !== id);
    renderCart(); updateTotals(); return;
  }
  if (p && p.stock !== null && newQty > p.stock) return alert('Stock limit reached');
  const it = cart.find(i => i.id === id);
  if (it) it.qty = newQty;
  renderCart(); updateTotals();
}

function renderCart(){
  if (!cartItems) return;
  cartItems.innerHTML = '';
  if (!cart || cart.length === 0){
    cartItems.innerHTML = '<div class="muted">Cart is empty. Tap a product to add.</div>';
    if (cartCount) cartCount.textContent = '(0 items)';
    return;
  }
  cart.forEach(item=>{
    const el = document.createElement('div'); el.className='cart-item';
    el.innerHTML = `
      <div style="min-width:0">
        <strong style="display:block">${escapeHtml(item.name)}</strong>
        <div class="muted" style="font-size:12px">${fmt(item.price)} each</div>
      </div>
      <div class="qty" style="display:flex;align-items:center;gap:8px">
        <button class="btn-muted dec">-</button>
        <div style="min-width:28px;text-align:center">${item.qty}</div>
        <button class="btn-muted inc">+</button>
      </div>
      <div style="width:86px;text-align:right">${fmt(item.price * item.qty)}</div>
      <div><button class="danger btn removeBtn">Remove</button></div>`;
    cartItems.appendChild(el);
    el.querySelector('.inc')?.addEventListener('click', ()=> changeQty(item.id, item.qty + 1));
    el.querySelector('.dec')?.addEventListener('click', ()=> changeQty(item.id, item.qty - 1));
    el.querySelector('.removeBtn')?.addEventListener('click', ()=>{
      cart = cart.filter(i => i.id !== item.id);
      renderCart(); updateTotals();
    });
  });
  if (cartCount) cartCount.textContent = `(${cart.length} ${cart.length === 1 ? 'item' : 'items'})`;
}

/* ========== TOTALS & VAT ========== */
function updateTotals(){
  const gross = cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const taxRate = Number(taxRateEl?.value || 12);
  const discountAmt = Number(currentDiscount.amount || 0);
  const taxable = Math.max(0, gross - discountAmt);
  const vatPortion = taxable - taxable / (1 + taxRate / 100);
  const netSales = taxable - vatPortion;
  const total = taxable;
  if (subtotalEl) subtotalEl.textContent = fmt(netSales);
  if (taxAmountEl) taxAmountEl.textContent = fmt(vatPortion);
  if (totalAmountEl) totalAmountEl.textContent = fmt(total);
  const cash = Number(cashInput?.value || 0);
  const change = cash - total;
  if (changeAmt) changeAmt.textContent = fmt(change > 0 ? change : 0);
  if (discountInfo){
    if (currentDiscount.type === 'none' || discountAmt === 0) discountInfo.textContent = '—';
    else discountInfo.textContent = `${currentDiscount.label} ${fmt(discountAmt)}`;
  }
}
if (cashInput) cashInput.addEventListener('input', updateTotals);
if (taxRateEl) taxRateEl.addEventListener('input', updateTotals);

/* ========== DISCOUNT MODALS & BEHAVIOR (FIX) ========== */
function showModal(modalEl){
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  setTimeout(()=> modalEl.setAttribute('aria-hidden','false'), 10);
}
function hideModal(modalEl){
  if (!modalEl) return;
  modalEl.setAttribute('aria-hidden','true');
  setTimeout(()=> { try { modalEl.style.display = 'none'; } catch(e){} }, 260);
}
qsa('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) hideModal(m); });
});

// hook discount modal buttons
if (discountBtn) discountBtn.addEventListener('click', ()=> showModal(discountModal));
if (closeDiscountModal) closeDiscountModal.addEventListener('click', ()=> hideModal(discountModal));
if (ownerDiscountOpenBtn) ownerDiscountOpenBtn.addEventListener('click', ()=> { hideModal(discountModal); if (ownerDiscountInput) ownerDiscountInput.value=''; showModal(ownerDiscountModal); });
if (closeOwnerModal) closeOwnerModal.addEventListener('click', ()=> hideModal(ownerDiscountModal));

// law discount (20%)
if (lawDiscountBtn) lawDiscountBtn.addEventListener('click', ()=>{
  const gross = cart.reduce((s,i)=>s + i.price * i.qty, 0);
  if (gross === 0) { alert('Cart is empty'); return; }
  const amt = +(gross * 0.20).toFixed(2);
  currentDiscount = { type:'law', amount:amt, label:'PH Law 20%:' };
  hideModal(discountModal); updateTotals();
});

// owner discount apply
if (applyOwnerDiscountBtn) applyOwnerDiscountBtn.addEventListener('click', ()=>{
  const v = Number(ownerDiscountInput?.value || 0);
  if (isNaN(v) || v <= 0) return alert('Enter discount amount (PHP)');
  const gross = cart.reduce((s,i)=>s + i.price * i.qty, 0);
  if (gross === 0) { alert('Cart is empty'); hideModal(ownerDiscountModal); return; }
  if (v >= gross && !confirm('Discount equals or exceeds total. This will make total ₱0. Proceed?')) return;
  currentDiscount = { type:'owner', amount:+v.toFixed(2), label:'Owner:' };
  hideModal(ownerDiscountModal); updateTotals();
});
if (clearDiscountBtn) clearDiscountBtn.addEventListener('click', ()=> { currentDiscount = { type:'none', amount:0, label:'' }; updateTotals(); alert('Discount cleared.'); });

/* ========== COMPLETE SALE ========== */
if (completeSaleBtn) completeSaleBtn.addEventListener('click', ()=>{
  if (cart.length === 0) return alert('Cart is empty');
  const gross = cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const taxRate = Number(taxRateEl?.value || 12);
  const discountAmt = Number(currentDiscount.amount || 0);
  const taxable = Math.max(0, gross - discountAmt);
  const vatPortion = taxable - taxable / (1 + taxRate / 100);
  const netSales = taxable - vatPortion;
  const total = taxable;
  const method = paymentMethod?.value || 'cash';
  const reference = (paymentReference?.value || '').trim();
  const cash = Number(cashInput?.value || 0);
  if (method === 'cash' && cash < total) return alert('Insufficient cash');
  if (method !== 'cash' && !reference) return alert('Enter a payment reference');
  if (cart.some(it => { const p = products.find(x => x.id === it.id); return !p || Number(p.stock) < Number(it.qty); })) return alert('One or more items no longer have enough stock');

  // deduct stock
  cart.forEach(it => {
    const p = products.find(x => x.id === it.id);
    if (p && p.stock !== null && !isNaN(p.stock)) { p.stock = Math.max(0, p.stock - it.qty); logMovement(p, it.qty, 'sale', 'Sale ' + (method || 'cash')); }
  });
  saveProducts();

  const sale = {
    id: 'S' + Date.now(),
    items: cart.map(i => ({ id:i.id, name:i.name, price:i.price, qty:i.qty })),
    subtotal: +netSales.toFixed(2),
    tax: +vatPortion.toFixed(2),
    discount: {...currentDiscount},
    total: +total.toFixed(2),
    cash: +(method === 'cash' ? cash : total).toFixed(2),
    change: +(method === 'cash' ? cash - total : 0).toFixed(2),
    paymentMethod: method,
    paymentReference: reference,
    customerName: (customerName?.value || '').trim(),
    notes: (saleNotes?.value || '').trim(),
    status: 'completed',
    timestamp: new Date().toISOString()
  };

  sales.push(sale); saveSales();
  cart = []; if (cashInput) cashInput.value=''; if (paymentReference) paymentReference.value=''; if (customerName) customerName.value=''; if (saleNotes) saleNotes.value=''; currentDiscount = { type:'none', amount:0, label:'' };

  renderCart(); renderProducts(searchInput?.value||''); renderPMList(); renderHistory(); renderReports(); openReceipt(sale); updateTotals();
});

/* ========== RECEIPT ========== */
function openReceipt(sale){
  const container = qs('#receiptContent');
  if (!container) return;
  container.innerHTML = '';
  const d = new Date(sale.timestamp);
  let html = `<div style="display:flex;justify-content:space-between"><div><strong>${escapeHtml(storeName())}</strong><div class="muted">${escapeHtml(storeAddress())}</div><div class="muted">${sale.id} · ${d.toLocaleString()}</div></div></div><hr/>`;
  if (sale.customerName) html += `<div>Customer: ${escapeHtml(sale.customerName)}</div>`;
  sale.items.forEach(it => html += `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(it.name)} x${it.qty}</div><div>${fmt(it.price * it.qty)}</div></div>`);
  html += `<hr/>`;
  if (sale.discount && sale.discount.type !== 'none' && Number(sale.discount.amount || 0) > 0) {
    html += `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(sale.discount.label)}</div><div>- ${fmt(sale.discount.amount)}</div></div>`;
  }
  html += `<div style="display:flex;justify-content:space-between"><div>Net Sales</div><div>${fmt(sale.subtotal)}</div></div>`;
  html += `<div style="display:flex;justify-content:space-between"><div>VAT</div><div>${fmt(sale.tax)}</div></div>`;
  html += `<div style="display:flex;justify-content:space-between;font-weight:700"><div>Total</div><div>${fmt(sale.total)}</div></div>`;
  html += `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(sale.paymentMethod || 'cash')}</div><div>${sale.paymentReference ? escapeHtml(sale.paymentReference) : fmt(sale.cash)}</div></div>`;
  html += `<div style="display:flex;justify-content:space-between"><div>Change</div><div>${fmt(sale.change)}</div></div>`;
  if (sale.notes) html += `<div style="margin-top:8px"><strong>Note:</strong> ${escapeHtml(sale.notes)}</div>`;
  container.innerHTML = html;
  const rp = qs('#receipt-print'); if (rp) rp.style.display='block';
  window.scrollTo({ top:0, behavior:'smooth' });
}
if (printReceiptBtn) printReceiptBtn.addEventListener('click', ()=> {
  const rp = qs('#receipt-print'); if (!rp || rp.style.display==='none') return alert('Open a receipt first'); window.print();
});
if (openReceiptBtn) openReceiptBtn.addEventListener('click', ()=> {
  if (!sales || sales.length===0) return alert('No receipts yet'); openReceipt(sales[sales.length-1]);
});

/* ========== HISTORY + EXPORT ========== */
function renderHistory(){
  if (!historyList) return;
  historyList.innerHTML = '';
  if (!sales || sales.length===0) { historyList.innerHTML = '<div class="muted">No sales yet.</div>'; if (todayTotalEl) todayTotalEl.textContent = fmt(0); return; }
  const sorted = sales.slice().reverse(); const today = new Date().toISOString().slice(0,10); let todayTotal=0;
  sorted.forEach(s=>{
    const row = document.createElement('div'); row.className='history-row';
    const d = new Date(s.timestamp);
    const voided = s.status === 'voided' || s.status === 'refunded';
    row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${s.id}</strong><div class="muted">${d.toLocaleString()} · ${s.status || 'completed'} · ${escapeHtml(s.paymentMethod || 'cash')}${s.customerName ? ` · ${escapeHtml(s.customerName)}` : ''}</div></div><div style="text-align:right"><div><strong>${fmt(s.total)}</strong></div><div style="display:flex;gap:6px;margin-top:6px"><button class="btn-muted reprintBtn">🧾 Reprint</button>${voided ? '' : '<button class="danger btn voidBtn">Refund / Void</button>'}</div></div></div>`;
    const details = document.createElement('div'); details.className='muted'; details.style.marginTop='8px';
    details.innerHTML = s.items.map(it=>`${escapeHtml(it.name)} x${it.qty} — ${fmt(it.price * it.qty)}`).join('<br>');
    if (s.discount && s.discount.type !== 'none' && Number(s.discount.amount || 0) > 0) details.innerHTML += `<br><strong>Discount:</strong> ${escapeHtml(s.discount.label)} ${fmt(s.discount.amount)}`;
    row.appendChild(details); historyList.appendChild(row);
    row.querySelector('.reprintBtn')?.addEventListener('click', ()=> { openReceipt(s); qs('#receipt-print')?.scrollIntoView({behavior:'smooth'}); });
    row.querySelector('.voidBtn')?.addEventListener('click', ()=> voidSale(s.id));
    if ((s.status || 'completed') === 'completed' && s.timestamp.slice(0,10) === today) todayTotal += s.total;
  });
  if (todayTotalEl) todayTotalEl.textContent = fmt(todayTotal);
}

function voidSale(id){
  const sale = sales.find(s => s.id === id);
  if (!sale || sale.status === 'voided' || sale.status === 'refunded') return;
  if (!confirm('Refund/void this sale and restore stock?')) return;
  sale.status = 'refunded'; sale.refundedAt = new Date().toISOString();
  sale.items.forEach(it => { const p = products.find(x => x.id === it.id); if (p) { p.stock = Number(p.stock || 0) + Number(it.qty || 0); logMovement(p, it.qty, 'refund', 'Refund ' + sale.id); } });
  saveProducts(); saveSales(); renderHistory(); renderProducts(searchInput?.value || ''); renderPMList(); renderReports();
}

/* PDF export (html2canvas + jsPDF) */
async function handleDownloadPdf(){
  if (!sales || sales.length===0) return alert('No sales to export.');
  const chooseToday = confirm("OK = today's sales, Cancel = all sales");
  let list;
  if (chooseToday){ const today = new Date().toISOString().slice(0,10); list = sales.filter(s=>s.timestamp.slice(0,10)===today); if (list.length===0) return alert('No sales today.'); } else list = sales.slice();
  const printableHtml = buildPrintableHtml(list);
  if (window.html2canvas && window.jspdf && window.jspdf.jsPDF){
    try {
      const off = document.createElement('div'); off.style.position='fixed'; off.style.left='-9999px'; off.style.top='0'; off.style.width='820px'; off.innerHTML = printableHtml; document.body.appendChild(off);
      const canvas = await window.html2canvas(off, { scale:2, useCORS:true, allowTaint:true });
      const imgData = canvas.toDataURL('image/jpeg',0.95);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit:'pt', format:'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight();
      const pxToPt = px => px * 72 / (window.devicePixelRatio * 96);
      const imgWidthPt = pxToPt(canvas.width), imgHeightPt = pxToPt(canvas.height);
      const ratio = Math.min(pageWidth / imgWidthPt, pageHeight / imgHeightPt);
      const renderWidth = imgWidthPt * ratio, renderHeight = imgHeightPt * ratio;
      pdf.addImage(imgData,'JPEG',(pageWidth - renderWidth)/2,40,renderWidth,renderHeight);
      pdf.save(`${storeName().replace(/\s+/g,'_')}_Sales.pdf`);
      if (off && off.parentNode) off.parentNode.removeChild(off);
    } catch (err) {
      console.error('PDF failed', err);
      const popup = window.open('', '_blank', 'width=900,height=800'); popup.document.open(); popup.document.write(printableHtml); popup.document.close(); setTimeout(()=>popup.print(),600);
    }
  } else {
    const popup = window.open('', '_blank', 'width=900,height=800'); if (!popup) return alert('Allow popups'); popup.document.open(); popup.document.write(printableHtml); popup.document.close(); setTimeout(()=>popup.print(),600);
  }
}
function buildPrintableHtml(list){
  const gAt = new Date().toLocaleString();
  let inner = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:20px;max-width:820px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:12px;"><div style="font-weight:700;font-size:18px;color:#ff7a18">${escapeHtml(storeName())}</div><div style="font-size:12px;color:#444;margin-top:4px">${escapeHtml(storeAddress())}</div><div style="margin-top:8px;font-weight:600">Sales Report</div><div style="margin-top:6px;color:#666;font-size:12px">Exported: ${gAt}</div></div><hr/>`;
  if (!list || list.length===0) inner += `<div>No sales</div>`;
  else list.forEach(s=>{
    const d = new Date(s.timestamp);
    inner += `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700">${escapeHtml(s.id)}</div><div style="color:#444">${escapeHtml(d.toLocaleString())}</div></div><div style="margin-top:6px;margin-left:6px;">`;
    s.items.forEach(it=> inner += `<div style="display:flex;justify-content:space-between;margin-bottom:2px"><div>${escapeHtml(it.name)} x${it.qty}</div><div>${fmt(it.price * it.qty)}</div></div>`);
    if (s.discount && s.discount.type!=='none' && Number(s.discount.amount||0) > 0) inner += `<div style="margin-top:6px"><strong>Discount:</strong> ${escapeHtml(s.discount.label)} ${fmt(s.discount.amount)}</div>`;
    inner += `</div><div style="margin-top:6px;display:flex;gap:10px;color:#222"><div><strong>Net:</strong> ${fmt(s.subtotal)}</div><div><strong>VAT:</strong> ${fmt(s.tax)}</div><div><strong>Total:</strong> ${fmt(s.total)}</div></div></div><hr style="border:none;border-top:1px solid #f4f4f4"/>`;
  });
  inner += `</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sales Export</title></head><body>${inner}</body></html>`;
}
if (exportSalesBtn) exportSalesBtn.addEventListener('click', handleDownloadPdf);

/* ========== REPORTS ========== */
function activeSales(){ return sales.filter(s => (s.status || 'completed') === 'completed'); }
function renderReports(){
  if (!reportSummary) return;
  const list = activeSales();
  const revenue = list.reduce((n,s)=>n + Number(s.total || 0), 0);
  const discounts = list.reduce((n,s)=>n + Number(s.discount?.amount || 0), 0);
  const byPayment = {};
  const byProduct = {};
  list.forEach(s => {
    const method = s.paymentMethod || 'cash'; byPayment[method] = (byPayment[method] || 0) + Number(s.total || 0);
    s.items.forEach(i => { byProduct[i.name] = (byProduct[i.name] || 0) + Number(i.qty || 0); });
  });
  reportSummary.innerHTML = [
    ['Sales', list.length], ['Revenue', fmt(revenue)], ['Discounts', fmt(discounts)],
    ['Items sold', Object.values(byProduct).reduce((n,v)=>n+v,0)]
  ].map(x=>`<div class="report-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  reportDetails.innerHTML = `<h4>Payment summary</h4>${Object.entries(byPayment).map(([k,v])=>`<div class="report-line"><span>${escapeHtml(k)}</span><strong>${fmt(v)}</strong></div>`).join('') || '<div class="muted">No completed sales.</div>'}<h4>Products sold</h4>${Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-line"><span>${escapeHtml(k)}</span><strong>${v}</strong></div>`).join('')}`;
}
function exportReportsCsv(){
  const rows = [['Sale ID','Date','Status','Payment method','Reference','Customer','Notes','Product','Qty','Total','Discount']];
  sales.forEach(s => s.items.forEach(i => rows.push([s.id, s.timestamp, s.status || 'completed', s.paymentMethod || 'cash', s.paymentReference || '', s.customerName || '', s.notes || '', i.name, i.qty, s.total, s.discount?.amount || 0])));
  const csv = rows.map(r=>r.map(v=>`"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ledgerly-pos-report.csv'; a.click(); URL.revokeObjectURL(a.href);
}
if (exportReportsBtn) exportReportsBtn.addEventListener('click', exportReportsCsv);
function updatePaymentFields(){
  const cash = paymentMethod?.value === 'cash';
  if (cashInput) { cashInput.disabled = !cash; cashInput.placeholder = cash ? 'Cash received' : 'Not needed for electronic payment'; }
  if (paymentReference) paymentReference.required = !cash;
  updateTotals();
}
if (paymentMethod) paymentMethod.addEventListener('change', updatePaymentFields);
updatePaymentFields();

/* ========== CLEAR / RESET ========== */
if (clearCartBtn) clearCartBtn.addEventListener('click', ()=> {
  if (cart.length===0) return alert('Cart is already empty');
  if (confirm('Clear cart?')) { cart = []; renderCart(); updateTotals(); }
});
if (clearSalesBtn) clearSalesBtn.addEventListener('click', ()=> {
  if (!sales || sales.length===0) return alert('No sales to clear');
  if (!confirm('Delete ALL sales history from this device?')) return;
  localStorage.removeItem(LS_SALES); sales = []; renderHistory();
  renderReports();
});
if (resetAllBtn) resetAllBtn.addEventListener('click', ()=> {
  if (!confirm('This will delete ALL products, sales and cart data locally. Continue?')) return;
  localStorage.removeItem(LS_PRODUCTS); localStorage.removeItem(LS_SALES); localStorage.removeItem(LS_MOVEMENTS);
  products = []; sales = []; movements = []; cart = []; renderProducts(); renderPMList(); renderCart(); renderHistory(); renderInventoryLog(); renderReports(); updateTotals();
});

/* ========== INITIAL RENDERS ========== */
renderProducts();
renderPMList();
renderCart();
renderHistory();
renderInventoryLog();
renderReports();
updateTotals();
if (storeNameInput) storeNameInput.value = storeName();
if (storeAddressInput) storeAddressInput.value = storeAddress();
if (defaultTaxInput) defaultTaxInput.value = settings.tax ?? 12;
if (taxRateEl && settings.tax !== undefined) taxRateEl.value = settings.tax;

/* ========== SEARCH / UI BINDINGS ========== */
if (searchInput) {
  searchInput.addEventListener('input', (e)=> renderProducts(e.target.value));
  searchInput.addEventListener('keydown', (e)=>{
    if (e.key !== 'Enter') return;
    const term = e.target.value.trim().toLowerCase();
    const match = products.find(p => String(p.barcode || '').toLowerCase() === term || String(p.sku || '').toLowerCase() === term);
    if (match) { addToCart(match.id); e.target.select(); }
  });
}
