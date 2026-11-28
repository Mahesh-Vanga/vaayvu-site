'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const spaces = require('../chrome/spaces.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('a spaces journey creates switches partitions and persists', () => {
  const storage = memoryStorage();
  const base = spaces.defaultState();
  const created = spaces.create(base, { name: 'Work', emoji: '💼', theme: 'ocean' });
  assert.equal(created.state.list.length, 2);
  spaces.save(created.state, storage);
  const reloaded = spaces.activate(spaces.load(storage), created.space.id);
  assert.equal(spaces.activeSpace(reloaded).name, 'Work');
  const tab = { id: 't1', space: created.space.id };
  const other = { id: 't2', space: 'personal' };
  const parts = spaces.partition([tab, other], reloaded);
  assert.equal(parts.active.length, 1);
  assert.equal(parts.other.length, 1);
  const counts = spaces.count([tab, other], reloaded);
  assert.equal(counts.get(created.space.id), 1);
  assert.equal(counts.get('personal'), 1);
  const removed = spaces.remove(reloaded, created.space.id);
  assert.equal(removed.state.list.length, 1);
  assert.equal(removed.state.active, 'personal');
});

test('split view and restore code paths are present', () => {
  const app = read('chrome/app.js');
  assert.match(app, /function splitSupported\(/);
  assert.match(app, /function splitActive\(/);
  assert.match(app, /function toggleSplit\(/);
  assert.match(app, /write\(windowKey\('split'\)/);
  assert.match(app, /recentlyClosed/);
  assert.match(read('tests/onboarding-s018.test.cjs'), /Restore 2 tabs/);
  assert.match(read('windows/test/desktop-windows.cjs'), /private-safe window restore/);
});

test('vertical tabs, notes and triage have tests while recipes are still a gap', () => {
  assert.match(read('tests/onboarding-steps.test.cjs'), /s-026 renders the tree, groups, spaces/);
  assert.match(read('tests/mobile-pages-ui.cjs'), /Page note/);
  assert.match(read('tests/browser-ui.cjs'), /group\/pin/);
  const doc = read('docs/POWER-TOOLS.md');
  assert.match(doc, /Session recipes \| \*\*Gap\*\* — screens only/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P11,Advanced tab and workflow power tools/);
});
