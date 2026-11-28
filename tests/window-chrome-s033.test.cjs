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
  return { dataset, state, overlay, step, click, context };
}

test('s-033 renders the active camera chip and revoke path', () => {
  const m = mount({
    capabilities: { permissionsChip: { site: 'meet.example.com', camera: 'Allowed' } },
  });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-033'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-033');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Permissions chip');
  assert.match(m.state.html, /perm-chip is-on/);
  assert.match(m.state.html, /Camera is on/);
  assert.match(m.state.html, /Revoke camera/);
  assert.match(m.state.html, /Microphone <b>Ask<\/b>/);
  assert.match(m.state.html, /Location <b>Blocked<\/b>/);
  assert.match(m.state.html, /01 Active permission/);
  assert.match(m.state.html, /02 Details/);
  assert.match(m.state.html, /03 Revoke/);
});

test('a platform can hide the permissions chip', () => {
  for (const capabilities of [
    { permissionsChip: false },
    { permissions: false },
    { omnibox: false },
    { securityChip: false },
  ]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-033'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Revoke removes the grant and the site must ask again', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-033');
  m.click('perm-revoke');
  assert.match(m.state.html, /perm-chip is-ask/);
  assert.match(m.state.html, /Camera is asking/);
  assert.match(m.state.html, /Camera revoked for meet\.example\.com\. The site must ask again\./);
  assert.match(m.state.html, /Allow camera/);
});

test('Allow restores the grant and Close keeps the chip visible', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-033');
  m.click('perm-revoke');
  m.click('perm-allow');
  assert.match(m.state.html, /perm-chip is-on/);
  assert.match(m.state.html, /Camera is on/);
  assert.match(m.state.html, /Camera allowed for meet\.example\.com\./);

  m.click('perm-close');
  assert.doesNotMatch(m.state.html, /perm-panel/);
  assert.match(m.state.html, /Panel closed\. The chip still shows the active permission\./);
  m.click('perm-toggle');
  assert.match(m.state.html, /perm-panel/);
});

test('Continue on s-033 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-033');
  m.click('perm-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the permissionsChip event opens s-033 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'permissionsChip' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-033');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'permissionsChip', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-033 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
