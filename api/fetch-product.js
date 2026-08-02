// Runs on Vercel as a Serverless Function.
// Purpose: Admin panel "Link Se Add Karein" feature. Admin pastes a product
// link from the supplier / wholesale site ("markaz"), and this function
// fetches that page server-side (browsers can't do this directly — most
// sites block cross-origin fetches) and pulls out whatever product info it
// can find: name, description, price, and a delivery/shipping charge if the
// page mentions one. The admin still adds the photo(s) themselves.
//
// This is best-effort scraping, not a guaranteed exact match — different
// supplier sites structure their pages differently. It tries, in order:
//   1) schema.org "Product" JSON-LD (most Shopify/WooCommerce sites have this)
//   2) Open Graph / standard meta tags
//   3) A loose text search for a delivery/shipping charge mentioned on the page
//
// No external npm packages are used (kept dependency-free like product-og.js).

const MAX_HTML_BYTES = 3 * 1024 * 1024; // don't buffer more than ~3MB of HTML
const FETCH_TIMEOUT_MS = 12000;

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  // block IPv4 private / loopback / link-local ranges and the cloud metadata IP
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h === '::1') return true;
  return false;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim();
}

// Some sites put raw HTML inside JSON-LD "description" or a Shopify
// product JSON's "body_html" — this strips the tags and tidies whitespace
// so we don't save "<p>Some <b>text</b></p>" straight into the product desc.
function stripHtml(s) {
  if (!s) return null;
  const text = decodeEntities(
    String(s)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/^\s+|\s+$/g, '') || null;
}

function extractMeta(html, key) {
  // matches <meta property="X" content="Y"> or <meta name="X" content="Y">, either attribute order
  const patterns = [
    new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]+content=["\']([^"\']*)["\']', 'i'),
    new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + key + '["\']', 'i')
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function extractAllMeta(html, key) {
  const out = [];
  const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]+content=["\']([^"\']*)["\']', 'gi');
  let m;
  while ((m = re.exec(html))) out.push(decodeEntities(m[1]));
  return out;
}

function extractJsonLdProduct(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);

  function flatten(node, out) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(n => flatten(n, out)); return; }
    if (typeof node !== 'object') return;
    if (node['@graph']) flatten(node['@graph'], out);
    out.push(node);
  }

  for (const raw of blocks) {
    let parsed;
    try { parsed = JSON.parse(raw.trim()); } catch (e) { continue; }
    const flat = [];
    flatten(parsed, flat);
    const product = flat.find(n => {
      const t = n['@type'];
      return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
    });
    if (product) return product;
  }
  return null;
}

function numberFromPriceString(v) {
  if (v == null) return null;
  const cleaned = String(v).replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n);
}

function findDeliveryCharge(plainText) {
  // Looks for phrases like "Delivery Charges: Rs 200" / "Shipping fee PKR 150" etc.
  const re = /(delivery|shipping)[^.\n\d]{0,25}(?:rs\.?|pkr|₨)?\s*([\d,]{2,6})/i;
  const m = plainText.match(re);
  if (!m) return null;
  const n = numberFromPriceString(m[2]);
  if (n == null || n <= 0 || n > 20000) return null; // sanity bounds
  return n;
}

const SIZE_WORD_RE = /^(x{0,3}(s|m|l)|xs|xl|xxl|xxxl|small|medium|large|free\s*size|standard|one\s*size|\d{1,3}(\.\d)?\s*(cm|in|ml|kg|g)?)$/i;

