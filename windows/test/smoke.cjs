'use strict';
const { app, protocol, Menu } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { BrowserHost } = require('../host.cjs');
const profile = process.env.VAAYVU_SMOKE_PROFILE;
if (!profile) throw new Error('Run the smoke test with test/run.cjs.');
app.setPath('userData', profile);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  { scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, description) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const result = await check();
    if (result) return result;
    await pause(50);
  }
  throw Error('Timed out waiting for ' + description);
}

async function run() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (part) => (body += part));
    req.on('end', () => {
      requests.push([req.method, req.url, body]);
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(
        '<title>Local fixture</title><h1>Independent browser page</h1><p>Read this fixture.</p>' +
          '<input value="hidden-form-value"><form method="POST" action="/submitted" target="_blank">' +
          '<input name="entry" value="real-form"><button id="submit">Send</button></form>',
      );
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const { createSyncService } = await import('../../sync/server.mjs');
  const syncServer = createSyncService();
  await new Promise((r) => syncServer.listen(0, '127.0.0.1', r));
  const syncOrigin = 'http://127.0.0.1:' + syncServer.address().port;
  const host = new BrowserHost(path.resolve(__dirname, '../../chrome'), { show: false });
  const ui = (code) =>
    host.ui.executeJavaScript(code).catch((error) => {
      throw new Error('UI expression failed: ' + code.slice(0, 85), { cause: error });
    });
  const send = (type, fields = {}) =>
    ui('VaayvuNative.postMessage(' + JSON.stringify(JSON.stringify({ type, ...fields })) + ')');
  const providerRequests = [];
  const providerUrls = [
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5',
    'https://api.open-meteo.com/v1/forecast?latitude=18&longitude=73&current=temperature_2m&timezone=auto',
  ];
  host.ui.session.protocol.handle('https', (request) => {
    providerRequests.push(request.url);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'vaayvu://browser' },
    });
  });
  const fetchProviders = () =>
    ui(
      'Promise.all(' +
        JSON.stringify(providerUrls) +
        '.map(async u=>{try{return (await (await fetch(u)).json()).ok===true}catch{return false}}))',
    );
  try {
    await until(
      () => ui('typeof nativeReady!=="undefined" && nativeReady').catch(() => false),
      'trusted UI bridge',
    );
    assert.equal(await ui('capabilities.platform'), process.platform === 'darwin' ? 'mac' : 'windows');
    await ui(
      'window.received=[];const originalEvent=window.vaayvuEvent;window.vaayvuEvent=(message)=>{received.push(message);originalEvent(message)};void 0',
    );
    const go = (source) =>
      ui(
        'document.querySelector("#address").value=' +
          JSON.stringify(source) +
          ';document.querySelector("#address-form").requestSubmit()',
      );
    const submitted = [];
    host.regular.protocol.handle('https', (request) => {
      submitted.push(new URL(request.url));
      return new Response('<title>Search fixture</title>', { headers: { 'Content-Type': 'text/html' } });
    });
    await until(() => host.enabled, 'ordinary browsing on a new profile');
    assert.equal(await ui('settings.searchProvider'), 'duckduckgo');
    await ui('document.querySelector("#address").value="fixture";document.querySelector("#address").dispatchEvent(new Event("input"));void 0');
    assert.equal(submitted.length, 0);
    for (const [provider, domain] of [['duckduckgo','duckduckgo.com'], ['google','www.google.com'], ['bing','www.bing.com']]) {
      await ui('VaayvuPreferences.commit({searchProvider:' + JSON.stringify(provider) + '})');
      await go('sample query');
      await until(() => submitted.some(u => u.hostname === domain && u.searchParams.get('q') === 'sample query'), provider + ' submitted query');
    }
    await ui('closeTab(activeId);VaayvuPreferences.commit({ordinaryWeb:false})');
    await until(() => !host.enabled && !host.tabs.size, 'restricted browsing selection');
    assert.deepEqual(await fetchProviders(), [false, false]);
    assert.equal(providerRequests.length, 0);
    await send('open', { id: 'ignored', url: base + '/strict' });
    await pause(150);
    assert.equal(host.tabs.size, 0);
    assert.equal(requests.length, 0);
    await send('open', { id: 'visit', url: base + '/granted', userApprovedVisit: true });
    await until(() => requests.some((request) => request[1] === '/granted'), 'approved visit');
    const approved = host.tabs.get('visit').view.webContents;
    await until(() => approved.getTitle() === 'Local fixture' && !approved.isLoading(), 'approved document');
    assert.equal(host.enabled, false);
    await send('openDeveloperTools', { id: 'visit', url: base + '/granted' });
    await until(() => approved.isDevToolsOpened(), 'Inspect on one approved website with general access paused');
    approved.closeDevTools();
    await until(() => !approved.isDevToolsOpened(), 'approved-site tools closed');
    assert.deepEqual(await fetchProviders(), [false, false]);
    assert.equal(providerRequests.length, 0);
    await send('open', { id: 'unrelated', url: base + '/denied' });
    await approved.executeJavaScript('window.open("/denied");void 0', true);
    await send('navigate', { id: 'visit', url: base + '/follow' });
    await until(() => requests.some((request) => request[1] === '/follow'), 'navigate within approved tab');
    await send('close', { id: 'visit' });
    await send('open', { id: 'visit', url: base + '/denied' });
    await pause(150);
    assert.equal(host.tabs.size, 0);
    assert(!requests.some((request) => request[1] === '/denied'));
    await ui('VaayvuPreferences.commit({ordinaryWeb:true})');
    await until(() => host.enabled, 'opt-in');
    assert.deepEqual(await fetchProviders(), [true, true]);
    assert.deepEqual(providerRequests, providerUrls);
    await ui(
      'sync.authenticate(' +
        JSON.stringify(syncOrigin) +
        ',"vaayvu.desktop.test","VaayvuLocalTrial1234",true).then(()=>true)',
    );
    const snapshot = await ui(
      'sync.exchange([{id:"fixture",title:"Test bookmark",url:"https://example.com",updatedAt:1}],{id:"windows-fixture",name:"Vaayvu test",tabs:[]})',
    );
    assert.equal(snapshot.bookmarks[0].title, 'Test bookmark');
    await go(base + '/first');
    await until(() => requests.some((r) => r[1] === '/first'), 'site navigation');
    const id = await ui('activeId'),
      site = host.tabs.get(id).view.webContents;
    await until(() => site.getTitle() === 'Local fixture' && !site.isLoading(), 'page loaded');
    assert.equal(
      await site.executeJavaScript('typeof window.VaayvuNative + ":" + typeof require + ":" + typeof process'),
      'undefined:undefined:undefined',
    );
    host.ui.openDevTools();
    assert.equal(host.ui.isDevToolsOpened(), false);
    const pageWidth = await site.executeJavaScript('window.innerWidth');
    await ui(`document.querySelector('#toolbar [data-act="more"]').click();
      document.querySelector('#dialog [data-act="menu-more"]').click();
      document.querySelector('#dialog [data-act="inspect"]').click();`);
    await until(() => site.isDevToolsOpened(), 'real Chromium DevTools');
    await until(async () => (await site.executeJavaScript('window.innerWidth')) < pageWidth, 'right-docked Chromium DevTools');
    site.closeDevTools();
    await until(() => !site.isDevToolsOpened(), 'DevTools close');
    site.sendInputEvent({ type: 'keyDown', keyCode: 'F12' });
    site.sendInputEvent({ type: 'keyUp', keyCode: 'F12' });
    await until(() => site.isDevToolsOpened(), 'F12 from web content');
    site.closeDevTools();
    await until(() => !site.isDevToolsOpened(), 'F12 tools closed');
    const nativePopup = Menu.prototype.popup;
    try {
      let clicked = false;
      Menu.prototype.popup = function () {
        const inspect = this.items.find(item => item.label === 'Inspect element');
        assert.ok(inspect);
        inspect.click();
        clicked = true;
      };
      const point = await site.executeJavaScript(`(() => {
        const box = document.querySelector('#submit').getBoundingClientRect();
        return {x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2)};
      })()`);
      site.emit('context-menu', {}, {...point, linkURL:'', selectionText:'', isEditable:false});
      assert.equal(clicked, true);
    } finally {
      Menu.prototype.popup = nativePopup;
    }
    await until(() => site.isDevToolsOpened(), 'Inspect element from the page context menu');
    const inspector = await until(() => site.devToolsWebContents, 'DevTools renderer attached');
    await until(() => inspector.getURL().startsWith('devtools://devtools/'), 'bundled Chromium DevTools frontend');
    await until(() => inspector.executeJavaScript('Boolean(globalThis.InspectorFrontendAPI)'), 'interactive Chromium DevTools frontend');
    const panelsLoaded = `(() => {
      const labels = new Set();
      function visit(root) {
        for (const node of root.querySelectorAll('*')) {
          if (node.getAttribute('role') === 'tab') labels.add(node.textContent.trim());
          if (node.shadowRoot) visit(node.shadowRoot);
        }
      }
      visit(document);
      return ['Elements', 'Console', 'Sources', 'Network'].every(name => labels.has(name));
    })()`;
    await until(() => inspector.executeJavaScript(panelsLoaded), 'Elements, Console, Sources and Network panels');
    assert.equal(site.getLastWebPreferences().sandbox, true);
    assert.equal(host.ui.session === site.session, false);
    await site.executeJavaScript(
      'localStorage.setItem("fixture","ordinary");document.cookie="marker=regular;path=/"',
    );
    await go(base + '/second');
    await until(() => site.getURL() === base + '/second', 'second location');
    assert.equal(site.devToolsWebContents, inspector);
    assert.ok(site.isDevToolsOpened());
    await send('back', { id });
    await until(() => site.getURL() === base + '/first', 'back navigation');
    await send('forward', { id });
    await until(() => site.getURL() === base + '/second', 'forward navigation');
    await send('extract', { id });
    await until(
      () =>
        ui(
          'received.some(m=>m.type==="text" && m.text.includes("Independent browser page") && !m.text.includes("hidden-form-value"))',
        ),
      'local reader extraction',
    );
    const oldTabs = host.tabs.size;
    await site.executeJavaScript('document.querySelector("#submit").click()', true);
    await until(
      () => requests.some((r) => r[0] === 'POST' && r[1] === '/submitted' && r[2] === 'entry=real-form'),
      'POST popup',
    );
    await until(() => host.tabs.size === oldTabs + 1, 'adopted popup tab');
    const child = await until(() => [...host.tabs.values()].find(tab =>
      tab.popup && tab.id === host.active && tab.view.webContents.getURL() === base + '/submitted' && !tab.loading), 'selected website popup');
    await until(() => !site.isDevToolsOpened(), 'docked tools close when the opener becomes inactive');
    await send('openDeveloperTools', {id, url:base + '/second'});
    await send('openDeveloperTools', {id:child.id, url:base + '/stale'});
    await pause(100);
    assert.equal(site.isDevToolsOpened(), false);
    assert.equal(child.view.webContents.isDevToolsOpened(), false);
    child.view.webContents.sendInputEvent({ type:'keyDown', keyCode:'I', modifiers:process.platform === 'darwin' ? ['meta','alt'] : ['control','shift'] });
    child.view.webContents.sendInputEvent({ type:'keyUp', keyCode:'I', modifiers:process.platform === 'darwin' ? ['meta','alt'] : ['control','shift'] });
    await until(() => child.view.webContents.isDevToolsOpened(), 'platform Inspect shortcut on an adopted website popup');
    await go('http://127.0.0.1:1/unavailable');
    await until(() => child.failure && !child.view.webContents.isDevToolsOpened(), 'developer tools close on failed navigation');
    await send('openDeveloperTools', {id:child.id, url:'http://127.0.0.1:1/unavailable'});
    await pause(100);
    assert.equal(child.view.webContents.isDevToolsOpened(), false);
    await ui('addTab(true,' + JSON.stringify(base + '/private') + ')');
    const priv = await until(() => [...host.tabs.values()].find((t) => t.secret), 'private tab');
    await until(
      () => priv.view.webContents.getURL() === base + '/private' && !priv.view.webContents.isLoading(),
      'private page',
    );
    await until(() => host.protectedWindow, 'private viewport capture protection');
    priv.view.webContents.openDevTools();
    await send('openDeveloperTools', {id:priv.id, url:base + '/private'});
    assert.equal(priv.view.webContents.isDevToolsOpened(), false);
    const privateSession = priv.view.webContents.session;
    assert.equal(privateSession.isPersistent(), false);
    assert.deepEqual(
      await priv.view.webContents.executeJavaScript('[localStorage.getItem("fixture"),document.cookie]'),
      [null, ''],
    );
    await priv.view.webContents.executeJavaScript('localStorage.setItem("fixture","private")');
    await ui('closeTab(' + JSON.stringify(priv.id) + ')');
    await until(() => !host.privateSession, 'private profile released');
    await ui('addTab(true,' + JSON.stringify(base + '/fresh-private') + ')');
    const next = await until(() => [...host.tabs.values()].find((t) => t.secret), 'fresh private tab');
    await until(
      () => next.view.webContents.getURL() === base + '/fresh-private' && !next.view.webContents.isLoading(),
      'fresh document',
    );
    assert.notEqual(next.view.webContents.session, privateSession);
    assert.equal(await next.view.webContents.executeJavaScript('localStorage.getItem("fixture")'), null);
    await ui('VaayvuPreferences.commit({ordinaryWeb:false})');
    await until(() => !host.protectedWindow, 'ordinary interface screenshot access');
    await until(() => host.tabs.size === 0 && !host.enabled, 'strict mode teardown');
    const count = requests.length;
    await send('open', { id: 'blocked', url: base + '/after' });
    await pause(150);
    assert.equal(requests.length, count);
    console.log(
      'Shared UI passed strict defaults, opt-in, navigation/history, sandbox separation, POST popup adoption, reader extraction, account registration/sync, provider CORS, screen capture policy and private-session teardown.',
    );
  } finally {
    host.window.destroy();
    await new Promise((r) => {
      syncServer.close(r);
      syncServer.closeAllConnections();
    });
    await new Promise((r) => {
      server.close(r);
      server.closeAllConnections();
    });
  }
}

app
  .whenReady()
  .then(run)
  .then(
    () => {
      require('node:fs').writeFileSync(path.join(profile, 'smoke-passed'), 'ok');
      app.exit(0);
    },
    (error) => {
      console.error(error);
      app.exit(1);
    },
  );
