export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === 'www.vaayvu.com') {
      url.hostname = 'vaayvu.com';
      return Response.redirect(url.toString(), 301);
    }
    let response = await env.ASSETS.fetch(request);
    const isVideo = /\.(?:webm|mp4)$/i.test(url.pathname);
    if (isVideo && request.method === 'GET' && response.ok) {
      const range = request.headers.get('Range');
      const match = range && /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (match && (match[1] || match[2])) {
        const full = await response.arrayBuffer();
        const size = full.byteLength;
        const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
        const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (start > end || start >= size) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': 'bytes */' + size, 'Accept-Ranges': 'bytes' },
          });
        }
        const body = full.slice(start, end + 1);
        response = new Response(body, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Length': String(body.byteLength),
            'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=3600',
          },
        });
      }
    }
    const headers = new Headers(response.headers);
    if ((headers.get('Content-Type') || '').includes('text/html')) {
      // Keep Cloudflare from injecting the Web Analytics beacon or rewriting
      // the page. The site measures its own page and sets no cookies.
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate, no-transform');
    }
    if (isVideo) headers.set('Accept-Ranges', 'bytes');
    headers.set('Strict-Transport-Security', 'max-age=31536000');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
    );
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
