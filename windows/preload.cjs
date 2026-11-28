'use strict';
const { contextBridge, ipcRenderer } = require('electron');

if (process.isMainFrame && location.href === 'vaayvu://browser/index.html') {
  const prefix = '--vaayvu-window=';
  const context = process.argv.find((arg) => arg.startsWith(prefix));
  if (context) contextBridge.exposeInMainWorld('vaayvuWindow', JSON.parse(context.slice(prefix.length)));
  contextBridge.exposeInMainWorld('VaayvuNative', {
    postMessage(value) {
      if (typeof value === 'string' && value.length <= 3 * 1024 * 1024) ipcRenderer.send('vaayvu:command', value);
    },
  });
  // Durable renderer state is synchronous because the Web Storage API is
  // synchronous. Main holds the SQLite key-value table; chrome/native-store.js
  // swaps the UI's localStorage for this bridge so no renderer key persists in
  // Chromium's localStorage.
  contextBridge.exposeInMainWorld('VaayvuStore', {
    available: true,
    get: (key) => ipcRenderer.sendSync('vaayvu:store-get', key),
    set: (key, value) => ipcRenderer.sendSync('vaayvu:store-set', key, value),
    remove: (key) => ipcRenderer.sendSync('vaayvu:store-remove', key),
    keys: () => ipcRenderer.sendSync('vaayvu:store-keys'),
    importLegacy: (entries) => ipcRenderer.sendSync('vaayvu:store-import', entries),
  });
  ipcRenderer.on('vaayvu:event', (_event, payload) => {
    contextBridge.executeInMainWorld({ func: (message) => window.vaayvuEvent?.(message), args: [payload] });
  });
}
