'use strict';
/* VAAYVU first-run boot gate — route vaayvu://onboarding/s-001, phase p00.
 *
 * Loaded as a blocking head script so the decision lands before first paint:
 * a new install shows the splash on frame one (sub-300 ms, local assets only)
 * and a returning user never sees a flash of it.
 *
 * Crash-loop fallback: three uncompleted launches skip onboarding entirely and
 * drop the user straight into the browser, so a broken boot can never trap
 * someone behind the splash. The same fallback fires if the UI never takes
 * over within five seconds. */
(function () {
  const ROUTE = 'vaayvu://onboarding/s-001';
  const ROUTE_003 = 'vaayvu://onboarding/s-003';
  const PHASE = 'p00';
  const KEY = 'vaayvu.onboarding';
  const ATTEMPTS = 'vaayvu.onboardingAttempts';
  const RE_PROMPT_MS = 7 * 24 * 60 * 60 * 1000; // ask again a week after "Not now"
  const MAX_PROMPTS = 3;
  const state = { show: false, reprompt: false, route: ROUTE, phase: PHASE, reason: '', attempts: 0, shownAt: 0 };
  const root = document.documentElement;
  window.__vaayvuBoot = state;

  function hide(reason) {
    state.reason = reason;
    root.dataset.onboarding = 'hide';
  }

  try {
    // Automation must never sit behind the splash.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return hide('automation');

    let store = null;
    try { store = window.localStorage; } catch (error) { store = null; }
    if (!store) return hide('no-storage');
    const get = (key) => { try { return store.getItem(key); } catch (error) { return null; } };
    const set = (key, value) => { try { store.setItem(key, value); } catch (error) {} };
    // Unusable storage cannot record completion, so it would nag on every
    // launch. Probe it once and stay out of the way when it is broken.
    try {
      store.setItem('__vaayvu_probe', '1');
      store.removeItem('__vaayvu_probe');
    } catch (error) {
      return hide('no-storage');
    }

    let record = null;
    try { record = JSON.parse(get(KEY) || 'null'); } catch (error) { record = null; }

    // Deferred default-browser re-prompt: only s-003 comes back, a week after
    // "Not now", at most three times. Everything else about the completed
    // profile (categories, steps) stays untouched.
    const reprompt = !!(
      record &&
      record.defaultBrowser === 'deferred' &&
      (record.defaultBrowserPrompts || 1) < MAX_PROMPTS &&
      Date.now() - (record.deferredAt || 0) >= RE_PROMPT_MS
    );

    if (!reprompt) {
      if (record && (record.status === 'done' || record.status === 'skipped')) return hide('complete');
      // Profiles that already carry browser data are upgrades, not new installs.
      if (get('vaayvu.settings') || get('vaayvu.adBlock')) {
        set(KEY, JSON.stringify({ route: ROUTE, phase: PHASE, status: 'skipped', reason: 'existing-profile' }));
        return hide('existing-profile');
      }
    }

    let attempts = parseInt(get(ATTEMPTS) || '0', 10);
    if (!isFinite(attempts) || attempts < 0) attempts = 0;
    attempts += 1;
    set(ATTEMPTS, String(attempts));
    if (attempts > 3) {
      set(KEY, JSON.stringify({ route: ROUTE, phase: PHASE, status: 'skipped', reason: 'crash-loop', attempts }));
      return hide('crash-loop');
    }

    state.show = true;
    state.reprompt = reprompt;
    state.route = reprompt ? ROUTE_003 : ROUTE;
    state.attempts = attempts;
    state.shownAt = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;
    root.dataset.onboarding = 'show';
    root.dataset.onboardingRoute = state.route;
    root.dataset.onboardingPhase = PHASE;

    // Never trap a user behind the splash if the UI fails to take over.
    setTimeout(() => {
      if (root.dataset.onboarding === 'show' && !window.__vaayvuOnboardingReady) {
        set(KEY, JSON.stringify({ route: ROUTE, phase: PHASE, status: 'skipped', reason: 'boot-timeout', attempts }));
        try { store.removeItem(ATTEMPTS); } catch (error) {}
        hide('boot-timeout');
      }
    }, 5000);
  } catch (error) {
    hide('boot-error');
  }
})();
