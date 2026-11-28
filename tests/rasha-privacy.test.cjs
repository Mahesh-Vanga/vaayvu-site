'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const vfd = require('../chrome/vfd.js');
require('../chrome/vfd-rules.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the first-party ownership audit passes with original rules only', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/vfd-ownership-audit.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.passed, true);
  assert.equal(result.rules, 47);
  assert.equal(result.rejected, 0);
  const db = globalThis.VaayvuVFDRules;
  assert.equal(db.format, 'VFD/1');
  assert.equal(new Set(db.rules.map((rule) => rule.id)).size, db.rules.length);
  for (const rule of db.rules) {
    assert.ok(rule.evidence && rule.added, rule.id + ' provenance');
    assert.ok(['ads', 'trackers', 'social', 'firstparty', 'cosmetic', 'exception', 'malware'].includes(rule.category));
  }
  assert.match(read('.github/workflows/build.yml'), /vfd-ownership-audit\.cjs/);
});

test('protected apexes and private paused-site behavior are enforced', () => {
  const protectedRun = vfd.load({
    format: 'VFD/1', version: 'test',
    rules: [{ id: 'VFD-ADS-9001', category: 'ads', hosts: ['youtube.com'], evidence: 'test', added: '2026-11-28' }],
  });
  assert.ok(protectedRun.rejected.some((rule) => /protected/i.test(rule.reason)));

  const compiled = globalThis.__vfd || vfd.load(globalThis.VaayvuVFDRules);
  const config = { enabled: true, lists: { ads: true, trackers: true, social: false, cosmetic: true, aggressive: false } };
  const decide = (url, document, extra = {}) => vfd.decide(url, document, { compiled, config, strict: new Set(), pausedSites: [], ...extra });
  assert.equal(decide('https://other.example/pagead/ad.js', 'https://news.example.com/'), 'token');
  assert.equal(decide('https://news.example.com/pagead/ad.js', 'https://news.example.com/article'), '');
  assert.equal(decide('https://other.example/pagead/ad.js', 'https://news.example.com/', { pausedSites: ['news.example.com'] }), '');
  assert.equal(
    decide('https://other.example/pagead/ad.js', 'https://news.example.com/', { pausedSites: ['news.example.com'], privateTab: true }),
    'token',
  );
});

test('the ownership audit and isolation limits are documented', () => {
  const doc = read('docs/RAASHA-PRIVACY.md');
  assert.match(doc, /original VAAYVU work/);
  assert.match(doc, /not a live\s+fingerprinting or hostile-site lab/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P20,Rasha and advanced privacy/);
});
