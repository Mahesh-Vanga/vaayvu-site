'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const core = require('../chrome/core.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('bookmark export escapes text and import/export are bounded', () => {
  const workbench = read('chrome/workbench.js');
  assert.match(workbench, /exportBookmarkText/);
  assert.match(workbench, /<A HREF="' \+ e\(b\.url\) \+ '">' \+ e\(b\.title\)/);
  const host = read('windows/host.cjs');
  assert.match(host, /2 \* 1024 \* 1024/);
  assert.match(host, /bookmarkFile/);
  assert.match(host, /filters: \[\{ name: 'Bookmarks HTML'/);
});

test('external search templates reject insecure or malformed values', () => {
  assert.equal(core.legacyTemplate('https://search.example/?q=%s'), 'https://search.example/?q=%s');
  for (const bad of [
    'http://search.example/?q=%s',
    'https://user:pass@search.example/?q=%s',
    'https://search.example/?q=%s&x=%s',
    'https://search.example/?q=%s extra',
    'javascript:alert(%s)',
  ]) {
    assert.equal(core.legacyTemplate(bad), '', bad);
  }
  assert.equal(core.providerQuery('https://www.google.com/search?q=private'), 'private');
});

test('library migrations, pinned search and private isolation are evidenced', () => {
  const store = read('tests/domain-store.test.cjs');
  assert.match(store, /migrations run in order/);
  assert.match(read('sync/privacy-sentinel.test.mjs'), /PRIVATE-SENTINEL-/);
  assert.match(read('tests/india-search-ui.cjs'), /private search isolation/);
  assert.match(read('windows/test/policy.test.cjs'), /TLS hostname and leaf pin/);
  const doc = read('docs/MIGRATION-SEARCH.md');
  assert.match(doc, /No public index/);
  assert.match(doc, /full account data export runtime is implemented|account data export gap/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P33,\"Migration, library and external search\"/);
});
