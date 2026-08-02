let categories = [], products = [];
let search = '', catFilter = 'all', stockFilter = 'all';

RESTPOS.guard(['admin'], (user) => {
  RESTPOS.renderNav('products', 'admin', user.name);
  boot();
});

function boot() {
  DB.listenCategories(list => { categories = list; renderCategorySelects(); renderCategoryManager(); });
  DB.listenProducts(list => { products = list; renderTable(); });

  document.getElementById('searchInput').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.getElementById('categoryFilter').addEventListener('change', e => { catFilter = e.target.value; renderTable(); });
  document.getElementById('stockFilter').addEventListener('change', e => { stockFilter = e.target.value; renderTable(); });

  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('manageCatsBtn').addEventListener('click', () => RESTPOS.openModal('catModal'));

  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
  document.getElementById('deleteProductBtn').addEventListener('click', deleteProduct);
  document.getElementById('catForm').addEventListener('submit', addCategory);
  document.getElementById('catImageInput').addEventListener('change', onCatImagePicked);
}

let pendingCatImage = null; // base64 data URI, set after the picked file is resized

function onCatImagePicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Resize down to a small square thumbnail so it stores cheaply and
      // safely inside the category document (no external image host needed).
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      pendingCatImage = canvas.toDataURL('image/jpeg', 0.72);
      document.getElementById('catImagePreview').innerHTML = `<img src="${pendingCatImage}" style="width:100%; height:100%; object-fit:cover">`;
    };
    img.onerror = () => RESTPOS.toast('Could not read that image — try a different file.', 'error');
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------------- Categories ---------------- */
function renderCategorySelects() {
  const filterSel = document.getElementById('categoryFilter');
  const formSel = document.getElementById('pCategory');
  const opts = categories.map(c => `<option value="${c.id}">${c.icon ? c.icon + ' ' : ''}${RESTPOS.escapeHtml(c.name)}</option>`).join('');
  filterSel.innerHTML = `<option value="all">All categories</option>${opts}`;
  formSel.innerHTML = opts || '<option value="">Add a category first</option>';
}

function catIconHtml(c, size = 22) {
  if (c.iconImage) return `<img src="${c.iconImage}" style="width:${size}px; height:${size}px; border-radius:5px; object-fit:cover; vertical-align:-5px; margin-right:2px">`;
  return `${c.icon || '🍽️'} `;
}

function renderCategoryManager() {
  const host = document.getElementById('catList');
  if (!categories.length) { host.innerHTML = `<p class="hint">No categories yet — add one above.</p>`; return; }
  host.innerHTML = categories.map(c => `
    <div class="receipt-line">
      <span class="rl-name">${catIconHtml(c, 24)}${RESTPOS.escapeHtml(c.name)} ${c.enabled === false ? '<span class="badge badge-alert">Disabled</span>' : ''}</span>
      <span class="rl-fill"></span>
      <button class="btn btn-sm" data-toggle="${c.id}" data-enabled="${c.enabled !== false}">${c.enabled === false ? 'Enable' : 'Disable'}</button>
      <button class="btn btn-sm btn-danger" data-del="${c.id}">Delete</button>
    </div>`).join('');
  host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    DB.updateCategory(b.dataset.toggle, { enabled: b.dataset.enabled !== 'true' });
  }));
  host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const used = products.some(p => p.categoryId === b.dataset.del);
    if (used) { RESTPOS.toast('This category has products in it — reassign them first.', 'error'); return; }
    if (confirm('Delete this category?')) DB.deleteCategory(b.dataset.del);
  }));
}

