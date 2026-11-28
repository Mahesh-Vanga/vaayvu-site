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

const rowCount = (html) => (html.match(/class="bf-row[ "]/g) || []).length;

test('s-098 opens on back history with titled entries', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-098'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-098');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Back/forward menu');
  assert.equal(rowCount(m.state.html), 2);
  assert.match(m.state.html, /Back history/);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /arc\.example\.com/);
  assert.match(m.state.html, /Back history, 2 of 5 titles\./);
  assert.match(m.state.html, /01 Long-press/);
  assert.match(m.state.html, /02 Titles/);
  assert.match(m.state.html, /03 Jump/);
  assert.match(m.state.html, /04 Full history/);
});

test('a platform can hide the history menu', () => {
  for (const capabilities of [{ backForwardMenu: false }, { history: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-098'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Forward swaps the list and the label', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-098');
  m.click('bf-side', { side: 'forward' });
  assert.match(m.state.html, /Forward history/);
  assert.match(m.state.html, /Showing forward history\./);
  assert.match(m.state.html, /Docs/);
  assert.match(m.state.html, /Notes/);
  assert.doesNotMatch(m.state.html, /Arc paper/);
});

test('Long-press opens the full history', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-098');
  m.click('bf-longpress');
  assert.equal(rowCount(m.state.html), 5);
  assert.match(m.state.html, /Long-press opened the full history\./);
  assert.match(m.state.html, /Weather/);
  assert.match(m.state.html, /Show recent pages only/);
});

test('Show full history toggles back to recent pages', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-098');
  m.click('bf-full');
  assert.equal(rowCount(m.state.html), 5);
  assert.match(m.state.html, /Full history shown\./);
  m.click('bf-full');
  assert.equal(rowCount(m.state.html), 2);
  assert.match(m.state.html, /Showing recent pages only\./);
});

test('choosing a title jumps to that page', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-098');
  m.click('bf-jump', { id: 'shells' });
  assert.match(m.state.html, /Went back to Browser shells\./);
  assert.match(m.state.html, /bf-row is-selected/);
});

test('Continue on s-098 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-098');
  m.click('bf-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the backForwardMenu event opens s-098 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'backForwardMenu' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://content/s-098');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'backForwardMenu', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-098 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
