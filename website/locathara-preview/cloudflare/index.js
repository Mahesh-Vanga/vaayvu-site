export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Force HTTPS
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    // Redirect www to apex
    if (url.hostname === 'www.locathara.com') {
      url.hostname = 'locathara.com';
      return Response.redirect(url.toString(), 301);
    }

    // Handle clean URLs - add .html if missing for known pages
    const knownPages = ['', 'index', 'product', 'technology', 'philosophy', 'company', 'download', 'blog', 'privacy', 'contact'];
    const pathname = url.pathname;
    
    // If path doesn't end with .html and isn't a known asset, try adding .html
    if (!pathname.endsWith('.html') && 
        !pathname.includes('.') && 
        pathname !== '/' &&
        !pathname.startsWith('/assets/')) {
      const pageName = pathname.replace(/^\//, '').replace(/\/$/, '');
      if (knownPages.includes(pageName)) {
        url.pathname = '/' + pageName + '.html';
      }
    }

    // Root path -> index.html
    if (url.pathname === '/') {
      url.pathname = '/index.html';
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    // Security headers
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
    );

    // Cache static assets
    if (url.pathname.match(/\.(css|js|woff2?|svg|png|jpg|jpeg|webp|ico)$/)) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};