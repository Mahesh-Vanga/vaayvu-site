'use strict';
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const [currentVersion, previousVersion] = process.argv.slice(2);
if (!currentVersion || !previousVersion) {
  console.error('Usage: node scripts/rollback-drill.cjs <current> <previous>');
  process.exit(2);
}
const root = resolve(__dirname, '..');
const readManifest = (version) => JSON.parse(readFileSync(join(root, 'docs', 'releases', version + '.json'), 'utf8'));
const verify = (manifest) => {
  const dir = join(root, 'tests', 'test', manifest.version);
  for (const artifact of manifest.artifacts) {
    const bytes = readFileSync(join(dir, artifact.name));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== artifact.sha256) throw new Error('Hash mismatch: ' + artifact.name);
  }
  return manifest.artifacts.length;
};
const semver = (value) => value.split('.').map((part) => Number(part) || 0);
const newer = (a, b) => {
  const x = semver(a), y = semver(b);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const current = readManifest(currentVersion);
const previous = readManifest(previousVersion);
if (newer(currentVersion, previousVersion) <= 0) throw new Error('Current version must be newer than the rollback target.');
const currentCount = verify(current);
const previousCount = verify(previous);
const dmg = join(root, 'tests', 'test', previous.version, 'Vaayvu-' + previous.version + '-macOS.dmg');
execFileSync('hdiutil', ['verify', dmg], { stdio: 'ignore' });
const report = `# Release rollback drill

Generated: ${new Date().toISOString()}

| Field | Value |
|---|---|
| Current release | ${currentVersion} (${currentCount} artifacts verified) |
| Rollback target | ${previousVersion} (${previousCount} artifacts verified) |
| Previous macOS DMG | \`hdiutil verify\` passed |
| Result | **Pass (dry run)** |

## Drill steps

1. Verified every artifact hash in \`docs/releases/${currentVersion}.json\`.
2. Verified every artifact hash in \`docs/releases/${previousVersion}.json\`.
3. Confirmed \`${currentVersion}\` is newer than \`${previousVersion}\`.
4. Verified the previous macOS DMG container.
5. Selected \`${previousVersion}\` as the rollback target.

## Real rollback runbook

1. Freeze the current release channel.
2. Publish the previous signed artifacts from \`tests/test/${previousVersion}/\`.
3. Verify \`SHA256SUMS.txt\` after transfer.
4. Re-point the download/update manifest to \`${previousVersion}\`.
5. Keep the failed release artifacts for incident review; do not delete evidence.
6. Announce the rollback and open an incident report.

This drill verifies artifacts and target selection. It does **not** replace an
actual install/update rollback on a managed device.
`;
writeFileSync(join(root, 'docs', 'releases', 'ROLLBACK-DRILL.md'), report);
console.log(`Rollback drill passed: ${currentVersion} -> ${previousVersion} (${currentCount}/${previousCount} artifacts verified).`);
