// Runs on Vercel as a Serverless Function.
// Purpose: link-preview crawlers (WhatsApp, Facebook, Instagram, Telegram, etc.)
// do NOT execute JavaScript — they only read the raw HTML of the page.
// Our SPA updates <meta property="og:..."> tags via js/app.js after the page
// loads, which works fine for real visitors but is invisible to those
// crawlers. So every shared product link was showing the site's default
// homepage image instead of the product photo.
//
// vercel.json rewrites requests that (a) contain ?p=<productId> AND
// (b) come from a known crawler User-Agent to this function instead of the
// static index.html. This function reads the product, swaps in its title /
// description / photo into the HTML's <head>, and returns that — so the
// crawler sees the right picture. Everyone else still gets the normal SPA.

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://alhadi.store';

function loadProducts() {
  const raw = fs.readFileSync(path.join(process.cwd(), 'js', 'products-data.js'), 'utf8');
  const jsonStr = raw.replace('window.EMBEDDED_PRODUCTS = ', '').trim().replace(/;$/, '');
  return JSON.parse(jsonStr).products || [];
}

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function absoluteUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return SITE_URL + '/' + String(p).replace(/^\//, '');
}

module.exports = (req, res) => {
  try {
    const id = (req.query && req.query.p) || '';
    const indexPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    const product = id ? loadProducts().find((x) => x.id === id) : null;

    if (product) {
      const title = escapeAttr(product.name + ' | Al Hadi Store');
      const rawDesc = product.desc
        ? String(product.desc).replace(/\s+/g, ' ').trim()
        : (product.name + ' — available now at Al Hadi Store. Rs ' + Number(product.price || 0).toLocaleString('en-PK') + '.');
      const desc = escapeAttr(rawDesc.length > 160 ? rawDesc.slice(0, 157) + '...' : rawDesc);
      const firstImage = product.images && product.images[0] && product.images[0].src;
      const img = escapeAttr(absoluteUrl(firstImage) || (SITE_URL + '/assets/og-image.png'));
      const url = escapeAttr(SITE_URL + '/?p=' + encodeURIComponent(id));

      html = html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`)
        .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
        .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`)
        .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img}">`)
        .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${desc}">`)
        .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${img}">`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).send(html);
  } catch (err) {
    // On any failure, fall back to the plain homepage rather than erroring out.
    try {
      const fallback = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fallback);
    } catch (e2) {
      res.status(500).send('Error generating preview');
    }
  }
};
