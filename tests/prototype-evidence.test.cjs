'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const evidence = JSON.parse(read('docs/benchmarks/playwright-2026-11-28.json'));

test('P03 evidence records eight executed probes and no failures', () => {
  assert.equal(evidence.phase, 'P03');
  assert.equal(evidence.passed, 8);
  assert.equal(evidence.failed, 0);
  assert.equal(evidence.probes.length, 8);
  assert.ok(evidence.playwright);
  assert.ok(evidence.chromium.startsWith('chromium-'));
  for (const probe of evidence.probes) {
    assert.equal(probe.status, 'passed', probe.file);
    assert.equal(typeof probe.durationMs, 'number', probe.file + ' duration');
    assert.ok(probe.durationMs > 100, probe.file + ' actually executed');
    assert.equal(existsSync(resolve(root, probe.file)), true, probe.file + ' exists');
  }
  assert.ok(new Set(evidence.probes.map((probe) => probe.file)).size === 8, 'each probe once');
  assert.ok(!Number.isNaN(Date.parse(evidence.generatedAt)));
});

test('module probes can execute standalone instead of exiting as no-ops', () => {
  for (const file of [
    'tests/responsive-mobile-ui.cjs',
    'tests/mobile-pages-ui.cjs',
    'tests/mobile-overview-ui.cjs',
    'tests/observatory-ui.cjs',
    'tests/account-switch-ui.cjs',
  ]) {
    assert.match(read(file), /require\.main === module/, file + ' has a standalone launcher');
  }
});

test('one runner executes the probes and CI uploads its result', () => {
  const runner = read('scripts/run-prototypes.cjs');
  assert.match(runner, /tests\/browser-ui\.cjs/);
  assert.match(runner, /tests\/responsive-mobile-ui\.cjs/);
  assert.match(runner, /tests\/mobile-pages-ui\.cjs/);
  assert.match(runner, /tests\/mobile-overview-ui\.cjs/);
  assert.match(runner, /tests\/desktop-tab-strip-ui\.cjs/);
  assert.match(runner, /tests\/observatory-ui\.cjs/);
  assert.match(runner, /tests\/inspector-ui\.cjs/);
  assert.match(runner, /tests\/account-switch-ui\.cjs/);
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /node scripts\/run-prototypes\.cjs --json/);
  assert.match(workflow, /name: prototype-evidence/);
  assert.match(read('docs/DESIGN-SYSTEM.md'), /scripts\/run-prototypes\.cjs/);
});
