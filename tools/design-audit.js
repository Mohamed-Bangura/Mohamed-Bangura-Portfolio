/* Numeric design audit. Run after tools/browser-test.js.
   Verifies contrast, type scale, rhythm, image loading and visibility using
   computed values only, so it works without inspecting screenshots. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const { listen } = require('./serve');
const ROOT = path.join(__dirname, '..');
const PORT = 4399;
const base = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let errors = 0;
const pass = (m) => console.log('  ok    ' + m);
const fail = (m) => { errors++; console.log('  FAIL  ' + m); };
const warn = (m) => console.log('  warn  ' + m);
const info = (m) => console.log('  --    ' + m);

/* Puppeteer evaluates a string as an expression, so a top-level return is
   illegal. Wrap every snippet in an IIFE. */
const ev = (p, body) => p.evaluate(`(() => {\n${body}\n})()`);

/* Injected into the page. Contrast is computed from real rendered colours,
   compositing every translucent background layer down to an opaque base. */
const HELPERS = `
function _rgb(c) {
  const m = String(c).match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function _over(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  };
}
function _lum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function _gradStops(cs) {
  const img = cs.backgroundImage;
  if (!img || img === 'none' || !/gradient/.test(img)) return [];
  return (img.match(/rgba?\\([^)]+\\)/g) || []).map(_rgb).filter(Boolean);
}
/* Ancestors are flattened into ONE opaque base, because a gradient behind the
   text is spatially varying and cannot be treated as a flat fill. Only the
   element's OWN backgrounds become separate candidates -- a 0.94-alpha fill
   genuinely hides what is behind it, so the dark gradient underneath must not
   be offered as a contrast candidate for the text on top. */
function _backdrops(el) {
  const chain = [];
  let n = el.parentElement;
  while (n && n.nodeType === 1) {
    const cs = getComputedStyle(n);
    const bc = _rgb(cs.backgroundColor);
    const stops = _gradStops(cs);
    chain.push({ bc, stops });
    if ((bc && bc.a >= 1) || stops.some((s) => s.a >= 1)) break;
    n = n.parentElement;
  }

  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = chain.length - 1; i >= 0; i--) {
    const { bc, stops } = chain[i];
    if (bc && bc.a > 0) base = _over(bc, base);
    if (stops.length) {
      const opaque = stops.find((s) => s.a >= 1);
      if (opaque) {
        base = opaque;
      } else {
        /* translucent: approximate the strongest pass, worst case for contrast */
        let best = stops[0];
        stops.forEach((s) => {
          if (Math.abs(_lum(s) - _lum(base)) > Math.abs(_lum(best) - _lum(base))) best = s;
        });
        base = _over(best, base);
      }
    }
  }

  const cs = getComputedStyle(el);
  const own = _rgb(cs.backgroundColor);
  const ownStops = _gradStops(cs);
  const cands = [];

  const opaqueOwn = ownStops.find((s) => s.a >= 1);
  if (opaqueOwn) {
    cands.push(opaqueOwn);
  } else if (own && own.a > 0) {
    cands.push(_over(own, base));
    ownStops.forEach((s) => { if (s.a > 0) cands.push(_over(_over(s, own), base)); });
  } else {
    ownStops.forEach((s) => { if (s.a > 0) cands.push(_over(s, base)); });
    cands.push(base);
  }

  const seen = new Set();
  return cands.filter((c) => {
    const k = Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function _contrast(el) {
  const fg0 = _rgb(getComputedStyle(el).color);
  if (!fg0) return null;
  let worst = Infinity;
  _backdrops(el).forEach((bg) => {
    const fg = fg0.a < 1 ? _over(fg0, bg) : fg0;
    const L1 = _lum(fg), L2 = _lum(bg);
    const c = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (c < worst) worst = c;
  });
  return Math.round(worst * 100) / 100;
}
/* Colour maths cannot prove anything about text sitting on a photograph.
   Detect that geometrically, then require the covering element to paint a
   scrim (an absolutely positioned pseudo-element with a gradient). */
function _photoCheck(el) {
  const own = _rgb(getComputedStyle(el).backgroundColor);
  if (own && own.a >= 0.5) return null;          /* its own fill settles it */

  const r = el.getBoundingClientRect();
  let n = el.parentElement;
  let depth = 0;
  while (n && n.nodeType === 1 && depth < 6) {
    const bc = _rgb(getComputedStyle(n).backgroundColor);
    if (bc && bc.a >= 1) return null;             /* opaque backdrop above it */

    const imgs = n.querySelectorAll(':scope > img, :scope > picture > img');
    let overlaps = false;
    for (const im of imgs) {
      const ir = im.getBoundingClientRect();
      const ox = Math.min(r.right, ir.right) - Math.max(r.left, ir.left);
      const oy = Math.min(r.bottom, ir.bottom) - Math.max(r.top, ir.top);
      if (ox > 1 && oy > 1) { overlaps = true; break; }
    }
    if (overlaps) {
      const painted = ['::before', '::after'].some((pe) => {
        const s = getComputedStyle(n, pe);
        return s.content !== 'none' && s.position === 'absolute' &&
          s.backgroundImage && s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage);
      });
      return { scrim: painted };
    }
    n = n.parentElement;
    depth++;
  }
  return null;
}
function _contrast(el) {
  const fg0 = _rgb(getComputedStyle(el).color);
  if (!fg0) return null;
  let worst = Infinity;
  _backdrops(el).forEach((bg) => {
    const fg = fg0.a < 1 ? _over(fg0, bg) : fg0;
    const L1 = _lum(fg), L2 = _lum(bg);
    const c = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (c < worst) worst = c;
  });
  return Math.round(worst * 100) / 100;
}
function _measurable(el) {
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  if (el.closest('[hidden]') || el.closest('.hp-field')) return false;
  if (el.classList.contains('skip-link')) return false;
  /* Intentionally invisible text: decorative watermarks drawn with a text
     stroke and a transparent fill. Nothing to contrast against. */
  const m = cs.color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((n) => parseFloat(n));
    if (parts.length === 4 && parts[3] === 0) return false;
  }
  if (el.closest('[aria-hidden="true"]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function _ownText(el) {
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
}
/* Trigger lazy images and scroll reveals, then return to the top.
   Bounded on both the scroll loop and the image wait so a stalled request
   can never hang the whole audit. */
async function _settle() {
  const deadline = Date.now() + 12000;
  const step = Math.max(200, Math.round(window.innerHeight * 0.8));
  let y = 0;
  let guard = 0;
  /* scroll-behavior is smooth, so jump instantly instead of animating. */
  const prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  while (y < document.body.scrollHeight && Date.now() < deadline && guard++ < 200) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 50));
    y += step;
  }
  window.scrollTo(0, 0);
  document.documentElement.style.scrollBehavior = prev;
  await new Promise((r) => setTimeout(r, 400));
  const pending = Array.from(document.images).filter((i) => !i.complete);
  await Promise.race([
    Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
    new Promise((r) => setTimeout(r, 5000))
  ]);
  await new Promise((r) => setTimeout(r, 300));
  return { scrolledTo: y, stillLoading: document.images.length - pending.length };
}
`;

