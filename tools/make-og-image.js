/* Generate the 1200x630 social share image.
   Uses the Chrome that puppeteer-core already drives, so there is no native
   image dependency. Layout and colour are declared inline and mirror
   css/style.css, which keeps the source art out of the repository.

   Run: node tools/make-og-image.js                                      */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'og-image.png');
const OUT_JPG = path.join(ROOT, 'images', 'og-image.jpg');
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const W = 1200;
const H = 630;

/* Palette taken from the :root block in css/style.css. */
const CARD = `
<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&display=swap">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{
    background:#0B0609;color:#F2E9E1;
    font-family:Inter,system-ui,-apple-system,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  /* Same fixed grain layer the site uses. */
  body::after{
    content:"";position:absolute;inset:0;z-index:3;pointer-events:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity:.05;mix-blend-mode:overlay;
  }
  .stage{
    position:relative;width:${W}px;height:${H}px;
    display:flex;align-items:center;gap:64px;padding:64px 72px;
  }
  /* Warm burgundy bloom, matching the hero backdrop. */
  .stage::before{
    content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(70% 90% at 8% 4%, rgba(110,26,48,.55), transparent 60%),
      radial-gradient(60% 80% at 96% 100%, rgba(44,26,37,.9), transparent 62%);
  }
  .mark{
    position:relative;z-index:1;flex:0 0 auto;
    width:132px;height:132px;border-radius:50%;
    background:linear-gradient(145deg,#7A1F3D,#2A0A14);
    border:1px solid rgba(201,162,126,.36);
    display:grid;place-items:center;
    font-family:Fraunces,Georgia,serif;font-weight:600;
    font-size:46px;letter-spacing:.04em;color:#FBF3EC;
  }
  .copy{position:relative;z-index:1;min-width:0}
  .role{
    font-size:15px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;
    color:#C9A27E;margin-bottom:20px;
  }
  h1{
    font-family:Fraunces,Georgia,serif;font-weight:500;
    font-size:60px;line-height:1.06;letter-spacing:-.015em;
    color:#F5EFE7;max-width:15ch;
  }
  h1 em{font-style:italic;color:#C9A27E}
  .rule{
    width:64px;height:2px;margin:28px 0 22px;
    background:linear-gradient(90deg,#C9A27E,rgba(201,162,126,0));
  }
  .meta{
    display:flex;align-items:center;gap:12px;
    font-size:15px;color:#9C8B95;
  }
  .meta span{color:#C9BAC2}
  .dot{width:3px;height:3px;border-radius:50%;background:#6B1A30}
</style></head><body>
<div class="stage">
  <div class="mark">MB</div>
  <div class="copy">
    <p class="role">Frontend Web Developer &amp; Digital Creative</p>
    <h1>I build digital experiences that bring <em>ideas to life.</em></h1>
    <div class="rule"></div>
    <p class="meta">Mohamed Bangura <i class="dot"></i> <span>Sierra Leone</span></p>
  </div>
</div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(CARD, { waitUntil: 'networkidle0' });
  /* Wait for webfonts so the display serif never falls back to Georgia. */
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT });
  /* JPEG fallback for crawlers that will not take the PNG. */
  await page.screenshot({ path: OUT_JPG, type: 'jpeg', quality: 92 });
  await browser.close();
  for (const f of [OUT, OUT_JPG]) {
    console.log('wrote ' + path.relative(ROOT, f) + ' (' + W + 'x' + H + ', ' +
      Math.round(fs.statSync(f).size / 1024) + ' kB)');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
