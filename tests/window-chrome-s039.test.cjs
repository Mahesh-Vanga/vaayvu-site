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

test('s-039 renders the download shelf with files and controls', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-039'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-039');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Downloads shelf');
  assert.match(m.state.html, /dl-shelf/);
  assert.match(m.state.html, /Vaayvu-0\.0\.23-macOS\.dmg/);
  assert.match(m.state.html, /Wikipedia-Reading-Type\.zip/);
  assert.match(m.state.html, /data-onboard="dl-history"/);
  assert.match(m.state.html, /data-onboard="dl-clear"/);
  assert.match(m.state.html, /01 Shelf/);
  assert.match(m.state.html, /02 History/);
  assert.match(m.state.html, /03 Clear/);
  assert.match(m.state.html, /data-onboard="dl-continue">Continue</);
});

test('a platform can hide the download shelf', () => {
  for (const capabilities of [{ downloadShelf: false }, { downloads: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-039'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('History opens the side drawer with older downloads', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-039');
  m.click('dl-history');
  assert.match(m.state.html, /dl-history"/);
  assert.match(m.state.html, /annual-report\.pdf/);
  assert.match(m.state.html, /site-assets\.zip/);
  assert.match(m.state.html, /Download history open\./);
  m.click('dl-close-history');
  assert.doesNotMatch(m.state.html, /annual-report\.pdf/);
  assert.match(m.state.html, /Download history closed\./);
});

test('Clear empties the shelf and history', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-039');
  m.click('dl-history');
  m.click('dl-clear');
  assert.match(m.state.html, /No downloads on the shelf\./);
  assert.match(m.state.html, /Download shelf and history cleared\./);
  assert.doesNotMatch(m.state.html, /annual-report\.pdf/);
});

test('a download row reports what it opened', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-039');
  m.clickData('dl-open', 'dlName', 'notes.pdf');
  assert.match(m.state.html, /Opened notes\.pdf in this preview\./);
});

test('Continue on s-039 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-039');
  m.click('dl-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the downloadShelf event opens s-039 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'downloadShelf' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-039');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'downloadShelf', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-039 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
