'use strict';

const observatoryLooks = { observatory: 'Harbor', ridge: 'Ridge', dusk: 'Dusk', paper: 'Paper' };
const deskViews = { overview: 'Overview', reading: 'Reading', focus: 'Focus' };
const fieldNotes = [
  { topic: 'Ocean', title: 'Why the tide keeps time', art: 'sea', source: 'NASA Science',
    url: 'https://science.nasa.gov/moon/tides/',
    body: 'A shoreline is a clock with an uneven beat. The Moon pulls more strongly on the side of Earth nearest to it. The difference in that pull across the planet helps drive the tides. The Sun plays a part too. The shape of a bay and the depth of the sea near it change when the water reaches a particular pier.' },
  { topic: 'Space', title: 'Look along the twilight line', art: 'moon', source: 'NASA Science',
    url: 'https://science.nasa.gov/moon/moon-phases/',
    body: 'Look at the edge where daylight gives way to night on the Moon. Sunlight there arrives at a low angle, and long shadows make crater rims and mountain slopes stand out. As the Moon orbits Earth, that boundary moves across the face we see. A different part of the landscape comes into relief each evening.' },
  { topic: 'Maps', title: 'The shortest route looks curved', art: 'map', source: 'National Geographic Education',
    url: 'https://education.nationalgeographic.org/resource/great-circle/',
    body: 'Stretch a thread between two points on a globe and pull it tight. Its path follows part of a great circle. On a flat map, that same path can look surprisingly bowed. The curve is a clue to what the map projection changes as it turns a round surface into a rectangle.' },
];
const forecastCities = {
  Mumbai: [19.08, 72.88], Hyderabad: [17.39, 78.49], Bengaluru: [12.97, 77.59],
  Delhi: [28.61, 77.21], London: [51.51, -0.13], 'New York': [40.71, -74.01], Tokyo: [35.68, 139.69],
};
let deskView = 'overview';
let noteIndex = 0;
const focusKey = 'vaayvu.focusUntil';
function readFocusDeadline() {
  try { return Number(localStorage.getItem(focusKey)) || 0; } catch { return 0; }
}
function saveFocusDeadline(value) {
  try { value ? localStorage.setItem(focusKey, String(value)) : localStorage.removeItem(focusKey); } catch {}
}
const storedFocus = readFocusDeadline();
let focusUntil = storedFocus > Date.now() ? storedFocus : 0;
let focusCompleted = storedFocus > 0 && storedFocus <= Date.now();
let deskClockTimer;
let briefStories = [];
let forecast = null;
let forecastCity = 'Mumbai';
const deskRequests = new Map();

