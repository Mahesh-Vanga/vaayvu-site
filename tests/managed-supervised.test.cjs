'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('managed policy is signed scoped and fully disclosed', () => {
  const source = read('chrome/managed-policy.js');
  assert.match(source, /createHmac\('sha256'/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /function summarize/);
  assert.match(source, /scope: policy\.scope\?\.profileId/);
  assert.match(source, /MAX_RULES = 64/);
});

test('supervised exit requires guardian or PIN and never traps the owner', () => {
  const source = read('chrome/managed-policy.js');
  assert.match(source, /guardian === true/);
  assert.match(source, /Supervision PIN accepted/);
  assert.match(source, /OS level/);
  assert.match(read('tests/onboarding-steps.test.cjs'), /kiosk validates URL, allowlist, PIN and exit/);
});

test('transparency, isolation and runtime gaps are documented', () => {
  const doc = read('docs/MANAGED-SUPERVISED.md');
  assert.match(doc, /every rule is disclosed/);
  assert.match(doc, /other profiles are unaffected/);
  assert.match(doc, /MDM\/GPO runtime \| \*\*Gap\*\*/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P34,Managed and supervised browsing/);
});
