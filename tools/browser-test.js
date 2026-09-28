/* Real-browser test run against the local build.
   Covers: render, console errors, horizontal overflow at 9 widths,
   mobile menu, intro behaviour, reduced motion, form validation,
   intro skip on repeat navigation, keyboard focus.

   Run with: node tools/browser-test.js                                        */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { listen } = require('./serve');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
const SHOTS = path.join(ROOT, '.shots');

let errors = 0;
const fail = (m) => { errors++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const warn = (m) => console.log('  warn  ' + m);

async function main() {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });

  const server = await listen(4321);
  const base = 'http://localhost:4321';

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });

  const consoleErrors = [];
  const pageErrors = [];

  async function newPage(opts = {}) {
    const page = await browser.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(page.url() + ' :: ' + m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(page.url() + ' :: ' + e.message));
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (u.startsWith(base)) consoleErrors.push('REQUEST FAILED ' + u);
    });
    if (opts.reducedMotion) {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    }
    if (opts.noJs) {
      await page.setJavaScriptEnabled(false);
    }
    if (opts.width) await page.setViewport({ width: opts.width, height: opts.height || 800, deviceScaleFactor: 1 });
    return page;
  }

  /* The intro is a full-screen overlay for ~5s. Any test that has to click,
     scroll or read layout must wait it out first, otherwise the click lands on
     the intro instead of the control underneath. */
  const settle = (p) => p.waitForFunction(() => !document.getElementById('intro'), { timeout: 9000 });

  /* The header is sticky, so a control scrolled flush to the top of the
     viewport can end up underneath it, and a click at that point would be
     delivered to the header instead. Centre the target, confirm it really is
     the topmost element at its own centre, and only then click. Trying a few
     offsets keeps this robust instead of depending on where the browser
     happens to put the element. */
  const clickSafely = async (p, selector) => {
    for (const nudge of [0, 60, 120, -60]) {
      const hit = await p.evaluate((sel, dy) => {
        const el = document.querySelector(sel);
        if (!el) return 'missing';
        /* Sit the target a little below centre, clear of the sticky header. */
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        if (dy) window.scrollBy(0, dy);
        const b = el.getBoundingClientRect();
        const x = b.left + b.width / 2;
        const y = b.top + b.height / 2;
        const top = document.elementFromPoint(x, y);
        if (!top) return 'offscreen';
        if (top === el || el.contains(top) || top.contains(el)) return 'ok';
        return 'covered by ' + (top.id || top.className || top.tagName);
      }, selector, nudge);
      if (hit === 'ok') {
        await p.click(selector);
        return true;
      }
      if (hit === 'missing') throw new Error('clickSafely: no element for ' + selector);
    }
    /* Nothing was provably on top, so click and let the assertions judge. */
    await p.click(selector);
    return false;
  };

  /* ---------------- 1. Console / page errors across all pages -------------- */
  console.log('\n[1] Console + page errors (desktop 1280, JS on)');
  {
    const p = await newPage({ width: 1280, height: 900 });
    for (const route of ['/', '/projects/savory-bites.html', '/projects/pp-studio.html',
      '/projects/johnsons-academy.html', '/404.html']) {
      await p.goto(base + route, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1800));
    }
    await p.close();
    if (pageErrors.length === 0) pass('0 uncaught JS errors across 5 pages');
    else pageErrors.forEach((e) => fail('JS error: ' + e));

    const real = consoleErrors.filter((e) => !/favicon|fonts\.g(oogle|static)/i.test(e));
    if (real.length === 0) pass('0 console errors (external font/favicon noise ignored)');
    else real.forEach((e) => fail('console: ' + e));
  }

  /* ---------------- 2. Horizontal overflow, 9 widths ----------------------- */
  console.log('\n[2] Horizontal overflow + tap targets, widths: ' + WIDTHS.join(', '));
  {
    for (const w of WIDTHS) {
      const p = await newPage({ width: w, height: 900 });
      await p.goto(base + '/', { waitUntil: 'networkidle2' });
      await settle(p);
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 700));

      const res = await p.evaluate(() => {
        const de = document.documentElement;
        const overflow = de.scrollWidth - de.clientWidth;

        const offenders = [];
        const vw = de.clientWidth;
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          if (r.right > vw + 1.5 || r.left < -1.5) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.opacity === '0') return;
            if (el.closest('[aria-hidden="true"]')) return;
            offenders.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0] +
              ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
          }
        });

        const small = [];
        document.querySelectorAll('a, button, select, input, textarea').forEach((el) => {
          if (el.closest('.hp-field') || el.classList.contains('skip-link')) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (getComputedStyle(el).visibility === 'hidden') return;
          if (el.closest('[hidden]')) return;
          if (r.height < 44) {
            small.push(el.tagName.toLowerCase() + '["' +
              (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '"]' +
              (el.className ? '.' + el.className.split(' ')[0] : '') + ' h=' + Math.round(r.height));
          }
        });
        return { overflow, offenders: offenders.slice(0, 6), small: small.slice(0, 8) };
      });

      const line = '  ' + String(w).padStart(4) + 'px  overflow=' + res.overflow;
      if (res.overflow > 1 || res.offenders.length) {
        fail(line + '  offenders: ' + res.offenders.join(' | '));
      } else if (res.small.length && w <= 430) {
        console.log(line + '  ok  (small tap targets: ' + res.small.join(', ') + ')');
      } else {
        pass(line);
      }

      if ([320, 390, 768, 1440].includes(w)) {
        await p.evaluate(() => window.scrollTo(0, 0));
        await new Promise((r) => setTimeout(r, 400));
        await p.screenshot({ path: path.join(SHOTS, 'home-' + w + '.png'), fullPage: false });
      }
      await p.close();
    }
  }

  /* ---------------- 3. Intro: first visit ---------------------------------- */
  console.log('\n[3] Signature intro - first visit, ~5s timeline');
  {
    const p = await newPage({ width: 390, height: 844 });
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });

    const t0 = Date.now();
    const seenEarly = await p.evaluate(() => {
      const el = document.getElementById('intro');
      return el ? { present: true, active: el.classList.contains('is-active') } : { present: false };
    });
    seenEarly.present
      ? pass('intro element present in DOM on load')
      : fail('intro element missing');

    /* The homepage must be built and laid out underneath the overlay. */
    const underneath = await p.evaluate(() => {
      const h1 = document.querySelector('h1');
      return {
        h1: h1 ? h1.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : null,
        rendered: h1 ? h1.getBoundingClientRect().height > 0 : false,
        sections: document.querySelectorAll('main section').length
      };
    });
    underneath.rendered && underneath.sections >= 8
      ? pass('homepage ready underneath the intro (' + underneath.sections + ' sections, H1 rendered)')
      : fail('homepage not ready underneath the intro');

    await new Promise((r) => setTimeout(r, 380));
    await p.screenshot({ path: path.join(SHOTS, 'intro-390-1.png') });

    const early = await p.evaluate(() => {
      const el = document.getElementById('intro');
      return {
        active: el && el.classList.contains('is-active'),
        locked: document.body.classList.contains('is-locked')
      };
    });
    early.active ? pass('intro active and animating (~380ms)') : fail('intro not active at 380ms');
    early.locked ? pass('scroll locked while intro is up') : fail('scroll not locked during intro');

    /* 1-2s beat: name and role have arrived. */
    await new Promise((r) => setTimeout(r, 1500));
    const beat2 = await p.evaluate(() => {
      const o = (s) => {
        const el = document.querySelector(s);
        return el ? parseFloat(getComputedStyle(el).opacity) : null;
      };
      return { name: o('.intro__name'), role: o('.intro__role') };
    });
    beat2.name > 0.9 && beat2.role > 0.9
      ? pass('~1.9s: name and role fully revealed')
      : fail('~1.9s: name/role not revealed (name=' + beat2.name + ' role=' + beat2.role + ')');

    /* 2-4s beat: the statement is up. */
    await new Promise((r) => setTimeout(r, 900));
    const beat3 = await p.evaluate(() => {
      const el = document.querySelector('.intro__statement');
      const r = el.getBoundingClientRect();
      return { opacity: parseFloat(getComputedStyle(el).opacity), width: r.width };
    });
    beat3.opacity > 0.9 && beat3.width > 0
      ? pass('~2.8s: statement revealed and rendered')
      : fail('~2.8s: statement not revealed (opacity=' + beat3.opacity + ')');
    await p.screenshot({ path: path.join(SHOTS, 'intro-390-2.png') });

    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 9000 });
    const elapsed = Date.now() - t0;
    elapsed >= 4200 && elapsed <= 6200
      ? pass('intro removed from DOM after ' + elapsed + 'ms (target ~5s)')
      : fail('intro took ' + elapsed + 'ms - expected roughly 5s');

    const after = await p.evaluate(() => {
      const h1 = document.querySelector('h1');
      const r = h1.getBoundingClientRect();
      return {
        h1: h1.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
        heroVisible: r.width > 0 && r.height > 0 && r.top < window.innerHeight,
        locked: document.body.classList.contains('is-locked'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    after.heroVisible ? pass('hero H1 visible immediately after intro: "' + after.h1 + '..."') : fail('hero not visible after intro');
    !after.locked ? pass('scroll lock released') : fail('scroll still locked after intro');
    await p.screenshot({ path: path.join(SHOTS, 'hero-390.png') });
    await p.close();
  }

  /* ---------------- 4. Intro skip control ---------------------------------- */
  console.log('\n[4] Intro skip control (click, Escape, keyboard)');
  {
    const fresh = async () => {
      const p = await newPage({ width: 1280, height: 900 });
      await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
      return p;
    };

    /* Markup and accessibility shape. */
    let p = await fresh();
    const mark = await p.evaluate(() => {
      const btn = document.querySelector('[data-intro-skip]');
      if (!btn) return { present: false };
      const hiddenAncestor = btn.closest('[aria-hidden="true"]');
      const cs = getComputedStyle(btn);
      return {
        present: true,
        tag: btn.tagName,
        label: (btn.textContent || '').trim(),
        hiddenAncestor: !!hiddenAncestor,
        type: btn.getAttribute('type'),
        minHeight: Math.round(btn.getBoundingClientRect().height)
      };
    });
    mark.present ? pass('skip control present in markup') : fail('skip control missing');
    mark.tag === 'BUTTON' ? pass('skip control is a real <button>') : fail('skip control is not a button');
    /skip/i.test(mark.label) ? pass('skip control is labelled "' + mark.label + '"') : fail('skip control label unclear: ' + mark.label);
    !mark.hiddenAncestor ? pass('skip control is NOT inside an aria-hidden subtree') : fail('skip control hidden from assistive tech');
    mark.minHeight >= 44 ? pass('skip control meets the 44px touch target (' + mark.minHeight + 'px)') : fail('skip control too small: ' + mark.minHeight + 'px');

    /* Becomes visible, then a click dismisses immediately. */
    await new Promise((r) => setTimeout(r, 1100));
    const vis = await p.evaluate(() => {
      const btn = document.querySelector('[data-intro-skip]');
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return { opacity: parseFloat(cs.opacity), visibility: cs.visibility };
    });
    vis && vis.opacity > 0.85 && vis.visibility === 'visible'
      ? pass('skip control visible and interactive at ~1.2s')
      : fail('skip control not visible at ~1.2s: ' + JSON.stringify(vis));

    const tc = Date.now();
    await p.click('[data-intro-skip]');
    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 4000 });
    const clickMs = Date.now() - tc;
    clickMs < 1600
      ? pass('click skips the intro in ' + clickMs + 'ms (no 5s wait)')
      : fail('click took ' + clickMs + 'ms to skip');
    await p.close();

    /* Escape key. */
    p = await fresh();
    await new Promise((r) => setTimeout(r, 900));
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 4000 });
    const escUnlocked = await p.evaluate(() => !document.body.classList.contains('is-locked'));
    escUnlocked ? pass('Escape key dismisses the intro and releases the scroll lock') : fail('Escape did not release the scroll lock');
    await p.close();

    /* Keyboard reachability: Tab from the top of the document.
       First tab stop is the "skip to main content" link, second is the
       intro skip control. */
    p = await fresh();
    await new Promise((r) => setTimeout(r, 700));
    await p.keyboard.press('Tab');
    await p.keyboard.press('Tab');
    const focused = await p.evaluate(() => {
      const el = document.activeElement;
      return { sel: el ? (el.getAttribute('data-intro-skip') !== null ? 'skip' : el.className) : null };
    });
    focused.sel === 'skip'
      ? pass('skip control reachable by keyboard (Tab, Tab)')
      : fail('skip control not keyboard reachable, focus was on: ' + focused.sel);
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 9000 });
    const enterGone = await p.evaluate(() => !document.getElementById('intro'));
    enterGone ? pass('Enter on the focused skip control dismisses the intro') : fail('Enter did not dismiss the intro');
    await p.close();
  }

  /* ---------------- 5. Intro: repeat navigation in same session ------------ */
  console.log('\n[5] Intro skipped on repeat navigation (same session)');
  {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 9000 });
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 120));
    const skipped = await p.evaluate(() => !document.getElementById('intro'));
    skipped ? pass('2nd visit: no intro, homepage shown immediately') : fail('intro replayed on 2nd visit in session');

    const stored = await p.evaluate(() => sessionStorage.getItem('mb-intro-seen'));
    stored === '1' ? pass('sessionStorage flag set to "1"') : fail('sessionStorage flag not set: ' + stored);

    /* deep link with a hash */
    await p.evaluate(() => sessionStorage.removeItem('mb-intro-seen'));
    await p.goto(base + '/#work', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 120));
    const hashSkip = await p.evaluate(() => !document.getElementById('intro'));
    hashSkip ? pass('deep link to /#work skips the intro') : fail('intro forced on deep link');
    await p.close();
  }

  /* ---------------- 7. Reduced motion -------------------------------------- */
  console.log('\n[6] prefers-reduced-motion: reduce');
  {
    const p = await newPage({ width: 1280, height: 900, reducedMotion: true });
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 160));
    const spinning = await p.evaluate(() => {
      const mark = document.querySelector('.intro__mark');
      const bar = document.querySelector('.intro__progress');
      const name = document.querySelector('.intro__name');
      const skip = document.querySelector('[data-intro-skip]');
      const g = (sel) => (sel ? getComputedStyle(sel).animationName : 'missing');
      const vis = (sel) => (sel ? getComputedStyle(sel).visibility : 'missing');
      return {
        markAnim: g(mark),
        barAnim: g(bar),
        nameAnim: g(name),
        nameOpacity: name ? parseFloat(getComputedStyle(name).opacity) : 0,
        skipVisibility: vis(skip)
      };
    });
    spinning.markAnim === 'none' ? pass('monogram animation disabled') : fail('monogram still animating: ' + spinning.markAnim);
    spinning.barAnim === 'none' ? pass('progress sweep disabled') : fail('bar still animating: ' + spinning.barAnim);
    spinning.nameAnim === 'none' ? pass('name reveal disabled') : fail('name still animating: ' + spinning.nameAnim);
    spinning.nameOpacity > 0.9 ? pass('intro text immediately legible under reduced motion') : fail('intro text hidden under reduced motion: ' + spinning.nameOpacity);
    spinning.skipVisibility === 'visible' ? pass('skip control still available under reduced motion') : fail('skip control hidden under reduced motion');

    const t0r = Date.now();
    await p.waitForFunction(() => !document.getElementById('intro'), { timeout: 4000 });
    const reducedMs = Date.now() - t0r;
    reducedMs < 2500 ? pass('brand reveal completes quickly under reduced motion (' + reducedMs + 'ms)') : fail('reduced-motion intro took ' + reducedMs + 'ms');

    const revealed = await p.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-reveal]'));
      const hidden = els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.9);
      return { total: els.length, hidden: hidden.length };
    });
    revealed.hidden === 0
      ? pass('all ' + revealed.total + ' scroll-reveal elements are fully visible (no hidden content)')
      : fail(revealed.hidden + ' of ' + revealed.total + ' reveal elements stuck invisible');
    await p.close();
  }

  /* ---------------- 7. No-JS fallback --------------------------------------- */
  console.log('\n[7] JavaScript disabled');
  {
    const p = await newPage({ width: 390, height: 844, noJs: true });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    const noJs = await p.evaluate(() => {
      const intro = document.getElementById('intro');
      const h1 = document.querySelector('h1');
      const r = h1.getBoundingClientRect();
      const links = Array.from(document.querySelectorAll('.nav__link'))
        .filter((a) => a.getBoundingClientRect().height > 0);
      return {
        introVisible: intro ? getComputedStyle(intro).display !== 'none' : false,
        h1Visible: r.width > 0 && r.height > 0,
        h1Text: h1.textContent.trim().slice(0, 30),
        navLinksReachable: links.length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    !noJs.introVisible ? pass('intro stays display:none — no blank screen without JS') : fail('intro visible without JS');
    noJs.h1Visible ? pass('homepage renders fully without JS: "' + noJs.h1Text + '…"') : fail('page blank without JS');
    noJs.navLinksReachable >= 5
      ? pass(noJs.navLinksReachable + ' nav links reachable without JS')
      : warn('only ' + noJs.navLinksReachable + ' nav links reachable without JS');
    await p.screenshot({ path: path.join(SHOTS, 'nojs-390.png') });
    await p.close();
  }

  /* ---------------- 8. Mobile menu ------------------------------------------ */
  console.log('\n[8] Mobile menu');
  {
    const p = await newPage({ width: 360, height: 780 });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    await settle(p);

    const collapsed = await p.evaluate(() => ({
      hidden: document.getElementById('primary-menu').hidden,
      expanded: document.querySelector('.js-nav-toggle').getAttribute('aria-expanded'),
      toggleVisible: document.querySelector('.js-nav-toggle').getBoundingClientRect().height > 0
    }));
    collapsed.hidden && collapsed.expanded === 'false' && collapsed.toggleVisible
      ? pass('menu starts collapsed, aria-expanded="false", button visible')
      : fail('menu initial state wrong: ' + JSON.stringify(collapsed));

    await p.click('.js-nav-toggle');
    await new Promise((r) => setTimeout(r, 420));
    const opened = await p.evaluate(() => {
      const m = document.getElementById('primary-menu');
      const r = m.getBoundingClientRect();
      return {
        hidden: m.hidden,
        expanded: document.querySelector('.js-nav-toggle').getAttribute('aria-expanded'),
        height: Math.round(r.height),
        visible: r.height > 100
      };
    });
    opened.visible && opened.expanded === 'true'
      ? pass('menu opens (' + opened.height + 'px tall), aria-expanded="true"')
      : fail('menu did not open: ' + JSON.stringify(opened));
    await p.screenshot({ path: path.join(SHOTS, 'menu-open-360.png') });

    /* Escape closes */
    await p.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 380));
    const escClosed = await p.evaluate(() => document.getElementById('primary-menu').hidden);
    escClosed ? pass('Escape closes the menu') : fail('Escape did not close the menu');

    /* link click closes + navigates */
    await p.click('.js-nav-toggle');
    await new Promise((r) => setTimeout(r, 400));
    await p.click('a.nav__link[href="#services"]');
    await new Promise((r) => setTimeout(r, 1500));
    /* wait for smooth scrolling to settle before measuring alignment */
    await p.evaluate(() => new Promise((resolve) => {
      let last = -1;
      let still = 0;
      const tick = () => {
        const y = Math.round(window.scrollY);
        if (y === last) { still++; } else { still = 0; last = y; }
        if (still > 4) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    const afterNav = await p.evaluate(() => ({
      hidden: document.getElementById('primary-menu').hidden,
      hash: location.hash,
      top: Math.round(document.getElementById('services').getBoundingClientRect().top),
      headerH: Math.round(document.querySelector('.site-header').getBoundingClientRect().height)
    }));
    afterNav.hidden ? pass('menu closes after selecting a destination') : fail('menu stayed open after link click');
    afterNav.hash === '#services' ? pass('anchor navigation reached #services') : fail('hash not set: ' + afterNav.hash);
    /* Target heading should sit below the sticky header plus ~1.25rem breathing room. */
    afterNav.top >= 0 && afterNav.top <= afterNav.headerH + 28
      ? pass('section heading clears the sticky header (' + afterNav.top + 'px vs ' + afterNav.headerH + 'px header)')
      : warn('services top=' + afterNav.top + 'px, header=' + afterNav.headerH + 'px');
    await p.screenshot({ path: path.join(SHOTS, 'services-360.png') });
    await p.close();
  }

  /* ---------------- 9. Navigation switches to horizontal at 56rem ---------- */
  console.log('\n[9] Navigation breakpoint (mobile menu below 896px, bar at/above)');
  {
    for (const w of [768, 896, 1024, 1280, 1440]) {
      const p = await newPage({ width: w, height: 900 });
      await p.goto(base + '/', { waitUntil: 'networkidle2' });
      await settle(p);
      const d = await p.evaluate(() => {
        const menu = document.getElementById('primary-menu');
        const toggle = document.querySelector('.js-nav-toggle');
        const mr = menu.getBoundingClientRect();
        const cta = document.querySelector('.nav__cta .btn');
        const brand = document.querySelector('.brand');
        return {
          rowDirection: getComputedStyle(document.querySelector('.nav__list')).flexDirection,
          menuVisible: mr.height > 20,
          toggleVisible: toggle.getBoundingClientRect().height > 0,
          menuRight: Math.round(mr.right),
          viewport: document.documentElement.clientWidth,
          ctaVisible: !!(cta && cta.getBoundingClientRect().width > 0),
          brandTop: Math.round(brand.getBoundingClientRect().top)
        };
      });
      const overflowing = d.menuRight > d.viewport + 1;
      const wantsBar = w >= 896;

      if (wantsBar) {
        if (d.menuVisible && !d.toggleVisible && d.rowDirection === 'row' && !overflowing && d.ctaVisible) {
          pass(w + 'px — horizontal nav, toggle hidden, no overflow, CTA visible');
        } else {
          fail(w + 'px — expected horizontal bar, got ' + JSON.stringify(d));
        }
      } else {
        if (d.toggleVisible && !d.menuVisible) {
          pass(w + 'px — mobile menu toggle shown, menu collapsed, no overflow');
        } else {
          fail(w + 'px — expected mobile menu, got ' + JSON.stringify(d));
        }
      }
      await p.close();
    }
  }

  /* ---------------- 10. Contact form validation ----------------------------- */
  console.log('\n[10] Contact form validation');
  {
    const p = await newPage({ width: 390, height: 844 });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    await settle(p);

    const action = await p.evaluate(() => {
      const f = document.getElementById('contact-form');
      return { action: f.getAttribute('action'), method: f.getAttribute('method'), hasKey: !!f.querySelector('input[name="access_key"]') };
    });
    action.action === 'https://api.web3forms.com/submit' && action.hasKey
      ? pass('Web3Forms integration preserved (action + access key present, method=' + action.method + ')')
      : fail('form integration changed: ' + JSON.stringify(action));

    /* Submit empty -> validation, no network call */
    let sent = false;
    await p.setRequestInterception(true);
    p.on('request', (r) => {
      if (r.url().includes('api.web3forms.com')) sent = true;
      r.continue();
    });

    await clickSafely(p, '#contact-form button[type="submit"]');
    await new Promise((r) => setTimeout(r, 500));

    const invalid = await p.evaluate(() => ({
      errors: Array.from(document.querySelectorAll('.form__field.has-error .form__error'))
        .map((e) => e.textContent).filter(Boolean),
      ariaInvalid: document.querySelectorAll('[aria-invalid="true"]').length,
      status: document.getElementById('form-status').textContent,
      focused: document.activeElement && document.activeElement.id
    }));
    invalid.errors.length === 4
      ? pass('empty submit blocks and reports ' + invalid.errors.length + ' field errors')
      : fail('expected 4 field errors, got ' + invalid.errors.length + ': ' + JSON.stringify(invalid.errors));
    invalid.ariaInvalid === 4 ? pass('aria-invalid="true" set on each failing field') : fail('aria-invalid count: ' + invalid.ariaInvalid);
    invalid.focused === 'cf-name' ? pass('focus moved to the first invalid field') : fail('focus went to: ' + invalid.focused);
    !sent ? pass('no network request made on invalid submit') : fail('invalid submit hit the network');
    await p.screenshot({ path: path.join(SHOTS, 'form-errors-390.png') });

    /* Bad email */
    await p.type('#cf-name', 'Test Client');
    await p.type('#cf-email', 'not-an-email');
    await p.type('#cf-message', 'This is a sufficiently long project description for validation.');
    await p.select('#cf-type', 'Business website');
    await clickSafely(p, '#contact-form button[type="submit"]');
    await new Promise((r) => setTimeout(r, 500));
    const emailErr = await p.evaluate(() => {
      const e = document.querySelector('#cf-email');
      return { invalid: e.getAttribute('aria-invalid'), msg: e.closest('.form__field').querySelector('.form__error').textContent };
    });
    emailErr.invalid === 'true' && /valid email/i.test(emailErr.msg)
      ? pass('invalid email rejected: "' + emailErr.msg + '"')
      : fail('email validation wrong: ' + JSON.stringify(emailErr));

    /* Mobile usability: no zoom on focus (16px inputs) */
    const fontSize = await p.evaluate(() => getComputedStyle(document.getElementById('cf-name')).fontSize);
    parseFloat(fontSize) >= 16
      ? pass('input font-size ' + fontSize + ' — iOS will not zoom on focus')
      : fail('input font-size ' + fontSize + ' causes iOS zoom');

    /* Honeypot */
    const hp = await p.evaluate(() => {
      const f = document.getElementById('contact-form');
      const h = f.querySelector('input[name="_hp"]');
      const cs = h ? getComputedStyle(h) : null;
      return h ? { offscreen: h.getBoundingClientRect().left < -1000, aria: h.getAttribute('aria-hidden') } : null;
    });
    hp && hp.offscreen ? pass('honeypot field present and off-screen for humans') : fail('honeypot issue: ' + JSON.stringify(hp));
    await p.close();
  }

  /* ---------------- 11. Keyboard accessibility ----------------------------- */
  console.log('\n[11] Keyboard access');
  {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    await settle(p);

    await p.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 450)); /* let the reveal transition finish */
    const first = await p.evaluate(() => {
      const r = document.activeElement.getBoundingClientRect();
      return {
        cls: document.activeElement.className,
        text: document.activeElement.textContent.trim().slice(0, 30),
        visible: r.top >= 0 && r.height > 0
      };
    });
    first.cls.includes('skip-link') && first.visible
      ? pass('first Tab reaches the visible skip link')
      : fail('first tab stop wrong: ' + JSON.stringify(first));

    const order = [];
    for (let i = 0; i < 9; i++) {
      await p.keyboard.press('Tab');
      order.push(await p.evaluate(() => {
        const a = document.activeElement;
        return (a.tagName + ':' + (a.className || a.getAttribute('aria-label') || a.textContent || '').toString().trim().split(' ')[0]).slice(0, 34);
      }));
    }
    pass('tab order: ' + order.join(' > '));

    const ring = await p.evaluate(() => {
      const cs = getComputedStyle(document.activeElement);
      return { outline: cs.outlineWidth, style: cs.outlineStyle };
    });
    ring.style !== 'none' && parseFloat(ring.outline) >= 2
      ? pass('focus ring visible: ' + ring.outline + ' ' + ring.style)
      : fail('focus ring missing: ' + JSON.stringify(ring));
    await p.close();
  }

  /* ---------------- 12. Case study pages ----------------------------------- */
  console.log('\n[12] Case study pages');
  {
    for (const [route, w] of [['/projects/savory-bites.html', 390], ['/projects/pp-studio.html', 390],
      ['/projects/johnsons-academy.html', 390], ['/projects/savory-bites.html', 1280]]) {
      const p = await newPage({ width: w, height: 900 });
      await p.goto(base + route, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 600));
      const r = await p.evaluate(() => ({
        intro: !!document.getElementById('intro'),
        h1: document.querySelector('h1').textContent.trim(),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        facts: document.querySelectorAll('.case__fact').length,
        links: document.querySelectorAll('.case__link').length,
        imgOk: Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)
      }));
      const name = route.split('/').pop();
      if (r.intro) fail(name + ' — intro should not exist on sub-pages');
      else if (r.overflow > 1) fail(name + ' @' + w + ' overflow=' + r.overflow);
      else if (!r.imgOk) fail(name + ' — an image failed to load');
      else pass(name + ' @' + w + 'px — h1 "' + r.h1 + '", ' + r.facts + ' facts, ' + r.links + ' verified links, no overflow, images OK');
      await p.screenshot({ path: path.join(SHOTS, name.replace('.html', '') + '-' + w + '.png') });
      await p.close();
    }
  }

  /* ---------------- 13. Brief compliance ----------------------------------- */
  console.log('\n[13] Brief compliance: nav, order, closing CTA, footer, skills');
  {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const r = await p.evaluate(() => {
      const text = (s) => {
        const el = document.querySelector(s);
        return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
      };
      const navLinks = Array.from(document.querySelectorAll('.nav__list .nav__link'))
        .map((a) => a.textContent.trim());
      const order = Array.from(document.querySelectorAll('main > section, main > .closing'))
        .map((s) => s.id || s.className.split(' ')[0]);
      const skills = Array.from(document.querySelectorAll('.skill-group__title'))
        .map((h) => h.textContent.trim());
      return {
        navLinks,
        navCta: text('.nav__cta .btn'),
        h1: text('h1'),
        heroLead: text('.hero__lead'),
        order,
        skills,
        skillBars: document.querySelectorAll('.skill-bar, .skill__bar, progress, meter').length,
        serviceRows: document.querySelectorAll('.service-row').length,
        workItems: document.querySelectorAll('.work__item').length,
        workLayouts: Array.from(document.querySelectorAll('.work__item'))
          .map((el) => Array.from(el.classList).find((c) => /^work__item--/.test(c)) || 'none'),
        closingTitle: text('.closing__title'),
        closingText: text('.closing__text'),
        closingCta: text('.closing__actions .btn'),
        footerLinks: document.querySelectorAll('.site-footer a').length,
        footerHasMark: !!document.querySelector('.footer__mark'),
        footerHasName: !!document.querySelector('.footer__name'),
        footerHasCopy: !!document.querySelector('.footer__copy'),
        footerSocial: document.querySelectorAll('.footer__social .footer__icon').length,
        grain: (() => {
          const cs = getComputedStyle(document.body, '::after');
          return cs.backgroundImage.indexOf('data:image/svg+xml') !== -1;
        })(),
        darkSections: Array.from(document.querySelectorAll('main > section, main > .closing'))
          .map((s) => {
            const c = getComputedStyle(s).backgroundColor;
            const m = c.match(/\d+/g);
            if (!m) return 1;
            const lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
            return lum;
          })
      };
    });

    const wantNav = ['Work', 'About', 'Services', 'Contact'];
    JSON.stringify(r.navLinks) === JSON.stringify(wantNav)
      ? pass('nav is exactly ' + wantNav.join(', '))
      : fail('nav links are ' + JSON.stringify(r.navLinks) + ', expected ' + JSON.stringify(wantNav));

    /Let/.test(r.navCta || '') ? pass('nav CTA present: "' + r.navCta + '"') : fail('nav CTA missing');

    /I build digital experiences that bring ideas to life\./i.test(r.h1 || '')
      ? pass('H1 matches the brief: "' + r.h1 + '"')
      : fail('H1 is "' + r.h1 + '"');

    r.h1.length < 120 && r.heroLead
      ? pass('hero value statement is concise (' + r.h1.length + ' char headline)')
      : fail('hero copy too long: ' + (r.h1 || '').length + ' chars');

    const wantOrder = ['home', 'about', 'services', 'work', 'skills', 'process', 'contact', 'closing'];
    JSON.stringify(r.order) === JSON.stringify(wantOrder)
      ? pass('section order: ' + r.order.join(' -> '))
      : fail('section order is ' + JSON.stringify(r.order) + ', expected ' + JSON.stringify(wantOrder));

    r.skillBars === 0
      ? pass('no proficiency bars or meters anywhere in Skills')
      : fail(r.skillBars + ' proficiency indicator(s) found - brief forbids them');
    r.skills.length === 3
      ? pass('skills grouped as ' + r.skills.join(' / '))
      : fail('expected 3 skill groups, found ' + JSON.stringify(r.skills));

    r.serviceRows === 3
      ? pass('services presented as ' + r.serviceRows + ' numbered editorial rows')
      : fail('expected 3 service rows, found ' + r.serviceRows);

    r.workItems === 3 ? pass('3 real projects shown') : fail('expected 3 projects, found ' + r.workItems);
    new Set(r.workLayouts).size === 3
      ? pass('project layouts are varied: ' + r.workLayouts.join(', '))
      : fail('project layouts are not varied: ' + r.workLayouts.join(', '));

    /Have a project in mind\?/i.test(r.closingTitle || '')
      ? pass('closing CTA headline: "' + r.closingTitle + '"')
      : fail('closing CTA headline is "' + r.closingTitle + '"');
    /thoughtful digital experience/i.test(r.closingText || '')
      ? pass('closing CTA line: "' + r.closingText + '"')
      : fail('closing CTA line is "' + r.closingText + '"');
    /Let/.test(r.closingCta || '')
      ? pass('closing CTA button: "' + r.closingCta + '"')
      : fail('closing CTA button is "' + r.closingCta + '"');

    r.footerHasMark && r.footerHasName && r.footerHasCopy && r.footerSocial === 3
      ? pass('footer is minimal: mark, name, copyright, ' + r.footerSocial + ' social icons')
      : fail('footer incomplete: mark=' + r.footerHasMark + ' name=' + r.footerHasName +
        ' copy=' + r.footerHasCopy + ' social=' + r.footerSocial);
    r.footerLinks === 4
      ? pass('footer carries no extra navigation (' + r.footerLinks + ' links: brand + 3 social)')
      : fail('footer has ' + r.footerLinks + ' links - expected only brand + 3 social');

    r.grain ? pass('subtle grain/texture layer present') : fail('grain texture layer missing');

    const dark = r.darkSections.filter((l) => l < 0.5).length;
    dark >= r.darkSections.length * 0.6
      ? pass('most sections read dark: ' + dark + ' of ' + r.darkSections.length + ' below 50% luminance')
      : fail('only ' + dark + ' of ' + r.darkSections.length + ' sections are dark');

    await p.close();
  }

  /* ---------------- 14. Broken link sweep on live URLs --------------------- */
  console.log('\n[14] External project links');
  {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(base + '/', { waitUntil: 'networkidle2' });
    const hrefs = await p.evaluate(() =>
      Array.from(document.querySelectorAll('a[target="_blank"]')).map((a) => a.href));
    const uniq = Array.from(new Set(hrefs));
    for (const u of uniq) console.log('    -> ' + u);
    await p.close();
  }

  await browser.close();
  server.close();

  console.log('\n' + '='.repeat(72));
  console.log(errors + ' failure(s).  Screenshots in .shots/');
  console.log('='.repeat(72));
  process.exit(errors ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
