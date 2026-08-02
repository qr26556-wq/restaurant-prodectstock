
/* ============================================================
   Al Hadi Store — marketplace front-end
   WITH GOOGLE SHEETS ORDER TRACKING ✅
   ============================================================ */

/* ---------- ON-SCREEN ERROR CATCHER ----------
   Chhupi hui JS errors (jo phone par console mein bhi nahi dikhtin) ek
   chhoti si red patti mein screen ke neeche dikhti hain — taake bina
   computer/console ke bhi asal masla pata chal sake.
   IMPORTANT: yeh sirf debug mode mein chalta hai (?debug=1 URL mein add
   karein — ek dafa add karne se agli visits ke liye bhi yaad rehta hai,
   hata-ne ke liye ?debug=0 lagayein) ya jab admin already logged in ho.
   Pehle yeh HAR customer ko dikhta tha (jaise generic browser/extension
   "Script error." bhi) — checkout ke baad invoice screen par bhi — jo
   customers ko dara/confuse kar sakta tha bina koi kaam ki info diye. */
(function(){
  let box;
  function debugModeOn(){
    try{
      const params = new URLSearchParams(window.location.search);
      if(params.has('debug')) sessionStorage.setItem('ahs_debug', params.get('debug')==='1' ? '1' : '0');
      if(sessionStorage.getItem('ahs_debug') === '1') return true;
    }catch(e){}
    try{ if(sessionStorage.getItem('ahs_admin') === '1') return true; }catch(e){}
    return false;
  }
  function ensureBox(){
    if(box) return box;
    box = document.createElement('div');
    box.id = 'debugErrorBox';
    box.style.cssText = 'position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;background:#2a0a0a;color:#ffdede;font:12px/1.5 monospace;padding:12px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);max-height:40vh;overflow-y:auto;display:none;';
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕ Band Karein';
    closeBtn.style.cssText = 'text-align:right;font-weight:700;cursor:pointer;margin-bottom:6px;color:#ffb3b3;';
    closeBtn.onclick = function(){ box.style.display = 'none'; };
    box.appendChild(closeBtn);
    document.body.appendChild(box);
    return box;
  }
  function showError(label, detail){
    if(!debugModeOn()) return;
    const b = ensureBox();
    const line = document.createElement('div');
    line.style.cssText = 'border-top:1px solid rgba(255,255,255,.15);padding-top:6px;margin-top:6px;white-space:pre-wrap;word-break:break-word;';
    line.textContent = '⚠️ ' + label + ': ' + detail;
    b.appendChild(line);
    b.style.display = 'block';
  }
  window.addEventListener('error', function(e){
    // A bare "Script error." with no filename means the error came from a
    // cross-origin script without CORS headers (a third-party SDK or a
    // browser extension) — the browser deliberately hides the real detail,
    // so this line is always uninformative noise. Still logged to the
    // console for developers; just not surfaced in the on-screen banner.
    const isOpaqueCrossOrigin = (!e || !e.filename) && e && e.message === 'Script error.';
    console.error('window error:', e && e.message, e && e.filename, e && e.lineno);
    if(isOpaqueCrossOrigin) return;
    showError('JS Error', (e && e.message ? e.message : 'Unknown') + (e && e.filename ? (' @ ' + e.filename.split('/').pop() + ':' + e.lineno) : ''));
  });
  window.addEventListener('unhandledrejection', function(e){
    const reason = e && e.reason;
    const msg = (reason && reason.message) ? reason.message : (reason && reason.code) ? reason.code : String(reason);
    console.error('unhandled rejection:', msg);
    showError('Promise Error', msg);
  });
  window.addEventListener('securitypolicyviolation', function(e){
    console.error('CSP violation:', e.violatedDirective, e.blockedURI);
    showError('CSP Blocked', (e.violatedDirective||'')+' — '+(e.blockedURI||''));
  });
  window.showDebugError = showError;
})();

const DELIVERY_CHARGE = 200;
const CATEGORY_LABELS = {
  kapray:'Clothing', joote:'Footwear', mobile:'Mobile & Accessories',
  exercise:'Fitness', electronics:'Electronics', other:'Lifestyle'
};

const CATEGORY_ICONS = {
  kapray:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 3 4 6l1.5 3L8 8v13h8V8l2.5 1L20 6l-4-3-2 2h-4z"/></svg>',
  joote:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 18v-4c2-.3 3-1 4-2l2-2c1 1.2 2.4 2 4 2h3.5c1.9 0 3.5 1.6 3.5 3.5V18z"/><path d="M3 18h18M6 10l2-3M14 10l2-3"/></svg>',
  mobile:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
  electronics:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2l2.8 2.8"/></svg>',
  exercise:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6.5 6.5 17.5 17.5M4 9l3-3M17 20l3-3M2 11l3 3M18 5l3 3"/></svg>',
  other:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.6 12.3 12.3 20.6a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.5 3.2a1.5 1.5 0 0 1 2.1 0l7 7c.6.6.6 1.5 0 2.1z"/></svg>'
};

let ALL_PRODUCTS = [];
let CART = [];
let APPLIED_COUPON = null; // { code, type, value, discountAmount }
let currentFilter = 'all';
let currentSearch = '';
let PD = { product:null, index:0 };
let currentUser = null;
let USER_LIKES = new Set();

/* ---------- Google Sheets Integration ---------- */
// ⚠️ آپ کو اپنا Google Sheets Script URL یہاں paste کرنا ہے
// Setup instructions نیچے دیے ہیں
const GOOGLE_SHEETS_URL = 'YOUR_GOOGLE_SHEETS_URL_HERE';

/* ---------- shareable product links (?p=productId) ---------- */
const PRODUCT_URL_PARAM = 'p';
let deepLinkOpened = false;

function productShareURL(id){
  return location.origin + location.pathname + '?' + PRODUCT_URL_PARAM + '=' + encodeURIComponent(id);
}
/* Called after products are loaded (base catalog + Firestore sync) to
   auto-open the product a shared link points to. Safe to call multiple
   times — no-ops once the deep link has been handled. */
function openProductFromURL(){
  if(deepLinkOpened) return;
  const id = new URLSearchParams(location.search).get(PRODUCT_URL_PARAM);
  if(!id) return;
  const p = ALL_PRODUCTS.find(x => x.id === id);
  if(!p) return; // not loaded yet (e.g. admin-added product still syncing) — retried on next call
  deepLinkOpened = true;
  openProduct(id, true);
}
window.addEventListener('popstate', function(){
  const id = new URLSearchParams(location.search).get(PRODUCT_URL_PARAM);
  const p = id ? ALL_PRODUCTS.find(x => x.id === id) : null;
  if(p){ openProduct(id, true); }
  else{
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow='';
    resetPageSEO();
  }
});

