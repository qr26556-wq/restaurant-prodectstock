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
    return `
    <button class="product-card" data-id="${p.id}" ${out ? 'disabled' : ''}>
      <div class="thumb">${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : RESTPOS.escapeHtml(p.name.charAt(0))}</div>
      <div class="info">
        <div class="pname">${RESTPOS.escapeHtml(p.name)}</div>
        <div class="pprice">${RESTPOS.money(p.price)}</div>
        ${out ? '<div class="pstock">Out of stock</div>' : (p.stock <= (p.lowStockThreshold ?? 5) ? `<div class="pstock">${p.stock} left</div>` : '')}
      </div>
    </button>`;
  }).join('');
  host.querySelectorAll('.product-card').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

/* ---------------- Cart ---------------- */
function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(i => i.productId === productId);
  const inCart = existing ? existing.qty : 0;
  if (inCart + 1 > (p.stock ?? 0)) { RESTPOS.toast(`Only ${p.stock ?? 0} in stock`, 'error'); return; }
  if (existing) existing.qty += 1;
  else cart.push({ productId, name: p.name, price: p.price, qty: 1, note: '' });
  renderCart();
}
function changeQty(productId, delta) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  const p = products.find(x => x.id === productId);
  const next = item.qty + delta;
  if (next <= 0) { cart = cart.filter(i => i.productId !== productId); }
  else if (p && next > (p.stock ?? 0)) { RESTPOS.toast(`Only ${p.stock ?? 0} in stock`, 'error'); return; }
  else item.qty = next;
  renderCart();
}
function removeItem(productId) { cart = cart.filter(i => i.productId !== productId); renderCart(); }
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
          <button data-id="${i.productId}" data-d="-1">−</button>
          <span class="qn">${i.qty}</span>
          <button data-id="${i.productId}" data-d="1">+</button>
          <button data-id="${i.productId}" data-remove title="Remove" style="margin-left:auto;color:var(--alert);border-color:var(--alert-soft)">✕</button>
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
    items: cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, note: i.note || '' })),
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
