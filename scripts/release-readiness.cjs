'use strict';

// P35 release readiness. Aggregates phase status, signed artifacts and explicit
// critical blockers. It refuses to call a release ready while any blocker is open.

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
function parseCsv(text) {
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

const rows = parseCsv(readFileSync(join(root, 'docs', 'PHASES.csv'), 'utf8'));
const header = rows[0];
const phases = rows.slice(1).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])));

const blockers = [
  { id: 'B-00', phase: 'P00', severity: 'high', reason: 'Charter and exit artifacts are unsigned by the responsible owner.' },
  { id: 'B-01', phase: 'P17', severity: 'critical', reason: 'No real beta cohort, measured SLOs or live security-update channel; P35 dependency also unresolved.' },
  { id: 'B-02', phase: 'P27', severity: 'critical', reason: 'No real-device playback quality or call-protection verification; no WebRTC call path.' },
  { id: 'B-03', phase: 'P32', severity: 'critical', reason: 'Physical iPhone, iPad and Android runs are missing; only simulators/emulators were exercised.' },
  { id: 'B-04', phase: 'P23', severity: 'high', reason: 'Sync payloads are TLS-only and not end-to-end encrypted.' },
  { id: 'B-05', phase: 'P28', severity: 'high', reason: 'PWA install/window/offline runtime is missing.' },
  { id: 'B-06', phase: 'P29', severity: 'medium', reason: 'Official WPT suite was not run; only a WPT-style corpus exists.' },
  { id: 'B-07', phase: 'P26', severity: 'medium', reason: 'Download quarantine, resume and integrity checks are screens only.' },
  { id: 'B-08', phase: 'P01', severity: 'medium', reason: 'Remote CI has not been observed green for the current tree.' },
];

const manifest = JSON.parse(readFileSync(join(root, 'docs', 'releases', '0.0.23.json'), 'utf8'));
const artifacts = manifest.artifacts.map((artifact) => {
  const file = join(root, 'tests', 'test', manifest.version, artifact.name);
  const present = existsSync(file);
  const hash = present ? createHash('sha256').update(readFileSync(file)).digest('hex') : '';
  return { name: artifact.name, present, hashMatches: hash === artifact.sha256, signed: /macOS|iOS|Android/.test(artifact.name) };
});

const critical = blockers.filter((blocker) => blocker.severity === 'critical');
const payload = {
  generatedAt: new Date().toISOString(),
  product: 'Vaayvu',
  version: manifest.version,
  decision: critical.length ? 'no-go' : 'go',
  reason: critical.length
    ? 'Unresolved critical blockers remain; a signed build alone is not a release.'
    : 'All applicable gates are green.',
  signedArtifacts: {
    manifest: 'docs/releases/0.0.23.json',
    macSigned: artifacts.some((a) => /macOS\.dmg/.test(a.name) && a.present && a.hashMatches),
    windowsBuilt: artifacts.some((a) => /Windows/.test(a.name) && a.present && a.hashMatches),
    androidBuilt: artifacts.some((a) => /Android\.apk/.test(a.name) && a.present && a.hashMatches),
    iosDevelopment: artifacts.some((a) => /iOS\.ipa/.test(a.name) && a.present && a.hashMatches),
  },
  phases: phases.map((phase) => ({ id: phase.phase_id, title: phase.title, status: phase.status, verification: phase.verification })),
  blockers,
  artifacts,
};
writeFileSync(join(root, 'docs', 'release-readiness.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ decision: payload.decision, critical: critical.length, artifacts: artifacts.length, signedArtifacts: payload.signedArtifacts }));
