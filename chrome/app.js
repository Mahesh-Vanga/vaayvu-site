'use strict';
const BROWSER_VERSION = '0.0.23';
const $ = (selector) => document.querySelector(selector);
const { webURL, destination, escapeHTML: e, mergeBookmarks, publicTabs, stripTrackingParams } = VaayvuCore;
const adBlock = typeof VaayvuVFD !== 'undefined' ? VaayvuVFD : null; // VAAYVU's own native engine (docs/VFD-FORMAT.md)
const vfdDb = adBlock ? adBlock.load(globalThis.VaayvuVFDRules) : null;
// VAAYVU's default is full protection. Strong mode also checks the small,
// verified set of same-site ad paths; people can reduce this per profile in
// Protection when a particular site needs it.
const VFD_DEFAULTS = { schema: 2, enabled: true, lists: { ads: true, trackers: true, social: true, cosmetic: true, aggressive: true }, custom: [], pausedSites: [] };
function normalizeAdBlockConfig(stored) {
  if (!stored || typeof stored !== 'object' || stored.schema !== 2) {
    return {
      schema: 2,
      enabled: true,
      lists: { ...VFD_DEFAULTS.lists },
      custom: Array.isArray(stored && stored.custom) ? stored.custom.filter((h) => typeof h === 'string').slice(0, 512) : [],
      pausedSites: Array.isArray(stored && stored.pausedSites) ? stored.pausedSites.filter((h) => typeof h === 'string').slice(0, 256) : [],
    };
  }
  const lists = { ...VFD_DEFAULTS.lists, ...((stored && stored.lists) || {}) };
  for (const key of Object.keys(VFD_DEFAULTS.lists)) lists[key] = lists[key] === true;
  return {
    schema: 2,
    enabled: stored.enabled !== false,
    lists,
    custom: Array.isArray(stored && stored.custom) ? stored.custom.filter((h) => typeof h === 'string').slice(0, 512) : [],
    pausedSites: Array.isArray(stored && stored.pausedSites) ? stored.pausedSites.filter((h) => typeof h === 'string').slice(0, 256) : [],
  };
}
migrateVaayvuStore();
let adBlockConfig = normalizeAdBlockConfig(read('adBlock', {}));
function read(key, fallback) {
  try {
    const value = vaayvuStoreGet(key, fallback);
    if (
      value === null ||
      typeof value !== typeof fallback ||
      Array.isArray(value) !== Array.isArray(fallback)
    )
      return fallback;
    if (Array.isArray(fallback))
      return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    return value;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  if (globalThis.VaayvuStorage) {
    const result = globalThis.VaayvuStorage.write('vaayvu.' + key, value);
    if (!result.ok) {
      toast('Device storage is full or unavailable.');
      return false;
    }
    return true;
  }
  try {
    vaayvuStoreSet(key, value);
    return true;
  } catch {
    toast('Device storage is full or unavailable.');
    return false;
  }
}
const uid = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint32Array(4)), (v) => v.toString(16)).join('-');
const initialFavs = [
  { title: 'GitHub', url: 'https://github.com/' },
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { title: 'Figma', url: 'https://www.figma.com/' },
];
const sync = window.VaayvuSync;
const windowInfo = { id: 'main', private: false, regularWindowIds: ['main'], ...window.vaayvuWindow };
let windowIds = windowInfo.regularWindowIds || ['main'];
let incoming = read('incoming.' + sync.profileKey, []);
const windowKey = (key) => (windowInfo.id === 'main' ? key : key + '.' + windowInfo.id);
let capabilities = {};
let autoRevealed = false;
const closedTabsKey = windowKey('recentlyClosed');
let settings = VaayvuPreferences.normalize(read('settings', {}), read('sidebarClosed', false));
VaayvuCore.setLegacyTemplate(settings.legacySearchTemplate);
sync.allowNetwork(settings.ordinaryWeb);
if (adBlock && vfdDb) {
  const rawAdBlock = read('adBlock', {});
  adBlockConfig = normalizeAdBlockConfig(rawAdBlock);
  if (!rawAdBlock || rawAdBlock.schema !== 2) write('adBlock', adBlockConfig);
}
let favorites = read('favorites', initialFavs),
  historyItems = read('history', []),
  downloads = read('downloads', []),
  passwords = read('passwords', []);
const groupColors = ['#6653bb', '#e84393', '#00b894', '#fdcb6e', '#0984e3', '#6c5ce7', '#fd79a8', '#feca57'];
let tabGroups = read('tabGroups', {});
let split = read(windowKey('split'), { left: '', right: '', ratio: 0.5 });
let paramsStripped = 0;
/* Spaces: Arc-style workspaces that own their own tabs, pinned row and accent. */
const spaceStore = typeof VaayvuSpaces !== 'undefined' ? VaayvuSpaces : null;
const spacesEnabled = !!spaceStore && !windowInfo.private;
let spaces = spaceStore
  ? spaceStore.load()
  : { active: 'personal', list: [{ id: 'personal', name: 'Personal', emoji: '🌊', theme: 'aurora', createdAt: 0 }] };
function activeSpace() {
  return spaces.list.find((s) => s.id === spaces.active) || spaces.list[0];
}
function tabSpaceId(tab) {
  return tab && spaces.list.some((s) => s.id === tab.space) ? tab.space : spaces.active;
}
function spaceTabs() {
  return spacesEnabled ? tabs.filter((t) => tabSpaceId(t) === spaces.active) : tabs;
}
function spaceNameOf(tab) {
  const space = spaces.list.find((s) => s.id === tabSpaceId(tab));
  return space ? space.name : '';
}
function saveSpaces() {
  if (spaceStore && !spaceStore.save(spaces)) toast('Could not save spaces on this device.');
}
function applySpaceTheme() {
  // Theme values live in spaces.css so the strict style-src policy stays intact.
  document.documentElement.dataset.space = spacesEnabled ? activeSpace().theme : 'aurora';
}
/* Split view: two pages side by side with a draggable divider. */
function splitSupported() {
  return !narrowLayout.matches;
}
function splitActive() {
  if (!split.left || !split.right || !splitSupported() || view !== 'web') return false;
  const left = tabs.find((t) => t.id === split.left),
    right = tabs.find((t) => t.id === split.right);
  return !!(left && right && canVisit(left) && canVisit(right) && left.url && right.url && !left.private && !right.private);
}
function clearSplit() {
  if (!split.left && !split.right) return false;
  split.left = '';
  split.right = '';
  write(windowKey('split'), split);
  return true;
}
function toggleSplit() {
  if (!splitSupported()) {
    toast('Split view is available on desktop.');
    return;
  }
  if (splitActive()) {
    clearSplit();
    rectUpdate(true);
    render(true);
    return;
  }
  if (view !== 'web' || !current().url) {
    toast('Open a page before splitting the view.');
    return;
  }
  const candidates = spaceTabs().filter((t) => t.id !== activeId && t.url && canVisit(t) && !t.private);
  if (!candidates.length) {
    toast('Open another page to place in the second pane.');
    return;
  }
  split.left = activeId;
  split.right = candidates[0].id;
  split.ratio = 0.5;
  write(windowKey('split'), split);
  const right = candidates[0];
  if (!mounted.has(right.id)) {
    mounted.add(right.id);
    send({ type: 'open', id: right.id, url: right.url, private: false, desktopSite: !!right.desktopSite });
  }
  haptic('medium');
  render(true);
  rectUpdate(true);
  toast('Split view. Drag the divider to resize.');
}
function drawPanes() {
  const vp = $('#viewport');
  const on = splitActive();
  vp.classList.toggle('split', on);
  vp.dataset.ratio = String(Math.min(75, Math.max(25, Math.round((split.ratio * 100) / 5) * 5)));
  $('#pane-right').hidden = !on;
  $('#pane-divider').hidden = !on;
  const button = $('.desktop-split');
  if (button) {
    button.classList.toggle('active', on);
    button.title = on ? 'Close split view' : 'Split view';
    button.setAttribute('aria-label', on ? 'Close split view' : 'Split view');
  }
  if (!on) return;
  const left = tabs.find((t) => t.id === split.left),
    right = tabs.find((t) => t.id === split.right);
  $('#pane-left .pane-title').textContent = left?.title || hostOf(left?.url) || 'Page';
  $('#pane-right .pane-title').textContent = right?.title || hostOf(right?.url) || 'Page';
  $('#pane-left').classList.toggle('focused', activeId === split.left);
  $('#pane-right').classList.toggle('focused', activeId === split.right);
}
function cleanURL(url) {
  if (!settings.stripTracking || !url) return url;
  const cleaned = stripTrackingParams(url);
  if (cleaned.removed) {
    paramsStripped += cleaned.removed;
    toast('Removed ' + cleaned.removed + ' tracking parameter' + (cleaned.removed === 1 ? '' : 's') + '.');
  }
  return cleaned.url;
}
function groupColor(id) {
  const g = tabGroups[id];
  return g && g.color ? g.color : groupColors[Object.keys(tabGroups).length % groupColors.length];
}
function saveTabGroups() {
  write('tabGroups', tabGroups);
}
let bookmarks = read('bookmarks.' + sync.profileKey, []),
  devices = [],
  lastSync = '',
  syncError = '';
let deviceId = read('deviceId', '');
if (!deviceId) {
  deviceId = uid();
  write('deviceId', deviceId);
}
const blank = (isPrivate = false) => ({
  id: uid(),
  private: isPrivate || windowInfo.private,
  url: '',
  title: 'Start page',
  loading: false,
});
let tabs = (windowInfo.private || (!windowInfo.reopened && settings.startup !== 'restore') ? [] : read(windowKey('tabs'), []))
  .filter((t) => t && !t.private && typeof t.id === 'string' && (!t.url || webURL(t.url)))
  .map((t) => {
    const localSearch = !t.url && (t.title === 'Vaayvu Search');
    if (localSearch || VaayvuCore.providerQuery(t.url)) return { ...t, url: '', title: 'Start page', loading: false };
    return { ...t, loading: false };
  });
if (!tabs.length) {
  const first = blank();
  if (!windowInfo.private && settings.startup === 'page' && webURL(settings.startupURL) && !VaayvuCore.providerQuery(settings.startupURL)) {
    first.url = settings.startupURL;
    first.title = hostOf(first.url);
  }
  tabs = [first];
}
let activeId = read(windowKey('active'), '');
if (!tabs.some((t) => t.id === activeId)) activeId = tabs[0].id;
if (spacesEnabled) {
  for (const tab of tabs)
    if (!spaces.list.some((s) => s.id === tab.space)) tab.space = spaces.active;
  if (!tabs.some((t) => t.id === activeId && tabSpaceId(t) === spaces.active)) {
    const first = tabs.find((t) => tabSpaceId(t) === spaces.active);
    if (first) activeId = first.id;
    else {
      const extra = blank();
      extra.space = spaces.active;
      tabs.push(extra);
      activeId = extra.id;
    }
  }
}
const current = () => tabs.find((t) => t.id === activeId);
let tabVisitSequence = 1;
current().lastViewed = tabVisitSequence;
let view = tabView(current()),
  platform = 'preview',
  privateSupported = true,
  nativeReady = false;
let drawer = false,
  modal = '',
  pageText = null,
  readerRequest = null,
  visitStamp = new Map(),
  lastRect = '';
let dialogTrigger = null,
  syncTimer,
  syncInFlight = false,
  syncAgain = false,
  toastTimer,
  rendererStamp = '',
  libraryQuery = '';
