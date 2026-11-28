'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync(require.resolve('../chrome/boot.js'), 'utf8');

function memoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
    raw: () => Object.fromEntries(map),
  };
}

// Runs boot.js exactly as the browser does: blocking, before first paint.
function boot({ store = memoryStore(), webdriver = false, timers = [] } = {}) {
  const dataset = {};
  const context = {
    window: { localStorage: store },
    document: { documentElement: { dataset } },
    navigator: { webdriver },
    performance: { now: () => 42 },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    JSON,
    parseInt,
    isFinite,
    Date,
  };
  runInNewContext(source, context);
  return { state: context.window.__vaayvuBoot, window: context.window, dataset, store, timers };
}

test('a new install shows the splash before first paint with route and phase', () => {
  const { state, dataset } = boot();
  assert.equal(state.show, true);
  assert.equal(state.route, 'vaayvu://onboarding/s-001');
  assert.equal(state.phase, 'p00');
  assert.equal(dataset.onboarding, 'show');
  assert.equal(dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  assert.equal(dataset.onboardingPhase, 'p00');
  assert.equal(state.shownAt, 42); // decision recorded in head, sub-300 ms
  assert.ok(state.shownAt < 300);
});

test('a completed or skipped profile never sees the splash again', () => {
  for (const status of ['done', 'skipped']) {
    const store = memoryStore({ 'vaayvu.onboarding': JSON.stringify({ route: 'vaayvu://onboarding/s-001', status }) });
    const { state, dataset } = boot({ store });
    assert.equal(state.show, false);
    assert.equal(state.reason, 'complete');
    assert.equal(dataset.onboarding, 'hide');
  }
});

test('an existing profile with browser data is an upgrade, not a new install', () => {
  const store = memoryStore({ 'vaayvu.settings': '{"theme":"dark"}' });
  const { state, dataset } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'existing-profile');
  assert.equal(dataset.onboarding, 'hide');
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'skipped');
  assert.equal(record.reason, 'existing-profile');
  assert.equal(record.route, 'vaayvu://onboarding/s-001');
});

test('existing settings count as an existing profile', () => {
  const store = memoryStore({ 'vaayvu.settings': '{"theme":"dark"}' });
  const { state } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'existing-profile');
});

test('crash-loop fallback: three uncompleted launches then straight to the browser', () => {
  const store = memoryStore({ 'vaayvu.onboardingAttempts': '3' });
  const { state, dataset } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'crash-loop');
  assert.equal(dataset.onboarding, 'hide');
  const record = JSON.parse(store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'skipped');
  assert.equal(record.reason, 'crash-loop');
  // The skipped record stops future launches from counting attempts at all.
  const again = boot({ store });
  assert.equal(again.state.reason, 'complete');
});

test('each uncompleted launch increments the attempt counter', () => {
  const store = memoryStore();
  boot({ store });
  assert.equal(store.getItem('vaayvu.onboardingAttempts'), '1');
  boot({ store });
  assert.equal(store.getItem('vaayvu.onboardingAttempts'), '2');
});

test('automation never sits behind the splash', () => {
  const { state, dataset } = boot({ webdriver: true });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'automation');
  assert.equal(dataset.onboarding, 'hide');
});

test('boot-timeout: if the UI never takes over, the splash releases itself', () => {
  // UI took over in time: the watchdog must leave the splash alone.
  const taken = boot();
  assert.equal(taken.state.show, true);
  assert.equal(taken.timers.length, 1);
  assert.equal(taken.timers[0].ms, 5000);
  taken.window.__vaayvuOnboardingReady = true;
  taken.timers[0].fn();
  assert.equal(taken.dataset.onboarding, 'show');

  // UI never took over: the splash hides itself and records why.
  const stranded = boot({ store: memoryStore({ 'vaayvu.onboardingAttempts': '1' }) });
  assert.equal(stranded.dataset.onboarding, 'show');
  stranded.timers[0].fn();
  assert.equal(stranded.dataset.onboarding, 'hide');
  assert.equal(stranded.state.reason, 'boot-timeout');
  const record = JSON.parse(stranded.store.getItem('vaayvu.onboarding'));
  assert.equal(record.status, 'skipped');
  assert.equal(record.reason, 'boot-timeout');
});

test('a missing or hostile localStorage degrades to no splash, never a trap', () => {
  const hostile = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  const { state, dataset } = boot({ store: hostile });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'no-storage');
  assert.equal(dataset.onboarding, 'hide');
});

const DAY = 24 * 60 * 60 * 1000;
const deferredRecord = (over = {}) => JSON.stringify({
  route: 'vaayvu://onboarding/s-003',
  phase: 'p00',
  status: 'done',
  steps: ['s-001', 's-002', 's-003'],
  categories: { ads: true, social: false },
  defaultBrowser: 'deferred',
  defaultBrowserPrompts: 1,
  deferredAt: Date.now() - 8 * DAY,
  completedAt: Date.now() - 8 * DAY,
  ...over,
});

test('a deferred default-browser ask re-prompts only s-003 after a week', () => {
  const store = memoryStore({
    'vaayvu.onboarding': deferredRecord(),
    // A completed profile carries browser data; the re-prompt must still show.
    'vaayvu.settings': '{"theme":"dark"}',
  });
  const { state, dataset } = boot({ store });
  assert.equal(state.show, true);
  assert.equal(state.reprompt, true);
  assert.equal(state.route, 'vaayvu://onboarding/s-003');
  assert.equal(dataset.onboarding, 'show');
  assert.equal(dataset.onboardingRoute, 'vaayvu://onboarding/s-003');
});

test('the re-prompt waits out the interval', () => {
  const store = memoryStore({ 'vaayvu.onboarding': deferredRecord({ deferredAt: Date.now() - 2 * DAY }) });
  const { state, dataset } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'complete');
  assert.equal(dataset.onboarding, 'hide');
});

test('the re-prompt stops after three prompts', () => {
  const store = memoryStore({ 'vaayvu.onboarding': deferredRecord({ defaultBrowserPrompts: 3 }) });
  const { state } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'complete');
});

test('a granted default browser never re-prompts', () => {
  const store = memoryStore({ 'vaayvu.onboarding': deferredRecord({ defaultBrowser: 'requested' }) });
  const { state } = boot({ store });
  assert.equal(state.show, false);
  assert.equal(state.reason, 'complete');
});
