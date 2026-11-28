import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extractFile, getRawHeader } from '@electron/asar';
import { getCurrentFuseWire, FuseV1Options as Fuse, FuseState } from '@electron/fuses';
import { runtimeFiles } from './package-source.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const metadata = JSON.parse(await fs.readFile(path.join(here, 'package.json'), 'utf8'));
const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'tests', 'test', metadata.version);
const base = path.join(directory, 'Vaayvu-' + metadata.version + '-macOS');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'vaayvu-mac-verify-'));
const mount = path.join(scratch, 'mounted');
let attached = false;
async function signingHash(app) {
  await exec('codesign', ['--verify', '--deep', '--strict', app]);
  const { stderr } = await exec('codesign', ['-dv', '--verbose=4', app]);
  assert.match(stderr, /^Authority=Developer ID Application:/m);
  assert.match(stderr, /flags=0x[0-9a-f]+\(runtime\)/);
  return /^CDHash=(\w+)/m.exec(stderr)[1];
}

try {
  await exec('hdiutil', ['verify', base + '.dmg']);
  await exec('codesign', ['--verify', '--strict', base + '.dmg']);
  const { stdout: signature } = await exec('pkgutil', ['--check-signature', base + '.pkg']);
  assert.match(signature, /Developer ID Installer:/);
  await fs.mkdir(mount);
  await exec('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, base + '.dmg']);
  attached = true;
  const app = path.join(mount, 'Vaayvu.app');
  assert.equal(await fs.readlink(path.join(mount, 'Applications')), '/Applications');
  const cdHash = await signingHash(app);
  const contents = path.join(app, 'Contents');
  const executable = path.join(contents, 'MacOS', 'Vaayvu');
  assert.equal((await exec('lipo', ['-archs', executable])).stdout.trim(), 'arm64');
  const plist = JSON.parse((await exec('plutil', ['-convert', 'json', '-o', '-', path.join(contents, 'Info.plist')])).stdout);
  assert.equal(plist.CFBundleIdentifier, 'com.electron.vaayvu');
  assert.equal(plist.CFBundleName, metadata.productName);
  assert.equal(plist.CFBundleDisplayName, metadata.productName);
  assert.equal(plist.CFBundleExecutable, metadata.productName);
  assert.equal(plist.CFBundleShortVersionString, metadata.version);
  assert.equal(plist.CFBundleVersion, String(metadata.buildNumber));
  const resources = path.join(contents, 'Resources');
  assert.equal(plist.CFBundleIconName, 'Icon');
  await fs.access(path.join(resources, 'Assets.car'));
  assert.equal(plist.NSDockTilePlugIn, 'VaayvuDock.docktileplugin');
  const plugin = path.join(contents, 'PlugIns', plist.NSDockTilePlugIn);
  await signingHash(plugin);
  const dockArtwork = path.join(root, 'branding', 'vaayvu-desktop.png');
  assert.deepEqual(await fs.readFile(path.join(resources, 'VaayvuDock.png')), await fs.readFile(dockArtwork));
  const harness = path.join(scratch, 'check-dock-tile');
  await exec('xcrun', ['--sdk', 'macosx', 'clang', '-fobjc-arc', '-framework', 'AppKit',
    path.join(here, 'test', 'dock-tile.m'), '-o', harness]);
  await exec(harness, [plugin, path.join(scratch, 'dock-tile.png')]);
  const iconset = path.join(scratch, 'launcher.iconset');
  await exec('iconutil', ['-c', 'iconset', path.join(resources, plist.CFBundleIconFile), '-o', iconset]);
  async function iconPixels(source, filename) {
    const target = path.join(scratch, filename);
    await exec('sips', ['-s', 'format', 'bmp', '-z', '64', '64', source, '--out', target]);
    const bitmap = await fs.readFile(target);
    return bitmap.subarray(bitmap.readUInt32LE(10));
  }
  const appIconArtwork = path.join(root, 'branding', 'vaayvu-appicon.png');
  const square = path.join(scratch, 'expected-icon.png');
  await exec('sips', ['--padToHeightWidth', '1024', '1024', appIconArtwork, '--out', square]);
  const expectedIcon = await iconPixels(square, 'expected.bmp');
  const shippedIcon = await iconPixels(path.join(iconset, 'icon_512x512@2x.png'), 'shipped.bmp');
  assert.deepEqual(shippedIcon, expectedIcon, 'The signed app must carry the V/wind app icon');
  for (const notice of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) await fs.access(path.join(resources, notice));
  const archive = path.join(resources, 'app.asar');
  const digest = createHash('sha256').update(getRawHeader(archive).headerString).digest('hex');
  assert.equal(plist.ElectronAsarIntegrity['Resources/app.asar'].hash, digest);
  const shipped = JSON.parse(extractFile(archive, 'package.json'));
  assert.equal(shipped.version, metadata.version);
  assert.equal(shipped.productName, metadata.productName);
  for (const name of runtimeFiles) assert.deepEqual(extractFile(archive, name), await fs.readFile(path.join(here, name)));
  for (const file of await fs.readdir(path.join(root, 'chrome'), { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || file.name.startsWith('.')) continue;
    const full = path.join(file.parentPath, file.name);
    assert.deepEqual(extractFile(archive, path.relative(root, full)), await fs.readFile(full));
  }
  const fuses = await getCurrentFuseWire(executable);
  for (const flag of [Fuse.RunAsNode, Fuse.EnableNodeOptionsEnvironmentVariable, Fuse.EnableNodeCliInspectArguments, Fuse.GrantFileProtocolExtraPrivileges]) {
    assert.equal(fuses[flag], FuseState.DISABLE);
  }
  for (const flag of [Fuse.EnableEmbeddedAsarIntegrityValidation, Fuse.OnlyLoadAppFromAsar]) {
    assert.equal(fuses[flag], FuseState.ENABLE);
  }
  const expanded = path.join(scratch, 'installer');
  await exec('pkgutil', ['--expand-full', base + '.pkg', expanded]);
  const [component] = (await fs.readdir(expanded)).filter(name => name.endsWith('.pkg'));
  assert.ok(component);
  const receipt = await fs.readFile(path.join(expanded, component, 'PackageInfo'), 'utf8');
  assert.match(receipt, /identifier="com\.vaayvu\.browser\.chromium"/);
  assert.match(receipt, /install-location="\/Applications"/);
  assert.ok(receipt.includes('version="' + metadata.buildNumber + '"'));
  assert.equal(await signingHash(path.join(expanded, component, 'Payload', 'Vaayvu.app')), cdHash);
  console.log('Verified matching signed Mac app in DMG and PKG, Dock plug-in drawing and transparency, Finder catalog, receipt, version, source bytes, Chromium notices, ASAR integrity and hardened fuses.');
} finally {
  if (attached) await exec('hdiutil', ['detach', mount]);
  await fs.rm(scratch, { force: true, recursive: true });
}
