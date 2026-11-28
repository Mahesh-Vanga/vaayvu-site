import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import extract from '@electron-internal/extract-zip';
import { extractFile, getRawHeader, listPackage } from '@electron/asar';
import { getCurrentFuseWire, FuseV1Options as Fuse, FuseState } from '@electron/fuses';
import { runtimeFiles } from './package-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(here);
const metadata = JSON.parse(await fs.readFile(path.join(here, 'package.json'), 'utf8'));
const packagePath = process.argv[2] ? path.resolve(process.argv[2]) :
  path.join(root, 'tests', 'test', metadata.version, 'Vaayvu-' + metadata.version + '-Windows-x64.zip');
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'vaayvu-verify-'));
try {
  await extract(packagePath, { dir: work });
  const app = path.join(work, 'Vaayvu'),
    exe = path.join(app, 'Vaayvu.exe'),
    asar = path.join(app, 'resources', 'app.asar');
  const pe = await fs.readFile(exe),
    offset = pe.readUInt32LE(60);
  assert.equal(pe.subarray(offset, offset + 4).toString('hex'), '50450000');
  assert.equal(pe.readUInt16LE(offset + 4), 0x8664);
  assert.equal(pe.readUInt16LE(offset + 24), 0x20b);
  assert(pe.includes(Buffer.from('Vaayvu Browser', 'utf16le')));
  const icon = await fs.readFile(path.join(here, 'vaayvu.ico'));
  const largest = 6 + 16 * (icon.readUInt16LE(4) - 1);
  const iconStart = icon.readUInt32LE(largest + 12);
  assert(pe.includes(icon.subarray(iconStart, iconStart + icon.readUInt32LE(largest + 8))),
    'Windows executable must contain the current full-color launcher artwork');
  const digest = createHash('sha256').update(getRawHeader(asar).headerString).digest('hex');
  assert(pe.includes(Buffer.from(digest)), 'The Windows executable must embed the app.asar integrity digest');
  const fuses = await getCurrentFuseWire(exe);
  for (const fuse of [
    Fuse.RunAsNode,
    Fuse.EnableNodeOptionsEnvironmentVariable,
    Fuse.EnableNodeCliInspectArguments,
    Fuse.GrantFileProtocolExtraPrivileges,
  ])
    assert.equal(fuses[fuse], FuseState.DISABLE);
  for (const fuse of [Fuse.EnableEmbeddedAsarIntegrityValidation, Fuse.OnlyLoadAppFromAsar])
    assert.equal(fuses[fuse], FuseState.ENABLE);
  const built = JSON.parse(extractFile(asar, 'package.json'));
  assert.equal(built.version, metadata.version);
  assert.equal(built.productName, 'Vaayvu');
  const shipped = new Set(listPackage(asar).map((x) => x.replaceAll('\\', '/').replace(/^\//, '')));
  for (const name of runtimeFiles)
    assert.deepEqual(extractFile(asar, name), await fs.readFile(path.join(here, name)));
  let count = 0;
  async function compare(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const file = path.join(dir, item.name),
        id = path.relative(root, file).split(path.sep).join('/');
      if (item.isDirectory()) await compare(file);
      else if (item.isFile()) {
        assert(shipped.has(id), id);
        assert.deepEqual(extractFile(asar, path.normalize(id)), await fs.readFile(file), id);
        count++;
      }
    }
  }
  await compare(path.join(root, 'chrome'));
  for (const file of [
    'LICENSE',
    'LICENSES.chromium.html',
    'chrome_100_percent.pak',
    'icudtl.dat',
    'resources.pak',
  ])
    await fs.access(path.join(app, file));
  if (process.platform === 'win32') {
    await promisify(execFile)('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(here, 'test', 'launch-package.ps1'),
      '-Executable', exe, '-ProfileDirectory', path.join(work, 'test-profile'),
    ], { timeout: 60000 });
    console.log('The packaged Vaayvu.exe opened its browser window on Windows.');
  }
  console.log(
    'Verified Windows x64 PE, Vaayvu product resources, ASAR digest, hardened Electron fuses, desktop sources and ' +
      count +
      ' shared assets.',
  );
} finally {
  await fs.rm(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
