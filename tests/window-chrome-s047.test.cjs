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
  const clickAction = (name) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'lc-action', lc: name } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickAction, context };
}

test('s-047 renders the link context menu with every action', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-047'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-047');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Link context menu');
  assert.match(m.state.html, /lc-menu/);
  assert.match(m.state.html, /Vaayvu documentation/);
  for (const label of [
    'Open link in new tab',
    'Open link in new window',
    'Open link in private window',
    'Open link in split view',
    'Copy link',
    'Share link',
    'Send to your device',
  ])
    assert.ok(m.state.html.includes(label), label);
  assert.match(m.state.html, /01 Open/);
  assert.match(m.state.html, /02 Link/);
  assert.match(m.state.html, /03 Send/);
});

test('a platform can hide the link context menu', () => {
  for (const capabilities of [{ linkContext: false }, { contextMenu: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-047'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('link actions report what would happen', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-047');
  m.clickAction('newtab');
  assert.match(m.state.html, /The link would open in a new tab\./);
  m.clickAction('private');
  assert.match(m.state.html, /The link would open in a private window\./);
  m.clickAction('copy');
  assert.match(m.state.html, /The link address would be copied\./);
  m.clickAction('send');
  assert.match(m.state.html, /The link would be sent to another signed-in device\./);
});

test('Continue on s-047 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-047');
  m.click('lc-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the linkContext event opens s-047 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'linkContext' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-047');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'linkContext', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-047 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
