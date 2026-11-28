'use strict';

// P05 native download assertion: real Electron DownloadItem, save-dialog
// options, deterministic destination, cancel and partial-file cleanup.
// Run with Electron:
//   windows/node_modules/.bin/electron windows/test/downloads.cjs

const { app, protocol } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { BrowserHost } = require('../host.cjs');

const providedProfile = process.env.VAAYVU_SMOKE_PROFILE;
const profile = providedProfile || fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-downloads-'));
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-downloads-out-'));
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
  const payload = Buffer.from('vaayvu-download-payload\n');
  const slowBytes = Buffer.alloc(8192, 7);
  const timers = new Set();
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/slow.bin')) {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="slow.bin"',
        'Content-Length': String(1024 * 1024),
        'Cache-Control': 'no-store',
      });
      const timer = setInterval(() => {
        if (!res.write(slowBytes)) return;
      }, 20);
      timers.add(timer);
      res.on('close', () => {
        clearInterval(timer);
        timers.delete(timer);
      });
      return;
    }
    if (req.url === '/ok.txt') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="ok.txt"',
        'Content-Length': String(payload.length),
        'Cache-Control': 'no-store',
      });
      res.write(payload.subarray(0, 6));
      setTimeout(() => res.end(payload.subarray(6)), 250);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  const items = [];
  const done = [];
  const waiters = [];
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), {
    show: false,
    downloadDir,
    onDownload: (item, tab) => {
      items.push({ item, tab });
      const waiter = waiters.shift();
      if (waiter) waiter(item);
    },
    onDownloadDone: (item, state, tab) => done.push({ item, state, tab, savePath: item.getSavePath() }),
  });
  const ui = (code) => host.ui.executeJavaScript(code);
  const nextItem = () => new Promise((resolve) => waiters.push(resolve));
  const navigate = async (url) => {
    await ui(
      'document.querySelector("#address").value=' +
        JSON.stringify(url) +
        ';document.querySelector("#address-form").requestSubmit()',
    );
  };

  try {
    await until(() => ui('typeof nativeReady !== "undefined" && nativeReady').catch(() => false), 'chrome ready');
    await ui(
      'window.received=[];const originalVaayvuEvent=window.vaayvuEvent;' +
        'window.vaayvuEvent=(message)=>{received.push(message);originalVaayvuEvent(message)};void 0',
    );
    await ui('VaayvuPreferences.commit({ordinaryWeb:true})');
    await until(() => host.enabled, 'ordinary web enabled');

    // 1. A real download reaches will-download, sets save-dialog options, uses
    // the deterministic destination, completes and reports the event.
    const first = nextItem();
    await navigate(base + '/ok.txt');
    const item = await first;
    assert.ok(item, 'download item created');
    assert.equal(host.downloads.has(item), true);
    const dialog = item.getSaveDialogOptions();
    assert.equal(dialog.title, 'Save download');
    assert.ok(item.getSavePath().startsWith(downloadDir), 'deterministic save path');
    await until(() => done.length === 1, 'first download done');
    assert.equal(done[0].state, 'completed');
    assert.deepEqual(fs.readFileSync(done[0].savePath), payload);
    await until(
      () => ui('received.some(m=>m.type==="download"&&m.name==="ok.txt"&&!m.private)'),
      'download event',
    );
    assert.equal(host.downloads.size, 0);

    // 2. Cancel keeps the in-flight set consistent and removes the partial file.
    const second = nextItem();
    await navigate(base + '/slow.bin');
    const slow = await second;
    assert.equal(host.downloads.has(slow), true);
    const slowPath = slow.getSavePath();
    slow.cancel();
    await until(() => done.length === 2, 'cancel done');
    assert.equal(done[1].state, 'cancelled');
    assert.equal(fs.existsSync(slowPath), false, 'final file removed');
    assert.equal(fs.existsSync(slowPath + '.crdownload'), false, 'partial file removed');
    assert.equal(host.downloads.size, 0);
    await pause(250);
    assert.equal(
      await ui('received.some(m=>m.type==="download"&&m.url.includes("/slow.bin"))'),
      false,
      'cancelled download is not reported as completed',
    );

    // 3. Teardown/restrict cancels any remaining download instead of leaking it.
    const third = nextItem();
    await navigate(base + '/slow.bin?2');
    const lingering = await third;
    host.restrict();
    await until(() => done.length === 3, 'restrict cancel done');
    assert.equal(done[2].state, 'cancelled');
    assert.equal(host.downloads.size, 0);
    assert.equal(fs.existsSync(lingering.getSavePath()), false);

    console.log(
      JSON.stringify({
        downloads: items.length,
        completed: done.filter((entry) => entry.state === 'completed').length,
        cancelled: done.filter((entry) => entry.state === 'cancelled').length,
        dialog: dialog.title,
        destination: path.basename(done[0].savePath),
      }),
    );
    if (providedProfile) fs.writeFileSync(path.join(profile, 'smoke-passed'), 'downloads');
  } finally {
    for (const timer of timers) clearInterval(timer);
    try {
      host.dispose();
    } catch (error) {}
    server.close();
    if (!providedProfile) fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(downloadDir, { recursive: true, force: true });
    app.quit();
  }
}

app.whenReady().then(run).catch((error) => {
  console.error(error);
  app.exit(1);
});
