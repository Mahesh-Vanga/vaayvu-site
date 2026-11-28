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
  const chooseColor = (color) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'at-color', color } } : null,
      },
    });
  return { dataset, state, overlay, step, click, chooseColor, context };
}

test('s-066 renders the active tab with every part', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-066'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-066');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Active tab');
  assert.match(m.state.html, /at-tab is-active/);
  assert.match(m.state.html, /at-favicon/);
  assert.match(m.state.html, /Linear — Q4 roadmap/);
  assert.match(m.state.html, /data-onboard="at-audio"/);
  assert.match(m.state.html, /data-onboard="at-close"/);
  assert.match(m.state.html, /data-onboard="at-color"/);
  assert.match(m.state.html, /01 Favicon and title/);
  assert.match(m.state.html, /02 Audio/);
  assert.match(m.state.html, /03 Close/);
  assert.match(m.state.html, /04 Group colour/);
});

test('a platform can hide the active tab', () => {
  for (const capabilities of [{ activeTab: false }, { startPage: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-066'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('audio and close update the tab', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-066');
  m.click('at-audio');
  assert.match(m.state.html, /Tab audio muted\./);
  assert.match(m.state.html, /at-audio is-muted/);
  m.click('at-audio');
  assert.match(m.state.html, /Tab audio unmuted\./);
  m.click('at-close');
  assert.match(m.state.html, /Tab closed\. Reopen restores it\./);
  assert.match(m.state.html, /data-onboard="at-reopen"/);
  m.click('at-reopen');
  assert.match(m.state.html, /Tab reopened\./);
  assert.match(m.state.html, /Linear — Q4 roadmap/);
});

test('group colour changes the tab accent', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-066');
  m.chooseColor('#e84393');
  assert.match(m.state.html, /Group colour set to Rose\./);
  assert.match(m.state.html, /--tab-color:#e84393/);
  assert.match(m.state.html, /at-color is-active/);
});

test('Continue on s-066 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-066');
  m.click('at-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the activeTab event opens s-066 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'activeTab' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-066');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'activeTab', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-066 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
