'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../chrome/onboarding.js'), 'utf8');

function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

// Mounts onboarding.js against a minimal DOM, exactly as index.html wires it.
function mount({ store = memoryStore(), capabilities = { canImportBookmarks: true }, withSync = true, signedIn = false, ordinaryWeb = true, withPrint = false, lists, reprompt = false, platform = 'mac', narrow = false, withSpaces = true, bookmarks = [], passwords = [], favorites, reading = [], withReading = true, withPreferences = true } = {}) {
  const dataset = {};
  const state = { html: '', removed: false, attrs: {}, focus: 0 };
  const catInputs = [];
  const overlay = {
    setAttribute(key, value) { state.attrs[key] = value; },
    addEventListener(type, fn) { overlay['on' + type] = fn; },
    querySelectorAll(selector) { return selector === 'input[data-cat]' ? catInputs : []; },
    remove() { state.removed = true; },
  };
  const fixInputs = [];
  const phraseInputs = [];
  const step = {
    set innerHTML(value) { state.html = value; },
    get innerHTML() { return state.html; },
    querySelector() { return { focus() { state.focus += 1; } }; },
    querySelectorAll(selector) {
      if (selector === 'input[data-fix-field]') return fixInputs;
      if (selector === 'input[data-phrase-word]') return phraseInputs;
      return [];
    },
  };
  const timers = [];
  const calls = {
    write: [], sendBlocklist: 0, reload: null, drawBar: 0, toast: [], command: [], events: [], commits: [],
    spaceUpdates: [], spacesSaved: 0, spaceThemeApplied: 0, themeApplied: 0, uiRenders: [], copied: [], prints: 0,
    sent: [],
  };
  const adBlockConfig = {
    enabled: false,
    lists: lists || { ads: true, trackers: true, social: true, cosmetic: true, aggressive: true },
    custom: [],
    pausedSites: [],
  };
  const capabilitiesRef = capabilities;
  const context = {
    window: {
      __vaayvuBoot: {
        show: true,
        reprompt,
        route: reprompt ? 'vaayvu://onboarding/s-003' : 'vaayvu://onboarding/s-001',
        phase: 'p00',
      },
      vaayvuEvent(message) { calls.events.push(message); },
      ...(withPrint ? { print: () => { calls.prints += 1; } } : {}),
    },
    navigator: { clipboard: { writeText: async (text) => { calls.copied.push(text); } } },
    document: {
      documentElement: { dataset },
      getElementById: (id) => (id === 'onboarding' ? overlay : id === 'onboarding-step' ? step : null),
    },
    localStorage: store,
    BROWSER_VERSION: '0.0.23',
    send: (message) => { calls.sent.push(message); return true; },
    adBlockConfig,
    write: (key, value) => calls.write.push([key, JSON.parse(JSON.stringify(value))]),
    sendBlocklist: (reload) => { calls.sendBlocklist += 1; calls.reload = reload; },
    drawBar: () => { calls.drawBar += 1; },
    toast: (message) => calls.toast.push(message),
    command: (action) => calls.command.push(action),
    capabilities: capabilitiesRef,
    sync: withSync ? { profileKey: 'user', session: signedIn ? { username: 'mahesh' } : null } : undefined,
    bookmarks,
    passwords,
    favorites,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    addManyBookmarks: (items) => {
      let added = 0;
      const known = new Set(bookmarks.map((item) => item.url));
      for (const item of items) {
        const url = String(item.url || '');
        if (!/^https?:\/\//i.test(url) || known.has(url) || bookmarks.length >= 2000) continue;
        bookmarks.push({ url, title: item.title || '' });
        known.add(url);
        added += 1;
      }
      return added;
    },
    read: withReading ? (key, fallback) => (key === 'reading' ? reading : fallback) : undefined,
    settings: {
      searchProvider: 'duckduckgo', telemetryConsent: false, ordinaryWeb,
      theme: 'system', tabPosition: 'top', wallpaper: 'observatory',
    },
    VaayvuPreferences: withPreferences ? { commit: (patch) => calls.commits.push(patch) } : undefined,
    platform,
    narrowLayout: { matches: narrow },
    spaceStore: withSpaces
      ? {
          update: (state, id, patch) => {
            calls.spaceUpdates.push({ id, ...patch });
            return { ...state, list: state.list.map((space) => (space.id === id ? { ...space, ...patch } : space)) };
          },
        }
      : null,
    spaces: { active: 'personal', list: [{ id: 'personal', name: 'Personal', emoji: 'sea', theme: 'aurora', createdAt: 1 }] },
    saveSpaces: () => { calls.spacesSaved += 1; },
    applySpaceTheme: () => { calls.spaceThemeApplied += 1; },
    applyTheme: () => { calls.themeApplied += 1; },
    render: (force) => { calls.uiRenders.push(force); },
    VaayvuSpaces: {
      THEME_IDS: ['aurora', 'ember', 'forest', 'ocean', 'rose', 'graphite'],
      THEMES: {
        aurora: { name: 'Aurora' }, ember: { name: 'Ember' }, forest: { name: 'Forest' },
        ocean: { name: 'Ocean' }, rose: { name: 'Rose' }, graphite: { name: 'Graphite' },
      },
    },
    Date,
    JSON,
  };
  runInNewContext(source, context);
  const click = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: name } } : null) },
    });
  const clickShield = (level) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-shield]' ? { dataset: { shield: level } } : null) },
    });
  const clickCarry = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-carry]' ? { dataset: { carry: name } } : null) },
    });
  const clickSource = (id) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-source]' ? { dataset: { source: id } } : null) },
    });
  const clickSafe = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-safe]' ? { dataset: { safe: name } } : null) },
    });
  const change = (target) => overlay.onchange({ target });
  const setCategories = (values) => {
    catInputs.length = 0;
    for (const [cat, checked] of Object.entries(values)) catInputs.push({ dataset: { cat }, checked });
  };
  setCategories({ ads: true, trackers: true, social: true, cosmetic: true, aggressive: true });
  const runTimers = () => { while (timers.length) timers.shift()(); };
  const setFixInputs = (values) => {
    fixInputs.length = 0;
    for (const [field, value] of Object.entries(values)) fixInputs.push({ dataset: { fixField: field }, value });
  };
  const setPhraseInputs = (values) => {
    phraseInputs.length = 0;
    for (const [position, value] of Object.entries(values)) phraseInputs.push({ dataset: { phraseWord: position }, value });
  };
  return { dataset, state, overlay, step, calls, adBlockConfig, store, click, clickShield, clickCarry, clickSource, clickSafe, change, setCategories, runTimers, setFixInputs, setPhraseInputs, context };
}

test('s-001 renders the boot splash with Continue and Skip', () => {
  const m = mount();
  assert.match(m.state.html, /splash-logo/);
  assert.match(m.state.html, /Vaayvu/);
  assert.match(m.state.html, /under 300 ms/);
  assert.match(m.state.html, /Crash-loop guard/);
  assert.match(m.state.html, /5 s/);
  assert.match(m.state.html, /data-onboard="continue">Continue</);
  assert.match(m.state.html, /data-onboard="skip">Skip onboarding</);
  assert.match(m.state.html, /Step 1 of 6/);
  assert.doesNotMatch(m.state.html, /data-cat=/);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Boot/splash');
  assert.ok(m.state.focus >= 1, 'primary button receives focus');
});

test('Continue from the splash advances to s-002 without writing settings', () => {
  const m = mount();
  m.click('continue');
  assert.equal(m.calls.write.length, 0, 'no shield write before welcome');
  assert.equal(m.calls.sendBlocklist, 0);
  assert.match(m.state.html, /Ads, trackers and popups blocked by default/);
  assert.match(m.state.html, /data-onboard="start">Get started</);
  assert.match(m.state.html, /data-onboard="back">Back</);
  assert.match(m.state.html, /Step 2 of 6/);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
  assert.equal(m.state.attrs['aria-label'], 'Welcome');
});

test('privacy setup matches the atlas controls without extra category switches', () => {
  const m = mount();
  m.click('continue');
  m.click('start');
  assert.match(m.state.html, /data-priv="search"/);
  assert.match(m.state.html, /data-shield="standard"/);
  assert.match(m.state.html, /data-priv="telemetry"/);
  assert.doesNotMatch(m.state.html, /data-cat=/);
  m.click('next');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-012');
  assert.equal(m.calls.write.length, 0, 'privacy setup does not write shield lists');
});

test('import and sync choices are capability-gated per platform', () => {
  const both = mount();
  both.click('continue');
  assert.match(both.state.html, /data-onboard="import">/);
  assert.match(both.state.html, /data-onboard="sync">/);

  const gated = mount({ capabilities: { canImportBookmarks: false }, withSync: false });
  gated.click('continue');
  assert.doesNotMatch(gated.state.html, /data-onboard="import"/);
  assert.doesNotMatch(gated.state.html, /data-onboard="sync"/);
  assert.match(gated.state.html, /data-onboard="start">Get started</, 'welcome still completes');
});

test('choosing import or sync runs the browser command', () => {
  const m = mount();
  m.click('continue');
  m.click('import');
  m.click('sync');
  assert.deepEqual(m.calls.command, ['bookmarkImport', 'account']);
  assert.equal(m.state.removed, false, 'choices do not end the flow');
});

test('Continue completes with route s-051, phase p05 and all six steps', () => {
  const m = mount({ store: memoryStore({ 'vaayvu.onboardingAttempts': '2' }) });
  m.click('continue');
  m.click('start');
  assert.match(m.state.html, /data-onboard="next">Continue</, 's-011 advances, not finishes');
  m.click('next');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-012');
  m.click('next');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-015', 's-012 advances to the checklist');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  m.click('next');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-051', 's-015 advances to the start page');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  m.click('finish');
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.route, 'vaayvu://start-page/s-051');
  assert.equal(record.phase, 'p05');
  assert.deepEqual(record.steps, ['s-001', 's-002', 's-011', 's-012', 's-015', 's-051']);
  assert.equal('categories' in record, false, 'categories are not part of onboarding now');
  assert.deepEqual(record.checklist, { bookmarks: 0, sync: false, passwords: 0, extensions: 0 });
  assert.ok(Number.isFinite(record.completedAt));
  assert.equal(m.store.has('vaayvu.onboardingAttempts'), false, 'attempt counter cleared');
  assert.equal(m.state.removed, true);
  assert.equal(m.dataset.onboarding, 'hide');
  assert.deepEqual(m.calls.toast, ['Rasha Shield is on']);
});

test('Back from s-011 returns to the welcome step', () => {
  const m = mount();
  m.click('continue');
  m.click('start');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-011');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
  assert.match(m.state.html, /Step 2 of 6/);
  assert.equal(m.store.getItem('vaayvu.onboarding'), null, 'nothing recorded yet');
});

test('privacy setup controls write the real settings', () => {
  const m = mount({ capabilities: { canImportBookmarks: true, canDnsSettings: true } });
  m.click('continue');
  m.click('start');
  // Search engine → VaayvuPreferences.commit
  m.change({ dataset: { priv: 'search' }, value: 'google' });
  assert.equal(m.calls.commits.length, 1);
  assert.equal(m.calls.commits[0].searchProvider, 'google');
  // Anonymous usage opt-in → stored consent
  m.change({ dataset: { priv: 'telemetry' }, checked: true });
  assert.equal(m.calls.commits.length, 2);
  assert.equal(m.calls.commits[1].telemetryConsent, true);
  // Shield level → writes the VFD policy and pushes the blocklist
  assert.equal(m.adBlockConfig.lists.aggressive, true, 'Strong is the default');
  const sendsBefore = m.calls.sendBlocklist;
  const writesBefore = m.calls.write.length;
  m.clickShield('standard');
  assert.equal(m.adBlockConfig.lists.aggressive, false);
  assert.equal(m.calls.sendBlocklist, sendsBefore + 1, 'blocklist pushed on change');
  assert.equal(m.calls.write.length, writesBefore + 1);
  assert.equal(m.calls.write[m.calls.write.length - 1][0], 'adBlock');
  assert.match(m.state.html, /data-shield="standard" aria-pressed="true"/, 'segment follows the choice');
  m.clickShield('strong');
  assert.equal(m.adBlockConfig.lists.aggressive, true);
  assert.equal(m.calls.sendBlocklist, sendsBefore + 2);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-011', 'still on the step');
});

test('Back from welcome returns to the splash and back again is stable', () => {
  const m = mount();
  m.click('continue');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  assert.match(m.state.html, /splash-wordmark/);
  assert.match(m.state.html, /data-onboard="continue">Continue</);
  m.click('continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});

test('Skip at s-001 finishes the whole flow without reaching s-002', () => {
  const m = mount({ store: memoryStore({ 'vaayvu.onboardingAttempts': '1' }) });
  m.click('skip');
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'skipped');
  assert.equal(record.route, 'vaayvu://onboarding/s-001');
  assert.deepEqual(record.steps, ['s-001']);
  assert.equal('categories' in record, false, 'recommended defaults stay untouched');
  assert.equal(m.calls.write.length, 0, 'no settings written on skip');
  assert.equal(m.state.removed, true);
  assert.equal(m.dataset.onboarding, 'hide');
  assert.deepEqual(m.calls.toast, ['Using recommended protection']);
});

test('capabilities arriving on step 2 re-render the choices', () => {
  const capabilities = {};
  const m = mount({ capabilities });
  m.click('continue');
  assert.doesNotMatch(m.state.html, /data-onboard="import"/, 'ready has not arrived yet');
  capabilities.canImportBookmarks = true;
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'ios' });
  assert.match(m.state.html, /data-onboard="import"/, 'choice appears once the platform reports it');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002', 'stays on the same step');
  assert.deepEqual(m.calls.events, [{ type: 'ready', platform: 'ios' }], 'the original handler still runs');
});

const S003_CAPS = { canImportBookmarks: true, canDefaultBrowser: true };

function storeWith(record) {
  const map = new Map([['vaayvu.onboarding', JSON.stringify(record)]]);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

function deferredPrior(over = {}) {
  return {
    route: 'vaayvu://onboarding/s-003',
    phase: 'p00',
    status: 'done',
    steps: ['s-001', 's-002', 's-003'],
    categories: { ads: true, social: false },
    defaultBrowser: 'deferred',
    defaultBrowserPrompts: 1,
    deferredAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    completedAt: 1,
    ...over,
  };
}

test('Get started advances from s-002 to the s-011 privacy setup', () => {
  const m = mount({ capabilities: S003_CAPS });
  m.click('continue');
  m.click('start');
  // s-011 renders, not s-003 and not a finish.
  assert.match(m.state.html, /Search engine/);
  assert.match(m.state.html, /Shield level/);
  assert.match(m.state.html, /Anonymous usage data/);
  assert.match(m.state.html, /Step 3 of 6 · Privacy setup/);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-011');
  assert.equal(m.state.attrs['aria-label'], 'Privacy setup');
  assert.equal(m.state.removed, false, 'privacy setup waits for Start browsing');
  const record = m.store.getItem('vaayvu.onboarding');
  assert.equal(record, null, 'nothing recorded until the flow finishes');
});

test('the privacy setup shows on every platform; DNS row is capability-gated', () => {
  const plain = mount(); // no canDefaultBrowser, no canDnsSettings
  plain.click('continue');
  plain.click('start');
  assert.match(plain.state.html, /Search engine/);
  assert.doesNotMatch(plain.state.html, /data-onboard="dns"/, 'no DNS row without the capability');
  const withDns = mount({ capabilities: { canImportBookmarks: true, canDnsSettings: true } });
  withDns.click('continue');
  withDns.click('start');
  assert.match(withDns.state.html, /data-onboard="dns">/);
  withDns.click('dns');
  assert.deepEqual(withDns.calls.command, ['dnsSettings'], 'the real deep link fires');
  assert.equal(withDns.state.removed, false, 'the DNS row does not end the flow');
});

test('the s-003 screen itself still works through the deferred re-prompt', () => {
  const m = mount({ store: storeWith(deferredPrior()), reprompt: true, capabilities: S003_CAPS });
  assert.match(m.state.html, /Links from apps and messages open in Vaayvu/);
  assert.match(m.state.html, /data-onboard="default">Set as default</);
  assert.match(m.state.html, /data-onboard="notnow">Not now</);
  assert.match(m.state.html, /Opens your device’s default-browser setting/);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-003');
  assert.equal(m.state.attrs['aria-label'], 'Default browser request');
  m.click('default');
  assert.deepEqual(m.calls.command, ['requestDefaultBrowser'], 'the real deep link fires');
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.route, 'vaayvu://onboarding/s-003');
  assert.equal(record.defaultBrowser, 'requested');
  assert.deepEqual(record.steps, ['s-001', 's-002', 's-003']);
  assert.equal(m.state.removed, true);
  assert.equal(m.dataset.onboarding, 'hide');
});

test('Not now from the re-prompt defers again with a higher prompt count', () => {
  const m = mount({ store: storeWith(deferredPrior()), reprompt: true, capabilities: S003_CAPS });
  m.click('notnow');
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.route, 'vaayvu://onboarding/s-003');
  assert.equal(record.defaultBrowser, 'deferred');
  assert.equal(record.defaultBrowserPrompts, 2, 'prior prompt counted');
  assert.ok(Date.now() - record.deferredAt < 5000, 'deferredAt stamped now');
  assert.equal(m.state.removed, true);
});

test('a re-prompt on a platform without the capability completes without a dead screen', () => {
  const m = mount({ store: storeWith(deferredPrior()), reprompt: true, capabilities: {} });
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.defaultBrowser, 'unsupported', 'no further re-prompts');
  assert.equal(m.state.removed, true);
  assert.equal(m.dataset.onboarding, 'hide');
  assert.doesNotMatch(m.state.html, /data-onboard="default"/, 'no button that cannot work');
});

test('a deferred re-prompt shows only s-003 and keeps prior progress', () => {
  const m = mount({ store: storeWith(deferredPrior()), reprompt: true, capabilities: S003_CAPS });
  assert.match(m.state.html, /data-onboard="default">Set as default</);
  assert.doesNotMatch(m.state.html, /data-cat=/, 'no category step on a re-prompt');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-003');
  m.click('notnow');
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.defaultBrowserPrompts, 2, 'prompt counted for the next re-prompt');
  assert.deepEqual(record.steps, ['s-001', 's-002', 's-003'], 'progress preserved');
  assert.deepEqual(record.categories, { ads: true, social: false }, 'categories preserved');
  assert.equal(m.state.removed, true);
});

const openAppearance = (options) => {
  const m = mount(options);
  m.click('continue');
  m.click('start');
  m.click('next');
  return m;
};

test('s-012 renders theme, tab position, accent and wallpaper', () => {
  const m = openAppearance();
  assert.match(m.state.html, /data-priv="theme"/);
  assert.match(m.state.html, /data-priv="tab"/);
  assert.match(m.state.html, /data-priv="accent"/);
  assert.match(m.state.html, /data-priv="wallpaper"/);
  assert.match(m.state.html, />Observatory</, 'wallpaper list is real');
  assert.match(m.state.html, />Alpine dusk</);
  assert.match(m.state.html, />Aurora</, 'accent names come from VaayvuSpaces');
  assert.match(m.state.html, /data-onboard="next">Continue</);
  assert.match(m.state.html, /Step 4 of 6 · Appearance setup/);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-012');
  assert.equal(m.state.attrs['aria-label'], 'Appearance setup');
  assert.equal(m.state.removed, false, 'waits for Continue');
});

test('tab position and accent rows are capability-gated', () => {
  const phone = openAppearance({ platform: 'android', narrow: true });
  assert.doesNotMatch(phone.state.html, /data-priv="tab"/, 'no tab row in phone layout');
  assert.match(phone.state.html, /data-priv="theme"/, 'theme is always there');
  const ios = openAppearance({ platform: 'ios' });
  assert.doesNotMatch(ios.state.html, /data-priv="tab"/, 'no tab row on iOS');
  const noSpaces = openAppearance({ withSpaces: false });
  assert.doesNotMatch(noSpaces.state.html, /data-priv="accent"/, 'no accent without spaces');
  assert.match(noSpaces.state.html, /data-priv="wallpaper"/, 'wallpaper stays');
});

test('appearance controls write the real settings', () => {
  const m = openAppearance();
  m.change({ dataset: { priv: 'theme' }, value: 'dark' });
  assert.equal(m.calls.commits.length, 1);
  assert.equal(m.calls.commits[0].theme, 'dark');
  m.change({ dataset: { priv: 'wallpaper' }, value: 'ridge' });
  assert.equal(m.calls.commits[1].wallpaper, 'ridge');
  assert.equal(m.calls.themeApplied, 1, 'start page repaints with the wallpaper');
  m.change({ dataset: { priv: 'tab' }, value: 'left' });
  assert.equal(m.calls.commits[2].tabPosition, 'left');
  assert.deepEqual(m.calls.uiRenders, [true], 'tab strip repositions immediately');
  m.change({ dataset: { priv: 'accent' }, value: 'ember' });
  assert.equal(m.calls.spaceUpdates.length, 1, 'active space theme updated');
  assert.equal(m.calls.spaceUpdates[0].theme, 'ember');
  assert.equal(m.calls.spacesSaved, 1);
  assert.equal(m.calls.spaceThemeApplied, 1);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-012', 'stays on the step');
});

test('Back from s-012 returns to the privacy setup', () => {
  const m = openAppearance();
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-011');
  assert.match(m.state.html, /Step 3 of 6/);
  assert.equal(m.store.getItem('vaayvu.onboarding'), null, 'nothing recorded until finish');
});


const ALL_SETUP = {
  canImportBookmarks: true,
  canDefaultBrowser: true,
  canImportPasswords: true,
  canUserStyles: true,
};
const openChecklist = (options) => {
  const m = openAppearance(options);
  m.click('next');
  return m;
};

test('s-015 renders the five setup rows with real actions', () => {
  const m = openChecklist({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-015');
  assert.equal(m.state.attrs['aria-label'], 'Onboarding checklist');
  assert.match(m.state.html, /Step 5 of 6 · Onboarding checklist/);
  assert.match(m.state.html, /Import bookmarks/);
  assert.match(m.state.html, /Sync with Vaayvu ID/);
  assert.match(m.state.html, /Set Vaayvu as default/);
  assert.match(m.state.html, /Import passwords/);
  assert.match(m.state.html, /Add an extension/);
  assert.match(m.state.html, /data-carry="import"/);
  assert.match(m.state.html, /data-carry="password"/);
  assert.match(m.state.html, /type="file"[^>]*data-import-passwords/, 'hidden CSV picker is present');
  assert.match(m.state.html, /data-onboard="next">Continue</);
  assert.match(m.state.html, /Step 5 of 6 · Onboarding checklist/);
  assert.equal(m.state.removed, false, 'checklist waits for Continue');
});

test('the checklist rows are capability-gated', () => {
  const bare = openChecklist({ capabilities: {}, withSync: false });
  assert.match(bare.state.html, /Import bookmarks/, 'import has no platform gate');
  assert.doesNotMatch(bare.state.html, /Sync with Vaayvu ID/);
  assert.doesNotMatch(bare.state.html, /Set Vaayvu as default/);
  assert.doesNotMatch(bare.state.html, /Import passwords/);
  assert.doesNotMatch(bare.state.html, /Add an extension/);
  const noPasswords = openChecklist({ capabilities: { ...ALL_SETUP, canImportPasswords: false } });
  assert.doesNotMatch(noPasswords.state.html, /Import passwords/);
  const noExtensions = openChecklist({ capabilities: { ...ALL_SETUP, canUserStyles: false } });
  assert.doesNotMatch(noExtensions.state.html, /Add an extension/);
  const noDefault = openChecklist({ capabilities: { ...ALL_SETUP, canDefaultBrowser: false } });
  assert.doesNotMatch(noDefault.state.html, /Set Vaayvu as default/);
});

test('checklist actions open the real surfaces and stay on the checklist', () => {
  const m = openChecklist({ capabilities: ALL_SETUP });
  m.clickCarry('import');
  m.clickCarry('sync');
  m.clickCarry('default');
  m.clickCarry('extension');
  assert.deepEqual(m.calls.command, ['bookmarkImport', 'account', 'requestDefaultBrowser', 'extensions']);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-015', 'still on the checklist');
  assert.equal(m.state.removed, false);
  assert.equal(m.store.getItem('vaayvu.onboarding'), null, 'nothing recorded until Start browsing');
});

test('checklist marks come from live device state, never guesses', () => {
  const m = openChecklist({
    capabilities: ALL_SETUP,
    signedIn: true,
    bookmarks: [{ id: 'b1' }, { id: 'b2' }],
    passwords: [{ site: 'https://a.example', username: 'me', password: 'x', at: 1 }],
    store: memoryStore({ 'vaayvu.styleExtension.wikipedia': '{}' }),
  });
  assert.match(m.state.html, /Imported/);
  assert.match(m.state.html, /Signed in/);
  assert.match(m.state.html, /1 saved/);
  assert.match(m.state.html, /Added/);
  assert.doesNotMatch(m.state.html, /data-carry="import"/, 'completed rows drop their action');
  assert.doesNotMatch(m.state.html, /data-carry="password"/);
  // The OS default-browser setting cannot be read from the page, so that row
  // keeps its action and never claims success.
  assert.match(m.state.html, /data-carry="default"/);
});

test('the password CSV importer merges real entries and re-renders', async () => {
  const m = openChecklist({ capabilities: ALL_SETUP });
  const csv =
    'name,url,username,password\n"GitHub","https://github.com","octo","s3cret"\n"Mail","https://mail.example","me","pa""ss"\n';
  m.change({ dataset: { importPasswords: '' }, files: [{ text: async () => csv }] });
  await new Promise((resolve) => setImmediate(resolve));
  const saved = m.context.passwords;
  assert.equal(saved.length, 2);
  assert.equal(saved[0].site, 'https://github.com');
  assert.equal(saved[0].username, 'octo');
  assert.equal(saved[1].password, 'pa"ss', 'doubled quotes decode');
  const written = m.calls.write.find(([key]) => key === 'passwords');
  assert.ok(written, 'import writes the same local store the Passwords dialog uses');
  assert.equal(m.calls.toast.pop(), '2 passwords imported.');
  assert.match(m.state.html, /2 saved/, 'checklist reflects the import immediately');
  // Importing the same file again updates instead of duplicating.
  m.change({ dataset: { importPasswords: '' }, files: [{ text: async () => csv }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(m.context.passwords.length, 2, 'site + username stays the identity');
});

test('an unreadable or empty password file changes nothing', async () => {
  const m = openChecklist({ capabilities: ALL_SETUP });
  m.change({ dataset: { importPasswords: '' }, files: [{ text: async () => 'not,a,password,file\n1,2,3,4\n' }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(m.context.passwords.length, 0);
  assert.equal(m.calls.toast.pop(), 'No passwords found in that file.');
});

test('Back from s-015 returns to appearance setup', () => {
  const m = openChecklist({ capabilities: ALL_SETUP });
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-012');
  assert.match(m.state.html, /Step 4 of 6 · Appearance setup/);
});


const openStart = (options) => {
  const m = openChecklist(options);
  m.click('next');
  return m;
};
const START_FAVS = [
  { title: 'GitHub', url: 'https://github.com/' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
];

test('s-051 shows the start page logo, search, shortcuts, reading list and Continue', () => {
  const m = openStart({
    capabilities: ALL_SETUP,
    favorites: START_FAVS,
    reading: [{ url: 'https://example.com/a', title: 'A' }],
  });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-051');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.state.attrs['aria-label'], 'Start default');
  assert.match(m.state.html, /Step 6 of 6 · Start default/);
  assert.match(m.state.html, /assets\/vaayvu\.svg/, 'the real logo is shown');
  assert.match(m.state.html, /data-priv="search"/, 'search engine row is live');
  assert.match(m.state.html, />Shortcuts</);
  assert.match(m.state.html, />GitHub</);
  assert.match(m.state.html, />Wikipedia</);
  assert.match(m.state.html, />Reading list</);
  assert.match(m.state.html, /1 page saved/);
  assert.match(m.state.html, /data-onboard="finish">Continue</);
  assert.equal(m.state.removed, false, 'waits for Continue');
});

test('start page shortcuts, reading list and search are capability-gated', () => {
  const noFavs = openStart({ capabilities: ALL_SETUP, favorites: null });
  assert.doesNotMatch(noFavs.state.html, />Shortcuts</);
  assert.match(noFavs.state.html, /data-priv="search"/, 'search stays');
  const noReading = openStart({ capabilities: ALL_SETUP, favorites: START_FAVS, withReading: false });
  assert.doesNotMatch(noReading.state.html, />Reading list</);
  const noPrefs = openStart({ capabilities: ALL_SETUP, favorites: START_FAVS, withPreferences: false });
  assert.doesNotMatch(noPrefs.state.html, /data-priv="search"/);
  assert.match(noPrefs.state.html, /data-onboard="finish">Continue</, 'Continue is always there');
});

test('choosing the search engine on s-051 writes the real preference', () => {
  const m = openStart({ capabilities: ALL_SETUP, favorites: START_FAVS });
  m.change({ dataset: { priv: 'search' }, value: 'bing' });
  assert.equal(m.calls.commits.length, 1);
  assert.equal(m.calls.commits[0].searchProvider, 'bing');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-051', 'stays on the step');
});

test('Back from s-051 returns to the setup checklist', () => {
  const m = openStart({ capabilities: ALL_SETUP, favorites: START_FAVS });
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-015');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.match(m.state.html, /Step 5 of 6 · Onboarding checklist/);
});


const openImport = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-004');
  return m;
};

test('s-004 lists all eleven import sources with its own route and phase', () => {
  const m = openImport({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-004');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Import source picker');
  for (const name of ['Chrome', 'Edge', 'Brave', 'Safari', 'Firefox', 'Opera', 'Vivaldi', 'HTML file', 'CSV file', '1Password', 'Bitwarden']) {
    assert.match(m.state.html, new RegExp('>' + name + '<'), name + ' is offered');
  }
  assert.match(m.state.html, /Import source picker/);
  assert.match(m.state.html, /data-onboard="back">Back</);
  assert.equal(m.state.removed, false, 'screen waits for an action');
});

test('import sources are capability-gated by kind', () => {
  const bookmarksOnly = openImport({ capabilities: { canImportBookmarks: true, canImportPasswords: false } });
  assert.match(bookmarksOnly.state.html, />Chrome</);
  assert.match(bookmarksOnly.state.html, />HTML file</);
  assert.doesNotMatch(bookmarksOnly.state.html, />1Password</);
  assert.doesNotMatch(bookmarksOnly.state.html, /data-import-passwords/);

  const passwordsOnly = openImport({ capabilities: { canImportBookmarks: false, canImportPasswords: true } });
  assert.doesNotMatch(passwordsOnly.state.html, />Chrome</);
  assert.doesNotMatch(passwordsOnly.state.html, />HTML file</);
  assert.match(passwordsOnly.state.html, />CSV file</);
  assert.match(passwordsOnly.state.html, />1Password</);
  assert.match(passwordsOnly.state.html, />Bitwarden</);
  assert.match(passwordsOnly.state.html, /data-import-passwords/, 'CSV picker appears with the password group');

  const none = openImport({ capabilities: {} });
  assert.match(none.state.html, /not available on this device/);
  assert.doesNotMatch(none.state.html, /data-source=/);
});

test('a browser source shows real export steps and opens the bookmark picker', () => {
  const m = openImport({ capabilities: ALL_SETUP, withPreferences: false });
  m.clickSource('chrome');
  assert.match(m.state.html, /From Chrome/);
  assert.match(m.state.html, /Bookmark manager → Export bookmarks/);
  assert.match(m.state.html, /data-carry="import">Choose file</);
  assert.equal(m.state.attrs['aria-label'], 'Import source picker');
  m.clickCarry('import');
  assert.deepEqual(m.calls.command, ['bookmarkImport']);
});

test('1Password, Bitwarden and CSV use the CSV importer', () => {
  for (const id of ['csv', '1password', 'bitwarden']) {
    const m = openImport({ capabilities: ALL_SETUP });
    m.clickSource(id);
    assert.match(m.state.html, /data-carry="password">Choose CSV</, id + ' offers the CSV picker');
    assert.match(m.state.html, /data-import-passwords/);
  }
  const m = openImport({ capabilities: ALL_SETUP });
  m.clickSource('1password');
  assert.match(m.state.html, /File → Export → CSV/);
});

test('Back from s-004 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue'); // s-002
  m.context.window.__vaayvuOnboardingOpen('s-004');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-004');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
  assert.match(m.state.html, /data-onboard="start">Get started</);
});


const openImportProcess = (options, job) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-005', job);
  return m;
};
const BOOKMARK_FILE = (links) => '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>' + links + '</DL>';

test('s-005 idle state is honest before an import starts', () => {
  const m = openImportProcess({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-005');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Import progress');
  assert.match(m.state.html, /No import in progress/);
  assert.match(m.state.html, /data-onboard="back">Back</);
  assert.doesNotMatch(m.state.html, /data-import-cancel/);
  assert.match(m.state.html, /Import progress/);
});

test('s-005 reports real bookmark counts and partial failure', () => {
  const m = openImportProcess(
    { capabilities: ALL_SETUP, bookmarks: [{ url: 'https://dup.example/' }] },
    {
      sourceId: 'chrome',
      kind: 'bookmarks',
      text: BOOKMARK_FILE(
        '<DT><A HREF="https://a.example/">A</A>' +
          '<DT><A HREF="https://dup.example/">Dup</A>' +
          '<DT><A HREF="javascript:void(0)">Bad</A>',
      ),
    },
  );
  assert.match(m.state.html, /From|Chrome|Import summary/);
  assert.match(m.state.html, /Imported 1 of 3 bookmarks/);
  assert.match(m.state.html, /Skipped 2 — duplicates, invalid addresses or the 2,000-bookmark limit/);
  assert.match(m.state.html, /data-status="partial"/);
  assert.match(m.state.html, /data-onboard="back">Done</);
  assert.equal(m.context.bookmarks.filter((b) => b.url === 'https://a.example/').length, 1);
});

test('s-005 reports a clean bookmark import', () => {
  const m = openImportProcess(
    { capabilities: ALL_SETUP },
    {
      sourceId: 'firefox',
      kind: 'bookmarks',
      text: BOOKMARK_FILE('<DT><A HREF="https://a.example/">A</A><DT><A HREF="https://b.example/">B</A>'),
    },
  );
  assert.match(m.state.html, /Imported all 2 bookmarks/);
  assert.match(m.state.html, /data-status="done"/);
  assert.doesNotMatch(m.state.html, /data-status="partial"/);
});

test('s-005 imports password CSV rows and names skipped rows', () => {
  const m = openImportProcess(
    { capabilities: ALL_SETUP },
    {
      sourceId: '1password',
      kind: 'passwords',
      text: 'name,url,username,password\nA,https://a.example,user,pass\nB,https://b.example,user,\nC,https://c.example,user,pass2',
    },
  );
  assert.match(m.state.html, /Imported 2 of 3 passwords/);
  assert.match(m.state.html, /Skipped 1 row — the website, username or password was missing/);
  assert.match(m.state.html, /data-status="partial"/);
  assert.equal(m.context.passwords.length, 2);
});

test('s-005 cancels between batches and stops adding', () => {
  const links = Array.from({ length: 60 }, (_, n) => '<DT><A HREF="https://s' + n + '.example/">S' + n + '</A>').join('');
  const m = openImportProcess(
    { capabilities: ALL_SETUP },
    { sourceId: 'html', kind: 'bookmarks', text: BOOKMARK_FILE(links) },
  );
  assert.match(m.state.html, /Importing your data/);
  assert.match(m.state.html, /25 of 60/);
  assert.match(m.state.html, /data-import-cancel>Cancel</);
  const before = m.context.bookmarks.length;
  assert.equal(before, 25, 'first batch landed');
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-import-cancel]' ? {} : null) },
  });
  assert.match(m.state.html, /Import cancelled/);
  assert.match(m.state.html, /Imported 25 of 60 bookmarks before you cancelled/);
  m.runTimers();
  assert.equal(m.context.bookmarks.length, before, 'queued batches stop after cancel');
});

test('s-005 refuses an import the platform does not support', () => {
  const m = openImportProcess(
    { capabilities: { canImportBookmarks: false, canImportPasswords: false } },
    {
      sourceId: 'chrome',
      kind: 'bookmarks',
      text: BOOKMARK_FILE('<DT><A HREF="https://a.example/">A</A>'),
    },
  );
  assert.match(m.state.html, /This import is not available/);
  assert.match(m.state.html, /data-status="unavailable"/);
  assert.equal(m.context.bookmarks.length, 0);
});

test('Done on s-005 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-005', {
    sourceId: 'chrome',
    kind: 'bookmarks',
    text: BOOKMARK_FILE('<DT><A HREF="https://a.example/">A</A>'),
  });
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const openImportResults = (options, job) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-006', job);
  return m;
};
const clickFixOpen = (m, index) =>
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-fix-open]' ? { dataset: { fixOpen: String(index) } } : null) },
  });
const clickFixSave = (m, index) =>
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-fix-save]' ? { dataset: { fixSave: String(index) } } : null) },
  });

test('s-006 idle state is honest and returns', () => {
  const m = openImportResults({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-006');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Import results');
  assert.match(m.state.html, /No import results yet/);
  assert.match(m.state.html, /data-onboard="back">Back</);
  assert.doesNotMatch(m.state.html, /onboarding-counts/);
  assert.match(m.state.html, /Import results/);
});

test('s-006 shows counts, skip reasons and a working bookmark fix link', () => {
  const m = openImportResults(
    { capabilities: ALL_SETUP, bookmarks: [{ url: 'https://dup.example/' }] },
    {
      sourceId: 'chrome',
      kind: 'bookmarks',
      text: BOOKMARK_FILE(
        '<DT><A HREF="https://a.example/">A</A>' +
          '<DT><A HREF="https://dup.example/">Dup</A>' +
          '<DT><A HREF="javascript:void(0)">Bad</A>',
      ),
    },
  );
  assert.match(m.state.html, /Chrome/);
  assert.match(m.state.html, /Import results/);
  assert.match(m.state.html, />3<\/strong><small>Found</);
  assert.match(m.state.html, />1<\/strong><small>Imported</);
  assert.match(m.state.html, /data-skipped="true"><strong>2<\/strong><small>Skipped</);
  assert.match(m.state.html, /What was skipped/);
  assert.match(m.state.html, /Already saved/);
  assert.match(m.state.html, /Not a website address/);
  assert.match(m.state.html, /data-fix-open="1">Fix</, 'the bad address is fixable');
  assert.doesNotMatch(m.state.html, /data-fix-open="0"/, 'a duplicate is not fixable here');
  clickFixOpen(m, 1);
  assert.match(m.state.html, /data-fix-field="url"/, 'inline editor opens');
  assert.match(m.state.html, /data-fix-field="title"/);
  m.setFixInputs({ url: 'https://fixed.example/', title: 'Fixed' });
  clickFixSave(m, 1);
  assert.equal(m.context.bookmarks.filter((b) => b.url === 'https://fixed.example/').length, 1);
  assert.match(m.state.html, />2<\/strong><small>Imported</, 'counts update after the fix');
  assert.match(m.state.html, /data-skipped="true"><strong>1<\/strong><small>Skipped</);
  assert.doesNotMatch(m.state.html, /Not a website address/);
  assert.equal(m.calls.toast.pop(), 'Bookmark added.');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-006', 'stays on results');
});

test('s-006 names missing password fields and offers the password fix', () => {
  const m = openImportResults(
    { capabilities: ALL_SETUP },
    {
      sourceId: 'bitwarden',
      kind: 'passwords',
      text: 'name,url,username,password\nA,https://a.example,user,pass\nB,https://b.example,user,\nC,https://c.example,user,pass2',
    },
  );
  assert.match(m.state.html, />3<\/strong><small>Found</);
  assert.match(m.state.html, />2<\/strong><small>Imported</);
  assert.match(m.state.html, /Missing password/);
  assert.match(m.state.html, /data-fix-open="0">Fix</, 'the incomplete row is fixable');
  clickFixOpen(m, 0);
  assert.match(m.state.html, /data-fix-field="password"/);
  m.setFixInputs({ site: 'https://b.example', username: 'user', password: 'secret' });
  clickFixSave(m, 0);
  assert.equal(m.context.passwords.length, 3);
  assert.match(m.state.html, />3<\/strong><small>Imported</);
  assert.match(m.state.html, /Nothing was skipped/);
  assert.equal(m.calls.toast.pop(), 'Password saved.');
});

test('s-006 reports a clean import with no fix link', () => {
  const m = openImportResults(
    { capabilities: ALL_SETUP },
    {
      sourceId: 'firefox',
      kind: 'bookmarks',
      text: BOOKMARK_FILE('<DT><A HREF="https://a.example/">A</A><DT><A HREF="https://b.example/">B</A>'),
    },
  );
  assert.match(m.state.html, />2<\/strong><small>Found</);
  assert.match(m.state.html, />2<\/strong><small>Imported</);
  assert.match(m.state.html, /data-skipped="false"><strong>0<\/strong><small>Skipped</);
  assert.match(m.state.html, /Nothing was skipped/);
  assert.doesNotMatch(m.state.html, /data-fix-open=/);
});

test('s-006 explains a CSV without the expected columns', () => {
  const m = openImportResults(
    { capabilities: ALL_SETUP },
    { sourceId: 'csv', kind: 'passwords', text: 'foo,bar\none,two\nthree,four' },
  );
  assert.match(m.state.html, />2<\/strong><small>Found</);
  assert.match(m.state.html, />0<\/strong><small>Imported</);
  assert.match(m.state.html, /Unrecognised columns/);
  assert.doesNotMatch(m.state.html, /data-fix-open=/, 'an unrecognised file has no inline fix');
  assert.equal(m.context.passwords.length, 0);
});

test('Done on s-006 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-006', {
    sourceId: 'chrome',
    kind: 'bookmarks',
    text: BOOKMARK_FILE('<DT><A HREF="https://a.example/">A</A>'),
  });
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const openSyncIntro = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-007');
  return m;
};

test('s-007 offers create, pair and skip with its own route and phase', () => {
  const m = openSyncIntro({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-007');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Sync intro');
  assert.match(m.state.html, /Bookmarks and open tabs on your other devices/);
  assert.match(m.state.html, /data-onboard="create-id"><strong>Create a Vaayvu ID</);
  assert.match(m.state.html, /data-onboard="sync"><strong>Pair this device</);
  assert.match(m.state.html, /data-onboard="back">Skip for now</);
  assert.match(m.state.html, /Sync intro/);
});

test('s-007 opens the real register and sign-in sheets', () => {
  const m = openSyncIntro({ capabilities: ALL_SETUP });
  m.click('create-id');
  m.click('sync');
  assert.deepEqual(m.calls.command, ['register', 'account']);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-007', 'stays on the intro');
});

test('s-007 explains a build without the sync client', () => {
  const m = openSyncIntro({ capabilities: ALL_SETUP, withSync: false });
  assert.match(m.state.html, /Sync is not available in this build/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
  assert.match(m.state.html, /data-onboard="back">Skip for now</);
});

test('s-007 respects India-only browsing', () => {
  const m = openSyncIntro({ capabilities: ALL_SETUP, ordinaryWeb: false });
  assert.match(m.state.html, /Sync is paused/);
  assert.match(m.state.html, /India-only browsing/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
});

test('s-007 shows the connected account instead of sign-up actions', () => {
  const m = openSyncIntro({ capabilities: ALL_SETUP, signedIn: true });
  assert.match(m.state.html, /Signed in as mahesh/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
  assert.match(m.state.html, /data-onboard="back">Done</);
});

test('Skip on s-007 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-007');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const openCreateAccount = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-008');
  return m;
};

test('s-008 offers the atlas methods and the real password path', () => {
  const m = openCreateAccount({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-008');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Create account');
  assert.match(m.state.html, /Email link/);
  assert.match(m.state.html, /Passkey/);
  assert.match(m.state.html, /SSO/);
  assert.equal((m.state.html.match(/Choose/g) || []).length, 3, 'each method is selectable');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'auth-method', method: 'email' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-auth-method="email"/);
  assert.match(m.state.html, /is-selected/);
  assert.match(m.state.html, /data-auth-email/);
  assert.match(m.state.html, /data-onboard="auth-send-link"/);
  m.click('auth-send-link');
  assert.match(m.state.html, /Check your email/);
  assert.match(m.state.html, /No mail is sent in this build\./);
  assert.match(m.state.html, /data-onboard="create-id"/);
  assert.match(m.state.html, /data-onboard="create-id"><strong>Create a Vaayvu ID</);
  assert.match(m.state.html, /data-onboard="back">Back</);
  assert.match(m.state.html, /data-onboard="auth-method"/);
});

test('s-008 opens the real registration sheet', () => {
  const m = openCreateAccount({ capabilities: ALL_SETUP });
  m.click('create-id');
  assert.deepEqual(m.calls.command, ['register']);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-008', 'stays on the screen');
  assert.equal(m.state.removed, false);
});

test('s-008 explains a build without the sync client', () => {
  const m = openCreateAccount({ capabilities: ALL_SETUP, withSync: false });
  assert.match(m.state.html, /Sync is not available in this build/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
  assert.doesNotMatch(m.state.html, /onboarding-method/);
});

test('s-008 respects India-only browsing', () => {
  const m = openCreateAccount({ capabilities: ALL_SETUP, ordinaryWeb: false });
  assert.match(m.state.html, /Account creation is paused/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
});

test('s-008 does not offer a second account while signed in', () => {
  const m = openCreateAccount({ capabilities: ALL_SETUP, signedIn: true });
  assert.match(m.state.html, /Already signed in as mahesh/);
  assert.doesNotMatch(m.state.html, /data-onboard="create-id"/);
  assert.match(m.state.html, /data-onboard="back">Done</);
});

test('Back from s-008 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-008');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const openSignIn = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-009');
  return m;
};

test('s-009 offers the atlas sign-in methods and the real password path', () => {
  const m = openSignIn({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-009');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Sign in');
  for (const name of ['Passkey', 'Email link', 'Authenticator code', 'Recovery code']) {
    assert.match(m.state.html, new RegExp('>' + name + '<'), name + ' is offered');
  }
  assert.equal((m.state.html.match(/Choose/g) || []).length, 4, 'each method is selectable');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'auth-method', method: 'passkey' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-auth-method="passkey"/);
  assert.match(m.state.html, /is-selected/);
  assert.match(m.state.html, /data-onboard="auth-passkey">Use passkey/);
  m.click('auth-passkey');
  assert.match(m.state.html, /Passkey ready/);
  assert.match(m.state.html, /No credential is created or used yet\./);
  assert.match(m.state.html, /data-onboard="sync"/);
  assert.match(m.state.html, /data-onboard="sync"><strong>Sign in with a Vaayvu ID</);
  assert.match(m.state.html, /data-onboard="back">Back</);
});

test('s-009 opens the real sign-in sheet', () => {
  const m = openSignIn({ capabilities: ALL_SETUP });
  m.click('sync');
  assert.deepEqual(m.calls.command, ['account']);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-009', 'stays on the screen');
  assert.equal(m.state.removed, false);
});

test('s-009 explains a build without the sync client', () => {
  const m = openSignIn({ capabilities: ALL_SETUP, withSync: false });
  assert.match(m.state.html, /Sync is not available in this build/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
  assert.doesNotMatch(m.state.html, /onboarding-method/);
});

test('s-009 respects India-only browsing', () => {
  const m = openSignIn({ capabilities: ALL_SETUP, ordinaryWeb: false });
  assert.match(m.state.html, /Sign-in is paused/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
});

test('s-009 shows the connected account instead of sign-in methods', () => {
  const m = openSignIn({ capabilities: ALL_SETUP, signedIn: true });
  assert.match(m.state.html, /Signed in as mahesh/);
  assert.doesNotMatch(m.state.html, /data-onboard="sync"/);
  assert.doesNotMatch(m.state.html, /onboarding-method/);
  assert.match(m.state.html, /data-onboard="back">Done</);
});

test('Back from s-009 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-009');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const PHRASE = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray';
const openRecovery = (options, phrase) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-010', phrase === undefined ? undefined : { phrase });
  return m;
};
const clickPhrase = (m, act) =>
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-phrase]' ? { dataset: { phrase: act } } : null) },
  });
const phrasePositions = (m) => [...m.state.html.matchAll(/data-phrase-word="(\d+)"/g)].map((match) => match[1]);

test('s-010 renders a clearly labelled preview phrase when none is supplied', () => {
  const m = openRecovery({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-010');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Recovery key');
  assert.match(m.state.html, /Preview phrase/);
  assert.match(m.state.html, /not tied to an account/);
  assert.match(m.state.html, /onboarding-words/);
  assert.equal((m.state.html.match(/<li>/g) || []).length, 24);
  assert.match(m.state.html, /data-phrase="copy"/);
  assert.match(m.state.html, /data-phrase="lost"/);
});

test('s-010 shows a real 24-word phrase with copy, print, continue and lost', () => {
  const m = openRecovery({ capabilities: ALL_SETUP, withPrint: true }, PHRASE);
  assert.equal((m.state.html.match(/<li>/g) || []).length, 24);
  assert.match(m.state.html, />alpha</);
  assert.match(m.state.html, />xray</);
  assert.match(m.state.html, /data-phrase="copy">Copy</);
  assert.match(m.state.html, /data-phrase="print">Print</);
  assert.match(m.state.html, /data-phrase="confirm">Continue</);
  assert.match(m.state.html, /data-phrase="lost">I lost it</);
});

test('s-010 copies the phrase and prints the page only where supported', async () => {
  const m = openRecovery({ capabilities: ALL_SETUP, withPrint: true }, PHRASE);
  clickPhrase(m, 'copy');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(m.calls.copied.length, 1);
  assert.equal(m.calls.copied[0], PHRASE);
  assert.equal(m.calls.toast.pop(), 'Recovery phrase copied.');
  clickPhrase(m, 'print');
  assert.equal(m.calls.prints, 1);
  const noPrint = openRecovery({ capabilities: ALL_SETUP }, PHRASE);
  assert.doesNotMatch(noPrint.state.html, /data-phrase="print"/);
});

test('s-010 confirms three requested words', () => {
  const m = openRecovery({ capabilities: ALL_SETUP }, PHRASE);
  clickPhrase(m, 'confirm');
  const positions = phrasePositions(m);
  assert.equal(positions.length, 3, 'three words are requested');
  const words = PHRASE.split(' ');
  m.setPhraseInputs(Object.fromEntries(positions.map((position) => [position, words[Number(position) - 1]])));
  clickPhrase(m, 'verify');
  assert.match(m.state.html, /Recovery phrase confirmed/);
  assert.match(m.state.html, /data-onboard="back">Done</);
});

test('s-010 rejects wrong confirmation words without advancing', () => {
  const m = openRecovery({ capabilities: ALL_SETUP }, PHRASE);
  clickPhrase(m, 'confirm');
  const positions = phrasePositions(m);
  m.setPhraseInputs(Object.fromEntries(positions.map((position) => [position, 'wrong'])));
  clickPhrase(m, 'verify');
  assert.match(m.state.html, /do not match/);
  assert.doesNotMatch(m.state.html, /Recovery phrase confirmed/);
  assert.match(m.state.html, /data-phrase-word=/, 'still on the confirm step');
});

test('s-010 lost-phrase flow is honest and offers a new ID', () => {
  const m = openRecovery({ capabilities: ALL_SETUP }, PHRASE);
  clickPhrase(m, 'lost');
  assert.match(m.state.html, /cannot be recovered/);
  assert.match(m.state.html, /data-onboard="create-id"><strong>Create a new Vaayvu ID/);
  m.click('create-id');
  assert.deepEqual(m.calls.command, ['register']);
});

test('s-010 rejects an incomplete phrase', () => {
  const m = openRecovery({ capabilities: ALL_SETUP }, 'alpha bravo charlie');
  assert.match(m.state.html, /has 3 words; 24 are required/);
  assert.doesNotMatch(m.state.html, /onboarding-words/);
});

test('Back from s-010 returns to the screen that opened it', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-010', { phrase: PHRASE });
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});


const openTour = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-013');
  return m;
};
const clickTour = (m, act) =>
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-tour]' ? { dataset: { tour: act } } : null) },
  });

test('s-013 walks omnibox, tabs, spaces, sidebar and AI', () => {
  const m = openTour({ capabilities: ALL_SETUP });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-013');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Feature tour');
  assert.match(m.state.html, /Omnibox/);
  assert.match(m.state.html, /Step 1 of 5 · Omnibox/);
  assert.match(m.state.html, /data-tour="next">Next</);
  assert.match(m.state.html, /data-tour="back">Back</);
  clickTour(m, 'next');
  assert.match(m.state.html, /Step 2 of 5 · Tabs/);
  clickTour(m, 'next');
  assert.match(m.state.html, /Step 3 of 5 · Spaces/);
  clickTour(m, 'next');
  assert.match(m.state.html, /Step 4 of 5 · Sidebar/);
  clickTour(m, 'next');
  assert.match(m.state.html, /Step 5 of 5 · Page Q/);
  assert.match(m.state.html, /data-tour="next">Done</);
  assert.match(m.state.html, /sync server and its configured model/);
});

test('the tour always carries the five atlas stops', () => {
  const phone = openTour({ capabilities: ALL_SETUP, platform: 'ios', narrow: true });
  assert.match(phone.state.html, /of 5 · Omnibox/);
  clickTour(phone, 'next');
  clickTour(phone, 'next');
  assert.match(phone.state.html, /Spaces/);
  clickTour(phone, 'next');
  assert.match(phone.state.html, /Sidebar/);
  clickTour(phone, 'next');
  assert.match(phone.state.html, /Page Q/);
  const noSync = openTour({ capabilities: ALL_SETUP, withSync: false });
  assert.match(noSync.state.html, /of 5/);
  const noSpaces = openTour({ capabilities: ALL_SETUP, withSpaces: false });
  assert.match(noSpaces.state.html, /of 5/);
  clickTour(noSpaces, 'next');
  clickTour(noSpaces, 'next');
  assert.match(noSpaces.state.html, /Spaces/);
});

test('Back moves through the tour and closes at the first stop', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-013');
  clickTour(m, 'next');
  clickTour(m, 'next');
  assert.match(m.state.html, /Step 3 of 5 · Spaces/);
  clickTour(m, 'back');
  assert.match(m.state.html, /Step 2 of 5 · Tabs/);
  clickTour(m, 'back');
  clickTour(m, 'back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002', 'closes back to the opener');
});

test('Done on the last tour stop closes to the opener', () => {
  const m = mount({ capabilities: ALL_SETUP });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-013');
  for (let n = 0; n < 5; n += 1) clickTour(m, 'next');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
  assert.equal(m.state.attrs['aria-label'], 'Welcome');
});


const openPrimer = (options) => {
  const m = mount(options);
  m.context.window.__vaayvuOnboardingOpen('s-014');
  return m;
};

test('s-014 explains notifications before the OS prompt', () => {
  const m = openPrimer({ capabilities: { ...ALL_SETUP, canPageReminder: true } });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-014');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Page reminders');
  assert.match(m.state.html, /A reminder opens the page you saved/);
  assert.match(m.state.html, /No marketing and no background messages/);
  assert.match(m.state.html, /data-onboard="request-notifications">Enable notifications</);
  assert.match(m.state.html, /data-onboard="back">Not now</);
});

test('s-014 hands the prompt to the native layer without claiming a grant', () => {
  const m = openPrimer({ capabilities: { ...ALL_SETUP, canPageReminder: true } });
  m.click('request-notifications');
  assert.deepEqual(m.calls.command, ['requestNotifications']);
  assert.match(m.state.html, /Your device is asking now/);
  assert.match(m.state.html, /system prompt/);
  assert.doesNotMatch(m.state.html, /Notifications enabled|granted/i);
  assert.match(m.state.html, /data-onboard="back">Done</);
  // Reopening starts at the explainer again, not a remembered grant.
  m.context.window.__vaayvuOnboardingOpen('s-014');
  assert.match(m.state.html, /data-onboard="request-notifications">Enable notifications</);
});

test('s-014 is honest on platforms without page reminders', () => {
  const m = openPrimer({ capabilities: ALL_SETUP });
  assert.match(m.state.html, /Notifications are not used in this build/);
  assert.doesNotMatch(m.state.html, /data-onboard="request-notifications"/);
  assert.match(m.state.html, /data-onboard="back">Back</);
});

test('Back from s-014 returns to the screen that opened it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, canPageReminder: true } });
  m.click('continue');
  m.context.window.__vaayvuOnboardingOpen('s-014');
  m.click('back');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-002');
});

// ----- s-016: update available ---------------------------------------------

const UPDATE = {
  available: true,
  version: '0.0.24',
  size: '182 MB',
  notes: ['Faster start page', 'Rasha Shield fixes for same-site paths'],
  url: 'https://vaayvu.com/releases/v0.0.24',
};

test('s-016 stays hidden when the host reports no update', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-016'), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  assert.doesNotMatch(m.state.html, /Update available|Install &amp; relaunch/);
});

test('s-016 renders the real version, size, notes and both actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: UPDATE } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-016'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-016');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Update available');
  assert.match(m.state.html, /Version 0\.0\.24 is ready/);
  assert.match(m.state.html, /182 MB/);
  assert.match(m.state.html, /Installed 0\.0\.23/);
  assert.match(m.state.html, /Faster start page/);
  assert.match(m.state.html, /Rasha Shield fixes for same-site paths/);
  assert.match(m.state.html, /data-onboard="install-update"/);
  assert.match(m.state.html, /Install &amp; relaunch/);
  assert.match(m.state.html, /data-onboard="later-update">Later</);
});

test('s-016 does not offer an update for the version already installed', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: { ...UPDATE, version: '0.0.23' } } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-016'), false);
});

test('Later on s-016 records the dismissal and returns to the chain', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: UPDATE } });
  m.context.window.__vaayvuOnboardingOpen('s-016');
  m.click('later-update');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  const saved = JSON.parse(m.store.getItem('vaayvu.update.dismissed'));
  assert.equal(saved.version, '0.0.24');
});

test('Install & relaunch asks the host to install and shows no fake progress', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: UPDATE } });
  m.context.window.__vaayvuOnboardingOpen('s-016');
  m.click('install-update');
  assert.equal(m.calls.sent.length, 1);
  assert.equal(m.calls.sent[0].type, 'installUpdate');
  assert.equal(m.calls.sent[0].version, '0.0.24');
  assert.equal(m.calls.sent[0].url, 'https://vaayvu.com/releases/v0.0.24');
  assert.match(m.state.html, /Installing…/);
  assert.match(m.state.html, /Preparing the update…/);
  const saved = JSON.parse(m.store.getItem('vaayvu.update.installing'));
  assert.equal(saved.to, '0.0.24');
});

test('s-016 stops claiming an install when the host stays silent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: UPDATE } });
  m.context.window.__vaayvuOnboardingOpen('s-016');
  m.click('install-update');
  assert.match(m.state.html, /Preparing the update…/);
  m.runTimers();
  assert.match(m.state.html, /Still downloading\. Keep Vaayvu open/);
  assert.match(m.state.html, /Install &amp; relaunch/);
});

test('s-016 reports host progress and failures without claiming success', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, update: UPDATE } });
  m.context.window.__vaayvuOnboardingOpen('s-016');
  m.click('install-update');
  m.context.window.vaayvuEvent({ type: 'updateProgress', percent: 42 });
  assert.match(m.state.html, /Downloading update… 42%/);
  m.context.window.vaayvuEvent({ type: 'updateError', message: 'The download was interrupted.' });
  assert.match(m.state.html, /The download was interrupted\./);
  assert.match(m.state.html, /Install &amp; relaunch/);
});

test('updateAvailable opens s-016 on its own route', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'updateAvailable', update: UPDATE });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-016');
  assert.match(m.state.html, /Version 0\.0\.24 is ready/);
});

// ----- s-017: what’s new ----------------------------------------------------

const NOTES = {
  version: '0.0.23',
  date: '24 Nov 2026',
  notes: [
    'Split view keeps two pages side by side',
    'Tab groups collapse into one row',
    'Local passwords stay in the browser store',
  ],
  links: [
    { label: 'See the tour', tour: 'omnibox' },
    { label: 'Spaces', tour: 'spaces' },
  ],
};

test('s-017 stays hidden without release notes for the installed version', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-017'), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-017 renders the version, notes and feature-tour links', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, releaseNotes: NOTES } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-017'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-017');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'What’s new');
  assert.match(m.state.html, /Version 0\.0\.23 · 24 Nov 2026/);
  assert.match(m.state.html, /Split view keeps two pages side by side/);
  assert.match(m.state.html, /data-tour-link="omnibox">See the tour</);
  assert.match(m.state.html, /data-onboard="whatsnew-done">Continue</);
});

test('s-017 ignores notes for a different version', () => {
  const m = mount({
    capabilities: { ...ALL_SETUP, releaseNotes: { ...NOTES, version: '0.0.24' } },
  });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-017'), false);
});

test('s-017 does not repeat once the version was seen', () => {
  const store = memoryStore({
    'vaayvu.whatsNew.seen': JSON.stringify({ version: '0.0.23', at: 1 }),
  });
  const m = mount({ store, capabilities: { ...ALL_SETUP, releaseNotes: NOTES } });
  assert.equal(m.context.window.__vaayvuWhatsNewPrompt(), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('Continue marks the version seen and returns to the chain', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, releaseNotes: NOTES } });
  m.context.window.__vaayvuOnboardingOpen('s-017');
  m.click('whatsnew-done');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  const seen = JSON.parse(m.store.getItem('vaayvu.whatsNew.seen'));
  assert.equal(seen.version, '0.0.23');
});

test('a feature-tour link opens the tour and Back returns to the notes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, releaseNotes: NOTES } });
  m.context.window.__vaayvuOnboardingOpen('s-017');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-tour-link]' ? { dataset: { tourLink: 'omnibox' } } : null,
    },
  });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-013');
  assert.match(m.state.html, /Omnibox/);
  m.overlay.onclick({
    target: {
      closest: (selector) => (selector === '[data-tour]' ? { dataset: { tour: 'back' } } : null),
    },
  });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-017');
});

test('releaseNotes opens s-017 without waiting for a relaunch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'releaseNotes', releaseNotes: NOTES });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-017');
  assert.match(m.state.html, /Tab groups collapse into one row/);
});

test('ready opens what’s new only when no update is waiting', () => {
  const notesOnly = mount({ capabilities: { ...ALL_SETUP, releaseNotes: NOTES } });
  notesOnly.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(notesOnly.dataset.onboardingRoute, 'vaayvu://onboarding/s-017');

  const updateFirst = mount({
    capabilities: {
      ...ALL_SETUP,
      update: { available: true, version: '0.0.24', size: '182 MB', notes: ['New'] },
      releaseNotes: NOTES,
    },
  });
  updateFirst.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(updateFirst.dataset.onboardingRoute, 'vaayvu://onboarding/s-016');
});

// ----- s-020: unsupported system -------------------------------------------

const UNSUPPORTED = {
  active: true,
  current: 'macOS 13.6 Ventura',
  minimum: 'macOS 14 Sonoma',
  why: 'Vaayvu uses WebKit features that arrived in macOS 14.',
  legacyUrl: 'https://vaayvu.com/releases/0.0.22',
};

test('s-020 stays hidden unless the host reports an unsupported system', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-020'), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-020 states the current system, minimum, reason and older build', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, unsupportedSystem: UNSUPPORTED } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-020'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-020');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Unsupported system');
  assert.match(m.state.html, /This device: macOS 13\.6 Ventura/);
  assert.match(m.state.html, /Minimum: macOS 14 Sonoma/);
  assert.match(m.state.html, /WebKit features that arrived in macOS 14/);
  assert.match(m.state.html, /data-onboard="unsupported-download">Download older version</);
  assert.match(m.state.html, /data-onboard="unsupported-continue">Continue anyway</);
});

test('Download older version opens the system browser through the host', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, unsupportedSystem: UNSUPPORTED } });
  m.context.window.__vaayvuOnboardingOpen('s-020');
  m.click('unsupported-download');
  assert.equal(m.calls.sent.length, 1);
  assert.equal(m.calls.sent[0].type, 'openExternal');
  assert.equal(m.calls.sent[0].url, 'https://vaayvu.com/releases/0.0.22');
  assert.match(m.state.html, /Opening the older version page/);
});

test('s-020 is honest when no older build is published', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      unsupportedSystem: {
        active: true,
        current: 'Android 10',
        minimum: 'Android 11',
        why: 'The current WebView is too old.',
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-020');
  assert.doesNotMatch(m.state.html, /unsupported-download/);
  assert.match(m.state.html, /data-onboard="unsupported-continue">Continue</);
  assert.match(m.state.html, /No older build is published for this device/);
});

test('Continue on s-020 returns to the setup chain', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, unsupportedSystem: UNSUPPORTED } });
  m.context.window.__vaayvuOnboardingOpen('s-020');
  m.click('unsupported-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('unsupportedSystem opens s-020 without a relaunch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'unsupportedSystem', unsupportedSystem: UNSUPPORTED });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-020');
});

test('an unsupported system outranks update and what’s new', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      unsupportedSystem: UNSUPPORTED,
      update: { available: true, version: '0.0.24', size: '182 MB', notes: ['New'] },
      releaseNotes: NOTES,
    },
  });
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-020');
});

// ----- s-019: safe mode prompt ----------------------------------------------

const SAFE = { reason: 'Vaayvu did not shut down cleanly.', crashes: 2 };

test('s-019 stays hidden without a safe-mode report from the host', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-019'), false);
  assert.equal(m.context.window.__vaayvuSafeModePrompt(), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-019 renders the recovery choices on its own route', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, safeMode: SAFE } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-019'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-019');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Safe mode prompt');
  assert.match(m.state.html, /Vaayvu did not shut down cleanly/);
  assert.match(m.state.html, /data-safe="extensions"/);
  assert.match(m.state.html, /data-safe="reset"/);
  assert.match(m.state.html, /data-safe="continue">Continue</);
});

test('Disable extensions really turns every style package off and finishes', () => {
  const store = memoryStore({
    'vaayvu.styleExtension.Wikipedia': JSON.stringify({ name: 'Wikipedia', rules: [], enabled: true }),
    'vaayvu.styleExtension.News': JSON.stringify({ name: 'News', rules: [], enabled: false }),
  });
  const m = mount({ store, capabilities: { ...ALL_SETUP, safeMode: SAFE } });
  m.context.window.__vaayvuOnboardingOpen('s-019');
  m.clickSafe('extensions');
  assert.equal(m.state.removed, true);
  assert.equal(JSON.parse(store.getItem('vaayvu.styleExtension.Wikipedia')).enabled, false);
  assert.equal(JSON.parse(store.getItem('vaayvu.styleExtension.News')).enabled, false);
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.route, 'vaayvu://onboarding/s-019');
  assert.equal(record.safeMode, 'extensions-disabled');
  assert.equal(record.extensionsDisabled, 1, 'only the enabled package changed');
});

test('Reset asks inside the screen and keeps saved pages and passwords', () => {
  const store = memoryStore({
    'vaayvu.settings': '{"theme":"dark"}',
    'vaayvu.adBlock': '{"schema":2}',
    'vaayvu.styleExtension.Wikipedia': JSON.stringify({ name: 'Wikipedia', rules: [], enabled: true }),
    'vaayvu.bookmarks': 'kept',
    'vaayvu.passwords': 'kept',
  });
  const m = mount({ store, capabilities: { ...ALL_SETUP, safeMode: SAFE } });
  m.context.window.__vaayvuOnboardingOpen('s-019');
  m.clickSafe('reset');
  assert.match(m.state.html, /Reset browser settings\?/);
  assert.equal(store.getItem('vaayvu.settings'), '{"theme":"dark"}', 'nothing changes before confirmation');
  m.clickSafe('reset-cancel');
  assert.doesNotMatch(m.state.html, /Reset browser settings\?/);
  assert.equal(store.getItem('vaayvu.settings'), '{"theme":"dark"}');

  m.clickSafe('reset');
  m.clickSafe('reset-confirm');
  assert.equal(store.getItem('vaayvu.settings'), null);
  assert.equal(store.getItem('vaayvu.adBlock'), null);
  assert.equal(store.getItem('vaayvu.bookmarks'), 'kept');
  assert.equal(store.getItem('vaayvu.passwords'), 'kept');
  assert.equal(JSON.parse(store.getItem('vaayvu.styleExtension.Wikipedia')).enabled, false);
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.safeMode, 'reset');
  assert.equal(record.extensionsDisabled, 1);
});

test('Continue closes safe mode without changing settings', () => {
  const store = memoryStore({ 'vaayvu.settings': '{"theme":"dark"}' });
  const m = mount({ store, capabilities: { ...ALL_SETUP, safeMode: SAFE } });
  m.context.window.__vaayvuOnboardingOpen('s-019');
  m.clickSafe('continue');
  assert.equal(m.state.removed, true);
  assert.equal(store.getItem('vaayvu.settings'), '{"theme":"dark"}');
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.safeMode, 'continued');
  assert.equal(record.status, 'done');
});

test('a safeMode event opens the prompt and a ready report outranks updates', () => {
  const event = mount({ capabilities: { ...ALL_SETUP } });
  event.context.window.vaayvuEvent({ type: 'safeMode', safeMode: SAFE });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://onboarding/s-019');
  assert.match(event.state.html, /Vaayvu did not shut down cleanly/);

  const ready = mount({
    capabilities: {
      ...ALL_SETUP,
      safeMode: SAFE,
      update: { available: true, version: '0.0.24', size: '182 MB', notes: ['New'] },
      releaseNotes: NOTES,
    },
  });
  ready.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(ready.dataset.onboardingRoute, 'vaayvu://onboarding/s-019');
});

// ----- s-021: main window (light) ------------------------------------------

test('s-021 renders the window map with all four regions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-021'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-021');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.state.attrs['aria-label'], 'Main window light');
  assert.match(m.state.html, /mw-frame/);
  assert.match(m.state.html, /mw-tab is-active/);
  assert.match(m.state.html, /mw-toolbar/);
  assert.match(m.state.html, /mw-content/);
  assert.match(m.state.html, /01 Frame/);
  assert.match(m.state.html, /02 Tab strip/);
  assert.match(m.state.html, /03 Toolbar/);
  assert.match(m.state.html, /04 Content/);
  assert.match(m.state.html, /data-onboard="mainwindow-continue">Continue</);
});

test('s-021 can be hidden by a platform', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, mainWindow: false } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-021'), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('Continue on s-021 returns to the setup chain', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-021');
  m.click('mainwindow-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mainWindow event opens s-021 when the host asks for it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'mainWindow' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-021');
});

test('s-021 reports the window-chrome category and phase p03', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-021');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-021');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
});

test('s-021 does not run inside the onboarding ready chain', () => {
  const plain = mount({ capabilities: { ...ALL_SETUP } });
  plain.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(plain.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');

  const asked = mount({ capabilities: { ...ALL_SETUP, showMainWindow: true } });
  asked.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(asked.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

// ----- s-022: main window (dark) -------------------------------------------

test('s-022 renders the same map with dark tokens', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-022'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-022');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Main window dark');
  assert.match(m.state.html, /onboarding-mainwindow is-dark/);
  assert.match(m.state.html, /Dark tokens shown/);
  assert.match(m.state.html, /01 Frame/);
  assert.match(m.state.html, /02 Tab strip/);
  assert.match(m.state.html, /03 Toolbar/);
  assert.match(m.state.html, /04 Content/);
});

test('s-022 shares the platform gate and returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, mainWindow: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-022'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-022');
  m.click('mainwindow-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mainWindow event chooses light or dark', () => {
  const dark = mount({ capabilities: { ...ALL_SETUP } });
  dark.context.window.vaayvuEvent({ type: 'mainWindow', theme: 'dark' });
  assert.equal(dark.dataset.onboardingRoute, 'vaayvu://window-chrome/s-022');

  const light = mount({ capabilities: { ...ALL_SETUP } });
  light.context.window.vaayvuEvent({ type: 'mainWindow' });
  assert.equal(light.dataset.onboardingRoute, 'vaayvu://window-chrome/s-021');
});

test('the main-window prompt accepts the dark variant', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, showMainWindow: true } });
  assert.equal(m.context.window.__vaayvuMainWindowPrompt('dark'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-022');
});

// ----- s-024: full screen ---------------------------------------------------

test('s-024 renders hidden chrome with an edge reveal', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-024'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-024');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Fullscreen');
  assert.match(m.state.html, /data-fs-stage/);
  assert.match(m.state.html, /data-fs-edge/);
  assert.match(m.state.html, /data-fs-chrome/);
  assert.doesNotMatch(m.state.html, /fs-stage is-revealed/);
  assert.match(m.state.html, /data-onboard="fullscreen-toggle">Reveal chrome</);
  assert.match(m.state.html, /data-onboard="fullscreen-continue">Continue</);
});

test('the reveal action shows the chrome and can hide it again', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-024');
  m.click('fullscreen-toggle');
  assert.match(m.state.html, /fs-stage is-revealed/);
  assert.match(m.state.html, /data-onboard="fullscreen-toggle">Hide chrome</);
  assert.match(m.state.html, /Chrome revealed/);
  m.click('fullscreen-toggle');
  assert.doesNotMatch(m.state.html, /fs-stage is-revealed/);
  assert.match(m.state.html, /Chrome hidden/);
});

test('hovering the top edge reveals the chrome', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-024');
  m.overlay.onpointerover({
    target: {
      closest: (selector) => (selector === '[data-fs-edge]' ? {} : null),
    },
  });
  assert.match(m.state.html, /fs-stage is-revealed/);
});

test('s-024 respects the platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, fullscreen: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-024'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-024');
  m.click('fullscreen-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the fullscreen event opens s-024 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'fullscreen' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-024');
});

// ----- s-026: vertical tab rail --------------------------------------------

test('s-026 renders the tree, groups, spaces and collapse control', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-026'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-026');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Vertical tab rail');
  assert.match(m.state.html, /role="tree"/);
  assert.match(m.state.html, /aria-expanded="true"/);
  assert.match(m.state.html, /Design/);
  assert.match(m.state.html, /Figma/);
  assert.match(m.state.html, /Research/);
  assert.match(m.state.html, /vrail-spaces/);
  assert.match(m.state.html, /data-onboard="rail-collapse">Collapse rail</);
  assert.match(m.state.html, /data-onboard="rail-continue">Continue</);
});

test('collapsing the rail narrows it and keeps an expand path', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-026');
  m.click('rail-collapse');
  assert.match(m.state.html, /vrail-stage is-collapsed/);
  assert.match(m.state.html, /data-onboard="rail-collapse">Expand rail</);
  m.click('rail-collapse');
  assert.doesNotMatch(m.state.html, /vrail-stage is-collapsed/);
});

test('groups fold and unfold independently', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-026');
  m.click('rail-design');
  assert.doesNotMatch(m.state.html, /Figma/);
  assert.match(m.state.html, /aria-expanded="false"/);
  m.click('rail-research');
  assert.match(m.state.html, /Ars Technica/);
});

test('rail resizing is bounded and works by button and separator keys', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-026');
  assert.match(m.state.html, /aria-valuenow="220"/);
  m.click('rail-wide');
  assert.match(m.state.html, /Rail width 240 px/);
  assert.match(m.state.html, /aria-valuenow="240"/);
  m.overlay.onkeydown({ key: 'ArrowRight', target: { hasAttribute: (n) => n === 'data-rail-resize' } });
  assert.match(m.state.html, /Rail width 260 px/);
  for (let i = 0; i < 10; i += 1) m.click('rail-wide');
  assert.match(m.state.html, /aria-valuenow="360"/);
  m.click('rail-narrow');
  assert.match(m.state.html, /aria-valuenow="340"/);
  m.click('rail-collapse');
  assert.match(m.state.html, /vrail-stage is-collapsed/);
  m.click('rail-collapse');
  assert.match(m.state.html, /aria-valuenow="340"/);
});

test('up and down keys select rail items and keep the saved location', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-026');
  m.overlay.onkeydown({ key: 'ArrowDown', target: {} });
  assert.match(m.state.html, /Selected Notion, item 2 of 7/);
  assert.match(m.state.html, /aria-selected="true"/);
  m.click('rail-save-location');
  assert.match(m.state.html, /Saved location Notion/);
  m.click('rail-sheet');
  assert.match(m.state.html, /Saved location: Notion/);
  m.overlay.onkeydown({ key: 'ArrowUp', target: {} });
  assert.match(m.state.html, /Selected Figma, item 1 of 7/);
  assert.match(m.state.html, /Saved location: Notion/);
});

test('s-026 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, verticalRail: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-026'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-026');
  m.click('rail-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the verticalRail event opens s-026 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'verticalRail' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-026');
});

// ----- s-028: toolbar, default ---------------------------------------------

test('s-028 renders every default toolbar control', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-028'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-028');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Toolbar default');
  assert.match(m.state.html, /role="toolbar"/);
  assert.match(m.state.html, /aria-label="Address and search"/);
  assert.match(m.state.html, /data-onboard="toolbar-shield"/);
  assert.match(m.state.html, /data-onboard="toolbar-extensions"/);
  assert.match(m.state.html, /data-onboard="toolbar-profile"/);
  assert.match(m.state.html, /data-onboard="toolbar-menu"/);
  assert.match(m.state.html, /01 Navigation/);
  assert.match(m.state.html, /02 Omnibox/);
  assert.match(m.state.html, /03 Rasha Shield/);
  assert.match(m.state.html, /04 Extensions, profile, menu/);
});

test('the omnibox opens local suggestions and closes again', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-028');
  m.click('toolbar-omnibox');
  assert.match(m.state.html, /tb-omnibox is-open/);
  assert.match(m.state.html, /Suggestions come from this device/);
  assert.match(m.state.html, /Bookmarks/);
  m.click('toolbar-omnibox');
  assert.doesNotMatch(m.state.html, /tb-omnibox is-open/);
});

test('the Shield control toggles this site and says so', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-028');
  m.click('toolbar-shield');
  assert.match(m.state.html, /aria-pressed="false"/);
  assert.match(m.state.html, /Shield paused for this site only/);
  m.click('toolbar-shield');
  assert.match(m.state.html, /aria-pressed="true"/);
  assert.match(m.state.html, /Shield back on for this site/);
});

test('each right-side control explains what it opens', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-028');
  m.click('toolbar-extensions');
  assert.match(m.state.html, /Extensions live here/);
  m.click('toolbar-profile');
  assert.match(m.state.html, /Profiles keep work, home and projects apart/);
  m.click('toolbar-menu');
  assert.match(m.state.html, /The menu holds tabs, history, downloads, zoom and settings/);
});

test('s-028 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, toolbar: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-028'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-028');
  m.click('toolbar-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the toolbar event opens s-028 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'toolbar' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-028');
});

// ----- s-030: omnibox, idle ------------------------------------------------

test('s-030 renders the URL, security chip and page actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-030'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-030');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Omnibox idle');
  assert.match(m.state.html, /ob-security/);
  assert.match(m.state.html, /https:\/\/vaayvu\.com\//);
  assert.match(m.state.html, /data-onboard="ob-idle-bookmark"/);
  assert.match(m.state.html, /data-onboard="ob-idle-reader"/);
  assert.match(m.state.html, /data-onboard="ob-idle-find"/);
  assert.match(m.state.html, /data-onboard="ob-idle-share"/);
  assert.match(m.state.html, /01 URL/);
  assert.match(m.state.html, /02 Security chip/);
  assert.match(m.state.html, /03 Page actions/);
});

test('the security chip opens and closes real site details', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-030');
  m.click('ob-idle-security');
  assert.match(m.state.html, /ob-popover/);
  assert.match(m.state.html, /Secure \(HTTPS\)/);
  assert.match(m.state.html, /2 first-party/);
  assert.match(m.state.html, /Close site information/);
  m.click('ob-idle-security');
  assert.doesNotMatch(m.state.html, /ob-popover/);
});

test('bookmark and Reader reflect their pressed state', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-030');
  m.click('ob-idle-bookmark');
  assert.match(m.state.html, /aria-pressed="true"/);
  assert.match(m.state.html, /Bookmark saved\./);
  m.click('ob-idle-reader');
  assert.match(m.state.html, /Reader view on\./);
  m.click('ob-idle-reader');
  assert.match(m.state.html, /Reader view off\./);
});

test('Find and Share report the surface they open', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-030');
  m.click('ob-idle-find');
  assert.match(m.state.html, /Find bar ready on this page\./);
  m.click('ob-idle-share');
  assert.match(m.state.html, /Share sheet ready\./);
});

test('s-030 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, omnibox: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-030'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-030');
  m.click('ob-idle-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the omnibox event opens s-030 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'omniboxIdle' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-030');
});

// ----- s-032: security chip popover ----------------------------------------

test('s-032 renders connection, certificate, cookies and permissions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-032'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-032');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Security chip popover');
  assert.match(m.state.html, /Connection/);
  assert.match(m.state.html, /Certificate/);
  assert.match(m.state.html, /First-party/);
  assert.match(m.state.html, /Third-party/);
  assert.match(m.state.html, /Camera/);
  assert.match(m.state.html, /Microphone/);
  assert.match(m.state.html, /Location/);
  assert.match(m.state.html, /01 Connection/);
  assert.match(m.state.html, /04 Permissions/);
});

test('s-032 uses real host security details when provided', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      securityInfo: {
        url: 'https://example.com/docs',
        connection: 'Encrypted (HTTPS)',
        protocol: 'TLS 1.3',
        certificate: {
          status: 'Valid',
          issuedTo: 'example.com',
          issuer: 'Example CA',
          validity: 'Until 12 Mar 2027',
        },
        cookies: { firstParty: 4, thirdParty: 1 },
        permissions: { camera: 'Blocked', microphone: 'Ask', location: 'Allowed' },
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-032');
  assert.match(m.state.html, /example\.com/);
  assert.match(m.state.html, /TLS 1\.3/);
  assert.match(m.state.html, /Example CA/);
  assert.match(m.state.html, /Until 12 Mar 2027/);
  assert.match(m.state.html, /<strong>4<\/strong>/);
  assert.match(m.state.html, /<strong>1<\/strong>/);
});

test('cookies can be listed and cleared without touching other tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-032');
  m.click('sec-cookies');
  assert.match(m.state.html, /sec-cookie-list/);
  assert.match(m.state.html, /preferences/);
  m.click('sec-clear-cookies');
  assert.match(m.state.html, /Site cookies cleared\./);
  assert.match(m.state.html, /First-party<\/span><strong>0<\/strong>/);
});

test('permissions cycle Ask, Allowed and Blocked with a status', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-032');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sec-perm', perm: 'camera' } }
          : null,
    },
  });
  assert.match(m.state.html, /Camera set to Allowed for this site\./);
  assert.match(m.state.html, /Camera<\/span>|Camera<strong>Allowed<\/strong>/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sec-perm', perm: 'camera' } }
          : null,
    },
  });
  assert.match(m.state.html, /Camera set to Blocked for this site\./);
});

test('s-032 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, securityChip: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-032'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-032');
  m.click('sec-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the securityChip event opens s-032 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'securityChip' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-032');
});

// ----- s-034: page actions chip --------------------------------------------

test('s-034 renders Reader, Translate, Zoom and Reading list', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-034'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-034');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Page actions chip');
  assert.match(m.state.html, /pa-chip/);
  assert.match(m.state.html, /Reader view/);
  assert.match(m.state.html, /Translate/);
  assert.match(m.state.html, /Zoom/);
  assert.match(m.state.html, /Reading list/);
  assert.match(m.state.html, /01 Reader/);
  assert.match(m.state.html, /04 Reading list/);
});

test('Reader, Translate and the reading list toggle with a status', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-034');
  m.click('pa-reader');
  assert.match(m.state.html, /Reader view on\./);
  assert.match(m.state.html, /aria-pressed="true"/);
  m.click('pa-translate');
  assert.match(m.state.html, /Page translated to English\./);
  m.click('pa-reading');
  assert.match(m.state.html, /Added to the reading list\./);
  m.click('pa-reading');
  assert.match(m.state.html, /Removed from the reading list\./);
});

test('Zoom steps between 50% and 200%', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-034');
  m.click('pa-zoom-in');
  assert.match(m.state.html, /<strong>110%<\/strong>/);
  assert.match(m.state.html, /Zoom set to 110%\./);
  m.click('pa-zoom-out');
  assert.match(m.state.html, /<strong>100%<\/strong>/);
});

test('s-034 starts from real host page-action state', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      pageActions: { reader: true, translated: true, zoom: 125, reading: true },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-034');
  assert.match(m.state.html, /<strong>On<\/strong>/);
  assert.match(m.state.html, /<strong>English<\/strong>/);
  assert.match(m.state.html, /<strong>125%<\/strong>/);
  assert.match(m.state.html, /<strong>Saved<\/strong>/);
});

test('a missing capability hides just that page action', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, canTranslate: false } });
  m.context.window.__vaayvuOnboardingOpen('s-034');
  assert.doesNotMatch(m.state.html, /data-onboard="pa-translate"/);
  assert.match(m.state.html, /data-onboard="pa-reader"/);
});

test('s-034 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, pageActions: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-034'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-034');
  m.click('pa-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the pageActions event opens s-034 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'pageActions' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-034');
});

// ----- s-036: status / hover URL -------------------------------------------

test('s-036 renders the bottom-left status with a full safe URL', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-036'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-036');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Status/hover URL');
  assert.match(m.state.html, /sh-status/);
  assert.match(m.state.html, /https:\/\/vaayvu\.com\/privacy/);
  assert.match(m.state.html, /data-tone="safe"/);
  assert.match(m.state.html, /Secure/);
  assert.match(m.state.html, /01 Bottom-left/);
  assert.match(m.state.html, /03 Safety/);
});

test('an HTTP link is marked Not secure before it is opened', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-036');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sh-link', shLink: 'http://example.com/login' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-tone="warn"/);
  assert.match(m.state.html, /Not secure/);
  assert.match(m.state.html, /http:\/\/example\.com\/login/);
  assert.match(m.state.html, /Destination: http:\/\/example\.com\/login/);
});

test('hovering a link updates the status without opening it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-036');
  m.overlay.onpointerover({
    target: {
      closest: (selector) =>
        selector === '[data-sh-link]'
          ? { dataset: { shLink: 'https://developer.mozilla.org/en-US/docs/Web/Security' } }
          : null,
    },
  });
  assert.match(m.state.html, /developer\.mozilla\.org/);
  assert.match(m.state.html, /data-tone="safe"/);
});

test('s-036 can start from a host-supplied hover URL', () => {
  const m = mount({
    capabilities: { ...ALL_SETUP, hoverUrl: 'http://intranet.local/status' },
  });
  m.context.window.__vaayvuOnboardingOpen('s-036');
  assert.match(m.state.html, /http:\/\/intranet\.local\/status/);
  assert.match(m.state.html, /data-tone="warn"/);
});

test('s-036 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, statusBar: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-036'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-036');
  m.click('sh-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the hoverUrl event opens s-036 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'hoverUrl' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-036');
});

// ----- s-038: download bubble ----------------------------------------------

test('s-038 renders active and completed downloads', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-038'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-038');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Downloads bubble');
  assert.match(m.state.html, /vaayvu-wallpapers\.zip/);
  assert.match(m.state.html, /18\.4 MB · 62%/);
  assert.match(m.state.html, /observatory\.jpg/);
  assert.match(m.state.html, /Completed/);
  assert.match(m.state.html, /01 Active/);
  assert.match(m.state.html, /04 Reveal/);
  assert.match(m.state.html, /data-onboard="dl-reveal-active"/);
  assert.match(m.state.html, /data-onboard="dl-reveal-done"/);
});

test('pause and resume keep the transfer in place', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-038');
  m.click('dl-pause');
  assert.match(m.state.html, /dl-item is-paused/);
  assert.match(m.state.html, /Paused at 62%/);
  assert.match(m.state.html, /Download paused at 62%\./);
  assert.match(m.state.html, /data-onboard="dl-pause">Resume download</);
  m.click('dl-pause');
  assert.doesNotMatch(m.state.html, /dl-item is-paused/);
  assert.match(m.state.html, /Downloading again\./);
});

test('Reveal opens the real downloads folder', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-038');
  m.click('dl-reveal-done');
  assert.deepEqual(m.calls.command, ['openDownloads']);
  assert.match(m.state.html, /Opening your downloads folder\./);
});

test('reveal is hidden where the platform cannot open the folder', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, canOpenDownloads: false } });
  m.context.window.__vaayvuOnboardingOpen('s-038');
  assert.doesNotMatch(m.state.html, /data-onboard="dl-reveal-active"/);
  assert.doesNotMatch(m.state.html, /data-onboard="dl-reveal-done"/);
});

test('s-038 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, downloadBubble: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-038'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-038');
  m.click('dl-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the downloadBubble event opens s-038 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'downloadBubble' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-038');
});

// ----- s-040: extension overflow -------------------------------------------

test('s-040 renders pinned icons, overflow and the manager', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-040'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-040');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Extensions overflow');
  assert.match(m.state.html, /ext-pin-btn/);
  assert.match(m.state.html, /Shield helper/);
  assert.match(m.state.html, /ext-overflow/);
  assert.match(m.state.html, /ext-count">3/);
  assert.match(m.state.html, /More extensions/);
  assert.match(m.state.html, /data-onboard="ext-manager">Manage extensions/);
  assert.match(m.state.html, /01 Pinned/);
  assert.match(m.state.html, /03 Manager/);
});

test('the overflow control opens and closes the menu', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-040');
  assert.match(m.state.html, /ext-menu/);
  m.click('ext-overflow');
  assert.doesNotMatch(m.state.html, /ext-menu/);
  assert.match(m.state.html, /aria-expanded="false"/);
});

test('pinning and unpinning move an extension between the two lists', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-040');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'ext-pin', ext: 'Password tools' } }
          : null,
    },
  });
  assert.match(m.state.html, /Pinned Password tools\./);
  assert.match(m.state.html, /ext-count">2/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'ext-unpin', ext: 'Dark mode' } }
          : null,
    },
  });
  assert.match(m.state.html, /Unpinned Dark mode\./);
  assert.match(m.state.html, /ext-count">3/);
});

test('Manage extensions opens the real manager', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-040');
  m.click('ext-manager');
  assert.deepEqual(m.calls.command, ['extensions']);
  assert.match(m.state.html, /Opening the extension manager\./);
});

test('s-040 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, extensionOverflow: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-040'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-040');
  m.click('ext-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the extensionOverflow event opens s-040 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'extensionOverflow' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-040');
});

// ----- s-042: space switcher -----------------------------------------------

test('s-042 renders spaces, icons, colours, add and edit', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-042'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-042');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Space switcher');
  assert.match(m.state.html, /sp-switcher/);
  assert.match(m.state.html, /Personal/);
  assert.match(m.state.html, /Work/);
  assert.match(m.state.html, /Study/);
  assert.match(m.state.html, /data-onboard="space-add"/);
  assert.match(m.state.html, /data-onboard="space-edit">Edit</);
  assert.match(m.state.html, /01 Spaces/);
  assert.match(m.state.html, /04 Add \/ edit/);
});

test('switching spaces changes the active space', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-042');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'space-select', space: 'work' } }
          : null,
    },
  });
  assert.match(m.state.html, /Switched to Work\./);
  assert.match(m.state.html, /aria-pressed="true" style="--sp-color:#5f8f74"/);
});

test('adding a space creates and selects it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-042');
  m.click('space-add');
  assert.match(m.state.html, /Space 1/);
  assert.match(m.state.html, /Added Space 1\./);
});

test('edit changes the icon and colour of the active space', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-042');
  m.click('space-edit');
  assert.match(m.state.html, /sp-editor/);
  assert.match(m.state.html, /data-onboard="space-icon"/);
  assert.match(m.state.html, /data-onboard="space-color"/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'space-icon', icon: '🚀' } }
          : null,
    },
  });
  assert.match(m.state.html, /Personal icon updated\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'space-color', color: '#b04848' } }
          : null,
    },
  });
  assert.match(m.state.html, /Personal colour updated\./);
  assert.match(m.state.html, /--sp-color:#b04848/);
});

test('s-042 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, spaceSwitcher: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-042'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-042');
  m.click('space-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the spaceSwitcher event opens s-042 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'spaceSwitcher' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-042');
});

// ----- s-044: macOS menu bar -----------------------------------------------

test('s-044 renders every menu in atlas order', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-044'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-044');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'macOS menu bar');
  for (const name of ['File', 'Edit', 'View', 'History', 'Bookmarks', 'People', 'Tab', 'Window', 'Help']) {
    assert.match(m.state.html, new RegExp('data-onboard="menu-open" data-menu="' + name + '"'));
  }
  assert.match(m.state.html, /01 Menu bar/);
  assert.match(m.state.html, /02 Menus/);
  assert.match(m.state.html, /03 Shortcuts/);
});

test('File opens by default with real items and shortcuts', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-044');
  assert.match(m.state.html, /aria-label="File menu"/);
  assert.match(m.state.html, /New Tab/);
  assert.match(m.state.html, /⌘T/);
  assert.match(m.state.html, /Save Page…/);
});

test('choosing another menu and an item reports the path', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-044');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'menu-open', menu: 'View' } }
          : null,
    },
  });
  assert.match(m.state.html, /aria-label="View menu"/);
  assert.match(m.state.html, /Reader View/);
  assert.match(m.state.html, /View menu open\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'menu-item', menu: 'View', item: 'Reader View' } }
          : null,
    },
  });
  assert.match(m.state.html, /View → Reader View/);
});

test('s-044 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, menuBar: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-044'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-044');
  m.click('menu-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the menuBar event opens s-044 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'menuBar' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-044');
});

// ----- s-046: page context menu --------------------------------------------

test('s-046 renders every page action with shortcuts', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-046'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-046');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Page context menu');
  for (const id of ['back', 'forward', 'reload', 'save', 'print', 'translate', 'reader', 'inspect']) {
    assert.match(m.state.html, new RegExp('data-onboard="ctx-item" data-ctx="' + id + '"'));
  }
  assert.match(m.state.html, /⌘\[/);
  assert.match(m.state.html, /⌥⌘I/);
  assert.match(m.state.html, /01 Page/);
  assert.match(m.state.html, /03 Tools/);
});

test('history, save, print and inspect call the real commands', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-046');
  for (const [id, message] of [
    ['back', 'Going back.'],
    ['forward', 'Going forward.'],
    ['reload', 'Reloading the page.'],
    ['save', 'Opening Save Page As…'],
    ['print', 'Opening Print…'],
    ['inspect', 'Opening the inspector.'],
  ]) {
    m.overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'ctx-item', ctx: id } } : null,
      },
    });
    assert.match(m.state.html, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.deepEqual(m.calls.command, ['back', 'forward', 'reload', 'savePage', 'print', 'inspect']);
});

test('Reader toggles and Translate asks the host', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-046');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]' ? { dataset: { onboard: 'ctx-item', ctx: 'reader' } } : null,
    },
  });
  assert.match(m.state.html, /Exit Reader View/);
  assert.match(m.state.html, /Reader view on\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'ctx-item', ctx: 'translate' } }
          : null,
    },
  });
  assert.equal(m.calls.sent.length, 1);
  assert.equal(m.calls.sent[0].type, 'translatePage');
  assert.match(m.state.html, /Asking your device to translate this page\./);
});

test('s-046 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, pageContext: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-046'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-046');
  m.click('ctx-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the pageContext event opens s-046 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'pageContext' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-046');
});

// ----- s-048: image / video context menu -----------------------------------

test('s-048 renders save, copy, open, search, PiP and Cast for a video', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-048'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-048');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Image/video context menu');
  assert.match(m.state.html, /Save video…/);
  assert.match(m.state.html, /Copy video/);
  assert.match(m.state.html, /Open video in new tab/);
  assert.match(m.state.html, /Search with DuckDuckGo/);
  assert.match(m.state.html, /Picture-in-Picture/);
  assert.match(m.state.html, /Cast…/);
  assert.match(m.state.html, /01 Media/);
  assert.match(m.state.html, /03 Playback/);
});

test('an image menu drops Picture-in-Picture and uses image labels', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, mediaKind: 'image' } });
  m.context.window.__vaayvuOnboardingOpen('s-048');
  assert.match(m.state.html, /Save image…/);
  assert.doesNotMatch(m.state.html, /data-media="pip"/);
  assert.match(m.state.html, /data-media="cast"/);
});

test('media actions send the matching host message', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-048');
  for (const [id, type] of [
    ['save', 'saveMedia'],
    ['copy', 'copyMedia'],
    ['open', 'openMedia'],
    ['search', 'searchMedia'],
  ]) {
    m.overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]'
            ? { dataset: { onboard: 'media-item', media: id } }
            : null,
      },
    });
    assert.equal(m.calls.sent[m.calls.sent.length - 1].type, type);
    assert.equal(m.calls.sent[m.calls.sent.length - 1].kind, 'video');
  }
  assert.match(m.state.html, /Asking the host to search for this video\./);
});

test('Picture-in-Picture and Cast report what the host is doing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-048');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'media-item', media: 'pip' } }
          : null,
    },
  });
  assert.equal(m.calls.sent[0].type, 'pictureInPicture');
  assert.match(m.state.html, /Exit Picture-in-Picture/);
  assert.match(m.state.html, /Picture-in-Picture on\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'media-item', media: 'cast' } }
          : null,
    },
  });
  assert.equal(m.calls.sent[m.calls.sent.length - 1].type, 'castMedia');
  assert.match(m.state.html, /Looking for cast devices…/);
});

test('s-048 hides PiP and Cast when the platform cannot provide them', () => {
  const m = mount({
    capabilities: { ...ALL_SETUP, canPictureInPicture: false, canCast: false },
  });
  m.context.window.__vaayvuOnboardingOpen('s-048');
  assert.doesNotMatch(m.state.html, /data-media="pip"/);
  assert.doesNotMatch(m.state.html, /data-media="cast"/);
});

test('s-048 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, imageContext: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-048'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-048');
  m.click('media-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mediaContext event opens s-048 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'mediaContext' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-048');
});

// ----- s-049: toast / undo host --------------------------------------------

test('s-049 renders the close-tab toast with Undo and all five examples', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-049'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-049');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Toast/undo host');
  assert.match(m.state.html, /Tab closed/);
  assert.match(m.state.html, /data-onboard="toast-action">Undo</);
  for (const label of ['Close tab', 'Bookmark', 'Download', 'Sync', 'Error']) {
    assert.match(m.state.html, new RegExp('data-onboard="toast-kind" data-kind="[a-z]+">' + label + '<'));
  }
  assert.match(m.state.html, /01 Toast/);
  assert.match(m.state.html, /03 Error/);
});

test('the error example is an error toast with Retry', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-049');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]' ? { dataset: { onboard: 'toast-kind', kind: 'error' } } : null,
    },
  });
  assert.match(m.state.html, /data-tone="error"/);
  assert.match(m.state.html, /Sync failed/);
  assert.match(m.state.html, /data-onboard="toast-action">Retry/);
});

test('Undo restores the tab and removes the bookmark', () => {
  const close = mount({ capabilities: { ...ALL_SETUP } });
  close.context.window.__vaayvuOnboardingOpen('s-049');
  close.click('toast-action');
  assert.doesNotMatch(close.state.html, /class="toast"/);
  assert.match(close.state.html, /Tab restored\./);

  const bookmark = mount({ capabilities: { ...ALL_SETUP } });
  bookmark.context.window.__vaayvuOnboardingOpen('s-049');
  bookmark.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'toast-kind', kind: 'bookmark' } }
          : null,
    },
  });
  bookmark.click('toast-action');
  assert.match(bookmark.state.html, /Bookmark removed\./);
});

test('Show opens the downloads folder and dismiss clears the toast', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-049');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'toast-kind', kind: 'download' } }
          : null,
    },
  });
  m.click('toast-action');
  assert.deepEqual(m.calls.command, ['openDownloads']);
  assert.match(m.state.html, /Opening your downloads folder\./);

  const dismissed = mount({ capabilities: { ...ALL_SETUP } });
  dismissed.context.window.__vaayvuOnboardingOpen('s-049');
  dismissed.click('toast-dismiss');
  assert.doesNotMatch(dismissed.state.html, /class="toast"/);
  assert.match(dismissed.state.html, /Toast dismissed\./);
});

test('s-049 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, toastHost: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-049'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-049');
  m.click('toast-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the toastHost event opens s-049 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'toastHost' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-049');
});

// ----- s-052: start page, customized ---------------------------------------

test('s-052 renders wallpaper, layout and widget controls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-052'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-052');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Start customized');
  assert.match(m.state.html, /data-wallpaper="observatory"/);
  assert.match(m.state.html, /data-onboard="stp-wallpaper"/);
  assert.match(m.state.html, /data-onboard="stp-layout"/);
  assert.match(m.state.html, /data-onboard="stp-widget"/);
  assert.match(m.state.html, /data-layout="centered"/);
  assert.match(m.state.html, /Clock/);
  assert.match(m.state.html, /Weather/);
  assert.match(m.state.html, /Reading list/);
  assert.match(m.state.html, /Spaces/);
});

test('wallpaper and layout update the preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-052');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stp-wallpaper', wallpaper: 'ridge' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-wallpaper="ridge"/);
  assert.match(m.state.html, /Wallpaper set to Ridge\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stp-layout', layout: 'sidebar' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-layout="sidebar"/);
  assert.match(m.state.html, /Layout set to Sidebar\./);
});

test('widgets toggle on and off in the preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-052');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stp-widget', widget: 'clock' } }
          : null,
    },
  });
  assert.match(m.state.html, /Clock widget off\./);
  assert.doesNotMatch(m.state.html, /9:41/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stp-widget', widget: 'clock' } }
          : null,
    },
  });
  assert.match(m.state.html, /Clock widget on\./);
  assert.match(m.state.html, /9:41/);
});

test('s-052 starts from host start-page state', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      startPage: {
        wallpaper: 'dusk',
        layout: 'compact',
        widgets: { clock: true, weather: false, reading: false, spaces: true },
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-052');
  assert.match(m.state.html, /data-wallpaper="dusk"/);
  assert.match(m.state.html, /data-layout="compact"/);
  assert.doesNotMatch(m.state.html, /18°/);
  assert.match(m.state.html, /3<\/strong><small>spaces/);
});

test('s-052 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, startPageCustomize: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-052'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-052');
  m.click('stp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the startPageCustomize event opens s-052 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'startPageCustomize' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-052');
});

// ----- s-054: shortcut editor ----------------------------------------------

test('s-054 renders shortcut tiles, editor and add control', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-054'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-054');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Shortcuts editor');
  for (const name of ['GitHub', 'MDN', 'Linear', 'Figma']) assert.match(m.state.html, new RegExp(name));
  assert.match(m.state.html, /data-onboard="shortcut-add"/);
  assert.match(m.state.html, /data-shortcut-field="name"/);
  assert.match(m.state.html, /data-shortcut-field="url"/);
  assert.match(m.state.html, /data-onboard="shortcut-save"/);
  assert.match(m.state.html, /data-onboard="shortcut-delete"/);
  assert.match(m.state.html, /01 Add/);
  assert.match(m.state.html, /04 Favicon/);
});

test('selecting a shortcut fills the editor', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-054');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'shortcut-select', id: 'sc-2' } }
          : null,
    },
  });
  assert.match(m.state.html, /Editing MDN/);
  assert.match(m.state.html, /value="MDN"/);
  assert.match(m.state.html, /value="https:\/\/developer\.mozilla\.org"/);
});

test('editing name and URL saves them together', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-054');
  m.change({ dataset: { shortcutField: 'name' }, value: 'GitHub Docs' });
  m.change({ dataset: { shortcutField: 'url' }, value: 'https://docs.github.com' });
  m.click('shortcut-save');
  assert.match(m.state.html, /Saved GitHub Docs\./);
  assert.match(m.state.html, /GitHub Docs/);
  assert.match(m.state.html, /https:\/\/docs\.github\.com/);
});

test('an invalid URL is refused with a real reason', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-054');
  m.change({ dataset: { shortcutField: 'url' }, value: 'github.com' });
  m.click('shortcut-save');
  assert.match(m.state.html, /Enter a full HTTP or HTTPS address\./);
});

test('adding, deleting and reordering change the grid', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-054');
  m.click('shortcut-add');
  assert.match(m.state.html, /New shortcut/);
  assert.match(m.state.html, /Added a shortcut/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'shortcut-delete' } }
          : null,
    },
  });
  assert.match(m.state.html, /Deleted New shortcut\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'shortcut-move', id: 'sc-2', dir: 'up' } }
          : null,
    },
  });
  assert.match(m.state.html, /Moved MDN up\./);
});

test('s-054 starts from host shortcuts and respects the gate', () => {
  const seeded = mount({
    capabilities: {
      ...ALL_SETUP,
      shortcuts: [
        { name: 'Docs', url: 'https://example.com/docs', color: '#2d6a4f' },
        { name: 'Mail', url: 'https://mail.example.com' },
      ],
    },
  });
  seeded.context.window.__vaayvuOnboardingOpen('s-054');
  assert.match(seeded.state.html, /Docs/);
  assert.match(seeded.state.html, /Mail/);

  const hidden = mount({ capabilities: { ...ALL_SETUP, shortcutEditor: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-054'), false);
});

test('Continue on s-054 returns to the chain and the event opens it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-054');
  m.click('shortcut-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');

  const event = mount({ capabilities: { ...ALL_SETUP } });
  event.context.window.vaayvuEvent({ type: 'shortcutEditor' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-054');
});

// ----- s-056: continue browsing --------------------------------------------

test('s-056 renders recent tabs with restore and dismiss', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-056'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-056');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Continue browsing');
  assert.match(m.state.html, /Continue browsing/);
  assert.match(m.state.html, /3 tabs from your last session/);
  assert.match(m.state.html, /Why the tide keeps time/);
  assert.match(m.state.html, /theverge\.com/);
  assert.match(m.state.html, /data-onboard="cb-restore-all">Restore all</);
  assert.match(m.state.html, /data-onboard="cb-dismiss">Dismiss</);
  assert.match(m.state.html, /01 Recent tabs/);
  assert.match(m.state.html, /03 Dismiss/);
});

test('Restore all sends every recent URL', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-056');
  m.click('cb-restore-all');
  assert.equal(m.calls.sent.length, 1);
  assert.equal(m.calls.sent[0].type, 'restoreTabs');
  assert.equal(m.calls.sent[0].urls.length, 3);
  assert.match(m.state.html, /Restoring 3 tabs\./);
});

test('one row restores one tab and reports its title', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-056');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'cb-restore', id: 'rt-2' } }
          : null,
    },
  });
  assert.equal(m.calls.sent[0].type, 'restoreTab');
  assert.equal(m.calls.sent[0].url, 'https://github.com/vaayvu/shield');
  assert.match(m.state.html, /Restored “Rasha Shield — design notes”\./);
});

test('Dismiss clears the list without opening anything', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-056');
  m.click('cb-dismiss');
  assert.match(m.state.html, /Recent tabs dismissed\./);
  assert.doesNotMatch(m.state.html, /Why the tide keeps time/);
  assert.match(m.state.html, /No recent tabs/);
  assert.equal(m.calls.sent.length, 0);
});

test('s-056 uses host recent tabs and respects the gate', () => {
  const seeded = mount({
    capabilities: {
      ...ALL_SETUP,
      recentTabs: [
        { title: 'Docs', url: 'https://example.com/docs' },
        { title: 'Mail', url: 'https://mail.example.com' },
      ],
    },
  });
  seeded.context.window.__vaayvuOnboardingOpen('s-056');
  assert.match(seeded.state.html, /2 tabs from your last session/);
  assert.match(seeded.state.html, /mail\.example\.com/);

  const hidden = mount({ capabilities: { ...ALL_SETUP, continueBrowsing: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-056'), false);
});

test('Continue returns to the chain and the event opens s-056', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-056');
  m.click('cb-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');

  const event = mount({ capabilities: { ...ALL_SETUP } });
  event.context.window.vaayvuEvent({ type: 'continueBrowsing' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-056');
});

// ----- s-058: reading list preview -----------------------------------------

test('s-058 renders three saved pages with reading time', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-058'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-058');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Reading list preview');
  assert.match(m.state.html, /3 saved/);
  assert.match(m.state.html, /The quiet web: designing for attention/);
  assert.match(m.state.html, /alistapart\.com/);
  assert.match(m.state.html, /8 min read/);
  assert.match(m.state.html, /data-onboard="rl-open-all">Open all</);
  assert.match(m.state.html, /01 Saved pages/);
  assert.match(m.state.html, /03 Open all/);
});

test('opening one page sends only its URL', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-058');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'rl-open', id: 'rl-2' } }
          : null,
    },
  });
  assert.equal(m.calls.sent[0].type, 'openReading');
  assert.equal(m.calls.sent[0].url, 'https://developer.mozilla.org/docs/Web/Privacy');
  assert.match(m.state.html, /Opening “How browsers keep your data local”\./);
});

test('Open all sends every saved URL', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-058');
  m.click('rl-open-all');
  assert.equal(m.calls.sent[0].type, 'openReadingList');
  assert.equal(m.calls.sent[0].urls.length, 3);
  assert.match(m.state.html, /Opening 3 saved pages\./);
});

test('s-058 uses host reading items and respects the gate', () => {
  const seeded = mount({
    capabilities: {
      ...ALL_SETUP,
      readingList: [
        { title: 'First', url: 'https://example.com/first', minutes: 3 },
        { title: 'Second', url: 'https://example.com/second', minutes: 7 },
      ],
    },
  });
  seeded.context.window.__vaayvuOnboardingOpen('s-058');
  assert.match(seeded.state.html, /2 saved/);
  assert.match(seeded.state.html, /example\.com/);
  assert.match(seeded.state.html, /3 min read/);

  const hidden = mount({ capabilities: { ...ALL_SETUP, readingListPreview: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-058'), false);
});

test('s-058 empty shelf shows zero and opens bookmarks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, readingList: [] } });
  m.context.window.__vaayvuOnboardingOpen('s-058');
  assert.match(m.state.html, /0 saved/);
  assert.match(m.state.html, /No saved pages yet\./);
  m.click('rl-bookmarks');
  assert.deepEqual(m.calls.command, ['bookmarks']);
  assert.match(m.state.html, /Opening your bookmarks\./);
});

test('Continue returns to the chain and the event opens s-058', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-058');
  m.click('rl-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');

  const event = mount({ capabilities: { ...ALL_SETUP } });
  event.context.window.vaayvuEvent({ type: 'readingListPreview' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-058');
});

// ----- s-060: news feed (opt-in) -------------------------------------------

test('s-060 starts off by default with no feed fetched', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-060'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-060');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'News feed (opt-in)');
  assert.match(m.state.html, /aria-checked="false"/);
  assert.match(m.state.html, /Nothing is fetched until you turn it on/);
  assert.match(m.state.html, /Turn on news feed/);
  assert.doesNotMatch(m.state.html, /nf-stories/);
  assert.match(m.state.html, /01 Off by default/);
});

test('turning it on shows topics, sources and stories', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-060');
  m.click('news-toggle');
  assert.match(m.state.html, /aria-checked="true"/);
  assert.match(m.state.html, /Technology/);
  assert.match(m.state.html, /The Verge/);
  assert.match(m.state.html, /Design systems are moving back into the browser/);
  assert.match(m.state.html, /News feed on\. Choose topics and sources\./);
});

test('topics and sources toggle, stories hide', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-060');
  m.click('news-toggle');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'news-topic', topic: 'Space' } }
          : null,
    },
  });
  assert.match(m.state.html, /Space added\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'news-source', source: 'MDN Blog' } }
          : null,
    },
  });
  assert.match(m.state.html, /MDN Blog removed\./);
  assert.doesNotMatch(m.state.html, /A practical guide to Content Security Policy/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'news-hide', id: 'nw-1' } }
          : null,
    },
  });
  assert.match(m.state.html, /Story hidden\./);
  assert.doesNotMatch(m.state.html, /Design systems are moving back into the browser/);
});

test('s-060 can start enabled from host state', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      newsFeed: {
        enabled: true,
        topics: ['Science', 'Space'],
        sources: ['Reuters'],
        hidden: ['nw-2'],
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-060');
  assert.match(m.state.html, /aria-checked="true"/);
  assert.match(m.state.html, /Science/);
  assert.match(m.state.html, /Reuters/);
});

test('s-060 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, newsFeed: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-060'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-060');
  m.click('news-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the newsFeed event opens s-060 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'newsFeed' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-060');
});

// ----- s-063: start page settings ------------------------------------------

test('s-063 renders section toggles, layout and a live preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-063'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-063');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Start settings');
  for (const label of ['Search', 'Spaces', 'Favorites', 'Recently visited', 'Reading list', 'Continue browsing', 'News feed']) {
    assert.match(m.state.html, new RegExp('aria-label="' + label + ' section"'));
  }
  assert.match(m.state.html, /data-onboard="stg-layout"/);
  assert.match(m.state.html, /data-layout="centered"/);
  assert.match(m.state.html, /stg-search/);
  assert.match(m.state.html, /01 Sections/);
  assert.match(m.state.html, /03 Preview/);
});

test('toggling a section updates the preview and status', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-063');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stg-section', section: 'news' } }
          : null,
    },
  });
  assert.match(m.state.html, /News feed section on\./);
  assert.match(m.state.html, /<strong>News feed<\/strong>/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stg-section', section: 'search' } }
          : null,
    },
  });
  assert.match(m.state.html, /Search section off\./);
  assert.doesNotMatch(m.state.html, /stg-search/);
});

test('layout changes apply to the preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-063');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'stg-layout', layout: 'compact' } }
          : null,
    },
  });
  assert.match(m.state.html, /data-layout="compact"/);
  assert.match(m.state.html, /Layout set to Compact\./);
});

test('s-063 starts from host settings', () => {
  const m = mount({
    capabilities: {
      ...ALL_SETUP,
      startSettings: {
        layout: 'sidebar',
        sections: { search: false, spaces: false, favorites: true, recent: false, reading: true, continue: false, news: true },
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-063');
  assert.match(m.state.html, /data-layout="sidebar"/);
  assert.doesNotMatch(m.state.html, /stg-search/);
  assert.match(m.state.html, /<strong>News feed<\/strong>/);
  assert.doesNotMatch(m.state.html, /<strong>Spaces<\/strong>/);
});

test('s-063 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, startSettings: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-063'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-063');
  m.click('stg-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the startSettings event opens s-063 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'startSettings' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-063');
});

// ----- s-065: private start ------------------------------------------------

test('s-065 explains the private window and its empty omnibox', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-065'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-065');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Private start');
  assert.match(m.state.html, /Private window/);
  assert.match(m.state.html, /History is not recorded/);
  assert.match(m.state.html, /No bookmark or history suggestions/);
  assert.match(m.state.html, /Cookies and site data clear/);
  assert.match(m.state.html, /01 Private/);
  assert.match(m.state.html, /03 Suggestions/);
});

test('checking suggestions states the honest empty result', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-065');
  m.click('private-check');
  assert.match(m.state.html, /No suggestions/);
  assert.match(m.state.html, /No history or bookmark suggestions in private windows\./);
});

test('s-065 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, privateStart: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-065'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-065');
  m.click('private-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the privateStart event opens s-065 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'privateStart' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-065');
});

// ----- s-067: inactive tab ------------------------------------------------

test('s-067 renders one active and one dimmed tab with hover actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-067'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-067');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Inactive tab');
  assert.match(m.state.html, /it-tab is-active[^>]*>Observatory/);
  assert.match(m.state.html, /it-tab is-inactive/);
  assert.match(m.state.html, /data-onboard="it-pin"/);
  assert.match(m.state.html, /data-onboard="it-close"/);
  assert.match(m.state.html, /01 Dimmed/);
  assert.match(m.state.html, /03 Activate/);
});

test('activating the dimmed tab switches the active page', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-067');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'it-activate', id: 'reading' } }
          : null,
    },
  });
  assert.match(m.state.html, /Switched to Reading\./);
  assert.match(m.state.html, /it-tab is-active[^>]*>Reading/);
});

test('pinning and closing the background tab report their result', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-067');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'it-pin', id: 'reading' } }
          : null,
    },
  });
  assert.match(m.state.html, /Pinned Reading\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'it-close', id: 'reading' } }
          : null,
    },
  });
  assert.match(m.state.html, /Closed Reading\./);
  assert.doesNotMatch(m.state.html, /it-tab is-inactive/);
});

test('s-067 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, inactiveTab: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-067'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-067');
  m.click('it-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the inactiveTab event opens s-067 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'inactiveTab' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-067');
});

// ----- s-068: pinned tab ---------------------------------------------------

test('s-068 renders favicon-only pinned tabs in a fixed zone', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-068'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-068');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Pinned tab');
  assert.match(m.state.html, /pt-zone/);
  assert.match(m.state.html, /data-onboard="pt-activate" data-id="pin-1"/);
  assert.match(m.state.html, /data-onboard="pt-unpin"/);
  assert.match(m.state.html, /data-onboard="pt-pin"/);
  assert.match(m.state.html, /01 Favicon only/);
  assert.match(m.state.html, /02 Fixed zone/);
  assert.match(m.state.html, /03 Unpin/);
});

test('pinning and unpinning move a tab across the divider', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-068');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'pt-pin', id: 'tab-1' } }
          : null,
    },
  });
  assert.match(m.state.html, /Pinned Reading\./);
  assert.match(m.state.html, /data-id="tab-1" aria-label="Reading" title="Reading"/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'pt-unpin', id: 'pin-2' } }
          : null,
    },
  });
  assert.match(m.state.html, /Unpinned GitHub\./);
});

test('clicking a tab activates it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-068');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'pt-activate', id: 'tab-2' } }
          : null,
    },
  });
  assert.match(m.state.html, /Switched to News\./);
  assert.match(m.state.html, /<strong>News<\/strong>/);
});

test('s-068 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, pinnedTab: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-068'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-068');
  m.click('pt-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the pinnedTab event opens s-068 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'pinnedTab' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-068');
});

// ----- s-070: playing audio ------------------------------------------------

test('s-070 renders an animated speaker on the playing tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-070'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-070');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Playing audio');
  assert.match(m.state.html, /au-speaker is-playing/);
  assert.match(m.state.html, /au-bars/);
  assert.match(m.state.html, /data-onboard="au-mute"/);
  assert.match(m.state.html, /Now playing/);
  assert.match(m.state.html, /01 Playing/);
  assert.match(m.state.html, /03 Mute/);
});

test('clicking the speaker mutes and unmutes the tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-070');
  m.click('au-mute');
  assert.match(m.state.html, /au-speaker is-muted/);
  assert.match(m.state.html, /aria-pressed="true"/);
  assert.match(m.state.html, /Muted\./);
  assert.match(m.state.html, />Unmute</);
  m.click('au-mute');
  assert.match(m.state.html, /au-speaker is-playing/);
  assert.match(m.state.html, /Playing again\./);
});

test('activating the other tab reports it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-070');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'au-activate', title: 'Observatory' } }
          : null,
    },
  });
  assert.match(m.state.html, /Showing Observatory\./);
});

test('s-070 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, playingAudio: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-070'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-070');
  m.click('au-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the playingAudio event opens s-070 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'playingAudio' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-070');
});

// ----- s-071: loading tab --------------------------------------------------

test('s-071 renders a spinning tab with a progress bar', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-071'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-071');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Loading tab');
  assert.match(m.state.html, /lt-spinner/);
  assert.match(m.state.html, /aria-valuenow="35"/);
  assert.match(m.state.html, /Loading, 35%/);
  assert.match(m.state.html, /01 Spinner/);
  assert.match(m.state.html, /02 Progress/);
  assert.match(m.state.html, /03 Settled/);
});

test('advancing the load moves the bar and settles at 100%', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-071');
  m.click('lt-step');
  assert.match(m.state.html, /aria-valuenow="60"/);
  assert.match(m.state.html, /Loading, 60%/);
  m.click('lt-step');
  m.click('lt-step');
  assert.match(m.state.html, /aria-valuenow="100"/);
  assert.match(m.state.html, /Page loaded\./);
  assert.doesNotMatch(m.state.html, /lt-spinner/);
  assert.match(m.state.html, /lt-fav/);
});

test('reload restarts the progress from the beginning', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-071');
  m.click('lt-reload');
  assert.match(m.state.html, /aria-valuenow="10"/);
  assert.match(m.state.html, /Reloading\./);
});

test('s-071 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, loadingTab: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-071'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-071');
  m.click('lt-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the loadingTab event opens s-071 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'loadingTab' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-071');
});

// ----- s-073: sleeping tab -------------------------------------------------

test('s-073 opens with the tab dimmed and marked sleeping', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-073'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-073');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Sleeping tab');
  assert.match(m.state.html, /sl-tab is-sleeping/);
  assert.match(m.state.html, /sl-badge">Sleeping</);
  assert.match(m.state.html, /sl-zzz/);
  assert.match(m.state.html, /sl-stage is-sleeping/);
  assert.match(m.state.html, /01 Dimmed/);
  assert.match(m.state.html, /02 Sleeping/);
  assert.match(m.state.html, /03 Wake/);
});

test('waking restores the tab and sleeping it again re-marks it', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-073');
  m.click('sl-wake');
  assert.match(m.state.html, /Reading woke where you left it\./);
  assert.doesNotMatch(m.state.html, /sl-badge">Sleeping</);
  m.click('sl-sleep');
  assert.match(m.state.html, /Reading put to sleep\. Its memory was released\./);
  assert.match(m.state.html, /sl-badge">Sleeping</);
});

test('s-073 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, sleepingTab: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-073'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-073');
  m.click('sl-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the sleepingTab event opens s-073 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'sleepingTab' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-073');
});

// ----- s-075: collapsed group ----------------------------------------------

test('s-075 opens with one coloured header standing in for the group', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-075'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-075');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Group collapsed');
  assert.match(m.state.html, /gc-group is-collapsed/);
  assert.match(m.state.html, /aria-expanded="false"/);
  assert.match(m.state.html, /aria-label="Expand Research group, 3 tabs"/);
  assert.match(m.state.html, /gc-count">3</);
  assert.match(m.state.html, /Research · 3 tabs/);
  assert.match(m.state.html, /Collapsed group/);
  assert.match(m.state.html, /01 Colour/);
  assert.match(m.state.html, /02 Count/);
  assert.match(m.state.html, /03 Expand/);
});

test('expanding the group reveals its tabs and keeps the count', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-075');
  m.click('gc-toggle');
  assert.match(m.state.html, /gc-tabs/);
  assert.match(m.state.html, /gc-count">3</);
  assert.match(m.state.html, /aria-expanded="true"/);
  assert.match(m.state.html, /Research group expanded, 3 tabs\./);
  assert.match(m.state.html, /gc-tab is-active/);
  assert.match(m.state.html, /Expanded group/);
  m.click('gc-toggle');
  assert.match(m.state.html, /gc-group is-collapsed/);
  assert.match(m.state.html, /Research group collapsed, 3 tabs\./);
});

test('s-075 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, groupCollapsed: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-075'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-075');
  m.click('gc-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the groupCollapsed event opens s-075 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'groupCollapsed' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-075');
});

// ----- s-078: split 2-up ---------------------------------------------------

test('s-078 renders two panes with a divider between them', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-078'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-078');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Split 2-up');
  assert.match(m.state.html, /data-side="left"/);
  assert.match(m.state.html, /data-side="right"/);
  assert.match(m.state.html, /aria-valuenow="50"/);
  assert.match(m.state.html, /data-active="left"/);
  assert.match(m.state.html, /01 Divider/);
  assert.match(m.state.html, /02 Swap/);
  assert.match(m.state.html, /03 Close pane/);
  assert.match(m.state.html, /04 Focus/);
});

test('the divider cycles through its three positions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-078');
  m.click('sp-divider');
  assert.match(m.state.html, /aria-valuenow="65"/);
  assert.match(m.state.html, /Divider at 65%\./);
  m.click('sp-divider');
  assert.match(m.state.html, /aria-valuenow="35"/);
  m.click('sp-divider');
  assert.match(m.state.html, /aria-valuenow="50"/);
});

test('swap and focus act on the panes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-078');
  m.click('sp-swap');
  assert.match(m.state.html, /Panes swapped\./);
  assert.match(m.state.html, /data-side="left"[^>]*aria-label="Notes pane"/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sp-focus', side: 'left' } }
          : null,
    },
  });
  assert.match(m.state.html, /Focused Notes\./);
  assert.match(m.state.html, /data-active="left"/);
});

test('closing a pane leaves a single full-width pane and can reopen', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-078');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sp-close', side: 'right' } }
          : null,
    },
  });
  assert.match(m.state.html, /sp-stage is-single/);
  assert.doesNotMatch(m.state.html, /data-side="right"/);
  assert.match(m.state.html, /Pane closed\. The other side takes the window\./);
  m.click('sp-reopen');
  assert.match(m.state.html, /Second pane reopened\./);
  assert.match(m.state.html, /data-side="right"/);
});

test('s-078 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, split2Up: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-078'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-078');
  m.click('sp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the split2Up event opens s-078 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'split2Up' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-078');
});

// ----- s-083: group editor -------------------------------------------------

test('s-083 renders name, colour, emoji, save and sync controls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-083'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-083');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab group editor');
  assert.match(m.state.html, /data-group-editor-name/);
  assert.match(m.state.html, /value="Research"/);
  assert.match(m.state.html, /tge-swatch/);
  assert.match(m.state.html, /tge-emoji/);
  assert.match(m.state.html, /data-onboard="tge-sync"/);
  assert.match(m.state.html, /aria-checked="true"/);
  assert.match(m.state.html, /01 Name/);
  assert.match(m.state.html, /04 Sync/);
});

test('typing a name updates the preview and marks it unsaved', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-083');
  m.overlay.oninput({
    target: { hasAttribute: (name) => name === 'data-group-editor-name', value: 'Field notes' },
  });
  assert.match(m.state.html, /Field notes/);
  assert.match(m.state.html, /Unsaved changes\./);
  assert.doesNotMatch(m.state.html, /tge-saved/);
});

test('colour and emoji choices repaint the group header', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-083');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tge-color', color: '#00b894' } }
          : null,
    },
  });
  assert.match(m.state.html, /--group-color:#00b894/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tge-emoji', emoji: '💼' } }
          : null,
    },
  });
  assert.match(m.state.html, /aria-label="Group emoji 💼"/);
});

test('save writes locally and reports the sync state', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-083');
  m.click('tge-save');
  assert.match(m.state.html, /Group saved on this device\. Sync is on\./);
  assert.match(m.state.html, /tge-saved/);
  m.click('tge-sync');
  assert.match(m.state.html, /aria-checked="false"/);
  m.click('tge-save');
  assert.match(m.state.html, /Group saved on this device\. Sync is off\./);
});

test('s-083 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, groupEditor: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-083'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-083');
  m.click('tge-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the groupEditor event opens s-083 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'groupEditor' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-083');
});

// ----- s-080: tab search ---------------------------------------------------

test('s-080 renders fuzzy search, results and a preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-080'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-080');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab search');
  assert.match(m.state.html, /data-tab-search/);
  assert.match(m.state.html, /role="listbox"/);
  assert.match(m.state.html, /ts-row is-selected/);
  assert.match(m.state.html, /ts-preview/);
  assert.match(m.state.html, /01 Fuzzy/);
  assert.match(m.state.html, /03 Switch/);
});

test('typing filters the results with a fuzzy match', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-080');
  m.overlay.oninput({
    target: { hasAttribute: (name) => name === 'data-tab-search', value: 'read' },
  });
  assert.match(m.state.html, /Reading list/);
  assert.doesNotMatch(m.state.html, /Weather/);
  m.overlay.oninput({
    target: { hasAttribute: (name) => name === 'data-tab-search', value: 'zzz' },
  });
  assert.match(m.state.html, /No tabs match/);
  assert.match(m.state.html, /ts-empty/);
});

test('preview selection switches or opens in a new window', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-080');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'ts-select', id: 'notes' } }
          : null,
    },
  });
  assert.match(m.state.html, /Previewing Notes\./);
  assert.match(m.state.html, /notes\.example\.com · Work/);
  m.click('ts-switch');
  assert.match(m.state.html, /Switched to Notes\./);
  m.click('ts-new-window');
  assert.match(m.state.html, /Opened Notes in a new window\./);
  assert.match(m.state.html, /Opened in a new window/);
});

test('s-080 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, tabSearch: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-080'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-080');
  m.click('ts-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the tabSearch event opens s-080 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'tabSearch' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-080');
});

// ----- s-084: tab content menu ---------------------------------------------

test('s-084 lists exactly 25 tab actions in five sections', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-084'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-084');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab context menu');
  assert.equal((m.state.html.match(/data-action="/g) || []).length, 25);
  assert.match(m.state.html, /aria-label="25 actions"/);
  for (const section of ['Tab', 'Group', 'Page', 'Share', 'Close']) {
    assert.match(m.state.html, new RegExp('tc-section-label">' + section + '<'));
  }
  assert.match(m.state.html, /New tab to the right/);
  assert.match(m.state.html, /Reopen closed tab/);
  assert.match(m.state.html, /01 Sections/);
  assert.match(m.state.html, /03 Scope/);
});

test('pin, mute and group update the tab badges', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-084');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tc-action', action: 'pin' } }
          : null,
    },
  });
  assert.match(m.state.html, /tc-badge">Pinned</);
  assert.match(m.state.html, /Unpin tab/);
  assert.match(m.state.html, /Tab pinned\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tc-action', action: 'mute' } }
          : null,
    },
  });
  assert.match(m.state.html, /tc-badge">Muted</);
  assert.match(m.state.html, /Unmute tab/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tc-action', action: 'group-remove' } }
          : null,
    },
  });
  assert.doesNotMatch(m.state.html, /tc-badge is-group/);
  assert.match(m.state.html, /Removed from Research\./);
});

test('close and reopen act on the tab, and reset clears the state', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-084');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tc-action', action: 'close' } }
          : null,
    },
  });
  assert.match(m.state.html, /tc-tab is-closed/);
  assert.match(m.state.html, /Tab closed\. Reopen is still in the menu\./);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'tc-action', action: 'reopen' } }
          : null,
    },
  });
  assert.doesNotMatch(m.state.html, /tc-tab is-closed/);
  assert.match(m.state.html, /Tab reopened\./);
  m.click('tc-reset');
  assert.match(m.state.html, /Menu reset\./);
  m.click('tc-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-084 respects its platform gate', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, tabContentMenu: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-084'), false);
});

test('the tabContentMenu event opens s-084 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'tabContentMenu' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-084');
});

// ----- s-087: close undo toast ---------------------------------------------

test('s-087 shows an eight-second toast with Undo and Close all', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-087'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-087');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Close undo toast');
  assert.match(m.state.html, /aria-label="8 seconds left"/);
  assert.match(m.state.html, /<strong>8s<\/strong>/);
  assert.match(m.state.html, /3 tabs closed/);
  assert.match(m.state.html, /data-onboard="uc-undo"/);
  assert.match(m.state.html, /data-onboard="uc-close-all"/);
  assert.match(m.state.html, /01 8 seconds/);
  assert.match(m.state.html, /02 Undo/);
  assert.match(m.state.html, /03 Close all/);
});

test('Close all folds the remaining tab into the same toast', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-087');
  m.click('uc-close-all');
  assert.match(m.state.html, /All tabs closed/);
  assert.match(m.state.html, /4 tabs closed/);
  assert.match(m.state.html, /All tabs closed\. Undo is still available\./);
  assert.match(m.state.html, /<strong>Nothing open<\/strong>/);
  assert.equal((m.state.html.match(/uc-tab is-closed/g) || []).length, 4);
});

test('Undo restores the batch and ends the countdown', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-087');
  m.click('uc-undo');
  assert.match(m.state.html, /Restored 4 tabs\./);
  assert.match(m.state.html, /No undo pending/);
  assert.doesNotMatch(m.state.html, /uc-tab is-closed/);
  assert.doesNotMatch(m.state.html, /aria-label="8 seconds left"/);
});

test('dismissing leaves closed tabs to History', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-087');
  m.click('uc-dismiss');
  assert.match(m.state.html, /Toast dismissed\. Closed tabs stay in History\./);
  assert.match(m.state.html, /No undo pending/);
});

test('s-087 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, closeUndo: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-087'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-087');
  m.click('uc-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the closeUndo event opens s-087 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'closeUndo' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-087');
});

// ----- s-089: audio mixer --------------------------------------------------

test('s-089 renders per-tab volume, mute and focus controls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-089'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-089');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Audio mixer');
  assert.equal((m.state.html.match(/data-mixer-volume/g) || []).length, 3);
  assert.match(m.state.html, /data-id="music" aria-label="Music volume">/);
  assert.match(m.state.html, /mx-row is-active" data-mixer-row="music"/);
  assert.match(m.state.html, /data-onboard="mx-mute" data-id="music"/);
  assert.match(m.state.html, /data-onboard="mx-focus" data-id="music"/);
  assert.match(m.state.html, /01 Per-tab volume/);
  assert.match(m.state.html, /02 Mute/);
  assert.match(m.state.html, /03 Focus/);
});

test('a volume slider changes only that tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-089');
  m.overlay.oninput({
    target: {
      hasAttribute: (name) => name === 'data-mixer-volume',
      dataset: { id: 'video' },
      value: '30',
    },
  });
  assert.match(m.state.html, /Video volume 30%\./);
  assert.match(m.state.html, /data-id="video" aria-label="Video volume">/);
  assert.match(m.state.html, /value="30" data-mixer-volume data-id="video"/);
  assert.match(m.state.html, /value="72" data-mixer-volume data-id="music"/);
});

test('mute and focus act per tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-089');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'mx-mute', id: 'music' } }
          : null,
    },
  });
  assert.match(m.state.html, /Music muted\./);
  assert.match(m.state.html, /mx-row is-active is-muted" data-mixer-row="music"/);
  assert.match(m.state.html, /mx-percent">Muted</);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'mx-focus', id: 'video' } }
          : null,
    },
  });
  assert.match(m.state.html, /Focused Video\. Its sound is unchanged\./);
  assert.match(m.state.html, /mx-row is-active" data-mixer-row="video"/);
});

test('mute all and reset levels cover the whole mixer', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-089');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'mx-mute-all' } }
          : null,
    },
  });
  assert.match(m.state.html, /All tabs muted\./);
  assert.equal((m.state.html.match(/mx-row is-active/g) || []).length <= 1, true);
  assert.equal((m.state.html.match(/mx-row[^"]* is-muted/g) || []).length >= 2, true);
  assert.match(m.state.html, /Unmute all/);
  m.click('mx-reset');
  assert.match(m.state.html, /Levels reset\./);
  assert.match(m.state.html, /value="72" data-mixer-volume data-id="music"/);
});

test('s-089 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, audioMixer: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-089'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-089');
  m.click('mx-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the audioMixer event opens s-089 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'audioMixer' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-089');
});

// ----- s-091: tab sync panel ----------------------------------------------

test('s-091 lists other devices, their tabs, and send targets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-091'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-091');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab sync panel');
  assert.match(m.state.html, /3 devices/);
  assert.match(m.state.html, /MacBook Pro/);
  assert.match(m.state.html, /iPhone/);
  assert.match(m.state.html, /Pixel/);
  assert.equal((m.state.html.match(/data-onboard="sy-open"/g) || []).length, 5);
  assert.equal((m.state.html.match(/data-onboard="sy-send"/g) || []).length, 3);
  assert.match(m.state.html, /Send this tab to/);
  assert.match(m.state.html, /01 Other devices/);
  assert.match(m.state.html, /02 Open/);
  assert.match(m.state.html, /03 Send/);
});

test('Open pulls a tab from another device', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-091');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sy-open', device: 'macbook', tab: 'reading' } }
          : null,
    },
  });
  assert.match(m.state.html, /Opened Reading list from MacBook Pro\./);
  assert.match(m.state.html, /sy-tab is-opened/);
  assert.match(m.state.html, />Opened</);
});

test('Send pushes this tab to one device and marks it Sent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-091');
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sy-send', device: 'iphone' } }
          : null,
    },
  });
  assert.match(m.state.html, /Sent Arc paper to iPhone\./);
  assert.match(m.state.html, /sy-send-btn is-sent" data-onboard="sy-send" data-device="iphone" aria-pressed="true"/);
  assert.match(m.state.html, />Sent<small>iPhone</);
  m.click('sy-reset');
  assert.match(m.state.html, /Panel reset\./);
});

test('s-091 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, tabSync: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-091'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-091');
  m.click('sy-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the tabSync event opens s-091 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'tabSync' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-091');
});

// ----- s-093: mobile overflow ---------------------------------------------

test('s-093 renders the mobile overflow sheet with three actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-093'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-093');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Mobile overflow');
  assert.match(m.state.html, /role="dialog" aria-label="Tab overflow menu"/);
  assert.equal((m.state.html.match(/class="mo-row"/g) || []).length, 3);
  assert.match(m.state.html, /data-onboard="mo-new"/);
  assert.match(m.state.html, /data-onboard="mo-search"/);
  assert.match(m.state.html, /data-onboard="mo-close-all"/);
  assert.match(m.state.html, /01 Close all/);
  assert.match(m.state.html, /02 New tab/);
  assert.match(m.state.html, /03 Search/);
});

test('New tab adds one tab and updates the count', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-093');
  m.click('mo-new');
  assert.match(m.state.html, /New tab added\. 4 open\./);
  assert.equal((m.state.html.match(/class="mo-row"/g) || []).length, 4);
  assert.match(m.state.html, /New tab 1/);
  assert.match(m.state.html, />4</);
});

test('Search opens a field and filters the sheet', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-093');
  m.click('mo-search');
  assert.match(m.state.html, /data-overflow-search/);
  assert.match(m.state.html, /Search opened\./);
  m.overlay.oninput({
    target: { hasAttribute: (name) => name === 'data-overflow-search', value: 'read' },
  });
  assert.equal((m.state.html.match(/class="mo-row"/g) || []).length, 1);
  assert.match(m.state.html, /Reading list/);
  assert.doesNotMatch(m.state.html, /Arc paper/);
});

test('Close all asks once, then clears the sheet', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-093');
  m.click('mo-close-all');
  assert.match(m.state.html, /Close all\? Tap again to confirm\./);
  assert.match(m.state.html, /Confirm close all/);
  m.click('mo-close-all');
  assert.match(m.state.html, /All tabs closed\./);
  assert.equal((m.state.html.match(/class="mo-row"/g) || []).length, 0);
  assert.match(m.state.html, /No tabs open\. New tab starts again\./);
  m.click('mo-close-all');
  assert.match(m.state.html, /No tabs to close\./);
});

test('s-093 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, mobileOverflow: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-093'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-093');
  m.click('mo-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mobileOverflow event opens s-093 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'mobileOverflow' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-093');
});

// ----- s-094: tab swipe ----------------------------------------------------

test('s-094 renders a swipeable track with dots and controls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-094'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-094');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab swipe');
  assert.match(m.state.html, /data-swipe-stage/);
  assert.equal((m.state.html.match(/data-swipe-page="/g) || []).length, 3);
  assert.equal((m.state.html.match(/data-onboard="sw-dot"/g) || []).length, 3);
  assert.match(m.state.html, /1 \/ 3/);
  assert.match(m.state.html, /Swipe between tabs/);
  assert.match(m.state.html, /01 Swipe/);
  assert.match(m.state.html, /02 Settle/);
  assert.match(m.state.html, /03 Dots/);
  assert.match(m.state.html, /data-onboard="sw-prev" disabled/);
});

test('next, previous and dots move between tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-094');
  m.click('sw-next');
  assert.match(m.state.html, /Showing Reading list\./);
  assert.match(m.state.html, /2 \/ 3/);
  m.click('sw-next');
  assert.match(m.state.html, /3 \/ 3/);
  assert.match(m.state.html, /data-onboard="sw-next" disabled/);
  m.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'sw-dot', index: '0' } }
          : null,
    },
  });
  assert.match(m.state.html, /Showing Arc paper\./);
  assert.match(m.state.html, /1 \/ 3/);
});

test('a full drag swipes and a short drag settles back', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-094');
  const stage = { closest: (selector) => (selector === '[data-swipe-stage]' ? {} : null) };
  m.overlay.onpointerdown({ target: stage, clientX: 200 });
  assert.match(m.state.html, /tsw-viewport is-dragging/);
  m.overlay.onpointermove({ clientX: 120 });
  m.overlay.onpointerup({ clientX: 120 });
  assert.match(m.state.html, /Swiped to Reading list\./);
  assert.match(m.state.html, /2 \/ 3/);

  m.overlay.onpointerdown({ target: stage, clientX: 200 });
  m.overlay.onpointerup({ clientX: 180 });
  assert.match(m.state.html, /Swipe settled back on Reading list\./);
  assert.match(m.state.html, /2 \/ 3/);

  m.overlay.onpointerdown({ target: stage, clientX: 100 });
  m.overlay.onpointermove({ clientX: 180 });
  m.overlay.onpointerup({ clientX: 180 });
  assert.match(m.state.html, /Swiped to Arc paper\./);
  assert.match(m.state.html, /1 \/ 3/);
});

test('s-094 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, tabSwipe: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-094'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-094');
  m.click('sw-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the tabSwipe event opens s-094 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'tabSwipe' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-094');
});

// ----- s-095: empty tab state ---------------------------------------------

test('s-095 shows an honest empty strip and one New tab CTA', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-095'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-095');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Empty tab state');
  assert.match(m.state.html, /No tabs/);
  assert.match(m.state.html, /No tabs open/);
  assert.match(m.state.html, /Nothing was lost/);
  assert.match(m.state.html, /et-cta/);
  assert.match(m.state.html, /New tab <kbd>/);
  assert.match(m.state.html, /aria-label="Open a new tab"/);
  assert.match(m.state.html, /01 No tabs/);
  assert.match(m.state.html, /02 New tab/);
  assert.match(m.state.html, /03 Fresh start/);
});

test('New tab opens a tab and updates the strip and stage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-095');
  m.click('et-new');
  assert.match(m.state.html, /New tab opened\. 1 open\./);
  assert.match(m.state.html, /et-tab is-active">New tab 1</);
  assert.match(m.state.html, /Start typing an address/);
  assert.doesNotMatch(m.state.html, /et-cta/);
  m.click('et-new');
  assert.match(m.state.html, /New tab opened\. 2 open\./);
  assert.match(m.state.html, /1 tab open\.|2 open\./);
  m.click('et-reset');
  assert.match(m.state.html, /Back to the empty state\./);
  assert.match(m.state.html, /No tabs open/);
});

test('s-095 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, emptyTabState: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-095'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-095');
  m.click('et-new');
  m.click('et-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the emptyTabState event opens s-095 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'emptyTabState' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-095');
});

// ----- s-097: loaded page --------------------------------------------------

test('s-097 renders content, status and chrome together', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-097'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-097');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Loaded page');
  assert.match(m.state.html, /ld-window/);
  assert.match(m.state.html, /ld-tab is-active">Reading the wind/);
  assert.match(m.state.html, /vaayvu\.com\/atlas\/loaded-page/);
  assert.match(m.state.html, /Reading the wind over the ridge/);
  assert.match(m.state.html, /Mira Sol/);
  assert.match(m.state.html, /ld-status" role="status"/);
  assert.match(m.state.html, /Secure connection/);
  assert.match(m.state.html, /18\.4 KB/);
  assert.match(m.state.html, /01 Content/);
  assert.match(m.state.html, /02 Status/);
  assert.match(m.state.html, /03 Chrome/);
});

test('reloading updates the status and message', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-097');
  m.click('ld-reload');
  assert.match(m.state.html, /Page reloaded\. Content, status and chrome are in sync\./);
  assert.match(m.state.html, /<strong>Reloaded<\/strong>/);
  m.click('ld-reload');
  assert.match(m.state.html, /Page reloaded\./);
});

test('the status bar can be hidden and shown again', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-097');
  m.click('ld-status-toggle');
  assert.match(m.state.html, /Page loaded, status hidden\./);
  assert.doesNotMatch(m.state.html, /ld-status" role="status"/);
  m.click('ld-status-toggle');
  assert.match(m.state.html, /ld-status" role="status"/);
  assert.match(m.state.html, /Page loaded with status visible\./);
});

test('s-097 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, loadedPage: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-097'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-097');
  m.click('ld-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the loadedPage event opens s-097 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'loadedPage' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-097');
});

// ----- s-099: DNS error ----------------------------------------------------

test('s-099 explains the DNS failure with retry, search and offline', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-099'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-099');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'DNS error');
  assert.match(m.state.html, /example\.invalid/);
  assert.match(m.state.html, /This site can/);
  assert.match(m.state.html, /domain name could not be resolved/);
  assert.match(m.state.html, /DNS_PROBE_FINISHED_NXDOMAIN/);
  assert.match(m.state.html, /data-onboard="de-retry"/);
  assert.match(m.state.html, /data-onboard="de-search"/);
  assert.match(m.state.html, /data-onboard="de-offline"/);
  assert.match(m.state.html, /01 Explain/);
  assert.match(m.state.html, /02 Retry/);
  assert.match(m.state.html, /03 Search/);
  assert.match(m.state.html, /04 Offline/);
});

test('retry keeps failing honestly and search turns the address into a query', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-099');
  m.click('de-retry');
  assert.match(m.state.html, /Retry 1: example\.invalid still does not resolve\./);
  assert.match(m.state.html, /1 retry/);
  m.click('de-search');
  assert.match(m.state.html, /Searching for example\.invalid instead\./);
  assert.match(m.state.html, /Search for .*example\.invalid/);
});

test('offline is named separately and blocks retry', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-099');
  m.click('de-offline');
  assert.match(m.state.html, /You are offline/);
  assert.match(m.state.html, /Offline mode on\. Retry needs a connection\./);
  assert.match(m.state.html, /<strong>Offline<\/strong>/);
  assert.doesNotMatch(m.state.html, /DNS_PROBE_FINISHED_NXDOMAIN/);
  m.click('de-retry');
  assert.match(m.state.html, /Still offline\. Reconnect before retrying the lookup\./);
  m.click('de-offline');
  assert.match(m.state.html, /Back online\. DNS lookup still fails\./);
  assert.match(m.state.html, /This site can/);
});

test('s-099 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, dnsError: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-099'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-099');
  m.click('de-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the dnsError event opens s-099 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'dnsError' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-099');
});

// ----- s-100: offline error ----------------------------------------------

test('s-100 explains the offline state and offers the cached copy', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-100'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-100');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Offline error');
  assert.match(m.state.html, /of-offline-chip">Offline/);
  assert.match(m.state.html, /You\\u2019re offline|You’re offline/);
  assert.match(m.state.html, /cached copy from 2 hours ago/);
  assert.match(m.state.html, /data-onboard="oe-cache"/);
  assert.match(m.state.html, /data-onboard="oe-retry"/);
  assert.match(m.state.html, /data-onboard="oe-help"/);
  assert.match(m.state.html, /01 Cached copy/);
  assert.match(m.state.html, /02 Retry/);
  assert.match(m.state.html, /03 Network help/);
});

test('the cached copy is read-only and says what it is', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-100');
  m.click('oe-cache');
  assert.match(m.state.html, /Showing the cached copy from 2 hours ago\./);
  assert.match(m.state.html, /of-cached-badge">Cached copy · 2 hours ago/);
  assert.match(m.state.html, /Reading cached copy/);
  assert.match(m.state.html, /Hide cached copy/);
  m.click('oe-cache');
  assert.match(m.state.html, /Cached copy hidden\. The page still needs a connection\./);
});

test('retry stays offline and network help lists real checks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-100');
  m.click('oe-retry');
  assert.match(m.state.html, /Still offline\. Retry 1 could not reach the network\./);
  assert.match(m.state.html, /1 retry/);
  m.click('oe-help');
  assert.match(m.state.html, /Network help shown\./);
  assert.match(m.state.html, /Check Wi-Fi or mobile data/);
  assert.match(m.state.html, /Turn airplane mode off, then on/);
  assert.match(m.state.html, /Restart the router/);
});

test('s-100 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, offlineError: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-100'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-100');
  m.click('oe-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the offlineError event opens s-100 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'offlineError' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-100');
});

// ----- s-096: loading page ------------------------------------------------

test('s-096 renders progress, stop and a skeleton page', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-096'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-096');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Loading page');
  assert.match(m.state.html, /lp-spinner/);
  assert.match(m.state.html, /role="progressbar"/);
  assert.match(m.state.html, /aria-valuenow="35"/);
  assert.match(m.state.html, /lp-skeleton is-title/);
  assert.match(m.state.html, /lp-skeleton is-image/);
  assert.match(m.state.html, /data-onboard="lp-stop"/);
  assert.match(m.state.html, /01 Progress/);
  assert.match(m.state.html, /02 Stop/);
  assert.match(m.state.html, /03 Skeleton/);
});

test('advancing reaches loaded and disables further progress', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-096');
  m.click('lp-step');
  assert.match(m.state.html, /aria-valuenow="60"/);
  m.click('lp-step');
  m.click('lp-step');
  assert.match(m.state.html, /aria-valuenow="100"/);
  assert.match(m.state.html, /Page loaded\./);
  assert.match(m.state.html, /lp-spinner is-off/);
  assert.match(m.state.html, /data-onboard="lp-step" disabled/);
  m.click('lp-stop');
  assert.match(m.state.html, /Reloading from the start\./);
  assert.match(m.state.html, /aria-valuenow="0"/);
});

test('Stop freezes the page and marks it incomplete', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-096');
  m.click('lp-stop');
  assert.match(m.state.html, /Loading stopped at 35%\. The page is incomplete\./);
  assert.match(m.state.html, /lp-page is-stopped/);
  assert.match(m.state.html, /lp-stopped-note/);
  assert.match(m.state.html, /<strong>Stopped<\/strong>/);
  assert.match(m.state.html, /lp-progress-fill is-stopped/);
  m.click('lp-restart');
  assert.match(m.state.html, /Restarted\./);
  assert.match(m.state.html, /aria-valuenow="0"/);
});

test('s-096 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, loadingPage: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-096'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-096');
  m.click('lp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the loadingPage event opens s-096 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'loadingPage' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-096');
});

test('s-008 and s-009 method screens reach their preview states', () => {
  const create = openCreateAccount({ capabilities: ALL_SETUP });
  create.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'auth-method', method: 'sso' } }
          : null,
    },
  });
  assert.match(create.state.html, /Google/);
  create.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'auth-sso', provider: 'Google' } }
          : null,
    },
  });
  assert.match(create.state.html, /SSO ready/);
  assert.match(create.state.html, /Continue with Google preview/);

  const signin = openSignIn({ capabilities: ALL_SETUP });
  signin.overlay.onclick({
    target: {
      closest: (selector) =>
        selector === '[data-onboard]'
          ? { dataset: { onboard: 'auth-method', method: 'totp' } }
          : null,
    },
  });
  assert.match(signin.state.html, /data-auth-code/);
  signin.click('auth-verify-code');
  assert.match(signin.state.html, /Code preview accepted/);
});

// ----- s-101: timeout ------------------------------------------------------

test('s-101 explains the timeout with retry and details', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-101'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-101');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Timeout');
  assert.match(m.state.html, /This page took too long to respond/);
  assert.match(m.state.html, /ERR_TIMED_OUT/);
  assert.match(m.state.html, /data-onboard="to-retry"/);
  assert.match(m.state.html, /data-onboard="to-details-toggle"/);
  assert.match(m.state.html, /01 Retry/);
  assert.match(m.state.html, /02 Details/);
  assert.match(m.state.html, /03 Status/);
});

test('retry reports another timeout and details reveal diagnostics', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-101');
  m.click('to-retry');
  assert.match(m.state.html, /Retry 1: example\.com still did not respond within 30 seconds\./);
  assert.match(m.state.html, /1 retry/);
  m.click('to-details-toggle');
  assert.match(m.state.html, /Timeout details/);
  assert.match(m.state.html, /https:\/\/example\.com\/atlas\/timeout/);
  assert.match(m.state.html, /30 seconds/);
  assert.match(m.state.html, /No response/);
  m.click('to-details-toggle');
  assert.match(m.state.html, /Details hidden\./);
});

test('s-101 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, timeoutError: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-101'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-101');
  m.click('to-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the timeoutError event opens s-101 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'timeoutError' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-101');
});

// ----- s-103: renderer crash ----------------------------------------------

test('s-103 explains the renderer crash with reload, restore and report', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-103'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-103');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Renderer crash');
  assert.match(m.state.html, /This page stopped responding/);
  assert.match(m.state.html, /RENDERER_CRASHED/);
  assert.match(m.state.html, /data-onboard="cr-reload"/);
  assert.match(m.state.html, /data-onboard="cr-restore"/);
  assert.match(m.state.html, /data-onboard="cr-report"/);
  assert.match(m.state.html, /01 Reload/);
  assert.match(m.state.html, /02 Restore/);
  assert.match(m.state.html, /03 Report/);
});

test('restore shows a read-only snapshot and report queues once', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-103');
  m.click('cr-restore');
  assert.match(m.state.html, /Restored the snapshot from 12 seconds ago, read-only\./);
  assert.match(m.state.html, /Restored snapshot · 12 s ago/);
  assert.match(m.state.html, /Read-only until the page reloads\./);
  assert.match(m.state.html, /Hide snapshot/);
  m.click('cr-report');
  assert.match(m.state.html, /Crash report queued on this device\. No telemetry backend is configured\./);
  assert.match(m.state.html, /Reported/);
  assert.match(m.state.html, /data-onboard="cr-report" disabled/);
});

test('reload counts attempts without clearing the snapshot', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-103');
  m.click('cr-restore');
  m.click('cr-reload');
  assert.match(m.state.html, /Reload 1 requested\./);
  assert.match(m.state.html, /1 reload/);
  assert.match(m.state.html, /Restored snapshot/);
});

test('s-103 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, rendererCrash: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-103'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-103');
  m.click('cr-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the rendererCrash event opens s-103 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'rendererCrash' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-103');
});

// ----- s-105: policy blocked ----------------------------------------------

test('s-105 shows the administrator message and contact path', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-105'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-105');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Policy blocked');
  assert.match(m.state.html, /blocked by your organisation/);
  assert.match(m.state.html, /approved research sources/);
  assert.match(m.state.html, /BLOCKED_BY_ADMIN/);
  assert.match(m.state.html, /data-onboard="pb-contact"/);
  assert.match(m.state.html, /data-onboard="pb-details"/);
  assert.match(m.state.html, /01 Admin message/);
  assert.match(m.state.html, /02 Contact/);
  assert.match(m.state.html, /03 Details/);
});

test('Contact reveals the administrator email and extension', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-105');
  m.click('pb-contact');
  assert.match(m.state.html, /helpdesk@example\.com/);
  assert.match(m.state.html, /Extension 4400/);
  assert.match(m.state.html, /Administrator contact shown/);
  m.click('pb-copy');
  assert.match(m.state.html, /Administrator email copied\./);
});

test('Details names the policy, rule, administrator and device', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-105');
  m.click('pb-details');
  assert.match(m.state.html, /Research device policy/);
  assert.match(m.state.html, /Uncategorised sites/);
  assert.match(m.state.html, /IT helpdesk/);
  assert.match(m.state.html, /Managed profile/);
  assert.match(m.state.html, /Policy details shown\./);
});

test('s-105 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, policyBlocked: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-105'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-105');
  m.click('pb-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the policyBlocked event opens s-105 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'policyBlocked' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-105');
});

// ----- s-106: unsafe site ------------------------------------------------

test('s-106 shows a local malicious-domain warning with no bypass', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-106'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-106');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Unsafe site interstitial');
  assert.match(m.state.html, /This site may harm your device/);
  assert.match(m.state.html, /malware\.example/);
  assert.match(m.state.html, /Malware/);
  assert.match(m.state.html, /Phishing/);
  assert.match(m.state.html, /RASHA_MALWARE_MATCH/);
  assert.match(m.state.html, /data-onboard="us-back"/);
  assert.match(m.state.html, /data-onboard="us-source"/);
  assert.match(m.state.html, /data-onboard="us-report"/);
  assert.doesNotMatch(m.state.html, /us-proceed|Proceed anyway/);
  assert.match(m.state.html, /01 Trusted warning/);
  assert.match(m.state.html, /04 No bypass/);
});

test('source names the list, version and matched host', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-106');
  m.click('us-source');
  assert.match(m.state.html, /Rasha Shield local list/);
  assert.match(m.state.html, /2026\.11/);
  assert.match(m.state.html, /Checked on this device\. No network lookup was needed\./);
  assert.match(m.state.html, /Warning source shown\./);
});

test('reporting queues locally and keeps the block in place', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-106');
  m.click('us-report');
  assert.match(m.state.html, /This site is safe/);
  assert.match(m.state.html, /This warning is outdated/);
  m.click('us-report-safe');
  assert.match(m.state.html, /Report queued on this device\./);
  assert.match(m.state.html, /The block stays until the list is reviewed\./);
  assert.match(m.state.html, /No bypass/);
});

test('Back to safety reports that the site was not opened', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-106');
  m.click('us-back');
  assert.match(m.state.html, /Back to safety\. The site was not opened\./);
});

test('s-106 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, unsafeSite: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-106'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-106');
  m.click('us-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the unsafeSite event opens s-106 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'unsafeSite' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-106');
});

// ----- s-107: captive portal ----------------------------------------------

test('s-107 detects the portal and offers login and retry', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-107'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-107');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Captive portal');
  assert.match(m.state.html, /Sign in to this network/);
  assert.match(m.state.html, /Airport Wi-Fi/);
  assert.match(m.state.html, /data-onboard="cw-open"/);
  assert.match(m.state.html, /data-onboard="cw-retry"/);
  assert.match(m.state.html, /data-onboard="cw-detect"/);
  assert.match(m.state.html, /01 Detect/);
  assert.match(m.state.html, /02 Open login/);
  assert.match(m.state.html, /03 Retry/);
});

test('detection details and the login page open locally', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-107');
  m.click('cw-detect');
  assert.match(m.state.html, /connectivity\.example/);
  assert.match(m.state.html, /HTTP redirect/);
  assert.match(m.state.html, /local; no page content was loaded/);
  m.click('cw-open');
  assert.match(m.state.html, /Network login page/);
  assert.match(m.state.html, /data-cw-credential/);
  assert.match(m.state.html, /data-onboard="cw-signin"/);
  assert.match(m.state.html, /Opened the Airport Wi-Fi login page\./);
});

test('retry stays honest until sign-in, then reaches online', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-107');
  m.click('cw-retry');
  assert.match(m.state.html, /still behind the captive portal\. Finish sign-in first\./);
  assert.match(m.state.html, /1 retry/);
  m.click('cw-open');
  m.click('cw-signin');
  assert.match(m.state.html, /Signed in on Airport Wi-Fi\. Retry to check the connection\./);
  m.click('cw-retry');
  assert.match(m.state.html, /Retry 2: connected\. The internet is reachable\./);
  assert.match(m.state.html, /You are online/);
  assert.match(m.state.html, /<strong>Online<\/strong>/);
});

test('s-107 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, captivePortal: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-107'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-107');
  m.click('cw-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the captivePortal event opens s-107 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'captivePortal' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-107');
});

// ----- s-108: PDF viewer ---------------------------------------------------

test('s-108 renders pages, zoom, rotate, search, print, save and share', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-108'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-108');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'PDF viewer');
  assert.match(m.state.html, /ridge-report\.pdf/);
  assert.match(m.state.html, /1 \/ 12/);
  assert.match(m.state.html, /data-onboard="pv-prev"/);
  assert.match(m.state.html, /data-onboard="pv-next"/);
  assert.match(m.state.html, /data-onboard="pv-zoom-in"/);
  assert.match(m.state.html, /data-onboard="pv-rotate"/);
  assert.match(m.state.html, /data-onboard="pv-search"/);
  assert.match(m.state.html, /data-onboard="pv-print"/);
  assert.match(m.state.html, /data-onboard="pv-save"/);
  assert.match(m.state.html, /data-onboard="pv-share"/);
  assert.match(m.state.html, /01 Pages/);
  assert.match(m.state.html, /04 Print, save, share/);
});

test('pages move within bounds and zoom and rotation update the page', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-108');
  m.click('pv-next');
  assert.match(m.state.html, /2 \/ 12/);
  assert.match(m.state.html, /aria-label="PDF page 2 of 12"/);
  m.click('pv-prev');
  assert.match(m.state.html, /1 \/ 12/);
  assert.match(m.state.html, /data-onboard="pv-prev" aria-label="Previous page" disabled/);
  m.click('pv-zoom-in');
  assert.match(m.state.html, /125%/);
  assert.match(m.state.html, /scale\(1\.25\)/);
  m.click('pv-zoom-out');
  m.click('pv-zoom-out');
  assert.match(m.state.html, /75%/);
  m.click('pv-rotate');
  assert.match(m.state.html, /rotate\(90deg\)/);
  assert.match(m.state.html, /Rotated to 90°/);
});

test('search counts matches in the document', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-108');
  m.click('pv-search');
  assert.match(m.state.html, /data-pdf-search/);
  assert.match(m.state.html, /Search opened\./);
  m.overlay.oninput({
    target: { hasAttribute: (name) => name === 'data-pdf-search', value: 'wind' },
  });
  assert.match(m.state.html, /2 matches/);
});

test('print, save and share report their requests', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-108');
  m.click('pv-print');
  assert.match(m.state.html, /Print requested for ridge-report\.pdf\./);
  m.click('pv-save');
  assert.match(m.state.html, /Save requested for ridge-report\.pdf\./);
  m.click('pv-share');
  assert.match(m.state.html, /Share requested for ridge-report\.pdf\./);
});

test('s-108 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, pdfViewer: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-108'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-108');
  m.click('pv-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the pdfViewer event opens s-108 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'pdfViewer' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-108');
});

// ----- s-109: PDF annotate and sign ---------------------------------------

test('s-109 offers highlight, draw, text, signature and forms', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-109'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-109');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'PDF annotate/sign');
  for (const tool of ['highlight', 'draw', 'text', 'signature', 'forms']) {
    assert.match(m.state.html, new RegExp('data-tool="' + tool + '"'));
  }
  assert.match(m.state.html, /contract\.pdf/);
  assert.match(m.state.html, /01 Highlight/);
  assert.match(m.state.html, /05 Forms/);
});

test('highlight, draw, text, signature and forms each land on the page', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-109');
  const tool = (id) =>
    m.overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]'
            ? { dataset: { onboard: 'pd-tool', tool: id } }
            : null,
      },
    });
  tool('highlight');
  m.click('pd-highlight');
  assert.match(m.state.html, /is-highlighted/);
  assert.match(m.state.html, /1 highlight/);
  tool('draw');
  m.click('pd-draw');
  assert.match(m.state.html, /pd-draw/);
  tool('text');
  m.click('pd-text');
  assert.match(m.state.html, /pd-note/);
  assert.match(m.state.html, /Text note added\./);
  tool('signature');
  m.click('pd-sign');
  assert.match(m.state.html, /Mira Sol/);
  assert.match(m.state.html, /Signed on this device/);
  tool('forms');
  m.click('pd-forms');
  assert.match(m.state.html, /Form filled/);
  assert.match(m.state.html, /Form filled with the name and date\./);
});

test('reset clears every annotation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-109');
  m.click('pd-tool');
  m.click('pd-sign');
  m.click('pd-reset');
  assert.match(m.state.html, /Annotations reset\./);
  assert.doesNotMatch(m.state.html, /Signed on this device/);
  assert.match(m.state.html, /0 marks/);
});

test('s-109 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, pdfAnnotate: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-109'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-109');
  m.click('pd-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the pdfAnnotate event opens s-109 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'pdfAnnotate' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-109');
});

// ----- s-110: reader mode ------------------------------------------------

test('s-110 shows the article with theme, font, width and TTS', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-110'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-110');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Reader mode');
  assert.match(m.state.html, /Reading the wind over the ridge/);
  assert.match(m.state.html, /data-onboard="rd-theme"/);
  assert.match(m.state.html, /data-onboard="rd-font"/);
  assert.match(m.state.html, /data-onboard="rd-width"/);
  assert.match(m.state.html, /data-onboard="rd-tts"/);
  assert.match(m.state.html, /01 Article/);
  assert.match(m.state.html, /03 Font and width/);
  assert.match(m.state.html, /04 TTS/);
});

test('theme, font and width repaint the reader surface', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-110');
  const choose = (action, value) =>
    m.overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]'
            ? { dataset: { onboard: action, value } }
            : null,
      },
    });
  choose('rd-theme', 'dark');
  assert.match(m.state.html, /rd-surface is-light is-serif is-medium|rd-surface is-dark/);
  assert.match(m.state.html, /is-dark is-serif is-medium/);
  assert.match(m.state.html, /Reader theme: dark\./);
  choose('rd-font', 'sans');
  assert.match(m.state.html, /is-dark is-sans is-medium/);
  choose('rd-width', 'wide');
  assert.match(m.state.html, /is-dark is-sans is-wide/);
  assert.match(m.state.html, /Reader width: wide\./);
});

test('TTS is honest when speech synthesis is unavailable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-110');
  m.click('rd-tts');
  assert.match(m.state.html, /Speech synthesis is not available on this device\./);
  assert.match(m.state.html, /TTS off/);
});

test('s-110 keeps the source origin visible and preserves failure states', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-110');
  assert.match(m.state.html, /rd-origin[^>]*>vaayvu\.com\/atlas\/reading-the-wind/);
  m.click('rd-fail');
  assert.match(m.state.html, /Reader could not extract this article/);
  assert.match(m.state.html, /original page is still open and unchanged/);
  m.click('rd-protected');
  assert.match(m.state.html, /This page is paid or protected/);
  assert.match(m.state.html, /will not bypass a paywall/);
  m.click('rd-original');
  assert.match(m.state.html, /Original page open at vaayvu\.com/);
  assert.match(m.state.html, /rd-article/);
});

test('s-110 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, readerMode: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-110'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-110');
  m.click('rd-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the readerMode event opens s-110 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'readerMode' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-110');
});

// ----- s-111: reader settings --------------------------------------------

test('s-111 renders theme, size, line height, font and margins', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-111'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-111');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Reader settings');
  for (const action of ['rs-theme', 'rs-size', 'rs-line', 'rs-font', 'rs-margins']) {
    assert.match(m.state.html, new RegExp('data-onboard="' + action + '"'));
  }
  assert.match(m.state.html, /01 Theme/);
  assert.match(m.state.html, /05 Margins/);
  assert.match(m.state.html, /Live preview/);
});

test('every reader setting repaints the live preview', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-111');
  const choose = (action, value) =>
    m.overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]'
            ? { dataset: { onboard: action, value } }
            : null,
      },
    });
  choose('rs-theme', 'sepia');
  assert.match(m.state.html, /rs-preview is-sepia is-serif is-medium/);
  assert.match(m.state.html, /Theme set to sepia\./);
  choose('rs-size', '20');
  assert.match(m.state.html, /--rs-size:20px/);
  assert.match(m.state.html, /Text size set to 20px\./);
  choose('rs-line', '1.8');
  assert.match(m.state.html, /--rs-line:1\.8/);
  choose('rs-font', 'sans');
  assert.match(m.state.html, /is-sepia is-sans is-medium/);
  choose('rs-margins', 'wide');
  assert.match(m.state.html, /is-sepia is-sans is-wide/);
  assert.match(m.state.html, /Margins set to wide\./);
});

test('Apply confirms and Reset restores the defaults', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-111');
  m.click('rs-apply');
  assert.match(m.state.html, /Applied\. Reader uses these settings on every article\./);
  m.click('rs-reset');
  assert.match(m.state.html, /Reader settings reset\./);
  assert.match(m.state.html, /--rs-size:16px;--rs-line:1\.6/);
});

test('s-111 respects its platform gate and Continue returns to the chain', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, readerSettings: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-111'), false);

  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-111');
  m.click('rs-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the readerSettings event opens s-111 only when asked', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.vaayvuEvent({ type: 'readerSettings' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-111');
});

// ----- s-112 – s-128: content and sidebar batch ---------------------------

test('s-112 translate prompt detects, translates and remembers never', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-112'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-112');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Translate prompt');
  assert.match(m.state.html, /English/);
  assert.match(m.state.html, /Translate this page\?/);
  m.click('tr-settings');
  m.overlay.onclick({
    target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: 'tr-target', lang: 'Tamil' } } : null) },
  });
  assert.match(m.state.html, /Target language: Tamil\./);
  m.click('tr-translate');
  assert.match(m.state.html, /Translating to Tamil\./);
  m.click('tr-never');
  assert.match(m.state.html, /Never translate English\./);
});

test('s-113 toggles original, translation and feedback', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-113');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-113');
  assert.match(m.state.html, /Translated from English/);
  m.click('tpg-toggle');
  assert.match(m.state.html, /Showing the original English page\./);
  assert.match(m.state.html, /The ridge does not block the wind/);
  m.click('tpg-bad');
  assert.match(m.state.html, /Feedback saved on this device\./);
});

test('s-114 find results count, move and highlight', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-114');
  assert.match(m.state.html, /1 of 3/);
  m.click('fr-next');
  assert.match(m.state.html, /2 of 3/);
  m.click('fr-prev');
  assert.match(m.state.html, /1 of 3/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-find-results', value: 'ridge' } });
  assert.match(m.state.html, /ridge/);
  assert.match(m.state.html, /<mark>ridge<\/mark>/);
});

test('s-115 view source searches and saves', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-115');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-115');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-view-source', value: 'title' } });
  assert.match(m.state.html, /1 match/);
  assert.match(m.state.html, /is-hit/);
  m.click('vs-save');
  assert.match(m.state.html, /Save requested for page source\./);
});

test('s-116 fullscreen video controls, PiP and exit', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-116');
  m.click('fv-play');
  assert.match(m.state.html, /Paused in fullscreen\./);
  m.click('fv-forward');
  assert.match(m.state.html, /Seeked forward 10 seconds\./);
  m.click('fv-pip');
  assert.match(m.state.html, /Popped out to PiP\./);
  m.click('fv-exit');
  assert.match(m.state.html, /Exited fullscreen\. The video continues in its tab\./);
});

test('s-117 PiP stays on top and returns to the tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-117');
  assert.match(m.state.html, /Always on top/);
  m.click('pip-top');
  assert.match(m.state.html, /PiP unpinned\./);
  m.click('pip-play');
  assert.match(m.state.html, /Paused in the PiP window\./);
  m.click('pip-back');
  assert.match(m.state.html, /Returned to the tab at the same position\./);
});

test('s-118 mini player expands, closes and reopens', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-118');
  m.click('mp-expand');
  assert.match(m.state.html, /Expanded to video\./);
  assert.match(m.state.html, /Video preview/);
  m.click('mp-close');
  assert.match(m.state.html, /Player closed\. Audio stopped\./);
  m.click('mp-open');
  assert.match(m.state.html, /Player reopened\./);
});

test('s-119 print preview changes paper, pages, headers, scale and saves', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-119');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pp-paper', value: 'Letter' } } : null) } });
  assert.match(m.state.html, /Paper: Letter\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pp-pages', value: 'current' } } : null) } });
  m.click('pp-headers');
  assert.match(m.state.html, /Headers off\./);
  m.click('pp-scale');
  assert.match(m.state.html, /Scale: 90%\./);
  m.click('pp-save');
  assert.match(m.state.html, /Save as PDF requested \(Letter, 90%\)\./);
});

test('s-120 save page picks format, name and location', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-120');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sp-format', value: 'pdf' } } : null) } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-save-name', value: 'ridge-notes' } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sp-location', value: 'desktop' } } : null) } });
  m.click('sp-save');
  assert.match(m.state.html, /Save requested: ridge-notes\.pdf in desktop\./);
});

test('s-121 screenshot capture switches mode and captures', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-121');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sc-mode', value: 'full' } } : null) } });
  assert.match(m.state.html, /Capture mode: full\./);
  m.click('sc-capture');
  assert.match(m.state.html, /Captured the full page\./);
});

test('s-122 screenshot annotate applies crop, draw, blur and actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-122');
  const tool = (t) => m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sa-tool', tool: t } } : null) } });
  tool('crop'); m.click('sa-apply');
  assert.match(m.state.html, /sa-crop/);
  tool('draw'); m.click('sa-apply');
  assert.match(m.state.html, /sa-draw/);
  tool('blur'); m.click('sa-apply');
  assert.match(m.state.html, /sa-blur/);
  m.click('sa-copy');
  assert.match(m.state.html, /Screenshot copied to the clipboard\./);
  m.click('sa-save');
  assert.match(m.state.html, /Save requested for the annotated screenshot\./);
});

test('s-123 share sheet shares to apps and copies', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-123');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sh-app', app: 'Mail' } } : null) } });
  assert.match(m.state.html, /Shared to Mail\./);
  m.click('sh-copy');
  assert.match(m.state.html, /Link copied\./);
});

test('s-124 QR copies and changes expiry', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-124');
  m.click('qr-copy');
  assert.match(m.state.html, /Link copied\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'qr-expiry', value: '1h' } } : null) } });
  assert.match(m.state.html, /Link expires in 1h\./);
  m.click('qr-refresh');
  assert.match(m.state.html, /QR refreshed\./);
});

test('s-125 send to device covers progress, failure and retry', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-125');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sd-device', device: 'iphone' } } : null) } });
  m.click('sd-send');
  assert.match(m.state.html, /Sent to iphone\./);
  m.click('sd-fail');
  assert.match(m.state.html, /Send failed to iphone\./);
  m.click('sd-retry');
  assert.match(m.state.html, /Retry succeeded\. Sent to iphone\./);
});

test('s-126 sidebar resizes, switches panels and collapses', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-126'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sidebar/s-126');
  assert.equal(m.dataset.atlasCategory, 'sidebar');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-side-width', value: '300' } });
  assert.match(m.state.html, /Sidebar 300px\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sb-panel', value: 'panels' } } : null) } });
  assert.match(m.state.html, /Panel: panels\./);
  m.click('sb-collapse');
  assert.match(m.state.html, /Sidebar collapsed\./);
});

test('s-127 bookmarks search filters and add inserts a row', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-127'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sidebar/s-127');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-bookmark-search', value: 'docs' } });
  assert.match(m.state.html, /Docs/);
  assert.doesNotMatch(m.state.html, /Arc paper/);
  m.click('bk-add');
  assert.match(m.state.html, /Bookmark added at the top\./);
  assert.match(m.state.html, /Added bookmark/);
});

test('s-128 history groups by day or device and searches', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-128'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sidebar/s-128');
  assert.match(m.state.html, /Today/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'hs-group', value: 'device' } } : null) } });
  assert.match(m.state.html, /This device/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-history-search', value: 'weather' } });
  assert.match(m.state.html, /Weather/);
  assert.doesNotMatch(m.state.html, /Reading the wind/);
});

// ----- s-129 – s-160: sidebar and manager batch ---------------------------

test('s-129 – s-160 routes, categories, phases and conditional priority', () => {
  for (let n = 129; n <= 160; n += 1) {
    const id = 's-' + n;
    const m = mount({ capabilities: { ...ALL_SETUP } });
    assert.equal(m.context.window.__vaayvuOnboardingOpen(id), true, id + ' opens');
    const cat = n <= 140 ? 'sidebar' : 'manager';
    const base = n <= 140 ? 'vaayvu://sidebar/' : 'vaayvu://managers/';
    assert.equal(m.dataset.onboardingRoute, base + id);
    assert.equal(m.dataset.onboardingPhase, 'p09');
    assert.equal(m.dataset.atlasCategory, cat);
    assert.equal(m.dataset.atlasPriority, 'conditional');
    assert.notEqual(m.state.attrs['aria-label'], 'Welcome', id + ' has a title');
    assert.match(m.state.html, /onboarding-sx/, id + ' renders');
  }
});

test('s-129 – s-136 panels act on their content', () => {
  let m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-129');
  m.click('rli-offline');
  assert.match(m.state.html, /Offline items only\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-130');
  m.click('dn-remove');
  assert.match(m.state.html, /Download removed\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-131');
  m.click('nt-link');
  assert.match(m.state.html, /Note linked to this page\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-132');
  m.click('hlt-add');
  assert.match(m.state.html, /Highlight added\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-133');
  m.click('ai2-send');
  assert.match(m.state.html, /Reply added to the thread\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-134');
  m.overlay.onclick({ target: { closest: (sel) => (sel === '[data-onboard]' ? { dataset: { onboard: 'ex2-pin', id: 'dark' } } : null) } });
  assert.match(m.state.html, /Night theme pinned\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-135');
  m.click('sp2-add');
  assert.match(m.state.html, /Space added\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-136');
  m.click('tt-close');
  assert.match(m.state.html, /Group closed with its tabs\./);
});

test('s-149 generates values that follow the selected settings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-149');
  m.click('pg-symbols');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pg-length', value: '32' } } : null) } });
  let value = m.state.html.match(/sx-secret"><strong>([^<]+)</)[1];
  assert.match(value, /^[A-Za-z0-9]{32}$/);
  m.click('pg-passphrase');
  value = m.state.html.match(/sx-secret"><strong>([^<]+)</)[1];
  assert.match(value, /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/);
});

test('s-137 – s-144 panels and managers act', () => {
  let m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-137');
  m.click('sy2-now');
  assert.match(m.state.html, /Synced just now\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-138');
  m.click('si-cookies');
  assert.match(m.state.html, /Site cookies cleared\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-139');
  m.click('pf-why');
  assert.match(m.state.html, /Why slow shown\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-140');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-sidebar-width', value: '300' } });
  assert.match(m.state.html, /Sidebar width 300px\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-141');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bm-select', id: 'arc' } } : null) } });
  assert.match(m.state.html, /1 selected\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-142');
  m.click('be-save');
  assert.match(m.state.html, /Bookmark saved\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-143');
  m.click('hm-delete');
  assert.match(m.state.html, /Visit deleted\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-144');
  m.click('hd-delete');
  assert.match(m.state.html, /Visit deleted from History\./);
});

test('s-145 – s-152 managers act', () => {
  let m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-145');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dm-filter', value: 'completed' } } : null) } });
  assert.match(m.state.html, /Filter: completed\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-146');
  m.click('dd-scan');
  assert.match(m.state.html, /Scanned · no threats\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-147');
  m.click('pw-health');
  assert.match(m.state.html, /1 weak password found\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-148');
  m.click('pwd-reveal');
  assert.match(m.state.html, /Password revealed\./);
  m.click('pwd-breach');
  assert.match(m.state.html, /Found in 2 breaches/);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-149');
  m.click('pg-generate');
  assert.match(m.state.html, /Generated\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-150');
  m.click('pk-export');
  assert.match(m.state.html, /Passkey export requested\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-151');
  m.click('ad-preview');
  assert.match(m.state.html, /Autofill preview shown\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-152');
  m.click('pm-add');
  assert.match(m.state.html, /Card added\./);
});

test('s-153 – s-160 managers act', () => {
  let m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-153');
  m.click('id-save');
  assert.match(m.state.html, /Identity saved/);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-154');
  m.click('xm-dev');
  assert.match(m.state.html, /Developer mode on\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-155');
  m.click('xd-clear');
  assert.match(m.state.html, /Errors cleared\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-156');
  m.click('ei-allow');
  assert.match(m.state.html, /Extension added\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-157');
  m.click('ss-reset');
  assert.match(m.state.html, /All site permissions reset to Ask\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-158');
  m.click('sd-cookies');
  assert.match(m.state.html, /Cookies cleared\./);
  m.click('sd-storage');
  assert.match(m.state.html, /Storage cleared\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-159');
  m.click('cs-all');
  assert.match(m.state.html, /All cookies and storage cleared\./);
  m = mount({ capabilities: { ...ALL_SETUP } });
  m.context.window.__vaayvuOnboardingOpen('s-160');
  m.click('ct-import');
  assert.match(m.state.html, /Client certificate imported\./);
});

test('s-161 clear browsing data estimates, guards and confirms', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-161'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://managers/s-161');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'manager');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Clear browsing data');
  assert.match(m.state.html, /Estimated size/);
  assert.match(m.state.html, /146 MB/);
  m.click('cbd-type');
  assert.match(m.state.html, /Confirm clearing|Selection updated/);
  m.click('cbd-clear');
  assert.match(m.state.html, /Confirm clearing the selected data\./);
  assert.match(m.state.html, /This cannot be undone\./);
  m.click('cbd-confirm');
  assert.match(m.state.html, /Browsing data cleared\./);
  assert.match(m.state.html, /0 MB/);
});

test('s-162 import and export covers sources, formats and warnings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-162'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://managers/s-162');
  assert.equal(m.dataset.atlasCategory, 'manager');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Import/export');
  for (const src of ['Chrome', 'Arc', 'Bitwarden']) assert.match(m.state.html, new RegExp(src));
  assert.match(m.state.html, /Import merges with existing data/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ie-tab', value: 'export' } } : null) } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ie-format', value: 'csv' } } : null) } });
  assert.match(m.state.html, /passwords in readable text/);
  m.click('ie-run');
  assert.match(m.state.html, /Acknowledge the unencrypted export/);
  m.click('ie-ack');
  m.click('ie-run');
  assert.match(m.state.html, /Export requested as csv\./);
});

test('s-163 profile manager switches, styles and deletes profiles', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-163'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://managers/s-163');
  assert.equal(m.dataset.atlasCategory, 'manager');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Profile manager');
  assert.match(m.state.html, /Mira/);
  assert.match(m.state.html, /Work/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pm2-select', id: 'work' } } : null) } });
  assert.match(m.state.html, /Switched to work\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pm2-avatar', value: 'W' } } : null) } });
  assert.match(m.state.html, /Avatar updated\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pm2-color', value: '#00b894' } } : null) } });
  assert.match(m.state.html, /Colour updated\./);
  m.click('pm2-add');
  assert.match(m.state.html, /Profile added\./);
  m.click('pm2-delete');
  assert.match(m.state.html, /Profile deleted\./);
});

test('s-164 space manager edits name, icon, colour, jar and sync', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-164'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://managers/s-164');
  assert.equal(m.dataset.atlasCategory, 'manager');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Space manager');
  assert.match(m.state.html, /data-sm-name/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-sm-name', value: 'Fieldwork' } });
  assert.match(m.state.html, /value="Fieldwork"/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sm-icon', value: 'F' } } : null) } });
  assert.match(m.state.html, /Icon updated\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sm-color', value: '#00b894' } } : null) } });
  assert.match(m.state.html, /Colour updated\./);
  m.click('sm-jar');
  assert.match(m.state.html, /Cookie jar (on|off)\./);
  m.click('sm-sync');
  assert.match(m.state.html, /Sync (on|off)\./);
  m.click('sm-save');
  assert.match(m.state.html, /Space saved on this device\./);
});

test('s-165 search engines sets defaults, adds and removes engines', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-165'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://managers/s-165');
  assert.equal(m.dataset.atlasCategory, 'manager');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Search engines manager');
  assert.match(m.state.html, /DuckDuckGo/);
  assert.match(m.state.html, /Brave Search/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'se-default', id: 'google' } } : null) } });
  assert.match(m.state.html, /google is the default engine\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'se-private', id: 'bing' } } : null) } });
  assert.match(m.state.html, /bing is the private default\./);
  m.click('se-add');
  assert.match(m.state.html, /Custom engine added\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'se-remove', id: 'brave' } } : null) } });
  assert.match(m.state.html, /Engine removed\./);
});

test('s-166 site protection pauses categories while malware stays active', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-166'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-166');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Site protection panel');
  assert.match(m.state.html, /https:\/\/vaayvu\.com/);
  assert.match(m.state.html, /Malware and scam protection/);
  assert.match(m.state.html, /Custom blocked domains/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sp-cat', key: 'ads' } } : null) } });
  assert.match(m.state.html, /1 categories paused/);
  assert.match(m.state.html, /Category paused for this host\./);
  assert.match(m.state.html, /Malware and scam protection/);
  m.click('sp-resume');
  assert.match(m.state.html, /All categories resumed for this host\./);
  m.click('sp-adblock');
  assert.match(m.state.html, /S-191/);
  m.click('sp-diag');
  assert.match(m.state.html, /S-351/);
});

test('s-166 respects its capability gate', () => {
  const hidden = mount({ capabilities: { ...ALL_SETUP, siteProtectionPanel: false } });
  assert.equal(hidden.context.window.__vaayvuOnboardingOpen('s-166'), false);
});

test('s-167 privacy dashboard switches range and explains metrics', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-167'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-167');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Privacy dashboard');
  assert.match(m.state.html, /This week/);
  assert.match(m.state.html, /128/);
  assert.match(m.state.html, /pd-chart/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'prd-range', value: '30d' } } : null) } });
  assert.match(m.state.html, /512/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'prd-detail', key: 'fingerprint' } } : null) } });
  assert.match(m.state.html, /No raw fingerprint was stored/);
});

test('s-168 tracker detail allows and re-blocks one tracker', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-168'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-168');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Tracker detail');
  assert.match(m.state.html, /MetricWorks Analytics/);
  assert.match(m.state.html, /Analytics/);
  assert.match(m.state.html, /Blocked/);
  m.click('td-allow');
  assert.match(m.state.html, /MetricWorks allowed on this site\./);
  assert.match(m.state.html, /Allowed/);
  m.click('td-allow');
  assert.match(m.state.html, /MetricWorks blocked again\./);
  m.click('td-copy');
  assert.match(m.state.html, /Tracker domain copied\./);
});

test('s-169 cookie banner details never accepts or rejects', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-169'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-169');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Cookie banner handling details');
  assert.match(m.state.html, /Never auto-accepts/);
  assert.match(m.state.html, /Never rejects optional cookies/);
  assert.match(m.state.html, /Never implies consent/);
  m.click('cbh-toggle');
  assert.match(m.state.html, /Cookie banners stay visible\./);
  m.click('cbh-toggle');
  assert.match(m.state.html, /Supported banners are hidden; consent is untouched\./);
});

test('s-170 fingerprint settings switches modes and per-vector toggles', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-170'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-170');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Fingerprint settings');
  assert.match(m.state.html, /Canvas/);
  assert.match(m.state.html, /WebGL/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fp-mode', value: 'strict' } } : null) } });
  assert.match(m.state.html, /Strict fingerprint protection\./);
  assert.match(m.state.html, /Every supported vector is normalised/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fp-mode', value: 'standard' } } : null) } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fp-vector', key: 'screen' } } : null) } });
  assert.match(m.state.html, /screen normalised\./);
});

test('s-172 remains an excluded legacy record with no VPN implementation', () => {
  assert.doesNotMatch(source, /s-172/);
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-172'), false);
  assert.doesNotMatch(m.state.html, /VPN|tunnel/i);
});

test('s-171 DNS proxy selects provider, proxy, PAC and validates custom DoH', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-171'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-171');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'DNS/proxy');
  assert.match(m.state.html, /Cloudflare/);
  assert.match(m.state.html, /Quad9/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dns-provider', value: 'custom' } } : null) } });
  assert.match(m.state.html, /data-dns-doh/);
  m.click('dns-save');
  assert.match(m.state.html, /Enter a DoH URL for the custom provider\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-dns-doh', value: 'https://dns.example/dns-query' } });
  m.click('dns-save');
  assert.match(m.state.html, /DNS settings saved on this device\./);
  m.click('dns-proxy');
  assert.match(m.state.html, /Proxy on\./);
  assert.match(m.state.html, /data-dns-pac/);
  m.click('dns-auth');
  assert.match(m.state.html, /Proxy authentication on\./);
});

test('s-173 firewall toggles rules and shows logs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-173'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-173');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Firewall');
  assert.match(m.state.html, /Vaayvu/);
  assert.match(m.state.html, /metrics\.example/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fw-toggle', id: 'metrics' } } : null) } });
  assert.match(m.state.html, /metrics\.example allowed\./);
  m.click('fw-logs');
  assert.match(m.state.html, /Blocked · just now/);
  assert.match(m.state.html, /Allowed · 2 min ago/);
});

test('s-174 breach monitor requires opt-in, checks and acts', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-174'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-174');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Breach monitor');
  assert.match(m.state.html, /Opt-in required/);
  m.click('bm2-optin');
  assert.match(m.state.html, /data-breach-email/);
  m.click('bm2-check');
  assert.match(m.state.html, /Enter an email to check\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-breach-email', value: 'mira@example.com' } });
  m.click('bm2-check');
  assert.match(m.state.html, /2 breaches found\./);
  assert.match(m.state.html, /Example Mail/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bm2-action', id: 'mail' } } : null) } });
  assert.match(m.state.html, /Action opened for mail\./);
});

test('s-175 malware protection updates list and manages exceptions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-175'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-175');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Malware and scam protection');
  assert.match(m.state.html, /Known-domain protection/);
  assert.match(m.state.html, /Independent of ad and nuisance pauses/);
  m.click('mw-update');
  assert.match(m.state.html, /Malware list updated\./);
  assert.match(m.state.html, /Just now/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mw-domain', value: 'safe.example' } });
  m.click('mw-add');
  assert.match(m.state.html, /safe\.example allowed\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mw-remove', id: 'safe.example' } } : null) } });
  assert.match(m.state.html, /Exception removed\./);
});

test('s-176 permission audit filters and revokes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-176'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-176');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Permission audit');
  assert.match(m.state.html, /camera/);
  assert.match(m.state.html, /Today · 09:42/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pau-filter', value: 'camera' } } : null) } });
  assert.match(m.state.html, /Filter: camera\./);
  assert.doesNotMatch(m.state.html, /maps\.example/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pau-revoke', id: 'e1' } } : null) } });
  assert.match(m.state.html, /vaayvu\.com camera revoked\./);
  assert.match(m.state.html, /Revoked/);
});

test('s-177 private window explains and closes the session safely', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-177'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-177');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Private window');
  assert.match(m.state.html, /Not recorded/);
  assert.match(m.state.html, /No history or bookmarks/);
  assert.match(m.state.html, /Cleared when the window closes/);
  m.click('pvw-close');
  assert.match(m.state.html, /Confirm closing all private tabs\./);
  m.click('pvw-confirm');
  assert.match(m.state.html, /Private session closed\. History and cookies cleared\./);
  assert.match(m.state.html, /Session cleared/);
});

test('s-178 guest window isolates data and closes on confirmation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-178'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-178');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Guest window');
  assert.match(m.state.html, /No profile, no carried identity/);
  assert.match(m.state.html, /Extensions/);
  assert.match(m.state.html, /Bookmarks and passwords/);
  m.click('gw-close');
  assert.match(m.state.html, /Confirm closing the guest window\./);
  m.click('gw-confirm');
  assert.match(m.state.html, /Guest window closed\. Session discarded\./);
  assert.match(m.state.html, /Guest session ended/);
});

test('s-179 kids mode manages allowlist, limits, PIN and reports', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-179'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-179');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Kids mode');
  assert.match(m.state.html, /school\.example/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'km-time', value: '30' } } : null) } });
  assert.match(m.state.html, /Daily limit: 30 minutes\./);
  m.click('km-pin');
  assert.match(m.state.html, /PIN lock on\./);
  m.click('km-report');
  assert.match(m.state.html, /Weekly report off\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-km-site', value: 'library.example' } });
  m.click('km-add');
  assert.match(m.state.html, /library\.example allowed\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'km-remove', id: 'school.example' } } : null) } });
  assert.match(m.state.html, /Site removed from the allowlist\./);
});

test('s-180 panic clear selects data, arms and confirms', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-180'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-180');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Panic clear');
  assert.match(m.state.html, /Emergency clear/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pc-type', key: 'pcCookies' } } : null) } });
  assert.match(m.state.html, /Selection updated\./);
  m.click('pc-clear');
  assert.match(m.state.html, /Confirm the emergency clear\./);
  assert.match(m.state.html, /This cannot be undone\./);
  m.click('pc-confirm');
  assert.match(m.state.html, /Session, cookies and history cleared\./);
  assert.match(m.state.html, /Cleared/);
});

test('s-181 permission prompt offers once, remember, block and learn', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-181'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-181');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Permission prompt');
  assert.match(m.state.html, /Allow once/);
  assert.match(m.state.html, /Allow and remember/);
  m.click('prm-learn');
  assert.match(m.state.html, /The camera is used only while meet\.example is open/);
  m.click('prm-once');
  assert.match(m.state.html, /Camera allowed once\./);
  m.click('prm-always');
  assert.match(m.state.html, /Camera allowed and remembered\./);
  assert.match(m.state.html, /remembered for meet\.example/);
});

test('s-182 permission blocked explains unblocking and settings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-182'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-182');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Permission blocked');
  assert.match(m.state.html, /Camera is blocked for meet\.example/);
  assert.match(m.state.html, /Site info → Permissions → Allow/);
  m.click('pbl-settings');
  assert.match(m.state.html, /Site settings requested \(S-158\)\./);
  m.click('pbl-retry');
  assert.match(m.state.html, /Retry requested; the site may ask again\./);
});

test('s-183 site data prompt allows, clears and manages storage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-183'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-183');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Site data prompt');
  assert.match(m.state.html, /128 KB/);
  assert.match(m.state.html, /1\.8 MB/);
  m.click('sdp-allow');
  assert.match(m.state.html, /Storage allowed for vaayvu\.com\./);
  m.click('sdp-clear');
  assert.match(m.state.html, /Site data cleared\./);
  m.click('sdp-manage');
  assert.match(m.state.html, /Site data manager requested \(S-159\)\./);
});

test('s-184 HTTPS upgrade explains, proceeds explicitly and backs out', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-184'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-184');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'HTTPS upgrade interstitial');
  assert.match(m.state.html, /Secure version unavailable/);
  m.click('hu-why');
  assert.match(m.state.html, /HTTP sends the address and page content in clear text/);
  m.click('hu-proceed');
  assert.match(m.state.html, /Proceeding over HTTP\. This page is not protected\./);
  assert.match(m.state.html, /Do not enter passwords/);
  m.click('hu-back');
  assert.match(m.state.html, /Back to safety\. The HTTP page was not opened\./);
});

test('s-185 insecure form blocks password submission and explains', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-185'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security-privacy/s-185');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Insecure form warning');
  assert.match(m.state.html, /Password field on an insecure page/);
  assert.match(m.state.html, /Submission is blocked/);
  m.click('if-why');
  assert.match(m.state.html, /could be read or changed in transit/);
  m.click('if-back');
  assert.match(m.state.html, /Left the insecure page\. Nothing was submitted\./);
});

test('s-186 settings root searches sections and reports sync status', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-186'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-186');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Settings root');
  assert.match(m.state.html, /Appearance/);
  assert.match(m.state.html, /Privacy/);
  assert.match(m.state.html, /Not signed in/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-settings-search', value: 'privacy' } });
  assert.match(m.state.html, /Settings' \/|Privacy/);
  assert.doesNotMatch(m.state.html, /Appearance/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'set-open', target: 's-190' } } : null) } });
  assert.match(m.state.html, /Open s-190\./);
});

test('s-187 appearance changes theme, accent, tabs and motion', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-187'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-187');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Appearance');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ap-theme', value: 'dark' } } : null) } });
  assert.match(m.state.html, /Theme: dark\./);
  assert.match(m.state.html, /is-dark/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ap-tabs', value: 'left' } } : null) } });
  assert.match(m.state.html, /Tabs: left\./);
  m.click('ap-bookmarks');
  assert.match(m.state.html, /Bookmarks bar hidden\./);
  m.click('ap-motion');
  assert.match(m.state.html, /Reduced motion\./);
});

test('s-188 tabs and spaces changes position, close, sleep and toggles', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-188'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-188');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Tabs & spaces');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ts-pos', value: 'left' } } : null) } });
  assert.match(m.state.html, /Position: left\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ts-close', value: 'opener' } } : null) } });
  assert.match(m.state.html, /Close behaviour: opener\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ts-sleep', value: '15' } } : null) } });
  assert.match(m.state.html, /Sleep after 15 minutes\./);
  m.click('ts-groups');
  assert.match(m.state.html, /Tab groups off\./);
  m.click('ts-split');
  assert.match(m.state.html, /Split view off\./);
});

test('s-189 search and omnibox changes engine and suggestion sources', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-189'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-189');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Search & omnibox');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'so-engine', value: 'brave' } } : null) } });
  assert.match(m.state.html, /Engine: brave\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'so-suggest', key: 'remote' } } : null) } });
  assert.match(m.state.html, /remote suggestions on\./);
  m.click('so-actions');
  assert.match(m.state.html, /Page actions hidden\./);
  m.click('so-ai');
  assert.match(m.state.html, /AI in omnibox on\./);
  m.click('so-manage');
  assert.match(m.state.html, /Search engine manager requested \(S-165\)\./);
});

test('s-190 privacy settings changes cookies and opens related panels', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-190'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-190');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Privacy');
  assert.match(m.state.html, /Third-party cookies blocked/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'prv-cookies', value: 'block-all' } } : null) } });
  assert.match(m.state.html, /Cookie policy: block-all\./);
  m.click('prv-https');
  assert.match(m.state.html, /HTTPS-only off\./);
  m.click('prv-fingerprint');
  assert.match(m.state.html, /S-170/);
  m.click('prv-dns');
  assert.match(m.state.html, /S-171/);
  m.click('prv-clear');
  assert.match(m.state.html, /S-161/);
});

test('s-191 Rasha settings toggles categories, domains and pauses', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-191'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-191');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Rasha ad blocker settings');
  assert.match(m.state.html, /2026\.11/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ra-cat', key: 'social' } } : null) } });
  assert.match(m.state.html, /Pending: social disabled\./);
  assert.match(m.state.html, /active policy is unchanged/);
  m.click('ra-apply');
  assert.match(m.state.html, /applied after adapter success/);
  assert.match(m.state.html, /campaigns cannot disable it/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ra-domain', value: 'tracker.example' } });
  m.click('ra-add');
  assert.match(m.state.html, /tracker\.example blocked\./);
  m.click('ra-update');
  assert.match(m.state.html, /Rule lists updated\./);
  assert.match(m.state.html, /Just now/);
  m.click('ra-resume');
  assert.match(m.state.html, /Host resumed\./);
});

test('s-192 passwords settings toggles save, autofill and auth', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-192'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-192');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Passwords & autofill');
  assert.match(m.state.html, /Password vault/);
  assert.match(m.state.html, /Passkeys/);
  m.click('pwa-save');
  assert.match(m.state.html, /Offer to save off\./);
  m.click('pwa-autofill');
  assert.match(m.state.html, /Autofill off\./);
  m.click('pwa-auth');
  assert.match(m.state.html, /Device authentication not required\./);
  m.click('pwa-vault');
  assert.match(m.state.html, /S-147/);
  m.click('pwa-health');
  assert.match(m.state.html, /S-420/);
});

test('s-193 payments settings toggles autofill, CVC and scan', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-193'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-193');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Payments');
  assert.match(m.state.html, /Visa ·· 4242/);
  m.click('pay-autofill');
  assert.match(m.state.html, /Card autofill off\./);
  m.click('pay-cvc');
  assert.match(m.state.html, /CVC policy: remember\./);
  m.click('pay-scan');
  assert.match(m.state.html, /Card scan requested\./);
  m.click('pay-cards');
  assert.match(m.state.html, /S-152/);
});

test('s-194 downloads settings changes location, scanning and limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-194'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-194');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Downloads');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ds-location', value: 'desktop' } } : null) } });
  assert.match(m.state.html, /Location: desktop\./);
  m.click('ds-ask');
  assert.match(m.state.html, /Ask where to save on\./);
  m.click('ds-scan');
  assert.match(m.state.html, /Download scanning off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ds-speed', value: '5' } } : null) } });
  assert.match(m.state.html, /Speed limit: 5\./);
  m.click('ds-metered');
  assert.match(m.state.html, /Metered pause off\./);
});

test('s-195 languages changes UI language, spellcheck and offline', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-195'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-195');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Languages & translate');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'lang-ui', value: 'hi' } } : null) } });
  assert.match(m.state.html, /Interface language: hi\./);
  m.click('lang-spell');
  assert.match(m.state.html, /Spellcheck off\./);
  m.click('lang-offer');
  assert.match(m.state.html, /Translate offer off\./);
  m.click('lang-offline');
  assert.match(m.state.html, /Offline language pack downloaded\./);
});

test('s-196 accessibility toggles reader, motion, contrast, zoom and caret', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-196'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-196');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Accessibility');
  m.click('acc-reader');
  assert.match(m.state.html, /Screen reader optimisations on\./);
  m.click('acc-motion');
  assert.match(m.state.html, /Reduce motion on\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-contrast', value: 'high' } } : null) } });
  assert.match(m.state.html, /Contrast: high\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-zoom', value: '125' } } : null) } });
  assert.match(m.state.html, /Default zoom: 125%\./);
  m.click('acc-caret');
  assert.match(m.state.html, /Caret browsing on\./);
});

test('s-197 system and performance changes memory, battery, GPU and startup', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-197'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-197');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'System & performance');
  m.click('sys-mem');
  assert.match(m.state.html, /Memory saver off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sys-mem-mode', value: 'max' } } : null) } });
  assert.match(m.state.html, /Memory mode: max\./);
  m.click('sys-battery');
  assert.match(m.state.html, /Battery saver off\./);
  m.click('sys-gpu');
  assert.match(m.state.html, /GPU acceleration off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sys-startup', value: 'start' } } : null) } });
  assert.match(m.state.html, /Startup: start\./);
  m.click('sys-proxy');
  assert.match(m.state.html, /S-171/);
});

test('s-198 extensions settings changes dev mode, updates and access', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-198'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-198');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Extensions');
  m.click('xs-dev');
  assert.match(m.state.html, /Developer mode on\./);
  m.click('xs-updates');
  assert.match(m.state.html, /Automatic updates off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'xs-access', value: 'all' } } : null) } });
  assert.match(m.state.html, /Site access: all\./);
  m.click('xs-manager');
  assert.match(m.state.html, /S-154/);
});

test('s-199 sync settings toggles entities and opens related panels', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-199'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-199');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Sync');
  m.click('syn-on');
  assert.match(m.state.html, /Sync off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'syn-entity', key: 'extensions' } } : null) } });
  assert.match(m.state.html, /extensions sync on\./);
  m.click('syn-devices');
  assert.match(m.state.html, /S-220/);
  m.click('syn-recovery');
  assert.match(m.state.html, /S-232/);
  m.click('syn-diag');
  assert.match(m.state.html, /S-137/);
});

test('s-200 AI settings changes model, memory, permissions and retention', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-200'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-200');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ais-model', value: 'local' } } : null) } });
  assert.match(m.state.html, /Model: local\./);
  m.click('ais-memory');
  assert.match(m.state.html, /Memory off\./);
  m.click('ais-context');
  assert.match(m.state.html, /Page context off\./);
  m.click('ais-actions');
  assert.match(m.state.html, /Agent actions on\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ais-retention', value: 'none' } } : null) } });
  assert.match(m.state.html, /Retention: none\./);
  m.click('ais-train');
  assert.match(m.state.html, /Training on your data on\./);
});

test('s-201 advanced toggles experiments and resets them', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-201'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-201');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Advanced');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'adv-flag', key: 'renderer' } } : null) } });
  assert.match(m.state.html, /renderer experiment on\./);
  m.click('adv-diag');
  assert.match(m.state.html, /S-237/);
  m.click('adv-reset');
  assert.match(m.state.html, /Experiments reset\./);
});

test('s-202 about and reset checks update, credits and guarded reset', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-202'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/s-202');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'About/reset');
  assert.match(m.state.html, /Version 0\.0\.23/);
  m.click('ab-update');
  assert.match(m.state.html, /S-016/);
  m.click('ab-credits');
  assert.match(m.state.html, /open-source libraries/);
  m.click('ab-reset');
  assert.match(m.state.html, /Confirm resetting all settings\./);
  m.click('ab-confirm');
  assert.match(m.state.html, /Settings reset to defaults; saved data kept\./);
});

test('s-203 AI launcher shows entry points and consent rule', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-203'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-203');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI launcher');
  assert.match(m.state.html, /Toolbar launcher/);
  assert.match(m.state.html, /Consent first/);
  assert.match(m.state.html, /Private pages are excluded/);
  m.click('ail-shortcut');
  assert.match(m.state.html, /Ctrl\+Shift\+A/);
  m.click('ail-chat');
  assert.match(m.state.html, /S-204/);
  m.click('ail-summarize');
  assert.match(m.state.html, /S-205/);
});

test('s-204 chat with page keeps context, citations and thread', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-204'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-204');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Chat with page');
  assert.match(m.state.html, /Page: Reading the wind/);
  assert.match(m.state.html, /\[1\]\[2\]/);
  m.click('chp-ctx');
  assert.match(m.state.html, /Page context removed\./);
  m.click('chp-send');
  assert.match(m.state.html, /Reply added\./);
  assert.match(m.state.html, /What should I check next\?/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'chp-cite', id: '2' } } : null) } });
  assert.match(m.state.html, /Opened citation \[2\]\./);
});

test('s-205 summarize switches format and length and copies', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-205'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-205');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Summarize');
  assert.match(m.state.html, /Wind folds over a ridge/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sum-format', value: 'bullets' } } : null) } });
  assert.match(m.state.html, /Format: bullets\./);
  assert.match(m.state.html, /• Wind folds over the ridge\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sum-length', value: 'long' } } : null) } });
  assert.match(m.state.html, /Measurements were taken at first light/);
  m.click('sum-copy');
  assert.match(m.state.html, /Summary copied\./);
});

test('s-206 compare tabs picks tabs and builds a cited table', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-206'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-206');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Compare tabs');
  assert.match(m.state.html, /Arc paper/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cmp-pick', id: 'notes' } } : null) } });
  assert.match(m.state.html, /3 tabs selected\./);
  m.click('cmp-compare');
  assert.match(m.state.html, /Comparison ready\./);
  assert.match(m.state.html, /cmp-table/);
  assert.match(m.state.html, /Wind survey \[1\]/);
  assert.match(m.state.html, /Saved pages \[2\]/);
});

test('s-207 compose rewrite changes tone, rewrites and replaces', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-207'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-207');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Compose/rewrite');
  assert.match(m.state.html, /data-compose-draft/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cr-tone', value: 'formal' } } : null) } });
  assert.match(m.state.html, /Tone: formal\./);
  m.click('cr-rewrite');
  assert.match(m.state.html, /Rewritten with formal tone\./);
  assert.match(m.state.html, /Rewritten · formal/);
  m.click('cr-replace');
  assert.match(m.state.html, /Draft replaced\./);
  m.click('cr-insert');
  assert.match(m.state.html, /Inserted into the draft\./);
});

test('s-208 selection actions explain, translate, rewrite and search', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-208'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-208');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Selection actions');
  assert.match(m.state.html, /does not block the wind/);
  m.click('sel-explain');
  assert.match(m.state.html, /changes the wind’s shape/);
  m.click('sel-translate');
  assert.match(m.state.html, /कठिनाई हवा/);
  m.click('sel-rewrite');
  assert.match(m.state.html, /reshapes the wind rather than blocking/);
  m.click('sel-search');
  assert.match(m.state.html, /Searching the selected phrase/);
});

test('s-209 agent plan includes steps, permissions, cost and approval', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-209'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-209');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Agent plan');
  assert.match(m.state.html, /Open the booking page/);
  assert.match(m.state.html, /about 1,200 tokens/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ag-step', key: 'submit' } } : null) } });
  assert.match(m.state.html, /submit step included\./);
  m.click('ag-approve');
  assert.match(m.state.html, /Plan approved\./);
  assert.match(m.state.html, /The agent can run only the included steps/);
});

test('s-210 agent run advances, pauses, stops and logs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-210'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-210');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Agent run');
  assert.match(m.state.html, /Filled requested dates/);
  m.click('ar-advance');
  assert.match(m.state.html, /Progress 55%\./);
  assert.match(m.state.html, /Step 3 completed/);
  m.click('ar-pause');
  assert.match(m.state.html, /Agent paused\./);
  m.click('ar-advance');
  assert.match(m.state.html, /Agent paused\./);
  m.click('ar-stop');
  assert.match(m.state.html, /Agent stopped\./);
  assert.match(m.state.html, /data-onboard="ar-advance" disabled/);
});

test('s-211 agent receipts undo one action or all', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-211'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-211');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Agent receipts');
  assert.match(m.state.html, /Opened booking page/);
  assert.match(m.state.html, /3 actions · 0 undone\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'rec-undo', id: 'r2' } } : null) } });
  assert.match(m.state.html, /Filled dates undone\./);
  m.click('rec-undo-all');
  assert.match(m.state.html, /All actions undone\./);
  assert.match(m.state.html, /data-onboard="rec-undo-all" disabled/);
});

test('s-212 AI memory adds, edits, deletes and scopes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-212'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-212');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI memory');
  assert.match(m.state.html, /Prefers concise answers/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mem-draft', value: 'Uses metric units' } });
  m.click('mem-add');
  assert.match(m.state.html, /Memory added\./);
  assert.match(m.state.html, /Uses metric units/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mem-edit', id: 'm1' } } : null) } });
  assert.match(m.state.html, /data-mem-edit/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mem-edit', value: 'Prefers very concise answers' } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mem-save', id: 'm1' } } : null) } });
  assert.match(m.state.html, /Memory updated\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mem-delete', id: 'm2' } } : null) } });
  assert.match(m.state.html, /Memory deleted\./);
});

test('s-213 AI settings changes provider, model, retention and training', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-213'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-213');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI settings');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'aic-provider', value: 'cloud' } } : null) } });
  assert.match(m.state.html, /Provider: cloud\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'aic-model', value: 'Cloud max' } } : null) } });
  assert.match(m.state.html, /Model: Cloud max\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'aic-retention', value: 'none' } } : null) } });
  assert.match(m.state.html, /Retention: none\./);
  m.click('aic-training');
  assert.match(m.state.html, /Training on your data on\./);
  m.click('aic-save');
  assert.match(m.state.html, /AI settings saved on this device\./);
});

test('s-214 model picker switches provider, speed and cost', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-214'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-214');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Model picker');
  assert.match(m.state.html, /On-device/);
  assert.match(m.state.html, /No network · no per-request cost/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mp-provider', value: 'cloud' } } : null) } });
  assert.match(m.state.html, /Provider: cloud\./);
  assert.match(m.state.html, /About 1,200 tokens per answer/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'mp-speed', value: 'quality' } } : null) } });
  assert.match(m.state.html, /Quality: quality\./);
  assert.match(m.state.html, /About 2,400 tokens per answer/);
  m.click('mp-use');
  assert.match(m.state.html, /Model selected: Cloud · quality\./);
});

test('s-215 plans and upgrade switches cycle, confirms a plan and restores', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-215'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-215');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Quota/paywall');
  assert.match(m.state.html, /₹1,999 \/ yr/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pl-cycle', value: 'monthly' } } : null) } });
  assert.match(m.state.html, /Billing cycle: monthly\./);
  assert.match(m.state.html, /₹199 \/ mo/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pl-pick', id: 'plus' } } : null) } });
  assert.match(m.state.html, /Change to plus\?/);
  m.click('pl-confirm');
  assert.match(m.state.html, /Plan changed to plus\./);
  assert.match(m.state.html, /plus plan active/);
  m.click('pl-restore');
  assert.match(m.state.html, /nothing changed/);
});

test('s-216 AI error names the failure, retries honestly and falls back locally', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-216'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-216');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI error/offline');
  assert.match(m.state.html, /Cloud model did not respond/);
  m.click('ae-retry');
  assert.match(m.state.html, /Retry failed again/);
  assert.match(m.state.html, /still unreachable/);
  m.click('ae-local');
  assert.match(m.state.html, /On-device fallback active/);
  assert.match(m.state.html, /not sent again/);
});

test('s-217 AI consent grants, declines and withdraws scopes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-217'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-217');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI onboarding');
  assert.match(m.state.html, /Not granted · 0 scopes\./);
  m.click('nc-grant');
  assert.match(m.state.html, /Check the consent box first\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'nc-scope', key: 'page' } } : null) } });
  assert.match(m.state.html, /page scope allowed\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'nc-dest', value: 'cloud' } } : null) } });
  assert.match(m.state.html, /Destination: cloud\./);
  m.click('nc-ack');
  m.click('nc-grant');
  assert.match(m.state.html, /Consent granted\./);
  assert.match(m.state.html, /1 scopes · cloud processing/);
  m.click('nc-withdraw');
  assert.match(m.state.html, /Consent withdrawn; all scopes reset\./);
});

test('s-218 AI history searches, opens and deletes threads', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-218'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai/s-218');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'AI history');
  assert.match(m.state.html, /Wind survey notes/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ah-search', value: 'atlas' } });
  assert.match(m.state.html, /Compare Atlas papers/);
  assert.doesNotMatch(m.state.html, /Wind survey notes/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ah-delete', id: 'th2' } } : null) } });
  assert.match(m.state.html, /Thread deleted/);
  m.click('ah-clear');
  assert.match(m.state.html, /All AI history deleted/);
  assert.match(m.state.html, /No threads match/);
});

test('s-219 accounts and profiles switches, renames, adds and deletes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-219'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-219');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Account overview');
  assert.match(m.state.html, /meera@vaayvu\.app · verified/);
  assert.match(m.state.html, /Plus · renews 12 Dec 2026/);
  assert.match(m.state.html, /2FA enabled · recovery key verified/);
  assert.match(m.state.html, /Personal · current/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-switch', id: 'p2' } } : null) } });
  assert.match(m.state.html, /Switched to Work\./);
  assert.match(m.state.html, /Work · current/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-edit', id: 'p2' } } : null) } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acc-edit', value: 'Studio' } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-save', id: 'p2' } } : null) } });
  assert.match(m.state.html, /Profile renamed\./);
  assert.match(m.state.html, /Studio · current/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acc-new', value: 'Travel' } });
  m.click('acc-add');
  assert.match(m.state.html, /Profile added\./);
  assert.match(m.state.html, /Travel/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'acc-delete', id: 'p1' } } : null) } });
  assert.match(m.state.html, /Delete Personal\?/);
  m.click('acc-delete-confirm');
  assert.match(m.state.html, /Profile deleted\./);
});

test('s-220 account and sync devices revokes, pairs and signs out', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-220'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-220');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Devices');
  assert.match(m.state.html, /meera@vaayvu\.app/);
  assert.match(m.state.html, /3 devices · sync on\./);
  m.click('dev-sync');
  assert.match(m.state.html, /Sync on this device off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dev-revoke', id: 'd3' } } : null) } });
  assert.match(m.state.html, /Revoke this device\?/);
  m.click('dev-revoke-confirm');
  assert.match(m.state.html, /Office PC revoked\./);
  assert.doesNotMatch(m.state.html, /data-id="d3"/);
  m.click('dev-pair');
  assert.match(m.state.html, /Pairing code/);
  assert.match(m.state.html, /<span class="sx-code">\d{6}<\/span>/);
  m.click('dev-signout');
  assert.match(m.state.html, /Sign out of sync\?/);
  m.click('dev-signout-confirm');
  assert.match(m.state.html, /Signed out of sync; local data kept\./);
});

test('s-221 sync conflict shows both copies and merges without loss', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-221'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-221');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Sync conflict');
  assert.match(m.state.html, /This device/);
  assert.match(m.state.html, /Your other device/);
  assert.match(m.state.html, /3 pages/);
  assert.match(m.state.html, /2 pages/);
  m.click('sc-merge');
  assert.match(m.state.html, /Merged both copies/);
  assert.match(m.state.html, /Nothing was lost/);
});

test('s-222 account plans switch cycle and choose a plan', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-222'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-222');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Plans');
  assert.match(m.state.html, /Free/);
  assert.match(m.state.html, /Pro/);
  assert.match(m.state.html, /Family/);
  assert.match(m.state.html, /₹1,999 \/ yr/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'apl-cycle', value: 'monthly' } } : null) } });
  assert.match(m.state.html, /₹199 \/ mo/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'apl-choose', id: 'pro' } } : null) } });
  assert.match(m.state.html, /Selected the pro plan/);
  assert.match(m.state.html, /No charge is made/);
});

test('s-223 checkout switches method, shows tax and requires terms', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-223'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-223');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Checkout');
  assert.match(m.state.html, /Tax \(18% GST\)/);
  assert.match(m.state.html, /₹2,358\.82/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'co-method', value: 'apple' } } : null) } });
  assert.match(m.state.html, /Apple Pay/);
  m.click('co-pay');
  assert.match(m.state.html, /Accept the terms before paying/);
  m.click('co-terms');
  m.click('co-pay');
  assert.match(m.state.html, /Payment authorised/);
  assert.match(m.state.html, /No real charge was made/);
});

test('s-224 manage subscription pauses, cancels and resumes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-224'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-224');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Manage subscription');
  assert.match(m.state.html, /Plus plan/);
  assert.match(m.state.html, /Card ending 4242/);
  m.click('sb-method-open');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-sb-card', value: '5555444433332222' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-sb-expiry', value: '12/30' } });
  m.click('sb-method-save');
  assert.match(m.state.html, /Card ending 2222/);
  m.click('sb-pause');
  assert.match(m.state.html, /Plan paused/);
  m.click('sb-resume');
  assert.match(m.state.html, /Plan resumed/);
});

test('s-225 invoices list, download and show VAT', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-225'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-225');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Invoices');
  assert.match(m.state.html, /INV-2026-11/);
  assert.match(m.state.html, /₹2,358\.82/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'inv-download', id: 'INV-2026-11' } } : null) } });
  assert.match(m.state.html, /downloaded as a PDF/);
  m.click('inv-vat');
  assert.match(m.state.html, /base ₹1,999 \+ GST ₹359\.82/);
});

test('s-226 family invites, removes and shows limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-226'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-226');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Family');
  assert.match(m.state.html, /Meera · owner/);
  assert.match(m.state.html, /3 of 6 members/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-famg-invite', value: 'dev@example.com' } });
  m.click('famg-invite');
  assert.match(m.state.html, /Invite sent to dev@example\.com/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'famg-remove', id: 'u2' } } : null) } });
  assert.match(m.state.html, /Remove Arun\?/);
  m.click('famg-remove-confirm');
  assert.match(m.state.html, /Arun removed from the family/);
});

test('s-227 restore purchases waits for store confirmation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-227'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-227');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Restore purchases');
  assert.match(m.state.html, /Apple App Store/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'rp-store', value: 'google' } } : null) } });
  assert.match(m.state.html, /Google Play/);
  m.click('rp-restore');
  assert.match(m.state.html, /Waiting for the store/);
  assert.match(m.state.html, /Nothing is unlocked until it does/);
  m.click('rp-confirm');
  assert.match(m.state.html, /Purchase restored/);
  assert.match(m.state.html, /Receipt verified/);
});

test('s-228 delete account warns, exports and uses a 30-day grace period', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-228'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-228');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Delete account');
  assert.match(m.state.html, /30-day grace period/);
  m.click('da-open');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-da-typed', value: 'delete' } });
  m.click('da-confirm');
  assert.match(m.state.html, /Type DELETE in capitals/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-da-typed', value: 'DELETE' } });
  m.click('da-confirm');
  assert.match(m.state.html, /Password is required/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-da-pass', value: 'secret' } });
  m.click('da-confirm');
  assert.match(m.state.html, /Deletion scheduled with a 30-day grace period/);
  m.click('da-cancel');
  assert.match(m.state.html, /Deletion cancelled; account restored/);
});

test('s-229 export data sets scope, format, email and progress', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-229'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-229');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Export data');
  m.click('ax-send');
  assert.match(m.state.html, /Enter a valid email address/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ax-email', value: 'me@example.com' } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ex-entity', key: 'passwords' } } : null) } });
  assert.match(m.state.html, /passwords included/);
  m.click('ax-send');
  assert.match(m.state.html, /20%/);
  for (let i = 0; i < 4; i += 1) m.click('ax-advance');
  assert.match(m.state.html, /Export emailed to me@example\.com/);
  assert.match(m.state.html, /100%/);
});

test('s-230 sign out covers this device or all devices', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-230'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-230');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Sign out');
  assert.match(m.state.html, /local browsing data/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'so-scope', value: 'all' } } : null) } });
  m.click('so-signout');
  assert.match(m.state.html, /Sign out everywhere\?/);
  m.click('so-confirm');
  assert.match(m.state.html, /Signed out on every device/);
  assert.match(m.state.html, /Local data on each device was kept/);
});

test('s-231 two-factor covers TOTP, recovery codes and passkey', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-231'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-231');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], '2FA');
  m.click('tf-totp');
  assert.match(m.state.html, /Authenticator app configured/);
  m.click('tf-passkey');
  assert.match(m.state.html, /Passkey added/);
  m.click('tf-codes');
  assert.match(m.state.html, /Recovery codes generated/);
  assert.match(m.state.html, /[A-Z0-9]{4}-[A-Z0-9]{4}/);
  assert.match(m.state.html, /Two-factor protection on/);
});

test('s-232 recovery generates a key, sets delay and opens support', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-232'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accounts/s-232');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'accounts');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Recovery');
  assert.match(m.state.html, /Recovery email/);
  m.click('rc-key');
  assert.match(m.state.html, /VYVU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'rc-delay', value: '24' } } : null) } });
  assert.match(m.state.html, /Recovery delay: 24 hours/);
  m.click('rc-help');
  assert.match(m.state.html, /Recovery support request opened/);
});

test('s-233 notification settings toggles types, quiet hours and OS link', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-233'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-233');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Notification settings');
  assert.match(m.state.html, /Downloads finished/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ns-type', key: 'ai' } } : null) } });
  assert.match(m.state.html, /ai notifications on/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ns-quiet', value: '20:00–08:00' } } : null) } });
  assert.match(m.state.html, /Quiet hours: 20:00–08:00/);
  m.click('ns-os');
  assert.match(m.state.html, /OS notification settings requested/);
});

test('s-234 default apps covers browser, protocols and PDF', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-234'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-234');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Default apps/protocols');
  assert.match(m.state.html, /Web browser/);
  assert.match(m.state.html, /Magnet links/);
  assert.match(m.state.html, /PDF files/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dap-set', id: 'mail' } } : null) } });
  assert.match(m.state.html, /OS default-app settings for mail/);
});

test('s-235 task manager sorts, inspects and ends tasks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-235'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-235');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Task manager');
  assert.match(m.state.html, /CPU/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'tm-sort', value: 'cpu' } } : null) } });
  assert.match(m.state.html, /Sorted by cpu/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'tm-sel', id: 't1' } } : null) } });
  assert.match(m.state.html, /Task details shown/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'tm-end', id: 't1' } } : null) } });
  assert.match(m.state.html, /freed \d+ MB/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-tm-query', value: 'zzz' } });
  assert.match(m.state.html, /No tasks match/);
});

test('s-236 about:flags toggles experiments and resets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-236'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-236');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'about:flags');
  assert.match(m.state.html, /Experimental flags/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'af-flag', key: 'gpu' } } : null) } });
  assert.match(m.state.html, /gpu experiment on/);
  m.click('af-reset');
  assert.match(m.state.html, /All experiments reset/);
  assert.match(m.state.html, /0 experiments enabled/);
});

test('s-237 diagnostics copies, checks, shows logs and bundles', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-237'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-237');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Diagnostics');
  assert.match(m.state.html, /0\.0\.23 · Stable/);
  assert.match(m.state.html, /It never includes page content, passwords or cookies/);
  m.click('dg-copy');
  assert.match(m.state.html, /Diagnostics copied to the clipboard\./);
  m.click('dg-net');
  assert.match(m.state.html, /checked just now/);
  m.click('dg-logs');
  assert.match(m.state.html, /boot: profile loaded, version 0\.0\.23/);
  m.click('dg-bundle');
  assert.match(m.state.html, /vaayvu-diagnostics-2026-11-27\.zip/);
  m.click('dg-download');
  assert.match(m.state.html, /Diagnostics bundle downloaded\./);
});

test('s-238 crash reports toggles sending, sends and deletes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-238'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-238');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Crash report');
  assert.match(m.state.html, /2 reports · 1 not sent\./);
  m.click('cr-auto');
  assert.match(m.state.html, /Automatic crash reports off\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cr-sel', id: 'c1' } } : null) } });
  assert.match(m.state.html, /renderer\/segv-0x14/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cr-send', id: 'c1' } } : null) } });
  assert.match(m.state.html, /Crash report sent\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cr-delete', id: 'c2' } } : null) } });
  assert.match(m.state.html, /Crash report deleted\./);
  m.click('cr-clear');
  m.click('cr-clear-confirm');
  assert.match(m.state.html, /1 crash reports deleted\./);
  assert.match(m.state.html, /No stored reports/);
});

test('s-239 feedback sets category, attachments and contact', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-239'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-239');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Feedback');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fb-category', value: 'performance' } } : null) } });
  assert.match(m.state.html, /Category: performance/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fb-text', value: 'Scrolling stutters' } });
  m.click('fb-shot');
  m.click('fb-logs');
  assert.match(m.state.html, /Attached/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fb-contact', value: 'me@example.com' } });
  m.click('fb-send');
  assert.match(m.state.html, /Feedback queued/);
});

test('s-240 help center searches, opens articles and contacts support', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-240'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-240');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Help center');
  assert.match(m.state.html, /Set up sync/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-hc-query', value: 'password' } });
  assert.match(m.state.html, /Export and import passwords/);
  assert.doesNotMatch(m.state.html, /Set up sync/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'hc-open', id: 'passwords' } } : null) } });
  assert.match(m.state.html, /CSV import/);
  m.click('hc-contact');
  assert.match(m.state.html, /Support contact requested/);
});

test('s-241 legal covers terms, privacy, cookies and licences', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-241'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-241');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Legal');
  assert.match(m.state.html, /Terms of service/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'lg-doc', value: 'licences' } } : null) } });
  assert.match(m.state.html, /BSD 3-Clause/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'lg-doc', value: 'privacy' } } : null) } });
  m.click('lg-open');
  assert.match(m.state.html, /Full privacy document opened/);
});

test('s-242 licences search, open notices and copy', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-242'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-242');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Licenses');
  assert.match(m.state.html, /Chromium/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-lc-query', value: 'node' } });
  assert.match(m.state.html, /Node\.js/);
  assert.doesNotMatch(m.state.html, /Chromium/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'lc-open', id: 'node' } } : null) } });
  assert.match(m.state.html, /Permission is hereby granted/);
  m.click('lc-copy');
  assert.match(m.state.html, /Licence notice copied/);
});

test('s-243 theme studio sets colours, wallpaper and shares or imports', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-243'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-243');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Theme studio');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ts-accent', value: '#e84393' } } : null) } });
  assert.match(m.state.html, /Accent: #e84393/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ts-wall', value: 'dusk' } } : null) } });
  assert.match(m.state.html, /Wallpaper: dusk/);
  m.click('ts-share');
  assert.match(m.state.html, /VYVU-THEME-E84393-FAF9F5-DUSK/);
  m.click('ts-import');
  assert.match(m.state.html, /Theme imported/);
});

test('s-244 shortcut editor searches, rebinds, detects conflicts and resets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-244'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-244');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Shortcut editor');
  assert.match(m.state.html, /New tab/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ke-query', value: 'find' } });
  assert.match(m.state.html, /Find in page/);
  assert.doesNotMatch(m.state.html, /Close tab/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ke-rebind', id: 'find' } } : null) } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ke-draft', value: '⌘T' } });
  m.click('ke-save');
  assert.match(m.state.html, /Shortcut already used by New tab/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ke-draft', value: '⇧⌘F' } });
  m.click('ke-save');
  assert.match(m.state.html, /Shortcut saved/);
  m.click('ke-reset');
  assert.match(m.state.html, /All shortcuts reset/);
});

test('s-245 widgets adds, resizes and removes widgets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-245'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-245');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Widgets');
  assert.match(m.state.html, /Clock/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'wd-size', id: 'clock', value: 'Large' } } : null) } });
  assert.match(m.state.html, /Clock size: Large/);
  m.click('wd-add-open');
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'wd-add', id: 'notes' } } : null) } });
  assert.match(m.state.html, /Notes widget added/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'wd-remove', id: 'weather' } } : null) } });
  assert.match(m.state.html, /Weather removed/);
});

test('s-246 handoff enables, lists devices and reports status', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-246'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-246');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Handoff/continuity');
  assert.match(m.state.html, /MacBook Pro/);
  assert.match(m.state.html, /only the current page title and address/);
  m.click('ho-toggle');
  assert.match(m.state.html, /Continuity off/);
  assert.match(m.state.html, /Nothing is shared/);
  m.click('ho-toggle');
  assert.match(m.state.html, /2 devices nearby/);
});

test('s-247 screen reader guide switches sections and plays a sample', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-247'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-247');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Screen reader guide');
  assert.match(m.state.html, /Double-tap/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'srg-tab', value: 'labels' } } : null) } });
  assert.match(m.state.html, /Address bar/);
  m.click('srg-sample');
  assert.match(m.state.html, /Sample announcement/);
});

test('s-248 kiosk validates URL, allowlist, PIN and exit', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-248'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-248');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Kiosk setup');
  assert.match(m.state.html, /Start URL/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kio-domain', value: 'lobby.example' } });
  m.click('kio-add');
  assert.match(m.state.html, /lobby\.example allowed/);
  m.click('kio-start');
  assert.match(m.state.html, /Set an exit PIN/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kio-pin', value: '12' } });
  m.click('kio-set-pin');
  assert.match(m.state.html, /4-digit PIN/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kio-pin', value: '4821' } });
  m.click('kio-set-pin');
  m.click('kio-start');
  assert.match(m.state.html, /Kiosk running/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kio-pin', value: '0000' } });
  m.click('kio-exit');
  assert.match(m.state.html, /Enter the 4-digit exit PIN/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kio-pin', value: '4821' } });
  m.click('kio-exit');
  assert.match(m.state.html, /Kiosk exited/);
});

test('s-249 enterprise policy shows managed status, policies and reports', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-249'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-249');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'Enterprise policy');
  assert.match(m.state.html, /Managed device/);
  assert.match(m.state.html, /Safe browsing/);
  m.click('ep-details');
  assert.match(m.state.html, /Policy ID/);
  m.click('ep-report');
  assert.match(m.state.html, /Compliance report generated/);
});

test('s-250 DevTools covers all panels and runs Lighthouse', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-250'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://system-utilities/s-250');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'system-utilities');
  assert.equal(m.dataset.atlasPriority, 'conditional');
  assert.equal(m.state.attrs['aria-label'], 'DevTools');
  assert.match(m.state.html, /Elements/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dv-tab', value: 'network' } } : null) } });
  assert.match(m.state.html, /18\.4 KB/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'dv-tab', value: 'lighthouse' } } : null) } });
  m.click('dv-run');
  assert.match(m.state.html, /Performance 96/);
  assert.match(m.state.html, /Lighthouse audit completed/);
});

test('s-251 startup health inspects stage, continues intact and links recovery', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-251'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-251');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Browser startup health center');
  assert.match(m.state.html, /2 consecutive failed starts/);
  m.click('sth-stage');
  assert.match(m.state.html, /Private-session tabs are never written to the journal/);
  m.click('sth-recovery');
  assert.match(m.state.html, /S-254/);
  m.click('sth-diagnostics');
  assert.match(m.state.html, /private URLs excluded/);
  m.click('sth-continue');
  assert.match(m.state.html, /Continue without the failing workload\?/);
  m.click('sth-continue-confirm');
  assert.match(m.state.html, /failing workload skipped\./);
  assert.match(m.state.html, /history, tabs on disk and settings were not erased/);
});

test('s-252 engine integrity shows metadata, verifies locally and links update', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-252'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-252');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Engine integrity and update status');
  assert.match(m.state.html, /engine revision 134\.0\.6998\.45/);
  assert.match(m.state.html, /App requires engine 132–136/);
  m.click('egi-versions');
  assert.match(m.state.html, /ICU 76 · SQLite 3\.46 · zlib 1\.3/);
  m.click('egi-check');
  assert.match(m.state.html, /Integrity check passed\./);
  assert.match(m.state.html, /No package was downloaded\./);
  m.click('egi-update');
  assert.match(m.state.html, /S-264/);
});

test('s-252 signature failure can never appear as verified', () => {
  const m = mount({ capabilities: { ...ALL_SETUP, engineSignatureFailed: true } });
  m.context.window.__vaayvuOnboardingOpen('s-252');
  assert.match(m.state.html, /Mismatch/);
  m.click('egi-check');
  assert.match(m.state.html, /Integrity check failed/);
  assert.match(m.state.html, /did not match its signed digest/);
});

test('s-253 profile lock hides data, survives failure and offers PIN fallback', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-253'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-253');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Profile lock/unlock');
  assert.match(m.state.html, /Personal is locked/);
  assert.match(m.state.html, /are not rendered until unlock succeeds/);
  m.click('plu-switch');
  assert.match(m.state.html, /no locked data was loaded/);
  m.click('plu-fail');
  assert.match(m.state.html, /Profile remains locked\./);
  assert.match(m.state.html, /1 failed this session/);
  m.click('plu-fallback');
  assert.match(m.state.html, /not OS biometric protection/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-plu-pin', value: '12' } });
  m.click('plu-pin-save');
  assert.match(m.state.html, /PIN must be 4 to 8 digits\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-plu-pin', value: '1234' } });
  m.click('plu-pin-save');
  assert.match(m.state.html, /reviewed app PIN fallback/);
  assert.match(m.state.html, /Personal unlocked/);
});

test('s-254 profile recovery selects sources, compares and previews read-only rules', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-254'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-254');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Profile recovery choice');
  assert.match(m.state.html, /Nothing is overwritten yet/);
  assert.match(m.state.html, /Bookmarks, history, tabs, settings, passwords key/);
  m.click('prc-compare');
  assert.match(m.state.html, /Versions compared\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'prc-select', id: 'snap2' } } : null) } });
  assert.match(m.state.html, /Inspected snap2; no files changed\./);
  assert.match(m.state.html, /Schema 12 is older than the supported migration range/);
  assert.match(m.state.html, /data-onboard="prc-preview" disabled/);
  m.click('prc-preview');
  assert.match(m.state.html, /read-only and cannot be recovered/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'prc-select', id: 'snap1' } } : null) } });
  m.click('prc-preview');
  assert.match(m.state.html, /Recovery preview prepared \(S-257\)\./);
  m.click('prc-cancel');
  assert.match(m.state.html, /current profile files preserved\./);
});

test('s-255 session salvage scans, selects tabs and exports a report', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-255'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-255');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Damaged session salvage');
  assert.match(m.state.html, /Private-session tabs were never written to it/);
  m.click('ssv-scan');
  assert.match(m.state.html, /Salvage scan complete: 9 readable, 2 corrupt skipped\./);
  assert.match(m.state.html, /Reading the wind/);
  assert.match(m.state.html, /data-onboard="ssv-open" disabled/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ssv-toggle', id: 'sv2' } } : null) } });
  assert.match(m.state.html, /1 tabs selected\./);
  m.click('ssv-open');
  assert.match(m.state.html, /original journal untouched/);
  m.click('ssv-report');
  assert.match(m.state.html, /Redacted salvage report exported\./);
  assert.match(m.state.html, /No URLs with private query values, no credentials/);
});

test('s-256 backup catalogue inspects, blocks missing files and unlocks encryption', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-256'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-256');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Backup catalogue');
  m.click('bc-inspect');
  assert.match(m.state.html, /1,240 bookmarks · 8,600 history · 96 passwords/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bc-select', id: 'b2' } } : null) } });
  assert.match(m.state.html, /nothing restored or uploaded/);
  m.click('bc-inspect');
  assert.match(m.state.html, /local unlock required/);
  assert.match(m.state.html, /data-onboard="bc-preview" disabled/);
  m.click('bc-unlock');
  assert.match(m.state.html, /Backup unlocked for local preview\./);
  m.click('bc-preview');
  assert.match(m.state.html, /Restore preview requested \(S-257\)\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bc-select', id: 'b3' } } : null) } });
  m.click('bc-preview');
  assert.match(m.state.html, /backup file is missing and cannot be restored/);
});

test('s-257 restore preview keeps conflicts explicit and survives interruption', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-257'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-257');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Backup restore preview');
  assert.match(m.state.html, /1,240 bookmarks, 8,600 history entries, 96 passwords/);
  assert.match(m.state.html, /3 conflicts/);
  assert.match(m.state.html, /Read-only preview/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'brp-dest', value: 'merge' } } : null) } });
  assert.match(m.state.html, /Conflicting bookmarks are kept side by side/);
  m.click('brp-restore');
  assert.match(m.state.html, /Confirm restore\?/);
  m.click('brp-interrupt');
  assert.match(m.state.html, /original profile and backup intact\./);
  m.click('brp-restore');
  m.click('brp-confirm');
  assert.match(m.state.html, /Restore complete; original profile and backup unchanged\./);
  assert.match(m.state.html, /Recovery profile populated/);
});

test('s-258 migration dry run retains unknowns and restores on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-258'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-258');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Migration dry-run summary');
  assert.match(m.state.html, /live profile is not touched/);
  m.click('mdr-approve');
  assert.match(m.state.html, /Run the dry run before approving\./);
  m.click('mdr-run');
  assert.match(m.state.html, /128 keys remapped, 3 unknown keys reported/);
  assert.match(m.state.html, /Live profile unchanged/);
  m.click('mdr-unsupported');
  assert.match(m.state.html, /sidebar\.customDensity · reader\.oldLineHeight · experiments\.legacyFlag/);
  assert.match(m.state.html, /retained in the report/);
  m.click('mdr-approve');
  assert.match(m.state.html, /Confirm approval; backup is verified first\./);
  m.click('mdr-confirm');
  assert.match(m.state.html, /Migration approved and applied; journal written\./);
  m.click('mdr-fail');
  assert.match(m.state.html, /last coherent schema state restored from the journal/);
});

test('s-259 crash journal inspects, redacts and explains missing symbols', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-259'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-259');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Crash journal inspection');
  assert.match(m.state.html, /Raw memory dumps are not collected by default/);
  assert.match(m.state.html, /renderer!RestoreSession\+0x2a/);
  m.click('cji-symbols');
  assert.match(m.state.html, /reported as unresolved rather than guessed/);
  m.click('cji-redact');
  assert.match(m.state.html, /Removed: private-session URLs/);
  assert.match(m.state.html, /Kept: signature, versions, component, timestamps/);
  m.click('cji-export');
  assert.match(m.state.html, /no raw dump, private URL or credential is included/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'cji-select', id: 'c2' } } : null) } });
  assert.match(m.state.html, /worker!BlocklistBuild\+0x11/);
  m.click('cji-recovery');
  assert.match(m.state.html, /S-254/);
});

test('s-260 safe mode disables temporarily, re-enables suspects and exits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-260'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-260');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Safe-mode diagnostic wizard');
  assert.match(m.state.html, /Nothing is uninstalled and preferences are not erased/);
  assert.match(m.state.html, /Sandbox, certificate checks and HTTPS upgrades stay enabled/);
  m.click('sfm-start');
  assert.match(m.state.html, /extensions disabled for this session only/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sfm-enable', id: 'x1' } } : null) } });
  assert.match(m.state.html, /Rasha Shield re-enabled for this session\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sfm-enable', id: 'x1' } } : null) } });
  assert.match(m.state.html, /Rasha Shield disabled again\./);
  m.click('sfm-results');
  assert.match(m.state.html, /engine sandbox and certificate checks unchanged/);
  m.click('sfm-exit');
  assert.match(m.state.html, /previous extension state was restored\./);
  assert.match(m.state.html, /data-onboard="sfm-start"/);
});

test('s-261 profile isolation validates name, scopes imports and creates', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-261'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-261');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'New profile isolation wizard');
  assert.match(m.state.html, /cannot read the current profile’s data/);
  assert.match(m.state.html, /Never offered as an import source/);
  m.click('npi-create');
  assert.match(m.state.html, /Profile name is required\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-npi-name', value: 'Work' } });
  m.click('npi-create');
  assert.match(m.state.html, /That profile name already exists\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-npi-name', value: 'Studio' } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'npi-import', key: 'bookmarks' } } : null) } });
  assert.match(m.state.html, /bookmarks import selected\./);
  m.click('npi-create');
  assert.match(m.state.html, /Isolated profile created; current profile untouched\./);
  m.click('npi-open');
  assert.match(m.state.html, /Opened the new profile in its own window\./);
});

test('s-262 container isolation runs fixtures, compares and reports unsupported cache', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-262'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-262');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Container isolation test page');
  assert.match(m.state.html, /No ordinary browsing cookie, credential or history record/);
  assert.match(m.state.html, /Not partitioned on this platform build/);
  m.click('cit-run');
  assert.match(m.state.html, /Fixture probes complete: cookies and localStorage isolated; cache partition unsupported\./);
  assert.match(m.state.html, /A = alpha · B = beta/);
  assert.match(m.state.html, /Blocked both directions/);
  m.click('cit-compare');
  assert.match(m.state.html, /Cache reuse remains unsupported and is reported as such, not passed\./);
  m.click('cit-report');
  assert.match(m.state.html, /Contains no real browsing credentials\./);
});

test('s-263 security incident shows signed advisory, exposure and dismissal', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-263'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resilience/s-263');
  assert.equal(m.dataset.onboardingPhase, 'p04');
  assert.equal(m.dataset.atlasCategory, 'resilience');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Security incident notice');
  assert.match(m.state.html, /Text on a website cannot create or alter it/);
  assert.match(m.state.html, /installed 134\.0\.6998\.45 is in range/);
  m.click('sin-signed');
  assert.match(m.state.html, /crafted page could corrupt a journal record/);
  m.click('sin-exposure');
  assert.match(m.state.html, /Local exposure checked; no evidence of compromise\./);
  assert.match(m.state.html, /is not proof of compromise/);
  assert.match(m.state.html, /No evidence this profile was exploited/);
  m.click('sin-update');
  assert.match(m.state.html, /S-264/);
  m.click('sin-dismiss');
  assert.match(m.state.html, /Notice dismissed for this session/);
  assert.match(m.state.html, /not marked as resolved/);
  m.click('sin-reopen');
  assert.match(m.state.html, /Advisory shown again\./);
});

test('s-264 emergency update rejects unsigned, saves work and preserves old version', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-264'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-264');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Emergency update required');
  assert.match(m.state.html, /signed by Vaayvu release key/);
  assert.match(m.state.html, /Session restore stays disabled until the update is installed/);
  m.click('eu-reason');
  assert.match(m.state.html, /Restriction reason shown\./);
  assert.match(m.state.html, /Restart will require saving or discarding regular tabs first/);
  m.click('eu-save');
  assert.match(m.state.html, /Regular work saved; restart can proceed safely\./);
  m.click('eu-unsigned');
  assert.match(m.state.html, /Unsigned package rejected; nothing was installed\./);
  m.click('eu-fail');
  assert.match(m.state.html, /Install failed; previous 0\.0\.23 remains intact\./);
  m.click('eu-retry');
  assert.match(m.state.html, /Retry installed the verified package\./);
  assert.match(m.state.html, /Restart ready/);
});

test('s-265 engine mismatch names components and stages a signed update', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-265'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-265');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Engine version mismatch');
  assert.match(m.state.html, /Nothing was force-loaded/);
  assert.match(m.state.html, /libvfd_engine 1\.8 requires engine ABI 136/);
  m.click('evm-diag');
  assert.match(m.state.html, /Installed 76 · app expects 77/);
  assert.match(m.state.html, /Profile schema/);
  m.click('evm-stage');
  assert.match(m.state.html, /Signed 0\.0\.25 selected; installs on restart\./);
  assert.match(m.state.html, /signature verified · applies on restart/);
  m.click('evm-recovery');
  assert.match(m.state.html, /S-260/);
});

test('s-266 DRM explanation states limits, retries and offers publisher help', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-266'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-266');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Unsupported DRM explanation');
  assert.match(m.state.html, /Widevine L1 · HD · protected media/);
  assert.match(m.state.html, /Widevine L3 · SD · licensed playback only/);
  assert.match(m.state.html, /DRM_LICENSE_UNSUPPORTED/);
  assert.match(m.state.html, /does not bypass DRM or extract media/);
  m.click('drm-retry');
  assert.match(m.state.html, /Capability rechecked: Widevine L3 only; HD remains unavailable\./);
  m.click('drm-help');
  assert.match(m.state.html, /cannot grant a licence the publisher did not issue/);
  m.click('drm-page');
  assert.match(m.state.html, /unprotected media still works\./);
});

test('s-267 streaming compatibility separates decode, network and rights limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-267'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-267');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Streaming compatibility page');
  assert.match(m.state.html, /hardware decode unavailable/);
  assert.match(m.state.html, /no network error reported/);
  assert.match(m.state.html, /Rights limit/);
  assert.match(m.state.html, /no 4K support is claimed/);
  m.click('scp-run');
  assert.match(m.state.html, /decode limitation for AV1; network OK; rights limited to SD/);
  m.click('scp-diag');
  assert.match(m.state.html, /playback tokens, signed media URLs, cookies/);
  m.click('scp-player');
  assert.match(m.state.html, /Returned to the player at the supported quality\./);
});

test('s-268 extension API warning lists gaps and installs with limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-268'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-268');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Extension API compatibility warning');
  assert.match(m.state.html, /Missing security-critical APIs are listed explicitly and are not silently ignored/);
  assert.match(m.state.html, /nativeMessaging/);
  assert.match(m.state.html, /cannot be granted by any permission prompt/);
  m.click('eac-detail');
  assert.match(m.state.html, /Local helper sync and system-level firewall integration are disabled/);
  m.click('eac-install');
  assert.match(m.state.html, /Installed with limits; nativeMessaging stays unavailable\./);
  assert.match(m.state.html, /no permission prompt can grant it/);
  m.click('eac-cancel');
  assert.match(m.state.html, /Installation cancelled; nothing changed\./);
});

test('s-269 permission diff gates new hosts and keeps the old version on decline', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-269'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-269');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Extension permission diff review');
  assert.match(m.state.html, /New host access is not granted until you approve/);
  assert.match(m.state.html, /https:\/\/\*\.news\.example/);
  assert.match(m.state.html, /clipboardWrite/);
  m.click('epd-approve');
  assert.match(m.state.html, /Update approved; new origin scopes granted\./);
  assert.match(m.state.html, /clipboardWrite is removed/);
  m.click('epd-decline');
  assert.match(m.state.html, /2\.1 remains installed with its previous permissions\./);
  assert.match(m.state.html, /No new host access was granted\./);
  m.click('epd-sites');
  assert.match(m.state.html, /Site access controls requested\./);
});

test('s-270 sandbox alert terminates the process and stays quarantined', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-270'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-270');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Extension sandbox isolation alert');
  assert.match(m.state.html, /cannot write or dismiss its own trusted alert/);
  assert.match(m.state.html, /pid 4712 · quarantined/);
  m.click('esi-details');
  assert.match(m.state.html, /this alert intentionally omits unrelated browsing details/);
  m.click('esi-disable');
  assert.match(m.state.html, /Extension process terminated; access suspended\./);
  assert.match(m.state.html, /stays suspended across restarts until the quarantine review is finished/);
  m.click('esi-quarantine');
  assert.match(m.state.html, /S-271/);
});

test('s-271 quarantine review separates removal from data and reports redacted', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-271'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-271');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Malicious extension quarantine');
  assert.match(m.state.html, /Quarantined code cannot execute while this review is open/);
  assert.match(m.state.html, /sha256 71db…e0a4/);
  m.click('meq-remove');
  assert.match(m.state.html, /Remove the extension\?/);
  m.click('meq-remove-confirm');
  assert.match(m.state.html, /Extension removed; stored data retained separately\./);
  m.click('meq-delete-data');
  assert.match(m.state.html, /Stored extension data deleted\./);
  m.click('meq-report');
  assert.match(m.state.html, /Contains the package digest, version and signature match/);
  assert.match(m.state.html, /No browsing history, cookies or credentials/);
});

test('s-272 extension rollback excludes vulnerable versions and preserves state on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-272'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-272');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Extension rollback details');
  assert.match(m.state.html, /never broadens host permissions/);
  assert.match(m.state.html, /2\.0 · prohibited/);
  assert.match(m.state.html, /Vulnerable/);
  m.click('erb-preview');
  assert.match(m.state.html, /Unknown future keys stay untouched/);
  m.click('erb-apply');
  assert.match(m.state.html, /Apply rollback to 2\.1\?/);
  m.click('erb-confirm');
  assert.match(m.state.html, /Rollback complete; previous package recoverable\./);
  m.click('erb-fail');
  assert.match(m.state.html, /current 2\.2 and extension data remain recoverable/);
});

test('s-273 active permissions inspects frame scope and stops live sessions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-273'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-273');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Website permission active-indicator center');
  assert.match(m.state.html, /these are capabilities active right now, not remembered grants/i);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pic-select', id: 'i2' } } : null) } });
  assert.match(m.state.html, /Embedded frame on reading\.example/);
  assert.match(m.state.html, /not attributed to the top page/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pic-stop', id: 'i2' } } : null) } });
  assert.match(m.state.html, /Microphone session stopped; live capability revoked\./);
  assert.doesNotMatch(m.state.html, /data-id="i2"/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pic-stop', id: 'i1' } } : null) } });
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pic-stop', id: 'i3' } } : null) } });
  assert.match(m.state.html, /No active camera, microphone or location sessions/);
  m.click('pic-sites');
  assert.match(m.state.html, /S-157/);
});

test('s-274 one-time permission sheet scopes origins and expires honestly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-274'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-274');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Permission one-time session sheet');
  assert.match(m.state.html, /notes\.example · embedded frame/);
  assert.match(m.state.html, /https:\/\/reading\.example/);
  assert.match(m.state.html, /Until this tab closes or 10 minutes/);
  m.click('pos-explain');
  assert.match(m.state.html, /Navigating the frame to another origin requires a new request\./);
  m.click('pos-allow');
  assert.match(m.state.html, /Allowed once/);
  assert.match(m.state.html, /No persistent grant was saved\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pos-done' } } : null) } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-274'), true);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pos-deny' } } : null) } });
  assert.match(m.state.html, /not converted into a persistent allow after restart/);
});

test('s-275 clipboard warning distinguishes read and write and hides content', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-275'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-275');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Clipboard cross-origin warning');
  assert.match(m.state.html, /replacing what is there now/);
  assert.match(m.state.html, /clipboard\.writeText/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ccw-mode', value: 'read' } } : null) } });
  assert.match(m.state.html, /clipboard\.readText/);
  assert.match(m.state.html, /Clipboard contents stay hidden until you allow/);
  m.click('ccw-deny');
  assert.match(m.state.html, /The clipboard was left unchanged\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ccw-allow' } } : null) } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-275'), true);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ccw-mode', value: 'write' } } : null) } });
  m.click('ccw-allow');
  assert.match(m.state.html, /Allowed to replace the clipboard once\./);
  m.click('ccw-origin');
  assert.match(m.state.html, /a redirect cannot inherit this prompt/);
});

test('s-276 dangerous download quarantine cannot auto-open and keeps file on cancel', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-276'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-276');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Dangerous download quarantine');
  assert.match(m.state.html, /cannot auto-open or run/);
  assert.match(m.state.html, /Suspected, not proven malicious/);
  m.click('ddq-remove');
  assert.match(m.state.html, /Remove the quarantined file\?/);
  m.click('ddq-cancel');
  assert.match(m.state.html, /Deletion cancelled; file untouched\./);
  assert.match(m.state.html, /File present in quarantine storage/);
  m.click('ddq-remove');
  m.click('ddq-remove-confirm');
  assert.match(m.state.html, /Quarantined file removed\./);
  assert.match(m.state.html, /File removed from this device/);
  m.click('ddq-report');
  assert.match(m.state.html, /No browsing history or local paths/);
});

test('s-277 resume blocks unsafe bytes, keeps partials and resolves destination conflict', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-277'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-277');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Download resumed after restart');
  assert.match(m.state.html, /361 MB of 860 MB/);
  assert.match(m.state.html, /ETag v7-abc matches/);
  m.click('drs-validator');
  m.click('drs-resume');
  assert.match(m.state.html, /unsafe byte concatenation prevented/);
  m.click('drs-validator');
  m.click('drs-resume');
  assert.match(m.state.html, /completion waits for integrity checks/);
  m.click('drs-restart');
  assert.match(m.state.html, /Enter a new destination first\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-drs-dest', value: 'Downloads/Archive (1).zip' } });
  m.click('drs-restart');
  assert.match(m.state.html, /Destination exists; choose keep both or replace\./);
  m.click('drs-keep');
  assert.match(m.state.html, /Restarted into a keep-both destination\./);
  m.click('drs-cancel');
  assert.match(m.state.html, /partial file kept\./);
});

test('s-278 download verification distinguishes unsigned match and failed hashing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-278'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-278');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Download hash and origin verification');
  assert.match(m.state.html, /cdn\.files\.example/);
  assert.match(m.state.html, /Publisher signature/);
  assert.match(m.state.html, /Unavailable · the server offers no signed digest/);
  m.click('dhv-compare');
  assert.match(m.state.html, /Enter an expected digest to compare\./);
  m.click('dhv-calc');
  assert.match(m.state.html, /sha256 5c19…8f2b/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-dhv-expected', value: '5c19…8f2b' } });
  m.click('dhv-compare');
  assert.match(m.state.html, /It is not publisher authenticity because no signed digest exists\./);
  m.click('dhv-record');
  assert.match(m.state.html, /Excludes cookies, tokens and local file paths\./);
  m.click('dhv-fail');
  assert.match(m.state.html, /Hash computation failed; no success badge shown\./);
  assert.match(m.state.html, /Not available — computation failed/);
});

test('s-279 upload privacy holds files until explicit action and removes metadata', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-279'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-279');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'File upload privacy notice');
  assert.match(m.state.html, /Selecting files does not transmit them/);
  assert.match(m.state.html, /https:\/\/upload\.example/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'fup-remove', id: 'f2' } } : null) } });
  assert.match(m.state.html, /File removed from the selection\./);
  m.click('fup-strip');
  assert.match(m.state.html, /Metadata removal on\./);
  m.click('fup-upload');
  assert.match(m.state.html, /Upload 1 files to https:\/\/upload\.example\?/);
  m.click('fup-hold');
  assert.match(m.state.html, /nothing uploaded/);
  m.click('fup-upload');
  m.click('fup-confirm');
  assert.match(m.state.html, /1 files sent to https:\/\/upload\.example with metadata removed\./);
});

test('s-280 storage pressure previews categories, protects data and fails honestly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-280'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-280');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Device storage-pressure recovery');
  assert.match(m.state.html, /2\.1 GB free · low space/);
  assert.match(m.state.html, /Passwords and bookmarks/);
  assert.match(m.state.html, /Downloads<\/strong><small>8 GB · user files<\/small><\/span><span class="sx-badge">Protected/);
  m.click('dsp-preview');
  assert.match(m.state.html, /Removing cache, temp would free about 3\.4 GB/);
  m.click('dsp-clean');
  assert.match(m.state.html, /Confirm cleanup of 2 categories\?/);
  m.click('dsp-confirm');
  assert.match(m.state.html, /Passwords, bookmarks and downloads were untouched\./);
  m.click('dsp-fail');
  assert.match(m.state.html, /no reclaim claimed/);
});

test('s-281 sync journal resumes idempotently and keeps queue on auth failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-281'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/s-281');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Sync offline journal recovery');
  assert.match(m.state.html, /23 queued operations · encrypted/);
  assert.match(m.state.html, /Private-session events never enter it/);
  m.click('soj-details');
  assert.match(m.state.html, /idempotency key so a retry cannot duplicate a record/);
  m.click('soj-reconnect');
  assert.match(m.state.html, /remote acknowledged sequence advanced to 812/);
  m.click('soj-conflicts');
  assert.match(m.state.html, /journal is kept; choosing a side happens in the conflict view \(S-221\)/);
  m.click('soj-authfail');
  assert.match(m.state.html, /queued encrypted operations remain intact/);
});

test('s-282 retention monitor protects stale-device tombstones and previews compaction', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-282'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-282');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Sync retention/compaction monitor');
  assert.match(m.state.html, /Cursor 402 · active but stale/);
  assert.match(m.state.html, /42 tombstones still required by the old tablet’s cursor/);
  assert.match(m.state.html, /Local cache: 30 days/);
  m.click('src-details');
  assert.match(m.state.html, /oldest active cursor \(tablet, 402\)/);
  m.click('src-preview');
  assert.match(m.state.html, /Synced records are unchanged by this preview\./);
  m.click('src-compact');
  assert.match(m.state.html, /Run compaction\?/);
  m.click('src-confirm');
  assert.match(m.state.html, /42 held tombstones and all active records remain/);
  m.click('src-compact');
  m.click('src-postpone');
  assert.match(m.state.html, /Compaction postponed; nothing changed\./);
});

test('s-283 stale device rebootstraps with current epoch and revokes explicitly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-283'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-283');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Sync stale device recovery');
  assert.match(m.state.html, /Being offline is not by itself a reason to revoke/);
  assert.match(m.state.html, /Stored epoch 3 · current epoch 4/);
  m.click('ssd-details');
  assert.match(m.state.html, /cannot upload from sequence 402/);
  m.click('ssd-rebootstrap');
  assert.match(m.state.html, /Snapshot verified, authorization current, key epoch 4/);
  m.click('ssd-revoke');
  assert.match(m.state.html, /Revoke the old tablet\?/);
  m.click('ssd-revoke-cancel');
  assert.match(m.state.html, /Device kept; no revocation\./);
  m.click('ssd-revoke');
  m.click('ssd-revoke-confirm');
  assert.match(m.state.html, /New sync access is blocked/);
  assert.match(m.state.html, /cannot be erased remotely/);
});

test('s-284 revocation confirms scope, key rotation and unaffected devices', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-284'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-284');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Sync revoked device confirmation');
  assert.match(m.state.html, /Only this device loses new sync access/);
  assert.match(m.state.html, /Required before the device can pair again/);
  m.click('srd-revoke');
  assert.match(m.state.html, /Revoke Pixel 9\?/);
  m.click('srd-cancel');
  assert.match(m.state.html, /Revocation cancelled; device unchanged\./);
  m.click('srd-revoke');
  m.click('srd-confirm');
  assert.match(m.state.html, /cannot be remotely guaranteed erased/);
  m.click('srd-effects');
  assert.match(m.state.html, /Refresh token invalidated/);
  assert.match(m.state.html, /Unaffected · This Mac and tablet sessions remain/);
});

test('s-285 key rotation keeps old epoch until commit and supports rollback', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-285'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-285');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Sync key change safety wizard');
  assert.match(m.state.html, /never encrypted under epoch 5 until the rotation commits/);
  assert.match(m.state.html, /Raw key material never appears in logs/);
  m.click('kcw-details');
  assert.match(m.state.html, /A failed rotation leaves the old key usable\./);
  m.click('kcw-authorize');
  assert.match(m.state.html, /25% re-encrypted/);
  m.click('kcw-advance');
  assert.match(m.state.html, /Re-encryption at 50%\./);
  m.click('kcw-interrupt');
  assert.match(m.state.html, /epoch 4 decrypt path retained/);
  m.click('kcw-authorize');
  m.click('kcw-advance');
  m.click('kcw-advance');
  m.click('kcw-advance');
  assert.match(m.state.html, /Rotation committed under epoch 5\./);
});

test('s-286 recovery phrase verifies locally, clears memory and hides partials', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-286'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-286');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Recovery phrase offline verification');
  assert.match(m.state.html, /never uploaded, copied to the clipboard or stored in ordinary preferences/);
  assert.match(m.state.html, /autocomplete="off"/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-rpv-words', value: 'ridge wind wrong words' } });
  m.click('rpv-verify');
  assert.match(m.state.html, /Phrase does not verify; no partial matches revealed\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-rpv-words', value: 'ridge wind cairn water stone field light path moss fern salt' } });
  m.click('rpv-verify');
  assert.match(m.state.html, /Phrase verified and cleared from memory\./);
  assert.match(m.state.html, /Input was cleared from memory; nothing was saved\./);
  assert.match(m.state.html, /value=""/);
});

test('s-287 deletion requires successful export and explains legal retention', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-287'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-287');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Account deletion export confirmation');
  assert.match(m.state.html, /separate from deleting files on this device/);
  assert.match(m.state.html, /not erased unconditionally/);
  m.click('ade-delete');
  assert.match(m.state.html, /Export must succeed before deletion can be confirmed\./);
  m.click('ade-fail');
  assert.match(m.state.html, /Export failed; deletion remains blocked\./);
  assert.match(m.state.html, /Export failed · deletion blocked/);
  m.click('ade-delete');
  assert.match(m.state.html, /Export must succeed before deletion can be confirmed\./);
  m.click('ade-export');
  assert.match(m.state.html, /Account export ready and downloaded\./);
  m.click('ade-delete');
  assert.match(m.state.html, /Delete the account\?/);
  m.click('ade-confirm');
  assert.match(m.state.html, /legal records are retained/);
});

test('s-288 credential conflict hides secrets until auth and commits atomically', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-288'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-288');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Credential conflict resolution');
  assert.match(m.state.html, /Neither timestamp is applied automatically/);
  assert.match(m.state.html, /•••••••• encrypted · authenticate to inspect/);
  assert.match(m.state.html, /data-onboard="ccr-choose" data-value="a" disabled/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ccr-choose', value: 'a' } } : null) } });
  assert.match(m.state.html, /Authenticate before choosing a version\./);
  m.click('ccr-auth');
  assert.match(m.state.html, /Password fields decrypted for this decision/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'ccr-choose', value: 'both' } } : null) } });
  assert.match(m.state.html, /Both entries preserved separately\./);
  m.click('ccr-confirm');
  assert.match(m.state.html, /Conflict resolved atomically\./);
  m.click('ccr-fail');
  assert.match(m.state.html, /both encrypted versions remain recoverable/);
});

test('s-289 passkey explainer gates capability and avoids export promises', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-289'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-289');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Passkey availability explainer');
  assert.match(m.state.html, /Private keys are non-exportable; no recovery copy is promised/);
  assert.match(m.state.html, /OS authenticator, not Vaayvu, holds the private key/);
  m.click('pka-why');
  assert.match(m.state.html, /Capability-gated/);
  assert.match(m.state.html, /never pretends to be that authenticator/);
  m.click('pka-continue');
  assert.match(m.state.html, /Confirm with Touch ID in the system dialog/);
  assert.match(m.state.html, /Vaayvu receives only the signed assertion/);
  m.click('pka-password');
  assert.match(m.state.html, /passkey stays registered/);
});

test('s-290 passkey migration requires provider evidence and keeps source', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-290'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-290');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Passkey migration notice');
  assert.match(m.state.html, /Passkeys only · passwords and recovery codes are not converted/);
  assert.match(m.state.html, /Completion requires provider confirmation/);
  m.click('pkm-open');
  assert.match(m.state.html, /Vaayvu waits for provider evidence before showing success\./);
  m.click('pkm-complete');
  assert.match(m.state.html, /source credential is not deleted automatically/);
  m.click('pkm-cancel');
  assert.match(m.state.html, /nothing was converted or deleted/);
});

test('s-291 phishing warning blocks autofill and keeps trusted origin text', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-291'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://sync-credentials/s-291');
  assert.equal(m.dataset.onboardingPhase, 'p10');
  assert.equal(m.dataset.atlasCategory, 'sync-credentials');
  assert.equal(m.dataset.atlasPriority, 'trust');
  assert.equal(m.state.attrs['aria-label'], 'Credential phishing-site warning');
  assert.match(m.state.html, /Registrable domain differs/);
  assert.match(m.state.html, /No password was filled/);
  assert.match(m.state.html, /not proof the site is safe/);
  m.click('phw-identity');
  assert.match(m.state.html, /a page cannot rewrite it/);
  m.click('phw-cancel');
  assert.match(m.state.html, /saved password stays in the vault and was not inserted into this page/);
  m.click('phw-back');
  assert.match(m.state.html, /no credential was shared/);
});

test('s-292 hostname analysis shows both forms and never rewrites input', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-292'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-292');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Omnibox Unicode hostname analysis');
  assert.match(m.state.html, /Cyrillic “а”, not Latin “a”/);
  assert.match(m.state.html, /Latin \+ Cyrillic in one label/);
  assert.match(m.state.html, /Unicode 16 · IDNA 2008/);
  m.click('hst-details');
  assert.match(m.state.html, /not proof of malicious intent/);
  assert.match(m.state.html, /never changed silently/);
  m.click('hst-copy');
  assert.match(m.state.html, /without normalization/);
  m.click('hst-edit');
  assert.match(m.state.html, /destination unchanged/);
  assert.deepEqual(m.calls.copied, ['аccounts.example']);
});

test('s-293 lookalike review shows exact URL and cannot override engine block', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-293'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-293');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Lookalike URL review');
  assert.match(m.state.html, /URL was not sent to a remote lookup service/);
  assert.match(m.state.html, /accounts\.example · matched locally/);
  m.click('lkr-details');
  assert.match(m.state.html, /Suggested alternatives are never opened automatically/);
  m.click('lkr-continue');
  assert.match(m.state.html, /mandatory engine block takes precedence/);
  m.click('lkr-edit');
  assert.match(m.state.html, /destination is unchanged until you press Enter/);
});

test('s-294 local network prompt is scoped and discloses OS limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-294'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-294');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Local network access prompt');
  assert.match(m.state.html, /No subnet scan runs just to show this prompt/);
  assert.match(m.state.html, /OS firewall remains authoritative/);
  m.click('lna-scope');
  assert.match(m.state.html, /cannot grant system-wide firewall exemptions/);
  m.click('lna-allow');
  assert.match(m.state.html, /another origin must ask again/);
  m.click('lna-deny');
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-294'), true);
  m.click('lna-deny');
  assert.match(m.state.html, /denial is not stored as an allow/);
});

test('s-295 storage exception is scoped, expiring and revocable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-295'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-295');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Third-party cookie exception explainer');
  assert.match(m.state.html, /reading\.example/);
  assert.match(m.state.html, /player\.example · iframe/);
  assert.match(m.state.html, /3 days · then access ends automatically/);
  m.click('tce-grant');
  assert.match(m.state.html, /Other embedded origins remain partitioned/);
  assert.match(m.state.html, /until 30 Nov/);
  m.click('tce-revoke');
  assert.match(m.state.html, /global third-party restriction was never disabled/);
  m.click('tce-deny');
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-295'), true);
  m.click('tce-deny');
  assert.match(m.state.html, /Partitioning stays in place/);
});

test('s-296 private limits avoid invisibility claims and separate downloads', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-296'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-296');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Incognito limitations explainer');
  assert.match(m.state.html, /Websites, your network and your ISP can still see your traffic/);
  assert.match(m.state.html, /Files you download persist on disk, separately from private history/);
  assert.match(m.state.html, /no anonymity is claimed/);
  m.click('inc-perms');
  assert.match(m.state.html, /Persistent site grants do not carry over/);
  m.click('inc-open');
  assert.match(m.state.html, /Ephemeral profile in use/);
  m.click('inc-close');
  assert.match(m.state.html, /Ephemeral cookies and site data removed; downloaded files remain on disk\./);
});

test('s-297 page context consent is task-scoped and previews exact excerpt', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-297'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-297');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'User consent for AI page context');
  assert.match(m.state.html, /Nothing is sent until you authorize this exact source and processor/);
  assert.match(m.state.html, /Form values, passwords and hidden fields excluded/);
  assert.match(m.state.html, /new pages or origins need new consent/);
  m.click('apc-preview');
  assert.match(m.state.html, /teaches it a new shape/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'apc-decline' } } : null) } });
  assert.match(m.state.html, /No page text was sent/);
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-297'), true);
  m.click('apc-allow');
  assert.match(m.state.html, /Consent is not reused for other pages/);
});

test('s-298 source picker excludes unchecked and protected pages before dispatch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-298'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-298');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI source permission picker');
  assert.match(m.state.html, /Credential fields and protected browser pages are excluded automatically/);
  assert.match(m.state.html, /vaayvu:\/\/settings/);
  assert.match(m.state.html, /<span class="sx-badge is-warn">Protected<\/span>/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'asp-toggle', id: 's2' } } : null) } });
  assert.match(m.state.html, /2 sources selected\./);
  m.click('asp-inspect');
  assert.match(m.state.html, /Protected pages never contribute\./);
  m.click('asp-confirm');
  assert.match(m.state.html, /2 sources confirmed after origin revalidation/);
  m.click('asp-revalidate');
  assert.match(m.state.html, /origins revalidated before dispatch/);
});

test('s-299 redaction preview edits content, fixes digest and discards on cancel', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-299'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-299');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI personal-data redaction preview');
  assert.match(m.state.html, /suggestions, not a guarantee that every secret was found/);
  assert.match(m.state.html, /\[EMAIL\]/);
  assert.match(m.state.html, /The route starts past the cairn\./);
  m.click('rdp-remove');
  assert.doesNotMatch(m.state.html, /The route starts past the cairn\./);
  m.click('rdp-approve');
  assert.match(m.state.html, /sha256 0af3…71c/);
  assert.match(m.state.html, /Hidden source content cannot be appended after this point\./);
  m.click('rdp-cancel');
  assert.match(m.state.html, /provider received nothing/);
});

test('s-300 tool approval is bounded and resets on target change', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-300'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-300');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI tool action approval');
  assert.match(m.state.html, /A web page cannot approve this action/);
  assert.match(m.state.html, /Create one draft · no send/);
  m.click('tav-details');
  assert.match(m.state.html, /cannot send, delete or read other messages under this approval/);
  m.click('tav-approve');
  assert.match(m.state.html, /Approve this exact action\?/);
  m.click('tav-confirm');
  assert.match(m.state.html, /No other tool operation is allowed by this approval/);
  m.click('tav-target');
  assert.match(m.state.html, /approval reset and renewed review required/);
  assert.match(m.state.html, /mail\.other\.example · account changed/);
  m.click('tav-reject');
  assert.match(m.state.html, /External state is untouched/);
});

test('s-301 action receipt distinguishes unknown from failure and supports undo', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-301'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-301');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI action receipt verification');
  assert.match(m.state.html, /A planned or attempted action is not called completed/);
  assert.match(m.state.html, /Confirmed completed · draft dr-441/);
  m.click('arv-evidence');
  assert.match(m.state.html, /Receipt omits message body, addresses and credentials/);
  m.click('arv-unknown');
  assert.match(m.state.html, /Outcome unknown · provider did not confirm/);
  assert.match(m.state.html, /check drafts before retrying/);
  m.click('arv-fail');
  assert.match(m.state.html, /Confirmed failure · no draft created/);
  m.click('arv-undo');
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-301'), true);
  m.click('arv-undo');
  assert.match(m.state.html, /undo action itself is recorded as a separate receipt/);
});

test('s-302 injection alert stops external action and analyzes content only', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-302'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-302');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI prompt injection risk alert');
  assert.match(m.state.html, /risk signal, not proof of a successful attack/);
  assert.match(m.state.html, /Page text cannot expand the assistant’s permissions/);
  m.click('pia-scope');
  assert.match(m.state.html, /Only the quoted comment text is flagged/);
  m.click('pia-content');
  assert.match(m.state.html, /rejected external action remains unapproved/);
  m.click('pia-stop');
  assert.match(m.state.html, /pending email action was cancelled/);
});

test('s-303 provider fallback retries honestly and needs boundary review to switch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-303'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-303');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI provider outage fallback');
  assert.match(m.state.html, /Nothing is rerouted automatically/);
  assert.match(m.state.html, /Transmitted · remote outcome unknown/);
  assert.match(m.state.html, /idempotency key prevents duplicate tool actions/);
  m.click('pof-switch');
  assert.match(m.state.html, /Review the alternative boundary first\./);
  m.click('pof-boundary');
  assert.match(m.state.html, /no page text is sent to another provider/);
  m.click('pof-switch');
  assert.match(m.state.html, /Switched to on-device processing; excerpt stays local\./);
  m.click('pof-retry');
  assert.match(m.state.html, /unknown outcome stands/);
});

test('s-304 cost controls separate estimate from billing and keep stale usage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-304'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-304');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI cost controls');
  assert.match(m.state.html, /Estimate, not billed amount/);
  assert.match(m.state.html, /Client-side limits pause local requests/);
  m.click('ctl-set');
  assert.match(m.state.html, /Enter a limit between 1 and 1000 thousand tokens\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ctl-limit', value: '80' } });
  m.click('ctl-set');
  assert.match(m.state.html, /Local limit set to 80k tokens\./);
  m.click('ctl-estimate');
  assert.match(m.state.html, /This is an estimate, not the billed amount\./);
  m.click('ctl-fail');
  assert.match(m.state.html, /Usage fetch failed; last known 68,000 retained\./);
  assert.match(m.state.html, /Last successful fetch · live usage unavailable/);
  m.click('ctl-pause');
  assert.match(m.state.html, /Browsing is unaffected/);
});

test('s-305 on-device model failure keeps browsing and offers smaller model', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-305'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-305');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI on-device memory warning');
  assert.match(m.state.html, /Measured available memory: 2\.8 GB/);
  assert.match(m.state.html, /no performance promise is made for unmeasured devices/);
  assert.match(m.state.html, /Requires separate page-context consent/);
  m.click('lmw-load');
  assert.match(m.state.html, /Model failed to load/);
  assert.match(m.state.html, /Browsing and the active call continue unaffected\./);
  m.click('lmw-small');
  assert.match(m.state.html, /Smaller model selected \(1\.9 GB\)\./);
  m.click('lmw-load');
  assert.match(m.state.html, /Local 3B loaded within the measured budget\./);
  m.click('lmw-unload');
  assert.match(m.state.html, /tabs and downloads were not affected\./);
});

test('s-306 history deletion separates local removal from provider erasure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-306'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://ai-trust/s-306');
  assert.equal(m.dataset.onboardingPhase, 'p13');
  assert.equal(m.dataset.atlasCategory, 'ai-trust');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'AI history deletion audit');
  assert.match(m.state.html, /Deleting locally does not erase a provider copy/);
  assert.match(m.state.html, /provider copy exists/);
  m.click('hda-preview');
  assert.match(m.state.html, /Audit metadata \(IDs, timestamps, outcome\) is retained/);
  m.click('hda-delete');
  assert.match(m.state.html, /Delete selected history\?/);
  m.click('hda-confirm');
  assert.match(m.state.html, /Local conversations/);
  assert.match(m.state.html, /pending acknowledgment/);
  assert.match(m.state.html, /conversation content removed/);
  m.click('hda-fail');
  assert.match(m.state.html, /request retained for retry/);
});

test('s-307 reader fallback keeps original page, position and source', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-307'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-307');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Reader extraction failure fallback');
  assert.match(m.state.html, /no replacement text was generated/);
  assert.match(m.state.html, /42% preserved locally/);
  assert.match(m.state.html, /data-onboard="rdf-options" disabled/);
  m.click('rdf-retry');
  assert.match(m.state.html, /scroll position and form state were kept/);
  m.click('rdf-page');
  assert.match(m.state.html, /scroll and form state kept/);
});

test('s-308 PDF signature stays indeterminate and warns before edits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-308'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-308');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'PDF cryptographic signature limitations');
  assert.match(m.state.html, /A drawn signature image is not a cryptographic signature/);
  assert.match(m.state.html, /Unsupported algorithm path · status indeterminate/);
  assert.match(m.state.html, /trust anchor unknown/);
  m.click('psig-detail');
  assert.match(m.state.html, /does not show “valid” in that case/);
  m.click('psig-edit');
  assert.match(m.state.html, /Editing invalidates the signature/);
  m.click('psig-save');
  assert.match(m.state.html, /original remains untouched/);
});

test('s-309 PDF unsaved changes never discard silently and keep work on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-309'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-309');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'PDF data loss confirmation');
  assert.match(m.state.html, /Closing does not discard them silently/);
  assert.match(m.state.html, /report-signed\.pdf already exists/);
  m.click('pdl-save');
  assert.match(m.state.html, /report-annotated\.pdf written; original report\.pdf unchanged/);
  m.click('pdl-fail');
  assert.match(m.state.html, /annotations and form edits remain in memory/);
  m.click('pdl-discard');
  assert.match(m.state.html, /Discard unsaved changes\?/);
  m.click('pdl-cancel');
  assert.match(m.state.html, /Close cancelled; continuing to edit\./);
});

test('s-310 active call warning prevents silent suspension and stops devices on end', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-310'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-310');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'WebRTC session preservation warning');
  assert.match(m.state.html, /will not silently interrupt the call/);
  assert.match(m.state.html, /Rejoin may be possible but is not guaranteed/);
  m.click('rtc-end');
  assert.match(m.state.html, /Camera and microphone sessions stopped and indicators cleared/);
  m.click('rtc-keep');
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-310'), true);
  m.click('rtc-keep');
  assert.match(m.state.html, /Suspension skipped; devices and recording continue\./);
  m.click('rtc-cancel');
  assert.match(m.state.html, /Suspension cancelled; call still active\./);
});

test('s-311 screen share indicator cannot be forged and stops clearly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-311'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-311');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Screen-share permanent indicator');
  assert.match(m.state.html, /Page content cannot hide or forge it/);
  assert.match(m.state.html, /Entire screen · Display 1/);
  m.click('ssi-scope');
  assert.match(m.state.html, /whole display is captured, including other windows/);
  m.click('ssi-change');
  assert.match(m.state.html, /new scope will be shown before sharing resumes/);
  m.click('ssi-cancel-change');
  assert.match(m.state.html, /Current capture source kept\./);
  m.click('ssi-stop');
  assert.match(m.state.html, /trusted indicator is hidden and capture has ended/);
});

test('s-312 snapshots exclude private tabs and clearing is explicit', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-312'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-312');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Tab snapshot data sensitivity notice');
  assert.match(m.state.html, /Private tabs never create persistent previews/);
  assert.match(m.state.html, /protected pages are skipped in the snapshot/);
  m.click('tss-preview');
  assert.match(m.state.html, /Suppressed fields appear as blank regions/);
  m.click('tss-disable');
  assert.match(m.state.html, /Saved thumbnails remain until you clear them\./);
  m.click('tss-clear');
  assert.match(m.state.html, /Clear saved thumbnails\?/);
  m.click('tss-clear-confirm');
  assert.match(m.state.html, /Existing previews removed; capture settings unchanged\./);
});

test('s-313 restore conflict protects live form state and private data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-313'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-313');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Tab restore conflict resolver');
  assert.match(m.state.html, /Restoring never overwrites live unsaved form state/);
  assert.match(m.state.html, /Absent from restore candidates/);
  m.click('trc-duplicates');
  assert.match(m.state.html, /without replacing your current ones/);
  m.click('trc-merge');
  assert.match(m.state.html, /Live unsaved form input kept; duplicates grouped/);
  m.click('trc-new');
  assert.match(m.state.html, /Live session untouched, including the unsaved Booking form\./);
  m.click('trc-cancel');
  assert.match(m.state.html, /Restore cancelled; current session unchanged\./);
});

test('s-314 discard exemptions are scoped, expiring and removal keeps tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-314'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-314');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Tab discard exemption list');
  assert.match(m.state.html, /cannot promise survival if the OS terminates the process/);
  assert.match(m.state.html, /Call tab · expires in 2 hours/);
  m.click('tde-inspect');
  assert.match(m.state.html, /Unsaved editor state is protected where the page exposes it; otherwise it is not detectable/);
  m.click('tde-add');
  assert.match(m.state.html, /Exemption added for reading\.example \(2 hours\)\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'tde-remove', id: 'x1' } } : null) } });
  assert.match(m.state.html, /Exemption removed; tab stays open\./);
});

test('s-315 memory profiler shows unavailable attribution and no fake savings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-315'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-315');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Tab memory profiler');
  assert.match(m.state.html, /Shared renderer memory is counted once, not once per tab/);
  assert.match(m.state.html, /Per-tab attribution unavailable on this engine build/);
  m.click('tmp-detail');
  assert.match(m.state.html, /Measurement is sampled, not continuous/);
  m.click('tmp-sample');
  assert.match(m.state.html, /Comparison does not double-count 92 MB/);
  m.click('tmp-sleep');
  assert.match(m.state.html, /no RAM-saved figure reported because shared memory is not attributable/);
});

test('s-316 background activity uses real signals and protects uploads', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-316'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-316');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Background activity detector');
  assert.match(m.state.html, /A quiet interval does not prove a tab is permanently inactive/);
  assert.match(m.state.html, /Upload 42% · protected workload lease/);
  m.click('bad-detail');
  assert.match(m.state.html, /CPU is a sample, not a guarantee of future idle/);
  m.click('bad-mute');
  assert.match(m.state.html, /Audio playing · muted/);
  m.click('bad-throttle');
  assert.match(m.state.html, /Uploads and calls are exempt from throttling/);
  m.click('bad-close');
  assert.match(m.state.html, /notes\.example closed through the ordinary close action/);
});

test('s-317 battery exceptions never weaken isolation and restore is scoped', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-317'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-317');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Battery saver exclusion list');
  assert.match(m.state.html, /Engine isolation and certificate checks stay enabled/);
  assert.match(m.state.html, /38% · on battery/);
  m.click('bse-review');
  assert.match(m.state.html, /An active call is never interrupted by the battery policy alone/);
  m.click('bse-add');
  assert.match(m.state.html, /Exception added for meet\.example \(1 hour\)\./);
  m.click('bse-restore');
  assert.match(m.state.html, /Restore defaults\?/);
  m.click('bse-restore-confirm');
  assert.match(m.state.html, /Battery defaults restored; engine isolation untouched\./);
});

test('s-318 benchmark runner isolates fixtures and excludes cancelled runs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-318'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-318');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark scene runner');
  assert.match(m.state.html, /Real credentials and private profiles are excluded/);
  assert.match(m.state.html, /Default settings · 5 repetitions/);
  m.click('brs-cancel');
  assert.match(m.state.html, /not a passing sample/);
  m.click('brs-run');
  assert.match(m.state.html, /Repetition 3 of 5 · cancel is safe/);
  m.click('brs-save');
  assert.match(m.state.html, /Missing metric: GPU frame time \(not reported as zero\)/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'brs-scene', value: 'wind' } } : null) } });
  assert.match(m.state.html, /Wind atlas scroll · v2\.1/);
});

test('s-319 benchmark comparison excludes incomparable runs and avoids significance claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-319'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-319');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark baseline comparison');
  assert.match(m.state.html, /no significance is claimed without a stated method/);
  assert.match(m.state.html, /r-101 · excluded/);
  assert.match(m.state.html, /fastest single run is not used as the headline/);
  m.click('bcp-excluded');
  assert.match(m.state.html, /different scene version and a 4-sample run/);
  m.click('bcp-export');
  assert.match(m.state.html, /Declared scope: r-118 vs r-124/);
});

test('s-320 reproducibility keeps gaps explicit and redacts export', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-320'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-320');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark reproducibility report');
  assert.match(m.state.html, /sha256 8c41…2d9e/);
  assert.match(m.state.html, /4 of 5 trace files present · 1 missing/);
  m.click('repb-detail');
  assert.match(m.state.html, /recorded as an environment gap, not replaced with an estimate/);
  m.click('repb-gap');
  assert.match(m.state.html, /Trace 5 unavailable due to sampler contention/);
  m.click('repb-export');
  assert.match(m.state.html, /URLs and tokens redacted/);
});

test('s-321 device list requires run evidence and minimizes exported identifiers', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-321'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-321');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark device list');
  assert.match(m.state.html, /Listed is not tested/);
  assert.match(m.state.html, /No run evidence/);
  assert.match(m.state.html, /Deployment not configured/);
  m.click('bdl-detail');
  assert.match(m.state.html, /No identifier is invented for missing devices/);
  m.click('bdl-register');
  assert.match(m.state.html, /Linux x64 · deployment pending · marked unverified/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bdl-toggle', id: 'ipad' } } : null) } });
  assert.match(m.state.html, /2 targets selected\./);
  m.click('bdl-export');
  assert.match(m.state.html, /Minimized device list exported\./);
});

test('s-322 contrast inspector reports rendered ratios and records findings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-322'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-322');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'High contrast surface inspector');
  assert.match(m.state.html, /visual preview alone is not full accessibility conformance/);
  assert.match(m.state.html, /3\.1:1 · fails AA small text/);
  assert.match(m.state.html, /not color alone/);
  m.click('hcs-toggle');
  assert.match(m.state.html, /12\.6:1 · passes AA/);
  assert.match(m.state.html, /9\.1:1 against adjacent surfaces/);
  m.click('hcs-record');
  assert.match(m.state.html, /Sidebar secondary label 3\.1:1 at 13 px/);
  assert.match(m.state.html, /Focus order and disabled semantics remain perceivable/);
});

test('s-323 transparency inspector keeps legibility and layout stable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-323'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content-performance/s-323');
  assert.equal(m.dataset.onboardingPhase, 'p14');
  assert.equal(m.dataset.atlasCategory, 'content-performance');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Reduced transparency theme inspector');
  assert.match(m.state.html, /Material changes never reset profile data or tab placement/);
  assert.match(m.state.html, /Reduce transparency · available and honored when set/);
  assert.match(m.state.html, /origin text and form labels stay legible/);
  m.click('rtt-compare');
  assert.match(m.state.html, /Both keep the same controls, focus order and labels\./);
  m.click('rtt-apply');
  assert.match(m.state.html, /Profile data, tabs and placement are unchanged\./);
  assert.match(m.state.html, /Solid surface · #ffffff at 100%/);
});

test('s-324 route explorer traverses controls and restores focus after modal', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-324'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-324');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Screen reader route explorer');
  assert.match(m.state.html, /Every essential route must be reachable without pointer input/);
  assert.match(m.state.html, /“Back”/);
  m.click('sre-next');
  assert.match(m.state.html, /Focus advanced in reading order\./);
  assert.match(m.state.html, /▶ “Address and search”/);
  m.click('sre-modal');
  assert.match(m.state.html, /Focus stays inside the dialog until it closes/);
  m.click('sre-close');
  assert.match(m.state.html, /focus returned to the trigger/);
  m.click('sre-findings');
  assert.match(m.state.html, /live region announcements are not repeated on a timer/);
});

test('s-325 shortcut conflicts resolve explicitly and protect OS chords', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-325'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-325');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Keyboard shortcut conflict resolver');
  assert.match(m.state.html, /never assigned to two actions silently/);
  assert.match(m.state.html, /⌘Space · reserved by the OS/);
  m.click('kcr-reserved');
  assert.match(m.state.html, /belongs to the OS and cannot be assigned here/);
  m.click('kcr-resolve');
  assert.match(m.state.html, /Open AI launcher moved to ⇧⌘K; Clear history keeps ⌘K/);
  assert.match(m.state.html, /Text-entry fields never trigger either destructive command while typing/);
  m.click('kcr-reset');
  assert.match(m.state.html, /Selected shortcut defaults restored\./);
});

test('s-326 foldable posture preserves session and keeps hinge clear', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-326'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-326');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Foldable posture transition');
  assert.match(m.state.html, /without recreating the browsing session or losing input/);
  assert.match(m.state.html, /Booking form input preserved/);
  m.click('fpt-toggle');
  assert.match(m.state.html, /Vertical hinge between panes · essential controls avoid it/);
  assert.match(m.state.html, /Unfolded · session and input preserved\./);
  m.click('fpt-prefs');
  assert.match(m.state.html, /compact rail is used with the same controls/);
});

test('s-327 iPad restore excludes private scenes and avoids duplicate ownership', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-327'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-327');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'iPad multiple-window restore');
  assert.match(m.state.html, /Private scenes never keep durable snapshots/);
  assert.match(m.state.html, /Excluded · no durable snapshot/);
  m.click('ipr-dup');
  assert.match(m.state.html, /keeps one owner per tab and groups the remainder rather than duplicating tabs/);
  m.click('ipr-restore');
  assert.match(m.state.html, /Restoring 2 regular windows with one owner per tab\./);
  m.click('ipr-new');
  assert.match(m.state.html, /existing windows unchanged/);
});

test('s-328 Windows Snap inspector keeps Windows unverified from Mac runs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-328'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-328');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Windows Snap compatibility inspector');
  assert.match(m.state.html, /No Windows completion is inferred from Mac testing/);
  assert.match(m.state.html, /Windows Snap APIs unavailable on this Mac build/);
  m.click('wsc-run');
  assert.match(m.state.html, /This is Mac-lane evidence only\./);
  m.click('wsc-detail');
  assert.match(m.state.html, /Fractional scaling did not hide controls or shift hit testing\./);
  m.click('wsc-save');
  assert.match(m.state.html, /Windows remains unverified until a real target run exists/);
});

test('s-329 Linux compositor records limits and requires a real target run', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-329'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-329');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Linux compositor compatibility inspector');
  assert.match(m.state.html, /Linux results require a real target run and remain a later lane/);
  assert.match(m.state.html, /Server-side decorations unsupported/);
  assert.match(m.state.html, /No Linux device attached to this session/);
  assert.match(m.state.html, /data-onboard="lci-export" disabled/);
  m.click('lci-limits');
  assert.match(m.state.html, /Wayland lacks global window positioning/);
  m.click('lci-record');
  assert.match(m.state.html, /recorded as unsupported; no fabricated pass/);
});

test('s-330 upstream readiness blocks candidate until merge and checks pass', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-330'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-330');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Upstream engine patch readiness');
  assert.match(m.state.html, /Security readiness is separate from feature completeness/);
  assert.match(m.state.html, /1 unresolved merge conflict/);
  m.click('upr-approve');
  assert.match(m.state.html, /Candidate blocked until merge and required checks pass\./);
  m.click('upr-checks');
  assert.match(m.state.html, /Resolve the merge conflict before running checks\./);
  m.click('upr-merge');
  m.click('upr-checks');
  assert.match(m.state.html, /Windows\/Linux gaps recorded/);
  m.click('upr-approve');
  assert.match(m.state.html, /Approved only after merge resolution and required checks/);
  m.click('upr-details');
  assert.match(m.state.html, /does not fabricate device validation/);
});

test('s-331 release rollout pauses and rolls back without security loss', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-331'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://quality-release/s-331');
  assert.equal(m.dataset.onboardingPhase, 'p16');
  assert.equal(m.dataset.atlasCategory, 'quality-release');
  assert.equal(m.dataset.atlasPriority, 'advanced');
  assert.equal(m.state.attrs['aria-label'], 'Release rollout and rollback status');
  assert.match(m.state.html, /Signed manifest verified for this platform/);
  assert.match(m.state.html, /0\.4% sessions · baseline 0\.2%/);
  m.click('rrs-pause');
  assert.match(m.state.html, /Rollout paused at 25%\./);
  m.click('rrs-review');
  assert.match(m.state.html, /does not disable browser security/);
  m.click('rrs-rollback');
  assert.match(m.state.html, /Authorize rollback to 0\.0\.23\?/);
  m.click('rrs-confirm');
  assert.match(m.state.html, /audit reason is recorded/);
});

test('s-332 provider choice saves or skips to the default', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-332'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-332');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'onboarding');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Provider choice onboarding');
  assert.match(m.state.html, /Default · no account required/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pco-pick', id: 'brave' } } : null) } });
  assert.match(m.state.html, /Selected brave\./);
  m.click('pco-save');
  assert.match(m.state.html, /Provider set to brave; continuing to S-051\./);
  m.click('pco-skip');
  assert.match(m.state.html, /default DuckDuckGo kept/);
});

test('s-333 provider settings overview routes defaults and consent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-333'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-333');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Search provider settings overview');
  assert.match(m.state.html, /Regular default/);
  assert.match(m.state.html, /no regular history or autocomplete/);
  m.click('sps-regular');
  assert.match(m.state.html, /S-334/);
  m.click('sps-private');
  assert.match(m.state.html, /S-335/);
  m.click('sps-consent');
  assert.match(m.state.html, /typing may be sent to the provider/);
  m.click('sps-add');
  assert.match(m.state.html, /S-336/);
});

test('s-334 regular provider picker saves or cancels without losing previous', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-334'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-334');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Regular default provider picker');
  assert.match(m.state.html, /DuckDuckGo/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'rpp-pick', id: 'brave' } } : null) } });
  assert.match(m.state.html, /Selected brave\./);
  m.click('rpp-save');
  assert.match(m.state.html, /Regular default saved as brave; returning to S-333\./);
  m.click('rpp-cancel');
  assert.match(m.state.html, /Cancelled; previous regular default kept\./);
});

test('s-335 private provider picker states origin limits and cancels safely', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-335'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-335');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Private default provider picker');
  assert.match(m.state.html, /Regular history and autocomplete are not used as suggestions/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pvp-pick', id: 'brave' } } : null) } });
  assert.match(m.state.html, /Selected brave for private windows\./);
  m.click('pvp-save');
  assert.match(m.state.html, /Private default saved as brave; returning to S-333\./);
  m.click('pvp-cancel');
  assert.match(m.state.html, /previous private default kept/);
});

test('s-336 custom provider validates HTTPS template and retains input', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-336'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-336');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Add custom search provider');
  m.click('acp-save');
  assert.match(m.state.html, /Name is required\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acp-name', value: 'Kagi' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acp-url', value: 'http://kagi.com?q=%s' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acp-keyword', value: 'kagi' } });
  m.click('acp-save');
  assert.match(m.state.html, /HTTPS URL required; error details are in S-338\./);
  assert.match(m.state.html, /value="Kagi"/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acp-url', value: 'https://kagi.com/search?q=test' } });
  m.click('acp-test');
  assert.match(m.state.html, /Invalid template; error details are in S-338\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-acp-url', value: 'https://kagi.com/search?q=%s' } });
  m.click('acp-test');
  assert.match(m.state.html, /Test passed over HTTPS\./);
  m.click('acp-save');
  assert.match(m.state.html, /Provider Kagi added\./);
});

test('s-337 edit provider validates and deletes only after confirmation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-337'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-337');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'settings');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Edit custom search provider');
  assert.match(m.state.html, /value="Kagi"/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ecp-url', value: 'http://kagi.com?q=%s' } });
  m.click('ecp-save');
  assert.match(m.state.html, /HTTPS template with %s is required\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ecp-url', value: 'https://kagi.com/search?q=%s' } });
  m.click('ecp-save');
  assert.match(m.state.html, /Provider updated\./);
  m.click('ecp-delete');
  assert.match(m.state.html, /Delete this provider\?/);
  m.click('ecp-cancel');
  assert.match(m.state.html, /Delete cancelled; provider kept\./);
  m.click('ecp-delete');
  m.click('ecp-delete-confirm');
  assert.match(m.state.html, /default providers were not changed/);
});

test('s-338 provider error retains draft and gives line-specific reasons', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-338'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-338');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'error');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Invalid search provider error');
  assert.match(m.state.html, /Draft retained/);
  assert.match(m.state.html, /Only HTTPS templates are accepted\./);
  assert.match(m.state.html, /“google” is already used by a built-in provider\./);
  m.click('ispe-fix');
  assert.match(m.state.html, /Returning to S-336 with the draft retained\./);
});

test('s-339 suggestion consent explains remote typing and saves choice', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-339'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-339');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'permissions');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Remote search suggestions consent');
  assert.match(m.state.html, /characters you type in the address bar can be sent/);
  assert.match(m.state.html, /suggestions stay local/);
  m.click('rsc-toggle');
  assert.match(m.state.html, /partial queries may leave the device/);
  m.click('rsc-save');
  assert.match(m.state.html, /Consent saved; returning to S-333\./);
  m.click('rsc-cancel');
  assert.match(m.state.html, /Cancelled; previous consent kept\./);
});

test('s-340 search loading classifies query and navigates in one tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-340'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-340');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'navigation');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Search execution loading');
  assert.match(m.state.html, /classified as search, not a URL/);
  assert.match(m.state.html, /no duplicate tab will be created/);
  m.click('sxl-go');
  assert.match(m.state.html, /One tab navigates to the results page \(S-097\)/);
  m.click('sxl-timeout');
  assert.match(m.state.html, /DNS or timeout failure · recovery options in S-341/);
  m.click('sxl-cancel');
  assert.match(m.state.html, /Cancelled; tab unchanged\./);
});

test('s-341 provider recovery keeps query and never switches silently', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-341'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-341');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'error');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Provider unavailable recovery');
  assert.match(m.state.html, /no provider was switched automatically/);
  assert.match(m.state.html, /“ridge wind survey” · retained/);
  m.click('pur-retry');
  assert.match(m.state.html, /still unreachable/);
  m.click('pur-change');
  assert.match(m.state.html, /S-342/);
});

test('s-342 provider switcher applies to one query only', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-342'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-342');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'navigation');
  assert.equal(m.dataset.atlasPriority, 'next');
  assert.equal(m.state.attrs['aria-label'], 'Search provider switcher quick action');
  assert.match(m.state.html, /Applies to this query only; the saved default is unchanged/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'spq-pick', id: 'google' } } : null) } });
  assert.match(m.state.html, /Selected google for this query\./);
  m.click('spq-run');
  assert.match(m.state.html, /sent to google for this search only; the default provider was not changed/);
  m.click('spq-cancel');
  assert.match(m.state.html, /selection kept for the recovery screen/);
});

test('s-343 private search uses local suggestions and no regular history', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-343'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/s-343');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'private');
  assert.equal(m.dataset.atlasPriority, 'next');
  assert.equal(m.state.attrs['aria-label'], 'Private search no-leak state');
  assert.match(m.state.html, /Suggestions default to local-only/);
  assert.match(m.state.html, /Not read, not written/);
  m.click('prs-start');
  assert.match(m.state.html, /No regular history was read/);
  assert.match(m.state.html, /ephemeral session \(S-340\)/);
});

test('s-344 blocked domains validate bare hosts and block partial saves', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-344'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-344');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Custom blocked domains editor');
  assert.match(m.state.html, /never badexample\.org/);
  m.click('cbd-preview');
  assert.match(m.state.html, /ads\.example · tracker\.example/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-cbd-text', value: 'ads.example\nhttps://bad.example/path' } });
  m.click('cbd-save');
  assert.match(m.state.html, /Save blocked: 1 invalid line\(s\); previous rules kept\./);
  assert.match(m.state.html, /URLs are not accepted; enter a bare host\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-cbd-text', value: 'Example.ORG.\nexample.org\nbadexample.org' } });
  m.click('cbd-save');
  assert.match(m.state.html, /Saved 2 domains\./);
  m.click('cbd-cancel');
  assert.match(m.state.html, /previous generation unchanged/);
});

test('s-345 domain errors are line-specific and keep the draft', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-345'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-345');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Domain validation errors');
  assert.match(m.state.html, /No partial application/);
  assert.match(m.state.html, /Wildcard syntax is not accepted/);
  assert.match(m.state.html, /Public suffix cannot be blocked as a whole/);
  m.click('dve-fix');
  assert.match(m.state.html, /Returning to S-344 with the draft retained\./);
});

test('s-346 rule generation stays on last good until acknowledged install', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-346'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-346');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Applying protection rules');
  assert.match(m.state.html, /last good generation \(3\) stays effective/);
  m.click('apr-start');
  assert.match(m.state.html, /Compiling generation 4/);
  m.click('apr-next');
  assert.match(m.state.html, /Signature schema and fixture manifest verified\./);
  m.click('apr-fail');
  assert.match(m.state.html, /generation 3 remains effective/);
  m.click('apr-late');
  assert.match(m.state.html, /Late acknowledgment for an older attempt ignored/);
  m.click('apr-start');
  m.click('apr-next');
  m.click('apr-next');
  m.click('apr-next');
  assert.match(m.state.html, /Generation 4 acknowledged and promoted\./);
  assert.match(m.state.html, /Generation 4 active/);
});

test('s-347 protection failure keeps last rules and redacts diagnostics', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-347'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-347');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Protection update failure');
  assert.match(m.state.html, /never refreshes the update timestamp/);
  assert.match(m.state.html, /Yesterday, 18:20 · generation 3/);
  m.click('puf-retry');
  assert.match(m.state.html, /last success time is unchanged/);
  m.click('puf-details');
  assert.match(m.state.html, /URL paths and query values are redacted/);
});

test('s-348 site pauses are exact-host and never pause malware blocks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-348'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-348');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Site pause manager');
  assert.match(m.state.html, /Malware and custom domain blocks always stay active/);
  assert.match(m.state.html, /reading\.example/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'spl-remove', id: 'p1' } } : null) } });
  assert.match(m.state.html, /reading\.example resumed; applying new generation \(S-346\)\./);
  assert.match(m.state.html, /Malware and scam blocklist<\/strong><\/span><span class="sx-badge">Active/);
});

test('s-349 blocked page is trusted local and names the matched rule', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-349'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-349');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Custom domain blocked page');
  assert.match(m.state.html, /trusted local page rendered by Vaayvu, not by the blocked site/);
  assert.match(m.state.html, /Custom blocked domain · tracker\.example/);
  assert.match(m.state.html, /badexample\.org unaffected/);
  m.click('cdp-manage');
  assert.match(m.state.html, /Opening blocked-domain editor \(S-344\)\./);
  m.click('cdp-back');
  assert.match(m.state.html, /previous safe page/);
});

test('s-350 Rasha collection details show provenance, version and evidence', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-350'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-350');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Rasha rule collection details');
  assert.match(m.state.html, /no external blocking list is imported/);
  assert.match(m.state.html, /2026\.11\.3 · generation 3/);
  m.click('rcd-evidence');
  assert.match(m.state.html, /Unsupported semantics are listed rather than approximated/);
  m.click('rcd-research');
  assert.match(m.state.html, /S-396/);
});

test('s-351 blocking diagnostics redact hosts and refuse invented counters', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-351'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-351');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Local blocking diagnostics');
  assert.match(m.state.html, /shown as unavailable, not invented/);
  assert.match(m.state.html, /a\*\*\*\.ads\.example/);
  m.click('lbd-detail');
  assert.match(m.state.html, /Unknown attribution is labelled unknown rather than counted as blocked/);
  m.click('lbd-back');
  assert.match(m.state.html, /Returning to site protection \(S-166\)\./);
});

test('s-352 blocker reset preserves custom domains and malware protection', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-352'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-352');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Reset ad blocker confirmation');
  assert.match(m.state.html, /Custom domains and site pauses are preserved unless you explicitly include them/);
  assert.match(m.state.html, /Malware and scam protection<\/strong><small>Always retained/);
  m.click('rab-reset');
  assert.match(m.state.html, /Reset selected scope\?/);
  m.click('rab-confirm');
  assert.match(m.state.html, /Only the selected scope changed; applying generation through S-346\./);
});

test('s-353 unsaved blocker draft requires explicit discard', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-353'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://settings/ad-blocker/s-353');
  assert.equal(m.dataset.onboardingPhase, 'p08');
  assert.equal(m.dataset.atlasCategory, 'security-privacy');
  assert.equal(m.dataset.atlasPriority, 'core');
  assert.equal(m.state.attrs['aria-label'], 'Discard unsaved blocker changes');
  assert.match(m.state.html, /Closing does not silently save or discard these lines/);
  m.click('duc-continue');
  assert.match(m.state.html, /Continuing with all typed lines preserved\./);
  m.click('duc-discard');
  assert.match(m.state.html, /Discard this draft\?/);
  m.click('duc-cancel');
  assert.match(m.state.html, /Discard cancelled; draft kept\./);
  m.click('duc-discard');
  m.click('duc-discard-confirm');
  assert.match(m.state.html, /Draft discarded; active generation unchanged\./);
});

test('s-354 resource budget separates target, measurement and shared memory', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-354'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/1');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Resource budget center');
  assert.match(m.state.html, /not a guaranteed allocation/);
  assert.match(m.state.html, /1\.2 GB shared \(counted once\)/);
  assert.match(m.state.html, /do not each report its full memory/);
  m.click('rbu-refresh');
  assert.match(m.state.html, /no extrapolated GPU figure was added/);
  m.click('rbu-edit');
  assert.match(m.state.html, /S-355/);
  m.click('rbu-timeline');
  assert.match(m.state.html, /S-356/);
});

test('s-355 memory budget rejects hard below soft and keeps prior policy', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-355'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/2');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Device memory budget editor');
  assert.match(m.state.html, /not guarantees/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mbe-hard', value: '4' } });
  m.click('mbe-save');
  assert.match(m.state.html, /Hard threshold must be greater than soft; previous policy kept\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mbe-hard', value: '10' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mbe-reserve', value: '7' } });
  m.click('mbe-save');
  assert.match(m.state.html, /Reserve must be below the soft threshold; previous policy kept\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-mbe-reserve', value: '2' } });
  m.click('mbe-preview');
  assert.match(m.state.html, /nothing committed/);
  m.click('mbe-save');
  assert.match(m.state.html, /Policy committed atomically \(soft 6 GB, hard 10 GB\)\./);
});

test('s-356 pressure timeline applies hysteresis and never fakes PSS', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-356'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/3');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Memory pressure timeline');
  assert.match(m.state.html, /recovery dwell and hysteresis/);
  assert.match(m.state.html, /not replaced with an estimate/);
  m.click('mpt-spikes');
  assert.match(m.state.html, /no tab was discarded/);
  m.click('mpt-cycles');
  assert.match(m.state.html, /transient GC spike is not labelled a leak/);
});

test('s-357 workload leases preserve unknown work and release ended activity', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-357'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/4');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Critical workload leases');
  assert.match(m.state.html, /Unknown critical state favors preservation/);
  assert.match(m.state.html, /Undetectable work is kept rather than force-discarded/);
  m.click('cwl-endcall');
  assert.match(m.state.html, /Call lease released; other leases unaffected\./);
  m.click('cwl-close');
  assert.match(m.state.html, /only its lease invalidated/);
  m.click('cwl-pin');
  assert.match(m.state.html, /Pin removed; only unsaved-edit detection protects the form\./);
});

test('s-358 reclaim preview protects pinned form and never weakens isolation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-358'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/5');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reclaim impact preview');
  assert.match(m.state.html, /Sandbox and site isolation are never weakened/);
  assert.match(m.state.html, /bank\.example · pinned form<\/strong><small>320 MB · excluded despite size/);
  assert.match(m.state.html, /Private tab/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'rcp-toggle', key: 't2' } } : null) } });
  assert.match(m.state.html, /420 MB · estimate from current samples/);
  m.click('rcp-preview-toggle');
  assert.match(m.state.html, /same workspace is not repeatedly chosen while equal candidates exist/);
  m.click('rcp-apply');
  assert.match(m.state.html, /Protected and private tabs untouched\./);
});

test('s-359 resource recovery keeps URL, restores policy and admits limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-359'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://resource/6');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'adaptive-resource-governance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Resource recovery state');
  assert.match(m.state.html, /Page JavaScript state cannot be claimed after an OS kill/);
  assert.match(m.state.html, /tab-8821 · URL ridge\.example\/wind/);
  m.click('rsv-resume');
  assert.match(m.state.html, /JavaScript state not claimed/);
  m.click('rsv-disk');
  assert.match(m.state.html, /last known-good thresholds were restored\. No silent reset\./);
});

test('s-360 lifecycle states are typed and prioritize the selected tab', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-360'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/1');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Lifecycle policy details');
  assert.match(m.state.html, /Frozen is never shown once the renderer has been destroyed/);
  assert.match(m.state.html, /obsolete resume work cancelled/);
  m.click('lpd-next');
  assert.match(m.state.html, /Transitioned to Throttled\./);
  m.click('lpd-next');
  assert.match(m.state.html, /Transitioned to Frozen\./);
  m.click('lpd-next');
  assert.match(m.state.html, /Transitioned to Discarded\./);
});

test('s-361 preservation rules expose scope, expiry and eviction limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-361'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/2');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tab preservation rules');
  assert.match(m.state.html, /Expiry removes the override automatically/);
  assert.match(m.state.html, /partially uploaded file is not treated as resumable without range evidence/);
  m.click('tpr-close');
  assert.match(m.state.html, /Kept active until the tab closes\./);
  m.click('tpr-timed');
  assert.match(m.state.html, /expiry will remove the override/);
  m.click('tpr-expire');
  assert.match(m.state.html, /lifecycle policy resumed automatically/);
});

test('s-362 snapshot excludes secrets and quarantines tampered data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-362'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/3');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tab state snapshot review');
  assert.match(m.state.html, /Password values, private history and cookies never enter a regular snapshot/);
  assert.match(m.state.html, /62% · article paragraph 14/);
  m.click('tsr-verify');
  assert.match(m.state.html, /Origin-bound metadata is checksummed and schema-versioned before restore/);
  m.click('tsr-tamper');
  assert.match(m.state.html, /Checksum mismatch detected; content was not executed/);
  m.click('tsr-consent');
  assert.match(m.state.html, /Snapshot consent off\./);
});

test('s-363 suspension explanation distinguishes OS eviction from user action', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-363'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/4');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Suspension decision explanation');
  assert.match(m.state.html, /12 minutes 08 seconds/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'sde-reason', value: 'os' } } : null) } });
  assert.match(m.state.html, /Reason: os\./);
  assert.match(m.state.html, /not attributed to you or to a page action/);
  m.click('sde-resume');
  assert.match(m.state.html, /snapshot loads before content/);
  m.click('sde-keep');
  assert.match(m.state.html, /suspension override applied until close/);
});

test('s-364 resume progress measures interactive content and keeps URL on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-364'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/5');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Resume progress');
  assert.match(m.state.html, /startup does not launch every tab at once/);
  assert.match(m.state.html, /placeholder not counted as interactive/);
  m.click('rsp-finish');
  assert.match(m.state.html, /p50 180 ms · p95 340 ms/);
  m.click('rsp-fail');
  assert.match(m.state.html, /URL retained; retry does not navigate to an unrelated site\./);
  m.click('rsp-cancel');
  assert.match(m.state.html, /tab remains suspended/);
});

test('s-365 restore divergence drops cross-origin state and replays safely', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-365'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://lifecycle/6');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Restore divergence review');
  assert.match(m.state.html, /Stale origin-specific UI and form metadata are dropped/);
  assert.match(m.state.html, /https:\/\/news\.example\/today/);
  assert.match(m.state.html, /Scroll position, form values and reader location/);
  m.click('rdv-reload');
  assert.match(m.state.html, /no stale ridge\.example state was applied/);
  m.click('rdv-replay');
  assert.match(m.state.html, /No duplicate tabs were created and the active selection was preserved\./);
});

test('s-366 compute center separates process groups and avoids per-tab summation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-366'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/1');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Compute workload center');
  assert.match(m.state.html, /No process-wide boost is applied/);
  assert.match(m.state.html, /shared by 3 tabs, counted once/);
  m.click('cwc-favor');
  assert.match(m.state.html, /security and OS processes are untouched/);
  m.click('cwc-background');
  assert.match(m.state.html, /S-367/);
});

test('s-367 background inspector throttles hidden timers and shows unknown work', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-367'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/2');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Background task inspector');
  assert.match(m.state.html, /Unattributed work is shown as unknown, never as zero/);
  assert.match(m.state.html, /Attribution unavailable on this engine/);
  m.click('bti-throttle');
  assert.match(m.state.html, /audio remains exempt/);
  m.click('bti-close');
  assert.match(m.state.html, /high-frequency app-owned sampling/);
});

test('s-368 rendering quality respects accessibility and needs restart for acceleration', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-368'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/3');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rendering quality controls');
  assert.match(m.state.html, /No unsafe driver flags and no weakening of site isolation/);
  m.click('rqc-accel');
  assert.match(m.state.html, /Acceleration disabled; restart required\./);
  m.click('rqc-blur');
  assert.match(m.state.html, /Expensive blur disabled\./);
  m.click('rqc-anim');
  assert.match(m.state.html, /glass effects yield to reduced-motion policy/);
  assert.match(m.state.html, /high-contrast or reduced-transparency mode replaces glass with opaque surfaces/);
});

test('s-369 frame pacing separates refresh capability and content latency', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-369'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/4');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Frame pacing report');
  assert.match(m.state.html, /Display refresh capability is not a measured page frame rate/);
  assert.match(m.state.html, /not claimed as browser overhead/);
  m.click('fpr-run');
  assert.match(m.state.html, /60 fps during 5 s controlled scroll/);
  assert.match(m.state.html, /Chrome p95 45 ms · content p95 180 ms/);
  assert.match(m.state.html, /chrome and content latency reported separately/);
});

test('s-370 graphics fallback preserves navigation and respects engine blacklist', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-370'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/5');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Graphics fallback notice');
  assert.match(m.state.html, /Engine blacklist and safety restrictions are retained/);
  assert.match(m.state.html, /no benchmark bypass/);
  m.click('gfn-recreate');
  assert.match(m.state.html, /Rendering context recreated; navigation preserved\./);
  m.click('gfn-safe');
  assert.match(m.state.html, /Repeated failures; safe software fallback active\./);
  assert.match(m.state.html, /Required to re-attempt hardware acceleration/);
});

test('s-371 workload priority grants a bounded lease and cancels stale work', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-371'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compute/6');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'cpu-graphics-scheduler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workload priority editor');
  assert.match(m.state.html, /Temporary priority applies only to this tab for a bounded lease/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'wpe-lease', value: '30' } } : null) } });
  assert.match(m.state.html, /Lease set to 30 minutes\./);
  m.click('wpe-prioritize');
  assert.match(m.state.html, /This tab is favored for 30 minutes\. Other tabs are unaffected/);
  m.click('wpe-cancel');
  assert.match(m.state.html, /cannot update the current origin/);
  m.click('wpe-save');
  assert.match(m.state.html, /unrelated tabs unchanged/);
});

test('s-372 energy center labels measured vs estimated and keeps focus', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-372'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/1');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Energy profile center');
  assert.match(m.state.html, /Measured and estimated values are labelled separately/);
  assert.match(m.state.html, /4\.2% per hour · from OS battery signal/);
  assert.match(m.state.html, /3\.8% per hour · model estimate, not a measurement/);
  m.click('epc-saver');
  assert.match(m.state.html, /Energy saver active; focus and tab unchanged\./);
  assert.match(m.state.html, /Certificate checks and signed updates remain active\./);
  m.click('epc-details');
  assert.match(m.state.html, /without a battery show battery values as unavailable, never a fictional percentage/);
  m.click('epc-nobattery');
  assert.match(m.state.html, /Desktop · AC power · no battery present/);
  assert.match(m.state.html, /Unavailable · no battery on this device/);
  assert.match(m.state.html, /never a fictional percentage/);
});

test('s-373 power schedule validates hysteresis and keeps previous policy', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-373'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/2');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Power schedule editor');
  assert.match(m.state.html, /prevent oscillation/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-pse-exit', value: '23' } });
  m.click('pse-save');
  assert.match(m.state.html, /Exit must be at least 5 points above enter; previous schedule kept\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-pse-enter', value: '20' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-pse-exit', value: '35' } });
  m.click('pse-save');
  assert.match(m.state.html, /Schedule applied \(enter 20%, exit 35%\); deferred index resumes safely, and an interrupted rebuild can never corrupt the committed index\./);
  m.click('pse-cancel');
  assert.match(m.state.html, /Cancelled; previous schedule unchanged\./);
});

test('s-374 energy tab uses proxies and never cuts resolution silently', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-374'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/3');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Energy-intensive tab detail');
  assert.match(m.state.html, /OS\/process proxies, not a calibrated battery measurement/);
  assert.match(m.state.html, /Never lowered silently to improve a benchmark/);
  m.click('eit-mitigate');
  assert.match(m.state.html, /playback resolution and hardware decode unchanged/);
});

test('s-375 thermal mitigations never end calls and suppress oscillation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-375'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/4');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Thermal mitigation notice');
  assert.match(m.state.html, /Calls and recordings are never terminated by thermal policy/);
  m.click('tmn-oscillate');
  assert.match(m.state.html, /no renderer surface recreation/);
  m.click('tmn-recover');
  assert.match(m.state.html, /mitigations restoring gradually/);
});

test('s-376 battery exceptions cannot disable security and mute only noncritical', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-376'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/5');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Battery exception manager');
  assert.match(m.state.html, /Certificate checks and network safety are never disabled/);
  m.click('bem-add');
  assert.match(m.state.html, /Exception added for video\.example \(1 hour\)\./);
  m.click('bem-mute');
  assert.match(m.state.html, /safety-critical still shown/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'bem-remove', id: 'e1' } } : null) } });
  assert.match(m.state.html, /Exception removed; security unchanged\./);
});

test('s-377 energy benchmark requires matched conditions and reports uncertainty', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-377'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://energy/6');
  assert.equal(m.dataset.onboardingPhase, 'p18');
  assert.equal(m.dataset.atlasCategory, 'energy');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Energy benchmark result');
  assert.match(m.state.html, /not a calibrated wattmeter/);
  assert.match(m.state.html, /4\.0 Wh-equivalent · uncertainty ±0\.3/);
  m.click('ebr-mismatch');
  assert.match(m.state.html, /runs remain separate and unranked/);
  m.click('ebr-compare');
  assert.match(m.state.html, /difference is within reported uncertainty/);
  m.click('ebr-export');
  assert.match(m.state.html, /no extrapolated values/);
  assert.match(m.state.html, /Different brightness, video quality or background updates → separate runs only/);
});

test('s-378 connection health reports engine protocols and partition isolation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-378'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/1');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Connection health overview');
  assert.match(m.state.html, /Only protocols the shipping engine reports are shown as active/);
  assert.match(m.state.html, /connection pools never shared across profiles/);
  m.click('cho-diag');
  assert.match(m.state.html, /exportable with redaction in S-383/);
  m.click('cho-export');
  assert.match(m.state.html, /S-383/);
});

test('s-379 per-origin inspector separates cache source and resists spoofing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-379'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/2');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Per-origin connection inspector');
  assert.match(m.state.html, /Facts come from the engine and TLS layer, not from page text/);
  assert.match(m.state.html, /cached response, no new network request/);
  m.click('pci-details');
  assert.match(m.state.html, /Network, HTTP cache, service worker and unknown are separate categories/);
  m.click('pci-refresh');
  assert.match(m.state.html, /cached source unchanged/);
});

test('s-380 speculative controls stay bounded and silent while typing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-380'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/3');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Speculative loading controls');
  assert.match(m.state.html, /Typing alone never contacts a provider/);
  assert.match(m.state.html, /Same-origin only · 2 concurrent/);
  m.click('slc-prefetch');
  assert.match(m.state.html, /Prefetch off\./);
  m.click('slc-typing');
  assert.match(m.state.html, /No provider contact from typing; requests require explicit submit\./);
  assert.match(m.state.html, /never paused or interrupted by speculative policy/);
  assert.match(m.state.html, /No remote requests are made just to populate ornamental cards/);
});

test('s-381 network retry never downgrades certificates or replays POST', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-381'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/4');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Network retry state');
  assert.match(m.state.html, /Never automatically replayed/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'nrs-kind', value: 'cert' } } : null) } });
  assert.match(m.state.html, /Not auto-retryable · certificate must be fixed/);
  m.click('nrs-retry');
  assert.match(m.state.html, /cannot be auto-retried or downgraded to HTTP/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'nrs-kind', value: 'portal' } } : null) } });
  assert.match(m.state.html, /Blocked by sign-in page · open portal first/);
  m.click('nrs-post');
  assert.match(m.state.html, /POST\/payment forms are never automatically replayed\./);
});

test('s-382 encrypted DNS rejects malformed endpoints and keeps prior config', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-382'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/5');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Encrypted DNS configuration');
  assert.match(m.state.html, /unknown state is labelled unknown/);
  m.click('edc-apply');
  assert.match(m.state.html, /Test the endpoint before applying; current resolver unchanged\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-edc-endpoint', value: 'dns.example' } });
  m.click('edc-test');
  assert.match(m.state.html, /Malformed endpoint; previous resolver config retained\./);
  m.click('edc-apply');
  assert.match(m.state.html, /Apply refused: malformed endpoint; previous config kept\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-edc-endpoint', value: 'https://dns.cloudflare.com/dns-query' } });
  m.click('edc-test');
  assert.match(m.state.html, /encryption verified/);
  m.click('edc-apply');
  assert.match(m.state.html, /Resolver applied after successful test\./);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'edc-mode', value: 'os' } } : null) } });
  assert.match(m.state.html, /the OS does not expose encrypted state to the browser/);
  m.click('edc-apply');
  assert.match(m.state.html, /encryption state remains unknown until the OS reports it/);
});

test('s-383 diagnostics export redacts secrets and avoids engine blame', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-383'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://network/6');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'transport-connection-efficiency');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Connection diagnostics export');
  assert.match(m.state.html, /External network latency is reported as observed, not attributed to engine performance/);
  m.click('cde-preview');
  assert.match(m.state.html, /Removed: credentials, cookies, query strings, page content/);
  m.click('cde-export');
  assert.match(m.state.html, /no private trace or full URL/);
});

test('s-384 storage breakdown excludes downloads and labels shared usage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-384'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/1');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Storage breakdown center');
  assert.match(m.state.html, /User-downloaded files are excluded from disposable cache/);
  assert.match(m.state.html, /external files \(8 GB\) excluded/);
  assert.match(m.state.html, /40 MB cannot be attributed/);
  m.click('sbc-scan');
  assert.match(m.state.html, /site directories were not walked on each refresh/);
});

test('s-385 origin quota keeps containers separate and cleans scoped', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-385'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/2');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Per-origin quota detail');
  assert.match(m.state.html, /Same-domain accounts in separate containers never merge usage/);
  assert.match(m.state.html, /42 MB of 200 MB quota/);
  m.overlay.onclick({ target: { closest: (s) => (s === '[data-onboard]' ? { dataset: { onboard: 'pqd-container', value: 'B' } } : null) } });
  assert.match(m.state.html, /18 MB of 200 MB quota/);
  m.click('pqd-clean');
  assert.match(m.state.html, /other sites and containers untouched/);
});

test('s-386 cache policy validates bounds and preserves pinned data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-386'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/3');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Cache policy editor');
  assert.match(m.state.html, /Cache eviction never removes notes, files or pinned offline data/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-cpe-budget', value: '50' } });
  m.click('cpe-save');
  assert.match(m.state.html, /Budget must be between 200 and 5000 MB\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-cpe-budget', value: '1200' } });
  m.click('cpe-preview');
  assert.match(m.state.html, /User notes and downloads untouched/);
  m.click('cpe-save');
  assert.match(m.state.html, /Cache policy saved \(soft 1200 MB, 30 days\)\./);
  assert.match(m.state.html, /disabled rather than simulated/);
});

test('s-387 reclaim preview names sign-ins and reports partial failures', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-387'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/4');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Storage reclaim preview');
  assert.match(m.state.html, /signs out of app\.example and notes\.example/);
  m.click('srp-reclaim');
  assert.match(m.state.html, /Remove selected data\?/);
  m.click('srp-cancel');
  assert.match(m.state.html, /Cancelled; all selected data intact\./);
  m.click('srp-reclaim');
  m.click('srp-fail');
  assert.match(m.state.html, /Cookies not cleared; other selected data cleared\./);
});

test('s-388 disk pressure stays read-only and export keeps the source', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-388'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/5');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Disk-pressure safe state');
  assert.match(m.state.html, /last committed state is preserved/);
  m.click('dps-retry');
  assert.match(m.state.html, /No “Saved” indication is shown while the transaction fails\./);
  m.click('dps-export');
  assert.match(m.state.html, /source data was not removed/);
  m.click('dps-cancel');
  assert.match(m.state.html, /Export cancelled; source data kept\./);
});

test('s-389 integrity report never auto-cleans unknown files', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-389'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://cache/6');
  assert.equal(m.dataset.onboardingPhase, 'p19');
  assert.equal(m.dataset.atlasCategory, 'storage-cache-disk-pressure');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Storage integrity report');
  assert.match(m.state.html, /Unknown files are listed but never deleted automatically/);
  assert.match(m.state.html, /3 app files with no manifest reference/);
  m.click('sir-run');
  assert.match(m.state.html, /unknown files left untouched/);
  m.click('sir-corrupt');
  assert.match(m.state.html, /prior recoverable version remains active/);
  m.click('sir-report');
  assert.match(m.state.html, /1,240 references valid/);
  assert.match(m.state.html, /it stays on this device/);
});

test('s-390 Rasha health proves deterministic compile and lists unsupported', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-390'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/1');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha engine health');
  assert.match(m.state.html, /Every production rule is VAAYVU-authored/);
  assert.match(m.state.html, /0 unattributed active/);
  m.click('reh-compile');
  assert.match(m.state.html, /Same inputs and compiler version produced hash 8c41…2d9e again/);
  m.click('reh-unsupported');
  assert.match(m.state.html, /never approximated as active/);
});

test('s-391 Rasha inspection enforces dot-boundary matching only', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-391'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/2');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha rule inspection');
  assert.match(m.state.html, /canonical hostname equality or dot-boundary subdomains only/);
  m.click('rri-bad');
  assert.match(m.state.html, /notexample\.com does not match: no label boundary\./);
  m.click('rri-evil');
  assert.match(m.state.html, /suffix is not a dot-boundary of the rule host/);
  m.click('rri-frame');
  assert.match(m.state.html, /rule scope unchanged/);
  m.click('rri-sub');
  assert.match(m.state.html, /a\.example\.com matches: dot-boundary descendant\./);
  assert.match(m.state.html, /never mutate the shared generation/);
});

test('s-392 selector editor refuses critical dialog/login/payment targets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-392'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/3');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha selector editor');
  assert.match(m.state.html, /site storage and consent choices are untouched/);
  m.click('rse-preview');
  assert.match(m.state.html, /nothing saved/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-rse-selector', value: 'dialog' } });
  m.click('rse-save');
  assert.match(m.state.html, /refused/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-rse-selector', value: '.banner-ad' } });
  m.click('rse-save');
  assert.match(m.state.html, /Cosmetic rule saved for reading\.example\./);
  m.click('rse-disable');
  assert.match(m.state.html, /consent choices unchanged/);
  m.click('rse-cancel');
  assert.match(m.state.html, /last committed rule kept/);
});

test('s-393 rule conflicts keep tracking and threat blocks mandatory', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-393'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/4');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha rule conflict review');
  assert.match(m.state.html, /Tracking block wins · request blocked/);
  m.click('rrc-pause');
  assert.match(m.state.html, /tracking block still applies/);
  m.click('rrc-threat');
  assert.match(m.state.html, /threat and custom blocks cannot be paused by category scope/);
});

test('s-394 generation comparison proves block via fixture logs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-394'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/5');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha generation comparison');
  assert.match(m.state.html, /86 blocked-resource fixtures · 86 never reached the fixture server/);
  assert.match(m.state.html, /CSS hidden/);
  m.click('rgc-run');
  assert.match(m.state.html, /no unsupported rule was promoted/);
});

test('s-395 quarantine keeps active filtering and truthful counts', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-395'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashacore/6');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-matching-rule-compiler');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha quarantine and rollback');
  assert.match(m.state.html, /bad signature or compile error cannot replace active filtering/);
  assert.match(m.state.html, /0 unknown counted/);
  m.click('rqr-fail');
  assert.match(m.state.html, /filtering continues on generation 4/);
  m.click('rqr-rollback');
  assert.match(m.state.html, /custom domains unaffected/);
  assert.match(m.state.html, /shown as unavailable, never estimated/);
});

test('s-396 research intake redacts URLs and excludes private sessions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-396'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/1');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha research intake');
  assert.match(m.state.html, /Competitor lists and customer browsing histories are never accepted/);
  assert.match(m.state.html, /Private sessions<\/strong><small>Excluded from reports by default/);
  m.click('rsi-send');
  assert.match(m.state.html, /Preview the redacted report before transmitting\./);
  m.click('rsi-preview');
  assert.match(m.state.html, /No full URL, cookies or private-session data\./);
  m.click('rsi-send');
  assert.match(m.state.html, /Redacted report queued for review\./);
});

test('s-397 candidate review blocks unreviewed broad rules', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-397'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/2');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rule candidate review');
  assert.match(m.state.html, /Broad, threat and exception rules require independent review/);
  m.click('rcr-approve');
  assert.match(m.state.html, /Unreviewed candidate cannot enter production\./);
  m.click('rcr-exception');
  assert.match(m.state.html, /owner and 7-day expiry/);
  m.click('rcr-expire');
  assert.match(m.state.html, /no exception can remain past its 7-day expiry/);
  m.click('rcr-review');
  m.click('rcr-approve');
  assert.match(m.state.html, /Candidate approved for the next generation\./);
});

test('s-398 coverage corpus requires ordinary-page fixtures', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-398'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/3');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Coverage corpus dashboard');
  assert.match(m.state.html, /86 blocked-resource \+ 18 ordinary-page fixtures/);
  m.click('ccd-blocked');
  assert.match(m.state.html, /Blocked-only corpus cannot pass the release gate\./);
  m.click('ccd-run');
  assert.match(m.state.html, /ordinary pages rendered correctly across every fixture/);
});

test('s-399 compatibility triage prioritizes functional fixes and refuses allow-all', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-399'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/4');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Compatibility triage');
  assert.match(m.state.html, /Functional regressions outrank aesthetic cleanup/);
  m.click('ctr-cosmetic');
  assert.match(m.state.html, /aesthetic cleanup cannot override a functional regression/);
  m.click('ctr-open');
  assert.match(m.state.html, /broad exception cannot weaken other protections/);
  m.click('ctr-rerun');
  assert.match(m.state.html, /Login still failing/);
  m.click('ctr-fix');
  m.click('ctr-rerun');
  assert.match(m.state.html, /Login check passed after scoped fix\./);
});

test('s-400 signing review verifies before staging and pauses on regression', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-400'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/5');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Release signing review');
  assert.match(m.state.html, /no browsing history or page content/);
  m.click('rsr-stage');
  assert.match(m.state.html, /Verify the signature before rollout\./);
  m.click('rsr-verify');
  assert.match(m.state.html, /downgrade attempt rejected/);
  m.click('rsr-stage');
  assert.match(m.state.html, /Staged rollout started at 5%\./);
  m.click('rsr-pause');
  assert.match(m.state.html, /generation 4 remains active/);
  m.click('rsr-tamper');
  assert.match(m.state.html, /wrong signing key/);
  assert.match(m.state.html, /Nothing was staged/);
});

test('s-401 faulty rule containment rolls back without weakening security', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-401'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://rashalab/6');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'rasha-independent-research');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Faulty rule containment');
  assert.match(m.state.html, /no universal claim from one ad-test page/);
  assert.match(m.state.html, /Precision 0\.94 · recall 0\.88/);
  m.click('frc-rollback');
  assert.match(m.state.html, /engine security and custom rules unaffected/);
  m.click('frc-metrics');
  assert.match(m.state.html, /recomputed on labeled fixtures/);
});

test('s-402 privacy partition proves per-site keys and guest isolation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-402'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/1');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Privacy partition overview');
  assert.match(m.state.html, /Anything the engine cannot partition is labelled, never assumed/);
  assert.match(m.state.html, /Temporary isolated storage/);
  m.click('ppo-run');
  assert.match(m.state.html, /each received a distinct partition key and no cookie was shared/);
  m.click('ppo-guest');
  assert.match(m.state.html, /0 of 12 regular bookmarks/);
  m.click('ppo-limits');
  assert.match(m.state.html, /reported unavailable rather than treated as isolated/);
  m.click('ppo-ephemeral');
  assert.match(m.state.html, /normal retention applies/);
  assert.match(m.state.html, /never migrated into the regular profile/);
});

test('s-403 partition detail never overstates unsupported storage isolation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-403'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/2');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Partition detail inspector');
  assert.match(m.state.html, /Adapter does not partition this kind/);
  assert.match(m.state.html, /Not probed on this adapter/);
  m.click('pdd-label');
  assert.match(m.state.html, /display metadata and cannot create cookie isolation/);
  m.click('pdd-key');
  assert.match(m.state.html, /The space label "Shopping" is display-only/);
  m.click('pdd-grants');
  assert.match(m.state.html, /expires in 15 min/);
});

test('s-404 storage grant is context-bound, session-only and revocable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-404'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/3');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Storage access grant review');
  assert.match(m.state.html, /persistent upgrade not offered/);
  m.click('sgr-allow');
  assert.match(m.state.html, /Session grant approved for this frame on shop\.example\./);
  m.click('sgr-persist');
  assert.match(m.state.html, /cannot silently expand to persistent access/);
  m.click('sgr-context');
  m.click('sgr-allow');
  assert.match(m.state.html, /grant requested from a changed top-level origin is not inherited/);
  m.click('sgr-context');
  m.click('sgr-allow');
  m.click('sgr-revoke');
  assert.match(m.state.html, /keeps its partitioned storage until the page reloads/);
});

test('s-405 cleanup rule is exact-host, validates fields and warns on shared storage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-405'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/4');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Automatic site cleanup rule editor');
  assert.match(m.state.html, /Parent domains and subdomains are never included/);
  m.click('scr-domain');
  assert.match(m.state.html, /broad registrable-domain removal cannot be labelled as an exact host/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-scr-host', value: '' } });
  m.click('scr-save');
  assert.match(m.state.html, /Exact host is required\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-scr-host', value: '*.news.example' } });
  m.click('scr-save');
  assert.match(m.state.html, /Wildcards, paths and spaces are not allowed/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-scr-host', value: 'news.example' } });
  m.click('scr-preview');
  assert.match(m.state.html, /2 active tabs on news\.example share this storage/);
  m.click('scr-save');
  assert.match(m.state.html, /Saved exact-host rule for news\.example\./);
});

test('s-406 cleanup result reports partial success and refuses secure-erase claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-406'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/5');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Selective cleanup result');
  assert.match(m.state.html, /Partial success is reported as partial/);
  assert.match(m.state.html, /cleanup never removes saved files/);
  m.click('scr2-erase');
  assert.match(m.state.html, /cannot guarantee physical secure erase of SSD blocks/);
  m.click('scr2-retry');
  assert.match(m.state.html, /successful categories were not rerun/);
  assert.match(m.state.html, /Site storage<\/strong><small>Deleted on retry/);
  m.click('scr2-private');
  assert.match(m.state.html, /downloads remain and are disclosed/);
});

test('s-407 leakage audit blocks release on a sentinel and redacts export', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-407'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://privacyisolation/6');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'privacy-boundaries-ephemeral-storage');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Private leakage audit');
  assert.match(m.state.html, /Any match blocks release/);
  m.click('pla-export');
  assert.match(m.state.html, /sentinel values never included/);
  m.click('pla-run');
  assert.match(m.state.html, /Shared engine process did not share cookie stores/);
  m.click('pla-leak');
  m.click('pla-run');
  assert.match(m.state.html, /Private sentinel detected in regular persistence; fix before shipping/);
  m.click('pla-shared');
  assert.match(m.state.html, /cookie stores stayed distinct per profile/);
});

test('s-408 fingerprint controls use reviewed policy and report unavailable APIs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-408'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/1');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Fingerprint protection controls');
  assert.match(m.state.html, /never injected scripts/);
  assert.match(m.state.html, /User-selected language and text output preserved/);
  m.click('fpc-unsupported');
  assert.match(m.state.html, /Engine exposes no reviewable hook/);
  assert.match(m.state.html, /Not standardized by this adapter/);
  m.click('fpc-strong');
  assert.match(m.state.html, /Stronger reviewed policy applied; language and text rendering preserved\./);
  assert.match(m.state.html, /Renderer and driver fields reduced to coarse tier/);
});

test('s-409 API exposure keeps repeated calls coherent and graphics honest', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-409'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/2');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'API exposure detail');
  assert.match(m.state.html, /User-selected content language preserved exactly/);
  assert.match(m.state.html, /No supported hook on this adapter/);
  m.click('aed-repeat');
  assert.match(m.state.html, /coherent values across repeated calls on the same site/);
  m.click('aed-graphics');
  assert.match(m.state.html, /no synthetic benchmark scores produced/);
  m.click('aed-variation');
  assert.match(m.state.html, /user language and text rendering untouched/);
  assert.match(m.state.html, /Never spoofed to bypass service controls/);
});

test('s-410 redirect inspector preserves signed, payment and unknown parameters', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-410'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/3');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tracking redirect inspector');
  assert.match(m.state.html, /ref, session · preserved untouched/);
  m.click('tri-clean');
  assert.match(m.state.html, /preserved ref, session and signature parameters/);
  m.click('tri-signed');
  assert.match(m.state.html, /preserved byte-for-byte; cleanup skipped/);
  m.click('tri-payment');
  assert.match(m.state.html, /Payment redirect untouched/);
  m.click('tri-alias');
  assert.match(m.state.html, /No extra DNS lookup performed; unsupported alias disclosed\./);
  m.click('tri-idp');
  assert.match(m.state.html, /Identity-provider redirect untouched/);
});

test('s-411 privacy exception is origin-scoped, temporary and cannot disable hard protections', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-411'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/4');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Scoped privacy exception editor');
  assert.match(m.state.html, /Sandbox, certificate validation and Rasha threat blocks are never exceptions/);
  assert.match(m.state.html, /Exposed under user policy · honoring not verified/);
  m.click('spe-protected');
  assert.match(m.state.html, /cannot be disabled/);
  m.click('spe-gpc');
  assert.match(m.state.html, /GPC signal not exposed\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-spe-origin', value: 'https://shop.example/*' } });
  m.click('spe-apply');
  assert.match(m.state.html, /Enter an exact host without a scheme, path or wildcard\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-spe-origin', value: 'shop.example' } });
  m.click('spe-apply');
  assert.match(m.state.html, /24-hour exception applied to shop\.example for fingerprint normalization\./);
});

test('s-412 fingerprint compatibility refuses a global downgrade', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-412'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/5');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Fingerprint compatibility warning');
  assert.match(m.state.html, /Keep full protection; no silent global change/);
  m.click('fcw-global');
  assert.match(m.state.html, /never lowered globally after one broken page/);
  m.click('fcw-diagnostics');
  assert.match(m.state.html, /canvas normalization on meet\.example/);
  m.click('fcw-exception');
  assert.match(m.state.html, /Scoped to meet\.example for 24 hours/);
  m.click('fcw-return');
  assert.match(m.state.html, /protection settings unchanged/);
});

test('s-413 privacy regression reports stability without anonymity claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-413'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://fingerprint/6');
  assert.equal(m.dataset.onboardingPhase, 'p20');
  assert.equal(m.dataset.atlasCategory, 'fingerprinting-tracking-resistance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Privacy regression results');
  assert.match(m.state.html, /not an anonymity guarantee/);
  m.click('prg-score');
  assert.match(m.state.html, /single public test score is not proof of anonymity/);
  m.click('prg-cross');
  assert.match(m.state.html, /stayed stable within each partition and differed across partitions/);
  m.click('prg-broken');
  assert.match(m.state.html, /breaks conferencing is blocking until reviewed/);
  m.click('prg-workflow');
  assert.match(m.state.html, /executed across standard and strong modes/);
});

test('s-414 trusted origin follows committed navigation and ignores URL userinfo', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-414'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/1');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Trusted origin detail');
  assert.match(m.state.html, /never the page title or markup/);
  m.click('tod-redirect');
  assert.match(m.state.html, /previous safe indicator cleared/);
  assert.match(m.state.html, /Valid for evil\.test only/);
  m.click('tod-creds');
  assert.match(m.state.html, /embedded credentials do not name the destination/);
  m.click('tod-lookalike');
  assert.match(m.state.html, /no lookalike variant for this fixture/);
});

test('s-415 active sessions revoke after confirmation and never read clipboard silently', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-415'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/2');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Active capability sessions');
  assert.match(m.state.html, /badge stays visible in hidden tabs/);
  assert.match(m.state.html, /Clipboard<\/strong><small>Not read/);
  m.click('acs-clipboard');
  assert.match(m.state.html, /page messages cannot approve clipboard access/);
  m.click('acs-hidden');
  assert.match(m.state.html, /remains visible in the browser-level indicator/);
  m.click('acs-cam');
  assert.match(m.state.html, /Camera revoked after adapter confirmed the session ended\./);
  m.click('acs-loc');
  assert.match(m.state.html, /Location grant revoked; adapter confirmed\./);
  assert.match(m.state.html, /stays pending until restart completes/);
});

test('s-416 grant scope preserves denial and never inherits a new origin', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-416'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/3');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Grant scope editor');
  assert.match(m.state.html, /changing origin or frame never inherits the grant/);
  m.click('gse-scope');
  m.click('gse-scope');
  assert.match(m.state.html, /Persistent · deliberate confirmation required/);
  m.click('gse-approve');
  assert.match(m.state.html, /Confirm persistent camera access deliberately/);
  m.click('gse-approve');
  assert.match(m.state.html, /Camera approved for persistent scope on shop\.example\./);
  m.click('gse-deny');
  m.click('gse-approve');
  assert.match(m.state.html, /Explicit denial preserved/);
  m.click('gse-origin');
  assert.match(m.state.html, /prior authorization is not inherited/);
  m.click('gse-recover');
  assert.match(m.state.html, /user-initiated request can prompt again/);
});

test('s-417 redirect review requires a gesture and rejects unsafe schemes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-417'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/4');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Suspicious redirect review');
  assert.match(m.state.html, /proceeding requires a click/);
  m.click('srd-silent');
  assert.match(m.state.html, /cannot launch an external app without a user gesture/);
  m.click('srd-scheme');
  assert.match(m.state.html, /javascript and unsupported schemes cannot launch/);
  m.click('srd-threat');
  assert.match(m.state.html, /blocked threat in the chain cannot be bypassed/);
  m.click('srd-proceed');
  assert.match(m.state.html, /Navigation proceeded after explicit click; target scheme shown\./);
});

test('s-418 security recovery blocks certificate bypass and offers safe exit', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-418'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/5');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Security recovery center');
  assert.match(m.state.html, /No claim of complete phishing detection/);
  m.click('srv-continue');
  assert.match(m.state.html, /no silent certificate bypass/);
  m.click('srv-off');
  assert.match(m.state.html, /TLS checks cannot be disabled from a warning page/);
  m.click('srv-details');
  assert.match(m.state.html, /Certificate name mismatch/);
  m.click('srv-back');
  assert.match(m.state.html, /Nothing was loaded from the untrusted origin/);
  m.click('srv-type');
  assert.match(m.state.html, /Engine safety warning/);
  m.click('srv-help');
  assert.match(m.state.html, /no bypass is offered/);
});

test('s-419 permission events hold metadata only and deny privileged frame access', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-419'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://security/6');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'trusted-navigation-permission-intelligence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Permission event review');
  assert.match(m.state.html, /No camera, microphone or page content is stored/);
  assert.match(m.state.html, /private sessions are excluded from this regular log/i);
  m.click('per-frame');
  assert.match(m.state.html, /untrusted frame cannot read vault, file or update APIs/);
  m.click('per-content');
  assert.match(m.state.html, /no camera, microphone or page content/);
  m.click('per-clear');
  assert.match(m.state.html, /Event log cleared; nothing else removed\./);
});

test('s-420 credential health keeps checks local and refuses lookalike fills', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-420'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/1');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Credential health overview');
  assert.match(m.state.html, /No secret, hash or password is transmitted/);
  assert.match(m.state.html, /security code never stored or logged/);
  m.click('crh-remote');
  assert.match(m.state.html, /requires reviewed consent and is off by default/);
  m.click('crh-lookalike');
  assert.match(m.state.html, /lookalike host is not the verified origin/);
  m.click('crh-payment');
  assert.match(m.state.html, /payment authorization cannot be fabricated/);
  m.click('crh-run');
  assert.match(m.state.html, /refreshed on-device; nothing left the device/);
  assert.match(m.state.html, /mismatched origin never receive saved passwords/);
});

test('s-421 origin match fills only after gesture and blocks changed frames', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-421'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/2');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Origin match review');
  assert.match(m.state.html, /Autofill requires an explicit gesture/);
  m.click('omr-frame');
  m.click('omr-fill');
  assert.match(m.state.html, /frame origin does not match the credential binding/);
  m.click('omr-frame');
  m.click('omr-fill');
  assert.match(m.state.html, /Filled the visible field after explicit gesture\./);
  m.click('omr-hidden');
  assert.match(m.state.html, /hidden or off-screen password fields are never autofilled/);
  m.click('omr-generate');
  assert.match(m.state.html, /value is masked and never logged/);
  assert.match(m.state.html, /never exposed to untrusted chrome script/);
});

test('s-422 passkey enrollment keeps the password through cancel and failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-422'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/3');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Passkey enrollment status');
  assert.match(m.state.html, /never removes the existing password/);
  m.click('pke-emulate');
  assert.match(m.state.html, /not emulated with ordinary password storage/);
  m.click('pke-start');
  assert.match(m.state.html, /Waiting for the platform authenticator/);
  m.click('pke-cancel');
  assert.match(m.state.html, /Canceled; prior password remains usable\./);
  m.click('pke-fail');
  assert.match(m.state.html, /Enrollment failed; prior password remains usable\./);
  m.click('pke-complete');
  assert.match(m.state.html, /Passkey enrolled through the platform authenticator\./);
});

test('s-423 credential import validates first and preserves the vault on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-423'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/4');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Credential import preview');
  assert.match(m.state.html, /2 conflicting passwords · both identities kept/);
  m.click('cim-import');
  assert.match(m.state.html, /Validate a clean file before importing\./);
  m.click('cim-validate');
  assert.match(m.state.html, /5 duplicate pairs and 2 conflicts previewed before commit/);
  m.click('cim-malformed');
  m.click('cim-import');
  assert.match(m.state.html, /Validate a clean file before importing\./);
  m.click('cim-disk');
  assert.match(m.state.html, /prior vault intact, nothing partially written/);
});

test('s-424 secure export requires OS auth and never overclaims encryption', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-424'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/5');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Secure export confirmation');
  assert.match(m.state.html, /Plaintext formats are disclosed before writing/);
  m.click('sex-export');
  assert.match(m.state.html, /OS authentication is required before export/);
  m.click('sex-skip');
  assert.match(m.state.html, /cannot proceed without OS authentication/);
  m.click('sex-auth');
  m.click('sex-encrypt');
  assert.match(m.state.html, /encryption is verified before any claim/);
  m.click('sex-export');
  assert.match(m.state.html, /Exported 12 credentials to the chosen folder/);
  m.click('sex-cancel');
  assert.match(m.state.html, /Vault unchanged; no file was written\./);
});

test('s-425 vault recovery refuses destructive reset and keeps private sentinels out', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-425'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://vault/6');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'credentials-passkeys-safe-autofill');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Vault recovery state');
  assert.match(m.state.html, /A new vault is never created automatically/);
  m.click('vrs-reset');
  assert.match(m.state.html, /automatic destructive reset/);
  m.click('vrs-retry');
  assert.match(m.state.html, /vault remains locked and data intact/);
  m.click('vrs-restore');
  assert.match(m.state.html, /restore awaits OS authentication/);
  m.click('vrs-sentinel');
  assert.match(m.state.html, /Private form sentinel absent from logs and regular profile storage/);
});

test('s-426 update health shows exact revisions and refuses to guess unknowns', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-426'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/1');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Update health center');
  assert.match(m.state.html, /128\.0\.6613\.84 · exact shipped revision/);
  assert.match(m.state.html, /Critical patches are not deferred for monthly features/);
  m.click('uhc-unknown');
  assert.match(m.state.html, /no guessed version substituted/);
  m.click('uhc-check');
  assert.match(m.state.html, /Revision check matched the shipped build record\./);
  m.click('uhc-assign');
  assert.match(m.state.html, /critical patch not deferred/);
});

test('s-427 update integrity rejects tampering, downgrades and skipped signing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-427'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/2');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Update integrity detail');
  assert.match(m.state.html, /previous key not accepted for new builds/);
  m.click('uit-verify');
  assert.match(m.state.html, /notarization verified; no downgrade present/);
  m.click('uit-tamper');
  assert.match(m.state.html, /Rejected: digest mismatch against the signed manifest\./);
  m.click('uit-downgrade');
  assert.match(m.state.html, /unapproved downgrade to an older signed version/);
  m.click('uit-skip');
  assert.match(m.state.html, /cannot be bypassed/);
});

test('s-428 update install defers protected work and preserves data on low disk', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-428'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/3');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Update installation review');
  assert.match(m.state.html, /1 call, 1 download, 1 unsaved form detected/);
  m.click('uir-force');
  assert.match(m.state.html, /optional update cannot force a restart during a protected call/);
  m.click('uir-disk');
  m.click('uir-install');
  assert.match(m.state.html, /Insufficient staging space; existing package and profile untouched\./);
  m.click('uir-disk');
  m.click('uir-install');
  assert.match(m.state.html, /call, download and unsaved form are safe/);
  m.click('uir-defer');
  assert.match(m.state.html, /current version remains active/);
});

test('s-429 interrupted update keeps the verified version and drops changed bytes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-429'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/4');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Update interrupted recovery');
  assert.match(m.state.html, /never marks the new version as installed/);
  m.click('uri-change');
  assert.match(m.state.html, /Remote content changed; staged artifact invalidated\./);
  m.click('uri-resume');
  assert.match(m.state.html, /partial bytes discarded/);
  m.click('uri-status');
  assert.match(m.state.html, /interrupted install is not marked updated/);
});

test('s-430 rollback review requires a backup and refuses automatic erasure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-430'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/5');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Release rollback review');
  assert.match(m.state.html, /Newer data is never silently destroyed by rollback/);
  m.click('rbr-rollback');
  assert.match(m.state.html, /Create the restore-safe backup before rolling back\./);
  m.click('rbr-erase');
  assert.match(m.state.html, /startup failure never triggers automatic data erasure/);
  m.click('rbr-backup');
  m.click('rbr-rollback');
  assert.match(m.state.html, /newer data preserved in the backup/);
  m.click('rbr-safe');
  assert.match(m.state.html, /existing profiles available/);
});

test('s-431 dependency ledger blocks forbidden dependencies and redacts notes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-431'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://updates/6');
  assert.equal(m.dataset.onboardingPhase, 'p21');
  assert.equal(m.dataset.atlasCategory, 'secure-application-engine-maintenance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Dependency security ledger');
  assert.match(m.state.html, /A source commit alone cannot certify a release/);
  m.click('dsl-forbidden');
  m.click('dsl-gate');
  assert.match(m.state.html, /Blocked: forbidden third-party blocker dependency present\./);
  m.click('dsl-forbidden');
  m.click('dsl-gate');
  assert.match(m.state.html, /Gate passed: pinned build, signature, regression and rollout manifest attached\./);
  m.click('dsl-notes');
  assert.match(m.state.html, /no crash secrets or exploit details exposed/);
});

test('s-432 tab placement preserves tabs and keeps a compact fallback', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-432'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/1');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Four-side tab position chooser');
  assert.match(m.state.html, /no right-click/);
  m.click('tlp-left');
  assert.match(m.state.html, /Placement set to left; 7 tab IDs, order, active page and media preserved\./);
  assert.match(m.state.html, /Current · left/);
  m.click('tlp-compact');
  assert.match(m.state.html, /preferred placement retained/);
  m.click('tlp-right');
  assert.match(m.state.html, /Current · right/);
});

test('s-433 tab size validates bounds and keeps new-tab reachable at 100 tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-433'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/2');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tab layout size editor');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-tls-width', value: '120' } });
  m.click('tls-apply');
  assert.match(m.state.html, /Width must be between 180 and 420 pixels\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-tls-width', value: '260' } });
  m.click('tls-apply');
  assert.match(m.state.html, /Sidebar applied at 260px; minimum content width preserved\./);
  m.click('tls-hundred');
  assert.match(m.state.html, /new-tab control stays reachable/);
  m.click('tls-dense');
  assert.match(m.state.html, /targets remain accessible/);
  m.click('tls-cancel');
  assert.match(m.state.html, /last committed width retained/);
});

test('s-434 nested groups reject cycles and preserve active tabs when collapsed', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-434'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/3');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Nested group tree');
  m.click('ngt-cycle');
  assert.match(m.state.html, /would create a cycle/);
  m.click('ngt-pointer');
  assert.match(m.state.html, /none duplicated or lost/);
  m.click('ngt-collapse');
  assert.match(m.state.html, /active tab location shown in the header/);
  assert.match(m.state.html, /an active call keeps running/);
  m.click('ngt-move');
  assert.match(m.state.html, /Research moved under Work; stable IDs preserved\./);
  m.click('ngt-keyboard');
  assert.match(m.state.html, /same ordering as drag/);
});

test('s-435 batch selection previews exact IDs and keeps same-URL tabs distinct', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-435'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/4');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tab selection and batch review');
  assert.match(m.state.html, /t-1042, t-1051, t-1063/);
  m.click('tsl-close');
  assert.match(m.state.html, /Preview the exact selection before closing\./);
  m.click('tsl-dedupe');
  assert.match(m.state.html, /separate sessions and are never merged/);
  m.click('tsl-all');
  assert.match(m.state.html, /never includes unselected or pinned tabs/);
  m.click('tsl-preview');
  m.click('tsl-close');
  assert.match(m.state.html, /Exactly the 3 selected IDs were closed/);
});

test('s-436 tab movement keeps a single owner and leaves the source on failure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-436'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/5');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tab movement confirmation');
  assert.match(m.state.html, /cookies not carried/);
  m.click('tmv-fail');
  assert.match(m.state.html, /Destination creation failed; source tab remains intact\./);
  m.click('tmv-move');
  assert.match(m.state.html, /one active owner/);
  m.click('tmv-copy');
  assert.match(m.state.html, /Copied as a distinct tab object; source tab unchanged\./);
  m.click('tmv-cross');
  assert.match(m.state.html, /requires fresh navigation and isolation disclosure/);
});

test('s-437 layout restore survives rotation and invalid settings without resetting appearance', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-437'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tablayouts/6');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'advanced-tab-layout-organization');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Layout restoration state');
  m.click('lrs-rotate');
  assert.match(m.state.html, /Rotation kept selection and toolbar controls/);
  m.click('lrs-invalid');
  assert.match(m.state.html, /theme, density and other choices kept/);
  m.click('lrs-reset');
  assert.match(m.state.html, /Layout reset only; other appearance choices preserved\./);
});

test('s-438 workspace dashboard shows real counts and refuses isolation by name', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-438'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/1');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workspace project dashboard');
  assert.match(m.state.html, /14 open tabs · 3 notes · 2 layouts/);
  assert.match(m.state.html, /Excluded from this regular dashboard/);
  m.click('wsp-isolate');
  assert.match(m.state.html, /cannot create cookie isolation/);
  m.click('wsp-rename');
  assert.match(m.state.html, /space ID, profile and cookie scope unchanged/);
  m.click('wsp-open');
  assert.match(m.state.html, /actual tab count/);
});

test('s-439 workspace template rejects unsafe URLs and caps startup loads', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-439'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/2');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workspace template editor');
  assert.match(m.state.html, /Only https destinations and layout metadata are saved/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-wte-url', value: 'javascript:alert(1)' } });
  m.click('wte-add');
  assert.match(m.state.html, /javascript, data and ftp are rejected/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-wte-url', value: 'https://docs.example/notes' } });
  m.click('wte-add');
  assert.match(m.state.html, /Destination validated and added\./);
  m.click('wte-launch');
  assert.match(m.state.html, /3 tabs load concurrently and the rest wait/);
  m.click('wte-bulk');
  assert.match(m.state.html, /capped at 12 destinations/);
  m.click('wte-cancel');
  assert.match(m.state.html, /last committed template retained/);
});

test('s-440 pane gallery binds toolbar to the active pane and keeps same-URL panes distinct', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-440'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/3');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Saved pane layout gallery');
  assert.match(m.state.html, /Toolbar actions bind to the active pane only/);
  m.click('pgl-command');
  assert.match(m.state.html, /inactive pane cannot steal the toolbar origin or command/);
  m.click('pgl-merge');
  assert.match(m.state.html, /distinct objects with separate state/);
  m.click('pgl-restore');
  assert.match(m.state.html, /focus on the left pane/);
  m.click('pgl-narrow');
  assert.match(m.state.html, /tab switcher; all tabs retained/);
  m.click('pgl-edit');
  assert.match(m.state.html, /saved geometry and focus remain until saved/);
});

test('s-441 workspace transition keeps protected work and independent windows', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-441'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/4');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workspace transition preview');
  assert.match(m.state.html, /1 active call · 1 upload in progress/);
  m.click('wtr-discard');
  assert.match(m.state.html, /never discarded automatically on switch/);
  m.click('wtr-switch');
  assert.match(m.state.html, /protected activity continues/);
  m.click('wtr-all');
  assert.match(m.state.html, /keep their own space unless explicitly configured/);
});

test('s-442 workspace archive preserves data and refuses profile deletion', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-442'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/5');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workspace archive review');
  assert.match(m.state.html, /never closes protected tabs/);
  m.click('war-profile');
  assert.match(m.state.html, /archiving is not profile deletion/);
  m.click('war-archive');
  assert.match(m.state.html, /user files, bookmarks and protected tabs retained/);
  m.click('war-cancel');
  assert.match(m.state.html, /Canceled; every item and underlying file retained\./);
  m.click('war-meta');
  assert.match(m.state.html, /underlying data and files kept/);
});

test('s-443 workspace restore resolves conflicts without dedupe or private sync', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-443'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://workspaces/6');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'project-spaces-multi-pane-workflow');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workspace restore conflict');
  assert.match(m.state.html, /never silently overwritten/);
  m.click('wrc-dedupe');
  assert.match(m.state.html, /never deduplicated by URL/);
  m.click('wrc-private');
  assert.match(m.state.html, /private workspaces never sync or appear on a remote device/);
  m.click('wrc-dup');
  assert.match(m.state.html, /new stable ID; distinct tab kept/);
  m.click('wrc-retain');
  assert.match(m.state.html, /Current project retained; incoming snapshot previewed separately\./);
  m.click('wrc-restore');
  assert.match(m.state.html, /backing up the current project; missing tabs listed/);
});

test('s-444 container manager isolates partitions and refuses color-only identity', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-444'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/1');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container manager');
  assert.match(m.state.html, /Color alone never carries identity or security scope/);
  m.click('cnm-shared');
  assert.match(m.state.html, /do not share cookies without an explicit approved capability/);
  m.click('cnm-color');
  assert.match(m.state.html, /color alone cannot communicate container identity/);
  m.click('cnm-create');
  assert.match(m.state.html, /only after the engine partition was verified/);
  assert.match(m.state.html, /4 containers/);
});

test('s-445 container creation verifies allocation and keeps temporary data isolated', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-445'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/2');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container creation wizard');
  assert.match(m.state.html, /never enters regular persistent storage/);
  m.click('ccw-skip');
  assert.match(m.state.html, /not a cosmetic label/);
  m.click('ccw-fail');
  m.click('ccw-create');
  assert.match(m.state.html, /Allocation failed; no container was created\./);
  m.click('ccw-fail');
  m.click('ccw-create');
  assert.match(m.state.html, /Container created after ID and partition allocation/);
  m.click('ccw-temp');
  assert.match(m.state.html, /Persistent container selected; data kept until manual removal\./);
});

test('s-446 container rules flag equal-priority conflicts and keep overrides local', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-446'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/3');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container assignment rules');
  assert.match(m.state.html, /Explicit tab → exact host → default/);
  m.click('crr-resolve');
  assert.match(m.state.html, /nothing chosen arbitrarily/);
  m.click('crr-override');
  assert.match(m.state.html, /persistent rule unchanged/);
  m.click('crr-leak');
  assert.match(m.state.html, /does not carry prior account state/);
  m.click('crr-add');
  assert.match(m.state.html, /conflict flagged for review/);
});

test('s-447 container transfer never carries secrets and keeps the source until load', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-447'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/4');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container tab transfer review');
  assert.match(m.state.html, /Cookies, passwords and live DOM state never cross/);
  m.click('ctn-cookies');
  assert.match(m.state.html, /never move across containers/);
  m.click('ctn-close');
  assert.match(m.state.html, /only after the destination is successfully established/);
  m.click('ctn-fail');
  assert.match(m.state.html, /Destination creation failed; source tab remains open\./);
  m.click('ctn-open');
  assert.match(m.state.html, /source kept until destination loaded/);
});

test('s-448 container data keeps unknowns as unknown and isolates removal scope', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-448'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/5');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container data management');
  assert.match(m.state.html, /not reported as zero/);
  m.click('cdm-zero');
  assert.match(m.state.html, /unknown byte count is shown as unavailable, not zero/);
  m.click('cdm-measure');
  assert.match(m.state.html, /cache remains unavailable/);
  m.click('cdm-remove');
  assert.match(m.state.html, /other containers and profile data untouched/);
  m.click('cdm-revoke');
  assert.match(m.state.html, /2 grants revoked; active tabs remain open\./);
});

test('s-449 container fallback refuses isolation claims on unsupported adapters', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-449'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://containers/6');
  assert.equal(m.dataset.onboardingPhase, 'p22');
  assert.equal(m.dataset.atlasCategory, 'isolated-tab-containers-multi-account');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Container unavailable fallback');
  assert.match(m.state.html, /would misrepresent isolation/);
  m.click('cuf-claim');
  assert.match(m.state.html, /isolation cannot be advertised on an adapter without storage partitioning/);
  m.click('cuf-test');
  assert.match(m.state.html, /Shared cache sentinel found across contexts; isolated-container claim blocked\./);
  m.click('cuf-profile');
  assert.match(m.state.html, /Separate profile opened with its own storage\./);
  m.click('cuf-return');
  assert.match(m.state.html, /no container state changed/);
});

test('s-450 continue project advertises capabilities and excludes secrets by default', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-450'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/1');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Continue project on device');
  assert.match(m.state.html, /2-pane layout unavailable/);
  m.click('cpd-secret');
  assert.match(m.state.html, /never transferred/);
  m.click('cpd-send');
  assert.match(m.state.html, /Preview the handoff before sending\./);
  m.click('cpd-untrusted');
  assert.match(m.state.html, /untrusted device cannot receive a project payload/);
  m.click('cpd-preview');
  m.click('cpd-send');
  assert.match(m.state.html, /excluded data is not included/);
});

test('s-451 handoff consent previews fields and blocks revoked devices', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-451'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/2');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Handoff consent sheet');
  assert.match(m.state.html, /Cancellation transmits nothing/);
  m.click('hcs-cookie');
  assert.match(m.state.html, /cookies are not part of the handoff payload/);
  m.click('hcs-cancel');
  assert.match(m.state.html, /no project payload was sent/);
  m.click('hcs-revoke');
  m.click('hcs-send');
  assert.match(m.state.html, /revoked device cannot receive the encrypted payload/);
  m.click('hcs-revoke');
  m.click('hcs-send');
  assert.match(m.state.html, /recipient key was verified/);
});

test('s-452 incoming handoff requires acceptance and never overwrites local tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-452'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/3');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Handoff incoming review');
  assert.match(m.state.html, /Raw page execution context, extension secrets and cookies/);
  m.click('hir-overwrite');
  assert.match(m.state.html, /cannot overwrite local tabs silently/);
  m.click('hir-new');
  assert.match(m.state.html, /existing local tabs untouched/);
  m.click('hir-merge');
  assert.match(m.state.html, /no local tab was overwritten/);
  m.click('hir-decline');
  assert.match(m.state.html, /Declined; nothing was imported\./);
});

test('s-453 sync journal pauses at quota and stays idempotent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-453'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/4');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Sync change journal');
  assert.match(m.state.html, /3\.2 of 10 MB/);
  m.click('scj-dedupe');
  assert.match(m.state.html, /never by URL dedupe/);
  m.click('scj-replay');
  assert.match(m.state.html, /Duplicate ACK ignored; distinct tab objects preserved\./);
  m.click('scj-full');
  m.click('scj-sync');
  assert.match(m.state.html, /pauses and warns instead of dropping oldest work/);
  m.click('scj-full');
  m.click('scj-sync');
  assert.match(m.state.html, /applied once by op ID/);
});

test('s-454 device trust rotates keys without claiming remote erasure', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-454'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/5');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Device trust and key rotation');
  assert.match(m.state.html, /No server-side plaintext key/);
  m.click('dtk-erase');
  assert.match(m.state.html, /remote erasure of data already stored on a revoked device cannot be guaranteed/);
  m.click('dtk-rotate');
  assert.match(m.state.html, /future handoffs use new credentials/);
  m.click('dtk-revoke');
  assert.match(m.state.html, /cannot be remotely erased/);
  m.click('dtk-recovery');
  assert.match(m.state.html, /no server-side plaintext key/);
});

test('s-455 continuity recovery keeps local work independent of the account service', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-455'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://continuity/6');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'encrypted-continuity-device-handoff');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Continuity recovery state');
  assert.match(m.state.html, /Local browsing never depends on the account service/);
  m.click('crs-schema');
  assert.match(m.state.html, /unsupported remote schema cannot overwrite local data/);
  m.click('crs-export');
  assert.match(m.state.html, /without contacting the account service/);
  m.click('crs-retry');
  assert.match(m.state.html, /local work retained while offline/);
  m.click('crs-state');
  assert.match(m.state.html, /Device revoked · local work kept/);
});

test('s-456 backup inventory pauses on capacity and never auto-deletes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-456'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/1');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Backup inventory detail');
  assert.match(m.state.html, /never deleted or overwritten without permission/);
  m.click('bki-full');
  m.click('bki-create');
  assert.match(m.state.html, /backup paused and warned; no older version purged/);
  m.click('bki-full');
  m.click('bki-create');
  assert.match(m.state.html, /New checksummed version created; existing versions kept\./);
  m.click('bki-corrupt');
  assert.match(m.state.html, /no automatic delete, reset or reinitialize/);
  m.click('bki-preview');
  assert.match(m.state.html, /nothing touched yet/);
});

test('s-457 backup creation stages, verifies and keeps prior backup on interruption', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-457'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/2');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Backup creation review');
  assert.match(m.state.html, /Credentials and payment data/);
  m.click('bcr-creds');
  assert.match(m.state.html, /credentials are excluded from generic backup payloads/);
  m.click('bcr-temp');
  assert.match(m.state.html, /cannot use an insecure temporary location/);
  m.click('bcr-interrupt');
  m.click('bcr-create');
  assert.match(m.state.html, /Complete the interrupted backup before starting a new one\./);
  m.click('bcr-interrupt');
  m.click('bcr-create');
  assert.match(m.state.html, /Backup staged, verified and marked complete\./);
});

test('s-458 migration matrix retains unknown fields and preserves the original DB', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-458'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/3');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration compatibility matrix');
  assert.match(m.state.html, /2 future fields retained and surfaced/);
  m.click('mgm-drop');
  assert.match(m.state.html, /unknown future fields are retained, not dropped/);
  m.click('mgm-dry');
  assert.match(m.state.html, /Dry run mapped 42 records; unknown fields retained and surfaced\./);
  m.click('mgm-apply');
  assert.match(m.state.html, /original database preserved/);
  assert.match(m.state.html, /last known-good schema preserved separately/);
});

test('s-459 write recovery stays read-only until the store returns', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-459'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/4');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Interrupted write recovery');
  assert.match(m.state.html, /abrupt kill did not corrupt them/);
  m.click('iwr-claim');
  assert.match(m.state.html, /database is read-only, so changes are not saved/);
  m.click('iwr-replay');
  assert.match(m.state.html, /partial record quarantined/);
  m.click('iwr-export');
  assert.match(m.state.html, /Unsaved changes exported to a local file\./);
  m.click('iwr-retry');
  m.click('iwr-claim');
  assert.match(m.state.html, /Changes are saved; store is writable\./);
});

test('s-460 restore merge keeps conflicts distinct and refuses silent overwrite', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-460'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/5');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Restore merge review');
  assert.match(m.state.html, /3 same-URL records · kept as distinct identities/);
  m.click('rmr-overwrite');
  assert.match(m.state.html, /cannot overwrite unrelated current work without explicit approval/);
  m.click('rmr-creds');
  assert.match(m.state.html, /plaintext credentials are never stored/);
  m.click('rmr-apply');
  assert.match(m.state.html, /Preview the merge before applying\./);
  m.click('rmr-preview');
  m.click('rmr-apply');
  assert.match(m.state.html, /3 conflicts kept distinct and current work intact/);
});

test('s-461 recovery evidence redacts payload and blocks on silent data loss', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-461'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://recovery/6');
  assert.equal(m.dataset.onboardingPhase, 'p23');
  assert.equal(m.dataset.atlasCategory, 'data-preservation-backups-migration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Recovery evidence export');
  assert.match(m.state.html, /never enter the default report/);
  m.click('rev-history');
  assert.match(m.state.html, /browsing history and secrets are excluded/);
  m.click('rev-export');
  assert.match(m.state.html, /Redacted report exported to the chosen destination\./);
  m.click('rev-matrix');
  assert.match(m.state.html, /Five failure modes passed; no silent data loss\./);
  m.click('rev-loss');
  assert.match(m.state.html, /migration release is blocked/);
});

test('s-462 research dashboard saves sources locally and never crawls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-462'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/1');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Research collection dashboard');
  assert.match(m.state.html, /Nothing is crawled or published/);
  m.click('rcd-crawl');
  assert.match(m.state.html, /never crawl the web or build public search infrastructure/);
  m.click('rcd-private');
  assert.match(m.state.html, /private-browsing sources are excluded/);
  m.click('rcd-add');
  assert.match(m.state.html, /stable source ID and capture time/);
  assert.match(m.state.html, /13 sources/);
});

test('s-463 source capture stores only selected text and preserves the quote', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-463'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/2');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Source capture review');
  assert.match(m.state.html, /Only the user-selected text and committed metadata/);
  m.click('sca-form');
  assert.match(m.state.html, /sensitive form contents are never captured/);
  m.click('sca-auto');
  assert.match(m.state.html, /pages cannot auto-save/);
  m.click('sca-rewrite');
  assert.match(m.state.html, /saved excerpt keeps its original text/);
  m.click('sca-save');
  assert.match(m.state.html, /bound to committed origin and capture time/);
});

test('s-464 citation inspector separates notes, quotes and generated text', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-464'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/3');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Citation and quote inspector');
  assert.match(m.state.html, /Note: connects to the supplier chapter/);
  m.click('cqi-generated');
  assert.match(m.state.html, /unverified generated text cannot appear as a direct quote/);
  m.click('cqi-changed');
  assert.match(m.state.html, /asks before reattaching the note/);
  m.click('cqi-verify');
  assert.match(m.state.html, /verified against the saved excerpt and timestamp/);
  m.click('cqi-open');
  assert.match(m.state.html, /Opened the source tab at the saved position/);
});

test('s-465 collection search queries only saved content with visible filters', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-465'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/4');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Local collection search');
  assert.match(m.state.html, /Nothing is crawled or ranked by invented relevance/);
  m.click('cse-search');
  assert.match(m.state.html, /Enter a query to search saved content\./);
  m.click('cse-private');
  assert.match(m.state.html, /private history and unsaved pages are outside the local index/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-cse-query', value: 'supplier' } });
  m.click('cse-filter');
  m.click('cse-search');
  assert.match(m.state.html, /3 matches in saved content with filter notes\./);
  assert.match(m.state.html, /Deleted sources removed from the index after commit/);
});

test('s-466 research export previews, verifies and refuses silent overwrite', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-466'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/5');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Research export review');
  assert.match(m.state.html, /No private history or unsaved pages/);
  m.click('rex-export');
  assert.match(m.state.html, /Preview the export before writing\./);
  m.click('rex-overwrite');
  assert.match(m.state.html, /not overwritten without explicit approval/);
  m.click('rex-format');
  assert.match(m.state.html, /Format set to HTML\./);
  m.click('rex-preview');
  m.click('rex-export');
  assert.match(m.state.html, /file reopened and verified with all selected records/);
  assert.match(m.state.html, /Missing sources or attachments are listed before export/);
});

test('s-467 missing source offers the snapshot and never claims freshness', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-467'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://research/6');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'local-research-citations-collections');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Missing-source recovery');
  assert.match(m.state.html, /never presented as the latest page/);
  m.click('msr-claim');
  assert.match(m.state.html, /not claimed to reflect the latest page/);
  m.click('msr-retry');
  assert.match(m.state.html, /saved snapshot remains available/);
  m.click('msr-open');
  assert.match(m.state.html, /Opened the saved snapshot from 27 Nov 10:14\./);
  m.click('msr-export');
  assert.match(m.state.html, /stable IDs and schema version for future restore/);
  m.click('msr-dup');
  assert.match(m.state.html, /never merged by URL alone/);
});

test('s-468 reading dashboard uses real counts and hides private history', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-468'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/1');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reading dashboard detail');
  assert.match(m.state.html, /3 separate entries · not merged into bookmarks/);
  m.click('rdb-sample');
  assert.match(m.state.html, /sample entries are never shown as real browsing history/);
  m.click('rdb-private');
  assert.match(m.state.html, /private or disabled history never appears/);
  m.click('rdb-refresh');
  assert.match(m.state.html, /Counts refreshed from actual saved articles/);
});

test('s-469 reader extraction labels partial results and returns to the source', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-469'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/2');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reader extraction preview');
  m.click('rdx-title');
  assert.match(m.state.html, /cannot replace the trusted origin with a display title/);
  m.click('rdx-low');
  m.click('rdx-extract');
  assert.match(m.state.html, /Partial extraction: 2 blocks skipped; original page intact\./);
  m.click('rdx-original');
  assert.match(m.state.html, /exact source tab at the saved scroll position/);
  m.click('rdx-fail');
  assert.match(m.state.html, /no content was invented/);
});

test('s-470 reader typography honors OS settings and refuses remote speech', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-470'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/3');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reader typography editor');
  assert.match(m.state.html, /OS text size and reduced-contrast preferences are honored/);
  m.click('rte-remote');
  assert.match(m.state.html, /no remote speech upload without explicit disclosure and consent/);
  m.click('rte-speak');
  assert.match(m.state.html, /pause and resume available/);
  m.click('rte-contrast');
  assert.match(m.state.html, /Reduced-contrast OS preference honored/);
  m.click('rte-size');
  assert.match(m.state.html, /20px · follows OS text size/);
  m.click('rte-cancel');
  assert.match(m.state.html, /last committed typography retained/);
});

test('s-471 offline article respects rights and never evicts saved notes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-471'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/4');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Offline article download review');
  assert.match(m.state.html, /Paywalls and access controls are never bypassed/);
  m.click('oad-bypass');
  assert.match(m.state.html, /never bypassed/);
  m.click('oad-paywall');
  m.click('oad-save');
  assert.match(m.state.html, /paywalled content cannot be saved/);
  m.click('oad-paywall');
  m.click('oad-full');
  m.click('oad-save');
  assert.match(m.state.html, /existing saved article and note kept/);
  m.click('oad-full');
  m.click('oad-save');
  assert.match(m.state.html, /1\.2 MB actual; provenance recorded/);
});

test('s-472 reading progress keeps positions and falls back on changed layout', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-472'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/5');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reading progress library');
  assert.match(m.state.html, /62% · unread · last opened 10:42/);
  m.click('rpg-changed');
  assert.match(m.state.html, /falls back to the top instead of an invalid offset/);
  m.click('rpg-archive');
  assert.match(m.state.html, /undo available; bookmarks untouched/);
  m.click('rpg-read');
  assert.match(m.state.html, /Marked read; saved position retained\./);
  m.click('rpg-unread');
  assert.match(m.state.html, /Marked unread; saved position retained\./);
  m.click('rpg-bulk');
  assert.match(m.state.html, /requires explicit scope and keeps bookmarks separate/);
});

test('s-473 reader unavailable explains failure and keeps the original page', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-473'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://reading/6');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'advanced-reader-shelf-offline-knowledge');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Reader unavailable recovery');
  assert.match(m.state.html, /not force-extracted or invented/);
  m.click('run-force');
  assert.match(m.state.html, /unsupported documents are not force-extracted/);
  m.click('run-retry');
  assert.match(m.state.html, /Retry failed; the original page remains available\./);
  m.click('run-open');
  assert.match(m.state.html, /Opened the original URL in the source tab\./);
  m.click('run-matrix');
  assert.match(m.state.html, /multi-column, RTL, code, images, keyboard and screen reader/);
});

test('s-474 feed manager fetches only approved sources and keeps same-title items', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-474'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/1');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'RSS subscription manager');
  assert.match(m.state.html, /No browsing history is crawled/);
  m.click('rss-discover');
  assert.match(m.state.html, /only explicitly added or approved feeds are fetched/);
  m.click('rss-refresh');
  assert.match(m.state.html, /Refreshed 4 approved sources; no other sites contacted\./);
  m.click('rss-dup');
  assert.match(m.state.html, /distinct GUIDs; both are retained/);
});

test('s-475 add feed enforces HTTPS and previews sanitized items', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-475'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/2');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Add feed validation');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fdv-url', value: 'javascript:alert(1)' } });
  m.click('fdv-validate');
  assert.match(m.state.html, /Only https feed URLs are accepted/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fdv-url', value: 'https://user:pass@news.example/feed.xml' } });
  m.click('fdv-validate');
  assert.match(m.state.html, /credentials are rejected/);
  m.click('fdv-confirm');
  assert.match(m.state.html, /Validate a clean feed before subscribing\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fdv-url', value: 'https://news.example/feed.xml' } });
  m.click('fdv-validate');
  assert.match(m.state.html, /safe redirects follow engine policy/);
  assert.match(m.state.html, /no scripts or inline handlers/);
  m.click('fdv-confirm');
  assert.match(m.state.html, /Subscribed with source identity; sample items sanitized\./);
});

test('s-476 feed article sanitizes markup and keeps private subscriptions local', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-476'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/3');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Feed article view');
  m.click('fav-script');
  assert.match(m.state.html, /Feed script and inline handlers stripped/);
  m.click('fav-private');
  assert.match(m.state.html, /private subscription data never syncs/);
  m.click('fav-read');
  assert.match(m.state.html, /Marked read locally; encrypted sync if enabled\./);
  m.click('fav-open');
  assert.match(m.state.html, /Opened the publisher link in a normal tab/);
});

test('s-477 feed refresh respects metered pause and avoids refresh storms', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-477'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/4');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Feed refresh preferences');
  assert.match(m.state.html, /Bounded at 2 MB per feed/);
  m.click('frp-metered');
  m.click('frp-now');
  assert.match(m.state.html, /Refresh skipped on metered network\./);
  m.click('frp-metered');
  m.click('frp-now');
  assert.match(m.state.html, /unchanged feeds skipped/);
  m.click('frp-storm');
  assert.match(m.state.html, /coalesced into a single refresh/);
  assert.match(m.state.html, /rejected at parse with bounded memory/);
});

test('s-478 feed transfer previews OPML and refuses silent overwrite', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-478'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/5');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Feed import/export review');
  assert.match(m.state.html, /3 existing sources · listed, not silently merged/);
  m.click('ftr-import');
  assert.match(m.state.html, /Preview and validate the OPML before importing\./);
  m.click('ftr-preview');
  assert.match(m.state.html, /22 valid https feeds · 2 insecure rejected/);
  m.click('ftr-import');
  assert.match(m.state.html, /Imported 22 valid feeds after approval; duplicates listed\./);
  m.click('ftr-export');
  assert.match(m.state.html, /user-chosen file/);
  m.click('ftr-overwrite');
  assert.match(m.state.html, /not overwritten without approval/);
  assert.match(m.state.html, /DTDs and external entities are rejected/);
});

test('s-479 feed failure keeps cache fresh-labeled and saves articles separate', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-479'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://feeds/6');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'independent-rss-subscribed-sources');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Feed failure state');
  assert.match(m.state.html, /12 items · 2 hours old · actual freshness shown/);
  m.click('ffl-cache');
  assert.match(m.state.html, /no invented headlines/);
  m.click('ffl-retry');
  assert.match(m.state.html, /Still offline; showing 12 cached items/);
  m.click('ffl-remove');
  assert.match(m.state.html, /separately saved articles kept/);
  m.click('ffl-delete');
  assert.match(m.state.html, /require explicit, separate deletion/);
  m.click('ffl-cancel');
  assert.match(m.state.html, /subscription and cached items retained/);
});

test('s-480 focus workspace keeps timer state across sections and shows real tabs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-480'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/1');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Observatory Focus workspace');
  assert.match(m.state.html, /25:00 · idle/);
  m.click('foc-start');
  assert.match(m.state.html, /running/);
  m.click('foc-section');
  assert.match(m.state.html, /timer state preserved/);
  m.click('foc-pause');
  assert.match(m.state.html, /elapsed time retained/);
  m.click('foc-resume');
  assert.match(m.state.html, /paused elapsed time/);
  m.click('foc-reset');
  assert.match(m.state.html, /25:00 · idle/);
  m.click('foc-tabs');
  assert.match(m.state.html, /nothing closed/);
});

test('s-481 focus preferences validate bounds and keep the timer independent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-481'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/2');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Focus session preferences');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fsp-focus', value: '0' } });
  m.click('fsp-apply');
  assert.match(m.state.html, /Focus must be between 5 and 120 minutes\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fsp-focus', value: '50' } });
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fsp-break', value: '10' } });
  m.click('fsp-apply');
  assert.match(m.state.html, /active timer unchanged until the next session/);
  m.click('fsp-notify');
  assert.match(m.state.html, /denial would not stop the timer/);
  m.click('fsp-default');
  assert.match(m.state.html, /25-minute focus, 5-minute break/);
});

test('s-482 distraction schedule stays browser-scoped and validates hosts', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-482'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/3');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Distraction schedule editor');
  assert.match(m.state.html, /DST and timezone shifts keep intended local hours/);
  m.click('fds-os');
  assert.match(m.state.html, /browser only, not OS-wide interception/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fds-host', value: 'bad host' } });
  m.click('fds-add');
  assert.match(m.state.html, /exact host without a scheme, path or wildcard/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fds-host', value: 'games.example' } });
  m.click('fds-add');
  assert.match(m.state.html, /Host added to the browser-scope schedule\./);
  m.click('fds-override');
  assert.match(m.state.html, /15-minute override active; clearly visible and reversible\./);
  m.click('fds-cancel');
  assert.match(m.state.html, /last committed schedule retained/);
  assert.match(m.state.html, /cannot extend a restriction indefinitely/);
});

test('s-483 focus running protects calls and uploads and survives suspension', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-483'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/4');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Focus running indicator');
  assert.match(m.state.html, /18:24 remaining/);
  m.click('fro-stop');
  assert.match(m.state.html, /never stops uploads or calls automatically/);
  m.click('fro-suspend');
  assert.match(m.state.html, /no background execution is claimed/);
  assert.match(m.state.html, /restores from the monotonic deadline/);
  m.click('fro-pause');
  assert.match(m.state.html, /Focus paused; protected tasks untouched\./);
  m.click('fro-end');
  assert.match(m.state.html, /no tabs closed, calls muted or uploads stopped/);
});

test('s-484 focus summary stores a bounded note and fabricates no score', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-484'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/5');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Focus completed summary');
  assert.match(m.state.html, /no productivity score is invented/);
  m.click('fcs-score');
  assert.match(m.state.html, /no fabricated productivity score is generated/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fcs-note', value: 'x'.repeat(141) } });
  m.click('fcs-save');
  assert.match(m.state.html, /Note must be 140 characters or fewer\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-fcs-note', value: 'Finished the outline' } });
  m.click('fcs-save');
  assert.match(m.state.html, /Note saved locally; editable later\./);
  m.click('fcs-again');
  assert.match(m.state.html, /New 25-minute session started\./);
  assert.match(m.state.html, /not written to regular history without deliberate save/);
});

test('s-485 focus recovery restores monotonic time and avoids tick spam', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-485'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://focus/6');
  assert.equal(m.dataset.onboardingPhase, 'p24');
  assert.equal(m.dataset.atlasCategory, 'focus-distraction-time-awareness');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Focus interrupted recovery');
  assert.match(m.state.html, /OS process eviction during focus/);
  m.click('fcr-tick');
  assert.match(m.state.html, /not spammed each second/);
  m.click('fcr-clock');
  assert.match(m.state.html, /prevents a negative countdown/);
  m.click('fcr-resume');
  assert.match(m.state.html, /Resumed from the monotonic deadline; no time lost or invented\./);
  m.click('fcr-reset');
  assert.match(m.state.html, /Session reset cleanly; timer returns to idle\./);
});

test('s-486 workflow library keeps versioned definitions and refuses executable imports', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-486'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/1');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow library');
  assert.match(m.state.html, /Editing creates a new version · receipts unchanged/);
  m.click('wfl-exec');
  assert.match(m.state.html, /downloaded executable workflow code is never run/);
  m.click('wfl-copy');
  assert.match(m.state.html, /historical receipts unchanged/);
  m.click('wfl-new');
  assert.match(m.state.html, /typed steps and an input schema/);
  m.click('wfl-run');
  assert.match(m.state.html, /receipt opened read-only/);
});

test('s-487 workflow builder allows typed steps only and bounds loops', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-487'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/2');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow builder');
  assert.match(m.state.html, /max 5 iterations, 60 s total/);
  m.click('wfb-unknown');
  assert.match(m.state.html, /unknown or downloaded commands are not allowed/);
  m.click('wfb-script');
  assert.match(m.state.html, /untrusted code cannot be added as a step/);
  m.click('wfb-add');
  assert.match(m.state.html, /Allowlisted step added/);
  m.click('wfb-validate');
  assert.match(m.state.html, /loop bounded at 5 with a 60-second timeout/);
});

test('s-488 workflow dry run makes no side effects and marks irreversible steps', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-488'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/3');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow dry run');
  assert.match(m.state.html, /Bookmark added \(reversible\) · no message or purchase/);
  m.click('wdr-send');
  assert.match(m.state.html, /dry run never sends messages or mutates website state/);
  m.click('wdr-approve');
  assert.match(m.state.html, /require approval at execution/);
  m.click('wdr-skip');
  assert.match(m.state.html, /skipped only with this explicit decision/);
  m.click('wdr-run');
  assert.match(m.state.html, /Dry run resolved 3 steps; no messages, purchases or site mutations performed\./);
});

test('s-489 execution monitor does not overclaim cancel or duplicate retries', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-489'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/4');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow execution monitor');
  assert.match(m.state.html, /1 of 5 steps completed/);
  m.click('wem-cancel');
  assert.match(m.state.html, /not claimed reversed/);
  m.click('wem-retry');
  assert.match(m.state.html, /no duplicate bookmark created/);
  m.click('wem-pause');
  assert.match(m.state.html, /Paused between safe steps; current step not started\./);
  m.click('wem-uncertain');
  assert.match(m.state.html, /marked uncertain until the adapter confirms/);
});

test('s-490 workflow approval is one-time and never exposes vault secrets', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-490'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/5');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow action approval');
  assert.match(m.state.html, /Irreversible external write/);
  m.click('wap-blanket');
  assert.match(m.state.html, /blanket approval is not offered/);
  m.click('wap-vault');
  assert.match(m.state.html, /not exposed to workflow steps/);
  m.click('wap-approve');
  assert.match(m.state.html, /approval is one-time/);
  m.click('wap-skip');
  assert.match(m.state.html, /workflow continues without it/);
  assert.match(m.state.html, /Only a direct user gesture can approve/);
});

test('s-491 run receipt undoes only reversible actions and keeps imports inert', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-491'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://automation/6');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'user-owned-browser-workflow-automation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Workflow run receipt');
  assert.match(m.state.html, /sent message not universally undoable/);
  m.click('wrr-message');
  assert.match(m.state.html, /cannot be universally undone/);
  m.click('wrr-undo');
  assert.match(m.state.html, /Bookmark addition undone; the sent message is unaffected\./);
  m.click('wrr-retry');
  assert.match(m.state.html, /queued for retry by run and step ID/);
  m.click('wrr-import');
  assert.match(m.state.html, /validated as inert data; it cannot auto-run/);
  m.click('wrr-resume');
  assert.match(m.state.html, /Resume review opened at the failed step/);
});

test('s-492 assistant dashboard requires explicit opt-in and honest hardware limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-492'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/1');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Assistant capability dashboard');
  assert.match(m.state.html, /Normal browsing requires no AI service/);
  m.click('asd-silent');
  assert.match(m.state.html, /cannot be enabled without explicit opt-in/);
  m.click('asd-hardware');
  assert.match(m.state.html, /existing hardware check passed|Hardware check passed/i);
  m.click('asd-enable');
  assert.match(m.state.html, /enabled by explicit consent/);
  m.click('asd-provider');
  assert.match(m.state.html, /consent must be given again/);
  assert.match(m.state.html, /external API · selected tab content only/);
  assert.match(m.state.html, /No page-context network requests are made/);
  assert.match(m.state.html, /No unverified no-training or confidentiality guarantee is claimed/);
});

test('s-493 assistant context previews redacted selection and treats pages as data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-493'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/2');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Assistant context preview');
  assert.match(m.state.html, /Page text is data, never instructions/);
  m.click('acp-secret');
  assert.match(m.state.html, /passwords, payment fields and unrelated tabs are excluded/);
  m.click('acp-injection');
  assert.match(m.state.html, /treated as data, not commands/);
  m.click('acp-send');
  assert.match(m.state.html, /Preview the redacted context before sending\./);
  m.click('acp-preview');
  m.click('acp-send');
  assert.match(m.state.html, /Context sent to the chosen provider; no unrelated tabs included\./);
});

test('s-494 evidence answer labels unsupported claims and never fakes quotes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-494'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/3');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Evidence-linked answer panel');
  assert.match(m.state.html, /labeled unsupported, not given a fake citation/);
  m.click('aev-quote');
  assert.match(m.state.html, /never presented as an observed source quote/);
  m.click('aev-form');
  assert.match(m.state.html, /not overwritten without a preview/);
  m.click('aev-insert');
  assert.match(m.state.html, /original draft remains recoverable/);
  m.click('aev-copy');
  assert.match(m.state.html, /copied with its source references/);
});

test('s-495 tab comparison scopes to selected IDs and saves citations', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-495'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/4');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Multi-tab comparison workspace');
  assert.match(m.state.html, /t-1042, t-1051, t-1063/);
  m.click('acm-extra');
  assert.match(m.state.html, /only explicitly selected tab IDs are compared/);
  m.click('acm-scrape');
  assert.match(m.state.html, /restricted or private content is never scraped/);
  m.click('acm-save');
  assert.match(m.state.html, /Run the comparison before saving it\./);
  m.click('acm-run');
  m.click('acm-save');
  assert.match(m.state.html, /Saved the answer and cited sources into the research collection\./);
});

test('s-496 assistant memory is opt-in, separate from history and reviewable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-496'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/5');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Assistant memory manager');
  assert.match(m.state.html, /never browsing history/);
  m.click('amm-history');
  assert.match(m.state.html, /never harvested from browsing history/);
  m.click('amm-delete');
  assert.match(m.state.html, /4 items listed for review · nothing deleted yet/);
  assert.match(m.state.html, /does not erase other browser data/);
  m.click('amm-export');
  assert.match(m.state.html, /only user-approved memory items/);
  m.click('amm-edit');
  assert.match(m.state.html, /browser history untouched/);
});

test('s-497 assistant unavailable stops cleanly and never switches silently', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-497'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://assistant/6');
  assert.equal(m.dataset.onboardingPhase, 'p25');
  assert.equal(m.dataset.atlasCategory, 'opt-in-intelligent-assistance-evidence');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Assistant blocked or unavailable state');
  assert.match(m.state.html, /never silently switches provider or returns invented output/);
  m.click('abk-silent');
  assert.match(m.state.html, /never switches provider silently/);
  m.click('abk-switch');
  assert.match(m.state.html, /requires your explicit choice/);
  m.click('abk-retry');
  assert.match(m.state.html, /request stopped without a partial answer/);
  m.click('abk-state');
  assert.match(m.state.html, /Unsupported model · no partial answer/);
  assert.match(m.state.html, /Site-provided scripts are never executed by the assistant/);
});

test('s-498 document workspace searches text and grants no document privileges', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-498'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/1');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Document workspace');
  assert.match(m.state.html, /Malformed documents gain no browser privileges/);
  m.click('dws-privilege');
  assert.match(m.state.html, /cannot gain browser privileges/);
  m.click('dws-search');
  assert.match(m.state.html, /Found 3 matches on pages 4, 9 and 12/);
  m.click('dws-image');
  assert.match(m.state.html, /searchable text is unavailable/);
  m.click('dws-outline');
  assert.match(m.state.html, /Outline hidden\./);
});

test('s-499 annotation properties preserve original bytes and use semantic labels', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-499'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/2');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Annotation properties');
  assert.match(m.state.html, /semantic name, not color-only/);
  m.click('anp-bytes');
  assert.match(m.state.html, /original PDF bytes are preserved unless saved explicitly as a copy/);
  m.click('anp-coloronly');
  assert.match(m.state.html, /color alone cannot identify annotation state/);
  m.click('anp-save');
  assert.match(m.state.html, /document hash, page and anchor/);
  m.click('anp-color');
  assert.match(m.state.html, /Green · labeled and contrast-checked/);
  m.click('anp-cancel');
  assert.match(m.state.html, /existing annotations and the original file are retained/);
});

test('s-500 document comparison fabricates nothing and invalidates stale results', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-500'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/3');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Document comparison view');
  assert.match(m.state.html, /18 of 20 pages aligned/);
  m.click('dcp-fail');
  assert.match(m.state.html, /no OCR or comparison is fabricated/);
  m.click('dcp-stale');
  assert.match(m.state.html, /previous comparison is invalidated/);
  m.click('dcp-reuse');
  assert.match(m.state.html, /stale comparison cannot be reused/);
  m.click('dcp-compare');
  assert.match(m.state.html, /Comparison produced for 18 of 20 pages/);
});

test('s-501 save copy preserves the original and discloses flattening', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-501'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/4');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Document save-copy review');
  assert.match(m.state.html, /The original is preserved by default/);
  m.click('dsv-overwrite');
  assert.match(m.state.html, /original cannot be overwritten without explicit permission/);
  m.click('dsv-flatten');
  assert.match(m.state.html, /annotations become permanent and fields are no longer editable/);
  m.click('dsv-claim');
  assert.match(m.state.html, /not presented as preserving editable fields/);
  m.click('dsv-save');
  assert.match(m.state.html, /written atomically and reopened; the original remains untouched/);
  assert.match(m.state.html, /annotation compatibility preserved unless flattened/);
});

test('s-502 document signature separates crypto signatures from drawn marks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-502'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/5');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Document signature information');
  assert.match(m.state.html, /Visual only · never labeled verified/);
  m.click('dsg-draw');
  assert.match(m.state.html, /not cryptographically verified/);
  m.click('dsg-claim');
  assert.match(m.state.html, /drawn mark cannot be advertised as a verified digital signature/);
  m.click('dsg-modify');
  assert.match(m.state.html, /signed original is not silently modified/);
  m.click('dsg-verify');
  assert.match(m.state.html, /certificate chain and timestamp recorded/);
  assert.match(m.state.html, /reported as unknown, never as verified/);
});

test('s-503 document recovery respects access controls and bounds raster work', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-503'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://documents/6');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'pdf-document-annotation-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Document unsupported or recovery state');
  assert.match(m.state.html, /1000 pages never rasterized at once/);
  m.click('dru-bypass');
  assert.match(m.state.html, /passwords, DRM and permissions are never bypassed/);
  m.click('dru-bulk');
  assert.match(m.state.html, /1000 pages are not allocated at once/);
  m.click('dru-cancel');
  assert.match(m.state.html, /temporary allocations released/);
  m.click('dru-retry');
  assert.match(m.state.html, /access control still enforced/);
});

test('s-504 capture mode limits to the active surface and preserves DRM', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-504'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/1');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Capture mode chooser');
  assert.match(m.state.html, /DRM content stays black/);
  m.click('cpm-tabs');
  assert.match(m.state.html, /other tabs and windows are never captured/);
  m.click('cpm-drm');
  assert.match(m.state.html, /protected frames stay black and cannot be reconstructed/);
  m.click('cpm-mode');
  assert.match(m.state.html, /Capture mode set to region\./);
  m.click('cpm-capture');
  assert.match(m.state.html, /unrelated tabs were not included/);
});

test('s-505 capture region rejects zero area and masks pixels irreversibly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-505'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/2');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Capture region review');
  assert.match(m.state.html, /Redaction masks pixels irreversibly/);
  m.click('crg-zero');
  assert.match(m.state.html, /Zero-area selection is rejected before allocation\./);
  m.click('crg-capture');
  assert.match(m.state.html, /Fix the selection before capturing\./);
  m.click('crg-overlay');
  assert.match(m.state.html, /removable overlay is not redaction/);
  m.click('crg-mask');
  assert.match(m.state.html, /Irreversible pixel mask applied in the exported copy\./);
  m.click('crg-done');
});

test('s-506 capture editor keeps the original and bounds memory', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-506'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/3');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Capture annotation editor');
  assert.match(m.state.html, /Tiled within limits/);
  m.click('cae-cancel');
  assert.match(m.state.html, /cancel never deletes the original capture/);
  m.click('cae-crop');
  assert.match(m.state.html, /original capture is retained/);
  m.click('cae-text');
  assert.match(m.state.html, /Text annotation added to the edited copy\./);
  m.click('cae-undo');
  assert.match(m.state.html, /Last edit undone; original unchanged\./);
  m.click('cae-save');
  assert.match(m.state.html, /original capture is retained\./);
  assert.match(m.state.html, /explicit user-selected bound/);
});

test('s-507 print layout maps native support and never claims omitted pages', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-507'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/4');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Print layout editor');
  assert.match(m.state.html, /1–4 · verified against the preview/);
  m.click('prl-unsupported');
  assert.match(m.state.html, /A3 is unavailable on this printer/);
  m.click('prl-omit');
  assert.match(m.state.html, /never claims omitted pages will print/);
  m.click('prl-paper');
  assert.match(m.state.html, /Letter portrait · pages 1–4 of 12/);
  m.click('prl-preview');
  assert.match(m.state.html, /Preview matches Letter portrait, pages 1–4 at 100%\./);
  m.click('prl-cancel');
  assert.match(m.state.html, /last committed print layout retained/);
});

test('s-508 export destination sanitizes names and verifies real format', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-508'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/5');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Export destination review');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-edx-name', value: '../evil.png' } });
  m.click('edx-export');
  assert.match(m.state.html, /Unsafe filename rejected/);
  m.click('edx-overwrite');
  assert.match(m.state.html, /existing file cannot be overwritten without permission/);
  m.click('edx-rename');
  assert.match(m.state.html, /changing the extension does not convert/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-edx-name', value: 'capture.png' } });
  m.click('edx-export');
  assert.match(m.state.html, /verified the actual PNG signature/);
  assert.match(m.state.html, /names the format and the full destination path/);
});

test('s-509 capture failure releases temp memory and never bypasses DRM', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-509'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://capture/6');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'page-capture-print-export');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Capture/print failure recovery');
  assert.match(m.state.html, /cannot be captured or reconstructed/);
  m.click('cfr-bypass');
  assert.match(m.state.html, /protected pages and DRM cannot be bypassed/);
  m.click('cfr-upload');
  assert.match(m.state.html, /never uploaded or synced automatically/);
  m.click('cfr-cancel');
  assert.match(m.state.html, /temporary allocations released and original assets retained/);
  m.click('cfr-state');
  assert.match(m.state.html, /Allocation limit reached/);
});

test('s-510 download queue uses native states and never invents percentages', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-510'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/1');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download queue manager');
  assert.match(m.state.html, /length unknown, no fake percentage/);
  m.click('dlq-fake');
  assert.match(m.state.html, /unknown length is shown as unknown/);
  m.click('dlq-cancel');
  assert.match(m.state.html, /Canceled one item only; other downloads are unaffected\./);
  m.click('dlq-pause');
  assert.match(m.state.html, /unrelated downloads continue/);
  m.click('dlq-priority');
  assert.match(m.state.html, /prioritized within queue limits/);
  m.click('dlq-search');
  assert.match(m.state.html, /download states unchanged/);
});

test('s-511 download integrity blocks completion on hash mismatch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-511'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/2');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download origin and integrity detail');
  assert.match(m.state.html, /spoofed-origin warnings preserved/);
  m.click('dli-mismatch');
  m.click('dli-complete');
  assert.match(m.state.html, /hash mismatch can never be labeled completed/);
  m.click('dli-verify');
  assert.match(m.state.html, /Digest and actual size verified/);
  m.click('dli-name');
  assert.match(m.state.html, /no hidden double extension/);
  assert.match(m.state.html, /Traversal segments are stripped/);
});

test('s-512 download destination previews conflict policy and keeps last file', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-512'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/3');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download destination chooser');
  assert.match(m.state.html, /Temporary file reserved · renamed only on completion/);
  m.click('dld-overwrite');
  assert.match(m.state.html, /never overwritten without explicit permission/);
  m.click('dld-policy');
  assert.match(m.state.html, /Conflict policy set to Rename\./);
  m.click('dld-full');
  assert.match(m.state.html, /last valid file retained/);
  m.click('dld-confirm');
  assert.match(m.state.html, /Reserved temporary space and prepared the partial file/);
});

test('s-513 download resumption requires matching identity and explicit restart', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-513'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/4');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download resumption review');
  m.click('dlr-change');
  m.click('dlr-resume');
  assert.match(m.state.html, /Resume disabled: the remote identity changed\./);
  m.click('dlr-append');
  assert.match(m.state.html, /cannot be appended to old partial bytes/);
  m.click('dlr-restart');
  assert.match(m.state.html, /Restarted the transfer explicitly/);
  m.click('dlr-change');
  m.click('dlr-resume');
  assert.match(m.state.html, /Resumed from 8.4 MB; ETag matched\./);
  m.click('dlr-metered');
  assert.match(m.state.html, /never starts silently/);
});

test('s-514 quarantine keeps checks mandatory and separates entry from file', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-514'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/5');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download quarantine review');
  assert.match(m.state.html, /Clearing a list entry is distinct from deleting the file/);
  m.click('dqr-open');
  assert.match(m.state.html, /mandatory threat checks cannot be bypassed/);
  m.click('dqr-clear');
  assert.match(m.state.html, /quarantined file remains on disk/);
  m.click('dqr-report');
  assert.match(m.state.html, /stays quarantined until reviewed/);
  m.click('dqr-delete');
  assert.match(m.state.html, /Quarantined file deleted; no other files affected\./);
});

test('s-515 download failure offers retry and never claims saved after OS denial', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-515'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://downloads/6');
  assert.equal(m.dataset.onboardingPhase, 'p26');
  assert.equal(m.dataset.atlasCategory, 'advanced-download-file-lifecycle');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Download failure recovery');
  assert.match(m.state.html, /no continuous guarantee/);
  m.click('dlf-retry');
  assert.match(m.state.html, /partial bytes retained for resume/);
  m.click('dlf-dest');
  assert.match(m.state.html, /partial data moved safely/);
  m.click('dlf-state');
  m.click('dlf-saved');
  assert.match(m.state.html, /OS denied the write, so the download is not saved/);
});

test('s-516 media center uses real sessions and preserves call priority', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-516'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/1');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Global media center');
  assert.match(m.state.html, /Call audio keeps priority over page media/);
  m.click('mdc-call');
  assert.match(m.state.html, /cannot mute an active call without explicit action/);
  m.click('mdc-mute');
  assert.match(m.state.html, /Muted the selected tab only\./);
  m.click('mdc-solo');
  assert.match(m.state.html, /active call stays prioritized/);
  m.click('mdc-play');
  assert.match(m.state.html, /actual engine state/);
});

test('s-517 media detail reports observed stats and honest decode limits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-517'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/2');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Per-tab media detail');
  assert.match(m.state.html, /never guessed from the URL/);
  m.click('mdt-guess');
  assert.match(m.state.html, /never guessed from the URL/);
  m.click('mdt-codec');
  assert.match(m.state.html, /not force-enabled/);
  m.click('mdt-software');
  assert.match(m.state.html, /Software decode enabled as an explicit fallback\./);
  m.click('mdt-refresh');
  assert.match(m.state.html, /Stats refreshed from the active media session\./);
});

test('s-518 media playlist labels online and offline items truthfully', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-518'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/3');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Media playlist library');
  assert.match(m.state.html, /10 links · clearly not playable offline/);
  m.click('mpl-label');
  assert.match(m.state.html, /online-only link cannot be labeled offline playable/);
  m.click('mpl-drm');
  assert.match(m.state.html, /DRM-protected streams are never downloaded/);
  m.click('mpl-add');
  assert.match(m.state.html, /stable ID and URL metadata/);
});

test('s-519 playlist editor validates sources and never deletes media files', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-519'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/4');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Playlist editor');
  m.click('ple-add');
  assert.match(m.state.html, /Enter an https media URL\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ple-src', value: 'ftp://media.example/x' } });
  m.click('ple-add');
  assert.match(m.state.html, /Only validated https media URLs are accepted\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-ple-src', value: 'https://media.example/watch' } });
  m.click('ple-add');
  assert.match(m.state.html, /stable identity; order saved/);
  m.click('ple-delete');
  assert.match(m.state.html, /never deletes the media file without explicit consent/);
  m.click('ple-remove');
  assert.match(m.state.html, /playlist entry removed, media file kept/);
  m.click('ple-move');
  assert.match(m.state.html, /new order persisted with undo available/);
  assert.match(m.state.html, /saved with the playlist/);
});

test('s-520 playback compatibility claims only licensed DRM and falls back safely', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-520'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/5');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Playback compatibility state');
  assert.match(m.state.html, /4K not licensed/);
  m.click('pbc-fairplay');
  assert.match(m.state.html, /FairPlay licensing is never claimed/);
  m.click('pbc-drm');
  assert.match(m.state.html, /playback stops with an explanation and no bypass/);
  m.click('pbc-pip');
  assert.match(m.state.html, /without duplicate audio/);
  m.click('pbc-check');
  assert.match(m.state.html, /Licensed Widevine L3 available/);
});

test('s-521 media continuity transfers only URL and position, never DRM keys', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-521'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://media/6');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'advanced-video-audio-media-continuity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Media continuity review');
  assert.match(m.state.html, /DRM keys and cookies never transfer/);
  m.click('mcy-drm');
  assert.match(m.state.html, /raw DRM keys, cookies and protected media are never transferred/);
  m.click('mcy-4k');
  assert.match(m.state.html, /4K is not available on the destination/);
  m.click('mcy-quality');
  assert.match(m.state.html, /Measured 1080p with 12 dropped frames/);
  m.click('mcy-send');
  assert.match(m.state.html, /approved URL and 12:40 position/);
  assert.match(m.state.html, /silent reduction never counts as a memory or energy win/);
});

test('s-522 live collaboration uses engine events and keeps capture visible', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-522'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/1');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Live collaboration status');
  assert.match(m.state.html, /titles are not evidence/);
  m.click('rtc-title');
  assert.match(m.state.html, /tab title cannot establish an active call/);
  m.click('rtc-silent');
  assert.match(m.state.html, /background screen sharing is never silent/);
  m.click('rtc-stop');
  assert.match(m.state.html, /indicator clears only after the engine confirms/);
});

test('s-523 call protection blocks discard and reports observed stats honestly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-523'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/2');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Call protection detail');
  assert.match(m.state.html, /Optional maintenance cannot discard, freeze or restart an active call/);
  m.click('clp-discard');
  assert.match(m.state.html, /cannot be discarded or frozen by optional maintenance/);
  m.click('clp-refresh');
  assert.match(m.state.html, /0.4% packet loss from engine stats/);
  m.click('clp-os');
  assert.match(m.state.html, /OS process termination remains possible/);
  m.click('clp-end');
  assert.match(m.state.html, /protected lease released/);
});

test('s-524 device selection preserves the call and hides persistent IDs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-524'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/3');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Device selection sheet');
  assert.match(m.state.html, /no persistent unique IDs exposed/);
  m.click('dvs-id');
  assert.match(m.state.html, /persistent unique device IDs are not exposed/);
  m.click('dvs-mic');
  assert.match(m.state.html, /call preserved and the new device confirmed/);
  m.click('dvs-cam');
  assert.match(m.state.html, /Camera disabled; call preserved\./);
  m.click('dvs-out');
  assert.match(m.state.html, /Output device switched; the call continues\./);
  m.click('dvs-fail');
  assert.match(m.state.html, /previous microphone stays active/);
});

test('s-525 screen share scope requires OS consent and verified stop', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-525'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/4');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Screen-share scope review');
  assert.match(m.state.html, /not the whole display/);
  m.click('sss-display');
  assert.match(m.state.html, /cannot select the entire display silently/);
  m.click('sss-early');
  assert.match(m.state.html, /never cleared before actual cessation/);
  m.click('sss-stop');
  assert.match(m.state.html, /stays until the engine and OS confirm/);
  assert.match(m.state.html, /single tab can be selected/);
});

test('s-526 call recovery reconnects without replaying forms or syncing private data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-526'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/5');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Connection recovery state');
  assert.match(m.state.html, /Unrelated submitted forms are not replayed/);
  m.click('cre-form');
  assert.match(m.state.html, /never replayed automatically/);
  m.click('cre-sync');
  assert.match(m.state.html, /never enters regular history or sync/);
  m.click('cre-reconnect');
  assert.match(m.state.html, /Reconnected on the new network; call tab preserved\./);
  assert.match(m.state.html, /captured audio and video are never included/);
});

test('s-527 call benchmark blocks release on interruption and quality mismatches', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-527'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://realtime/6');
  assert.equal(m.dataset.onboardingPhase, 'p27');
  assert.equal(m.dataset.atlasCategory, 'webrtc-conferencing-live-collaboration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Collaboration benchmark report');
  assert.match(m.state.html, /720p · 3 participants · 20 minutes/);
  m.click('cbr-claim');
  assert.match(m.state.html, /lower call quality cannot be counted as an efficiency win/);
  m.click('cbr-interrupt');
  assert.match(m.state.html, /Protected call interruption detected; release is blocked\./);
  m.click('cbr-run');
  assert.match(m.state.html, /Compared matched calls; CPU, energy and quality measured\./);
});

test('s-528 extension catalog reports pinned-engine support and rejects unknown packages', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-528'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/1');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension capability catalog');
  assert.match(m.state.html, /not assumed Chrome parity/);
  m.click('exc-parity');
  assert.match(m.state.html, /Chrome parity is never assumed/);
  m.click('exc-unknown');
  assert.match(m.state.html, /unrecognized package is never installed automatically/);
  m.click('exc-check');
  assert.match(m.state.html, /pinned engine; unsupported APIs are labeled/);
  m.click('exc-unsupported');
  assert.match(m.state.html, /Unsupported API hidden from the list\./);
});

test('s-529 extension permission diff never inherits privileges without approval', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-529'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/2');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension permission diff');
  assert.match(m.state.html, /Remains active until the update is approved/);
  m.click('xpd-inherit');
  assert.match(m.state.html, /never inherited without explicit approval/);
  m.click('xpd-data');
  assert.match(m.state.html, /failed update cannot delete extension data/);
  m.click('xpd-cancel');
  assert.match(m.state.html, /prior verified version remains active/);
  m.click('xpd-approve');
  assert.match(m.state.html, /widened permissions are now active/);
});

test('s-530 extension site access stays exact-host and private off by default', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-530'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/3');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension site access editor');
  assert.match(m.state.html, /Extension unavailable by default/);
  m.click('exs-wildcard');
  assert.match(m.state.html, /separate broad-access review/);
  m.click('exs-mode');
  assert.match(m.state.html, /Duration set to Once\./);
  m.click('exs-grant');
  assert.match(m.state.html, /Granted Once access to news\.example only\./);
  m.click('exs-revoke');
  assert.match(m.state.html, /Access revoked and verified for the exact host\./);
  assert.match(m.state.html, /never enters regular extension storage/);
});

test('s-531 extension activity avoids double counting and disables without deleting', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-531'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/4');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension activity inspector');
  assert.match(m.state.html, /not double-counted/);
  m.click('exa-double');
  assert.match(m.state.html, /shared renderer cost is not double-counted/);
  m.click('exa-delete');
  assert.match(m.state.html, /compatibility test never deletes the extension/);
  m.click('exa-disable');
  assert.match(m.state.html, /package and data remain/);
  m.click('exa-refresh');
  assert.match(m.state.html, /refreshed from supported engine accounting/);
  assert.match(m.state.html, /site isolation and browser security unchanged/);
});

test('s-532 extension quarantine keeps evidence and restores only verified versions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-532'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/5');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension quarantine recovery');
  assert.match(m.state.html, /Manifest and package retained for review/);
  m.click('exq-run');
  assert.match(m.state.html, /suspect extension code is never executed/);
  m.click('exq-vuln');
  assert.match(m.state.html, /known vulnerable version cannot be restored/);
  m.click('exq-restore');
  assert.match(m.state.html, /Verified 2.1 restored through the supported mechanism\./);
});

test('s-533 extension portability syncs metadata only and keeps Rasha independent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-533'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://extensions/6');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'extensions-capability-compatibility');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Extension portability review');
  assert.match(m.state.html, /no vendor blocker package/);
  m.click('exp-creds');
  assert.match(m.state.html, /credentials are excluded from portability sync/);
  m.click('exp-parity');
  assert.match(m.state.html, /parity is not claimed by name on mobile/);
  m.click('exp-sync');
  assert.match(m.state.html, /Synced metadata for 2 supported extensions; credentials excluded\./);
});

test('s-534 web app install binds identity and requires explicit consent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-534'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/1');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Web app installation review');
  assert.match(m.state.html, /Installation requires an explicit action/);
  m.click('win-auto');
  assert.match(m.state.html, /auto-install without user consent/);
  m.click('win-spoof');
  assert.match(m.state.html, /cannot spoof another installed app identity/);
  m.click('win-install');
  assert.match(m.state.html, /identity bound to docs\.example/);
});

test('s-535 installed apps bind identity and review updates', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-535'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/2');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Installed web apps manager');
  assert.match(m.state.html, /Same-title apps never overwrite each other/);
  m.click('ina-overwrite');
  assert.match(m.state.html, /same title cannot overwrite another identity/);
  m.click('ina-launch');
  assert.match(m.state.html, /validated origin and profile context/);
  m.click('ina-update');
  assert.match(m.state.html, /origin and scope unchanged; identity verified/);
  m.click('ina-remove');
  assert.match(m.state.html, /site-data retention is a separate choice/);
});

test('s-536 app window keeps origin and escape path visible', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-536'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/3');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Web app window settings');
  assert.match(m.state.html, /security origin and escape path stay accessible/);
  m.click('iww-origin');
  assert.match(m.state.html, /security origin cannot be hidden/);
  m.click('iww-escape');
  assert.match(m.state.html, /escape path to trusted chrome must stay accessible/);
  m.click('iww-mode');
  assert.match(m.state.html, /origin indicator and escape path remain available/);
  assert.match(m.state.html, /removable without deleting app data/);
});

test('s-537 web app offline status claims only supported routes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-537'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/4');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Offline web app status');
  assert.match(m.state.html, /not all web apps/);
  m.click('iwo-claim');
  assert.match(m.state.html, /not guaranteed for all web apps/);
  m.click('iwo-revoke');
  assert.match(m.state.html, /unrelated data untouched/);
  m.click('iwo-check');
  assert.match(m.state.html, /supported routes only/);
});

test('s-538 app permissions keep origin policy and explicit notification consent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-538'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/5');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Web app permission review');
  assert.match(m.state.html, /Installed status never bypasses prompts/);
  m.click('iwp-bypass');
  assert.match(m.state.html, /cannot bypass camera, microphone or location prompts/);
  m.click('iwp-notify');
  assert.match(m.state.html, /only after explicit user intent/);
  m.click('iwp-revoke');
  assert.match(m.state.html, /Notifications revoked; OS\/engine state reflected\./);
});

test('s-539 app unavailable separates removal scope and keeps files', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-539'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://webapps/6');
  assert.equal(m.dataset.onboardingPhase, 'p28');
  assert.equal(m.dataset.atlasCategory, 'installable-web-apps-offline-workflows');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Web app unavailable or removal state');
  assert.match(m.state.html, /not labeled installed app/);
  m.click('wrm-shortcut');
  assert.match(m.state.html, /shortcut is not labeled a fully installed web app/);
  m.click('wrm-remove');
  assert.match(m.state.html, /site data and downloaded files retained/);
  m.click('wrm-data');
  assert.match(m.state.html, /explicitly; downloaded files retained/);
  m.click('wrm-cancel');
  assert.match(m.state.html, /app, data and files unchanged/);
});

test('s-540 developer studio attaches only to the selected target', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-540'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/1');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Developer studio launcher');
  assert.match(m.state.html, /Only the selected tab is attached/);
  m.click('dvk-chrome');
  assert.match(m.state.html, /webpage cannot attach to privileged browser chrome/);
  m.click('dvk-panel');
  assert.match(m.state.html, /Unsupported panel is labeled rather than simulated/);
  m.click('dvk-attach');
  assert.match(m.state.html, /Attached to the selected tab/);
  m.click('dvk-detach');
  assert.match(m.state.html, /session and profiling resources released/);
});

test('s-541 network trace redacts secrets and keeps private traces local', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-541'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/2');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Network trace workspace');
  assert.match(m.state.html, /CSS hides are not counted as blocked requests/);
  m.click('ntw-raw');
  assert.match(m.state.html, /stay masked by default/);
  m.click('ntw-persist');
  assert.match(m.state.html, /never persisted or uploaded/);
  m.click('ntw-start');
  assert.match(m.state.html, /Capture started for the selected target/);
  m.click('ntw-stop');
  assert.match(m.state.html, /events retained in memory until detach/);
  assert.match(m.state.html, /private records stay local/);
});

test('s-542 performance trace is bounded and never fabricates CPU data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-542'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/3');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Performance trace workspace');
  assert.match(m.state.html, /Stops on target close or explicit detach/);
  m.click('ptc-fabricate');
  assert.match(m.state.html, /frame and CPU data are never fabricated/);
  m.click('ptc-stale');
  assert.match(m.state.html, /cannot continue silently against a new origin/);
  m.click('ptc-start');
  assert.match(m.state.html, /Trace started with bounded sampling/);
  m.click('ptc-stop');
  assert.match(m.state.html, /Trace stopped; resources released\./);
  assert.match(m.state.html, /User and engine markers recorded with timestamps/);
});

test('s-543 storage inspection scopes to origin and confirms deletes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-543'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/4');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Storage inspection workspace');
  assert.match(m.state.html, /no cross-profile access/);
  m.click('dsi-cross');
  assert.match(m.state.html, /another profile is not accessible/);
  m.click('dsi-bulk');
  assert.match(m.state.html, /bulk deletion requires explicit scope/);
  m.click('dsi-delete');
  assert.match(m.state.html, /Preview the exact key before deletion/);
  m.click('dsi-delete');
  assert.match(m.state.html, /Selected key deleted; other storage preserved\./);
  m.click('dsi-cancel');
  assert.match(m.state.html, /all storage preserved/);
});

test('s-544 remote debugging pairs locally and revokes cleanly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-544'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/5');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Remote device debugging review');
  assert.match(m.state.html, /never public by default/);
  m.click('rdb2-public');
  assert.match(m.state.html, /never exposed publicly by default/);
  m.click('rdb2-stale');
  assert.match(m.state.html, /closed session token cannot reattach silently/);
  m.click('rdb2-pair');
  assert.match(m.state.html, /authorized for the selected app only/);
  m.click('rdb2-revoke');
  assert.match(m.state.html, /disconnect confirmed and token expired/);
});

test('s-545 debug export verifies files and blocks privileged data escape', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-545'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://devtools/6');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'browser-developer-studio');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Debug export and detach');
  assert.match(m.state.html, /no cookies or tokens/);
  m.click('dex-leak');
  assert.match(m.state.html, /privileged browser data cannot escape/);
  m.click('dex-overwrite');
  assert.match(m.state.html, /existing trace is not overwritten without approval/);
  m.click('dex-export');
  assert.match(m.state.html, /verified by reopening/);
  m.click('dex-detach');
  assert.match(m.state.html, /Detached safely; session resources released\./);
});

test('s-546 compatibility library records build context and blocks homepage-only claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-546'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/1');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Compatibility scenario library');
  assert.match(m.state.html, /2026\.11 · pinned/);
  m.click('csl-homepage');
  assert.match(m.state.html, /homepage load cannot certify banking or payment compatibility/);
  m.click('csl-unknown');
  assert.match(m.state.html, /unknown version cannot be compared/);
  m.click('csl-run');
  assert.match(m.state.html, /pinned fixtures with the recorded build and engine/);
});

test('s-547 site capability separates outcomes and never counts skips as passes', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-547'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/2');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Site capability report');
  assert.match(m.state.html, /Counted separately · never as pass/);
  m.click('cap2-unsupported');
  assert.match(m.state.html, /unsupported API is never relabeled as pass/);
  m.click('cap2-skip');
  assert.match(m.state.html, /skipped cases are not counted as passes/);
  m.click('cap2-run');
  assert.match(m.state.html, /pass, blocked, unsupported and failed cases stay separate/);
  assert.match(m.state.html, /128\.0\.6613\.84 · exact shipped revision/);
});

test('s-548 regression comparison blocks scoring when the workflow is broken', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-548'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/3');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Regression comparison workspace');
  assert.match(m.state.html, /Task success, visual fidelity and data preservation come before/);
  m.click('rgn-fail');
  assert.match(m.state.html, /comparison is blocked until the workflow works/);
  m.click('rgn-score');
  assert.match(m.state.html, /broken page cannot be scored faster/);
  m.click('rgn-run');
  assert.match(m.state.html, /task success verified/);
  assert.match(m.state.html, /not attributed solely to VAAYVU/);
});

test('s-549 standards explorer shows denominators and per-platform results', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-549'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/4');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Web standards result explorer');
  assert.match(m.state.html, /1,240 of 1,310 runnable tests/);
  m.click('wpe-cherry');
  assert.match(m.state.html, /pass rate cannot be cherry-picked without the full denominator/);
  m.click('wpe-device');
  assert.match(m.state.html, /one device cannot certify all platforms/);
  m.click('wpe-run');
  assert.match(m.state.html, /denominator, exclusions and expected failures preserved/);
});

test('s-550 compatibility exception stays narrow and never lowers isolation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-550'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/5');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Compatibility exception review');
  assert.match(m.state.html, /14-day expiry/);
  m.click('cpx-isolation');
  assert.match(m.state.html, /mandatory engine isolation and certificate safety are never lowered/);
  m.click('cpx-blocked');
  assert.match(m.state.html, /blocked checkout or control prevents rule release/);
  m.click('cpx-approve');
  assert.match(m.state.html, /expiry and security impact recorded/);
});

test('s-551 release gate blocks critical issues and refuses universal claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-551'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://compatibility/6');
  assert.equal(m.dataset.onboardingPhase, 'p29');
  assert.equal(m.dataset.atlasCategory, 'website-compatibility-standards-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Release-blocking compatibility report');
  assert.match(m.state.html, /1 critical/);
  m.click('rbg-hide');
  assert.match(m.state.html, /cannot be hidden by adding UI screens/);
  m.click('rbg-claim');
  assert.match(m.state.html, /no universal fastest or safest claim/);
  m.click('rbg-open');
  assert.match(m.state.html, /Gate remains blocked/);
});

test('s-552 benchmark workload matches conditions and retains failed runs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-552'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/1');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark workload designer');
  assert.match(m.state.html, /100 tabs only where safe memory exists/);
  m.click('bwd-resolution');
  assert.match(m.state.html, /different playback or display resolution cannot be compared/);
  m.click('bwd-drop');
  assert.match(m.state.html, /failed or OOM runs remain in the report/);
  m.click('bwd-validate');
  assert.match(m.state.html, /identical hardware, engine, fixtures and repetitions/);
});

test('s-553 benchmark runner separates startup from navigation and refuses splash claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-553'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/2');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark runner dashboard');
  assert.match(m.state.html, /interactive UI, not a splash/);
  m.click('brd-splash');
  assert.match(m.state.html, /splash screen does not count as usable startup/);
  m.click('brd-universal');
  assert.match(m.state.html, /does not establish universal speed/);
  m.click('brd-start');
  assert.match(m.state.html, /Run started with the recorded repetitions\./);
  m.click('brd-stop');
  assert.match(m.state.html, /partial results retained/);
  assert.match(m.state.html, /interrupted runs retained/);
});

test('s-554 resource comparison avoids double counting and shortened-task wins', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-554'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/3');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Resource comparison explorer');
  assert.match(m.state.html, /Both recorded separately/);
  m.click('rsc-double');
  assert.match(m.state.html, /shared RSS is not added twice/);
  m.click('rsc-short');
  assert.match(m.state.html, /lower energy from a failed or shortened task is not a win/);
  m.click('rsc-refresh');
  assert.match(m.state.html, /peak\/steady state shown/);
  assert.match(m.state.html, /Refresh rate and resolution documented/);
});

test('s-555 outlier review keeps distribution and environment context', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-555'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/4');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Benchmark outlier review');
  assert.match(m.state.html, /thermal throttling recorded/);
  m.click('bov-drop');
  assert.match(m.state.html, /outliers with reasons are retained/);
  m.click('bov-best');
  assert.match(m.state.html, /best-only headline cannot replace the full distribution/);
  m.click('bov-review');
  assert.match(m.state.html, /reasons for every outlier/);
  assert.match(m.state.html, /tagged invalid and repeated/);
});

test('s-556 matcher microbenchmark compares only equivalent coverage', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-556'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/5');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Rasha matcher microbenchmark');
  assert.match(m.state.html, /Equivalent coverage and false-positive burden required/);
  m.click('rmb-small');
  assert.match(m.state.html, /smaller rule list alone cannot establish a superior blocker/);
  m.click('rmb-coverage');
  assert.match(m.state.html, /equivalent labeled coverage and FP burden/);
  m.click('rmb-run');
  assert.match(m.state.html, /Measured compile, lookup, memory, coverage and false positives\./);
  assert.match(m.state.html, /Labeled fixtures with known true and false positives/);
});

test('s-557 evidence report refuses universal claims and unsafe tradeoffs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-557'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://benchmark/6');
  assert.equal(m.dataset.onboardingPhase, 'p30');
  assert.equal(m.dataset.atlasCategory, 'competitive-performance-resource-laboratory');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Competitive evidence release report');
  assert.match(m.state.html, /Security or functionality regression cannot be traded/);
  m.click('bre-victory');
  assert.match(m.state.html, /no universal victory or multi-year lead claim/);
  m.click('bre-trade');
  assert.match(m.state.html, /cannot be traded for score/);
  m.click('bre-export');
  assert.match(m.state.html, /denominator, dates, versions and tradeoffs/);
  assert.match(m.state.html, /Known limitations published with the report/);
});

test('s-558 preset studio keeps shared state and the original default', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-558'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/s-558');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'appearance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Preset studio');
  assert.match(m.state.html, /Original stays the default/);
  m.click('pss-reset');
  assert.match(m.state.html, /never resets tabs, bookmarks or preferences/);
  m.click('pss-observatory');
  assert.match(m.state.html, /same navigation and real state preserved/);
  m.click('pss-preview');
  assert.match(m.state.html, /previewed without committing/);
  m.click('pss-original');
  assert.match(m.state.html, /Original preset active/);
});

test('s-559 theme gallery uses local assets and no fake data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-559'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/2');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'adaptive-design-system-two-presets');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Theme scene gallery');
  assert.match(m.state.html, /no network wallpaper/);
  m.click('tsg-fetch');
  assert.match(m.state.html, /no network fetch or tracker/);
  m.click('tsg-fake');
  assert.match(m.state.html, /fake weather, headlines or protection metrics are never shown/);
  m.click('tsg-next');
  assert.match(m.state.html, /Scene set to Ridge using local assets\./);
});

test('s-560 material controls honor contrast and motion preferences', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-560'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/3');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'adaptive-design-system-two-presets');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Native material controls');
  assert.match(m.state.html, /Safety text stays above the approved threshold/);
  m.click('nmc-glass');
  assert.match(m.state.html, /trusted security prompts are never drawn in ornamental glass/);
  m.click('nmc-motion');
  assert.match(m.state.html, /reduce-motion is respected/);
  m.click('nmc-solid');
  assert.match(m.state.html, /Solid high-contrast fallback active\./);
  assert.match(m.state.html, /never delays navigation or obscures focus/);
});

test('s-561 toolbar editor keeps origin controls and resets appearance only', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-561'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/4');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'adaptive-design-system-two-presets');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Toolbar arrangement editor');
  assert.match(m.state.html, /Origin and security controls always shown/);
  m.click('tba-remove');
  assert.match(m.state.html, /cannot be removed/);
  m.click('tba-move');
  assert.match(m.state.html, /new toolbar order saved/);
  m.click('tba-reset');
  assert.match(m.state.html, /history, Rasha rules and data preserved/);
  m.click('tba-icon');
  assert.match(m.state.html, /accessible name retained/);
  assert.match(m.state.html, /Pointer drag and keyboard controls produce the same order/);
});

test('s-562 responsive chrome keeps origin visible and avoids fake controls', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-562'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/s-562');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'appearance');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Responsive chrome');
  assert.match(m.state.html, /Actual origin always visible/);
  m.click('rcp-clip');
  assert.match(m.state.html, /cannot be clipped/);
  m.click('rcp-fake');
  assert.match(m.state.html, /fake system controls that conflict with OS behavior/);
  m.click('rcp-cycle');
  assert.match(m.state.html, /Width set to Tablet; safe areas reapplied\./);
});

test('s-563 appearance fallback keeps preference and requires a11y checks', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-563'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://appearance/6');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'adaptive-design-system-two-presets');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Appearance fallback state');
  assert.match(m.state.html, /Fallback never overwrites the saved preference/);
  m.click('afb-overwrite');
  assert.match(m.state.html, /never overwrites the persistent preference/);
  m.click('afb-pixel');
  assert.match(m.state.html, /pixel match alone cannot replace functional and accessibility checks/);
  m.click('afb-toggle');
  assert.match(m.state.html, /Native material restored where supported\./);
});

test('s-564 accessibility overview keeps labels and untruncated origin', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-564'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/1');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Accessibility preference overview');
  assert.match(m.state.html, /Origin and security text never truncated/);
  m.click('a11y-icon');
  assert.match(m.state.html, /icon-only control without an accessible name blocks release/);
  m.click('a11y-origin');
  assert.match(m.state.html, /never truncated below readable size/);
  m.click('a11y-labels');
  assert.match(m.state.html, /role, accessible name, state and help/);
  m.click('a11y-scale');
  assert.match(m.state.html, /250% · controls remain navigable/);
});

test('s-565 keyboard editor rejects reserved and duplicate chords', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-565'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/2');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Keyboard command editor');
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kce-chord', value: 'Cmd+Tab' } });
  m.click('kce-assign');
  assert.match(m.state.html, /reserved by the OS/);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kce-chord', value: '⌘K' } });
  m.click('kce-assign');
  assert.match(m.state.html, /Duplicate chord already assigned to search\./);
  m.overlay.oninput({ target: { hasAttribute: (n) => n === 'data-kce-chord', value: '⌘L' } });
  m.click('kce-assign');
  assert.match(m.state.html, /Chord assigned; conflict check passed\./);
  m.click('kce-reset');
  assert.match(m.state.html, /Default shortcut restored; other shortcuts unchanged\./);
  m.click('kce-os');
  assert.match(m.state.html, /reserved OS shortcut cannot be silently overridden/);
  assert.match(m.state.html, /available only on hover is a release failure/);
});

test('s-566 assistive navigation restores focus and forbids gesture-only actions', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-566'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/3');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Assistive navigation guide');
  assert.match(m.state.html, /Focus returns after dialogs/);
  m.click('asn-modal');
  assert.match(m.state.html, /focus cannot escape a modal/);
  m.click('asn-gesture');
  assert.match(m.state.html, /touch-only gesture cannot be the sole path/);
  m.click('asn-focus');
  assert.match(m.state.html, /focus restored to the invoking control/);
});

test('s-567 language preview protects host text and IME composition', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-567'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/4');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Language and direction preview');
  assert.match(m.state.html, /Telugu script rendered locally/);
  m.click('ldp-ime');
  assert.match(m.state.html, /cannot trigger a premature search/);
  m.click('ldp-bidi');
  assert.match(m.state.html, /cannot obscure the registrable host/);
  m.click('ldp-rtl');
  assert.match(m.state.html, /host text remains readable/);
  assert.match(m.state.html, /expand 30% without clipping controls/);
});

test('s-568 accessibility audit requires real AT evidence and contrast', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-568'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/5');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Accessibility audit report');
  assert.match(m.state.html, /Automated scan alone cannot certify/);
  m.click('aar-auto');
  assert.match(m.state.html, /automated scanner alone cannot certify complete usability/);
  m.click('aar-contrast');
  assert.match(m.state.html, /cannot fall below the approved contrast threshold/);
  m.click('aar-run');
  assert.match(m.state.html, /VoiceOver, TalkBack and desktop screen-reader evidence/);
});

test('s-569 accessibility fallback preserves capability and settings', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-569'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://accessibility/6');
  assert.equal(m.dataset.onboardingPhase, 'p31');
  assert.equal(m.dataset.atlasCategory, 'accessibility-localization-inclusive-interaction');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Accessibility fallback state');
  m.click('afb2-remove');
  assert.match(m.state.html, /never removes user capability/);
  m.click('afb2-reset');
  assert.match(m.state.html, /does not reset unrelated settings/);
  m.click('afb2-show');
  assert.match(m.state.html, /capability remains available/);
});

test('s-570 mobile tabs keep stable objects and private boundaries', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-570'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/1');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Mobile tab overview controls');
  assert.match(m.state.html, /Same stable tab objects/);
  m.click('mtv-private');
  assert.match(m.state.html, /private titles never appear/);
  m.click('mtv-duplicate');
  assert.match(m.state.html, /switching view never duplicates tabs/);
  m.click('mtv-toggle');
  assert.match(m.state.html, /Switched to List view; tab objects unchanged\./);
  m.click('mtv-close');
  assert.match(m.state.html, /undo available for the action/);
  assert.match(m.state.html, /require explicit confirmation before closing/);
});

test('s-571 tablet split maps input to one registry and falls back honestly', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-571'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/2');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Tablet split layout editor');
  assert.match(m.state.html, /same commands/);
  m.click('tsp-fake');
  assert.match(m.state.html, /does not fake concurrent page rendering/);
  m.click('tsp-pointer');
  assert.match(m.state.html, /keyboard\/touch alternative/);
  m.click('tsp-toggle');
  assert.match(m.state.html, /Single-pane fallback active; tabs preserved\./);
  assert.match(m.state.html, /Shows pane widths and focus before applying/);
});

test('s-572 address placement keeps origin and navigation visible', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-572'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/3');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Mobile address placement controls');
  assert.match(m.state.html, /never hidden by keyboard or notch/);
  m.click('map-origin');
  assert.match(m.state.html, /origin and security controls cannot be hidden/);
  m.click('map-back');
  assert.match(m.state.html, /cannot be concealed in compact layout/);
  m.click('map-toggle');
  assert.match(m.state.html, /Address moved to Top; origin and controls preserved\./);
  assert.match(m.state.html, /keeps origin, back and new-tab actions visible/);
});

test('s-573 posture transition preserves session and avoids universal claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-573'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/4');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Window posture transition state');
  assert.match(m.state.html, /no universal phone promise/);
  m.click('pst-reset');
  assert.match(m.state.html, /cannot reset the browsing session/);
  m.click('pst-universal');
  assert.match(m.state.html, /not promised on phones/);
  m.click('pst-rotate');
  assert.match(m.state.html, /active tab, scroll and space kept/);
});

test('s-574 mobile recovery retains metadata but promises no live renderer', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-574'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/5');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Mobile background recovery');
  assert.match(m.state.html, /live renderer state is not guaranteed/);
  m.click('mbr-live');
  assert.match(m.state.html, /cannot be guaranteed after an OS process kill/);
  m.click('mbr-reload');
  assert.match(m.state.html, /no forced-reload-free claim/);
  m.click('mbr-restore');
  assert.match(m.state.html, /pages may reload as required/);
});

test('s-575 platform capability uses physical devices and never forces default', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-575'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://mobile/6');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'phone-tablet-adaptive-windowing');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Platform capability review');
  assert.match(m.state.html, /emulator-only not accepted/);
  m.click('pcr-default');
  assert.match(m.state.html, /cannot silently force itself as the default browser/);
  m.click('pcr-emulator');
  assert.match(m.state.html, /emulator-only results cannot certify/);
  m.click('pcr-review');
  assert.match(m.state.html, /on physical devices/);
});

test('s-576 window arrangement clamps geometry and keeps windows independent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-576'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/1');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Native window arrangement');
  assert.match(m.state.html, /Clamped to visible area/);
  m.click('nwa-offscreen');
  assert.match(m.state.html, /never opens unreachable/);
  m.click('nwa-close');
  assert.match(m.state.html, /never erases another window state/);
  m.click('nwa-restore');
  assert.match(m.state.html, /clamped to the available display/);
});

test('s-577 titlebar keeps native controls reachable and avoids emulation', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-577'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/2');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Desktop titlebar controls');
  assert.match(m.state.html, /Separated from clickable tabs/);
  m.click('dtc-obscure');
  assert.match(m.state.html, /cannot obscure close, minimize or fullscreen/);
  m.click('dtc-emulate');
  assert.match(m.state.html, /not emulated as real native capability/);
  m.click('dtc-toggle');
  assert.match(m.state.html, /drag regions recomputed/);
  assert.match(m.state.html, /never over native controls/);
});

test('s-578 window snapshot excludes private data and keeps escape reachable', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-578'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/3');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Window snapshot review');
  assert.match(m.state.html, /Private content is never included/);
  m.click('wsr-private');
  assert.match(m.state.html, /never included/);
  m.click('wsr-escape');
  assert.match(m.state.html, /cannot permanently hide the trusted escape controls/);
  m.click('wsr-save');
  assert.match(m.state.html, /safe geometry and tab\/pane metadata/);
  m.click('wsr-restore');
  assert.match(m.state.html, /active pane restored first/);
  assert.match(m.state.html, /nearest available display/);
});

test('s-579 desktop integration uses OS choice and validates dropped files', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-579'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/4');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Desktop integration settings');
  assert.match(m.state.html, /No arbitrary path traversal/);
  m.click('din-silent');
  assert.match(m.state.html, /never silently overridden/);
  m.click('din-register');
  assert.match(m.state.html, /no silent override/);
  m.click('din-drop');
  assert.match(m.state.html, /current profile context/);
  assert.match(m.state.html, /registered only through supported OS APIs/);
});

test('s-580 desktop fallback preserves preference and focused dispatch', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-580'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/5');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Desktop platform fallback');
  assert.match(m.state.html, /Dispatch to the actual focused window/);
  m.click('dfb-corrupt');
  assert.match(m.state.html, /never corrupts the saved window preference/);
  m.click('dfb-focus');
  assert.match(m.state.html, /inactive window cannot steal focus/);
  m.click('dfb-toggle');
  assert.match(m.state.html, /Native compositor material restored\./);
  assert.match(m.state.html, /moves to an available display/);
});

test('s-581 desktop build records signed architectures and native tests', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-581'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://desktop/6');
  assert.equal(m.dataset.onboardingPhase, 'p32');
  assert.equal(m.dataset.atlasCategory, 'desktop-native-windows-platform-integration');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Desktop build capability report');
  assert.match(m.state.html, /Signed and notarized package evidence/);
  m.click('dbc-universal');
  assert.match(m.state.html, /not called universally installable/);
  m.click('dbc-visual');
  assert.match(m.state.html, /visual preview alone cannot certify/);
  m.click('dbc-run');
  assert.match(m.state.html, /resize, fullscreen, display removal/);
});

test('s-582 migration source chooser requires explicit permission', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-582'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/1');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration source chooser');
  assert.match(m.state.html, /Safari 17 · detected/);
  assert.match(m.state.html, /Not granted · request explicitly/);
  m.click('mig-passwords');
  assert.match(m.state.html, /password import is unavailable on this platform/);
  m.click('mig-grant');
  assert.match(m.state.html, /read-only extraction through supported APIs/);
  m.click('mig-cancel');
  assert.match(m.state.html, /nothing was read from another browser/);
});

test('s-583 migration inventory previews counts and keeps passwords separate', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-583'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/2');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration inventory preview');
  assert.match(m.state.html, /214 found · 2 invalid entries skipped/);
  assert.match(m.state.html, /Dedicated secure credential flow/);
  m.click('mig2-import');
  assert.match(m.state.html, /Preview and validate the inventory before importing\./);
  m.click('mig2-malformed');
  m.click('mig2-import');
  assert.match(m.state.html, /Preview and validate the inventory before importing\./);
  m.click('mig2-preview');
  m.click('mig2-import');
  assert.match(m.state.html, /skipped rows remain listed/);
  m.click('mig2-cancel');
  assert.match(m.state.html, /source file is unchanged/);
});

test('s-584 migration conflicts preserve distinct records and secure defaults', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-584'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/3');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration conflict review');
  assert.match(m.state.html, /distinct records preserved/);
  m.click('mig3-apply');
  assert.match(m.state.html, /Preview the conflict resolution before applying\./);
  m.click('mig3-unknown');
  assert.match(m.state.html, /cannot override secure defaults/);
  m.click('mig3-merge');
  assert.match(m.state.html, /only to the selected duplicate pair/);
  m.click('mig3-cancel');
  assert.match(m.state.html, /existing records unchanged/);
});

test('s-585 migration progress keeps existing collections safe', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-585'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/4');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration progress detail');
  assert.match(m.state.html, /142 · written to the staging batch/);
  assert.match(m.state.html, /Unchanged until the staged batch commits/);
  m.click('mig4-fail');
  assert.match(m.state.html, /existing collection is intact/);
  m.click('mig4-rollback');
  assert.match(m.state.html, /later edits and unrelated bookmarks preserved/);
  m.click('mig4-cancel');
  assert.match(m.state.html, /existing collection is uncorrupted/);
});

test('s-586 migration report counts actual outcomes and keeps source data', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-586'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/5');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Migration completion report');
  assert.match(m.state.html, /206 items · verified/);
  assert.match(m.state.html, /16 items · listed with reasons, not counted as imported/);
  m.click('mig5-source');
  assert.match(m.state.html, /never deleted after a successful import/);
  m.click('mig5-rollback');
  assert.match(m.state.html, /later edits are preserved/);
  m.click('mig5-export');
  assert.match(m.state.html, /actual imported, skipped, failed and unsupported counts/);
});

test('s-587 portable export states format limits and keeps passwords out', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-587'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://importexport/6');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'switching-from-other-browsers-portability');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Portable export scope review');
  assert.match(m.state.html, /Not claimed as universally importable/);
  m.click('mig6-passwords');
  assert.match(m.state.html, /dedicated secure export flow/);
  m.click('mig6-universal');
  assert.match(m.state.html, /not claimed to import everywhere/);
  m.click('mig6-format');
  assert.match(m.state.html, /Format set to JSON/);
  m.click('mig6-cancel');
  assert.match(m.state.html, /nothing was written/);
});

test('s-588 unified library keeps collections separate and local', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-588'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/1');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Unified library workspace');
  assert.match(m.state.html, /214 saved · folders preserved/);
  assert.match(m.state.html, /no public web index/);
  m.click('lib-remove');
  assert.match(m.state.html, /reading list, history and notes untouched/);
  m.click('lib-history');
  assert.match(m.state.html, /private history is excluded/);
  m.click('lib-index');
  assert.match(m.state.html, /never builds a public web index/);
});

test('s-589 smart folder previews matches and rejects unbounded queries', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-589'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/2');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Smart folder editor');
  assert.match(m.state.html, /tags “research”, “unread”/);
  m.click('sf2-save');
  assert.match(m.state.html, /Preview the matching items before saving\./);
  m.click('sf2-regex');
  assert.match(m.state.html, /unbounded regular expressions are rejected/);
  m.click('sf2-nest');
  assert.match(m.state.html, /cannot move into its own descendant/);
  m.click('sf2-cancel');
  assert.match(m.state.html, /last committed rules retained/);
});

test('s-590 bookmark duplicates show differences and never auto-merge', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-590'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/3');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Bookmark duplicate review');
  assert.match(m.state.html, /folder Work · note “Q4 plan”/);
  m.click('dup2-auto');
  assert.match(m.state.html, /never triggers an automatic destructive merge/);
  m.click('dup2-keep');
  assert.match(m.state.html, /folders and annotations unchanged/);
  m.click('dup2-cancel');
  assert.match(m.state.html, /both bookmark objects unchanged/);
});

test('s-591 history range stays local and excludes private visits', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-591'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/4');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'History time-range inspector');
  assert.match(m.state.html, /Regular sessions only · private history excluded/);
  m.click('htr-range');
  assert.match(m.state.html, /Last 30 days/);
  m.click('htr-private');
  assert.match(m.state.html, /private history never enters regular history/);
  m.click('htr-timezone');
  assert.match(m.state.html, /none removed/);
});

test('s-592 library bulk action affects only selected IDs', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-592'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/5');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Library bulk action review');
  assert.match(m.state.html, /b-1042 · b-1051 · b-1063/);
  m.click('blk-confirm');
  assert.match(m.state.html, /Removed exactly the three selected IDs/);
  m.click('blk-fail');
  assert.match(m.state.html, /original bookmarks preserved/);
  m.click('blk-cancel');
  assert.match(m.state.html, /every library item unchanged/);
});

test('s-593 library index recovery preserves originals and bounds rendering', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-593'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://collections/6');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-bookmarks-history-local-search');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Library index recovery');
  assert.match(m.state.html, /Bookmarks, reading list, history and notes intact/);
  m.click('lix-rebuild');
  assert.match(m.state.html, /original collections remain intact/);
  m.click('lix-bulk');
  assert.match(m.state.html, /never rendered all at once/);
  m.click('lix-cancel');
  assert.match(m.state.html, /previous index kept/);
});

test('s-594 provider switcher detail never silently changes company', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-594'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/1');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Provider quick switcher detail');
  assert.match(m.state.html, /no crawler, index, scraping proxy or public results backend/);
  m.click('pqs-keyword');
  assert.match(m.state.html, /saved default is unchanged/);
  m.click('pqs-outage');
  assert.match(m.state.html, /no other company is selected silently/);
});

test('s-595 omnibox suggestions stay local without explicit consent', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-595'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/2');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Omnibox local suggestion controls');
  assert.match(m.state.html, /Off · no keystroke leaves the device/);
  m.click('ols-remote');
  assert.match(m.state.html, /stay off until explicit consent/);
  m.click('ols-private');
  assert.match(m.state.html, /never surfaces regular history suggestions/);
  m.click('ols-ranking');
  assert.match(m.state.html, /ranking stays within this profile/);
});

test('s-596 provider validation rejects unsafe templates and sends nothing', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-596'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/3');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Custom provider validation preview');
  assert.match(m.state.html, /“ridge wind” → ridge%20wind/);
  m.click('cpv-credentials');
  assert.match(m.state.html, /templates containing credentials are rejected/);
  m.click('cpv-scheme');
  assert.match(m.state.html, /javascript, data and http templates are rejected/);
  m.click('cpv-send');
  assert.match(m.state.html, /never sends the user query automatically/);
});

test('s-597 search recovery retains the query and never silently switches', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-597'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/4');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Search navigation error recovery');
  assert.match(m.state.html, /“ridge wind survey” · not modified/);
  m.click('snr-retry');
  assert.match(m.state.html, /still unavailable and the query is retained/);
  m.click('snr-fabricate');
  assert.match(m.state.html, /no fallback results are fabricated/);
  m.click('snr-history');
  assert.match(m.state.html, /not recorded as a normal visit/);
});

test('s-598 command and URL classification blocks privileged script input', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-598'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/5');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Command and URL distinction review');
  assert.match(m.state.html, /https:\/\/docs\.example\/notes → navigation/);
  m.click('cud-script');
  assert.match(m.state.html, /cannot execute as a privileged browser command/);
  m.click('cud-web');
  assert.match(m.state.html, /cannot synthesize a privileged omnibox command/);
  m.click('cud-query');
  assert.match(m.state.html, /classified as a search query; no privileged action/);
});

test('s-599 search privacy report states local policy without provider claims', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-599'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://search/6');
  assert.equal(m.dataset.onboardingPhase, 'p33');
  assert.equal(m.dataset.atlasCategory, 'advanced-omnibox-provider-navigation');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Search privacy report');
  assert.match(m.state.html, /Off · no keystrokes leave the device/);
  m.click('spr-tracking');
  assert.match(m.state.html, /no claim is made about a third-party provider not tracking/);
  m.click('spr-encode');
  assert.match(m.state.html, /composition does not submit/);
  m.click('spr-private');
  assert.match(m.state.html, /not written to regular history/);
});

test('s-600 managed policy overview keeps unknowns visible and rejects insecure values', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-600'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://enterprise/1');
  assert.equal(m.dataset.onboardingPhase, 'p34');
  assert.equal(m.dataset.atlasCategory, 'managed-deployment-policy-integrity');
  assert.equal(m.dataset.atlasPriority, 'required');
  assert.equal(m.state.attrs['aria-label'], 'Managed policy overview');
  assert.match(m.state.html, /Only unmanaged preferences · managed values locked/);
  m.click('mpo-insecure');
  assert.match(m.state.html, /insecure policy value is blocked with a reason/);
  m.click('mpo-unknown');
  assert.match(m.state.html, /never applied over user settings/);
});

test('s-601 to s-623 atlas cards route, render and respond', () => {
  const specs = [
    ['s-601','managed-deployment-policy-integrity','p34','Policy provenance detail','pp1-web','cannot set enterprise policy'],
    ['s-602','managed-deployment-policy-integrity','p34','Managed profile onboarding','pp2-auto','website prompt cannot enroll'],
    ['s-603','managed-deployment-policy-integrity','p34','Kiosk mode review','pp3-exit','emergency exit control cannot be hidden'],
    ['s-604','managed-deployment-policy-integrity','p34','Policy conflict recovery','pp4-weaken','never weakens protection'],
    ['s-605','managed-deployment-policy-integrity','p34','Enterprise deployment evidence','pp5-skip','cannot claim enterprise-ready'],
    ['s-606','family-shared-devices-personal-control','p34','Shared device profile chooser','pp6-leak','cannot see other profile credentials'],
    ['s-607','family-shared-devices-personal-control','p34','Supervised browsing setup','pp7-covert','never installed covertly'],
    ['s-608','family-shared-devices-personal-control','p34','Allowed and limited site editor','pp8-broad','broad public suffix'],
    ['s-609','family-shared-devices-personal-control','p34','Restriction explanation state','pp9-fake','never impersonates a network or certificate error'],
    ['s-610','family-shared-devices-personal-control','p34','Family activity privacy review','pp10-message','messages and page content are never captured'],
    ['s-611','family-shared-devices-personal-control','p34','Supervision change and recovery','pp11-leak','cross-profile credentials never become visible'],
    ['s-612','support-diagnostics-privacy-safe-reporting','p35','Help and capability center','pp12-fake','never advertises an unavailable feature'],
    ['s-613','support-diagnostics-privacy-safe-reporting','p35','Problem report builder','pp13-history','history is never collected automatically'],
    ['s-614','support-diagnostics-privacy-safe-reporting','p35','Diagnostic bundle review','pp14-auto','never uploaded automatically'],
    ['s-615','support-diagnostics-privacy-safe-reporting','p35','Known issue status','pp15-count','ticket counts are never fabricated'],
    ['s-616','support-diagnostics-privacy-safe-reporting','p35','Feedback receipt and follow-up','pp16-claim','never presented as successful submission'],
    ['s-617','support-diagnostics-privacy-safe-reporting','p35','Support recovery workflow','pp17-delete','cannot delete user data without explicit permission'],
    ['s-618','automated-quality-security-release-evidence','p35','Requirement traceability board','pp18-orphan','cannot pass registry validation'],
    ['s-619','automated-quality-security-release-evidence','p35','Automated test run explorer','pp19-skip','never counted as passing'],
    ['s-620','automated-quality-security-release-evidence','p35','Security verification board','pp20-escape','privilege escape is release-blocking'],
    ['s-621','automated-quality-security-release-evidence','p35','Platform parity checkpoint','pp21-emulator','emulator-only checks cannot certify'],
    ['s-622','automated-quality-security-release-evidence','p35','Release candidate review','pp22-fail','cannot be marked as a completed package'],
    ['s-623','automated-quality-security-release-evidence','p35','Regression rollback gate','pp23-trade','security is never traded']
  ];
  for (const [id, cat, phase, title, action, needle] of specs) {
    const m = mount({ capabilities: { ...ALL_SETUP } });
    assert.equal(m.context.window.__vaayvuOnboardingOpen(id), true, id + ' opens');
    assert.equal(m.dataset.atlasCategory, cat, id + ' category');
    assert.equal(m.dataset.onboardingPhase, phase, id + ' phase');
    assert.equal(m.state.attrs['aria-label'], title, id + ' title');
    assert.match(m.state.html, /<div class="sx-list">/, id + ' rows');
    m.click(action);
    assert.match(m.state.html, new RegExp(needle), id + ' action');
  }
});

test('every atlas screen s-106 to s-623 opens with its own title', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  for (let n = 106; n <= 623; n += 1) {
    if (n === 172) continue;
    const id = 's-' + String(n).padStart(3, '0');
    assert.equal(m.context.window.__vaayvuOnboardingOpen(id), true, id + ' opens');
    assert.notEqual(m.state.attrs['aria-label'], 'Welcome', id + ' has a title');
  }
});

test('a-001 to a-032 ads and rewards screens route and respond', () => {
  const specs = [
    ['a-001','ads-and-rewards','p36','Ads and rewards home','ad1-off','Future sponsored cards disabled immediately'],
    ['a-002','ads-and-rewards','p36','Sponsored cards consent','ad2-accept','only after explicit acceptance'],
    ['a-003','ads-and-rewards','p36','Reward program terms','ad3-accept','supported reviewed region and age decision'],
    ['a-004','ads-and-rewards','p36','Reward eligibility check','ad4-continue','without inferring citizenship or identity'],
    ['a-005','ads-and-rewards','p37','Sponsored card on start page','ad5-hide','Card hidden'],
    ['a-006','ads-and-rewards','p37','Why this advertisement','ad6-controls','Ad controls opened'],
    ['a-007','ads-and-rewards','p37','Advertisement report','ad7-submit','campaign ID only'],
    ['a-008','ads-and-rewards','p37','Advertiser preferences','ad8-save','applied locally and in later eligibility'],
    ['a-009','ads-and-rewards','p38','Reward dashboard','ad9-fail','no zero balance'],
    ['a-010','ads-and-rewards','p38','Earning receipt details','ad10-click','never requires a click'],
    ['a-011','ads-and-rewards','p38','Pending earnings','ad11-delay','stays pending and is not promoted'],
    ['a-012','ads-and-rewards','p38','Reward payout method','ad12-unsupported','stay disabled with their stated reasons'],
    ['a-013','ads-and-rewards','p38','Payout identity verification','ad13-local','never stored in browser settings'],
    ['a-014','ads-and-rewards','p38','Payout review','ad14-double','no second payout is created'],
    ['a-015','ads-and-rewards','p38','Payout pending','ad15-force','not a manual mark'],
    ['a-016','ads-and-rewards','p38','Payout result and retry','ad16-returned','separate reversal posted'],
    ['a-017','ads-and-rewards','p38','Reward adjustment appeal','ad17-edit','cannot secretly edit a settled amount'],
    ['a-018','ads-and-rewards','p38','Reward tax and statements','ad18-advice','no withheld taxes are invented'],
    ['a-019','ads-and-rewards','p38','Reward privacy and exit','ad19-exit','does not confiscate already valid entitlements'],
    ['a-020','revenue-operations','p36','Advertiser account setup','ad20-live','cannot submit or serve live inventory'],
    ['a-021','revenue-operations','p37','Campaign brief','ad21-thirdparty','replacement placement rejected'],
    ['a-022','revenue-operations','p37','Creative submission','ad22-redirect','malicious redirect stays blocked'],
    ['a-023','revenue-operations','p37','Creative review queue','ad23-status','cannot become deliverable through a status edit'],
    ['a-024','revenue-operations','p37','Campaign budget and pacing','ad24-over','cannot exceed the hard campaign budget'],
    ['a-025','revenue-operations','p36','Inventory and publisher authorization','ad25-revoke','disabled immediately'],
    ['a-026','revenue-operations','p37','Delivery and frequency diagnostics','ad26-hidden','never automatically a second billable event'],
    ['a-027','revenue-operations','p39','Fraud review workbench','ad27-fingerprint','never identified through covert fingerprinting'],
    ['a-028','revenue-operations','p38','Revenue settlement reconciliation','ad28-uncollected','cannot fund an available reward balance'],
    ['a-029','revenue-operations','p38','Reward pool approval','ad29-rewrite','does not silently rewrite earned receipts'],
    ['a-030','revenue-operations','p38','Payout operations','ad30-mark','cannot mark paid without provider evidence'],
    ['a-031','revenue-operations','p37','Campaign incident and kill switch','ad31-disable','never disabled to stop ad serving'],
    ['a-032','revenue-operations','p39','Monetization release evidence','ad32-skip','block payouts and serving']
  ];
  for (const [id, cat, phase, title, action, needle] of specs) {
    const expectedRoute = (cat === 'ads-and-rewards' || cat === 'revenue-operations') ? 'vaayvu://revenue/' + id : (cat === 'ads' ? 'vaayvu://ads/' : 'vaayvu://campaigns/') + id;
    const m = mount({ capabilities: { ...ALL_SETUP } });
    assert.equal(m.context.window.__vaayvuOnboardingOpen(id), true, id + ' opens');
    assert.equal(m.dataset.onboardingRoute, expectedRoute, id + ' route');
    assert.equal(m.dataset.atlasCategory, cat, id + ' category');
    assert.equal(m.dataset.onboardingPhase, phase, id + ' phase');
    assert.equal(m.state.attrs['aria-label'], title, id + ' title');
    m.click(action);
    assert.match(m.state.html, new RegExp(needle), id + ' action');
  }
});


test('a-015 payout callbacks verify, dedupe and never regress paid', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('a-015'), true);
  assert.match(m.state.html, /Pending · awaiting provider/);
  m.click('ad15-unverified');
  assert.match(m.state.html, /unverified callback cannot mark the payout paid/);
  assert.match(m.state.html, /Pending · awaiting provider/);
  m.click('ad15-late');
  assert.match(m.state.html, /stays Pending/);
  m.click('ad15-paid');
  assert.match(m.state.html, /Paid · settled by a verified callback/);
  assert.match(m.state.html, /Pending → Paid/);
  m.click('ad15-late');
  assert.match(m.state.html, /does not regress to Pending/);
  assert.match(m.state.html, /Paid · settled by a verified callback/);
  m.click('ad15-unverified');
  assert.match(m.state.html, /cannot alter a paid payout/);
  m.click('ad15-force');
  assert.match(m.state.html, /verified provider evidence, not a manual mark/);
});

test('audit all screen metadata', () => {
  const m = mount({ capabilities: { ...ALL_SETUP } });
  const rows = [];
  const ids = [];
  for (let n = 1; n <= 623; n += 1) ids.push('s-' + String(n).padStart(3, '0'));
  for (let n = 1; n <= 32; n += 1) ids.push('a-' + String(n).padStart(3, '0'));
  for (const id of ids) {
    const opened = m.context.window.__vaayvuOnboardingOpen(id);
    rows.push({
      id,
      opened,
      title: opened ? m.state.attrs['aria-label'] : '',
      category: opened ? m.dataset.atlasCategory : '',
      phase: opened ? m.dataset.onboardingPhase : '',
      priority: opened ? m.dataset.atlasPriority : '',
      route: opened ? m.dataset.onboardingRoute : '',
    });
  }
  writeFileSync('/tmp/vaayvu-screens.json', JSON.stringify(rows, null, 2));
  assert.ok(rows.length >= 655);
});
