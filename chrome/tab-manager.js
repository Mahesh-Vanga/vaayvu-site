'use strict';

let tabSelection = new Set();
let groupTargets = [];
let closeTargets = [];
let draggedTab = '';
let overview = null;
let managerRegularOnly = false;

function overviewRows(items, state, groupName = (id) => id) {
  const query = state.query.trim().toLowerCase();
  const rows = items.filter(
    (t) =>
      !!t.private === state.private &&
      (!state.group || t.group === state.group) &&
      (!query ||
        [t.title, t.url, t.group && groupName(t.group)].some((v) =>
          String(v || '')
            .toLowerCase()
            .includes(query),
        )),
  );
  if (state.sort === 'title') rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  if (state.sort === 'website') rows.sort((a, b) => hostOf(a.url).localeCompare(hostOf(b.url)));
  return rows;
}

function overviewGroupName(id) {
  return (Object.prototype.hasOwnProperty.call(tabGroups, id) && tabGroups[id]?.name) || id;
}
function overviewButton(action, text, symbol, className = '', disabled = false) {
  return (
    '<button type="button" class="' +
    className +
    '" data-overview="' +
    action +
    '" aria-label="' +
    e(text) +
    '" title="' +
    e(text) +
    '"' +
    (disabled ? ' disabled' : '') +
    '>' +
    (symbol ? icon(symbol) : '') +
    '<span>' +
    e(text) +
    '</span></button>'
  );
}
function showTabOverview(resume = false) {
  if (!overview || !resume || overview.space !== (spacesEnabled ? spaces.active : '')) {
    const t = current();
    overview = {
      private: !!t.private,
      group: t.private ? '' : t.group || '',
      space: spacesEnabled ? spaces.active : '',
      sort: 'manual',
      query: '',
      search: false,
      selecting: false,
      picked: new Set(),
      images: new Map(),
      requested: new Map(),
      token: uid(),
      groupTargets: [],
    };
  }
  dialog(
    'Tab overview',
    '<div class="ov-shell"><div class="ov-heading"><img src="assets/vaayvu.svg" width="34" height="34" alt="">' +
      '<div class="ov-title"><h3>Tabs</h3>' +
      (spacesEnabled ? '<button type="button" data-act="spaceSheet" aria-label="' + e('Change Space, ' + activeSpace().name) + '"><span>' +
        e(activeSpace().name) + '</span>' + icon('down') + '</button>' : '<span>Private window</span>') +
      '</div><span id="ov-count" role="status"></span>' +
      overviewButton('more', 'Tab actions', 'more', 'ov-icon') +
      '</div><div class="ov-top"><div class="ov-scopes">' +
      '<button type="button" id="ov-groups" data-overview="groups">' +
      icon('layers') + '<span></span>' + icon('down') + '</button>' +
      (privateSupported && native && !windowInfo.private
        ? overviewButton('privacy', 'Private', 'private', 'ov-private')
        : '') +
      '</div>' + overviewButton('search', 'Search tabs', 'search', 'ov-icon') +
      overviewButton('sort', 'Arrange tabs', 'sliders', 'ov-icon') + '</div>' +
      '<div id="ov-search-wrap"><input type="search" id="ov-search" aria-label="Search tabs" placeholder="Search tabs" autocomplete="off" spellcheck="false"></div>' +
      '<div id="ov-grid" class="ov-grid" aria-label="Open tabs"></div><div id="ov-selection"></div>' +
      '<nav class="ov-bottom" aria-label="Tab overview actions">' +
      overviewButton('add', 'New tab', 'plus', 'ov-primary') +
      overviewButton('done', 'Done', 'check', 'ov-finish') +
      '</nav></div>',
    'tabOverview',
  );
  $('#dialog').dataset.layout = 'tabOverview';
  $('#ov-search').value = overview.query;
  drawTabOverview();
}
function overviewCard(t) {
  const title = t.title || 'Start page',
    id = e(t.id),
    selected = overview.picked.has(t.id);
  const host = t.private ? '' : hostOf(t.url);
  const label = t.private ? 'Private tab' : host || 'Vaayvu';
  const artwork = icon(t.private ? 'private' : host ? 'globe' : 'vaayvu');
  return (
    '<article class="ov-card' +
    (t.id === activeId ? ' ov-current' : '') +
    (selected ? ' ov-selected' : '') +
    '"><div class="ov-frame"><button type="button" class="ov-tile" data-ov-tab="' +
    id +
    '" aria-label="' +
    e(label + ', ' + (overview.selecting ? 'select ' : 'open ') + title) +
    '"' +
    (overview.selecting
      ? ' aria-pressed="' + selected + '"'
      : t.id === activeId
        ? ' aria-current="page"'
        : '') +
    '><span class="ov-symbol' +
    (t.private ? ' ov-secret' : !host ? ' ov-start' : '') +
    '" aria-hidden="true">' +
    artwork +
    '</span><span class="ov-host" aria-hidden="true">' +
    e(label) +
    '</span></button>' +
    (overview.selecting
      ? '<span class="ov-mark" aria-hidden="true">' + (selected ? icon('check') : '') + '</span>'
      : '<button type="button" class="ov-close" data-ov-close="' +
        id +
        '" aria-label="' +
        e('Close ' + title) +
        '">' +
        icon('x') +
        '</button>') +
    '</div><div class="ov-caption">' +
    (t.private ? icon('private') : tabIcon(t)) +
    '<span>' +
    e(title) +
    '</span>' +
    (overview.selecting
      ? ''
      : '<button type="button" data-ov-options="' +
        id +
        '" aria-label="' +
        e('Options for ' + title) +
        '">' +
        icon('more') +
        '</button>') +
    '</div></article>'
  );
}
function drawTabOverview() {
  if (modal !== 'tabOverview' || !overview || !$('#ov-grid')) return;
  const rows = overviewRows(spaceTabs(), overview, overviewGroupName);
  const ids = new Set(rows.map((t) => t.id));
  for (const id of overview.picked) if (!ids.has(id)) overview.picked.delete(id);
  const grid = $('#ov-grid');
  const focus = document.activeElement?.dataset.ovTab || document.activeElement?.dataset.ovClose;
  const closing = document.activeElement?.hasAttribute('data-ov-close');
  grid.innerHTML = rows.length
    ? rows.map(overviewCard).join('')
    : '<p class="ov-empty">' +
      (overview.query
        ? 'No matching tabs.'
        : overview.private
          ? 'No private tabs.'
          : 'No tabs in this group.') +
      '</p>';
  const buttons = [...grid.querySelectorAll('[data-ov-tab]')];
  if (focus && ids.has(focus))
    (closing
      ? [...grid.querySelectorAll('[data-ov-close]')].find((b) => b.dataset.ovClose === focus)
      : buttons.find((b) => b.dataset.ovTab === focus)
    )?.focus({ preventScroll: true });
  $('#ov-count').textContent = rows.length + (rows.length === 1 ? ' tab' : ' tabs');
  $('#ov-search-wrap').hidden = !overview.search;
  const privateButton = $('#dialog [data-overview="privacy"]');
  if (privateButton) privateButton.setAttribute('aria-pressed', String(overview.private));
  $('#ov-groups span').textContent = overview.private
    ? windowInfo.private
      ? 'Private tabs'
      : 'All tabs'
    : overview.group
      ? overviewGroupName(overview.group)
      : 'All tabs';
  $('#ov-groups').disabled = !!windowInfo.private;
  $('#ov-groups').setAttribute('aria-label', $('#ov-groups span').textContent + ', choose tab group');
  $('#ov-groups').setAttribute('aria-pressed', String(!overview.private));
  $('#ov-selection').hidden = !overview.selecting;
  if (overview.selecting)
    $('#ov-selection').innerHTML =
      overviewButton(
        'all',
        rows.length > 0 && overview.picked.size === rows.length ? 'Deselect all' : 'Select all',
        '',
        'ov-text',
        !rows.length,
      ) +
      '<span>' +
      overview.picked.size +
      ' selected</span>' +
      overviewButton('more', 'Actions', 'more', 'ov-text');
  const byId = new Map(rows.map((t) => [t.id, t]));
  for (const b of buttons) {
    const t = byId.get(b.dataset.ovTab);
    if (t.private || windowInfo.private || t.loading || t.error || !webURL(t.url)) continue;
    const cache = overview.images.get(t.id);
    if (cache && cache.url === t.url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = cache.image;
      b.append(img);
    }
  }
  requestOverviewPreviews();
}
function invalidateTabPreview(id) {
  if (!overview || (!overview.images.has(id) && !overview.requested.has(id))) return;
  overview.images.delete(id);
  // A reload can keep the same URL while an older native snapshot is still in flight.
  overview.token = uid();
  overview.requested = new Map([...overview.images].map(([tabId, preview]) => [tabId, preview.url]));
}
function requestOverviewPreviews() {
  if (
    modal !== 'tabOverview' ||
    !overview ||
    overview.private ||
    windowInfo.private ||
    !capabilities.canTabPreviews
  )
    return;
  const grid = $('#ov-grid');
  const bounds = grid.getBoundingClientRect();
  const byId = new Map(spaceTabs().map((t) => [t.id, t]));
  const pending = [];
  for (const b of grid.querySelectorAll('[data-ov-tab]')) {
    const rect = b.getBoundingClientRect();
    if (rect.top > bounds.bottom + 45) break;
    if (rect.bottom < bounds.top - 45) continue;
    const t = byId.get(b.dataset.ovTab);
    if (
      !t ||
      t.private ||
      t.loading ||
      t.error ||
      !mounted.has(t.id) ||
      !webURL(t.url) ||
      overview.requested.get(t.id) === t.url
    )
      continue;
    pending.push({ id: t.id, url: t.url });
    overview.requested.set(t.id, t.url);
    if (pending.length === 12) break;
  }
  if (pending.length) send({ type: 'tabPreviews', requestId: overview.token, tabs: pending });
}
function receiveTabPreview(event) {
  if (
    modal !== 'tabOverview' ||
    !overview ||
    overview.private ||
    windowInfo.private ||
    event.requestId !== overview.token ||
    overview.requested.get(event.id) !== event.url ||
    typeof event.image !== 'string' ||
    event.image.length > 320000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(event.image)
  )
    return;
  const tab = spaceTabs().find((t) => t.id === event.id);
  const button = [...document.querySelectorAll('#ov-grid [data-ov-tab]')].find(
    (b) => b.dataset.ovTab === event.id,
  );
  if (!tab || tab.private || tab.loading || tab.error || tab.url !== event.url || !button) return;
  if (overview.images.size >= 12 && !overview.images.has(tab.id)) {
    const old = overview.images.keys().next().value;
    overview.images.delete(old);
    overview.requested.delete(old);
  }
  overview.images.set(tab.id, { url: tab.url, image: event.image });
  const img = button.querySelector(':scope > img') || document.createElement('img');
  img.alt = '';
  img.src = event.image;
  if (!img.parentElement) button.append(img);
}

