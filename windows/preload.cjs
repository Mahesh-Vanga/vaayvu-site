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
  ipcRenderer.on('vaayvu:event', (_event, payload) => {
    contextBridge.executeInMainWorld({ func: (message) => window.vaayvuEvent?.(message), args: [payload] });
  });
}
