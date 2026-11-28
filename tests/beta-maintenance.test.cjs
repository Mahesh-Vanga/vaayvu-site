'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('SLO targets exist but are explicitly unmeasured', () => {
  const slo = JSON.parse(read('docs/slo.json'));
  assert.equal(slo.status, 'unmeasured');
  assert.equal(slo.measuredAt, null);
  assert.equal(slo.slos.length, 5);
  for (const row of slo.slos) {
    assert.equal(row.measured, null, row.id + ' has no invented measurement');
    assert.equal(row.status, 'unmeasured');
    assert.ok(row.target > 0);
  }
  const ids = slo.slos.map((row) => row.id);
  for (const id of ['crash-free-sessions', 'cold-start-p95', 'update-success', 'rollback-time', 'critical-security-response']) {
    assert.ok(ids.includes(id), id);
  }
});

test('the beta plan records staged rollout, triage and governance', () => {
  const doc = read('docs/BETA-MAINTENANCE.md');
  assert.match(doc, /Opt-in beta/);
  assert.match(doc, /1% \| opt-in/);
  assert.match(doc, /S1 \| Data loss/);
  assert.match(doc, /Release governance/);
  assert.match(doc, /No beta user is enrolled by this audit/);
  assert.match(doc, /Gate met \| \*\*No\*\*/);
  assert.match(read('docs/PHASES.csv'), /P17,\"Beta, staged launch and maintenance\"/);
  assert.match(read('docs/PHASES.csv'), /P35/);
});
