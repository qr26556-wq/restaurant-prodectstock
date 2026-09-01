let categories = [], products = [];
let search = '', catFilter = 'all', stockFilter = 'all';

RESTPOS.guard(['admin'], (user) => {
  RESTPOS.renderNav('products', 'admin', user.name);
  boot();
});

function boot() {
  DB.listenCategories(list => { categories = list; renderCategorySelects(); renderCategoryManager(); });
  DB.listenProducts(list => { products = list; renderTable(); updatePlanLimitHint(); });
  DB.getSettings().then(s => { window.__settings = s || {}; updatePlanLimitHint(); }).catch(() => {});

  document.getElementById('searchInput').addEventListener('input', e => { search = e.target.value.toLowerCase(); renderTable(); });
  document.getElementById('categoryFilter').addEventListener('change', e => { catFilter = e.target.value; renderTable(); });
  document.getElementById('stockFilter').addEventListener('change', e => { stockFilter = e.target.value; renderTable(); });

  document.getElementById('addProductBtn').addEventListener('click', () => {
    const settings = window.__settings || {};
    const limit = RESTPOS.FREE_LIMITS.products;
    if (!RESTPOS.isPaidPlan(settings) && products.length >= limit) {
      RESTPOS.upsellToast(`Free plan is limited to ${limit} products.`);
      return;
    }
    openProductModal();
  });
  document.getElementById('manageCatsBtn').addEventListener('click', () => RESTPOS.openModal('catModal'));
  document.getElementById('stockScanBtn').addEventListener('click', openStockScanModal);
  document.getElementById('stockScanCloseBtn').addEventListener('click', closeStockScanModal);
  document.getElementById('stockScanCancelBtn').addEventListener('click', closeStockScanModal);
  document.getElementById('stockScanCaptureBtn').addEventListener('click', captureAndUpdateStock);

  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
  document.getElementById('deleteProductBtn').addEventListener('click', deleteProduct);
  document.getElementById('catForm').addEventListener('submit', addCategory);
  document.getElementById('catImageInput').addEventListener('change', onCatImagePicked);
  document.getElementById('catImageAiBtn').addEventListener('click', () => {
    if (!RESTPOS.isPaidPlan(window.__settings || {})) {
      RESTPOS.upsellToast('AI image generation is a paid feature.');
      return;
    }
    document.getElementById('catImageAiRow').classList.toggle('hidden');
    document.getElementById('catImageAiPrompt').focus();
  });
  document.getElementById('catImageAiGoBtn').addEventListener('click', generateCategoryImageWithAI);

  document.getElementById('pImagePreview').addEventListener('click', () => document.getElementById('pImageInput').click());
  document.getElementById('pImageGalleryBtn').addEventListener('click', () => document.getElementById('pImageInput').click());
  document.getElementById('pImageInput').addEventListener('change', onProductImagePicked);
  document.getElementById('pImageRemoveBtn').addEventListener('click', clearProductImage);
  document.getElementById('pImageAiBtn').addEventListener('click', () => {
    if (!RESTPOS.isPaidPlan(window.__settings || {})) {
      RESTPOS.upsellToast('AI image generation is a paid feature.');
      return;
    }
    document.getElementById('pImageAiRow').classList.toggle('hidden');
    document.getElementById('pImageAiPrompt').focus();
  });
  document.getElementById('pImageAiGoBtn').addEventListener('click', generateProductImageWithAI);
}

/* ---------------- Product image: gallery pick ---------------- */
function resizeFileToDataUrl(file, size, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read that image — try a different file.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function setProductImagePreview(dataUrl) {
  const box = document.getElementById('pImagePreview');
  document.getElementById('pImage').value = dataUrl || '';
  document.getElementById('pImageRemoveBtn').style.display = dataUrl ? 'inline-flex' : 'none';
  box.innerHTML = dataUrl ? `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover">` : '🍽️';
}

function clearProductImage() {
  document.getElementById('pImageInput').value = '';
  setProductImagePreview('');
}

async function onProductImagePicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await resizeFileToDataUrl(file, 480, 0.75);
    setProductImagePreview(dataUrl);
  } catch (err) {
    RESTPOS.toast(err.message, 'error');
  }
}

