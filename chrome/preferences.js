'use strict';

const VaayvuPreferences = (() => {
  const core = typeof VaayvuCore === 'undefined' ? require('./core.js') : VaayvuCore;
  const categories = {
    general: ['Startup and home', 'home', 'Choose what opens when you launch Vaayvu.'],
    search: ['Search and address bar', 'search', 'Private search, website access and local suggestions.'],
    appearance: ['Appearance', 'sun', 'Theme, wallpaper and browser layout.'],
    tabs: ['Tabs', 'tabs', 'Link behavior, tab search and organization.'],
    privacy: ['Privacy and security', 'shield', 'Tracking protection, history and site data.'],
    library: ['Bookmarks and downloads', 'bookmark', 'Saved pages, transfers and download history.'],
    sync: ['Sync and devices', 'devices', 'Vaayvu ID, device names and shared tabs.'],
    access: ['Accessibility', 'user', 'Text size, contrast, motion and page zoom.'],
    system: ['System and shortcuts', 'settings', 'System tools, profiles and keyboard commands.'],
  };
  const choices = {
    searchProvider: { duckduckgo: 'DuckDuckGo', google: 'Google', bing: 'Bing' },
    theme: { system: 'Follow device', light: 'Light', dark: 'Dark' },
    siteAppearance: { matchBrowser: 'Match browser theme', website: 'Let websites choose' },
    youtubeLayout: { desktop: 'Desktop', mobile: 'Mobile (uses less memory)' },
    wallpaper: { observatory: 'Observatory', ridge: 'Ridge', dusk: 'Dusk', paper: 'Paper', alpine: 'Alpine dusk', plain: 'Soft gradient' },
    sidebarMode: { on: 'On', auto: 'Auto-hide', off: 'Off' },
    tabPosition: { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' },
    startup: { restore: 'Continue where I left off', new: 'Open the start page', page: 'Open a specific page' },
    interfaceSize: { standard: 'Standard', large: 'Larger' },
    linkTabs: { foreground: 'Switch to the new tab', background: 'Keep the current tab active' },
    newTabPosition: { end: 'At the end', after: 'Beside the active tab' },
    adBlockLists: { recommended: 'Recommended', custom: 'Custom categories', all: 'All categories', adsTrackers: 'Ads & trackers only', minimal: 'Ads only', none: 'Off' },
    afterClose: { right: 'The tab to its right', left: 'The tab to its left', lastUsed: 'The last viewed tab' },
    defaultZoom: Object.fromEntries([50, 75, 90, 100, 110, 125, 150, 175, 200].map(n => [n, n + '%'])),
  };
  const defaults = {
    theme: globalThis.location?.href === 'vaayvu://browser/index.html' ? 'light' : 'dark',
    wallpaper: 'observatory', interfaceSize: 'standard', startup: 'restore',
    sidebarMode: 'on', linkTabs: 'foreground', newTabPosition: 'end', afterClose: 'right',
    defaultZoom: 100, tabPosition: 'top', horizontalTabs: true, pinTabSearch: true, bookmarkBar: false,
    reduceMotion: false, highContrast: false, protection: true, ordinaryWeb: true, searchProvider: 'duckduckgo', localSuggestions: true, rememberHistory: true,
    rememberDownloads: true, downloadNotices: true, showHomeButton: false,
    adBlockLists: 'adsTrackers', blockImages: false, blockPopups: true, stripTracking: true, youtubeLayout: 'desktop',
    lowMemoryBrowsing: false, youtubeDesktopOptimization: true, siteAppearance: 'matchBrowser',
  };
  const fields = [
    ['general', 'startup', 'When Vaayvu starts', 'Choose the first page or restore your regular tabs.'],
    ['general', 'startupURL', 'Startup website', 'Saving a website sets it as your startup page.'],
    ['general', 'showHomeButton', 'Show Home button', 'Add a Home button to the browser toolbar.'],
    ['general', 'homeURL', 'Home button destination', 'Leave this empty to open the Vaayvu start page.'],
    ['search', 'searchProvider', 'Web search engine', 'With ordinary websites enabled, submitting a search sends it to this provider. The provider may process it outside India. Suggestions while typing stay on this device.'],
    ['search', 'indiaSearch', 'Vaayvu India Search', 'Search the built-in website and topic directories. A configured India index can supply additional results.'],
    ['search', 'ordinaryWeb', 'Allow ordinary websites', 'On opens websites directly and uses your selected web search engine. Off uses on-device search and any configured India index, asks before opening a website, and pauses sync.'],
    ['search', 'localSuggestions', 'Suggest bookmarks and history', 'Show matches from this profile as you type in a regular tab.', 'regular'],
    ['appearance', 'theme', 'Color theme', 'Choose a light or dark browser interface.'],
    ['appearance', 'siteAppearance', 'Website appearance', 'Match websites to the browser’s light, dark, or device theme.'],
    ['appearance', 'wallpaper', 'Start page background', 'Choose the wallpaper behind your favorites.'],
    ['appearance', 'sidebarMode', 'Desktop sidebar', 'Keep the sidebar open, reveal it at the edge, or close it.', 'desktop'],
    ['appearance', 'tabPosition', 'Tab bar alignment', 'Choose the top, bottom, left or right edge of the window.', 'desktop'],
    ['tabs', 'pinTabSearch', 'Pin tab search', 'Show the tab search button in the toolbar.', 'desktop'],
    ['appearance', 'bookmarkBar', 'Show bookmarks bar', 'Keep saved pages below the address bar.', 'regular'],
    ['appearance', '@favorites', 'Edit start page favorites', 'Add or remove your favorite websites.'],
    ['tabs', 'linkTabs', 'Links that open new tabs', 'Choose whether link-created tabs open in front or in the background.'],
    ['tabs', 'newTabPosition', 'New tab position', 'Choose where a new tab appears in the tab list.'],
    ['tabs', 'afterClose', 'After closing the active tab', 'Choose which remaining tab to show.'],
    ['tabs', '@manageTabs', 'Manage tabs', 'Find, group, pin or close open tabs.'],
    ['tabs', '@closedList', 'Recently closed tabs', 'Reopen a regular tab from this window.'],
    ['tabs', '@performance', 'Tab activity', 'Review open tabs and their loading state.'],
    ['privacy', '@adBlockSettings', 'Rasha Shield', 'Rasha Shield blocks ads, trackers, popups and YouTube ads on every website. No filter lists are downloaded.', 'canProtect'],
    ['privacy', 'blockedDomains', 'Custom blocked domains', 'Enter one domain per line to always block. Subdomains are blocked too.', 'adBlockCat'],
    ['privacy', 'stripTracking', 'Strip tracking parameters', 'Remove campaign and click IDs from links you open from the address bar.', 'adBlockCat'],
    ['privacy', 'youtubeLayout', 'YouTube layout', 'Use the full desktop layout. Choose mobile only when lower YouTube memory use is more important than the desktop view.', 'canLiteYouTube'],
    ['privacy', 'lowMemoryBrowsing', 'Low-memory browsing', 'Block web fonts on every website to reduce memory use while keeping website images available.', 'canLowMemoryBrowsing'],
    ['privacy', 'youtubeDesktopOptimization', 'Optimize desktop YouTube', 'Reduce offscreen YouTube rendering while keeping the desktop layout, video quality, and images.', 'canLiteYouTube'],
    ['privacy', 'rememberHistory', 'Record browsing history', 'Keep new visits from regular tabs in History. Previously recorded visits remain until cleared.', 'regular'],
    ['privacy', '@clearData', 'Delete browsing data', 'Choose which history, download records or website data to remove.'],
    ['privacy', '@clearCookies', 'Clear cookies', 'Remove all cookies and site data for this profile.'],
    ['privacy', '@privateTab', 'Open a private tab', 'Browse in a temporary website session.'],
    ['privacy', 'blockImages', 'Block images', 'Prevent websites from loading images.', 'canBlockImages'],
    ['privacy', 'blockPopups', 'Block pop-up windows', 'Prevent websites from opening new windows.'],
    ['library', '@bookmarks', 'Bookmark manager', 'Find and remove saved pages.'],
    ['library', '@bookmarkImport', 'Import bookmarks', 'Import bookmarks from a browser bookmark file.'],
    ['library', '@bookmarkExport', 'Export bookmarks', 'Save bookmarks to a file.'],
    ['library', '@reading', 'Reading list', 'Return to pages saved for later.'],
    ['library', 'rememberDownloads', 'Keep download history', 'List new regular downloads in Vaayvu. This setting affects records only.', 'regular'],
    ['library', 'downloadNotices', 'Show download notices', 'Display an in-app notice when a regular download finishes.'],
    ['library', '@downloads', 'Downloads', 'Review files recorded by this browser profile.'],
    ['sync', 'name', 'Device name', 'Identify this device in Vaayvu Sync and when sending a page.', 'regular'],
    ['sync', '@account', 'Vaayvu ID and sync', 'Connect to your sync server or manage this session.'],
    ['sync', '@devices', 'Other devices', 'Continue a regular tab or open a page sent to this device.'],
    ['access', 'interfaceSize', 'Browser interface text', 'Choose the text size used in Vaayvu controls.'],
    ['access', 'defaultZoom', 'Default page zoom', 'Set the scale for web pages without an individual tab override.', 'canZoom'],
    ['access', 'highContrast', 'Increase interface contrast', 'Make text, borders and keyboard focus easier to distinguish.'],
    ['access', 'reduceMotion', 'Reduce interface animations', 'Minimize transitions. Vaayvu also follows your device’s reduced-motion preference.'],
    ['system', '@requestDefaultBrowser', 'Set Vaayvu as default browser', 'Choose which browser opens website links on this device.'],
    ['system', '@extensions', 'Extensions', 'Install and manage extensions for websites.'],
    ['system', '@systemPasswords', 'System password manager', 'Open your device’s credential settings.'],
    ['system', '@systemVPN', 'System VPN settings', 'Open the VPN settings provided by your operating system.'],
    ['system', '@sitePermissions', 'Site permissions', 'Review camera, microphone and location access granted to websites.'],
    ['system', '@profiles', 'Browser profiles', 'Switch to a separate browsing profile or open a guest window.'],
    ['system', '@quick', 'Quick commands', 'Search for a browser command and run it.'],
    ['system', '@help', 'Help and keyboard shortcuts', 'Read the shortcuts available in Vaayvu.'],
  ];
  const escape = core.escapeHTML;
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const searchTerms = {
    localSuggestions: 'autocomplete suggestions omnibox', sidebarMode: 'vertical tabs sidebar',
    bookmarkBar: 'favorites bookmarks toolbar', blockedDomains: 'blocking filters blocklist tracking hosts',
    protection: 'tracking blocker shields', linkTabs: 'popup foreground background', youtubeLayout: 'memory ram video youtube desktop mobile player',
    lowMemoryBrowsing: 'memory ram low fonts lightweight websites', youtubeDesktopOptimization: 'youtube desktop memory ram 1440p 2160p video',
    siteAppearance: 'website page dark light system theme color',
    interfaceSize: 'font text size', reduceMotion: 'reduced motion animations',
    rememberHistory: 'save remember browsing activity', startup: 'relaunch restore session',
    '@systemPasswords': 'passkeys autofill credentials', '@extensions': 'add-ons addons plugins',
  };

  function domain(value) {
    if (!/^[a-z0-9.-]+$/i.test(value)) return '';
    const s = value.toLowerCase();
    if (s.length > 253 || !s.includes('.') || !/[a-z]/.test(s.split('.').pop())) return '';
    if (!s.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) return '';
    try { return new URL('https://' + s).hostname === s ? s : ''; } catch { return ''; }
  }

  function parseDomains(input, limit = 128) {
    const set = new Set();
    for (const entry of String(input).trim().split(/[\s,]+/).filter(Boolean)) {
      const host = domain(entry);
      if (!host) throw Error('Enter a DNS name without a URL, wildcard or IP address. Check “' + entry.slice(0, 80) + '”.');
      set.add(host);
      if (set.size > limit) throw Error('Use up to ' + limit + ' unique domains.');
    }
    return [...set];
  }

  function normalize(raw, legacyClosed = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    const result = { ...raw };
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = raw[key];
      if (typeof fallback === 'boolean') result[key] = typeof value === 'boolean' ? value : fallback;
      else if (choices[key] && ['string', 'number'].includes(typeof value) && has(choices[key], value))
        result[key] = key === 'defaultZoom' ? Number(value) : value;
      else result[key] = key === 'sidebarMode' && legacyClosed === true ? 'off' : fallback;
    }
    if (!has(choices.tabPosition, raw.tabPosition) && typeof raw.horizontalTabs === 'boolean')
      result.tabPosition = raw.horizontalTabs ? 'top' : 'left';
    result.horizontalTabs = result.tabPosition === 'top' || result.tabPosition === 'bottom';
    for (const key of ['homeURL', 'startupURL'])
      result[key] = typeof raw[key] === 'string' ? core.webURL(raw[key].trim()) : '';
    // Retain only a recognition pattern for old search URLs in saved and synced tabs.
    result.legacySearchTemplate = core.legacyTemplate(raw.legacySearchTemplate || raw.customSearchURL);
    delete result.engine;
    delete result.customSearchURL;
    if (result.startup === 'page' && !result.startupURL) result.startup = 'new';
    result.name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
    result.blockedDomains = Array.isArray(raw.blockedDomains)
      ? [...new Set(raw.blockedDomains.filter(x => typeof x === 'string').map(x => domain(x.trim())).filter(Boolean))].slice(0, 128)
      : [];
    return result;
  }

  function matchingFields(query, visible = fields) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return visible.filter(([category, key, label, description]) => {
      const text = [categories[category][0], label, description, searchTerms[key] || '', ...Object.values(choices[key] || {})].join(' ').toLowerCase();
      return words.every(word => text.includes(word));
    });
  }

  function visibleFields() {
    const commands = browserCommands();
    return fields.filter(([, key, , , gate]) => {
      if (gate === 'regular' && windowInfo.private) return false;
      if (gate === 'desktop' && (narrowLayout.matches || platform === 'ios' || platform === 'android')) return false;
      if (gate && !['regular', 'desktop', 'adBlockCat'].includes(gate) && !capabilities[gate]) return false;
      if (key.startsWith('@')) {
        const action = commands[key.slice(1)];
        return !!action && action[2] !== false;
      }
      return true;
    });
  }

  let section = 'home';
  function navButton(id, card = false) {
    const [label, symbol, hint] = categories[id];
    return '<button type="button" data-act="pref-' + id + '" class="' + (card ? 'prefs-card' : 'prefs-nav-item') +
      '" ' + (id === section ? 'aria-current="page"' : '') + '>' + icon(symbol) +
      '<span><strong>' + escape(label) + '</strong>' + (card ? '<small>' + escape(hint) + '</small>' : '') +
      '</span>' + (card ? icon('forward') : '') + '</button>';
  }

  function row(field) {
    const [, key, label, hint] = field;
    const id = 'preference-' + key.replace('@', '');
    const labelText = '<label for="' + id + '">' + escape(label) + '</label>';
    const desc = '<small id="' + id + '-hint">' + escape(hint) + '</small>';
    if (key === 'indiaSearch')
      return '<div class="prefs-row" id="' + id + '" tabindex="-1"><div><strong>' + escape(label) +
        '</strong>' + desc + '<small>' + (capabilities.canIndiaSearch ? 'Regional service configured.' : 'On-device search is available. No regional server is configured.') +
        '</small></div>' + icon('shield') + '</div>';
    if (key.startsWith('@')) {
      const action = key.slice(1);
      const [, symbol, , enabled = true] = browserCommands()[action];
      return '<button id="' + id + '" class="prefs-action" type="button" data-act="' + action + '" ' + (enabled ? '' : 'disabled') + '>' +
        icon(symbol) + '<span><strong>' + escape(label) + '</strong>' + desc + '</span>' + icon('forward') + '</button>';
    }
    const attr = 'id="' + id + '" data-pref="' + key + '" aria-describedby="' + id + '-hint"';
    if (choices[key]) {
      const options = Object.entries(choices[key]).map(([value, caption]) =>
        '<option value="' + escape(value) + '"' + (String(settings[key]) === value ? ' selected' : '') + '>' + escape(caption) + '</option>').join('');
      return '<div class="prefs-row"><div>' + labelText + desc + '</div><select ' + attr + '>' + options + '</select></div>';
    }
    if (typeof defaults[key] === 'boolean') {
      return '<div class="prefs-row"><div>' + labelText + desc + '</div><input type="checkbox" role="switch" ' + attr +
        (settings[key] ? ' checked' : '') + '></div>';
    }
    const value = key === 'blockedDomains' ? (adBlock ? adBlockConfig.custom : settings.blockedDomains).join('\n') : settings[key] || '';
    const textAttr = 'id="' + id + '" name="value" aria-describedby="' + id + '-hint" spellcheck="false"';
    const placeholders = { startupURL: 'https://example.com', homeURL: 'Vaayvu start page', name: syncDeviceName(),
      blockedDomains: 'tracker.example.org' };
    const input = key === 'blockedDomains'
      ? '<textarea ' + textAttr + ' rows="4" maxlength="32768" placeholder="' + placeholders[key] + '">' + escape(value) + '</textarea>'
      : '<input type="text" ' + textAttr + (['startupURL','homeURL'].includes(key) ? ' inputmode="url" autocapitalize="none"' : '') +
        ' maxlength="' + (key === 'name' ? 80 : 8192) + '" placeholder="' + escape(placeholders[key]) + '" value="' + escape(value) + '">';
    return '<form class="prefs-editor" data-pref-form="' + key + '" novalidate>' + labelText + desc +
      '<div class="prefs-entry">' + input + '<button class="prefs-save" type="submit" aria-label="Save ' + escape(label) +
      '">Save</button></div><span class="prefs-message" role="status"></span></form>';
  }

  function paint(query = '') {
    const visible = visibleFields(), ids = Object.keys(categories).filter(id => visible.some(f => f[0] === id));
    const pane = document.querySelector('#prefs-content');
    if (!pane) return;
    if (query.trim()) {
      const matches = matchingFields(query, visible);
      pane.innerHTML = '<div class="prefs-results"><p class="prefs-count" role="status">' + matches.length +
        (matches.length === 1 ? ' matching setting' : ' matching settings') + '</p>' +
        matches.map(([category, key, label]) => '<button type="button" class="prefs-match" data-pref-jump="' + key + '">' +
          icon(categories[category][1]) + '<span><strong>' + escape(label) + '</strong><small>' + escape(categories[category][0]) +
          '</small></span>' + icon('forward') + '</button>').join('') +
        (matches.length ? '' : '<p>Try a shorter search, such as “tabs” or “zoom”.</p>') + '</div>';
    } else if (!ids.includes(section)) {
      pane.innerHTML = '<nav class="prefs-cards" aria-label="Settings categories">' + ids.map(k => navButton(k, true)).join('') + '</nav>';
    } else {
      pane.innerHTML = '<div class="prefs-columns"><nav class="prefs-nav" aria-label="Settings categories"><button type="button" ' +
        'class="prefs-nav-home" data-act="pref-home">' + icon('back') + 'All settings</button>' + ids.map(k => navButton(k)).join('') +
        '</nav><section class="prefs-section" aria-labelledby="prefs-section-title"><button type="button" class="prefs-mobile-back" ' +
        'data-act="pref-home">' + icon('back') + 'All settings</button><h3 tabindex="-1" id="prefs-section-title">' +
        escape(categories[section][0]) + '</h3>' + visible.filter(f => f[0] === section).map(row).join('') + '</section></div>';
    }
  }

  function open(next = 'home', key = '') {
    section = has(categories, next) ? next : 'home';
    dialog('Settings', '<div class="prefs-search">' + icon('search') +
      '<input type="search" id="settings-filter" aria-label="Search settings" aria-controls="prefs-content" ' +
      'placeholder="Search settings" autocomplete="off" spellcheck="false"></div><div id="prefs-content"></div>', 'settings');
    document.querySelector('#dialog').dataset.layout = 'settings';
    paint();
    const target = key ? document.getElementById('preference-' + key.replace('@','')) : document.getElementById('prefs-section-title');
    if (target) target.focus();
    else if (!narrowLayout.matches) document.querySelector('#settings-filter').focus();
  }

  function commit(patch) {
    if (['left', 'right'].includes(patch.tabPosition) && !has(patch, 'sidebarMode'))
      patch = { ...patch, sidebarMode: 'on' };
    settings = normalize({ ...read('settings', settings), ...patch }, read('sidebarClosed', false));
    if (has(patch, 'sidebarMode')) {
      sidebarClosed = settings.sidebarMode !== 'on';
      autoRevealed = false;
      write('sidebarClosed', sidebarClosed);
    }
    if (has(patch, 'ordinaryWeb')) updateWebsiteAccess();
    if (has(patch, 'blockedDomains') && adBlock) saveAdDomains(patch.blockedDomains);
    if (has(patch, 'protection') || has(patch, 'blockedDomains')) { sendProtection(); sendBlocklist(); }
    if (has(patch, 'youtubeLayout')) sendLiteYouTube();
    if (has(patch, 'lowMemoryBrowsing')) sendLowMemoryBrowsing();
    if (has(patch, 'youtubeDesktopOptimization')) sendYouTubeDesktopOptimization();
    if (has(patch, 'theme') || has(patch, 'siteAppearance')) {
      applyTheme();
      applySiteAppearance(current(), true);
    }
    if (has(patch, 'defaultZoom') && capabilities.canZoom) {
      for (const t of tabs) if (!t.zoom && mounted.has(t.id)) send({ type: 'zoom', id: t.id, percent: settings.defaultZoom });
    }
    if (has(patch, 'blockImages') || has(patch, 'blockPopups')) {
      send({ type: 'contentSettings', blockImages: settings.blockImages, blockPopups: settings.blockPopups });
    }
    storeSettings();
    if (has(patch, 'name')) queueSync(0);
  }

  // Safe mode (s-019) resets the browser settings to the same defaults a new
  // profile uses. Bookmarks, history and saved passwords are deliberately not
  // touched; those have their own delete actions.
  function reset() {
    settings = normalize({}, false);
    try {
      if (typeof write === 'function') {
        write('settings', settings);
        write('sidebarClosed', false);
      }
    } catch (error) {}
    try {
      if (typeof updateWebsiteAccess === 'function') updateWebsiteAccess();
      if (typeof applyTheme === 'function') applyTheme();
      if (typeof applySiteAppearance === 'function') applySiteAppearance(current(), true);
      if (typeof sendProtection === 'function') sendProtection();
      if (typeof sendBlocklist === 'function') sendBlocklist();
      if (typeof sendLiteYouTube === 'function') sendLiteYouTube();
      if (typeof sendLowMemoryBrowsing === 'function') sendLowMemoryBrowsing();
      if (typeof sendYouTubeDesktopOptimization === 'function') sendYouTubeDesktopOptimization();
      if (typeof send === 'function') {
        send({
          type: 'contentSettings',
          blockImages: settings.blockImages,
          blockPopups: settings.blockPopups,
        });
      }
      if (typeof storeSettings === 'function') storeSettings();
    } catch (error) {}
    return settings;
  }

  function refreshControls(values) {
    const pane = document.getElementById('prefs-content');
    if (!pane) return;
    for (const control of pane.querySelectorAll('[data-pref]')) {
      const value = values[control.dataset.pref];
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
    }
    for (const form of pane.querySelectorAll('form[data-pref-form]:not([data-dirty])')) {
      const key = form.dataset.prefForm;
      const value = key === 'blockedDomains' && adBlock ? adBlockConfig.custom : values[key];
      form.elements.namedItem('value').value = Array.isArray(value) ? value.join('\n') : value;
    }
  }

  function editorPatch(key, value) {
    const raw = String(value).trim();
    if (key === 'name') {
      if (raw.length > 80) throw Error('Use up to 80 characters.');
      return { name: raw };
    }
    if (key === 'blockedDomains') return { blockedDomains: parseDomains(raw, 512) };
    if (key === 'homeURL' || key === 'startupURL') {
      const url = raw && core.webURL(raw);
      if (!url && (raw || key === 'startupURL')) throw Error('Enter a full HTTP or HTTPS website address without sign-in details.');
      return key === 'homeURL' ? { homeURL: url } : { startup: 'page', startupURL: url };
    }
    throw Error('Unknown setting.');
  }

  if (typeof document !== 'undefined') {
    window.addEventListener('storage', ev => {
      if (ev.key === 'vaayvu.settings')
        refreshControls(normalize(read('settings', {}), read('sidebarClosed', false)));
    });
    document.addEventListener('DOMContentLoaded', () => {
      narrowLayout.addEventListener('change', () => {
        const search = document.getElementById('settings-filter');
        if (search) paint(search.value);
      });
    }, { once: true });
    document.addEventListener('input', ev => {
      if (ev.target.id === 'settings-filter') paint(ev.target.value);
      const form = ev.target.closest('form[data-pref-form]');
      if (form) {
        form.dataset.dirty = '';
        form.querySelector('.prefs-message').textContent = '';
        ev.target.removeAttribute('aria-invalid');
      }
    });
    document.addEventListener('click', ev => {
      const jump = ev.target.closest('[data-pref-jump]');
      if (!jump) return;
      const field = visibleFields().find(f => f[1] === jump.dataset.prefJump);
      if (field) open(field[0], field[1]);
    });
    document.addEventListener('keydown', ev => {
      if (ev.target.id === 'settings-filter' && ['Enter', 'ArrowDown'].includes(ev.key)) {
        const first = document.querySelector('[data-pref-jump]');
        if (first) { ev.preventDefault(); ev.key === 'Enter' ? first.click() : first.focus(); }
      }
    });
    document.addEventListener('change', ev => {
      const el = ev.target;
      if (!el.matches('#prefs-content [data-pref]')) return;
      const key = el.dataset.pref;
      if (!visibleFields().some(f => f[1] === key)) return;
      if (key === 'startup' && el.value === 'page' && !settings.startupURL) {
        el.value = settings[key];
        const input = document.getElementById('preference-startupURL');
        input.closest('form').querySelector('.prefs-message').textContent = 'Enter an address and select Save to use it.';
        input.focus();
        return;
      }
      if (choices[key] && has(choices[key], el.value)) commit({ [key]: el.value });
      else if (typeof defaults[key] === 'boolean') commit({ [key]: el.checked });
    });
    document.addEventListener('submit', ev => {
      const form = ev.target;
      if (!form.matches('form[data-pref-form]')) return;
      ev.preventDefault();
      const key = form.dataset.prefForm;
      if (!visibleFields().some(f => f[1] === key)) return;
      const input = form.elements.namedItem('value'), message = form.querySelector('.prefs-message');
      try {
        const patch = editorPatch(key, input.value);
        commit(patch);
        delete form.dataset.dirty;
        refreshControls(settings);
        input.removeAttribute('aria-invalid');
        message.textContent = 'Saved.';
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        message.textContent = error.message;
        input.focus();
      }
    });
  }
  return { positions: choices.tabPosition, providerName: key => choices.searchProvider[key], normalize, parseDomains, editorPatch, matchingFields, open, commit, reset };
})();
if (typeof module !== 'undefined') module.exports = VaayvuPreferences;
