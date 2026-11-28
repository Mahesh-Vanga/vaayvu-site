'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { app, Menu, protocol } = require('electron');
const { BrowserHost } = require('../host.cjs');
const { DesktopWindows } = require('../desktop-windows.cjs');

const profile = process.env.VAAYVU_SMOKE_PROFILE;
if (!profile) throw Error('Run with test/run.cjs.');
app.setPath('userData', profile);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'vaayvu', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);
const evaluate = (host, expression) => host.ui.executeJavaScript(expression);
async function until(check, label) {
  for (let i = 0; i < 140; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error('Timed out waiting for ' + label);
}
const ready = (host) => until(() => evaluate(host, 'typeof nativeReady !== "undefined" && nativeReady').catch(() => false), 'browser chrome');

async function run() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end('<title>Local site</title><main>Local page for tab menu checks</main>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const manager = new DesktopWindows((options) =>
    new BrowserHost(path.resolve(__dirname, '../../chrome'), { ...options, show: false }));
  const first = manager.create();
  const originalPopup = Menu.prototype.popup;
  let popup;
  const openMenu = async (host, gesture = 'contextmenu') => {
    popup = undefined;
    await evaluate(host, 'document.querySelector("#top-tabs").dispatchEvent(new MouseEvent(' +
      JSON.stringify(gesture) + ',{bubbles:true,clientX:690,clientY:23}))');
    await until(() => popup, gesture + ' to native menu');
    assert.equal(popup.options.window, host.window);
    assert.deepEqual([popup.options.x, popup.options.y], [690, 23]);
    return popup.menu;
  };
  const item = (menu, label) => {
    const found = menu.items.find((it) => it.label === label);
    assert.ok(found, label);
    return found;
  };
  try {
    await ready(first);
    assert.equal(await evaluate(first, 'windowInfo.id'), 'main');
    let presented = false;
    let dismissed = false;
    Menu.prototype.popup = function (options) {
      this.once('menu-will-show', () => {
        presented = true;
        setTimeout(() => this.closePopup(options.window), 140);
      });
      return originalPopup.call(this, { ...options, callback: () => { dismissed = true; } });
    };
    first.window.showInactive();
    await evaluate(first, 'document.querySelector("#top-tabs .strip-placement").click()');
    await until(() => presented && dismissed, 'visible native menu to open and close');
    first.window.hide();
    Menu.prototype.popup = function (options) { popup = { menu: this, options }; };
    let menu = await openMenu(first, 'dblclick');
    assert.deepEqual(menu.items.filter((it) => it.type !== 'separator').map((it) => it.label), [
      'New Tab', 'Reopen Closed Window', 'Bookmark All Tabs', 'Show Tabs Vertically',
      'Tab Bar Alignment', 'Name Window…', 'Unpin Tab Search', 'Task Manager',
    ]);
    assert.equal(item(menu, 'Reopen Closed Window').enabled, false);
    assert.equal(item(menu, 'Bookmark All Tabs').enabled, false);
    item(menu, 'New Tab').click();
    await until(() => evaluate(first, 'tabs.length === 2'), 'new tab');
    await evaluate(first, 'VaayvuPreferences.commit({ordinaryWeb:true,startup:"new"}); navigate(' + JSON.stringify(url + '/first') + ')');
    await until(() => [...first.tabs.values()].some((tab) => tab.view.webContents.getURL() === url + '/first'), 'webpage');
    menu = await openMenu(first);
    assert.equal(item(menu, 'Bookmark All Tabs').enabled, true);
    item(menu, 'Bookmark All Tabs').click();
    await until(() => evaluate(first, 'saved().some((b)=> b.url === ' + JSON.stringify(url + '/first') + ')'), 'bookmark all tabs');
    item(menu, 'Unpin Tab Search').click();
    await until(() => evaluate(first, 'document.getElementById("pinned-tab-search").hidden'), 'unpin search');
    const positions = item(menu, 'Tab Bar Alignment').submenu;
    assert.equal(item(positions, 'Top').checked, true);
    item(positions, 'Bottom').click();
    await until(() => evaluate(first, 'document.body.dataset.tabPosition === "bottom"'), 'bottom placement');
    menu = await openMenu(first);
    assert.equal(item(item(menu, 'Tab Bar Alignment').submenu, 'Bottom').checked, true);
    item(menu, 'Task Manager').click();
    await until(() => evaluate(first, 'modal === "performance"'), 'Task Manager');
    if (await evaluate(first, 'Boolean(document.querySelector("[data-memory-tab]"))')) {
      await until(() => evaluate(first, '/MiB/.test(document.querySelector("#dialog").innerText)'), 'renderer memory sample');
    }
    await evaluate(first, 'closeDialog(); command("newWindow")');
    await until(() => manager.open.size === 2, 'second window');
    const second = [...manager.open.values()][1];
    await ready(second);
    const secondId = await evaluate(second, 'windowInfo.id');
    assert.notEqual(secondId, 'main');
    assert.equal(await evaluate(second, 'settings.tabPosition'), 'bottom');
    await evaluate(second, 'navigate(' + JSON.stringify(url + '/second') + ')');
    await until(() => [...second.tabs.values()].some((tab) => tab.view.webContents.getURL() === url + '/second'), 'second webpage');
    await evaluate(first, 'navigate(' + JSON.stringify(url + '/first-again') + ')');
    await until(() => [...first.tabs.values()].some((tab) => tab.view.webContents.getURL() === url + '/first-again'), 'first window still browses');
    menu = await openMenu(second);
    item(menu, 'Name Window…').click();
    await until(() => evaluate(second, '!!document.querySelector("#window-name")'), 'name form');
    await evaluate(second, 'document.querySelector("#window-name input").value="Reference";document.querySelector("#window-name").requestSubmit()');
    await until(() => second.window.getTitle() === 'Reference', 'native window title');
    await evaluate(second, 'addTab(true,' + JSON.stringify(url + '/private') + '); persistTabs()');
    await until(() => [...second.tabs.values()].some((tab) => tab.secret), 'private tab');
    second.window.close();
    await until(() => manager.lastClosed?.id === secondId, 'closed window');
    menu = await openMenu(first);
    assert.equal(item(menu, 'Reopen Closed Window').enabled, true);
    item(menu, 'Reopen Closed Window').click();
    const reopened = manager.open.get(secondId);
    assert.ok(reopened);
    await ready(reopened);
    assert.equal(reopened.window.getTitle(), 'Reference');
    const restored = await evaluate(reopened, 'tabs.map((t)=>t.url)');
    assert.deepEqual(restored, [url + '/second']);
    assert.equal(item(await openMenu(first), 'Reopen Closed Window').enabled, false);
    // A window destroyed without its 'closed' handler running yet must never
    // crash active() with "Object has been destroyed".
    const stale = { window: { isDestroyed: () => { throw Error('Object has been destroyed'); }, isFocused: () => { throw Error('Object has been destroyed'); } } };
    manager.open.set('stale-test-window', stale);
    assert.doesNotThrow(() => manager.active());
    assert.equal(manager.open.has('stale-test-window'), false);
    console.log('Verified native tab menu, placement, bookmarking, tab search, Task Manager, independent windows and private-safe window restore.');
    fs.writeFileSync(path.join(profile, 'smoke-passed'), 'ok');
  } finally {
    Menu.prototype.popup = originalPopup;
    for (const host of [...manager.open.values()]) host.window.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
app.whenReady().then(run).then(() => app.exit(0), (err) => { console.error(err); app.exit(1); });
