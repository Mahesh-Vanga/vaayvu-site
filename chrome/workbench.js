'use strict';

// Commands appear on a platform only when its native host can perform them.
let profileCatalog = [];
function showProfiles() {
  const choices = profileCatalog
    .map(
      (p) =>
        '<button class="choice" data-profile="' +
        e(p.id) +
        '">' +
        icon('user') +
        '<span>' +
        e(p.name) +
        '</span>' +
        (p.id === windowInfo.profileId ? icon('check') : '') +
        '</button>',
    )
    .join('');
  dialog(
    'Browser profiles',
    '<div class="stack"><p class="muted">Each profile keeps its own website sign-ins, bookmarks, settings, and Vaayvu ID.</p>' +
      choices +
      '<form id="new-profile"><label>New profile name<input name="name" maxlength="60" required></label><button class="primary">Create profile</button></form>' +
      (platform === 'mac' || capabilities.canGuestWindow ? actButton('guestWindow', 'Open guest window', 'private') : '') +
      '</div>',
    'profiles',
  );
}
const pageInspector = {
  available() {
    const tab = current();
    const appleInspector = capabilities.canInspect &&
      (platform === 'ios' || (platform === 'mac' && !capabilities.chromiumDesktop));
    return !!((capabilities.canNativeInspector || appleInspector) && view === 'web' && tab &&
      !tab.loading && !tab.error && !tab.private && !windowInfo.private && !windowInfo.guest && webURL(tab.url));
  },
  open() {
    if (!this.available()) return;
    closeDialog();
    const tab = current();
    if (capabilities.canNativeInspector) send({type:'openDeveloperTools', id:tab.id, url:tab.url});
    else send({type:'inspection', id:tab.id, enabled:true});
  },
};

