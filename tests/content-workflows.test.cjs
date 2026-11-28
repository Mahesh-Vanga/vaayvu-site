'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the content workflow is part of the desktop suite and covers reader PDF capture', () => {
  const workflow = read('windows/test/content-workflow.cjs');
  assert.match(workflow, /printToPDF/);
  assert.match(workflow, /capturePage/);
  assert.match(workflow, /received\.some\(m=>m\.type==="text"/);
  assert.match(workflow, /smoke-passed/);
  assert.match(read('windows/test/run.cjs'), /'content-workflow'/);
  assert.equal(existsSync(resolve(root, 'docs/CONTENT-WORKFLOWS.md')), true);
});

test('recorded workflow output is honest and the gaps are explicit', () => {
  const doc = read('docs/CONTENT-WORKFLOWS.md');
  assert.match(doc, /"reader":true,"pdf":true/);
  assert.match(doc, /"capture":true/);
  assert.match(doc, /Downloads \| Implemented; file assertion missing/);
  assert.match(doc, /Translation \| \*\*Gap\*\* — no provider/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  const phases = read('docs/PHASES.csv');
  assert.match(phases, /P09,"Content, downloads and productivity"/);
  assert.match(phases, /translation provider not implemented/);
});

test('bookmarks and history have native coverage', () => {
  const desktop = read('windows/test/desktop-windows.cjs');
  assert.match(desktop, /bookmark all tabs/);
  assert.match(read('windows/test/smoke.cjs'), /history/);
});
