'use strict';
// VaayvuVFD — VAAYVU's original filter compiler (docs/VFD-FORMAT.md).
// Dependency-free so every platform host and test harness can load it.
const VaayvuVFD = (() => {
  const CATEGORIES = new Set(['ads', 'trackers', 'social', 'cosmetic', 'firstparty', 'exception', 'malware']);
  const PROTECTED_APEX = new Set([
    'googlevideo.com', 'youtube.com', 'youtu.be', 'ytimg.com', 'ggpht.com',
    'gstatic.com', 'googleapis.com', 'googleusercontent.com', 'google.com',
    'facebook.com', 'instagram.com', 'amazon.com', 'amazon.in', 'reddit.com',
    'x.com', 'twitter.com', 'linkedin.com', 'pinterest.com', 'tiktok.com',
    'yahoo.com', 'bing.com', 'duckduckgo.com', 'github.com', 'scribd.com',
    'flipkart.com', 'myntra.com', 'meesho.com',
    'adobe.com', 'apple.com', 'microsoft.com', 'wikipedia.org',
  ]);
  const AD_SUBDOMAIN_PREFIX = /^(?:ads|adserver|adservice|adsystem|adbanner|adtrack|pagead\d*|doubleclick)\./;
  const TRACKER_SUBDOMAIN_PREFIX = /^(?:telemetry|metrics|pixel|beacon|analytics|stat|stats|tracker|tracking)\./;
  const HOSTNAME = /^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,}$/;
  const MULTI_PART = new Set([
    'co.uk', 'com.au', 'co.jp', 'co.nz', 'com.br', 'co.in', 'com.mx',
    'co.za', 'com.tr', 'co.kr', 'com.sg', 'com.hk', 'com.tw', 'co.il',
  ]);

  function normalizeHost(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    let host;
    try {
      host = /^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? new URL(raw).hostname : raw;
    } catch { return ''; }
    host = host.replace(/\.$/, '');
    return HOSTNAME.test(host) ? host : '';
  }

  function siteOf(value) {
    const host = normalizeHost(value);
    if (!host) return '';
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const last = parts.slice(-2).join('.');
    return MULTI_PART.has(last) ? parts.slice(-3).join('.') : last;
  }

  // Only a bare apex itself is protected: a rule for ads.youtube.com can
  // only ever match that ad subdomain, never YouTube content. Bare apexes
  // (youtube.com, googlevideo.com, ...) are always rejected.
  function isProtected(host) {
    return PROTECTED_APEX.has(host);
  }

  function validateRule(rule, seenIds) {
    const problems = [];
    if (!rule || typeof rule !== 'object') return ['not an object'];
    if (typeof rule.id !== 'string' || !/^VFD-[A-Z]+-[0-9]+$/.test(rule.id)) problems.push('bad id');
    else if (seenIds.has(rule.id)) problems.push('duplicate id');
    if (!CATEGORIES.has(rule.category)) problems.push('bad category');
    if (typeof rule.evidence !== 'string' || !rule.evidence) problems.push('missing evidence');
    if (typeof rule.added !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.added)) problems.push('bad added date');
    if (rule.verified !== null && (typeof rule.verified !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.verified))) problems.push('bad verified date');
    if (rule.expires != null) {
      if (typeof rule.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.expires)) problems.push('bad expiry');
      else if (rule.expires < new Date().toISOString().slice(0, 10)) problems.push('expired');
    }
    const hosts = Array.isArray(rule.hosts) ? rule.hosts : [];
    const tokens = Array.isArray(rule.urlIncludes) ? rule.urlIncludes : [];
    const selectors = Array.isArray(rule.selectors) ? rule.selectors : [];
    if (rule.category !== 'cosmetic' && rule.category !== 'exception' && hosts.length === 0 && tokens.length === 0) problems.push('no matchers');
    for (const h of hosts) {
      const clean = normalizeHost(h);
      if (!clean) { problems.push('bad host: ' + h); break; }
      if (isProtected(clean)) { problems.push('protected apex: ' + clean); break; }
    }
    for (const t of tokens) {
      if (typeof t !== 'string') { problems.push('bad token'); break; }
      // Short tokens are only safe when path-anchored (slashes make
      // accidental matches very unlikely).
      const minLen = t.includes('/') ? 5 : 6;
      if (t.length < minLen || t.length > 64 || /youtube|googlevideo/i.test(t)) { problems.push('bad token'); break; }
    }
    for (const s of selectors) {
      if (typeof s !== 'string' || !s || s.length > 256 || /:has\(/i.test(s)) { problems.push('bad selector'); break; }
    }
    return problems;
  }

  // Compile the database once. Invalid rules are rejected with reasons;
  // nothing invalid ever reaches the blocking sets.
  function load(db) {
    const out = {
      version: '', ads: new Set(), trackers: new Set(), social: new Set(),
      firstPartyTokens: [], tokens: new Set(), trackerTokens: new Set(),
      selectors: [], exceptions: [], rejected: [],
    };
    if (!db || typeof db !== 'object' || !Array.isArray(db.rules)) {
      out.rejected.push({ id: '(database)', reason: 'unreadable rule database' });
      return out;
    }
    out.version = typeof db.version === 'string' ? db.version : '';
    if (db.format !== 'VFD/1') out.rejected.push({ id: '(database)', reason: 'unsupported format' });
    const seen = new Set();
    for (const rule of db.rules) {
      const problems = validateRule(rule, seen);
      if (rule && typeof rule.id === 'string') seen.add(rule.id);
      if (problems.length) {
        out.rejected.push({ id: (rule && rule.id) || '(unknown)', reason: problems.join('; ') });
        continue;
      }
      const hosts = (rule.hosts || []).map(normalizeHost).filter(Boolean);
      if (rule.category === 'ads') for (const h of hosts) out.ads.add(h);
      else if (rule.category === 'trackers') for (const h of hosts) out.trackers.add(h);
      else if (rule.category === 'social') for (const h of hosts) out.social.add(h);
      else if (rule.category === 'exception') {
        out.exceptions.push({
          hosts, paths: (rule.paths || []).filter(p => typeof p === 'string' && p.length <= 128),
        });
      } else if (rule.category === 'firstparty') {
        for (const t of rule.urlIncludes || []) if (!out.firstPartyTokens.includes(String(t).toLowerCase())) out.firstPartyTokens.push(String(t).toLowerCase());
      }
      if (rule.category === 'ads' || rule.category === 'trackers') {
        const bucket = rule.category === 'ads' ? out.tokens : out.trackerTokens;
        for (const t of rule.urlIncludes || []) {
          const token = String(t).toLowerCase();
          if ((token.length >= 6 || (token.includes('/') && token.length >= 5)) && token.length <= 64) bucket.add(token);
        }
      }
      if (rule.category === 'cosmetic') {
        for (const s of rule.selectors || []) if (!out.selectors.includes(s)) out.selectors.push(s);
      }
    }
    return out;
  }

  function hostInSet(host, set) {
    if (!host || set.size === 0) return false;
    if (set.has(host)) return true;
    let dot = host.indexOf('.');
    while (dot !== -1) {
      if (set.has(host.slice(dot + 1))) return true;
      dot = host.indexOf('.', dot + 1);
    }
    return false;
  }

  function hostInPaused(documentHost, pausedSites) {
    if (!documentHost || !pausedSites) return false;
    const list = Array.isArray(pausedSites) ? pausedSites : [...pausedSites];
    for (const entry of list) {
      const clean = normalizeHost(entry);
      if (clean && (documentHost === clean || documentHost.endsWith('.' + clean))) return true;
    }
    return false;
  }

  function matchesException(url, host, exceptions) {
    for (const ex of exceptions) {
      if (ex.hosts.length && !ex.hosts.some(h => host === h || host.endsWith('.' + h))) continue;
      if (!ex.paths.length) return true;
      if (ex.paths.some(p => url.includes(p))) return true;
    }
    return false;
  }

  function tokenHit(url, tokens) {
    for (const token of tokens) {
      if (token && url.includes(token)) return true;
    }
    return false;
  }

  // Deterministic precedence: strict custom > exceptions > category hosts >
  // URL tokens (first-party tokens only in Aggressive mode + same-site).
  // Returns 'strict' | 'ads' | 'trackers' | 'social' | 'token' |
  // 'tokentracker' | 'firstparty' | ''.
  function decide(urlString, documentString, env) {
    const { compiled, config, strict = new Set(), pausedSites = [], privateTab = false } = env;
    if (!config || config.enabled === false) return '';
    const lists = config.lists || {};
    const adsOn = lists.ads !== false, trackersOn = lists.trackers !== false;
    const socialOn = lists.social === true, aggressive = lists.aggressive === true;
    let url;
    try {
      url = new URL(String(urlString ?? ''));
    } catch {
      return '';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const host = normalizeHost(url.hostname);
    if (!host) return '';
    if (hostInSet(host, strict)) return 'strict';
    const documentHost = normalizeHost(documentString);
    const sameSite = !!documentHost && siteOf(host) === siteOf(documentHost);
    if (!privateTab && hostInPaused(documentHost, pausedSites)) return '';
    if (matchesException(url.href.toLowerCase(), host, compiled.exceptions)) return '';
    const cat = (set) => hostInSet(host, set);
    const lowerUrl = url.href.toLowerCase();
    // Dedicated ad and tracker hosts (never bare content apexes, enforced by
    // validateRule) are blocked even when they share a parent domain with the
    // document (e.g. ads.youtube.com on youtube.com, ads.google.com on google.com)
    // or when an ad iframe initiates a subrequest to its own ad domain.
    if (adsOn && (cat(compiled.ads) || AD_SUBDOMAIN_PREFIX.test(host))) return 'ads';
    if (trackersOn && (cat(compiled.trackers) || (!sameSite && TRACKER_SUBDOMAIN_PREFIX.test(host)))) return 'trackers';
    if (sameSite) {
      if (aggressive && adsOn && tokenHit(lowerUrl, compiled.firstPartyTokens)) return 'firstparty';
      if (aggressive && trackersOn && TRACKER_SUBDOMAIN_PREFIX.test(host)) return 'trackers';
      return '';
    }
    if (socialOn && cat(compiled.social)) return 'social';
    if (adsOn && tokenHit(lowerUrl, compiled.tokens)) return 'token';
    if (trackersOn && tokenHit(lowerUrl, compiled.trackerTokens)) return 'tokentracker';
    return '';
  }

  function shouldBlock(urlString, documentString, env) {
    return decide(urlString, documentString, env) !== '';
  }

  // Flat policy for the native hosts. Small by design: the database is
  // curated, not scraped, so the message stays well under IPC limits.
  function policy(compiled, config, custom) {
    const lists = { ...(config.lists || {}) };
    const norm = (set) => [...set].sort();
    return {
      hostsAds: (lists.ads !== false) ? norm(compiled.ads) : [],
      hostsTrackers: (lists.trackers !== false) ? norm(compiled.trackers) : [],
      hostsSocial: lists.social === true ? norm(compiled.social) : [],
      strict: [...custom],
      patterns: (lists.ads !== false) ? [...compiled.tokens] : [],
      trackerPatterns: (lists.trackers !== false) ? [...compiled.trackerTokens] : [],
      firstPartyPatterns: lists.aggressive === true ? [...compiled.firstPartyTokens] : [],
      selectors: lists.cosmetic === false ? [] : [...compiled.selectors],
      pausedSites: [...(config.pausedSites || [])],
      lists: {
        ads: lists.ads !== false, trackers: lists.trackers !== false,
        social: lists.social === true, cosmetic: lists.cosmetic !== false,
        aggressive: lists.aggressive === true,
      },
      rulesVersion: compiled.version,
      mode: lists.aggressive === true ? 'aggressive' : 'standard',
    };
  }

  return {
    load, policy, decide, shouldBlock, hostInSet, matchesException,
    normalizeHost, siteOf, CATEGORIES,
  };
})();

if (typeof module !== 'undefined') module.exports = VaayvuVFD;