function browserCommands() {
  const web = view === 'web' && !!current().url;
  const regular = !windowInfo.private;
  const mac = platform === 'mac';
  const has = (key) => !!capabilities[key];
  return {
    newTab: ['New tab', 'plus'],
    privateTab: ['New private tab', 'private', privateSupported],
    newWindow: ['New window', 'tabs', mac || has('canNewWindow')],
    privateWindow: ['New private window', 'private', mac && !has('chromiumDesktop')],
    reopenTab: ['Reopen closed tab', 'history', regular, read(closedTabsKey, []).length > 0],
    duplicateTab: ['Duplicate tab', 'tabs'],
    pinTab: [current().pinned ? 'Unpin tab' : 'Pin tab', 'pin'],
    groupTab: ['Name tab group', 'layers'],
    moveLeft: [
      'Move tab left',
      'back',
      true,
      !!tabs[tabs.indexOf(current()) - 1] &&
        !!tabs[tabs.indexOf(current()) - 1].pinned === !!current().pinned,
    ],
    moveRight: [
      'Move tab right',
      'forward',
      true,
      !!tabs[tabs.indexOf(current()) + 1] &&
        !!tabs[tabs.indexOf(current()) + 1].pinned === !!current().pinned,
    ],
    closeTab: ['Close tab', 'x'],
    tabSearch: ['Search open tabs', 'search'],
    manageTabs: ['Manage tabs', 'tabs'],
    splitView: [
      typeof splitActive === 'function' && splitActive() ? 'Close split view' : 'Split view',
      'split',
      typeof splitSupported === 'function' ? splitSupported() : false,
      typeof splitActive === 'function' && splitActive() ? true : view === 'web' && !!current().url,
    ],
    newSpace: ['New space', 'plus', regular],
    spaceMenu: ['Spaces…', 'layers', regular],
    archived: ['Archived tabs', 'clock', regular, read('archived', []).length > 0],
    commandBar: ['Command bar', 'search'],
    extensions: ['Extensions', 'layers', regular && has('canUserStyles')],
    desktopSite: [
      current().desktopSite ? 'Request mobile site' : 'Request desktop site',
      'devices',
      has('canDesktopSite'),
      web,
    ],
    favorites: ['Edit start page favorites', 'edit', regular],
    nextTab: ['Next tab', 'forward', true, tabs.length > 1],
    previousTab: ['Previous tab', 'back', true, tabs.length > 1],
    tools: ['Page reader and AI', 'spark', true, web],
    reader: ['Reader view', 'book', true, web],
    protection: ['Rasha Shield', 'shield', has('canProtect')],
    adBlock: [typeof adBlockConfig !== 'undefined' && adBlockConfig.enabled ? 'Turn Rasha Shield off' : 'Turn Rasha Shield on', 'shield', regular && typeof adBlock !== 'undefined' && adBlock],
    adBlockSettings: ['Rasha Shield', 'shield', regular && typeof adBlock !== 'undefined' && adBlock],
    systemPasswords: ['System password manager', 'lock', has('canSystemPasswords')],
    passwords: ['Saved passwords', 'lock', true],
    systemVPN: ['System VPN settings', 'shield', has('canSystemVPN')],
    sitePermissions: ['Site permissions', 'camera', has('canSitePermissions')],
    bookmark: ['Bookmark this tab', 'star', regular, web && !current().private],
    bookmarkAll: ['Bookmark all regular tabs', 'layers', regular, publicTabs(tabs).length > 0],
    bookmarks: ['Bookmark manager', 'bookmark', regular],
    bookmarkBar: [settings.bookmarkBar ? 'Hide bookmarks bar' : 'Show bookmarks bar', 'panel', regular],
    bookmarkImport: ['Import bookmarks…', 'download', regular && has('canImportBookmarks')],
    bookmarkExport: ['Export bookmarks…', 'share', regular && has('canExportBookmarks'), saved().length > 0],
    reading: ['Reading list', 'book', regular],
    readLater: ['Save to reading list', 'book', regular, web && !current().private],
    history: ['Browsing history', 'history', regular],
    closedList: ['Recently closed', 'clock', regular],
    devices: ['Tabs from other devices', 'devices', regular],
    downloads: ['Downloads', 'download', regular],
    clearData: ['Delete browsing data…', 'trash', regular],
    clearCookies: ['Clear cookies', 'trash', regular],
    find: ['Find on page', 'search', true, web],
    print: ['Print…', 'print', has('canPrint'), web],
    savePDF: ['Save as PDF…', 'download', has('canSavePDF'), web],
    savePage: ['Save page as archive…', 'download', has('canSavePage'), web],
    capture: ['Save screenshot…', 'camera', has('canCapture'), web],
    cut: ['Cut', 'edit', has('canEditPage'), web],
    copySelection: ['Copy selection', 'link', has('canEditPage'), web],
    paste: ['Paste', 'edit', has('canEditPage'), web],
    selectAll: ['Select all', 'layers', has('canEditPage'), web],
    copyURL: ['Copy page link', 'link', has('canCopy') || !!navigator.clipboard, web],
    share: ['Share page…', 'share', native, web],
    qr: ['Create QR code', 'qr', true, web],
    sendDevice: ['Send to your device', 'devices', regular, web && !current().private],
    shortcut: [
      platform === 'mac' ? 'Create website shortcut…' : 'Add to home screen…',
      'plus',
      has('canShortcut'),
      web && !current().private,
    ],
    zoomIn: ['Zoom in', 'plus', has('canZoom'), web],
    zoomOut: ['Zoom out', 'minus', has('canZoom'), web],
    zoomReset: ['Actual size', 'compass', has('canZoom'), web],
    fullscreen: ['Toggle full screen', 'expand', has('canFullscreen')],
    account: ['Vaayvu Sync', 'sync', regular],
    renameWindow: ['Name this window…', 'edit', has('canRenameWindow')],
    layoutTabs: [
      'Tab bar alignment',
      'panel',
      !narrowLayout.matches,
    ],
    quick: ['Command bar', 'search'],
    performance: [capabilities.canSampleTabMemory ? 'Task Manager' : 'Tab activity', 'layers'],
    settings: ['Settings', 'settings'],
    requestDefaultBrowser: ['Set Vaayvu as default browser', 'globe', has('canDefaultBrowser')],
    help: ['Help and shortcuts', 'book'],
    about: ['About Vaayvu', 'globe'],
    profiles: ['Profiles', 'user', has('canProfiles')],
    inspect: ['Inspect page', 'search', pageInspector.available()],
    suspendTab: [
      'Unload inactive tabs',
      'layers',
      true,
      tabs.some((t) => t.id !== activeId && mounted.has(t.id)),
    ],
    focusAddress: ['Open location', 'compass'],
    home: ['Start page', 'home'],
  };
}
const menuGroups = {
  main: [
    'Browser menu',
    ['newTab', 'splitView', 'manageTabs', 'spaceMenu', 'newWindow', 'privateWindow', 'privateTab'],
    ['tools', 'reader', 'protection', 'adBlockSettings', 'adBlock', 'systemVPN'],
    ['@sidebar', '@tabs', '@passwords', 'passwords', '@history', '@bookmarks', 'downloads', 'extensions', 'clearData'],
    ['@zoom', 'desktopSite', 'print', '@find', '@share', '@more'],
    ['help', 'about', 'settings'],
  ],
  tabs: [
    'Tabs',
    ['newTab', 'splitView', 'duplicateTab', 'pinTab', 'groupTab', 'moveLeft', 'moveRight'],
    ['manageTabs', 'tabSearch', 'reopenTab', 'closeTab', 'layoutTabs'],
  ],
  passwords: ['Passwords and autofill', ['systemPasswords']],
  history: ['History', ['history', 'closedList', 'reopenTab', 'devices']],
  bookmarks: [
    'Bookmarks and lists',
    ['bookmark', 'bookmarkAll', 'bookmarkBar', 'bookmarks'],
    ['bookmarkImport', 'bookmarkExport'],
    ['reading', 'readLater'],
  ],
  zoom: ['Zoom', ['zoomOut', 'zoomReset', 'zoomIn', 'fullscreen']],
  find: ['Find and edit', ['find', 'cut', 'copySelection', 'paste', 'selectAll']],
  share: [
    'Save and share',
    ['savePage', 'savePDF', 'capture', 'shortcut'],
    ['copyURL', 'share', 'qr', 'sendDevice'],
  ],
  more: [
    'More tools',
    ['commandBar', 'profiles', 'newWindow', 'privateWindow', 'renameWindow', 'account'],
    ['tabSearch', 'quick', 'archived', 'layoutTabs', 'performance', 'suspendTab', 'inspect'],
  ],
  sidebar: ['Sidebar', []],
};
function control(action, commands = browserCommands()) {
  const [label, ic, available = true, enabled = true] = commands[action] || [];
  if (!label || !available) return '';
  return (
    '<button class="choice" data-act="' +
    action +
    '" ' +
    (enabled ? '' : 'disabled') +
    '>' +
    icon(ic) +
    '<span>' +
    e(label) +
    '</span></button>'
  );
}
function openCommandMenu(group = 'main') {
  const [title, ...sections] = menuGroups[group] || menuGroups.main,
    commands = browserCommands();
  const rows = sections
    .map((entries) =>
      entries
        .map((key) => {
          if (key.startsWith('@')) {
            if (key === '@sidebar' && narrowLayout.matches) return '';
            if (key === '@sidebar')
              return (
                '<div class="menu-inline">' +
                icon('panel') +
                '<span>Sidebar</span><div class="segments">' +
                ['on', 'auto', 'off']
                  .map(
                    (m) =>
                      '<button data-act="side-' +
                      m +
                      '" aria-pressed="' +
                      (settings.sidebarMode === m) +
                      '">' +
                      { on: 'On', auto: 'Auto', off: 'Off' }[m] +
                      '</button>',
                  )
                  .join('') +
                '</div></div>'
              );
            if (key === '@zoom' && capabilities.canZoom)
              return (
                '<div class="menu-inline">' +
                icon('search') +
                '<span>Zoom</span>' +
                ['zoomOut', 'zoomReset', 'zoomIn', 'fullscreen']
                  .map((a) => {
                    const c = commands[a];
                    return c[2] === false
                      ? ''
                      : '<button aria-label="' +
                          e(c[0]) +
                          '" title="' +
                          e(c[0]) +
                          '" class="zoom-action" data-act="' +
                          a +
                          '" ' +
                          (c[3] === false ? 'disabled' : '') +
                          '>' +
                          (a === 'zoomReset'
                            ? (current().zoom || settings.defaultZoom || 100) + '%'
                            : icon(a === 'zoomIn' ? 'plus' : a === 'zoomOut' ? 'minus' : 'expand')) +
                          '</button>';
                  })
                  .join('') +
                '</div>'
              );
            const id = key.slice(1),
              [sub, ...groups] = menuGroups[id];
            if (id !== 'sidebar' && !groups.flat().some((action) => control(action, commands))) return '';
            return (
              '<button class="choice" data-act="menu-' +
              id +
              '">' +
              icon(
                {
                  tabs: 'tabs',
                  passwords: 'lock',
                  history: 'history',
                  bookmarks: 'bookmark',
                  zoom: 'search',
                  find: 'edit',
                  share: 'share',
                  more: 'settings',
                  sidebar: 'panel',
                }[id],
              ) +
              '<span>' +
              sub +
              '</span>' +
              icon('forward') +
              '</button>'
            );
          }
          return control(key, commands);
        })
        .join(''),
    )
    .filter(Boolean);
  const footer = group === 'main' ? rows.pop() : '';
  let body =
    (group === 'main' ? '' : actButton('more', 'Browser menu', 'back', 'linkbtn')) +
    rows.map((row) => '<div class="menu-group">' + row + '</div>').join('');
  if (footer) body = '<div class="menu-scroll">' + body + '</div><div class="menu-foot">' + footer + '</div>';
  if (group === 'sidebar') {
    body +=
      '<p class="muted">Desktop sidebar</p><div class="segments">' +
      ['on', 'auto', 'off']
        .map(
          (mode) =>
            '<button aria-pressed="' +
            (settings.sidebarMode === mode) +
            '" data-act="side-' +
            mode +
            '">' +
            { on: 'On', auto: 'Auto-hide', off: 'Off' }[mode] +
            '</button>',
        )
        .join('') +
      '</div>';
  }
  if (group === 'zoom')
    body += '<p class="muted">Page zoom · ' + (current().zoom || settings.defaultZoom || 100) + '%</p>';
  if (group === 'history') body += recentRows(4);
  if (group === 'bookmarks')
    body += saved()
      .slice(0, 4)
      .map((b) => urlRow(b))
      .join('');
  dialog(title, body, 'menu');
  $('#dialog').dataset.layout = 'menu';
}
function storeSettings() {
  write('settings', settings);
  applyTheme();
  updateSidebar();
  render(true);
}
function setSidebarMode(mode) {
  settings.sidebarMode = mode;
  sidebarClosed = mode !== 'on';
  autoRevealed = false;
  write('sidebarClosed', sidebarClosed);
  storeSettings();
  closeDialog();
}
function openTabBarMenu(anchor, pointer) {
  if (!capabilities.canTabBarMenu) {
    command('layoutTabs');
    return;
  }
  const bounds = anchor.getBoundingClientRect();
  const x = pointer ? pointer.clientX : bounds.left + bounds.width / 2;
  const y = pointer ? pointer.clientY : bounds.top + bounds.height / 2;
  send({
    type: 'tabBarMenu', position: settings.tabPosition, searchPinned: settings.pinTabSearch,
    canBookmark: !windowInfo.private && publicTabs(tabs).length > 0,
    x: Math.max(0, Math.min(innerWidth - 1, Math.round(x))),
    y: Math.max(0, Math.min(innerHeight - 1, Math.round(y))),
  });
}