/* ---------- helpers ---------- */
function money(n){ return 'Rs ' + Number(n||0).toLocaleString('en-PK'); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function discountPct(p){ if(!p.oldPrice || p.oldPrice<=p.price) return 0; return Math.round((1 - p.price/p.oldPrice)*100); }
function firstImg(p){ return (p.images && p.images[0] && p.images[0].src) || ''; }
function catLabel(c){ return CATEGORY_LABELS[c] || (c ? c.charAt(0).toUpperCase()+c.slice(1) : 'Lifestyle'); }
function starSvg(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.7l.9-5.4L4.2 8.7l5.4-.8z"/></svg>'; }

/* ---------- dynamic per-product SEO metadata ----------
   Products open in a modal on top of index.html (?p=productId) rather than
   on their own static page, so without this the title/description/canonical/
   OG tags would stay identical for every product. This captures the default
   homepage values once on load, swaps in product-specific values (plus a
   Product JSON-LD block) whenever a product is opened — via click or a
   shared deep link — and restores the defaults when it's closed. */
function getMetaContent(selector, attr){
  const el = document.querySelector(selector);
  if(!el) return '';
  return attr ? (el.getAttribute(attr)||'') : (el.getAttribute('content')||'');
}
function setMetaContent(selector, attr, value){
  const el = document.querySelector(selector);
  if(el && value) el.setAttribute(attr, value);
}
const DEFAULT_SEO = {
  title: document.title,
  description: getMetaContent('meta[name="description"]'),
  canonical: getMetaContent('link[rel="canonical"]', 'href'),
  ogTitle: getMetaContent('meta[property="og:title"]'),
  ogDescription: getMetaContent('meta[property="og:description"]'),
  ogUrl: getMetaContent('meta[property="og:url"]'),
  ogImage: getMetaContent('meta[property="og:image"]'),
  twitterTitle: getMetaContent('meta[name="twitter:title"]'),
  twitterDescription: getMetaContent('meta[name="twitter:description"]'),
  twitterImage: getMetaContent('meta[name="twitter:image"]')
};
function absoluteAssetUrl(path){
  if(!path) return DEFAULT_SEO.ogImage;
  if(/^https?:\/\//i.test(path)) return path;
  return location.origin + '/' + String(path).replace(/^\//,'');
}
function updateProductSEO(p){
  const url = productShareURL(p.id);
  const img = absoluteAssetUrl(firstImg(p));
  const rawDesc = p.desc ? String(p.desc).replace(/\s+/g,' ').trim() : (p.name + ' — available now at Al Hadi Store. ' + money(p.price) + '.');
  const desc = rawDesc.length > 160 ? rawDesc.slice(0,157) + '...' : rawDesc;
  const title = p.name + ' | Al Hadi Store';

  document.title = title;
  setMetaContent('meta[name="description"]','content', desc);
  setMetaContent('link[rel="canonical"]','href', url);
  setMetaContent('meta[property="og:url"]','content', url);
  setMetaContent('meta[property="og:title"]','content', title);
  setMetaContent('meta[property="og:description"]','content', desc);
  setMetaContent('meta[property="og:image"]','content', img);
  setMetaContent('meta[name="twitter:title"]','content', title);
  setMetaContent('meta[name="twitter:description"]','content', desc);
  setMetaContent('meta[name="twitter:image"]','content', img);
  updateProductJsonLd(p, url, img, desc);
}
function resetPageSEO(){
  document.title = DEFAULT_SEO.title;
  setMetaContent('meta[name="description"]','content', DEFAULT_SEO.description);
  setMetaContent('link[rel="canonical"]','href', DEFAULT_SEO.canonical);
  setMetaContent('meta[property="og:url"]','content', DEFAULT_SEO.ogUrl);
  setMetaContent('meta[property="og:title"]','content', DEFAULT_SEO.ogTitle);
  setMetaContent('meta[property="og:description"]','content', DEFAULT_SEO.ogDescription);
  setMetaContent('meta[property="og:image"]','content', DEFAULT_SEO.ogImage);
  setMetaContent('meta[name="twitter:title"]','content', DEFAULT_SEO.twitterTitle);
  setMetaContent('meta[name="twitter:description"]','content', DEFAULT_SEO.twitterDescription);
  setMetaContent('meta[name="twitter:image"]','content', DEFAULT_SEO.twitterImage);
  removeProductJsonLd();
}
function updateProductJsonLd(p, url, img, desc){
  removeProductJsonLd();
  const outOfStock = p.stockStatus === 'out' || (p.stockQty != null && Number(p.stockQty) <= 0);
  const data = {
    "@context":"https://schema.org",
    "@type":"Product",
    "name": p.name,
    "image":[img],
    "description": desc,
    "sku": p.productCode || p.id,
    "category": catLabel(p.category),
    "offers":{
      "@type":"Offer",
      "url": url,
      "priceCurrency":"PKR",
      "price": p.price,
      "availability": outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
    }
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'product-jsonld';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}
function removeProductJsonLd(){
  const el = document.getElementById('product-jsonld');
  if(el) el.remove();
}

/* ---------- product rendering ---------- */
function heartSvg(filled){
  return '<svg width="16" height="16" viewBox="0 0 24 24" '+(filled?'fill="currentColor" stroke="currentColor"':'fill="none" stroke="currentColor"')+' stroke-width="2"><path d="M12 21s-7.5-4.6-10-7.5C-.3 11.5 1.5 6 5.5 6c2 0 3.5 1 6.5 4 3-3 4.5-4 6.5-4 4 0 5.8 5.5 3.5 7.5-2.5 2.9-10 7.5-10 7.5z"/></svg>';
}

function renderProductCard(p){
  const disc = discountPct(p);
  const wished = USER_LIKES.has(p.id);
  const compared = getCompareIds().includes(p.id);
  const outOfStock = (p.stockStatus==='out') || (p.stockQty!=null && p.stockQty<=0);
  return (
    '<article class="pcard" onclick="openProduct(\''+p.id+'\')">'+
      '<div class="pcard-img">'+
        '<img src="'+firstImg(p)+'" alt="'+escapeHtml(p.name)+'" loading="lazy">'+
        (disc>0 ? '<span class="badge-disc">-'+disc+'%</span>' : '')+
        (p.badge ? '<span class="badge-tag">'+escapeHtml(p.badge)+'</span>' : '')+
        (outOfStock ? '<span class="badge-tag" style="left:auto;right:9px;top:9px;background:#c0392b;">Out of Stock</span>' : '')+
        '<button class="wish'+(wished?' on':'')+'" onclick="event.stopPropagation();toggleLike(\''+p.id+'\')" aria-label="'+(wished?'Remove from liked products':'Save to liked products')+'">'+heartSvg(wished)+'</button>'+
        '<button class="cmp-btn'+(compared?' on':'')+'" onclick="event.stopPropagation();toggleCompare(\''+p.id+'\')" aria-label="Compare" title="Compare"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>'+
      '</div>'+
      '<div class="pcard-body">'+
        '<h3 class="pcard-name">'+escapeHtml(p.name)+'</h3>'+
        '<div class="pcard-price"><span class="now">'+money(p.price)+'</span>'+(p.oldPrice&&p.oldPrice>p.price?'<span class="was">'+money(p.oldPrice)+'</span>':'')+'</div>'+
        '<div class="pcard-meta">'+
          (p.rating ? '<span class="rating">'+starSvg()+'<span class="num">'+p.rating+'</span></span><span class="sep">|</span>' : '')+
          '<span class="sold">'+(p.sold?p.sold+' sold':catLabel(p.category))+'</span>'+
        '</div>'+
        (outOfStock
          ? '<button class="pcard-add" disabled style="opacity:.55;cursor:not-allowed;" onclick="event.stopPropagation();">Out of Stock</button>'
          : '<button class="pcard-add" onclick="event.stopPropagation();quickAdd(\''+p.id+'\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>Add</button>')+
      '</div>'+
    '</article>'
  );
}

/* Flash Sale products first, then New, then everything else. Sort is stable
   (native Array#sort preserves relative order within same rank), so within
   each group products keep their existing order. */
function productRank(p){
  if(p.flashSale) return 0;
  if(p.badge === 'New') return 1;
  return 2;
}

function normKey(s){ return String(s||'').trim().toLowerCase(); }
/* Grouping key: two categories are "the same" if their display label matches
   once trimmed/lowercased — this is what stops "Clothing" and "kapray" (or
   "Clothing" typed twice with different spacing) from showing as separate
   category buttons. */
function catKey(c){ return normKey(catLabel(c)); }
/* label(lowercase) -> official predefined category code, e.g. 'clothing' -> 'kapray'.
   Used so a manually-typed category that matches a known one re-uses its code/icon. */
const PREDEFINED_KEY_TO_CODE = {};
Object.keys(CATEGORY_LABELS).forEach(code => { PREDEFINED_KEY_TO_CODE[normKey(CATEGORY_LABELS[code])] = code; });
let CATEGORY_GROUPS = {}; // key -> { label, code }

function renderProducts(){
  const grid = document.getElementById('productGrid');
  const info = document.getElementById('resultInfo');
  let list = ALL_PRODUCTS.filter(p => !p.hidden && !p.deleted);
  if(currentFilter !== 'all') list = list.filter(p => catKey(p.category) === currentFilter);
  if(currentSearch){
    const q = currentSearch.toLowerCase();
    list = list.filter(p => (p.name+' '+(p.desc||'')+' '+catLabel(p.category)).toLowerCase().includes(q));
  }
  list = list.slice().sort((a,b) => productRank(a) - productRank(b));
  if(list.length === 0){
    grid.innerHTML = '<div class="empty"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><b>Koi product nahi mila</b><p>Doosri category try karein ya search badlein.</p></div>';
  } else {
    grid.innerHTML = list.map(renderProductCard).join('');
  }
  if(info){
    if(currentSearch) info.textContent = list.length+' result'+(list.length!==1?'s':'')+' for "'+currentSearch+'"';
    else if(currentFilter!=='all') info.textContent = list.length+' item'+(list.length!==1?'s':'')+' in '+((CATEGORY_GROUPS[currentFilter]&&CATEGORY_GROUPS[currentFilter].label)||catLabel(currentFilter));
    else info.textContent = 'Browse the full Al Hadi Store collection';
  }
  renderHomeSections();
  renderCompareBar();
}

/* ---------- homepage rows: flash sale / new arrivals / best sellers / recently viewed ---------- */
function renderHomeSections(){
  const live = ALL_PRODUCTS.filter(p => !p.hidden && !p.deleted);

  const flash = live.filter(p => p.flashSale);
  toggleRow('flashSaleSec','flashSaleRow', flash.slice(0,10));

  const fresh = live.filter(p => p.badge==='New' && !p.flashSale).slice(0,10);
  toggleRow('newArrivalsSec','newArrivalsRow', fresh);

  renderBestSellers(live);
  renderRecentlyViewed(live);
}
function toggleRow(secId, rowId, items){
  const sec = document.getElementById(secId);
  const row = document.getElementById(rowId);
  if(!sec || !row) return;
  if(!items.length){ sec.style.display='none'; return; }
  sec.style.display='block';
  row.innerHTML = items.map(renderProductCard).join('');
}
async function renderBestSellers(live){
  try{
    const doc = await firebase.firestore().collection('analytics').doc('summary').get();
    const counts = (doc.exists && doc.data().productAddToCart) || {};
    const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(e=>e[0])
      .map(id=>live.find(p=>p.id===id)).filter(Boolean).slice(0,10);
    toggleRow('bestSellersSec','bestSellersRow', ranked);
  }catch(e){ /* analytics optional — don't break homepage */ }
}
function getRecentlyViewed(){
  try{ return JSON.parse(localStorage.getItem('ahs_recent')||'[]'); }catch(e){ return []; }
}
function trackRecentlyViewed(id){
  try{
    let ids = getRecentlyViewed().filter(x=>x!==id);
    ids.unshift(id);
    ids = ids.slice(0,12);
    localStorage.setItem('ahs_recent', JSON.stringify(ids));
  }catch(e){}
}
function renderRecentlyViewed(live){
  const ids = getRecentlyViewed().filter(id => id !== (PD.product&&PD.product.id));
  const items = ids.map(id=>live.find(p=>p.id===id)).filter(Boolean).slice(0,10);
  toggleRow('recentSec','recentRow', items);
}

/* ---------- category tabs & nav ---------- */
function buildCategories(){
  // Group every product's category by its display label so near-duplicate
  // category values (different casing/spelling meaning the same thing) collapse
  // into a single tab/circle instead of showing twice.
  const groups = {};
  ALL_PRODUCTS.forEach(p => {
    const raw = p.category || 'other';
    const key = catKey(raw);
    if(!groups[key]) groups[key] = { label: catLabel(raw), code: PREDEFINED_KEY_TO_CODE[key] || raw };
  });
  CATEGORY_GROUPS = groups;
  const keys = Object.keys(groups);

  const tabs = document.getElementById('catTabs');
  let th = '<button class="active" data-cat="all" onclick="setFilter(\'all\')">All Products</button>';
  keys.forEach(k => th += '<button data-cat="'+escapeHtml(k)+'" onclick="setFilter(\''+k+'\')">'+escapeHtml(groups[k].label)+'</button>');
  tabs.innerHTML = th;

  const nav = document.getElementById('catNav');
  let nh = '<a href="#shop" class="active" onclick="setFilter(\'all\')">All</a>';
  keys.forEach(k => nh += '<a href="#shop" onclick="setFilter(\''+k+'\')">'+escapeHtml(groups[k].label)+'</a>');
  nh += '<a href="#payment">Payment</a><a href="mailto:qraza2376@gmail.com">Contact</a>';
  nav.innerHTML = nh;

  const circles = document.getElementById('catCircles');
  if(circles){
    let ch = '<button class="cat-circle active" data-cat="all" onclick="setFilter(\'all\')"><span class="ring">'+
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'+
      '</span><span>All</span></button>';
    keys.forEach(k => {
      ch += '<button class="cat-circle" data-cat="'+escapeHtml(k)+'" onclick="setFilter(\''+k+'\')"><span class="ring">'+
        (CATEGORY_ICONS[groups[k].code]||CATEGORY_ICONS.other)+'</span><span>'+escapeHtml(groups[k].label)+'</span></button>';
    });
    circles.innerHTML = ch;
  }

  const marquee = document.getElementById('marqueeTrack');
  if(marquee){
    const items = ['Sale Is Live','Free Shipping On Orders Over Rs 3000','Cash On Delivery Available','100% Original Products','Easy Returns Within 3 Days'];
    const one = items.map(t => '<span class="marquee-item"><span class="pct">%</span>'+escapeHtml(t)+'</span>').join('');
    marquee.innerHTML = '<span class="marquee-set">'+one+'</span><span class="marquee-set">'+one+'</span>';
  }

  populateCategoryDropdown();
}

/* ---------- admin "add product" category dropdown ---------- */
function populateCategoryDropdown(){
  const sel = document.getElementById('apCategory');
  if(!sel) return;
  const prevValue = sel.value;
  // Predefined categories first (in a fixed, friendly order), then any extra
  // categories that exist in real product data but aren't predefined.
  const order = ['kapray','joote','mobile','exercise','electronics','other'];
  const seen = new Set();
  let oh = '';
  order.forEach(code => {
    const key = normKey(CATEGORY_LABELS[code]);
    seen.add(key);
    oh += '<option value="'+escapeHtml(code)+'">'+escapeHtml(CATEGORY_LABELS[code])+'</option>';
  });
  Object.keys(CATEGORY_GROUPS).forEach(key => {
    if(seen.has(key)) return;
    seen.add(key);
    oh += '<option value="'+escapeHtml(CATEGORY_GROUPS[key].code)+'">'+escapeHtml(CATEGORY_GROUPS[key].label)+'</option>';
  });
  oh += '<option value="__new__">+ Naya Category</option>';
  sel.innerHTML = oh;
  if(prevValue && Array.from(sel.options).some(o=>o.value===prevValue)) sel.value = prevValue;
}

function onCategorySelectChange(){
  const sel = document.getElementById('apCategory');
  const newInput = document.getElementById('apCategoryNew');
  if(!sel || !newInput) return;
  const isNew = sel.value === '__new__';
  newInput.style.display = isNew ? 'block' : 'none';
  if(!isNew) newInput.value = '';
}

/* Selects the dropdown option matching a product's raw category (used when
   opening the edit-product form), falling back to "+ Naya Category" with the
   raw value pre-filled if it truly doesn't match anything known yet. */
function setCategoryFieldValue(rawCategory){
  const sel = document.getElementById('apCategory');
  const newInput = document.getElementById('apCategoryNew');
  if(!sel) return;
  const key = catKey(rawCategory || 'other');
  const code = PREDEFINED_KEY_TO_CODE[key] || (CATEGORY_GROUPS[key] && CATEGORY_GROUPS[key].code) || rawCategory;
  const hasOption = Array.from(sel.options).some(o=>o.value===code);
  if(hasOption){
    sel.value = code;
    if(newInput){ newInput.style.display='none'; newInput.value=''; }
  } else {
    sel.value = '__new__';
    if(newInput){ newInput.style.display='block'; newInput.value = rawCategory || ''; }
  }
}

function setFilter(cat){
  currentFilter = cat;
  document.querySelectorAll('#catTabs button').forEach(b => b.classList.toggle('active', b.dataset.cat===cat));
  document.querySelectorAll('#catCircles button').forEach(b => b.classList.toggle('active', b.dataset.cat===cat));
  document.querySelectorAll('#catNav a').forEach(a => a.classList.remove('active'));
  renderProducts();
  const shop = document.getElementById('shop');
  if(shop) shop.scrollIntoView({behavior:'smooth'});
}


/* ---------- search ---------- */
document.getElementById('searchInput').addEventListener('input', function(){
  currentSearch = this.value.trim();
  renderProducts();
  renderSearchSuggestions(this.value.trim());
});
document.getElementById('searchInput').addEventListener('focus', function(){
  renderSearchSuggestions(this.value.trim());
});
document.addEventListener('click', function(e){
  const box = document.getElementById('searchSuggest');
  const bar = document.querySelector('.searchbar');
  if(box && bar && !bar.contains(e.target)) box.classList.remove('show');
});
function renderSearchSuggestions(q){
  const box = document.getElementById('searchSuggest');
  if(!box) return;
  if(!q){ box.classList.remove('show'); box.innerHTML=''; return; }
  const ql = q.toLowerCase();
  const matches = ALL_PRODUCTS.filter(p => !p.hidden && !p.deleted && p.name.toLowerCase().includes(ql)).slice(0,6);
  if(!matches.length){ box.innerHTML = '<div class="ss-empty">Koi match nahi mila</div>'; box.classList.add('show'); return; }
  box.innerHTML = matches.map(p =>
    '<div class="ss-item" onclick="pickSuggestion(\''+p.id+'\')"><img src="'+firstImg(p)+'" alt=""><div><b>'+escapeHtml(p.name)+'</b><span>'+money(p.price)+'</span></div></div>'
  ).join('');
  box.classList.add('show');
}
function pickSuggestion(id){
  document.getElementById('searchSuggest').classList.remove('show');
  document.getElementById('searchInput').value='';
  currentSearch=''; renderProducts();
  openProduct(id);
}
function focusResults(){ document.getElementById('shop').scrollIntoView({behavior:'smooth'}); }

/* ---------- product detail modal ---------- */
function openProduct(id, fromURL){
  const p = ALL_PRODUCTS.find(x => x.id===id);
  if(!p) return;
  trackEvent('product_view', id);
  trackRecentlyViewed(id);
  PD = { product:p, index:0, size:(p.sizes&&p.sizes.length?p.sizes[0]:null), qty:1, shareFile:null, shareFileFor:null };
  prefetchShareImage(p);
  renderDetail();
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow='hidden';
  updateProductSEO(p);
  if(!fromURL){
    try{ history.pushState({product:id}, '', productShareURL(id)); }catch(e){}
  }
}
function closeProduct(){
  const zoomOverlay = document.getElementById('pdZoomOverlay');
  if(zoomOverlay) zoomOverlay.classList.remove('open');
  document.getElementById('productModal').classList.remove('open'); document.body.style.overflow='';
  resetPageSEO();
  if(new URLSearchParams(location.search).get(PRODUCT_URL_PARAM)){
    try{ history.pushState({}, '', location.pathname); }catch(e){}
  }
}

function renderDetail(){
  const p = PD.product; if(!p) return;
  const imgs = p.images||[];
  const disc = discountPct(p);
  const el = document.getElementById('productDetail');
  const thumbs = imgs.map((im,i)=>'<img src="'+im.src+'" alt="" class="'+(i===PD.index?'active':'')+'" onclick="pdGo('+i+')">').join('');
  const sizes = (p.sizes||[]).map(s=>'<button class="'+(s===PD.size?'active':'')+'" onclick="pdSize('+JSON.stringify(escapeHtml(s)).replace(/"/g,'&quot;')+')">'+escapeHtml(s)+'</button>').join('');
  const details = (p.details||[]).map(d=>'<li>'+escapeHtml(d)+'</li>').join('');

  el.innerHTML =
    '<div class="pd-gallery">'+
      '<div class="pd-main">'+
        '<img id="pdMainImg" src="'+(imgs[PD.index]?imgs[PD.index].src:'')+'" alt="'+escapeHtml(p.name)+'" onclick="openZoom()">'+
        '<span class="pd-zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M9 11h4M11 9v4"/></svg>Zoom</span>'+
        (imgs.length>1 ? '<button class="pd-nav prev" onclick="pdSlide(-1)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></button>' : '')+
        (imgs.length>1 ? '<button class="pd-nav next" onclick="pdSlide(1)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 18l6-6-6-6"/></svg></button>' : '')+
      '</div>'+
      (imgs.length>1 ? '<div class="pd-thumbs" id="pdThumbs">'+thumbs+'</div>' : '')+
    '</div>'+
    '<div class="pd-info">'+
      (p.badge ? '<span class="pd-badge">'+escapeHtml(p.badge)+'</span>' : '')+
      '<h2 style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'+escapeHtml(p.name)+
        '<button class="wish'+(USER_LIKES.has(p.id)?' on':'')+'" style="position:static;flex-shrink:0;" onclick="toggleLike(\''+p.id+'\')" aria-label="Save to liked products">'+heartSvg(USER_LIKES.has(p.id))+'</button>'+
      '</h2>'+
      '<div class="pd-rate">'+(p.rating?'<span class="rating" style="color:var(--star)">'+starSvg()+'<span class="num" style="color:var(--ink);font-weight:700">'+p.rating+'</span></span>':'')+
        (p.ratingCount?'<span>'+p.ratingCount+' ratings</span>':'')+(p.sold?'<span>· '+p.sold+' sold</span>':'')+'</div>'+
      '<div class="pd-price"><span class="now">'+money(p.price)+'</span>'+
        (p.oldPrice&&p.oldPrice>p.price?'<span class="was">'+money(p.oldPrice)+'</span><span class="off">-'+disc+'%</span>':'')+'</div>'+
      '<div class="pd-delivery">+ '+money(DELIVERY_CHARGE)+' delivery · Cash on Delivery available</div>'+
      (p.sizes&&p.sizes.length ? '<div class="pd-field"><label>'+escapeHtml(p.sizeLabel||'Size')+'</label><div class="size-opts">'+sizes+'</div></div>' : '')+
      '<div class="pd-field"><label>Quantity</label><div class="stepper" style="border-radius:9px;"><button onclick="pdQty(-1)">−</button><span id="pdQty">'+PD.qty+'</span><button onclick="pdQty(1)">+</button></div></div>'+
      '<div class="pd-actions">'+
        '<button class="btn btn-gold" onclick="pdAddToCart(false)">Add to Cart</button>'+
        '<button class="btn btn-navy" onclick="pdAddToCart(true)">Buy Now</button>'+
      '</div>'+
      (p.desc||details||p.note ? '<div class="pd-details">'+
        (p.desc?'<p>'+escapeHtml(p.desc)+'</p>':'')+
        (details?'<ul>'+details+'</ul>':'')+
        (p.note?'<div class="note">'+escapeHtml(p.note)+'</div>':'')+
        (p.productCode?'<div class="note" style="font-style:normal"><b>Product Code:</b> '+escapeHtml(p.productCode)+'</div>':'')+
      '</div>' : '')+
      '<button class="pd-share" onclick="shareProduct()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.8 7.5l6.4 3.7M8.8 16.5l6.4-3.7"/></svg>Share</button>'+
      '<div class="pd-reviews" id="pdReviews"><h4>Reviews &amp; Ratings</h4><p style="font-size:.8rem;color:var(--muted)">Loading…</p></div>'+
      '<div class="pd-related" id="pdRelated"></div>'+
    '</div>';
  loadProductReviews(p.id);
  renderRelatedProducts(p);
  injectProductSchema(p);
}
function injectProductSchema(p){
  let tag = document.getElementById('productSchemaTag');
  if(!tag){ tag = document.createElement('script'); tag.type='application/ld+json'; tag.id='productSchemaTag'; document.head.appendChild(tag); }
  tag.textContent = JSON.stringify({
    "@context":"https://schema.org",
    "@type":"Product",
    "name": p.name,
    "image": firstImg(p),
    "description": (p.desc||'').slice(0,300),
    "offers": {
      "@type":"Offer",
      "priceCurrency":"PKR",
      "price": p.price,
      "availability": (p.stockStatus==='out') ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "url": "https://alhadi.store/?product="+p.id
    }
  });
}
/* ---------- product comparison ---------- */
function getCompareIds(){
  try{ return JSON.parse(localStorage.getItem('ahs_compare')||'[]'); }catch(e){ return []; }
}
function setCompareIds(ids){ localStorage.setItem('ahs_compare', JSON.stringify(ids)); }
function toggleCompare(id){
  let ids = getCompareIds();
  if(ids.includes(id)){ ids = ids.filter(x=>x!==id); }
  else{
    if(ids.length>=3){ toast('Sirf 3 products tak compare kar sakte hain'); return; }
    ids.push(id);
  }
  setCompareIds(ids);
  renderProducts();
  renderCompareBar();
}
function renderCompareBar(){
  const bar = document.getElementById('compareBar');
  if(!bar) return;
  const ids = getCompareIds();
  if(ids.length < 2){ bar.classList.remove('show'); return; }
  bar.classList.add('show');
  const items = ids.map(id=>ALL_PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  document.getElementById('compareBarThumbs').innerHTML = items.map(p=>
    '<div class="cmp-thumb"><img src="'+firstImg(p)+'" alt=""><button onclick="toggleCompare(\''+p.id+'\')">&times;</button></div>'
  ).join('');
  document.getElementById('compareBarCount').textContent = ids.length+' selected';
}
function openCompareModal(){
  const ids = getCompareIds();
  const items = ids.map(id=>ALL_PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  if(items.length<2){ toast('Kam se kam 2 products select karein'); return; }
  const box = document.getElementById('compareTable');
  box.innerHTML =
    '<tr><th>Product</th>'+items.map(p=>'<td><img src="'+firstImg(p)+'" alt="" style="width:70px;height:70px;object-fit:cover;border-radius:8px;"><div style="font-size:.78rem;font-weight:600;margin-top:4px;">'+escapeHtml(p.name)+'</div></td>').join('')+'</tr>'+
    '<tr><th>Price</th>'+items.map(p=>'<td>'+money(p.price)+(p.oldPrice&&p.oldPrice>p.price?' <s style="color:var(--muted);font-size:.75rem;">'+money(p.oldPrice)+'</s>':'')+'</td>').join('')+'</tr>'+
    '<tr><th>Category</th>'+items.map(p=>'<td>'+escapeHtml(catLabel(p.category))+'</td>').join('')+'</tr>'+
    '<tr><th>Rating</th>'+items.map(p=>'<td>'+(p.rating?(p.rating+' ★'):'—')+'</td>').join('')+'</tr>'+
    '<tr><th>Stock</th>'+items.map(p=>'<td>'+((p.stockStatus==='out')?'Out of Stock':'In Stock')+'</td>').join('')+'</tr>'+
    '<tr><th></th>'+items.map(p=>'<td><button type="button" class="btn btn-gold" style="padding:7px 14px;font-size:.78rem;" onclick="closeCompareModal();openProduct(\''+p.id+'\')">View</button></td>').join('')+'</tr>';
  document.getElementById('compareModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeCompareModal(){
  document.getElementById('compareModal').classList.remove('open');
  document.body.style.overflow='';
}
function clearCompare(){ setCompareIds([]); renderProducts(); renderCompareBar(); }

/* ---------- hero banner ---------- */
let heroInterval = null, heroIdx = 0, HERO_BANNERS = [];
async function loadHeroBanners(){
  try{
    const snap = await firebase.firestore().collection('banners').where('active','==',true).orderBy('order','asc').get();
    HERO_BANNERS = []; snap.forEach(d=>HERO_BANNERS.push(Object.assign({_id:d.id}, d.data())));
    if(HERO_BANNERS.length) renderHeroBanners();
  }catch(e){ /* keep default hero on any error */ }
}
function renderHeroBanners(){
  const box = document.getElementById('heroBanner');
  if(!box || !HERO_BANNERS.length) return;
  clearInterval(heroInterval);
  box.innerHTML = HERO_BANNERS.map((b,i)=>
    '<div class="hero-slide'+(i===0?' active':'')+'" data-i="'+i+'">'+
      '<img src="'+b.imageUrl+'" alt="'+escapeHtml(b.title||'')+'">'+
      '<div class="hero-text">'+
        (b.title?'<span class="hero-kicker">Al Hadi Store</span><h2>'+escapeHtml(b.title)+'</h2>':'')+
        (b.subtitle?'<p>'+escapeHtml(b.subtitle)+'</p>':'')+
        '<a href="'+(b.link||'#shop')+'" class="btn btn-gold">Shop Now</a>'+
      '</div>'+
    '</div>'
  ).join('') + (HERO_BANNERS.length>1 ? '<div class="hero-dots">'+HERO_BANNERS.map((b,i)=>'<button class="'+(i===0?'active':'')+'" onclick="heroGo('+i+')"></button>').join('')+'</div>' : '');
  heroIdx = 0;
  if(HERO_BANNERS.length>1){ heroInterval = setInterval(()=>heroGo((heroIdx+1)%HERO_BANNERS.length), 4500); }
}
function heroGo(i){
  heroIdx = i;
  document.querySelectorAll('#heroBanner .hero-slide').forEach((el,idx)=>el.classList.toggle('active', idx===i));
  document.querySelectorAll('#heroBanner .hero-dots button').forEach((el,idx)=>el.classList.toggle('active', idx===i));
}

/* ---------- saved addresses ---------- */
let USER_ADDRESSES = [];
let addressesUnsub = null;
function watchAddresses(){
  if(addressesUnsub){ addressesUnsub(); addressesUnsub = null; }
  USER_ADDRESSES = [];
  if(!currentUser || typeof firebase === 'undefined' || !firebase.firestore) { renderAddressList(); return; }
  addressesUnsub = firebase.firestore().collection('users').doc(currentUser.uid).collection('addresses')
    .onSnapshot(function(snap){
      USER_ADDRESSES = snap.docs.map(d=>Object.assign({_id:d.id}, d.data()));
      renderAddressList();
      populateSavedAddressSelect();
    }, function(){ /* non-critical */ });
}
function renderAddressList(){
  const box = document.getElementById('addressList');
  if(!box) return;
  if(!USER_ADDRESSES.length){ box.innerHTML = '<p style="font-size:.8rem;color:var(--muted);">Koi address save nahi ki gayi.</p>'; return; }
  box.innerHTML = USER_ADDRESSES.map(a =>
    '<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">'+
      '<div><b style="font-size:.82rem;">'+escapeHtml(a.label||'Address')+'</b><div style="font-size:.78rem;color:var(--muted);margin-top:2px;">'+escapeHtml(a.fullName)+' · '+escapeHtml(a.phone)+'<br>'+escapeHtml(a.address)+'</div></div>'+
      '<button type="button" class="btn" style="padding:5px 10px;font-size:.74rem;background:#fde8e8;color:#c0392b;flex-shrink:0;" onclick="deleteAddress(\''+a._id+'\')">Delete</button>'+
    '</div>'
  ).join('');
}
function showAddAddressForm(){
  document.getElementById('addAddressForm').style.display = 'block';
}
async function submitAddAddress(e){
  e.preventDefault();
  if(!currentUser){ toast('Pehle login karein'); return false; }
  const data = {
    label: document.getElementById('addrLabel').value.trim(),
    fullName: document.getElementById('addrName').value.trim(),
    phone: document.getElementById('addrPhone').value.trim(),
    address: document.getElementById('addrFull').value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try{
    await firebase.firestore().collection('users').doc(currentUser.uid).collection('addresses').add(data);
    document.getElementById('addAddressForm').reset();
    document.getElementById('addAddressForm').style.display = 'none';
    toast('Address save ho gayi');
  }catch(e){ toast('Save nahi ho saki'); }
  return false;
}
async function deleteAddress(id){
  if(!confirm('Ye address delete karni hai?')) return;
  try{ await firebase.firestore().collection('users').doc(currentUser.uid).collection('addresses').doc(id).delete(); }
  catch(e){ toast('Delete nahi ho saki'); }
}
function populateSavedAddressSelect(){
  const picker = document.getElementById('savedAddressPicker');
  const sel = document.getElementById('savedAddressSelect');
  if(!picker || !sel) return;
  if(!USER_ADDRESSES.length){ picker.style.display='none'; return; }
  picker.style.display='block';
  sel.innerHTML = '<option value="">— Naya Address Likhein —</option>' +
    USER_ADDRESSES.map(a=>'<option value="'+a._id+'">'+escapeHtml(a.label||'Address')+' — '+escapeHtml(a.address.slice(0,40))+'</option>').join('');
}
function fillFromSavedAddress(id){
  if(!id) return;
  const a = USER_ADDRESSES.find(x=>x._id===id);
  if(!a) return;
  document.getElementById('cname').value = a.fullName || '';
  document.getElementById('cphone').value = a.phone || '';
  document.getElementById('caddress').value = a.address || '';
}

/* ---------- order status notifications ---------- */
let NOTIF_UNREAD = [];
let notifListeners = [];
function getSeenStatuses(){
  try{ return JSON.parse(localStorage.getItem('ahs_seen_status')||'{}'); }catch(e){ return {}; }
}
function setSeenStatuses(obj){ localStorage.setItem('ahs_seen_status', JSON.stringify(obj)); }
function watchMyOrdersForNotifications(){
  if(typeof firebase === 'undefined' || !firebase.firestore) return;
  notifListeners.forEach(u=>u());
  notifListeners = [];
  const ids = getMyOrderIds();
  const seen = getSeenStatuses();
  ids.forEach(function(id){
    const unsub = firebase.firestore().collection('orders').doc(id).onSnapshot(function(doc){
      if(!doc.exists) return;
      const status = doc.data().status || 'pending';
      const prev = seen[id];
      if(prev === undefined){
        seen[id] = status; setSeenStatuses(seen);
      } else if(prev !== status){
        NOTIF_UNREAD = NOTIF_UNREAD.filter(n=>n.id!==id);
        NOTIF_UNREAD.unshift({ id: id, status: status, items: doc.data().orderItems||'' });
        updateNotifBadge();
      }
    });
    notifListeners.push(unsub);
  });
}
function updateNotifBadge(){
  const el = document.getElementById('notifCount');
  if(!el) return;
  if(NOTIF_UNREAD.length){ el.style.display='flex'; el.textContent = NOTIF_UNREAD.length; }
  else { el.style.display='none'; }
}
function openNotifications(){
  const box = document.getElementById('notifList');
  if(!NOTIF_UNREAD.length){
    box.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:20px 4px;">Koi nayi update nahi hai. Jaise hi aapka order status update hoga, yahan dikhega.</p>';
  } else {
    box.innerHTML = NOTIF_UNREAD.map(n =>
      '<div style="border-bottom:1px solid var(--line);padding:12px 0;">'+
        '<b style="font-size:.85rem;">Order #'+n.id.slice(-6).toUpperCase()+'</b>'+
        '<div style="font-size:.8rem;color:var(--muted);margin-top:2px;">Status: '+ORDER_STATUS_LABELS[n.status]+'</div>'+
        '<div style="font-size:.78rem;color:var(--muted);margin-top:2px;">'+escapeHtml(n.items)+'</div>'+
      '</div>'
    ).join('');
  }
  document.getElementById('notifModal').classList.add('open');
  document.body.style.overflow='hidden';
  // mark all as seen
  const seen = getSeenStatuses();
  NOTIF_UNREAD.forEach(n=>{ seen[n.id] = n.status; });
  setSeenStatuses(seen);
  NOTIF_UNREAD = [];
  updateNotifBadge();
}
function closeNotifications(){
  document.getElementById('notifModal').classList.remove('open');
  document.body.style.overflow='';
}

function renderRelatedProducts(p){
  const box = document.getElementById('pdRelated'); if(!box) return;
  const related = ALL_PRODUCTS.filter(x => !x.hidden && !x.deleted && x.id!==p.id && catKey(x.category)===catKey(p.category)).slice(0,8);
  if(!related.length){ box.innerHTML=''; return; }
  box.innerHTML = '<h4>You may also like</h4><div class="product-row">'+related.map(renderProductCard).join('')+'</div>';
}

/* ---------- reviews & ratings ---------- */
let REVIEW_PICK = 5;
function starsHtml(n){
  let out='<span class="rv-stars">';
  for(let i=1;i<=5;i++){ out += i<=n ? starSvg() : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="opacity:.35"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.7l.9-5.4L4.2 8.7l5.4-.8z"/></svg>'; }
  return out+'</span>';
}
async function loadProductReviews(productId){
  const box = document.getElementById('pdReviews');
  if(!box) return;
  try{
    // NOTE: deliberately NOT chaining .orderBy('createdAt','desc') onto this
    // query. A where() + orderBy() on two different fields needs a Firestore
    // "composite index" that has to be created once in the Firebase console;
    // until that index exists, this call rejects with FAILED_PRECONDITION —
    // which the catch below was silently swallowing, so reviews always
    // showed "load nahi ho sake" even though the data/rules were fine.
    // Sorting client-side avoids needing that index at all.
    const snap = await firebase.firestore().collection('reviews').where('productId','==',productId).limit(50).get();
    const reviews = []; snap.forEach(d=>reviews.push(Object.assign({_id:d.id}, d.data())));
    reviews.sort((a,b)=>{
      const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    const avg = reviews.length ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length) : 0;
    REVIEW_PICK = 5;
    box.innerHTML =
      '<h4>Reviews &amp; Ratings</h4>'+
      (reviews.length ?
        '<div class="rv-summary"><span class="rv-avg">'+avg.toFixed(1)+'</span>'+starsHtml(Math.round(avg))+'<span style="font-size:.78rem;color:var(--muted)">('+reviews.length+' reviews)</span></div>'
        : '<p style="font-size:.82rem;color:var(--muted)">Abhi koi review nahi hai — pehla review aap likhein!</p>')+
      '<div id="rvList">'+reviews.map(r=>
        '<div class="rv-item">'+
          '<div class="rv-head"><span class="rv-name">'+escapeHtml(r.userName||'Customer')+'</span><span class="rv-date">'+(r.createdAt&&r.createdAt.toDate?r.createdAt.toDate().toLocaleDateString('en-PK'):'')+
            (isAdminLoggedIn()?' · <a href="javascript:void(0)" style="color:#c0392b;" onclick="deleteReview(\''+r._id+'\',\''+productId+'\')">Delete</a>':'')+
          '</span></div>'+
          starsHtml(r.rating||0)+
          (r.comment?'<p>'+escapeHtml(r.comment)+'</p>':'')+
        '</div>'
      ).join('')+'</div>'+
      '<div class="rv-form">'+
        '<div class="frow"><label>Apna rating dein</label><div class="rv-star-pick" id="rvStarPick"></div></div>'+
        '<div class="frow"><label for="rvName">Naam</label><input type="text" id="rvName" placeholder="Aapka naam"></div>'+
        '<div class="frow"><label for="rvComment">Review (optional)</label><textarea id="rvComment" rows="2" placeholder="Product kaisa laga?"></textarea></div>'+
        '<button type="button" class="btn btn-gold btn-block" onclick="submitReview(\''+productId+'\')">Review Submit Karein</button>'+
        '<div class="form-error" id="rvError" style="display:none;">Review submit nahi ho saka. Internet check karein.</div>'+
      '</div>';
    renderStarPicker();
  }catch(err){
    console.warn('loadProductReviews failed:', err);
    box.innerHTML = '<h4>Reviews &amp; Ratings</h4><p style="font-size:.8rem;color:var(--muted)">Reviews load nahi ho sake.</p>';
  }
}
function renderStarPicker(){
  const wrap = document.getElementById('rvStarPick'); if(!wrap) return;
  wrap.innerHTML = [1,2,3,4,5].map(i=>
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="'+(i<=REVIEW_PICK?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.6" style="color:var(--star)" onclick="pickReviewStar('+i+')"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.7l.9-5.4L4.2 8.7l5.4-.8z"/></svg>'
  ).join('');
}
function pickReviewStar(n){ REVIEW_PICK = n; renderStarPicker(); }
async function deleteReview(reviewId, productId){
  if(!confirm('Ye review delete karna hai?')) return;
  try{ await firebase.firestore().collection('reviews').doc(reviewId).delete(); loadProductReviews(productId); }
  catch(e){ toast('Delete nahi ho saka'); }
}
async function submitReview(productId){
  const errEl = document.getElementById('rvError');
  errEl.style.display='none';
  const name = (document.getElementById('rvName').value||'').trim() || 'Customer';
  const comment = (document.getElementById('rvComment').value||'').trim();
  const rating = REVIEW_PICK || 5;
  try{
    await firebase.firestore().collection('reviews').add({
      productId: productId,
      userName: name,
      rating: rating,
      comment: comment || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Shukriya! Aapka review submit ho gaya');
    loadProductReviews(productId);
  }catch(err){
    errEl.style.display='block';
  }
}
function pdGo(i){ PD.index=i; document.getElementById('pdMainImg').src = PD.product.images[i].src; document.querySelectorAll('#pdThumbs img').forEach((t,idx)=>t.classList.toggle('active',idx===i)); }
function pdSlide(d){ const n=PD.product.images.length; pdGo((PD.index+d+n)%n); }

/* ---------- fullscreen image zoom (pinch, double-tap, drag-to-pan) ---------- */
const ZM = { scale:1, x:0, y:0, startDist:0, startScale:1, startX:0, startY:0, panX:0, panY:0, dragging:false, lastTapTime:0 };
function zoomEls(){ return { overlay: document.getElementById('pdZoomOverlay'), img: document.getElementById('pdZoomImg'), stage: document.getElementById('pdZoomStage') }; }
function zoomApplyTransform(){
  const { img } = zoomEls();
  if(!img) return;
  img.style.transform = 'translate('+ZM.x+'px,'+ZM.y+'px) scale('+ZM.scale+')';
}
function zoomReset(instant){
  ZM.scale=1; ZM.x=0; ZM.y=0; ZM.panX=0; ZM.panY=0;
  const { img } = zoomEls();
  if(img){ if(instant) img.classList.add('no-transition'); zoomApplyTransform(); if(instant) requestAnimationFrame(()=>img.classList.remove('no-transition')); }
}
function openZoom(){
  if(!PD || !PD.product) return;
  const imgs = PD.product.images || [];
  if(!imgs.length) return;
  const { overlay, img } = zoomEls();
  if(!overlay || !img) return;
  img.src = imgs[PD.index].src;
  img.alt = PD.product.name || '';
  zoomReset(true);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  const nav = imgs.length > 1;
  document.getElementById('pdZoomPrev').style.display = nav ? 'flex' : 'none';
  document.getElementById('pdZoomNext').style.display = nav ? 'flex' : 'none';
}
function closeZoom(){
  const { overlay } = zoomEls();
  if(overlay) overlay.classList.remove('open');
  zoomReset(true);
  if(!document.getElementById('productModal').classList.contains('open')) document.body.style.overflow='';
  else document.body.style.overflow = 'hidden';
}
function zoomSlide(d){
  if(!PD || !PD.product) return;
  const n = PD.product.images.length; if(!n) return;
  pdGo((PD.index + d + n) % n);
  const { img } = zoomEls();
  if(img){ img.src = PD.product.images[PD.index].src; zoomReset(true); }
}
function zoomToggleDoubleTap(clientX, clientY){
  const { stage } = zoomEls();
  if(ZM.scale > 1){ zoomReset(false); return; }
  const rect = stage.getBoundingClientRect();
  ZM.scale = 2.5;
  ZM.x = (rect.width/2 - (clientX - rect.left)) * (ZM.scale - 1) / ZM.scale;
  ZM.y = (rect.height/2 - (clientY - rect.top)) * (ZM.scale - 1) / ZM.scale;
  zoomApplyTransform();
}
(function setupZoomGestures(){
  document.addEventListener('DOMContentLoaded', function(){
    const stage = document.getElementById('pdZoomStage');
    const overlay = document.getElementById('pdZoomOverlay');
    if(!stage || !overlay) return;

    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeZoom(); });

    stage.addEventListener('touchstart', function(e){
      if(e.touches.length === 2){
        const [a,b] = e.touches;
        ZM.startDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
        ZM.startScale = ZM.scale;
      } else if(e.touches.length === 1){
        const now = Date.now();
        if(now - ZM.lastTapTime < 300){
          zoomToggleDoubleTap(e.touches[0].clientX, e.touches[0].clientY);
        }
        ZM.lastTapTime = now;
        ZM.dragging = true;
        ZM.startX = e.touches[0].clientX - ZM.x;
        ZM.startY = e.touches[0].clientY - ZM.y;
      }
    }, { passive:true });

    stage.addEventListener('touchmove', function(e){
      if(e.touches.length === 2){
        e.preventDefault();
        const [a,b] = e.touches;
        const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
        ZM.scale = Math.min(5, Math.max(1, ZM.startScale * (dist / ZM.startDist)));
        zoomApplyTransform();
      } else if(e.touches.length === 1 && ZM.dragging && ZM.scale > 1){
        e.preventDefault();
        ZM.x = e.touches[0].clientX - ZM.startX;
        ZM.y = e.touches[0].clientY - ZM.startY;
        zoomApplyTransform();
      }
    }, { passive:false });

    stage.addEventListener('touchend', function(e){
      ZM.dragging = false;
      if(ZM.scale <= 1) zoomReset(false);
    });

    // desktop: double-click to toggle zoom, drag with mouse while zoomed
    stage.addEventListener('dblclick', function(e){ zoomToggleDoubleTap(e.clientX, e.clientY); });
    stage.addEventListener('mousedown', function(e){
      if(ZM.scale <= 1) return;
      ZM.dragging = true;
      ZM.startX = e.clientX - ZM.x;
      ZM.startY = e.clientY - ZM.y;
    });
    window.addEventListener('mousemove', function(e){
      if(!ZM.dragging || ZM.scale <= 1) return;
      ZM.x = e.clientX - ZM.startX;
      ZM.y = e.clientY - ZM.startY;
      zoomApplyTransform();
    });
    window.addEventListener('mouseup', function(){ ZM.dragging = false; });

    document.addEventListener('keydown', function(e){
      if(!overlay.classList.contains('open')) return;
      if(e.key === 'Escape') closeZoom();
      if(e.key === 'ArrowLeft') zoomSlide(-1);
      if(e.key === 'ArrowRight') zoomSlide(1);
    });
  });
})();
function pdSize(s){ PD.size=s; document.querySelectorAll('.size-opts button').forEach(b=>b.classList.toggle('active', b.textContent===s)); }
function pdQty(d){ PD.qty=Math.max(1,PD.qty+d); document.getElementById('pdQty').textContent=PD.qty; }
function pdAddToCart(buyNow){
  addToCart(PD.product, PD.size, PD.qty);
  closeProduct();
  if(buyNow){ openCheckout(); } else { openCart(); }
}

/* ---------- cart ---------- */
function loadCart(){ try{ CART = JSON.parse(localStorage.getItem('ahs_cart')||'[]'); }catch(e){ CART=[]; } }
function saveCart(){ try{ localStorage.setItem('ahs_cart', JSON.stringify(CART)); }catch(e){} }
function cartKey(id,size){ return id+'::'+(size||''); }
function addToCart(p, size, qty){
  qty = qty||1;
  trackEvent('add_to_cart', p.id);
  const key = cartKey(p.id, size);
  const found = CART.find(i => i.key===key);
  if(found){ found.qty += qty; }
  else { CART.push({ key, id:p.id, name:p.name, price:p.price, size:size||'', img:firstImg(p), qty }); }
  saveCart(); updateCartUI();
  toast('Added to cart');
}
function quickAdd(id){
  const p = ALL_PRODUCTS.find(x=>x.id===id); if(!p) return;
  const outOfStock = (p.stockStatus==='out') || (p.stockQty!=null && p.stockQty<=0);
  if(outOfStock){ toast('Ye product abhi stock mein nahi hai'); return; }
  // if product has sizes, open detail so user can choose; else add directly
  if(p.sizes && p.sizes.length){ openProduct(id); }
  else { addToCart(p, '', 1); }
}
function cartQty(){ return CART.reduce((s,i)=>s+i.qty,0); }
function cartSubtotal(){ return CART.reduce((s,i)=>s+i.price*i.qty,0); }
function changeQty(key, d){
  const it = CART.find(i=>i.key===key); if(!it) return;
  it.qty += d; if(it.qty<1){ CART = CART.filter(i=>i.key!==key); }
  saveCart(); updateCartUI();
}
function removeItem(key){ CART = CART.filter(i=>i.key!==key); saveCart(); updateCartUI(); }

function updateCartUI(){
  const n = cartQty();
  ['cartCount','bnCount'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.textContent=n; el.dataset.n=n; } });

  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');
  if(CART.length===0){
    body.innerHTML = '<div class="cart-empty"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L22 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg><b>Cart khaali hai</b><p>Products dhundho aur shopping shuru karo!</p></div>';
    foot.style.display='none';
  } else {
    body.innerHTML = CART.map(it =>
      '<div class="citem">'+
        '<img src="'+it.img+'" alt="'+escapeHtml(it.name)+'">'+
        '<div class="citem-info">'+
          '<h4>'+escapeHtml(it.name)+'</h4>'+
          (it.size?'<div class="csize">Size: '+escapeHtml(it.size)+'</div>':'')+
          '<div class="cprice">'+money(it.price)+'</div>'+
          '<div class="citem-bottom">'+
            '<div class="stepper"><button onclick="changeQty(\''+it.key+'\',-1)">−</button><span>'+it.qty+'</span><button onclick="changeQty(\''+it.key+'\',1)">+</button></div>'+
            '<button class="link-del" onclick="removeItem(\''+it.key+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16M9 11v6M15 11v6M9 7l.8-2.4c.3-.8 1-1.3 2-1.3h2.4c1 0 1.7.5 2 1.3l.8 2.4"/></svg></button>'+
          '</div>'+
        '</div>'+
      '</div>'
    ).join('');
    foot.style.display='block';
    const sub = cartSubtotal();
    document.getElementById('cartSubtotal').textContent = money(sub);
    document.getElementById('cartDelivery').textContent = money(DELIVERY_CHARGE);
    document.getElementById('cartTotal').textContent = money(sub+DELIVERY_CHARGE);
  }
}
function openCart(){ updateCartUI(); document.getElementById('cartOverlay').classList.add('open'); document.getElementById('cartDrawer').classList.add('open'); document.body.style.overflow='hidden'; }
function closeCart(){ document.getElementById('cartOverlay').classList.remove('open'); document.getElementById('cartDrawer').classList.remove('open'); document.body.style.overflow=''; }

/* ---------- checkout ---------- */
function openCheckout(){
  if(CART.length===0){ closeCart(); openCart(); toast('Your cart is empty'); return; }
  buildCheckoutSummary();
  // reset steps
  document.getElementById('orderForm').style.display='block';
  document.getElementById('paymentStep').classList.remove('show');
  document.getElementById('finalStep').classList.remove('show');
  document.getElementById('slipSection').style.display='none';
  document.getElementById('codSection').style.display='none';
  const ci=document.getElementById('couponInput'); if(ci) ci.value = APPLIED_COUPON ? APPLIED_COUPON.code : '';
  const cm=document.getElementById('couponMsg'); if(cm){ cm.className='coupon-msg'; cm.textContent=''; }
  closeCart();
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeCheckout(){ document.getElementById('checkoutModal').classList.remove('open'); document.body.style.overflow=''; }

function buildCheckoutSummary(){
  const lines = document.getElementById('coLines');
  lines.innerHTML = CART.map(it =>
    '<div class="co-line"><img src="'+it.img+'" alt=""><div class="m"><h5>'+escapeHtml(it.name)+'</h5><small>'+(it.size?'Size: '+escapeHtml(it.size)+' · ':'')+'Qty: '+it.qty+'</small></div><div class="r">'+money(it.price*it.qty)+'</div></div>'
  ).join('');
  const sub = cartSubtotal();
  const discount = couponDiscountAmount(sub);
  const total = Math.max(0, sub - discount) + DELIVERY_CHARGE;
  document.getElementById('coItems').textContent = money(sub);
  document.getElementById('coDelivery').textContent = money(DELIVERY_CHARGE);
  const discRow = document.getElementById('coDiscountRow');
  if(discRow){
    if(discount>0){ discRow.style.display='flex'; document.getElementById('coDiscount').textContent = '- '+money(discount); }
    else { discRow.style.display='none'; }
  }
  document.getElementById('coTotal').textContent = money(total);
  // hidden fields for the email
  document.getElementById('fOrderItems').value = CART.map(it => it.name+(it.size?' ('+it.size+')':'')+' x'+it.qty+' = '+money(it.price*it.qty)).join('\n');
  document.getElementById('fItemsTotal').value = money(sub);
  document.getElementById('fTotal').value = money(total);
  document.getElementById('finalTotal').textContent = money(total);
  const couponField = document.getElementById('fCoupon');
  if(couponField) couponField.value = APPLIED_COUPON ? (APPLIED_COUPON.code+' (-'+money(discount)+')') : 'None';
}

/* ---------- coupons ---------- */
function couponDiscountAmount(sub){
  if(!APPLIED_COUPON) return 0;
  const c = APPLIED_COUPON;
  let amt = c.type==='percent' ? Math.round(sub * (c.value/100)) : c.value;
  amt = Math.max(0, Math.min(amt, sub));
  return amt;
}
async function applyCoupon(){
  const input = document.getElementById('couponInput');
  const msg = document.getElementById('couponMsg');
  const code = (input.value||'').trim().toUpperCase();
  msg.className = 'coupon-msg';
  if(!code){ msg.textContent = 'Coupon code likhein'; msg.classList.add('show','err'); return; }
  msg.textContent = 'Check kar rahe hain…'; msg.classList.add('show');
  try{
    const doc = await firebase.firestore().collection('coupons').doc(code).get();
    if(!doc.exists){ APPLIED_COUPON = null; msg.textContent = 'Ye coupon valid nahi hai'; msg.classList.add('err'); buildCheckoutSummary(); return; }
    const c = doc.data();
    const sub = cartSubtotal();
    if(!c.active){ msg.textContent='Ye coupon abhi active nahi hai'; msg.classList.add('err'); buildCheckoutSummary(); return; }
    if(c.expiresAt && c.expiresAt.toDate && c.expiresAt.toDate() < new Date()){ msg.textContent='Is coupon ki miyaad khatam ho chuki hai'; msg.classList.add('err'); buildCheckoutSummary(); return; }
    if(c.usageLimit!=null && (c.usedCount||0) >= c.usageLimit){ msg.textContent='Ye coupon apni limit tak use ho chuka hai'; msg.classList.add('err'); buildCheckoutSummary(); return; }
    if(c.minOrder && sub < c.minOrder){ msg.textContent='Kam se kam order '+money(c.minOrder)+' ka hona chahiye'; msg.classList.add('err'); buildCheckoutSummary(); return; }
    APPLIED_COUPON = { code: code, type: c.type, value: c.value };
    msg.textContent = 'Coupon apply ho gaya! 🎉';
    msg.classList.add('ok');
    buildCheckoutSummary();
  }catch(err){
    msg.textContent = 'Internet check karein — coupon check nahi ho saka';
    msg.classList.add('err');
  }
}
function removeCoupon(){
  APPLIED_COUPON = null;
  const input = document.getElementById('couponInput'); if(input) input.value='';
  const msg = document.getElementById('couponMsg'); if(msg){ msg.className='coupon-msg'; msg.textContent=''; }
  buildCheckoutSummary();
}
async function bumpCouponUsage(code){
  if(!code) return;
  try{
    await firebase.firestore().collection('coupons').doc(code).update({ usedCount: firebase.firestore.FieldValue.increment(1) });
  }catch(e){ /* non-critical */ }
}

function selPay(radio){
  document.querySelectorAll('.pay-opt').forEach(o=>o.classList.remove('sel'));
  radio.closest('.pay-opt').classList.add('sel');
}

/* ========== MODIFIED: Order Form with Google Sheets + Firestore order tracking ========== */
let LAST_ORDER_ID = null;
document.getElementById('orderForm').addEventListener('submit', function(e){
  e.preventDefault();
  const form = this;
  const btn = document.getElementById('submitBtn');
  const err = document.getElementById('formError');
  err.classList.remove('show');
  if(!form.checkValidity()){ form.reportValidity(); return; }
  btn.textContent='Placing Order…'; btn.disabled=true;

  // Collect all order data
  const sub = cartSubtotal();
  const discount = couponDiscountAmount(sub);
  const orderData = {
    timestamp: new Date().toLocaleString('en-PK'),
    fullName: document.getElementById('cname').value.trim(),
    phone: document.getElementById('cphone').value.trim(),
    email: document.getElementById('cemail').value.trim() || 'N/A',
    address: document.getElementById('caddress').value.trim(),
    paymentMethod: form.querySelector('input[name="Payment Method"]:checked').value,
    notes: document.getElementById('cnotes').value.trim() || 'N/A',
    orderItems: CART.map(it => it.name+(it.size?' ('+it.size+')':'')+' x'+it.qty).join(', '),
    itemsTotal: sub,
    couponCode: APPLIED_COUPON ? APPLIED_COUPON.code : null,
    discount: discount,
    delivery: DELIVERY_CHARGE,
    totalAmount: Math.max(0, sub - discount) + DELIVERY_CHARGE,
    adminPhone: '923134586476'
  };

  // Send to Google Sheets first (in background)
  sendOrderToGoogleSheets(orderData);

  // Save order to Firestore so it can be tracked later (admin + customer)
  saveOrderToFirestore(orderData);
  if(APPLIED_COUPON){ bumpCouponUsage(APPLIED_COUPON.code); }

  // Then send email via formsubmit (existing functionality)
  fetch('https://formsubmit.co/ajax/qraza2376@gmail.com',{
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(form)))
  })
  .then(r=>r.json())
  .then(()=>{
    form.style.display='none';
    document.getElementById('paymentStep').classList.add('show');
    const method = form.querySelector('input[name="Payment Method"]:checked').value;
    if(method==='Online Payment'){
      document.getElementById('payStepMsg').textContent = 'Please send your payment to any account below, then upload the slip.';
      document.getElementById('slipSection').style.display='block';
    } else {
      document.getElementById('payStepMsg').textContent = 'You chose Cash on Delivery — just confirm your order below.';
      document.getElementById('codSection').style.display='block';
    }
  })
  .catch(()=>{ err.classList.add('show'); btn.textContent='Place Order'; btn.disabled=false; });
});

/* ========== Order tracking: Firestore save + local "my orders" list ========== */
function getMyOrderIds(){
  try{ return JSON.parse(localStorage.getItem('ahs_my_orders')||'[]'); }catch(e){ return []; }
}
function addMyOrderId(id){
  try{
    const ids = getMyOrderIds();
    if(ids.indexOf(id)===-1){ ids.unshift(id); localStorage.setItem('ahs_my_orders', JSON.stringify(ids.slice(0,50))); }
  }catch(e){}
  watchMyOrdersForNotifications();
}
function saveOrderToFirestore(orderData){
  if(typeof firebase === 'undefined' || !firebase.firestore){ return; }
  const record = Object.assign({}, orderData, {
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: (currentUser && currentUser.uid) ? currentUser.uid : null
  });
  firebase.firestore().collection('orders').add(record)
    .then(function(docRef){
      LAST_ORDER_ID = docRef.id;
      addMyOrderId(docRef.id);
    })
    .catch(function(error){
      console.warn('⚠️ Order could not be saved for tracking (non-blocking):', error);
    });
}

/* ========== Google Sheets Integration Function ========== */
function sendOrderToGoogleSheets(orderData) {
  // اگر URL setup نہیں ہوا تو صرف console میں log کریں
  if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'YOUR_GOOGLE_SHEETS_URL_HERE') {
    console.log('📊 Order Data (Google Sheets setup pending):', orderData);
    return;
  }

  // Google Sheets App Script کو POST request بھیجیں
  fetch(GOOGLE_SHEETS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData)
  })
  .then(() => {
    console.log('✅ Order saved to Google Sheets:', orderData);
  })
  .catch((error) => {
    console.warn('⚠️ Google Sheets sync issue (non-blocking):', error);
  });
}

/* slip upload via hidden iframe */
const slipForm = document.getElementById('slipForm');
const slipIframe = document.querySelector('iframe[name="slipIframe"]');
let slipSubmitted = false;
slipForm.addEventListener('submit', function(){
  const btn=document.getElementById('slipBtn');
  document.getElementById('slipError').classList.remove('show');
  btn.textContent='Sending…'; btn.disabled=true; slipSubmitted=true;
});
slipIframe.addEventListener('load', function(){ if(slipSubmitted) finalSuccess(); });

function finalSuccess(){
  document.getElementById('paymentStep').classList.remove('show');
  document.getElementById('finalStep').classList.add('show');
  CART = []; saveCart(); updateCartUI();
  APPLIED_COUPON = null;
}

/* ---------- share ---------- */
/* Turns a base64 data: URI (how product photos are stored) into a File,
   synchronously — kept sync so it runs inside the same click gesture that
   navigator.share() needs; an await/fetch() here can make some browsers
   (notably iOS Safari) reject the share as "not user-initiated". */
function dataURLtoFile(dataURL, baseName){
  const commaIdx = dataURL.indexOf(',');
  const header = dataURL.slice(0, commaIdx);
  const base64 = dataURL.slice(commaIdx+1);
  const mimeMatch = /:(.*?);/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg','jpg');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++){ bytes[i] = binary.charCodeAt(i); }
  return new File([bytes], baseName+'.'+ext, {type: mime});
}
function slugify(s){
  return String(s||'product').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,40) || 'product';
}
/* Fetches an ordinary image URL (relative path like "assets/products/x.webp",
   or a Cloudinary/https URL) and turns it into a File — the async counterpart
   of dataURLtoFile() above, for the (much more common) case where a product's
   image ISN'T a base64 data: URI. */
async function urlToFile(url, baseName){
  const res = await fetch(url, {mode:'cors'});
  if(!res.ok) throw new Error('image fetch failed: ' + res.status);
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg','jpg');
  return new File([blob], baseName+'.'+ext, {type: blob.type || 'image/jpeg'});
}
/* THE FIX for "share sends the link, not the product photo":
   shareProduct() must call navigator.share() synchronously inside the click
   handler (see note above dataURLtoFile), so it can't itself await a fetch()
   for products whose image is a normal URL rather than a data: URI — nearly
   every product in products-data.js is exactly that (e.g. "assets/products/
   prod-ishq-tshirt-1.webp"). The old code tried to run that URL through
   dataURLtoFile() anyway, which threw, was silently swallowed by the catch,
   and fell back to the link-only share — so WhatsApp/Instagram showed the
   site's generic preview card instead of the product picture.
   Fix: prefetch + convert the image to a File as soon as the product modal
   opens (prefetchShareImage, called from openProduct), well before the user
   taps Share. By share time the File is already sitting in memory, so
   navigator.share() can still be called synchronously with it. */
function prefetchShareImage(p){
  const src = firstImg(p);
  if(!src) return;
  const baseName = slugify(p.name || p.id);
  if(/^data:/i.test(src)){
    // Already inline base64 (e.g. an admin-uploaded photo) — convert now, synchronously.
    try{ PD.shareFile = dataURLtoFile(src, baseName); PD.shareFileFor = p.id; }catch(e){}
    return;
  }
  let absUrl = src;
  try{ absUrl = new URL(src, location.href).toString(); }catch(e){}
  urlToFile(absUrl, baseName).then(function(file){
    // Guard against the user having switched to a different product while this was loading.
    if(PD.product && PD.product.id === p.id){ PD.shareFile = file; PD.shareFileFor = p.id; }
  }).catch(function(){ /* leave shareFile null — shareProduct() falls back to link-only */ });
}
function shareProduct(){
  const p = PD.product; if(!p) return;
  const url = productShareURL(p.id);
  // Caption WITHOUT the link — used when url is passed as its own share field,
  // so the link never gets printed twice in the shared message.
  const caption = p.name+' — '+money(p.price)+'\n'+(p.desc?p.desc+'\n':'');
  // Caption WITH the link embedded — used only for the clipboard/prompt fallback,
  // where there's no separate url field to rely on.
  const textWithUrl = caption+'\nAl Hadi Store: '+url;
  const file = (PD.shareFileFor === p.id) ? PD.shareFile : null;

  // Try sharing WITH the product photo attached, so apps like WhatsApp show the picture inline.
  if(navigator.share && file){
    try{
      if(navigator.canShare && navigator.canShare({files:[file]})){
        // url isn't passed here: most share targets ignore `url` once files are
        // attached, but WhatsApp/iOS can still tack it on as an extra line
        // alongside the caption, printing the link twice.
        navigator.share({title:p.name, text: textWithUrl, files:[file]}).catch(()=>{});
        return;
      }
    }catch(e){ /* fall through to text/link share below */ }
  }
  // Fallback: text + link only (device/browser can't attach a file to a share,
  // or the image hadn't finished prefetching yet). Pass the link ONLY via `url`
  // (not embedded in `text` too) — the receiving app appends `url` on its own,
  // so embedding it in `text` as well is what caused the link to show up twice.
  if(navigator.share){ navigator.share({title:p.name, text: caption+'\nAl Hadi Store:', url}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(textWithUrl).then(()=>toast('Copied — paste to share')).catch(()=>prompt('Copy to share:',textWithUrl)); }
  else { prompt('Copy to share:', textWithUrl); }
}

/* ---------- toast ----------
   type: 'info' (default, navy) | 'success' (green) | 'error' (red) —
   purely a background-color change via CSS class, no markup change needed. */
let toastT;
function toast(msg, type){
  const t=document.getElementById('toast');
  document.getElementById('toastMsg').textContent=msg;
  t.classList.remove('toast-success','toast-error','toast-info');
  if(type==='success') t.classList.add('toast-success');
  else if(type==='error') t.classList.add('toast-error');
  t.classList.add('show'); clearTimeout(toastT);
  toastT=setTimeout(()=>t.classList.remove('show'), type==='error' ? 3200 : 2200);
}

/* Toggles a button into/out of a "loading" state: disables it, swaps its
   label for a spinner + custom text, and restores the original label
   afterwards. Used across every auth form so the person always gets
   immediate feedback that their tap registered. */
function setBtnLoading(btn, loading, loadingText){
  if(!btn) return;
  if(loading){
    if(!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span>' + (loadingText || 'Please wait…');
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    if(btn.dataset.originalHtml){ btn.innerHTML = btn.dataset.originalHtml; }
  }
}

/* ---------- misc ---------- */
function scrollToTop(){ window.scrollTo({top:0,behavior:'smooth'}); }
/* Bottom-nav "Spotlight" tab: jump to whichever highlighted/deals section
   is currently populated, falling back to the main product grid. */
function goSpotlight(){
  const ids = ['flashSaleSec','newArrivalsSec','bestSellersSec','shop'];
  for(const id of ids){
    const el = document.getElementById(id);
    if(el && el.style.display !== 'none'){ el.scrollIntoView({behavior:'smooth'}); return; }
  }
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeNotifications(); closeCompareModal(); closeInvoice(); closeProduct(); closeCheckout(); closeCart(); closeAdminLogin(); closeAdminPanel(); closeAccount(); closeOrdersModal(); } });
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- account (Firebase Auth) + liked products ---------- */
let likesUnsub = null;

function friendlyAuthError(error){
  const code = error && error.code;
  // Always log the real Firebase error code/message to console — makes future
  // debugging fast instead of guessing from the generic fallback message.
  console.error('Firebase Auth error:', code, error && error.message);
  const map = {
    'auth/email-already-in-use':'Ye email pehle se registered hai — Login karein.',
    'auth/invalid-email':'Email sahi format mein likhein.',
    'auth/missing-email':'Email likhna zaroori hai.',
    'auth/weak-password':'Password kam az kam 6 characters ka hona chahiye.',
    'auth/user-not-found':'Ye email registered nahi hai — pehle account banayein.',
    'auth/wrong-password':'Password ghalat hai.',
    'auth/invalid-credential':'Email ya password ghalat hai.',
    'auth/invalid-login-credentials':'Email ya password ghalat hai.',
    'auth/missing-password':'Password likhna zaroori hai.',
    'auth/too-many-requests':'Bohot zyada koshishein — thori dair baad try karein.',
    'auth/network-request-failed':'Internet connection check karein.',
    'auth/unauthorized-domain':'Ye website domain Firebase mein authorize nahi hai. Firebase Console > Authentication > Settings > Authorized domains mein ye domain add karein.',
    'auth/operation-not-allowed':'Email/Password login abhi Firebase Console mein enable nahi hai. Authentication > Sign-in method mein Email/Password ko enable karein.',
    'auth/user-disabled':'Ye account disable kar diya gaya hai.',
    'auth/requires-recent-login':'Security ke liye dobara login karein.',
    'auth/popup-closed-by-user':'Popup band ho gayi — dobara koshish karein.',
    'auth/cancelled-popup-request':'Pehli request abhi chal rahi thi — dobara tap karein.',
    'auth/popup-blocked':'Browser ne popup block kar di — popups is site ke liye allow karein.',
    'auth/quota-exceeded':'Abhi bohot zyada requests aa rahi hain — thori dair baad try karein.',
    // Not a real Firebase Auth code — set locally when we sign an
    // unverified user back out immediately after a successful password
    // check, so the message + resend-link UI stay consistent everywhere.
    'auth/email-not-verified':'Pehle apna email verify karein — hum ne aapko verification link bheja tha, apna inbox (aur spam folder) check karein.'
  };
  return (code && map[code]) || ('Kuch masla ho gaya, dobara koshish karein.' + (code ? ' (' + code + ')' : ''));
}

/* Holds the credentials of the last login attempt that failed because the
   account's email wasn't verified yet, purely so "Resend verification
   email" can silently re-authenticate and re-send without making the
   person type their password again. Cleared right after use — the signed-
   out User object from the failed attempt can't be trusted to still hold
   a valid token, so we re-sign-in instead of reusing that object. */
let unverifiedLoginAttempt = null;

function openAccount(){
  document.getElementById('accountModal').classList.add('open');
  document.body.style.overflow='hidden';
  updateAccountUI();
}
function closeAccount(){
  document.getElementById('accountModal').classList.remove('open');
  document.body.style.overflow='';
  ['liError','suError'].forEach(id=>{ const e=document.getElementById(id); if(e){ e.classList.remove('show'); e.textContent=''; } });
  hideForgotPassword();
  const resendWrap = document.getElementById('liResendWrap');
  if(resendWrap) resendWrap.style.display = 'none';
  unverifiedLoginAttempt = null;
}
function switchAccTab(tab){
  hideForgotPassword();
  document.querySelectorAll('.acc-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.acc-pane').forEach(p=>{ if(p.id!=='accPane-forgot') p.classList.toggle('show', p.id==='accPane-'+tab); });
}

function updateAccountUI(){
  const out = document.getElementById('accLoggedOut');
  const inn = document.getElementById('accLoggedIn');
  const btn = document.querySelector('.account-btn');
  if(!out || !inn) return;
  if(currentUser){
    out.style.display='none';
    inn.style.display='block';
    document.getElementById('accEmail').textContent = currentUser.email || '';
    renderLikedGrid();
    watchAddresses();
  } else {
    out.style.display='block';
    inn.style.display='none';
    watchAddresses();
  }
  if(btn) btn.classList.toggle('logged-in', !!currentUser);
}

function isMobileDevice(){
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
// Instagram / Facebook / Messenger / TikTok's built-in browser (opened when
// someone taps a link inside those apps) is a "disallowed" embedded webview
// as far as Google is concerned — Google refuses OAuth logins from it on
// EVERY platform (iOS and Android alike), full stop, by design, not a bug
// we can code around. Detecting it lets us tell the person what's actually
// wrong instead of a confusing silent failure that looks device-specific.
function isInAppBrowser(){
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok/i.test(navigator.userAgent);
}
function signInWithGoogle(){
  const err1 = document.getElementById('liError');
  const err2 = document.getElementById('suError');
  [err1,err2].forEach(function(e){ if(e) e.classList.remove('show'); });
  if(typeof firebase === 'undefined' || !firebase.auth){
    toast('Internet check karein');
    window.showDebugError && window.showDebugError('Google Sign-In', 'Firebase SDK load nahi hua (firebase undefined)');
    return;
  }
  if(isInAppBrowser()){
    // Same message, same behavior, on iOS and Android alike — Google blocks
    // this everywhere in these embedded browsers, so there's nothing to
    // retry here; the fix is opening the link in the real browser.
    toast('Ye link Instagram/Facebook ke andar khula hai — Google login yahan nahi chalta. Upar-right "•••" menu se "Open in Browser" / "Open in Safari" chunein.');
    return;
  }
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    // Popup first — on EVERY device, including mobile. Redirect looks safer
    // on paper, but on iOS Safari it silently fails even with a correctly
    // authorized domain: the auth.firebaseapp.com handler page relies on
    // cross-domain storage/cookies to hand the result back to this origin,
    // and Safari's tracking-prevention blocks exactly that, with no error —
    // getRedirectResult() just resolves with no user. Popup doesn't have
    // that problem, and modern mobile Safari/Chrome allow popups just fine
    // when triggered synchronously from a real tap, which this is.
    firebase.auth().signInWithPopup(provider)
      .then(function(){
        closeAccount();
        toast('Login ho gaye — khush aamdeed!', 'success');
      })
      .catch(function(error){
        const code = error && error.code;
        const popupFailedToOpen = code === 'auth/popup-blocked'
          || code === 'auth/operation-not-supported-in-this-environment'
          || code === 'auth/cancelled-popup-request';
        if(popupFailedToOpen && isMobileDevice()){
          // Only fall back to redirect when the popup genuinely couldn't
          // open (e.g. an in-app browser like Instagram/Facebook's webview
          // that disallows window.open). A user closing the popup on
          // purpose (auth/popup-closed-by-user) should NOT trigger this —
          // that just means they changed their mind.
          toast('Google par bhej rahe hain…');
          firebase.auth().signInWithRedirect(provider).catch(function(redirectError){
            window.showDebugError && window.showDebugError('Google Redirect', (redirectError&&redirectError.code)+': '+(redirectError&&redirectError.message));
            toast(friendlyAuthError(redirectError));
          });
          return;
        }
        const msg = friendlyAuthError(error);
        if(err1){ err1.textContent = msg; err1.classList.add('show'); }
        toast(msg);
        window.showDebugError && window.showDebugError('Google Popup', code+': '+(error&&error.message));
      });
  }catch(error){
    window.showDebugError && window.showDebugError('Google Sign-In (sync)', (error&&error.message)||String(error));
    toast('Kuch masla ho gaya');
  }
}
// Completes sign-in after returning from Google's redirect page (mobile flow)
try{
  if(typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth){
    firebase.auth().getRedirectResult().then(function(result){
      if(result && result.user){
        toast('Login ho gaye — khush aamdeed!', 'success');
      } else {
        // Resolves with no user on EVERY normal page load too (not just after
        // a Google redirect), so this stays a quiet console log rather than a
        // visible banner. If you land here right after tapping "Continue with
        // Google" and see no user, the most likely cause is that this domain
        // isn't in Firebase Console > Authentication > Settings > Authorized
        // domains — Firebase/Google then silently drops the redirect result.
        console.debug('getRedirectResult: no pending redirect / no user.');
      }
    }).catch(function(error){
      if(error && error.code && error.code !== 'auth/no-auth-event'){
        toast(friendlyAuthError(error));
        window.showDebugError && window.showDebugError('Redirect Result', error.code+': '+error.message);
      }
    });
  }
}catch(error){
  window.showDebugError && window.showDebugError('Redirect Result (sync)', (error&&error.message)||String(error));
}

function submitLogin(e){
  e.preventDefault();
  const email = document.getElementById('liEmail').value.trim();
  const pass = document.getElementById('liPass').value;
  const err = document.getElementById('liError');
  const resendWrap = document.getElementById('liResendWrap');
  const btn = document.getElementById('liSubmitBtn');
  err.classList.remove('show');
  if(resendWrap) resendWrap.style.display = 'none';
  if(typeof firebase === 'undefined' || !firebase.auth){
    err.textContent = 'Login abhi kaam nahi kar raha — internet check karein.';
    err.classList.add('show');
    return false;
  }
  setBtnLoading(btn, true, 'Login ho raha hai…');
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(function(cred){
      // Email/password accounts must verify their email before they can
      // use the site (Google accounts are already verified by Google and
      // never hit this function, so they're unaffected).
      if(!cred.user.emailVerified){
        unverifiedLoginAttempt = {email: email, pass: pass};
        return firebase.auth().signOut().then(function(){
          err.textContent = friendlyAuthError({code:'auth/email-not-verified'});
          err.classList.add('show');
          if(resendWrap) resendWrap.style.display = 'block';
        });
      }
      unverifiedLoginAttempt = null;
      closeAccount();
      document.getElementById('loginForm').reset();
      toast('Login ho gaye — khush aamdeed!', 'success');
    })
    .catch(function(error){
      err.textContent = friendlyAuthError(error);
      err.classList.add('show');
    })
    .finally(function(){ setBtnLoading(btn, false); });
  return false;
}

/* Re-sends the verification email for a login attempt that was just
   rejected for being unverified. Re-authenticates with the stored
   credentials (rather than reusing the now-signed-out User object, whose
   token can't be trusted), sends the email, then signs back out again. */
function resendVerificationEmail(){
  const err = document.getElementById('liError');
  const resendWrap = document.getElementById('liResendWrap');
  if(!unverifiedLoginAttempt){
    toast('Pehle login try karein, phir resend karein', 'error');
    return;
  }
  const resendBtn = document.getElementById('liResendBtn');
  setBtnLoading(resendBtn, true, 'Bhej rahe hain…');
  const attempt = unverifiedLoginAttempt;
  let signedInUser = null;
  firebase.auth().signInWithEmailAndPassword(attempt.email, attempt.pass)
    .then(function(cred){
      signedInUser = cred.user;
      return cred.user.sendEmailVerification();
    })
    .then(function(){
      return firebase.auth().signOut();
    })
    .then(function(){
      toast('Verification email dobara bhej diya gaya — apna inbox check karein.', 'success');
      if(resendWrap) resendWrap.style.display = 'none';
      unverifiedLoginAttempt = null;
    })
    .catch(function(error){
      // If credentials changed since the original attempt, sign whatever
      // did get signed in back out before surfacing the error.
      if(signedInUser){ firebase.auth().signOut().catch(function(){}); }
      err.textContent = friendlyAuthError(error);
      err.classList.add('show');
    })
    .finally(function(){ setBtnLoading(resendBtn, false); });
}

function submitSignup(e){
  e.preventDefault();
  const email = document.getElementById('suEmail').value.trim();
  const pass = document.getElementById('suPass').value;
  const err = document.getElementById('suError');
  const btn = document.getElementById('suSubmitBtn');
  err.classList.remove('show');
  if(typeof firebase === 'undefined' || !firebase.auth){
    err.textContent = 'Account banana abhi kaam nahi kar raha — internet check karein.';
    err.classList.add('show');
    return false;
  }
  if(pass.length < 6){
    err.textContent = 'Password kam az kam 6 characters ka hona chahiye.';
    err.classList.add('show');
    return false;
  }
  setBtnLoading(btn, true, 'Account ban raha hai…');
  firebase.auth().createUserWithEmailAndPassword(email, pass)
    .then(function(cred){
      return cred.user.sendEmailVerification();
    })
    .then(function(){
      // Sign the brand-new account back out immediately — per store policy
      // an account can't be used to log in until its email is verified,
      // so there's no reason to leave it signed in here either.
      return firebase.auth().signOut();
    })
    .then(function(){
      document.getElementById('signupForm').reset();
      switchAccTab('login');
      const liErr = document.getElementById('liError');
      liErr.textContent = 'Account ban gaya! Hum ne ' + email + ' par ek verification link bheja hai — link par tap kar ke email verify karein, phir login karein.';
      liErr.classList.add('show');
      toast('Account ban gaya — email verify karein', 'success');
    })
    .catch(function(error){
      err.textContent = friendlyAuthError(error);
      err.classList.add('show');
    })
    .finally(function(){ setBtnLoading(btn, false); });
  return false;
}

function logoutUser(){
  if(typeof firebase === 'undefined' || !firebase.auth) return;
  firebase.auth().signOut().then(function(){
    closeAccount();
    toast('Aap logout ho gaye', 'success');
  });
}

/* Toggles a password <input>'s type between password/text and swaps the
   pressed state on its eye-icon button (aria-pressed drives the CSS that
   switches between the "eye" and "eye-off" icon). */
function togglePasswordVisibility(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  if(btn) btn.setAttribute('aria-pressed', String(!showing));
}

/* ---------- forgot password (customer-facing) ---------- */
function showForgotPassword(){
  document.getElementById('accPane-login').style.display = 'none';
  document.getElementById('accPane-forgot').classList.add('show');
  document.getElementById('accPane-forgot').style.display = 'block';
  const fpEmail = document.getElementById('fpEmail');
  const liEmail = document.getElementById('liEmail');
  if(fpEmail && liEmail && liEmail.value) fpEmail.value = liEmail.value;
  document.querySelector('.acc-tabs').style.display = 'none';
  document.querySelector('.google-btn').style.display = 'none';
  document.querySelector('.or-divider').style.display = 'none';
}
function hideForgotPassword(){
  document.getElementById('accPane-login').style.display = '';
  document.getElementById('accPane-forgot').classList.remove('show');
  document.getElementById('accPane-forgot').style.display = 'none';
  document.querySelector('.acc-tabs').style.display = '';
  document.querySelector('.google-btn').style.display = '';
  document.querySelector('.or-divider').style.display = '';
  const msg = document.getElementById('fpMsg');
  if(msg){ msg.style.display = 'none'; msg.textContent = ''; }
  const err = document.getElementById('fpError');
  if(err){ err.classList.remove('show'); }
}
function submitForgotPassword(e){
  e.preventDefault();
  const email = document.getElementById('fpEmail').value.trim();
  const err = document.getElementById('fpError');
  const msg = document.getElementById('fpMsg');
  const btn = document.getElementById('fpSubmitBtn');
  err.classList.remove('show');
  msg.style.display = 'none';
  if(typeof firebase === 'undefined' || !firebase.auth){
    err.textContent = 'Abhi kaam nahi kar raha — internet check karein.';
    err.classList.add('show');
    return false;
  }
  setBtnLoading(btn, true, 'Bhej rahe hain…');
  firebase.auth().sendPasswordResetEmail(email)
    .then(function(){
      msg.textContent = 'Password reset link "' + email + '" par bhej diya gaya hai — apna inbox (aur spam folder) check karein.';
      msg.style.display = 'block';
      document.getElementById('forgotPasswordForm').reset();
    })
    .catch(function(error){
      // Firebase intentionally returns the same UI-facing behavior whether
      // or not the email exists (auth/user-not-found is still surfaced here
      // as a normal error since this form is only reachable from a person
      // who typed their own email, not a way to enumerate accounts at scale).
      err.textContent = friendlyAuthError(error);
      err.classList.add('show');
    })
    .finally(function(){ setBtnLoading(btn, false); });
  return false;
}

/* Real-time listener on this user's liked-product ids, synced across every device they log into. */
function watchUserLikes(uid){
  if(likesUnsub){ likesUnsub(); likesUnsub=null; }
  if(typeof firebase === 'undefined' || !firebase.firestore) return;
  likesUnsub = firebase.firestore().collection('users').doc(uid).onSnapshot(function(doc){
    const data = (doc && doc.data()) || {};
    USER_LIKES = new Set(data.likes || []);
    renderProducts();
    if(PD.product) renderDetail();
    renderLikedGrid();
  }, function(err){
    console.error('Liked products sync error:', err);
  });
}

async function toggleLike(id){
  if(!currentUser){
    openAccount();
    toast('Pehle apna account banayein ya login karein');
    return;
  }
  if(typeof firebase === 'undefined' || !firebase.firestore){
    toast('Internet check karein — like save nahi ho saka');
    return;
  }
  const liked = USER_LIKES.has(id);
  // optimistic UI update
  if(liked) USER_LIKES.delete(id); else USER_LIKES.add(id);
  renderProducts();
  if(PD.product) renderDetail();
  renderLikedGrid();
  try{
    const ref = firebase.firestore().collection('users').doc(currentUser.uid);
    await ref.set({
      likes: liked ? firebase.firestore.FieldValue.arrayRemove(id) : firebase.firestore.FieldValue.arrayUnion(id),
      email: currentUser.email || null
    }, {merge:true});
  }catch(err){
    // revert on failure
    if(liked) USER_LIKES.add(id); else USER_LIKES.delete(id);
    renderProducts();
    if(PD.product) renderDetail();
    renderLikedGrid();
    toast('Like save nahi ho saka — internet check karein');
  }
}

function renderLikedGrid(){
  const wrap = document.getElementById('likedGrid');
  if(!wrap || !currentUser) return;
  const liked = ALL_PRODUCTS.filter(p => USER_LIKES.has(p.id) && !p.hidden && !p.deleted);
  if(!liked.length){
    wrap.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);font-size:.85rem;margin:0;">Abhi tak koi product pasand nahi kiya — har product ke heart icon ' +
      heartSvg(false) + ' par tap karke save karein.</p>';
    return;
  }
  wrap.innerHTML = liked.map(renderProductCard).join('');
}

if(typeof firebase !== 'undefined' && firebase.auth){
  firebase.auth().onAuthStateChanged(function(user){
    currentUser = user;
    updateAccountUI();
    if(user){
      watchUserLikes(user.uid);
    } else {
      if(likesUnsub){ likesUnsub(); likesUnsub=null; }
      USER_LIKES = new Set();
      renderProducts();
      if(PD.product) renderDetail();
      renderLikedGrid();
    }
  });
}

/* ---------- admin ----------
   SECURITY FIX: admin login used to be a hardcoded username/password
   compared directly in this file (ADMIN_USER/ADMIN_PASS) — anyone who
   viewed the page source could read the password. Firestore rules also
   allowed "write: if true" on products/orders because there was no real
   Firebase Auth session to check against, so literally anyone could add,
   edit, or delete products straight from the browser console, without
   ever touching the admin panel.
   Fix: admin login now goes through real Firebase Authentication
   (the same sign-in used for customer accounts). Firestore rules check
   request.auth.token.email against ADMIN_EMAIL below — see FIRESTORE_RULES.txt.
   This ONLY works once you (1) enable Email/Password sign-in in Firebase
   Console > Authentication > Sign-in method, and (2) create one Firebase
   Auth user with this exact email as your admin account. */
const ADMIN_EMAIL = 'qraza2376@gmail.com';

let adminSessionMemory = false; // in-memory fallback for browsers (e.g. WhatsApp's in-app browser) that block sessionStorage
function isAdminLoggedIn(){
  try{ return sessionStorage.getItem('ahs_admin') === '1'; }
  catch(e){ return adminSessionMemory; }
}

function adminIconClick(){ isAdminLoggedIn() ? openAdminPanel() : openAdminLogin(); }

function openAdminLogin(){ document.getElementById('adminLoginModal').classList.add('open'); document.body.style.overflow='hidden'; }
function closeAdminLogin(){
  document.getElementById('adminLoginModal').classList.remove('open');
  document.body.style.overflow='';
  document.getElementById('adminLoginError').classList.remove('show');
  document.getElementById('adminLoginForm').reset();
}

function submitAdminLogin(e){
  e.preventDefault();
  const u = document.getElementById('adminUser').value.trim();
  const p = document.getElementById('adminPass').value;
  const errEl = document.getElementById('adminLoginError');
  const btn = document.getElementById('adminLoginBtn');
  errEl.classList.remove('show');
  if(typeof firebase === 'undefined' || !firebase.auth){
    errEl.textContent = 'Admin login abhi kaam nahi kar raha — internet check karein.';
    errEl.classList.add('show');
    return false;
  }
  // Username field still shown for familiarity, but the real check is the
  // Firebase Auth email+password sign-in below — only ADMIN_EMAIL's account
  // will ever be allowed to write products/orders per the Firestore rules.
  const email = (u.includes('@')) ? u : ADMIN_EMAIL;
  setBtnLoading(btn, true, 'Logging in…');
  firebase.auth().signInWithEmailAndPassword(email, p)
    .then(function(cred){
      if(cred.user.email !== ADMIN_EMAIL){
        firebase.auth().signOut();
        errEl.textContent = 'Ye account admin nahi hai.';
        errEl.classList.add('show');
        return;
      }
      adminSessionMemory = true;
      try{ sessionStorage.setItem('ahs_admin','1'); }catch(e){}
      closeAdminLogin();
      openAdminPanel();
      toast('Welcome, admin!', 'success');
    })
    .catch(function(error){
      errEl.textContent = friendlyAuthError(error);
      errEl.classList.add('show');
    })
    .finally(function(){ setBtnLoading(btn, false); });
  return false;
}

function adminForgotPassword(){
  const msgEl = document.getElementById('adminForgotMsg');
  const errEl = document.getElementById('adminLoginError');
  const btn = document.getElementById('adminForgotBtn');
  errEl.classList.remove('show');
  if(typeof firebase === 'undefined' || !firebase.auth){
    errEl.textContent = 'Abhi kaam nahi kar raha — internet check karein.';
    errEl.classList.add('show');
    return;
  }
  setBtnLoading(btn, true, 'Bhej rahe hain…');
  // Sends a real reset link to ADMIN_EMAIL's Gmail inbox via Firebase —
  // no password is ever shown, stored, or emailed in plain text.
  firebase.auth().sendPasswordResetEmail(ADMIN_EMAIL)
    .then(function(){
      msgEl.textContent = 'Reset link "' + ADMIN_EMAIL + '" par bhej diya gaya hai — apna Gmail check karein.';
      msgEl.style.display = 'block';
    })
    .catch(function(error){
      errEl.textContent = friendlyAuthError(error);
      errEl.classList.add('show');
    })
    .finally(function(){ setBtnLoading(btn, false); });
}

function adminLogout(){
  adminSessionMemory = false;
  try{ sessionStorage.removeItem('ahs_admin'); }catch(e){}
  if(typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut();
  closeAdminPanel();
  toast('Logged out');
}

function openAdminPanel(){
  renderAdminProductList();
  switchAdminTab('products');
  document.getElementById('adminPanelModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeAdminPanel(){
  document.getElementById('adminPanelModal').classList.remove('open');
  document.body.style.overflow='';
  if(adminOrdersUnsub){ adminOrdersUnsub(); adminOrdersUnsub = null; }
}

/* ---------- custom products (Firestore-backed, syncs on every device) ---------- */
let CUSTOM_PRODUCTS = [];
let BASE_PRODUCTS = [];

function loadCustomProducts(){
  return CUSTOM_PRODUCTS;
}

/* Merges base (embedded, code-level) products with Firestore overrides,
   de-duplicated by id — an override always wins over the base entry with
   the same id. Without this, base + override both stayed in ALL_PRODUCTS
   (plain .concat never dedupes), so a "deleted" base product's override
   (hidden:true) sat right alongside its original, un-hidden base entry —
   the product never actually disappeared from the admin list. */
function mergeProducts(base, custom){
  const byId = new Map();
  base.forEach(p => byId.set(p.id, p));
  custom.forEach(p => byId.set(p.id, p));
  return Array.from(byId.values());
}

/* Real-time listener: koi bhi admin product add/edit/delete kare,
   har visitor/device par bina refresh ke turant update ho jata hai. */
function watchCustomProducts(){
  if(typeof firebase === 'undefined' || !firebase.firestore){
    console.warn('Firebase Firestore load nahi hua — custom products sirf is device par dikhenge.');
    return;
  }
  firebase.firestore().collection('products').onSnapshot(function(snap){
    CUSTOM_PRODUCTS = snap.docs.map(function(d){
      return Object.assign({}, d.data(), {id:d.id});
    });
    ALL_PRODUCTS = mergeProducts(BASE_PRODUCTS, CUSTOM_PRODUCTS);
    buildCategories();
    renderProducts();
    renderAdminProductList();
    openProductFromURL();
  }, function(err){
    console.error('Firestore sync error:', err);
    toast('Products sync mein masla — internet ya Firebase settings check karein');
  });
}

/* Recursively strips anything Firestore cannot store (undefined values,
   Files/DOM nodes/class instances, functions) and guarantees arrays never
   directly contain another bare array (Firestore only allows primitives or
   maps as array entries). This is what fixes:
   "FirebaseError: Property array contains an invalid nested entity" /
   "Unsupported field value: undefined" — both come from unsanitized data
   (e.g. oldPrice/stockQty left as `undefined`, or a stray non-plain object
   inside images/colors/sizes/details) being handed straight to .set(). */
function sanitizeForFirestore(value){
  if(value === undefined || value === null) return null;
  const t = typeof value;
  if(t === 'string'){
    return value.trim() === '' ? null : value;
  }
  if(t === 'boolean') return value;
  if(t === 'number') return Number.isFinite(value) ? value : null;
  if(value instanceof Date) return value;
  if(Array.isArray(value)){
    return value
      .filter(v => v !== undefined && v !== null && v !== '')
      .map(v => sanitizeForFirestore(v))
      .filter(v => v !== null)
      .map(v => Array.isArray(v) ? {list:v} : v); // no arrays-in-arrays
  }
  if(value instanceof Set) return sanitizeForFirestore(Array.from(value));
  if(value instanceof Map) return sanitizeForFirestore(Object.fromEntries(value));
  if(t === 'object'){
    // Firestore FieldValue sentinels (arrayUnion/serverTimestamp/etc.) must
    // pass through untouched — they are not plain data and aren't used by
    // saveCustomProduct, but this keeps the helper safe to reuse elsewhere.
    if(value && value._methodName) return value;
    const out = {};
    Object.keys(value).forEach(function(k){
      if(value[k] === undefined || value[k] === null) return; // drop the key instead of storing null noise
      const clean = sanitizeForFirestore(value[k]);
      if(clean !== null && clean !== undefined) out[k] = clean;
    });
    return Object.keys(out).length ? out : null;
  }
  return null; // functions, symbols, DOM nodes, File objects, etc.
}

async function saveCustomProduct(product){
  const clean = sanitizeForFirestore(product);
  try{
    await firebase.firestore().collection('products').doc(clean.id).set(clean);
  }catch(err){
    console.error('saveCustomProduct failed. Payload sent to Firestore:', clean, 'Original error:', err);
    throw err;
  }
  return clean;
}
async function deleteCustomProduct(id){
  await firebase.firestore().collection('products').doc(id).delete();
}

function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* Resizes/compresses an uploaded photo before it leaves the device — a raw
   phone-camera photo can be several MB, which blows past Firestore's 1MB
   per-document limit if embedded directly. Shrinking to maxDim px + JPEG
   compression keeps it small whether it ends up in Storage or (as a
   fallback) inline. */
function compressImageFile(file, maxDim, quality){
  maxDim = maxDim || 1600;
  quality = quality || 0.82;

  function drawToBlob(source, width, height){
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error('Image compress nahi ho saka'));
      }, 'image/jpeg', quality);
    });
  }

  function scaledSize(w, h){
    let width = w, height = h;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
      else { width = Math.round(width * (maxDim / height)); height = maxDim; }
    }
    return {width, height};
  }

  // Preferred path: createImageBitmap decodes a much wider range of formats
  // (including iPhone HEIC/HEIC photos) than the classic <img> element does
  // on some browser/WebKit versions, and it auto-applies EXIF orientation.
  // Falls back to the old Image()-based approach if it's unavailable or
  // fails to decode the specific file, so nothing regresses for formats
  // that only the old path handled.
  async function viaImageBitmap(){
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap unavailable');
    const bitmap = await createImageBitmap(file);
    const {width, height} = scaledSize(bitmap.width, bitmap.height);
    try{
      return await drawToBlob(bitmap, width, height);
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  function viaImageElement(){
    return new Promise((resolve, reject) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const {width, height} = scaledSize(img.naturalWidth, img.naturalHeight);
        drawToBlob(img, width, height).then((blob) => {
          URL.revokeObjectURL(objUrl);
          resolve(blob);
        }).catch((err) => { URL.revokeObjectURL(objUrl); reject(err); });
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Photo load nahi ho saki — dusri photo try karein ya isay pehle "Camera Roll" format (JPEG) mein save karein.')); };
      img.src = objUrl;
    });
  }

  return viaImageBitmap().catch(() => viaImageElement());
}

/* Uploads a single image file to Cloudinary using an unsigned upload preset.
   The photo is resized/compressed on-device first (same helper used for the
   old inline-storage path) purely to save upload bandwidth and Cloudinary
   storage — Cloudinary itself has no 1MB document limit like Firestore did,
   so this is just good practice, not a hard requirement. Returns the
   Cloudinary-hosted secure URL to save on the product document. */
async function uploadImageToCloudinary(file){
  const blob = await compressImageFile(file, 1600, 0.82);
  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  let res;
  try{
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
      method: 'POST',
      body: form
    });
  }catch(err){
    throw new Error('Cloudinary tak pahonch nahi payi — internet check karein.');
  }
  if(!res.ok){
    let detail = '';
    try{
      const errBody = await res.json();
      detail = (errBody && errBody.error && errBody.error.message) || '';
    }catch(e){ /* response wasn't JSON, ignore */ }
    throw new Error('Photo upload nahi ho saki' + (detail ? ' — ' + detail : ' (Cloudinary preset check karein).'));
  }
  const data = await res.json();
  return data.secure_url;
}

