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

The site is live on GitHub Pages:

- Repository: <https://github.com/Mahesh-Vanga/vaayvu-site>
- Preview: <https://mahesh-vanga.github.io/vaayvu-site/>
- Custom domain configured in Pages: `vaayvu.com` (`CNAME` file included)

Publish changes with:

```sh
bash website/deploy.sh
```

The script clones the site repository to `~/.cache/vaayvu-site`, copies
`website/` over it (keeping `CNAME`, `.nojekyll` and the release-only
`downloads/` folder), commits and pushes. Run `bash website/sync-downloads.sh`
only if you switch back to self-hosted build files.

### DNS at Wix

The domain is still on Wix nameservers, so the last step has to happen in the
Wix dashboard. Open **Domains → vaayvu.com → DNS records** and replace the Wix
records with:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `mahesh-vanga.github.io` |

Remove the old Wix A records (`185.230.63.171`, `.107`, `.186`) and the
`www` CNAME to `cdn3.wixdns.net`. Optional IPv6 AAAA records:
`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
`2606:50c0:8003::153`.

If Wix locks the records because the domain is attached to an unpublished Wix
site, disconnect the domain from that site first. If the DNS editor is not
available, change the domain's nameservers at Wix to Cloudflare (free) and add
the same A/CNAME records there.

After DNS resolves, GitHub provisions the certificate for `vaayvu.com`. Until
it does, use the preview URL above. Do not enable “Enforce HTTPS” in Pages
before the certificate exists.

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
