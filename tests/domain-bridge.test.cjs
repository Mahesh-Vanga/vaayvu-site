'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const read = (file) => readFileSync(require.resolve('../' + file), 'utf8');

test('preload exposes the synchronous SQLite storage bridge', () => {
  const preload = read('windows/preload.cjs');
  assert.match(preload, /exposeInMainWorld\('VaayvuStore'/);
  assert.match(preload, /sendSync\('vaayvu:store-get'/);
  assert.match(preload, /sendSync\('vaayvu:store-set'/);
  assert.match(preload, /sendSync\('vaayvu:store-remove'/);
  assert.match(preload, /sendSync\('vaayvu:store-keys'/);
  assert.match(preload, /sendSync\('vaayvu:store-import'/);
});

test('Electron host owns the SQLite store and validates the frame', () => {
  const host = read('windows/host.cjs');
  assert.match(host, /require\('\.\/domain\/store\.cjs'\)/);
  assert.match(host, /new BrowserStore\(path\.join\(app\.getPath\('userData'\), 'vaayvu\.sqlite'\)\)/);
  assert.match(host, /ipcMain\.on\('vaayvu:store-get'/);
  assert.match(host, /ipcMain\.on\('vaayvu:store-set'/);
  assert.match(host, /ipcMain\.on\('vaayvu:store-remove'/);
  assert.match(host, /ipcMain\.on\('vaayvu:store-keys'/);
  assert.match(host, /ipcMain\.on\('vaayvu:store-import'/);
  assert.match(host, /event\.senderFrame\.url === HOME/);
  assert.match(host, /domainStore\.beginSession\(\)/);
  assert.match(host, /recoverPreviousSessions\(\)/);
});

test('a native Electron suite proves the renderer key lives in SQLite', () => {
  const native = read('windows/test/domain-store.cjs');
  assert.match(native, /localStorage instanceof Storage/);
  assert.match(native, /SELECT value FROM key_values/);
  assert.match(read('windows/test/run.cjs'), /'domain-store'/);
});

test('the UI swaps localStorage before the boot gate runs', () => {
  const html = read('chrome/index.html');
  assert.ok(html.indexOf('src="native-store.js"') > 0);
  assert.ok(html.indexOf('src="native-store.js"') < html.indexOf('src="boot.js"'));
  const script = read('chrome/native-store.js');
  assert.match(script, /VaayvuStore/);
  assert.match(script, /defineProperty\(window, 'localStorage'/);
  assert.match(script, /importLegacy\(entries\)/);
});
