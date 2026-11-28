'use strict';

// P03 interactive prototype gate. Runs every Playwright probe explicitly and
// can write a machine-readable result for the phase evidence:
//
//   node scripts/run-prototypes.cjs
//   node scripts/run-prototypes.cjs --json docs/benchmarks/playwright-2026-11-28.json
//
// Playwright must be installed (CI installs it under RUNNER_TEMP and sets
// NODE_PATH; locally `npm i playwright` is enough).

const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const probes = [
  ['browser shell', 'tests/browser-ui.cjs'],
  ['responsive mobile controls', 'tests/responsive-mobile-ui.cjs'],
  ['mobile pages', 'tests/mobile-pages-ui.cjs'],
  ['mobile overview', 'tests/mobile-overview-ui.cjs'],
  ['desktop tab strip', 'tests/desktop-tab-strip-ui.cjs'],
  ['Observatory/start page', 'tests/observatory-ui.cjs'],
  ['inspector routing', 'tests/inspector-ui.cjs'],
  ['account switch', 'tests/account-switch-ui.cjs'],
];

function version() {
  try {
    const pkg = require('playwright/package.json');
    let browser = 'unknown';
    try {
      const { chromium } = require('playwright');
      const match = chromium.executablePath().match(/chromium-\d+/);
      if (match) browser = match[0];
    } catch (error) {}
    return { playwright: pkg.version, chromium: browser };
  } catch (error) {
    return { playwright: 'unavailable', chromium: 'unavailable' };
  }
}

const results = [];
for (const [name, file] of probes) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [join(root, file)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - started;
  const ok = run.status === 0;
  results.push({ name, file, status: ok ? 'passed' : 'failed', durationMs });
  if (!ok) {
    console.error('FAILED', name, '(' + file + ')');
  }
}

const versions = version();
const passed = results.filter((result) => result.status === 'passed').length;
const failed = results.length - passed;
const evidence = {
  phase: 'P03',
  generatedAt: new Date().toISOString(),
  ...versions,
  probes: results,
  passed,
  failed,
};

const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex !== -1 && process.argv[jsonIndex + 1]) {
  const output = resolve(root, process.argv[jsonIndex + 1]);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log('Wrote ' + output);
}
console.log(JSON.stringify(evidence));
process.exit(failed ? 1 : 0);
