'use strict';

// P15 accessibility and locale audit. Static checks plus i18n primitive checks.
// This is not a screen-reader session; VoiceOver/TalkBack/Narrator need a device.

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const i18n = require('../chrome/i18n.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const failures = [];
const html = read('chrome/index.html');
const css = read('chrome/styles.css');

if (!/<html[^>]*\blang="[a-z-]+"/i.test(html)) failures.push('html lang is missing');
if (/tabindex="[1-9]/.test(html)) failures.push('positive tabindex found');
if (!/aria-label="[^"]+"/.test(html)) failures.push('no aria-labels found');
if (!/role="tablist"/.test(html)) failures.push('spaces tablist role missing');
if (!/:focus-visible/.test(css)) failures.push('focus-visible style missing');
if (!/@media \(prefers-reduced-motion: reduce\)/.test(css)) failures.push('reduced-motion media query missing');
if (!/prefers-contrast|high-contrast/.test(css)) failures.push('contrast handling missing');
if (!/var\(--ui-font/.test(css)) failures.push('locale font stack is not used');
if (!/\[dir="rtl"\]/.test(css)) failures.push('RTL layout rules missing');
if (!/\[data-script="cjk"\]/.test(css)) failures.push('CJK layout rules missing');

for (const rtl of ['ar', 'he', 'fa', 'ur']) {
  if (i18n.direction(rtl) !== 'rtl') failures.push(`RTL direction failed for ${rtl}`);
}
for (const cjk of ['ja', 'zh', 'ko']) {
  if (i18n.script(cjk) !== 'cjk') failures.push(`CJK script failed for ${cjk}`);
  if (!/Hiragino|Noto Sans CJK|PingFang|Malgun/.test(i18n.fontStack(cjk))) failures.push(`CJK font stack missing for ${cjk}`);
}
if (i18n.direction('en') !== 'ltr') failures.push('LTR direction failed for en');
if (i18n.formatNumber(1234567, 'ar') === '1234567') failures.push('Arabic number formatting is not locale-aware');

const responsive = read('tests/responsive-mobile-ui.cjs');
if (!/r\.width >= 24 && r\.height >= 24/.test(responsive)) failures.push('24px hit-target probe missing');
if (!/reducedMotion/.test(read('tests/observatory-ui.cjs'))) failures.push('reduced-motion UI probe missing');
if (!/UIAccessibility\.isReduceMotionEnabled/.test(read('apple/Sources/PageActions.swift'))) failures.push('Apple reduce-motion flag missing');

if (failures.length) {
  console.error('Vaayvu accessibility audit failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Vaayvu accessibility audit passed: labels, focus, reduce motion, contrast, 24px targets, RTL and CJK primitives.');