// Electron drag regions swallow double-click and context-menu events. Keep the
// strip interactive and let the host move the window once the pointer drags.
function bindTitlebarDragging() {
  let drag;
  function move(phase, event) {
    send({ type: 'dragTabBar', phase, screenX: event.screenX, screenY: event.screenY });
  }
  document.addEventListener('pointerdown', (event) => {
    if (!capabilities.canTabBarMenu || !event.isPrimary || event.button !== 0 ||
        !event.target.matches('body.native-mac > #top-tabs, body.native-mac > #toolbar')) return;
    event.target.setPointerCapture(event.pointerId);
    drag = event.pointerId;
    move('start', event);
  });
  document.addEventListener('pointermove', (event) => {
    if (drag === event.pointerId) move('move', event);
  });
  function finish(event) {
    if (drag !== event.pointerId) return;
    drag = undefined;
    move('end', event);
  }
  document.addEventListener('pointerup', finish);
  document.addEventListener('lostpointercapture', finish);
}

let lastTitlebarGeometry;
let lastStripMarkup, lastStripSelection;
function reportTitlebarGeometry() {
  if (platform !== 'mac') return;
  const name = document.body.dataset.titlebar;
  const height = name ? Math.round(document.getElementById(name).getBoundingClientRect().height) : 0;
  const geometry = [name, height].join(':');
  if (geometry === lastTitlebarGeometry) return;
  lastTitlebarGeometry = geometry;
  send({ type: 'titlebarTabs', enabled: Boolean(name), height });
}
function renderBrowserBars() {
  const top = $('#top-tabs'),
    bar = $('#bookmark-bar'),
    visible = spaceTabs();
  const body = document.body;
  const desktop = !['ios', 'android'].includes(platform) && !narrowLayout.matches;
  const horizontal = desktop && settings.horizontalTabs;
  body.classList.toggle('desktop-browser', desktop);
  body.classList.toggle('horizontal-tabs', horizontal);
  body.classList.toggle('native-mac', platform === 'mac');
  body.dataset.tabPosition = settings.tabPosition;
  const sideTabs = $('#side-tabs'), rail = $('#rail'), toolbar = $('#toolbar'), progress = $('#loading-bar');
  if (desktop && sideTabs.parentElement === rail) $('main').before(sideTabs);
  if (!desktop && sideTabs.parentElement !== rail) $('.railfoot').before(sideTabs);
  sideTabs.hidden = horizontal;
  if (desktop && progress.parentElement !== toolbar) toolbar.append(progress);
  if (!desktop && progress.parentElement === toolbar) body.prepend(progress);
  top.hidden = !horizontal;
  $('#pinned-tab-search').hidden = !desktop || !settings.pinTabSearch;
  $('.desktop-shield').hidden = !desktop || !adBlock || windowInfo.private;
  $('#vertical-tab-actions').hidden = !desktop || horizontal;
  const spaceMenu = $('#compact-space-menu');
  spaceMenu.hidden = !desktop;
  spaceMenu.dataset.act = spacesEnabled ? 'spaceSheet' : 'openHome';
  if (!spacesEnabled) {
    spaceMenu.title = 'Start page';
    spaceMenu.setAttribute('aria-label', spaceMenu.title);
  }
  const titlebar = horizontal && settings.tabPosition === 'top' ? 'top-tabs' :
    platform === 'mac' || desktop ? 'toolbar' : '';
  if ((body.dataset.titlebar || '') !== titlebar) {
    if (top.parentElement === body) $('main').prepend(top);
    if (toolbar.parentElement === body) $('#address-matches').before(toolbar);
    if (titlebar) {
      body.dataset.titlebar = titlebar;
      $('#shell').before(document.getElementById(titlebar));
    } else {
      delete body.dataset.titlebar;
    }
    reportTitlebarGeometry();
  }
  if (platform === 'mac' && lastTitlebarGeometry === undefined) reportTitlebarGeometry();
  document.querySelectorAll('.tab-count').forEach((button) => {
    button.firstElementChild.textContent = visible.length;
    button.firstElementChild.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-label', visible.length + (visible.length === 1 ? ' open tab. Manage tabs' : ' open tabs. Manage tabs'));
  });
  if (horizontal) {
    const strip = $('#strip-items');
    const markup = visible.map(
          (t, index) =>
            (t.group && visible[index - 1]?.group !== t.group
              ? '<span class="strip-group" title="' + e(t.group) + '">' + e(t.group) + '</span>'
              : '') +
            '<div draggable="true" data-tab-row="' +
            e(t.id) +
            '" class="strip-tab ' +
            (t.id === activeId ? 'chosen' : '') +
            '"><button aria-pressed="' + (t.id === activeId) + '" data-select="' +
            e(t.id) +
            '" title="' +
            e(t.title) +
            '">' +
            tabIcon(t) +
            '<span>' +
            e(t.title || 'Start page') +
            '</span></button><button class="icon" data-close="' +
            e(t.id) +
            '" aria-label="Close ' +
            e(t.title) +
            '">' +
            icon('x') +
            '</button></div>',
        )
        .join('');
    if (markup !== lastStripMarkup) {
      const focused = strip.contains(document.activeElement) ? document.activeElement.dataset : null;
      strip.innerHTML = markup;
      lastStripMarkup = markup;
      if (focused?.select || focused?.close) {
        const key = focused.select ? 'select' : 'close';
        strip.querySelector('[data-' + key + '="' + CSS.escape(focused[key]) + '"]')?.focus({preventScroll: true});
      }
    }
    if (lastStripSelection !== activeId) {
      const selected = strip.querySelector('.chosen')?.getBoundingClientRect();
      const bounds = strip.getBoundingClientRect();
      if (selected?.right > bounds.right) strip.scrollLeft += selected.right - bounds.right;
      else if (selected?.left < bounds.left) strip.scrollLeft += selected.left - bounds.left;
      lastStripSelection = activeId;
    }
  } else lastStripSelection = undefined;
  bar.hidden = !settings.bookmarkBar || windowInfo.private;
  if (!bar.hidden)
    bar.innerHTML =
      saved()
        .slice(0, 40)
        .map(
          (b) =>
            '<button data-url="' +
            e(b.url) +
            '" title="' +
            e(b.url) +
            '">' +
            icon('bookmark') +
            e(b.title || hostOf(b.url)) +
            '</button>',
        )
        .join('') || '<button data-act="bookmarks">' + icon('bookmark') + 'Open bookmark manager</button>';
}
function recentRows(limit = 25) {
  const entries = read(closedTabsKey, []).slice(0, limit);
  return entries
    .map(
      (b, i) =>
        '<button class="choice" data-act="restore-' +
        i +
        '">' +
        icon('history') +
        '<span class="single">' +
        e(b.title || hostOf(b.url)) +
        '</span></button>',
    )
    .join('');
}
function restoreClosed(index) {
  if (windowInfo.private) return;
  const list = read(closedTabsKey, []),
    item = list[index];
  if (!item || !webURL(item.url)) return;
  list.splice(index, 1);
  write(closedTabsKey, list);
  addTab(false, item.url, {
    title: item.title,
    group: item.group,
    pinned: item.pinned,
    zoom: item.zoom,
    desktopSite: item.desktopSite,
  });
}
function tabList(filter = '', showMemory = false) {
  const query = filter.trim().toLowerCase();
  return (
    spaceTabs()
      .filter((t) => (t.title + ' ' + t.url + ' ' + (t.group || '')).toLowerCase().includes(query))
      .map(
        (t) =>
          '<button class="choice" data-select="' +
          e(t.id) +
          '">' +
          tabIcon(t, 'tabs') +
          '<span class="grow single">' +
          e(t.title || 'Start page') +
          '<small>' +
          e(t.group || hostOf(t.url)) +
          '</small></span>' +
          (showMemory ? '<small data-memory-tab="' + e(t.id) + '">' + (mounted.has(t.id) ? 'Measuring…' : 'Unloaded') + '</small>' : '') +
          (t.id === activeId ? icon('check') : '') +
          '</button>',
      )
      .join('') || '<p class="muted">No matching tabs.</p>'
  );
}
let memoryRequest;
function sampleTabMemory() {
  if (modal !== 'performance' || !capabilities.canSampleTabMemory) return;
  memoryRequest = uid();
  send({ type: 'sampleTabMemory', requestId: memoryRequest, ids: spaceTabs().filter(t => mounted.has(t.id)).map(t => t.id) });
}
function readingList() {
  const items = read('reading', []);
  dialog(
    'Reading list',
    items.length
      ? items
          .map(
            (x, i) =>
              '<div class="item"><button class="grow" data-url="' +
              e(x.url) +
              '"><span>' +
              e(x.title || hostOf(x.url)) +
              '</span></button><button class="icon" data-act="unread-' +
              i +
              '" aria-label="Remove from reading list">' +
              icon('x') +
              '</button></div>',
          )
          .join('')
      : emptyState(
          'book',
          'Your reading list is empty',
          'Use Save to reading list on a page you want to read later.',
        ),
    'reading',
  );
}
function addManyBookmarks(items) {
  let added = 0;
  const known = new Set(saved().map((b) => b.url));
  for (const item of items) {
    const url = webURL(item.url);
    if (!url || known.has(url) || bookmarks.length >= 2000) continue;
    bookmarks.push({
      id: uid(),
      url,
      title: String(item.title || hostOf(url)).slice(0, 512),
      updatedAt: Date.now(),
      deleted: false,
    });
    known.add(url);
    added++;
  }
  saveBookmarks();
  render(true);
  return added;
}
function importBookmarks(text) {
  if (windowInfo.private || typeof text !== 'string' || text.length > 2097152) {
    toast('Choose a bookmark HTML file under 2 MB.');
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = text;
  const items = Array.from(template.content.querySelectorAll('a[href]'), (a) => ({
    url: a.getAttribute('href'),
    title: a.textContent,
  }));
  const added = addManyBookmarks(items);
  closeDialog();
  toast(added + ' bookmark' + (added === 1 ? '' : 's') + ' imported.');
}
function exportBookmarkText() {
  return (
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Vaayvu bookmarks</TITLE>\n<H1>Vaayvu bookmarks</H1>\n<DL><p>\n' +
    saved()
      .map((b) => '  <DT><A HREF="' + e(b.url) + '">' + e(b.title) + '</A>')
      .join('\n') +
    '\n</DL><p>\n'
  );
}
function showQR() {
  const url = current().url;
  try {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    dialog(
      'Share with a QR code',
      '<div class="qr-wrap">' +
        code.createSvgTag({ cellSize: 4, margin: 16, scalable: true }) +
        '</div><p class="dialognote">' +
        e(url) +
        '</p>',
      'qr',
    );
  } catch {
    toast('This address is too long to fit in a QR code.');
  }
}
function deleteDataDialog() {
  const row = (key, label, checked = false) =>
    '<label class="optin"><input type="checkbox" name="' +
    key +
    '" ' +
    (checked ? 'checked' : '') +
    '> ' +
    label +
    '</label>';
  dialog(
    'Delete browsing data',
    '<form id="delete-data"><p class="muted">Choose what to remove from this device. Removing website data signs you out of websites.</p>' +
      row('history', 'Browsing history and recently closed tabs', true) +
      row('downloads', 'Download history') +
      (capabilities.canClearSiteData ? row('sites', 'Website cookies, storage, and cache') : '') +
      '<div class="dialogbuttons"><button class="primary">Delete selected data</button>' +
      actButton('dismiss', 'Cancel') +
      '</div></form>',
    'deleteData',
  );
}
function commandBarRows(q) {
  const query = String(q || '').trim();
  const lower = query.toLowerCase();
  const visible = spaceTabs();
  const dest = destination(query);
  const address = !!dest && !VaayvuCore.providerQuery(dest);
  let html = '';
  if (query) {
    const label = address
      ? dest.replace(/^https?:\/\//, '').replace(/\/$/, '')
      : '“' + query + '”';
    html +=
      '<button class="choice" data-cb-go="' +
      e(query) +
      '">' +
      icon(address ? 'compass' : 'search') +
      '<span class="grow single">' +
      (address ? 'Open ' : 'Search for ') +
      e(label) +
      '</span><small>' +
      (address ? 'Address' : 'Search') +
      '</small></button>';
  }
  const ordered = [...visible, ...tabs.filter((t) => !visible.includes(t))];
  const matches = ordered
    .filter((t) => (t.title + ' ' + t.url).toLowerCase().includes(lower))
    .slice(0, 6);
  if (matches.length) {
    html +=
      '<h2 class="listhead">Tabs</h2>' +
      matches
        .map(
          (t) =>
            '<button class="choice" data-select="' +
            e(t.id) +
            '">' +
            tabIcon(t, 'tabs') +
            '<span class="grow single">' +
            e(t.title || 'Start page') +
            '<small>' +
            e(spaceNameOf(t) || hostOf(t.url)) +
            '</small></span>' +
            (t.id === activeId ? icon('check') : '') +
            '</button>',
        )
        .join('');
  }
  if (spacesEnabled) {
    const found = spaces.list.filter((s) => !lower || s.name.toLowerCase().includes(lower)).slice(0, 6);
    if (found.length) {
      const counts = spaceStore.count(tabs, spaces);
      html +=
        '<h2 class="listhead">Spaces</h2>' +
        found
          .map(
            (s) =>
              '<button class="choice" data-space="' +
              e(s.id) +
              '"><span class="space-emoji">' +
              e(s.emoji) +
              '</span><span class="grow single">' +
              e(s.name) +
              '<small>' +
              (counts.get(s.id) || 0) +
              ' tab' +
              ((counts.get(s.id) || 0) === 1 ? '' : 's') +
              '</small></span>' +
              (s.id === spaces.active ? icon('check') : '') +
              '</button>',
          )
          .join('');
    }
  }
  const actionRows = paletteRows(query);
  if (actionRows) html += '<h2 class="listhead">Actions</h2>' + actionRows;
  if (query && view === 'web' && current().url)
    html +=
      '<h2 class="listhead">Ask Vaayvu</h2><button class="choice" data-act="tools">' +
      icon('spark') +
      '<span class="grow single">Ask about this page<small>' +
      e(current().title || hostOf(current().url)) +
      '</small></span></button>';
  return html || '<p class="muted">No matches.</p>';
}
function showCommandBar() {
  dialog(
    'Command bar',
    '<input class="searchlist" id="command-filter" autocorrect="off" autocapitalize="none" writingsuggestions="false" spellcheck="false" aria-label="Command bar" autocomplete="off" placeholder="Search tabs, spaces and actions, or type an address"><div id="command-results">' +
      commandBarRows('') +
      '</div>',
    'quick',
  );
  const input = $('#command-filter');
  const results = $('#command-results');
  input.focus();
  input.addEventListener('input', () => {
    results.innerHTML = commandBarRows(input.value);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      results.querySelector('button:not(:disabled)')?.click();
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      results.querySelector('button:not(:disabled)')?.focus();
    }
  });
  results.addEventListener('click', (ev) => {
    const go = ev.target.closest('[data-cb-go]');
    if (!go) return;
    const value = go.dataset.cbGo;
    closeDialog();
    navigate(value);
  });
}
function showPalette() {
  showCommandBar();
}
function paletteRows(q) {
  const commands = browserCommands();
  return (
    Object.keys(commands)
      .filter((a) => commands[a][0].toLowerCase().includes(q.trim().toLowerCase()))
      .map((a) => control(a, commands))
      .join('')
  );
}
function advancedSettings(section) {
  VaayvuPreferences.open(section);
}
function showHelp() {
  dialog(
    'Help and shortcuts',
    '<div class="stack"><p class="about-brand"><img src="assets/vaayvu.svg" width="30" height="30" alt=""><strong>Vaayvu Browser ' + BROWSER_VERSION + '</strong></p><p class="muted">Search or type an address in the top bar. Open the browser menu for tab tools, privacy, bookmarks, zoom, and sharing.</p><dl class="keys"><dt>Focus address</dt><dd>⌘ / Ctrl + L</dd><dt>New tab</dt><dd>⌘ / Ctrl + T</dd><dt>Find on page</dt><dd>⌘ / Ctrl + F</dd><dt>Reopen tab</dt><dd>⌘ / Ctrl + Shift + T</dd><dt>Command bar</dt><dd>⌘ / Ctrl + K</dd><dt>Split view</dt><dd>⌘ / Ctrl + Shift + D</dd><dt>Switch space</dt><dd>⌥ / Alt + 1–9</dd></dl>' +
      actButton('projectHelp', 'Open Vaayvu’s GitHub documentation', 'book') +
      '</div>',
    'help',
  );
}
function advancedCommand(act) {
  const t = current(),
    commands = browserCommands();
  if (commands[act] && (commands[act][2] === false || commands[act][3] === false)) return true;
  if (act.startsWith('position-') && Object.hasOwn(VaayvuPreferences.positions, act.slice(9))) {
    closeDialog();
    VaayvuPreferences.commit({ tabPosition: act.slice(9) });
    rectUpdate(true);
    return true;
  }
  if (act.startsWith('menu-')) {
    openCommandMenu(act.slice(5));
    return true;
  }
  if (act.startsWith('side-')) {
    setSidebarMode(act.slice(5));
    return true;
  }
  if (act.startsWith('pref-')) {
    advancedSettings(act.slice(5));
    return true;
  }
  if (act.startsWith('restore-')) {
    restoreClosed(Number(act.slice(8)));
    return true;
  }
  if (act.startsWith('unread-')) {
    const list = read('reading', []);
    list.splice(Number(act.slice(7)), 1);
    write('reading', list);
    readingList();
    return true;
  }
  switch (act) {
    case 'extensions':
      VaayvuExtensions.manager();
      break;
    case 'desktopSite':
      t.desktopSite = !t.desktopSite;
      persistTabs();
      closeDialog();
      send({ type: 'desktopSite', id: t.id, enabled: t.desktopSite });
      break;
    case 'newWindow':
    case 'privateWindow':
      closeDialog();
      send({ type: 'newWindow', private: act === 'privateWindow' });
      break;
    case 'sidebar':
      toggleSidebar();
      break;
    case 'duplicateTab':
    case 'pinTab':
    case 'moveLeft':
    case 'moveRight':
    case 'groupTab':
      applyTabAction(act, t.id);
      break;
    case 'renameWindow':
      dialog(
        'Name window',
        '<form id="window-name"><label>Window name<input name="name" maxlength="80" required></label><button class="primary">Rename</button></form>',
        'name',
      );
      break;
    case 'tabSearch':
      dialog(
        'Search tabs',
        '<input id="tab-filter" class="searchlist" aria-label="Search open tabs" placeholder="Search title, address or group"><div id="tab-results">' +
          tabList() +
          '</div>',
        'searchTabs',
      );
      $('#tab-filter').focus();
      break;
    case 'splitView':
      toggleSplit();
      break;
    case 'closedList':
      dialog(
        'Recently closed',
        recentRows() ||
          emptyState('clock', 'No recently closed tabs', 'Closed regular web tabs appear here.'),
        'closed',
      );
      break;
    case 'reopenTab':
      restoreClosed(0);
      break;
    case 'tabBarMenu':
      openTabBarMenu($('#top-tabs:not([hidden]) .strip-placement') || $('#vertical-tab-actions'));
      break;
    case 'toggleTabSearch':
      VaayvuPreferences.commit({ pinTabSearch: !settings.pinTabSearch });
      break;
    case 'layoutTabs':
      dialog('Tab bar alignment', '<div class="stack">' + Object.entries(VaayvuPreferences.positions).map(([id, label]) =>
        '<button class="choice" data-act="position-' + id + '" aria-pressed="' + (settings.tabPosition === id) + '">' +
        icon('panel') + '<span>' + label + '</span>' + (settings.tabPosition === id ? icon('check') : '') + '</button>').join('') + '</div>', 'placement');
      break;
    case 'bookmarkBar':
      settings.bookmarkBar = !settings.bookmarkBar;
      closeDialog();
      storeSettings();
      break;
    case 'bookmarkAll': {
      const count = addManyBookmarks(publicTabs(tabs));
      closeDialog();
      toast(count + ' bookmarks added.');
      break;
    }
    case 'bookmarkImport':
      closeDialog();
      send({ type: 'importBookmarks' });
      break;
    case 'bookmarkExport':
      closeDialog();
      send({ type: 'exportBookmarks', text: exportBookmarkText() });
      break;
    case 'reading':
      readingList();
      break;
    case 'readLater': {
      const entries = read('reading', []).filter((x) => x.url !== t.url);
      write('reading', [{ url: t.url, title: t.title }, ...entries]);
      closeDialog();
      toast('Saved to reading list.');
      break;
    }
    case 'quick':
      showPalette();
      break;
    case 'performance': {
      const visibleTabs = spaceTabs();
      dialog(
        commands.performance[0],
        '<div class="stack"><p class="muted">' +
          visibleTabs.filter(tab => mounted.has(tab.id)).length +
          ' loaded web tabs · ' +
          visibleTabs.length +
          ' tabs in this space</p>' +
          (capabilities.canSampleTabMemory ? '<p class="muted">Memory shows the resident size of each tab’s main Chromium renderer. Tabs sharing a renderer show the same measurement.</p>' +
            actButton('refreshTabMemory', 'Refresh memory', 'reload') : '') +
          control('suspendTab', commands) +
          tabList('', capabilities.canSampleTabMemory) +
          '</div>',
        'performance',
      );
      sampleTabMemory();
      break;
    }
    case 'refreshTabMemory':
      sampleTabMemory();
      break;
    case 'suspendTab':
      for (const id of [...mounted])
        if (id !== activeId) {
          send({ type: 'close', id });
          mounted.delete(id);
        }
      closeDialog();
      toast('Inactive web tabs unloaded. Select a tab to reload its address.');
      break;
    case 'clearData':
      deleteDataDialog();
      break;
    case 'clearCookies':
      closeDialog();
      send({ type: 'clearCookies' });
      toast('Cookies cleared.');
      break;
    case 'protection':
      advancedSettings('privacy');
      break;
    case 'help':
      showHelp();
      break;
    case 'projectHelp':
      closeDialog();
      navigate('https://github.com/Mahesh-Vanga/Vaayvu');
      break;
    case 'qr':
      showQR();
      break;
    case 'cut':
    case 'copySelection':
    case 'paste':
    case 'selectAll':
      closeDialog();
      send({ type: 'editPage', id: t.id, action: act === 'copySelection' ? 'copy' : act });
      break;
    case 'copyURL':
      closeDialog();
      if (capabilities.canCopy) send({ type: 'copy', text: t.url });
      else
        navigator.clipboard
          ?.writeText(t.url)
          .then(() => toast('Link copied.'))
          .catch(() => toast('Could not copy this link.'));
      break;
    case 'zoomReset':
    case 'zoomIn':
    case 'zoomOut': {
      const percent = Math.min(
        200,
        Math.max(
          50,
          act === 'zoomReset'
            ? settings.defaultZoom
            : (t.zoom || settings.defaultZoom || 100) + (act === 'zoomIn' ? 10 : -10),
        ),
      );
      t.zoom = act === 'zoomReset' ? undefined : percent;
      persistTabs();
      closeDialog();
      send({ type: 'zoom', id: t.id, percent });
      toast('Page zoom ' + percent + '%.');
      break;
    }
    case 'sendDevice': {
      if (!sync.session) {
        accountDialog();
        break;
      }
      const others = devices.filter((d) => d.id !== deviceId);
      dialog(
        'Send to your device',
        others.length
          ? others
              .map(
                (d) =>
                  '<button class="choice" data-send-device="' +
                  e(d.id) +
                  '">' +
                  icon('devices') +
                  '<span>' +
                  e(d.name) +
                  '</span></button>',
              )
              .join('')
          : emptyState(
              'devices',
              'No other device connected',
              'Sign in with your Vaayvu ID on a second device and sync it.',
            ),
        'sendDevice',
      );
      break;
    }
    case 'inspect':
      pageInspector.open();
      break;
    case 'profiles':
      if (platform !== 'mac') send({type:'profiles'});
      showProfiles();
      break;
    case 'guestWindow':
      closeDialog();
      send({ type: 'guestWindow' });
      break;
    case 'customize':
      advancedSettings('appearance');
      break;
    case 'capture':
    case 'fullscreen':
    case 'systemVPN':
    case 'requestDefaultBrowser':
    case 'requestNotifications':
    case 'dnsSettings':
    case 'systemPasswords':
    case 'sitePermissions':
    case 'savePDF':
    case 'print':
    case 'savePage':
    case 'shortcut':
      closeDialog();
      send({ type: act, id: t.id });
      break;
    default:
      return false;
  }
  return true;
}
const legacyCleanup = new Map();
function deleteBrowsingRecords({ history = false, downloads: clearDownloads = false, sites = false }) {
  if (windowInfo.private || (history && !clearLocalHistory())) return;
  if (clearDownloads) {
    if (!write('downloads', [])) return;
    downloads = [];
  }
  closeDialog();
  render(true);
  const clearSites = sites && capabilities.canClearSiteData;
  const finish = (success) => {
    if (clearSites) send({ type: 'clearSiteData' });
    if (!success) toast('Some records from an earlier installation could not be cleared.');
    else if (!clearSites) toast('Selected browsing records cleared.');
  };
  if (!capabilities.canClearLegacyRecords || (!history && !clearDownloads)) {
    finish(true);
    return;
  }
  const requestId = uid();
  const timeout = setTimeout(() => {
    legacyCleanup.delete(requestId);
    finish(false);
  }, 30000);
  legacyCleanup.set(requestId, (success) => {
    clearTimeout(timeout);
    finish(success);
  });
  send({ type: 'clearLegacyRecords', history, downloads: clearDownloads, requestId });
}
function advancedSubmit(form, data) {
  if (form.id === 'delete-data') {
    if (!data.has('history') && !data.has('downloads') && !data.has('sites')) {
      toast('Select at least one item.');
      return true;
    }
    deleteBrowsingRecords({
      history: data.has('history'),
      downloads: data.has('downloads'),
      sites: data.has('sites'),
    });
    return true;
  }
  if (form.id === 'new-profile') {
    const name = data.get('name').trim();
    if (!name) return true;
    closeDialog();
    send({ type: 'newProfile', name });
    return true;
  }
  if (form.id === 'window-name') {
    closeDialog();
    send({ type: 'renameWindow', name: data.get('name').trim() });
    return true;
  }
  return false;
}
function handleAdvancedEvent(event) {
  if (event.type === 'tabMemory') {
    if (modal === 'performance' && memoryRequest && event.requestId === memoryRequest) {
      memoryRequest = undefined;
      const samples = event.samples || {};
      const counts = new Map();
      for (const sample of Object.values(samples)) {
        if (Number.isInteger(sample?.pid)) counts.set(sample.pid, (counts.get(sample.pid) || 0) + 1);
      }
      for (const label of document.querySelectorAll('#dialog [data-memory-tab]')) {
        const id = label.dataset.memoryTab;
        const sample = Object.hasOwn(samples, id) && samples[id];
        label.textContent = sample && Number.isFinite(sample.bytes) && sample.bytes >= 0
          ? Math.round(sample.bytes / 1048576).toLocaleString() + ' MiB' + (counts.get(sample.pid) > 1 ? ' · shared' : '')
          : mounted.has(id) ? 'Unavailable' : 'Unloaded';
      }
    }
    return true;
  }
  if (event.type === 'nativeInspectorUnavailable') {
    if (event.id === activeId && event.url === current()?.url && pageInspector.available())
      toast('Developer tools could not open for this page.');
    return true;
  }
  if (event.type === 'legacyRecordsCleared') {
    const finish = legacyCleanup.get(event.requestId);
    if (finish) {
      legacyCleanup.delete(event.requestId);
      finish(event.success === true);
    }
    return true;
  }
  if (event.type === 'menuPreview') {
    if (
      !menuPreviewToken ||
      event.requestId !== menuPreviewToken ||
      event.id !== activeId ||
      current().private ||
      !$('#dialog').open ||
      typeof event.image !== 'string' ||
      !event.image.startsWith('data:image/jpeg;base64,') ||
      event.image.length > 3000000
    )
      return true;
    const preview = new Image();
    preview.alt = '';
    preview.src = event.image;
    preview.className = 'menu-backdrop-preview';
    $('#viewport .menu-backdrop-preview')?.remove();
    $('#viewport').append(preview);
    return true;
  }
  if (event.type === 'profiles') {
    profileCatalog = (Array.isArray(event.profiles) ? event.profiles : []).filter(p => p && typeof p.id === 'string' && typeof p.name === 'string');
    const profile = profileCatalog.find(p => p.id === event.active);
    if (profile) { windowInfo.profileId = profile.id; windowInfo.profileName = profile.name; drawRail(); }
    if (modal === 'profiles') showProfiles();
    return true;
  }
  if (event.type === 'bookmarkFile') {
    importBookmarks(event.text);
    return true;
  }
  if (event.type === 'resetWebTabs') {
    for (const id of event.ids || []) mounted.delete(id);
    closeApprovedVisits(event.ids || []);
    if (view === 'web') activateTab();
    return true;
  }
  if (event.type === 'windows') {
    if (Array.isArray(event.ids)) windowIds = event.ids.filter((id) => typeof id === 'string');
    queueSync();
    return true;
  }
  return false;
}
function bindAdvancedControls() {
  bindTitlebarDragging();
  const titlebarSize = new ResizeObserver(reportTitlebarGeometry);
  titlebarSize.observe($('#toolbar'));
  titlebarSize.observe($('#top-tabs'));
  narrowLayout.addEventListener('change', renderBrowserBars);
  $('#sidebar-peek').addEventListener('pointerenter', () => {
    autoRevealed = true;
    updateSidebar();
    rectUpdate();
  });
  $('#sidebar-peek').addEventListener('click', () => {
    autoRevealed = true;
    updateSidebar();
    focusSidebarToggle();
  });
  $('#rail').addEventListener('pointerleave', () => {
    if (settings.sidebarMode === 'auto' && !narrowLayout.matches) {
      autoRevealed = false;
      updateSidebar();
      rectUpdate();
    }
  });
  document.addEventListener('click', (ev) => {
    const fold = ev.target.closest('[data-fold]');
    if (fold) {
      const group = fold.dataset.fold;
      if (foldedGroups.has(group)) foldedGroups.delete(group);
      else foldedGroups.add(group);
      drawRail();
      return;
    }
    const target = ev.target.closest('[data-send-device]');
    if (target && modal === 'sendDevice' && !closeStaleAccountDialog() && sync.session && !current().private && view === 'web') {
      const page = { url: current().url, title: current().title };
      target.disabled = true;
      sync
        .sendPage(deviceId, target.dataset.sendDevice, page)
        .then(() => {
          closeDialog();
          toast('Page sent.');
        })
        .catch((err) => {
          target.disabled = false;
          toast(err.message);
        });
    }
    const delivery = ev.target.closest('[data-delivery]');
    if (delivery) {
      const item = incoming.find((p) => p.id === delivery.dataset.delivery);
      if (item) {
        if (delivery.dataset.open === 'true') addTab(false, item.url);
        sync
          .dismissPage(deviceId, item.id)
          .then(() => {
            incoming = incoming.filter((p) => p.id !== item.id);
            write('incoming.' + sync.profileKey, incoming);
            if (view === 'devices') render(true);
          })
          .catch((err) => toast(err.message));
      }
    }
    const profile = ev.target.closest('button[data-profile]');
    if (profile) {
      closeDialog();
      send({ type: 'switchProfile', id: profile.dataset.profile });
    }
  });
  document.addEventListener('input', (ev) => {
    const q = ev.target.value;
    if (ev.target.id === 'tab-filter') $('#tab-results').innerHTML = tabList(q);
    if (ev.target.id === 'command-filter') $('#command-results').innerHTML = commandBarRows(q);
  });
  document.addEventListener(
    'keydown',
    (ev) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return;
      const key = ev.key.toLowerCase();
      let act = '';
      if (ev.shiftKey && key === 't') act = 'reopenTab';
      if (ev.shiftKey && key === 'p') act = 'quick';
      if (ev.shiftKey && key === 'd') act = 'splitView';
      if (!ev.shiftKey && key === 'p') act = 'print';
      if (key === '=' || key === '+') act = 'zoomIn';
      if (key === '-') act = 'zoomOut';
      if (key === '0') act = 'zoomReset';
      if (act) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        command(act);
      }
    },
    true,
  );
  addEventListener('storage', (event) => {
    const key = event.key;
    if (key === 'vaayvu.adBlock' && adBlock) {
      adBlockConfig = normalizeAdBlockConfig(read('adBlock', {}));
      sendBlocklist();
      drawBar();
      return;
    }
    if (
      !key ||
      !key.startsWith('vaayvu.') ||
      (windowInfo.private && key !== 'vaayvu.settings')
    )
      return;
    const suffix = key.slice('vaayvu.'.length);
    if (suffix === 'incoming.' + sync.profileKey) {
      incoming = read('incoming.' + sync.profileKey, []);
      if (view === 'devices') render(true);
      return;
    }
    if (suffix === 'sync.session.v1') {
      forgetAllSearches();
      incoming = read('incoming.' + sync.profileKey, []);
      bookmarks = read('bookmarks.' + sync.profileKey, []);
      devices = read('devices.' + sync.profileKey, []);
      lastSync = '';
      syncError = '';
      closeStaleAccountDialog();
      queueSync();
      render(true);
    } else if (suffix === 'bookmarks.' + sync.profileKey) {
      bookmarks = mergeBookmarks(read('bookmarks.' + sync.profileKey, []), bookmarks);
      render(true);
    } else if (suffix === 'devices.' + sync.profileKey) {
      devices = read('devices.' + sync.profileKey, []);
      if (view === 'devices') render(true);
    } else if (suffix === 'history' || suffix === 'favorites' || suffix === 'downloads') {
      historyItems = read('history', []);
      favorites = read('favorites', initialFavs);
      downloads = read('downloads', []);
      render(true);
    } else if (suffix === 'settings') {
      const wasOpen = settings.ordinaryWeb;
      settings = VaayvuPreferences.normalize(read('settings', {}), read('sidebarClosed', false));
      if (wasOpen !== settings.ordinaryWeb) updateWebsiteAccess();
      sidebarClosed = settings.sidebarMode !== 'on';
      applyTheme();
      updateSidebar();
      sendProtection();
      sendBlocklist();
      sendLiteYouTube();
      sendLowMemoryBrowsing();
      sendYouTubeDesktopOptimization();
      if (view === 'web') activateTab();
      render(true);
      rectUpdate();
    } else if (
      (suffix === 'tabs' || suffix.startsWith('tabs.') || suffix === 'syncRequest') &&
      windowIds[0] === windowInfo.id
    )
      queueSync();
  });
}

