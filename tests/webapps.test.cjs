'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ext = require('../chrome/extensions.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('style extensions apply without any Rasha or ad-block dependency', () => {
  const pkg = ext.parsePackage(ext.sampleFiles);
  const enabled = [{ ...pkg, enabled: true }];
  assert.match(ext.cssFor(enabled, { url: 'https://en.wikipedia.org/wiki/Test' }), /line-height/);
  const source = read('chrome/extensions.js');
  assert.doesNotMatch(source, /adBlock|vfd|rasha/i);
});

test('extension permissions stay CSS-only and private tabs are excluded', () => {
  const manifest = JSON.parse(ext.sampleFiles['manifest.json']);
  const record = manifest.content_scripts[0];
  for (const bad of [
    { ...manifest, content_scripts: [{ ...record, js: ['run.js'] }] },
    { ...manifest, content_scripts: [{ ...record, matches: ['<all_urls>'] }] },
    { ...manifest, permissions: ['tabs'] },
  ]) {
    assert.throws(() => ext.parsePackage({ ...ext.sampleFiles, 'manifest.json': JSON.stringify(bad) }));
  }
  const pkg = ext.parsePackage(ext.sampleFiles);
  assert.equal(ext.cssFor([{ ...pkg, enabled: true }], { url: 'https://en.wikipedia.org/wiki/Test', private: true }), '');
});

test('PWA runtime is documented as absent', () => {
  const doc = read('docs/WEBAPPS-EXTENSIONS.md');
  assert.match(doc, /Install prompt \/ manifest handling \| \*\*Not implemented\*\*/);
  assert.match(doc, /no PWA install runtime|No PWA capability is claimed/i);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P28,Extensions and web applications/);
});
