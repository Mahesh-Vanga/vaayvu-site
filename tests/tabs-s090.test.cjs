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

const rowCount = (html) => (html.match(/class="mp-row[ "]/g) || []).length;

test('s-090 lists per-tab RAM and controls', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-090'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-090');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Tab memory panel');
  assert.equal(rowCount(m.state.html), 4);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /182 MB/);
  assert.match(m.state.html, /Music/);
  assert.match(m.state.html, /Protected/);
  assert.match(m.state.html, /390 MB across 4 tabs · 1 protected\./);
  assert.match(m.state.html, /01 Per-tab RAM/);
  assert.match(m.state.html, /02 Discard/);
  assert.match(m.state.html, /03 Protect/);
  assert.match(m.state.html, /04 Reload/);
});

test('a platform can hide the memory panel', () => {
  for (const capabilities of [{ memoryPanel: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-090'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Discard frees RAM and leaves the tab in place', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-090');
  m.click('mem-discard', { id: 'arc' });
  assert.match(m.state.html, /Discarded Arc paper\. 182 MB freed\./);
  assert.match(m.state.html, /208 MB/);
  assert.match(m.state.html, /0 MB/);
  assert.match(m.state.html, /Discarded/);
  assert.equal(rowCount(m.state.html), 4);
});

test('a discarded tab reloads its RAM', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-090');
  m.click('mem-discard', { id: 'arc' });
  m.click('mem-reload', { id: 'arc' });
  assert.match(m.state.html, /Reloaded Arc paper\. 182 MB in use again\./);
  assert.match(m.state.html, /390 MB/);
});

test('Protected tabs cannot be discarded until unprotected', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-090');
  m.click('mem-discard', { id: 'music' });
  assert.match(m.state.html, /Music is protected\. Unprotect it before discarding\./);
  assert.match(m.state.html, /390 MB/);
  assert.match(m.state.html, /data-onboard="mem-discard" data-id="music" disabled/);
  m.click('mem-protect', { id: 'music' });
  assert.match(m.state.html, /Music can be discarded again\./);
  m.click('mem-discard', { id: 'music' });
  assert.match(m.state.html, /Discarded Music\. 74 MB freed\./);
  assert.match(m.state.html, /316 MB/);
});

test('Continue on s-090 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-090');
  m.click('mem-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the memoryPanel event opens s-090 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'memoryPanel' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-090');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'memoryPanel', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-090 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
