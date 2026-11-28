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
  const listeners = {};
  const overlay = {
    setAttribute(key, value) { state.attrs[key] = value; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); overlay['on' + type] = fn; },
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
  const click = (name, extra = {}) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: name, ...extra } } : null) },
    });
  return { dataset, state, overlay, step, click, context };
}

test('s-085 renders a tab strip ready to lift', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-085'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-085');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Drag/reorder');
  assert.equal((m.state.html.match(/class="dr-tab"/g) || []).length, 8);
  assert.match(m.state.html, /8 tabs\. Lift one to start\./);
  assert.match(m.state.html, /data-onboard="dr-drop" disabled/);
  assert.match(m.state.html, /01 Lift/);
  assert.match(m.state.html, /02 Gap/);
  assert.match(m.state.html, /03 Auto-scroll/);
  assert.match(m.state.html, /04 Drop/);
});

test('a platform can hide drag reorder', () => {
  for (const capabilities of [{ dragReorder: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-085'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('lifting and moving the gap tracks the drop position', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-085');
  m.click('dr-lift', { drTitle: 'Reading' });
  assert.match(m.state.html, /Lifted Reading\. Move the gap, then drop\./);
  assert.match(m.state.html, /class="dr-chip"/);
  assert.match(m.state.html, /class="dr-gap"/);
  assert.equal((m.state.html.match(/class="dr-tab"/g) || []).length, 7);
  m.click('dr-right');
  assert.match(m.state.html, /Gap at position 2\./);
  m.click('dr-right');
  assert.match(m.state.html, /Gap at position 3\./);
  m.click('dr-left');
  assert.match(m.state.html, /Gap at position 2\./);
});

test('auto-scroll announces its state and only works while lifted', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-085');
  assert.match(m.state.html, /data-onboard="dr-scroll" aria-pressed="false" disabled/);
  m.click('dr-lift', { drTitle: 'Notes' });
  m.click('dr-scroll');
  assert.match(m.state.html, /Auto-scroll on: the strip follows the pointer near an edge\./);
  assert.match(m.state.html, /aria-pressed="true"/);
  assert.match(m.state.html, /dr-stage is-scrolling/);
  m.click('dr-scroll');
  assert.match(m.state.html, /Auto-scroll off\./);
});

test('Drop commits the new order', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-085');
  m.click('dr-lift', { drTitle: 'Reading' });
  m.click('dr-right');
  m.click('dr-right');
  m.click('dr-drop');
  assert.match(m.state.html, /Dropped Reading at position 3\./);
  assert.match(m.state.html, /Reading<\/button>[\s\S]*Docs<\/button>/);
  assert.doesNotMatch(m.state.html, /class="dr-gap"/);
  assert.doesNotMatch(m.state.html, /class="dr-chip"/);
  assert.match(m.state.html, /data-onboard="dr-drop" disabled/);
});

test('Cancel keeps the original order', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-085');
  m.click('dr-lift', { drTitle: 'Weather' });
  m.click('dr-right');
  m.click('dr-cancel');
  assert.match(m.state.html, /Reorder cancelled\. The order is unchanged\./);
  assert.match(m.state.html, /Reading<\/button>[\s\S]*Weather<\/button>[\s\S]*Docs<\/button>/);
});

test('Continue on s-085 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-085');
  m.click('dr-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the dragReorder event opens s-085 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'dragReorder' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-085');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'dragReorder', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-085 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
