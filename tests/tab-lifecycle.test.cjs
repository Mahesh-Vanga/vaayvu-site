'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the host implements pressure reclaim, sleep, wake and expiring leases', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /reclaimUnderPressure\(/);
  assert.match(host, /sleepIdleTabs\(/);
  assert.match(host, /sleepTab\(/);
  assert.match(host, /wakeTab\(/);
  assert.match(host, /hasLease\(tab\)/);
  assert.match(host, /setLease\(id, active/);
  assert.match(host, /VAAYVU_PRESSURE_BYTES/);
  assert.match(host, /leaseUntil = Date.now\(\) \+ ttl/);
  assert.match(host, /!this\.hasLease\(t\)/);
});

test('the lifecycle pressure trace is part of the desktop suite', () => {
  assert.equal(existsSync(resolve(root, 'windows/test/lifecycle-pressure.cjs')), true);
  assert.match(read('windows/test/run.cjs'), /'lifecycle-pressure'/);
  const trace = JSON.parse(read('docs/benchmarks/lifecycle-2026-11-28.json'));
  assert.deepEqual(trace.result.sleptUnderPressure, ['t1', 't3']);
  assert.equal(trace.result.leaseProtected, 't2');
  assert.equal(trace.result.activeProtected, 't4');
  assert.ok(trace.result.ramWorkingSetKb > 0);
  assert.ok(trace.result.cpuMs > 0);
});

test('the teardown and energy limits are documented honestly', () => {
  const doc = read('docs/TAB-LIFECYCLE.md');
  assert.match(doc, /Renderer `close` is stubbed/);
  assert.match(doc, /CPU time is an energy \*\*proxy\*\*/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P18,Adaptive performance and tab lifecycle/);
});
