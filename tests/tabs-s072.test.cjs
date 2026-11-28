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

test('s-072 renders the crashed tab with reload and report', () => {
  const m = mount({ capabilities: { crashedTab: { title: 'Docs', reason: 'The renderer stopped unexpectedly.' } } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-072'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-072');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Crashed tab');
  assert.match(m.state.html, /ct-face/);
  assert.match(m.state.html, /This page crashed/);
  assert.match(m.state.html, /data-onboard="ct-reload">Reload/);
  assert.match(m.state.html, /data-onboard="ct-report"/);
  assert.match(m.state.html, /01 Sad tab/);
  assert.match(m.state.html, /02 Reload/);
  assert.match(m.state.html, /03 Report/);
});

test('the crashed tab can be hidden by capability', () => {
  const m = mount({ capabilities: { crashedTab: false } });
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-072'), false);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('Reload and Report report their actions honestly', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-072');
  m.click('ct-reload');
  assert.match(m.state.html, /Reload requested for Docs\. It will return when the process restarts\./);
  m.click('ct-report');
  assert.match(m.state.html, /Crash report queued on this device\. No telemetry backend is configured in this build\./);
  assert.match(m.state.html, /ct-report is-reported/);
  assert.match(m.state.html, /aria-pressed="true"/);
});

test('Continue on s-072 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-072');
  m.click('ct-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the crashedTab event opens s-072 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'crashedTab', crashedTab: { title: 'Docs' } });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-072');

  const off = mount({ capabilities: { crashedTab: false } });
  off.context.window.vaayvuEvent({ type: 'crashedTab', crashedTab: { title: 'Docs' } });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-072 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