function inboxRows() {
  if (!sync.session || !incoming.length) return '';
  return (
    '<h2 class="listhead">Sent to this device</h2><div class="list">' +
    incoming
      .map(
        (item) =>
          '<div class="item"><button class="grow" data-delivery="' +
          e(item.id) +
          '" data-open="true"><span><strong>' +
          e(item.title || hostOf(item.url)) +
          '</strong><small>' +
          e(item.sender) +
          ' · ' +
          e(hostOf(item.url)) +
          '</small></span></button><button class="icon" data-delivery="' +
          e(item.id) +
          '" aria-label="Dismiss sent page">' +
          icon('x') +
          '</button></div>',
      )
      .join('') +
    '</div>'
  );
}

const foldedGroups = new Set();
function groupPalette() {
  return typeof groupColors !== 'undefined' && groupColors.length ? groupColors : ['#6653bb'];
}
function groupTone(color) {
  const palette = groupPalette();
  const index = palette.indexOf(color);
  return 'gc-' + (index < 0 ? 0 : index);
}
function tabIcon(t, websiteIcon = 'globe') {
  return icon(t.pinned ? 'pin' : t.private ? 'private' : t.url ? websiteIcon : 'vaayvu');
}
function sidebarTab(t) {
  const tables = typeof tabGroups !== 'undefined' ? tabGroups : {};
  const g = t.group ? (tables[t.group] || {}) : null;
  const color = g && g.color ? g.color : '';
  return (
    '<div draggable="true" data-tab-row="' +
    e(t.id) +
    '" class="tab ' +
    (t.id === activeId ? 'current' : '') +
    (t.group ? ' in-group ' + groupTone(color || groupPalette()[0]) : '') +
    '"><button class="tabname" data-select="' +
    e(t.id) +
    '" title="' +
    e(t.title) +
    '">' +
    tabIcon(t) +
    '<span>' +
    e(t.title || hostOf(t.url) || 'Start page') +
    '</span></button><button class="icon tabclose" data-close="' +
    e(t.id) +
    '" aria-label="Close ' +
    e(t.title || 'tab') +
    '">' +
    icon('x') +
    '</button></div>'
  );
}
function sidebarTabs(items) {
  const pinned = items.filter((t) => t.pinned);
  if (!pinned.length) return groupedSidebar(items);
  return (
    '<div class="pinned-title">' +
    icon('pin') +
    'Pinned</div>' +
    groupedSidebar(pinned) +
    groupedSidebar(items.filter((t) => !t.pinned))
  );
}
function groupedSidebar(items) {
  const groups = new Map(),
    order = [];
  for (const tab of items) {
    if (!tab.group) {
      order.push(tab);
      continue;
    }
    if (!groups.has(tab.group)) {
      groups.set(tab.group, []);
      order.push(tab.group);
    }
    groups.get(tab.group).push(tab);
  }
  return order
    .map((item) => {
      if (typeof item !== 'string') return sidebarTab(item);
      const group = groups.get(item),
        folded = foldedGroups.has(item),
        g = (typeof tabGroups !== 'undefined' ? tabGroups : {})[item] || {},
        color = g.color || groupPalette()[0],
        name = g.name || item;
      return (
        '<button class="group-toggle" aria-expanded="' +
        !folded +
        '" data-fold="' +
        e(item) +
        '">' +
        '<span class="group-dot ' +
        groupTone(color) +
        '"></span>' +
        icon(folded ? 'forward' : 'down') +
        '<span class="single">' +
        e(name) +
        '</span><small>' +
        group.length +
        '</small></button>' +
        (folded ? '' : group.map(sidebarTab).join(''))
      );
    })
    .join('');
}