function cleanOptionList(list) {
  const seen = new Set();
  const out = [];
  for (let raw of list) {
    if (typeof raw !== 'string') continue;
    let v = decodeEntities(raw).trim();
    if (!v) continue;
    // drop obvious placeholder / non-option junk
    if (/^(select|choose|please select|--|—|n\/a)/i.test(v)) continue;
    if (v.length > 40) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.slice(0, 20);
}

// Best-effort search for size / variant options across a few common
// supplier-site patterns. Returns an array of strings (e.g. ["S","M","L"])
// or null if nothing usable was found — caller falls back to ["Standard"].
function extractSizeOptions(html, jsonLd) {
  // 1) schema.org Product with variants (hasVariant / additionalProperty)
  if (jsonLd) {
    if (Array.isArray(jsonLd.hasVariant)) {
      const names = jsonLd.hasVariant
        .map(v => v && (v.size || v.name || (v.additionalProperty && v.additionalProperty.value)))
        .filter(Boolean);
      const cleaned = cleanOptionList(names);
      if (cleaned.length > 1) return cleaned;
    }
    if (Array.isArray(jsonLd.additionalProperty)) {
      const sizeProp = jsonLd.additionalProperty.find(p => p && /size/i.test(p.name || ''));
      if (sizeProp && sizeProp.value) {
        const cleaned = cleanOptionList(String(sizeProp.value).split(/[,/]/));
        if (cleaned.length > 1) return cleaned;
      }
    }
  }

  // 2) Shopify-style embedded product JSON: <script id="ProductJson-...">
  //    contains {"options":[{"name":"Size","values":["S","M","L"]}], ...}
  //    or a top-level {"variants":[{"option1":"S"}, ...]}
  const shopifyRe = /<script[^>]+id=["']ProductJson[^"']*["'][^>]*>([\s\S]*?)<\/script>/i;
  const shopifyM = html.match(shopifyRe);
  if (shopifyM) {
    try {
      const data = JSON.parse(shopifyM[1].trim());
      if (Array.isArray(data.options)) {
        const sizeOpt = data.options.find(o => o && /size/i.test(typeof o === 'string' ? o : (o.name || '')));
        if (sizeOpt && Array.isArray(sizeOpt.values)) {
          const cleaned = cleanOptionList(sizeOpt.values);
          if (cleaned.length > 1) return cleaned;
        }
      }
      if (Array.isArray(data.variants)) {
        const opt1 = data.variants.map(v => v && v.option1).filter(Boolean);
        const cleaned = cleanOptionList(opt1);
        if (cleaned.length > 1) return cleaned;
      }
    } catch (e) { /* not valid JSON, ignore */ }
  }

  // 3) A <select> element whose name/id/class mentions "size", reading its <option> labels
  const selectRe = /<select[^>]*(?:name|id|class)=["'][^"']*size[^"']*["'][^>]*>([\s\S]*?)<\/select>/i;
  const selectM = html.match(selectRe);
  if (selectM) {
    const optionRe = /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
    const labels = [];
    let om;
    while ((om = optionRe.exec(selectM[1]))) {
      const label = stripHtml(om[2]) || om[1];
      if (label) labels.push(label);
    }
    const cleaned = cleanOptionList(labels);
    if (cleaned.length > 1) return cleaned;
  }

  // 4) Buttons/spans/labels inside a "size" swatch block, e.g.
  //    <div class="size-swatch"><span>S</span><span>M</span><span>L</span></div>
  const swatchRe = /<[^>]+class=["'][^"']*size[^"'\s]*(?:swatch|option|selector|list|group)[^"']*["'][^>]*>([\s\S]{0,1500}?)<\/div>/i;
  const swatchM = html.match(swatchRe);
  if (swatchM) {
    const itemRe = /<(?:span|button|label|li)[^>]*>([\s\S]*?)<\/(?:span|button|label|li)>/gi;
    const labels = [];
    let im;
    while ((im = itemRe.exec(swatchM[1]))) {
      const label = stripHtml(im[1]);
      if (label) labels.push(label);
    }
    const cleaned = cleanOptionList(labels.filter(l => SIZE_WORD_RE.test(l) || l.length <= 6));
    if (cleaned.length > 1) return cleaned;
  }

  // 5) Loose text fallback: "Size: S, M, L, XL" mentioned in the page copy
  const plain = stripHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '));
  if (plain) {
    const m = plain.match(/size[s]?\s*[:\-]\s*([A-Za-z0-9,\/\s]{2,60})/i);
    if (m) {
      const cleaned = cleanOptionList(m[1].split(/[,\/]+/));
      const looksLikeSizes = cleaned.length > 1 && cleaned.every(c => SIZE_WORD_RE.test(c));
      if (looksLikeSizes) return cleaned;
    }
  }

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const rawUrl = (req.query && req.query.url) || '';
  let target;
  try {
    target = new URL(rawUrl);
  } catch (e) {
    return res.status(400).json({ ok: false, message: 'Link sahi format mein nahi hai.' });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return res.status(400).json({ ok: false, message: 'Sirf http/https links chalte hain.' });
  }
  if (isPrivateHost(target.hostname)) {
    return res.status(400).json({ ok: false, message: 'Yeh link support nahi hota.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html;
  try {
    const response = await fetch(target.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlHadiStoreBot/1.0; +https://alhadi.store)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timer);
    if (!response.ok) {
      return res.status(200).json({ ok: false, message: 'Markaz ki site ne page nahi diya (status ' + response.status + '). Link check karein.' });
    }
    const reader = response.body ? response.body.getReader() : null;
    if (reader) {
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_HTML_BYTES) break;
        chunks.push(value);
      }
      html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } else {
      html = await response.text();
    }
  } catch (err) {
    clearTimeout(timer);
    const msg = (err && err.name === 'AbortError')
      ? 'Markaz ki site jawab dene mein bohot time le rahi hai.'
      : 'Is link se detail nahi la saka — site tak pohanch nahi hui.';
    return res.status(200).json({ ok: false, message: msg });
  }

  try {
    const jsonLd = extractJsonLdProduct(html);

    let name = null, description = null, price = null, images = [];

    if (jsonLd) {
      name = decodeEntities(typeof jsonLd.name === 'string' ? jsonLd.name : null);
      description = stripHtml(typeof jsonLd.description === 'string' ? jsonLd.description : null);
      let offers = jsonLd.offers;
      if (Array.isArray(offers)) offers = offers[0];
      if (offers) {
        price = numberFromPriceString(offers.price || offers.lowPrice);
      }
      let img = jsonLd.image;
      if (typeof img === 'string') images = [img];
      else if (Array.isArray(img)) images = img.filter(x => typeof x === 'string');
      else if (img && img.url) images = [img.url];
    }

    if (!name) name = extractMeta(html, 'og:title');
    if (!description) description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    if (!description) {
      // Shopify-style embedded product JSON often has a full HTML description
      // ("body_html") even when og:description is missing or truncated.
      const shopifyM = html.match(/<script[^>]+id=["']ProductJson[^"']*["'][^>]*>([\s\S]*?)<\/script>/i);
      if (shopifyM) {
        try {
          const data = JSON.parse(shopifyM[1].trim());
          if (data && typeof data.description === 'string') description = stripHtml(data.description);
        } catch (e) { /* ignore */ }
      }
    }
    if (!price) {
      const priceMeta = extractMeta(html, 'product:price:amount') || extractMeta(html, 'og:price:amount') || extractMeta(html, 'twitter:data1');
      price = numberFromPriceString(priceMeta);
    }
    if (!images.length) {
      const ogImages = extractAllMeta(html, 'og:image');
      if (ogImages.length) images = ogImages;
    }
    if (!name) {
      const t = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (t) name = decodeEntities(t[1]);
    }

    const plainText = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    const deliveryCharge = findDeliveryCharge(plainText);
    const sizes = extractSizeOptions(html, jsonLd);

    if (!name && !price) {
      return res.status(200).json({ ok: false, message: 'Is page se product ki detail nahi mil saki. Naam/price khud likh lein.' });
    }

    return res.status(200).json({
      ok: true,
      name: name || null,
      description: description || null,
      price: price,
      images: images.slice(0, 5),
      deliveryCharge: deliveryCharge,
      sizes: sizes, // array of option labels (e.g. ["S","M","L"]) or null if none found
      sourceUrl: target.toString()
    });
  } catch (err) {
    return res.status(200).json({ ok: false, message: 'Page parse karte waqt masla hua.' });
  }
};
