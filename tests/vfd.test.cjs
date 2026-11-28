'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const VaayvuVFD = require('../chrome/vfd.js');
require('../chrome/vfd-rules.js');

const base = {
  enabled: true,
  lists: { ads: true, trackers: true, social: false, cosmetic: true, aggressive: false },
  pausedSites: [],
};
const env = (over = {}) => ({
  compiled: globalThis.__vfd,
  config: { ...base, ...(over.config || {}) },
  strict: over.strict || new Set(),
  pausedSites: over.pausedSites || [],
  privateTab: !!over.privateTab,
});

test('rule validation rejects malformed rules with reasons', () => {
  const seen = new Set();
  const { load } = VaayvuVFD;
  const bad = load({ format: 'VFD/1', version: 'x', rules: [
    { id: 'nope', category: 'ads', hosts: ['a.com'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-ADS-9001', category: 'nope', hosts: ['a.com'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-ADS-9002', category: 'ads', hosts: ['not a host'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-ADS-9003', category: 'ads', hosts: ['youtube.com'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-ADS-9004', category: 'ads', urlIncludes: ['x'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-COS-9005', category: 'cosmetic', selectors: ['div:has(span)'], evidence: 'e', added: '2026-11-24' },
    { id: 'VFD-ADS-9006', category: 'ads', hosts: ['a.com'], evidence: '', added: '2026-11-24' },
    { id: 'VFD-ADS-9007', category: 'ads', hosts: ['a.com'], evidence: 'e', added: '2026-11-24', expires: '2000-01-01' },
  ]});
  assert.equal(bad.ads.size, 0);
  assert.equal(bad.rejected.length, 8);
  assert.ok(bad.rejected.every(r => r.reason));
});

test('shipped database compiles with version and broad coverage', () => {
  const compiled = VaayvuVFD.load(globalThis.VaayvuVFDRules);
  globalThis.__vfd = compiled;
  assert.ok(compiled.ads.size > 300, 'ads hosts: ' + compiled.ads.size);
  assert.ok(compiled.trackers.size > 150, 'tracker hosts: ' + compiled.trackers.size);
  assert.ok(compiled.tokens.size > 60, 'tokens: ' + compiled.tokens.size);
  assert.ok(compiled.selectors.length > 90, 'selectors: ' + compiled.selectors.length);
  assert.equal(compiled.version, '2026-11-24.3');
  assert.equal(compiled.rejected.length, 0);
  const policy = VaayvuVFD.policy(compiled, base, new Set(['custom.example']));
  assert.ok(policy.hostsAds.length > 300 && policy.hostsTrackers.length > 150, 'hosts per category');
  assert.deepEqual(policy.strict, ['custom.example']);
  assert.ok(policy.patterns.length > 60 && policy.trackerPatterns.length > 15);
  const aggroPolicy = VaayvuVFD.policy(compiled, { ...base, lists: { ...base.lists, aggressive: true } }, new Set());
  assert.ok(aggroPolicy.firstPartyPatterns.length >= 25);
  assert.ok(policy.selectors.length > 90);
  assert.equal(policy.mode, 'standard');
  assert.equal(policy.rulesVersion, '2026-11-24.3');
});

test('precedence: strict beats everything, exceptions beat category blocks', () => {
  const strict = new Set(['evil.example']);
  assert.equal(VaayvuVFD.decide('https://evil.example/x.js', 'https://evil.example/', { ...env(), strict }), 'strict');
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://news.example/', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://google-analytics.com/x', 'https://news.example/', env()), 'trackers');
  assert.equal(VaayvuVFD.decide('https://cdn.taboola.com/lib/x.js', 'https://news.example/', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://prebid.adsrvr.org/x', 'https://news.example/', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://cdn.matomo.cloud/tracker.js', 'https://news.example/', env()), 'trackers');
  // Same-site dedicated ad/tracker subdomains are blocked even on their parent site.
  assert.equal(VaayvuVFD.decide('https://ads.youtube.com/x', 'https://www.youtube.com/watch', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://ads.google.com/x', 'https://www.google.com/search', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://adservice.google.com/x', 'https://www.google.com/search', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://ads.news.example/banner.js', 'https://www.news.example/', env()), 'ads');
  assert.equal(VaayvuVFD.decide('https://imasdk.googleapis.com/x', 'https://www.youtube.com/watch', env()), 'token');
  assert.equal(VaayvuVFD.decide('https://news.example/ads/team', 'https://news.example/', env()), '');
  assert.equal(VaayvuVFD.decide('https://www.youtube.com/api/stats/ads?v=1', 'https://www.youtube.com/watch', env()), '');
  assert.equal(VaayvuVFD.decide('https://images.news.example/logo.png', 'https://news.example/', env()), '');
  assert.equal(VaayvuVFD.decide('https://cdn.example/app.js', 'https://news.example/', env()), '');
});

test('paused sites fall back to strict-only, private tabs ignore pauses', () => {
  const paused = ['news.example'];
  const strict = new Set(['evil.example']);
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://news.example/', env({ pausedSites: paused })), '');
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://www.news.example/article', env({ pausedSites: paused })), '');
  assert.equal(VaayvuVFD.decide('https://evil.example/x', 'https://news.example/', env({ pausedSites: paused, strict })), 'strict');
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://news.example/', env({ pausedSites: paused, privateTab: true })), 'ads');
});

test('categories and modes gate the engine', () => {
  const noAds = { config: { ...base, lists: { ...base.lists, ads: false } } };
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://news.example/', env(noAds)), '');
  assert.equal(VaayvuVFD.decide('https://google-analytics.com/x', 'https://news.example/', env(noAds)), 'trackers');
  const off = { config: { ...base, enabled: false } };
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', 'https://news.example/', env(off)), '');
  const aggro = { config: { ...base, lists: { ...base.lists, aggressive: true } } };
  assert.equal(VaayvuVFD.decide('https://news.example/pagead/x.js', 'https://news.example/', env(aggro)), 'firstparty');
  assert.equal(VaayvuVFD.decide('https://news.example/pagead/x.js', 'https://news.example/', env()), '');
  const social = { config: { ...base, lists: { ...base.lists, social: true } } };
  assert.equal(VaayvuVFD.decide('https://connect.facebook.net/x', 'https://news.example/', env(social)), 'social');
  assert.equal(VaayvuVFD.decide('https://connect.facebook.net/x', 'https://news.example/', env()), '');
});

test('ad and tracker token sets are gated independently', () => {
  const t = (u, d, lists) => VaayvuVFD.decide(u, d, env({ config: { ...base, lists: { ...base.lists, ...lists } } }));
  const doc = 'https://news.example/';
  assert.equal(t('https://x.example/pagead/x.js', doc, { ads: true, trackers: false }), 'token');
  assert.equal(t('https://x.example/pagead/x.js', doc, { ads: false, trackers: true }), '');
  assert.equal(t('https://x.example/collect?x=1', doc, { ads: false, trackers: true }), 'tokentracker');
  assert.equal(t('https://x.example/collect?x=1', doc, { ads: true, trackers: false }), '');
});

test('paused sites accept arrays and Sets from any native host', () => {
  const doc = 'https://news.example/';
  const withSet = { ...base, pausedSites: new Set(['news.example']) };
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', doc, { ...env(), pausedSites: new Set(['news.example']) }), '');
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', doc, env({ pausedSites: ['news.example'] })), '');
  assert.equal(VaayvuVFD.decide('https://ad.doubleclick.net/x', doc, { ...env(), pausedSites: new Set() }), 'ads');
});
