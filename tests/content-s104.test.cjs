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

test('s-104 shows the memory meter and heavy tabs', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-104'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-104');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Out of memory');
  assert.match(m.state.html, /Vaayvu ran out of memory/);
  assert.match(m.state.html, /2170 MB/);
  assert.match(m.state.html, /2048 MB/);
  assert.match(m.state.html, /4 heavy tabs/);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /420 MB/);
  assert.match(m.state.html, /01 Close tabs/);
  assert.match(m.state.html, /02 Reload/);
  assert.match(m.state.html, /03 Report/);
  assert.match(m.state.html, /04 Memory/);
});

test('a platform can hide the out-of-memory screen', () => {
  for (const capabilities of [{ outOfMemory: false }, { content: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-104'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Close tabs frees the heaviest tabs', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-close');
  assert.match(m.state.html, /Closed 3 heavy tabs\. 990 MB freed\./);
  assert.match(m.state.html, /1180 MB/);
  assert.doesNotMatch(m.state.html, /Arc paper/);
  assert.match(m.state.html, /Inbox/);
  assert.match(m.state.html, /data-onboard="oom-close" disabled/);
});

test('Close tabs will not close the last heavy tab', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-close');
  m.click('oom-close');
  assert.match(m.state.html, /Inbox/);
});

test('Reload counts the attempt and names the memory still held', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-reload');
  assert.match(m.state.html, /Reload 1 requested\. 4 heavy tabs still hold 1170 MB/);
  assert.match(m.state.html, /2170 MB/);
  m.click('oom-close');
  m.click('oom-reload');
  assert.match(m.state.html, /Reload 2 requested\. 1 heavy tabs still hold 180 MB/);
});

test('Report is honest about staying on this device', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-report');
  assert.match(m.state.html, /Report queued on this device\. No telemetry backend is configured in this build\./);
  assert.match(m.state.html, /oom-report is-reported/);
  assert.match(m.state.html, /aria-pressed="true"/);
});

test('Reset restores the memory state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-close');
  m.click('oom-reset');
  assert.match(m.state.html, /Memory page reset\./);
  assert.match(m.state.html, /2170 MB/);
  assert.match(m.state.html, /Arc paper/);
});

test('Continue on s-104 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-104');
  m.click('oom-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the outOfMemory event opens s-104 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'outOfMemory' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://content/s-104');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'outOfMemory', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-104 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
