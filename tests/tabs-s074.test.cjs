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
  return { dataset, state, overlay, step, click, context };
}

test('s-074 renders the hover preview with every part', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-074'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-074');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Hover preview');
  assert.match(m.state.html, /hp-preview/);
  assert.match(m.state.html, /hp-thumb/);
  assert.match(m.state.html, /VAAYVU documentation/);
  assert.match(m.state.html, /github\.com\/Mahesh-Vanga/);
  assert.match(m.state.html, /data-onboard="hp-mute"/);
  assert.match(m.state.html, /data-onboard="hp-close"/);
  assert.match(m.state.html, /01 Thumbnail/);
  assert.match(m.state.html, /02 Title and URL/);
  assert.match(m.state.html, /03 Close and mute/);
});

test('a platform can hide the hover preview', () => {
  for (const capabilities of [{ hoverPreview: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-074'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('mute and close update the preview', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-074');
  m.click('hp-mute');
  assert.match(m.state.html, /Tab muted from the preview\./);
  assert.match(m.state.html, /hp-mute is-muted/);
  m.click('hp-close');
  assert.match(m.state.html, /Tab closed from the preview\./);
  assert.match(m.state.html, /hp-closed/);
  assert.match(m.state.html, /Reopen tab/);
  m.click('hp-reopen');
  assert.match(m.state.html, /Tab reopened\./);
  assert.match(m.state.html, /hp-preview/);
});

test('Continue on s-074 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-074');
  m.click('hp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the hoverPreview event opens s-074 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'hoverPreview' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-074');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'hoverPreview', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-074 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
