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

function mount({ capabilities = {} } = {}) {
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
    localStorage: memoryStore(),
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
  return { dataset, state, context };
}

test('s-066 and s-073 are tabs, not start page', () => {
  for (const id of ['s-066', 's-073']) {
    const m = mount();
    assert.equal(m.context.window.__vaayvuOnboardingOpen(id), true, id);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/' + id, id);
    assert.equal(m.dataset.atlasCategory, 'tabs', id);
    assert.equal(m.dataset.onboardingPhase, 'p05', id);
  }
});

test('s-065 remains start page', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-065'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-065');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.dataset.onboardingPhase, 'p05');
});
