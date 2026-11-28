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

const rowCount = (html) => (html.match(/class="rc-row"/g) || []).length;

test('s-088 lists tabs, windows and groups', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-088'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-088');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Recently closed');
  assert.equal(rowCount(m.state.html), 4);
  assert.match(m.state.html, /aria-label="Tabs"/);
  assert.match(m.state.html, /aria-label="Windows"/);
  assert.match(m.state.html, /aria-label="Groups"/);
  assert.match(m.state.html, /Design notes/);
  assert.match(m.state.html, /Work window/);
  assert.match(m.state.html, /Research group/);
  assert.match(m.state.html, /4 recently closed items\./);
  assert.match(m.state.html, /01 Tabs/);
  assert.match(m.state.html, /02 Windows/);
  assert.match(m.state.html, /03 Groups/);
  assert.match(m.state.html, /04 Restore/);
});

test('a platform can hide recently closed', () => {
  for (const capabilities of [{ recentlyClosed: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-088'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('a single tab can be restored', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-088');
  m.click('rc-restore', { rcSection: 'tabs', rcId: 'design' });
  assert.match(m.state.html, /Restored Design notes\./);
  assert.equal(rowCount(m.state.html), 3);
  assert.doesNotMatch(m.state.html, /data-rc-id="design"/);
});

test('windows and groups report their own verb', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-088');
  m.click('rc-restore', { rcSection: 'windows', rcId: 'work' });
  assert.match(m.state.html, /Reopened Work window\./);
  assert.equal(rowCount(m.state.html), 3);
  m.click('rc-restore', { rcSection: 'groups', rcId: 'research' });
  assert.match(m.state.html, /Reopened Research group\./);
  assert.equal(rowCount(m.state.html), 2);
});

test('Restore all clears the panel and disables itself', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-088');
  m.click('rc-restore-all');
  assert.match(m.state.html, /Restored 4 items\./);
  assert.match(m.state.html, /Nothing recently closed/);
  assert.equal(rowCount(m.state.html), 0);
  assert.match(m.state.html, /data-onboard="rc-restore-all" disabled/);
});

test('Continue on s-088 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-088');
  m.click('rc-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the recentlyClosed event opens s-088 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'recentlyClosed' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-088');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'recentlyClosed', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-088 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
