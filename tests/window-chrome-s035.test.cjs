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
  const clickData = (name, key, value) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: name, [key]: value } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickData, context };
}

test('s-035 renders folders, overflow and edit on the bookmarks bar', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-035'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-035');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Bookmarks bar');
  assert.match(m.state.html, /bm-bar/);
  assert.match(m.state.html, /Design/);
  assert.match(m.state.html, /Reading/);
  assert.match(m.state.html, /bm-overflow/);
  assert.match(m.state.html, /bm-edit/);
  assert.match(m.state.html, /Moodboard/);
  assert.match(m.state.html, /01 Folders/);
  assert.match(m.state.html, /02 Overflow/);
  assert.match(m.state.html, /03 Edit/);
  assert.match(m.state.html, /data-onboard="bm-continue">Continue</);
});

test('a platform can hide the bookmarks bar', () => {
  for (const capabilities of [{ bookmarksBar: false }, { bookmarks: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-035'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('folders and overflow open their own menus', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-035');
  m.clickData('bm-folder', 'bmId', 'reading');
  assert.match(m.state.html, /Longform/);
  assert.doesNotMatch(m.state.html, /Moodboard/);
  m.click('bm-overflow');
  assert.match(m.state.html, /More bookmarks/);
  assert.match(m.state.html, /Linear/);
  assert.match(m.state.html, /Notion/);
});

test('Edit adds remove controls, removal works and Reset restores the row', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-035');
  m.click('bm-edit');
  assert.match(m.state.html, /Edit mode on\. Remove what you do not need\./);
  assert.match(m.state.html, /data-onboard="bm-remove" data-bm-id="vaayvu"/);
  m.clickData('bm-remove', 'bmId', 'vaayvu');
  assert.doesNotMatch(m.state.html, /data-onboard="bm-remove" data-bm-id="vaayvu"/);
  assert.match(m.state.html, /Vaayvu removed from the bar\./);
  m.click('bm-reset');
  assert.match(m.state.html, /data-bm-id="vaayvu"/);
  assert.match(m.state.html, /Bookmarks bar reset\./);
  assert.doesNotMatch(m.state.html, /data-onboard="bm-remove"/);
});

test('Continue on s-035 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-035');
  m.click('bm-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the bookmarksBar event opens s-035 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'bookmarksBar' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-035');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'bookmarksBar', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-035 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
