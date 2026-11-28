'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { normalize, parseDomains, editorPatch, matchingFields } = require('../chrome/preferences.js');

test('the desktop shell starts light and all hosts honor a saved theme', () => {
  const source = readFileSync(require.resolve('../chrome/preferences.js'), 'utf8');
  const core = require('../chrome/core.js');
  for (const [href, defaultTheme] of [
    ['vaayvu://browser/index.html', 'light'],
    ['https://appassets.androidplatform.net/assets/index.html', 'dark'],
    ['file:///bundle/chrome/index.html', 'dark'],
    ['http://localhost:5173/index.html', 'dark'],
  ]) {
    const prefs = runInNewContext(source + '\nVaayvuPreferences', { location: { href }, VaayvuCore: core });
    assert.equal(prefs.normalize({}).theme, defaultTheme, href);
    for (const theme of ['light', 'dark', 'system'])
      assert.equal(prefs.normalize({ theme }).theme, theme, href);
  }
});

test('desktop tab placement migrates earlier profiles and keeps the active strip consistent', () => {
  assert.equal(normalize({}).tabPosition, 'top');
  assert.equal(normalize({ horizontalTabs: false }).tabPosition, 'left');
  assert.equal(normalize({ horizontalTabs: true }).tabPosition, 'top');
  assert.equal(normalize({ horizontalTabs: false, tabPosition: 'bottom' }).horizontalTabs, true);
  assert.equal(normalize({ horizontalTabs: true, tabPosition: 'right' }).horizontalTabs, false);
  assert.equal(normalize({ tabPosition: 'invalid', horizontalTabs: false }).tabPosition, 'left');
  assert.equal(normalize({ pinTabSearch: false }).pinTabSearch, false);
});

test('existing profiles retain their choices and acquire defaults for new controls', () => {
  const current = normalize({ engine: 'Brave', theme: 'dark', bookmarkBar: true, name: ' Camera ',
    startup: 'page', startupURL: 'https://example.org', thumbnailMode: 'compact' }, true);
  assert.equal(current.engine, undefined);
  assert.equal(current.ordinaryWeb, true);
  assert.equal(current.searchProvider, "duckduckgo");
  assert.equal(normalize({ordinaryWeb:false}).ordinaryWeb, false);
  assert.equal(normalize({searchProvider:"google"}).searchProvider, "google");
  assert.equal(current.wallpaper, 'observatory');
  for (const wallpaper of ['observatory', 'ridge', 'dusk', 'paper', 'alpine', 'plain'])
    assert.equal(normalize({ wallpaper }).wallpaper, wallpaper);
  assert.equal(current.theme, 'dark');
  assert.equal(current.bookmarkBar, true);
  assert.equal(current.name, 'Camera');
  assert.equal(current.startupURL, 'https://example.org/');
  assert.equal(current.thumbnailMode, 'compact');
  assert.equal(current.sidebarMode, 'off');
  assert.equal(normalize({ sidebarMode: 'auto' }, true).sidebarMode, 'auto');
  assert.equal(current.defaultZoom, 100);
  assert.equal(current.linkTabs, 'foreground');
  assert.equal(current.newTabPosition, 'end');
  assert.equal(current.afterClose, 'right');
  assert.equal(current.localSuggestions, true);
  assert.equal(current.rememberHistory, true);
  assert.equal(current.rememberDownloads, true);
  assert.equal(current.youtubeLayout, 'desktop');
  assert.equal(normalize({ youtubeLayout: 'mobile' }).youtubeLayout, 'mobile');
  assert.equal(current.lowMemoryBrowsing, false);
  assert.equal(normalize({ lowMemoryBrowsing: true }).lowMemoryBrowsing, true);
  assert.equal(current.youtubeDesktopOptimization, true);
  assert.equal(normalize({ youtubeDesktopOptimization: false }).youtubeDesktopOptimization, false);
  assert.equal(current.siteAppearance, 'matchBrowser');
  assert.equal(normalize({ siteAppearance: 'website' }).siteAppearance, 'website');
  assert.equal(current.highContrast, false);
  assert.deepEqual(current.blockedDomains, []);
  assert.deepEqual(normalize(current), current);
});

