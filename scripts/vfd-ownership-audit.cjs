'use strict';

// P20 first-party ownership, original-rule and enforcement audit.
// Verifies VFD provenance, forbidden third-party data, protected apexes,
// first-party vs third-party enforcement and private-tab isolation.

const { existsSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const vfd = require('../chrome/vfd.js');
require('../chrome/vfd-rules.js');

const root = resolve(__dirname, '..');
const database = globalThis.VaayvuVFDRules;
const compiled = vfd.load(database);
const failures = [];

if (!database || database.format !== 'VFD/1') failures.push('VFD format is not VFD/1');
if (!database.version) failures.push('VFD version is missing');
if (compiled.rejected.length) failures.push(compiled.rejected.length + ' rules failed validation');
const seen = new Set();
for (const rule of database.rules) {
  if (!/^VFD-[A-Z]+-\d{4}$/.test(rule.id || '')) failures.push('Bad rule id: ' + rule.id);
  if (seen.has(rule.id)) failures.push('Duplicate rule id: ' + rule.id);
  seen.add(rule.id);
  if (!vfd.CATEGORIES.has(rule.category)) failures.push('Bad category: ' + rule.id);
  if (!rule.evidence || !rule.added) failures.push('Missing provenance: ' + rule.id);
  if (!(rule.hosts?.length || rule.selectors?.length || rule.tokens?.length || rule.urlIncludes?.length || rule.firstParty?.length))
    failures.push('Empty rule: ' + rule.id);
}

for (const forbidden of [
  'chrome/adblock.js', 'chrome/ad-hosts.js', 'chrome/ad-rules.js', 'chrome/ad-selectors.css',
  'branding/build-ad-hosts.py', 'branding/build-ad-rules.py',
]) {
  if (existsSync(resolve(root, forbidden))) failures.push('Third-party-derived file still present: ' + forbidden);
}
for (const dir of ['chrome', 'branding', 'docs']) {
  const names = readdirSync(resolve(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name.toLowerCase());
  for (const name of names) {
    if (/easylist|easyprivacy|fanboy|stevenblack|peter-?lowe|someonewhocares|ublock/.test(name))
      failures.push('Third-party list file found: ' + dir + '/' + name);
  }
}

const protectedRun = vfd.load({
  format: 'VFD/1', version: 'audit',
  rules: [{ id: 'VFD-ADS-9000', category: 'ads', hosts: ['youtube.com'], evidence: 'audit', added: '2026-11-28' }],
});
if (!protectedRun.rejected.some((r) => /protected/i.test(r.reason))) failures.push('Protected apex was not rejected');

const base = { enabled: true, lists: { ads: true, trackers: true, social: false, cosmetic: true, aggressive: false } };
const decide = (url, document, extra = {}) =>
  vfd.decide(url, document, { compiled, config: base, strict: new Set(), pausedSites: [], ...extra });
const adUrl = 'https://ads.doubleclick.net/pixel';
if (!decide(adUrl, 'https://news.example.com/')) failures.push('Third-party ad host was not blocked');
const firstPartyUrl = 'https://news.example.com/pagead/ad.js';
if (decide(firstPartyUrl, 'https://news.example.com/article')) failures.push('First-party token was blocked without aggressive mode');
if (!decide(firstPartyUrl, 'https://other.example/')) failures.push('Third-party token was not blocked');
const thirdPartyToken = 'https://other.example/pagead/ad.js';
if (decide(thirdPartyToken, 'https://news.example.com/article', { pausedSites: ['news.example.com'] })) failures.push('Paused site did not relax');
if (!decide(thirdPartyToken, 'https://news.example.com/article', { pausedSites: ['news.example.com'], privateTab: true }))
  failures.push('Private tab did not ignore the paused-site exception');

const stats = {
  rules: database.rules.length,
  rejected: compiled.rejected.length,
  adsHosts: compiled.ads.size,
  trackerHosts: compiled.trackers.size,
  cosmeticSelectors: compiled.selectors.length,
  tokens: compiled.tokens.size,
};
if (failures.length) {
  console.error('Vaayvu first-party audit failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, ...stats }));
