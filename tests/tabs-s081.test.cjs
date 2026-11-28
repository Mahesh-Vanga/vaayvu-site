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

test('s-081 renders grouped mobile cards', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-081'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://tabs/s-081');
  assert.equal(m.dataset.onboardingPhase, 'p05');
  assert.equal(m.dataset.atlasCategory, 'tabs');
  assert.equal(m.state.attrs['aria-label'], 'Mobile tab grid');
  assert.match(m.state.html, /Research/);
  assert.match(m.state.html, /Personal/);
  assert.match(m.state.html, /Arc paper/);
  assert.match(m.state.html, /Weather/);
  assert.equal((m.state.html.match(/class="mg-card[ "]/g) || []).length, 5);
  assert.match(m.state.html, /data-onboard="mg-close-all"/);
  assert.match(m.state.html, /data-onboard="mg-mode-private"/);
  assert.match(m.state.html, /01 Cards/);
  assert.match(m.state.html, /02 Groups/);
  assert.match(m.state.html, /03 Close all/);
  assert.match(m.state.html, /04 Private/);
  assert.match(m.state.html, /5 tabs in 2 groups\./);
});

test('a platform can hide the mobile tab grid', () => {
  for (const capabilities of [{ mobileTabGrid: false }, { tabs: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-081'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('Private shows a separate card set', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-081');
  m.click('mg-mode-private');
  assert.match(m.state.html, /mg-grid is-private/);
  assert.match(m.state.html, /Private search/);
  assert.match(m.state.html, /2 private tabs\./);
  assert.match(m.state.html, /2 private tabs stay out of history\./);
  m.click('mg-mode');
  assert.match(m.state.html, /Arc paper/);
  assert.doesNotMatch(m.state.html, /mg-grid is-private/);
});

test('Close all clears the open view and Restore brings it back', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-081');
  m.click('mg-close-all');
  assert.match(m.state.html, /5 tabs closed\. No history was written for them\./);
  assert.match(m.state.html, /No open tabs/);
  assert.equal((m.state.html.match(/class="mg-card[ "]/g) || []).length, 0);
  m.click('mg-restore');
  assert.match(m.state.html, /Tabs restored\./);
  assert.equal((m.state.html.match(/class="mg-card[ "]/g) || []).length, 5);
});

test('Close all respects the private view', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-081');
  m.click('mg-mode-private');
  m.click('mg-close-all');
  assert.match(m.state.html, /2 private tabs closed\. They are not kept in history\./);
  assert.match(m.state.html, /No private tabs/);
  m.click('mg-restore');
  assert.match(m.state.html, /Private tabs restored\./);
  assert.match(m.state.html, /Private search/);
});

test('a card can be selected and reports the switch', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-081');
  m.click('mg-card', { mgGroup: 'personal', mgTitle: 'Inbox' });
  assert.match(m.state.html, /Switched to Inbox\./);
  assert.match(m.state.html, /aria-pressed="true">Inbox|data-mg-title="Inbox"[^]*aria-pressed="true"/);
});

test('Continue on s-081 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-081');
  m.click('mg-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the mobileTabGrid event opens s-081 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'mobileTabGrid' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://tabs/s-081');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'mobileTabGrid', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-081 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
