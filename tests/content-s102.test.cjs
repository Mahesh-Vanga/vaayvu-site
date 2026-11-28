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

test('s-102 shows the certificate warning and no page', () => {
  const m = mount();
  assert.equal(m.context.window.__vaayvuOnboardingOpen('s-102'), true);
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://content/s-102');
  assert.equal(m.dataset.onboardingPhase, 'p09');
  assert.equal(m.dataset.atlasCategory, 'content');
  assert.equal(m.state.attrs['aria-label'], 'Certificate error');
  assert.match(m.state.html, /This connection is not private/);
  assert.match(m.state.html, /The certificate expired 2 days ago\./);
  assert.match(m.state.html, /Not secure/);
  assert.match(m.state.html, /01 Why/);
  assert.match(m.state.html, /02 Advanced/);
  assert.match(m.state.html, /03 Proceed \(guarded\)/);
  assert.match(m.state.html, /04 Report/);
  assert.match(m.state.html, /Certificate blocked this page\./);
});

test('a platform can hide the certificate error', () => {
  for (const capabilities of [{ certificateError: false }, { content: false }]) {
    const m = mount({ capabilities });
    assert.equal(m.context.window.__vaayvuOnboardingOpen('s-102'), false);
    assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
  }
});

test('host-supplied certificate fields are used', () => {
  const m = mount({
    capabilities: {
      certificateError: {
        host: 'shop.example.com',
        reason: 'The name on the certificate does not match.',
        issuedTo: 'other.example.com',
        issuer: 'Example CA',
        validity: 'valid until 2027',
      },
    },
  });
  m.context.window.__vaayvuOnboardingOpen('s-102');
  assert.match(m.state.html, /shop\.example\.com/);
  assert.match(m.state.html, /The name on the certificate does not match\./);
  m.click('ce-advanced');
  assert.match(m.state.html, /other\.example\.com/);
  assert.match(m.state.html, /Example CA/);
  assert.match(m.state.html, /valid until 2027/);
});

test('Why explains the risk concretely', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-102');
  m.click('ce-why');
  assert.match(m.state.html, /Why this is unsafe/);
  assert.match(m.state.html, /The certificate names vaayvu\.com/);
  assert.match(m.state.html, /not trusted for this connection/);
  assert.match(m.state.html, /Anyone on this network could read or change the page\./);
});

test('Proceed is guarded by Advanced and a second press', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-102');
  m.click('ce-proceed');
  assert.match(m.state.html, /Review the certificate details, then press Proceed again\./);
  assert.match(m.state.html, /Certificate details/);
  assert.match(m.state.html, /Proceed anyway \(unsafe\)/);
  m.click('ce-proceed');
  assert.match(m.state.html, /Proceeded without certificate checks\. This window is not protected\./);
  assert.match(m.state.html, /You proceeded without certificate checks\./);
  assert.match(m.state.html, /data-onboard="ce-proceed" disabled/);
});

test('Report is honest about staying on this device', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-102');
  m.click('ce-report');
  assert.match(m.state.html, /Report queued on this device\. No telemetry backend is configured in this build\./);
  assert.match(m.state.html, /ce-report is-reported/);
  assert.match(m.state.html, /aria-pressed="true"/);
});

test('Reset clears every certificate state', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-102');
  m.click('ce-why');
  m.click('ce-report');
  m.click('ce-reset');
  assert.match(m.state.html, /Certificate error reset\./);
  assert.doesNotMatch(m.state.html, /Why this is unsafe/);
  assert.doesNotMatch(m.state.html, /is-reported/);
});

test('Continue on s-102 returns to the setup chain', () => {
  const m = mount();
  m.context.window.__vaayvuOnboardingOpen('s-102');
  m.click('ce-continue');
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('the certificateError event opens s-102 and opt-out is respected', () => {
  const event = mount();
  event.context.window.vaayvuEvent({ type: 'certificateError', certificateError: { host: 'bad.example' } });
  assert.equal(event.dataset.onboardingRoute, 'vaayvu://content/s-102');
  assert.match(event.state.html, /bad\.example/);

  const off = mount();
  off.context.window.vaayvuEvent({ type: 'certificateError', show: false });
  assert.equal(off.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});

test('s-102 stays out of the ready chain', () => {
  const m = mount();
  m.context.window.vaayvuEvent({ type: 'ready', platform: 'mac' });
  assert.equal(m.dataset.onboardingRoute, 'vaayvu://onboarding/s-001');
});
