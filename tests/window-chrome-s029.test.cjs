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
    setItem: (key, value) => map.set(key, String(value)),
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
  const dragStart = (id) =>
    overlay.ondragstart({
      target: {
        closest: (selector) =>
          selector === '[data-toolbar-item][draggable="true"]'
            ? { dataset: { toolbarItem: id }, classList: { add() {} } }
            : null,
      },
      dataTransfer: null,
    });
  const dropOn = (id) =>
    overlay.ondrop({
      target: {
        closest: (selector) =>
          selector === '[data-toolbar-item]' ? { dataset: { toolbarItem: id } } : null,
      },
      preventDefault() {},
    });
  return { dataset, state, overlay, step, click, clickData, dragStart, dropOn, context };
}

test('s-029 renders the customize toolbar on the window-chrome route', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-029'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-029');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Toolbar customize');
  assert.match(m.state.html, /tc-bar/);
  assert.match(m.state.html, /data-toolbar-zone="shown"/);
  assert.match(m.state.html, /data-toolbar-zone="hidden"/);
  assert.match(m.state.html, /draggable="true"/);
  assert.match(m.state.html, /data-onboard="toolbar-reset">Reset</);
  assert.match(m.state.html, /01 Drag/);
  assert.match(m.state.html, /02 Show\/hide/);
  assert.match(m.state.html, /03 Reset/);
  assert.match(m.state.html, /data-onboard="toolbar-custom-continue">Continue</);
});

test('a platform can hide toolbar customization while keeping the toolbar', () => {
  for (const capabilities of [{ toolbarCustomize: false }, { toolbar: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-029'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Hide moves a control to Available and Show brings it back', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-029');
  assert.match(m.state.html, /data-toolbar-hide="back"/);
  m.clickData('toolbar-hide', 'toolbarHide', 'back');
  assert.doesNotMatch(m.state.html, /data-toolbar-hide="back"/);
  assert.match(m.state.html, /data-toolbar-show="back"/);
  assert.match(m.state.html, /Back hidden. It is in Available./);
  m.clickData('toolbar-show', 'toolbarShow', 'back');
  assert.match(m.state.html, /data-toolbar-hide="back"/);
  assert.match(m.state.html, /Back added to the toolbar./);
});

test('Reset restores the default row after edits', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-029');
  m.clickData('toolbar-hide', 'toolbarHide', 'menu');
  assert.doesNotMatch(m.state.html, /data-toolbar-hide="menu"/);
  m.click('toolbar-reset');
  assert.match(m.state.html, /data-toolbar-hide="menu"/);
  assert.match(m.state.html, /Toolbar reset to the default controls./);
});

test('dragging a row reorders the toolbar', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-029');
  assert.ok(
    m.state.html.indexOf('data-toolbar-item="back"') <
      m.state.html.indexOf('data-toolbar-item="menu"'),
  );
  m.dragStart('menu');
  m.dropOn('back');
  assert.match(m.state.html, /Toolbar order updated\./);
  assert.ok(
    m.state.html.indexOf('data-toolbar-item="menu"') <
      m.state.html.indexOf('data-toolbar-item="back"'),
  );
});

test('Continue on s-029 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-029');
  m.click('toolbar-custom-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the toolbarCustomize event opens s-029 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'toolbarCustomize' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-029');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'toolbarCustomize', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-029 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
