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
  const click = (name) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: name } } : null) },
    });
  const clickTab = (title) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: 'ge-tab-close', geTitle: title } } : null) },
    });
  const chooseColor = (color) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: 'ge-color', color } } : null) },
    });
  const change = (target) => {
    for (const fn of listeners.change || []) fn({ target });
  };
  return { dataset, state, overlay, step, click, clickTab, chooseColor, change, context };
}

test('s-076 renders the expanded group with tabs and controls', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-076'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-076');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Group expanded');
  assert.match(m.state.html, /Research/);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /Browser shells/);
  assert.match(m.state.html, /data-onboard="ge-edit"/);
  assert.match(m.state.html, /data-onboard="ge-close"/);
  assert.match(m.state.html, /data-onboard="ge-tab-close"/);
  assert.match(m.state.html, /01 Tabs/);
  assert.match(m.state.html, /02 Edit/);
  assert.match(m.state.html, /03 Close/);
  assert.match(m.state.html, /04 Group/);
});

test('a platform can hide the expanded group', () => {
  for (const capabilities of [{ groupExpanded: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-076'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('closing a tab updates the group count', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-076');
  m.clickTab('Arc paper');
  assert.doesNotMatch(m.state.html, /data-ge-title="Arc paper"/);
  assert.match(m.state.html, /Arc paper closed\. 3 left in Research\./);
});

test('Edit renames and recolours the group', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-076');
  m.click('ge-edit');
  assert.match(m.state.html, /data-group-name/);
  m.change({ hasAttribute: (name) => name === 'data-group-name', value: 'Design' });
  m.chooseColor('#e84393');
  m.click('ge-save');
  assert.match(m.state.html, /Design/);
  assert.match(m.state.html, /--group-color:#e84393/);
  assert.match(m.state.html, /Group saved\./);
});

test('Close group and Reopen work', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-076');
  m.click('ge-close');
  assert.match(m.state.html, /Research group closed\./);
  assert.match(m.state.html, /Reopen group/);
  m.click('ge-reopen');
  assert.match(m.state.html, /Research group reopened\./);
  assert.match(m.state.html, /Arc paper/);
});

test('Continue on s-076 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-076');
  m.click('ge-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the groupExpanded event opens s-076', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'groupExpanded' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-076');
});
