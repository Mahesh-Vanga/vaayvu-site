'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('sync credentials use scrypt, hashed sessions and TLS beyond loopback', () => {
  const server = read('sync/server.mjs');
  assert.match(server, /scrypt/);
  assert.match(server, /digest\(/);
  assert.match(server, /Use TLS_CERT and TLS_KEY to listen beyond loopback/);
  assert.doesNotMatch(server, /password\s*TEXT/i);
  const doc = read('docs/CREDENTIALS-SYNC.md');
  assert.match(doc, /No end-to-end encryption/);
  assert.match(doc, /server-readable/);
  assert.match(doc, /Platform-delegated/);
});

test('multi-device recovery and data-loss chaos tests exist', () => {
  const file = 'sync/recovery.test.mjs';
  assert.equal(existsSync(resolve(root, file)), true);
  const tests = read(file);
  assert.match(tests, /offline device catches up across a restart/);
  assert.match(tests, /backup restores the whole multi-device state/);
  assert.match(tests, /rejected batch leaves the previous snapshot intact/);
  assert.match(tests, /corrupt database fails closed/);
  assert.match(tests, /deletion ties/);
  assert.match(read('docs/CREDENTIALS-SYNC.md'), /# tests 7, pass 7, fail 0/);
});

test('P10 records the encryption and passkey gaps instead of claiming them', () => {
  const phases = read('docs/PHASES.csv');
  assert.match(phases, /P10,"Credentials, synchronization and backup"/);
  assert.match(phases, /not end-to-end encrypted/);
  assert.match(phases, /passkeys are platform-delegated/);
  const doc = read('docs/CREDENTIALS-SYNC.md');
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(doc, /independent\s+passkey test are not claimed|passkey gaps recorded/);
});
