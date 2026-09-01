let categories = [], products = [], tables = [];
let cart = [];
let activeCategory = 'all';
let orderType = 'dine-in';
let selectedTable = null;
let paymentMethod = 'cash';
let taxPercent = 5;
let searchTerm = '';
let currentUser = null;
let lastReceiptOrder = null;

RESTPOS.guard(['admin', 'cashier'], (user) => {
  currentUser = user;
  RESTPOS.renderNav('pos', user.role, user.name);
  boot();
});

function boot() {
  DB.getSettings().then(s => { taxPercent = s.taxPercent ?? 5; document.getElementById('taxPct').textContent = taxPercent; renderTotals(); });
  DB.listenCategories(list => { categories = list.filter(c => c.enabled !== false); renderCategoryTabs(); });
  DB.listenProducts(list => { products = list; renderProducts(); });
  DB.listenTables(list => { tables = list; renderTableGrid(); });

  document.getElementById('productSearch').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderProducts();
  });

  document.querySelectorAll('.order-type-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-type-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderType = btn.dataset.type;
      document.getElementById('tablePickRow').style.display = orderType === 'dine-in' ? 'flex' : 'none';
      document.getElementById('customerRow').style.display = orderType === 'delivery' ? 'grid' : 'none';
      if (orderType !== 'dine-in') selectedTable = null;
      updateChooseTableLabel();
    });
  });

  document.querySelectorAll('.pay-methods button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-methods button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paymentMethod = btn.dataset.pm;
    });
  });

  document.getElementById('chooseTableBtn').addEventListener('click', () => RESTPOS.openModal('tableModal'));
  document.getElementById('scanCodesBtn').addEventListener('click', openScanModal);
  document.getElementById('scanCloseBtn').addEventListener('click', closeScanModal);
  document.getElementById('scanCancelBtn').addEventListener('click', closeScanModal);
  document.getElementById('scanCaptureBtn').addEventListener('click', captureAndScan);
  document.getElementById('discountInput').addEventListener('input', renderTotals);
  document.getElementById('clearCartBtn').addEventListener('click', clearCart);
  document.getElementById('holdOrderBtn').addEventListener('click', () => submitOrder('held'));
  document.getElementById('completeOrderBtn').addEventListener('click', () => submitOrder('new'));
  document.getElementById('closeReceiptBtn').addEventListener('click', () => RESTPOS.closeModal('receiptModal'));
  document.getElementById('newOrderBtn').addEventListener('click', () => { RESTPOS.closeModal('receiptModal'); });
  document.getElementById('printReceiptBtn').addEventListener('click', () => {
    document.getElementById('printArea').className = document.getElementById('printWidth').value;
    window.print();
  });
  document.getElementById('pdfReceiptBtn').addEventListener('click', () => {
    if (!lastReceiptOrder) return;
    RESTPOS.receiptPDF(lastReceiptOrder, window.__settings || {}, 'receipt');
  });
}

/* ---------------- Categories & products ---------------- */
function renderCategoryTabs() {
  const host = document.getElementById('catTabs');
  const tabs = [{ id: 'all', name: 'All' }, ...categories];
  host.innerHTML = tabs.map(c =>
    `<button class="cat-tab ${activeCategory === c.id ? 'active' : ''}" data-id="${c.id}">${c.iconImage ? `<img src="${c.iconImage}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;vertical-align:-3px;margin-right:3px">` : (c.icon ? c.icon + ' ' : '')}${RESTPOS.escapeHtml(c.name)}</button>`
  ).join('');
  host.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.id;
      host.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
    });
  });
}

