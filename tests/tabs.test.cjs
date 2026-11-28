const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../chrome/core');

function controls(tabs) {
  const ctx = vm.createContext({
    tabs,
    activeId: 'current',
    webURL: core.webURL,
    hostOf: (url) => new URL(url).hostname,
    persistTabs() {},
    drawRail() {},
    modal: '',
  });
  for (const file of ['tab-manager.js', 'omnibox.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../chrome', file), 'utf8'), ctx);
  return ctx;
}
test('closing duplicates protects pinned, current, private and separately grouped copies', () => {
  const shared = { url: 'https://example.org/' };
  const tabs = [
    { ...shared, id: 'earlier' },
    { ...shared, id: 'pinned', pinned: true },
    { ...shared, id: 'current' },
    { ...shared, id: 'private', private: true },
    { ...shared, id: 'research', group: 'Research' },
    { id: 'empty', url: '' },
    { id: 'second-empty', url: '' },
  ];
  const ctx = controls(tabs);
  assert.deepEqual(Array.from(ctx.duplicateTabIds(tabs, 'current')), ['earlier']);
  assert.deepEqual(
    Array.from(ctx.matchingTabs(tabs, 'research', 'grouped'), (t) => t.id),
    ['research'],
  );
});
test('tab movement keeps pinned boundary, updates group and preserves active page', () => {
  const tabs = [{ id: 'p', pinned: true }, { id: 'a' }, { id: 'b', group: 'Work' }];
  const ctx = controls(tabs);
  assert.equal(ctx.moveTabBeforeOrAfter('b', 'p', false, true), false);
  assert.equal(ctx.moveTabBeforeOrAfter('a', 'b', true, true), true);
  assert.deepEqual(
    tabs.map((t) => t.id),
    ['p', 'b', 'a'],
  );
  assert.equal(tabs[2].group, 'Work');
  assert.equal(ctx.activeId, 'current');
});
test('local omnibox matches exclude private and deleted data, deduplicate and prefer a live tab', () => {
  const row = { title: 'A Vaayvu page', url: 'https://example.org/' };
  const tabs = [
    { ...row, id: 'other' },
    { ...row, id: 'private', private: true, url: 'https://private.test/' },
  ];
  const matches = controls(tabs).localAddressChoices(
    'vaayvu',
    tabs,
    [row, { ...row, deleted: true, url: 'https://deleted.test/' }],
    [row, { ...row, url: 'https://history.test/' }],
    'current',
  );
  assert.deepEqual(
    Array.from(matches, (m) => [m.url, m.source]),
    [
      [row.url, 'Switch to tab'],
      ['https://history.test/', 'History'],
    ],
  );
});
test('legacy providers cannot turn search text into an external visit or a synced tab', () => {
  assert.equal(core.destination('snow & ice', 'Custom', 'https://search.example.org/?q=%s'), '');
  const url = 'https://www.google.co.in/search?q=blue+sky';
  assert.equal(core.providerQuery(url), 'blue sky');
  assert.equal(core.providerQuery('https://www.google.com.evil.example/?q=value'), '');
  assert.deepEqual(core.publicTabs([{url, title:'blue sky'}]), []);
});

test('closing the current group selects the preferred surviving neighbor or most recently used tab', () => {
  const items = [
    { id: 'first', lastViewed: 9 },
    { id: 'left', lastViewed: 3 },
    { id: 'close' },
    { id: 'alsoClose' },
    { id: 'right', lastViewed: 7 },
  ];
  const closing = new Set(['close', 'alsoClose']);
  const ctx = controls(items);
  for (const [preference, id] of [
    ['left', 'left'],
    ['right', 'right'],
    ['lastUsed', 'first'],
  ])
    assert.equal(ctx.nextAfterClose(items, 2, closing, preference).id, id);
});
