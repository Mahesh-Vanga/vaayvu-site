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
  const clickSuggestion = (id) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: 'ai-suggest', aiId: id } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickSuggestion, context };
}

test('s-059 renders the AI prompt bar and suggestions', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-059'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://start-page/s-059');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'start-page');
  assert.equal(m.state.attrs['aria-label'], 'AI prompt bar');
  assert.match(m.state.html, /ai-bar/);
  assert.match(m.state.html, /Ask about anything…/);
  assert.match(m.state.html, /Summarize this page/);
  assert.match(m.state.html, /Explain this code/);
  assert.match(m.state.html, /Compare these tabs/);
  assert.match(m.state.html, /Draft a reply/);
  assert.match(m.state.html, /01 Prompt/);
  assert.match(m.state.html, /02 Suggestions/);
  assert.match(m.state.html, /03 Source/);
});

test('a platform can hide the AI prompt bar', () => {
  for (const capabilities of [{ ai: false }, { pageQA: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-059'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('suggestions fill the prompt', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-059');
  m.clickSuggestion('summary');
  assert.match(m.state.html, /What are the main points on this page\?/);
  assert.match(m.state.html, /Suggestion filled: Summarize this page\./);
});

test('sending an empty or filled prompt reports the state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-059');
  m.click('ai-send');
  assert.match(m.state.html, /Choose a suggestion or type a question first\./);
  m.clickSuggestion('code');
  m.click('ai-send');
  assert.match(m.state.html, /Question ready for your sync server/);
});

test('Continue on s-059 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-059');
  m.click('ai-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the aiPrompt event opens s-059 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'aiPrompt' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://start-page/s-059');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'aiPrompt', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-059 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