function blobToDataUrl(blob){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* Keeps shrinking a photo (smaller dimensions, lower JPEG quality) until its
   base64 form fits comfortably inside Firestore's 1MB-per-document limit.
   Firebase Storage would be the "proper" way to host images, but it now
   requires the paid Blaze plan just to enable — this avoids that entirely
   by keeping images small enough to live directly in the product document. */
async function compressImageUnderLimit(file, maxBytes){
  maxBytes = maxBytes || 350000; // per-image budget (bytes of the base64 string)
  const attempts = [
    {maxDim:1100, quality:0.7},
    {maxDim:900,  quality:0.55},
    {maxDim:700,  quality:0.45},
    {maxDim:500,  quality:0.4}
  ];
  let lastDataUrl = null;
  for(let i=0;i<attempts.length;i++){
    const blob = await compressImageFile(file, attempts[i].maxDim, attempts[i].quality);
    const dataUrl = await blobToDataUrl(blob);
    lastDataUrl = dataUrl;
    if(dataUrl.length <= maxBytes) return dataUrl;
  }
  throw new Error('Photo bohot bari hai — chhoti ya kam-resolution wali photo try karein, ya kam photos add karein.');
}

/* ---------- size chip helpers ---------- */
function toggleSizeChip(btn){
  const sizesInput = document.getElementById('apSizes');
  let list = sizesInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  const val = btn.getAttribute('data-size');
  const idx = list.indexOf(val);
  if(idx === -1){
    list.push(val);
    btn.classList.add('active');
  } else {
    list.splice(idx,1);
    btn.classList.remove('active');
  }
  sizesInput.value = list.join(', ');
}
function clearSizeChips(){
  document.getElementById('apSizes').value = '';
  document.querySelectorAll('.size-chip.active').forEach(b=>b.classList.remove('active'));
}
function syncSizeChipsFromInput(){
  const list = document.getElementById('apSizes').value.split(',').map(s=>s.trim()).filter(Boolean);
  document.querySelectorAll('.size-chip').forEach(b=>{
    b.classList.toggle('active', list.includes(b.getAttribute('data-size')));
  });
}

async function submitAddProduct(e){
  e.preventDefault();
  const errEl = document.getElementById('addProductError');
  errEl.classList.remove('show');

  const editId = document.getElementById('apEditId').value;
  const name = document.getElementById('apName').value.trim();
  const categorySel = document.getElementById('apCategory').value;
  const category = (categorySel === '__new__'
    ? (document.getElementById('apCategoryNew').value.trim() || 'other')
    : (categorySel || 'other'));
  const price = Number(document.getElementById('apPrice').value);
  const oldPriceRaw = document.getElementById('apOldPrice').value;
  const oldPrice = oldPriceRaw ? Number(oldPriceRaw) : null;
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
  const stockQtyRaw = document.getElementById('apStockQty').value.trim().replace(/[^\d]/g,'');
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

  if(files.length > 8){
    errEl.textContent = 'Ek dafa mein zyada se zyada 8 photos upload karein.';
    errEl.classList.add('show');
    return false;
  }

  const productId = editId || ('admin_' + Date.now() + '_' + Math.random().toString(36).slice(2,7));

  let uploadedImages = [];
  if(files.length){
    const submitBtn = document.getElementById('addProductForm') && document.getElementById('addProductForm').querySelector('button[type="submit"]');
    if(submitBtn){ submitBtn.disabled = true; submitBtn.dataset.origText = submitBtn.textContent; submitBtn.textContent = 'Uploading photos...'; }
    try{
      uploadedImages = await Promise.all(files.map(f=>uploadImageToCloudinary(f).then(url=>({src:url, alt:name}))));
    }catch(err){
      errEl.textContent = (err && err.message) || 'Photo upload nahi ho saki.';
      errEl.classList.add('show');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.origText; }
      return false;
    }
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.origText; }
  }

  const urlImages = imageUrls.map(u=>({src:u, alt:name}));
  let images = urlImages.concat(uploadedImages);
  if(!images.length && existing) images = existing.images;

  const product = {
    id: productId,
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

  /* Optimistic local update — real-time listener bhi isi data se sab visitors ko update karega */
  ALL_PRODUCTS = ALL_PRODUCTS.filter(p=>p.id !== savedProduct.id).concat([savedProduct]);
  buildCategories();
  renderProducts();
  renderAdminProductList();

  document.getElementById('addProductForm').reset();
  document.getElementById('apEditId').value = '';
  document.getElementById('apCategoryNew').style.display = 'none';
  document.getElementById('apCategoryNew').value = '';
  document.getElementById('apDelivery').value = 200;
  document.getElementById('apStockQty').value = '';
  document.getElementById('apVisible').value = 'yes';
  clearSizeChips();
  document.getElementById('addProductSubmitBtn').textContent = 'Product Add Karein';
  toast(existing ? 'Product update ho gaya!' : 'Product Add ho gaya!');
  return false;
}

