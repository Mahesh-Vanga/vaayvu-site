'use strict';

// On macOS: node windows/test/package-parity.cjs <signed.dmg> [screenshots-directory]
// Use --source-only in place of the DMG to exercise the ordinary development entry point.
const assert = require('node:assert/strict');
const { execFile, spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');
const { chromium } = require('playwright');

const exec = promisify(execFile);
const desktop = path.resolve(__dirname, '..');
const version = require('../package.json').version;

async function waitFor(label, check) {
  const deadline = Date.now() + 18000;
  do {
    const result = await check();
    if (result) return result;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for ' + label);
}

async function withBrowser(executable, source, profile, check) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  await fs.rm(portFile, {force: true});
  const args = ['--user-data-dir=' + profile, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'];
  if (source) args.push(desktop);
  const child = spawn(executable, args, {stdio: 'ignore'});
  const exited = once(child, 'exit');
  let browser;
  try {
    const port = await waitFor('isolated browser debugging port', async () => {
      if (child.exitCode !== null) throw Error('Browser exited with code ' + child.exitCode);
      const data = await fs.readFile(portFile, 'utf8').catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return '';
      });
      return Number(data.split('\n')[0]);
    });
    const endpoint = 'http://127.0.0.1:' + port;
    browser = await chromium.connectOverCDP(endpoint);
    const pages = () => browser.contexts().flatMap(context => context.pages());
    const ui = await waitFor('Vaayvu shell', () => pages().find(page => page.url() === 'vaayvu://browser/index.html'));
    ui.setDefaultTimeout(10000);
    await ui.waitForFunction(() => typeof nativeReady !== 'undefined' && nativeReady);
    // Fresh profiles land on the first-run splash; release it before UI checks.
    await ui.evaluate(() => {
      document.documentElement.dataset.onboarding = 'hide';
      document.getElementById('onboarding')?.remove();
    });
    return await check({ui, pages, endpoint});
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child.exitCode === null && !child.signalCode) child.kill('SIGTERM');
    await exited;
  }
}

async function appearance(ui) {
  await ui.getByRole('button', {name: 'Browser menu', exact: true}).click();
  await ui.locator('#dialog [data-act="settings"]').click();
  await ui.locator('#dialog [data-act="pref-appearance"]').click();
}

async function savedTheme(ui, theme) {
  assert.equal(await ui.evaluate(() => settings.theme), theme);
  const applied = await ui.evaluate(() => document.documentElement.dataset.theme);
  const systemDark = await ui.evaluate(() => matchMedia('(prefers-color-scheme:dark)').matches);
  assert.equal(applied, theme === 'system' ? (systemDark ? 'dark' : 'light') : theme);
}

async function selectTheme(ui, theme) {
  await appearance(ui);
  await ui.locator('#preference-theme').selectOption(theme);
  await ui.getByRole('button', {name: 'Close dialog', exact: true}).click();
  await savedTheme(ui, theme);
  assert.equal(await ui.evaluate(() => JSON.parse(localStorage.getItem('vaayvu.settings')).theme), theme);
}

async function screenshotStartup(ui, screenshots, name) {
  if (!screenshots) return;
  await fs.mkdir(screenshots, {recursive: true});
  await ui.screenshot({path: path.join(screenshots, name + ' startup.png'), animations: 'disabled', caret: 'hide'});
}

function startupState() {
  const box = selector => {
    const {x, y, width, height} = document.querySelector(selector).getBoundingClientRect();
    return [x, y, width, height];
  };
  return {
    version: BROWSER_VERSION, view, title: current().title, theme: settings.theme,
    appearance: document.documentElement.dataset.theme, position: settings.tabPosition,
    tabs: tabs.length, strip: box('#top-tabs'), firstTab: box('.strip-tab.chosen'),
    toolbar: box('#toolbar'), rail: box('#rail'), screen: [innerWidth, innerHeight],
    library: [...document.querySelectorAll('#rail nav [data-view]')].map(node => node.getAttribute('aria-label')),
  };
}

async function verifyTabs(ui, width, height) {
  for (const position of ['bottom', 'left', 'right', 'top']) {
    await appearance(ui);
    await ui.locator('#preference-tabPosition').selectOption(position);
    await ui.getByRole('button', {name: 'Close dialog', exact: true}).click();
    const strip = ui.locator('#top-tabs');
    if (position === 'bottom' || position === 'top') {
      const box = await strip.boundingBox();
      assert.ok(box);
      assert.equal(position === 'top' ? box.y : box.y + box.height, position === 'top' ? 0 : height);
    } else {
      assert.equal(await strip.isVisible(), false);
      const box = await ui.locator('#side-tabs').boundingBox();
      assert.equal(position === 'left' ? box.x : box.x + box.width, position === 'left' ? 68 : width);
    }
  }
}

