'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('fault injection covers crashes, corrupt state, pressure and quota', () => {
  const store = read('tests/domain-store.test.cjs');
  assert.match(store, /unclean session recovers tabs/);
  assert.match(store, /migrations run in order/);
  const sync = read('sync/recovery.test.mjs');
  assert.match(sync, /corrupt database fails closed/);
  assert.match(sync, /rejected batch leaves the previous snapshot intact/);
  assert.match(sync, /backup restores the whole multi-device state/);
  assert.match(read('windows/test/lifecycle-pressure.cjs'), /leaseProtected/);
  assert.match(read('tests/network-storage.test.cjs'), /quota failures preserve/);
});

test('the private sentinel is tested against every sync database file', () => {
  const sentinel = read('sync/privacy-sentinel.test.mjs');
  assert.match(sentinel, /PRIVATE-SENTINEL-/);
  assert.match(sentinel, /readdir\(dir\)/);
  assert.match(sentinel, /private sentinel absent from/);
  assert.match(sentinel, /private tab sync is rejected|status\).*400|privateEntry/);
  assert.match(read('docs/CONTINUITY-RECOVERY.md'), /main, WAL, SHM/);
});

test('the E2E encryption gap is recorded instead of claimed', () => {
  const doc = read('docs/CONTINUITY-RECOVERY.md');
  assert.match(doc, /Server-readable — no end-to-end encryption/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P23,\"Continuity, migrations and recovery\"/);
});
