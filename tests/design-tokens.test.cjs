'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('the design token package matches the stylesheet', () => {
  const tokens = JSON.parse(read('design/tokens.json'));
  assert.equal(tokens.color.light.accent, '#0071e3');
  assert.equal(tokens.color.dark.accent, '#0a84ff');
  assert.equal(tokens.radius['radius-xl'], '16px');
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/check-tokens.cjs')], { encoding: 'utf8' });
  assert.match(output, /design-token check passed/);
  assert.match(output, /14 light colors, 14 dark colors/);
});

test('brand glass responsive and accessibility evidence exists', () => {
  for (const file of [
    'branding/vaayvu-mark.svg',
    'branding/Vaayvu_V_Wind_16K.svg',
    'chrome/liquid.css',
    'chrome/mobile.css',
    'docs/DESIGN-SYSTEM.md',
  ]) {
    assert.equal(existsSync(resolve(root, file)), true, file + ' exists');
  }
  const css = read('chrome/styles.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:root\[data-theme='dark'\]/);
  assert.match(read('chrome/liquid.css'), /--glass-fill/);
});

test('the interactive prototype probes are real and wired to CI', () => {
  for (const file of [
    'tests/browser-ui.cjs',
    'tests/responsive-mobile-ui.cjs',
    'tests/mobile-pages-ui.cjs',
    'tests/mobile-overview-ui.cjs',
    'tests/desktop-tab-strip-ui.cjs',
    'tests/observatory-ui.cjs',
    'tests/inspector-ui.cjs',
    'tests/account-switch-ui.cjs',
  ]) {
    assert.equal(existsSync(resolve(root, file)), true, file + ' exists');
  }
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /node scripts\/check-tokens\.cjs/);
  assert.match(workflow, /tests\/browser-ui\.cjs/);
  const doc = read('docs/DESIGN-SYSTEM.md');
  assert.match(doc, /all Playwright probes passed/);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
});
