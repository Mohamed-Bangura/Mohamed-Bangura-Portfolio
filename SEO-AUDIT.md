# SEO Audit — Mohamed Bangura Portfolio

Audited against the current build. Canonical domain:
`https://mohamed-bangura-portfolio.vercel.app/`

> The previously documented `https://mohamedbangura.vercel.app/` returns **404**
> and has been removed from every canonical, Open Graph, sitemap and robots
> reference. Treat the new domain as the only correct address.

## Status

### Crawling

- [x] `robots.txt` allows all public pages and points at the live sitemap
- [x] `<meta name="robots" content="index, follow, max-image-preview:large, …">`
- [x] `404.html` is `noindex, follow`
- [x] `sitemap.xml` lists exactly the four indexable pages
- [x] Google Search Console verification file preserved

### Metadata

- [x] Unique `<title>` per page, all at or under 60 characters
- [x] Unique meta description per page, 132–175 characters
- [x] `lang="en"`, `author`, and `theme-color`
- [x] Self-referencing canonical on every page, absolute `https://`
- [x] Canonical and `og:url` agree on every page

### Open Graph and Twitter

- [x] `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name`, `og:locale`
- [x] `og:image:width` 1200 and `og:image:height` 630
- [x] `og:image:alt`
- [x] `twitter:card` = `summary_large_image`, plus title, description, image and `image:alt`
- [x] One 1200x630 `og-image.png` with a `.jpg` fallback for older crawlers

### Structured data

- [x] `Person` — name, job title, email, `sameAs` profiles, `knowsAbout`
- [x] `WebSite` with `SearchAction`
- [x] `ItemList` of the three projects, each with its live URL and repository
- [x] `BreadcrumbList` on each case study
- [ ] **Verify in the Rich Results Test.** The JSON-LD parses and the ids
      resolve, but it has not been checked against Google's validator.

### HTML structure and accessibility

- [x] Semantic landmarks: `header`, `nav`, `main`, `section`, `article`, `footer`
- [x] Exactly one `h1` per page
- [x] No skipped heading levels — machine-checked across all 28 headings
- [x] Skip link, revealed on focus
- [x] `aria-labelledby` on every section, `aria-current` on the active nav link
- [x] Form status is `aria-live`; invalid fields get `aria-invalid` plus
      `aria-describedby` error text, and focus moves to the first bad field
- [x] Visible focus ring on every interactive element
- [x] Mobile menu is a real `aria-expanded` toggle, closes on `Escape`,
      on outside click, and on choosing a destination
- [x] Every text node meets WCAG AA contrast — machine-checked against
      composited rendered colours, not estimated by eye

### Images and performance

- [x] `alt` text on every image, machine-checked
- [x] Explicit `width`/`height` on every image, so nothing shifts while loading
- [x] `loading="lazy"` on below-fold images, `fetchpriority="high"` on the portrait
- [x] `srcset` and `sizes` on the portrait and project screenshots
- [x] WebP throughout, 846 KB total, down from about 5.4 MB
- [x] `defer` on the single script
- [x] No render-blocking JavaScript, no framework
- [ ] **Core Web Vitals are unmeasured.** No Lighthouse or field data has been
      collected against the deployed URL. This is the main open gap.

### Deployment

- [x] Fully static, no server runtime
- [x] All internal links resolve — `npm run verify` checks every local reference
- [x] All project links point at verified live URLs and real repositories
- [ ] **Post-deploy checks pending:** confirm the new build is live, re-submit
      the sitemap in Search Console, and request indexing for the three new
      case-study URLs.

## Known gaps

1. **No Core Web Vitals data.** Run Lighthouse against the deployed URL, then
   watch the Search Console Core Web Vitals report for real-user data.
2. **Rich Results Test not run** on the JSON-LD.
3. **Case-study `BreadcrumbList` ids** reference the homepage graph. If a case
   study is ever shared without the homepage in the same crawl, switch those
   references to absolute URLs.
4. **No `sitemap` `lastmod` accuracy** beyond the build date. Worth refreshing
   only when content actually changes.
5. **No analytics.** Deliberate: no third-party scripts, nothing to consent to.
   If page views are wanted later, a privacy-respecting option should be
   chosen deliberately rather than added by default.
6. **Case studies are not individually targeted for local search terms.** The
   three pages are branded case studies, not location landing pages.

## Verification tooling

| Command | Covers |
| --- | --- |
| `npm run verify` | Link and asset resolution, title/description lengths, `h1` count, `alt` presence, canonical/OG agreement, sitemap, robots, manifest, secret-file scan |
| `npm run test:browser` | Console errors, overflow at 9 widths, intro behaviour, reduced motion, no-JS, mobile menu, form validation, keyboard access |
| `npm run test:design` | WCAG AA contrast, type scale, section rhythm, heading order, image decoding, visibility sweep |

Run `npm test` for all three.

---

*Audited 2026-09-27 against the current build.*
