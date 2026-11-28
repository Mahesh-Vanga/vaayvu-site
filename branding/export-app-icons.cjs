'use strict';

// Render the Vaayvu app icon from the owner's V/wind artwork.
//
// This artwork is only an application icon: the browser chrome, window, Dock
// tile and launch screens keep their own branding. Run `node
// branding/export-app-icons.cjs` from the project root to refresh the checked-in
// icons before a build.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.dirname(__dirname);
const master = path.join(__dirname, 'Vaayvu_V_Wind_16K.svg');
const appleIcon = path.join(root, 'apple', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-nodpi');
const appleSplash = path.join(root, 'apple', 'Assets.xcassets', 'VaayvuSplash.imageset');
const macIcon = path.join(__dirname, 'vaayvu-appicon.png');
const squareIcon = path.join(__dirname, 'vaayvu-appicon-full.png');

function viewport(source, box, width, height) {
  return source.replace(/<svg\b[^>]*>/, tag => tag
    .replace(/\bwidth="[^"]*"/, 'width="' + width + '"')
    .replace(/\bheight="[^"]*"/, 'height="' + height + '"')
    .replace(/\bviewBox="[^"]*"/, 'viewBox="' + box + '"'));
}

// The source draws a rounded tile inside a transparent margin. Apple and
// Android apply their own icon masks, so replace the tile outline with a square
// that reaches every edge and crop the viewport to it. The V and wind stay
// centred inside the mask's safe area.
function fullBleed(source) {
  const fill = source.indexOf('fill="url(#tile)"');
  if (fill < 0) throw Error('The rounded app icon tile is required');
  const start = source.lastIndexOf('<path', fill);
  const end = source.indexOf('/>', fill) + 2;
  if (start < 0 || end < 2) throw Error('The rounded app icon tile is malformed');
  let square = source.slice(0, start) +
    '<rect x="79" y="97" width="1080" height="1086" fill="url(#tile)"/>' + source.slice(end);
  // The corner clip only existed to round the tile; the square needs the full
  // light wash up to every edge.
  square = square.replace('<g clip-path="url(#tileClip)">', '<g>');
  // The platform supplies the icon edge, so drop the tile's inner highlight.
  const shine = square.indexOf('stroke="url(#innerEdge)"');
  if (shine > 0) {
    const shineStart = square.lastIndexOf('<path', shine);
    square = square.slice(0, shineStart) + square.slice(square.indexOf('/>', shine) + 2);
  }
  return viewport(square, '79 97 1080 1086', 1080, 1086);
}

// Android draws an adaptive icon from separate layers. The background is the
// tile's gradient without the monogram; the foreground is the V and wind alone.
// The 1623-unit viewport maps the lockup to 84% of the launcher's visible 72dp
// safe area, matching its proportion on the square tile.
const ANDROID_FOREGROUND_BOX = '-182 -132 1623 1623';
function androidBackground(source) {
  const square = fullBleed(source);
  const monogram = square.indexOf('<g id="vaayvu-v"');
  if (monogram < 0) throw Error('The V monogram is required');
  return square.slice(0, monogram) + '</svg>\n';
}

function androidForeground(source) {
  const start = source.indexOf('<g id="app-icon-background">');
  const end = source.indexOf('<!-- Vaayvu V monogram -->');
  if (start < 0 || end < 0) throw Error('The app icon background is required');
  return viewport(source.slice(0, start) + source.slice(end), ANDROID_FOREGROUND_BOX, 1623, 1623);
}

async function render(page, source, box, size, transparent) {
  const svg = viewport(source, box, size, size);
  const url = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    '<style>html,body{margin:0;width:100%;height:100%;background:transparent}img{display:block;width:100%;height:100%}</style>' +
    '<img alt="" src="' + url + '">');
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ type: 'png', omitBackground: transparent });
}

async function main() {
  const source = await fs.readFile(master, 'utf8');
  await fs.mkdir(androidRes, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await fs.writeFile(macIcon, await render(page, source, '0 0 1254 1254', 1024, true));
    const square = fullBleed(source);
    await fs.writeFile(squareIcon, await render(page, square, '79 97 1080 1086', 1024, false));
    await fs.writeFile(appleIcon, await render(page, square, '79 97 1080 1086', 1024, false));
    await fs.writeFile(path.join(androidRes, 'vaayvu_appicon_back_img.png'),
      await render(page, androidBackground(source), '79 97 1080 1086', 648, false));
    await fs.writeFile(path.join(androidRes, 'vaayvu_appicon_glyph_img.png'),
      await render(page, androidForeground(source), ANDROID_FOREGROUND_BOX, 648, true));
    // Splash screens reuse the same V/wind lockup: a 648px glyph for Android
    // and 1x/2x/3x variants for the iPhone launch screen and privacy cover.
    const splash = await render(page, androidForeground(source), ANDROID_FOREGROUND_BOX, 648, true);
    await fs.writeFile(path.join(androidRes, 'vaayvu_splash_img.png'), splash);
    await fs.mkdir(appleSplash, { recursive: true });
    await fs.writeFile(path.join(appleSplash, 'splash@3x.png'), splash);
    await fs.writeFile(path.join(appleSplash, 'splash@2x.png'),
      await render(page, androidForeground(source), ANDROID_FOREGROUND_BOX, 432, true));
    await fs.writeFile(path.join(appleSplash, 'splash.png'),
      await render(page, androidForeground(source), ANDROID_FOREGROUND_BOX, 216, true));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
