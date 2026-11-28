const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ext = require('../chrome/extensions');
const zip = require('../chrome/vendor/zip-native.min.js');

test('install the sample ZIP, restrict the style to its exact HTTPS site, and skip private tabs', async () => {
  const archive = fs.readFileSync(path.join(__dirname, '../examples/Wikipedia-Reading-Type.zip'));
  const pkg = await ext.unpack(new Blob([archive]), zip);
  assert.deepEqual(pkg, ext.parsePackage(ext.sampleFiles));
  const enabled = [{ ...pkg, enabled: true }];
  assert.match(ext.cssFor(enabled, { url: 'https://en.wikipedia.org/wiki/Test' }), /line-height/);
  for (const tab of [
    { url: 'https://en.wikipedia.org/', private: true },
    { url: 'http://en.wikipedia.org/' },
    { url: 'https://en.wikipedia.org.other.example/' },
    { url: 'https://other.example/' },
  ])
    assert.equal(ext.cssFor(enabled, tab), '');
  assert.equal(ext.cssFor([{ ...pkg, enabled: false }], { url: 'https://en.wikipedia.org/' }), '');
});
test('unsupported package features and network-capable style declarations are rejected at install', () => {
  const manifest = JSON.parse(ext.sampleFiles['manifest.json']);
  const base = manifest.content_scripts[0];
  function install(record, extra = {}) {
    return ext.parsePackage({
      ...ext.sampleFiles,
      'manifest.json': JSON.stringify({ ...manifest, ...extra, content_scripts: [record] }),
    });
  }
  for (const record of [
    { ...base, js: ['run.js'] },
    { ...base, matches: ['<all_urls>'] },
    { ...base, matches: ['https://*.wikipedia.org/*'] },
    { ...base, all_frames: true },
  ])
    assert.throws(() => install(record));
  assert.throws(() => install(base, { permissions: ['tabs'] }));
  for (const css of [
    'p{background-image:url(https://example.org/a)}',
    '@import "another.css";',
    'p{color:var(--x)}',
    'p{font-family:u\\72l(x)}',
    'p{color:red}invalid',
    '[name=x]{color:red}',
  ])
    assert.throws(() => ext.parsePackage({ ...ext.sampleFiles, 'reading.css': css }));
});

test('safe mode disables every style package without deleting it', () => {
  const map = new Map([
    ['vaayvu.styleExtension.A', JSON.stringify({ name: 'A', rules: [], enabled: true })],
    ['vaayvu.styleExtension.B', JSON.stringify({ name: 'B', rules: [], enabled: false })],
    ['unrelated.key', 'keep'],
  ]);
  const previous = global.localStorage;
  global.localStorage = {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
  try {
    assert.equal(ext.disableAll(), 1, 'only the enabled package changed');
    assert.equal(JSON.parse(map.get('vaayvu.styleExtension.A')).enabled, false);
    assert.equal(JSON.parse(map.get('vaayvu.styleExtension.B')).enabled, false);
    assert.equal(map.get('unrelated.key'), 'keep');
  } finally {
    if (previous === undefined) delete global.localStorage;
    else global.localStorage = previous;
  }
});
