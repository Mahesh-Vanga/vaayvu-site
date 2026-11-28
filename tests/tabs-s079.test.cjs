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

test('s-079 renders a four-pane grid with a toolbar per pane', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-079'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-079');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Split 3/4-up');
  assert.match(m.state.html, /sg-grid is-4/);
  assert.match(m.state.html, /4-up grid, 4 panes\./);
  assert.equal((m.state.html.match(/class="sg-pane/g) || []).length, 4);
  assert.match(m.state.html, /Reading/);
  assert.match(m.state.html, /Inbox/);
  assert.match(m.state.html, /Docs/);
  assert.match(m.state.html, /data-onboard="sg-back"/);
  assert.match(m.state.html, /data-onboard="sg-forward"/);
  assert.match(m.state.html, /data-onboard="sg-reload"/);
  assert.match(m.state.html, /data-onboard="sg-close"/);
  assert.match(m.state.html, /01 Grid/);
  assert.match(m.state.html, /02 Pane/);
  assert.match(m.state.html, /03 Toolbar/);
  assert.match(m.state.html, /04 Close and add/);
});

test('a platform can hide the split grid', () => {
  for (const capabilities of [{ splitGrid: false }, { splitView: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-079'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('the layout switches between 4-up and 3-up', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-079');
  m.click('sg-layout');
  assert.match(m.state.html, /sg-grid is-3/);
  assert.match(m.state.html, /3-up grid\./);
  assert.equal((m.state.html.match(/class="sg-pane/g) || []).length, 3);
  m.click('sg-layout');
  assert.match(m.state.html, /sg-grid is-4/);
  assert.equal((m.state.html.match(/class="sg-pane/g) || []).length, 4);
});

test('reload and history act on one pane only', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-079');
  m.click('sg-reload', { pane: '1' });
  assert.match(m.state.html, /Notes reloaded\. 1 in this pane\./);
  assert.match(m.state.html, /1 reload in this pane/);
  m.click('sg-back', { pane: '1' });
  assert.match(m.state.html, /Notes has no earlier page\./);
  m.click('sg-forward', { pane: '1' });
  assert.match(m.state.html, /Notes history 1 of 3\./);
  m.click('sg-back', { pane: '0' });
  assert.match(m.state.html, /Reading history 0 of 3\./);
  assert.match(m.state.html, /aria-label="Back in Reading" disabled/);
});

test('a pane can be focused, closed and added back', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-079');
  m.click('sg-focus', { pane: '2' });
  assert.match(m.state.html, /Focused Inbox\./);
  m.click('sg-close', { pane: '2' });
  assert.match(m.state.html, /Inbox pane closed\. 3 left\./);
  assert.doesNotMatch(m.state.html, /aria-label="Inbox pane"/);
  m.click('sg-add');
  assert.match(m.state.html, /Inbox pane added\./);
  assert.match(m.state.html, /Inbox/);
});

test('closing every pane leaves an honest empty state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-079');
  for (let i = 0; i < 4; i += 1) m.click('sg-close', { pane: '0' });
  assert.match(m.state.html, /No panes open\. Add a pane to start again\./);
  assert.match(m.state.html, /aria-label="Add pane"|Add pane/);
  m.click('sg-add');
  assert.match(m.state.html, /Docs pane added\.|Reading pane added\.|Notes pane added\.|Inbox pane added\./);
});

test('Continue on s-079 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-079');
  m.click('sg-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the splitGrid event opens s-079 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'splitGrid' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-079');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'splitGrid', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-079 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
