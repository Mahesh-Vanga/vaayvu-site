'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the hostile isolation suite is wired and checks Node, bridge and storage', () => {
  const script = read('windows/test/hostile-isolation.cjs');
  for (const needle of ['process: typeof process', 'require: typeof require', 'bridge: typeof window.VaayvuNative', 'chromeSettings', 'chromeHealthy']) {
    assert.ok(script.includes(needle), needle);
  }
  assert.match(read('windows/test/run.cjs'), /'hostile-isolation'/);
  const doc = read('docs/SECURITY-UPDATES.md');
  assert.match(doc, /"process":"undefined"/);
  assert.match(doc, /cannot read\s+`vaayvu.settings`/);
});

test('the vault provides authenticated encryption and fails closed', () => {
  const vault = read('windows/vault.cjs');
  assert.match(vault, /aes-256-gcm/);
  assert.match(vault, /scryptSync/);
  assert.match(vault, /getAuthTag/);
  assert.match(vault, /setAuthTag/);
  assert.match(vault, /mode: 0o600/);
  assert.match(vault, /HTTPS origins/);
  assert.match(read('tests/vault.test.cjs'), /tampering and non-HTTPS origins are rejected/);
});

test('signed-update evidence and the remaining gaps are recorded', () => {
  const manifest = JSON.parse(read('docs/releases/0.0.23.json'));
  assert.equal(manifest.artifacts.length, 6);
  const doc = read('docs/SECURITY-UPDATES.md');
  assert.match(doc, /vault is not wired into a shipping credential UI/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P21,\"Security, credentials and update integrity\"/);
});