function editAdminProduct(id){
  const p = ALL_PRODUCTS.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('apEditId').value = p.id;
  document.getElementById('apName').value = p.name || '';
  setCategoryFieldValue(p.category);
  document.getElementById('apPrice').value = p.price || '';
  document.getElementById('apOldPrice').value = p.oldPrice || '';
  document.getElementById('apImageUrls').value = (p.images||[]).map(im=>im.src).filter(s=>s && !s.startsWith('data:')).join(', ');
  document.getElementById('apVideoUrl').value = p.videoUrl || '';
  document.getElementById('apColors').value = (p.colors||[]).join(', ');
  document.getElementById('apSizes').value = (p.sizes||[]).join(', ');
  document.getElementById('apFlashSale').value = p.flashSale ? 'yes' : 'no';
  document.getElementById('apStock').value = p.stockStatus || 'in';
  document.getElementById('apStockQty').value = (p.stockQty!=null ? p.stockQty : '');
  document.getElementById('apVisible').value = p.hidden ? 'no' : 'yes';
  document.getElementById('apDelivery').value = (p.deliveryCharge!=null ? p.deliveryCharge : DELIVERY_CHARGE);
  document.getElementById('apDesc').value = p.desc || '';
  syncSizeChipsFromInput();
  document.getElementById('addProductSubmitBtn').textContent = 'Product Update Karein';
  document.getElementById('addProductForm').scrollIntoView({behavior:'smooth', block:'start'});
}

