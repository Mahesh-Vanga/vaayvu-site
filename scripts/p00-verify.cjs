'use strict';

// P00 verification. Artifacts can be complete while the owner signature is not.
// A missing signature keeps P00 unverified; this script never signs on behalf.

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

const files = ['docs/CHARTER.md', 'docs/DECISIONS.csv', 'docs/SOURCES.csv', 'docs/PHASES.csv', 'docs/SCREENS.csv'];
for (const file of files) check('exists:' + file, existsSync(resolve(root, file)), file);

const charter = read('docs/CHARTER.md');
for (const [name, pattern] of [
  ['scope', /## Scope/],
  ['goals', /## Goals/],
  ['ownership', /## Ownership/],
  ['evidence rules', /## Evidence rules/],
  ['legacy reconciliation', /## Legacy identifier reconciliation/],
  ['exit checklist', /## Exit gate checklist \(P00\)/],
  ['signature table', /## Signature/],
]) check('charter:' + name, pattern.test(charter), name);
check('charter:signed status', /Signed — owner attestation 2026-11-28/.test(charter), 'status');
check('charter:s-172 exclusion', /s-172.*permanently excluded/.test(charter), 's-172');
check('charter:route alias', /vaayvu:\/\//.test(charter) && /orbit:\/\//.test(charter), 'routes');

function csvRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ''));
}

const decisions = csvRows(read('docs/DECISIONS.csv'));
check('decisions:header', decisions[0]?.[0] === 'id', 'header');
check('decisions:count', decisions.length > 10, String(decisions.length - 1) + ' decisions');
check('decisions:ids', decisions.slice(1).every((row) => /^D-\d{3}$/.test(row[0] || '')), 'D-NNN');
check('decisions:status', decisions.slice(1).every((row) => ['accepted', 'open', 'closed'].includes(row[5])), 'status values');
const sources = csvRows(read('docs/SOURCES.csv'));
check('sources:header', sources[0]?.[0] === 'id', 'header');
check('sources:count', sources.length > 10, String(sources.length - 1) + ' sources');
check('sources:authoritative', sources.slice(1).some((row) => row[1] === 'User-provided canonical screen specs'), 'canonical spec');

const phases = csvRows(read('docs/PHASES.csv'));
const p00 = phases.find((row) => row[0] === 'P00');
check('phases:40', phases.length - 1 === 40, String(phases.length - 1) + ' phases');
check('phases:P00 title', p00?.[1] === 'Product charter and audit', p00?.[1] || '');
check('phases:P00 dependency', p00?.[5] === 'None', p00?.[5] || '');
check('phases:P00 owner', p00?.[8] === '—', p00?.[8] || '');

const screens = csvRows(read('docs/SCREENS.csv'));
const ids = new Set(screens.slice(1).map((row) => row[0]));
check('screens:655', ids.size === 655, String(ids.size) + ' screens');
const s172 = screens.slice(1).find((row) => row[0] === 's-172');
check('screens:s-172 excluded', !!s172 && s172[4] === 'excluded', s172?.[1] || 'missing');
check('screens:a-032 present', ids.has('a-032'), 'a-032');

const signatureRows = charter
  .split(/\r?\n/)
  .filter((line) => /^\| (Product owner|Engineering owner|Evidence reviewer) /.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
const signatureComplete = signatureRows.length === 3 &&
  signatureRows.every((cells) => cells[1] && cells[2] && cells[3]);
check('charter:signature complete', signatureComplete, signatureComplete ? '3 roles signed' : 'signature missing');

const payload = {
  phase: 'P00',
  artifactsComplete: checks.every((entry) => entry.ok),
  signaturePending: !signatureComplete,
  verified: checks.every((entry) => entry.ok) && signatureComplete,
  checks,
};
console.log(JSON.stringify(payload, null, 2));
if (checks.some((entry) => !entry.ok)) process.exit(1);