const mounted = new Set();
function send(message) {
  if (window.webkit?.messageHandlers?.vaayvu) {
    window.webkit.messageHandlers.vaayvu.postMessage(message);
    return true;
  }
  if (window.VaayvuNative) {
    window.VaayvuNative.postMessage(JSON.stringify(message));
    return true;
  }
  return false;
}
const native = !!(window.webkit?.messageHandlers?.vaayvu || window.VaayvuNative);
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function sendProtection() {
  // Current hosts receive categories and legacy custom domains together in sendBlocklist.
  send({ type: 'protection', enabled: !adBlock && settings.protection, domains: adBlock ? [] : settings.blockedDomains });
}
function sendLiteYouTube() {
  if (capabilities.canLiteYouTube) send({ type: 'liteYouTube', enabled: settings.youtubeLayout === 'mobile' });
}
function sendLowMemoryBrowsing() {
  if (capabilities.canLowMemoryBrowsing) send({ type: 'lowMemoryBrowsing', enabled: settings.lowMemoryBrowsing });
}
function sendYouTubeDesktopOptimization() {
  if (capabilities.canLiteYouTube) send({ type: 'youtubeDesktopOptimization', enabled: settings.youtubeDesktopOptimization });
}
function applyTheme() {
  document.body.classList.toggle('high-contrast', settings.highContrast);
  if (globalThis.VaayvuI18n) globalThis.VaayvuI18n.apply(document, settings.language || navigator.language);
  $('.toolbar-home').hidden = !settings.showHomeButton;
  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.body.classList.toggle('reduce-motion', !!settings.reduceMotion || !!capabilities.reduceMotion);
  document.body.classList.toggle('reduce-transparency', !!capabilities.reduceTransparency);
  document.body.classList.toggle('large-type', settings.interfaceSize === 'large');
  document.body.dataset.wallpaper = settings.wallpaper;
}
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function persistTabs() {
  if (windowInfo.private) return;
  write(
    windowKey('tabs'),
    tabs
      .filter((t) => !t.private && !approvedVisits.has(t.id) && !VaayvuCore.providerQuery(t.url))
      .map(({ id, url, title, pinned, group, zoom, desktopSite, space }) => ({
        space,
        id,
        url,
        title,
        pinned,
        group,
        zoom,
        desktopSite,
      })),
  );
  if (!current()?.private) write(windowKey('active'), activeId);
}
function saveBookmarks() {
  if (windowInfo.private) return;
  bookmarks = mergeBookmarks(bookmarks, read('bookmarks.' + sync.profileKey, []));
  write('bookmarks.' + sync.profileKey, bookmarks);
  queueSync();
}
function saved() {
  return bookmarks.filter((b) => !b.deleted);
}
function passwordsDialog() {
  const list = passwords.length
    ? passwords
        .map(
          (p, i) =>
            '<div class="item"><span class="tileicon">' +
            icon('lock') +
            '</span><div class="grow"><strong>' +
            e(p.username) +
            '</strong><small>' +
            e(p.site) +
            '</small></div>' +
            '<button class="icon" data-remove-password="' +
            i +
            '" aria-label="Remove password for ' +
            e(p.username) +
            '">' +
            icon('x') +
            '</button></div>',
        )
        .join('')
    : emptyState('lock', 'No saved passwords', 'Passwords you save will appear here.');
  dialog(
    'Passwords',
    '<div class="stack"><p class="muted">Passwords are stored locally on this device. Use your system password manager for stronger security.</p>' +
      '<div class="list">' +
      list +
      '</div>' +
      '<form id="add-password"><label>Website<input name="site" type="url" placeholder="https://example.com" required></label>' +
      '<label>Username<input name="username" required></label>' +
      '<label>Password<input name="password" type="password" required></label>' +
      '<button class="primary">Save password</button></form></div>',
    'passwords',
  );
}
function savePasswordEntry(site, username, password) {
  if (!site || !username || !password) return;
  const existing = passwords.findIndex((p) => p.site === site && p.username === username);
  if (existing >= 0) passwords[existing].password = password;
  else passwords.push({ site, username, password, at: Date.now() });
  write('passwords', passwords);
  toast('Password saved.');
}
function deletePassword(index) {
  if (index < 0 || index >= passwords.length) return;
  passwords.splice(index, 1);
  write('passwords', passwords);
  passwordsDialog();
  render(true);
  toast('Password removed.');
}
function syncDeviceName() {
  return (
    settings.name ||
    { mac: 'Mac', ios: 'iPhone', android: 'Android', preview: 'Web preview' }[platform] ||
    'Device'
  );
}
function drawRail() {
  renderBrowserBars();
  drawSpaceBar();
  const head = $('#tabhead-label');
  if (head) head.textContent = spacesEnabled ? activeSpace().name : 'Open tabs';
  $('#tabs').innerHTML = sidebarTabs(spaceTabs());
  $('#rail nav')
    .querySelectorAll('[data-view]')
    .forEach((button) => {
      const selected = button.dataset.view === view;
      button.classList.toggle('on', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  $('#account').innerHTML =
    '<span class="avatar">' +
    icon('user') +
    '</span><span class="grow"><strong>' +
    e(
      windowInfo.guest
        ? 'Guest window'
        : windowInfo.private
          ? 'Private window'
          : sync.session?.username || windowInfo.profileName || 'Local profile',
    ) +
    '</strong><small>' +
    e(windowInfo.private ? 'Temporary session' : sync.session ? 'Vaayvu Sync' : 'Connect to sync') +
    '</small></span>';
  $('#account').setAttribute('aria-label', $('#account strong').textContent);
  $('#account').title = $('#account strong').textContent;
}
function drawSpaceBar() {
  const bar = $('#space-bar');
  if (!bar) return;
  const mobile = $('.space-mobile'),
    emoji = $('#mobile-space-emoji');
  if (mobile) {
    mobile.hidden = !spacesEnabled;
    if (emoji) emoji.textContent = activeSpace().emoji;
    mobile.setAttribute('aria-label', 'Spaces: ' + activeSpace().name);
    mobile.title = 'Spaces · ' + activeSpace().name;
  }
  bar.hidden = !spacesEnabled;
  if (!spacesEnabled) {
    bar.innerHTML = '';
    return;
  }
  const counts = spaceStore.count(tabs, spaces);
  const compactMenu = $('#compact-space-menu');
  compactMenu.title = 'Switch space · ' + activeSpace().name;
  compactMenu.setAttribute('aria-label', compactMenu.title);
  bar.innerHTML =
    spaces.list
      .map((space) => {
        const on = space.id === spaces.active,
          total = counts.get(space.id) || 0;
        return (
          '<button class="space-chip' +
          (on ? ' on' : '') +
          '" role="tab" aria-selected="' +
          on +
          '" data-space="' +
          e(space.id) +
          '" title="' +
          e(space.name + (total ? ' · ' + total + ' tabs' : '')) +
          '" aria-label="' +
          e(space.name + ', ' + total + ' tabs') +
          '"><span aria-hidden="true">' +
          e(space.emoji) +
          '</span></button>'
        );
      })
      .join('') +
    '<button class="space-chip add" data-act="newSpace" title="New space" aria-label="New space">+</button>' +
    '<button class="space-chip more" data-act="spaceMenu" title="Manage spaces" aria-label="Manage spaces">⋯</button>';
}
function updateLoadingBar() {
  const bar = $('#loading-bar');
  if (!bar) return;
  const t = current();
  const onWeb = view === 'web';
  if (onWeb && t && t.loading) {
    bar.classList.remove('done');
    bar.classList.add('active');
  } else {
    bar.classList.remove('active');
    bar.classList.add('done');
    setTimeout(() => bar.classList.remove('done'), 400);
  }
}
function drawBar() {
  drawPhoneBar();
  const t = current(),
    onWeb = view === 'web',
    addr = $('#address');
  addr.placeholder = searchPlaceholder();
  if (document.activeElement !== addr) addr.value = onWeb ? t.url : view === 'indiaSearch' ? searches.get(t.id)?.q || '' : '';
  $('#address-icon').innerHTML = icon(
    onWeb ? (!t.error && t.url.startsWith('https:') ? 'lock' : 'globe') : 'compass',
  );
  const shield = $('#address-shield');
  if (shield) {
    const blocked = onWeb && !t.private ? tabProtection.get(t.id) : null;
    const total = blocked ? blocked.ads + blocked.trackers + blocked.social + blocked.firstparty + blocked.token + (blocked.strict || 0) : 0;
    const sitePaused = onWeb && !!t.url && adBlockConfig.pausedSites.includes(hostOf(t.url));
    const shieldUp = adBlockConfig.enabled && !sitePaused;
    shield.innerHTML = icon(shieldUp ? 'shield' : 'shield-off');
    shield.classList.toggle('shield-up', shieldUp);
    shield.title = shieldUp
      ? (total ? 'Rasha Shield is UP · ' + total + ' blocked on this page' : 'Rasha Shield is UP (Strong protection)')
      : (sitePaused ? 'Rasha Shield is paused on this site' : 'Rasha Shield is DOWN');
    shield.hidden = !onWeb || t.private;
  }
  document.querySelectorAll('[data-act="back"]').forEach((b) => (b.disabled = onWeb ? !t.canBack : view === 'indiaSearch' ? false : !t.url));
  document.querySelectorAll('[data-act="forward"]').forEach((b) => (b.disabled = !onWeb || !t.canForward));
  const rb = $('.refresh');
  rb.innerHTML = icon(t.loading && onWeb ? 'x' : 'reload');
  rb.disabled = !onWeb;
  rb.setAttribute('aria-label', t.loading && onWeb ? 'Stop loading' : 'Reload');
  const sb = $('[data-act="bookmark"]');
  sb.disabled = !onWeb || !webURL(t.url) || t.private;
  sb.classList.toggle('saved', onWeb && saved().some((b) => b.url === t.url));
  $('[data-act="tools"]').disabled = !onWeb || !webURL(t.url) || !!t.error;
  updateLoadingBar();
}
function rectUpdate(force = false) {
  if (modal === 'adBlock' && document.body.classList.contains('desktop-browser')) {
    const bottom = Math.round($('#toolbar').getBoundingClientRect().bottom);
    $('#dialog').style.setProperty('--block-toolbar-bottom', bottom + 'px');
  }
  const el = $('#viewport');
  const visible = !el.hidden && !drawer && !$('#dialog').open;
  syncPhoneAppearance();
  if (splitActive()) {
    const left = $('#pane-left .pane-body').getBoundingClientRect(),
      right = $('#pane-right .pane-body').getBoundingClientRect();
    const msg = {
      type: 'panes',
      visible,
      panes: [
        { id: split.left, x: left.x, y: left.y, width: left.width, height: left.height },
        { id: split.right, x: right.x, y: right.y, width: right.width, height: right.height },
      ],
    };
    const key = JSON.stringify(msg);
    if (force || key !== lastRect) {
      lastRect = key;
      send(msg);
    }
    return;
  }
  const r = el.getBoundingClientRect();
  const msg = {
    type: 'viewport',
    visible,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  };
  const key = JSON.stringify(msg);
  if (force || key !== lastRect) {
    lastRect = key;
    send(msg);
  }
}
// Match the phone styles when a short touch screen rotates past the portrait breakpoint.
const phoneViewport = matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 540px) and (pointer: coarse)');
const narrowLayout = {
  get matches() { return !capabilities.chromiumDesktop && phoneViewport.matches; },
  addEventListener(type, listener) { phoneViewport.addEventListener(type, listener); },
};
let sidebarClosed = settings.sidebarMode !== 'on';
function updateSidebar() {
  const auto = settings.sidebarMode === 'auto' && !narrowLayout.matches;
  const closed = auto ? !autoRevealed : sidebarClosed;
  const expanded = narrowLayout.matches ? drawer : !closed;
  $('#sidebar-peek').hidden = !auto || expanded;
  $('#shell').classList.toggle('sidebar-closed', closed);
  $('#rail').inert = !expanded;
  for (const button of document.querySelectorAll('button[aria-controls="rail"]')) {
    button.setAttribute('aria-expanded', String(expanded));
    if (button.classList.contains('sidebar-open')) {
      button.title = expanded ? 'Close sidebar' : 'Open sidebar';
      button.setAttribute('aria-label', button.title);
    }
  }
}
function focusSidebarToggle() {
  const close = $('.rail-out');
  (close.offsetWidth && !$('#rail').inert ? close : $('.sidebar-open')).focus();
}
function toggleSidebar() {
  if (narrowLayout.matches) {
    setDrawer(!drawer);
    if (!drawer) $('.sidebar-open').focus();
    return;
  }
  if (settings.sidebarMode === 'auto') {
    autoRevealed = !autoRevealed;
    updateSidebar();
    if (autoRevealed) focusSidebarToggle();
    return;
  }
  sidebarClosed = !sidebarClosed;
  settings.sidebarMode = sidebarClosed ? 'off' : 'on';
  write('settings', settings);
  write('sidebarClosed', sidebarClosed);
  updateSidebar();
  focusSidebarToggle();
  rectUpdate();
}
function setDrawer(value) {
  drawer = value;
  $('#shell').classList.toggle('drawer', value);
  $('#scrim').hidden = !value;
  updateSidebar();
  if (value) $('#rail [data-view="home"]').focus();
  rectUpdate();
}
let menuPreviewToken = '';
const accountDialogs = new Set(['phoneLibrary','phoneFolder','phoneMoveBookmark','phoneNote','account', 'auth', 'tools', 'sendDevice', 'editBookmark']);
let dialogSession;
function closeStaleAccountDialog() {
  if (!accountDialogs.has(modal) || dialogSession === sync.session) return false;
  closeDialog();
  toast('Your Vaayvu ID changed. Reopen this action to use the current account.');
  return true;
}
function clearMenuPreview() {
  menuPreviewToken = '';
  $('#viewport .menu-backdrop-preview')?.remove();
}
function closeDialog() {
  clearMenuPreview();
  if ($('#dialog').open) $('#dialog').close();
  modal = '';
  dialogSession = undefined;
  readerRequest = null;
  pageText = null;
  rectUpdate();
}
function dialog(title, html, key) {
  hideAddressMatches();
  const el = $('#dialog');
  delete el.dataset.layout;
  delete el.dataset.modal;
  modal = key;
  dialogSession = accountDialogs.has(key) ? sync.session : undefined;
  if (!el.open) {
    dialogTrigger = document.activeElement;
    if (view === 'web' && !current().private) {
      menuPreviewToken = uid();
      send({ type: 'menuPreview', id: activeId, requestId: menuPreviewToken });
    }
  }
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = html;
  if (!el.open) el.showModal();
  rectUpdate();
}
function iconsStatic() {
  document.querySelectorAll('[data-i]').forEach((el) => (el.innerHTML = icon(el.dataset.i)));
}
function mark(f) {
  const host = hostOf(f.url);
  const logos = {
    'github.com': [
      'github',
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.3-3.9-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.2-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.7 1.6.3 2.8.2 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.5.4.8 1.1.8 2.1V22c0 .3.2.6.8.5A11.1 11.1 0 0 0 12 .9z"/></svg>',
    ],
    'youtube.com': [
      'youtube',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="5" width="22" height="15" rx="5" fill="currentColor"/><path d="m10 9 6 3.5-6 3.5z" fill="white"/></svg>',
    ],
    'wikipedia.org': ['wikipedia', 'W'],
    'figma.com': [
      'figma',
      '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#f24e1e" d="M8 1h4v7H8a3.5 3.5 0 0 1 0-7"/><path fill="#ff7262" d="M12 1h3.5a3.5 3.5 0 0 1 0 7H12z"/><path fill="#a259ff" d="M8 8h4v7H8a3.5 3.5 0 0 1 0-7"/><circle cx="15.5" cy="11.5" r="3.5" fill="#1abcfe"/><path fill="#0acf83" d="M8 15h4v3.5A3.5 3.5 0 1 1 8 15"/></svg>',
    ],
  };
  const [css, content] = logos[host] || [
    '',
    e(
      String(f.title || host)
        .slice(0, 1)
        .toUpperCase(),
    ),
  ];
  return '<span class="favmark ' + css + '">' + content + '</span>';
}
function actButton(action, label, ic = '', cls = 'subtle') {
  return (
    '<button type="button" class="' +
    cls +
    '" data-act="' +
    action +
    '">' +
    (ic ? icon(ic) : '') +
    e(label) +
    '</button>'
  );
}
function section(title, action = '') {
  return '<div class="sectiontop"><h1>' + e(title) + '</h1>' + action + '</div>';
}
function emptyState(ic, title, detail) {
  return (
    '<div class="empty"><span class="tileicon">' +
    icon(ic) +
    '</span><div><strong>' +
    e(title) +
    '</strong><p>' +
    e(detail) +
    '</p></div></div>'
  );
}
function urlRow(item, remove = '', removableHistory = false) {
  return (
    '<div class="item"><button class="grow" data-url="' +
    e(item.url) +
    '">' +
    mark(item) +
    '<span class="grow"><strong class="single">' +
    e(item.title || hostOf(item.url)) +
    '</strong><small>' +
    e(item.url) +
    '</small></span></button>' +
    (remove
      ? '<button class="icon" data-edit-bookmark="' +
        e(remove) +
        '" title="Edit bookmark" aria-label="Edit bookmark">' +
        icon('edit') +
        '</button><button class="icon" data-remove="' +
        e(remove) +
        '" aria-label="Remove bookmark">' +
        icon('x') +
        '</button>'
      : '') +
    (removableHistory
      ? '<button class="icon" data-forget-url="' +
        e(item.url) +
        '" title="Remove from history" aria-label="Remove from history">' +
        icon('x') +
        '</button>'
      : '') +
    '</div>'
  );
}
function libraryRows() {
  const isBookmarks = view === 'bookmarks';
  const items = isBookmarks ? saved().sort((a, b) => b.updatedAt - a.updatedAt) : historyItems;
  const q = libraryQuery.toLowerCase();
  const filtered = items.filter((x) => (x.title + ' ' + x.url).toLowerCase().includes(q));
  return filtered.length
    ? filtered.map((x) => urlRow(x, isBookmarks ? x.id : '', !isBookmarks)).join('')
    : emptyState(
        isBookmarks ? 'bookmark' : 'history',
        q ? 'No matches' : isBookmarks ? 'No bookmarks yet' : 'No browsing history yet',
        q
          ? 'Try another title or address.'
          : isBookmarks
            ? 'Select the star in the address bar to save a page.'
            : 'Pages you visit in regular tabs appear here.',
      );
}
function library() {
  if (view === 'devices') {
    const others = devices.filter((d) => d.id !== deviceId);
    return (
      section(
        'Other devices',
        actButton(
          sync.session ? 'syncNow' : 'account',
          sync.session ? 'Sync now' : 'Connect to sync',
          'sync',
        ),
      ) +
      inboxRows() +
      (!sync.session
        ? emptyState(
            'devices',
            'Continue on another device',
            'Connect the same Vaayvu ID on your devices to see their open tabs.',
          )
        : (syncError ? '<p class="error">' + e(syncError) + '</p>' : '') +
          (others.length
            ? others
                .map(
                  (d) =>
                    '<h2 class="listhead">' +
                    e(d.name) +
                    '</h2><div class="list">' +
                    (d.tabs.length
                      ? d.tabs.map((t) => urlRow(t)).join('')
                      : emptyState(
                          'tabs',
                          'No open pages',
                          'Regular web tabs from this device appear here.',
                        )) +
                    '</div>',
                )
                .join('')
            : emptyState(
                'devices',
                'This is your first device',
                'Sign in on another device using the same server and Vaayvu ID.',
              )))
    );
  }
  if (view === 'downloads')
    return (
      section(
        'Downloads',
        capabilities.canOpenDownloads ? actButton('openDownloads', 'Open downloads folder', 'download') : '',
      ) +
      (downloads.length
        ? '<div class="list">' +
          downloads
            .map(
              (d) =>
                '<div class="item"><span class="tileicon">' +
                icon('download') +
                '</span><div><strong>' +
                e(d.name) +
                '</strong><small>' +
                e(hostOf(d.url)) +
                '</small></div>' +
                (capabilities.canOpenDownload && d.downloadId
                  ? '<button class="subtle" data-open-download="' + e(d.downloadId) + '">Open</button>'
                  : '') +
                '</div>',
            )
            .join('') +
          '</div>'
        : emptyState('download', 'No downloads yet', 'Completed downloads from regular tabs appear here.'))
    );
  const isBookmarks = view === 'bookmarks';
  return (
    section(
      isBookmarks ? 'Bookmarks' : 'History',
      isBookmarks
        ? actButton('addBookmark', 'Add bookmark', 'plus')
        : historyItems.length
          ? actButton('clearHistory', 'Clear history')
          : '',
    ) +
    '<input class="searchlist" id="library-search" aria-label="Filter entries" placeholder="Search ' +
    view +
    '" value="' +
    e(libraryQuery) +
    '"><div class="results">' +
    libraryRows() +
    '</div>'
  );
}
function renderContent(force = false) {
  const error = view === 'web' && current().error;
  const web = view === 'web' && !error;
  $('#content').hidden = web;
  $('#viewport').hidden = !web;
  if (!web && (force || rendererStamp !== view)) {
    $('#content').innerHTML =
      '<div class="wrap page-in">' +
      (error
        ? section('Page couldn’t load') +
          emptyState('globe', hostOf(current().url), error) +
          actButton('reload', 'Try again', 'reload')
        : view === 'indiaSearch' ? indiaResultsPage()
        : view === 'restrictedSite' ? restrictedSite()
        : view === 'home'
          ? home()
          : library()) +
      '</div>';
    if (rendererStamp !== view) $('#content').scrollTop = 0;
  }
  updateDeskClock();
  rendererStamp = view;
  rectUpdate();
}
function render(force = false) {
  drawRail();
  drawBar();
  drawPanes();
  renderContent(force);
}
function activateTab() {
  const t = current();
  if (!canVisit(t) || searches.has(t.id) || (!settings.ordinaryWeb && VaayvuCore.providerQuery(t.url))) return;
  if (t.url && nativeReady && !mounted.has(t.id)) {
    mounted.add(t.id);
    send({ type: 'open', id: t.id, url: t.url, private: !!t.private, desktopSite: !!t.desktopSite,
      userApprovedVisit: approvedVisits.has(t.id) });
  }
  if (mounted.has(t.id)) {
    send({ type: 'select', id: t.id });
    applySiteAppearance(t);
    if (capabilities.canZoom) send({ type: 'zoom', id: t.id, percent: t.zoom || settings.defaultZoom });
  }
}
function selectTab(id) {
  setPhoneCompact(false);
  $('#address').blur();
  hideAddressMatches();
  const target = tabs.find((t) => t.id === id);
  if (!target) return;
  if (splitActive() && id !== activeId && id !== split.left && id !== split.right) {
    if (activeId === split.left) split.left = id;
    else split.right = id;
    write(windowKey('split'), split);
  }
  if (spacesEnabled && tabSpaceId(target) !== spaces.active) {
    spaces.active = tabSpaceId(target);
    saveSpaces();
    applySpaceTheme();
  }
  closeDialog();
  setDrawer(false);
  $('#findbar').hidden = true;
  activeId = id;
  current().lastViewed = ++tabVisitSequence;
  view = tabView(current());
  activateTab();
  persistTabs();
  render(true);
}
function addTab(isPrivate = false, url = '', options = {}) {
  isPrivate ||= windowInfo.private;
  if (isPrivate && (!privateSupported || !native)) {
    toast('Private browsing needs isolated tab storage on this device.');
    return;
  }
  if (splitActive()) clearSplit();
  const legacyQuery = VaayvuCore.providerQuery(url);
  if (legacyQuery && !settings.ordinaryWeb) {
    if (options.adopted) send({ type: 'close', id: options.id });
    addTab(isPrivate);
    searchIndia(legacyQuery);
    return;
  }
  url = cleanURL(url);
  const tab = blank(isPrivate);
  if (options.userApprovedVisit && !settings.ordinaryWeb && webURL(url)) approvedVisits.add(tab.id);
  if (options.adopted) {
    if (typeof options.id !== 'string' || !options.id || tabs.some((item) => item.id === options.id)) return;
    tab.id = options.id;
    tab.adopted = true;
    mounted.add(tab.id);
  }
  tab.url = webURL(url);
  tab.title = options.title || hostOf(tab.url) || 'Start page';
  tab.group = options.group || '';
  tab.zoom = options.zoom;
  tab.desktopSite = !!options.desktopSite;
  tab.pinned = !!options.pinned;
  if (spacesEnabled) tab.space = spaces.active;
  const anchor = options.after || (settings.newTabPosition === 'after' ? activeId : '');
  const after = tabs.findIndex((item) => item.id === anchor);
  tabs.splice(after < 0 ? tabs.length : after + 1, 0, tab);
  tabs.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  if (options.background) {
    persistTabs();
    render();
    drawManagedTabs();
    drawTabOverview();
    toast('Tab opened in the background.');
  } else {
    selectTab(tab.id);
    if (!tab.url && !tab.adopted) command('focusAddress');
  }
  queueSync();
}
function closeTabs(ids) {
  const closing = new Set(ids);
  const index = tabs.findIndex((t) => t.id === activeId);
  const removed = tabs.filter((t) => closing.has(t.id));
  if (!removed.length) return;
  const recent = removed
    .filter((t) => !t.private && !approvedVisits.has(t.id) && !VaayvuCore.providerQuery(t.url) && webURL(t.url))
    .reverse()
    .map(({ url, title, group, pinned, zoom, desktopSite }) => ({
      url,
      title,
      group,
      pinned,
      zoom,
      desktopSite,
    }));
  if (!windowInfo.private && settings.rememberHistory && recent.length)
    write(closedTabsKey, [...recent, ...read(closedTabsKey, [])].slice(0, 100));
  for (const tab of removed) {
    approvedVisits.delete(tab.id);
    forgetSearch(tab.id);
    mounted.delete(tab.id);
    visitStamp.delete(tab.id);
    send({ type: 'close', id: tab.id });
  }
  const next = nextAfterClose(tabs, index, closing, settings.afterClose);
  tabs = tabs.filter((t) => !closing.has(t.id));
  if ((split.left || split.right) && (closing.has(split.left) || closing.has(split.right))) {
    split.left = '';
    split.right = '';
    write(windowKey('split'), split);
  }
  if (!tabs.length) {
    const first = blank();
    if (spacesEnabled) first.space = spaces.active;
    tabs.push(first);
  }
  if (spacesEnabled && !spaceTabs().length) {
    const replacement = blank();
    replacement.space = spaces.active;
    tabs.push(replacement);
  }
  if (closing.has(activeId)) {
    const preferred =
      next && (!spacesEnabled || tabSpaceId(next) === spaces.active) ? next : spaceTabs()[0] || tabs[0];
    selectTab(preferred.id);
  }
  else {
    persistTabs();
    render(true);
    drawManagedTabs();
    drawTabOverview();
  }
  queueSync();
}
function closeTab(id) {
  closeTabs([id]);
}
function setActiveSpace(id) {
  if (!spacesEnabled || !spaces.list.some((s) => s.id === id)) return;
  if (id === spaces.active) {
    closeDialog();
    return;
  }
  clearSplit();
  haptic();
  spaces.active = id;
  saveSpaces();
  applySpaceTheme();
  closeDialog();
  const first = spaceTabs()[0];
  if (first) selectTab(first.id);
  else addTab();
  render(true);
}
function haptic(style = 'light') {
  if (!capabilities.canHaptic) return;
  send({ type: 'haptic', style });
}
function spaceSheet() {
  if (!spacesEnabled) {
    toast('Spaces are unavailable in private windows.');
    return;
  }
  haptic();
  const counts = spaceStore.count(tabs, spaces);
  const cards = spaces.list
    .map((space) => {
      const on = space.id === spaces.active,
        total = counts.get(space.id) || 0;
      return (
        '<button class="space-card theme-' +
        e(space.theme) +
        (on ? ' on' : '') +
        '" data-space="' +
        e(space.id) +
        '" aria-pressed="' +
        on +
        '"><span class="space-card-glow" aria-hidden="true"></span>' +
        '<span class="space-card-emoji" aria-hidden="true">' +
        e(space.emoji) +
        '</span><span class="space-card-text"><strong>' +
        e(space.name) +
        '</strong><small>' +
        (total ? total + ' tab' + (total === 1 ? '' : 's') : 'Empty') +
        (on ? ' · Active' : '') +
        '</small></span><span class="space-card-mark">' +
        (on ? icon('check') : '') +
        '</span></button>'
      );
    })
    .join('');
  dialog(
    'Spaces',
    '<div class="space-cards">' +
      cards +
      '</div><div class="dialogbuttons"><button class="primary" data-act="newSpace">New space</button>' +
      '<button data-act="spaceMenu">Manage spaces</button>' +
      '</div>',
    'spaces',
  );
  $('#dialog').dataset.layout = 'spaceSheet';
}
function spaceDialog(id = '') {
  if (!spacesEnabled) {
    toast('Spaces are unavailable in private windows.');
    return;
  }
  const editing = id ? spaces.list.find((s) => s.id === id) : null;
  const emoji = editing?.emoji || spaceStore.EMOJI[spaces.list.length % spaceStore.EMOJI.length];
  const theme = editing?.theme || spaceStore.THEME_IDS[spaces.list.length % spaceStore.THEME_IDS.length];
  dialog(
    editing ? 'Edit space' : 'New space',
    '<form id="space-form" data-space-id="' +
      e(id) +
      '" class="stack"><label>Name<input name="name" maxlength="40" required autocomplete="off" value="' +
      e(editing?.name || '') +
      '" placeholder="Work, Research, Personal…"></label>' +
      '<p class="label">Icon</p><div class="space-grid" role="group" aria-label="Space icon">' +
      spaceStore.EMOJI.map(
        (value) =>
          '<button type="button" class="space-emoji' +
          (value === emoji ? ' on' : '') +
          '" data-emoji="' +
          e(value) +
          '" aria-pressed="' +
          (value === emoji) +
          '">' +
          e(value) +
          '</button>',
      ).join('') +
      '</div><p class="label">Theme</p><div class="space-themes" role="group" aria-label="Space theme">' +
      spaceStore.THEME_IDS.map(
        (key) =>
          '<button type="button" class="space-theme' +
          (key === theme ? ' on' : '') +
          '" data-theme-pick="' +
          key +
          '" aria-pressed="' +
          (key === theme) +
          '">' +
          e(spaceStore.THEMES[key].name) +
          '</button>',
      ).join('') +
      '</div><div class="dialogbuttons">' +
      actButton('dismiss', 'Cancel') +
      '<button class="primary">' +
      (editing ? 'Save space' : 'Create space') +
      '</button></div></form>',
    'space',
  );
  const form = $('#space-form');
  const pick = (selector) =>
    form.querySelectorAll(selector).forEach((button) =>
      button.addEventListener('click', () => {
        form.querySelectorAll(selector).forEach((other) => {
          other.classList.remove('on');
          other.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('on');
        button.setAttribute('aria-pressed', 'true');
      }),
    );
  pick('.space-emoji');
  pick('[data-theme-pick]');
  form.querySelector('[name="name"]').focus();
  $('#dialog').dataset.layout = 'spaceForm';
}
function saveSpaceForm(form) {
  if (!spaceStore || !spacesEnabled) return;
  const id = form.dataset.spaceId;
  const name = String(new FormData(form).get('name') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  if (!name) {
    toast('Name the space first.');
    return;
  }
  const emoji = form.querySelector('.space-emoji.on')?.dataset.emoji || '🌊';
  const theme = form.querySelector('[data-theme-pick].on')?.dataset.themePick || 'aurora';
  if (id) {
    spaces = spaceStore.update(spaces, id, { name, emoji, theme });
  } else {
    const created = spaceStore.create(spaces, { name, emoji, theme });
    if (!created.space) {
      toast('Space limit reached.');
      return;
    }
    spaces = created.state;
  }
  saveSpaces();
  applySpaceTheme();
  closeDialog();
  render(true);
  if (!id) {
    const first = spaceTabs()[0];
    if (first) selectTab(first.id);
    else addTab();
  }
}
function spaceMenuDialog() {
  if (!spacesEnabled) {
    toast('Spaces are unavailable in private windows.');
    return;
  }
  const counts = spaceStore.count(tabs, spaces);
  dialog(
    'Spaces',
    '<div class="stack"><p class="muted">Each space keeps its own tabs, pinned pages and accent.</p>' +
      spaces.list
        .map((space) => {
          const on = space.id === spaces.active,
            total = counts.get(space.id) || 0;
          return (
            '<div class="item space-row' +
            (on ? ' current' : '') +
            '"><button class="grow" data-space="' +
            e(space.id) +
            '"><span class="space-emoji">' +
            e(space.emoji) +
            '</span><span class="grow"><strong>' +
            e(space.name) +
            '</strong><small>' +
            total +
            ' tab' +
            (total === 1 ? '' : 's') +
            (on ? ' · Active' : '') +
            '</small></span></button>' +
            '<button class="icon" data-space-edit="' +
            e(space.id) +
            '" aria-label="Edit ' +
            e(space.name) +
            '" title="Edit">' +
            icon('edit') +
            '</button><button class="icon" data-space-archive="' +
            e(space.id) +
            '" aria-label="Archive ' +
            e(space.name) +
            '" title="Archive">' +
            icon('clock') +
            '</button>' +
            (spaces.list.length > 1
              ? '<button class="icon" data-space-delete="' +
                e(space.id) +
                '" aria-label="Close ' +
                e(space.name) +
                '" title="Delete">' +
                icon('trash') +
                '</button>'
              : '') +
            '</div>'
          );
        })
        .join('') +
      '<div class="dialogbuttons"><button data-act="newSpace">New space</button>' +
      actButton('archived', 'Archived tabs', 'clock') +
      '</div></div>',
    'spaces',
  );
  $('#dialog').dataset.layout = 'spaceMenu';
}
function deleteSpace(id) {
  if (!spacesEnabled || spaces.list.length <= 1) return;
  const members = tabs.filter((t) => tabSpaceId(t) === id);
  if (members.length) closeTabs(members.map((t) => t.id));
  const next = spaceStore.remove(spaces, id);
  if (!next.removed) return;
  spaces = next.state;
  saveSpaces();
  applySpaceTheme();
  closeDialog();
  const first = spaceTabs()[0];
  if (first) selectTab(first.id);
  render(true);
  toast(next.removed.name + ' closed.');
}
function archiveSpace(id = spaces.active) {
  const space = spaces.list.find((s) => s.id === id);
  if (!space || !spacesEnabled) return;
  const members = tabs.filter((t) => tabSpaceId(t) === id);
  const pages = members
    .filter((t) => !t.private && !approvedVisits.has(t.id) && webURL(t.url) && !VaayvuCore.providerQuery(t.url))
    .map(({ url, title, group, pinned, zoom, desktopSite }) => ({
      url,
      title,
      group,
      pinned,
      zoom,
      desktopSite,
    }));
  if (pages.length) {
    const archived = read('archived', []);
    write(
      'archived',
      [
        {
          id: uid(),
          space: space.name,
          emoji: space.emoji,
          theme: space.theme,
          at: Date.now(),
          tabs: pages,
        },
        ...archived,
      ].slice(0, 20),
    );
  }
  if (members.length) closeTabs(members.map((t) => t.id));
  if (spaces.list.length > 1) {
    spaces = spaceStore.remove(spaces, id).state;
    saveSpaces();
    applySpaceTheme();
    render(true);
  }
  closeDialog();
  toast(
    pages.length
      ? 'Archived ' + pages.length + ' tab' + (pages.length === 1 ? '' : 's') + '.'
      : 'No pages to archive.',
  );
}
function archivedDialog() {
  const list = read('archived', []);
  dialog(
    'Archived tabs',
    list.length
      ? '<div class="stack">' +
          list
            .map(
              (item, index) =>
                '<div class="item"><button class="grow" data-archive-restore="' +
                index +
                '"><span class="space-emoji">' +
                e(item.emoji || '🗂') +
                '</span><span class="grow"><strong>' +
                e(item.space) +
                '</strong><small>' +
                item.tabs.length +
                ' page' +
                (item.tabs.length === 1 ? '' : 's') +
                ' · ' +
                e(new Date(item.at).toLocaleDateString()) +
                '</small></span></button></div>',
            )
            .join('') +
          '</div>'
      : emptyState('clock', 'Nothing archived', 'Archive a space to keep its pages without keeping them open.'),
    'archived',
  );
}
function restoreArchived(index) {
  const list = read('archived', []);
  const item = list[index];
  if (!item || !spacesEnabled) return;
  let space = spaces.list.find((s) => s.name === item.space);
  if (!space) {
    const created = spaceStore.create(spaces, {
      name: item.space,
      emoji: item.emoji,
      theme: item.theme,
    });
    if (!created.space) {
      toast('Space limit reached.');
      return;
    }
    spaces = created.state;
    space = created.space;
  }
  spaces.active = space.id;
  saveSpaces();
  applySpaceTheme();
  closeDialog();
  const [first, ...rest] = item.tabs;
  if (!first) {
    toast('This archive is empty.');
    return;
  }
  addTab(false, first.url, {
    title: first.title,
    group: first.group,
    pinned: first.pinned,
    zoom: first.zoom,
    desktopSite: first.desktopSite,
  });
  for (const page of rest)
    addTab(false, page.url, {
      title: page.title,
      group: page.group,
      pinned: page.pinned,
      zoom: page.zoom,
      desktopSite: page.desktopSite,
      background: true,
    });
  write(
    'archived',
    list.filter((_, i) => i !== index),
  );
  toast('Restored ' + item.tabs.length + ' tab' + (item.tabs.length === 1 ? '' : 's') + '.');
}
function navigate(input) {
  setPhoneCompact(false);
  const value = typeof input === 'string' ? input.trim() : '';
  let url = destination(value);
  const query = VaayvuCore.providerQuery(url);
  if (query || (value && !url && !/^[a-z][\w+.-]*:/i.test(value))) {
    if (!settings.ordinaryWeb) {
      searchIndia(query || value);
      return;
    }
    if (!url) {
      const base = { duckduckgo: 'https://duckduckgo.com/', google: 'https://www.google.com/search', bing: 'https://www.bing.com/search' };
      const result = new URL(base[settings.searchProvider]);
      result.searchParams.set('q', value);
      url = webURL(result.href);
    }
  }
  if (!url) {
    toast('Enter a search or an HTTP or HTTPS address.');
    return;
  }
  hideAddressMatches();
  closeDialog();
  setDrawer(false);
  $('#findbar').hidden = true;
  document.activeElement?.blur();
  if (!canVisit(current())) {
    offerVisit(url);
    return;
  }
  if (!native) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const target = cleanURL(url);
  const t = current();
  forgetSearch(t.id);
  t.url = target;
  t.error = '';
  t.title = hostOf(target);
  t.loading = true;
  view = 'web';
  pageText = null;
  if (mounted.has(t.id)) send({ type: 'navigate', id: t.id, url: target });
  else activateTab();
  persistTabs();
  render(true);
  queueSync();
}
function showView(v) {
  closeDialog();
  setDrawer(false);
  $('#findbar').hidden = true;
  libraryQuery = '';
  view = v;
  render(true);
  if (v === 'devices') queueSync(0);
}
function queueSync(delay = 800) {
  clearTimeout(syncTimer);
  if (settings.ordinaryWeb && sync.session && !windowInfo.private) syncTimer = setTimeout(runSync, delay);
}
async function runSync() {
  if (!settings.ordinaryWeb || !sync.session || windowInfo.private || !windowIds.length) return;
  if (windowIds.length && windowIds[0] !== windowInfo.id) {
    write('syncRequest', uid());
    return;
  }
  if (syncInFlight) {
    syncAgain = true;
    return;
  }
  syncInFlight = true;
  const profile = sync.profileKey;
  try {
    const data = await sync.exchange(bookmarks.filter(b => !VaayvuCore.providerQuery(b.url)), {
      id: deviceId,
      name: syncDeviceName(),
      tabs: publicTabs(
        windowIds.flatMap((id) =>
          id === windowInfo.id ? tabs.filter(tab => !approvedVisits.has(tab.id)) : read(id === 'main' ? 'tabs' : 'tabs.' + id, []),
        ),
      ),
    });
    if (sync.profileKey !== profile) return;
    bookmarks = mergeBookmarks(data.bookmarks, bookmarks);
    write('bookmarks.' + profile, bookmarks);
    devices = data.devices
      .filter((d) => d && typeof d.id === 'string' && typeof d.name === 'string' && Array.isArray(d.tabs))
      .map((d) => ({ ...d, tabs: publicTabs(d.tabs.filter((t) => t && typeof t === 'object')) }));
    write('devices.' + profile, devices);
    incoming = Array.isArray(data.incoming)
      ? data.incoming.filter((item) => item && typeof item.id === 'string' && webURL(item.url))
      : [];
    write('incoming.' + profile, incoming);
    lastSync = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    syncError = '';
    if (view === 'devices' || (view === 'bookmarks' && !libraryQuery)) render(true);
    else if (view === 'home' && document.activeElement !== $('#hero-input')) render(true);
    else drawBar();
    if (modal === 'account') accountDialog();
  } catch (err) {
    if (sync.profileKey === profile) {
      syncError = err.message;
      if (view === 'devices') render(true);
      if (modal === 'account') accountDialog();
    }
  } finally {
    syncInFlight = false;
    if (syncAgain) {
      syncAgain = false;
      queueSync(0);
    }
  }
}
function toggleBookmark() {
  const t = current();
  if (!t.url || t.private || view !== 'web') return;
  const match = saved().find((b) => b.url === t.url);
  if (match) {
    deleteBookmark(match.id);
    return;
  }
  bookmarks.push({
    id: uid(),
    url: t.url,
    title: (t.title || hostOf(t.url)).slice(0, 512),
    updatedAt: Date.now(),
    deleted: false,
  });
  saveBookmarks();
  render(true);
  toast('Bookmark saved.');
}
function editBookmark(id = '') {
  if (windowInfo.private) return;
  const item = saved().find((b) => b.id === id);
  if (id && !item) return;
  dialog(
    item ? 'Edit bookmark' : 'Add bookmark',
    '<form id="edit-bookmark" data-id="' +
      e(id) +
      '"><label>Name<input name="title" maxlength="512" value="' +
      e(item?.title || '') +
      '"></label><label>Website address<input name="url" type="url" required maxlength="8192" value="' +
      e(item?.url || '') +
      '" placeholder="https://example.com"></label><button class="primary">Save bookmark</button></form>',
    'editBookmark',
  );
}
function deleteBookmark(id) {
  bookmarks = bookmarks.map((b) =>
    b.id === id
      ? { id: b.id, title: '', url: '', deleted: true, updatedAt: Math.max(Date.now(), b.updatedAt + 1) }
      : b,
  );
  saveBookmarks();
  render(true);
  toast('Bookmark removed.');
}
function favoritesDialog() {
  dialog(
    'Edit favorites',
    '<div class="stack"><div class="list">' +
      favorites
        .map(
          (f, i) =>
            '<div class="item">' +
            mark(f) +
            '<span class="grow single">' +
            e(f.title) +
            '</span><button class="icon" data-removefav="' +
            i +
            '" aria-label="Remove ' +
            e(f.title) +
            '">' +
            icon('x') +
            '</button></div>',
        )
        .join('') +
      '</div><form id="fav-add"><label>Name<input name="title" maxlength="70" required></label><label>Website<input name="url" placeholder="example.com" autocapitalize="none" required></label><button class="primary">Add favorite</button></form></div>',
    'favorites',
  );
}
function accountDialog(register = false) {
  if (!settings.ordinaryWeb) {
    dialog('Sync paused', '<p>India-only browsing keeps your tabs and bookmarks on this device. ' +
      'Your sync server can be used in ordinary browsing.</p>' + actButton('pref-search', 'Search settings', 'settings') +
      (sync.session ? actButton('logout', 'Sign out on this device') : ''), 'account');
    return;
  }
  if (windowInfo.private) {
    toast('Sync is available in a regular window.');
    return;
  }
  if (sync.session) {
    dialog(
      'Vaayvu Sync',
      '<div class="stack"><p>Signed in as <strong>' +
        e(sync.session.username) +
        '</strong></p><p class="muted">' +
        e(sync.session.origin) +
        '<br>' +
        e(syncDeviceName()) +
        (lastSync ? ' · Last synced ' + e(lastSync) : '') +
        '</p>' +
        (syncError ? '<p class="error" role="status">' + e(syncError) + '</p>' : '') +
        '<div class="dialogbuttons">' +
        actButton('syncNow', 'Sync now', 'sync', 'primary') +
        actButton('devices', 'Other devices', 'devices') +
        actButton('logout', 'Sign out') +
        '</div></div>',
      'account',
    );
    return;
  }
  const server = read('server', '');
  dialog(
    register ? 'Create your Vaayvu ID' : 'Connect to Vaayvu Sync',
    '<form id="auth" data-register="' +
      register +
      '"><p class="muted">Use the same Vaayvu sync server and ID on each device. Your server stores bookmark titles, URLs, and regular open tabs.</p><label>Sync server<input required type="url" name="server" placeholder="https://sync.example.com" value="' +
      e(server) +
      '" autocapitalize="none" spellcheck="false"></label><label>Vaayvu ID<input required name="user" minlength="3" maxlength="48" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label>Password<input required name="pass" minlength="' +
      (register ? '12' : '1') +
      '" maxlength="256" type="password" autocomplete="' +
      (register ? 'new-password' : 'current-password') +
      '" placeholder="' +
      (register ? 'At least 12 characters' : 'Your password') +
      '"></label><label class="optin"><input type="checkbox" name="include"> Include this device’s local bookmarks</label><p class="dialognote">Signing in syncs your regular open tabs. Private tabs and history stay off the sync server.</p><p id="auth-error" class="error" role="status"></p><button class="primary">' +
      (register ? 'Create ID and sync' : 'Sign in and sync') +
      '</button>' +
      actButton(
        register ? 'signin' : 'register',
        register ? 'Use an existing ID' : 'Create a Vaayvu ID',
        '',
        'linkbtn',
      ) +
      '</form>',
    'auth',
  );
}
function clearLocalHistory() {
  if (windowInfo.private) return false;
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key === 'vaayvu.recentlyClosed' ||
        key.startsWith('vaayvu.recentlyClosed.')
      )
        localStorage.removeItem(key);
    }
    vaayvuStoreRemove('history');
    localStorage.setItem('vaayvu.history', '[]');
    historyItems = [];
    return true;
  } catch {
    toast('Could not finish clearing history on this device.');
    return false;
  }
}
function clearHistoryDialog() {
  dialog(
    'Clear browsing history?',
    '<div class="stack"><p class="muted">Remove visited pages and recently closed tab records from this profile.</p><div class="dialogbuttons">' +
      actButton('clearConfirm', 'Clear history', '', 'primary') +
      actButton('dismiss', 'Cancel') +
      '</div></div>',
    'clearHistory',
  );
}
function menuDialog() {
  openCommandMenu('main');
}
function toolsDialog() {
  const t = current();
  if (!t?.url || view !== 'web') return;
  dialog('Page tools', '<p class="muted" role="status">Reading this page…</p>', 'tools');
  pageText = null;
  readerRequest = { id: t.id, url: t.url };
  send({ type: 'extract', id: t.id });
}

function readerMode() {
  const t = current();
  if (!t?.url || view !== 'web') return;
  dialog('Reader', '<p class="muted" role="status">Extracting article…</p>', 'reader');
  pageText = null;
  readerRequest = { id: t.id, url: t.url, reader: true };
  send({ type: 'extract', id: t.id });
}
function receivedText(msg) {
  if (receiveSpeechText(msg)) return;
  const isReader = modal === 'reader' && readerRequest?.reader;
  if (
    (modal !== 'tools' && !isReader) ||
    closeStaleAccountDialog() ||
    readerRequest?.id !== msg.id ||
    readerRequest.url !== webURL(msg.url) ||
    current().url !== webURL(msg.url)
  )
    return;
  const text = String(msg.text || '')
    .trim()
    .slice(0, 18000);
  if (!text) {
    dialog(
      'Page tools',
      emptyState('book', 'No readable text', 'Try another page or wait for it to finish loading.'),
      'tools',
    );
    return;
  }
  pageText = { ...readerRequest, text };
  const words = text.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(words / 220));
  if (isReader) {
    dialog(
      'Reader',
      '<div class="reader-view"><h2>' + e(msg.title || current().title) + '</h2>' +
      '<div class="reader-meta">' + words.toLocaleString() + ' words · ' + readTime + ' min read</div>' +
      '<div class="reader-body">' + e(text).replace(/\n/g, '<br>') + '</div></div>',
      'reader',
    );
    return;
  }
  const ai = current().private || !settings.ordinaryWeb
    ? ''
    : '<form id="ask"><label>Ask about this page<textarea name="question" maxlength="2000" rows="2" required placeholder="What are the main points?"></textarea></label><p class="dialognote">' +
      (sync.session
        ? 'Sending shares the question and this page excerpt with ' +
          e(sync.session.origin) +
          ' and its configured model.'
        : 'Connect to a Vaayvu sync server with Ollama enabled for page Q&A.') +
      '</p>' +
      (sync.session
        ? '<button class="primary">Send page and question</button>'
        : actButton('account', 'Connect to sync', 'sync')) +
      '<p id="answer" class="reader" role="status"></p></form>';
  dialog(
    'Page tools',
    '<div class="stack"><p><strong>' +
      e(msg.title || current().title) +
      '</strong><br><span class="dialognote">' +
      words.toLocaleString() +
      ' words in excerpt · ' +
      readTime +
      ' min read</span></p><details><summary>Read page text</summary><div class="reader">' +
      e(text) +
      '</div></details>' +
      ai +
      '</div>',
    'tools',
  );
}
// Ad Block engine removed. This stays as the integration point for VAAYVU's
// future native engine: when it lands, the compiled policy goes out here
// again and the right-side menu toggle below drives it.
// Per-tab and session protection counters. Real blocked-request events from
// the native host; private tabs are never counted.
const tabProtection = new Map();
function protectionTotals() {
  const total = { ads: 0, trackers: 0, social: 0, firstparty: 0, token: 0, strict: 0, events: 0 };
  for (const stats of tabProtection.values()) {
    for (const key of Object.keys(total)) total[key] += stats[key] || 0;
  }
  return total;
}
// Estimated savings (methodology documented in docs/VFD-FORMAT.md):
// blocked bytes are estimated from per-category average transfer sizes
// because blocked requests are never downloaded; time assumes a conservative
// effective goodput plus a fixed per-request overhead. Always labelled.
const VFD_AVG_BYTES = { ads: 42000, trackers: 9000, social: 26000, firstparty: 18000, token: 24000, strict: 12000 };
const VFD_ASSUMED_GOODPUT = 4000000;
const VFD_PER_REQUEST_SECONDS = 0.09;
function estimateSavings(totals) {
  let bytes = 0, events = 0;
  for (const [kind, average] of Object.entries(VFD_AVG_BYTES)) {
    const n = totals[kind] || 0;
    bytes += n * average;
    events += n;
  }
  return { bytes, seconds: bytes / VFD_ASSUMED_GOODPUT + events * VFD_PER_REQUEST_SECONDS, events };
}
function formatBytes(n) {
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n, u = -1;
  do { v /= 1024; u++; } while (v >= 1024 && u < units.length - 1);
  return (Math.round(v * 10) / 10) + ' ' + units[u];
}
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  const h = Math.floor(m / 60);
  if (h < 48) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

function sendBlocklist(reloadActive = false) {
  if (!adBlock || !vfdDb || !native) return;
  const custom = new Set(
    [...adBlockConfig.custom, ...(settings.protection ? settings.blockedDomains : [])]
      .map((h) => adBlock.normalizeHost(h)).filter(Boolean));
  const policy = adBlock.policy(vfdDb, { enabled: adBlockConfig.enabled, lists: adBlockConfig.lists, pausedSites: adBlockConfig.pausedSites }, custom);
  send({ type: 'blocklist', enabled: adBlockConfig.enabled, reloadActive: reloadActive === true, ...policy });
}

function saveAdDomains(domains) {
  const next = { ...adBlockConfig, custom: domains };
  if (!write('adBlock', next)) throw Error('Could not save these domains on this device.');
  adBlockConfig = next;
  if (settings.blockedDomains.length) {
    settings.blockedDomains = [];
    write('settings', settings);
    sendProtection();
  }
}

function savedDomainCount(count) {
  return count + (count === 1 ? ' saved domain' : ' saved domains');
}

function siteProtectionStats() {
  const t = current();
  const zero = { ads: 0, trackers: 0, social: 0, firstparty: 0, token: 0, strict: 0 };
  const site = (t && !t.private && tabProtection.get(t.id)) || { ...zero };
  const session = { ...zero };
  for (const stats of tabProtection.values()) {
    for (const key of Object.keys(session)) session[key] += stats[key] || 0;
  }
  return { site, session };
}

function siteExceptions() {
  return [...new Set(adBlockConfig.pausedSites)].sort();
}

function readReports() {
  const list = read('adReports', []);
  return Array.isArray(list) ? list : [];
}

function unpauseSite(host) {
  if (!host) return;
  adBlockConfig.pausedSites = adBlockConfig.pausedSites.filter((h) => h !== host);
  write('adBlock', adBlockConfig);
  sendBlocklist(true);
  drawBar();
  if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
}

function saveReport(type) {
  const t = current();
  const url = t && t.url && webURL(t.url) ? t.url : '';
  const reports = readReports();
  reports.unshift({ type, url, time: Date.now() });
  while (reports.length > 50) reports.pop();
  write('adReports', reports);
  toast(type === 'missed' ? 'Saved. Thanks — missed ads help improve VAAYVU’s own filters.' : 'Saved. Thanks — the site will be checked for compatibility.');
}

function rewardsPlan() {
  const plan = read('rewardsPlan', 'adfree');
  return plan === 'fewer' || plan === 'more' ? plan : 'adfree';
}

function setRewardsPlan(plan) {
  const value = plan === 'fewer' || plan === 'more' ? plan : 'adfree';
  write('rewardsPlan', value);
  if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
  drawBar();
}

function adBlockSettingsDialog() {
  const t = current();
  const host = t && t.url && webURL(t.url) ? hostOf(t.url) : '';
  const paused = !!host && adBlockConfig.pausedSites.includes(host);
  const { site } = siteProtectionStats();
  const siteTotal = site.ads + site.trackers + site.social + site.firstparty + site.token + site.strict;
  const sessionTotals = protectionTotals();
  const sessionTotal = sessionTotals.ads + sessionTotals.trackers + sessionTotals.social +
    sessionTotals.firstparty + sessionTotals.token + sessionTotals.strict;
  const saved = estimateSavings(sessionTotals);
  const cat = (key, label, detail) =>
    '<label class="block-option"><span><strong>' + e(label) + '</strong><small>' + e(detail) + '</small></span>' +
    '<input type="checkbox" role="switch" data-ad-list="' + key + '"' + (adBlockConfig.lists[key] ? ' checked' : '') + '></label>';
  const exceptions = siteExceptions();
  const reports = readReports();
  const shieldUp = adBlockConfig.enabled && !paused;
  const protectionState = shieldUp ? 'Shields are UP' : (paused ? 'Shields are DOWN (This Site)' : 'Shields are DOWN');
  const protectionDetail = shieldUp
    ? (adBlockConfig.lists.aggressive
        ? 'Aggressive (Strong) protection is active. Trackers, ads & popups are blocked.'
        : 'Standard protection is active for this site.')
    : (paused
        ? 'Shields are down for this site only. Other websites remain protected.'
        : 'Shields are down everywhere. Websites load normally without filtering.');
  dialog('Rasha Shield', '<div class="block-body block-simple">' +
    '<section class="block-hero' + (shieldUp ? '' : ' is-off') + '" aria-label="Protection status"><div class="block-hero-copy"><span class="block-kicker">' + e(protectionState) +
    '</span><strong>' + (host ? e(host) : 'All websites') + '</strong><small>' + e(protectionDetail) +
    '</small></div><button type="button" class="block-power' + (shieldUp ? '' : ' is-off') + '" data-act="adBlock" aria-pressed="' + (shieldUp ? 'true' : 'false') + '" title="Toggle Rasha Shield">' +
    '<span class="block-power-track"><span class="block-power-thumb"></span></span><span class="block-power-label">' + (shieldUp ? 'UP' : 'DOWN') + '</span></button></section>' +
    '<section class="block-metrics" aria-label="Protection statistics"><div class="block-metric-primary"><strong id="pb-site">' + siteTotal + '</strong><span>Trackers &amp; ads blocked</span></div>' +
    '<div><strong id="pb-session">' + sessionTotal + '</strong><span>Session blocked</span></div>' +
    '<div><strong id="pb-saved">' + formatBytes(saved.bytes) + '</strong><span>Est. data saved</span></div></section>' +
    (host ? '<div class="block-site-action"><div><strong>Site shield for ' + e(host) + '</strong><small>' +
      (paused ? 'Protection is paused on this website.' : 'If this site seems broken, try turning Shields down.') +
      '</small></div><button type="button" data-act="adBlockPauseSite">' +
      (paused ? 'Turn Shields UP' : 'Pause on this site') + '</button></div>' : '') +
    '<section class="block-mode"><div><strong>Aggressive (Strong) blocking</strong><small>Blocks first-party &amp; third-party ads, YouTube ads, trackers and popups.</small></div>' +
    '<label><input type="checkbox" role="switch" data-ad-list="aggressive"' + (adBlockConfig.lists.aggressive ? ' checked' : '') + '><span>Strong</span></label></section>' +
    '<details class="block-advanced"><summary>Advanced protection controls</summary>' +
    cat('ads', 'Block advertisements', 'Known ad servers and verified advertising markers.') +
    cat('trackers', 'Block trackers', 'Known analytics and cross-site tracker requests.') +
    cat('social', 'Block social widgets', 'Embedded social widgets and cross-site social tracking.') +
    cat('cosmetic', 'Hide leftover ad slots', 'Collapses verified empty advertising placeholders.') +
    '<p class="block-note">Estimated savings use blocked-request counts and documented average resource sizes. They are not measured downloads.</p>' +
    '<p class="block-note">VFD ' + e(vfdDb ? vfdDb.version : '—') + ' is bundled. Automatic rule updates are not active yet.</p>' +
    '<form id="adblock-custom"><label for="block-domains"><strong>Always block these domains</strong></label>' +
    '<small>One domain per line. Subdomains are included.</small><textarea id="block-domains" name="domains" rows="4" spellcheck="false" placeholder="ads.example.com&#10;tracker.example.org">' +
    e(adBlockConfig.custom.join('\n')) + '</textarea><div class="block-actions"><button class="primary">Save domains</button>' +
    '<button type="reset">Undo</button></div></form>' +
    (exceptions.length ? '<h3>Paused sites</h3><ul class="block-exceptions">' + exceptions.map((h) =>
      '<li><span>' + e(h) + '</span> <button type="button" data-act="adBlockUnpause" data-url="' + e(h) + '">Resume</button></li>').join('') + '</ul>' : '') +
    '<div class="block-actions"><button type="button" data-act="adBlockReportMissed">Report missed ad</button>' +
    '<button type="button" data-act="adBlockReportBroken">Report broken site</button></div>' +
    (reports.length ? '<p class="block-note">' + reports.length + ' local report(s) queued for review.</p>' : '') +
    '</details>' +
    '<section class="block-rewards"><strong>VAAYVU rewards</strong><small>Not available yet. VAAYVU ads, paid views, balances and redemption remain off until advertiser agreements and a verified server ledger exist.</small></section>' +
    '<p class="block-actions"><button type="button" data-act="adBlockDefaults">Restore recommended protection</button></p>' +
    '</div>', 'adBlock');
  $('#dialog').dataset.modal = 'adBlock';
  if (narrowLayout.matches) $('#dialog').dataset.layout = 'phoneSheet';
  rectUpdate();
}
function updateProtectionDialog() {
  if (modal !== 'adBlock' || !$('#dialog').open) return;
  const { site, session } = siteProtectionStats();
  const siteTotal = site.ads + site.trackers + site.social + site.firstparty + site.token + site.strict;
  const sessionTotals = protectionTotals();
  const sessionTotal = sessionTotals.ads + sessionTotals.trackers + sessionTotals.social +
    sessionTotals.firstparty + sessionTotals.token + sessionTotals.strict;
  const saved = estimateSavings(sessionTotals);
  const siteEl = document.getElementById('pb-site');
  if (siteEl) siteEl.textContent = String(siteTotal);
  const sessionEl = document.getElementById('pb-session');
  if (sessionEl) sessionEl.textContent = String(sessionTotal);
  const savedEl = document.getElementById('pb-saved');
  if (savedEl) savedEl.textContent = formatBytes(saved.bytes);
}

function groupDialog(id) {
  const g = tabGroups[id];
  const name = g && g.name ? g.name : id;
  const color = g && g.color ? g.color : groupColors[0];
  const memberCount = tabs.filter((t) => t.group === id).length;
  const inGroup = tabs.some((t) => t.group === id);
  let swatches = '';
  for (const c of groupColors) {
    swatches +=
      '<button type="button" class="color-swatch ' +
      groupTone(c) +
      '" data-group-color="' +
      e(c) +
      '"></button>';
  }
  dialog(
    'Tab group',
    '<div class="stack"><label>Group name<input id="group-name" maxlength="48" value="' + e(name) + '"></label>' +
    '<div class="stack"><strong>Color</strong><div class="color-row">' + swatches + '</div></div>' +
    '<p class="dialognote">' + memberCount + ' tab' + (memberCount === 1 ? '' : 's') + ' in this group.</p>' +
    '<div class="dialogbuttons">' +
    (inGroup ? '<button type="button" data-act="ungroupGroup" data-group-id="' + e(id) + '">Ungroup all</button>' : '') +
    '<button type="button" data-act="deleteGroup" data-group-id="' + e(id) + '" class="danger">Delete group</button>' +
    actButton('saveGroup', 'Save group', 'layers', 'primary') +
    '</div></div>',
    'group',
  );
  $('#dialog').dataset.groupId = id;
  $('#group-name').focus();
  for (const sw of document.querySelectorAll('.color-swatch')) {
    if (sw.dataset.groupColor === color) sw.classList.add('selected');
    else sw.classList.remove('selected');
  }
}

function saveGroup() {
  const el = $('#dialog');
  const id = el.dataset.groupId;
  const nameInput = $('#group-name');
  const name = String(nameInput.value || '').trim().slice(0, 48) || id;
  const selectedSwatch = document.querySelector('.color-swatch.selected');
  const color = selectedSwatch ? selectedSwatch.dataset.groupColor : (tabGroups[id] && tabGroups[id].color) || groupColors[0];
  tabGroups[id] = { ...tabGroups[id], name, color };
  saveTabGroups();
  drawRail();
  if (modal === 'group') closeDialog();
}

function deleteGroup(id) {
  if (!id && $('#dialog').dataset.groupId) id = $('#dialog').dataset.groupId;
  if (!id) return;
  for (const t of tabs) if (t.group === id) t.group = '';
  delete tabGroups[id];
  foldedGroups.delete(id);
  persistTabs();
  saveTabGroups();
  drawRail();
  if (modal === 'group') closeDialog();
}

function ungroupGroup(id) {
  if (!id && $('#dialog').dataset.groupId) id = $('#dialog').dataset.groupId;
  if (!id) return;
  for (const t of tabs) if (t.group === id) t.group = '';
  delete tabGroups[id];
  foldedGroups.delete(id);
  persistTabs();
  saveTabGroups();
  drawRail();
  closeDialog();
}

function command(act) {
  if (/^selectTab[1-9]$/.test(act)) {
    const digit = Number(act.slice(-1));
    const tab = tabs[digit === 9 ? tabs.length - 1 : digit - 1];
    if (tab) selectTab(tab.id);
    return;
  }
  if (mobileCommand(act) || advancedCommand(act)) return;
  const t = current();
  switch (act) {
    case 'commandBar':
      showCommandBar();
      break;
    case 'newSpace':
      spaceDialog();
      break;
    case 'spaceMenu':
      spaceMenuDialog();
      break;
    case 'spaceSheet':
      spaceSheet();
      break;
    case 'archived':
      archivedDialog();
      break;
    case 'manageTabs':
      showTabManager();
      break;
    case 'openHome':
      if (settings.homeURL) navigate(settings.homeURL);
      else showView('home');
      break;
    case 'newTab':
      addTab();
      break;
    case 'privateTab':
      closeDialog();
      addTab(true);
      break;
    case 'closeTab':
      closeTab(activeId);
      break;
    case 'previousTab':
    case 'nextTab': {
      const i = tabs.indexOf(t);
      selectTab(tabs[(i + (act === 'nextTab' ? 1 : -1) + tabs.length) % tabs.length].id);
      break;
    }
    case 'home':
    case 'history':
    case 'bookmarks':
    case 'devices':
    case 'downloads':
      showView(act);
      break;
    case 'focusAddress':
      closeDialog();
      setDrawer(false);
      $('#address').focus();
      $('#address').select();
      break;
    case 'drawer':
      toggleSidebar();
      break;
    case 'retryIndia':
      if (view === 'indiaSearch') searchIndia(searches.get(activeId).q);
      break;
    case 'back':
      if (view === 'indiaSearch') window.vaayvuBack();
      else if (view !== 'web' && t.url) selectTab(t.id);
      else if (t.canBack) send({ type: 'back', id: t.id });
      break;
    case 'forward':
      if (view === 'web' && t.canForward) send({ type: 'forward', id: t.id });
      break;
    case 'reload':
      if (view === 'web' && t.error) navigate(t.url);
      else if (view === 'web') send({ type: t.loading ? 'stop' : 'reload', id: t.id });
      break;
    case 'bookmark':
      toggleBookmark();
      break;
    case 'share':
      closeDialog();
      if (view === 'web') send({ type: 'share', id: t.id });
      break;
    case 'settings':
      advancedSettings();
      break;
    case 'addBookmark':
      editBookmark();
      break;
    case 'openDownloads':
      if (capabilities.canOpenDownloads) send({ type: 'openDownloads' });
      break;
    case 'favorites':
      favoritesDialog();
      break;
    case 'account':
    case 'signin':
      accountDialog();
      break;
    case 'register':
      accountDialog(true);
      break;
    case 'syncNow':
      if (sync.session) {
        runSync();
        toast('Sync requested.');
      }
      break;
    case 'logout':
      signOut();
      break;
    case 'tools':
      toolsDialog();
      break;
    case 'reader':
      readerMode();
      break;
    case 'about':
      dialog(
        'About Vaayvu',
        '<div class="stack"><p class="about-brand"><img src="assets/vaayvu.svg" width="30" height="30" alt=""><strong>Vaayvu Browser</strong></p>' +
        '<p class="muted">Version ' + BROWSER_VERSION + '</p>' +
        '<p class="muted">A personal browser for macOS, Windows, iPhone, and Android.</p>' +
        '<p class="muted">Vaayvu uses Chromium on desktop, Android System WebView on Android, and WebKit on iPhone.</p>' +
        '<p class="muted">Built with privacy in mind. Your data stays on your devices.</p>' +
        '<div class="dialogbuttons">' +
        actButton('projectHelp', 'View on GitHub', 'globe') +
        '</div></div>',
        'about',
      );
      break;
    case 'passwords':
      passwordsDialog();
      break;
    case 'adBlock': {
      const t = current();
      const host = t && t.url && webURL(t.url) ? hostOf(t.url) : '';
      if (adBlockConfig.enabled && host && adBlockConfig.pausedSites.includes(host)) {
        adBlockConfig.pausedSites = adBlockConfig.pausedSites.filter((h) => h !== host);
      } else {
        adBlockConfig.enabled = !adBlockConfig.enabled;
        if (adBlockConfig.enabled && host && adBlockConfig.pausedSites.includes(host)) {
          adBlockConfig.pausedSites = adBlockConfig.pausedSites.filter((h) => h !== host);
        }
      }
      write('adBlock', adBlockConfig);
      sendBlocklist(true);
      drawBar();
      toast(adBlockConfig.enabled ? 'Rasha Shield is UP' : 'Rasha Shield is DOWN');
      if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
      break;
    }
    case 'adBlockDefaults':
      adBlockConfig.enabled = true;
      adBlockConfig.lists = { ...VFD_DEFAULTS.lists };
      write('adBlock', adBlockConfig);
      sendBlocklist(true);
      drawBar();
      adBlockSettingsDialog();
      break;
    case 'adBlockPauseSite': {
      const t = current();
      const host = t && t.url && webURL(t.url) ? hostOf(t.url) : '';
      if (!host) { toast('Open a website first'); break; }
      const paused = new Set(adBlockConfig.pausedSites);
      if (paused.has(host)) paused.delete(host);
      else paused.add(host);
      adBlockConfig.pausedSites = [...paused];
      write('adBlock', adBlockConfig);
      sendBlocklist(true);
      drawBar();
      if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
      break;
    }
    case 'adBlockReportMissed':
      saveReport('missed');
      if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
      break;
    case 'adBlockReportBroken':
      saveReport('broken');
      if (modal === 'adBlock' && $('#dialog').open) adBlockSettingsDialog();
      break;
    case 'adBlockSettings':
      adBlockSettingsDialog();
      break;
    case 'saveGroup':
      saveGroup();
      break;
    case 'newGroup': {
      const id = uid();
      tabGroups[id] = { name: 'New group', color: groupColors[Object.keys(tabGroups).length % groupColors.length] };
      saveTabGroups();
      drawRail();
      break;
    }
    case 'manageGroups': {
      const ids = Object.keys(tabGroups).sort();
      let html = '<div class="stack"><p class="muted">Manage your tab groups. Rename, change color, or delete groups.</p>';
      for (const id of ids) {
        const g = tabGroups[id];
        const count = tabs.filter((t) => t.group === id).length;
        html += '<div class="item"><button class="grow" data-act="openGroup" data-group-id="' + e(id) + '">' +
          '<span class="group-dot ' + groupTone(g.color || groupColors[0]) + '"></span>' +
          '<span class="grow"><strong>' + e(g.name || id) + '</strong><small>' + count + ' tab' + (count === 1 ? '' : 's') + '</small></span>' +
          icon('forward') +
          '</button><button class="icon" data-act="deleteGroup" data-group-id="' + e(id) + '" aria-label="Delete ' + e(g.name || id) + '">' +
          icon('x') +
          '</button></div>';
      }
      html += '<div class="dialogbuttons"><button class="primary" data-act="newGroup">New group</button></div></div>';
      dialog('Tab groups', html, 'groups');
      break;
    }
    case 'more':
      menuDialog();
      break;
    case 'dismiss':
      closeDialog();
      break;
    case 'clearHistory':
      clearHistoryDialog();
      break;
    case 'clearConfirm':
      deleteBrowsingRecords({ history: true });
      break;
    case 'find':
      closeDialog();
      if (view === 'web') {
        $('#findbar').hidden = false;
        $('#find-input').focus();
        $('#find-input').select();
        rectUpdate();
      }
      break;
    case 'findPrev':
    case 'findNext':
      send({ type: 'find', id: t.id, query: $('#find-input').value, backwards: act === 'findPrev' });
      break;
    case 'findClose':
      $('#findbar').hidden = true;
      send({ type: 'find', id: t.id, query: '', backwards: false });
      rectUpdate();
      break;
  }
}
async function signOut() {
  forgetAllSearches();
  clearTimeout(syncTimer);
  const revocation = sync.logout();
  bookmarks = read('bookmarks.local', []);
  devices = [];
  incoming = [];
  lastSync = '';
  syncError = '';
  closeDialog();
  render(true);
  try {
    await revocation;
    toast('Signed out.');
  } catch {
    toast('Signed out on this device. The server session could not be revoked.');
  }
}
window.vaayvuBack = (systemBack = false) => {
  if (!$('#address-matches').hidden) {
    hideAddressMatches();
    return true;
  }
  if ($('#dialog').open) {
    closeDialog();
    return true;
  }
  if (drawer) {
    setDrawer(false);
    return true;
  }
  if (!$('#findbar').hidden) {
    command('findClose');
    return true;
  }
  if (view === 'indiaSearch') {
    forgetSearch(activeId);
    current().title = 'Start page';
    showView('home');
    return true;
  }
  if (view !== 'restrictedSite' && view !== 'web' && view !== 'home') {
    selectTab(activeId);
    return true;
  }
  if (systemBack && view === 'web' && current().error && current().canBack) {
    send({ type: 'back', id: activeId });
    return true;
  }
  if (systemBack && tabs.length > 1 && (view === 'home' || current().error)) {
    closeTab(activeId);
    return true;
  }
  return false;
};
window.vaayvuEvent = (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'indiaSearchResult') { receiveIndiaResults(msg); return; }
  if (msg.type === 'accessibility') {
    capabilities.reduceMotion = msg.reduceMotion === true;
    capabilities.reduceTransparency = msg.reduceTransparency === true;
    applyTheme();
    return;
  }
  if (mobileEvent(msg) || handleAdvancedEvent(msg)) return;
  if (msg.type === 'ready') {
    capabilities = msg;
    applyTheme();
    send({ type: 'websiteAccess', enabled: settings.ordinaryWeb === true });
    if (typeof msg.profileId === 'string') windowInfo.profileId = msg.profileId;
    if (typeof msg.profileName === 'string') windowInfo.profileName = msg.profileName;
    sendProtection();
    sendLiteYouTube();
    sendLowMemoryBrowsing();
    sendYouTubeDesktopOptimization();
    sendBlocklist();
    platform = msg.platform;
    updateSidebar();
    privateSupported = msg.privateSupported !== false;
    nativeReady = true;
    activateTab();
    render(true);
    rectUpdate(true);
    queueSync(0);
    return;
  }
  if (msg.type === 'newtab') {
    if (!settings.ordinaryWeb) {
      if (msg.adopted) send({ type: 'close', id: msg.id });
      toast('External websites are paused in India-only browsing.');
      return;
    }
    if (webURL(msg.url) || (msg.adopted && !msg.url))
      addTab(!!msg.private, msg.url, {
        ...msg,
        background: msg.background ?? settings.linkTabs === 'background',
      });
    return;
  }
  if (msg.type === 'tabclosed') {
    if (tabs.some((tab) => tab.id === msg.id)) closeTab(msg.id);
    return;
  }
  if (msg.type === 'command') {
    const aliases = {
      importBookmarks: 'bookmarkImport',
      exportBookmarks: 'bookmarkExport',
      toggleSidebar: 'sidebar',
    };
    command(aliases[msg.command] || msg.command);
    return;
  }
  if (msg.type === 'notice') {
    if (modal === 'tools' && !pageText)
      dialog('Page tools', '<p class="muted">' + e(msg.message) + '</p>', 'tools');
    else toast(msg.message);
    return;
  }
  if (msg.type === 'openfailed') {
    const tab = tabs.find((t) => t.id === msg.id);
    if (tab?.private) closeTab(msg.id);
    else if (tab) {
      mounted.delete(tab.id);
      tab.loading = false;
      tab.error = String(msg.message || 'The browser could not open this tab.');
      render(true);
    }
    toast(msg.message);
    return;
  }
  if (msg.type === 'text') {
    receivedText(msg);
    return;
  }
  if (msg.type === 'protectionStats') {
    const t = msg.id ? tabs.find((tab) => tab.id === msg.id) : null;
    if (!t || t.private) return;
    let stats = tabProtection.get(t.id);
    if (!stats) {
      stats = { ads: 0, trackers: 0, social: 0, firstparty: 0, token: 0, tokentracker: 0, strict: 0 };
      tabProtection.set(t.id, stats);
    }
    if (typeof msg.ads === 'number' || typeof msg.trackers === 'number') {
      for (const key of Object.keys(stats)) {
        if (typeof msg[key] === 'number' && msg[key] >= 0) stats[key] = Math.floor(msg[key]);
      }
    } else if (typeof msg.kind === 'string') {
      const kind = msg.kind === 'tokentracker' ? 'token' : msg.kind;
      if (Object.hasOwn(stats, kind)) stats[kind] += 1;
      else stats.strict += 1;
    }
    for (const id of [...tabProtection.keys()]) {
      if (!tabs.some((tab) => tab.id === id)) tabProtection.delete(id);
    }
    if (t.id === activeId) drawBar();
    if (modal === 'adBlock' && $('#dialog').open) updateProtectionDialog();
    return;
  }
  if (msg.type === 'adBlock') {
    // Legacy no-op: the VAAYVU engine reports through protectionStats.
    return;
  }
  const t = tabs.find((t) => t.id === msg.id);
  if (msg.type === 'download') {
    if (
      settings.rememberDownloads &&
      !windowInfo.private &&
      !t?.private &&
      msg.private !== true &&
      (t || msg.private === false)
    ) {
      downloads = [
        {
          name: String(msg.name || 'Download'),
          url: webURL(msg.url),
          downloadId: typeof msg.downloadId === 'string' ? msg.downloadId : '',
        },
        ...downloads,
      ].slice(0, 200);
      write('downloads', downloads);
    }
    if (view === 'downloads') render(true);
    if (settings.downloadNotices) toast(msg.message || 'Download saved.');
    return;
  }
  if (msg.type !== 'page' || !t || !canVisit(t) || searches.has(t.id)) return;
  const previousError = t.error;
  const wasLoading = t.loading;
  t.error = msg.failed
    ? String(msg.error || 'Check your connection or the website address.').slice(0, 500)
    : '';
  const prev = t.url,
    oldTitle = t.title;
  const url = webURL(msg.url);
  if (url) t.url = url;
  else if (t.adopted && msg.blank === true) t.url = '';
  t.title =
    t.adopted && !t.url ? 'New tab' : String(msg.title || hostOf(t.url) || 'Start page').slice(0, 512);
  t.loading = !!msg.loading;
  t.canBack = !!msg.canBack;
  t.canForward = !!msg.canForward;
  if (t.loading) t.appliedAppearance = '';
  else { VaayvuExtensions.apply(t); applySiteAppearance(t); }
  if (t.id === activeId && prev !== t.url) resetPhonePage();
  if (t.id === activeId && readerRequest && readerRequest.url !== t.url) closeDialog();
  if (
    !t.private &&
    !windowInfo.private &&
    !approvedVisits.has(t.id) &&
    settings.rememberHistory &&
    !t.loading &&
    url && !VaayvuCore.providerQuery(url) &&
    !msg.failed &&
    visitStamp.get(t.id) !== t.url
  ) {
    historyItems = read('history', historyItems);
    visitStamp.set(t.id, t.url);
    historyItems = [
      { url: t.url, title: t.title, at: Date.now() },
      ...historyItems.filter((h) => h.url !== t.url),
    ].slice(0, 350);
    write('history', historyItems);
  }
  if (!t.private && (prev !== t.url || oldTitle !== t.title || !t.loading)) {
    persistTabs();
    queueSync();
  }
  if (t.id === activeId) {
    drawBar();
    if (previousError !== t.error) renderContent(true);
  }
  const addressChanged = prev !== t.url;
  if (addressChanged || (!wasLoading && t.loading) || (!previousError && t.error)) invalidateTabPreview(t.id);
  if (addressChanged || oldTitle !== t.title) {
    drawRail();
    drawManagedTabs();
  }
  if (addressChanged || oldTitle !== t.title || wasLoading !== t.loading || previousError !== t.error) drawTabOverview();
};
document.addEventListener('click', (event) => {
  const el = event.target.closest('button');
  if (!el || (el.closest('#dialog') && closeStaleAccountDialog())) return;
  if (el.dataset.groupId && el.dataset.act === 'openGroup') groupDialog(el.dataset.groupId);
  else if (el.dataset.groupId && el.dataset.act === 'ungroupGroup') ungroupGroup(el.dataset.groupId);
  else if (el.dataset.groupId && el.dataset.act === 'deleteGroup') deleteGroup(el.dataset.groupId);
  else if (el.dataset.landscape && Object.hasOwn(observatoryLooks, el.dataset.landscape)) {
    VaayvuPreferences.commit({ wallpaper: el.dataset.landscape });
    $('#content [data-landscape="' + el.dataset.landscape + '"]')?.focus({ preventScroll: true });
  }
  else if (el.dataset.act === 'tabBarMenu') openTabBarMenu(el, event.detail ? event : undefined);
  else if (el.dataset.act === 'adBlockUnpause' && el.dataset.url) unpauseSite(el.dataset.url);
  else if (el.dataset.act) command(el.dataset.act);
  else if (el.dataset.view) showView(el.dataset.view);
  else if (el.dataset.paneFocus) selectTab(el.dataset.paneFocus === 'left' ? split.left : split.right);
  else if (el.dataset.paneClose) closeTabs([el.dataset.paneClose === 'left' ? split.left : split.right]);
  else if (el.dataset.select) selectTab(el.dataset.select);
  else if (el.dataset.space) setActiveSpace(el.dataset.space);
  else if (el.dataset.spaceEdit) spaceDialog(el.dataset.spaceEdit);
  else if (el.dataset.spaceArchive) archiveSpace(el.dataset.spaceArchive);
  else if (el.dataset.spaceDelete) deleteSpace(el.dataset.spaceDelete);
  else if (el.dataset.archiveRestore) restoreArchived(Number(el.dataset.archiveRestore));
  else if (el.dataset.close) closeTab(el.dataset.close);
  else if (el.dataset.resultUrl) {
    if (settings.ordinaryWeb) addTab(current().private, el.dataset.resultUrl);
    else offerVisit(el.dataset.resultUrl);
  } else if (el.dataset.confirmVisit && modal === 'restrictedSite' && el.closest('#dialog[open]')) {
    const url = webURL(el.dataset.confirmVisit);
    if (url && !VaayvuCore.providerQuery(url)) {
      closeDialog();
      if (native) addTab(current().private, url, { userApprovedVisit: true });
      else window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else if (el.dataset.offerVisit) {
    offerVisit(el.dataset.offerVisit);
  } else if (el.dataset.url) {
    if (event.metaKey || event.ctrlKey)
      addTab(current().private, el.dataset.url, { background: !event.shiftKey });
    else navigate(el.dataset.url);
  } else if (el.dataset.editBookmark) editBookmark(el.dataset.editBookmark);
  else if (el.dataset.openDownload && capabilities.canOpenDownload)
    send({ type: 'openDownload', downloadId: el.dataset.openDownload });
  else if (el.dataset.forgetUrl && !windowInfo.private) {
    historyItems = read('history', historyItems).filter((item) => item.url !== el.dataset.forgetUrl);
    write('history', historyItems);
    render(true);
  } else if (el.dataset.remove) deleteBookmark(el.dataset.remove);
  else if (el.hasAttribute('data-removefav')) {
    favorites.splice(Number(el.dataset.removefav), 1);
    write('favorites', favorites);
    favoritesDialog();
    render(true);
  } else if (el.dataset.removePassword) {
    deletePassword(Number(el.dataset.removePassword));
  } else if (el.matches('.color-swatch')) {
    for (const sw of document.querySelectorAll('.color-swatch')) sw.classList.remove('selected');
    el.classList.add('selected');
  } else if (el.dataset.act === 'saveGroup') {
    saveGroup();
  } else if (el.dataset.act === 'deleteGroup') {
    deleteGroup(el.dataset.groupId);
  } else if (el.dataset.act === 'ungroupGroup') {
    ungroupGroup(el.dataset.groupId);
  } else if (el.dataset.fold) {
    const id = el.dataset.fold;
    if (foldedGroups.has(id)) foldedGroups.delete(id);
    else foldedGroups.add(id);
    drawRail();
  } else if (el.dataset.act === 'openGroup') {
    groupDialog(el.dataset.groupId);
  } else if (el.dataset.act === 'newGroup') {
    command('newGroup');
  }
});
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    data = new FormData(form);
  if (form.closest('#dialog') && closeStaleAccountDialog()) return;
  if (advancedSubmit(form, data)) return;
  if (form.id === 'group-name-form') {
    event.preventDefault();
    saveGroup();
    return;
  }
  if (form.id === 'space-form') {
    saveSpaceForm(form);
    return;
  }
  switch (form.id) {
    case 'add-password': {
      const site = webURL(data.get('site'));
      if (!site) { toast('Enter a valid website address.'); break; }
      savePasswordEntry(site, data.get('username').trim(), data.get('password'));
      passwordsDialog();
      break;
    }
    case 'edit-bookmark': {
      if (windowInfo.private) break;
      const url = webURL(data.get('url'));
      if (!url) {
        toast('Enter a complete HTTP or HTTPS address.');
        break;
      }
      const id = form.dataset.id;
      const old = id ? saved().find((b) => b.id === id) : saved().find((b) => b.url === url);
      if (id && !old) {
        closeDialog();
        toast('This bookmark was removed.');
        break;
      }
      const next = {
        id: old?.id || uid(),
        url,
        title: data.get('title').trim().slice(0, 512) || hostOf(url),
        updatedAt: Math.max(Date.now(), (old?.updatedAt || 0) + 1),
      };
      bookmarks = [...bookmarks.filter((b) => b.id !== next.id), next];
      saveBookmarks();
      closeDialog();
      render(true);
      toast('Bookmark saved.');
      break;
    }
    case 'address-form':
      navigate($('#address').value);
      break;
    case 'directory-form':
      navigate(data.get('query'));
      break;
    case 'hero-form':
      navigate($('#hero-input').value);
      break;
    case 'fav-add': {
      const raw = data.get('url').trim(),
        url = webURL(raw) || webURL('https://' + raw);
      if (!url || /\s/.test(raw)) {
        toast('Enter a valid website address.');
        return;
      }
      favorites.push({ title: data.get('title').trim() || hostOf(url), url });
      write('favorites', favorites);
      favoritesDialog();
      render(true);
      break;
    }
    case 'auth': {
      const button = form.querySelector('.primary');
      button.disabled = true;
      const include = data.has('include');
      try {
        await sync.authenticate(
          data.get('server'),
          data.get('user'),
          data.get('pass'),
          form.dataset.register === 'true',
        );
        forgetAllSearches();
        write('server', sync.session.origin);
        bookmarks = mergeBookmarks(
          read('bookmarks.' + sync.profileKey, []),
          include ? read('bookmarks.local', []) : [],
        );
        devices = [];
        incoming = [];
        lastSync = '';
        syncError = '';
        saveBookmarks();
        accountDialog();
        render(true);
        await runSync();
      } catch (err) {
        if (form.isConnected) {
          form.querySelector('#auth-error').textContent = err.message;
          button.disabled = false;
        } else toast(err.message);
      }
      break;
    }
    case 'adblock-custom': {
      const input = form.elements.namedItem('domains');
      const status = form.querySelector('.prefs-message');
      try {
        saveAdDomains(VaayvuPreferences.parseDomains(input.value, 512));
        input.value = input.defaultValue = adBlockConfig.custom.join('\n');
        input.removeAttribute('aria-invalid');
        status.textContent = savedDomainCount(adBlockConfig.custom.length);
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        status.textContent = error.message;
      }
      break;
    }
    case 'ask': {
      if (!settings.ordinaryWeb || modal !== 'tools' || !sync.session || !pageText || current().private || pageText.id !== activeId || pageText.url !== current().url) break;
      const button = form.querySelector('button'),
        answer = form.querySelector('#answer');
      const question = data.get('question').trim();
      const guard = globalThis.VaayvuAiGuard;
      if (guard) {
        const gate = guard.costGate({ text: pageText.text, question });
        if (!gate.allowed) {
          answer.textContent = gate.reason;
          break;
        }
      }
      button.disabled = true;
      answer.textContent = 'Waiting for your model…';
      try {
        const safeText = guard ? guard.redact(pageText.text) : pageText.text;
        answer.textContent = await sync.ask(question, safeText);
      } catch (err) {
        answer.textContent = err.message;
      } finally {
        button.disabled = false;
      }
      break;
    }
  }
});
$('#dialog').addEventListener('close', () => {
  if ($('#dialog').open) return;
  clearMenuPreview();
  modal = '';
  dialogSession = undefined;
  readerRequest = null;
  pageText = null;
  rectUpdate();
  if (dialogTrigger?.isConnected && !drawer && document.activeElement === document.body)
    dialogTrigger.focus();
});
$('#dialog').addEventListener('click', (ev) => {
  if (ev.target !== $('#dialog')) return;
  const r = $('#dialog').getBoundingClientRect();
  if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)
    closeDialog();
});
$('#address').addEventListener('focus', () => $('#address').select());
document.addEventListener('reset', ev => {
  if (ev.target.id !== 'adblock-custom') return;
  ev.target.elements.domains.removeAttribute('aria-invalid');
  const message = ev.target.querySelector('.prefs-message');
  if (message) message.textContent = savedDomainCount(adBlockConfig.custom.length);
});
document.addEventListener('change', ev => {
  if (ev.target && ev.target.id === 'rewards-plan') {
    setRewardsPlan(ev.target.value);
    return;
  }
  const key = ev.target.dataset.adList;
  if (!key || modal !== 'adBlock' || !adBlock || !(key in adBlockConfig.lists)) return;
  adBlockConfig.lists[key] = ev.target.checked;
  write('adBlock', adBlockConfig);
  sendBlocklist();
  drawBar();
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'library-search') {
    libraryQuery = ev.target.value;
    $('.results').innerHTML = libraryRows();
  }
  if (ev.target.id === 'find-input') command('findNext');
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (ev.defaultPrevented) return;
    if (window.vaayvuBack()) {
      ev.preventDefault();
    }
    return;
  }
  if (ev.key === 'Enter' && ev.target.id === 'find-input') {
    ev.preventDefault();
    command(ev.shiftKey ? 'findPrev' : 'findNext');
    return;
  }
  if (spacesEnabled && ev.altKey && !ev.metaKey && !ev.ctrlKey && /^[1-9]$/.test(ev.key)) {
    const space = spaces.list[Number(ev.key) - 1];
    if (space) {
      ev.preventDefault();
      setActiveSpace(space.id);
    }
    return;
  }
  if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return;
  if (/^[1-9]$/.test(ev.key) && !ev.shiftKey) {
    ev.preventDefault();
    command('selectTab' + ev.key);
    return;
  }
  if (ev.key === 'Tab' && ev.ctrlKey) {
    ev.preventDefault();
    command(ev.shiftKey ? 'previousTab' : 'nextTab');
    return;
  }
  if (ev.shiftKey) return;
  const action = { l: 'focusAddress', t: 'newTab', w: 'closeTab', f: 'find', r: 'reload', d: 'bookmark', k: 'commandBar' }[
    ev.key.toLowerCase()
  ];
  if (action) {
    ev.preventDefault();
    command(action);
  }
});
new ResizeObserver(() => rectUpdate()).observe($('#viewport'));
const paneDivider = $('#pane-divider');
paneDivider.addEventListener('pointerdown', (event) => {
  if (!splitActive()) return;
  event.preventDefault();
  paneDivider.setPointerCapture(event.pointerId);
  paneDivider.classList.add('dragging');
  const move = (e) => {
    const vp = $('#viewport').getBoundingClientRect();
    split.ratio = Math.min(0.75, Math.max(0.25, (e.clientX - vp.left) / vp.width));
    $('#viewport').dataset.ratio = String(Math.min(75, Math.max(25, Math.round((split.ratio * 100) / 5) * 5)));
    rectUpdate(true);
  };
  const stop = () => {
    write(windowKey('split'), split);
    paneDivider.classList.remove('dragging');
    paneDivider.removeEventListener('pointermove', move);
    paneDivider.removeEventListener('pointerup', stop);
    paneDivider.removeEventListener('pointercancel', stop);
  };
  paneDivider.addEventListener('pointermove', move);
  paneDivider.addEventListener('pointerup', stop);
  paneDivider.addEventListener('pointercancel', stop);
});
narrowLayout.addEventListener('change', () => {
  drawBar();
  drawPanes();
  if (view === 'home') renderContent(true);
});
addEventListener('resize', () => {
  if (!narrowLayout.matches && drawer) setDrawer(false);
  else updateSidebar();
  rectUpdate();
});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {applyTheme(); applySiteAppearance(current()); syncPhoneAppearance();});
document.addEventListener('visibilitychange', () => {
  updateDeskClock();
  if (!document.hidden) queueSync(0);
});
setInterval(() => {
  if (!document.hidden) queueSync(0);
}, 60000);
bindTabManager();
bindOmnibox();
VaayvuExtensions.bind();
bindAdvancedControls();
iconsStatic();
updateSidebar();
applyTheme();
applySpaceTheme();
render(true);
sendBlocklist();
send({ type: 'ready' });
