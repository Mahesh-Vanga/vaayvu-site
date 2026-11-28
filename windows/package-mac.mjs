import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { packager } from '@electron/packager';
import { flipFuses, FuseVersion, FuseV1Options as Fuse } from '@electron/fuses';
import { sign } from '@electron/osx-sign';
import { stageDesktopSource } from './package-source.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const require = createRequire(import.meta.url);
const metadata = require('./package.json');
const version = metadata.version;
const build = String(metadata.buildNumber);
const destination = process.env.VAAYVU_PACKAGE_DIR || path.join(root, 'tests', 'test', version);
const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'vaayvu-chromium-mac-'));
const dockArtwork = path.join(root, 'branding', 'vaayvu-desktop.png');
const appIconArtwork = path.join(root, 'branding', 'vaayvu-appicon.png');
const appIconSquare = path.join(root, 'branding', 'vaayvu-appicon-full.png');
const dockPlugin = 'VaayvuDock.docktileplugin';

async function signingIdentity(kind, configured) {
  if (configured) return configured;
  const { stdout } = await exec('security', ['find-identity', '-v', '-p', kind === 'Application' ? 'codesigning' : 'basic']);
  const matches = [...stdout.matchAll(/"([^"\n]+)"/g)].map(match => match[1])
    .filter(identity => identity.startsWith('Developer ID ' + kind + ':'));
  if (matches.length !== 1) throw new Error('Select a Developer ID ' + kind + ' signing identity with VAAYVU_MAC_' + kind.toUpperCase() + '_IDENTITY.');
  return matches[0];
}

async function appIcons() {
  // The V/wind app icon is only used for the application icon. The Dock tile
  // keeps the browser-window artwork installed below.
  const input = path.join(work, 'icon-square.png');
  await exec('sips', ['--padToHeightWidth', '1024', '1024', appIconArtwork, '--out', input]);
  const set = path.join(work, 'Vaayvu.iconset');
  await fsp.mkdir(set);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = String(size * scale);
      const name = 'icon_' + size + 'x' + size + (scale === 2 ? '@2x' : '') + '.png';
      await exec('sips', ['-z', pixels, pixels, input, '--out', path.join(set, name)]);
    }
  }
  const icon = path.join(work, 'Vaayvu.icns');
  await exec('iconutil', ['-c', 'icns', set, '-o', icon]);
  const layered = path.join(work, 'Vaayvu.icon');
  await fsp.mkdir(path.join(layered, 'Assets'), { recursive: true });
  await fsp.copyFile(path.join(here, 'macos', 'icon.json'), path.join(layered, 'icon.json'));
  await fsp.copyFile(appIconSquare, path.join(layered, 'Assets', 'Window.png'));
  return [layered, icon];
}

async function installDockTile(app, identity) {
  const contents = path.join(app, 'Contents');
  await fsp.copyFile(dockArtwork, path.join(contents, 'Resources', 'VaayvuDock.png'));
  const plugin = path.join(contents, 'PlugIns', dockPlugin);
  const binary = path.join(plugin, 'Contents', 'MacOS', 'VaayvuDock');
  await fsp.mkdir(path.dirname(binary), { recursive: true });
  await fsp.copyFile(path.join(here, 'macos', 'DockTile-Info.plist'), path.join(plugin, 'Contents', 'Info.plist'));
  await exec('xcrun', ['--sdk', 'macosx', 'clang', '-bundle', '-arch', 'arm64', '-mmacosx-version-min=12.0',
    '-fobjc-arc', '-Os', '-framework', 'AppKit', path.join(here, 'macos', 'VaayvuDockTile.m'), '-o', binary]);
  await exec('codesign', ['--force', '--options', 'runtime', '--timestamp', '--sign', identity, plugin]);
}

