'use strict';
const { createHash } = require('node:crypto');
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const version = process.argv[2];
if (!version) { console.error('Usage: node scripts/release-checksums.cjs <version>'); process.exit(2); }
const dir = resolve(__dirname, '..', 'tests', 'test', version);
const files = readdirSync(dir)
  .filter((name) => name.startsWith('Vaayvu-' + version + '-') && !name.endsWith('.txt'))
  .sort();
if (!files.length) { console.error('No artifacts for ' + version); process.exit(1); }
const lines = files.map((name) => {
  const hash = createHash('sha256').update(readFileSync(join(dir, name))).digest('hex');
  return hash + '  ' + name;
});
writeFileSync(join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log('Wrote ' + join(dir, 'SHA256SUMS.txt') + ' for ' + files.length + ' artifacts.');
