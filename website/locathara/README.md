# Locathara Website

Professional marketing site for **Locathara** — the parent company of Vaayvu Browser.

## Structure

```
website/locathara/
├── index.html           # Main HTML page
├── styles.css           # All styles (self-contained, no build step)
├── site.js              # Client-side interactions
├── deploy-cloudflare.sh # Deployment script
├── cloudflare/
│   ├── wrangler.jsonc   # Cloudflare Worker config
│   ├── index.js         # Worker with security headers & redirects
│   └── public/          # Auto-populated by deploy script
└── assets/
    ├── fonts/           # Fraunces + IBM Plex Sans (WOFF2)
    └── images/
        ├── locathara-icon.svg      # Favicon / brand mark
        ├── locathara-180.png       # Apple touch icon (generate from SVG)
        └── og.jpg                  # Open Graph image (1200×630, generate from SVG)
```

## Local Development

```bash
cd website/locathara
npx serve .
# or
python3 -m http.server 8000
```

Open http://localhost:8000

## Deploy to Cloudflare Workers

### Prerequisites
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler` (or use `npx` as in deploy script)
- Authenticated: `wrangler login`

### One-time setup
1. Create the Worker in Cloudflare dashboard or run deploy once
2. Note the Worker subdomain: `locathara-secure.<your-account>.workers.dev`
3. Add custom domain `locathara.com` in Cloudflare Workers → Triggers → Custom Domains

### Deploy
```bash
cd website/locathara
./deploy-cloudflare.sh
```

## Wix Domain Configuration

Since your domain `locathara.com` is registered at **Wix** and not yet assigned:

### Option A: Point Wix DNS to Cloudflare (Recommended)
1. In Wix Dashboard → Domains → Manage → DNS Records
2. **Delete** any existing A/CNAME records for `@` and `www`
3. Add two **CNAME** records:
   ```
   Type: CNAME   Host: @    Value: locathara-secure.<your-subdomain>.workers.dev
   Type: CNAME   Host: www  Value: locathara-secure.<your-subdomain>.workers.dev
   ```
4. In Cloudflare Workers → Custom Domains → Add `locathara.com` and `www.locathara.com`
5. Enable **Always Use HTTPS** in Cloudflare SSL/TLS → Edge Certificates

### Option B: Move Nameservers to Cloudflare (Full Control)
1. In Cloudflare Dashboard → Add Site → `locathara.com`
2. Copy the two Cloudflare nameservers (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
3. In Wix Dashboard → Domains → Manage → Name Servers → Change to Cloudflare's
4. Wait for propagation (up to 24h)
5. In Cloudflare → DNS → Add CNAME records pointing to your Worker
6. Add custom domains in Workers → Triggers

### Option C: Cloudflare for SaaS / Custom Hostnames (Advanced)
If you want `locathara.com` to resolve without CNAME flattening, use Cloudflare for SaaS with a Custom Hostname.

## Assets to Generate

Before deploying to production, generate raster images from the SVG sources:

### Apple Touch Icon (180×180 PNG)
```bash
# Using ImageMagick
magick assets/images/locathara-icon.svg -resize 180x180 assets/images/locathara-180.png

# Or using macOS sips
sips -s format png -z 180 180 assets/images/locathara-icon.svg --out assets/images/locathara-180.png
```

### Open Graph Image (1200×630 JPG)
```bash
# Using ImageMagick
magick assets/images/og.jpg -resize 1200x630 -quality 90 assets/images/og.jpg

# Or convert the SVG to JPG first, then resize
```

## Features

- **Zero build step** — pure HTML/CSS/JS, deploys as static assets via Cloudflare Workers
- **Security headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **HTTPS enforcement** — Worker redirects HTTP → HTTPS
- **www → apex redirect** — Canonical domain handling
- **Responsive** — Mobile-first, works down to 320px
- **Accessible** — Semantic HTML, ARIA, focus management, reduced motion
- **Performance** — Font preloading, cache headers, minimal JS (~3KB gzipped)
- **Professional design** — Deep-space navy theme, gradient accents, staggered reveals

## Customization

- **Colors**: Edit CSS custom properties in `styles.css` (`:root`)
- **Content**: Modify `index.html` sections
- **Analytics**: Add Plausible/Umami script in `<head>` (no GA)
- **Newsletter**: Update form action in `index.html` to your Buttondown/ConvertKit endpoint

## License

MIT — same as Vaayvu. See root `LICENSE.txt`.