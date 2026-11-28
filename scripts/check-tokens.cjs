'use strict';

// P03 design-token guard. The JSON package must stay identical to the CSS
// custom properties it describes; drifted tokens fail the check.

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const css = readFileSync(resolve(root, 'chrome/styles.css'), 'utf8');
const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));

function block(selector) {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`Missing CSS block: ${selector}`);
  const start = css.indexOf('{', at) + 1;
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

function vars(text) {
  const map = {};
  for (const match of text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    map[match[1]] = match[2].trim();
  }
  return map;
}

const light = vars(block(':root {'));
const dark = vars(block(":root[data-theme='dark'] {"));
const failures = [];

for (const [theme, actual] of [['light', light], ['dark', dark]]) {
  for (const [name, value] of Object.entries(tokens.color[theme])) {
    if (actual[name] !== value) {
      failures.push(`${theme} --${name}: JSON ${value} != CSS ${actual[name]}`);
    }
  }
}
for (const [name, value] of Object.entries(tokens.radius)) {
  if (light[name] !== value) failures.push(`radius ${name}: JSON ${value} != CSS ${light[name]}`);
}
for (const [name, value] of Object.entries(tokens.shadow)) {
  if (light[name] !== value) failures.push(`shadow ${name}: JSON ${value} != CSS ${light[name]}`);
}
if (light.side !== tokens.layout.side) {
  failures.push(`layout side: JSON ${tokens.layout.side} != CSS ${light.side}`);
}
if (!css.includes('@media (prefers-reduced-motion: reduce)')) {
  failures.push('Missing prefers-reduced-motion rule.');
}
if (!css.includes(':focus-visible')) {
  failures.push('Missing focus-visible rule.');
}
if (!css.includes(":root[data-theme='dark']")) {
  failures.push('Missing dark theme.');
}

if (failures.length) {
  console.error('Vaayvu design-token check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Vaayvu design-token check passed: ${Object.keys(tokens.color.light).length} light colors, ${Object.keys(tokens.color.dark).length} dark colors, ${Object.keys(tokens.radius).length} radii.`);
