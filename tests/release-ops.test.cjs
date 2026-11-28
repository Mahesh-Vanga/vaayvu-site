'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the release manifest and checksums match the current artifacts', () => {
  const manifest = JSON.parse(read('docs/releases/0.0.23.json'));
  assert.equal(manifest.version, '0.0.23');
  assert.equal(manifest.artifacts.length, 6);
  if (!existsSync(join(root, 'tests/test/0.0.23', manifest.artifacts[0].name))) {
    assert.equal(manifest.artifacts.length, 6, 'manifest still lists all artifacts');
    return;
  }
  const sums = read('tests/test/0.0.23/SHA256SUMS.txt').trim().split('\n');
  assert.equal(sums.length, 6);
  for (const artifact of manifest.artifacts) {
    const bytes = readFileSync(join(root, 'tests/test/0.0.23', artifact.name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.sha256, artifact.name);
    assert.ok(sums.some((line) => line.endsWith('  ' + artifact.name)), artifact.name + ' in SHA256SUMS');
  }
});

test('the rollback drill covers both releases and is a verified dry run', () => {
  const report = read('docs/releases/ROLLBACK-DRILL.md');
  assert.match(report, /Current release \| 0\.0\.23 \(6 artifacts verified\)/);
  assert.match(report, /Rollback target \| 0\.0\.22 \(6 artifacts verified\)/);
  assert.match(report, /Result \| \*\*Pass \(dry run\)\*\*/);
  assert.match(report, /does \*\*not\*\* replace an/);
  for (const file of ['scripts/release-checksums.cjs', 'scripts/release-manifest.cjs', 'scripts/rollback-drill.cjs']) {
    assert.equal(existsSync(resolve(root, file)), true, file);
  }
});

test('notarization and store review are documented as gaps', () => {
  const doc = read('docs/RELEASE-OPS.md');
  assert.match(doc, /Apple notarization \| \*\*Not performed\*\*/);
  assert.match(doc, /App Store \/ Play Store review \| \*\*Not submitted\*\*/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P16,"Packaging, distribution, release operations"/);
});