(async () => {
  const server = await listen(PORT);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 240000
  });
  const page = async (w, h) => {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h });
    return p;
  };
  const open = async (p, file) => {
    await p.goto(base + file, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1800));
    await ev(p, HELPERS + '\nreturn _settle();');
  };
  const PAGES = ['/', '/projects/savory-bites.html', '/projects/pp-studio.html',
    '/projects/johnsons-academy.html', '/404.html'];

  /* ---------------- A. contrast ---------------- */
  console.log('\n[A] Text contrast (WCAG AA, composited rendered colours)');
  for (const file of PAGES) {
    const p = await page(1280, 900);
    await open(p, file);
    const res = await ev(p, HELPERS + `
      const out = [];
      const photo = [];
      document.querySelectorAll('h1,h2,h3,h4,p,li,a,label,dt,dd,small,button,strong,em,blockquote,figcaption,span')
        .forEach((el) => {
          if (!_measurable(el)) return;
          if (parseFloat(getComputedStyle(el).opacity) < 0.95) return;
          if (!_ownText(el)) return;
          const cs = getComputedStyle(el);
          const size = parseFloat(cs.fontSize);
          const weight = Number(cs.fontWeight) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          const need = large ? 3 : 4.5;
          if (_photoCheck(el)) {
            const p = _photoCheck(el);
            photo.push({ label: el.tagName.toLowerCase() + '.' +
              (el.className || '').toString().split(' ')[0] + ' "' +
              el.textContent.trim().slice(0, 24) + '"', scrim: p.scrim });
            return;
          }
          const c = _contrast(el);
          if (c === null) return;
          out.push({ t: el.textContent.trim().slice(0, 30), c, size, need });
        });
      return { out, photo: [...new Set(photo)] };`);
    const bad = res.out.filter((r) => r.c < r.need);
    if (!bad.length) pass(file + ' — ' + res.out.length + ' text nodes all meet AA');
    else {
      fail(file + ' — ' + bad.length + '/' + res.out.length + ' below AA');
      [...new Set(bad.map((b) => b.c + ':1 ' + b.size + 'px "' + b.t + '"'))].slice(0, 10)
        .forEach((b) => info('    ' + b));
    }
    if (res.photo.length) {
      const unproven = res.photo.filter((p) => !p.scrim);
      const key = (p) => p.label;
      if (unproven.length) {
        fail(file + ' — text over a photo with no scrim: ' +
          [...new Set(unproven.map(key))].slice(0, 6).join(', '));
      } else {
        pass(file + ' — ' + res.photo.length + ' text element(s) sit on a photo, all with a scrim');
        info('  scrimmed: ' + [...new Set(res.photo.map(key))].join(', '));
      }
    }
    await p.close();
  }

  /* ---------------- B. scale, rhythm, headings ---------------- */
  console.log('\n[B] Type scale, rhythm and heading structure');
  {
    const p = await page(1280, 900);
    await open(p, '/');
    const d = await ev(p, HELPERS + `
      const px = (s) => { const e = document.querySelector(s);
        return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      let prev = 0; const skips = [];
      headings.forEach((h) => { const n = Number(h.tagName[1]);
        if (prev && n > prev + 1) skips.push(h.tagName + ' "' + h.textContent.trim().slice(0, 20) + '"');
        prev = n; });
      const rhythm = {};
      ['#about', '#services', '#work', '#skills', '#process', '#contact'].forEach((id) => {
        const e = document.querySelector(id);
        if (e) rhythm[id] = Math.round(parseFloat(getComputedStyle(e).paddingTop));
      });
      return {
        h1: px('.hero__title'), h2: px('.section-head h2'), h3: px('.work__title'),
        h4: px('h4'),
        body: px('body'), lead: px('.lead'), small: px('.chip'),
        rhythm, skips, h1n: document.querySelectorAll('h1').length,
        n: headings.length,
        families: [...new Set(Array.from(document.querySelectorAll('h1,h2,h3,p'))
          .map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '')))],
        maxw: getComputedStyle(document.documentElement).getPropertyValue('--maxw').trim(),
        docW: document.documentElement.clientWidth,
        wide: Array.from(document.querySelectorAll('main *'))
          .filter((e) => e.getBoundingClientRect().width > document.documentElement.clientWidth)
          .map((e) => e.tagName + '.' + (e.className || '').toString().split(' ')[0])
      };`);

    info('h1 ' + d.h1 + '  h2 ' + d.h2 + '  h3 ' + d.h3 + '  h4 ' + d.h4 +
      '  body ' + d.body + '  lead ' + d.lead + '  chip ' + d.small);
    info('families: ' + d.families.join(', ') + '   max-width ' + d.maxw);
    info('section padding-top: ' + JSON.stringify(d.rhythm));

    /* Only levels the page actually uses, so a missing h4 does not read as a
       broken scale. */
    const scale = [d.h1, d.h2, d.h3, d.h4, d.body, d.small].filter((v) => typeof v === 'number' && v > 0);
    scale.length >= 5 && scale.every((v, i) => i === 0 || v <= scale[i - 1])
      ? pass('type scale descends monotonically: ' + scale.join(' >= '))
      : fail('type scale not descending: ' + JSON.stringify([d.h1, d.h2, d.h3, d.h4, d.body, d.small]));

    const pads = Object.values(d.rhythm);
    pads.length === 6 && new Set(pads).size === 1
      ? pass('all 6 content sections share one vertical rhythm (' + pads[0] + 'px)')
      : fail('inconsistent section rhythm: ' + JSON.stringify(d.rhythm));

    d.h1n === 1 ? pass('exactly one h1') : fail('h1 count = ' + d.h1n);
    !d.skips.length
      ? pass('no skipped heading levels across ' + d.n + ' headings')
      : fail('heading level skips: ' + d.skips.join(', '));
    !d.wide.length
      ? pass('no element wider than the ' + d.docW + 'px viewport')
      : fail('over-wide elements: ' + [...new Set(d.wide)].join(', '));
    await p.close();
  }

  /* ---------------- C. images ---------------- */
  console.log('\n[C] Images: decoded, alt text, no distortion, lazy loading');
  for (const file of ['/', '/projects/savory-bites.html', '/projects/pp-studio.html',
    '/projects/johnsons-academy.html']) {
    const p = await page(1280, 900);
    await open(p, file);
    const imgs = await ev(p, HELPERS + `
      return Array.from(document.images).map((im) => {
        const r = im.getBoundingClientRect();
        const cs = getComputedStyle(im);
        const nat = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : null;
        const box = r.height > 0 ? r.width / r.height : null;
        return {
          src: (im.currentSrc || im.src || '(none)').split('/').pop(),
          ok: im.complete && im.naturalWidth > 0,
          bytes: im.currentSrc.split('/').pop(),
          hasAlt: im.hasAttribute('alt'),
          w: Math.round(r.width), h: Math.round(r.height),
          loading: im.getAttribute('loading') || 'eager',
          fit: cs.objectFit,
          nat, box,
          /* Only a plain scale is distortion. cover/contain crop on purpose. */
          dist: (nat && box && cs.objectFit === 'fill') ? Math.abs(nat - box) / nat : 0
        };
      });`);

    const broken = imgs.filter((i) => !i.ok);
    const noAlt = imgs.filter((i) => !i.hasAlt);
    const distorted = imgs.filter((i) => i.dist > 0.03);
    const lazy = imgs.filter((i) => i.loading === 'lazy');

    broken.length
      ? fail(file + ' — ' + broken.length + ' image(s) failed to decode: ' +
        broken.map((b) => b.src).join(', '))
      : pass(file + ' — all ' + imgs.length + ' image(s) decoded');
    noAlt.length
      ? fail(file + ' — missing alt: ' + noAlt.map((b) => b.src).join(', '))
      : pass(file + ' — every image has alt text');
    distorted.length
      ? fail(file + ' — distorted: ' + distorted.map((d) =>
        d.src + ' nat=' + d.nat.toFixed(2) + ' box=' + d.box.toFixed(2)).join(', '))
      : pass(file + ' — no distortion (cover crops are intentional)');
    info(file + ' — ' + lazy.length + '/' + imgs.length + ' lazy-loaded, widths ' +
      imgs.map((i) => i.w + 'px').join('/'));
    await p.close();
  }

  /* ---------------- D. intro composition ---------------- */
  console.log('\n[D] Intro composition (real class names)');
  {
    const p = await page(390, 844);
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1200));
    const d = await ev(p, `
      const el = document.getElementById('intro');
      if (!el) return { missing: true };
      const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
                 left: Math.round(r.left) }; };
      const letters = el.querySelector('.intro__letters');
      const mark = el.querySelector('.intro__mark');
      const ring = el.querySelector('.intro__ring');
      const bar = el.querySelector('.intro__progress');
      const skip = el.querySelector('[data-intro-skip]');
      const cs = getComputedStyle(el);
      return {
        visible: el.classList.contains('is-active'),
        opacity: cs.opacity, bg: cs.backgroundColor,
        onScreen: box(el),
        letters: letters && { text: letters.textContent.trim(),
          fontSize: getComputedStyle(letters).fontSize,
          family: getComputedStyle(letters).fontFamily.split(',')[0].replace(/["']/g, ''), ...box(letters) },
        mark: mark && { anim: getComputedStyle(mark).animationName, ...box(mark) },
        ring: ring && { ...box(ring) },
        bar: bar && { box: box(bar), anim: getComputedStyle(bar).animationName },
        skip: skip && { text: skip.textContent.trim(),
          vis: getComputedStyle(skip).visibility,
          h: Math.round(skip.getBoundingClientRect().height),
          ariaHiddenAncestor: !!skip.closest('[aria-hidden="true"]') },
        name: box(el.querySelector('.intro__name')),
        role: box(el.querySelector('.intro__role')),
        statement: box(el.querySelector('.intro__statement'))
      };`);

    if (d.missing) fail('intro markup missing');
    else {
      d.visible ? pass('intro active at ~1.2s, opacity ' + d.opacity) : fail('intro not active');
      d.onScreen && d.onScreen.top === 0 && d.onScreen.h >= 800
        ? pass('intro covers the whole viewport')
        : fail('intro does not cover the viewport: ' + JSON.stringify(d.onScreen));
      d.letters && d.letters.w > 0
        ? pass('monogram "' + d.letters.text + '" ' + d.letters.fontSize + ' in ' + d.letters.family)
        : fail('monogram not rendered');
      d.mark && d.mark.w > 0
        ? pass('monogram mark ' + d.mark.w + 'px, anim=' + d.mark.anim)
        : fail('monogram mark missing');
      d.ring && d.ring.w > 0 ? pass('ring ' + d.ring.w + 'px') : fail('ring missing');
      d.bar && d.bar.box.w > 0
        ? pass('progress line ' + d.bar.box.w + 'px wide, anim=' + d.bar.anim)
        : fail('progress line missing');
      d.bar && d.bar.anim && d.bar.anim !== 'none'
        ? pass('progress line animates (indeterminate sweep, no fake percentage)')
        : fail('progress line animation = ' + (d.bar && d.bar.anim));
      d.skip && d.skip.vis === 'visible' && d.skip.h >= 44 && !d.skip.ariaHiddenAncestor
        ? pass('skip control "' + d.skip.text + '" visible, ' + d.skip.h + 'px, outside aria-hidden')
        : fail('skip control problem: ' + JSON.stringify(d.skip));
      /* text block order and spacing */
      const tops = [d.letters, d.name, d.role, d.statement].filter(Boolean).map((x) => x.top);
      tops.every((t, i) => i === 0 || t > tops[i - 1])
        ? pass('intro content stacks in order: ' + tops.join(' -> '))
        : fail('intro content overlaps or is out of order: ' + tops.join(', '));
    }
    await p.close();
  }

  /* ---------------- E. visibility sweep ---------------- */
  console.log('\n[E] Visibility sweep (after full scroll, nothing may stay hidden)');
  for (const file of ['/', '/projects/savory-bites.html', '/projects/pp-studio.html',
    '/projects/johnsons-academy.html']) {
    const p = await page(390, 844);
    await open(p, file);
    const stuck = await ev(p, HELPERS + `
      const out = [];
      document.querySelectorAll('main *, header *, footer *').forEach((el) => {
        if (el.closest('[hidden]') || el.classList.contains('skip-link')) return;
        if (el.closest('.hp-field')) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (parseFloat(getComputedStyle(el).opacity) < 0.05) {
          out.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0] +
            ' opacity=' + getComputedStyle(el).opacity);
        }
      });
      return [...new Set(out)];`);
    stuck.length
      ? fail(file + ' — invisible after scrolling: ' + stuck.join(' | '))
      : pass(file + ' — no content left invisible');
    await p.close();
  }

  /* ---------------- F. reduced motion ---------------- */
  console.log('\n[F] prefers-reduced-motion: no hidden content, no motion');
  {
    const p = await page(390, 844);
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await open(p, '/');
    const r2 = await ev(p, HELPERS + `
      const rev = Array.from(document.querySelectorAll('[data-reveal]'));
      return {
        hidden: rev.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.9).length,
        total: rev.length,
        anim: document.getAnimations().filter((a) => a.playState === 'running').length
      };`);
    !r2.hidden
      ? pass('all ' + r2.total + ' reveal elements visible')
      : fail(r2.hidden + '/' + r2.total + ' reveal elements still hidden');
    !r2.anim
      ? pass('no running animations under reduced motion')
      : fail(r2.anim + ' animations still running');
    await p.close();
  }

  /* ---------------- G. section contrast sanity (dark and light) ------------ */
  console.log('\n[G] Section contrast: dark (work, contact) and light (services, process)');
  {
    const p = await page(1280, 900);
    await open(p, '/');

    const scan = (id) => ev(p, HELPERS + `
      const sec = document.getElementById('${id}');
      if (!sec) return null;
      const out = [];
      sec.querySelectorAll('h2,h3,p,li,a,span,b').forEach((el) => {
        if (!_measurable(el)) return;
        if (parseFloat(getComputedStyle(el).opacity) < 0.95) return;
        if (!_ownText(el)) return;
        const c = _contrast(el);
        if (c === null) return;
        const size = parseFloat(getComputedStyle(el).fontSize);
        const weight = Number(getComputedStyle(el).fontWeight) || 400;
        out.push({ t: el.textContent.trim().slice(0, 28), c,
          need: (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5 });
      });
      return { rows: out, bg: getComputedStyle(sec).backgroundColor };`);

    for (const id of ['work', 'contact', 'services', 'process']) {
      const res = await scan(id);
      if (!res) { fail(id + ' section not found'); continue; }
      const bad = res.rows.filter((r) => r.c < r.need);
      info(id + ' background ' + res.bg + ', ' + res.rows.length + ' text nodes checked');
      bad.length
        ? fail(id + ' — ' + bad.length + ' below AA: ' +
          [...new Set(bad.map((b) => b.c + ':1 "' + b.t + '"'))].slice(0, 8).join(', '))
        : pass(id + ' — all ' + res.rows.length + ' text nodes meet AA');
    }
    await p.close();
  }

  await browser.close();
  server.close();
  console.log('\n========================================================================');
  console.log(errors + ' failure(s) in design audit.');
  console.log('========================================================================');
  process.exit(errors ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
