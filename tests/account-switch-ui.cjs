const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkAccountSwitch(browser) {
  const context = await browser.newContext();
  const first = 'https://first.example';
  const second = 'https://second.example';
  try {
    await context.addInitScript(() => {
      localStorage.setItem('vaayvu.settings', JSON.stringify({ordinaryWeb:true}));
      window.sent = [];
      window.fetch = async (address, options) => {
        const url = new URL(address);
        const body = JSON.parse(options.body);
        const command = url.pathname.slice('/v1/'.length);
        window.sent.push({ command, origin: url.origin, body });
        let result = {};
        if (command === 'login') result = { username: body.username, token: 't'.repeat(43) };
        if (command === 'ask') result = { answer: 'Test answer' };
        if (command === 'sync') result = {
          bookmarks: [], devices: [{ id: 'other', name: 'Test phone', tabs: [] }], incoming: [],
        };
        return { ok: true, json: async () => result };
      };
      window.VaayvuNative = { postMessage(raw) {
        const m = JSON.parse(raw);
        if (m.type === 'ready') queueMicrotask(() => vaayvuEvent({ type: 'ready', platform: 'mac' }));
        if (m.type === 'open' || m.type === 'navigate') queueMicrotask(() =>
          vaayvuEvent({ type: 'page', id: m.id, url: m.url, title: 'Fixture', loading: false }));
        if (m.type === 'extract') queueMicrotask(() => vaayvuEvent({
          type: 'text', id: m.id, url: 'https://reader.example/', title: 'Fixture', text: 'Local excerpt',
        }));
      }};
    });
    const reader = await context.newPage();
    const other = await context.newPage();
    const index = pathToFileURL(path.resolve('chrome/index.html')).href;
    await Promise.all([reader.goto(index), other.goto(index)]);
    const signIn = (win, origin, username) => win.evaluate(([origin, username]) =>
      VaayvuSync.authenticate(origin, username, 'test password'), [origin, username]);
    const waitAccount = async (origin, username) => {
      // Force the same load path a storage event uses; some headless builds do
      // not deliver file-origin storage events reliably across pages.
      await reader.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'vaayvu.sync.session.v1' })));
      return reader.waitForFunction(([origin, username]) =>
        VaayvuSync.session?.origin === origin && VaayvuSync.session?.username === username, [origin, username]);
    };
    const showReader = async origin => {
      await reader.evaluate(() => command('tools'));
      await reader.locator('#ask').waitFor();
      assert.ok((await reader.locator('#ask .dialognote').textContent()).includes(origin));
      await reader.locator('#ask textarea').fill('What does this say?');
    };
    const hidden = () => reader.locator('#dialog').waitFor({ state: 'hidden' });
    await signIn(other, first, 'owner');
    await waitAccount(first, 'owner');
    await reader.locator('#hero-input').fill('https://reader.example/');
    await reader.locator('#hero-input').press('Enter');
    await showReader(first);

    await signIn(other, second, 'owner');
    await hidden();
    await waitAccount(second, 'owner');
    assert.equal(await reader.evaluate(() => sent.some(r => r.command === 'ask')), false);

    // Exercise the submission guard independently of a window's storage-event notification.
    await showReader(second);
    await signIn(reader, first, 'owner');
    await reader.getByRole('button', {name: 'Send page and question'}).click();
    await hidden();
    assert.equal(await reader.evaluate(() => sent.some(r => r.command === 'ask')), false);

    await showReader(first);
    await reader.getByRole('button', {name: 'Send page and question'}).click();
    await reader.getByText('Test answer', {exact:true}).waitFor();
    const transmitted = await reader.evaluate(() => sent.filter(r => r.command === 'ask'));
    assert.deepEqual(transmitted, [{
      origin: first, command: 'ask', body: { question: 'What does this say?', text: 'Local excerpt' },
    }]);
    await reader.getByRole('button', {name:'Close dialog',exact:true}).click();

    await reader.evaluate(async () => { await runSync(); command('sendDevice'); });
    await reader.locator('[data-send-device]').waitFor();
    await signIn(other, first, 'someoneelse');
    await hidden();
    await waitAccount(first, 'someoneelse');
    assert.equal(await reader.evaluate(() => sent.some(r => r.command === 'send')), false);

    await reader.evaluate(() => editBookmark());
    await reader.locator('#edit-bookmark [name="url"]').fill('https://draft.example/');
    await signIn(other, second, 'owner');
    await hidden();
    assert.deepEqual(await reader.evaluate(() => saved()), []);
    console.log('PASS account-bound reader consent, device selection and bookmark editor');
  } finally { await context.close(); }
};
