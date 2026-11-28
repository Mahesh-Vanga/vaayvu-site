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
  const clickSpace = (id) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'so-open', soId: id } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickSpace, context };
}

test('s-057 renders three space cards with recents', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-057'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-057');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Spaces overview');
  assert.match(m.state.html, /Personal/);
  assert.match(m.state.html, /Work/);
  assert.match(m.state.html, /Study/);
  assert.match(m.state.html, /The Observatory/);
  assert.match(m.state.html, /Linear — Q4 roadmap/);
  assert.match(m.state.html, /MDN Web Docs/);
  assert.match(m.state.html, /01 Cards/);
  assert.match(m.state.html, /02 Recents/);
  assert.match(m.state.html, /03 Switch/);
});

test('a platform can hide the spaces overview', () => {
  for (const capabilities of [{ spacesOverview: false }, { spaces: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-057'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('opening a card selects that space', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-057');
  m.clickSpace('work');
  assert.match(m.state.html, /Opened Work space in this preview\./);
  assert.match(m.state.html, /so-card is-active" data-onboard="so-open" data-so-id="work"/);
});

test('Continue on s-057 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-057');
  m.click('so-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the spacesOverview event opens s-057 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'spacesOverview' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-057');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'spacesOverview', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-057 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
