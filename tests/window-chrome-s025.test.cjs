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
  return { dataset, state, overlay, step, click, context };
}

test('s-025 renders the horizontal tab strip on the window-chrome route', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-025'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-025');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Horizontal tab strip');
  assert.match(m.state.html, /ts-titlebar/);
  assert.match(m.state.html, /ts-tab is-active/);
  assert.match(m.state.html, /class="ts-add"/);
  assert.match(m.state.html, /class="ts-overflow"/);
  assert.match(m.state.html, /class="ts-search"/);
  assert.match(m.state.html, /ts-searchbar/);
  assert.match(m.state.html, /ts-overflow-menu/);
  assert.match(m.state.html, /01 Tabs/);
  assert.match(m.state.html, /02 New tab/);
  assert.match(m.state.html, /03 Overflow/);
  assert.match(m.state.html, /04 Search/);
  assert.match(m.state.html, /data-onboard="tabstrip-continue">Continue</);
});

test('a platform can hide the horizontal strip explicitly', () => {
  for (const capabilities of [{ horizontalTabs: false }, { tabStrip: false }, { mainWindow: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-025'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Continue on s-025 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-025');
  m.click('tabstrip-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the horizontalTabs event opens s-025 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'horizontalTabs' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-025');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'horizontalTabs', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-025 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
