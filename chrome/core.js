'use strict';
// Device storage lives under the Vaayvu prefix only.
function vaayvuStoreGet(suffix, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const value = localStorage.getItem('vaayvu.' + suffix);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
function vaayvuStoreSet(suffix, value) {
  localStorage.setItem('vaayvu.' + suffix, JSON.stringify(value));
}
function vaayvuStoreRemove(suffix) {
  try { localStorage.removeItem('vaayvu.' + suffix); } catch {}
}
function migrateVaayvuStore() {}

const VaayvuCore = (() => {
  function webURL(value) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/.test(value)) return '';
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.href.length <= 8192
        ? url.href
        : '';
    } catch {
      return '';
    }
  }
  // Only explicit website addresses may become navigation URLs. Queries stay in Vaayvu.
  function destination(input) {
    if (typeof input !== 'string') return '';
    const value = input.trim();
    if (!value) return '';
    if (
      /^(localhost|\[[\da-f:]+\]|[\w-]+(?:\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(value) &&
      !/\s/.test(value)
    ) {
      return webURL((/^(localhost|127\.0\.0\.1)([:/?#]|$)/i.test(value) ? 'http://' : 'https://') + value);
    }
    if (/^[a-z][\w+.-]*:/i.test(value)) return webURL(value);
    return '';
  }
  let legacyPattern;
  const marker = 'vaayvulegacysearchtoken';
  function legacyTemplate(value) {
    if (typeof value !== 'string' || value.length > 8192 || value.split('%s').length !== 2 ||
        !value.startsWith('https://') || /[\s\\]/.test(value) || value.includes(marker)) return '';
    const url = webURL(value.replace('%s', marker));
    if (!url || new URL(url).origin.includes(marker) || !url.includes(marker)) return '';
    return value;
  }
  function setLegacyTemplate(value) {
    legacyPattern = legacyTemplate(value) ? new URL(value.replace('%s', marker)) : null;
  }
  function legacyQuery(url) {
    if (!legacyPattern || url.origin !== legacyPattern.origin) return '';
    const capture = (value, pattern) => {
      const at = pattern.indexOf(marker);
      if (at < 0 || !value.startsWith(pattern.slice(0, at)) || !value.endsWith(pattern.slice(at + marker.length))) return '';
      return value.slice(at, value.length - (pattern.length - at - marker.length)).trim();
    };
    if (legacyPattern.pathname === url.pathname) {
      for (const [key, pattern] of legacyPattern.searchParams) {
        const q = capture(url.searchParams.get(key) || '', pattern);
        if (q) return q;
      }
    }
    const raw = capture(url.href, legacyPattern.href);
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  function providerQuery(address) {
    if (!address) return '';
    let url;
    try { url = new URL(address); } catch { return ''; }
    const legacy = legacyQuery(url);
    if (legacy) return legacy;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const google = /^(?:www\.)?google\.(?:com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/.test(host);
    const bing = /^(?:www\.)?bing\.com$/.test(host);
    const duck = /^(?:(?:www|html|lite)\.)?duckduckgo\.com$/.test(host);
    const brave = host === 'search.brave.com';
    const yahoo = /^(?:[a-z]{2}\.)?search\.yahoo\.com$/.test(host);
    if (!(google || bing || duck || brave || yahoo)) return '';
    const keys = yahoo ? ['p'] : ['q'];
    for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
      for (const key of keys) if (params.get(key)?.trim()) return params.get(key).trim();
    }
    return '';
  }
  function serverOrigin(value) {
    const url = webURL(value.trim());
    if (!url) return '';
    const parsed = new URL(url);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname)
      ? parsed.origin
      : '';
  }
  // Campaign and click-ID parameters that identify the user across sites.
  // Stripped from links typed or searched from the address bar.
  const TRACKING_PARAMS =
    /^(?:utm_[a-z0-9_]+|fbclid|gclid|dclid|gclsrc|gbraid|wbraid|msclkid|yclid|igshid|igsh|mc_eid|mc_cid|_hsenc|_hsmi|_openstat|vero_id|vero_conv|wickedid|oly_enc_id|oly_anon_id|s_kwcid|twclid)$/i;
  function stripTrackingParams(url) {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return { url, removed: 0 };
      let removed = 0;
      for (const key of [...parsed.searchParams.keys()]) {
        if (TRACKING_PARAMS.test(key)) {
          parsed.searchParams.delete(key);
          removed += 1;
        }
      }
      return removed ? { url: parsed.href, removed } : { url, removed: 0 };
    } catch {
      return { url, removed: 0 };
    }
  }
  // SQLite's BINARY text order compares UTF-8, which follows Unicode code point order.
  function compareText(left, right) {
    const a = Array.from(String(left || '')),
      b = Array.from(String(right || ''));
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i].codePointAt(0) - b[i].codePointAt(0);
      if (diff) return diff;
    }
    return a.length - b.length;
  }
  function mergeBookmarks(...lists) {
    const byId = new Map();
    for (const list of lists)
      for (const b of list) {
        if (
          !b ||
          typeof b.id !== 'string' ||
          !Number.isSafeInteger(b.updatedAt) ||
          (!b.deleted && !webURL(b.url))
        )
          continue;
        const prev = byId.get(b.id);
        const order =
          prev &&
          (b.updatedAt - prev.updatedAt ||
            Number(!!b.deleted) - Number(!!prev.deleted) ||
            compareText(b.url, prev.url) ||
            compareText(b.title, prev.title));
        if (!prev || order > 0) byId.set(b.id, b);
      }
    return [...byId.values()];
  }
  function publicTabs(tabs) {
    return tabs
      .filter((t) => t && !t.private && webURL(t.url) && !providerQuery(t.url))
      .slice(0, 256)
      .map((t) => ({ title: String(t.title || '').slice(0, 512), url: t.url }));
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }
  return {
    webURL,
    providerQuery,
    legacyTemplate,
    setLegacyTemplate,
    destination,
    stripTrackingParams,
    serverOrigin,
    mergeBookmarks,
    publicTabs,
    escapeHTML,
  };
})();
if (typeof module !== 'undefined') module.exports = VaayvuCore;
