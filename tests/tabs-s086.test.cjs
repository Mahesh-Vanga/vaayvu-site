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

const tabCount = (html) => (html.match(/class="tp-tab/g) || []).length;

test('s-086 renders the main window with tear-off controls', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-086'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-086');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tear-off preview');
  assert.equal(tabCount(m.state.html), 4);
  assert.match(m.state.html, /Main window/);
  assert.match(m.state.html, /data-onboard="tp-drop" disabled/);
  assert.match(m.state.html, /data-onboard="tp-cancel" disabled/);
  assert.match(m.state.html, /4 tabs in the main window\. Lift one to preview a new window\./);
  assert.match(m.state.html, /01 Ghost window/);
  assert.match(m.state.html, /02 Drop/);
  assert.match(m.state.html, /03 Detach/);
  assert.match(m.state.html, /04 Reattach/);
});

test('a platform can hide the tear-off preview', () => {
  for (const capabilities of [{ tearOff: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-086'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('lifting a tab shows the ghost window and a gap', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-086');
  m.click('tp-lift', { tpTitle: 'Reading' });
  assert.match(m.state.html, /Ghost window: Reading\. Drop to detach, or cancel\./);
  assert.match(m.state.html, /class="tp-ghost"/);
  assert.match(m.state.html, /tp-ghost/);
  assert.match(m.state.html, /class="tp-gap"/);
  assert.equal(tabCount(m.state.html), 3);
  assert.match(m.state.html, /data-onboard="tp-drop">Drop to detach/);
});

test('Cancel dismisses the ghost and keeps the order', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-086');
  m.click('tp-lift', { tpTitle: 'Notes' });
  m.click('tp-cancel');
  assert.match(m.state.html, /Ghost dismissed\. The tab stayed put\./);
  assert.equal(tabCount(m.state.html), 4);
  assert.doesNotMatch(m.state.html, /class="tp-ghost"/);
  assert.match(m.state.html, /Reading<\/button>[\s\S]*Notes<\/button>[\s\S]*Weather<\/button>/);
});

test('Drop detaches the tab into its own window', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-086');
  m.click('tp-lift', { tpTitle: 'Sources' });
  m.click('tp-drop');
  assert.match(m.state.html, /Detached Sources into a new window\./);
  assert.match(m.state.html, /class="tp-detached"/);
  assert.match(m.state.html, /Detached window/);
  assert.match(m.state.html, /data-onboard="tp-reattach"/);
  assert.equal(tabCount(m.state.html), 3);
  assert.doesNotMatch(m.state.html, /class="tp-ghost"/);
});

test('Reattach brings the tab back to its old place', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-086');
  m.click('tp-lift', { tpTitle: 'Sources' });
  m.click('tp-drop');
  m.click('tp-reattach');
  assert.match(m.state.html, /Sources reattached to the main window\./);
  assert.equal(tabCount(m.state.html), 4);
  assert.doesNotMatch(m.state.html, /class="tp-detached"/);
  assert.match(m.state.html, /Notes<\/button>[\s\S]*Sources<\/button>[\s\S]*Weather<\/button>/);
});

test('Continue on s-086 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-086');
  m.click('tp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the tearOff event opens s-086 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'tearOff' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-086');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'tearOff', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-086 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
