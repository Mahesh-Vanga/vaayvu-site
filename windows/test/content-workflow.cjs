'use strict';

// P09 end-to-end content workflow: open a real local article, run reader
// extraction, generate a PDF and capture a PNG. Run with Electron:
//   windows/node_modules/.bin/electron windows/content-workflow.cjs

const { app, protocol } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BrowserHost } = require('../host.cjs');

const providedProfile = process.env.VAAYVU_SMOKE_PROFILE;
const profile = providedProfile || fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-content-'));
app.setPath('userData', profile);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  { scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  for (let i = 0; i < 160; i += 1) {
    const value = await check();
    if (value) return value;
    await pause(50);
  }
  throw new Error('Timed out: ' + label);
}

app.whenReady().then(async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(
      '<title>Content workflow article</title><article><h1>Independent article</h1>' +
        '<p>Reader extraction must keep this paragraph and drop the hidden form value.</p>' +
        '<p>Second paragraph for the offline reading copy.</p>' +
        '<input value="hidden-form-value"></article>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: true });
  const ui = (code) => host.ui.executeJavaScript(code);
  const send = (type, fields = {}) =>
    ui('VaayvuNative.postMessage(' + JSON.stringify(JSON.stringify({ type, ...fields })) + ')');

  await until(() => ui('typeof nativeReady !== "undefined" && nativeReady').catch(() => false), 'chrome ready');
  await ui('window.received=[];const originalEvent=window.vaayvuEvent;window.vaayvuEvent=(message)=>{received.push(message);originalEvent(message)};void 0');
  await ui('VaayvuPreferences.commit({ordinaryWeb:true})');
  await until(() => host.enabled, 'ordinary web enabled');
  await ui('document.querySelector("#address").value=' + JSON.stringify(base + '/article') + ';document.querySelector("#address-form").requestSubmit()');
  const tab = await until(() => [...host.tabs.values()].find((entry) => entry.view.webContents.getURL() === base + '/article' && !entry.view.webContents.isLoading()), 'article loaded');
  const tabId = [...host.tabs.entries()].find(([, entry]) => entry === tab)[0];
  await send('extract', { id: tabId });
  const contents = tab.view.webContents;
  await until(
    () => ui('received.some(m=>m.type==="text" && m.text.includes("Independent article") && !m.text.includes("hidden-form-value"))'),
    'reader extraction',
  );

  host.layout();
  host.window.showInactive();
  await pause(600);
  const before = { url: contents.getURL(), title: contents.getTitle() };
  const pdf = await contents.printToPDF({ printBackground: true });
  const png = (await contents.capturePage({ x: 0, y: 0, width: 800, height: 600 })).toPNG();
  const mhtmlPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-mhtml-')), 'page.mhtml');
  await contents.savePage(mhtmlPath, 'MHTML');
  const mhtml = fs.readFileSync(mhtmlPath);
  const after = { url: contents.getURL(), title: contents.getTitle() };
  const result = {
    article: contents.getTitle(),
    reader: true,
    pdf: pdf.subarray(0, 4).toString() === '%PDF',
    pdfBytes: pdf.length,
    capture: png.subarray(1, 4).toString() === 'PNG',
    captureBytes: png.length,
    mhtml: mhtml.length > 200 && /Content-Type: multipart\/related|MIME-Version:/i.test(mhtml.subarray(0, 1000).toString()),
    mhtmlBytes: mhtml.length,
    unchanged: before.url === after.url && before.title === after.title,
    window: host.window.getContentBounds(),
    attached: host.window.contentView.children.includes(tab.view),
    zones: host.zones,
    enabled: host.enabled,
  };
  console.log(JSON.stringify(result));
  const ok = result.reader && result.pdf && result.capture && result.mhtml && result.unchanged && result.pdfBytes > 1000 && result.captureBytes > 1000;
  server.close();
  host.window.destroy();
  if (ok) fs.writeFileSync(path.join(profile, 'smoke-passed'), 'content-workflow');
  if (!providedProfile) fs.rmSync(profile, { recursive: true, force: true });
  app.exit(ok ? 0 : 1);
}).catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }));
  if (!providedProfile) fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
});