function renderProducts() {
  const host = document.getElementById('productGrid');
  let list = products.filter(p => p.available !== false);
  if (activeCategory !== 'all') list = list.filter(p => p.categoryId === activeCategory);
  if (searchTerm) list = list.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.sku || '').toLowerCase().includes(searchTerm));

  if (!list.length) {
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1">${RESTPOS.icon('box')}<p>No products found.</p></div>`;
    return;
  }
  host.innerHTML = list.map(p => {
    const out = (p.stock ?? 0) <= 0;
    const hasVariants = p.variants && p.variants.length;
    const priceLabel = hasVariants ? 'From ' + RESTPOS.money(Math.min(...p.variants.map(v => v.price))) : RESTPOS.money(p.price);
    return `
    <button class="product-card" data-id="${p.id}" ${out ? 'disabled' : ''}>
      <div class="thumb">${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : RESTPOS.escapeHtml(p.name.charAt(0))}</div>
      <div class="info">
        <div class="pname">${RESTPOS.escapeHtml(p.name)}</div>
        <div class="pprice">${priceLabel}</div>
        ${out ? '<div class="pstock">Out of stock</div>' : (p.stock <= (p.lowStockThreshold ?? 5) ? `<div class="pstock">${p.stock} left</div>` : '')}
      </div>
    </button>`;
  }).join('');
  host.querySelectorAll('.product-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = products.find(x => x.id === btn.dataset.id);
      if (p && p.variants && p.variants.length) openVariantPicker(p);
      else addToCart(btn.dataset.id);
    });
  });
}

/* ---------------- Size / variant picker ---------------- */
function openVariantPicker(product) {
  const existing = document.getElementById('variantPickModal');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'modal-backdrop open';
  div.id = 'variantPickModal';
  div.innerHTML = `
    <div class="modal" style="max-width:360px">
      <div class="modal-head"><h2>${RESTPOS.escapeHtml(product.name)} — size chunain</h2><button class="icon-btn" id="variantPickCloseBtn">✕</button></div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:8px">
        ${product.variants.map((v, i) => `<button class="btn" data-vi="${i}" style="justify-content:space-between; display:flex">
            <span>${RESTPOS.escapeHtml(v.name)}</span><span class="mono">${RESTPOS.money(v.price)}</span>
          </button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#variantPickCloseBtn').addEventListener('click', () => div.remove());
  div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });
  div.querySelectorAll('[data-vi]').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart(product.id, product.variants[Number(btn.dataset.vi)]);
      div.remove();
    });
  });
}

/* ---------------- Cart ---------------- */
function cartKeyFor(productId, variant) { return variant ? `${productId}::${variant.name}` : productId; }

function addToCart(productId, variant) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const cartKey = cartKeyFor(productId, variant);
  const totalInCart = cart.filter(i => i.productId === productId).reduce((s, i) => s + i.qty, 0);
  if (totalInCart + 1 > (p.stock ?? 0)) { RESTPOS.toast(`Only ${p.stock ?? 0} in stock`, 'error'); return; }
  const existing = cart.find(i => i.cartKey === cartKey);
  if (existing) existing.qty += 1;
  else cart.push({
    productId, cartKey,
    name: variant ? `${p.name} (${variant.name})` : p.name,
    price: variant ? variant.price : p.price,
    variantName: variant ? variant.name : null,
    qty: 1, note: '',
  });
  renderCart();
}
function changeQty(cartKey, delta) {
  const item = cart.find(i => i.cartKey === cartKey);
  if (!item) return;
  const p = products.find(x => x.id === item.productId);
  const next = item.qty + delta;
  const otherQty = cart.filter(i => i.productId === item.productId && i.cartKey !== cartKey).reduce((s, i) => s + i.qty, 0);
  if (next <= 0) { cart = cart.filter(i => i.cartKey !== cartKey); }
  else if (p && (otherQty + next) > (p.stock ?? 0)) { RESTPOS.toast(`Only ${p.stock ?? 0} in stock`, 'error'); return; }
  else item.qty = next;
  renderCart();
}
function removeItem(cartKey) { cart = cart.filter(i => i.cartKey !== cartKey); renderCart(); }
function clearCart() {
  cart = []; selectedTable = null; document.getElementById('discountInput').value = 0;
  updateChooseTableLabel(); renderCart();
}

