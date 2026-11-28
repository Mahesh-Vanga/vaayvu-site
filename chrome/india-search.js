'use strict';

// Search state has no URL. Keeping it separate from tab records also keeps it out of sync and session restore.
const searches = new Map();
const approvedVisits = new Set();

function canVisit(tab) {
  return settings.ordinaryWeb || approvedVisits.has(tab.id);
}

function closeApprovedVisits(ids = [...approvedVisits]) {
  const closing = ids.filter(id => approvedVisits.has(id));
  if (closing.length) closeTabs(closing);
}

function forgetSearch(id) {
  const search = searches.get(id);
  if (search?.pending) send({ type: 'cancelIndiaSearch', requestId: search.requestId });
  searches.delete(id);
}

function forgetAllSearches() {
  for (const id of searches.keys()) {
    forgetSearch(id);
    const tab = tabs.find(t => t.id === id);
    if (tab) tab.title = 'Start page';
  }
  if (view === 'indiaSearch') view = 'home';
}

function searchIndia(input) {
  const q = input.trim();
  if (!q || Array.from(q).length > 256) {
    toast('Enter up to 256 characters to search.');
    return;
  }
  closeDialog();
  setDrawer(false);
  hideAddressMatches();
  if (current().url || current().adopted) addTab(current().private);
  document.activeElement?.blur();
  $('#findbar').hidden = true;
  const id = activeId;
  forgetSearch(id);
  const pending = nativeReady && capabilities.canIndiaSearch === true;
  const state = { q, directory: VaayvuDirectory.search(q), pending, requestId: uid(), results: [], status: pending ? 'loading' : 'offline' };
  searches.set(id, state);
  current().title = 'Vaayvu Search';
  view = 'indiaSearch';
  render(true);
  if (pending) send({ type: 'indiaSearch', id, requestId: state.requestId, q });
}

function receiveIndiaResults(msg) {
  const state = searches.get(msg.id);
  if (!state?.pending || state.requestId !== msg.requestId) return;
  state.pending = false;
  state.status = msg.error === 'invalid' ? 'invalid' : 'failed';
  if (!msg.error && Array.isArray(msg.results)) {
    state.results = msg.results.slice(0, 20).filter(item =>
      item && typeof item.title === 'string' && typeof item.snippet === 'string' &&
      webURL(item.url).startsWith('https://') && !VaayvuCore.providerQuery(item.url));
    state.status = 'done';
  }
  if (msg.id === activeId && view === 'indiaSearch') renderContent(true);
}

function indiaResultsPage() {
  const state = searches.get(activeId);
  if (!state) return home();
  const local = current().private ? [] : localAddressChoices(state.q, [], [...saved(), ...favorites], historyItems, activeId)
    .filter(row => !VaayvuCore.providerQuery(row.url));
  const shown = new Set();
  function group(label, items) {
    const rows = [];
    for (const item of items) {
      const url = webURL(item.url);
      if (!url || shown.has(url)) continue;
      shown.add(url);
      rows.push('<button class="india-result" data-result-url="' + e(url) + '"><span class="result-icon" aria-hidden="true">' +
        icon(item.kind === 'topic' ? 'book' : 'globe') + '</span><span class="result-copy"><small>' + e(hostOf(url)) +
        '</small><strong>' + e(item.title || hostOf(url)) + '</strong>' +
        (item.snippet ? '<span>' + e(item.snippet) + '</span>' : '') + '</span><span class="result-arrow" aria-hidden="true">' + icon('forward') + '</span></button>');
    }
    return rows.length ? '<section class="result-group"><h2>' + e(label) + '</h2>' + rows.join('') + '</section>' : '';
  }
  const groups = group('India web index', state.results) + group('Your saved and visited pages', local) +
    group('Websites', state.directory.sites) + group('Reference articles', state.directory.topics);
  const status = {
    loading: 'Checking the India web index…',
    offline: 'Searched on this device. Your search words stayed here.',
    failed: 'The India index could not be reached. Showing available on-device matches.',
    invalid: 'The India index could not use this query. Showing available on-device matches.',
    done: state.results.length ? 'Searched the India web index and this device.' : 'The India index returned no additional matches.',
  }[state.status];
  return '<section class="india-results search-desk"><header class="search-brand"><img src="assets/vaayvu.svg" width="34" height="34" alt=""><h1>Vaayvu Search</h1></header>' +
    '<form id="directory-form" class="directory-form">' + icon('search') +
    '<input type="search" name="query" aria-label="Edit search" value="' + e(state.q) + '" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search">' +
    '<button type="submit" aria-label="Search">' + icon('forward') + '</button></form>' +
    '<p class="result-status" role="status">' + icon('shield') + e(status) + '</p>' +
    (!settings.ordinaryWeb ? actButton('pref-search', 'Web search settings', 'settings') : '') +
    (state.status === 'failed' ? actButton('retryIndia', 'Retry India index', 'reload') : '') +
    (groups || (state.pending ? '' : '<div class="result-empty"><h2>No matches for “' + e(state.q) +
      '”</h2><p>Try a shorter name or topic, or enter the full website address.</p>' + actButton('focusAddress', 'Enter an address', 'globe') + '</div>')) +
    '<details class="search-sources"><summary>Search sources &amp; privacy</summary>' +
    '<p>Website names are from the Majestic Million (CC BY 3.0). Reference titles and subject groups are adapted from Wikipedia’s Vital articles (CC BY-SA 4.0). ' +
    'These snapshots work offline. Opening a result connects to the destination, which can be outside India. Vaayvu does not attach the search words.</p>' +
    '<button data-url="https://majestic.com/reports/majestic-million">Majestic Million</button> · ' +
    '<button data-url="https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level_4">Wikipedia contributors</button> · ' +
    '<button data-url="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</button> · ' +
    '<button data-url="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</button></details></section>';
}

function tabView(tab) {
  if (searches.has(tab.id)) return 'indiaSearch';
  if (!tab.url && !tab.adopted) return 'home';
  return canVisit(tab) ? 'web' : 'restrictedSite';
}

function restrictedSite() {
  const url = webURL(current().url);
  return '<section class="india-results"><h1>This website is paused</h1><p>' + e(hostOf(url)) + '</p>' +
    '<button class="primary" data-offer-visit="' + e(url) + '">Open website</button></section>';
}

function offerVisit(value) {
  const url = webURL(value);
  if (!url || VaayvuCore.providerQuery(url)) return;
  dialog('Open ' + hostOf(url) + '?',
    '<p>This tab will connect directly to <strong>' + e(new URL(url).host) +
    '</strong>. The website and its services may receive data outside India. Vaayvu’s search stays private and sync stays paused.</p>' +
    '<button class="primary" data-confirm-visit="' + e(url) + '">Open website</button> ' +
    actButton('dismiss', 'Cancel'), 'restrictedSite');
}

function updateWebsiteAccess() {
  closeApprovedVisits();
  sync.allowNetwork(settings.ordinaryWeb);
  if (settings.ordinaryWeb) queueSync();
  send({ type: 'websiteAccess', enabled: settings.ordinaryWeb === true });
  if (!settings.ordinaryWeb) {
    clearObservatoryNetwork();
    for (const id of mounted) send({ type: 'close', id });
    mounted.clear();
  }
  if (['web', 'restrictedSite'].includes(view)) view = tabView(current());
  if (view === 'web') activateTab();
  render(true);
}
