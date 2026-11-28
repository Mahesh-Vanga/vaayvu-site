'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the release readiness aggregator reports no-go with explicit blockers', () => {
  execFileSync(process.execPath, [resolve(root, 'scripts/release-readiness.cjs')], { encoding: 'utf8' });
  const readiness = JSON.parse(read('docs/release-readiness.json'));
  assert.equal(readiness.decision, 'no-go');
  assert.ok(readiness.blockers.some((blocker) => blocker.phase === 'P17' && blocker.severity === 'critical'));
  assert.ok(readiness.blockers.some((blocker) => blocker.phase === 'P27' && blocker.severity === 'critical'));
  assert.ok(readiness.blockers.some((blocker) => blocker.phase === 'P32' && blocker.severity === 'critical'));
  const anyPresent = readiness.artifacts.some((artifact) => artifact.present);
  if (anyPresent) {
    assert.equal(readiness.signedArtifacts.macSigned, true);
    assert.equal(readiness.signedArtifacts.windowsBuilt, true);
    for (const artifact of readiness.artifacts) {
      assert.equal(artifact.present, true, artifact.name);
      assert.equal(artifact.hashMatches, true, artifact.name);
    }
  } else {
    assert.equal(readiness.signedArtifacts.macSigned, false);
    assert.equal(readiness.signedArtifacts.windowsBuilt, false);
  }
});

test('signed artifacts and rollback exist but do not imply release readiness', () => {
  const doc = read('docs/RELEASE-ASSURANCE.md');
  assert.match(doc, /today is \*\*no-go\*\*/i);
  assert.match(doc, /All applicable requirements verified \| \*\*No\*\*/);
  assert.match(doc, /No unresolved critical blockers \| \*\*No\*\*/);
  assert.match(doc, /6\/6 artifacts, `0\.0\.23 → 0\.0\.22`/);
  assert.match(read('docs/releases/ROLLBACK-DRILL.md'), /Result \| \*\*Pass \(dry run\)\*\*/);
});

test('P35 stays blocked and does not claim all requirements verified', () => {
  const phases = read('docs/PHASES.csv');
  assert.match(phases, /P35,Operational quality and release assurance/);
  assert.match(phases, /Blocked \/ release decision no-go/);
  const readiness = JSON.parse(read('docs/release-readiness.json'));
  const blocked = readiness.phases.filter((phase) => phase.id !== 'P35' && /Blocked/.test(phase.status)).map((phase) => phase.id);
  assert.deepEqual(blocked.sort(), ['P17', 'P27', 'P32', 'P36', 'P37', 'P38', 'P39']);
});
