import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { packager } from '@electron/packager';
import { flipFuses, FuseVersion, FuseV1Options as Fuse } from '@electron/fuses';
import yazl from 'yazl';
import { stageDesktopSource } from './package-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(here);
const require = createRequire(import.meta.url);
const metadata = require('./package.json');
const version = metadata.version;
const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'vaayvu-package-'));
const destination = process.env.VAAYVU_PACKAGE_DIR || path.join(root, 'tests', 'test', version);
const target = path.join(destination, 'Vaayvu-' + version + '-Windows-x64.zip');
const pending = target + '.' + process.pid + '.tmp';
try {
  const source = path.join(work, 'app');
  await stageDesktopSource(source);
  const [folder] = await packager({
    dir: source,
    tmpdir: work,
    out: path.join(work, 'output'),
    name: 'Vaayvu',
    executableName: 'Vaayvu',
    electronVersion: metadata.devDependencies.electron,
    platform: 'win32',
    arch: 'x64',
    asar: true,
    asarIntegrityDigest: true,
    prune: false,
    appVersion: version,
    buildVersion: version + '.' + metadata.buildNumber,
    icon: path.join(here, 'vaayvu.ico'),
    download: { checksums: require('electron/checksums.json') },
    win32metadata: {
      CompanyName: 'Vaayvu',
      ProductName: 'Vaayvu',
      FileDescription: 'Vaayvu Browser',
      OriginalFilename: 'Vaayvu.exe',
    },
  });
  await flipFuses(path.join(folder, 'Vaayvu.exe'), {
    version: FuseVersion.V1,
    [Fuse.RunAsNode]: false,
    [Fuse.EnableNodeOptionsEnvironmentVariable]: false,
    [Fuse.EnableNodeCliInspectArguments]: false,
    [Fuse.EnableEmbeddedAsarIntegrityValidation]: true,
    [Fuse.OnlyLoadAppFromAsar]: true,
    [Fuse.GrantFileProtocolExtraPrivileges]: false,
  });
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const zip = new yazl.ZipFile();
  async function addFiles(current) {
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await addFiles(file);
      else if (entry.isFile()) zip.addFile(file, 'Vaayvu/' + path.relative(folder, file).split(path.sep).join('/'));
    }
  }
  await addFiles(folder);
  const completed = pipeline(zip.outputStream, fs.createWriteStream(pending, { flags: 'wx' }));
  zip.end();
  await completed;
  await fsp.rename(pending, target);
  console.log(target);
} finally {
  await fsp.rm(pending, { force: true });
  await fsp.rm(work, { recursive: true, force: true });
}
