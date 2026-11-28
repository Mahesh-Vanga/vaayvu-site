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
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: (key) => map.delete(key),
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}

function mount({ store = memoryStore(), capabilities = {} } = {}) {
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
  const context = {
    window: {
      __vaayvuBoot: {
        show: true,
        reprompt: false,
        route: 'vaayvu://onboarding/s-001',
        phase: 'p00',
      },
      vaayvuEvent() {},
    },
    document: {
      documentElement: { dataset },
      getElementById: (id) => (id === 'onboarding' ? overlay : id === 'onboarding-step' ? step : null),
    },
    localStorage: store,
    capabilities,
    adBlockConfig: {
      enabled: true,
      lists: { ads: true, trackers: true, social: true, cosmetic: true, aggressive: true },
    },
    toast: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    Date,
    JSON,
    URL,
  };
  runInNewContext(source, context);
  const click = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: name } } : null) },
    });
  const clickShortcut = (name) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'of-open', ofName: name } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickShortcut, context };
}

test('s-064 renders the offline start page with cached shortcuts', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-064'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-064');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Offline start');
  assert.match(m.state.html, /of-banner/);
  assert.match(m.state.html, /You are offline/);
  assert.match(m.state.html, /Vaayvu/);
  assert.match(m.state.html, /GitHub/);
  assert.match(m.state.html, /Wikipedia/);
  assert.match(m.state.html, /data-onboard="of-retry"/);
  assert.match(m.state.html, /01 Offline/);
  assert.match(m.state.html, /02 Cached shortcuts/);
  assert.match(m.state.html, /03 Retry/);
});

test('a platform can hide the offline start page', () => {
  for (const capabilities of [{ offlineStart: false }, { offline: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-064'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('cached shortcuts and retry report their state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-064');
  m.clickShortcut('GitHub');
  assert.match(m.state.html, /Opening the cached copy of GitHub\. The live page needs a connection\./);
  m.click('of-retry');
  assert.match(m.state.html, /Checking the connection…/);
  m.click('of-retry');
  assert.match(m.state.html, /Still offline after 2 retries\. Cached shortcuts remain available\./);
});

test('Continue on s-064 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-064');
  m.click('of-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the offlineStart event opens s-064 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'offlineStart' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-064');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'offlineStart', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-064 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
