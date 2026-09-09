// Simple POS app (localStorage-based)
const PRODUCTS_KEY = 'pos_products_v1';
const CART_KEY = 'pos_cart_v1';
const ORDERS_KEY = 'pos_orders_v1';

function loadProducts() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveProducts(list) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
}
function loadCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function loadOrders() {
  return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
}
function saveOrders(list) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}

function renderProducts() {
  const list = loadProducts();
  const container = document.getElementById('productList');
  container.innerHTML = '';
  if (!list.length) { container.innerHTML = '<i>No products. Click "Load sample products."</i>'; return; }
  list.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'prod';
    div.innerHTML = `<div><strong>${p.name}</strong><br>₹${p.price.toFixed(2)}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Add';
    btn.onclick = ()=> addToCart(p.id);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

function renderCart() {
  const cart = loadCart();
  const products = loadProducts();
  const container = document.getElementById('cartList');
  container.innerHTML = '';
  let total = 0;
  for (const id in cart) {
    const qty = cart[id];
    const p = products.find(x=>x.id==id);
    if (!p) continue;
    const line = document.createElement('div');
    line.style.display='flex'; line.style.justifyContent='space-between'; line.style.marginBottom='6px';
    line.innerHTML = `<div>${p.name} x ${qty}</div><div>₹${(p.price*qty).toFixed(2)}</div>`;
    container.appendChild(line);
    total += p.price * qty;
  }
  document.getElementById('total').textContent = total.toFixed(2);
}

function addToCart(id) {
  const cart = loadCart();
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  renderCart();
}

function seedSampleProducts() {
  const sample = [
    { id: 'p1', name: 'Veg Burger', price: 79.00 },
    { id: 'p2', name: 'Paneer Wrap', price: 129.00 },
    { id: 'p3', name: 'Coffee', price: 49.00 },
    { id: 'p4', name: 'French Fries', price: 59.00 }
  ];
  saveProducts(sample);
  renderProducts();
  renderCart();
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  renderCart();
}

function payCart() {
  const cart = loadCart();
  if (Object.keys(cart).length===0) { alert('Cart is empty'); return; }
  const products = loadProducts();
  let total = 0;
  const items = [];
  for (const id in cart) {
    const p = products.find(x=>x.id==id);
    const qty = cart[id];
    items.push({ id, name: p.name, qty, price: p.price });
    total += p.price * qty;
  }
  const orders = loadOrders();
  const order = { id: 'o'+Date.now(), created: new Date().toISOString(), items, total };
  orders.push(order);
  saveOrders(orders);
  alert('Payment recorded. Total ₹' + total.toFixed(2));
  clearCart();
  renderOrders();
}

function renderOrders() {
  const orders = loadOrders();
  const el = document.getElementById('ordersList');
  if (!orders.length) { el.innerHTML = '<i>No orders yet.</i>'; return; }
  el.innerHTML = '';
  orders.slice().reverse().forEach(o=>{
    const div = document.createElement('div');
    div.className = 'order';
    div.innerHTML = `<div><strong>${o.id}</strong> — ${new Date(o.created).toLocaleString()}</div>
      <div>Total: ₹${o.total.toFixed(2)}</div>`;
    el.appendChild(div);
  });
}

// PWA install prompt handling
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.remove('hidden');
});
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('seed').addEventListener('click', seedSampleProducts);
  document.getElementById('clear').addEventListener('click', clearCart);
  document.getElementById('pay').addEventListener('click', payCart);

  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      installBtn.classList.add('hidden');
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }

  renderProducts();
  renderCart();
  renderOrders();
});
