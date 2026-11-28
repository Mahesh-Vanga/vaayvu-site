'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the pilot is blocked at 0% with no approvals or economics', () => {
  const plan = JSON.parse(read('docs/pilot-plan.json'));
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.rollout.approvedPercent, 0);
  assert.equal(plan.rollout.stage, 'none');
  assert.deepEqual(Object.values(plan.rollout.approvals), [null, null, null, null]);
  assert.equal(plan.dependencies.P35, 'no-go');
  assert.equal(plan.reconciliation.status, 'pending');
  assert.equal(plan.killSwitch.tested, true);
  assert.equal(plan.killSwitch.weakensRasha, false);
  assert.equal(plan.economics.monitored, false);
  assert.equal(plan.economics.values, null);
});

test('the pilot checker refuses rollout without approvals and reconciliation', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/pilot-check.cjs')], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.ok, true);
  assert.equal(result.rolloutPercent, 0);
  assert.deepEqual(result.missingApprovals.sort(), ['legal', 'privacy', 'productOwner', 'security']);
  assert.equal(result.reconciliation, 'pending');
  assert.equal(result.economics, 'unmeasured');
  const source = read('scripts/pilot-check.cjs');
  assert.match(source, /Pilot requires a release go/);
  assert.match(source, /Pilot requires passed reconciliation/);
  assert.match(source, /Pilot requires monitored economics/);
});

test('the pilot document does not publish invented economics', () => {
  const doc = read('docs/MONETIZATION-PILOT.md');
  assert.match(doc, /None are measured/);
  assert.match(doc, /no approved rollout and no measured\s+economics/);
  assert.match(doc, /Gate met \| \*\*No\*\*/);
  assert.match(read('docs/PHASES.csv'), /P39,Monetization pilot and continuing assurance/);
});
