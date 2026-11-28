'use strict';
/* Durable renderer storage for Electron (P04).
 *
 * The UI keeps using the synchronous Web Storage API. When the preload bridge
 * exposes VaayvuStore, this head script imports any pre-SQLite localStorage
 * values once and swaps window.localStorage for a shim backed by the SQLite
 * key-value table. Outside Electron (tests, web preview) the bridge is absent
 * and nothing changes. */
(function () {
  const native = typeof window !== 'undefined' ? window.VaayvuStore : null;
  if (!native || typeof native.get !== 'function' || typeof native.set !== 'function') return;
  const legacy = window.localStorage;
  if (!legacy) return;

  // One-time carry-over. importLegacy inserts only missing keys, so newer
  // SQLite values always win.
  try {
    const entries = [];
    for (let index = 0; index < legacy.length; index += 1) {
      const key = legacy.key(index);
      if (typeof key !== 'string' || !key) continue;
      const value = legacy.getItem(key);
      if (typeof value === 'string') entries.push([key, value]);
    }
    if (entries.length) native.importLegacy(entries);
  } catch (error) {}

  const keys = () => {
    try {
      const list = native.keys();
      return Array.isArray(list) ? list.filter((key) => typeof key === 'string') : [];
    } catch (error) {
      return [];
    }
  };
  const shim = {
    get length() {
      return keys().length;
    },
    key(index) {
      const list = keys();
      const at = Number(index);
      return Number.isInteger(at) && at >= 0 && at < list.length ? list[at] : null;
    },
    getItem(key) {
      try {
        const value = native.get(String(key));
        return value == null ? null : String(value);
      } catch (error) {
        return null;
      }
    },
    setItem(key, value) {
      let ok = false;
      try {
        ok = native.set(String(key), String(value)) === true;
      } catch (error) {
        ok = false;
      }
      if (!ok) throw new DOMException('Device storage is full or unavailable.', 'QuotaExceededError');
    },
    removeItem(key) {
      try {
        native.remove(String(key));
      } catch (error) {}
    },
    clear() {
      for (const key of keys()) shim.removeItem(key);
    },
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
  } catch (error) {}
})();
