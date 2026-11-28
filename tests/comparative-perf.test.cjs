'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the comparative lab records six matched-device cases with stable medians', () => {
  const result = JSON.parse(read('docs/benchmarks/comparative-2026-11-28.json'));
  assert.equal(result.results.length, 6);
  assert.deepEqual(result.coverage.sort(), ['adblock', 'ai', 'navigation', 'workspace']);
  assert.equal(result.stability.pass, true);
  for (const row of result.results) {
    assert.ok(row.medianMs > 0);
    assert.ok(row.cvPercent <= result.stability.thresholdCvPercent, row.id + ' CV');
    assert.ok(row.perSecond > 0);
  }
  assert.match(result.comparison, /Same machine and runtime/);
  assert.match(result.comparison, /Not a comparison with other browsers/);
  assert.match(read('scripts/comparative-benchmark.cjs'), /const threshold = 20/);
});

test('the published lab and phase record avoid cross-browser claims', () => {
  const doc = read('docs/COMPARATIVE-PERF.md');
  assert.match(doc, /not\*\* a comparison against other browsers/);
  assert.match(doc, /No cross-browser speed claim/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  const published = JSON.parse(read('docs/benchmarks/comparative-2026-11-28.json'));
  assert.equal(published.results.length, 6);
  assert.equal(published.stability.pass, true);
  assert.match(read('docs/PHASES.csv'), /P30,Comparative performance laboratory/);
});
