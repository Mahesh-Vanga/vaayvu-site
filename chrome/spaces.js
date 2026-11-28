'use strict';
/**
 * Vaayvu Spaces — Arc-style workspaces.
 *
 * A space owns a set of tabs, its own pinned row, and an accent theme. The store
 * is intentionally dependency-free so it can be unit tested in Node and reused
 * by the shared chrome UI on every platform.
 */
const VaayvuSpaces = (() => {
  const KEY = 'vaayvu.spaces';
  const VERSION = 1;
  const MAX_SPACES = 24;
  const MAX_NAME = 40;

  const THEMES = {
    aurora: { name: 'Aurora', glow: '#3b2f6b', accent: '#a08bff', tint: '#efeaff' },
    ember: { name: 'Ember', glow: '#4a2418', accent: '#ff9a62', tint: '#fff0e8' },
    forest: { name: 'Forest', glow: '#17352a', accent: '#5fd3a0', tint: '#e6fbf1' },
    ocean: { name: 'Ocean', glow: '#123149', accent: '#63c1ff', tint: '#e5f5ff' },
    rose: { name: 'Rose', glow: '#40202f', accent: '#ff8fc0', tint: '#ffeaf3' },
    graphite: { name: 'Graphite', glow: '#24242a', accent: '#c9c9d4', tint: '#f1f1f5' },
  };
  const THEME_IDS = Object.keys(THEMES);
  const EMOJI = ['🌊', '🔥', '🌿', '🌙', '🍊', '🪐', '🧪', '🎧', '📚', '💼', '🎨', '🏔️'];

  const cleanText = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const validID = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
  const newID = () =>
    'space-' +
    (globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ||
      Math.random().toString(36).slice(2, 14));

  function defaultState() {
    return {
      version: VERSION,
      active: 'personal',
      list: [{ id: 'personal', name: 'Personal', emoji: '🌊', theme: 'aurora', createdAt: 0 }],
    };
  }

  function normalizeSpace(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const id = validID(raw.id) ? raw.id : 'space-' + index;
    return {
      id,
      name: cleanText(raw.name, MAX_NAME) || 'Space ' + (index + 1),
      emoji: cleanText(raw.emoji, 8) || EMOJI[index % EMOJI.length],
      theme: THEME_IDS.includes(raw.theme) ? raw.theme : 'aurora',
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    };
  }

  /** Coerce any stored value into a valid state. Never throws. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.list)) return defaultState();
    const seen = new Set();
    const list = [];
    for (const item of raw.list.slice(0, MAX_SPACES)) {
      const space = normalizeSpace(item, list.length);
      if (!space || seen.has(space.id)) continue;
      seen.add(space.id);
      list.push(space);
    }
    if (!list.length) return defaultState();
    const active = seen.has(raw.active) ? raw.active : list[0].id;
    return { version: VERSION, active, list };
  }

  function load(storage) {
    const store = storage || globalThis.localStorage;
    try {
      const raw = store.getItem(KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultState();
    }
  }

  function save(state, storage) {
    const store = storage || globalThis.localStorage;
    const value = normalize(state);
    try {
      store.setItem(KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function activeSpace(state) {
    const value = normalize(state);
    return value.list.find((space) => space.id === value.active) || value.list[0];
  }

  function spaceByID(state, id) {
    return normalize(state).list.find((space) => space.id === id) || null;
  }

  /** Tabs without a known space belong to a caller-provided fallback. */
  function tabSpace(tab, state) {
    const value = normalize(state);
    return tab && value.list.some((space) => space.id === tab.space) ? tab.space : value.active;
  }

  function create(state, input = {}) {
    const value = normalize(state);
    if (value.list.length >= MAX_SPACES) return { state: value, space: null, reason: 'limit' };
    const space = {
      id: newID(),
      name: cleanText(input.name, MAX_NAME) || 'Space ' + (value.list.length + 1),
      emoji: cleanText(input.emoji, 8) || EMOJI[value.list.length % EMOJI.length],
      theme: THEME_IDS.includes(input.theme)
        ? input.theme
        : THEME_IDS[value.list.length % THEME_IDS.length],
      createdAt: Date.now(),
    };
    const next = { ...value, list: [...value.list, space] };
    if (input.activate !== false) next.active = space.id;
    return { state: next, space };
  }

  function update(state, id, patch = {}) {
    const value = normalize(state);
    const list = value.list.map((space) =>
      space.id === id
        ? {
            ...space,
            name: patch.name === undefined ? space.name : cleanText(patch.name, MAX_NAME) || space.name,
            emoji: patch.emoji === undefined ? space.emoji : cleanText(patch.emoji, 8) || space.emoji,
            theme: THEME_IDS.includes(patch.theme) ? patch.theme : space.theme,
          }
        : space,
    );
    return { ...value, list };
  }

  function remove(state, id) {
    const value = normalize(state);
    if (value.list.length <= 1) return { state: value, removed: null, reason: 'last' };
    const index = value.list.findIndex((space) => space.id === id);
    if (index < 0) return { state: value, removed: null, reason: 'missing' };
    const removed = value.list[index];
    const list = value.list.filter((space) => space.id !== id);
    const active = value.active === id ? list[Math.min(index, list.length - 1)].id : value.active;
    return { state: { ...value, active, list }, removed };
  }

  function activate(state, id) {
    const value = normalize(state);
    return value.list.some((space) => space.id === id) ? { ...value, active: id } : value;
  }

  function move(state, id, delta) {
    const value = normalize(state);
    const index = value.list.findIndex((space) => space.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= value.list.length) return value;
    const list = [...value.list];
    [list[index], list[target]] = [list[target], list[index]];
    return { ...value, list };
  }

  /** Split a flat tab list into the active space and everything else. */
  function partition(tabs, state) {
    const value = normalize(state);
    const active = [];
    const other = [];
    for (const tab of Array.isArray(tabs) ? tabs : []) {
      (tabSpace(tab, value) === value.active ? active : other).push(tab);
    }
    return { active, other };
  }

  function count(tabs, state) {
    const totals = new Map(normalize(state).list.map((space) => [space.id, 0]));
    for (const tab of Array.isArray(tabs) ? tabs : []) {
      const id = tabSpace(tab, state);
      totals.set(id, (totals.get(id) || 0) + 1);
    }
    return totals;
  }

  return {
    KEY,
    VERSION,
    MAX_SPACES,
    THEMES,
    THEME_IDS,
    EMOJI,
    defaultState,
    normalize,
    load,
    save,
    activeSpace,
    spaceByID,
    tabSpace,
    create,
    update,
    remove,
    activate,
    move,
    partition,
    count,
    newID,
  };
})();
if (typeof module !== 'undefined') module.exports = VaayvuSpaces;
