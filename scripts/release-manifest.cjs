'use strict';
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const version = process.argv[2];
if (!version) { console.error('Usage: node scripts/release-manifest.cjs <version>'); process.exit(2); }
const root = resolve(__dirname, '..');
const dir = join(root, 'tests', 'test', version);
const meta = JSON.parse(readFileSync(join(root, 'windows', 'package.json'), 'utf8'));
const files = readdirSync(dir)
  .filter((name) => name.startsWith('Vaayvu-' + version + '-') && !name.endsWith('.txt'))
  .sort()
  .map((name) => {
    const bytes = readFileSync(join(dir, name));
    return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
if (!files.length) { console.error('No artifacts for ' + version); process.exit(1); }
const manifest = {
  version,
  product: meta.productName,
  packageVersion: meta.version,
  buildNumber: meta.buildNumber,
  generatedAt: new Date().toISOString(),
  artifacts: files,
  directory: 'tests/test/' + version,
};
const outDir = join(root, 'docs', 'releases');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, version + '.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote ' + out + ' with ' + files.length + ' artifacts.');
