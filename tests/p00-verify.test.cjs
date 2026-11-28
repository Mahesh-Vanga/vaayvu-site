'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

test('P00 artifacts verify with the owner attestation recorded', () => {
  const output = execFileSync(process.execPath, [resolve(__dirname, '../scripts/p00-verify.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output);
  for (const entry of result.checks) assert.equal(entry.ok, true, entry.name + ': ' + entry.detail);
  assert.equal(result.artifactsComplete, true);
  assert.equal(result.signaturePending, false);
  assert.equal(result.verified, true, 'signed charter verifies');
});
