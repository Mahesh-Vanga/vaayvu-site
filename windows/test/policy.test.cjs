const { test } = require('node:test');
const assert = require('node:assert/strict');
const { website, syncDestination, blockedHost, domains, bounds, isInspectorFrontend } = require('../policy.cjs');
test('DevTools requests with missing or retired renderer IDs cannot crash the browser', () => {
  for (const id of [undefined, null, -1, 0, '2', Infinity, 0x80000000]) {
    assert.equal(isInspectorFrontend(id, () => assert.fail('unexpected native lookup')), false);
  }
  assert.equal(isInspectorFrontend(8, () => undefined), false);
  assert.equal(isInspectorFrontend(8, () => ({ isDestroyed: () => true })), false);
  for (const type of ['remote', 'window', 'webview']) {
    assert.equal(isInspectorFrontend(8, () => ({ isDestroyed: () => false, getType: () => type })), type === 'remote');
  }
});
test('Website navigation accepts only explicit, bounded plain HTTP(S) URLs', () => {
  assert.equal(website('https://example.com/a').host, 'example.com');
  for (const bad of [
    'file:///a',
    'data:text/html,a',
    'javascript:1',
    'vaayvu://browser/index.html',
    'https://x@y.test',
    'https://a.test/ ' + 'z',
    'https://a.test/' + 'x'.repeat(8200),
    'https://appassets.androidplatform.net/a',
  ])
    assert.equal(website(bad), null);
});
test('Sync destinations require TLS or loopback HTTP', () => {
  assert(syncDestination('https://sync.example/a'));
  assert(syncDestination('http://127.0.0.1:345/a'));
  assert(!syncDestination('http://example.com/a'));
});
test('Tracker rules match DNS label boundaries', () => {
  const rules = domains(['doubleclick.net', 'bad_domain.test', '*.example.com', 'example'], 128);
  assert.deepEqual([...rules], ['doubleclick.net']);
  assert(blockedHost('ads.doubleclick.net', rules));
  assert(!blockedHost('notdoubleclick.net', rules));
});
test('Native content bounds fit the window', () => {
  assert.deepEqual(bounds({ x: 80, y: 50, width: 100, height: 100 }, 100, 100), {
    x: 80,
    y: 50,
    width: 20,
    height: 50,
  });
  assert.equal(bounds({ x: 0, y: 0, width: NaN, height: 1 }, 100, 100), null);
});

