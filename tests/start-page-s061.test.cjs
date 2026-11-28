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
  return { dataset, state, overlay, step, click, context };
}

test('s-061 renders clock, weather and opt-in stocks widgets', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-061'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-061');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Widgets');
  assert.match(m.state.html, /wg-clock/);
  assert.match(m.state.html, /wg-weather/);
  assert.match(m.state.html, /wg-stocks/);
  assert.match(m.state.html, /Choose city/);
  assert.match(m.state.html, /Enable stocks/);
  assert.match(m.state.html, /Opt-in/);
  assert.match(m.state.html, /01 Clock/);
  assert.match(m.state.html, /02 Weather/);
  assert.match(m.state.html, /03 Stocks/);
});

test('a platform can hide the widgets screen', () => {
  for (const capabilities of [{ widgets: false }, { startPage: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-061'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('stocks stay off until enabled and can be turned off', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-061');
  assert.match(m.state.html, /Stocks are off|Quotes need a provider/);
  m.click('wg-stocks');
  assert.match(m.state.html, /wg-stocks is-on/);
  assert.match(m.state.html, /Add a provider in Settings to load quotes\./);
  assert.match(m.state.html, /Turn off stocks/);
  m.click('wg-stocks');
  assert.match(m.state.html, /Stocks turned off\. No quote requests are made\./);
});

test('weather reports the city picker and source', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-061');
  m.click('wg-weather');
  assert.match(m.state.html, /A city picker would open; the chosen city is sent to Open-Meteo\./);
});

test('Continue on s-061 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-061');
  m.click('wg-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the widgets event opens s-061 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'widgets' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-061');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'widgets', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-061 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
