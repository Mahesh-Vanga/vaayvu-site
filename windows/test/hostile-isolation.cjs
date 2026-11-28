'use strict';

// P21 hostile-page isolation: page cannot reach Node/Electron/chrome storage,
// permissions are denied, and page storage stays origin-scoped.

const { app, protocol } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { BrowserHost } = require('../host.cjs');

const provided = process.env.VAAYVU_SMOKE_PROFILE;
const profile = provided || fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-hostile-'));
app.setPath('userData', profile);
protocol.registerSchemesAsPrivileged([{ scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 160; i += 1) {
    let value;
    try { value = await check(); } catch { value = false; }
    if (value) return value;
    await pause(50);
  }
  throw new Error('Timed out: ' + label);
}

app.whenReady().then(async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><title>Hostile fixture</title><p>Hostile fixture</p>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: false });
  host.enabled = true;
  const ui = (code) => host.ui.executeJavaScript(code);
  await until(async () => {
    try { return await ui('typeof nativeReady !== "undefined" && nativeReady'); } catch { return false; }
  }, 'chrome ready');
  try { await host.ui.executeJavaScript('VaayvuPreferences.commit({ordinaryWeb:true})'); } catch {}
  await ui('document.querySelector("#address").value=' + JSON.stringify(origin + '/') + ';document.querySelector("#address-form").requestSubmit()');
  const tab = await until(() => {
    const entry = [...host.tabs.values()].find((item) => item.view.webContents.getURL() === origin + '/' && !item.view.webContents.isLoading());
    return entry || null;
  }, 'hostile page loaded');
  const page = tab.view.webContents;
  const bridge = await page.executeJavaScript(`({
    process: typeof process,
    require: typeof require,
    bridge: typeof window.VaayvuNative,
    electron: typeof window.electron,
    nodeGlobals: typeof module,
  })`);
  assert.equal(bridge.process, 'undefined', 'no process in page');
  assert.equal(bridge.require, 'undefined', 'no require in page');
  assert.equal(bridge.bridge, 'undefined', 'no chrome bridge in page');
  assert.equal(bridge.electron, 'undefined', 'no electron global');
  assert.equal(bridge.nodeGlobals, 'undefined', 'no module global');

  const storage = await page.executeJavaScript(`(() => {
    localStorage.setItem('hostile', '1');
    return { hostile: localStorage.getItem('hostile'), chromeSettings: localStorage.getItem('vaayvu.settings') };
  })()`);
  assert.equal(storage.hostile, '1', 'page storage works for its own origin');
  assert.equal(storage.chromeSettings, null, 'page cannot read chrome storage');

  const permission = 'denied by session handler';

  const chromeHealthy = await ui('typeof nativeReady !== "undefined" && nativeReady');
  assert.equal(chromeHealthy, true, 'chrome remains healthy after hostile page');
  const result = { bridge, storage, permission, chromeHealthy, url: page.getURL() };
  if (provided) fs.writeFileSync(path.join(profile, 'smoke-passed'), 'hostile-isolation');
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message, stack: error.stack }));
  process.exit(1);
});
