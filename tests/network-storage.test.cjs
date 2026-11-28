'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const storage = require('../chrome/storage.js');
const policy = require('../windows/policy.cjs');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function fakeStorage({ failKey = '' } = {}) {
  const store = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) {
      if (failKey && key === failKey) {
        const error = new Error('disk full');
        error.name = 'QuotaExceededError';
        throw error;
      }
      store[key] = String(value);
    },
    removeItem(key) { delete store[key]; },
  };
  return store;
}

test('quota failures preserve the previous value and report failure', () => {
  const store = fakeStorage({ failKey: 'vaayvu.settings' });
  store['vaayvu.settings'] = JSON.stringify({ theme: 'light' });
  const result = storage.write('vaayvu.settings', { theme: 'dark' }, store);
  assert.deepEqual(result, { ok: false, reason: 'quota' });
  assert.deepEqual(storage.read('vaayvu.settings', null, store), { theme: 'light' });
  assert.deepEqual(storage.write('vaayvu.other', { ok: true }, store), { ok: true, reason: '' });
  assert.deepEqual(storage.read('vaayvu.other', null, store), { ok: true });
  assert.equal(storage.remove('vaayvu.other', store), true);
  assert.equal(storage.read('vaayvu.other', 'fallback', store), 'fallback');
});

test('generic legacy keys migrate without overwriting newer values', () => {
  const store = fakeStorage();
  store.setItem('old.settings', 'old');
  store.setItem('old.keep', 'old-keep');
  store.setItem('vaayvu.keep', 'new-keep');
  assert.equal(storage.migrate('vaayvu.', 'old.', store), 1);
  assert.equal(store.getItem('vaayvu.settings'), 'old');
  assert.equal(store.getItem('vaayvu.keep'), 'new-keep');
  assert.equal(store.getItem('old.settings'), null);
  assert.equal(store.getItem('old.keep'), null);
});

test('transport accepts only bounded HTTP(S) and TLS sync destinations', () => {
  assert.ok(policy.website('https://example.com/path'));
  assert.ok(policy.website('http://127.0.0.1:8080/'));
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.com/', 'https://exa mple.com/', 'https://example.com\\@evil.example/']) {
    assert.equal(policy.website(bad), null, bad);
  }
  assert.equal(policy.syncDestination('https://sync.example.com'), true);
  assert.equal(policy.syncDestination('http://127.0.0.1:8787'), true);
  assert.equal(policy.syncDestination('http://sync.example.com'), false);
});

test('regular and private caches are partitioned and cleared', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /session\.fromPartition\(name, \{ cache:/);
  assert.match(host, /persist:vaayvu-web/);
  assert.match(host, /vaayvu-private-.*randomUUID/);
  assert.match(host, /old\.clearStorageData\(\)/);
  assert.match(host, /old\.clearCache\(\)/);
  assert.match(host, /clearStorageData\(\{ storages: \['cookies'\] \}\)/);
  assert.match(host, /clearCache\(\)/);
});

test('the storage recovery and cache boundaries are documented', () => {
  const doc = read('docs/NETWORK-STORAGE.md');
  assert.match(doc, /previous value stays intact/);
  assert.match(doc, /OS-level disk-full/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P19,Efficient networking and storage/);
});
