'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../chrome/native-store.js'), 'utf8');

function legacyStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); },
    map,
  };
}

function bridge(initial = {}) {
  const map = new Map(Object.entries(initial));
  const imported = [];
  return {
    map,
    imported,
    available: true,
    get(key) { return map.has(key) ? map.get(key) : null; },
    set(key, value) { map.set(String(key), String(value)); return true; },
    remove(key) { return map.delete(String(key)); },
    keys() { return Array.from(map.keys()); },
    importLegacy(entries) {
      imported.push(...entries);
      let count = 0;
      for (const [key, value] of entries) {
        if (map.has(key)) continue;
        map.set(key, value);
        count += 1;
      }
      return count;
    },
  };
}

function mount({ native = bridge(), legacy = legacyStorage() } = {}) {
  const window = { VaayvuStore: native, localStorage: legacy };
  const context = { window, DOMException, Array, Object, String, Number, JSON, console };
  runInNewContext(source, context);
  return { window, native, legacy };
}

test('legacy values are imported once and reads/writes use the bridge', () => {
  const { window, native, legacy } = mount({
    legacy: legacyStorage({
      'vaayvu.settings': JSON.stringify({ theme: 'light' }),
      'vaayvu.tabs': JSON.stringify([{ id: 'one' }]),
    }),
  });
  assert.equal(native.imported.length, 2);
  assert.equal(window.localStorage, window.localStorage);
  assert.equal(window.localStorage.getItem('vaayvu.settings'), '{"theme":"light"}');
  assert.equal(window.localStorage.length, 2);
  assert.equal(window.localStorage.key(0), 'vaayvu.settings');
  assert.equal(window.localStorage.key(9), null);
  window.localStorage.setItem('vaayvu.history', '[{"url":"https://example.com"}]');
  assert.equal(native.map.get('vaayvu.history'), '[{"url":"https://example.com"}]');
  window.localStorage.removeItem('vaayvu.tabs');
  assert.equal(native.map.has('vaayvu.tabs'), false);
  assert.equal(legacy.getItem('vaayvu.tabs'), JSON.stringify([{ id: 'one' }]));
});

test('import never overwrites newer SQLite state', () => {
  const native = bridge({ 'vaayvu.settings': JSON.stringify({ theme: 'dark' }) });
  const { window } = mount({ native, legacy: legacyStorage({ 'vaayvu.settings': JSON.stringify({ theme: 'light' }) }) });
  assert.equal(native.imported.length, 1);
  assert.equal(window.localStorage.getItem('vaayvu.settings'), '{"theme":"dark"}');
});

test('clear removes every bridged key', () => {
  const { window, native } = mount({ legacy: legacyStorage({ 'a': '1', 'b': '2' }) });
  window.localStorage.clear();
  assert.deepEqual(native.map.size, 0);
  assert.equal(window.localStorage.length, 0);
});

test('without the Electron bridge localStorage is left untouched', () => {
  const legacy = legacyStorage({ 'vaayvu.settings': '{"theme":"light"}' });
  const window = { localStorage: legacy };
  runInNewContext(source, { window, DOMException, Array, Object, String, Number, JSON, console });
  assert.equal(window.localStorage, legacy);
  assert.equal(window.localStorage.getItem('vaayvu.settings'), '{"theme":"light"}');
});
