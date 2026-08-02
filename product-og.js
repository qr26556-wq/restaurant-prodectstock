// api/product-og.js
// Vercel serverless function.
// vercel.json already routes requests like "/?p=PRODUCT_ID" to this file
// ONLY when the request comes from a bot (WhatsApp, Facebook, Twitter, etc).
// Normal human visitors keep loading index.html as usual — this file never
// touches the shopping experience.
//
// Job of this file: fetch that one product from Firestore and return a tiny
// HTML page whose <meta property="og:image"> points at THAT product's photo,
// so WhatsApp/Facebook/Instagram show the right picture in the link preview.

const PROJECT_ID = 'al-hadi-store-b'; // <-- change this if your Firebase project id is different
const SITE_URL = 'https://alhadi.store'; // <-- change this if your live domain is different

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Firestore REST documents come back as {fields: {name: {stringValue: "..."}}}
// This turns that into a normal plain object.
function parseFirestoreFields(fields) {
  const out = {};
  for (const key in fields) {
    const val = fields[key];
    if (val.stringValue !== undefined) out[key] = val.stringValue;
    else if (val.integerValue !== undefined) out[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) out[key] = val.doubleValue;
    else if (val.booleanValue !== undefined) out[key] = val.booleanValue;
    else if (val.arrayValue !== undefined) {
      out[key] = (val.arrayValue.values || []).map((v) =>
        v.stringValue !== undefined ? v.stringValue : v
      );
    } else {
      out[key] = null;
    }
  }
  return out;
}

module.exports = async (req, res) => {
  try {
    const productId = req.query.p;

    // Fallback card (used if no product id, or product not found/error)
    const fallback = () => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Al Hadi Store</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Al Hadi Store">
<meta property="og:title" content="Al Hadi Store — Online Shopping in Pakistan">
<meta property="og:description" content="Shop clothing, footwear & lifestyle products online in Pakistan.">
<meta property="og:image" content="${SITE_URL}/assets/og-image.png">
<meta http-equiv="refresh" content="0; url=${SITE_URL}/">
</head><body></body></html>`);
    };

    if (!productId) return fallback();

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${encodeURIComponent(productId)}`;
    const response = await fetch(firestoreUrl);

    if (!response.ok) return fallback();

    const doc = await response.json();
    if (!doc.fields) return fallback();

    const product = parseFirestoreFields(doc.fields);

    const name = product.name || 'Al Hadi Store Product';
    const price = product.price ? `Rs ${product.price}` : '';
    const desc = product.desc
      ? product.desc
      : price
      ? `${price} — available at Al Hadi Store. Cash on Delivery available.`
      : 'Shop at Al Hadi Store — Quality · Trust · Style.';

    // "images" field: array of URLs, or semicolon-separated string (bulk-CSV style)
    let images = product.images;
    if (typeof images === 'string') images = images.split(';').map((s) => s.trim()).filter(Boolean);
    if (!Array.isArray(images)) images = [];
    const image = images[0] || `${SITE_URL}/assets/og-image.png`;

    const pageUrl = `${SITE_URL}/?p=${encodeURIComponent(productId)}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${escapeHtml(name)} — Al Hadi Store</title>
<meta property="og:type" content="product">
<meta property="og:site_name" content="Al Hadi Store">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${escapeHtml(name)}${price ? ' — ' + price : ''}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(name)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0; url=${pageUrl}">
</head><body></body></html>`);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${SITE_URL}/"></head><body></body></html>`);
  }
};
