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
  const input = (value) => {
    for (const fn of listeners.input || []) {
      fn({ target: { hasAttribute: (name) => name === 'data-archive-search', value } });
    }
  };
  return { dataset, state, overlay, step, click, input, context };
}

test('s-077 renders the archive with its stacks and tabs', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-077'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-077');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Stack/archive');
  assert.match(m.state.html, /Research stack/);
  assert.match(m.state.html, /Launch week/);
  assert.match(m.state.html, /data-onboard="ar-restore"/);
  assert.match(m.state.html, /data-archive-search/);
  assert.match(m.state.html, /01 Stacks/);
  assert.match(m.state.html, /02 Restore/);
  assert.match(m.state.html, /03 Search/);
});

test('a platform can hide the archive', () => {
  for (const capabilities of [{ archive: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-077'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('restoring a whole stack removes it from the archive', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-077');
  m.click('ar-restore', { arGroup: 'research' });
  assert.match(m.state.html, /Restored 3 tabs from Research stack\./);
  assert.doesNotMatch(m.state.html, /data-ar-group="research"/);
  assert.match(m.state.html, /Launch week/);
});

test('restoring a single tab keeps the rest of its stack', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-077');
  m.click('ar-tab', { arGroup: 'research', arTitle: 'Arc paper' });
  assert.match(m.state.html, /Restored Arc paper\./);
  assert.doesNotMatch(m.state.html, /data-ar-title="Arc paper"/);
  assert.match(m.state.html, /Browser shells/);
});

test('search filters stacks by title, host or stack name', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-077');
  m.input('figma');
  assert.match(m.state.html, /Design review/);
  assert.doesNotMatch(m.state.html, /Research stack/);
  m.input('nothing-here');
  assert.match(m.state.html, /No archived tabs match that search\./);
});

test('Continue on s-077 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-077');
  m.click('ar-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the stackArchive event opens s-077 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'stackArchive' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-077');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'stackArchive', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
