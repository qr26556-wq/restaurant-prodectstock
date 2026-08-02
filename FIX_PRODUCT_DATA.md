# Al Hadi Store — Firebase Data Validation Fix

## مسئلہ:
```
Product save nahi ho saka. Internet check karein ya Firebase Firestore settings dekhein. 
(Property array contains an invalid nested entity)
```

## وجہ:
جب تم `Description` میں data ڈالتے ہو یا `colors/sizes` میں خالی values ہوں تو Firestore reject کرتا ہے۔

---

## حل — تین Steps:

### Step 1: `js/app.js` میں `sanitizeForFirestore()` کو تبدیل کریں

**لائن 723-751 میں یہ تبدیلی کریں:**

```javascript
function sanitizeForFirestore(value){
  // null/undefined کو safely handle کریں
  if(value === undefined || value === null) return null;
  
  const t = typeof value;
  if(t === 'string') {
    // خالی strings کو null میں convert کریں
    return value.trim() === '' ? null : value;
  }
  if(t === 'boolean') return value;
  if(t === 'number') return Number.isFinite(value) ? value : null;
  if(value instanceof Date) return value;
  
  if(Array.isArray(value)){
    return value
      .filter(v => v !== undefined && v !== null && v !== '')
      .map(v => sanitizeForFirestore(v))
      .filter(v => v !== null) // null values نکالیں
      .map(v => Array.isArray(v) ? {list:v} : v);
  }
  
  if(value instanceof Set) return sanitizeForFirestore(Array.from(value));
  if(value instanceof Map) return sanitizeForFirestore(Object.fromEntries(value));
  
  if(t === 'object'){
    if(value && value._methodName) return value;
    const out = {};
    Object.keys(value).forEach(function(k){
      if(value[k] === undefined || value[k] === null) return;
      const clean = sanitizeForFirestore(value[k]);
      if(clean !== null && clean !== undefined) out[k] = clean;
    });
    return Object.keys(out).length ? out : null;
  }
  
  return null;
}
```

### Step 2: Admin Panel میں default values ٹھیک کریں

**لائن 797-894 میں `submitAddProduct()` میں یہ تبدیلی کریں:**

```javascript
async function submitAddProduct(e){
  e.preventDefault();
  const errEl = document.getElementById('addProductError');
  errEl.classList.remove('show');

  const editId = document.getElementById('apEditId').value;
  const name = document.getElementById('apName').value.trim();
  const category = document.getElementById('apCategory').value.trim() || 'other';
  const price = Number(document.getElementById('apPrice').value);
  const oldPriceRaw = document.getElementById('apOldPrice').value;
  const oldPrice = oldPriceRaw ? Number(oldPriceRaw) : null; // undefined بجائے null
  const imageUrlsRaw = document.getElementById('apImageUrls').value.trim();
  const imageUrls = imageUrlsRaw ? imageUrlsRaw.split(',').map(s=>s.trim()).filter(s => s.length > 0) : [];
  const files = Array.from(document.getElementById('apImageFiles').files || []);
  const videoUrl = document.getElementById('apVideoUrl').value.trim() || null;
  const colorsRaw = document.getElementById('apColors').value.trim();
  const colors = colorsRaw ? colorsRaw.split(',').map(s=>s.trim()).filter(s => s.length > 0) : [];
  const sizesRaw = document.getElementById('apSizes').value.trim();
  const sizes = sizesRaw ? sizesRaw.split(',').map(s=>s.trim()).filter(s => s.length > 0) : ['Standard'];
  const flashSale = document.getElementById('apFlashSale').value === 'yes';
  const stockStatus = document.getElementById('apStock').value;
  const stockQtyRaw = document.getElementById('apStockQty').value;
  const stockQty = stockQtyRaw !== '' ? Math.max(0, parseInt(stockQtyRaw,10)||0) : null;
  const hidden = document.getElementById('apVisible').value === 'no';
  const deliveryRaw = document.getElementById('apDelivery').value;
  const deliveryCharge = deliveryRaw ? Number(deliveryRaw) : DELIVERY_CHARGE;
  const desc = document.getElementById('apDesc').value.trim() || null;

  const existing = editId ? ALL_PRODUCTS.find(p=>p.id===editId) : null;

  if(!name || !price || (!imageUrls.length && !files.length && !(existing && existing.images && existing.images.length))){
    errEl.textContent = 'Please fill in the product name, price, and at least one image (URL or upload).';
    errEl.classList.add('show');
    return false;
  }

  let uploadedImages = [];
  try{
    uploadedImages = await Promise.all(files.map(f=>fileToDataUrl(f).then(src=>({src:src, alt:name}))));\n  }catch(err){
    errEl.textContent = 'Could not read the selected image file(s).';
    errEl.classList.add('show');
    return false;
  }

  const urlImages = imageUrls.map(u=>({src:u, alt:name}));
  let images = urlImages.concat(uploadedImages);
  if(!images.length && existing) images = existing.images;

  const product = {
    id: editId || ('admin_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)),
    category: category,
    name: name,
    price: price,
    oldPrice: oldPrice,
    desc: desc,
    sizes: sizes,
    sizeLabel: 'Size',
    colors: colors,
    videoUrl: videoUrl,
    stockStatus: stockStatus,
    stockQty: stockQty,
    hidden: hidden,
    deliveryCharge: deliveryCharge,
    flashSale: flashSale,
    details: [],
    note: null,
    productCode: null,
    images: images,
    badge: flashSale ? 'Flash Sale' : 'New',
    addedByAdmin: true
  };

  let savedProduct;
  try{
    savedProduct = await saveCustomProduct(product);
  }catch(err){
    errEl.textContent = 'Product save nahi ho saka. Internet check karein ya Firebase Firestore settings dekhein. (' + ((err && err.message) || 'unknown error') + ')';
    errEl.classList.add('show');
    return false;
  }

  ALL_PRODUCTS = ALL_PRODUCTS.filter(p=>p.id !== savedProduct.id).concat([savedProduct]);
  buildCategories();
  renderProducts();
  renderAdminProductList();

  document.getElementById('addProductForm').reset();
  document.getElementById('apEditId').value = '';
  document.getElementById('apDelivery').value = 200;
  document.getElementById('apStockQty').value = '';
  document.getElementById('apVisible').value = 'yes';
  clearSizeChips();
  document.getElementById('addProductSubmitBtn').textContent = 'Product Add Karein';
  toast(existing ? 'Product update ho gaya!' : 'Product Add ho gaya!');
  return false;
}
```

---

## Step 3: Test کریں

1. **Firebase Console کھولیں**: https://console.firebase.google.com
2. **Al-Hadi-Store project** منتخب کریں
3. **Firestore Database** > **Rules** میں اپ ڈیٹ کریں (اگر ابھی تک نہ کیا ہو)
4. اپنی store میں **Admin Login** کریں
5. **Naya product add کریں** یا **موجودہ product edit کریں**
6. اب **"Product Add Karein"** کریں — کام کرنا چاہیے! ✅

---

## کیا بدلا:
✅ `undefined` values کو `null` میں بدلا  
✅ خالی strings فلٹر کریں  
✅ Array میں خالی items نہ رکھیں  
✅ Default sizes = `['Standard']` (خالی array نہیں)  
