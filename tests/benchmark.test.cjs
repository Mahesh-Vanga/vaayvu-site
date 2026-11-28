'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const { compare } = require('../scripts/benchmark-compare.cjs');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the benchmark runs locally and publishes four measured cases', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/benchmark.cjs'), '--json'], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(output);
  assert.equal(result.results.length, 4);
  for (const row of result.results) {
    assert.ok(row.iterations > 0);
    assert.ok(row.ms > 0);
    assert.ok(row.perSecond > 0);
    assert.ok(row.cpuMs >= 0);
  }
  assert.match(result.notes.join(' '), /no network requests, telemetry or upload/);
  assert.doesNotMatch(read('scripts/benchmark.cjs'), /require\(['"]node:https?['"]\)|fetch\(/);
});

test('the comparator detects regressions past the threshold', () => {
  const base = { results: [{ label: 'Case', ms: 100 }] };
  assert.equal(compare(base, { results: [{ label: 'Case', ms: 110 }] }, 20).regressed, false);
  assert.equal(compare(base, { results: [{ label: 'Case', ms: 130 }] }, 20).regressed, true);
  assert.equal(compare(base, { results: [{ label: 'New', ms: 50 }] }, 20).regressed, false);
});

test('published results and the P14 record are present', () => {
  const doc = read('docs/BENCHMARKS.md');
  assert.match(doc, /node scripts\/benchmark\.cjs --json/);
  assert.match(doc, /VFD decisions/);
  assert.match(doc, /CPU time is reported as an \*\*energy proxy\*\*/);
  assert.match(doc, /no joule measurement is claimed/i);
  const baseline = JSON.parse(read('docs/benchmarks/2026-11-28.json'));
  assert.equal(baseline.results.length, 4);
  assert.match(read('docs/PHASES.csv'), /P14,Performance and low-memory program/);
});
