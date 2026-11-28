'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../chrome/onboarding.js'), 'utf8');

function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

// Crash restore is a recovery surface: it must render with boot.show false.
function mount({ store = memoryStore(), capabilities = {}, bootShow = false } = {}) {
  const dataset = {};
  const state = { html: '', removed: false, attrs: {}, focus: 0 };
  const overlay = {
    setAttribute(key, value) { state.attrs[key] = value; },
    addEventListener(type, fn) { overlay['on' + type] = fn; },
    querySelectorAll() { return []; },
    remove() { state.removed = true; },
  };
  const step = {
    set innerHTML(value) { state.html = value; },
    get innerHTML() { return state.html; },
    querySelector() { return { focus() { state.focus += 1; } }; },
    querySelectorAll() { return []; },
  };
  const calls = { tabs: [], writes: [], toasts: [], events: [] };
  const context = {
    window: {
      __vaayvuBoot: {
        show: bootShow,
        reprompt: false,
        route: 'vaayvu://onboarding/s-001',
        phase: 'p00',
      },
      vaayvuEvent(message) { calls.events.push(message); },
    },
    document: {
      documentElement: { dataset },
      getElementById: (id) => (id === 'onboarding' ? overlay : id === 'onboarding-step' ? step : null),
    },
    localStorage: store,
    capabilities,
    tabs: [],
    addTab: (isPrivate, url, options) => { calls.tabs.push({ isPrivate, url, options }); },
    write: (key, value) => calls.writes.push([key, value]),
    toast: (message) => calls.toasts.push(message),
    setTimeout: () => 1,
    clearTimeout: () => {},
    Date,
    JSON,
    URL,
  };
  runInNewContext(source, context);
  const clickCrash = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-crash]' ? { dataset: { crash: name } } : null) },
    });
  return { dataset, state, overlay, step, calls, store, clickCrash, context };
}

const CRASH_TABS = {
  tabs: [
    { title: 'Docs', url: 'https://example.com/docs' },
    { title: 'News', url: 'https://news.example.org/story', pinned: true },
  ],
};

test('s-018 stays hidden without a crash report', () => {
  const m = mount({ capabilities: {} });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-018'), false);
  assert.equal(m.context.window.__vaayvuCrashRestorePrompt(), false);
});

test('s-018 renders the reported tab list and both choices', () => {
  const m = mount({ capabilities: { crashRestore: CRASH_TABS } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-018'), true);
  assert.equal(m.dataset.onboarding, 'show');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-018');
  assert.equal(m.dataset.onboardingPhase, 'p00');
  assert.equal(m.state.attrs['aria-label'], 'Restore your tabs');
  assert.match(m.state.html, /2 tabs were open/);
  assert.match(m.state.html, /Docs/);
  assert.match(m.state.html, /news\.example\.org/);
  assert.match(m.state.html, /data-crash="restore">Restore 2 tabs</);
  assert.match(m.state.html, /data-crash="discard">Discard</);
});

test('s-018 ignores unsafe URLs and stays hidden when nothing is restorable', () => {
  const unsafe = mount({
    capabilities: {
      crashRestore: { tabs: [{ title: 'Bad', url: 'javascript:alert(1)' }, { url: 'file:///etc/passwd' }] },
    },
  });
  assert.equal(unsafe.context.window.__vaayvuOnboardingOpen('s-018'), false);
  assert.equal(unsafe.dataset.onboarding, undefined);
});

test('Restore opens each reported page and records the choice', () => {
  const m = mount({ capabilities: { crashRestore: CRASH_TABS } });
  m.context.window.__vaayvuOnboardingOpen('s-018');
  m.clickCrash('restore');
  assert.equal(m.state.removed, true);
  assert.deepEqual(
    m.calls.tabs.map((tab) => tab.url),
    ['https://example.com/docs', 'https://news.example.org/story'],
  );
  assert.equal(m.calls.tabs[1].options.pinned, true);
  const record = JSON.parse(m.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'done');
  assert.equal(record.route, 'vaayvu://onboarding/s-018');
  assert.equal(record.crashRestore, 'restored');
  assert.equal(record.restoredTabs, 2);
});

test('Discard drops a stored crashed session and keeps it dropped', () => {
  const store = memoryStore({
    'vaayvu.tabs': JSON.stringify([{ id: 'a', url: 'https://example.com/', title: 'Example' }]),
    'vaayvu.active': 'a',
  });
  const m = mount({ store, capabilities: { crashRestore: { active: true } } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-018'), true);
  assert.match(m.state.html, /1 tab was open/);
  m.clickCrash('discard');
  assert.equal(m.state.removed, true);
  assert.equal(store.getItem('vaayvu.tabs'), null);
  assert.equal(store.getItem('vaayvu.active'), null);
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.crashRestore, 'discarded');
});

test('a crashRestore event opens s-018 and a ready report outranks safe mode', () => {
  const event = mount({ capabilities: {} });
  event.context.window.vaayvuEvent({ type: 'crashRestore', crashRestore: CRASH_TABS });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://onboarding/s-018');
  assert.match(event.state.html, /example\.com/);

  const ready = mount({
    capabilities: {
      crashRestore: CRASH_TABS,
      safeMode: { reason: 'Previous launch failed.' },
      update: { available: true, version: '0.0.24', notes: ['New'] },
    },
  });
  ready.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(ready.dataset.onboardingRoute, 'vaayvu://onboarding/s-018');
});

test('crash restore and safe mode can reveal the layer on a later launch', () => {
  const crashed = mount({ capabilities: { crashRestore: CRASH_TABS } });
  crashed.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(crashed.dataset.onboarding, 'show');
  assert.equal(crashed.dataset.onboardingRoute, 'vaayvu://onboarding/s-018');

  const safe = mount({ capabilities: { safeMode: { reason: 'Previous launch failed.' } } });
  safe.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(safe.dataset.onboarding, 'show');
  assert.equal(safe.dataset.onboardingRoute, 'vaayvu://onboarding/s-019');
});
