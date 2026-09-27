/* Generate square PNG app icons from the MB mark.
   Uses the Chrome that puppeteer-core already drives, so there is no native
   image dependency. The mark is drawn inline, which keeps the source asset
   out of the repository.

   Run: node tools/make-icons.js                                        */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'favicon');
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* Matches .brand__mark in css/style.css: a wine gradient disc with the
   monogram in the display serif. */
const MARK = `
<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  .disc{
    width:100vmin;height:100vmin;border-radius:50%;
    background:linear-gradient(145deg,#5E1529,#2A0A14);
    display:grid;place-items:center;
    font-family:Georgia,'Times New Roman',serif;
    font-weight:600;color:#F3E3D8;letter-spacing:.04em;
  }
</style></head><body><div class="disc">MB</div></body></html>`;

/* Full-bleed square, mark held inside the 80% maskable safe zone. */
const MASKABLE = `
<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  .disc{
    border-radius:50%;
    background:linear-gradient(145deg,#7A1F3D,#2A0A14);
    display:grid;place-items:center;
    font-family:Georgia,'Times New Roman',serif;
    font-weight:600;color:#FBF3EC;letter-spacing:.04em;
  }
</style></head><body><div class="disc">MB</div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--force-device-scale-factor=1']
  });

  for (const size of [192, 512]) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(MARK, { waitUntil: 'load' });
    await page.evaluate((s) => {
      const d = document.querySelector('.disc');
      d.style.width = s + 'px';
      d.style.height = s + 'px';
      d.style.fontSize = Math.round(s * 0.34) + 'px';
    }, size);
    const file = path.join(OUT, 'icon-' + size + '.png');
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
    console.log('wrote ' + path.relative(ROOT, file) + ' (' + size + 'x' + size + ')');
  }

  /* Apple touch icons are never transparent and never maskable. */
  for (const size of [180]) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      MARK.replace('background:transparent', 'background:#2A0A14'),
      { waitUntil: 'load' }
    );
    await page.evaluate((s) => {
      const d = document.querySelector('.disc');
      d.style.width = s + 'px';
      d.style.height = s + 'px';
      d.style.fontSize = Math.round(s * 0.34) + 'px';
    }, size);
    const file = path.join(OUT, 'apple-touch-icon.png');
    await page.screenshot({ path: file });
    await page.close();
    console.log('wrote ' + path.relative(ROOT, file) + ' (' + size + 'x' + size + ')');
  }

  /* Maskable icons get cropped to whatever shape the platform uses, so the
     art must be full-bleed with the mark inside the 80% safe zone. */
  for (const size of [192, 512]) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      MASKABLE.replace('background:transparent', 'background:#2A0A14'),
      { waitUntil: 'load' }
    );
    await page.evaluate((s) => {
      const d = document.querySelector('.disc');
      d.style.width = Math.round(s * 0.6) + 'px';
      d.style.height = Math.round(s * 0.6) + 'px';
      d.style.fontSize = Math.round(s * 0.6 * 0.34) + 'px';
    }, size);
    const file = path.join(OUT, 'icon-maskable-' + size + '.png');
    await page.screenshot({ path: file });
    await page.close();
    console.log('wrote ' + path.relative(ROOT, file) + ' (' + size + 'x' + size + ', maskable)');
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
