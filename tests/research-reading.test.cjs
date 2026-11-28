'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const collections = require('../chrome/collections.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('a local-first collection saves, searches, exports and deduplicates', () => {
  const storage = memoryStorage();
  let state = collections.defaultState();
  assert.equal(state.collections[0].name, 'Research');
  const created = collections.createCollection(state, 'Climate notes');
  state = created.state;
  assert.equal(collections.save(state, storage), true);
  const collectionId = created.collection.id;
  const added = collections.addSource(state, collectionId, {
    url: 'https://example.org/report',
    title: 'Climate report',
    note: 'Read the appendix',
    tags: ['climate', 'report'],
  });
  assert.ok(added.source);
  state = added.state;
  assert.equal(collections.addSource(state, collectionId, { url: 'https://example.org/report' }).reason, 'duplicate');
  assert.equal(collections.addSource(state, collectionId, { url: 'javascript:alert(1)' }).reason, 'url');
  assert.equal(collections.search(state, 'appendix').length, 1);
  assert.equal(collections.search(state, 'climate').length, 1);
  assert.match(collections.exportJSON(state), /Climate report/);
  assert.match(collections.exportMarkdown(state), /\[Climate report\]\(https:\/\/example.org\/report\)/);
  const removed = collections.removeSource(state, collectionId, added.source.id);
  assert.equal(removed.removed.id, added.source.id);
  assert.equal(collections.search(removed.state, 'appendix').length, 0);
  const reloaded = collections.load(storage);
  assert.equal(reloaded.collections.length, 2);
});

test('the focus timer persists its deadline across reload', () => {
  const source = read('chrome/observatory.js');
  assert.match(source, /focusKey = 'vaayvu\.focusUntil'/);
  assert.match(source, /storedFocus > Date\.now\(\)/);
  assert.match(source, /saveFocusDeadline\(focusUntil\)/);
  assert.match(read('tests/observatory-ui.cjs'), /focus deadline survives reload/);
});

test('reader, offline and the feed gap are documented honestly', () => {
  const doc = read('docs/RESEARCH-READING.md');
  assert.match(doc, /not yet wired to a shipping research screen/);
  assert.match(doc, /no shipping feed engine/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P24,"Research, reading, feeds and Focus"/);
});
