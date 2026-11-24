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

The private GitHub repository `vaayvu-site` is no longer the live source. Do
not use it to publish the site; keep it only as an archive if you want.

### `www` record

`www.vaayvu.com` needs one DNS record in Cloudflare, because its old Pages
CNAME no longer has a certificate:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `www` | `vaayvu.com` | Proxied |

Once that record is saved, the edge Worker sends `www` to `vaayvu.com` with the
valid apex certificate. Until then, use `https://vaayvu.com`.

### Installers

The installer files are not hosted with the website. The GitHub release links
are private and must not be used. Enable **R2** in the Cloudflare dashboard,
then run `bash website/sync-downloads.sh` and point the four download buttons at
the R2 public URLs (or a `downloads.vaayvu.com` custom domain).

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
