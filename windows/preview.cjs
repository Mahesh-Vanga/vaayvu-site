'use strict';

// Local development entry point. The distributable uses main.cjs directly.
const fs = require('node:fs');
const path = require('node:path');
const chrome = path.join(__dirname, '..', 'chrome');

if (process.versions.electron) {
  const { app, BrowserWindow, webContents } = require('electron');
  const profile = process.env.VAAYVU_PREVIEW_DIRECTORY;
  const fixture = process.env.VAAYVU_PREVIEW_PAGE;
  if (!profile || !fixture) throw Error('Start the live preview with npm run preview.');
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  process.on('disconnect', () => app.quit());
  process.on('message', async (action) => {
    if (action !== 'restart') return;
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const demo = webContents.getAllWebContents().find(contents => !contents.isDestroyed() && contents.getURL() === fixture);
    if (demo && win && !win.isDestroyed() && win.webContents.getURL() === 'vaayvu://browser/index.html') {
      const open = demo.isDevToolsOpened() ? 'yes' : 'no';
      await win.webContents.executeJavaScript('localStorage.setItem("preview.nativeDevTools",' + JSON.stringify(open) + ')').catch(() => {});
    }
    app.quit();
  });
  app.on('browser-window-created', (_event, win) => {
    const ui = win.webContents;
    ui.on('did-finish-load', async () => {
      if (ui.getURL() !== 'vaayvu://browser/index.html') return;
      await ui.executeJavaScript(
        '(async () => { while (!nativeReady) await new Promise(r=>setTimeout(r,50));' +
        'if (!localStorage.getItem("preview.seeded")) {' +
        'VaayvuPreferences.commit({theme:"light",ordinaryWeb:true});' +
        'localStorage.setItem("preview.seeded","yes");navigate(' + JSON.stringify(fixture) + ');' +
        '} if (localStorage.getItem("preview.nativeDevTools")!=="no") {' +
        'for (let attempt=0; attempt<80; attempt++) {' +
        'if (current()?.url === ' + JSON.stringify(fixture) + ' && pageInspector.available()) {command("inspect");break;}' +
        'await new Promise(r=>setTimeout(r,100));}} })()',
      ).catch(console.error);
      console.log('Vaayvu live preview ready', win.getMediaSourceId());
    });
  });
  app.on('web-contents-created', (_event, contents) => {
    contents.on('devtools-opened', () => {
      if (contents.getURL() === fixture && contents.devToolsWebContents?.getURL().startsWith('devtools://')) {
        console.log('Full Chromium DevTools is open on the preview fixture.');
      }
    });
  });
  try {
    require('./main.cjs');
  } catch (error) {
    console.error('Could not load the desktop preview.', error.message);
    app.exit(1);
  }
  app.setName('Vaayvu Live Preview');
  app.whenReady().then(() => app.dock?.setBadge('Preview'));
  app.on('window-all-closed', () => app.quit());
  process.on('message', (action) => {
    if (action !== 'styles') return;
    for (const win of BrowserWindow.getAllWindows()) {
      const ui = win.webContents;
      if (ui.getURL() !== 'vaayvu://browser/index.html') continue;
      ui.executeJavaScript(
        'for (const old of document.querySelectorAll("link[rel=stylesheet]")) {' +
        'const fresh=old.cloneNode();fresh.onload=()=>old.remove();fresh.onerror=()=>fresh.remove();old.after(fresh)}',
      ).catch(console.error);
    }
  });
} else {
  const http = require('node:http');
  const os = require('node:os');
  const { spawn } = require('node:child_process');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vaayvu-live-'));
  const version = require('./package.json').version;
  const server = http.createServer((req, res) => {
    if (req.url === '/observatory.jpg') {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      fs.createReadStream(path.join(chrome, 'assets', 'observatory.jpg')).pipe(res);
      return;
    }
    if (req.url !== '/') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><html lang="en"><title>Inspector preview</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{margin:0;background:#f5f3ec;color:#233637;font:16px system-ui}main{max-width:680px;margin:clamp(24px,6vw,72px) auto;padding:0 24px}' +
      'img{width:100%;border-radius:16px}h1{font:44px Georgia,serif}p{line-height:1.5}</style>' +
      '<main><img src="/observatory.jpg" alt="The observatory above the sea"><h1>Inspector preview</h1>' +
      '<p>Right-click the image or heading and choose <b>Inspect element</b>.</p>' +
      '<details><summary>Page details</summary><p>This local page is open in Vaayvu ' + version + '.</p></details></main></html>');
  });
  let child, timer, restart = false, stopped = false;
  const watchers = [];
  function sourcesReady() {
    const host = fs.readFileSync(path.join(__dirname, 'host.cjs'), 'utf8');
    const shell = fs.readFileSync(path.join(chrome, 'index.html'), 'utf8');
    const nativeImports = [...host.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)].map(match => path.resolve(__dirname, match[1]));
    const shellScripts = [...shell.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map(match => path.resolve(chrome, match[1]));
    return [...nativeImports, ...shellScripts].every(file => fs.existsSync(file));
  }
  function start() {
    restart = false;
    if (!sourcesReady() || stopped) return;
    child = spawn(require('electron'), [__filename], {
      env: { ...process.env, VAAYVU_PREVIEW_DIRECTORY: directory, VAAYVU_PREVIEW_PAGE: 'http://127.0.0.1:' + server.address().port + '/' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    child.on('exit', code => {
      child = null;
      if (restart && !stopped) start();
      else if (code !== 0 && !stopped) console.log('Waiting for the next saved change.');
      else stop();
    });
    child.on('error', (error) => { console.error(error); stop(); });
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    server.close();
    if (child?.connected) child.send('restart');
    // Only this invocation owns the randomly created profile.
    const cleanup = () => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    if (child && child.exitCode === null && child.signalCode === null) child.once('exit', cleanup);
    else cleanup();
  }
  let needsRestart = false;
  function changed(relative, native) {
    if (!relative || !/\.(?:css|js|html|cjs|json)$/.test(relative)) return;
    if (native && !['preview.cjs', 'main.cjs', 'host.cjs', 'preload.cjs', 'policy.cjs', 'desktop-windows.cjs'].includes(relative)) return;
    if (!relative.endsWith('.css')) needsRestart = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped || !sourcesReady()) return;
      if (!child) { needsRestart = false; start(); return; }
      if (!child.connected) return;
      if (needsRestart) { needsRestart = false; restart = true; child.send('restart'); }
      else child.send('styles');
    }, 1400);
  }
  server.on('error', (error) => { console.error(error); process.exitCode = 1; stop(); });
  server.listen(0, '127.0.0.1', () => {
    watchers.push(fs.watch(chrome, { recursive: true }, (_, file) => changed(file, false)));
    watchers.push(fs.watch(__dirname, (_, file) => changed(file, true)));
    console.log('Starting Vaayvu ' + version + ' live preview in an isolated profile.');
    start();
  });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
