'use strict';

const { app, protocol, Menu, BrowserWindow } = require('electron');
const { BrowserHost } = require('./host.cjs');
const { DesktopWindows } = require('./desktop-windows.cjs');
const path = require('node:path');

app.setName('Vaayvu');
app.setAppUserModelId('app.vaayvu.browser');
app.enableSandbox();
// Keep long-lived browser memory bounded and let Chromium reclaim background
// tabs the way a memory-saver browser does, while throttling idle renderers.
// Video frames stay on the GPU (zero-copy/Metal) instead of duplicated in CPU
// RAM, background autoplay never pre-buffers 8K, and renderer count is capped.
app.commandLine.appendSwitch('process-per-site');
app.commandLine.appendSwitch('renderer-process-limit', '8');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=224');
app.commandLine.appendSwitch('disk-cache-size', '52428800');
app.commandLine.appendSwitch('media-cache-size', '16777216');
app.commandLine.appendSwitch('enable-features', 'AutomaticTabDiscarding,ZeroCopyVideoCapture');
app.commandLine.appendSwitch('disable-features', 'BackForwardCache');
protocol.registerSchemesAsPrivileged([
  { scheme: 'vaayvu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();
else {
  const chrome = app.isPackaged ? path.join(__dirname, 'chrome') : path.join(__dirname, '..', 'chrome');
  const windows = new DesktopWindows((options) => new BrowserHost(chrome, options));
  let splash = null;
  function closeSplash() {
    if (splash && !splash.isDestroyed()) splash.close();
    splash = null;
  }
  // The V/wind artwork shows while the first window loads, then hands off.
  function showSplash() {
    if (splash) return;
    splash = new BrowserWindow({
      width: 360, height: 360, transparent: true, frame: false,
      alwaysOnTop: true, skipTaskbar: true, resizable: false,
      movable: false, minimizable: false, maximizable: false,
      show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    splash.setMenu(null);
    splash.loadFile(path.join(chrome, 'splash.html')).catch(() => closeSplash());
    splash.once('ready-to-show', () => {
      if (splash && !splash.isDestroyed()) splash.show();
      // Never trap the user behind the splash if loading stalls.
      setTimeout(closeSplash, 10000).unref();
    });
  }
  function showWindow() {
    if (!app.isReady()) return;
    let host;
    try {
      host = windows.active();
    } catch {
      host = undefined;
    }
    if (host) {
      try {
        if (!host.window.isDestroyed()) {
          if (host.window.isMinimized()) host.window.restore();
          host.window.show();
          host.window.focus();
          return;
        }
      } catch {
        // The window died mid-handoff; fall through to a fresh window.
      }
    }
    showSplash();
    const fresh = windows.create();
    fresh.window.once('ready-to-show', closeSplash);
    fresh.window.once('closed', closeSplash);
  }
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    const mac = process.platform === 'darwin';
    if (mac) {
      const icon = app.isPackaged
        ? path.join(process.resourcesPath, 'VaayvuDock.png')
        : path.join(__dirname, '..', 'branding', 'vaayvu-desktop.png');
      app.dock.setIcon(icon);
    }
    const action = (label, command) => ({ label, click: () => windows.active()?.event('command', { command }) });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(mac ? [{ role: 'appMenu' }] : []),
      { label: 'File', submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => windows.create() },
        action('New Tab', 'newTab'),
        { type: 'separator' },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', click: () => windows.active()?.window.close() },
        ...(!mac ? [{ role: 'quit' }] : []),
      ] },
      { role: 'editMenu' },
      { label: 'View', submenu: [
        action('Inspect Page', 'inspect'),
        { type: 'separator' }, { role: 'togglefullscreen' },
      ] },
      { label: 'Window', role: 'windowMenu' },
    ]));
    showWindow();
  });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
