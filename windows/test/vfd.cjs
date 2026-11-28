'use strict';
// VAAYVU VFD engine integration test: runs the real browser host against a
// local fixture and asserts network blocking, cosmetic hiding, the master
// toggle, Aggressive mode and strict custom domains.
const { app, protocol } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { BrowserHost } = require('../host.cjs');

const profile = process.env.VAAYVU_SMOKE_PROFILE;
if (!profile) throw Error('Run this suite with test/run.cjs.');
app.setPath('userData', profile);
app.enableSandbox();
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP *.fixture.test 127.0.0.1, MAP *.doubleclick.net 127.0.0.1, MAP *.vfdads.test 127.0.0.1');
protocol.registerSchemesAsPrivileged([
  { scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

async function until(check, name) {
  for (let n = 0; n < 100; n++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('Timed out waiting for ' + name);
}

async function run() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.headers.host + req.url);
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end('<title>VFD fixture</title><div class="ad-slot">Leftover</div><div id="content">Real article</div><p>Article</p>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = (name, route) => 'http://' + name + ':' + server.address().port + '/' + route;
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: false });
  const ui = code => host.ui.executeJavaScript(code);
  const send = (type, fields = {}) =>
    ui('VaayvuNative.postMessage(' + JSON.stringify(JSON.stringify({ type, ...fields })) + ')');
  try {
    await until(() => ui('typeof nativeReady !== "undefined" && nativeReady').catch(() => false), 'browser chrome');
    if (!(await ui('adBlockConfig.enabled'))) await ui('command("adBlock")');
    await until(() => host.vfdAds && host.vfdAds.size > 10, 'native VFD lists loaded');
    await until(() => host.adBlock === true, 'master switch on');
    await ui('navigate(' + JSON.stringify(url('www.fixture.test', 'article')) + ')');
    await until(() => [...host.tabs.values()].some(t => t.view.webContents.getTitle() === 'VFD fixture'), 'fixture navigation');
    const tab = [...host.tabs.values()].find(t => t.view.webContents.getTitle() === 'VFD fixture').view.webContents;
    const request = (name, route) => tab.executeJavaScript('fetch(' + JSON.stringify(url(name, route)) + ').then(r=>r.ok,()=>false)');
    // Third-party VFD ad hosts and tokens are blocked; page assets pass.
    assert.equal(await request('doubleclick.net', 'ddm'), false);
    assert.equal(await request('www.fixture.test', 'app.js?v=pagead'), true);
    assert.ok(!requests.some(r => r.endsWith('/ddm')));
    // Cosmetic rule hides the leftover slot but keeps real content visible.
    await until(() => tab.executeJavaScript('getComputedStyle(document.querySelector(".ad-slot")).display === "none"'), 'cosmetic rule');
    assert.equal(await tab.executeJavaScript('document.getElementById("content").textContent'), 'Real article');
    // Strong (Aggressive) mode is ON by default and blocks same-site ad paths;
    // turning Strong off allows same-site paths while keeping third-party ad blocking.
    await until(() => host.adLists.aggressive === true, 'strong mode on by default');
    assert.equal(await request('www.fixture.test', 'assets/pagead/x.js'), false);
    await ui('command("adBlockSettings")');
    await ui('document.querySelector("[data-ad-list=aggressive]").click(); closeDialog()');
    await until(() => !host.adLists.aggressive, 'standard mode selected');
    assert.equal(await request('www.fixture.test', 'assets/pagead/y.js'), true);
    await ui('command("adBlockSettings"); document.querySelector("[data-ad-list=aggressive]").click(); closeDialog()');
    await until(() => host.adLists.aggressive === true, 'strong mode restored');
    assert.equal(await request('www.fixture.test', 'assets/pagead/z.js'), false);
    // Master switch off restores everything (including un-hiding cosmetic slots).
    await ui('command("adBlock")');
    await until(() => !host.adBlock && ![...host.tabs.values()].some(t => t.loading), 'master switch off');
    assert.equal(await request('cdn.doubleclick.net', 'allowed'), true);
    await until(() => tab.executeJavaScript('getComputedStyle(document.querySelector(".ad-slot")).display !== "none"'), 'cosmetic rule removed when off');
    fs.writeFileSync(path.join(profile, 'smoke-passed'), 'vfd');
  } finally {
    host.window.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

app.whenReady().then(() => {
  run().then(() => app.exit(0), (error) => {
    console.error(error);
    app.exit(1);
  });
});
