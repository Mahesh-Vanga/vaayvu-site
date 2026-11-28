const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../chrome/core.js');

function workspace(tab, capabilities = {}) {
  const actions = [];
  const context = vm.createContext({
    e: core.escapeHTML,
    webURL: core.webURL,
    publicTabs: core.publicTabs,
    hostOf: (value) => new URL(value).hostname,
    icon: () => '',
    view: 'web',
    windowInfo: { private: false, id: 'main' },
    current: () => tab,
    activeId: tab.id,
    platform: 'mac',
    capabilities,
    navigator: {},
    settings: {},
    tabs: [tab],
    native: true,
    privateSupported: true,
    closedTabsKey: 'recentlyClosed',
    read: () => [],
    saved: () => [],
    sync: { session: null },
    mounted: new Set(),
    narrowLayout: { matches: false },
    send: (action) => actions.push(action),
    closeDialog() {},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../chrome/workbench.js'), 'utf8'), context);
  return { context, actions };
}

test('private URLs cannot be sent, bookmarked, or pinned to a launcher through menu commands', () => {
  const { context, actions } = workspace(
    { id: 'private', url: 'https://example.org/', private: true },
    { canShortcut: true },
  );
  for (const command of ['sendDevice', 'bookmark', 'shortcut', 'readLater']) {
    assert.equal(vm.runInContext('browserCommands()[' + JSON.stringify(command) + '][3]', context), false);
    assert.equal(vm.runInContext('advancedCommand(' + JSON.stringify(command) + ')', context), true);
  }
  assert.deepEqual(actions, []);
});

test('group headings and tab titles are escaped, and folded groups hide their member buttons', () => {
  const { context } = workspace({ id: '1', title: '<script>title</script>', url: 'https://example.org/', group: 'Work & travel' });
  const open = vm.runInContext('sidebarTabs(tabs)', context);
  assert.match(open, /Work &amp; travel/);
  assert.match(open, /&lt;script&gt;title/);
  assert.doesNotMatch(open, /<script>/);
  const folded = vm.runInContext("foldedGroups.add('Work & travel'); sidebarTabs(tabs)", context);
  assert.match(folded, /aria-expanded="false"/);
  assert.doesNotMatch(folded, /data-select/);
});

test('unsupported native actions stay out of the menu and do not send bridge messages', () => {
  const {context, actions} = workspace({id: '1', url:'https://example.org/'});
  assert.equal(vm.runInContext("control('savePDF')", context), '');
  assert.equal(vm.runInContext("advancedCommand('savePDF')",context),true);
  assert.deepEqual(actions, []);
});
