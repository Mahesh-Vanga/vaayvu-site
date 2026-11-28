'use strict';

const UI_ORIGIN = 'vaayvu://browser';
const HOME = UI_ORIGIN + '/index.html';

function website(value) {
  if (typeof value !== 'string' || !value || value.length > 8192 || /[\x00-\x20\\]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (
      !['https:', 'http:'].includes(u.protocol) ||
      !u.hostname ||
      u.username ||
      u.password ||
      u.hostname === 'appassets.androidplatform.net'
    )
      return null;
    return u;
  } catch {
    return null;
  }
}

function syncDestination(value) {
  const site = website(value);
  return !!site && (site.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname));
}

function isInspectorFrontend(contentsId, lookup) {
  // DevTools workers and requests in flight during teardown can have no owning contents.
  if (!Number.isInteger(contentsId) || contentsId <= 0 || contentsId > 0x7fffffff) return false;
  const contents = lookup(contentsId);
  return !!contents && !contents.isDestroyed() && contents.getType() === 'remote';
}

function domains(entries, limit) {
  if (!Array.isArray(entries)) return new Set();
  const accepted = entries
    .slice(0, limit)
    .filter(
      (x) =>
        typeof x === 'string' &&
        x.length <= 253 &&
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x),
    );
  return new Set(accepted);
}

function blockedHost(host, rules) {
  let name = host.toLowerCase().replace(/\.$/, '');
  while (name.includes('.')) {
    if (rules.has(name)) return true;
    name = name.slice(name.indexOf('.') + 1);
  }
  return false;
}

const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'com.au', 'co.jp', 'co.nz', 'com.br', 'co.in', 'com.mx',
  'co.za', 'com.tr', 'co.kr', 'com.sg', 'com.hk', 'com.tw', 'co.il',
]);
const AD_SUBDOMAIN_PREFIX = /^(?:ads|adserver|adservice|adsystem|adbanner|adtrack|pagead\d*|doubleclick)\./;
const TRACKER_SUBDOMAIN_PREFIX = /^(?:telemetry|metrics|pixel|beacon|analytics|stat|stats|tracker|tracking)\./;

function extractHost(value) {
  let host = String(value ?? '').trim().toLowerCase();
  if (!host) return '';
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(host)) host = new URL(host).hostname;
  } catch {
    return '';
  }
  return String(host).toLowerCase().replace(/\.$/, '');
}

// Registrable domain of a hostname or URL ("news.bbc.co.uk" -> "bbc.co.uk").
// Used to tell first-party requests from third-party ones.
function siteOf(value) {
  const host = extractHost(value);
  if (!host) return '';
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last = parts.slice(-2).join('.');
  return MULTI_PART_SUFFIXES.has(last) ? parts.slice(-3).join('.') : last;
}

// VAAYVU filter decision on flat, UI-compiled rule sets. Mirrors the
// precedence in chrome/vfd.js decide() so every native host blocks
// identically: strict custom rules, exceptions, category hosts, URL tokens
// (first-party tokens only in Aggressive mode + same-site), else allow.
// `env` carries: ads, trackers, social (Sets), patterns, trackerPatterns,
// firstParty (arrays), exceptions ([{hosts, paths}]), strict (Set),
// paused (Set of document hosts), lists ({ads,trackers,social,aggressive}),
// enabled, privateTab.
function vfdMatch(urlString, documentString, env) {
  const lists = env.lists || {};
  if (env.enabled === false) return '';
  const adsOn = lists.ads !== false, trackersOn = lists.trackers !== false;
  const socialOn = lists.social === true, aggressive = lists.aggressive === true;
  const set = (s) => (s instanceof Set ? s : new Set(Array.isArray(s) ? s : []));
  let url;
  try {
    url = new URL(String(urlString ?? ''));
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  const host = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return '';
  if (blockedHost(host, set(env.strict))) return 'strict';
  const documentHost = extractHost(documentString);
  const sameSite = !!documentHost && siteOf(host) === siteOf(documentHost);
  if (!env.privateTab && documentHost && env.paused && blockedHost(documentHost, set(env.paused))) return '';
  for (const ex of env.exceptions || []) {
    const hosts = ex.hosts || [];
    if (hosts.length && !hosts.some((h) => host === h || host.endsWith('.' + h))) continue;
    const paths = ex.paths || [];
    if (!paths.length || paths.some((p) => url.href.toLowerCase().includes(String(p).toLowerCase()))) return '';
  }
  const lower = url.href.toLowerCase();
  const tokenHit = (tokens) => (tokens || []).some((t) => typeof t === 'string' && t && lower.includes(t.toLowerCase()));
  if (adsOn && (blockedHost(host, set(env.ads)) || AD_SUBDOMAIN_PREFIX.test(host))) return 'ads';
  if (trackersOn && (blockedHost(host, set(env.trackers)) || (!sameSite && TRACKER_SUBDOMAIN_PREFIX.test(host)))) return 'trackers';
  if (sameSite) {
    if (aggressive && adsOn && tokenHit(env.firstParty)) return 'firstparty';
    if (aggressive && trackersOn && TRACKER_SUBDOMAIN_PREFIX.test(host)) return 'trackers';
    return '';
  }
  if (socialOn && blockedHost(host, set(env.social))) return 'social';
  if (adsOn && tokenHit(env.patterns)) return 'token';
  if (trackersOn && tokenHit(env.trackerPatterns)) return 'tokentracker';
  return '';
}

function bounds(rect, width, height) {
  if (!rect || !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(rect[k]))) return null;
  const x = Math.max(0, Math.min(width, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height, Math.round(rect.y)));
  const w = Math.min(width - x, Math.round(rect.width)),
    h = Math.min(height - y, Math.round(rect.height));
  return w > 0 && h > 0 ? { x, y, width: w, height: h } : null;
}

module.exports = { UI_ORIGIN, HOME, website, syncDestination, domains, blockedHost, bounds, isInspectorFrontend, siteOf, vfdMatch };
