'use strict';

// Compare two local benchmark JSON files. Fails when a case regresses past the
// threshold. No network, no telemetry.
// Usage: node scripts/benchmark-compare.cjs docs/benchmarks/baseline.json current.json [--threshold=20]

const { readFileSync } = require('node:fs');

function compare(baseline, current, threshold = 20) {
  const before = new Map(baseline.results.map((row) => [row.label, row]));
  const rows = [];
  for (const row of current.results) {
    const base = before.get(row.label);
    if (!base) {
      rows.push({ label: row.label, baseline: null, current: row.ms, change: null, regressed: false });
      continue;
    }
    const change = base.ms ? ((row.ms - base.ms) / base.ms) * 100 : 0;
    rows.push({
      label: row.label,
      baseline: base.ms,
      current: row.ms,
      change: Number(change.toFixed(1)),
      regressed: change > threshold,
    });
  }
  return { threshold, rows, regressed: rows.some((row) => row.regressed) };
}

function main() {
  const args = process.argv.slice(2);
  const thresholdArg = args.find((arg) => arg.startsWith('--threshold='));
  const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 20;
  const files = args.filter((arg) => !arg.startsWith('--'));
  if (files.length !== 2) {
    console.error('Usage: node scripts/benchmark-compare.cjs <baseline.json> <current.json> [--threshold=20]');
    process.exit(2);
  }
  const result = compare(
    JSON.parse(readFileSync(files[0], 'utf8')),
    JSON.parse(readFileSync(files[1], 'utf8')),
    Number.isFinite(threshold) ? threshold : 20,
  );
  for (const row of result.rows) {
    const change = row.change == null ? 'new' : (row.change > 0 ? '+' : '') + row.change + '%';
    console.log(row.label.padEnd(24) + String(row.baseline ?? '—').padStart(10) + ' ms -> ' +
      String(row.current).padStart(10) + ' ms  ' + change + (row.regressed ? '  REGRESSION' : ''));
  }
  console.log(result.regressed ? 'Benchmark regression above threshold.' : 'Benchmark comparison passed.');
  process.exit(result.regressed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { compare };