function renderAdminProductList(){
  const wrap = document.getElementById('adminProductList');
  const selectAll = document.getElementById('adminSelectAllProducts');
  if(selectAll) selectAll.checked = false;
  const listable = ALL_PRODUCTS.filter(p => !p.deleted);
  if(!listable.length){
    wrap.innerHTML = '<p style="color:#667;margin:0;">Abhi tak koi product nahi hai.</p>';
    updateBulkDeleteButton();
    return;
  }
  wrap.innerHTML = listable.map(p=>{
    const stockTxt = (p.stockQty!=null) ? ('Stock: '+p.stockQty) : (p.stockStatus==='out' ? 'Out of Stock' : 'In Stock');
    const stockColor = (p.stockQty===0 || p.stockStatus==='out') ? '#c0392b' : '#2f8f4e';
    const hiddenTxt = p.hidden ? ' · <span style="color:#c0392b;">Hidden</span>' : '';
    return '<div class="admin-plist-row">'+
      '<img src="'+firstImg(p)+'" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">'+
      '<div style="flex:1;min-width:0;">'+
        '<b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escapeHtml(p.name)+' — '+money(p.price)+'</b>'+
        '<span style="color:#667;font-size:13px;">'+catLabel(p.category)+' · <span style="color:'+stockColor+';">'+stockTxt+'</span>'+hiddenTxt+'</span>'+
      '</div>'+
      '<div class="admin-plist-actions">'+
        '<button type="button" class="btn btn-ghost" style="padding:6px 12px;" onclick="editAdminProduct(\''+p.id+'\')">Edit Karein</button>'+
        '<button type="button" class="btn btn-ghost" style="padding:6px 12px;" onclick="toggleAdminVisibility(\''+p.id+'\')">'+(p.hidden?'Show Karein':'Hide Karein')+'</button>'+
        '<button type="button" class="btn btn-navy" style="padding:6px 12px;" onclick="deleteAdminProduct(\''+p.id+'\')">Hatayein</button>'+
        '<label style="display:flex;align-items:center;gap:5px;font-size:13px;color:#667;cursor:pointer;">'+
          '<input type="checkbox" class="admin-plist-check" value="'+p.id+'" onchange="updateBulkDeleteButton()" style="width:18px;height:18px;">Select'+
        '</label>'+
      '</div>'+
    '</div>';
  }).join('');
  updateBulkDeleteButton();
}