/* ---------------- Free AI image generation (Pollinations.ai — no API key needed) ---------------- */
function aiImageDataUrl(promptText, styleSuffix, size) {
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText + styleSuffix)}?width=512&height=512&seed=${seed}&nologo=true`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('AI image service did not respond — check your internet connection and try again.'));
    img.src = url;
  });
}

async function generateProductImageWithAI() {
  const promptInput = document.getElementById('pImageAiPrompt');
  const nameFallback = document.getElementById('pName').value.trim();
  const prompt = promptInput.value.trim() || nameFallback;
  if (!prompt) { RESTPOS.toast('Type a short description first (or fill Product name)', 'error'); return; }

  const goBtn = document.getElementById('pImageAiGoBtn');
  goBtn.disabled = true;
  goBtn.textContent = 'Generating…';
  try {
    const dataUrl = await aiImageDataUrl(prompt, ', food photography, appetizing, restaurant menu photo', 480);
    setProductImagePreview(dataUrl);
    document.getElementById('pImageAiRow').classList.add('hidden');
    RESTPOS.toast('AI image generated', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast(err.message || 'Could not generate an image', 'error');
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
  }
}

async function generateCategoryImageWithAI() {
  const promptInput = document.getElementById('catImageAiPrompt');
  const nameFallback = document.getElementById('catName').value.trim();
  const prompt = promptInput.value.trim() || nameFallback;
  if (!prompt) { RESTPOS.toast('Type a short description first (or fill Category name)', 'error'); return; }

  const goBtn = document.getElementById('catImageAiGoBtn');
  goBtn.disabled = true;
  goBtn.textContent = 'Generating…';
  try {
    const dataUrl = await aiImageDataUrl(prompt, ', simple flat icon, minimal, restaurant menu category icon', 96);
    pendingCatImage = dataUrl;
    document.getElementById('catImagePreview').innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover">`;
    document.getElementById('catImageAiRow').classList.add('hidden');
    RESTPOS.toast('AI image generated', 'success');
  } catch (err) {
    console.error(err);
    RESTPOS.toast(err.message || 'Could not generate an image', 'error');
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
  }
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
    document.getElementById('catImageAiRow').classList.add('hidden');
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
function updatePlanLimitHint() {
  const el = document.getElementById('planLimitHint');
  if (!el) return;
  const limit = RESTPOS.FREE_LIMITS.products;
  if (RESTPOS.isPaidPlan(window.__settings || {})) { el.textContent = ''; return; }
  el.textContent = `Free plan: ${products.length}/${limit} products used. Upgrade in Settings for unlimited products.`;
}

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

/* ---------------- Camera scan: add stock by code ---------------- */
let stockScanStream = null;
let stockScanBusy = false;

async function openStockScanModal() {
  RESTPOS.openModal('stockScanModal');
  document.getElementById('stockScanStatus').textContent = '';
  document.getElementById('stockScanResultsList').innerHTML = '';
  const video = document.getElementById('stockScanVideo');
  try {
    stockScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stockScanStream;
    await video.play();
  } catch (err) {
    console.error(err);
    document.getElementById('stockScanStatus').textContent = 'Camera khul nahi saka. Browser permission check karain (Settings > Site permissions > Camera allow karain).';
    RESTPOS.toast('Camera access nahi mila', 'error');
  }
}

function closeStockScanModal() {
  if (stockScanStream) { stockScanStream.getTracks().forEach(t => t.stop()); stockScanStream = null; }
  RESTPOS.closeModal('stockScanModal');
}

async function captureAndUpdateStock() {
  if (stockScanBusy) return;
  const video = document.getElementById('stockScanVideo');
  if (!stockScanStream || !video.videoWidth) { RESTPOS.toast('Camera abhi ready nahi hai', 'error'); return; }

  stockScanBusy = true;
  const statusEl = document.getElementById('stockScanStatus');
  const listEl = document.getElementById('stockScanResultsList');
  const btn = document.getElementById('stockScanCaptureBtn');
  btn.disabled = true;
  statusEl.textContent = 'Scan ho raha hai…';
  listEl.innerHTML = '';

  try {
    const canvas = document.getElementById('stockScanCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!('BarcodeDetector' in window)) {
      statusEl.innerHTML = 'Yeh browser ek saath multiple code scan support nahi karta.<br>Chrome (Android/Desktop) use karain, ya neeche code number type karke stock add karain:';
      renderManualStockEntry(listEl);
      return;
    }

    const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => null);
    const detector = new window.BarcodeDetector(formats ? { formats } : undefined);
    const detections = await detector.detect(canvas);

    if (!detections.length) {
      statusEl.textContent = 'Koi bhi code nahi mila. Camera thora paas/saaf rakh kar dobara try karain.';
      renderManualStockEntry(listEl);
      return;
    }

    // Count how many times each code appears in this single photo — that
    // becomes the quantity added to that product's stock.
    const counts = {};
    detections.forEach(d => {
      const code = (d.rawValue || '').trim();
      if (code) counts[code] = (counts[code] || 0) + 1;
    });

    const updates = [];
    const notFound = [];
    for (const code of Object.keys(counts)) {
      const qty = counts[code];
      const product = products.find(p => (p.sku || '').trim().toLowerCase() === code.toLowerCase());
      if (product) updates.push({ product, qty });
      else notFound.push(code);
    }

    await Promise.all(updates.map(u => DB.updateProduct(u.product.id, { stock: FieldValue.increment(u.qty) })));

    statusEl.textContent = updates.length
      ? `${updates.length} product(s) ka stock update ho gaya.`
      : 'Codes mile lekin koi bhi product match nahi hua.';

    listEl.innerHTML = [
      ...updates.map(u => `<div class="receipt-line" style="color:var(--success,#1a7a3c)"><span class="rl-name">✔ ${RESTPOS.escapeHtml(u.product.name)}</span><span class="rl-fill"></span><span class="rl-val">+${u.qty} stock</span></div>`),
      ...notFound.map(code => `
        <div class="receipt-line" style="color:var(--alert)">
          <span class="rl-name">✕ ${RESTPOS.escapeHtml(code)}</span><span class="rl-fill"></span>
          <button class="btn btn-sm" data-newcode="${RESTPOS.escapeHtml(code)}">+ Add product</button>
        </div>`),
    ].join('') || '<p class="hint">Kuch nahi mila.</p>';

    listEl.querySelectorAll('[data-newcode]').forEach(b => b.addEventListener('click', () => {
      closeStockScanModal();
      openProductModal();
      document.getElementById('pSku').value = b.dataset.newcode;
    }));

    if (updates.length) RESTPOS.toast(`${updates.length} product ka stock scan se update hua`, 'success');
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Scan mein masla aaya, dobara try karain.';
    RESTPOS.toast('Scan fail ho gaya', 'error');
  } finally {
    btn.disabled = false;
    stockScanBusy = false;
  }
}

