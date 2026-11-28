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
  const choose = (id) =>
    overlay.onclick({
      target: { closest: (selector) => (selector === '[data-onboard]' ? { dataset: { onboard: 'wp-choose', wpId: id } } : null) },
    });
  return { dataset, state, overlay, step, click, choose, context };
}

test('s-062 renders the wallpaper picker', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-062'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-062');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'Wallpaper picker');
  assert.match(m.state.html, /wp-preview/);
  assert.match(m.state.html, /Observatory/);
  assert.match(m.state.html, /Sunrise/);
  assert.match(m.state.html, /Choose an image/);
  assert.match(m.state.html, /data-wp-blur/);
  assert.match(m.state.html, /data-onboard="wp-sync"/);
});

test('wallpaper picker is capability-gated', () => {
  for (const capabilities of [{ wallpaperPicker: false }, { startPage: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-062'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('choosing a wallpaper and image works', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-062');
  m.choose('dusk');
  assert.match(m.state.html, /Dusk selected\./);
  m.click('wp-image');
  assert.match(m.state.html, /An image picker would open\. The image stays on this device\./);
  assert.match(m.state.html, /Image selected/);
});

test('blur and sync update their state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-062');
  m.overlay.oninput({ target: { hasAttribute: () => true, value: '12' } });
  assert.match(m.state.html, /Blur set to 12px\./);
  assert.match(m.state.html, /filter: blur\(12px\)/);
  m.click('wp-sync');
  assert.match(m.state.html, /Wallpaper sync off\. The wallpaper stays on this device\./);
  assert.match(m.state.html, /aria-checked="false"/);
});

test('Continue returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-062');
  m.click('wp-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the wallpaperPicker event opens s-062', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'wallpaperPicker' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-062');
});
