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
  const clickData = (name, key, value) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: name, [key]: value } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickData, context };
}

test('s-055 renders frequently visited tiles on the start page', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-055'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-055');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Frequently visited');
  assert.match(m.state.html, /fv-grid/);
  assert.match(m.state.html, /Vaayvu/);
  assert.match(m.state.html, /fv-auto/);
  assert.match(m.state.html, /data-onboard="fv-edit"/);
  assert.match(m.state.html, /01 Auto/);
  assert.match(m.state.html, /02 Hide/);
  assert.match(m.state.html, /03 Remove/);
});

test('a platform can hide frequently visited', () => {
  for (const capabilities of [{ frequentVisited: false }, { startPage: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-055'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Auto can be switched off and back on', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-055');
  m.click('fv-auto');
  assert.match(m.state.html, /aria-checked="false"/);
  assert.match(m.state.html, /Automatic updates off\. The tiles stay as they are\./);
  m.click('fv-auto');
  assert.match(m.state.html, /Frequently visited updates automatically again\./);
});

test('Edit reveals Hide and Remove; Hide keeps the visit in history', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-055');
  m.click('fv-edit');
  assert.match(m.state.html, /data-onboard="fv-hide"/);
  assert.match(m.state.html, /data-onboard="fv-remove"/);
  m.clickData('fv-hide', 'fvId', 'vaayvu');
  assert.match(m.state.html, /is-hidden/);
  assert.match(m.state.html, /Vaayvu hidden from the page; history is unchanged\./);
  m.clickData('fv-remove', 'fvId', 'github');
  assert.doesNotMatch(m.state.html, /data-fv-name="GitHub"/);
  assert.match(m.state.html, /GitHub removed from this page\./);
});

test('Reset restores the tile set', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-055');
  m.click('fv-edit');
  m.clickData('fv-remove', 'fvId', 'figma');
  assert.doesNotMatch(m.state.html, /data-fv-name="Figma"/);
  m.click('fv-reset');
  assert.match(m.state.html, /Figma/);
  assert.match(m.state.html, /Frequently visited reset\./);
});

test('Continue on s-055 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-055');
  m.click('fv-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the frequentVisited event opens s-055 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'frequentVisited' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-055');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'frequentVisited', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-055 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
