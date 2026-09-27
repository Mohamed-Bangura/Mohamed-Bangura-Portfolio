/* Static audit: every local link/asset resolves, no dead canonicals,
   headings are ordered, images have alt + dimensions, no placeholder cruft.
   Run with: node tools/verify.js                                             */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://mohamed-bangura-portfolio.vercel.app/';

const pages = ['index.html', '404.html',
  'projects/savory-bites.html', 'projects/pp-studio.html', 'projects/johnsons-academy.html'];

let errors = 0;
let warnings = 0;
const fail = (m) => { errors++; console.log('  FAIL  ' + m); };
const warn = (m) => { warnings++; console.log('  WARN  ' + m); };
const ok = (m) => console.log('  ok    ' + m);

const attr = (tag, name) => {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
};

console.log('='.repeat(72));
console.log('LOCAL ASSET / LINK RESOLUTION');
console.log('='.repeat(72));

pages.forEach((page) => {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) return fail('missing page ' + page);
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const found = new Set();

  const patterns = [
    /(?:src|href)\s*=\s*"([^"#][^"]*)"/gi
  ];
  let m;
  while ((m = patterns[0].exec(html))) {
    const url = m[1].trim();
    if (!url || url.startsWith('http') || url.startsWith('mailto:') ||
        url.startsWith('data:') || url.startsWith('//')) continue;
    const clean = url.split('?')[0].split('#')[0];
    if (!clean) continue;
    found.add(clean);
  }

  // srcset candidates
  const srcsetRe = /srcset\s*=\s*"([^"]*)"/gi;
  while ((m = srcsetRe.exec(html))) {
    m[1].split(',').forEach((c) => {
      const u = c.trim().split(/\s+/)[0];
      if (u && !u.startsWith('http') && !u.startsWith('data:')) found.add(u);
    });
  }

  let bad = 0;
  found.forEach((url) => {
    const target = path.resolve(dir, decodeURIComponent(url));
    if (!fs.existsSync(target)) {
      fail(page + ' -> missing ' + url);
      bad++;
    }
  });
  if (!bad) ok(page + ' (' + found.size + ' local refs resolve)');
});

console.log('');
console.log('='.repeat(72));
console.log('PER-PAGE SEO + A11Y');
console.log('='.repeat(72));

pages.forEach((page) => {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const problems = [];

  if (!/<html[^>]+lang="en"/.test(html)) problems.push('missing lang="en"');
  if (!/<title>[^<]{10,}<\/title>/.test(html)) problems.push('title missing or too short');
  if (!/name="description"[^>]{20,}/.test(html)) problems.push('meta description missing/short');

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/name="description"\s+content="([^"]*)"/) || [])[1] || '';
  if (title.length > 65) problems.push('title ' + title.length + ' chars (>65)');
  if (desc.length < 70 || desc.length > 175) problems.push('description ' + desc.length + ' chars (want 70-175)');

  const canonical = (html.match(/rel="canonical"\s+href="([^"]*)"/) || [])[1];
  if (!canonical) problems.push('no canonical');
  else if (!canonical.startsWith(SITE)) problems.push('canonical off-domain: ' + canonical);

  if (!/name="viewport"/.test(html)) problems.push('no viewport');
  if (!/og:image/.test(html) && page !== '404.html') problems.push('no og:image');

  // placeholders
  ['YOUR_', 'GA_MEASUREMENT_ID', 'G-XXXXXXXXXX', 'lorem ipsum', 'TODO', 'FIXME', 'example.com']
    .forEach((bad) => {
      if (html.toLowerCase().includes(bad.toLowerCase())) problems.push('placeholder: ' + bad);
    });

  if (!/<h1[\s>]/.test(html)) problems.push('no h1');
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s > 1) problems.push(h1s + ' h1 elements');

  // heading order
  const levels = (html.match(/<h([1-6])[\s>]/g) || []).map((t) => +t.match(/\d/)[0]);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      problems.push('heading jump h' + levels[i - 1] + ' -> h' + levels[i]);
      break;
    }
  }

  if (!/class="skip-link"/.test(html)) problems.push('no skip link');

  // images
  (html.match(/<img\b[^>]*>/g) || []).forEach((tag) => {
    if (!attr(tag, 'alt')) problems.push('img without alt: ' + tag.slice(0, 70));
    if (!attr(tag, 'width') || !attr(tag, 'height')) {
      problems.push('img without dimensions: ' + (attr(tag, 'src') || '?'));
    }
  });

  // JSON-LD
  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []);
  ld.forEach((block) => {
    const json = block.replace(/<[^>]+>/g, '');
    try { JSON.parse(json); } catch (e) { problems.push('invalid JSON-LD: ' + e.message); }
  });

  // links
  (html.match(/<a\b[^>]*href="([^"]*)"[^>]*>/g) || []).forEach((tag) => {
    if (attr(tag, 'target') === '_blank' && !/noopener/.test(tag)) {
      problems.push('target=_blank without rel=noopener');
    }
  });

  if (problems.length === 0) ok(page + ' — clean  [' + title.length + ' char title, ' + desc.length + ' char desc]');
  else problems.forEach((p) => fail(page + ': ' + p));
});

