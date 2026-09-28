# Mohamed Bangura | Frontend Web Developer Portfolio

A static, dependency-free portfolio site for Mohamed Bangura, Frontend Web
Developer & Digital Creative based in Sierra Leone. Built to win freelance
clients and to support job and internship applications.

- **Live site:** <https://mohamed-bangura-portfolio.vercel.app/>
- **Repository:** <https://github.com/Mohamed-Bangura/Mohamed-Bangura-Portfolio>

> The old `mohamedbangura.vercel.app` address returns 404. The canonical domain
> is `mohamed-bangura-portfolio.vercel.app`; do not link to the old one.

## Stack

No framework, no bundler, no runtime dependencies. The site is plain files that
Vercel serves as-is.

| Concern | Choice |
| --- | --- |
| Markup | HTML5, semantic landmarks, one `h1` per page |
| Styling | CSS3 custom properties, mobile-first, container-free grid |
| Behaviour | Vanilla ES2018 in one deferred file, wrapped in an IIFE |
| Contact | Web3Forms (public access key lives in the markup) |
| Hosting | Vercel, deployed from `main` |
| Fonts | Fraunces + Inter from Google Fonts, with system fallbacks |

Dev-only tooling uses `puppeteer-core` to drive a real local Chrome. It never
ships to the browser.

## Pages

| Path | Purpose |
| --- | --- |
| `index.html` | Hero, about, services, selected work, skills, process, contact, closing CTA |
| `projects/savory-bites.html` | Case study: restaurant site |
| `projects/pp-studio.html` | Case study: digital agency site |
| `projects/johnsons-academy.html` | Case study: training-provider site |
| `404.html` | Branded error page, `noindex` |

## Project structure

```
.
├── index.html
├── 404.html
├── projects/
│   ├── savory-bites.html
│   ├── pp-studio.html
│   └── johnsons-academy.html
├── css/style.css
├── js/script.js
├── images/
│   ├── profile/          responsive WebP portrait (320/560/800)
│   ├── projects/         responsive WebP screenshots
│   ├── logo/             WebP mark at 96 and 192
│   ├── og-image.png      1200x630 social preview
│   └── og-image.jpg      JPEG fallback for older crawlers
├── favicon/
├── tools/                dev-only checks, never referenced by the site
├── robots.txt
├── sitemap.xml
├── manifest.webmanifest
└── googlefaa70da1a191416b.html   Google Search Console verification
```

## The intro

The homepage opens with a short cinematic brand reveal that runs about five
seconds. It is deliberately defensive:

- Shown **once per browsing session**, tracked in `sessionStorage` under
  `mb-intro-seen`. A repeat visit, a refresh, or a back-navigation goes straight
  to the content.
- Skipped entirely when the URL carries a hash, so deep links land on the
  section the visitor asked for.
- A real `<button>` sits **outside** the `aria-hidden` decorative subtree, so
  assistive technology can reach it. It is revealed after a short delay and is
  dismissed by click or `Escape`.
- The markup is `display: none` unless `<html>` has `class="js"`, which is only
  set by an inline script. **With JavaScript disabled the intro never renders
  and the page is complete.**
- A `6000ms` failsafe timer removes it even if an animation callback is lost,
  after an intentional `900ms` hold so the brand lands rather than flashes.
- `prefers-reduced-motion: reduce` replaces the reveal with a short static hold.
- The progress line is an indeterminate sweep. No percentage is ever faked.

Timing lives in one place, `Intro` in `js/script.js`: `EXIT_AT: 4300`,
`LIFETIME: 6000`, `FADE_MS: 700`, `STILL_MS: 900`.

Scroll locking is reference counted (`Lock` in `js/script.js`) because the intro
and the mobile menu both lock the page and overlap during the first second.
Releasing one must not unlock the other.

The mobile menu is positioned absolutely inside the header rather than fixed to
the viewport: the header's `backdrop-filter` makes it the containing block for a
`position: fixed` child, which collapsed the panel to the header's own height.

## Design

Deliberately dark and cinematic, with two light sections used as punctuation
rather than decoration:

| Section | Ground | Role |
| --- | --- | --- |
| Hero, About, Selected Work, Skills, Contact, Closing | Dark (`--ink-900`) | The main reading experience |
| Services, Process | Ivory (`#F5EFE7`) | Two deliberate breaks in the rhythm |

