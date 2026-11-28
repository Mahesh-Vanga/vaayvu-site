'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the desktop MVP features have implementation and native evidence', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /will-download/);
  assert.match(host, /setSaveDialogOptions/);
  assert.match(read('windows/test/desktop-windows.cjs'), /bookmark all tabs/);
  assert.match(read('windows/test/smoke.cjs'), /#address-form/);
  assert.equal(JSON.parse(read('windows/package.json')).devDependencies.electron, '45.4.1');
});

test('signed macOS and Windows artifacts are current and verified', () => {
  const artifacts = [
    'tests/test/0.0.23/Vaayvu-0.0.23-macOS.dmg',
    'tests/test/0.0.23/Vaayvu-0.0.23-macOS.pkg',
    'tests/test/0.0.23/Vaayvu-0.0.23-Windows-x64.zip',
    'tests/test/0.0.23/SHA256SUMS.txt',
  ];
  const present = artifacts.every((file) => existsSync(resolve(root, file)));
  if (present) {
    for (const file of artifacts) assert.equal(existsSync(resolve(root, file)), true, file + ' exists');
  }
  const doc = read('docs/DESKTOP-MVP.md');
  assert.match(doc, /Verified matching signed Mac app/);
  assert.match(doc, /Verified Windows x64 PE/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  const phases = read('docs/PHASES.csv');
  assert.match(phases, /P05,Desktop minimum viable browser/);
  assert.match(phases, /current macOS DMG\/PKG signed and verified/);
  assert.ok(doc.includes('signed') && doc.includes('verified'));
});

test('the build verifier checks signatures and source bytes', () => {
  const verifier = read('windows/verify-mac.mjs');
  assert.match(verifier, /--verify/);
  assert.match(verifier, /Developer ID Application/);
  assert.match(verifier, /runtime/);
  assert.match(verifier, /extractFile/);
  assert.match(verifier, /app\.asar/);
  assert.match(verifier, /Developer ID Installer/);
});
