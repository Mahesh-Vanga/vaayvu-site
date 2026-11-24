# vaayvu.com

Static landing page for Vaayvu. No build step, no framework, no third-party
scripts, no analytics and no cookies set by the page. The page uses the
browser's own HTML, one stylesheet, one script, two self-hosted fonts, local
screenshots and one locally recorded film.

## Preview

From the project root:

```sh
python3 -m http.server 4173 -d website
```

Open <http://localhost:4173>. The page deliberately skips the download
availability check on `localhost` and `file:`, so the preview stays complete.

## Deployment

Live at **https://vaayvu.com**, served by the Cloudflare Worker
`vaayvu-secure`:

- static assets are uploaded from this folder
- Worker routes cover `vaayvu.com/*` and `www.vaayvu.com/*`
- the Worker redirects HTTP to HTTPS, sends `www` to the apex, and adds HSTS,
  CSP, `nosniff`, frame, referrer and permissions headers
- the DNS zone is on Cloudflare (`aaden`/`irma` nameservers); the old Wix and
  GitHub Pages setup is retired

Publish changes with:

```sh
bash website/deploy-cloudflare.sh
```

It copies `website/` into `website/cloudflare/public` and runs
`wrangler deploy` against the `vaayvu-secure` Worker. The Cloudflare login is
stored by Wrangler; the source never needs to be public.

This folder is the live source. `bash website/deploy.sh` mirrors it to the
public `vaayvu-site` repository on GitHub; that repository is an archive, not
the deployment target. The Worker assets are what visitors receive.

### `www` record

`www.vaayvu.com` needs one DNS record in Cloudflare, because its old Pages
CNAME no longer has a certificate:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `www` | `vaayvu.com` | Proxied |

Once that record is saved, the edge Worker sends `www` to `vaayvu.com` with the
valid apex certificate. Until then, use `https://vaayvu.com`.

### Media

The three browser screenshots and the film are captured from the running
build, not drawn or composited:

| File | Use |
|---|---|
| `assets/browser-current.webp` | Hero start page, film poster |
| `assets/browser-spaces.webp` | Hero Spaces tab |
| `assets/browser-appearance.webp` | Hero Appearance tab |
| `assets/vaayvu-film.webm` | 14-second film, VP9, 640 KB |
| `assets/vaayvu-film.mp4` | 14-second film, H.264 fallback, 832 KB |

The film is recorded at 1440 × 900 with Playwright driving the Electron build.
The page loads it only when the film section enters the viewport, pauses it
off-screen, and never autoplays it under `prefers-reduced-motion`.

### Installers

The four installers are public assets on the `v0.0.23` GitHub release in the
public `vaayvu-site` repository, and the site links directly to them. R2 is
optional for a future release if you prefer to keep installers on Cloudflare;
if you use it, run `bash website/sync-downloads.sh` and point the buttons at the
R2 public URLs.

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
