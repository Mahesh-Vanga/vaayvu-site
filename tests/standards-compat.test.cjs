'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the standards corpus covers URL/IDN, Intl, dialog, grid, forms and storage', () => {
  const fixture = read('tests/fixtures/standards.html');
  for (const needle of ['new URL(', 'URLSearchParams', 'Intl.NumberFormat', 'HTMLDialogElement', 'ResizeObserver', 'Element.prototype.animate', 'margin-inline-start', 'checkValidity', 'localStorage']) {
    assert.ok(fixture.includes(needle), needle);
  }
  assert.match(read('tests/standards-ui.cjs'), /PASS standards corpus/);
  assert.match(read('tests/browser-ui.cjs'), /standards-ui\.cjs/);
});

test('native inspection exists on every platform', () => {
  const inspector = read('tests/inspector-ui.cjs');
  assert.match(inspector, /for \(const platform of \['mac', 'windows', 'android', 'ios'\]\)/);
  assert.match(read('apple/Sources/BrowserHost.swift'), /isInspectable/);
  assert.match(read('android/app/src/main/java/dev/vaayvu/app/ChromiumInspectionActivity.java'), /class ChromiumInspectionActivity/);
});

test('the official WPT gap and unsupported cases are documented', () => {
  const doc = read('docs/COMPATIBILITY.md');
  assert.match(doc, /WPT-style subset\*\*, not a run of the official/);
  assert.match(doc, /Official WPT pass rate \| \*\*Not run\*\*/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P29,Developer tools and standards compatibility/);
});
