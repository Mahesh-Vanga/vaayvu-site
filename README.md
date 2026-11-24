# vaayvu.com

Static landing page for Vaayvu. No build step, no framework, no third-party
scripts. The page uses the browser's own HTML, one stylesheet, one script, two
self-hosted fonts and four local images.

## Preview

From the project root:

```sh
python3 -m http.server 4173 -d website
```

Open <http://localhost:4173>. The page deliberately skips the download
availability check on `localhost` and `file:`, so the preview stays complete.

## Deploying to vaayvu.com (domain bought at Wix)

The domain and the site can live in different places. Two paths:

1. **Host the folder, point the domain at it.** Upload the `website/` folder to
   Cloudflare Pages, Netlify or GitHub Pages. In the Wix dashboard open
   **Domains → vaayvu.com → Connect to an existing site** (Wix wording changes
   from time to time) and follow the DNS records Wix shows for that provider.
   Usually that is an `A`/`AAAA` pair for the apex and a `CNAME` for `www`.
2. **Keep Wix hosting.** Wix does not serve arbitrary static folders from its
   editor. Either rebuild the page in Wix (not recommended; it loses this code)
   or use path 1 and leave the Wix editor unused.

Before pointing DNS, confirm the host gives you HTTPS for both `vaayvu.com`
and `www.vaayvu.com`, and pick one canonical host (the page uses
`https://vaayvu.com/` as canonical).

## Downloads

On vaayvu.com the download buttons point at the GitHub release assets in
`Mahesh-Vanga/vaayvu-site` (tag `v0.0.23`), because GitHub Pages cannot serve
files above 100 MB. The page skips its availability check for those external
URLs.

For a self-hosted copy, `downloads/<artifact>` is still supported: change the
four hrefs back to the relative paths and the page will `HEAD`-check each file,
showing “Not uploaded yet” instead of a dead link. On `localhost` that check is
skipped.

Copy the current release into the folder (it stays out of git):

```sh
bash website/sync-downloads.sh 0.0.23
```

That copies the four published artifacts (macOS DMG/PKG, Windows ZIP, Android APK) from `tests/test/0.0.23/`, writes
`downloads/SHA256SUMS.txt`, and leaves the page's hard-coded checksums as the
source of truth for what is displayed. When you ship a new build, update:

- `softwareVersion` in `index.html`'s JSON-LD
- the version line in the hero and download section
- the artifact file names, sizes and SHA-256 values in the four download cards
- the `--version` argument above

## Design

The page is built around the browser's own Observatory start page: a warm paper
surface, ink type, one sea-blue accent, and the harbor photograph as the single
rich moment. Fraunces carries the large headings; IBM Plex Sans carries the
interface and body. Both fonts and all images are local.

The signature is the small wind contour ahead of each section label and the
live local clock inside the browser preview. Motion is limited to a short reveal
and the state changes that explain something (tabs, shield, spaces); reduced
motion turns it off.

## Editing rules

- Keep claims checkable. The page should not invent user counts, speed claims or
  protection percentages. If a number is shown, it is a version, a file size or a
  checksum.
- The current build has no telemetry backend, no scripted extension runtime and
  no Vaayvu cloud; copy says so.
- Network requests: none at runtime. Fonts, images and scripts are local.
- Accessibility: keep the skip link, landmarks, visible focus styles, the
  `aria-*` state on tabs, switches and the nav, and `prefers-reduced-motion`
  behavior when editing. Lighthouse currently reports 100 for accessibility,
  best practices and SEO.
- Cache: bump the `?v=` query on `styles.css` and `site.js` in `index.html`
  when either file changes, so a host with heuristic caching serves the new
  version.

## Files

```text
website/
  index.html            the page
  styles.css            design system + layout
  site.js               clock, preview tabs, shield demo, spaces, menus, checks
  assets/               logo, wallpaper images, self-hosted fonts
  downloads/            release artifacts (git-ignored)
  LICENSE.txt           MIT license for Vaayvu's own code
  sync-downloads.sh     copies the published release into downloads/
```

The page is the presentation layer only. The browser source, sync service and
native hosts live in the parent project.
