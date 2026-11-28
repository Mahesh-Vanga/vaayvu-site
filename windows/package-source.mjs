import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const require = createRequire(import.meta.url);
const metadata = require('./package.json');

// Only runtime modules belong in the signed app, never packaging tools or tests.
export const runtimeFiles = ['main.cjs', 'preload.cjs', 'host.cjs', 'policy.cjs', 'india-search.cjs', 'desktop-windows.cjs', 'domain/store.cjs'];

export async function stageDesktopSource(destination) {
  await fs.mkdir(destination);
  for (const file of runtimeFiles) {
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(here, file), target);
  }
  let region;
  try {
    const raw = await fs.readFile(path.join(root, 'search', 'client-deployment.json'), 'utf8');
    region = raw.length <= 8192 && require('./india-search.cjs').deployment(JSON.parse(raw));
    if (!region) throw new Error('The search deployment manifest is invalid or expired.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const { name, productName, version, main, description, license } = metadata;
  await fs.writeFile(path.join(destination, 'package.json'), JSON.stringify({
    name, productName, version, main, description, license,
    ...(region && { vaayvuIndiaSearch: region }),
  }));
  await fs.cp(path.join(root, 'chrome'), path.join(destination, 'chrome'), {
    recursive: true,
    filter: file => !path.basename(file).startsWith('.'),
  });
}
