'use strict';

const {
  app,
  BrowserWindow,
  WebContentsView,
  webContents,
  session,
  ipcMain,
  clipboard,
  dialog,
  Menu,
  shell,
  nativeTheme,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { UI_ORIGIN, HOME, website, syncDestination, domains, blockedHost, bounds, isInspectorFrontend, siteOf, vfdMatch } = require('./policy.cjs');
const { tabBarMenu } = require('./desktop-windows.cjs');
const { BrowserStore } = require('./domain/store.cjs');

// Durable renderer state (P04). One SQLite file per install holds the
// key-value table plus the crash journal. The renderer reaches it through the
// synchronous VaayvuStore bridge in windows/preload.cjs, so UI keys no longer
// persist in Chromium localStorage.
let domainStore = null;
function durableStore() {
  if (domainStore) return domainStore;
  domainStore = new BrowserStore(path.join(app.getPath('userData'), 'vaayvu.sqlite'));
  domainStore.beginSession();
  try {
    domainStore.recoverPreviousSessions();
  } catch (error) {}
  return domainStore;
}
const trustedStoreFrame = (event) => !!event.senderFrame && event.senderFrame.url === HOME;
const storeKey = (key) => typeof key === 'string' && key.length > 0 && key.length <= 512;
const storeValue = (value) => typeof value === 'string' && value.length <= 4 * 1024 * 1024;

ipcMain.on('vaayvu:store-get', (event, key) => {
  if (!trustedStoreFrame(event) || !storeKey(key)) { event.returnValue = null; return; }
  try {
    event.returnValue = durableStore().getValue(key);
  } catch (error) {
    event.returnValue = null;
  }
});
ipcMain.on('vaayvu:store-set', (event, key, value) => {
  if (!trustedStoreFrame(event) || !storeKey(key) || !storeValue(value)) { event.returnValue = false; return; }
  try {
    event.returnValue = durableStore().setValue(key, value);
  } catch (error) {
    event.returnValue = false;
  }
});
ipcMain.on('vaayvu:store-remove', (event, key) => {
  if (!trustedStoreFrame(event) || !storeKey(key)) { event.returnValue = false; return; }
  try {
    event.returnValue = durableStore().removeValue(key);
  } catch (error) {
    event.returnValue = false;
  }
});
ipcMain.on('vaayvu:store-keys', (event) => {
  if (!trustedStoreFrame(event)) { event.returnValue = []; return; }
  try {
    event.returnValue = durableStore().listValues();
  } catch (error) {
    event.returnValue = [];
  }
});
ipcMain.on('vaayvu:store-import', (event, entries) => {
  if (!trustedStoreFrame(event) || !Array.isArray(entries) || entries.length > 5000) {
    event.returnValue = 0;
    return;
  }
  try {
    event.returnValue = durableStore().importValues(entries);
  } catch (error) {
    event.returnValue = 0;
  }
});
app.on('will-quit', () => {
  if (!domainStore) return;
  try {
    domainStore.endSession();
  } catch (error) {}
  try {
    domainStore.close();
  } catch (error) {}
  domainStore = null;
});

// Electron allows one request handler per session. Route shared-profile traffic
// to the window that owns the request before applying its policy.
const uiSessions = new WeakSet();
const shellHosts = new Map();
const siteMembers = new WeakMap();
const siteTabs = new Map();
const clearingSessions = new WeakSet();

const SECURE = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  webviewTag: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  navigateOnDragDrop: false,
  spellcheck: false,
  devTools: false,
  safeDialogs: true,
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function assets(root, directory = root, out = new Map()) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) assets(root, full, out);
    else if (entry.isFile()) out.set('/' + path.relative(root, full).split(path.sep).join('/'), full);
  }
  return out;
}
function denyPermissions(ses) {
  ses.setPermissionRequestHandler((_contents, _permission, answer) => answer(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
  ses.setDisplayMediaRequestHandler((_request, answer) => answer({}));
}


// Rewrite desktop YouTube to the lighter mobile layout when the user opts in.
function liteYouTubeURL(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  if (host === 'www.youtube.com' || host === 'youtube.com') {
    url.hostname = 'm.youtube.com';
    return url.href;
  }
  return null;
}
// On YouTube pages: never pre-buffer, pause anything offscreen, and keep a
// single video playing so background players can't hold 8K buffers.
const YOUTUBE_OPTIMIZE = `(()=>{try{
if(!/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be)$/.test(location.hostname))return;
const seen=new WeakSet();
function arm(v){if(!(v instanceof HTMLVideoElement)||seen.has(v))return;seen.add(v);
try{v.preload='metadata'}catch{}
try{if(v.autoplay)v.autoplay=false}catch{}
const io=new IntersectionObserver(es=>{for(const e of es){if(!e.isIntersecting&&!v.paused&&document.pictureInPictureElement!==v){try{v.pause()}catch{}}}} ,{threshold:0.05});
try{io.observe(v)}catch{}
v.addEventListener('play',()=>{for(const o of document.querySelectorAll('video')){if(o!==v&&!o.paused&&document.pictureInPictureElement!==o){try{o.pause()}catch{}}}});}
for(const v of document.querySelectorAll('video'))arm(v);
new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes){if(n instanceof HTMLVideoElement)arm(n);
else if(n&&n.querySelectorAll)for(const v of n.querySelectorAll('video'))arm(v);}}}).observe(document.documentElement,{childList:true,subtree:true});
}catch{}})();`;
// VAAYVU's original YouTube player-response & dynamic ad shield. Strips
// ad-schedule arrays (adPlacements, playerAds, adSlots, adBreakHeartbeatParams)
// from player JSON responses while preserving streamingData (720p..8K/60fps/HDR),
// collapses dynamic ad wrappers, and auto-skips/mutes any residual .ad-showing state.
const YOUTUBE_MAIN_WORLD_SHIELD = `(()=>{try{
if(!/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com)$/i.test(location.hostname))return;
if(window.__vaayvuYtShieldInstalled)return;
window.__vaayvuYtShieldInstalled=true;
const AD_KEYS=['adPlacements','playerAds','adSlots','adBreakHeartbeatParams'];
function strip(obj,depth=0){
  if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off')return obj;
  if(!obj||typeof obj!=='object'||depth>4)return obj;
  for(const k of AD_KEYS){if(k in obj){try{delete obj[k];}catch{}}}
  if(obj.playerResponse&&typeof obj.playerResponse==='object')strip(obj.playerResponse,depth+1);
  return obj;
}
let ytipr=window.ytInitialPlayerResponse;
if(ytipr)strip(ytipr);
try{
  Object.defineProperty(window,'ytInitialPlayerResponse',{
    configurable:true,enumerable:true,
    get(){return ytipr;},
    set(v){ytipr=strip(v);}
  });
}catch{}
const origJson=Response.prototype.json;
Response.prototype.json=async function(){
  const data=await origJson.apply(this,arguments);
  return strip(data);
};
const origParse=JSON.parse;
JSON.parse=function(){
  const data=origParse.apply(this,arguments);
  return strip(data);
};
}catch{}})();`;
function buildAdShieldScript(enabled, css) {
  return `(()=>{try{
const on=${enabled ? 'true' : 'false'},css=${JSON.stringify(css || '')};
if(document.documentElement)document.documentElement.dataset.vaayvuAdShield=on?'on':'off';
const k=Symbol.for('vaayvu.vfdShield');
let st=document.getElementById('vaayvu-vfd-cosmetic');
if(!on||!css){if(st)st.remove();}
else{if(!st){st=document.createElement('style');st.id='vaayvu-vfd-cosmetic';(document.head||document.documentElement).appendChild(st);}if(st.textContent!==css)st.textContent=css;}
const prev=window[k];
if(!on){if(prev&&prev.stop)prev.stop();delete window[k];return;}
if(prev&&prev.active)return;
const yt=/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be)$/i.test(location.hostname);
function cleanDOM(){
  if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off')return;
  for(const f of document.querySelectorAll('iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="googleadservices"],iframe[src*="amazon-adsystem"],iframe[src*="taboola"],iframe[src*="outbrain"],iframe[src*="adnxs"],iframe[src*="criteo"],iframe[src*="exoclick"],iframe[src*="popads"],iframe[id^="google_ads_"]')){
    f.style.setProperty('display','none','important');
    const box=f.closest('.ad-slot,.ad-container,.ad-wrapper,.ad-unit,.dfp-ad,[id^="div-gpt-ad"]');
    if(box)box.style.setProperty('display','none','important');
  }
  if(yt){
    for(const el of document.querySelectorAll('ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-video-masthead-ad-v3-renderer,ytm-promoted-sparkles-web-renderer,ytm-promoted-video-renderer,ytm-companion-ad-renderer,ytm-ad-slot-renderer,ytm-in-feed-ad-layout-renderer')){
      el.style.setProperty('display','none','important');
      const cell=el.closest('ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer');
      if(cell)cell.style.setProperty('display','none','important');
    }
    for(const reel of document.querySelectorAll('ytd-reel-video-renderer[is-ad],ytd-reel-video-renderer ytd-ad-slot-renderer')){
      const r=reel.closest('ytd-reel-video-renderer')||reel;
      r.style.setProperty('display','none','important');
    }
    const player=document.getElementById('movie_player')||document.querySelector('.html5-video-player');
    if(player){
      const adShowing=player.classList.contains('ad-showing')||player.classList.contains('ad-interrupting')||!!player.querySelector('.ytp-ad-player-overlay,.ytp-ad-player-overlay-layout');
      const v=player.querySelector('video.html5-main-video')||player.querySelector('video');
      if(adShowing){
        try{if(typeof player.skipAd==='function')player.skipAd();}catch{}
        for(const b of player.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container,.ytp-ad-skip-button-slot button,.ytp-ad-overlay-close-button')){try{b.click();}catch{}}
        if(v){
          if(v.__vaayvuPreAdMuted===undefined)v.__vaayvuPreAdMuted=v.muted;
          if(v.__vaayvuPreAdRate===undefined&&v.playbackRate<=2)v.__vaayvuPreAdRate=v.playbackRate;
          try{v.muted=true;}catch{}
          try{if(Number.isFinite(v.duration)&&v.duration>0&&v.duration<600)v.currentTime=Math.max(0,v.duration-0.05);else v.playbackRate=16;}catch{}
        }
      }else if(v&&v.__vaayvuPreAdMuted!==undefined){
        try{v.muted=v.__vaayvuPreAdMuted;}catch{}
        try{if(v.__vaayvuPreAdRate)v.playbackRate=v.__vaayvuPreAdRate;}catch{}
        delete v.__vaayvuPreAdMuted;
        delete v.__vaayvuPreAdRate;
      }
    }
  }
}
cleanDOM();
const mo=new MutationObserver(()=>{cleanDOM();});
if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true,attributes:yt,attributeFilter:yt?['class','is-ad']:undefined});
window[k]={active:true,stop(){try{mo.disconnect();}catch{}}};
}catch{}})();`;
}
function configureShell(ui, files) {
  if (uiSessions.has(ui)) return;
  uiSessions.add(ui);
  denyPermissions(ui);
  ui.protocol.handle('vaayvu', (request) => {
    const url = new URL(request.url);
    const file = !url.username && !url.password && url.host === 'browser' && files.get(url.pathname);
    if (request.method !== 'GET' || !file || url.search) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(file), {
      headers: {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      },
    });
  });
  ui.webRequest.onBeforeRequest((details, done) => {
    const local = details.url.startsWith(UI_ORIGIN + '/');
    const host = shellHosts.get(details.webContentsId);
    done({ cancel: !local && (!host?.enabled || !syncDestination(details.url) ||
      (details.resourceType !== 'xhr' && details.method !== 'OPTIONS')) });
  });
  ui.on('will-download', (event) => event.preventDefault());
}
function keyboard(input) {
  if (input.type !== 'keyDown') return;
  const key = input.key.toLowerCase(),
    mod = input.control || (process.platform === 'darwin' && input.meta);
  if (input.alt && !mod && !input.shift) return { ArrowLeft: 'back', ArrowRight: 'forward' }[input.key];
  if (key === 'f12' || (key === 'i' && ((input.control && input.shift && !input.alt) ||
      (process.platform === 'darwin' && input.meta && input.alt && !input.shift)))) return 'inspect';
  if (key === 'f5') return 'reload';
  if (!mod || input.alt) return;
  if (input.shift) return { t: 'reopenTab', n: 'privateTab', tab: 'previousTab', a: 'manageTabs' }[key];
  return {
    t: 'newTab',
    w: 'closeTab',
    l: 'focusAddress',
    f: 'find',
    d: 'bookmark',
    h: 'history',
    j: 'downloads',
    r: 'reload',
    tab: 'nextTab',
    p: 'print',
  }[key];
}

const { IndiaSearch } = require('./india-search.cjs');

class BrowserHost {
  constructor(chromeDir, options = {}) {
    this.windows = options.windows;
    this.windowName = options.windowName || '';
    this.tabs = new Map();
    this.search = new IndiaSearch(require('./package.json').vaayvuIndiaSearch, (response) => this.event('indiaSearchResult', response));
    this.active = null;
    this.zones = [];
    this.enabled = false;
    this.downloads = new Set();
    // Deterministic destination for tests and headless runs; the normal path
    // keeps the native save dialog. onDownload/onDownloadDone are test hooks.
    this.downloadDir = typeof options.downloadDir === 'string' && options.downloadDir
      ? path.resolve(options.downloadDir)
      : '';
    this.onDownload = typeof options.onDownload === 'function' ? options.onDownload : null;
    this.onDownloadDone = typeof options.onDownloadDone === 'function' ? options.onDownloadDone : null;
    this.protect = true;
    this.custom = new Set();
    this.blocklist = new Set();
    this.strictBlocks = new Set();
    this.pausedSites = new Set();
    this.adBlock = true;
    this.adLists = { ads: true, trackers: true, social: true, cosmetic: true, aggressive: true };
    let defaultCompiled = null;
    try {
      require(path.join(chromeDir, 'vfd-rules.js'));
      const VaayvuVFD = require(path.join(chromeDir, 'vfd.js'));
      defaultCompiled = VaayvuVFD.load(globalThis.VaayvuVFDRules);
    } catch {}
    this.vfdAds = new Set(defaultCompiled ? defaultCompiled.ads : []);
    this.vfdTrackers = new Set(defaultCompiled ? defaultCompiled.trackers : []);
    this.vfdSocial = new Set(defaultCompiled ? defaultCompiled.social : []);
    this.vfdPatterns = defaultCompiled ? [...defaultCompiled.tokens] : [];
    this.vfdTrackerPatterns = defaultCompiled ? [...defaultCompiled.trackerTokens] : [];
    this.vfdFirstParty = defaultCompiled ? [...defaultCompiled.firstPartyTokens] : [];
    this.vfdExceptions = defaultCompiled ? [...defaultCompiled.exceptions] : [];
    this.vfdCSS = defaultCompiled && defaultCompiled.selectors.length
      ? defaultCompiled.selectors.join(',') + '{display:none !important}'
      : '';
    this.protectionStats = new Map();
    this.requestedImages = true;
    // Memory settings from the browser UI. Defaults match preferences.js.
    // Font blocking stays opt-in so website typography never changes unasked.
    this.liteYouTube = false;
    this.youtubeOptimize = true;
    this.lowMemory = false;
    const files = assets(chromeDir);
    this.siteOf = siteOf;
    this.trackers = domains(JSON.parse(fs.readFileSync(files.get('/tracking.json'), 'utf8')), 4096);
    this.extractor = fs.readFileSync(files.get('/extract.js'), 'utf8');
    this.pageDisplay = fs.readFileSync(files.get('/page-display.js'), 'utf8');
    const ui = session.fromPartition('persist:vaayvu-ui');
    this.regular = this.siteSession('persist:vaayvu-web');
    this.privateSession = null;
    configureShell(ui, files);
    this.window = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 530,
      minHeight: 380,
      backgroundColor: '#f2eee6',
      title: this.windowName || 'Vaayvu',
      ...(process.platform !== 'darwin' && { icon: path.join(chromeDir, 'assets', 'vaayvu.png') }),
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 8, y: 11 } } : {}),
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        ...SECURE, session: ui, preload: path.join(__dirname, 'preload.cjs'),
        additionalArguments: options.windowInfo ? ['--vaayvu-window=' + JSON.stringify(options.windowInfo)] : [],
      },
    });
    if (options.show !== false) this.window.once('ready-to-show', () => this.window.show());
    this.ui = this.window.webContents;
    this.uiId = this.ui.id;
    shellHosts.set(this.uiId, this);
    this.protectedWindow = false;
    this.ui.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.ui.on('will-navigate', (e) => e.preventDefault());
    this.ui.on('will-frame-navigate', (e) => e.preventDefault());
    this.ui.on('will-attach-webview', (e) => e.preventDefault());
    this.ui.on('render-process-gone', () => {
      this.dispose();
      this.window.destroy();
    });
    this.ui.on('before-input-event', (e, input) => this.shortcut(e, input));
    this.window.on('page-title-updated', (e) => e.preventDefault());
    this.window.on('resize', () => this.layout());
    this.window.on('closed', () => this.dispose());
    this.receive = (event, value) => {
      if (
        this.disposed ||
        event.sender !== this.ui ||
        !event.senderFrame ||
        event.senderFrame !== this.ui.mainFrame ||
        event.senderFrame.url !== HOME ||
        typeof value !== 'string' ||
        value.length > 3 * 1024 * 1024
      )
        return;
      let message;
      try {
        message = JSON.parse(value);
      } catch {
        return;
      }
      if (message && typeof message === 'object')
        this.command(message).catch(() => this.notice('Vaayvu could not complete that action.'));
    };
    ipcMain.on('vaayvu:command', this.receive);
    this.ui.loadURL(HOME).catch(() => this.window.close());
    this.sleeper = setInterval(() => {
      this.sleepIdleTabs();
      this.reclaimUnderPressure();
    }, 30000);
    this.sleeper.unref();
  }

  event(type, fields = {}) {
    if (!this.disposed && !this.ui.isDestroyed() && this.ui.getURL() === HOME)
      this.ui.send('vaayvu:event', { type, ...fields });
  }
  notice(message) {
    this.event('notice', { message });
  }
  countBlocked(tabId, kind) {
    if (!tabId) return;
    let stats = this.protectionStats.get(tabId);
    if (!stats) {
      stats = { ads: 0, trackers: 0, social: 0, firstparty: 0, token: 0, strict: 0 };
      this.protectionStats.set(tabId, stats);
    }
    if (kind === 'ads' || kind === 'trackers' || kind === 'social' || kind === 'firstparty') stats[kind] += 1;
    else if (kind === 'token' || kind === 'tokentracker') stats.token += 1;
    else stats.strict += 1;
    this.event('protectionStats', { id: tabId, kind, ...stats });
  }
  applyAdShield(tab) {
    if (!tab || !tab.view) return;
    const contents = tab.view.webContents;
    if (!contents || contents.isDestroyed()) return;
    const page = website(contents.getURL() || tab.url);
    if (!page) return;
    const host = page.hostname.replace(/\.$/, '').toLowerCase();
    const paused = !tab.secret && blockedHost(host, this.pausedSites);
    const active = !!(this.adBlock && !paused);
    const css = active && this.adLists.cosmetic ? this.vfdCSS : '';
    if (tab.vfdCssKey) {
      const oldKey = tab.vfdCssKey;
      tab.vfdCssKey = null;
      contents.removeInsertedCSS(oldKey).catch(() => {});
    }
    if (css) {
      contents.insertCSS(css, { cssOrigin: 'user' }).then((key) => {
        if (this.adBlock && this.adLists.cosmetic) tab.vfdCssKey = key;
        else contents.removeInsertedCSS(key).catch(() => {});
      }).catch(() => {});
    }
    contents.executeJavaScriptInIsolatedWorld(1003, [{ code: buildAdShieldScript(active, css) }]).catch(() => {});
    if (active && /(^|\.)(www\.youtube\.com|m\.youtube\.com)$/i.test(host)) {
      contents.executeJavaScript(YOUTUBE_MAIN_WORLD_SHIELD).catch(() => {});
    }
  }
  dragTitlebar(msg) {
    if (msg.phase === 'end') {
      this.windowDrag = null;
      return;
    }
    if (!Number.isFinite(msg.screenX) || !Number.isFinite(msg.screenY) ||
        this.window.isFullScreen() || this.window.isMaximized()) return;
    if (msg.phase === 'start') {
      const [x, y] = this.window.getPosition();
      this.windowDrag = { x, y, screenX: msg.screenX, screenY: msg.screenY, moving: false };
    } else if (msg.phase === 'move' && this.windowDrag) {
      const origin = this.windowDrag;
      const dx = msg.screenX - origin.screenX;
      const dy = msg.screenY - origin.screenY;
      if (!origin.moving && Math.hypot(dx, dy) < 4) return;
      origin.moving = true;
      this.window.setPosition(Math.round(origin.x + dx), Math.round(origin.y + dy));
    }
  }
  shortcut(event, input) {
    const command = keyboard(input);
    if (command) {
      event.preventDefault();
      this.event('command', { command });
    }
  }
  siteSession(name) {
    const ses = session.fromPartition(name, { cache: name.startsWith('persist:') });
    let members = siteMembers.get(ses);
    if (members) {
      members.add(this);
      return ses;
    }
    members = new Set([this]);
    siteMembers.set(ses, members);
    denyPermissions(ses);
    ses.webRequest.onBeforeRequest((d, done) => {
      const resource = new URL(d.url);
      const protocol = resource.protocol;
      if (protocol === 'devtools:') {
        // Electron loads its bundled developer tools in an internal renderer of type "remote".
        // Ordinary WebContentsView pages and private sessions cannot load this scheme.
        const permitted = resource.hostname === 'devtools' && isInspectorFrontend(d.webContentsId, (id) => webContents.fromId(id)) &&
          [...members].some((host) => host.toolsTarget && host.toolsTarget.id === host.active &&
            ses === host.regular && !host.toolsTarget.secret);
        return done({ cancel: !permitted });
      }
      const entry = siteTabs.get(d.webContentsId);
      const host = entry?.host || members.values().next().value;
      if (!host || (!entry && [...members].some((member) => !member.enabled))) return done({ cancel: true });
      // Mobile YouTube uses far less JS/DOM than the desktop layout for the
      // same video. Redirect before anything else loads.
      if (d.resourceType === 'mainFrame' && host.liteYouTube) {
        const mobile = liteYouTubeURL(d.url);
        if (mobile && mobile !== d.url) return done({ redirectURL: mobile });
      }
      // Low-memory browsing blocks web fonts everywhere by user choice.
      if (host.lowMemory && (d.resourceType === 'font' || /\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i.test(resource.pathname))) {
        if (d.resourceType !== 'mainFrame' && d.resourceType !== 'subFrame') return done({ cancel: true });
      }
      const owner = entry?.tab;
      if ((!host.enabled && !owner?.userApprovedVisit) || !['http:', 'https:', 'ws:', 'wss:', 'data:', 'blob:', 'about:'].includes(protocol))
        return done({ cancel: true });
      const site = website(d.url);
      if (host.adBlock && blockedHost(resource.hostname, host.strictBlocks)) return done({ cancel: true });
      if (d.resourceType === 'mainFrame') {
        if (!site && d.url !== 'about:blank') return done({ cancel: true });
        if (host.adBlock && site) {
          const sourcePage = website(owner?.openerUrl) || website(d.initiatorOrigin) || website(d.referrer);
          const sourcePaused = sourcePage && !owner?.secret && blockedHost(sourcePage.hostname, host.pausedSites);
          if (owner?.popup && !sourcePaused) {
            const verdict = vfdMatch(d.url, sourcePage && sourcePage.href, {
              ads: host.vfdAds,
              trackers: host.vfdTrackers,
              social: host.vfdSocial,
              patterns: host.vfdPatterns,
              trackerPatterns: host.vfdTrackerPatterns,
              firstParty: host.vfdFirstParty,
              exceptions: host.vfdExceptions,
              strict: host.strictBlocks,
              paused: host.pausedSites,
              lists: host.adLists,
              enabled: host.adBlock,
              privateTab: !!owner.secret,
            });
            if (verdict) {
              if (!owner.secret) host.countBlocked(owner.openerId || owner.id, verdict);
              if (!owner.committedUrl) {
                setImmediate(() => {
                  if (host.tabs.get(owner.id) === owner && !owner.committedUrl) host.closeTab(owner.id);
                });
              }
              return done({ cancel: true });
            }
          } else if (!sourcePaused && host.adLists.ads !== false && blockedHost(resource.hostname, host.vfdAds)) {
            if (owner && !owner.secret) host.countBlocked(owner.id, 'ads');
            return done({ cancel: true });
          }
        }
        return done({ cancel: false });
      }
      if (protocol === 'http:' || protocol === 'https:') {
        if (!site || (!host.requestedImages && d.resourceType === 'image')) return done({ cancel: true });
      }
      if (site || protocol === 'ws:' || protocol === 'wss:') {
        const hostname = resource.hostname;
        const legacy = host.adBlock && host.protect && (blockedHost(hostname, host.trackers) || blockedHost(hostname, host.custom));
        if (legacy) {
          // A worker request can carry its origin without a tab WebContents.
          const page = (owner && website(owner.url || owner.view.webContents.getURL())) ||
            website(d.initiatorOrigin) || website(d.referrer);
          if (page && host.siteOf(page.hostname) !== host.siteOf(hostname)) return done({ cancel: true });
        }
        if (d.resourceType !== 'mainFrame') {
          const page = (owner && website(owner.url || owner.view.webContents.getURL())) ||
            website(d.initiatorOrigin) || website(d.referrer);
          const verdict = vfdMatch(d.url, page && page.href, {
            ads: host.vfdAds,
            trackers: host.vfdTrackers,
            social: host.vfdSocial,
            patterns: host.vfdPatterns,
            trackerPatterns: host.vfdTrackerPatterns,
            firstParty: host.vfdFirstParty,
            exceptions: host.vfdExceptions,
            strict: host.strictBlocks,
            paused: host.pausedSites,
            lists: host.adLists,
            enabled: host.adBlock,
            privateTab: !!owner?.secret,
          });
          if (verdict) {
            if (owner && !owner.secret) host.countBlocked(owner.id, verdict);
            return done({ cancel: true });
          }
        }
      }
      done({ cancel: false });
    });
    ses.on('will-download', (e, item, contents) => {
      const entry = siteTabs.get(contents?.id);
      if (!entry?.host.enabled || !website(item.getURL())) {
        e.preventDefault();
        return;
      }
      const { host, tab } = entry;
      host.downloads.add(item);
      item.setSaveDialogOptions({ title: 'Save download' });
      if (host.downloadDir) {
        let name = 'download';
        try {
          name = path.basename(new URL(item.getURL()).pathname) || name;
        } catch (error) {}
        item.setSavePath(path.join(host.downloadDir, name));
      }
      if (host.onDownload) {
        try {
          host.onDownload(item, tab);
        } catch (error) {}
      }
      item.once('done', (_event, state) => {
        host.downloads.delete(item);
        if (state !== 'completed' && host.downloadDir) {
          const savePath = item.getSavePath();
          for (const file of [savePath, savePath + '.crdownload']) {
            if (!file) continue;
            try {
              fs.rmSync(file, { force: true });
            } catch (error) {}
          }
        }
        if (state === 'completed' && host.enabled)
          host.event('download', {
            id: tab.id,
            url: item.getURL(),
            name: path.basename(item.getSavePath()),
            private: tab.secret,
          });
        if (host.onDownloadDone) {
          try {
            host.onDownloadDone(item, state, tab);
          } catch (error) {}
        }
      });
    });
    return ses;
  }

  tab(id, secret, options = {}) {
    if (secret && !this.privateSession) this.privateSession = this.siteSession('vaayvu-private-' + randomUUID());
    const selectedSession = secret ? this.privateSession : this.regular;
    const view = new WebContentsView({
      ...options,
      webPreferences: { ...options.webPreferences, ...SECURE, devTools: !secret, session: selectedSession, preload: undefined, backgroundThrottling: true },
    });
    const contents = view.webContents;
    contents.setBackgroundThrottling(true);
    const contentId = contents.id;
    const tab = { id, secret, view, url: '', failure: '', loading: false, find: '', sleeping: false, lastUse: Date.now() };
    this.tabs.set(id, tab);
    siteTabs.set(contentId, { host: this, tab });
    const current = () => this.tabs.get(id) === tab && (this.enabled || tab.userApprovedVisit) && !contents.isDestroyed();
    const update = () => {
      if (!current()) return;
      const actual = contents.getURL();
      const url = tab.failure ? tab.url : website(actual) ? actual : tab.url;
      if (!url) return;
      this.event('page', {
        id,
        url,
        title: tab.failure ? '' : contents.getTitle(),
        loading: tab.loading,
        progress: tab.loading ? 0.3 : 1,
        failed: !!tab.failure,
        error: tab.failure,
        canBack: contents.navigationHistory.canGoBack(),
        canForward: contents.navigationHistory.canGoForward(),
      });
    };
    tab.update = update;
    contents.on('will-frame-navigate', (event) => {
      if (!current()) return event.preventDefault();
      if (event.isMainFrame && !website(event.url) && !(tab.popup && event.url === 'about:blank'))
        event.preventDefault();
      if (!event.isMainFrame && /^(?:file|vaayvu|chrome|devtools|javascript):/i.test(event.url))
        event.preventDefault();
    });
    contents.on('will-redirect', (event, url) => {
      if (!website(event.url || url)) event.preventDefault();
    });
    contents.on('will-attach-webview', (e) => e.preventDefault());
    contents.on('did-start-navigation', (event) => {
      if (!current() || !event.isMainFrame || !website(event.url)) return;
      tab.url = event.url;
      tab.loading = true;
      tab.failure = '';
      this.layout();
      this.applyAdShield(tab);
      this.event('page', {
        id,
        url: event.url,
        loading: true,
        failed: false,
        progress: 0.05,
        canBack: contents.navigationHistory.canGoBack(),
        canForward: contents.navigationHistory.canGoForward(),
      });
    });
    contents.on('did-navigate', (_event, url) => {
      if (website(url)) {
        tab.url = url;
        tab.committedUrl = url;
        tab.failure = '';
      }
      update();
    });
    contents.on('did-navigate-in-page', (_event, url, main) => {
      if (main && website(url)) {
        tab.url = url;
        this.applyAdShield(tab);
        update();
      }
    });
    contents.on('did-stop-loading', () => {
      tab.loading = false;
      update();
    });
    contents.on('dom-ready', () => {
      const page = website(contents.getURL());
      if (current()) this.applyAdShield(tab);
      if (current() && this.youtubeOptimize && page &&
          /(^|\.)(www\.youtube\.com|m\.youtube\.com|youtu\.be)$/.test(page.hostname.replace(/\.$/, ''))) {
        contents.executeJavaScriptInIsolatedWorld(1001, [{ code: YOUTUBE_OPTIMIZE }]).catch(() => {});
      }
    });
    contents.on('page-title-updated', update);
    contents.on('did-fail-load', (_event, code, _description, url, main) => {
      if (!main || code === -3 || !website(url) || !current()) return;
      tab.url = url;
      tab.loading = false;
      tab.failure = 'This website could not be loaded. Check the address and connection.';
      this.layout();
      update();
    });
    contents.on('render-process-gone', () => {
      if (!current()) return;
      this.closeTab(id);
      this.event('openfailed', { id, message: 'The website stopped responding. Reopen the tab to try again.' });
    });
    contents.on('destroyed', () => {
      siteTabs.delete(contentId);
      if (this.tabs.get(id) === tab && !tab.sleeping) {
        this.tabs.delete(id);
        this.cleanupPrivate();
        this.event('tabclosed', { id });
      }
    });
    contents.on('before-input-event', (e, input) => this.shortcut(e, input));
    contents.setWindowOpenHandler((details) => {
      if (!this.enabled || !current() || this.active !== id || (!website(details.url) && details.url !== 'about:blank'))
        return { action: 'deny' };
      if (this.adBlock && details.url && details.url !== 'about:blank') {
        const verdict = vfdMatch(details.url, contents.getURL() || tab.url, {
          ads: this.vfdAds,
          trackers: this.vfdTrackers,
          social: this.vfdSocial,
          patterns: this.vfdPatterns,
          trackerPatterns: this.vfdTrackerPatterns,
          firstParty: this.vfdFirstParty,
          exceptions: this.vfdExceptions,
          strict: this.strictBlocks,
          paused: this.pausedSites,
          lists: this.adLists,
          enabled: this.adBlock,
          privateTab: secret,
        });
        if (verdict) {
          if (!secret) this.countBlocked(id, verdict);
          return { action: 'deny' };
        }
      }
      return {
        action: 'allow',
        outlivesOpener: true,
        overrideBrowserWindowOptions: { webPreferences: { ...SECURE, session: selectedSession } },
        createWindow: (childOptions) => {
          const child = this.tab(randomUUID(), secret, childOptions);
          child.popup = true;
          child.openerId = id;
          child.openerUrl = contents.getURL() || tab.url || '';
          child.url = website(details.url)?.href || '';
          this.event('newtab', {
            id: child.id,
            url: child.url,
            adopted: true,
            private: secret,
            ...(details.disposition === 'background-tab' ? { background: true } : {}),
          });
          return child.view.webContents;
        },
      };
    });
    contents.on('devtools-closed', () => {
      if (this.toolsTarget === tab) this.toolsTarget = null;
    });
    contents.on('context-menu', (_e, data) => {
      if (!current()) return;
      const link = this.enabled && website(data.linkURL);
      const template = link
        ? [
            {
              label: 'Open link in new tab',
              click: () => this.event('newtab', { url: link.href, private: secret, background: false }),
            },
            {
              label: 'Open link in background tab',
              click: () => this.event('newtab', { url: link.href, private: secret, background: true }),
            },
            { label: 'Copy link', click: () => clipboard.writeText(link.href) },
          ]
        : [];
      if (data.selectionText) template.push({ label: 'Copy selection', click: () => contents.copy() });
      if (data.isEditable) template.push({ label: 'Paste', click: () => contents.paste() });
      if (!secret && !tab.loading && !tab.failure && this.active === id && website(contents.getURL())) {
        const url = contents.getURL();
        if (template.length) template.push({ type: 'separator' });
        template.push({ label: 'Inspect element', click: () => this.openPageTools(tab, url, data) });
      }
      if (template.length) Menu.buildFromTemplate(template).popup({ window: this.window });
    });
    return tab;
  }

  openPageTools(tab, url, point) {
    if (!tab || this.active !== tab.id || this.tabs.get(tab.id) !== tab || tab.secret ||
        (!this.enabled && !tab.userApprovedVisit) || tab.loading || tab.failure || !website(url)) return;
    const contents = tab.view.webContents;
    if (contents.isDestroyed() || contents.getURL() !== url) return;
    this.toolsTarget = tab;
    // Select at the click's coordinates before docking changes the page layout.
    if (point) contents.inspectElement(point.x, point.y);
    contents.openDevTools({ mode: 'right' });
  }

  cleanupPrivate() {
    if (!this.privateSession || [...this.tabs.values()].some((t) => t.secret)) return;
    const old = this.privateSession;
    this.privateSession = null;
    siteMembers.get(old).delete(this);
    old.closeAllConnections();
    old.clearStorageData().catch(() => {});
    old.clearCache().catch(() => {});
  }
  closeTab(id) {
    if (id) this.search.cancel(id);
    const tab = this.tabs.get(id);
    if (!tab) return;
    if (tab.sleeping) {
      this.tabs.delete(id);
      this.protectionStats.delete(id);
      this.cleanupPrivate();
      this.layout();
      return;
    }
    if (!tab.view.webContents.isDestroyed()) siteTabs.delete(tab.view.webContents.id);
    this.tabs.delete(id);
    this.protectionStats.delete(id);
    this.window.contentView.removeChildView(tab.view);
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close({ waitForBeforeUnload: false });
    this.cleanupPrivate();
    this.layout();
  }
  layout() {
    if (this.disposed || this.window.isDestroyed()) return;
    if (this.toolsTarget && (this.toolsTarget.id !== this.active || this.toolsTarget.failure || !this.tabs.has(this.active))) {
      const contents = this.toolsTarget.view.webContents;
      this.toolsTarget = null;
      if (!contents.isDestroyed()) contents.closeDevTools();
    }
    const [width, height] = this.window.getContentSize();
    const visible = new Map();
    for (const zone of this.zones) {
      const rect = bounds(zone, width, height);
      const id = zone.id || this.active;
      const tab = this.tabs.get(id);
      if (rect && tab && (this.enabled || tab.userApprovedVisit) && !tab.failure) visible.set(id, rect);
    }
    const privateVisible = [...visible.keys()].some((id) => this.tabs.get(id).secret);
    if (privateVisible !== this.protectedWindow) {
      this.window.setContentProtection(privateVisible);
      this.protectedWindow = privateVisible;
    }
    for (const [id, tab] of this.tabs) {
      // A sleeping tab keeps only its address. Never re-attach its closed
      // view; selecting the tab rebuilds it through wakeTab.
      const attached = this.window.contentView.children.includes(tab.view);
      if (tab.sleeping) {
        if (attached) this.window.contentView.removeChildView(tab.view);
        continue;
      }
      const rect = visible.get(id);
      if (!rect) {
        if (attached) this.window.contentView.removeChildView(tab.view);
        if (!tab.view.webContents.isDestroyed()) tab.view.webContents.setFrameRate(1);
      } else {
        if (!attached) this.window.contentView.addChildView(tab.view);
        tab.view.setBounds(rect);
        tab.lastUse = Date.now();
        // Visible tabs keep the display's default frame rate so scrolling and
        // video stay perfectly smooth on high-refresh screens. Colors and
        // rendering are untouched; only hidden tabs are throttled.
      }
    }
  }
  // A short-lived lease protects uploads, calls, downloads and other critical
  // work from tab sleep. Leases expire so a forgotten flag cannot pin memory.
  hasLease(tab) {
    return !!(tab && Number(tab.leaseUntil) > Date.now());
  }

  setLease(id, active, reason = 'work', ttlMs = 300000) {
    const tab = this.tabs.get(id);
    if (!tab) return false;
    if (active === true) {
      const ttl = Math.min(3600000, Math.max(30000, Number(ttlMs) || 300000));
      tab.leaseUntil = Date.now() + ttl;
      tab.leaseReason = String(reason || 'work').slice(0, 40);
    } else {
      tab.leaseUntil = 0;
      tab.leaseReason = '';
    }
    return true;
  }

  // A hidden tab keeps its whole renderer process alive. After enough idle
  // time (and no audible media), close the renderer and keep only the address,
  // like a memory saver. Selecting the tab rebuilds it.
  sleepTab(tab) {
    if (tab.sleeping || this.active === tab.id || !this.tabs.get(tab.id)) return;
    if (this.hasLease(tab)) return;
    // Never sleep a tab that is on screen right now (split panes can show a
    // non-active tab). Sleeping it would blank a visible pane.
    try {
      if (!this.window.isDestroyed() && this.window.contentView.children.includes(tab.view)) return;
    } catch {
      return;
    }
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    if (contents.isCurrentlyAudible() || tab.loading) return;
    siteTabs.delete(contents.id);
    this.window.contentView.removeChildView(tab.view);
    tab.sleeping = true;
    contents.close({ waitForBeforeUnload: false });
    this.event('tabsleeping', { id: tab.id });
  }

  wakeTab(id) {
    const old = this.tabs.get(id);
    if (!old?.sleeping) return;
    const fresh = this.tab(id, old.secret);
    fresh.userApprovedVisit = old.userApprovedVisit;
    fresh.popup = old.popup;
    fresh.url = old.url || fresh.url;
    fresh.sleeping = false;
    fresh.leaseUntil = 0;
    fresh.leaseReason = '';
    // Keep the tab's position in the strip.
    const entries = [...this.tabs.entries()];
    const rebuilt = new Map();
    for (const [key, value] of entries) {
      if (key === id) {
        if (!rebuilt.has(id)) rebuilt.set(id, fresh);
      } else rebuilt.set(key, value);
    }
    this.tabs = rebuilt;
    if (fresh.url && (this.enabled || fresh.userApprovedVisit))
      fresh.view.webContents.loadURL(fresh.url).catch(() => {});
    this.layout();
  }

  sleepIdleTabs() {
    if (this.disposed) return;
    const deadline = Date.now() - (Number(process.env.VAAYVU_TAB_SLEEP_MS) || 300000);
    for (const tab of [...this.tabs.values()]) {
      if (tab.sleeping || this.active === tab.id || tab.lastUse > deadline || this.hasLease(tab)) continue;
      try {
        this.sleepTab(tab);
      } catch {}
    }
  }

  // Brave-style pressure relief: when the whole app's footprint passes ~1.4 GiB,
  // sleep the stalest background tabs first (never the visible tab, never a tab
  // playing sound). Tabs reload untouched when selected again.
  reclaimUnderPressure() {
    if (this.disposed) return;
    let total = 0;
    try {
      for (const { memory } of app.getAppMetrics()) total += memory?.workingSetSize || 0;
    } catch {
      return;
    }
    const threshold = Number(process.env.VAAYVU_PRESSURE_BYTES) || 1433600;
    if (total < threshold) return;
    const stale = [...this.tabs.values()]
      .filter((t) => !t.sleeping && t.id !== this.active && !t.loading && !this.hasLease(t) && Date.now() - t.lastUse > 60000)
      .sort((a, b) => a.lastUse - b.lastUse)
      .slice(0, 3);
    for (const t of stale) {
      try {
        this.sleepTab(t);
      } catch {}
    }
  }

  restrict() {
    this.enabled = false;
    for (const item of this.downloads) item.cancel();
    for (const id of [...this.tabs.keys()]) this.closeTab(id);
    if (siteMembers.get(this.regular).size === 1) {
      this.regular.closeAllConnections();
      this.ui.session.closeAllConnections();
    }
    this.layout();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.sleeper);
    siteMembers.get(this.regular).delete(this);
    shellHosts.delete(this.uiId);
    this.search.cancel();
    ipcMain.removeListener('vaayvu:command', this.receive);
    this.enabled = false;
    for (const item of this.downloads) item.cancel();
    for (const tab of this.tabs.values()) {
      this.tabs.delete(tab.id);
      if (!tab.view.webContents.isDestroyed()) {
        siteTabs.delete(tab.view.webContents.id);
        tab.view.webContents.close({ waitForBeforeUnload: false });
      }
    }
    this.cleanupPrivate();
  }

  async command(msg) {
    const id = typeof msg.id === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(msg.id) ? msg.id : null;
    let tab = this.tabs.get(id);
    if (tab?.sleeping && msg.type !== 'close') {
      this.wakeTab(id);
      tab = this.tabs.get(id);
    }
    const contents = tab?.view.webContents;
    const selected = tab && id === this.active && this.enabled;
    switch (msg.type) {
      case 'ready':
        this.event('ready', {
          platform: process.platform === 'darwin' ? 'mac' : 'windows',
          version: app.getVersion(),
          chromiumDesktop: true,
          canTabBarMenu: true,
          canNewWindow: !!this.windows,
          canRenameWindow: true,
          canSampleTabMemory: true,
          privateSupported: true,
          canProtect: true,
          canDefaultBrowser: process.platform === 'win32',
          canDnsSettings: process.platform === 'win32',
          canCustomBlock: true,
          canAdBlock: true,
          canFullscreen: true,
          canInspect: true,
          canNativeInspector: true,
          canZoom: true,
          canPrint: true,
          canSavePDF: true,
          canCapture: true,
          canSavePage: true,
          canCopy: true,
          canEditPage: true,
          canImportBookmarks: true,
          canExportBookmarks: true,
          canImportPasswords: true,
          canBlockImages: true,
          canClearSiteData: true,
          canPageDisplay: true,
          canUserStyles: true,
          canIndiaSearch: this.search.available,
          reduceTransparency: nativeTheme.shouldUseHighContrastColors,
        });
        this.windows?.notify();
        break;
      case 'openExternal': {
        // s-020 uses this to open the older-build page in the system browser,
        // outside the onboarding overlay.
        const target = typeof msg.url === 'string' ? msg.url.trim() : '';
        if (!/^https?:\/\//i.test(target)) break;
        shell.openExternal(target).catch(() => {});
        break;
      }
      case 'installUpdate': {
        // s-016 owns the presentation; the host owns the install. Builds
        // without an updater answer honestly instead of leaving the screen
        // stuck on "Preparing the update…".
        if (typeof this.installUpdate === 'function') {
          try {
            this.installUpdate(msg);
          } catch (error) {
            this.event('updateError', { message: 'The update could not be started. Try again from the installer.' });
          }
        } else {
          this.event('updateError', {
            message: 'This build installs updates from its installer, not from inside the app.',
          });
        }
        break;
      }
      case 'tabBarMenu': {
        this.windowDrag = null;
        const [width, height] = this.window.getContentSize();
        const popup = { window: this.window };
        if (Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
          popup.x = Math.min(width - 1, Math.max(0, Math.round(msg.x)));
          popup.y = Math.min(height - 1, Math.max(0, Math.round(msg.y)));
        }
        tabBarMenu(this, msg).popup(popup);
        break;
      }
      case 'dragTabBar':
        this.dragTitlebar(msg);
        break;
      case 'titlebarTabs':
        if (process.platform === 'darwin' && Number.isFinite(msg.height) && msg.height >= 24 && msg.height <= 120) {
          const y = Math.round((msg.height - 14) / 2);
          if (this.window.getWindowButtonPosition()?.y !== y) this.window.setWindowButtonPosition({ x: 8, y });
        }
        break;
      case 'newWindow':
        if (msg.private !== true) this.windows?.create();
        break;
      case 'renameWindow':
        if (typeof msg.name === 'string') {
          this.windowName = msg.name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80);
          this.window.setTitle(this.windowName || 'Vaayvu');
        }
        break;
      case 'sampleTabMemory': {
        if (typeof msg.requestId !== 'string' || msg.requestId.length > 128 || !Array.isArray(msg.ids)) return;
        const metrics = new Map(app.getAppMetrics().map(({ pid, memory }) => [pid, memory.workingSetSize]));
        const samples = Object.create(null);
        for (const tabId of msg.ids.slice(0, 2048)) {
          const view = this.tabs.get(tabId)?.view.webContents;
          if (!view || view.isDestroyed()) continue;
          const pid = view.getOSProcessId();
          const kib = metrics.get(pid);
          if (Number.isFinite(kib) && kib > 0) samples[tabId] = { pid, bytes: kib * 1024 };
        }
        this.event('tabMemory', { requestId: msg.requestId, samples });
        break;
      }
      case 'websiteAccess':
        if (msg.enabled === true) {
          this.enabled = true;
          for (const tab of this.tabs.values()) tab.userApprovedVisit = false;
        } else this.restrict();
        break;
      case 'viewport':
        this.zones = msg.visible === true ? [msg] : [];
        this.layout();
        break;
      case 'panes':
        this.zones = msg.visible === true && Array.isArray(msg.panes) ? msg.panes.slice(0, 2) : [];
        this.layout();
        break;
      case 'open': {
        if ((!this.enabled && msg.userApprovedVisit !== true) || clearingSessions.has(this.regular) || !id) return;
        const url = website(msg.url);
        if (!url) {
          this.event('openfailed', { id, message: 'This address cannot be opened.' });
          return;
        }
        if (!tab) tab = this.tab(id, msg.private === true);
        tab.userApprovedVisit = !this.enabled && msg.userApprovedVisit === true;
        if (!msg.background) this.active = id;
        this.layout();
        const target = (this.liteYouTube && liteYouTubeURL(url.href)) || url.href;
        tab.url = target;
        tab.view.webContents.loadURL(target).catch(() => {});
        break;
      }
      case 'select':
        this.active = tab?.id || null;
        this.layout();
        break;
      case 'close':
        this.closeTab(id);
        break;
      case 'openDeveloperTools':
        this.openPageTools(tab, msg.url);
        break;
      case 'navigate': {
        if (!tab || !(this.enabled || tab.userApprovedVisit)) break;
        const dest = website(msg.url);
        if (!dest) break;
        contents.loadURL((this.liteYouTube && liteYouTubeURL(dest.href)) || dest.href).catch(() => {});
        break;
      }
      case 'back':
        if (tab && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
        break;
      case 'forward':
        if (tab && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
        break;
      case 'reload':
        if (tab) {
          if (tab.failure && website(tab.url)) contents.loadURL(tab.url).catch(() => {});
          else contents.reload();
        }
        break;
      case 'stop':
        if (tab) contents.stop();
        break;
      case 'find':
        if (!selected) return;
        if (!msg.query) {
          contents.stopFindInPage('clearSelection');
          tab.find = '';
        } else if (typeof msg.query === 'string' && msg.query.length <= 4096) {
          contents.findInPage(msg.query, { forward: !msg.backwards, findNext: tab.find === msg.query });
          tab.find = msg.query;
        }
        break;
      case 'zoom':
        if (tab && Number.isInteger(msg.percent) && msg.percent >= 50 && msg.percent <= 200) {
          contents.setZoomMode('isolated');
          contents.setZoomFactor(msg.percent / 100);
        }
        break;
      case 'extract':
        if (selected && !tab.failure) {
          const url = contents.getURL(),
            frame = contents.mainFrame;
          const text = await contents.executeJavaScriptInIsolatedWorld(1001, [{ code: this.extractor }]);
          if (
            this.tabs.get(id) === tab &&
            this.active === id &&
            contents.mainFrame === frame &&
            contents.getURL() === url &&
            typeof text === 'string'
          )
            this.event('text', { id, url, title: contents.getTitle(), text: text.slice(0, 18000) });
        }
        break;
      case 'pageDisplay':
        if (selected && msg.url === contents.getURL() && ['dark', 'light', 'undo', 'pick'].includes(msg.action)) {
          const code =
            'if (location.href === ' +
            JSON.stringify(msg.url) +
            ') (' +
            this.pageDisplay +
            ')(' +
            JSON.stringify(msg.action) +
            ')';
          await contents.executeJavaScriptInIsolatedWorld(1001, [{ code }]);
        }
        break;
      case 'userStyles': {
        if (
          !tab ||
          tab.secret ||
          !this.enabled ||
          !website(msg.url) ||
          !msg.url.startsWith('https://') ||
          msg.url !== contents.getURL() ||
          typeof msg.css !== 'string' ||
          Buffer.byteLength(msg.css) > 131072
        )
          return;
        const code =
          '(()=>{if(location.href!==' +
          JSON.stringify(msg.url) +
          ')return;' +
          'const k=Symbol.for("vaayvu.extensionStyle"),s=' +
          JSON.stringify(msg.css) +
          ';' +
          'if(document[k])document.adoptedStyleSheets=document.adoptedStyleSheets.filter(sheet=>sheet!==document[k]);' +
          'delete document[k];if(!s)return;const sheet=new CSSStyleSheet();sheet.replaceSync(s);' +
          'document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];document[k]=sheet})()';
        await contents.executeJavaScriptInIsolatedWorld(1002, [{ code }]);
        break;
      }
      case 'menuPreview': {
        if (!selected || tab.secret || tab.failure || !website(contents.getURL())) return;
        const url = contents.getURL();
        const image = await contents.capturePage();
        if (image.isEmpty() || this.tabs.get(id) !== tab || this.active !== id || contents.getURL() !== url)
          return;
        const { width, height } = image.getSize(),
          ratio = Math.min(1, 900 / Math.max(width, height));
        const bytes = image
          .resize({
            width: Math.max(1, Math.round(width * ratio)),
            height: Math.max(1, Math.round(height * ratio)),
          })
          .toJPEG(65);
        this.event('menuPreview', {
          id,
          requestId: msg.requestId,
          image: 'data:image/jpeg;base64,' + bytes.toString('base64'),
        });
        break;
      }
      case 'fullscreen':
        this.window.setFullScreen(!this.window.isFullScreen());
        break;
      case 'editPage':
        if (selected && ['cut', 'copy', 'paste', 'selectAll'].includes(msg.action)) contents[msg.action]();
        break;
      case 'copy':
        if (this.enabled && typeof msg.text === 'string' && msg.text.length <= 100000)
          clipboard.writeText(msg.text);
        break;
      case 'share': {
        if (!selected) return;
        const link = website(contents.getURL());
        if (!link) return;
        const answer = await dialog.showMessageBox(this.window, {
          type: 'info',
          message: 'Share page',
          detail: link.href,
          buttons: ['Copy link', 'Cancel'],
          cancelId: 1,
        });
        if (answer.response === 0 && this.enabled && this.tabs.get(id) === tab) clipboard.writeText(link.href);
        break;
      }
      case 'external':
        if (this.enabled && website(msg.url)) await shell.openExternal(msg.url);
        break;
      case 'print':
        if (selected)
          contents.print({}, (ok, reason) => {
            if (!ok && !/cancel/i.test(reason)) this.notice('The page could not be printed.');
          });
        break;
      case 'savePDF':
      case 'capture':
      case 'savePage': {
        if (!selected || tab.failure) return;
        const url = contents.getURL();
        const ext = { savePDF: 'pdf', capture: 'png', savePage: 'mhtml' }[msg.type];
        const result = await dialog.showSaveDialog(this.window, {
          title: 'Save page',
          defaultPath: 'Vaayvu page.' + ext,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (result.canceled || !this.enabled || this.tabs.get(id) !== tab || contents.getURL() !== url) return;
        if (msg.type === 'savePage') await contents.savePage(result.filePath, 'MHTML');
        else {
          const bytes =
            msg.type === 'savePDF'
              ? await contents.printToPDF({ printBackground: true })
              : (await contents.capturePage()).toPNG();
          if (this.tabs.get(id) === tab && contents.getURL() === url)
            await fs.promises.writeFile(result.filePath, bytes);
        }
        break;
      }
      case 'importBookmarks': {
        const result = await dialog.showOpenDialog(this.window, {
          title: 'Import bookmarks',
          properties: ['openFile'],
          filters: [{ name: 'Bookmarks HTML', extensions: ['html', 'htm'] }],
        });
        if (result.canceled || !result.filePaths.length) return;
        const file = await fs.promises.open(result.filePaths[0], 'r');
        try {
          const max = 2 * 1024 * 1024,
            stat = await file.stat();
          if (!stat.isFile() || stat.size > max) return this.notice('Choose a bookmarks HTML file under 2 MB.');
          const buffer = Buffer.alloc(max + 1),
            { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
          if (bytesRead <= max) this.event('bookmarkFile', { text: buffer.toString('utf8', 0, bytesRead) });
        } finally {
          await file.close();
        }
        break;
      }
      case 'exportBookmarks': {
        if (!this.enabled || typeof msg.text !== 'string' || Buffer.byteLength(msg.text) > 2 * 1024 * 1024) return;
        const result = await dialog.showSaveDialog(this.window, {
          title: 'Export bookmarks',
          defaultPath: 'Vaayvu bookmarks.html',
          filters: [{ name: 'Bookmarks HTML', extensions: ['html'] }],
        });
        if (!result.canceled && this.enabled) await fs.promises.writeFile(result.filePath, msg.text, 'utf8');
        break;
      }
      case 'protection':
        this.protect = msg.enabled !== false;
        this.custom = domains(msg.domains, 128);
        break;
      case 'blocklist':
        // VAAYVU's own engine. The message carries the full compiled VFD
        // policy (small by design: curated hosts, tokens, selectors), so the
        // main process matches without loading anything itself.
        this.adBlock = msg.enabled !== false;
        const lists = msg.lists && typeof msg.lists === 'object' ? msg.lists : {};
        this.adLists = {
          ads: lists.ads !== false,
          trackers: lists.trackers !== false,
          social: lists.social === true,
          cosmetic: lists.cosmetic !== false,
          aggressive: lists.aggressive === true,
        };
        const toHostSet = (list) => new Set(
          (Array.isArray(list) ? list : []).filter((s) => typeof s === 'string' && s.length <= 253).map((s) => s.toLowerCase()));
        const toTokens = (list) => (Array.isArray(list) ? list : [])
          .filter((s) => typeof s === 'string' && s.length >= 2 && s.length <= 64).map((s) => s.toLowerCase());
        this.vfdAds = toHostSet(msg.hostsAds);
        this.vfdTrackers = toHostSet(msg.hostsTrackers);
        this.vfdSocial = toHostSet(msg.hostsSocial);
        this.vfdPatterns = toTokens(msg.patterns);
        this.vfdTrackerPatterns = toTokens(msg.trackerPatterns);
        this.vfdFirstParty = toTokens(msg.firstPartyPatterns);
        this.vfdExceptions = Array.isArray(msg.exceptions) ? msg.exceptions.slice(0, 256) : [];
        this.vfdCSS = Array.isArray(msg.selectors) && msg.selectors.length && this.adLists.cosmetic
          ? msg.selectors.filter((s) => typeof s === 'string' && s && s.length <= 256 && !/:has\(/i.test(s)).join(',') + '{display:none !important}'
          : '';
        this.blocklist = new Set();
        this.strictBlocks = new Set();
        if (this.adBlock) {
          for (const host of domains(msg.strict, 8000)) this.strictBlocks.add(host);
        }
        this.pausedSites = domains(msg.pausedSites, 256);
        this.protectionStats.clear();
        for (const t of this.tabs.values()) this.applyAdShield(t);
        if (msg.reloadActive === true && this.active) {
          const activeTab = this.tabs.get(this.active);
          if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed() && website(activeTab.view.webContents.getURL() || activeTab.url)) {
            activeTab.view.webContents.reload();
          }
        }
        break;
      case 'contentSettings':
        this.requestedImages = !msg.blockImages;
        break;
      case 'requestDefaultBrowser':
        // Windows deep-links to Settings > Default apps. macOS and Linux have
        // no supported programmatic request, so the UI never offers it there.
        if (process.platform === 'win32') shell.openExternal('ms-settings:defaultapps').catch(() => {});
        break;
      case 'dnsSettings':
        // Windows deep-links straight to the DNS settings page.
        if (process.platform === 'win32') shell.openExternal('ms-settings:network-dns').catch(() => {});
        break;
      case 'liteYouTube':
        this.liteYouTube = msg.enabled === true;
        break;
      case 'youtubeDesktopOptimization':
        this.youtubeOptimize = msg.enabled !== false;
        break;
      case 'criticalWork':
        this.setLease(id, msg.active === true, msg.reason, msg.ttlMs);
        break;
      case 'lowMemoryBrowsing':
        this.lowMemory = msg.enabled !== false;
        break;
      case 'clearCookies':
        await this.regular.clearStorageData({ storages: ['cookies'] });
        break;
      case 'clearSiteData': {
        if (clearingSessions.has(this.regular)) return;
        clearingSessions.add(this.regular);
        const closed = new Map();
        try {
          for (const host of siteMembers.get(this.regular)) {
            const ids = [...host.tabs.values()].filter((t) => !t.secret).map((t) => t.id);
            closed.set(host, ids);
            for (const key of ids) host.closeTab(key);
          }
          await this.regular.clearData();
          await this.regular.clearCache();
        } finally {
          clearingSessions.delete(this.regular);
          for (const [host, ids] of closed) host.event('resetWebTabs', { ids });
        }
        break;
      }
      case 'indiaSearch':
        await this.search.start(id, msg.requestId, msg.q);
        break;
      case 'cancelIndiaSearch':
        if (typeof msg.requestId === 'string' && (!Object.hasOwn(msg, 'id') || id)) this.search.cancel(id, msg.requestId);
        break;
    }
  }
}
module.exports = { BrowserHost };
