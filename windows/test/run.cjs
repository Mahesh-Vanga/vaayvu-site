'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const suites = ['smoke', 'vfd', 'desktop-windows', 'content-workflow', 'lifecycle-pressure', 'hostile-isolation'];
function run(suite) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-smoke-'));
  try {
    const test = spawnSync(require('electron'), [path.join(__dirname, suite + '.cjs')], {
      env: { ...process.env, VAAYVU_SMOKE_PROFILE: profile },
      stdio: 'inherit',
      timeout: 90000,
    });
    if (test.error) throw test.error;
    if (test.status !== 0 || !fs.existsSync(path.join(profile, 'smoke-passed')))
      throw Error('Electron did not complete the ' + suite + ' checks.');
  } finally {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  }
}
if (process.argv[2] && !suites.includes(process.argv[2])) throw Error('Unknown Electron test suite.');
for (const suite of process.argv[2] ? [process.argv[2]] : suites) run(suite);
