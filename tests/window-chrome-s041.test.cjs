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
    setItem: (key, value) => map.set(key, String(value)),
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
  const clickData = (name, key, value) =>
    overlay.onclick({
      target: {
        closest: (selector) =>
          selector === '[data-onboard]' ? { dataset: { onboard: name, [key]: value } } : null,
      },
    });
  return { dataset, state, overlay, step, click, clickData, context };
}

test('s-041 opens the profile menu at route s-041', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-041'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-041');
  assert.equal(m.dataset.onboardingPhase, 'p03');
  assert.equal(m.dataset.atlasCategory, 'window-chrome');
  assert.equal(m.state.attrs['aria-label'], 'Profile menu');
  assert.match(m.state.html, /pm-menu/);
  assert.match(m.state.html, /Personal/);
  assert.match(m.state.html, /Work/);
  assert.match(m.state.html, /Study/);
  assert.match(m.state.html, /data-onboard="pm-guest"/);
  assert.match(m.state.html, /data-onboard="pm-manage"/);
  assert.match(m.state.html, /01 Profiles/);
  assert.match(m.state.html, /02 Spaces/);
  assert.match(m.state.html, /03 Guest/);
  assert.match(m.state.html, /04 Manage/);
});

test('the profile menu is capability-gated and guest can be hidden', () => {
  for (const capabilities of [{ profileMenu: false }, { profiles: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-041'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
  const noGuest = mount({ capabilities: { canGuestWindow: false } });
  noGuest.context.window.__vaayvuOnboardingOpen('s-041');
  assert.doesNotMatch(noGuest.state.html, /pm-guest/);
});

test('switching profile and space updates the menu', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-041');
  m.clickData('pm-profile', 'pmId', 'work');
  assert.match(m.state.html, /Switched to Work in this preview\./);
  assert.match(m.state.html, /Vaayvu Sync/);
  m.clickData('pm-space', 'pmId', 'study');
  assert.match(m.state.html, /Study space selected in this preview\./);
});

test('guest and manage actions report their real surfaces', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-041');
  m.click('pm-guest');
  assert.match(m.state.html, /A guest window would use temporary storage and close clean\./);
  m.click('pm-manage');
  assert.match(m.state.html, /Create profile/);
  assert.match(m.state.html, /Manage profiles open\./);
  m.click('pm-create');
  assert.match(m.state.html, /A new profile form would open here\./);
  m.click('pm-manage-close');
  assert.doesNotMatch(m.state.html, /Create profile/);
});

test('Continue on s-041 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-041');
  m.click('pm-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the profileMenu event opens s-041 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'profileMenu' });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://window-chrome/s-041');

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'profileMenu', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-041 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-042 still opens the separate space switcher', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-042'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://window-chrome/s-042');
  assert.match(m.state.html, /sp-switcher/);
  assert.equal(m.state.attrs['aria-label'], 'Space switcher');
});
