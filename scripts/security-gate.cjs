'use strict';

// P08 security gate. Static invariants plus hostile-input checks that must hold
// before a build is treated as security-reviewed. External penetration testing
// is separate and cannot be asserted by this script.

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Core = require('../chrome/core.js');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const failures = [];

function requireMatch(file, pattern, label) {
  if (!pattern.test(read(file))) failures.push(`${label} (${file})`);
}

const host = read('windows/host.cjs');
for (const flag of [
  'sandbox: true',
  'contextIsolation: true',
  'nodeIntegration: false',
  'nodeIntegrationInSubFrames: false',
  'webviewTag: false',
  'webSecurity: true',
  'allowRunningInsecureContent: false',
]) {
  if (!host.includes(flag)) failures.push(`Electron hardening flag missing: ${flag}`);
}
if (!host.includes("this.ui.setWindowOpenHandler(() => ({ action: 'deny' }))")) failures.push('UI popup handler is not deny-by-default');
if (!host.includes("this.ui.on('will-navigate', (e) => e.preventDefault())")) failures.push('UI navigation is not denied');
if (!host.includes('setPermissionRequestHandler')) failures.push('Permission request handler missing');
if (!host.includes('setPermissionCheckHandler')) failures.push('Permission check handler missing');
if (!/siteSession\('vaayvu-private-/.test(host)) failures.push('Private web session is not partitioned');

requireMatch('chrome/index.html', /default-src 'none'/, 'CSP default-src is not none');
requireMatch('chrome/index.html', /object-src 'none'/, 'CSP object-src is not none');
requireMatch('chrome/index.html', /base-uri 'none'/, 'CSP base-uri is not none');
requireMatch('chrome/index.html', /form-action 'none'/, 'CSP form-action is not none');
requireMatch('chrome/index.html', /frame-src 'none'/, 'CSP frame-src is not none');
requireMatch('chrome/index.html', /script-src 'self'/, 'CSP script-src is not self');

requireMatch('.github/workflows/build.yml', /permissions:\n  contents: read/, 'CI is not read-only');
if (/secrets\./.test(read('.github/workflows/build.yml'))) failures.push('CI references repository secrets');

const ignore = read('.gitignore');
for (const rule of ['.env', '*.key', '*.keystore', '*.mobileprovision']) {
  if (!ignore.split(/\r?\n/).includes(rule)) failures.push(`Sensitive file is not ignored: ${rule}`);
}

requireMatch('docs/VFD-ENGINE.md', /VFD rule matching/, 'VFD engine documentation missing');

const corpus = JSON.parse(read('tests/fixtures/hostile-urls.json'));
for (const payload of corpus.reject) {
  if (Core.webURL(payload) !== '') failures.push(`Unsafe URL accepted: ${String(payload).slice(0, 60)}`);
}
for (const safe of corpus.accept) {
  if (Core.webURL(safe) === '') failures.push(`Safe URL rejected: ${safe}`);
}
if (Core.webURL('https://example.com/' + 'a'.repeat(9000)) !== '') failures.push('Unsafe URL accepted: oversized URL');
if (Core.destination('javascript:alert(1)') !== '') failures.push('destination() accepted a script URL');
if (Core.destination('example.com') !== 'https://example.com/') failures.push('destination() rejected a bare hostname');
if (Core.destination('two words') !== '') failures.push('destination() accepted whitespace');

if (failures.length) {
  console.error('Vaayvu security gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Vaayvu security gate passed: Electron flags, CSP, permissions, private partition, CI/secrets and hostile URL inputs.');
