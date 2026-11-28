'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the pinned toolchain is consistent and the doctor passes', () => {
  const pinned = read('.nvmrc').trim();
  const desktop = JSON.parse(read('windows/package.json'));
  assert.equal(pinned, '22.13.0');
  assert.equal(desktop.engines.node.replace(/[^0-9.]/g, ''), pinned);
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/doctor.cjs')], { encoding: 'utf8' });
  assert.match(output, /workstation check passed/);
  assert.match(output, /pinned minimum 22\.13\.0/);
});

test('CI wires the minimal gate and keeps secrets read-only', () => {
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /^name: Build Vaayvu$/m);
  assert.match(workflow, /node scripts\/doctor\.cjs/);
  assert.match(workflow, /node --test tests\/\*\.test\.cjs sync\/\*\.test\.mjs/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /Cache the Xcode test products/);
  assert.match(workflow, /-derivedDataPath "\$RUNNER_TEMP\/DerivedData"/);
  assert.match(workflow, /COMPILER_INDEX_STORE_ENABLE=NO/);
  assert.match(workflow, /test-without-building/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(read('.gitignore'), /^\.env$/m);
});

test('the reproducible setup document covers platforms and boundaries', () => {
  assert.equal(existsSync(resolve(root, 'docs/DEVELOPMENT.md')), true);
  const doc = read('docs/DEVELOPMENT.md');
  for (const needle of ['nvm install', 'npm ci --prefix windows', 'android/gradlew', 'iPhone', 'Secrets boundaries', 'P01 status']) {
    assert.match(doc, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(doc, /Green remotely/);
  assert.match(doc, /run 46121708263/);
});
