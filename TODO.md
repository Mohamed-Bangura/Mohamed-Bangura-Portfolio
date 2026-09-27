# TODO

## Done in this rebuild

- [x] Rebuilt the homepage around verified content: hero, about, skills, three
      projects, services, process, contact
- [x] Replaced the dead `mohamedbangura.vercel.app` canonical with
      `mohamed-bangura-portfolio.vercel.app` everywhere
- [x] Pointed each project at its real live URL and its real repository
      instead of the generic GitHub profile
- [x] Wrote three real case studies under `projects/`
- [x] Added a branded `404.html`
- [x] Cinematic first-visit intro: session-scoped, hash-aware, reduced-motion
      aware, failsafe-timed, and inert without JavaScript
- [x] Reference-counted scroll locking so the intro and the mobile menu can
      overlap safely
- [x] Accessible mobile navigation: `aria-expanded`, `Escape`, outside-click,
      focus management
- [x] Regenerated all imagery as responsive WebP plus a 1200x630 OG image;
      5.4 MB down to 846 KB
- [x] Scroll-lock, tap targets, skip-link reveal, portrait scrim and the
      project-type validation rule all fixed after browser testing found them
- [x] `npm test`: static verification, real-browser suite, numeric design audit
- [x] `README.md` and `SEO-AUDIT.md` rewritten to match reality

## Next up

### Deploy
- [ ] Push to `main`
- [ ] Confirm the new build is live on the canonical domain
- [ ] Re-submit `sitemap.xml` in Google Search Console
- [ ] Request indexing for the three case-study URLs

### Measure
- [ ] Run Lighthouse against the deployed URL
- [ ] Watch Core Web Vitals in Search Console once there is real-user data
- [ ] Run the JSON-LD through Google's Rich Results Test

### Content
- [ ] Add a fourth project when there is a fourth finished, publicly viewable
      site. Do not pad the grid with half-finished work.
- [ ] Write the case studies in first person with concrete outcomes, and add
      real numbers once they exist
- [ ] Replace the OG image if a stronger brand composition is wanted

### Optional
- [ ] Add a `humans.txt`
- [ ] Consider a lightweight dark mode. Only worth it if the palette holds up
      at AA in both directions; the current light theme is already verified.
- [ ] Consider per-page OG images for the case studies instead of one shared image

## Deliberately not doing

- **No framework or bundler.** The site is five static files; a build step
  would add failure modes for no measurable gain.
- **No analytics or third-party scripts.** Nothing to consent to, nothing to
  slow the page down.
- **No fake loading percentages.** The intro bar is indeterminate by design.
- **No invented metrics, testimonials, or client names.** Every project link
  and claim on the site is verifiable.
