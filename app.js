// Modified app.js with owner actions to update order status and KOT handling

const state = {
  products: [],
  view: 'table',
  shopCode: (new URLSearchParams(location.search)).get('shop') || 'local_shop_default'
};

const els = {
  productRows: document.getElementById('product-rows'),
  cardGrid: document.getElementById('card-grid'),
  search: document.getElementById('search'),
  categoryFilter: document.getElementById('category-filter'),
  viewMode: document.getElementById('view-mode'),
  tableView: document.getElementById('table-view'),
  cardView: document.getElementById('card-view'),
  totalProducts: document.getElementById('total-products'),
  lowStock: document.getElementById('low-stock'),
  year: document.getElementById('year'),
  toggleThemeBtn: document.getElementById('toggle-theme'),
  incomingBtn: document.getElementById('incomingOrdersBtn'),
  incomingCount: document.getElementById('incomingCount'),
  incomingList: document.getElementById('incomingList')
};

function fmtRow(p){
  return `
    <tr data-id="${p.id}">
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category||'')}</td>
      <td>${escapeHtml(p.unit||'')}</td>
      <td class="${p.stock <= p.min ? 'low' : 'ok'}">${p.stock}</td>
      <td>${p.min}</td>
      <td><button class="btn" data-action="edit" data-id="${p.id}">Edit</button></td>
    </tr>
  `;
}
function fmtCard(p){
  return `
    <article class="card" data-id="${p.id}">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta">${escapeHtml(p.category||'')} • ${escapeHtml(p.unit||'')}</div>
      <p style="margin:.5rem 0"><strong class="${p.stock <= p.min ? 'low' : 'ok'}">${p.stock}</strong> in stock (min ${p.min})</p>
      <div style="display:flex;gap:.5rem">
        <button class="btn" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="btn" data-action="consume" data-id="${p.id}">Use</button>
      </div>
    </article>
  `;
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

/* ===== Firebase helper: dynamic SDK load + init (reuse existing) ===== */
let fbReady = false;
let fbInitPromise = null;
async function loadScriptOnce(src){
  if(document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
}

async function initFirebase(){
  if(fbReady) return true;
  if(fbInitPromise) return fbInitPromise;
  const cfg = window.FIREBASE_CONFIG || window.firebaseConfig || null;
  if(!cfg || !cfg.apiKey){ return Promise.resolve(false); }
  fbInitPromise = (async ()=>{
    try{
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
      if(!window.firebase.apps || !window.firebase.apps.length) firebase.initializeApp(cfg);
      fbReady = true;
      return true;
    }catch(e){ fbInitPromise = null; return false; }
  })();
  return fbInitPromise;
}

async function ownerSignIn(){
  const ok = await initFirebase();
  if(!ok){ flash('Firebase not configured — cannot sign in'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then(async res=>{
    const user = res.user;
    const shop = state.shopCode;
    try{
      await firebase.database().ref('shops/' + shop).update({ ownerUid: user.uid, shopName: document.title || shop, updatedAt: Date.now() });
      flash('Signed in as ' + (user.displayName || user.email || 'owner'));
      pollIncomingOrders();
    }catch(e){ console.warn('Could not write shop mapping', e); flash('Signed in but could not register shop mapping'); }
  }).catch(err=>{ console.warn(err); flash('Sign-in failed'); });
}

/* ===== Products load & render ===== */
async function loadProducts(){
  try{
    const r = await fetch('/data/products.json');
    const json = await r.json();
    state.products = json;
  }catch(e){
    state.products = [ {id:1,name:'Tomatoes',category:'produce',unit:'kg',stock:12,min:5} ];
  }
}

function render(){
  const q = els.search.value?.trim().toLowerCase() || '';
  const cat = els.categoryFilter.value;
  const filtered = state.products.filter(p=>{
    if(cat && p.category !== cat) return false;
    if(!q) return true;
    return (p.name + ' ' + (p.category||'')).toLowerCase().includes(q);
  });
  els.productRows.innerHTML = filtered.map(fmtRow).join('') || `<tr><td colspan="6" class="muted">No matching products</td></tr>`;
  els.cardGrid.innerHTML = filtered.map(fmtCard).join('');
  els.totalProducts.textContent = state.products.length;
  els.lowStock.textContent = state.products.filter(p=>p.stock <= p.min).length;
}

function onAction(e){
  const btn = e.target.closest('button'); if(!btn) return;
  const action = btn.dataset.action; const id = Number(btn.dataset.id);
  if(action==='edit'){ alert('Edit product id: '+id); }
  if(action==='consume'){ const p = state.products.find(x=>x.id===id); if(p){ p.stock = Math.max(0,p.stock-1); render(); }}
}

function setup(){
  loadProducts().then(()=>{ render(); });
  els.search.addEventListener('input', debounce(render, 180));
  els.categoryFilter.addEventListener('change', render);
  els.viewMode.addEventListener('change', (e)=>{ state.view = e.target.value; if(state.view==='cards'){ els.tableView.classList.add('hidden'); els.cardView.classList.remove('hidden'); } else { els.cardView.classList.add('hidden'); els.tableView.classList.remove('hidden'); } });
  document.getElementById('product-rows').addEventListener('click', onAction);
  els.cardGrid.addEventListener('click', onAction);
  els.year.textContent = new Date().getFullYear();

  // incoming orders
  els.incomingBtn.addEventListener('click', ()=>{ document.getElementById('ordersOverlay').style.display='block'; renderIncomingOrders(); });
  pollIncomingOrders();

  // Sign-in
  const signBtn = document.getElementById('signInBtn'); if(signBtn) signBtn.addEventListener('click', ownerSignIn);

  // Theme toggle
  const root = document.documentElement; const stored = localStorage.getItem('theme'); if(stored === 'light') root.classList.add('light','theme-locked');
  els.toggleThemeBtn.addEventListener('click', ()=>{ const isLight = root.classList.toggle('light'); root.classList.add('theme-locked'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); els.toggleThemeBtn.setAttribute('aria-pressed', String(isLight)); });
}

/* ===== Incoming orders handling ===== */
function readLocalOrders(){ const key = `customer_orders_${state.shopCode}`; try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){ return []; } }

function saveLocalOrders(arr){ const key = `customer_orders_${state.shopCode}`; localStorage.setItem(key, JSON.stringify(arr)); }

function findLocalOrder(id){ return readLocalOrders().find(o=>o.id===id); }

function renderIncomingOrders(){ const list = readLocalOrders();
  els.incomingList.innerHTML = list.slice().reverse().map(o=>{
    const status = o.status || 'new';
    const statusLabel = `<div style="font-size:12px;margin-top:6px;color:#064e3b;font-weight:600">Status: ${escapeHtml(status)}</div>`;
    let actions = '';
    // Owner-only actions: Accept -> In Progress -> Ready, Reject
    if(status === 'new') actions = `<button class="btn" onclick="acceptOrder('${o.id}')">Accept</button> <button class="btn" onclick="rejectOrder('${o.id}')">Reject</button>`;
    else if(status === 'accepted') actions = `<button class="btn" onclick="startOrder('${o.id}')">Start</button> <button class="btn" onclick="rejectOrder('${o.id}')">Reject</button>`;
    else if(status === 'in_progress') actions = `<button class="btn" onclick="completeOrder('${o.id}')">Mark Ready</button>`;
    else if(status === 'ready') actions = `<span style="font-weight:700;color:#065f46">Ready for pickup</span>`;

    return `<div style="padding:8px;border-bottom:1px dashed #ccc;color:#111;background:#fff;margin-bottom:6px;border-radius:6px;padding:10px;">
      <div><strong>${escapeHtml(o.customer?.name||'Guest')}</strong> · ${new Date(o.time).toLocaleString()}</div>
      <div style="font-size:13px;color:#333;margin-top:6px;">${o.lines.map(l=>l.qty+'× '+escapeHtml(l.name)).join(', ')}</div>
      ${statusLabel}
      <div style="margin-top:8px;">${actions} <button class="btn" onclick="sendToKitchen('${o.id}')">Send KOT</button></div>
    </div>`;
  }).join('') || '<div class="muted">No orders yet</div>';
  els.incomingCount.textContent = list.length; }

// Poll incoming orders and attach firebase listeners when available
async function pollIncomingOrders(){
  renderIncomingOrders();
  const fbOk = await initFirebase();
  if(fbOk){
    try{
      const ref = firebase.database().ref(`customer_orders/${state.shopCode}`);
      ref.off();
      ref.on('child_added', snap=>{ const order = snap.val(); const key = `customer_orders_${state.shopCode}`; const arr = readLocalOrders(); arr.push(order); saveLocalOrders(arr); renderIncomingOrders(); flash('New customer order'); });
      ref.on('child_changed', snap=>{ const order = snap.val(); const arr = readLocalOrders(); const idx = arr.findIndex(o=>o.id===order.id); if(idx>-1) { arr[idx]=order; saveLocalOrders(arr); renderIncomingOrders(); flash('Order updated: '+order.status); } });
    }catch(e){ console.warn('Firebase listener error', e); }
  }
  setTimeout(pollIncomingOrders, 5000);
}

/* ===== Owner actions that change order status ===== */
async function updateOrderStatus(orderId, newStatus, extras){
  // Update local cache
  const arr = readLocalOrders(); const idx = arr.findIndex(o=>o.id===orderId);
  if(idx>-1){ arr[idx].status = newStatus; if(extras) Object.assign(arr[idx], extras); saveLocalOrders(arr); renderIncomingOrders(); }
  // Try to update in Firebase if available
  const fbOk = await initFirebase();
  if(fbOk){
    try{
      const ref = firebase.database().ref(`customer_orders/${state.shopCode}/${orderId}`);
      await ref.update(Object.assign({status:newStatus}, extras||{}));
      // also write a notification for owner
      await firebase.database().ref(`shops/${state.shopCode}/notifications`).push({ orderId, time: Date.now(), type:'status_update', status:newStatus });
    }catch(e){ console.warn('Could not update order in Firebase', e); flash('Could not update live — action saved locally'); }
  }
}

window.acceptOrder = function(id){ updateOrderStatus(id, 'accepted'); flash('Order accepted'); };
window.startOrder = function(id){ updateOrderStatus(id, 'in_progress'); flash('Order started'); };
window.completeOrder = function(id){ updateOrderStatus(id, 'ready'); flash('Order marked ready'); };
window.rejectOrder = function(id){ updateOrderStatus(id, 'rejected', { rejectedReason: 'rejected_by_shop' }); flash('Order rejected'); };

// Send to kitchen: create a KOT entry under shops/{shopCode}/kots and mark order as in_progress if not already
async function sendToKitchen(orderId){
  const order = findLocalOrder(orderId);
  if(!order){ flash('Order not found'); return; }
  // Create KOT locally
  const kotKey = `kots_${state.shopCode}`;
  const kots = JSON.parse(localStorage.getItem(kotKey)||'[]');
  kots.push({ id: 'KOT-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), orderId, lines: order.lines, time: Date.now(), table: order.table || null });
  localStorage.setItem(kotKey, JSON.stringify(kots));
  // Try write to Firebase
  const fbOk = await initFirebase();
  if(fbOk){
    try{
      const ref = firebase.database().ref(`shops/${state.shopCode}/kots`).push();
      await ref.set({ orderId: order.id, lines: order.lines, time: Date.now(), table: order.table || null });
      // optionally mark order in_progress
      await firebase.database().ref(`customer_orders/${state.shopCode}/${order.id}`).update({ status: 'in_progress' });
      flash('Sent to kitchen');
      renderIncomingOrders();
      return;
    }catch(e){ console.warn('Could not write KOT to Firebase', e); }
  }
  flash('KOT saved locally');
}

/* ===== Utilities ===== */
let toastTimer;
function flash(msg){ const t = document.createElement('div'); t.textContent = msg; t.style.position='fixed'; t.style.bottom='18px'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.padding='10px 14px'; t.style.background='#111'; t.style.color='#fff'; t.style.borderRadius='8px'; document.body.appendChild(t); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.remove(),1800); }
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

setup();
