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
  const clickAction = (name) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'am-action', am: name } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickAction, context };
}

test('s-043 renders the app menu with every requested row', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-043'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-043');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'App menu');
  assert.match(m.state.html, /am-menu/);
  for (const label of [
    'New tab',
    'New window',
    'New private window',
    'History',
    'Bookmarks',
    'Downloads',
    'Settings',
    'Help and shortcuts',
    'Quit Vaayvu',
  ])
    assert.ok(m.state.html.includes(label), label);
  assert.match(m.state.html, /01 New/);
  assert.match(m.state.html, /02 Library/);
  assert.match(m.state.html, /03 App/);
  assert.match(m.state.html, /04 Quit/);
  assert.doesNotMatch(m.state.html, /VPN/i);
  assert.doesNotMatch(m.state.html, /Vaayvu Search/i);
});

test('a platform can hide the app menu', () => {
  for (const capabilities of [{ appMenu: false }, { browserMenu: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-043'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('menu rows report the surface they would open', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-043');
  m.clickAction('newtab');
  assert.match(m.state.html, /A new tab would open in this window\./);
  m.clickAction('private');
  assert.match(m.state.html, /A private window would open with temporary storage\./);
  m.clickAction('downloads');
  assert.match(m.state.html, /Downloads would open for this profile\./);
  m.clickAction('settings');
  assert.match(m.state.html, /Settings would open on this page\./);
});

test('Quit asks once and never closes the preview', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-043');
  m.click('am-quit');
  assert.match(m.state.html, /Quit Vaayvu\? All windows close\./);
  m.click('am-quit-cancel');
  assert.match(m.state.html, /Quit cancelled\./);
  m.click('am-quit');
  m.click('am-quit-confirm');
  assert.match(m.state.html, /Quit is owned by the native app menu; this preview stays open\./);
});

test('Continue on s-043 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-043');
  m.click('am-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the appMenu event opens s-043 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'appMenu' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-043');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'appMenu', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-043 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