function renderCart() {
  const host = document.getElementById('cartItems');
  if (!cart.length) {
    host.innerHTML = `<div class="cart-empty">Cart is empty.<br>Tap a product to add it.</div>`;
  } else {
    host.innerHTML = cart.map(i => `
      <div class="cart-item">
        <div class="cart-item-top">
          <span>${RESTPOS.escapeHtml(i.name)}</span>
          <span class="mono">${RESTPOS.money(i.price * i.qty)}</span>
        </div>
        <div class="qty-ctrl">
          <button data-id="${i.cartKey}" data-d="-1">−</button>
          <span class="qn">${i.qty}</span>
          <button data-id="${i.cartKey}" data-d="1">+</button>
          <button data-id="${i.cartKey}" data-remove title="Remove" style="margin-left:auto;color:var(--alert);border-color:var(--alert-soft)">✕</button>
        </div>
      </div>`).join('');
    host.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.id, Number(b.dataset.d))));
    host.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeItem(b.dataset.id)));
  }
  renderTotals();
}

function computeTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.min(Number(document.getElementById('discountInput').value) || 0, subtotal);
  const taxable = subtotal - discount;
  const tax = taxable * (taxPercent / 100);
  const total = taxable + tax;
  return { subtotal, discount, tax, total };
}
function renderTotals() {
  const { subtotal, tax, total } = computeTotals();
  document.getElementById('subtotalVal').textContent = RESTPOS.money(subtotal);
  document.getElementById('taxVal').textContent = RESTPOS.money(tax);
  document.getElementById('grandVal').textContent = RESTPOS.money(total);
}

/* ---------------- Tables ---------------- */
function renderTableGrid() {
  const host = document.getElementById('tableGrid');
  if (!tables.length) { host.innerHTML = `<p class="hint">No tables set up yet. An admin can seed sample data from the dashboard, or add tables later in Settings.</p>`; return; }
  host.innerHTML = tables.map(t => `
    <button class="table-chip ${t.status} ${selectedTable?.id === t.id ? 'selected' : ''}" data-id="${t.id}" data-name="${RESTPOS.escapeHtml(t.name)}" ${t.status === 'occupied' && selectedTable?.id !== t.id ? 'disabled' : ''}>
      <span>${RESTPOS.escapeHtml(t.name)}</span>
      <span class="seats">${t.seats || ''} seats</span>
    </button>`).join('');
  host.querySelectorAll('.table-chip:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTable = { id: btn.dataset.id, name: btn.dataset.name };
      updateChooseTableLabel();
      RESTPOS.closeModal('tableModal');
      renderTableGrid();
    });
  });
}
function updateChooseTableLabel() {
  document.getElementById('chooseTableBtn').textContent = selectedTable ? `Table: ${selectedTable.name} ✓` : 'Choose table';
}

