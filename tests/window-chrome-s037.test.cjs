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

test('s-037 renders the find bar with input, count and options', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-037'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-037');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Find bar');
  assert.match(m.state.html, /fb-input/);
  assert.match(m.state.html, /value="vaayvu"/);
  assert.match(m.state.html, /3 of 12/);
  assert.match(m.state.html, /data-onboard="findbar-prev"/);
  assert.match(m.state.html, /data-onboard="findbar-next"/);
  assert.match(m.state.html, /data-onboard="findbar-case"/);
  assert.match(m.state.html, /data-onboard="findbar-word"/);
  assert.match(m.state.html, /data-onboard="findbar-close"/);
  assert.match(m.state.html, /01 Input/);
  assert.match(m.state.html, /02 Count/);
  assert.match(m.state.html, /03 Options/);
  assert.match(m.state.html, /04 Close/);
});

test('a platform can hide the find bar', () => {
  for (const capabilities of [{ findBar: false }, { pageFind: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-037'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('prev and next step through the matches and wrap', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-037');
  m.click('findbar-next');
  assert.match(m.state.html, /4 of 12/);
  m.click('findbar-prev');
  m.click('findbar-prev');
  m.click('findbar-prev');
  assert.match(m.state.html, /1 of 12/);
  m.click('findbar-prev');
  assert.match(m.state.html, /12 of 12/);
  m.click('findbar-next');
  assert.match(m.state.html, /1 of 12/);
});

test('match case and whole word narrow the count', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-037');
  m.click('findbar-case');
  assert.match(m.state.html, /1 of 5/);
  assert.match(m.state.html, /Match case on\. 5 matches\./);
  m.click('findbar-word');
  assert.match(m.state.html, /1 of 3/);
  assert.match(m.state.html, /Whole word on\. 3 matches\./);
  assert.match(m.state.html, /fb-case is-on/);
  assert.match(m.state.html, /fb-word is-on/);
});

test('Close hides the bar and Find reopens it', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-037');
  m.click('findbar-close');
  assert.doesNotMatch(m.state.html, /fb-bar/);
  assert.match(m.state.html, /fb-open/);
  assert.match(m.state.html, /Find bar closed\. Press ⌘F or use Find to reopen it\./);
  m.click('findbar-open');
  assert.match(m.state.html, /fb-bar/);
  assert.match(m.state.html, /Find bar open\. Match 1 of 12\./);
});

test('Continue on s-037 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-037');
  m.click('findbar-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the findBar event opens s-037 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'findBar' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-037');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'findBar', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-037 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
