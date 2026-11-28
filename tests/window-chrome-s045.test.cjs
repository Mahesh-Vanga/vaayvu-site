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

test('s-045 renders recent pages and tasks in the jump list', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-045'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-045');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Windows jump list/taskbar');
  assert.match(m.state.html, /jl-menu/);
  assert.match(m.state.html, /The Observatory/);
  assert.match(m.state.html, /VAAYVU documentation/);
  assert.match(m.state.html, /New window/);
  assert.match(m.state.html, /New private window/);
  assert.match(m.state.html, /New tab/);
  assert.match(m.state.html, /01 Recent/);
  assert.match(m.state.html, /02 Tasks/);
  assert.match(m.state.html, /03 Taskbar/);
});

test('a platform can hide the jump list', () => {
  for (const capabilities of [{ jumpList: false }, { taskbar: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-045'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('recent pages and tasks report their action', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-045');
  m.clickData('jl-recent', 'jlName', 'India news');
  assert.match(m.state.html, /Opened India news from the jump list\./);
  m.clickData('jl-task', 'jlTask', 'private');
  assert.match(m.state.html, /A new private window would open with temporary storage\./);
  m.clickData('jl-task', 'jlTask', 'newtab');
  assert.match(m.state.html, /A new tab would open in the current window\./);
});

test('the taskbar button closes and reopens the jump list', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-045');
  m.click('jl-taskbar');
  assert.doesNotMatch(m.state.html, /jl-menu/);
  assert.match(m.state.html, /Open jump list/);
  assert.match(m.state.html, /Jump list closed\./);
  m.click('jl-open');
  assert.match(m.state.html, /jl-menu/);
  assert.match(m.state.html, /Jump list open\./);
});

test('Continue on s-045 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-045');
  m.click('jl-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the jumpList event opens s-045 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'jumpList' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-045');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'jumpList', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-045 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
