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
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
      overlay['on' + type] = fn;
    },
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
  const clickIndex = (index) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'cp-run', cpIndex: index } } : null,
      },
    });
  const key = (name) => {
    for (const fn of listeners.keydown || [])
      fn({ key: name, preventDefault() {} });
  };
  return { dataset, state, overlay, step, click, clickIndex, key, context };
}

test('s-050 renders the command palette with all sections', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-050'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-050');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Command palette');
  assert.match(m.state.html, /cp-panel/);
  assert.match(m.state.html, /⌘K \/ Ctrl\+K/);
  for (const section of ['Actions', 'Tabs', 'History', 'Settings', 'AI'])
    assert.ok(m.state.html.includes(section), section);
  assert.match(m.state.html, /Ask about this page/);
  assert.match(m.state.html, /01 Shortcut/);
  assert.match(m.state.html, /02 Sections/);
  assert.match(m.state.html, /03 Keyboard/);
});

test('a platform can hide the command palette', () => {
  for (const capabilities of [{ commandPalette: false }, { commandBar: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-050'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('arrow keys move the highlight and wrap', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-050');
  m.key('ArrowDown');
  assert.match(m.state.html, /Command 2 of 10\./);
  m.key('ArrowUp');
  m.key('ArrowUp');
  assert.match(m.state.html, /Command 10 of 10\./);
  assert.match(m.state.html, /data-cp-index="9"/);
});

test('running the selected row reports it', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-050');
  m.clickIndex(8);
  assert.match(m.state.html, /Ran Privacy and security in this preview\./);
});

test('Close hides the palette and Open brings it back', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-050');
  m.click('cp-close');
  assert.doesNotMatch(m.state.html, /cp-panel/);
  assert.match(m.state.html, /Command bar closed/);
  assert.match(m.state.html, /Command bar closed\. Press ⌘K \/ Ctrl\+K to reopen\./);
  m.click('cp-open');
  assert.match(m.state.html, /cp-panel/);
  assert.match(m.state.html, /Command bar open\./);
});

test('Continue on s-050 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-050');
  m.click('cp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the commandPalette event opens s-050 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'commandPalette' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-050');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'commandPalette', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-050 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
