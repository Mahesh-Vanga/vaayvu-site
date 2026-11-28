import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import yazl from 'yazl';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const { version } = JSON.parse(await fsp.readFile(path.join(here, 'package.json'), 'utf8'));
const folder = process.env.VAAYVU_PACKAGE_DIR || path.join(root, 'tests', 'test', version);
const target = path.join(folder, 'Vaayvu-' + version + '-Source.zip');
const pending = target + '.' + process.pid + '.tmp';
const zip = new yazl.ZipFile();
const prefix = 'Vaayvu-' + version + '/';

async function add(relative) {
  const source = path.join(root, relative);
  const details = await fsp.lstat(source);
  if (details.isDirectory()) {
    for (const name of (await fsp.readdir(source)).sort()) {
      if (!name.startsWith('.') && name !== 'node_modules') await add(path.posix.join(relative, name));
    }
  } else if (details.isFile()) {
    zip.addFile(source, prefix + relative, { mode: details.mode & 0o111 ? 0o100755 : 0o100644 });
  }
}

await fsp.mkdir(folder, { recursive: true });
try {
  // Keep release inputs explicit. Installed dependencies, keys and local configurations stay outside the archive.
  for (const item of [
    'README.md', 'LICENSE', '.gitignore', '.github/workflows/build.yml',
    'chrome', 'branding', 'docs', 'examples/README.md', 'examples/Wikipedia-Reading-Type.zip',
    'search/.gitignore', 'search/README.md', 'search/client-deployment.example.json', 'search/site-directory.py', 'search/topic-directory.py',
    'sync/server.mjs', 'sync/README.md', 'sync/client.test.mjs', 'sync/server.test.mjs', 'sync/deploy',
    'android/.gitignore', 'android/README.md', 'android/gradlew', 'android/gradlew.bat', 'android/gradle.properties',
    'android/settings.gradle', 'android/gradle/wrapper', 'android/app/build.gradle', 'android/app/src',
    'apple/Sources', 'apple/Tests', 'apple/Assets.xcassets', 'apple/project.yml',
    'apple/iOS-Info.plist', 'apple/scripts/package.sh', 'apple/scripts/search-plist.py',
    'apple/Vaayvu.xcodeproj/project.pbxproj', 'apple/Vaayvu.xcodeproj/xcshareddata/xcschemes',
    'apple/Vaayvu.xcodeproj/project.xcworkspace/contents.xcworkspacedata',
    'windows/test', 'windows/macos',
  ]) await add(item);
  for (const name of (await fsp.readdir(here)).sort()) {
    if (/\.(cjs|mjs|ico)$/.test(name) || ['package.json', 'package-lock.json', 'README.md'].includes(name)) {
      await add('windows/' + name);
    }
  }
  for (const name of (await fsp.readdir(path.join(root, 'tests'))).sort()) {
    if (name.endsWith('.cjs')) await add('tests/' + name);
  }
  const written = pipeline(zip.outputStream, fs.createWriteStream(pending, { flags: 'wx' }));
  zip.end();
  await written;
  await fsp.rename(pending, target);
  console.log(target);
} finally {
  await fsp.rm(pending, { force: true });
}
