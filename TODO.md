# TODO

## Done in this rebuild

- [x] Cinematic redesign of the homepage: dark-dominant palette, burgundy and
      gold accents, film grain, editorial section rhythm
- [x] Reordered the page to hero, about, services, work, skills, process,
      contact, closing CTA
- [x] Exact required copy: role, hero statement, closing headline, closing line
      and CTA label
- [x] Rewrote the ~5s intro: 0–1s monogram, 1–2s name and role, 2–4s statement,
      4–5s exit
- [x] Real skip button outside the `aria-hidden` decorative subtree, `Escape` to
      dismiss, 44px target
- [x] Intro is still session-scoped, hash-aware, reduced-motion aware,
      failsafe-timed, and inert without JavaScript
- [x] Reference-counted scroll locking so the intro and the mobile menu can
      overlap safely
- [x] Accessible mobile navigation: `aria-expanded`, `Escape`, outside-click,
      focus management
- [x] Services and process as editorial rows rather than cards, so the design
      does not fall back to a card grid
- [x] Three deliberately different project layouts in the work section
- [x] Minimal footer and a matching closing CTA
- [x] Replaced the dead `mohamedbangura.vercel.app` canonical with
      `mohamed-bangura-portfolio.vercel.app` everywhere
- [x] Pointed each project at its real live URL and its real repository
      instead of the generic GitHub profile
- [x] Wrote three real case studies under `projects/`
- [x] Added a branded `404.html`
- [x] Regenerated all imagery as responsive WebP plus a 1200x630 OG image;
      5.4 MB down to 846 KB
- [x] OG share image now generated from the site's own palette and webfonts
- [x] Scroll-lock, tap targets, skip-link reveal, portrait scrim and the
      project-type validation rule all fixed after browser testing found them
- [x] `npm test`: static verification, real-browser suite, numeric design audit —
      0 failures in all three
- [x] `README.md` and `SEO-AUDIT.md` rewritten to match reality

## Next up

### Deploy
- [ ] Push to `main`
- [ ] Confirm the cinematic redesign is live on the canonical domain
- [ ] Re-submit `sitemap.xml` in Google Search Console
- [ ] Request indexing for the three case-study URLs

### Measure
- [ ] Run Lighthouse against the deployed URL
- [ ] Watch Core Web Vitals in Search Console once there is real-user data
- [ ] Run the JSON-LD through Google's Rich Results Test
- [ ] Preview the share card in the LinkedIn, X and Facebook debuggers

### Needs a decision or a real detail
- [ ] **WhatsApp contact.** No WhatsApp link or phone number exists anywhere in
      the repository or its history. The site publishes only the email address,
      LinkedIn and GitHub, because those are the only verified channels. Supply a
      real number and it can be added to the contact and footer; it should not be
      guessed.
- [ ] **Confirm Web3Forms delivery end to end.** The integration and validation
      are verified, but no message has been confirmed arriving in the inbox.

### Content
- [ ] Add a fourth project when there is a fourth finished, publicly viewable
      site. Do not pad the grid with half-finished work.
- [ ] Write the case studies in first person with concrete outcomes, and add
      real numbers once they exist
- [ ] Add a graduation year, degree, or any award, only if it is real

### Optional
- [ ] Add a `humans.txt`
- [ ] Consider per-page OG images for the case studies instead of one shared image

## Deliberately not doing

- **No framework or bundler.** The site is five static files; a build step
  would add failure modes for no measurable gain.
- **No analytics or third-party scripts.** Nothing to consent to, nothing to
  slow the page down.
- **No fake loading percentages.** The intro bar is indeterminate by design.
- **No invented metrics, testimonials, or client names.** Every project link
  and claim on the site is verifiable.
- **No light/dark theme toggle.** The palette already uses two ivory sections
  as deliberate punctuation; a full second theme would dilute that.
- **No WhatsApp link until a real number exists.** See above.
