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

const tabCount = (html) => (html.match(/class="pvt-tab[ "]/g) || []).length;

test('s-092 renders a private window with no history', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-092'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-092');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Private tabs');
  assert.match(m.state.html, /class="pvt-window"/);
  assert.equal(tabCount(m.state.html), 3);
  assert.match(m.state.html, /Not saved to history/);
  assert.match(m.state.html, /0 entries/);
  assert.match(m.state.html, /Private tabs never write to history/);
  assert.match(m.state.html, /3 private tabs open\. History stays empty\./);
  assert.match(m.state.html, /01 Private styling/);
  assert.match(m.state.html, /02 No history/);
  assert.match(m.state.html, /03 New tab/);
  assert.match(m.state.html, /04 Close/);
});

test('a platform can hide private tabs', () => {
  for (const capabilities of [{ privateTabs: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-092'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('a new private tab keeps history empty', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-092');
  m.click('pvt-new');
  assert.equal(tabCount(m.state.html), 4);
  assert.match(m.state.html, /Private tab 4/);
  assert.match(m.state.html, /Private tab opened\. History is still empty\./);
  assert.match(m.state.html, /0 entries/);
});

test('closing the private window clears it without history', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-092');
  m.click('pvt-close');
  assert.equal(tabCount(m.state.html), 0);
  assert.match(m.state.html, /Private window closed\. Nothing was written to history\./);
  assert.match(m.state.html, /Private window closed<\/strong>/);
  assert.match(m.state.html, /data-onboard="pvt-reopen"/);
  assert.match(m.state.html, /0 entries/);
});

test('Reopen restores the private tabs', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-092');
  m.click('pvt-close');
  m.click('pvt-reopen');
  assert.equal(tabCount(m.state.html), 3);
  assert.match(m.state.html, /Private window reopened\. History is still empty\./);
});

test('Continue on s-092 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-092');
  m.click('pvt-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the privateTabs event opens s-092 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'privateTabs' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-092');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'privateTabs', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-092 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
