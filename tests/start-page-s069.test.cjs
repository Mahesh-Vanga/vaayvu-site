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
      __vaayvuBoot: { show: true, reprompt: false, route: 'vaayvu://onboarding/s-001', phase: 'p00' },
      vaayvuEvent() {},
    },
    document: {
      documentElement: { dataset },
      getElementById: (id) => (id === 'onboarding' ? overlay : id === 'onboarding-step' ? step : null),
    },
    localStorage: store,
    capabilities,
    adBlockConfig: { enabled: true, lists: { ads: true, trackers: true, social: true, cosmetic: true, aggressive: true } },
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

test('s-069 renders the muted tab with an unmute action', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-069'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-069');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Muted tab');
  assert.match(m.state.html, /mt-audio is-muted/);
  assert.match(m.state.html, /Audio muted/);
  assert.match(m.state.html, /Unmute tab/);
  assert.match(m.state.html, /01 Muted icon/);
  assert.match(m.state.html, /02 Unmute/);
  assert.match(m.state.html, /03 Scope/);
});

test('a platform can hide the muted tab', () => {
  for (const capabilities of [{ mutedTab: false }, { startPage: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-069'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('unmute restores audio and mute puts it back', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-069');
  m.click('mt-unmute');
  assert.match(m.state.html, /Tab audio unmuted\. The page did not reload\./);
  assert.match(m.state.html, /mt-audio is-on/);
  assert.match(m.state.html, /Mute tab/);
  m.click('mt-audio');
  assert.match(m.state.html, /Tab audio muted\. Other tabs keep their sound\./);
  assert.match(m.state.html, /mt-audio is-muted/);
});

test('Continue on s-069 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-069');
  m.click('mt-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mutedTab event opens s-069 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'mutedTab' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-069');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'mutedTab', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-069 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
