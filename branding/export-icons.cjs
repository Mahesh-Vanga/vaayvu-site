'use strict';

// Regenerate the desktop and shared images from the owner's editable SVG.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.dirname(__dirname);
const master = path.join(__dirname, 'Vaayvu_16K_Vector_Transparent.svg');
const webAssets = path.join(root, 'chrome', 'assets');
const windowBox = '90 119 1076 1022';

function viewport(source, box, width, height) {
  return source.replace(/<svg\b[^>]*>/, tag => tag
    .replace(/\bwidth="[^"]*"/, 'width="' + width + '"')
    .replace(/\bheight="[^"]*"/, 'height="' + height + '"')
    .replace(/\bviewBox="[^"]*"/, 'viewBox="' + box + '"'));
}

// Fill the parts of a square launcher mask outside the tab contour with
// the adjacent window colors. Interior pixels retain their original colors.
async function launcherImage(window) {
  const { data, info } = await sharp(window).resize(1024, 1024, { fit: 'cover' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgb = Buffer.alloc(info.width * info.height * 3);
  const pixel = (x, y) => (y * info.width + x) * 4;
  for (let x = 0; x < info.width; x++) {
    let first = 0, last = info.height - 1;
    while (first <= last && data[pixel(x, first) + 3] < 250) first++;
    if (first > last) throw Error('A launcher column has no artwork');
    while (last > first && data[pixel(x, last) + 3] < 250) last--;
    for (let y = 0; y < info.height; y++) {
      const src = pixel(x, Math.min(last, Math.max(first, y)));
      data.copy(rgb, (y * info.width + x) * 3, src, src + 3);
    }
  }
  return sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

async function windowsIcon(window) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const entries = await Promise.all(sizes.map(size => sharp(window)
    .resize(size, size, { fit: 'contain', background: '#0000' }).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  for (const [index, entry] of entries.entries()) {
    const i = 6 + index * 16;
    header[i] = header[i + 1] = sizes[index] % 256;
    header.writeUInt16LE(1, i + 4);
    header.writeUInt16LE(32, i + 6);
    header.writeUInt32LE(entry.length, i + 8);
    header.writeUInt32LE(offset, i + 12);
    offset += entry.length;
  }
  return Buffer.concat([header, ...entries]);
}

function themedMark(source) {
  const paths = [...source.matchAll(/<path\b([^>]+)>/g)].map(match => match[1]);
  const outline = /<clipPath id="vClip"><path d="([^"]+)"/.exec(source)?.[1];
  const ribbon = fill => paths.find(tag => tag.includes('fill="url(#' + fill + ')"'))?.match(/\bd="([^"]+)"/)?.[1];
  const upper = ribbon('topAir'), lower = ribbon('lowerAir'), gap = ribbon('whiteAir');
  if (![outline, upper, lower, gap].every(Boolean)) throw Error('The V and ribbon paths are required');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="802" height="520" viewBox="240 458 802 520">\n' +
    '  <title>Vaayvu themed icon</title>\n' +
    '  <defs><mask id="ribbon-gap" maskUnits="userSpaceOnUse" x="240" y="458" width="802" height="520">\n' +
    '    <rect x="240" y="458" width="802" height="520" fill="white"/><path d="' + gap + '" fill="black"/>\n' +
    '  </mask></defs>\n  <g fill="white" mask="url(#ribbon-gap)">\n' +
    [outline, upper, lower].map(d => '    <path d="' + d + '"/>').join('\n') + '\n  </g>\n</svg>\n';
}

async function main() {
  const source = await fs.readFile(master, 'utf8');
  const fitted = viewport(source, windowBox, 1076, 1022);
  const render = Buffer.from(viewport(source, windowBox, 2152, 2044));
  const window = await sharp(render).resize({ width: 1024 }).png().toBuffer();
  await fs.writeFile(path.join(webAssets, 'vaayvu.svg'), fitted);
  await fs.writeFile(path.join(__dirname, 'vaayvu-mark.svg'), themedMark(source));
  await fs.writeFile(path.join(__dirname, 'vaayvu-desktop.png'), window);
  await fs.writeFile(path.join(__dirname, 'vaayvu-1024.png'), await launcherImage(window));
  await sharp(render).resize(256, 256, { fit: 'contain', background: '#0000' })
    .png().toFile(path.join(webAssets, 'vaayvu.png'));
  await fs.writeFile(path.join(root, 'windows', 'vaayvu.ico'), await windowsIcon(window));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