function updateDeskClock() {
  clearTimeout(deskClockTimer);
  const clock = $('#desk-time');
  if (!clock || document.hidden || view !== 'home') return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  $('#desk-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const timer = $('#focus-time');
  const remaining = Math.max(0, Math.ceil((focusUntil - now.getTime()) / 1000));
  if (focusUntil && !remaining) { focusUntil = 0; focusCompleted = true; saveFocusDeadline(0); }
  if (timer) {
    const seconds = focusUntil ? remaining : focusCompleted ? 0 : 1500;
    timer.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    $('#focus-toggle').textContent = focusUntil ? 'End session' : focusCompleted ? 'Start another session' : 'Start 25 minutes';
    $('#focus-status').textContent = focusUntil ? 'Session in progress' : focusCompleted ? 'Session complete' : 'Ready when you are';
  }
  deskClockTimer = setTimeout(updateDeskClock, (timer && focusUntil ? 1000 : 60000) - Date.now() % (timer && focusUntil ? 1000 : 60000));
}

function searchPlaceholder() {
  return (settings.ordinaryWeb ? 'Search ' + VaayvuPreferences.providerName(settings.searchProvider) : 'Search privately') + ' or enter an address';
}

function deskHero() {
  const privateTab = current().private || windowInfo.private;
  return '<header class="obs-hero' + (privateTab ? ' is-private' : '') + '">' +
    '<div class="obs-meta">' +
    '<span class="obs-wordmark"><img src="assets/vaayvu.svg" width="32" height="32" alt=""><span>Vaayvu</span></span>' +
    '<span class="obs-date">' + icon('sun') + '<span id="desk-date"></span><span aria-hidden="true"> / </span><time id="desk-time"></time></span>' +
    actButton('pref-search', settings.ordinaryWeb ? VaayvuPreferences.providerName(settings.searchProvider) : 'Private search', 'shield', 'obs-mode') + '</div>' +
    '<div class="obs-hero-content"><h1>' + (privateTab ? 'Private browsing' : 'The <em>Observatory</em>') + '</h1>' +
    '<form class="herosearch" id="hero-form">' + icon('search') +
    '<input id="hero-input" aria-label="' + searchPlaceholder() + '" placeholder="' + searchPlaceholder() + '" enterkeyhint="go" spellcheck="false" autocomplete="off" autocapitalize="none" autocorrect="off"><button aria-label="Go">' +
    icon('arrow') + '</button></form></div></header>';
}

function deskControls() {
  const controls = (options, key, currentValue) => Object.entries(options).map(([value, name]) =>
    '<button data-' + key + '="' + value + '" aria-pressed="' + (currentValue === value) + '">' +
    (key === 'landscape' ? '<i aria-hidden="true"></i>' : '') + name + '</button>').join('');
  return '<div class="obs-controls"><div class="obs-switch" role="group" aria-label="Start page view">' +
    controls(deskViews, 'desk-view', deskView) + '</div><div class="obs-looks" role="group" aria-label="Landscape">' +
    controls(observatoryLooks, 'landscape', settings.wallpaper) + '</div></div>';
}

function deskLabel(ic, title) {
  return '<h2 class="obs-label">' + icon(ic) + e(title) + '</h2>';
}

function journalCard() {
  const note = fieldNotes[noteIndex];
  return '<article class="obs-card journal">' + deskLabel('book', 'Field journal') +
    '<button class="obs-story story-' + note.art + '" data-note="read"><span class="obs-kicker">' + e(note.topic) +
    ' · Offline edition</span><strong>' + e(note.title) + '</strong><span class="story-go" aria-hidden="true">' + icon('arrow') +
    '</span></button><div class="obs-story-foot"><span>' + e(note.source) + '</span><div role="group" aria-label="Choose a field note">' +
    fieldNotes.map((entry, n) => '<button data-note="' + n + '" aria-label="' + e(entry.title) + '" aria-pressed="' + (n === noteIndex) + '"><i></i></button>').join('') +
    '</div></div></article>';
}

function libraryShelf() {
  const items = read('reading', []).filter(item => webURL(item.url));
  const seen = new Set();
  const shelf = [...items, ...saved()].filter(item => {
    const url = webURL(item.url);
    if (!url || seen.has(url)) return false;
    seen.add(url); return true;
  });
  return '<article class="obs-card shelf">' + deskLabel('bookmark', 'Reading shelf') +
    (shelf.length ? '<div class="obs-links">' + shelf.slice(0, deskView === 'reading' ? 8 : 2).map(item =>
      '<button data-url="' + e(item.url) + '">' + icon('bookmark') + '<span><strong>' + e(item.title || hostOf(item.url)) +
      '</strong><small>' + e(hostOf(item.url)) + '</small></span>' + icon('forward') + '</button>').join('') + '</div>' :
      '<strong class="obs-stat">' + saved().length + '</strong><span class="obs-detail">Saved pages</span>') +
    actButton('bookmarks', 'Open bookmarks', 'arrow', 'obs-link') + '</article>';
}

function deskNetworkAllowed() {
  return settings.ordinaryWeb && !windowInfo.private && !current().private && view === 'home';
}
function clearObservatoryNetwork() {
  for (const request of deskRequests.values()) request.abort();
  deskRequests.clear(); briefStories = []; forecast = null;
}

function weatherCard() {
  return '<article class="obs-card almanac">' + deskLabel('sun', 'Weather') +
    '<strong class="weather-stat">' + (forecast ? e(String(forecast.temp)) + '°C' : icon('sun')) + '</strong>' +
    '<span class="obs-detail">' + (forecast ? e(forecast.city) + ' · ' + e(forecast.time.replace('T', ' ')) + ' · Open-Meteo' :
      'Choose a city for its current forecast.') + '</span><button class="obs-link" data-live="weather">' + icon('globe') +
    (forecast ? 'Change city' : 'Choose city') + '</button></article>';
}
function headlinesCard() {
  return '<article class="obs-card headlines">' + deskLabel('globe', 'Tech headlines') +
    (briefStories.length ? '<div class="obs-links">' + briefStories.map(item => '<button data-url="' + e(item.url) + '"><span><strong>' +
      e(item.title) + '</strong><small>' + e(hostOf(item.url)) + '</small></span>' + icon('forward') + '</button>').join('') + '</div>' :
      '<p class="obs-description">Read the current front page of Hacker News.</p>') +
    '<button class="obs-link" data-live="headlines">' + icon('reload') + (briefStories.length ? 'Refresh headlines' : 'Get headlines') + '</button></article>';
}

function deskFavoriteCard() {
  const items = favorites.filter(item => webURL(item.url));
  return '<article class="obs-card obs-favorites"><div class="obs-card-head">' + deskLabel('star', 'Favorites') +
    actButton('favorites', 'Edit', 'edit', 'obs-link') + '</div><div class="phone-tiles obs-sites">' +
    items.slice(0, 8).map(phoneTile).join('') +
    (!items.length ? actButton('favorites', 'Add a favorite', 'plus', 'obs-link') : '') + '</div>' +
    (items.length > 8 ? actButton('phoneFavorites', 'All favorites', 'forward', 'obs-link') : '') + '</article>';
}

function workspaceCard() {
  const active = spaceTabs().filter(t => !t.private).length;
  return '<article class="obs-card obs-workspaces">' + deskLabel('layers', 'Workspace') +
    '<strong class="obs-workspace-name">' + e(spacesEnabled ? activeSpace().name : 'Current window') + '</strong><span class="obs-detail">' +
    active + (active === 1 ? ' regular tab' : ' regular tabs') + '</span><div class="obs-actions">' +
    (spacesEnabled ? actButton('spaceSheet', 'Switch space', 'layers', 'obs-link') : '') +
    actButton('manageTabs', 'Manage tabs', 'tabs', 'obs-link') + '</div></article>';
}

function shieldCard() {
  const totals = protectionTotals();
  const total = totals.ads + totals.trackers + totals.social + totals.firstparty + totals.token + totals.strict;
  const saved = estimateSavings(totals);
  return '<article class="obs-card protection">' + deskLabel('shield', 'Rasha Shield') +
    '<strong class="obs-stat">' + (adBlockConfig.enabled ? 'On' : 'Off') + '</strong><span class="obs-detail">' +
    (adBlockConfig.enabled
      ? total + ' blocked this session · est. ' + formatBytes(saved.bytes) + ' saved'
      : 'Rasha Shield is DOWN') +
    '</span>' + actButton('adBlockSettings', 'Rasha Shield', 'sliders', 'obs-link') + '</article>';
}

function home() {
  const privateTab = current().private || windowInfo.private;
  const hero = deskHero();
  const recent = privateTab ? [] : recentPages();
  let panel;
  if (privateTab) {
    panel = '<p class="privatehint">This tab keeps visits out of history, session restore and sync.</p>';
  } else if (deskView === 'focus') {
    panel = '<div class="obs-grid focus-layout"><article class="obs-card focus-clock">' + deskLabel('clock', 'Focus timer') +
      '<strong id="focus-time">25:00</strong><span id="focus-status" role="status"></span><button class="obs-primary" id="focus-toggle">Start 25 minutes</button></article>' +
      workspaceCard() + '</div>';
  } else {
    panel = '<div class="obs-grid ' + deskView + '-layout">' + (deskView === 'reading' ? libraryShelf() + journalCard() + headlinesCard() :
      journalCard() + deskFavoriteCard() + shieldCard() + workspaceCard() + weatherCard() + libraryShelf() + headlinesCard()) + '</div>';
    if (recent.length) panel += '<div class="rowhead"><h2>Pick up again</h2>' +
      actButton('history', 'History', 'forward', 'linkbtn') + '</div>' + phoneCards(recent);
    panel += '<div class="obs-actions obs-bottom">' + actButton('devices', 'Other devices', 'devices', 'obs-link') +
      actButton('reading', 'Reading list', 'book', 'obs-link') + actButton('history', 'History', 'history', 'obs-link') + '</div>';
  }
  return '<div class="observatory' + (narrowLayout.matches ? ' phone-home' : '') + '">' +
    hero + (privateTab ? '' : deskControls()) + panel + '</div>';
}

function livePanel(kind) {
  const weather = kind === 'weather';
  const source = weather ? 'Open-Meteo' : 'Hacker News via Algolia';
  dialog(weather ? 'City forecast' : 'Live tech headlines',
    '<div class="stack"><p class="muted">' + (weather ? 'Request current conditions for the selected city from ' :
      'Request front-page story titles and links from ') + source + '. The provider receives your IP address.</p>' +
    (deskNetworkAllowed() ? (weather ? '<label>City<select id="forecast-city">' + Object.keys(forecastCities).map(name =>
      '<option' + (name === forecastCity ? ' selected' : '') + '>' + e(name) + '</option>').join('') + '</select></label>' : '') +
      '<button class="primary" data-load-live="' + kind + '">' + (weather ? 'Get city forecast' : 'Load headlines') + '</button>' :
      '<p>India-only browsing pauses external requests.</p>' + actButton('pref-search', 'Open search settings', 'settings')) +
    '<p id="live-status" role="status"></p></div>', 'observatoryLive');
}
async function loadDeskData(kind) {
  if (!deskNetworkAllowed() || modal !== 'observatoryLive' || deskRequests.has(kind)) return;
  const weather = kind === 'weather';
  if (weather) forecastCity = $('#forecast-city')?.value || '';
  if (weather && !Object.hasOwn(forecastCities, forecastCity)) return;
  const city = forecastCity;
  const url = weather ? 'https://api.open-meteo.com/v1/forecast?latitude=' + forecastCities[city][0] +
    '&longitude=' + forecastCities[city][1] + '&current=temperature_2m&timezone=auto' :
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5';
  const controller = new AbortController();
  const opener = activeId;
  const button = $('[data-load-live]');
  deskRequests.set(kind, controller);
  const cityPicker = $('#forecast-city');
  if (cityPicker) cityPicker.disabled = true;
  button.disabled = true;
  $('#live-status').textContent = 'Loading…';
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!deskNetworkAllowed() || activeId !== opener || modal !== 'observatoryLive' || controller.signal.aborted || !button.isConnected) return;
    if (weather) {
      if (!Number.isFinite(data.current?.temperature_2m) || typeof data.current.time !== 'string') throw Error();
      forecast = { city, temp: Math.round(data.current.temperature_2m), time: data.current.time.slice(0, 16) };
    } else {
      if (!Array.isArray(data.hits)) throw Error();
      briefStories = data.hits.filter(hit => typeof hit.title === 'string' && webURL(hit.url)).slice(0, 5)
        .map(hit => ({ title: hit.title.slice(0, 180), url: webURL(hit.url) }));
      if (!briefStories.length) throw Error();
    }
    closeDialog(); renderContent(true);
    const trigger = $('[data-live="' + kind + '"]'); trigger?.focus({ preventScroll: true });
    trigger?.closest('article')?.scrollIntoView({block:'nearest'});
  } catch {
    if (button.isConnected && modal === 'observatoryLive') $('#live-status').textContent = 'The provider is unavailable. Try again later.';
  } finally {
    clearTimeout(timeout); button.disabled = false;
    if (cityPicker) cityPicker.disabled = false;
    if (deskRequests.get(kind) === controller) deskRequests.delete(kind);
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || view !== 'home' || windowInfo.private || current().private) return;
  if (Object.hasOwn(deskViews, button.dataset.deskView)) {
    deskView = button.dataset.deskView; renderContent(true);
    $('[data-desk-view="' + deskView + '"]').focus({ preventScroll: true });
  } else if (button.dataset.note === 'read') {
    const note = fieldNotes[noteIndex];
    dialog(note.title, '<div class="stack note-reader"><div aria-hidden="true" class="obs-story story-' + note.art +
      '"></div><p>' + e(note.body) + '</p><button class="choice" data-url="' + e(note.url) + '">' + icon('globe') + 'Read more at ' +
      e(note.source) + icon('arrow') + '</button></div>', 'fieldNote');
  } else if (button.dataset.note !== undefined && fieldNotes[Number(button.dataset.note)]) {
    noteIndex = Number(button.dataset.note); renderContent(true);
    $('[data-note="' + noteIndex + '"]').focus({preventScroll:true});
  } else if (button.id === 'focus-toggle') {
    focusUntil = focusUntil ? 0 : Date.now() + 25 * 60000; focusCompleted = false; saveFocusDeadline(focusUntil); updateDeskClock();
  } else if (['weather','headlines'].includes(button.dataset.live)) livePanel(button.dataset.live);
  else if (['weather','headlines'].includes(button.dataset.loadLive)) loadDeskData(button.dataset.loadLive);
});