test('corrupt profile values fall back to valid choices', () => {
  for (const value of [null, [], 5, false]) assert.equal(normalize(value).ordinaryWeb, true);
  const settings = normalize({ engine: 'Custom', customSearchURL: 'http://example.org/%s', sidebarMode: 'unknown',
    localSuggestions: 'false', rememberHistory: false, name: 'd'.repeat(100), theme: '__proto__',
    startup: 'page', startupURL: 'javascript:prompt(1)', homeURL: 'file:///etc', defaultZoom: -1,
    blockedDomains: ['BAD HOST', 'EXAMPLE.org', {}, 'example.org'] });
  assert.equal(settings.engine, undefined);
  assert.equal(settings.startup, 'new');
  assert.equal(settings.startupURL, '');
  assert.equal(settings.homeURL, '');
  assert.equal(settings.sidebarMode, 'on');
  assert.equal(settings.localSuggestions, true);
  assert.equal(settings.rememberHistory, false);
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.name.length, 80);
  assert.equal(settings.defaultZoom, 100);
  assert.equal(normalize({ defaultZoom: '125' }).defaultZoom, 125);
  assert.equal(normalize({ newTabPosition: 'after' }).newTabPosition, 'after');
  assert.equal(normalize({ afterClose: 'lastUsed' }).afterClose, 'lastUsed');
  assert.equal(normalize({ afterClose: 'left' }).afterClose, 'left');
  assert.equal(normalize({ newTabPosition: 'middle' }).newTabPosition, 'end');
  assert.equal(normalize({ afterClose: 'closed' }).afterClose, 'right');
  assert.deepEqual(settings.blockedDomains, ['example.org']);
});

test('tracker domains normalize pasted DNS names and reject the whole invalid edit', () => {
  assert.deepEqual(parseDomains('  First.Example\n first.example,second.abc  '), ['first.example', 'second.abc']);
  assert.deepEqual(editorPatch('blockedDomains', '\n'), { blockedDomains: [] });
  for (const entry of ['https://a.example', 'a.example:90', 'a..example', 'K.example', '*.example',
    '.example', 'a.example.', 'a-.example', 'a_b.example', 'localhost', '127.0.0.1', '[::1]',
    '0xff.0xff.0xff.0xff', 'bad.example/path', 'a'.repeat(64) + '.test', Array(5).fill('x'.repeat(55)).join('.')])
    assert.throws(() => parseDomains('valid.example\n' + entry), /DNS name/);
  const many = Array.from({ length: 129 }, (_, i) => 'tracker' + i + '.example');
  assert.equal(parseDomains(many.slice(0, 128).join('\n')).length, 128);
  assert.throws(() => parseDomains(many.join('\n')), /128/);
  assert.equal(normalize({ blockedDomains: many }).blockedDomains.length, 128);
});

test('saved website and search forms immediately activate the validated choice', () => {
  assert.deepEqual(editorPatch('homeURL', ' '), { homeURL: '' });
  assert.deepEqual(editorPatch('startupURL', ' https://example.net '), { startup: 'page', startupURL: 'https://example.net/' });
  for (const entry of ['', 'file:///x', 'https://name:secret@example.net']) assert.throws(() => editorPatch('startupURL', entry));
  assert.throws(() => editorPatch('homeURL', 'about:blank'));
  const customSearchURL = 'https://example.org/find?q=%s&lang=en';
  assert.throws(() => editorPatch('customSearchURL', customSearchURL));
  assert.equal(normalize({engine: 'Custom', customSearchURL}).customSearchURL, undefined);
  assert.equal(normalize({ordinaryWeb: 'true'}).ordinaryWeb, true);
  assert.equal(normalize({ordinaryWeb: true}).ordinaryWeb, true);
  assert.deepEqual(editorPatch('name', ' Office '), { name: 'Office' });
  assert.throws(() => editorPatch('name', 'n'.repeat(81)));
});

test('search maps multiple terms, display values and category names to controls', () => {
  const keys = query => matchingFields(query).map(row => row[1]);
  assert.ok(keys('bookmark suggestions').includes('localSuggestions'));
  assert.ok(keys('suggest bookmarks').includes('localSuggestions'));
  assert.ok(keys('accessibility zoom').includes('defaultZoom'));
  assert.ok(keys('India search').includes('indiaSearch'));
  assert.ok(keys('manage tabs').includes('@manageTabs'));
  assert.ok(keys('memory youtube').includes('youtubeLayout'));
  assert.ok(keys('memory images fonts').includes('lowMemoryBrowsing'));
  assert.ok(keys('youtube 2160p').includes('youtubeDesktopOptimization'));
  assert.ok(keys('website dark light').includes('siteAppearance'));
  assert.deepEqual(keys('nothingwillmatch'), []);
  assert.deepEqual(matchingFields('privacy', []).length, 0);
});
