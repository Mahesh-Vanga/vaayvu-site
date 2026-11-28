'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const i18n = require('../chrome/i18n.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the accessibility audit passes and is wired into CI', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/a11y-audit.cjs')], { encoding: 'utf8' });
  assert.match(output, /accessibility audit passed/);
  assert.match(read('.github/workflows/build.yml'), /node scripts\/a11y-audit\.cjs/);
});

test('RTL and CJK locale primitives are real', () => {
  for (const locale of ['ar', 'he', 'fa', 'ur']) assert.equal(i18n.direction(locale), 'rtl');
  assert.equal(i18n.direction('en'), 'ltr');
  for (const locale of ['ja', 'zh', 'ko']) {
    assert.equal(i18n.script(locale), 'cjk');
    assert.match(i18n.fontStack(locale), /Hiragino|Noto Sans CJK|PingFang|Malgun/);
  }
  assert.match(i18n.fontStack('ar'), /Noto Naskh Arabic|Geeza Pro/);
  assert.notEqual(i18n.formatNumber(1234567, 'ar'), '1234567');
  const element = { lang: '', dir: '', dataset: {}, style: { setProperty(key, value) { this[key] = value; } } };
  const result = i18n.apply({ documentElement: element }, 'ar');
  assert.equal(result.dir, 'rtl');
  assert.equal(element.dir, 'rtl');
  assert.equal(element.dataset.script, 'rtl');
});

test('the localization gap and screen-reader limits are documented, not claimed', () => {
  const doc = read('docs/ACCESSIBILITY-I18N.md');
  assert.match(doc, /does \*\*not\*\* do: translate the UI strings/);
  assert.match(doc, /no device screen-reader session was run/);
  assert.match(doc, /Localized release \| \*\*Gap\*\* — no translated string catalog/);
  assert.match(doc, /Gate met \| \*\*Partially\*\*/);
  assert.match(read('docs/PHASES.csv'), /P15,\"Accessibility, languages and inclusive UX\"/);
});