async function exercise({ui, pages, endpoint}, url, screenshots, name) {
  const state = await ui.evaluate(startupState);
  assert.equal(state.version, version);
  assert.equal(state.theme, 'light');
  assert.equal(state.appearance, 'light');
  assert.equal(state.position, 'top');
  assert.equal(state.strip[1], 0);
  assert.equal(state.strip[3], 36);
  assert.equal(state.firstTab[0], 78);
  assert.equal(state.rail[2], 68);
  assert.deepEqual(state.library, ['Start page', 'Bookmarks', 'History', 'Other devices']);
  await screenshotStartup(ui, screenshots, name);
  await ui.getByRole('button', {name: 'Close sidebar', exact: true}).filter({visible: true}).first().click();
  await ui.waitForFunction(() => document.querySelector('#rail').inert);
  await ui.getByRole('button', {name: 'Open sidebar', exact: true}).click();
  await ui.waitForFunction(() => !document.querySelector('#rail').inert);
  await verifyTabs(ui, ...state.screen);

  await ui.locator('#address').fill(url);
  await ui.locator('#address').press('Enter');
  await ui.waitForFunction(() => current()?.title === 'Release UI check' && pageInspector.available());
  const site = await waitFor('native webpage target', () => pages().find(page => page.url() === url));
  assert.equal(await site.locator('h1').textContent(), 'Local inspection fixture');
  const siteWidth = await site.evaluate(() => innerWidth);
  await ui.locator('.desktop-shield').click();
  const shield = await ui.locator('#dialog').evaluate(node => {
    const r = node.getBoundingClientRect();
    return [r.width, innerWidth - r.right, r.top - document.querySelector('#toolbar').getBoundingClientRect().bottom,
      node.querySelectorAll('[role="switch"]').length];
  });
  assert.deepEqual(shield, [380, 12, 8, 5]);
  await ui.getByRole('button', {name: 'Close dialog', exact: true}).click();
  await ui.getByRole('button', {name: 'Browser menu', exact: true}).click();
  await ui.getByRole('button', {name: 'More tools', exact: true}).click();
  await ui.getByRole('button', {name: 'Inspect page', exact: true}).click();
  await site.waitForFunction(before => innerWidth < before, siteWidth);
  const frontend = await waitFor('bundled Chromium inspector', async () => {
    const targets = await (await fetch(endpoint + '/json/list')).json();
    return targets.find(target => target.url.startsWith('devtools://devtools/bundled/'));
  });
  console.log(name + ' opened ' + new URL(frontend.url).pathname + ' docked on the live fixture.');
  await selectTheme(ui, 'dark');
  return {state, shield};
}

async function verify(name, executable, source, root, url, screenshots) {
  const profile = await fs.mkdtemp(path.join(root, name + '-'));
  const result = await withBrowser(executable, source, profile, run => exercise(run, url, screenshots, name));
  await withBrowser(executable, source, profile, async ({ui}) => {
    await savedTheme(ui, 'dark');
    await selectTheme(ui, 'system');
  });
  await withBrowser(executable, source, profile, ({ui}) => savedTheme(ui, 'system'));
  console.log(name + ' preserved Dark and Follow device across two relaunches.', JSON.stringify(result));
  return result;
}

async function main() {
  const [image, screenshots] = process.argv.slice(2);
  if (!image) throw Error('Provide a signed DMG path or --source-only.');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vaayvu-parity-'));
  const volume = path.join(root, 'mount');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end('<!doctype html><title>Release UI check</title><h1>Local inspection fixture</h1>');
  });
  let attached = false;
  try {
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    const fixture = 'http://127.0.0.1:' + server.address().port + '/';
    const source = await verify('Source', require('electron'), true, root, fixture, screenshots);
    if (image === '--source-only') return;
    const dmg = path.resolve(image);
    await exec('codesign', ['--verify', '--strict', dmg]);
    await fs.mkdir(volume);
    await exec('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', volume, dmg]);
    attached = true;
    const bundle = path.join(volume, 'Vaayvu.app');
    await exec('codesign', ['--verify', '--deep', '--strict', bundle]);
    const app = path.join(bundle, 'Contents/MacOS/Vaayvu');
    const installed = await verify('Installed', app, false, root, fixture, screenshots);
    assert.deepEqual(installed, source, 'Signed app and ordinary source startup render the same browser controls');
    console.log('Source and signed DMG passed startup, layout, native navigation, blocker, Inspect and preference parity.');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (attached) await waitFor('the test disk image to eject', async () => {
      try {
        await exec('hdiutil', ['detach', volume]);
        return true;
      } catch (error) {
        if (/resource busy/i.test(error.stderr)) return false;
        throw error;
      }
    });
    await fs.rm(root, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