const https = require('node:https');
const tls = require('node:tls');
const { X509Certificate, createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { IndiaSearch, deployment, checkPeer } = require('../india-search.cjs');

const certificate = new X509Certificate(tls.rootCertificates[0]);
const endpoint = {
  country: 'IN', region: 'fixture', origin: 'https://search.example',
  expiresAt: '2099-01-01T00:00:00Z',
  spkiPins: ['sha256/' + createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')],
};

test('Regional search accepts an unexpired reviewed origin and checks the TLS hostname and leaf pin', () => {
  assert.deepEqual(deployment(endpoint), endpoint);
  for (const change of [
    { country: 'SG' }, { origin: 'https://search.example/path' }, { origin: 'https://search.example:443' },
    { expiresAt: '2000-01-01T00:00:00Z' }, { spkiPins: [] }, { spkiPins: [...endpoint.spkiPins, ...endpoint.spkiPins] },
  ]) assert.equal(deployment({ ...endpoint, ...change }), null);
  const cert = { raw: certificate.raw, subjectaltname: 'DNS:search.example' };
  assert.equal(checkPeer(endpoint, 'search.example', cert), undefined);
  assert(checkPeer(endpoint, 'foreign.example', cert) instanceof Error);
  assert(checkPeer(endpoint, 'search.example', { ...cert, subjectaltname: 'DNS:foreign.example' }) instanceof Error);
  assert(checkPeer({ ...endpoint, spkiPins: [] }, 'search.example', cert) instanceof Error);
});

test('Regional search posts only a submitted query, rejects redirects and oversized results, and stays local without an endpoint', async (t) => {
  const contacted = [], reports = [];
  let status = 200;
  let body = JSON.stringify({ results: [{ title: 'Local', url: 'https://example.com/', snippet: 'Regional fixture' }] });
  t.mock.method(https, 'request', (url, options, receive) => {
    const request = new EventEmitter();
    request.end = (data) => {
      contacted.push({ url, options, data: data.toString() });
      const response = Readable.from([Buffer.from(body)]);
      response.statusCode = status;
      response.headers = { 'content-type': 'application/json', location: 'https://foreign.example' };
      receive(response);
    };
    return request;
  });
  const local = new IndiaSearch(null, (value) => reports.push(value));
  await local.start('a', 'r0', 'local query');
  assert.equal(reports.at(-1).error, 'unavailable');
  assert.equal(contacted.length, 0);
  const search = new IndiaSearch(endpoint, (value) => reports.push(value));
  await search.start('a', 'invalid', '---');
  assert.equal(reports.at(-1).error, 'invalid');
  assert.equal(contacted.length, 0);
  await search.start('a', 'r1', '  Jaipur  ');
  assert.equal(reports.at(-1).results[0].title, 'Local');
  assert.equal(contacted[0].data, '{"q":"Jaipur"}');
  assert.equal(contacted[0].url, endpoint.origin + '/v1/search');
  assert.equal(contacted[0].options.method, 'POST');
  assert.equal(contacted[0].options.headers.cookie, undefined);
  status = 302;
  await search.start('a', 'r2', 'Jaipur');
  assert.equal(reports.at(-1).error, 'failed');
  status = 200;
  body = ' '.repeat(60 * 1024 + 1);
  await search.start('a', 'r3', 'Jaipur');
  assert.equal(reports.at(-1).error, 'failed');
  assert.equal(contacted.length, 3);
  assert(contacted.every((r) => r.url === endpoint.origin + '/v1/search'));
});

test('native VFD matcher mirrors the compiler precedence', () => {
  const { vfdMatch } = require('../policy.cjs');
  const env = (over = {}) => ({
    ads: new Set(['doubleclick.net']),
    trackers: new Set(['google-analytics.com']),
    social: new Set(['connect.facebook.com']),
    patterns: ['pagead', '/ads/'],
    trackerPatterns: ['collect?'],
    firstParty: ['/pagead/'],
    exceptions: [{ hosts: ['allowed.example'], paths: [] }],
    strict: new Set(['evil.example']),
    paused: new Set(over.paused || []),
    lists: { ads: true, trackers: true, social: false, cosmetic: true, aggressive: !!over.aggressive },
    enabled: over.enabled !== false,
    privateTab: !!over.privateTab,
  });
  const doc = 'https://news.example/';
  assert.equal(vfdMatch('https://evil.example/x', doc, env()), 'strict');
  assert.equal(vfdMatch('https://ad.doubleclick.net/x', doc, env()), 'ads');
  assert.equal(vfdMatch('https://allowed.example/x.js', doc, env()), '');
  assert.equal(vfdMatch('https://x.example/pagead/x.js', doc, env()), 'token');
  assert.equal(vfdMatch('https://x.example/collect?v=1', doc, env()), 'tokentracker');
  assert.equal(vfdMatch('https://news.example/pagead/x.js', doc, env()), '');
  assert.equal(vfdMatch('https://news.example/pagead/x.js', doc, env({ aggressive: true })), 'firstparty');
  assert.equal(vfdMatch('https://ads.news.example/x.js', 'https://www.news.example/article', env()), 'ads');
  assert.equal(vfdMatch('https://ad.doubleclick.net/x', 'https://www.news.example/article', env({ paused: ['news.example'] })), '');
  assert.equal(vfdMatch('https://cdn.example/app.js', doc, env()), '');
});