console.log('');
console.log('='.repeat(72));
console.log('SITE-WIDE');
console.log('='.repeat(72));

const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
robots.includes(SITE + 'sitemap.xml')
  ? ok('robots.txt points at the live sitemap')
  : fail('robots.txt sitemap URL wrong or missing');

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const urls = (sitemap.match(/<loc>([^<]*)<\/loc>/g) || []).map((u) => u.replace(/<\/?loc>/g, ''));
const expected = [
  SITE,
  SITE + 'projects/savory-bites.html',
  SITE + 'projects/pp-studio.html',
  SITE + 'projects/johnsons-academy.html'
];
expected.forEach((u) => (urls.includes(u) ? ok('sitemap: ' + u) : fail('sitemap missing ' + u)));
urls.forEach((u) => { if (!expected.includes(u)) warn('sitemap extra URL: ' + u); });

/* PNG dimensions without any image dependency: IHDR is a fixed 24-byte
   header, so width and height are two big-endian uint32s at offset 16. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

try {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  ok('manifest.webmanifest is valid JSON');

  /* Every declared icon must exist, be a real PNG, be square, and match the
     size it claims. A non-square icon is invalid for install and maskable use. */
  let icons = 0;
  (mf.icons || []).forEach((ic) => {
    const rel = String(ic.src || '').replace(/^\//, '');
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { fail('manifest icon missing on disk: ' + ic.src); return; }
    icons++;
    const dim = pngSize(file);
    if (!dim) { fail('manifest icon is not a PNG: ' + ic.src); return; }
    if (dim.w !== dim.h) {
      fail('manifest icon is not square: ' + ic.src + ' (' + dim.w + 'x' + dim.h + ')');
    }
    const m = /^(\d+)x(\d+)$/.exec(ic.sizes || '');
    if (!m) {
      fail('manifest icon has no concrete sizes: ' + ic.src + ' (got "' + ic.sizes + '")');
    } else if (Number(m[1]) !== dim.w || Number(m[2]) !== dim.h) {
      fail('manifest icon size mismatch: ' + ic.src + ' claims ' + ic.sizes +
        ' but the file is ' + dim.w + 'x' + dim.h);
    }
  });
  if (icons) ok('manifest: ' + icons + ' icon(s) exist, square, and match their declared sizes');

  ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color']
    .forEach((k) => { if (!mf[k]) fail('manifest missing "' + k + '"'); });
  if (/^#[0-9a-f]{6}$/i.test(mf.theme_color || '')) ok('manifest theme_color is a valid hex colour');
  else fail('manifest theme_color is not #rrggbb: ' + mf.theme_color);
} catch (e) { fail('manifest invalid: ' + e.message); }

/* Icon links in the markup must point at files that exist, and a raster icon
   must not claim sizes="any", which only a vector can honour. */
for (const page of ['index.html', '404.html', 'projects/savory-bites.html',
  'projects/pp-studio.html', 'projects/johnsons-academy.html']) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const re = /<link[^>]*rel="(icon|apple-touch-icon|manifest)"[^>]*>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const href = (/href="([^"]+)"/.exec(tag) || [])[1];
    if (!href) { fail(page + ': ' + m[1] + ' link has no href'); continue; }
    if (/^https?:/.test(href)) continue;
    const abs = path.resolve(path.dirname(path.join(ROOT, page)), href);
    if (!fs.existsSync(abs)) { fail(page + ': ' + m[1] + ' points at a missing file: ' + href); continue; }
    n++;
    const sz = (/sizes="([^"]+)"/.exec(tag) || [])[1];
    if (m[1] === 'icon' && sz === 'any' && /\.png$/i.test(href)) {
      fail(page + ': raster icon claims sizes="any": ' + href);
    }
    if (/\.png$/i.test(href) && sz && /^\d+x\d+$/.test(sz)) {
      const dim = pngSize(abs);
      if (dim && (dim.w + 'x' + dim.h) !== sz) {
        fail(page + ': icon ' + href + ' declares ' + sz + ' but is ' + dim.w + 'x' + dim.h);
      }
    }
  }
  if (n) ok(page + ' — ' + n + ' icon/manifest link(s) resolve with correct sizes');
}

['css/style.css', 'js/script.js', 'favicon/favicon.png', 'favicon/icon-192.png',
  'favicon/icon-512.png', 'favicon/apple-touch-icon.png'].forEach((f) => {
  fs.existsSync(path.join(ROOT, f)) ? ok('asset present: ' + f) : fail('asset missing: ' + f);
});

// no secret-looking files staged
fs.readdirSync(ROOT).forEach((f) => {
  if (/^\.env/i.test(f) || f.endsWith('.pem') || f.endsWith('.key')) {
    fail('sensitive file at repo root: ' + f);
  }
});
ok('no .env / key / pem at repo root');

console.log('');
console.log('='.repeat(72));
console.log(errors + ' error(s), ' + warnings + ' warning(s)');
console.log('='.repeat(72));
process.exit(errors ? 1 : 0);
