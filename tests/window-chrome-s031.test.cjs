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
  const clickIndex = (index) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'ob-open', obIndex: index } } : null,
      },
    });
  const key = (name) =>
    overlay.onkeydown({
      key: name,
      preventDefault() {},
    });
  return { dataset, state, overlay, step, click, clickIndex, key, context };
}

test('s-031 renders the expanded omnibox with sections and keyboard hints', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-031'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-031');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Omnibox expanded');
  assert.match(m.state.html, /ob-omni/);
  assert.match(m.state.html, /This device/);
  assert.match(m.state.html, /Search/);
  assert.match(m.state.html, /Actions/);
  assert.match(m.state.html, /ob-row is-active/);
  assert.match(m.state.html, /ob-keys/);
  assert.match(m.state.html, /01 Suggestions/);
  assert.match(m.state.html, /02 Sections/);
  assert.match(m.state.html, /03 Keyboard/);
  assert.match(m.state.html, /data-onboard="ob-continue">Continue</);
});

test('a platform can hide the expanded omnibox', () => {
  for (const capabilities of [{ omnibox: false }, { omniboxSuggestions: false }, { toolbar: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-031'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('arrow keys move the selected suggestion and wrap', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-031');
  m.key('ArrowDown');
  assert.match(m.state.html, /Suggestion 2 of 6\./);
  assert.match(m.state.html, /data-ob-index="1"/);
  m.key('ArrowUp');
  m.key('ArrowUp');
  assert.match(m.state.html, /Suggestion 6 of 6\./);
  assert.match(m.state.html, /data-ob-index="5"/);
});

test('choosing a row opens that suggestion in the preview', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-031');
  m.clickIndex(3);
  assert.match(m.state.html, /Opened vaayvu browser in this preview\./);
  assert.match(m.state.html, /data-ob-index="3"/);
});

test('Continue on s-031 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-031');
  m.click('ob-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the omnibox event opens s-031 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'omnibox' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-031');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'omnibox', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-031 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