function addCategory(e) {
  e.preventDefault();
  const name = document.getElementById('catName').value.trim();
  if (!name) return;
  const btn = document.getElementById('addCatBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  const payload = { name };
  if (pendingCatImage) payload.iconImage = pendingCatImage;
  else payload.icon = '🍽️';
  DB.addCategory(payload).then(() => {
    document.getElementById('catForm').reset();
    document.getElementById('catImagePreview').innerHTML = '🍕';
    pendingCatImage = null;
    RESTPOS.toast('Category added', 'success');
  }).catch(err => {
    console.error(err);
    RESTPOS.toast('Could not add category: ' + err.message, 'error');
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = 'Add';
  });
}

/* ---------------- Products table ---------------- */
function renderTable() {
  let list = [...products];
  if (search) list = list.filter(p => p.name.toLowerCase().includes(search) || (p.sku || '').toLowerCase().includes(search));
  if (catFilter !== 'all') list = list.filter(p => p.categoryId === catFilter);
  if (stockFilter === 'low') list = list.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.lowStockThreshold ?? 5));
  if (stockFilter === 'out') list = list.filter(p => (p.stock ?? 0) <= 0);

  const tbody = document.querySelector('#productsTable tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="hint" style="padding:16px 10px">No products match.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const low = (p.stock ?? 0) <= (p.lowStockThreshold ?? 5);
    const cat = categories.find(c => c.id === p.categoryId);
    return `
    <tr>
      <td><div class="thumb" style="width:40px;height:40px;border-radius:8px;background:var(--paper-dim);display:flex;align-items:center;justify-content:center;overflow:hidden;font-weight:700">${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover">` : p.name.charAt(0)}</div></td>
      <td><strong>${RESTPOS.escapeHtml(p.name)}</strong></td>
      <td>${cat ? RESTPOS.escapeHtml(cat.name) : '<span class="hint">—</span>'}</td>
      <td class="mono">${RESTPOS.escapeHtml(p.sku || '—')}</td>
      <td class="mono">${RESTPOS.money(p.price)}</td>
      <td class="mono">${RESTPOS.money(p.costPrice || 0)}</td>
      <td class="${low ? 'low-stock' : ''}">${p.stock ?? 0}</td>
      <td><span class="avail-chip ${p.available !== false ? 'on' : 'off'}"></span></td>
      <td class="row-actions">
        <button class="btn btn-sm btn-icon" data-edit="${p.id}">${RESTPOS.icon('edit')}</button>
      </td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
}

/* ---------------- Product form ---------------- */
function openProductModal(id) {
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('pId').value = id || '';
  document.getElementById('deleteProductBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('productModalTitle').textContent = id ? 'Edit product' : 'Add product';

  if (id) {
    const p = products.find(x => x.id === id);
    document.getElementById('pName').value = p.name;
    document.getElementById('pCategory').value = p.categoryId || '';
    document.getElementById('pSku').value = p.sku || '';
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pCost').value = p.costPrice || 0;
    document.getElementById('pStock').value = p.stock || 0;
    document.getElementById('pLowStock').value = p.lowStockThreshold ?? 5;
    document.getElementById('pImage').value = p.imageUrl || '';
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pAvailable').checked = p.available !== false;
  } else {
    document.getElementById('pLowStock').value = 5;
    document.getElementById('pAvailable').checked = true;
  }
  RESTPOS.openModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const categoryId = document.getElementById('pCategory').value;
  const cat = categories.find(c => c.id === categoryId);
  if (!categoryId) { RESTPOS.toast('Please add a category first', 'error'); return; }

  const data = {
    name: document.getElementById('pName').value.trim(),
    categoryId, categoryName: cat ? cat.name : '',
    sku: document.getElementById('pSku').value.trim(),
    price: Number(document.getElementById('pPrice').value) || 0,
    costPrice: Number(document.getElementById('pCost').value) || 0,
    stock: Number(document.getElementById('pStock').value) || 0,
    lowStockThreshold: Number(document.getElementById('pLowStock').value) || 5,
    imageUrl: document.getElementById('pImage').value.trim(),
    description: document.getElementById('pDesc').value.trim(),
    available: document.getElementById('pAvailable').checked,
  };
  if (!data.name) { RESTPOS.toast('Product name is required', 'error'); return; }

  const btn = document.getElementById('saveProductBtn');
  btn.disabled = true;
  try {
    if (id) await DB.updateProduct(id, data);
    else await DB.addProduct(data);
    RESTPOS.toast('Product saved', 'success');
    RESTPOS.closeModal('productModal');
  } catch (err) {
    console.error(err);
    RESTPOS.toast('Could not save product', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct() {
  const id = document.getElementById('pId').value;
  if (!id) return;
  if (!confirm('Delete this product? This cannot be undone.')) return;
  await DB.deleteProduct(id);
  RESTPOS.toast('Product deleted', 'success');
  RESTPOS.closeModal('productModal');
}
