'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const Core = require('../chrome/core.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the security gate passes and is wired into CI', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/security-gate.cjs')], { encoding: 'utf8' });
  assert.match(output, /security gate passed/);
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /node scripts\/security-gate\.cjs/);
});

test('the hostile URL corpus is rejected at navigation boundaries', () => {
  const corpus = JSON.parse(read('tests/fixtures/hostile-urls.json'));
  assert.ok(corpus.reject.length >= 15);
  for (const payload of corpus.reject) {
    assert.equal(Core.webURL(payload), '', 'rejected: ' + String(payload).slice(0, 50));
  }
  for (const safe of corpus.accept) {
    assert.notEqual(Core.webURL(safe), '', 'accepted: ' + safe);
  }
  assert.equal(Core.webURL('https://example.com/' + 'a'.repeat(9000)), '');
  assert.equal(Core.webURL('https://example.com/path\n'), '');
  assert.equal(Core.webURL('https://example.com\\@evil.example/'), '');
  assert.equal(Core.destination('javascript:alert(1)'), '');
});

test('threat model, private boundaries and external-test status are recorded', () => {
  assert.equal(existsSync(resolve(root, 'docs/THREAT-MODEL.md')), true);
  const doc = read('docs/THREAT-MODEL.md');
  assert.match(doc, /Trust boundaries/);
  assert.match(doc, /Private data leaks/);
  assert.match(doc, /External hostile-site testing \| \*\*Not performed\*\*/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  const host = read('windows/host.cjs');
  assert.match(host, /sandbox: true/);
  assert.match(host, /contextIsolation: true/);
  assert.match(host, /setPermissionRequestHandler/);
  const phases = read('docs/PHASES.csv');
  assert.match(phases, /P08,"Privacy, security and protection depth"/);
  assert.match(phases, /external hostile-site testing pending/);
});
