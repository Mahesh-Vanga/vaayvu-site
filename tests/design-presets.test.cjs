'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('light and dark presets exist and tokens are guarded', () => {
  const prefs = read('chrome/preferences.js');
  assert.match(prefs, /theme: \{ system: 'Follow device', light: 'Light', dark: 'Dark' \}/);
  const css = read('chrome/styles.css');
  assert.match(css, /:root\[data-theme='dark'\]/);
  assert.match(css, /high-contrast/);
  const output = execFileSync(process.execPath, [resolve(root, 'scripts/check-tokens.cjs')], { encoding: 'utf8' });
  assert.match(output, /14 light colors, 14 dark colors/);
});

test('accessible journeys and responsive chrome probes are wired', () => {
  const audit = execFileSync(process.execPath, [resolve(root, 'scripts/a11y-audit.cjs')], { encoding: 'utf8' });
  assert.match(audit, /accessibility audit passed/);
  const responsive = read('tests/responsive-mobile-ui.cjs');
  assert.match(responsive, /r\.width >= 24 && r\.height >= 24/);
  assert.match(responsive, /phone touch targets, sheets and tab grid at 320\/360\/390/);
  const desktop = read('tests/desktop-tab-strip-ui.cjs');
  assert.match(desktop, /for \(const position of \['left', 'right'\]\)/);
});

test('translation and screen-reader limits are documented, not claimed', () => {
  const doc = read('docs/DESIGN-A11Y-L10N.md');
  assert.match(doc, /No translated string catalog/);
  assert.match(doc, /Screen-reader device sessions .*not run/s);
  assert.match(doc, /Gate met \| \*\*Yes, locally\*\*/);
  assert.match(read('docs/PHASES.csv'), /P31,\"Design, accessibility and localization\"/);
});
