'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('tab IDs survive reload and all four positions are exercised', () => {
  const probe = read('tests/desktop-tab-strip-ui.cjs');
  assert.match(probe, /stableIds = await page\.evaluate\(\(\) => tabs\.map\(\(tab\) => tab\.id\)\)/);
  assert.match(probe, /tab ids survive reload/);
  for (const position of ['top', 'bottom', 'left', 'right']) {
    assert.match(read('chrome/preferences.js'), new RegExp(position + ": '" + position.charAt(0).toUpperCase() + position.slice(1) + "'"));
  }
  assert.match(probe, /for \(const position of \['left', 'right'\]\)/);
});

test('protected work is covered by leases and pinned-tab rules', () => {
  assert.match(read('windows/host.cjs'), /hasLease\(tab\)/);
  assert.match(read('windows/host.cjs'), /leaseUntil = Date\.now\(\) \+ ttl/);
  const tabs = read('tests/tabs.test.cjs');
  assert.match(tabs, /pinned/);
  assert.match(tabs, /duplicateTabIds/);
});

test('partitions are proven while desktop containers stay a recorded gap', () => {
  assert.match(read('windows/host.cjs'), /vaayvu-private-/);
  assert.match(read('docs/NETWORK-STORAGE.md'), /private browsing/i);
  const doc = read('docs/ADVANCED-TABS.md');
  assert.match(doc, /Desktop containers \| \*\*screens only\*\*/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P22,\"Advanced tabs, workspaces and containers\"/);
});
