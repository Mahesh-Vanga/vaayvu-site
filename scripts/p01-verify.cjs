'use strict';

// P01 verification: pinned toolchain, monorepo layout, minimal CI and
// reproducible setup. Remote CI cannot be proven by a local script.

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

for (const file of ['.nvmrc', 'windows/package-lock.json', 'docs/DEVELOPMENT.md', 'scripts/doctor.cjs', '.github/workflows/build.yml']) {
  check('exists:' + file, existsSync(resolve(root, file)), file);
}
for (const dir of ['chrome', 'windows', 'apple', 'android', 'sync', 'tests']) {
  check('component:' + dir, existsSync(resolve(root, dir)), dir);
}

const pinned = read('.nvmrc').trim();
const desktop = JSON.parse(read('windows/package.json'));
check('toolchain:.nvmrc', pinned === '22.13.0', pinned);
check('toolchain:engines', desktop.engines?.node === '>=22.13.0', desktop.engines?.node || 'missing');
check('toolchain:lockfile', existsSync(resolve(root, 'windows/package-lock.json')), 'windows/package-lock.json');

const workflow = read('.github/workflows/build.yml');
check('ci:name', /^name: Build Vaayvu$/m.test(workflow), (workflow.match(/^name: .*$/m) || ['missing'])[0]);
for (const step of ['node scripts/doctor.cjs', 'node scripts/check-tokens.cjs', 'node scripts/security-gate.cjs', 'node scripts/a11y-audit.cjs', 'node --test tests/*.test.cjs sync/*.test.mjs', 'tests/browser-ui.cjs']) {
  check('ci:' + step, workflow.includes(step), step);
}
check('ci:read-only', /permissions:\n  contents: read/.test(workflow), 'contents: read');
check('ci:no-secrets', !/secrets\./.test(workflow), 'no secrets.*');
const ignore = read('.gitignore');
for (const rule of ['.env', '*.key', '*.keystore', '*.mobileprovision']) {
  check('secrets:ignore:' + rule, ignore.split(/\r?\n/).includes(rule), rule);
}
check('setup:doctor-doc', /node scripts\/doctor\.cjs/.test(read('docs/DEVELOPMENT.md')), 'doctor documented');
check('setup:commands-doc', /npm ci --prefix windows/.test(read('docs/DEVELOPMENT.md')), 'npm ci documented');

let doctor = false;
try {
  doctor = /workstation check passed/.test(execFileSync(process.execPath, [resolve(root, 'scripts/doctor.cjs')], { encoding: 'utf8' }));
} catch {}
check('local:doctor', doctor, doctor ? 'doctor passed' : 'doctor failed');

let p01Tests = false;
try {
  p01Tests = /# fail 0/.test(execFileSync(process.execPath, ['--test', resolve(root, 'tests/p01-workstation.test.cjs')], { encoding: 'utf8' }));
} catch {}
check('local:p01-tests', p01Tests, p01Tests ? '3 tests passed' : 'tests failed');

let remoteCi = 'unverified';
let remoteRun = null;
if (process.argv.includes('--remote')) {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
    const runs = JSON.parse(execFileSync('gh', ['run', 'list', '--repo', 'Mahesh-Vanga/vaayvu-site', '--branch', branch, '--limit', '30', '--json', 'headSha,conclusion,status,url'], { encoding: 'utf8' }));
    const green = runs.find((run) => run.headSha === head && run.status === 'completed' && run.conclusion === 'success');
    if (green) {
      remoteCi = 'green';
      remoteRun = green.url;
      check('remote:ci-green', true, green.url);
    } else {
      check('remote:ci-green', false, 'No successful run for HEAD ' + head.slice(0, 7));
    }
  } catch (error) {
    check('remote:ci-green', false, error.message.split('\n')[0]);
  }
}
const payload = {
  phase: 'P01',
  toolchainPinned: checks.filter((c) => c.name.startsWith('toolchain:')).every((c) => c.ok),
  ciConfigured: checks.filter((c) => c.name.startsWith('ci:')).every((c) => c.ok),
  reproducibleSetup: checks.filter((c) => c.name.startsWith('setup:')).every((c) => c.ok),
  localChecks: checks.filter((c) => c.name.startsWith('local:')).every((c) => c.ok),
  remoteCi,
  remoteRun,
  verified: checks.every((entry) => entry.ok) && remoteCi === 'green',
  reason: remoteCi === 'green'
    ? 'Local checks pass and a green remote run exists for HEAD.'
    : 'The minimal CI is configured and local checks pass, but no green remote run exists for the current tree.',
  checks,
};
console.log(JSON.stringify(payload, null, 2));
if (checks.some((c) => !c.ok)) process.exit(1);
