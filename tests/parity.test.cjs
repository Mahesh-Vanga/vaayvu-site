'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the iPad popover crash is fixed with a source view', () => {
  const tests = read('apple/Tests/PhoneInteractionTests.swift');
  assert.match(tests, /picker\.popoverPresentationController\?\.sourceView = host\.view/);
  assert.match(tests, /sourceRect = CGRect/);
  assert.match(read('docs/PARITY.md'), /iPad simulator suite passes \*\*18\/18\*\*/);
});

test('all simulated and packaged targets have evidence', () => {
  assert.match(read('docs/PARITY.md'), /iPhone \| 18\/18 simulator tests/);
  assert.match(read('docs/ANDROID-MOBILE.md'), /phone: launched at 1080x2280/);
  assert.match(read('docs/ANDROID-MOBILE.md'), /tablet: launched at 1600x2560/);
  assert.match(read('docs/DESKTOP-MVP.md'), /Verified Windows x64 PE/);
  assert.match(read('docs/DESKTOP-MVP.md'), /Verified matching signed Mac app/);
});

test('physical-device gaps are recorded instead of claimed', () => {
  const doc = read('docs/PARITY.md');
  assert.match(doc, /Physical iPhone \| \*\*Not available\*\*/);
  assert.match(doc, /Physical iPad \| \*\*Not available\*\*/);
  assert.match(doc, /Physical Android \| \*\*Not available\*\*/);
  assert.match(doc, /Gate met \| \*\*No\*\*/);
  assert.match(read('docs/PHASES.csv'), /P32,Native desktop and mobile parity/);
});
