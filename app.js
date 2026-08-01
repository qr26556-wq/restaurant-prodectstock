// Modified app.js: load products from data/products.json and add simple incoming order support (localStorage + optional Firebase)

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

  // Theme toggle (unchanged)
  const root = document.documentElement; const stored = localStorage.getItem('theme'); if(stored === 'light') root.classList.add('light','theme-locked');
  els.toggleThemeBtn.addEventListener('click', ()=>{ const isLight = root.classList.toggle('light'); root.classList.add('theme-locked'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); els.toggleThemeBtn.setAttribute('aria-pressed', String(isLight)); });
}

// Simple incoming orders using localStorage (shop-scoped) and optional Firebase realtime
function readLocalOrders(){ const key = `customer_orders_${state.shopCode}`; try{ return JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){ return []; } }
function renderIncomingOrders(){ const list = readLocalOrders(); els.incomingList.innerHTML = list.reverse().map(o=>`<div style="padding:8px;border-bottom:1px dashed #ccc;color:#111;background:#fff;margin-bottom:6px;border-radius:6px;padding:10px;"><div><strong>${o.customer?.name||'Guest'}</strong> · ${new Date(o.time).toLocaleString()}</div><div style="font-size:13px;color:#333;margin-top:6px;">${o.lines.map(l=>l.qty+'× '+l.name).join(', ')}</div><div style="margin-top:8px;"><button class="btn" onclick="acceptOrder('${o.id}')">Accept</button> <button class="btn" onclick="sendToKitchen('${o.id}')">Send KOT</button></div></div>`).join('') || '<div class="muted">No orders yet</div>'; els.incomingCount.textContent = list.length; }

function pollIncomingOrders(){ renderIncomingOrders(); // try firebase too
  if(window.firebase && window.firebase.database){
    const ref = firebase.database().ref(`customer_orders/${state.shopCode}`);
    ref.off();
    ref.on('child_added', snap=>{ const order = snap.val(); // persist to local cache
      const key = `customer_orders_${state.shopCode}`; const arr = readLocalOrders(); arr.push(order); localStorage.setItem(key, JSON.stringify(arr)); renderIncomingOrders(); flash('New customer order');
    });
  }
  setTimeout(pollIncomingOrders, 5000);
}

function acceptOrder(id){ flash('Order '+id+' accepted'); }
function sendToKitchen(id){ flash('KOT created for '+id); }

let toastTimer;
function flash(msg){ const t = document.createElement('div'); t.textContent = msg; t.style.position='fixed'; t.style.bottom='18px'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.padding='10px 14px'; t.style.background='#111'; t.style.color='#fff'; t.style.borderRadius='8px'; document.body.appendChild(t); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.remove(),1800); }

// simple debounce
function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

setup();
