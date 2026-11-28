'use strict';

// Reproducible-setup guard for P01. Fails fast when a workstation is missing a
// pinned toolchain or a required repository root. No network access.

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const failures = [];
const notes = [];

function read(file) {
  return readFileSync(resolve(root, file), 'utf8');
}

const pinned = read('.nvmrc').trim();
const parts = (value) => value.split('.').map((n) => Number(n) || 0);
const actual = process.versions.node;
const meetsPinned = (() => {
  const a = parts(actual);
  const p = parts(pinned);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > p[i]) return true;
    if (a[i] < p[i]) return false;
  }
  return true;
})();
if (!meetsPinned) {
  failures.push(`Node ${actual} is older than the pinned ${pinned}; install the pinned toolchain.`);
}

for (const dir of ['chrome', 'windows', 'apple', 'android', 'sync', 'tests']) {
  if (!existsSync(resolve(root, dir))) failures.push(`Missing repository component: ${dir}/`);
}

for (const file of ['windows/package-lock.json', 'README.md', 'docs/CHARTER.md']) {
  if (!existsSync(resolve(root, file))) failures.push(`Missing required file: ${file}`);
}

const desktop = JSON.parse(read('windows/package.json'));
const engine = desktop.engines && desktop.engines.node;
if (!engine) failures.push('windows/package.json has no engines.node pin.');
else if (engine.replace(/[^0-9.]/g, '') !== pinned) {
  failures.push(`windows/package.json engines.node (${engine}) disagrees with .nvmrc (${pinned}).`);
}

if (existsSync(resolve(root, '.env'))) {
  notes.push('.env exists locally and must stay untracked; never commit secrets.');
}

if (failures.length) {
  console.error('Vaayvu workstation check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Vaayvu workstation check passed: Node ${actual} (pinned minimum ${pinned}).`);
console.log('Components: chrome, windows, apple, android, sync, tests. Lockfile present.');
for (const note of notes) console.log(`Note: ${note}`);
