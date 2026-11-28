'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the AI opt-in document records privacy and cost gates without claiming agents', () => {
  const doc = read('docs/AI-OPTIN.md');
  assert.match(doc, /Page text is extracted locally/);
  assert.match(doc, /Private pages are rejected/);
  assert.match(doc, /8,000 estimated tokens/);
  assert.match(doc, /12 questions per account per 15 minutes/);
  assert.match(doc, /no shipping agent runtime/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
});

test('the server injection test and phase evidence are wired', () => {
  const sync = read('sync/ai-guard.test.mjs');
  assert.match(sync, /Ignore all previous instructions/);
  assert.match(sync, /untrustedPageText/);
  assert.match(sync, /tools, undefined/);
  assert.match(sync, /num_predict, 768/);
  assert.match(read('docs/PHASES.csv'), /P13,"AI-assisted browser, opt-in"/);
});
