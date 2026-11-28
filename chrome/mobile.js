'use strict';

let phoneCompact = false;
let phoneReading = '';
let speechRequest = null;
let reportRequest = null;

let folderID = '';
let libraryPane = 'saved';
let libraryFilter = '';
let nativeAppearance = '';

function recentPages() {
  if (current().private || windowInfo.private || !settings.localSuggestions || !settings.rememberHistory)
    return [];
  const seen = new Set();
  return historyItems
    .filter((item) => {
      const url = webURL(item.url);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 6);
}

function phoneTile(item) {
  return (
    '<button class="phone-tile" data-url="' +
    e(item.url) +
    '">' +
    mark(item) +
    '<strong>' +
    e(item.title || hostOf(item.url)) +
    '</strong></button>'
  );
}

function visitAge(at) {
  if (!Number.isFinite(at) || at <= 0) return '';
  const days = Math.max(0, Math.floor((Date.now() - at) / 86400000));
  return days === 0
    ? 'Today'
    : new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-days, 'day');
}
function phoneCards(items) {
  return (
    '<div class="phone-cards">' +
    items
      .map(
        (item) =>
          '<button data-url="' +
          e(item.url) +
          '">' +
          mark(item) +
          '<strong>' +
          e(item.title || hostOf(item.url)) +
          '</strong><small>' +
          e(hostOf(item.url)) +
          '</small>' +
          (item.at ? '<small>' + e(visitAge(item.at)) + '</small>' : '') +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}

function setPhoneCompact(value) {
  const collapsed =
    !!value &&
    narrowLayout.matches &&
    view === 'web' &&
    !current()?.error &&
    !drawer &&
    !$('#dialog').open &&
    $('#findbar').hidden &&
    $('#address-matches').hidden &&
    document.activeElement !== $('#address');
  if (phoneCompact === collapsed) return;
  phoneCompact = collapsed;
  document.body.classList.toggle('phone-compact', collapsed);
  $('#compact-site').hidden = !collapsed;
  $('#compact-site').innerHTML =
    icon('sliders') + '<strong>' + e(hostOf(current().url)) + '</strong>' + icon('down');
  rectUpdate(true);
}

function drawPhoneBar() {
  if (!narrowLayout.matches || view !== 'web' || current()?.error) setPhoneCompact(false);
  const live = view === 'web' && !!webURL(current()?.url) && !current()?.error;
  $('#mobilebar [data-act="share"]').disabled = !live;
  $('#phone-reload').hidden = !live;
  $('#phone-reload').innerHTML = icon(current().loading ? 'x' : 'reload');
  $('#phone-reload').setAttribute('aria-label', current().loading ? 'Stop loading page' : 'Reload page');
  $('#phone-mic').hidden = true;
  document.body.classList.toggle('phone-on-page', live);
  $('#toolbar [data-act="pageActions"]').disabled = !live;
  $('#compact-site strong')?.replaceChildren(document.createTextNode(hostOf(current()?.url)));
}

function syncPhoneAppearance() {
  if (!narrowLayout.matches || !nativeReady || !['ios','android'].includes(platform)) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const overview = modal === 'tabOverview';
  const background = overview ? '#202337' : dark ? '#1d1d1f' : '#f6f6fa';
  if (background === nativeAppearance) return;
  nativeAppearance = background;
  send({ type: 'mobileAppearance', background, lightContent: overview || dark });
}

function resetPhonePage() {
  setPhoneCompact(false);
  speechRequest = null;
  if (phoneReading === activeId) phoneReading = '';
  if (
    [
      'phonePage',
      'phonePageEdit',
      'phoneSite',
      'phoneZoom',
      'phoneReminder',
      'phoneNote',
      'phoneSpeech',
      'phoneReport',
      'phoneIssue',
    ].includes(modal)
  )
    closeDialog();
}

function phoneSheet(title, body, key) {
  dialog(title, body, key);
  $('#dialog').dataset.layout = 'phoneSheet';
}

function phoneRow(action, label, symbol, detail = '') {
  return (
    '<button class="phone-action" data-act="' +
    e(action) +
    '">' +
    icon(symbol) +
    '<span>' +
    e(label) +
    (detail ? '<small>' + e(detail) + '</small>' : '') +
    '</span>' +
    icon('forward') +
    '</button>'
  );
}

function pageToolsCatalog() {
  const t = current();
  const regular = !t.private && !windowInfo.private;
  const commands = browserCommands();
  const catalog = {
    find: ['Find on page', 'search'],
    reader: ['Reader', 'book'],
    phoneZoom: ['Page zoom', 'expand', capabilities.canZoom],
    phoneListen: [
      phoneReading === activeId ? 'Stop listening' : 'Listen to page',
      'audio',
      capabilities.canReadAloud,
    ],
    phoneSave: ['Save bookmark', 'bookmark', regular],
    readLater: ['Add to reading list', 'clock', regular],
    phoneFavorite: ['Add to favorites', 'star', regular],
    phoneNote: ['Page note', 'edit', regular],
    phoneReminder: ['Remind me', 'clock', regular && capabilities.canPageReminder],
    share: ['Share page', 'share', native],
    phoneDisplayPick: ['Hide a distracting item', 'eye', capabilities.canPageDisplay],
    phoneDisplayUndo: ['Restore hidden items', 'eye', capabilities.canPageDisplay],
    phoneDisplayDark: [
      t.phoneDark ? 'Restore page colors' : 'Darken this page',
      'sun',
      capabilities.canPageDisplay,
    ],
    phoneReport: ['Privacy and connection', 'shield'],
    inspect: ['Inspect page', 'search', !!commands.inspect[2]],
    desktopSite: [
      t.desktopSite ? 'Request mobile site' : 'Request desktop site',
      'devices',
      capabilities.canDesktopSite,
    ],
    phoneSite: ['Website settings', 'sliders'],
    extensions: ['Manage extensions', 'layers', commands.extensions[2]],
    tabOverview: ['Tab overview', 'tabs'],
    pinTab: [t.pinned ? 'Unpin tab' : 'Pin tab', 'pin'],
    groupTab: ['Move to tab group', 'layers', regular],
    tools: ['Ask about this page', 'spark', regular],
    phoneCollapse: ['Hide toolbars', 'panel'],
    phoneIssue: ['Report a website issue', 'link'],
  };
  return Object.fromEntries(Object.entries(catalog).filter(([, a]) => a.length < 3 || !!a[2]));
}

const defaultPhoneActions = ['find', 'reader', 'phoneListen', 'phoneSave', 'share', 'phoneReport'];
function phonePageActions(edit = false) {
  if (view !== 'web' || !webURL(current().url) || current().error) return;
  const catalog = pageToolsCatalog();
  const stored = read('phoneActions', { pins: defaultPhoneActions }).pins;
  const pins = [...new Set(Array.isArray(stored) ? stored : defaultPhoneActions)].filter((k) =>
    Object.hasOwn(catalog, k),
  );
  if (edit) {
    const keys = [...pins, ...Object.keys(catalog).filter((k) => !pins.includes(k))];
    phoneSheet(
      'Customize page actions',
      '<p class="dialognote">Choose the shortcuts shown first. Use the arrows to set their order.</p><div class="phone-action-list">' +
        keys
          .map(
            (k, i) =>
              '<div class="phone-pin-row"><label><input type="checkbox" data-phone-pin="' +
              k +
              '"' +
              (pins.includes(k) ? ' checked' : '') +
              '>' +
              e(catalog[k][0]) +
              '</label>' +
              (pins.includes(k)
                ? '<button class="icon" data-phone-up="' +
                  k +
                  '" aria-label="Move ' +
                  e(catalog[k][0]) +
                  ' earlier"' +
                  (i === 0 ? ' disabled' : '') +
                  '>' +
                  icon('up') +
                  '</button>'
                : '') +
              '</div>',
          )
          .join('') +
        '</div>' +
        actButton('pageActions', 'Done', 'check', 'primary'),
      'phonePageEdit',
    );
    return;
  }
  const rows = (keys) => keys.map((k) => phoneRow(k, ...catalog[k].slice(0, 2))).join('');
  const others = Object.keys(catalog).filter((k) => !pins.includes(k));
  phoneSheet(
    'Page actions',
    '<div class="phone-origin">' +
      mark(current()) +
      '<div><strong>' +
      e(hostOf(current().url)) +
      '</strong><small>' +
      e(current().title) +
      '</small></div></div>' +
      (pins.length
        ? '<div class="phone-primary-actions">' +
          pins.map((k) => actButton(k, catalog[k][0], catalog[k][1])).join('') +
          '</div>'
        : '') +
      '<div class="phone-action-list">' +
      rows(others) +
      phoneRow('phonePageEdit', 'Customize page actions', 'sliders') +
      '</div>',
    'phonePage',
  );
}

function updatePhonePins(k, checked) {
  if (!Object.hasOwn(pageToolsCatalog(), k)) return;
  const raw = read('phoneActions', { pins: defaultPhoneActions }).pins;
  const pins = [
    ...new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : defaultPhoneActions),
  ];
  const i = pins.indexOf(k);
  if (checked === undefined && i > 0) [pins[i - 1], pins[i]] = [pins[i], pins[i - 1]];
  else if (checked === true && i < 0) pins.push(k);
  else if (checked === false && i >= 0) pins.splice(i, 1);
  write('phoneActions', { pins });
  phonePageActions(true);
  const control = [...$('#dialog').querySelectorAll('[data-phone-pin]')].find(
    (b) => b.dataset.phonePin === k,
  );
  control?.focus();
}

function libraryKey(name) {
  return 'phone.' + name + '.' + sync.profileKey;
}
function bookmarkFolders() {
  return read(libraryKey('folders'), []).filter((f) => typeof f.name === 'string' && Array.isArray(f.items));
}
function librarySection(pane, id = '') {
  const previous = $('#dialog[open] .segment-lens')?.getBoundingClientRect().left;
  folderID = id;
  libraryPane = pane;
  libraryFilter = '';
  phoneLibrary();
  const lens = $('.segment-lens');
  if (previous !== undefined && lens && !document.body.classList.contains('reduce-motion') &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const dx = previous - lens.getBoundingClientRect().left;
    if (dx) lens.animate([
      { transform: 'translateX(' + dx + 'px)' },
      { transform: 'translateX(' + dx * .35 + 'px) scale(1.09,.94)', offset: .4 },
      { transform: 'none' },
    ], { duration: 280, easing: 'cubic-bezier(.2,.75,.28,1)' });
  }
}
function libraryMatches(item) {
  return (String(item.title || '') + ' ' + item.url).toLowerCase().includes(libraryFilter.toLowerCase());
}
function bookmarkTopics(items) {
  const counts = new Map();
  const stop = new Set([
    'about',
    'after',
    'before',
    'from',
    'guide',
    'home',
    'official',
    'online',
    'page',
    'site',
    'that',
    'this',
    'with',
    'website',
  ]);
  for (const item of items) {
    const words =
      String(item.title || '')
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]{4,30}/gu) || [];
    for (const word of new Set(words)) {
      if (!stop.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
}

function phoneLibraryRows() {
  const folders = bookmarkFolders();
  const folder = folders.find((f) => f.id === folderID);
  const items =
    libraryPane === 'history'
      ? historyItems
      : libraryPane === 'reading'
        ? read('reading', [])
        : saved()
            .filter((b) => !folder || folder.items.includes(b.id))
            .sort((a, b) => b.updatedAt - a.updatedAt);
  const filtered = items.filter(libraryMatches);
  let html = '';
  if (libraryPane === 'saved' && !folder && !libraryFilter) {
    const topics = bookmarkTopics(items);
    if (topics.length)
      html +=
        '<div class="rowhead"><h3>Topics</h3></div><div class="phone-topics">' +
        topics
          .map(
            ([word, count]) =>
              '<button data-phone-topic="' +
              e(word) +
              '">' +
              e(word) +
              ' <small>' +
              count +
              '</small></button>',
          )
          .join('') +
        '</div>';
    html +=
      '<div class="rowhead"><h3>Folders on this device</h3>' +
      actButton('phoneFolder', 'New folder', 'plus', 'linkbtn') +
      '</div><div class="phone-folder-list">' +
      folders
        .map(
          (f) =>
            '<button data-phone-folder="' +
            e(f.id) +
            '">' +
            icon('folder') +
            '<span>' +
            e(f.name) +
            '</span><small>' +
            items.filter((b) => f.items.includes(b.id)).length +
            '</small>' +
            icon('forward') +
            '</button>',
        )
        .join('') +
      '</div><div class="rowhead"><h3>Recently saved</h3>' +
      actButton('addBookmark', 'Add bookmark', 'plus', 'linkbtn') +
      '</div>';
  }
  if (folder)
    html +=
      '<div class="rowhead">' +
      actButton('mobileLibrary', 'All bookmarks', 'back', 'linkbtn') +
      actButton('phoneFolderEdit', 'Edit folder', 'edit', 'linkbtn') +
      '</div>';
  if (!filtered.length)
    return (
      html +
      emptyState(
        'book',
        libraryFilter ? 'No matches' : 'Nothing saved here yet',
        libraryFilter
          ? 'Try another title or website.'
          : libraryPane === 'history'
            ? 'Visits in regular tabs appear here.'
            : 'Save a page using Page actions.',
      )
    );
  return (
    html +
    '<div class="phone-entry-list">' +
    filtered
      .map(
        (item) =>
          '<div><button data-url="' +
          e(item.url) +
          '">' +
          mark(item) +
          '<span><strong>' +
          e(item.title || hostOf(item.url)) +
          '</strong><small>' +
          e(hostOf(item.url)) +
          '</small></span></button>' +
          (libraryPane === 'saved'
            ? '<button class="icon" data-file-bookmark="' +
              e(item.id) +
              '" aria-label="Organize ' +
              e(item.title) +
              '">' +
              icon('more') +
              '</button>'
            : '<button class="icon" data-forget-phone="' +
              e(item.url) +
              '" aria-label="Remove ' +
              e(item.title || hostOf(item.url)) +
              '">' +
              icon('x') +
              '</button>') +
          '</div>',
      )
      .join('') +
    '</div>'
  );
}

function phoneLibrary() {
  if (current().private || windowInfo.private) {
    phoneSheet(
      'Library',
      emptyState('private', 'Private browsing', 'Switch to a regular tab to open your personal library.'),
      'phoneLibrary',
    );
    return;
  }
  const folder = bookmarkFolders().find((f) => f.id === folderID);
  phoneSheet(
    folder?.name || 'Library',
    '<nav class="phone-segments" aria-label="Library sections">' +
      [
        ['saved', 'Bookmarks'],
        ['reading', 'Reading list'],
        ['history', 'History'],
      ]
        .map(
          ([k, label]) =>
            '<button data-library-pane="' +
            k +
            '" aria-pressed="' +
            (libraryPane === k) +
            '">' + (libraryPane === k ? '<span class="segment-lens" aria-hidden="true"></span>' : '') +
            label +
            '</button>',
        )
        .join('') +
      '</nav><input class="searchlist" id="phone-library-search" type="search" aria-label="Search library" placeholder="Search ' +
      e(folder?.name || 'this section') +
      '" value="' +
      e(libraryFilter) +
      '"><div id="phone-library-rows">' +
      phoneLibraryRows() +
      '</div>',
    'phoneLibrary',
  );
}
function editPhoneFolder(edit) {
  const f = edit && bookmarkFolders().find((f) => f.id === folderID);
  phoneSheet(
    f ? 'Edit folder' : 'New folder',
    '<form id="phone-folder-form" data-id="' +
      e(f?.id || '') +
      '"><label>Folder name<input name="name" maxlength="80" required value="' +
      e(f?.name || '') +
      '"></label><button class="primary">Save folder</button></form>' +
      (f ? phoneRow('phoneRemoveFolder', 'Remove folder and keep bookmarks', 'trash') : ''),
    'phoneFolder',
  );
}
function filePhoneBookmark(id) {
  const item = saved().find((b) => b.id === id);
  if (!item) return;
  const folders = bookmarkFolders();
  phoneSheet(
    'Organize bookmark',
    '<form id="phone-file-form" data-id="' +
      e(id) +
      '"><label>Folder on this device<select name="folder"><option value="">No folder</option>' +
      folders
        .map(
          (f) =>
            '<option value="' +
            e(f.id) +
            '"' +
            (f.items.includes(id) ? ' selected' : '') +
            '>' +
            e(f.name) +
            '</option>',
        )
        .join('') +
      '</select></label><button class="primary">Save location</button></form><div class="phone-action-list"><button data-phone-edit-bookmark="' +
      e(id) +
      '">Edit bookmark</button></div>',
    'phoneMoveBookmark',
  );
}

function showPhonePrivacy(event) {
  const t = current(),
    url = new URL(t.url);
  const privateTab = t.private || windowInfo.private;
  const lines = [
    '<div class="phone-origin">' +
      icon('shield') +
      '<div><strong>' +
      e(url.hostname) +
      '</strong><small>' +
      (url.protocol === 'https:' ? 'HTTPS connection' : 'Unencrypted HTTP connection') +
      '</small></div></div>',
    '<div class="phone-kv"><span>Tracking protection</span><strong>' +
      (settings.protection ? 'Enabled' : 'Off') +
      '</strong></div>',
  ];
  if (!privateTab && capabilities.canPrivacyReport) {
    if (!event) lines.push('<p class="dialognote" role="status">Checking blocked requests…</p>');
    else {
      lines.push(
        '<div class="phone-kv"><span>Requests blocked on this page</span><strong>' +
          Math.max(0, Number(event.blocked) || 0) +
          '</strong></div>',
      );
      for (const row of (Array.isArray(event.domains) ? event.domains : []).slice(0, 30))
        lines.push(
          '<div class="phone-kv"><span>' +
            e(row.host) +
            '</span><span>' +
            e(String(row.count)) +
            '</span></div>',
        );
    }
  } else if (!privateTab)
    lines.push(
      '<p class="dialognote">This browser engine does not provide a per-site count of blocked requests.</p>',
    );
  lines.push(phoneRow('protection', 'Privacy settings', 'sliders'));
  phoneSheet('Privacy and connection', lines.join(''), 'phoneReport');
  if (!event && !privateTab && capabilities.canPrivacyReport) {
    reportRequest = { id: t.id, url: t.url, requestId: uid() };
    send({ type: 'privacyReport', ...reportRequest });
  }
}

function siteAppearanceForm(t) {
  if (!capabilities.canPageDisplay || t.private || windowInfo.private) return '';
  const origin = new URL(t.url).origin;
  const choice = read('siteAppearance', {})[origin] || 'original';
  return (
    '<form id="phone-appearance-form" data-origin="' +
    e(origin) +
    '"><label>Appearance for this website<select name="appearance">' +
    [
      ['original', 'Website colors'],
      ['auto', 'Match device appearance'],
      ['dark', 'Always dark'],
    ]
      .map(
        ([value, label]) =>
          '<option value="' + value + '"' + (value === choice ? ' selected' : '') + '>' + label + '</option>',
      )
      .join('') +
    '</select></label><button class="subtle">Save website preference</button></form>'
  );
}

function applySiteAppearance(t, force = false) {
  if (
    !capabilities.canPageDisplay ||
    t.id !== activeId ||
    t.private ||
    windowInfo.private ||
    t.loading ||
    t.error ||
    !webURL(t.url)
  )
    return;
  const perSite = read('siteAppearance', {})[new URL(t.url).origin];
  const browserDark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  const mode = settings.siteAppearance === 'matchBrowser' ? (browserDark ? 'dark' : 'light') : perSite;
  const dark = mode === 'dark' || (mode === 'auto' && browserDark);
  const state = t.url + '|' + settings.siteAppearance + '|' + (mode || 'original') + '|' + dark;
  if (!force && t.appliedAppearance === state) return;
  t.appliedAppearance = state;
  if (mode || t.phoneDark || force)
    send({ type: 'pageDisplay', id: t.id, url: t.url, action: dark ? 'dark' : 'light' });
  t.phoneDark = dark;
}

function phoneZoom() {
  const t = current();
  const pct = t.zoom || settings.defaultZoom || 100;
  phoneSheet(
    'Page zoom',
    '<div class="phone-zoom">' +
      [50, 75, 90, 100, 110, 125, 150, 175, 200]
        .map(
          (n) => '<button data-phone-zoom="' + n + '" aria-pressed="' + (pct === n) + '">' + n + '%</button>',
        )
        .join('') +
      '</div>',
    'phoneZoom',
  );
}

function phoneListen() {
  const t = current();
  if (!capabilities.canReadAloud) return;
  if (phoneReading === t.id) {
    send({ type: 'stopReading', id: t.id });
    closeDialog();
    return;
  }
  phoneSheet('Listen to page', '<p role="status">Preparing readable text…</p>', 'phoneSpeech');
  speechRequest = { id: t.id, url: t.url };
  send({ type: 'extract', id: t.id });
}
function receiveSpeechText(msg) {
  if (modal !== 'phoneSpeech' || !speechRequest) return false;
  if (
    speechRequest.id !== msg.id ||
    activeId !== msg.id ||
    speechRequest.url !== webURL(msg.url) ||
    current().url !== speechRequest.url
  )
    return true;
  const text = String(msg.text || '')
    .trim()
    .slice(0, 18000);
  const request = speechRequest;
  speechRequest = null;
  closeDialog();
  if (text) send({ type: 'readAloud', ...request, text });
  else toast('No readable text on this page.');
  return true;
}

function mobileCommand(act) {
  if (act === 'expandPhoneBars') {
    setPhoneCompact(false);
    return true;
  }
  if (act === 'tabOverview') {
    setPhoneCompact(false);
    showTabOverview();
    return true;
  }
  if (act === 'mobileLibrary') {
    librarySection('saved');
    return true;
  }
  if (act === 'phoneReadingList') {
    librarySection('reading');
    return true;
  }
  if (act === 'phoneHistory') {
    librarySection('history');
    return true;
  }
  if (act === 'phoneFavorites') {
    phoneSheet(
      'Favorites',
      '<div class="phone-tiles">' +
        favorites
          .filter((f) => webURL(f.url))
          .map(phoneTile)
          .join('') +
        '</div>',
      'phoneFavorites',
    );
    return true;
  }
  if (act === 'phoneFolder' || act === 'phoneFolderEdit') {
    editPhoneFolder(act === 'phoneFolderEdit');
    return true;
  }
  if (act === 'phoneRemoveFolder') {
    write(
      libraryKey('folders'),
      bookmarkFolders().filter((f) => f.id !== folderID),
    );
    librarySection('saved');
    return true;
  }
  const t = current();
  if (!(act === 'pageActions' || act.startsWith('phone'))) return false;
  if (!t || !webURL(t.url) || view !== 'web') return true;
  switch (act) {
    case 'pageActions':
      phonePageActions();
      break;
    case 'phonePageEdit':
      phonePageActions(true);
      break;
    case 'phoneZoom':
      phoneZoom();
      break;
    case 'phoneListen':
      phoneListen();
      break;
    case 'phoneReport':
      showPhonePrivacy();
      break;
    case 'phoneSite':
      phoneSheet(
        'Website settings',
        '<div class="phone-origin">' +
          mark(t) +
          '<strong>' +
          e(hostOf(t.url)) +
          '</strong></div><div class="phone-action-list">' +
          phoneRow('phoneReport', 'Connection and protection', 'shield') +
          (capabilities.canZoom
            ? phoneRow('phoneZoom', 'Page zoom', 'expand', (t.zoom || settings.defaultZoom) + '%')
            : '') +
          (capabilities.canDesktopSite
            ? phoneRow('desktopSite', t.desktopSite ? 'Use mobile site' : 'Use desktop site', 'devices')
            : '') +
          (capabilities.canSitePermissions
            ? phoneRow('sitePermissions', 'Camera and microphone permissions', 'camera')
            : '') +
          '</div>' +
          siteAppearanceForm(t),
        'phoneSite',
      );
      break;
    case 'phoneCollapse':
      closeDialog();
      $('#address').blur();
      setPhoneCompact(true);
      break;
    case 'phoneDisplayDark':
    case 'phoneDisplayPick':
    case 'phoneDisplayUndo': {
      if (!capabilities.canPageDisplay) break;
      const action =
        act === 'phoneDisplayPick'
          ? 'pick'
          : act === 'phoneDisplayUndo'
            ? 'undo'
            : t.phoneDark
              ? 'light'
              : 'dark';
      closeDialog();
      send({ type: 'pageDisplay', id: t.id, url: t.url, action });
      if (action === 'light' || action === 'dark') t.phoneDark = action === 'dark';
      break;
    }
    case 'phoneSave': {
      if (t.private || windowInfo.private) break;
      let item = saved().find((b) => b.url === t.url);
      if (!item) {
        addManyBookmarks([t]);
        item = saved().find((b) => b.url === t.url);
      }
      if (item) filePhoneBookmark(item.id);
      break;
    }
    case 'phoneFavorite':
      if (t.private || windowInfo.private) break;
      if (!favorites.some((f) => f.url === t.url)) {
        favorites.push({ title: t.title, url: t.url });
        write('favorites', favorites);
      }
      closeDialog();
      toast('Saved to Favorites.');
      break;
    case 'phoneNote': {
      if (t.private || windowInfo.private) break;
      const note = read(libraryKey('notes'), []).find((n) => n.url === t.url);
      phoneSheet(
        'Page note',
        '<form id="phone-note-form" data-url="' +
          e(t.url) +
          '"><label>' +
          e(hostOf(t.url)) +
          '<textarea name="note" maxlength="4000" rows="6" placeholder="Write a note for this page">' +
          e(note?.text || '') +
          '</textarea></label><p class="dialognote">Saved on this device. Clear the text to remove the note.</p><button class="primary">Save note</button></form>',
        'phoneNote',
      );
      break;
    }
    case 'phoneReminder':
      if (!capabilities.canPageReminder || t.private || windowInfo.private) break;
      phoneSheet(
        'Remind me',
        '<p class="dialognote">Receive a device notification that opens this page.</p><div class="phone-action-list">' +
          [
            [3600, 'In one hour'],
            [86400, 'In one day'],
            [604800, 'In one week'],
          ]
            .map(
              ([sec, label]) =>
                '<button data-phone-reminder="' + sec + '">' + icon('clock') + label + '</button>',
            )
            .join('') +
          '</div>',
        'phoneReminder',
      );
      break;
    case 'phoneIssue':
      phoneSheet(
        'Report a website issue',
        '<p class="dialognote">Copy the site and browser details to include in a report. Review your report before sending it on GitHub.</p>' +
          phoneRow('phoneCopyIssue', 'Copy diagnostic details', 'link') +
          phoneRow('phoneOpenIssues', 'Open Vaayvu issue tracker', 'globe'),
        'phoneIssue',
      );
      break;
    case 'phoneCopyIssue': {
      const text =
        'Vaayvu ' + BROWSER_VERSION + ' · ' +
        platform +
        '\nSite: ' +
        new URL(t.url).origin +
        '\nPage zoom: ' +
        (t.zoom || settings.defaultZoom) +
        '%';
      if (capabilities.canCopy) send({ type: 'copy', text });
      else navigator.clipboard?.writeText(text).catch(() => toast('Copy unavailable.'));
      break;
    }
    case 'phoneOpenIssues':
      closeDialog();
      addTab(!!t.private, 'https://github.com/Mahesh-Vanga/Vaayvu/issues/new');
      break;
    default:
      return false;
  }
  return true;
}

function mobileEvent(m) {
  if (m.type === 'tabPreview') {
    receiveTabPreview(m);
    return true;
  }
  if (m.type === 'pageScroll') {
    if (m.id === activeId && view === 'web' && typeof m.collapsed === 'boolean') setPhoneCompact(m.collapsed);
    return true;
  }
  if (m.type === 'readingState') {
    if (m.active && m.id === activeId) phoneReading = m.id;
    else if (phoneReading === m.id) phoneReading = '';
    if (modal === 'phonePage') phonePageActions();
    return true;
  }
  if (m.type === 'privacyReport') {
    if (
      modal === 'phoneReport' &&
      reportRequest &&
      reportRequest.requestId === m.requestId &&
      m.id === activeId &&
      !current().private &&
      current().url === webURL(m.url)
    )
      showPhonePrivacy(m);
    return true;
  }
  return false;
}

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'phone-library-search' && modal === 'phoneLibrary') {
    libraryFilter = ev.target.value;
    $('#phone-library-rows').innerHTML = phoneLibraryRows();
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.dataset.phonePin && modal === 'phonePageEdit')
    updatePhonePins(ev.target.dataset.phonePin, ev.target.checked);
});
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b || !b.closest('#dialog') || closeStaleAccountDialog()) return;
  const d = b.dataset;
  if (d.phoneTopic && modal === 'phoneLibrary') {
    libraryFilter = d.phoneTopic;
    phoneLibrary();
    $('#phone-library-search').focus();
  } else if (d.libraryPane) librarySection(d.libraryPane);
  else if (d.phoneFolder) librarySection('saved', d.phoneFolder);
  else if (d.fileBookmark) filePhoneBookmark(d.fileBookmark);
  else if (d.phoneEditBookmark) editBookmark(d.phoneEditBookmark);
  else if (d.phoneUp && modal === 'phonePageEdit') updatePhonePins(d.phoneUp);
  else if (
    d.phoneReminder &&
    modal === 'phoneReminder' &&
    capabilities.canPageReminder &&
    !current().private
  ) {
    const seconds = Number(d.phoneReminder);
    if ([3600, 86400, 604800].includes(seconds)) {
      closeDialog();
      send({ type: 'pageReminder', id: activeId, url: current().url, seconds });
    }
  } else if (d.phoneZoom && modal === 'phoneZoom' && capabilities.canZoom) {
    const percent = Number(d.phoneZoom);
    current().zoom = percent;
    persistTabs();
    send({ type: 'zoom', id: activeId, percent });
    phoneZoom();
  } else if (d.forgetPhone && modal === 'phoneLibrary' && !current().private) {
    if (libraryPane === 'history') {
      historyItems = read('history', []).filter((h) => h.url !== d.forgetPhone);
      write('history', historyItems);
    } else if (libraryPane === 'reading')
      write(
        'reading',
        read('reading', []).filter((h) => h.url !== d.forgetPhone),
      );
    phoneLibrary();
  }
});
document.addEventListener('submit', (ev) => {
  const form = ev.target;
  if (!form.id.startsWith('phone-') || closeStaleAccountDialog() || current().private || windowInfo.private)
    return;
  ev.preventDefault();
  const data = new FormData(form);
  if (form.id === 'phone-appearance-form') {
    const origin = new URL(current().url).origin;
    const mode = data.get('appearance');
    if (form.dataset.origin !== origin || !['original', 'auto', 'dark'].includes(mode)) return;
    const choices = read('siteAppearance', {});
    if (mode === 'original') delete choices[origin];
    else choices[origin] = mode;
    if (write('siteAppearance', choices)) {
      applySiteAppearance(current(), true);
      toast('Website preference saved.');
    }
  } else if (form.id === 'phone-folder-form') {
    const folders = bookmarkFolders(),
      name = String(data.get('name') || '')
        .trim()
        .slice(0, 80);
    if (!name) return;
    const existing = folders.find((f) => f.id === form.dataset.id);
    if (existing) existing.name = name;
    else folders.push({ id: uid(), name, items: [] });
    if (write(libraryKey('folders'), folders)) librarySection('saved');
  } else if (form.id === 'phone-file-form') {
    const folders = bookmarkFolders(),
      id = form.dataset.id;
    if (!saved().some((b) => b.id === id)) {
      librarySection('saved');
      return;
    }
    for (const f of folders) {
      f.items = f.items.filter((item) => item !== id);
      if (f.id === data.get('folder')) f.items.push(id);
    }
    if (write(libraryKey('folders'), folders)) librarySection('saved', String(data.get('folder') || ''));
  } else if (form.id === 'phone-note-form' && current().url === form.dataset.url) {
    const notes = read(libraryKey('notes'), []).filter((n) => n.url !== form.dataset.url);
    const text = String(data.get('note') || '')
      .trim()
      .slice(0, 4000);
    if (text) notes.push({ url: current().url, text });
    if (write(libraryKey('notes'), notes)) {
      closeDialog();
      toast(text ? 'Note saved.' : 'Note removed.');
    }
  }
});
