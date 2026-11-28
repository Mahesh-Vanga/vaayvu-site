'use strict';
/**
 * Local-first research collections. Sources, notes and tags stay on device.
 * This module is dependency-free and not yet wired to a shipping research UI.
 */
const VaayvuCollections = (() => {
  const KEY = 'vaayvu.collections';
  const VERSION = 1;
  const MAX_COLLECTIONS = 50;
  const MAX_SOURCES = 2000;

  const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const id = () => 'src-' + (globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) || Math.random().toString(36).slice(2, 14));
  const validURL = (value) => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  };

  function normalize(value) {
    const state = value && typeof value === 'object' && Array.isArray(value.collections)
      ? value
      : { collections: [] };
    const collections = state.collections.slice(0, MAX_COLLECTIONS).map((collection, index) => ({
      id: clean(collection?.id, 64) || 'collection-' + (index + 1),
      name: clean(collection?.name, 80) || 'Collection ' + (index + 1),
      createdAt: Number(collection?.createdAt) || 0,
      sources: (Array.isArray(collection?.sources) ? collection.sources : [])
        .filter((source) => source && validURL(source.url))
        .slice(0, MAX_SOURCES)
        .map((source) => ({
          id: clean(source.id, 64) || id(),
          url: source.url,
          title: clean(source.title, 300) || source.url,
          excerpt: clean(source.excerpt, 2000),
          note: clean(source.note, 4000),
          tags: [...new Set((Array.isArray(source.tags) ? source.tags : []).map((tag) => clean(tag, 40)).filter(Boolean))].slice(0, 12),
          addedAt: Number(source.addedAt) || 0,
        })),
    }));
    return { version: VERSION, collections };
  }

  function defaultState() {
    return { version: VERSION, collections: [{ id: 'reading', name: 'Research', createdAt: 0 }] };
  }

  function load(storage) {
    try {
      const raw = (storage || globalThis.localStorage).getItem(KEY);
      return normalize(raw ? JSON.parse(raw) : defaultState());
    } catch { return defaultState(); }
  }

  function save(state, storage) {
    const normalized = normalize(state);
    try {
      (storage || globalThis.localStorage).setItem(KEY, JSON.stringify(normalized));
      return true;
    } catch { return false; }
  }

  function createCollection(state, name) {
    const value = normalize(state);
    if (value.collections.length >= MAX_COLLECTIONS) return { state: value, collection: null };
    const collection = { id: 'collection-' + (value.collections.length + 1) + '-' + Date.now().toString(36), name: clean(name, 80) || 'Untitled collection', createdAt: Date.now() };
    return { state: { ...value, collections: [...value.collections, collection] }, collection };
  }

  function addSource(state, collectionId, input = {}) {
    const value = normalize(state);
    const collection = value.collections.find((item) => item.id === collectionId);
    if (!collection) return { state: value, source: null, reason: 'collection' };
    if (!validURL(input.url)) return { state: value, source: null, reason: 'url' };
    const sources = Array.isArray(collection.sources) ? collection.sources : [];
    if (sources.some((source) => source.url === input.url)) return { state: value, source: null, reason: 'duplicate' };
    if (sources.length >= MAX_SOURCES) return { state: value, source: null, reason: 'limit' };
    const source = {
      id: id(),
      url: input.url,
      title: clean(input.title, 300) || input.url,
      excerpt: clean(input.excerpt, 2000),
      note: clean(input.note, 4000),
      tags: [...new Set((Array.isArray(input.tags) ? input.tags : []).map((tag) => clean(tag, 40)).filter(Boolean))].slice(0, 12),
      addedAt: Date.now(),
    };
    const next = value.collections.map((item) => item.id === collectionId ? { ...item, sources: [...sources, source] } : item);
    return { state: { ...value, collections: next }, source };
  }

  function removeSource(state, collectionId, sourceId) {
    const value = normalize(state);
    let removed = null;
    const next = value.collections.map((collection) => {
      if (collection.id !== collectionId) return collection;
      const sources = (collection.sources || []).filter((source) => {
        if (source.id === sourceId) { removed = source; return false; }
        return true;
      });
      return { ...collection, sources };
    });
    return { state: { ...value, collections: next }, removed };
  }

  function search(state, query) {
    const needle = clean(query, 120).toLowerCase();
    const value = normalize(state);
    if (!needle) return [];
    return value.collections.flatMap((collection) =>
      (collection.sources || []).filter((source) =>
        [source.title, source.url, source.excerpt, source.note, ...(source.tags || [])]
          .join(' ').toLowerCase().includes(needle)
      ).map((source) => ({ ...source, collection: collection.name }))
    );
  }

  function exportJSON(state) {
    return JSON.stringify(normalize(state), null, 2);
  }

  function exportMarkdown(state) {
    const value = normalize(state);
    return value.collections.map((collection) => {
      const sources = collection.sources || [];
      return '# ' + collection.name + '\n\n' + (sources.length
        ? sources.map((source) => `- [${source.title}](${source.url})${source.note ? ' — ' + source.note : ''}`).join('\n')
        : '_No sources._');
    }).join('\n\n');
  }

  return { KEY, VERSION, normalize, defaultState, load, save, createCollection, addSource, removeSource, search, exportJSON, exportMarkdown };
})();
if (typeof module !== 'undefined') module.exports = VaayvuCollections;