function updateBulkDeleteButton(){
  const checks = document.querySelectorAll('.admin-plist-check:checked');
  const btn = document.getElementById('adminBulkDeleteBtn');
  if(!btn) return;
  btn.textContent = 'Selected Delete Karein (' + checks.length + ')';
  btn.disabled = checks.length === 0;
  const all = document.querySelectorAll('.admin-plist-check');
  const selectAll = document.getElementById('adminSelectAllProducts');
  if(selectAll) selectAll.checked = all.length > 0 && checks.length === all.length;
}

function toggleSelectAllAdminProducts(cb){
  document.querySelectorAll('.admin-plist-check').forEach(function(c){ c.checked = cb.checked; });
  updateBulkDeleteButton();
}

async function bulkDeleteAdminProducts(){
  const checks = Array.from(document.querySelectorAll('.admin-plist-check:checked'));
  if(!checks.length) return;
  const ids = checks.map(function(c){ return c.value; });
  if(!confirm(ids.length + ' products delete karne hain — pakka?')) return;
  const btn = document.getElementById('adminBulkDeleteBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Delete ho raha hai...'; }
  let successCount = 0, failCount = 0;
  for(const id of ids){
    try{
      const wasCustomOnly = String(id).startsWith('admin_');
      if(wasCustomOnly){
        await deleteCustomProduct(id);
        ALL_PRODUCTS = ALL_PRODUCTS.filter(function(p){ return p.id !== id; });
      } else {
        const base = ALL_PRODUCTS.find(function(p){ return p.id===id; });
        if(base){
          const updated = Object.assign({}, base, {hidden:true, deleted:true});
          const saved = await saveCustomProduct(updated);
          ALL_PRODUCTS = ALL_PRODUCTS.filter(function(x){ return x.id!==id; }).concat([saved]);
        }
      }
      successCount++;
    }catch(err){
      failCount++;
    }
  }
  buildCategories();
  renderProducts();
  renderAdminProductList();
  toast(successCount + ' products hata diye gaye' + (failCount ? ', ' + failCount + ' fail hue' : ''));
}

async function toggleAdminVisibility(id){
  const p = ALL_PRODUCTS.find(x=>x.id===id);
  if(!p) return;
  const updated = Object.assign({}, p, {hidden: !p.hidden});
  let saved;
  try{
    saved = await saveCustomProduct(updated);
  }catch(err){
    toast('Update fail ho gaya — internet ya Firebase settings check karein');
    return;
  }
  ALL_PRODUCTS = ALL_PRODUCTS.filter(x=>x.id!==id).concat([saved]);
  buildCategories();
  renderProducts();
  renderAdminProductList();
  toast(updated.hidden ? 'Product site se hide ho gaya' : 'Product site par show ho gaya');
}

async function deleteAdminProduct(id){
  const wasCustomOnly = String(id).startsWith('admin_');
  try{
    if(wasCustomOnly){
      await deleteCustomProduct(id);
      ALL_PRODUCTS = ALL_PRODUCTS.filter(p=>p.id !== id);
    } else {
      const base = ALL_PRODUCTS.find(p=>p.id===id);
      if(!base) return;
      const updated = Object.assign({}, base, {hidden:true, deleted:true});
      const saved = await saveCustomProduct(updated);
      ALL_PRODUCTS = ALL_PRODUCTS.filter(x=>x.id!==id).concat([saved]);
    }
  }catch(err){
    toast('Delete fail ho gaya — internet ya Firebase settings check karein');
    return;
  }
  buildCategories();
  renderProducts();
  renderAdminProductList();
  toast('Product hata diya gaya');
}

/* ---------- load products ---------- */
function applyProducts(data){
  BASE_PRODUCTS = (data && data.products) || [];
  ALL_PRODUCTS = mergeProducts(BASE_PRODUCTS, loadCustomProducts());
  buildCategories();
  renderProducts();
  openProductFromURL();
}
function skeletons(){
  const g=document.getElementById('productGrid');
  g.innerHTML = Array.from({length:10}).map(()=>'<div class="sk"><div class="box"></div><div class="pad"><div class="ln w90"></div><div class="ln w40"></div><div class="ln w70"></div></div></div>').join('');
}
function loadProducts(){
  skeletons();
  Promise.reject() // use embedded data
    .then(r=>{ if(!r.ok) throw new Error('http'); return r.json(); })
    .then(applyProducts)
    .catch(()=>{ if(window.EMBEDDED_PRODUCTS) applyProducts(window.EMBEDDED_PRODUCTS);
      else document.getElementById('productGrid').innerHTML='<div class="empty"><b>Couldn\'t load products</b>Please refresh the page.</div>'; });
}

