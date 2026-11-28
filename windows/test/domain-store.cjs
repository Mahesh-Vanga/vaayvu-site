'use strict';

// P04 shipping integration: prove the Electron renderer writes durable state
// through the SQLite bridge rather than Chromium's native Storage object.
// Run with Electron:
//   windows/node_modules/.bin/electron windows/test/domain-store.cjs

const { app, protocol } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { BrowserHost } = require('../host.cjs');

const providedProfile = process.env.VAAYVU_SMOKE_PROFILE;
const profile = providedProfile || fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-domain-'));
app.setPath('userData', profile);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  { scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 200; i += 1) {
    const value = await check();
    if (value) return value;
    await pause(50);
  }
  throw new Error('Timed out: ' + label);
}

async function run() {
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: false });
  const ui = (code) => host.ui.executeJavaScript(code);
  const dbFile = path.join(profile, 'vaayvu.sqlite');
  try {
    await until(() => ui('typeof nativeReady !== "undefined" && nativeReady').catch(() => false), 'chrome ready');
    await ui('VaayvuPreferences.commit({ordinaryWeb:true})');
    await until(() => host.enabled, 'ordinary web enabled');

    const shape = await ui(
      '({bridge:typeof window.VaayvuStore,available:!!window.VaayvuStore?.available,' +
        'nativeStorage:window.localStorage instanceof Storage})',
    );
    assert.equal(shape.bridge, 'object', 'VaayvuStore is exposed');
    assert.equal(shape.available, true);
    assert.equal(shape.nativeStorage, false, 'localStorage is the SQLite shim, not Storage');

    const value = JSON.stringify({ version: 1, probe: 'sqlite', at: Date.now() });
    await ui('localStorage.setItem("vaayvu.p04-bridge", ' + JSON.stringify(value) + ')');
    assert.equal(await ui('localStorage.getItem("vaayvu.p04-bridge")'), value);
    assert.equal(await ui('localStorage.length >= 1 && localStorage.key(0) !== null'), true);

    const db = new DatabaseSync(dbFile);
    const row = db.prepare('SELECT value FROM key_values WHERE key = ?').get('vaayvu.p04-bridge');
    assert.ok(row, 'key exists in the SQLite key_values table');
    assert.equal(row.value, value);
    const sessions = db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
    assert.ok(sessions >= 1, 'a session journal row exists');
    db.close();

    await ui('localStorage.removeItem("vaayvu.p04-bridge")');
    const after = new DatabaseSync(dbFile);
    assert.equal(after.prepare('SELECT value FROM key_values WHERE key = ?').get('vaayvu.p04-bridge'), undefined);
    after.close();

    console.log(
      JSON.stringify({
        bridge: shape.bridge,
        nativeStorage: shape.nativeStorage,
        keysTable: true,
        sessionRows: sessions,
        removed: true,
      }),
    );
    if (providedProfile) fs.writeFileSync(path.join(profile, 'smoke-passed'), 'domain-store');
  } finally {
    try {
      host.dispose();
    } catch (error) {}
    if (!providedProfile) fs.rmSync(profile, { recursive: true, force: true });
    app.quit();
  }
}

app.whenReady().then(run).catch((error) => {
  console.error(error);
  app.exit(1);
});