/* ---------------- Checkout ---------------- */
async function submitOrder(status) {
  if (!cart.length) { RESTPOS.toast('Cart is empty', 'error'); return; }
  if (orderType === 'dine-in' && !selectedTable) { RESTPOS.toast('Please choose a table for dine-in orders', 'error'); return; }

  const { subtotal, discount, tax, total } = computeTotals();
  const order = {
    orderNumber: RESTPOS.genOrderNumber(),
    type: orderType,
    tableId: orderType === 'dine-in' ? selectedTable.id : null,
    tableName: orderType === 'dine-in' ? selectedTable.name : null,
    customer: {
      name: document.getElementById('custName')?.value || '',
      phone: document.getElementById('custPhone')?.value || '',
    },
    items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, note: i.note || '', variantName: i.variantName || null })),
    subtotal, discount, tax, total,
    paymentMethod, status,
    cashierId: currentUser.uid, cashierName: currentUser.name,
  };

  const btn = status === 'held' ? document.getElementById('holdOrderBtn') : document.getElementById('completeOrderBtn');
  btn.disabled = true;
  try {
    await DB.createOrder(order);
    RESTPOS.toast(status === 'held' ? 'Order held' : 'Order completed & sent to kitchen', 'success');
    if (status !== 'held') showReceipt(order);
    clearCart();
  } catch (err) {
    console.error(err);
    RESTPOS.toast(err.message || 'Could not save order', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ---------------- Camera multi-code scan ---------------- */
let scanStream = null;
let scanBusy = false;

async function openScanModal() {
  RESTPOS.openModal('scanModal');
  document.getElementById('scanStatus').textContent = '';
  document.getElementById('scanResultsList').innerHTML = '';
  const video = document.getElementById('scanVideo');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = scanStream;
    await video.play();
  } catch (err) {
    console.error(err);
    document.getElementById('scanStatus').textContent = 'Camera khul nahi saka. Browser permission check karain (Settings > Site permissions > Camera allow karain).';
    RESTPOS.toast('Camera access nahi mila', 'error');
  }
}

function closeScanModal() {
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  RESTPOS.closeModal('scanModal');
}

async function captureAndScan() {
  if (scanBusy) return;
  const video = document.getElementById('scanVideo');
  if (!scanStream || !video.videoWidth) { RESTPOS.toast('Camera abhi ready nahi hai', 'error'); return; }

  scanBusy = true;
  const statusEl = document.getElementById('scanStatus');
  const listEl = document.getElementById('scanResultsList');
  const btn = document.getElementById('scanCaptureBtn');
  btn.disabled = true;
  statusEl.textContent = 'Scan ho raha hai…';
  listEl.innerHTML = '';

  try {
    const canvas = document.getElementById('scanCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!('BarcodeDetector' in window)) {
      statusEl.innerHTML = 'Yeh browser ek saath multiple code scan support nahi karta.<br>Chrome (Android/Desktop) use karain, ya neeche code number type karke product add karain:';
      renderManualCodeEntry(listEl);
      return;
    }

    const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => null);
    const detector = new window.BarcodeDetector(formats ? { formats } : undefined);
    const detections = await detector.detect(canvas);

    if (!detections.length) {
      statusEl.textContent = 'Koi bhi code nahi mila. Camera thora paas/saaf rakh kar dobara try karain.';
      renderManualCodeEntry(listEl);
      return;
    }

    let addedCount = 0, addedQty = 0;
    const notFound = [];
    const foundSummary = {};

    detections.forEach(d => {
      const code = (d.rawValue || '').trim();
      if (!code) return;
      const product = products.find(p => (p.sku || '').trim().toLowerCase() === code.toLowerCase());
      if (product) {
        if (product.available === false) { notFound.push(`${code} (available nahi)`); return; }
        const existing = cart.find(i => i.productId === product.id);
        const inCart = existing ? existing.qty : 0;
        if (inCart + 1 > (product.stock ?? 0)) {
          notFound.push(`${product.name} — stock khatam`);
          return;
        }
        addToCart(product.id);
        addedCount++;
        addedQty++;
        foundSummary[product.name] = (foundSummary[product.name] || 0) + 1;
      } else {
        notFound.push(code);
      }
    });

    statusEl.textContent = addedQty
      ? `${addedQty} item cart mein add ho gaye.`
      : 'Frame mein codes mile lekin koi bhi product match nahi hua.';

    listEl.innerHTML = [
      ...Object.entries(foundSummary).map(([name, qty]) =>
        `<div class="receipt-line" style="color:var(--success,#1a7a3c)"><span class="rl-name">✔ ${RESTPOS.escapeHtml(name)}</span><span class="rl-fill"></span><span class="rl-val">x${qty}</span></div>`),
      ...notFound.map(code =>
        `<div class="receipt-line" style="color:var(--alert)"><span class="rl-name">✕ ${RESTPOS.escapeHtml(String(code))}</span><span class="rl-fill"></span><span class="rl-val">not found</span></div>`),
    ].join('') || '<p class="hint">Kuch nahi mila.</p>';

    if (addedQty) RESTPOS.toast(`${addedQty} item scan se add hue`, 'success');
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Scan mein masla aaya, dobara try karain.';
    RESTPOS.toast('Scan fail ho gaya', 'error');
  } finally {
    btn.disabled = false;
    scanBusy = false;
  }
}