/* ---------- customer order tracking ---------- */
const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};
const ORDER_STATUS_COLORS = {
  pending: '#b8860b',
  confirmed: '#2563eb',
  shipped: '#7c3aed',
  delivered: '#16a34a',
  cancelled: '#dc2626'
};
function orderStatusBadge(status){
  const s = status || 'pending';
  const label = ORDER_STATUS_LABELS[s] || s;
  const color = ORDER_STATUS_COLORS[s] || '#667';
  return '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;color:#fff;background:'+color+';">'+escapeHtml(label)+'</span>';
}
const ORDER_STEPS = ['pending','confirmed','shipped','delivered'];
function orderTimelineHtml(status){
  if(status==='cancelled'){
    return '<div style="font-size:12px;color:#dc2626;font-weight:600;margin:8px 0;">❌ Ye order cancel ho chuka hai</div>';
  }
  const idx = ORDER_STEPS.indexOf(status||'pending');
  const cur = idx<0 ? 0 : idx;
  return '<div style="display:flex;align-items:center;margin:10px 0 4px;">'+
    ORDER_STEPS.map(function(s,i){
      const done = i<=cur;
      const dot = '<div style="width:11px;height:11px;border-radius:50%;background:'+(done?'#16a34a':'#e0e0e0')+';flex-shrink:0;"></div>';
      const line = i<ORDER_STEPS.length-1 ? '<div style="flex:1;height:2px;background:'+(i<cur?'#16a34a':'#e0e0e0')+';"></div>' : '';
      return dot+line;
    }).join('')+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:8px;">'+
      ORDER_STEPS.map(s=>'<span>'+ORDER_STATUS_LABELS[s]+'</span>').join('')+
    '</div>';
}
function orderCardHtml(id, o){
  const items = o.orderItems || '';
  const total = money(o.totalAmount || 0);
  const date = o.timestamp || '';
  const status = o.status || 'pending';
  let actionBtn = '';
  if(status==='pending' && !o.cancelRequested){
    actionBtn = '<button type="button" class="btn" style="padding:6px 12px;font-size:12px;background:#fde8e8;color:#c0392b;margin-top:6px;" onclick="requestCancelOrder(\''+id+'\')">Cancel Order</button>';
  } else if(o.cancelRequested){
    actionBtn = '<div style="font-size:12px;color:#b8860b;margin-top:6px;">⏳ Cancel request bheji ja chuki hai</div>';
  } else if(status==='delivered' && !o.returnRequested){
    actionBtn = '<button type="button" class="btn" style="padding:6px 12px;font-size:12px;background:#fff3d6;color:#b8860b;margin-top:6px;" onclick="requestReturnOrder(\''+id+'\')">Return Request Karein</button>';
  } else if(o.returnRequested){
    actionBtn = '<div style="font-size:12px;color:#b8860b;margin-top:6px;">⏳ Return request bheji ja chuki hai</div>';
  }
  return '<div class="order-card" style="border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:14px;margin-bottom:10px;">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">'+
      '<b style="font-size:13px;color:#667;">Order #'+escapeHtml(id.slice(-6).toUpperCase())+'</b>'+
      orderStatusBadge(status)+
    '</div>'+
    '<div style="font-size:13px;color:#667;margin-bottom:4px;">'+escapeHtml(date)+'</div>'+
    orderTimelineHtml(status)+
    '<div style="font-size:14px;margin-bottom:6px;">'+escapeHtml(items)+'</div>'+
    '<div style="font-weight:700;">'+total+'</div>'+
    '<button type="button" class="btn btn-ghost" style="padding:6px 12px;font-size:12px;margin-top:8px;margin-right:6px;" onclick=\'openInvoice("'+id+'", '+JSON.stringify(o).replace(/'/g,"&#39;")+')\'>🧾 Invoice Dekhein</button>'+
    actionBtn+
  '</div>';
}
function openInvoice(id, o){
  const rows = (o.orderItems||'').split(',').map(s=>s.trim()).filter(Boolean);
  document.getElementById('invNumber').textContent = '#'+id.slice(-6).toUpperCase();
  document.getElementById('invDate').textContent = o.timestamp || '';
  document.getElementById('invName').textContent = o.fullName || '';
  document.getElementById('invPhone').textContent = o.phone || '';
  document.getElementById('invAddress').textContent = o.address || '';
  document.getElementById('invPayment').textContent = o.paymentMethod || '';
  document.getElementById('invItems').innerHTML = rows.map(r=>'<tr><td>'+escapeHtml(r)+'</td></tr>').join('');
  document.getElementById('invSubtotal').textContent = money(o.itemsTotal||0);
  const discRow = document.getElementById('invDiscountRow');
  if(o.discount && o.discount>0){ discRow.style.display='flex'; document.getElementById('invDiscount').textContent = '- '+money(o.discount)+(o.couponCode?(' ('+o.couponCode+')'):''); }
  else discRow.style.display='none';
  document.getElementById('invDelivery').textContent = money(o.delivery||0);
  document.getElementById('invTotal').textContent = money(o.totalAmount||0);
  document.getElementById('invoiceModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeInvoice(){
  document.getElementById('invoiceModal').classList.remove('open');
  document.body.style.overflow='';
}
function printInvoice(){ window.print(); }
async function requestCancelOrder(orderId){
  if(!confirm('Kya aap ye order cancel karna chahte hain?')) return;
  try{
    await firebase.firestore().collection('orders').doc(orderId).update({ cancelRequested: true, cancelRequestedAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Cancel request bhej di gayi');
    renderMyOrders();
  }catch(e){ toast('Request bhej nahi saki — internet check karein'); }
}
async function requestReturnOrder(orderId){
  const reason = prompt('Return ki wajah likhein (optional):','');
  try{
    await firebase.firestore().collection('orders').doc(orderId).update({ returnRequested: true, returnReason: reason||'', returnRequestedAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Return request bhej di gayi');
    renderMyOrders();
  }catch(e){ toast('Request bhej nahi saki — internet check karein'); }
}
function openOrdersModal(){
  document.getElementById('ordersModal').classList.add('open');
  document.body.style.overflow='hidden';
  renderMyOrders();
}
function closeOrdersModal(){
  document.getElementById('ordersModal').classList.remove('open');
  document.body.style.overflow='';
}
function renderMyOrders(){
  const list = document.getElementById('myOrdersList');
  const ids = getMyOrderIds();
  if(!ids.length){
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Abhi tak koi order is device se track nahi hua. Neechay phone number se dhoond sakte hain.</p>';
    return;
  }
  if(typeof firebase === 'undefined' || !firebase.firestore){
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Order tracking abhi available nahi hai.</p>';
    return;
  }
  list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Loading…</p>';
  const db = firebase.firestore();
  Promise.all(ids.map(id => db.collection('orders').doc(id).get().catch(()=>null)))
    .then(function(docs){
      const cards = [];
      docs.forEach(function(d, i){
        if(d && d.exists) cards.push(orderCardHtml(ids[i], d.data()));
      });
      list.innerHTML = cards.length ? cards.join('') : '<p style="color:var(--muted);font-size:14px;">Koi order nahi mila.</p>';
    })
    .catch(function(){
      list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Orders load nahi ho sakay — internet check karein.</p>';
    });
}
function trackOrdersByPhone(){
  const phone = document.getElementById('trackPhoneInput').value.trim();
  const list = document.getElementById('phoneOrdersList');
  if(!phone){ toast('Phone number likhein'); return; }
  if(typeof firebase === 'undefined' || !firebase.firestore){
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Order tracking abhi available nahi hai.</p>';
    return;
  }
  list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Dhoond rahe hain…</p>';
  firebase.firestore().collection('orders').where('phone', '==', phone).limit(50).get()
    .then(function(snap){
      if(snap.empty){ list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Is phone number se koi order nahi mila.</p>'; return; }
      const cards = [];
      snap.forEach(function(doc){ cards.push(orderCardHtml(doc.id, doc.data())); addMyOrderId(doc.id); });
      list.innerHTML = cards.join('');
    })
    .catch(function(){
      list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Search fail ho gayi — internet check karein.</p>';
    });
}

/* ---------- admin: orders dashboard ---------- */
let adminOrdersUnsub = null;
function switchAdminTab(tab){
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
  const btn = document.querySelector('.admin-tab[data-tab="'+tab+'"]');
  if(btn) btn.classList.add('active');
  document.getElementById('adminPane-products').style.display = (tab==='products') ? 'block' : 'none';
  document.getElementById('adminPane-orders').style.display = (tab==='orders') ? 'block' : 'none';
  document.getElementById('adminPane-bulk').style.display = (tab==='bulk') ? 'block' : 'none';
  document.getElementById('adminPane-fromlink').style.display = (tab==='fromlink') ? 'block' : 'none';
  document.getElementById('adminPane-analytics').style.display = (tab==='analytics') ? 'block' : 'none';
  document.getElementById('adminPane-coupons').style.display = (tab==='coupons') ? 'block' : 'none';
  document.getElementById('adminPane-banners').style.display = (tab==='banners') ? 'block' : 'none';
  if(tab==='orders') loadAdminOrders();
  if(tab==='analytics') loadAdminAnalytics();
  if(tab==='coupons') loadAdminCoupons();
  if(tab==='banners') loadAdminBanners();
}

/* ---------- admin: banners ---------- */
let adminBannersUnsub = null;
function loadAdminBanners(){
  const list = document.getElementById('adminBannersList');
  list.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  if(adminBannersUnsub) adminBannersUnsub();
  adminBannersUnsub = firebase.firestore().collection('banners').orderBy('order','asc')
    .onSnapshot(function(snap){
      if(snap.empty){ list.innerHTML = '<p style="color:var(--muted);">Abhi koi banner nahi hai — default banner dikhega.</p>'; return; }
      const rows = [];
      snap.forEach(function(doc){
        const b = doc.data();
        rows.push(
          '<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">'+
            '<img src="'+b.imageUrl+'" alt="" style="width:90px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;">'+
            '<div style="flex:1;min-width:140px;"><b>'+escapeHtml(b.title||'(no title)')+'</b><div style="font-size:.76rem;color:var(--muted);">'+escapeHtml(b.subtitle||'')+'</div></div>'+
            '<label style="font-size:.78rem;display:flex;align-items:center;gap:5px;"><input type="checkbox" '+(b.active?'checked':'')+' onchange="toggleBannerActive(\''+doc.id+'\',this.checked)"> Active</label>'+
            '<button type="button" class="btn" style="padding:6px 10px;font-size:.78rem;background:#fde8e8;color:#c0392b;" onclick="deleteBanner(\''+doc.id+'\')">Delete</button>'+
          '</div>'
        );
      });
      list.innerHTML = rows.join('');
    }, function(){ list.innerHTML = '<p style="color:var(--muted);">Banners load nahi ho sake.</p>'; });
}
async function submitAddBanner(e){
  e.preventDefault();
  const errEl = document.getElementById('bannerAddError');
  errEl.classList.remove('show');
  const fileInput = document.getElementById('bnImage');
  const file = fileInput.files && fileInput.files[0];
  if(!file){ errEl.textContent='Banner image chunein'; errEl.classList.add('show'); return false; }
  const btn = document.getElementById('bnSubmitBtn');
  btn.disabled = true; btn.textContent = 'Upload ho raha hai…';
  try{
    const url = await uploadImageToCloudinary(file);
    const countSnap = await firebase.firestore().collection('banners').get();
    await firebase.firestore().collection('banners').add({
      imageUrl: url,
      title: document.getElementById('bnTitle').value.trim(),
      subtitle: document.getElementById('bnSubtitle').value.trim(),
      link: document.getElementById('bnLink').value.trim() || '#shop',
      order: countSnap.size,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('bannerAddForm').reset();
    toast('Banner add ho gaya!');
    loadHeroBanners();
  }catch(err){
    errEl.textContent = 'Banner add nahi ho saka. ('+((err&&err.message)||'error')+')';
    errEl.classList.add('show');
  }
  btn.disabled = false; btn.textContent = 'Banner Add Karein';
  return false;
}
async function toggleBannerActive(id, active){
  try{ await firebase.firestore().collection('banners').doc(id).update({ active: active }); loadHeroBanners(); }
  catch(e){ toast('Update nahi ho saka'); }
}
async function deleteBanner(id){
  if(!confirm('Ye banner delete karna hai?')) return;
  try{ await firebase.firestore().collection('banners').doc(id).delete(); toast('Banner delete ho gaya'); loadHeroBanners(); }
  catch(e){ toast('Delete nahi ho saka'); }
}

/* ---------- admin: coupons ---------- */
let adminCouponsUnsub = null;
function loadAdminCoupons(){
  const list = document.getElementById('adminCouponsList');
  list.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  if(adminCouponsUnsub) adminCouponsUnsub();
  adminCouponsUnsub = firebase.firestore().collection('coupons').orderBy('createdAt','desc')
    .onSnapshot(function(snap){
      if(snap.empty){ list.innerHTML = '<p style="color:var(--muted);">Abhi koi coupon nahi hai.</p>'; return; }
      const rows = [];
      snap.forEach(function(doc){
        const c = doc.data();
        const expiry = c.expiresAt && c.expiresAt.toDate ? c.expiresAt.toDate().toLocaleDateString('en-PK') : '—';
        rows.push(
          '<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'+
            '<div>'+
              '<b>'+escapeHtml(doc.id)+'</b> — '+(c.type==='percent'?(c.value+'% off'):(money(c.value)+' off'))+
              '<div style="font-size:.76rem;color:var(--muted);margin-top:2px;">'+
                (c.minOrder?('Min order: '+money(c.minOrder)+' · '):'')+
                'Used: '+(c.usedCount||0)+(c.usageLimit?('/'+c.usageLimit):'')+' · Expiry: '+expiry+
              '</div>'+
            '</div>'+
            '<div style="display:flex;gap:8px;align-items:center;">'+
              '<label style="font-size:.78rem;display:flex;align-items:center;gap:5px;"><input type="checkbox" '+(c.active?'checked':'')+' onchange="toggleCouponActive(\''+doc.id+'\',this.checked)"> Active</label>'+
              '<button type="button" class="btn" style="padding:6px 10px;font-size:.78rem;background:#fde8e8;color:#c0392b;" onclick="deleteCoupon(\''+doc.id+'\')">Delete</button>'+
            '</div>'+
          '</div>'
        );
      });
      list.innerHTML = rows.join('');
    }, function(){ list.innerHTML = '<p style="color:var(--muted);">Coupons load nahi ho sake.</p>'; });
}
async function submitAddCoupon(e){
  e.preventDefault();
  const errEl = document.getElementById('couponAddError');
  errEl.classList.remove('show');
  const code = document.getElementById('cpCode').value.trim().toUpperCase();
  const type = document.getElementById('cpType').value;
  const value = Number(document.getElementById('cpValue').value);
  const minOrderRaw = document.getElementById('cpMinOrder').value;
  const limitRaw = document.getElementById('cpLimit').value;
  const expiryRaw = document.getElementById('cpExpiry').value;
  if(!code || !value){ errEl.textContent='Code aur value zaroori hain'; errEl.classList.add('show'); return false; }
  try{
    await firebase.firestore().collection('coupons').doc(code).set({
      code: code,
      type: type,
      value: value,
      minOrder: minOrderRaw ? Number(minOrderRaw) : null,
      usageLimit: limitRaw ? Number(limitRaw) : null,
      usedCount: 0,
      active: true,
      expiresAt: expiryRaw ? firebase.firestore.Timestamp.fromDate(new Date(expiryRaw+'T23:59:59')) : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('couponAddForm').reset();
    toast('Coupon add ho gaya!');
  }catch(err){
    errEl.textContent = 'Coupon add nahi ho saka. ('+((err&&err.message)||'error')+')';
    errEl.classList.add('show');
  }
  return false;
}
async function toggleCouponActive(code, active){
  try{ await firebase.firestore().collection('coupons').doc(code).update({ active: active }); }
  catch(e){ toast('Update nahi ho saka'); }
}
async function deleteCoupon(code){
  if(!confirm('Ye coupon delete karna hai?')) return;
  try{ await firebase.firestore().collection('coupons').doc(code).delete(); toast('Coupon delete ho gaya'); }
  catch(e){ toast('Delete nahi ho saka'); }
}
function loadAdminOrders(){
  const list = document.getElementById('adminOrdersList');
  if(typeof firebase === 'undefined' || !firebase.firestore){
    list.innerHTML = '<p style="color:var(--muted);">Firestore setup nahi hai.</p>';
    return;
  }
  list.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  if(adminOrdersUnsub) adminOrdersUnsub();
  adminOrdersUnsub = firebase.firestore().collection('orders').orderBy('createdAt', 'desc').limit(200)
    .onSnapshot(function(snap){
      if(snap.empty){ list.innerHTML = '<p style="color:var(--muted);">Abhi koi order nahi aya.</p>'; return; }
      const showCancelled = document.getElementById('showCancelledToggle') && document.getElementById('showCancelledToggle').checked;
      const rows = [];
      snap.forEach(function(doc){
        const data = doc.data();
        const normalizedStatus = String(data.status||'pending').trim().toLowerCase();
        if(!showCancelled && normalizedStatus==='cancelled') return;
        rows.push(adminOrderRowHtml(doc.id, data));
      });
      list.innerHTML = rows.length ? rows.join('') : '<p style="color:var(--muted);">Koi (active) order nahi hai. Cancelled orders dekhne ke liye upar wala checkbox tick karein.</p>';
    }, function(err){
      let hint = '';
      if(err && err.code === 'permission-denied') hint = ' (Firestore rules mein "orders" collection ke liye read allow nahi hai — Firebase Console mein rules publish karein.)';
      else if(err && err.code === 'failed-precondition') hint = ' (Firestore index chahiye — console mein diya gaya link kholein aur index create karein.)';
      list.innerHTML = '<p style="color:var(--muted);">Orders load nahi ho sakay'+hint+'</p><p style="color:#c0392b;font-size:12px;word-break:break-all;">'+escapeHtml((err && (err.code+': '+err.message)) || 'unknown error')+'</p>';
    });
}
function adminOrderRowHtml(id, o){
  const currentStatus = String(o.status||'pending').trim().toLowerCase();
  const statusOptions = Object.keys(ORDER_STATUS_LABELS).map(function(s){
    return '<option value="'+s+'"'+(currentStatus===s?' selected':'')+'>'+ORDER_STATUS_LABELS[s]+'</option>';
  }).join('');
  let flags = '';
  if(o.cancelRequested){
    flags += '<div style="margin-top:8px;padding:8px 10px;background:#fde8e8;border-radius:8px;font-size:13px;color:#c0392b;display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
      '<span>⚠️ Customer ne is order ko cancel karne ki request ki hai</span>'+
      '<button type="button" class="btn" style="padding:4px 10px;font-size:12px;background:#fff;" onclick="clearOrderFlag(\''+id+'\',\'cancelRequested\')">Clear</button>'+
    '</div>';
  }
  if(o.returnRequested){
    flags += '<div style="margin-top:8px;padding:8px 10px;background:#fff3d6;border-radius:8px;font-size:13px;color:#b8860b;display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
      '<span>↩️ Return request'+(o.returnReason?(': '+escapeHtml(o.returnReason)):'')+'</span>'+
      '<button type="button" class="btn" style="padding:4px 10px;font-size:12px;background:#fff;" onclick="clearOrderFlag(\''+id+'\',\'returnRequested\')">Clear</button>'+
    '</div>';
  }
  return '<div style="border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:14px;margin-bottom:10px;">'+
    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">'+
      '<div>'+
        '<b>'+escapeHtml(o.fullName||'')+'</b> · '+escapeHtml(o.phone||'')+'<br>'+
        '<span style="color:#667;font-size:13px;">'+escapeHtml(o.timestamp||'')+' · '+escapeHtml(o.paymentMethod||'')+'</span>'+
      '</div>'+
      '<select onchange="updateOrderStatus(\''+id+'\', this.value)" style="height:34px;border-radius:8px;">'+statusOptions+'</select>'+
    '</div>'+
    '<div style="margin-top:8px;font-size:14px;">'+escapeHtml(o.orderItems||'')+'</div>'+
    '<div style="margin-top:4px;color:#667;font-size:13px;">'+escapeHtml(o.address||'')+'</div>'+
    '<div style="margin-top:6px;font-weight:700;">'+money(o.totalAmount||0)+'</div>'+
    flags+
  '</div>';
}
async function clearOrderFlag(id, field){
  try{
    const update = {}; update[field] = false;
    await firebase.firestore().collection('orders').doc(id).update(update);
    toast('Clear ho gaya');
  }catch(e){ toast('Fail ho gaya'); }
}
function updateOrderStatus(id, status){
  if(typeof firebase === 'undefined' || !firebase.firestore) return;
  const normalized = String(status||'pending').trim().toLowerCase();
  firebase.firestore().collection('orders').doc(id).update({status: normalized})
    .then(function(){ toast('Order status update ho gaya'); })
    .catch(function(){ toast('Status update fail ho gaya'); });
}

/* ---------- admin: add products from markaz (supplier) links ---------- */
const LINK_ADD_PROFIT = 400; // Rs added on top of the markaz price automatically
const MULTI_LINK_MAX = 30; // safety cap on how many links can be processed in one go
const MULTI_LINK_CONCURRENCY = 4; // how many links are fetched in parallel

/* Runs `worker` over `items` with at most `limit` running at once, and
   returns once every item has been processed (order of completion doesn't
   matter here — each worker reports its own result as it finishes). */
async function runWithConcurrency(items, limit, worker){
  let idx = 0;
  async function lane(){
    while(idx < items.length){
      const cur = idx++;
      await worker(items[cur], cur);
    }
  }
  const lanes = Array.from({length: Math.max(1, Math.min(limit, items.length))}, lane);
  await Promise.all(lanes);
}

/* Calls the /api/fetch-product endpoint for one markaz link. Throws a
   labelled error for the caller to turn into a friendly message. */
async function fetchMarkazProductData(url){
  let res;
  try{
    res = await fetch('/api/fetch-product?url=' + encodeURIComponent(url));
  }catch(e){
    throw new Error('NETWORK');
  }
  if(res.status === 404) throw new Error('FEATURE_404');
  const contentType = res.headers.get('content-type') || '';
  if(!contentType.includes('application/json')) throw new Error('BAD_RESPONSE');
  return await res.json();
}

/* Splits the textarea into a clean, deduped list of links — admins can put
   one link per line (recommended) or separate them with commas/semicolons. */
function parseMultiLinkInput(raw){
  const parts = String(raw||'').split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);
  return Array.from(new Set(parts));
}

async function handleMultiLinkAdd(){
  const textEl = document.getElementById('flUrls');
  const resultEl = document.getElementById('flResult');
  const btn = document.getElementById('flFetchBtn');

  let urls = parseMultiLinkInput(textEl.value);
  if(!urls.length){ resultEl.innerHTML = '<p style="color:#c0392b;">Kam az kam ek markaz product link paste karein (ek line mein ek link).</p>'; return; }

  let trimmedNotice = '';
  if(urls.length > MULTI_LINK_MAX){
    trimmedNotice = '<p style="color:#c0392b;">Ek dafa mein zyada se zyada '+MULTI_LINK_MAX+' links chalte hain — pehle '+MULTI_LINK_MAX+' process kiye ja rahe hain, baaki links dobara paste kar ke chala lein.</p>';
    urls = urls.slice(0, MULTI_LINK_MAX);
  }

  const invalid = [];
  const valid = [];
  urls.forEach(u=>{
    try{ new URL(u); valid.push(u); }catch(e){ invalid.push(u); }
  });

  if(!valid.length){
    resultEl.innerHTML = trimmedNotice + '<p style="color:#c0392b;">Koi bhi link sahi format mein nahi hai.</p>';
    return;
  }

  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = 'Products add ho rahe hain…';

  const total = valid.length;
  let done = 0;
  function updateProgress(){
    resultEl.innerHTML = trimmedNotice + '<p style="color:var(--muted);">'+done+' / '+total+' links process ho chuke hain…</p>';
  }
  updateProgress();

  const successes = []; // {name, price}
  const failures = [];  // {url, reason}

  await runWithConcurrency(valid, MULTI_LINK_CONCURRENCY, async (url, i)=>{
    try{
      const data = await fetchMarkazProductData(url);
      if(!data || !data.ok){
        failures.push({url, reason: (data && data.message) || 'Is link se detail nahi mili.'});
        return;
      }

      const name = data.name || null;
      const markazPrice = (typeof data.price === 'number') ? data.price : null;
      if(!name || markazPrice == null){
        failures.push({url, reason: 'Naam ya price nahi mili — is link ko Products tab se khud bhar kar add karein.'});
        return;
      }

      const fetchedImages = (Array.isArray(data.images) ? data.images.filter(Boolean) : []);
      if(!fetchedImages.length){
        failures.push({url, reason: '"'+name+'" ki koi tasveer nahi mili — Products tab mein jaa kar is naam se tasveer ke sath khud add karein.'});
        return;
      }

      const price = markazPrice + LINK_ADD_PROFIT;
      const productId = 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '_' + i;
      const scrapedSizes = (Array.isArray(data.sizes) ? data.sizes.map(s=>String(s).trim()).filter(Boolean) : []);
      const product = {
        id: productId,
        category: 'other',
        name: name,
        price: price,
        oldPrice: null,
        desc: (data.description || '').trim() || null,
        sizes: scrapedSizes.length ? scrapedSizes : ['Standard'],
        sizeLabel: 'Size',
        colors: [],
        videoUrl: null,
        stockStatus: 'in',
        stockQty: 40,
        hidden: false,
        deliveryCharge: (data.deliveryCharge != null) ? data.deliveryCharge : DELIVERY_CHARGE,
        flashSale: false,
        details: [],
        note: null,
        productCode: null,
        images: fetchedImages.map(u=>({src:u, alt:name})),
        badge: 'New',
        addedByAdmin: true
      };

      const saved = await saveCustomProduct(product);
      ALL_PRODUCTS = ALL_PRODUCTS.filter(p=>p.id !== saved.id).concat([saved]);
      successes.push({name, price});
    }catch(e){
      const reason = (e && e.message === 'FEATURE_404')
        ? '"Link Se Add" feature is hosting par kaam nahi karta (404) — Vercel deployment check karein.'
        : (e && e.message === 'BAD_RESPONSE')
          ? 'Server se sahi jawab nahi mila.'
          : 'Detail nahi la saka — internet ya link check karein.';
      failures.push({url, reason});
    }finally{
      done++; updateProgress();
    }
  });

  btn.disabled = false; btn.textContent = origText;

  if(successes.length){
    buildCategories();
    renderProducts();
    renderAdminProductList();
  }

  let html = trimmedNotice;
  html += '<p style="font-weight:700;color:'+(successes.length?'#1a7a3c':'#c0392b')+';">'+successes.length+' products add ho gaye'+(failures.length?', '+failures.length+' fail hue':'')+'.</p>';
  if(successes.length){
    html += '<ul style="font-size:13px;margin-top:6px;padding-left:18px;">'+successes.map(s=>'<li>'+escapeHtml(s.name)+' — '+money(s.price)+'</li>').join('')+'</ul>';
  }
  if(failures.length){
    html += '<p style="margin-top:10px;font-weight:600;color:#c0392b;">Ye links fail hue:</p>';
    html += '<ul style="color:#c0392b;font-size:13px;margin-top:4px;padding-left:18px;word-break:break-all;">'+failures.slice(0,20).map(f=>'<li>'+escapeHtml(f.url)+' — '+escapeHtml(f.reason)+'</li>').join('')+'</ul>';
    if(failures.length>20) html += '<p style="color:#c0392b;font-size:13px;">...aur '+(failures.length-20)+' fail hue links.</p>';
  }
  if(invalid.length){
    html += '<p style="margin-top:10px;font-weight:600;color:#c0392b;">Ye sahi link format mein nahi thay, ignore ho gaye:</p>';
    html += '<ul style="color:#c0392b;font-size:13px;margin-top:4px;padding-left:18px;word-break:break-all;">'+invalid.slice(0,20).map(u=>'<li>'+escapeHtml(u)+'</li>').join('')+'</ul>';
  }
  resultEl.innerHTML = html;

  if(successes.length){
    toast(successes.length+' products add ho gaye');
    textEl.value = failures.length ? failures.map(f=>f.url).join('\n') : '';
  }
}

/* ---------- admin: CSV bulk upload ---------- */
function downloadSampleCsv(){
  const header = 'name,category,price,oldPrice,images,videoUrl,colors,sizes,flashSale,stockStatus,stockQty,hidden,deliveryCharge,desc';
  const example1 = 'Ishq Calligraphy T-Shirt,kapray,1000,1300,"https://example.com/img1.jpg;https://example.com/img2.jpg",,,"Small;Medium;Large;X-Large",no,in,20,no,200,"Men\'s olive green cotton tee"';
  const example2 = 'Rexine Slides,joota,800,,https://example.com/slide1.jpg,,"Black;White",Standard,yes,in,,no,150,';
  const csv = [header, example1, example2].join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'al-hadi-store-sample-products.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Minimal CSV parser — handles quoted fields (so commas/newlines inside
   a "..." cell, e.g. a description, don't break columns). */
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n' || c === '\r'){
        if(c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field = '';
        if(!(row.length===1 && row[0]==='')){ rows.push(row); }
        row = [];
      } else { field += c; }
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h,idx)=>{ obj[h] = (r[idx] !== undefined ? r[idx].trim() : ''); });
      return obj;
    });
}

async function handleBulkUpload(){
  const fileInput = document.getElementById('bulkCsvFile');
  const resultEl = document.getElementById('bulkUploadResult');
  const file = fileInput.files && fileInput.files[0];
  if(!file){ resultEl.innerHTML = '<p style="color:#c0392b;">Pehle CSV file select karein.</p>'; return; }

  resultEl.innerHTML = '<p style="color:var(--muted);">Padha ja raha hai…</p>';
  let rows;
  try{
    const text = await file.text();
    rows = parseCSV(text);
  }catch(e){
    resultEl.innerHTML = '<p style="color:#c0392b;">CSV file parh nahi saka — file format check karein.</p>';
    return;
  }
  if(!rows.length){ resultEl.innerHTML = '<p style="color:#c0392b;">CSV mein koi product row nahi mili.</p>'; return; }

  let successCount = 0, failCount = 0;
  const errors = [];
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const name = (r.name||'').trim();
    const price = Number(r.price);
    if(!name || !price){ failCount++; errors.push('Row '+(i+2)+': naam ya price missing/invalid hai.'); continue; }
    const images = (r.images||'').split(';').map(s=>s.trim()).filter(Boolean).map(u=>({src:u, alt:name}));
    if(!images.length){ failCount++; errors.push('Row '+(i+2)+' ('+name+'): kam az kam ek image URL zaroori hai.'); continue; }
    const sizesList = (r.sizes||'').split(';').map(s=>s.trim()).filter(Boolean);
    const productId = 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '_' + i;
    const product = {
      id: productId,
      category: (r.category||'').trim() || 'other',
      name: name,
      price: price,
      oldPrice: r.oldPrice ? Number(r.oldPrice) : null,
      desc: r.desc || null,
      sizes: sizesList.length ? sizesList : ['Standard'],
      sizeLabel: 'Size',
      colors: (r.colors||'').split(';').map(s=>s.trim()).filter(Boolean),
      videoUrl: r.videoUrl || null,
      stockStatus: (String(r.stockStatus).toLowerCase()==='out') ? 'out' : 'in',
      stockQty: r.stockQty ? Math.max(0, parseInt(r.stockQty,10)||0) : null,
      hidden: (String(r.hidden).toLowerCase()==='yes'),
      deliveryCharge: r.deliveryCharge ? Number(r.deliveryCharge) : DELIVERY_CHARGE,
      flashSale: (String(r.flashSale).toLowerCase()==='yes'),
      details: [],
      note: null,
      productCode: null,
      images: images,
      badge: (String(r.flashSale).toLowerCase()==='yes') ? 'Flash Sale' : 'New',
      addedByAdmin: true
    };
    try{
      const saved = await saveCustomProduct(product);
      ALL_PRODUCTS = ALL_PRODUCTS.filter(p=>p.id !== saved.id).concat([saved]);
      successCount++;
    }catch(e){
      failCount++;
      errors.push('Row '+(i+2)+' ('+name+'): save nahi ho saka.');
    }
  }

  buildCategories();
  renderProducts();
  renderAdminProductList();

  let html = '<p style="font-weight:700;">'+successCount+' products add ho gaye'+(failCount?', '+failCount+' fail hue':'')+'.</p>';
  if(errors.length){
    html += '<ul style="color:#c0392b;font-size:13px;margin-top:6px;padding-left:18px;">'+errors.slice(0,10).map(e=>'<li>'+escapeHtml(e)+'</li>').join('')+'</ul>';
    if(errors.length>10) html += '<p style="color:#c0392b;font-size:13px;">...aur '+(errors.length-10)+' errors.</p>';
  }
  resultEl.innerHTML = html;
  fileInput.value = '';
  if(successCount) toast(successCount+' products upload ho gaye');
}

/* ---------- analytics ---------- */
function trackEvent(type, productId){
  if(typeof firebase === 'undefined' || !firebase.firestore) return;
  try{
    const updates = { lastUpdated: firebase.firestore.FieldValue.serverTimestamp() };
    if(type === 'page_view'){
      updates.totalPageViews = firebase.firestore.FieldValue.increment(1);
    } else if(type === 'product_view' && productId){
      updates.totalProductViews = firebase.firestore.FieldValue.increment(1);
      updates['productViews.'+productId] = firebase.firestore.FieldValue.increment(1);
    } else if(type === 'add_to_cart' && productId){
      updates.totalAddToCart = firebase.firestore.FieldValue.increment(1);
      updates['productAddToCart.'+productId] = firebase.firestore.FieldValue.increment(1);
    } else { return; }
    firebase.firestore().collection('analytics').doc('summary').set(updates, {merge:true});
  }catch(e){ /* analytics kabhi bhi site ko break nahi karni chahiye */ }
}

function statCard(label, value){
  return '<div style="border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:14px;text-align:center;">'+
    '<div style="font-size:22px;font-weight:800;">'+value+'</div>'+
    '<div style="font-size:12px;color:var(--muted,#667);margin-top:2px;">'+label+'</div>'+
  '</div>';
}

const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let ADMIN_ANALYTICS_MONTHLY = []; // cached for PDF export: [{key,label,orders,revenue}]

function monthlySalesFromOrders(ordersSnap){
  const byMonth = {}; // 'YYYY-MM' -> {orders, revenue}
  ordersSnap.forEach(function(doc){
    const o = doc.data();
    const status = (o.status||'pending').toLowerCase();
    if(status==='cancelled') return; // cancelled orders aren't real sales
    if(!o.createdAt || !o.createdAt.toDate) return;
    const d = o.createdAt.toDate();
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!byMonth[key]) byMonth[key] = { orders:0, revenue:0, y:d.getFullYear(), m:d.getMonth() };
    byMonth[key].orders++;
    byMonth[key].revenue += Number(o.totalAmount||0);
  });
  return Object.keys(byMonth).sort().reverse().map(function(key){
    const v = byMonth[key];
    return { key: key, label: MONTH_NAMES_SHORT[v.m]+' '+v.y, orders: v.orders, revenue: v.revenue };
  });
}

async function loadAdminAnalytics(){
  const el = document.getElementById('adminAnalyticsContent');
  if(typeof firebase === 'undefined' || !firebase.firestore){
    el.innerHTML = '<p style="color:var(--muted);">Firestore setup nahi hai.</p>';
    return;
  }
  el.innerHTML = '<p style="color:var(--muted);">Loading…</p>';
  try{
    const summaryPromise = firebase.firestore().collection('analytics').doc('summary').get();
    const ordersPromise = firebase.firestore().collection('orders').get();
    const [summarySnap, ordersSnap] = await Promise.all([summaryPromise, ordersPromise]);
    const summary = summarySnap.exists ? (summarySnap.data()||{}) : {};
    let totalOrders = 0, totalRevenue = 0, cancelledOrders = 0;
    ordersSnap.forEach(function(doc){
      const o = doc.data();
      const status = (o.status||'pending').toLowerCase();
      totalOrders++;
      if(status==='cancelled'){ cancelledOrders++; return; }
      totalRevenue += Number(o.totalAmount || 0);
    });

    const monthly = monthlySalesFromOrders(ordersSnap);
    ADMIN_ANALYTICS_MONTHLY = monthly;

    const productViews = summary.productViews || {};
    const productCarts = summary.productAddToCart || {};
    function nameOf(id){ const p = ALL_PRODUCTS.find(x=>x.id===id); return p ? p.name : id; }

    const topViews = Object.entries(productViews).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    const topCarts = Object.entries(productCarts).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

    const monthlyRows = monthly.length ?
      monthly.map(function(r){
        return '<tr><td style="padding:8px 6px;border-bottom:1px solid rgba(0,0,0,.08);">'+r.label+'</td>'+
          '<td style="padding:8px 6px;border-bottom:1px solid rgba(0,0,0,.08);text-align:center;">'+r.orders+'</td>'+
          '<td style="padding:8px 6px;border-bottom:1px solid rgba(0,0,0,.08);text-align:right;">'+money(r.revenue)+'</td></tr>';
      }).join('') :
      '<tr><td colspan="3" style="padding:10px 6px;color:var(--muted);">Abhi koi sale nahi hui.</td></tr>';

    el.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">'+
        statCard('Total Visits', summary.totalPageViews||0)+
        statCard('Product Views', summary.totalProductViews||0)+
        statCard('Add to Cart', summary.totalAddToCart||0)+
        statCard('Total Orders', totalOrders)+
      '</div>'+
      '<div style="font-weight:700;margin-bottom:4px;">Total Sale (cancelled orders shamil nahi): '+money(totalRevenue)+'</div>'+
      (cancelledOrders ? '<div style="font-size:12px;color:var(--muted);margin-bottom:16px;">'+cancelledOrders+' cancelled order(s) is total mein shamil nahi ki gayi.</div>' : '<div style="margin-bottom:16px;"></div>')+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
        '<b>Monthly Sales (har mahine ki total sale)</b>'+
        '<button type="button" class="btn btn-navy" style="padding:6px 14px;font-size:13px;" onclick="exportAnalyticsPDF()">PDF Download Karein</button>'+
      '</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">'+
        '<thead><tr>'+
          '<th style="text-align:left;padding:8px 6px;border-bottom:2px solid rgba(0,0,0,.15);">Month</th>'+
          '<th style="text-align:center;padding:8px 6px;border-bottom:2px solid rgba(0,0,0,.15);">Orders</th>'+
          '<th style="text-align:right;padding:8px 6px;border-bottom:2px solid rgba(0,0,0,.15);">Sale Amount</th>'+
        '</tr></thead>'+
        '<tbody>'+monthlyRows+'</tbody>'+
      '</table>'+
      '<div style="margin-bottom:16px;"><b>Sab se zyada dekhe gaye products:</b>'+
        (topViews.length ? '<ol style="margin:8px 0 0;padding-left:20px;">'+topViews.map(function(e){return '<li>'+escapeHtml(nameOf(e[0]))+' — '+e[1]+' views</li>';}).join('')+'</ol>' : '<p style="color:var(--muted);margin:6px 0 0;">Abhi data nahi hai.</p>')+
      '</div>'+
      '<div><b>Sab se zyada cart mein dale gaye products:</b>'+
        (topCarts.length ? '<ol style="margin:8px 0 0;padding-left:20px;">'+topCarts.map(function(e){return '<li>'+escapeHtml(nameOf(e[0]))+' — '+e[1]+' baar</li>';}).join('')+'</ol>' : '<p style="color:var(--muted);margin:6px 0 0;">Abhi data nahi hai.</p>')+
      '</div>';
  }catch(e){
    let hint = '';
    if(e && e.code === 'permission-denied') hint = ' (Firestore rules mein "analytics"/"orders" collections ke liye read allow nahi hai — Firebase Console mein rules publish karein.)';
    else if(e && e.code === 'failed-precondition') hint = ' (Firestore index chahiye — console mein diya gaya link kholein aur index create karein.)';
    el.innerHTML = '<p style="color:var(--muted);">Analytics load nahi ho saka'+hint+'</p><p style="color:#c0392b;font-size:12px;word-break:break-all;">'+escapeHtml((e && (e.code+': '+e.message)) || 'unknown error')+'</p>';
  }
}

function exportAnalyticsPDF(){
  const rows = ADMIN_ANALYTICS_MONTHLY;
  const totalRevenue = rows.reduce(function(s,r){ return s+r.revenue; }, 0);
  const totalOrders = rows.reduce(function(s,r){ return s+r.orders; }, 0);
  const rowsHtml = rows.length ? rows.map(function(r){
    return '<tr><td>'+r.label+'</td><td style="text-align:center;">'+r.orders+'</td><td style="text-align:right;">'+money(r.revenue)+'</td></tr>';
  }).join('') : '<tr><td colspan="3">Abhi koi sale nahi hui.</td></tr>';

  const win = window.open('', '_blank');
  if(!win){ alert('Popup block ho gaya — is site ke liye popups allow karein aur dobara try karein.'); return; }
  win.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>Al Hadi Store - Sales Report</title>'+
    '<style>'+
      'body{font-family:Arial,Helvetica,sans-serif;color:#222;padding:32px;}'+
      'h1{font-size:20px;margin-bottom:2px;}'+
      '.sub{color:#666;font-size:12px;margin-bottom:20px;}'+
      'table{width:100%;border-collapse:collapse;font-size:13px;}'+
      'th,td{padding:8px 10px;border-bottom:1px solid #ddd;}'+
      'th{text-align:left;background:#f4f4f4;}'+
      '.totals{margin-top:18px;font-size:14px;font-weight:bold;}'+
      '@media print{ .no-print{display:none;} }'+
    '</style></head><body>'+
    '<h1>Al Hadi Store — Monthly Sales Report</h1>'+
    '<div class="sub">Generated: '+new Date().toLocaleString('en-PK')+'</div>'+
    '<table><thead><tr><th>Month</th><th style="text-align:center;">Orders</th><th style="text-align:right;">Sale Amount</th></tr></thead>'+
    '<tbody>'+rowsHtml+'</tbody></table>'+
    '<div class="totals">Total Orders: '+totalOrders+' &nbsp;|&nbsp; Total Sale: '+money(totalRevenue)+'</div>'+
    '<p class="no-print" style="margin-top:24px;color:#666;font-size:12px;">Print dialog mein "Save as PDF" choose karein.</p>'+
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function(){ win.print(); }, 300);
}

loadCart();
updateCartUI();
loadProducts();
watchCustomProducts();
trackEvent('page_view');
loadHeroBanners();
watchMyOrdersForNotifications();