function overviewSheet(title, content) {
  dialog(
    title,
    '<div class="ov-sheet">' + content + overviewButton('back', 'Back to tabs', 'back', 'ov-back') + '</div>',
    'overviewSheet',
  );
  $('#dialog').dataset.layout = 'overviewSheet';
}
function scopedOverviewRows() {
  return overviewRows(spaceTabs(), overview, overviewGroupName);
}
function selectedOverviewTabs() {
  return scopedOverviewRows().filter((t) => !overview.selecting || overview.picked.has(t.id));
}
function overviewTools() {
  const targets = selectedOverviewTabs();
  const links = targets.filter((t) => !t.private && webURL(t.url));
  const disabled = !targets.length;
  overviewSheet(
    'Tab actions',
    overviewButton('select', overview.selecting ? 'Finish selecting' : 'Select tabs', 'check') +
      (!overview.private
        ? overviewButton('groupNew', 'New empty tab group', 'plus') +
          overviewButton(
            'groupFrom',
            'New group with ' + targets.length + (targets.length === 1 ? ' tab' : ' tabs'),
            'layers',
            disabled,
          )
        : '') +
      (links.length && (capabilities.canCopy || navigator.clipboard?.writeText)
        ? overviewButton('copy', 'Copy ' + links.length + (links.length === 1 ? ' link' : ' links'), 'link')
        : '') +
      (links.length
        ? overviewButton(
            'bookmark',
            'Bookmark ' + links.length + (links.length === 1 ? ' tab' : ' tabs'),
            'bookmark',
          )
        : '') +
      (overview.selecting ? overviewButton('closePicked', 'Close selected tabs…', 'x', '', disabled) : '') +
      (!overview.private ? overviewButton('organize', 'Organize tabs…', 'tabs') : ''),
  );
}
function overviewGroups() {
  const counts = new Map();
  for (const t of spaceTabs()) if (!t.private && t.group) counts.set(t.group, (counts.get(t.group) || 0) + 1);
  const used = new Set(tabs.map((t) => t.group));
  for (const [id, group] of Object.entries(tabGroups)) {
    if (!used.has(id) && group && (!group.space || group.space === overview.space)) counts.set(id, 0);
  }
  const button = (id, name, count) =>
    '<div class="ov-group-row">' +
    '<button type="button" data-ov-group="' +
    e(id) +
    '" class="ov-group">' +
    icon(id ? 'layers' : 'tabs') +
    '<span>' +
    e(name) +
    '</span><small>' +
    count +
    '</small>' +
    (!overview.private && overview.group === id ? icon('check') : '') +
    '</button>' +
    (id
      ? '<button type="button" class="ov-group-edit" data-ov-edit="' +
        e(id) +
        '" aria-label="' +
        e('Edit ' + name) +
        '">' +
        icon('edit') +
        '</button>'
      : '') +
    '</div>';
  overviewSheet(
    'Tab groups',
    button('', 'All tabs', spaceTabs().filter((t) => !t.private).length) +
      [...counts.entries()]
        .sort(([a], [b]) => overviewGroupName(a).localeCompare(overviewGroupName(b)))
        .map(([id, n]) => button(id, overviewGroupName(id), n))
        .join('') +
      overviewButton('groupNew', 'New empty tab group', 'plus') +
      (spacesEnabled ? actButton('spaceSheet', 'Spaces', 'layers') : '') +
      (capabilities.canProfiles && !windowInfo.private ? actButton('profiles', 'Browser profiles', 'user') : ''),
  );
}
function setOverviewScope(isPrivate, group = '') {
  overview.private = isPrivate;
  overview.group = isPrivate ? '' : group;
  overview.query = '';
  overview.search = false;
  overview.selecting = false;
  overview.picked.clear();
  overview.images.clear();
  overview.requested.clear();
  overview.token = uid();
  showTabOverview(true);
}
function overviewAction(action) {
  if (!overview || !['tabOverview', 'overviewSheet', 'overviewGroup', 'overviewClose'].includes(modal))
    return;
  if (action === 'back') return showTabOverview(true);
  if (action === 'more') return overviewTools();
  if (action === 'groups') return overviewGroups();
  if (action === 'privacy') return setOverviewScope(!overview.private);
  if (action === 'organize') return showTabManager(true);
  if (action === 'search') {
    overview.search = !overview.search;
    if (!overview.search) {
      overview.query = '';
      $('#ov-search').value = '';
    }
    drawTabOverview();
    if (overview.search) $('#ov-search').focus();
    return;
  }
  if (action === 'sort') {
    return overviewSheet(
      'Arrange tabs by',
      Object.entries({ manual: 'Tab order', title: 'Page title', website: 'Website' })
        .map(
          ([key, label]) =>
            '<button type="button" data-ov-sort="' +
            key +
            '">' +
            icon(key === 'website' ? 'globe' : 'tabs') +
            '<span>' +
            label +
            '</span>' +
            (overview.sort === key ? icon('check') : '') +
            '</button>',
        )
        .join(''),
    );
  }
  if (action === 'select') {
    overview.selecting = !overview.selecting;
    overview.picked.clear();
    return showTabOverview(true);
  }
  if (action === 'all') {
    const items = scopedOverviewRows();
    overview.picked = overview.picked.size === items.length ? new Set() : new Set(items.map((t) => t.id));
    return drawTabOverview();
  }
  if (action === 'done') {
    if (overview.selecting) {
      overview.selecting = false;
      overview.picked.clear();
      return drawTabOverview();
    }
    const scope = spaceTabs().filter(
      (t) => !!t.private === overview.private && (!overview.group || t.group === overview.group),
    );
    const tab =
      scope.find((t) => t.id === activeId) ||
      scope.reduce((best, t) => (!best || (t.lastViewed || 0) > (best.lastViewed || 0) ? t : best), null);
    if (tab) return selectTab(tab.id);
  }
  if (action === 'add' || action === 'done') return addTab(overview.private, '', { group: overview.group });
  if (action === 'groupNew' || action === 'groupFrom') {
    overview.groupTargets =
      action === 'groupFrom'
        ? selectedOverviewTabs()
            .filter((t) => !t.private)
            .map((t) => t.id)
        : [];
    dialog(
      'New tab group',
      '<form id="ov-new-group"><label>Group name<input name="name" maxlength="48" required autocomplete="off"></label>' +
        '<div class="dialogbuttons">' +
        overviewButton('back', 'Cancel', '', 'subtle') +
        '<button class="primary">Create group</button></div></form>',
      'overviewGroup',
    );
    $('#ov-new-group input').focus();
    return;
  }
  const selected = selectedOverviewTabs();
  if (action === 'closePicked' && selected.length) {
    overview.closing = selected.map((t) => t.id);
    dialog(
      'Close ' + selected.length + (selected.length === 1 ? ' tab?' : ' tabs?'),
      '<div class="stack">' +
        (overview.private ? '<p>Private tabs cannot be reopened.</p>' : '') +
        '<div class="dialogbuttons">' +
        overviewButton('back', 'Cancel', '', 'subtle') +
        overviewButton('confirmClose', 'Close tabs', 'x', 'primary') +
        '</div></div>',
      'overviewClose',
    );
    return;
  }
  if (action === 'confirmClose' && modal === 'overviewClose') {
    closeTabs(overview.closing);
    overview.selecting = false;
    overview.picked.clear();
    return showTabOverview(true);
  }
  const links = selected.filter((t) => !t.private && webURL(t.url));
  if (action === 'bookmark' && links.length) {
    const count = addManyBookmarks(links);
    toast(count + (count === 1 ? ' bookmark added.' : ' bookmarks added.'));
    return showTabOverview(true);
  }
  if (action === 'copy' && links.length) {
    const text = links.map((t) => t.url).join('\n');
    if (text.length > 100000) {
      toast('Select fewer links to copy.');
      return;
    }
    if (capabilities.canCopy) {
      send({ type: 'copy', text });
      toast('Links copied.');
    } else
      navigator.clipboard
        ?.writeText(text)
        .then(() => toast('Links copied.'))
        .catch(() => toast('Could not copy the links.'));
    showTabOverview(true);
  }
}
function bindTabOverview() {
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || !overview) return;
    if (b.dataset.overview) return overviewAction(b.dataset.overview);
    if (modal === 'overviewSheet' && b.hasAttribute('data-ov-group'))
      return setOverviewScope(false, b.dataset.ovGroup);
    if (modal === 'overviewSheet' && b.dataset.ovEdit) return groupDialog(b.dataset.ovEdit);
    if (modal === 'overviewSheet' && b.dataset.ovSort) {
      overview.sort = b.dataset.ovSort;
      if (overview.sort !== 'manual') {
        const ordered = overviewRows(spaceTabs(), { ...overview, query: '' }, overviewGroupName);
        const ids = new Set(ordered.map((t) => t.id));
        ordered.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
        let index = 0;
        tabs = tabs.map((t) => (ids.has(t.id) ? ordered[index++] : t));
        persistTabs();
        drawRail();
      }
      return showTabOverview(true);
    }
    if (modal !== 'tabOverview') return;
    if (b.dataset.ovOptions) return showTabOptions(b.dataset.ovOptions);
    if (b.dataset.ovClose) {
      closeTab(b.dataset.ovClose);
      return showTabOverview(true);
    }
    if (b.dataset.ovTab) {
      if (!overview.selecting) return selectTab(b.dataset.ovTab);
      if (overview.picked.has(b.dataset.ovTab)) overview.picked.delete(b.dataset.ovTab);
      else overview.picked.add(b.dataset.ovTab);
      drawTabOverview();
    }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'ov-search' && overview) {
      overview.query = ev.target.value;
      drawTabOverview();
    }
  });
  let scheduled = false;
  document.addEventListener(
    'scroll',
    (ev) => {
      if (ev.target.id !== 'ov-grid' || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        requestOverviewPreviews();
      });
    },
    true,
  );
  document.addEventListener('submit', (ev) => {
    if (!overview || modal !== 'overviewGroup' || ev.target.id !== 'ov-new-group') return;
    ev.preventDefault();
    const field = ev.target.elements.namedItem('name'),
      name = field.value.trim();
    if (!name) {
      field.setCustomValidity('Enter a group name.');
      field.reportValidity();
      field.setCustomValidity('');
      return;
    }
    const id = uid(),
      ids = new Set(overview.groupTargets);
    tabGroups[id] = {
      name: name.slice(0, 48),
      color: groupColors[Object.keys(tabGroups).length % groupColors.length],
      space: overview.space,
    };
    for (const t of spaceTabs()) if (!t.private && ids.has(t.id)) t.group = id;
    saveTabGroups();
    persistTabs();
    drawRail();
    setOverviewScope(false, id);
  });
  $('#dialog').addEventListener('close', () => {
    if (!$('#dialog').open) {
      overview = null;
      $('#dialog .ov-shell')?.remove();
    }
  });
}