function renderManualCodeEntry(listEl) {
  listEl.innerHTML = `
    <div style="display:flex; gap:8px">
      <input id="manualCodeInput" placeholder="Product code / SKU type karain" style="flex:1; padding:8px; border-radius:7px; border:1px solid var(--line)">
      <button class="btn btn-primary" id="manualCodeAddBtn">Add</button>
    </div>
    <div id="manualCodeLog" style="margin-top:8px; display:flex; flex-direction:column; gap:6px"></div>`;
  const input = document.getElementById('manualCodeInput');
  const log = document.getElementById('manualCodeLog');
  const addByCode = () => {
    const code = input.value.trim();
    if (!code) return;
    const product = products.find(p => (p.sku || '').trim().toLowerCase() === code.toLowerCase());
    if (product) {
      addToCart(product.id);
      log.insertAdjacentHTML('afterbegin', `<div class="receipt-line" style="color:var(--success,#1a7a3c)"><span class="rl-name">✔ ${RESTPOS.escapeHtml(product.name)}</span><span class="rl-fill"></span><span class="rl-val">added</span></div>`);
    } else {
      log.insertAdjacentHTML('afterbegin', `<div class="receipt-line" style="color:var(--alert)"><span class="rl-name">✕ ${RESTPOS.escapeHtml(code)}</span><span class="rl-fill"></span><span class="rl-val">not found</span></div>`);
    }
    input.value = '';
    input.focus();
  };
  document.getElementById('manualCodeAddBtn').addEventListener('click', addByCode);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addByCode(); });
  input.focus();
}

function showReceipt(order) {
  lastReceiptOrder = order;
  const s = window.__settings || {};
  const lines = order.items.map(i => `
    <div class="receipt-line"><span class="rl-name">${RESTPOS.escapeHtml(i.name)} x${i.qty}</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(i.price * i.qty)}</span></div>
  `).join('');
  document.getElementById('receiptContent').innerHTML = `
    <div class="rp-center"><strong>${RESTPOS.escapeHtml(s.restaurantName || 'RESTPOS Kitchen')}</strong><br>
    ${s.address ? RESTPOS.escapeHtml(s.address) + '<br>' : ''}${s.phone ? RESTPOS.escapeHtml(s.phone) : ''}</div>
    <hr>
    Order #${order.orderNumber}<br>
    ${new Date().toLocaleString()}<br>
    Cashier: ${RESTPOS.escapeHtml(order.cashierName)}<br>
    ${order.type}${order.tableName ? ' · ' + order.tableName : ''}
    <hr>
    ${lines}
    <hr>
    <div class="receipt-line"><span class="rl-name">Subtotal</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(order.subtotal)}</span></div>
    <div class="receipt-line"><span class="rl-name">Discount</span><span class="rl-fill"></span><span class="rl-val">-${RESTPOS.money(order.discount)}</span></div>
    <div class="receipt-line"><span class="rl-name">Tax</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(order.tax)}</span></div>
    <div class="receipt-line" style="font-weight:700"><span class="rl-name">Total</span><span class="rl-fill"></span><span class="rl-val">${RESTPOS.money(order.total)}</span></div>
    <hr>
    Paid via ${order.paymentMethod}
    <div class="rp-center" style="margin-top:8px">Thank you — visit again!</div>
  `;
  RESTPOS.openModal('receiptModal');
}