function renderManualStockEntry(listEl) {
  listEl.innerHTML = `
    <div style="display:flex; gap:8px">
      <input id="manualStockCode" placeholder="Product code / SKU" style="flex:1; padding:8px; border-radius:7px; border:1px solid var(--line)">
      <input id="manualStockQty" type="number" min="1" value="1" style="width:70px; padding:8px; border-radius:7px; border:1px solid var(--line)">
      <button class="btn btn-primary" id="manualStockAddBtn">Add</button>
    </div>
    <div id="manualStockLog" style="margin-top:8px; display:flex; flex-direction:column; gap:6px"></div>`;
  const codeInput = document.getElementById('manualStockCode');
  const qtyInput = document.getElementById('manualStockQty');
  const log = document.getElementById('manualStockLog');
  const addByCode = async () => {
    const code = codeInput.value.trim();
    const qty = Number(qtyInput.value) || 1;
    if (!code) return;
    const product = products.find(p => (p.sku || '').trim().toLowerCase() === code.toLowerCase());
    if (product) {
      await DB.updateProduct(product.id, { stock: FieldValue.increment(qty) });
      log.insertAdjacentHTML('afterbegin', `<div class="receipt-line" style="color:var(--success,#1a7a3c)"><span class="rl-name">✔ ${RESTPOS.escapeHtml(product.name)}</span><span class="rl-fill"></span><span class="rl-val">+${qty} stock</span></div>`);
      RESTPOS.toast(`${product.name} stock +${qty}`, 'success');
    } else {
      log.insertAdjacentHTML('afterbegin', `
        <div class="receipt-line" style="color:var(--alert)">
          <span class="rl-name">✕ ${RESTPOS.escapeHtml(code)}</span><span class="rl-fill"></span>
          <button class="btn btn-sm" data-newcode2="${RESTPOS.escapeHtml(code)}">+ Add product</button>
        </div>`);
      log.querySelector('[data-newcode2]').addEventListener('click', function () {
        closeStockScanModal();
        openProductModal();
        document.getElementById('pSku').value = this.dataset.newcode2;
      });
    }
    codeInput.value = '';
    codeInput.focus();
  };
  document.getElementById('manualStockAddBtn').addEventListener('click', addByCode);
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addByCode(); });
  codeInput.focus();
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
    setProductImagePreview(p.imageUrl || '');
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pAvailable').checked = p.available !== false;
  } else {
    document.getElementById('pLowStock').value = 5;
    document.getElementById('pAvailable').checked = true;
    setProductImagePreview('');
  }
  document.getElementById('pImageAiRow').classList.add('hidden');
  document.getElementById('pImageAiPrompt').value = '';
  RESTPOS.openModal('productModal');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const categoryId = document.getElementById('pCategory').value;
  const cat = categories.find(c => c.id === categoryId);
  if (!categoryId) { RESTPOS.toast('Please add a category first', 'error'); return; }
  if (!id && !RESTPOS.isPaidPlan(window.__settings || {}) && products.length >= RESTPOS.FREE_LIMITS.products) {
    RESTPOS.upsellToast(`Free plan is limited to ${RESTPOS.FREE_LIMITS.products} products.`);
    RESTPOS.closeModal('productModal');
    return;
  }

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
