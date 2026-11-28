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

test('s-027 renders the tab overflow menu on the window-chrome route', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-027'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-027');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Tab overflow menu');
  assert.match(m.state.html, /tm-menu/);
  assert.match(m.state.html, /tm-search/);
  assert.match(m.state.html, /Search all tabs/);
  assert.match(m.state.html, /tm-head/);
  assert.match(m.state.html, /tm-row is-active/);
  assert.match(m.state.html, /tm-close/);
  assert.match(m.state.html, /01 All tabs/);
  assert.match(m.state.html, /02 Search/);
  assert.match(m.state.html, /03 Close/);
  assert.match(m.state.html, /data-onboard="tabmenu-continue">Continue</);
});

test('a platform can hide the tab overflow menu explicitly', () => {
  for (const capabilities of [
    { tabMenu: false },
    { tabOverflow: false },
    { horizontalTabs: false },
    { mainWindow: false },
  ]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-027'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Continue on s-027 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-027');
  m.click('tabmenu-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the tabOverflow event opens s-027 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'tabOverflow' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-027');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'tabOverflow', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-027 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
