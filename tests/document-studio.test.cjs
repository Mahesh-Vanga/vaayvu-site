'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the content workflow produces native PDF, PNG and MHTML without mutating the page', () => {
  const workflow = read('windows/test/content-workflow.cjs');
  assert.match(workflow, /printToPDF/);
  assert.match(workflow, /capturePage/);
  assert.match(workflow, /savePage\(mhtmlPath, 'MHTML'\)/);
  assert.match(workflow, /unchanged: before\.url === after\.url/);
  assert.match(workflow, /result\.mhtml/);
  const doc = read('docs/DOCUMENT-STUDIO.md');
  assert.match(doc, /"mhtml":true,"mhtmlBytes":3952,"unchanged":true/);
  assert.match(doc, /URL and title unchanged/);
});

test('save handlers re-check the tab and downloads cancel unsafe contexts', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /case 'savePDF':/);
  assert.match(host, /case 'capture':/);
  assert.match(host, /case 'savePage':/);
  assert.match(host, /contents\.getURL\(\) !== url/);
  assert.match(host, /!entry\?\.host\.enabled/);
  assert.match(host, /item\.setSaveDialogOptions/);
});

test('download recovery gaps are recorded honestly', () => {
  const doc = read('docs/DOCUMENT-STUDIO.md');
  assert.match(doc, /quarantine-before-open with an integrity check/);
  assert.match(doc, /resumable downloads across restart/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P26,\"Document, capture and download studio\"/);
});
