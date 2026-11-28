'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function parseCsv(text) {
  return text.trim().split('\n').map((line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { cells.push(cell); cell = ''; }
      else cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  });
}

test('the engine lab records three executed spike results', () => {
  const rows = parseCsv(read('docs/ENGINE-LAB.csv'));
  assert.equal(rows[0][0], 'engine');
  const engines = rows.slice(1).map((r) => r[0]);
  assert.deepEqual(engines, ['Chromium/Blink', 'WebKit', 'GeckoView']);
  for (const row of rows.slice(1)) {
    assert.match(row[2], /^Pass:/, row[0] + ' has a recorded pass');
    assert.equal(row[6], 'verified-locally', row[0] + ' is locally verified');
  }
  const gecko = rows.find((r) => r[0] === 'GeckoView');
  assert.match(gecko[1], /geckoview-spike/);
  assert.match(gecko[2], /loaded example\.com/);
  assert.match(gecko[5], /no-go/i);
});

test('the written go/no-go is conditional and the gate is met locally', () => {
  const doc = read('docs/ENGINE-LAB.md');
  assert.match(doc, /GeckoView.*no-go/i);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  const phases = parseCsv(read('docs/PHASES.csv'));
  const p02 = phases.find((r) => r[0] === 'P02');
  assert.match(p02[7], /GeckoView 145 APK built and loaded example\.com/);
  assert.equal(p02[6], 'Implemented / verified locally');
});

test('the engine lab cites real repository evidence', () => {
  for (const file of [
    'docs/VFD-ENGINE.md',
    'windows/package.json',
    'apple/Sources/ChromeStorage.swift',
    'android/app/src/main/java/dev/vaayvu/app/BrowserTab.java',
    'android/settings.gradle',
  ]) {
    assert.equal(existsSync(resolve(root, file)), true, file + ' exists');
  }
  assert.match(read('android/settings.gradle'), /geckoview-spike/);
  assert.match(read('android/geckoview-spike/build.gradle'), /org\.mozilla\.geckoview:geckoview:/);
  assert.match(read('windows/package.json'), /"electron": "45\.4\.1"/);
});
