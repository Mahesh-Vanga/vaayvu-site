'use strict';

// Minimal Chromium engine spike for P02. It proves request interception in a
// raw Electron/Chromium session: one allowed script runs, one blocked script
// never runs. Writes a single JSON result line.

const { app, session, BrowserWindow } = require('electron');
const http = require('node:http');

const result = { engine: 'chromium', spike: 'request-interception' };

app.whenReady().then(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/blocked.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('window.blockedRan = true;');
      return;
    }
    if (req.url === '/allowed.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('window.allowedRan = true;');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Engine spike</title><script src="/allowed.js"></script><script src="/blocked.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => callback({ cancel: details.url === origin + '/blocked.js' })
  );

  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL(origin + '/');
  const state = await win.webContents.executeJavaScript(
    '({ allowed: window.allowedRan === true, blocked: window.blockedRan === true })'
  );
  result.allowedScriptRan = state.allowed;
  result.blockedScriptRan = state.blocked;
  result.pass = state.allowed === true && state.blocked === false;
  result.chromium = process.versions.chrome;
  console.log(JSON.stringify(result));
  server.close();
  win.destroy();
  app.exit(result.pass ? 0 : 1);
}).catch((error) => {
  console.error(JSON.stringify({ engine: 'chromium', pass: false, error: error.message }));
  app.exit(1);
});
