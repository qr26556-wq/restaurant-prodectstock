// app.js (ES module) - renders sample products, search, filter, view toggle, theme toggle
const sampleProducts = [
  {id:1,name:'Tomatoes',category:'produce',unit:'kg',stock:12,min:5},
  {id:2,name:'Mozzarella',category:'dairy',unit:'kg',stock:2,min:5},
  {id:3,name:'Olive Oil',category:'pantry',unit:'ltr',stock:8,min:3},
  {id:4,name:'Basil',category:'produce',unit:'bunch',stock:0,min:2},
  {id:5,name:'Flour',category:'pantry',unit:'kg',stock:25,min:10}
];

const state = {
  products: sampleProducts,
  view: 'table'
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
  toggleThemeBtn: document.getElementById('toggle-theme')
};

function formatRow(p){
  return `
    <tr data-id="${p.id}">
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>${escapeHtml(p.unit)}</td>
      <td class="${p.stock <= p.min ? 'low' : 'ok'}">${p.stock}</td>
      <td>${p.min}</td>
      <td><button class="btn" data-action="edit" data-id="${p.id}">Edit</button></td>
    </tr>
  `;
}

function formatCard(p){
  return `
    <article class="card" data-id="${p.id}">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta">${escapeHtml(p.category)} • ${escapeHtml(p.unit)}</div>
      <p style="margin:.5rem 0"><strong class="${p.stock <= p.min ? 'low' : 'ok'}">${p.stock}</strong> in stock (min ${p.min})</p>
      <div style="display:flex;gap:.5rem">
        <button class="btn" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="btn" data-action="consume" data-id="${p.id}">Use</button>
      </div>
    </article>
  `;
}

function render(){
  const q = els.search.value.trim().toLowerCase();
  const cat = els.categoryFilter.value;
  const filtered = state.products.filter(p=>{
    if(cat && p.category !== cat) return false;
    if(!q) return true;
    return (p.name + ' ' + p.category).toLowerCase().includes(q);
  });

  els.productRows.innerHTML = filtered.map(formatRow).join('') || `<tr><td colspan="6" class="muted">No matching products</td></tr>`;
  els.cardGrid.innerHTML = filtered.map(formatCard).join('');
  els.totalProducts.textContent = state.products.length;
  els.lowStock.textContent = state.products.filter(p=>p.stock <= p.min).length;
}

function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

function onAction(e){
  const btn = e.target.closest('button');
  if(!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);
  if(action === 'edit'){ alert('Edit product id: ' + id); }
  if(action === 'consume'){
    const p = state.products.find(x=>x.id===id);
    if(p){ p.stock = Math.max(0, p.stock - 1); render(); }
  }
}

function setup(){
  render();
  els.search.addEventListener('input', debounce(render, 180));
  els.categoryFilter.addEventListener('change', render);
  els.viewMode.addEventListener('change', (e)=>{
    state.view = e.target.value;
    if(state.view === 'cards'){
      els.tableView.classList.add('hidden');
      els.cardView.classList.remove('hidden');
    } else {
      els.cardView.classList.add('hidden');
      els.tableView.classList.remove('hidden');
    }
  });
  document.getElementById('product-rows').addEventListener('click', onAction);
  els.cardGrid.addEventListener('click', onAction);
  els.year.textContent = new Date().getFullYear();

  // Theme toggle
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  if(stored === 'light') root.classList.add('light','theme-locked');
  els.toggleThemeBtn.addEventListener('click', ()=>{
    const isLight = root.classList.toggle('light');
    root.classList.add('theme-locked');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    els.toggleThemeBtn.setAttribute('aria-pressed', String(isLight));
  });
}

// Simple debounce
function debounce(fn, wait){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

setup();
