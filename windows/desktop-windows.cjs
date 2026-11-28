'use strict';

const { Menu } = require('electron');
const { randomUUID } = require('node:crypto');

class DesktopWindows {
  constructor(createHost) {
    this.createHost = createHost;
    this.open = new Map();
    this.lastClosed = null;
    this.started = false;
  }

  create(record) {
    const id = record?.id || (this.started ? randomUUID() : 'main');
    this.started = true;
    const host = this.createHost({
      windows: this,
      windowName: record?.name || '',
      windowInfo: { id, private: false, reopened: !!record, regularWindowIds: [...this.open.keys(), id] },
    });
    this.open.set(id, host);
    host.window.once('closed', () => {
      this.open.delete(id);
      this.lastClosed = { id, name: host.windowName };
      this.notify();
    });
    this.notify();
    return host;
  }

  notify() {
    const ids = [...this.open.keys()];
    for (const host of this.open.values()) host.event('windows', { ids });
  }

  reopen() {
    if (!this.lastClosed) return;
    const record = this.lastClosed;
    this.lastClosed = null;
    return this.create(record);
  }

  active() {
    // A window can be destroyed (close requested, renderer gone) just before
    // its 'closed' handler prunes it. Touching it then throws "Object has
    // been destroyed", so probe defensively and drop stale entries on sight.
    let fallback;
    for (const [id, host] of this.open) {
      let alive = false;
      try {
        alive = !!host.window && !host.window.isDestroyed();
      } catch {
        alive = false;
      }
      if (!alive) {
        this.open.delete(id);
        continue;
      }
      if (fallback === undefined) fallback = host;
      try {
        if (host.window.isFocused()) return host;
      } catch {
        // Focus check raced destruction: treat as not focused.
      }
    }
    return fallback;
  }
}

function tabBarMenu(host, message) {
  const positions = ['top', 'bottom', 'left', 'right'];
  const position = positions.includes(message.position) ? message.position : 'top';
  const vertical = position === 'left' || position === 'right';
  const command = (label, action, enabled = true) => ({
    label, enabled, click: () => host.event('command', { command: action }),
  });
  return Menu.buildFromTemplate([
    command('New Tab', 'newTab'),
    { label: 'Reopen Closed Window', enabled: !!host.windows?.lastClosed, click: () => host.windows?.reopen() },
    command('Bookmark All Tabs', 'bookmarkAll', message.canBookmark === true),
    { type: 'separator' },
    command(vertical ? 'Show Tabs Horizontally' : 'Show Tabs Vertically', vertical ? 'position-top' : 'position-left'),
    { label: 'Tab Bar Alignment', submenu: positions.map((side) => ({
      ...command(side[0].toUpperCase() + side.slice(1), 'position-' + side),
      type: 'radio', checked: side === position,
    })) },
    command('Name Window…', 'renameWindow'),
    { type: 'separator' },
    command(message.searchPinned ? 'Unpin Tab Search' : 'Pin Tab Search', 'toggleTabSearch'),
    command('Task Manager', 'performance'),
  ]);
}

module.exports = { DesktopWindows, tabBarMenu };
