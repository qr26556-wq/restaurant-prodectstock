// public/order.js — lightweight ordering client with optional Firebase support
const SHOP_PARAM = new URLSearchParams(location.search).get('shop') || 'local_shop_default';
const TABLE_PARAM = new URLSearchParams(location.search).get('table') || null;
const MENU_URL = '/data/products.json';
let MENU = [];

function fmtCurrency(n){ return '$' + n.toFixed(2); }

async function loadMenu(){
  try{
    const r = await fetch(MENU_URL);
    MENU = await r.json();
  }catch(e){
    MENU = [{id:1,name:'Tomatoes',price:2.5},{id:2,name:'Mozzarella',price:4.25},{id:3,name:'Olive Oil',price:8.0}];
  }
}

function renderMenu(){
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = MENU.map(item=>`
    <div class="menu-card" data-id="${item.id}">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="meta">${item.category||''} • ${item.unit||''}</div>
      <div class="row"><div><strong>${fmtCurrency(item.price||0)}</strong></div><button class="btn" data-add="${item.id}">Add</button></div>
    </div>
  `).join('');
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

let CART = {};
function addToCart(id){ CART[id] = (CART[id]||0)+1; renderCart(); }
function removeFromCart(id){ delete CART[id]; renderCart(); }
function renderCart(){
  const list = document.getElementById('cartList');
  const lines = Object.entries(CART).map(([id,qty])=>{ const it = MENU.find(m=>m.id==id); return {id,qty,name:it.name,price:it.price}; });
  list.innerHTML = lines.map(l=>`<div class="cart-row"><div>${escapeHtml(l.name)} × ${l.qty}</div><div>${fmtCurrency(l.price*l.qty)} <button class="btn" data-rem="${l.id}">✕</button></div></div>`).join('') || '<div class="muted">Cart is empty</div>';
  const total = lines.reduce((s,l)=>s+l.price*l.qty,0);
  document.getElementById('cartTotal').textContent = fmtCurrency(total);
}

function bind(){
  document.getElementById('menuGrid').addEventListener('click', e=>{
    const id = e.target.closest('[data-add]')?.getAttribute('data-add');
    if(id) addToCart(Number(id));
    const rid = e.target.closest('[data-rem]')?.getAttribute('data-rem');
    if(rid) removeFromCart(Number(rid));
  });
  document.getElementById('placeOrder').addEventListener('click', placeOrder);
}

function makeOrderObject(){
  const lines = Object.entries(CART).map(([id,qty])=>{ const it = MENU.find(m=>m.id==id); return {id:Number(id), name:it.name, qty, price:it.price}; });
  const subtotal = lines.reduce((s,l)=>s+l.price*l.qty,0);
  const order = {
    id: 'C-' + Date.now() + '-' + Math.random().toString(36).slice(2,8),
    shop: SHOP_PARAM,
    table: TABLE_PARAM,
    time: Date.now(),
    status: 'new',
    customer: { name: document.getElementById('custName').value.trim(), phone: document.getElementById('custPhone').value.trim(), address: document.getElementById('custAddr').value.trim() },
    lines,
    subtotal,
    total: subtotal
  };
  return order;
}

async function placeOrder(){
  if(Object.keys(CART).length===0){ showStatus('Add items to your order first'); return; }
  const order = makeOrderObject();
  // Basic validation
  if(!order.customer.name || !order.customer.phone){ showStatus('Please enter your name and phone'); return; }

  // Save to localStorage (shop-scoped)
  const key = `customer_orders_${order.shop}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push(order);
  localStorage.setItem(key, JSON.stringify(existing));

  // Attempt Firebase write if available
  if(window.firebase && window.firebase.database){
    try{
      const ref = firebase.database().ref(`customer_orders/${order.shop}/${order.id}`);
      await ref.set(order);
    }catch(e){ console.warn('Firebase write failed', e); }
  }

  // Clear cart and show confirmation
  CART = {};
  renderCart();
  showStatus('Order placed — thank you! Your order id: ' + order.id);
}

function showStatus(msg){ const el = document.getElementById('orderStatus'); el.textContent = msg; setTimeout(()=>el.textContent='',(msg.length>0?6000:0)); }

async function init(){
  await loadMenu();
  document.getElementById('shopName').textContent = decodeURIComponent(SHOP_PARAM.replace(/_/g,' '));
  if(TABLE_PARAM) document.getElementById('orderMeta').textContent = 'Table ' + TABLE_PARAM;
  renderMenu(); renderCart(); bind();
}

init();
