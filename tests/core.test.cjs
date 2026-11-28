const test = require('node:test');
const assert = require('node:assert/strict');
const {
  destination,
  webURL,
  serverOrigin,
  stripTrackingParams,
  mergeBookmarks,
  publicTabs,
  escapeHTML,
} = require('../chrome/core.js');

test('tracking parameters are stripped without touching meaningful ones', () => {
  assert.equal(
    stripTrackingParams('https://example.org/read?utm_source=feed&utm_medium=email&ref=keep&q=story').url,
    'https://example.org/read?ref=keep&q=story',
  );
  assert.equal(
    stripTrackingParams('https://example.org/?fbclid=abc&gclid=def&page=1').url,
    'https://example.org/?page=1',
  );
  assert.equal(stripTrackingParams('https://example.org/a?b=1').removed, 0);
  const bad = stripTrackingParams('not a url');
  assert.equal(bad.removed, 0);
  assert.equal(bad.url, 'not a url');
  assert.equal(stripTrackingParams('https://example.org/?utm_campaign=a+b').url, 'https://example.org/');
});

test('omnibox admits web URLs, keeps queries out of navigation URLs and rejects privileged schemes', () => {
  assert.equal(destination('example.org/a?x=2'), 'https://example.org/a?x=2');
  assert.equal(destination('127.0.0.1:8000'), 'http://127.0.0.1:8000/');
  assert.equal(destination('red & blue', 'Brave'), '');
  for (const bad of [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://a:b@example.org',
    'data:text/html,hello',
  ])
    assert.equal(destination(bad), '');
  assert.equal(webURL(undefined), '');
  assert.equal(serverOrigin('http://10.0.0.1:8787'), '');
  assert.equal(serverOrigin('https://example.org/oauth'), '');
  assert.equal(serverOrigin('http://localhost:8787'), 'http://localhost:8787');
});
test('private and internal tabs never enter synced tab snapshots', () => {
  const tab = { title: 'Public', url: 'https://example.org/' };
  assert.deepEqual(publicTabs([tab, { ...tab, private: true }, { url: '', title: 'Start page' }]), [tab]);
});
test('a newer local edit survives a slow response and deletion wins a tie', () => {
  const a = { id: 'one', updatedAt: 1, title: 'Page', url: 'https://example.org/' };
  const b = { ...a, updatedAt: 2, title: 'Update' };
  const tomb = { id: 'one', updatedAt: 2, deleted: true };
  assert.deepEqual(mergeBookmarks([b], [a]), [b]);
  assert.deepEqual(mergeBookmarks([tomb], [b]), [tomb]);
  assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

test('simultaneous edits converge regardless of device order, using the sync database text order', () => {
  const a = { id: 'one', url: 'https://example.org/', title: '\uE000', updatedAt: 42 };
  const b = { ...a, title: '🌍' };
  assert.deepEqual(mergeBookmarks([a], [b]), [b]);
  assert.deepEqual(mergeBookmarks([b], [a]), [b]);
});
