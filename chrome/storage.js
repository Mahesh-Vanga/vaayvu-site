'use strict';
/** Quota-safe local storage helpers shared by the chrome UI. */
const VaayvuStorage = (() => {
  const store = (override) => override || globalThis.localStorage;
  function read(key, fallback, override) {
    try {
      const value = store(override).getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function write(key, value, override) {
    try {
      store(override).setItem(key, JSON.stringify(value));
      return { ok: true, reason: '' };
    } catch (error) {
      return { ok: false, reason: error && error.name === 'QuotaExceededError' ? 'quota' : 'unavailable' };
    }
  }
  function remove(key, override) {
    try {
      store(override).removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
  function migrate(prefix, legacyPrefix, override) {
    const target = store(override);
    let moved = 0;
    try {
      for (const key of Object.keys(target)) {
        if (!key.startsWith(legacyPrefix) || key === legacyPrefix) continue;
        const suffix = key.slice(legacyPrefix.length);
        if (target.getItem(prefix + suffix) == null) {
          try {
            target.setItem(prefix + suffix, target.getItem(key));
            moved += 1;
          } catch {}
        }
        try { target.removeItem(key); } catch {}
      }
    } catch {}
    return moved;
  }
  return { read, write, remove, migrate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VaayvuStorage;