- One `Fraunces` display serif for headings, one `Inter` for everything else.
- A burgundy-to-gold accent range, used sparingly.
- A fixed film-grain layer over the whole page, at very low opacity.
- Cards are the exception, not the default. Services and process are editorial
  rows separated by hairlines; the three projects use three different layouts so
  the work section does not read as a card grid.
- A decorative `MB` watermark in the hero is drawn with a text stroke and a
  transparent fill, so the contrast audit correctly ignores it.

## Local development

```bash
npm install          # dev tooling only
npm run serve        # http://localhost:4321
```

## Checks

```bash
npm test             # runs all three suites below, in order
```

| Command | What it proves |
| --- | --- |
| `npm run verify` | Every local link and asset resolves; per-page title/description lengths; exactly one `h1`; `alt` text present; canonical and OG tags agree; sitemap, robots and manifest are valid; no `.env` or key files committed |
| `npm run test:browser` | Real Chrome across 9 widths (320–1440): no console errors, no horizontal overflow, intro timing and every skip path, reduced motion, no-JS fallback, mobile menu and `Escape`, 44px tap targets, form validation and no-network-on-invalid, keyboard order and focus rings, exact nav/section order/required copy, case-study pages |
| `npm run test:design` | WCAG AA contrast on every text node using composited rendered colours, descending type scale, uniform section rhythm, heading order, image decoding and aspect ratio, intro composition, nothing left invisible after scrolling, per-section contrast for both the dark and the light sections, reduced-motion safety |

`npm run test:design` exists because contrast cannot be judged by eye
reliably. It resolves translucent backgrounds and gradients properly: an element's
ancestors are flattened to one opaque base, and only the element's **own**
backgrounds become separate contrast candidates, because a 0.94-alpha fill
genuinely hides what is behind it. Text over a photograph is detected by
geometry and must have a scrim to pass.

Screenshots from the browser run land in `.shots/`, which is git-ignored.

`CHROME_PATH` overrides the browser binary if Chrome is not installed at the
default Windows location.

## Regenerating image assets

The committed WebP files are the source of truth for photography; there is no
asset build step. The large original PNG/JPG files were replaced to cut the
image payload from about 5.4 MB to 846 KB, and the originals were deleted. They
are still in git history if you ever need to re-cut them:

```bash
git show 4358260:images/projects/savory-bites.png > /tmp/savory-bites.png
```

The icons and the social share image are generated from inline markup, so their
source art never has to be committed:

```bash
node tools/make-icons.js      # favicon/icon-*.png, maskable + apple-touch variants
node tools/make-og-image.js   # images/og-image.png and the .jpg fallback, 1200x630
```

Both drive the same local Chrome as the test suites. The OG image uses the real
`:root` palette and the real webfonts, so change the tokens in
`css/style.css` first and the share image follows.

## Contact form

The form posts to Web3Forms using a public access key that is already in
`index.html`. That key is designed to be public and is not a secret. There is no
`.env` file and nothing secret belongs in this repository.

Client-side validation covers name, email, project type and message. A honeypot
field named `_hp` drops bot submissions. Delivery failures fall back to telling
the visitor to email `prosperbangura9@gmail.com` directly.

## SEO

- Unique title and meta description per page, all within display limits.
- Canonical, Open Graph and Twitter card tags on every page.
- JSON-LD `Person` plus `WebSite`, `ItemList` of projects, and `BreadcrumbList`
  on case studies.
- `sitemap.xml` lists the four indexable pages; `404.html` is `noindex`.
- One `og-image` at 1200x630 with a JPEG fallback, generated from the site's own
  palette and webfonts.

See `SEO-AUDIT.md` for the current state and the outstanding items.

## Contact channels

Only channels that are actually verified are published. The site lists an email
address, LinkedIn, and GitHub.

**There is no WhatsApp link, and none should be added** until a real number is
supplied and confirmed. No phone number exists in the repository or its history,
and inventing one would put a dead contact route in front of clients. See
`TODO.md`.

## Author

**Mohamed Bangura** — frontend developer, Information Technology student at
IPAM, Sierra Leone.

- Email: <prosperbangura9@gmail.com>
- LinkedIn: <https://www.linkedin.com/in/mohamed-bangura-699253389>
- GitHub: <https://github.com/Mohamed-Bangura>
