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
  const input = (value) => {
    for (const fn of listeners.input || []) {
      fn({ target: { hasAttribute: (name) => name === 'data-mobile-list-search', value } });
    }
  };
  return { dataset, state, overlay, step, click, input, context };
}

const rows = (html) => (html.match(/class="ml-row[ "]/g) || []).length;

test('s-082 renders compact rows with a search field', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-082'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-082');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Mobile tab list');
  assert.match(m.state.html, /data-mobile-list-search/);
  assert.equal(rows(m.state.html), 6);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /Weather/);
  assert.match(m.state.html, /Research/);
  assert.match(m.state.html, /Personal/);
  assert.match(m.state.html, /01 Rows/);
  assert.match(m.state.html, /02 Search/);
  assert.match(m.state.html, /03 Group tag/);
  assert.match(m.state.html, /6 tabs in a compact list\./);
});

test('a platform can hide the mobile tab list', () => {
  for (const capabilities of [{ mobileTabList: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-082'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('search filters rows by title, host and group', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-082');
  m.input('weather');
  assert.equal(rows(m.state.html), 1);
  assert.match(m.state.html, /Weather/);
  assert.match(m.state.html, /1 of 6 tabs match\./);
  m.input('personal');
  assert.equal(rows(m.state.html), 3);
  assert.match(m.state.html, /3 of 6 tabs match\./);
  m.input('mail');
  assert.equal(rows(m.state.html), 1);
  assert.match(m.state.html, /Inbox/);
  m.input('nothing-here');
  assert.equal(rows(m.state.html), 0);
  assert.match(m.state.html, /No tabs match that search\./);
});

test('Clear restores the whole list', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-082');
  m.input('weather');
  assert.equal(rows(m.state.html), 1);
  m.click('ml-clear');
  assert.match(m.state.html, /Search cleared\./);
  assert.equal(rows(m.state.html), 6);
});

test('a row can be selected and reports the switch', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-082');
  m.click('ml-card', { mlTitle: 'Inbox' });
  assert.match(m.state.html, /Switched to Inbox\./);
  assert.match(m.state.html, /aria-pressed="true">Inbox|data-ml-title="Inbox"[^]*aria-pressed="true"/);
});

test('Continue on s-082 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-082');
  m.click('ml-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mobileTabList event opens s-082 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'mobileTabList' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-082');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'mobileTabList', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-082 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
