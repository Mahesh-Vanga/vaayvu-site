'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ext = require('../chrome/extensions.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function matrix() {
  const [head, ...rows] = read('docs/EXTENSION-MATRIX.csv').trim().split('\n');
  const columns = head.split(',');
  return rows.map((line) => Object.fromEntries(line.split(',').map((cell, index) => [columns[index], cell])));
}

test('the compatibility matrix marks only CSS style extensions as supported', () => {
  const rows = matrix();
  assert.equal(rows.length, 10);
  const find = (needle) => rows.find((row) => row.feature.includes(needle));
  assert.equal(find('CSS-only').status, 'supported');
  assert.equal(find('Content-script JavaScript').status, 'unsupported');
  assert.equal(find('Chrome Web Store').status, 'unsupported');
  assert.equal(find('Native messaging').status, 'unsupported');
  assert.equal(find('Enterprise policy').status, 'gap');
  assert.equal(find('Private-window').status, 'blocked');
});

test('the extension security review rejects scripts wildcards and stale permissions', () => {
  const manifest = JSON.parse(ext.sampleFiles['manifest.json']);
  const record = manifest.content_scripts[0];
  for (const bad of [
    { ...manifest, content_scripts: [{ ...record, js: ['run.js'] }] },
    { ...manifest, content_scripts: [{ ...record, matches: ['<all_urls>'] }] },
    { ...manifest, permissions: ['tabs'] },
  ]) {
    assert.throws(() => ext.parsePackage({ ...ext.sampleFiles, 'manifest.json': JSON.stringify(bad) }));
  }
  assert.match(read('docs/EXTENSIONS-MANAGED.md'), /Enterprise policy enforcement.*Screen contracts only|Screen contracts only/);
  assert.match(read('docs/EXTENSIONS-MANAGED.md'), /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P12,Extensions and managed deployments/);
});

test('ZIP limits and private-tab exclusion are part of the review', () => {
  assert.match(read('chrome/extensions.js'), /256 \* 1024/);
  assert.match(read('chrome/extensions.js'), /paths\.size < 40/);
  assert.match(read('chrome/extensions.js'), /size <= 32000/);
  assert.match(read('chrome/extensions.js'), /private/);
});