function nextAfterClose(items, index, closing, preference) {
  const keep = (tab) => !closing.has(tab.id);
  const left = items.slice(0, index).reverse().find(keep);
  const right = items.slice(index).find(keep);
  if (preference === 'left') return left || right;
  if (preference === 'lastUsed') {
    const recent = items
      .filter(keep)
      .reduce((best, tab) => ((tab.lastViewed || 0) > (best?.lastViewed || 0) ? tab : best), null);
    if (recent) return recent;
  }
  return right || left;
}
function matchingTabs(items, query, kind = 'all') {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (tab) =>
      (kind === 'all' || (kind === 'pinned' ? tab.pinned : kind === 'private' ? tab.private : !!tab.group)) &&
      [tab.title, tab.url, tab.group].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(needle),
      ),
  );
}
function duplicateTabIds(items, keepId) {
  const seen = new Set();
  const duplicates = [];
  const preferred = items.filter((t) => t.pinned || t.id === keepId);
  for (const tab of [...preferred, ...items.filter((t) => !t.pinned && t.id !== keepId)]) {
    if (!tab.url) continue;
    const key = JSON.stringify([!!tab.private, tab.space || '', tab.group || '', tab.url]);
    if (seen.has(key) && !tab.pinned && tab.id !== keepId) duplicates.push(tab.id);
    seen.add(key);
  }
  return duplicates;
}
function tabButton(action, label, symbol, target, disabled = false) {
  return (
    '<button type="button" class="choice" data-tab-action="' +
    action +
    '" data-tab-id="' +
    e(target) +
    '"' +
    (disabled ? ' disabled' : '') +
    '>' +
    icon(symbol) +
    '<span>' +
    e(label) +
    '</span></button>'
  );
}
function managedScope() {
  return managerRegularOnly ? spaceTabs().filter((t) => !t.private) : spaceTabs();
}
function showTabManager(regularOnly = false) {
  managerRegularOnly = regularOnly;
  tabSelection.clear();
  dialog(
    'Manage tabs',
    '<div class="tab-manager"><div class="tab-manager-head">' +
      actButton('newTab', 'New tab', 'plus', 'primary') +
      (privateSupported && native ? actButton('privateTab', 'Private tab', 'private') : '') +
      (read(closedTabsKey, []).length && !windowInfo.private
        ? actButton('closedList', 'Recently closed', 'history')
        : '') +
      '</div><div class="tab-filters"><input id="manage-query" class="searchlist" placeholder="Search tabs" aria-label="Search open tabs">' +
      '<select id="manage-kind" aria-label="Filter tabs"><option value="all">All tabs</option><option value="pinned">Pinned</option>' +
      '<option value="grouped">Grouped</option>' +
      (regularOnly ? '' : '<option value="private">Private</option>') +
      '</select></div>' +
      '<label class="tab-select-all"><input id="select-visible-tabs" type="checkbox"> Select visible tabs</label>' +
      '<div id="managed-tabs"></div><div id="tab-batch"></div></div>',
    'manageTabs',
  );
  $('#dialog').dataset.layout = 'tabmanager';
  drawManagedTabs();
  if (!narrowLayout.matches) $('#manage-query').focus();
}
function drawManagedTabs() {
  if (modal !== 'manageTabs') return;
  const rows = matchingTabs(managedScope(), $('#manage-query').value, $('#manage-kind').value);
  for (const id of tabSelection) if (!tabs.some((t) => t.id === id)) tabSelection.delete(id);
  const selectAll = $('#select-visible-tabs');
  selectAll.checked = rows.length > 0 && rows.every((t) => tabSelection.has(t.id));
  selectAll.indeterminate = !selectAll.checked && rows.some((t) => tabSelection.has(t.id));
  selectAll.disabled = !rows.length;
  $('#managed-tabs').innerHTML =
    rows
      .map((t) => {
        const title = e(t.title || 'Start page');
        const detail = [t.private ? 'Private' : '', t.pinned ? 'Pinned' : '', t.group, hostOf(t.url)]
          .filter(Boolean)
          .join(' · ');
        return (
          '<div class="managed-tab" draggable="true" data-tab-row="' +
          e(t.id) +
          '">' +
          '<input type="checkbox" data-pick-tab="' +
          e(t.id) +
          '" aria-label="Select ' +
          title +
          '"' +
          (tabSelection.has(t.id) ? ' checked' : '') +
          '>' +
          '<button class="tab-switch" data-select="' +
          e(t.id) +
          '"' +
          (t.id === activeId ? ' aria-current="page"' : '') +
          '>' +
          (t.private ? icon('private') : tabIcon(t, 'tabs')) +
          '<span><strong>' +
          title +
          '</strong><small>' +
          e(detail || (t.id === activeId ? 'Current tab' : 'New tab')) +
          '</small></span></button>' +
          '<button class="icon" data-tab-options="' +
          e(t.id) +
          '" aria-label="Options for ' +
          title +
          '" title="Tab options">' +
          icon('more') +
          '</button></div>'
        );
      })
      .join('') || '<p class="muted">No matching tabs.</p>';
  const count = tabSelection.size;
  $('#tab-batch').innerHTML = count
    ? '<span role="status">' +
      count +
      ' selected</span>' +
      ['group', 'pin', 'unpin', 'bookmark', 'close']
        .map(
          (a) =>
            '<button class="subtle" data-tab-batch="' +
            a +
            '"' +
            (a === 'bookmark' && !tabs.some((t) => tabSelection.has(t.id) && !t.private && webURL(t.url))
              ? ' disabled'
              : '') +
            '>' +
            { group: 'Group…', pin: 'Pin', unpin: 'Unpin', bookmark: 'Bookmark', close: 'Close…' }[a] +
            '</button>',
        )
        .join('')
    : '<span role="status">' +
      rows.length +
      (rows.length === 1 ? ' tab' : ' tabs') +
      '</span>' +
      '<button class="linkbtn" data-tab-batch="duplicates"' +
      (duplicateTabIds(managedScope(), activeId).length ? '' : ' disabled') +
      '>Close duplicates…</button>';
}
function moveTabBeforeOrAfter(id, targetId, after, adoptGroup) {
  const tab = tabs.find((t) => t.id === id);
  const target = tabs.find((t) => t.id === targetId);
  if (!tab || !target || tab === target || !!tab.pinned !== !!target.pinned) return false;
  tabs.splice(tabs.indexOf(tab), 1);
  tabs.splice(tabs.indexOf(target) + Number(after), 0, tab);
  if (adoptGroup) tab.group = target.group || '';
  persistTabs();
  drawRail();
  drawManagedTabs();
  return true;
}
function groupTabSelection(ids) {
  groupTargets = ids.slice();
  const chosen = tabs.filter((t) => ids.includes(t.id));
  if (!chosen.length) return;
  const privacy = new Set(chosen.map((t) => !!t.private));
  const existing = [
    ...new Set(
      spaceTabs()
        .filter((t) => privacy.has(!!t.private))
        .map((t) => t.group)
        .filter(Boolean),
    ),
  ];
  const common = chosen.every((t) => t.group === chosen[0].group) ? chosen[0].group : '';
  dialog(
    'Group tabs',
    '<form id="group-selection"><label>Group name<input name="name" list="known-tab-groups" maxlength="48" value="' +
      e(common || '') +
      '" placeholder="Group name"></label><datalist id="known-tab-groups">' +
      existing.map((name) => '<option value="' + e(name) + '"></option>').join('') +
      '</datalist><div class="dialogbuttons"><button class="primary">Save group</button>' +
      (chosen.some((t) => t.group)
        ? '<button type="button" class="subtle" data-clear-group>Remove from group</button>'
        : '') +
      '</div></form>',
    'groupTabs',
  );
  $('#group-selection input').focus();
}
function saveTabGroup(name) {
  for (const tab of tabs) if (groupTargets.includes(tab.id)) tab.group = name.trim().slice(0, 48);
  groupTargets = [];
  foldedGroups.delete(name);
  persistTabs();
  drawRail();
  showTabManager(managerRegularOnly);
}
function confirmCloseTabs(ids) {
  const chosen = tabs.filter((t) => ids.includes(t.id));
  if (!chosen.length) return;
  closeTargets = chosen.map((t) => t.id);
  const count = chosen.length;
  dialog(
    'Close ' + count + (count === 1 ? ' tab?' : ' tabs?'),
    '<div class="stack"><p>' +
      (chosen.some((t) => t.private)
        ? 'Private tabs cannot be reopened.'
        : settings.rememberHistory
          ? 'Closed website tabs will appear in Recently closed.'
          : 'Recording recently closed tabs is turned off.') +
      '</p><div class="dialogbuttons"><button class="primary" data-confirm-tabs>Close ' +
      count +
      (count === 1 ? ' tab' : ' tabs') +
      '</button>' +
      actButton('manageTabs', 'Cancel') +
      '</div></div>',
    'confirmTabs',
  );
}
function showTabOptions(id) {
  const t = tabs.find((item) => item.id === id);
  if (!t) return;
  const peers = spaceTabs().filter((item) => !!item.private === !!t.private);
  const index = peers.indexOf(t);
  const button = (action, label, sym, disabled) => tabButton(action, label, sym, id, disabled);
  dialog(
    'Tab options',
    '<p class="tab-subject">' +
      e(t.title || 'Start page') +
      '</p><div class="menu-group">' +
      button('newAfter', 'New tab to the right', 'plus') +
      button('duplicateTab', 'Duplicate tab', 'tabs') +
      button('pinTab', t.pinned ? 'Unpin tab' : 'Pin tab', 'pin') +
      button('groupTab', 'Group tab…', 'layers') +
      button(
        'moveLeft',
        'Move earlier',
        'back',
        !peers[index - 1] || !!peers[index - 1].pinned !== !!t.pinned,
      ) +
      button(
        'moveRight',
        'Move later',
        'forward',
        !peers[index + 1] || !!peers[index + 1].pinned !== !!t.pinned,
      ) +
      '</div><div class="menu-group">' +
      button('closeOne', 'Close this tab', 'x') +
      button('closeOther', 'Close other unpinned tabs…', 'tabs', !peers.some((v) => !v.pinned && v !== t)) +
      button(
        'closeRight',
        'Close unpinned tabs to the right…',
        'forward',
        !peers.slice(index + 1).some((v) => !v.pinned),
      ) +
      '</div>' +
      actButton('manageTabs', 'Manage tabs', 'tabs', 'linkbtn'),
    'tabOptions',
  );
  $('#dialog').dataset.layout = 'menu';
}
function applyTabAction(action, id) {
  const t = tabs.find((item) => item.id === id);
  if (!t) return;
  const peers = spaceTabs().filter((item) => !!item.private === !!t.private);
  const index = peers.indexOf(t);
  switch (action) {
    case 'newAfter':
      addTab(t.private, '', { after: id, group: t.group });
      break;
    case 'duplicateTab':
      addTab(t.private, t.url, { after: id, title: t.title, group: t.group, zoom: t.zoom });
      break;
    case 'groupTab':
      groupTabSelection([id]);
      break;
    case 'closeOne':
      closeDialog();
      closeTab(id);
      break;
    case 'closeOther':
      confirmCloseTabs(peers.filter((v) => !v.pinned && v !== t).map((v) => v.id));
      break;
    case 'closeRight':
      confirmCloseTabs(
        peers
          .slice(index + 1)
          .filter((v) => !v.pinned)
          .map((v) => v.id),
      );
      break;
    case 'moveLeft':
    case 'moveRight': {
      const right = action === 'moveRight';
      moveTabBeforeOrAfter(id, peers[index + (right ? 1 : -1)]?.id, right, true);
      closeDialog();
      break;
    }
    case 'pinTab':
      t.pinned = !t.pinned;
      tabs.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
      persistTabs();
      closeDialog();
      drawRail();
      break;
  }
}
function applyTabBatch(action) {
  const ids = [...tabSelection];
  if (action === 'group') return groupTabSelection(ids);
  if (action === 'duplicates') return confirmCloseTabs(duplicateTabIds(managedScope(), activeId));
  if (action === 'close') return confirmCloseTabs(ids);
  const targets = tabs.filter((t) => tabSelection.has(t.id));
  if (action === 'bookmark') {
    toast(addManyBookmarks(publicTabs(targets)) + ' bookmarks added.');
  } else if (action === 'pin' || action === 'unpin') {
    for (const t of targets) t.pinned = action === 'pin';
    tabs.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    persistTabs();
    drawRail();
  }
  drawManagedTabs();
}
function bindTabManager() {
  bindTabOverview();
  function openStripMenu(event) {
    if (!document.body.classList.contains('desktop-browser') ||
        event.target.closest('button, [data-tab-row], .strip-group')) return;
    const strip = event.target.closest('#top-tabs, #tabs, .tabhead');
    if (!strip) return;
    event.preventDefault();
    openTabBarMenu(strip, event);
  }
  document.addEventListener('dblclick', (event) => {
    if (event.button === 0) openStripMenu(event);
  });
  document.addEventListener('contextmenu', (ev) => {
    const row = ev.target.closest('[data-tab-row]');
    if (row) {
      ev.preventDefault();
      showTabOptions(row.dataset.tabRow);
    } else openStripMenu(ev);
  });
  document.addEventListener('auxclick', (ev) => {
    const row = ev.target.closest('[data-tab-row]');
    if (ev.button === 1 && row) {
      ev.preventDefault();
      closeTab(row.dataset.tabRow);
      drawManagedTabs();
    }
  });
  document.addEventListener('dragstart', (ev) => {
    const row = ev.target.closest('[data-tab-row]');
    if (!row) return;
    draggedTab = row.dataset.tabRow;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', draggedTab);
  });
  document.addEventListener('dragend', () => {
    draggedTab = '';
  });
  document.addEventListener('dragover', (ev) => {
    if (draggedTab && ev.target.closest('[data-tab-row]')) ev.preventDefault();
  });
  document.addEventListener('drop', (ev) => {
    const row = ev.target.closest('[data-tab-row]');
    if (!row || !draggedTab) return;
    ev.preventDefault();
    const before =
      tabs.findIndex((t) => t.id === draggedTab) < tabs.findIndex((t) => t.id === row.dataset.tabRow);
    moveTabBeforeOrAfter(draggedTab, row.dataset.tabRow, before, true);
    draggedTab = '';
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.tabOptions) showTabOptions(b.dataset.tabOptions);
    if (b.dataset.tabAction) applyTabAction(b.dataset.tabAction, b.dataset.tabId);
    if (b.dataset.tabBatch) applyTabBatch(b.dataset.tabBatch);
    if (b.hasAttribute('data-clear-group')) saveTabGroup('');
    if (b.hasAttribute('data-confirm-tabs')) {
      closeDialog();
      closeTabs(closeTargets);
      closeTargets = [];
    }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'manage-query') drawManagedTabs();
  });
  document.addEventListener('change', (ev) => {
    if (modal !== 'manageTabs') return;
    const el = ev.target;
    if (el.id === 'manage-kind') tabSelection.clear();
    else if (el.id === 'select-visible-tabs') {
      for (const t of matchingTabs(managedScope(), $('#manage-query').value, $('#manage-kind').value))
        if (el.checked) tabSelection.add(t.id);
        else tabSelection.delete(t.id);
    } else if (el.dataset.pickTab) {
      if (el.checked) tabSelection.add(el.dataset.pickTab);
      else tabSelection.delete(el.dataset.pickTab);
    } else return;
    drawManagedTabs();
    if (el.dataset.pickTab)
      [...document.querySelectorAll('[data-pick-tab]')]
        .find((b) => b.dataset.pickTab === el.dataset.pickTab)
        ?.focus();
  });
  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'group-selection') {
      ev.preventDefault();
      saveTabGroup(new FormData(ev.target).get('name'));
    }
  });
}