try {
  const appIdentity = await signingIdentity('Application', process.env.VAAYVU_MAC_APPLICATION_IDENTITY);
  const installerIdentity = await signingIdentity('Installer', process.env.VAAYVU_MAC_INSTALLER_IDENTITY);
  const source = path.join(work, 'app');
  await stageDesktopSource(source);
  const [packaged] = await packager({
    dir: source,
    tmpdir: work,
    out: path.join(work, 'output'),
    name: 'Vaayvu',
    executableName: 'Vaayvu',
    electronVersion: metadata.devDependencies.electron,
    platform: 'darwin',
    arch: 'arm64',
    asar: true,
    asarIntegrityDigest: true,
    prune: false,
    appVersion: version,
    buildVersion: build,
    appBundleId: 'com.electron.vaayvu',
    icon: await appIcons(),
    extendInfo: { NSDockTilePlugIn: dockPlugin },
    download: { checksums: require('electron/checksums.json') },
  });
  const app = packaged.endsWith('.app') ? packaged : path.join(packaged, 'Vaayvu.app');
  const notices = path.join(app, 'Contents', 'Resources');
  await fsp.copyFile(path.join(path.dirname(app), 'LICENSE'), path.join(notices, 'LICENSE.electron.txt'));
  await fsp.copyFile(path.join(path.dirname(app), 'LICENSES.chromium.html'), path.join(notices, 'LICENSES.chromium.html'));
  const executable = path.join(app, 'Contents', 'MacOS', 'Vaayvu');
  await flipFuses(executable, {
    version: FuseVersion.V1,
    [Fuse.RunAsNode]: false,
    [Fuse.EnableNodeOptionsEnvironmentVariable]: false,
    [Fuse.EnableNodeCliInspectArguments]: false,
    [Fuse.EnableEmbeddedAsarIntegrityValidation]: true,
    [Fuse.OnlyLoadAppFromAsar]: true,
    [Fuse.GrantFileProtocolExtraPrivileges]: false,
  });
  await installDockTile(app, appIdentity);
  // The Dock loads this plug-in separately. Its signature needs no Electron entitlements.
  await sign({ app, identity: appIdentity, ignore: [/\/VaayvuDock\.docktileplugin\//],
    preAutoEntitlements: false, preEmbedProvisioningProfile: false, batchCodesignCalls: true });
  const staged = path.join(work, 'image');
  await fsp.mkdir(staged);
  await exec('ditto', ['--norsrc', '--noextattr', app, path.join(staged, 'Vaayvu.app')]);
  // Keep the receipt identifier stable and use the increasing build number for upgrades.
  const components = path.join(work, 'components.plist');
  await fsp.writeFile(components, JSON.stringify([{
    RootRelativeBundlePath: 'Vaayvu.app',
    BundleIsRelocatable: false,
    BundleIsVersionChecked: true,
    BundleHasStrictIdentifier: true,
    BundleOverwriteAction: 'upgrade',
  }]));
  await exec('plutil', ['-convert', 'xml1', components]);
  const unsigned = path.join(work, 'component.pkg');
  await exec('pkgbuild', ['--root', staged, '--component-plist', components, '--identifier', 'com.vaayvu.browser.chromium',
    '--version', build, '--install-location', '/Applications', unsigned]);
  const prefix = 'Vaayvu-' + version + '-macOS';
  const pkg = path.join(work, prefix + '.pkg');
  await exec('productbuild', ['--package', unsigned, '--sign', installerIdentity, pkg]);
  await exec('pkgutil', ['--check-signature', pkg]);
  await fsp.mkdir(destination, { recursive: true });
  await fsp.symlink('/Applications', path.join(staged, 'Applications'));
  const dmg = path.join(work, prefix + '.dmg');
  await exec('hdiutil', ['create', '-volname', 'Vaayvu ' + version, '-srcfolder', staged, '-format', 'UDZO', dmg]);
  await exec('codesign', ['--sign', appIdentity, '--timestamp', dmg]);
  await exec('codesign', ['--verify', '--strict', dmg]);
  await exec('hdiutil', ['verify', dmg]);
  for (const artifact of [dmg, pkg]) {
    const target = path.join(destination, path.basename(artifact));
    await fsp.rename(artifact, target);
    console.log(target);
  }
} finally {
  await fsp.rm(work, { recursive: true, force: true });
}
