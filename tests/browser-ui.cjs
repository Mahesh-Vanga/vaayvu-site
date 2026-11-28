const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path'),
  assert = require('node:assert/strict');
const out = process.env.VAAYVU_TEST_SCREENSHOTS;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VAAYVU_TEST_CHROME, headless: true });
  try {
    for (const [platform, width, height] of [
      ['mac', 1260, 800],
      ['ios', 390, 844],
      ['android', 360, 730],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'light' });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.setDefaultTimeout(10000);
      await page.addInitScript((p) => {
        window.messages = [];
        window.VaayvuNative = {
          postMessage(s) {
            const m = JSON.parse(s);
            messages.push(m);
            if (m.type === 'ready')
              queueMicrotask(() =>
                vaayvuEvent({
                  type: 'ready',
                  platform: p,
                  privateSupported: true,
                  canClearLegacyRecords: p !== 'android',
                  ...Object.fromEntries(
                    [
                      'canZoom',
                      'canPrint',
                      'canCopy',
                      'canProtect',
                      'canCustomBlock',
                      'canUserStyles',
                      'canImportBookmarks',
                      'canExportBookmarks',
                      'canClearSiteData',
                      'canDesktopSite',
                      'canOpenDownloads',
                      'canOpenDownload',
                      'canDefaultBrowser',
                    ].map((k) => [k, true]),
                  ),
                }),
              );
            if (m.type === 'clearLegacyRecords') queueMicrotask(() =>
              vaayvuEvent({type:'legacyRecordsCleared',requestId:m.requestId,success:true}));
            if (m.type === 'navigate' || m.type === 'open')
              queueMicrotask(() =>
                vaayvuEvent({
                  type: 'page',
                  id: m.id,
                  url: m.url,
                  title: new URL(m.url).pathname.slice(1).replaceAll('-', ' ') || 'Example',
                  loading: false,
                }),
              );
          },
        };
        if (!localStorage.getItem('vaayvu.settings')) {
          localStorage.setItem('vaayvu.settings', JSON.stringify({ ordinaryWeb: true, sidebarMode: 'off', theme: 'light' }));
        }
      }, platform);
      await page.goto(pathToFileURL(path.resolve('chrome/index.html')).href);
      const action = (key) =>
        page
          .locator('#dialog[open] [data-act="' + key + '"]')
          .first()
          .click();
      const val = (expr) => page.evaluate(expr);
      const more = () => page.getByRole('button', { name: 'Browser menu', exact: true }).click();
      const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      const buttonNew = () =>
        page.locator(platform === 'mac' ? '#top-tabs .strip-new:visible, #toolbar [data-act="newTab"]:visible' : '#mobilebar [data-act="newTab"]');
      const managerButton = () =>
        page.locator(
          platform === 'mac' ? '#toolbar [data-act="manageTabs"]' : '#mobilebar [data-act="tabOverview"]',
        );
      const openManager = async () => {
        await managerButton().click();
        if (platform === 'mac') return;
        const privateScope = page.locator('[data-overview="privacy"]');
        if (await privateScope.getAttribute('aria-pressed') === 'true') await privateScope.click();
        await page.locator('[data-overview="more"]').click();
        await page.locator('[data-overview="organize"]').click();
      };
      const visit = async (url) => {
        await page.locator('#address').fill(url);
        await page.locator('#address').press('Enter');
        await page.waitForFunction(() => view === 'web' && !current().loading);
      };
      await page.locator(platform === 'mac' ? '#hero-input' : '.phone-home').waitFor();
      assert.equal(await page.title(), 'Vaayvu Browser');
      assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), 'assets/vaayvu.svg');
      assert.equal(await page.locator('#rail .brand > span').textContent(), 'Vaayvu');
      await page.locator('#rail .brand > img').evaluate(img => img.decode());
      assert.ok(await page.getByRole('heading', { name: 'The Observatory', exact: true }).isVisible());
      assert.match(await page.locator('#desk-time').getAttribute('datetime'), /^\d{4}-\d\d-\d\dT/);
      await page.locator('[data-landscape="dusk"]').click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('vaayvu.settings') || '{}').wallpaper === 'dusk');
      await page.reload();
      await page.waitForFunction(() => typeof settings !== 'undefined' && settings.wallpaper === 'dusk');
      assert.equal(await page.locator('[data-landscape="dusk"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-landscape="ridge"]').click();
      assert.equal(await buttonNew().isVisible(), true);
      await visit('https://en.wikipedia.org/wiki/Reading');
      await buttonNew().click();
      assert.equal(await val('document.activeElement.id'), 'address');
      await visit('https://example.org/Field-notes');
      await buttonNew().click();
      await visit('https://example.org/Design-guide');
      await openManager();
      assert.equal(await page.locator('.managed-tab').count(), 3);
      await page.locator('#manage-query').fill('Field notes');
      assert.equal(await page.locator('.managed-tab').count(), 1);
      await page.locator('[data-pick-tab]').check();
      await page.locator('[data-tab-batch="group"]').click();
      await page.locator('#group-selection input').fill('Research');
      await page.locator('#group-selection button.primary').click();
      await page.locator('#manage-kind').selectOption('grouped');
      assert.equal(await page.locator('.managed-tab').count(), 1);
      await page.locator('[data-tab-options]').click();
      await page.locator('[data-tab-action="pinTab"]').click();
      assert.equal(await val("tabs.find(t=>t.url.includes('Field')).pinned"), true);
      assert.ok((await val('current().url')).includes('Design'));
      await openManager();
      if (out)
        await page.locator('#dialog').screenshot({ path: out + '/Vaayvu-' + platform + '-tabs.png' });
      await close();
      await more();
      await action('settings');
      await page.locator('#settings-filter').fill('India search');
      await page.locator('[data-pref-jump="indiaSearch"]').click();
      await page.locator('#preference-indiaSearch').getByText('No regional server is configured.', { exact: false }).waitFor();
      await close();
      await buttonNew().click();
      await page.locator('#address').fill('alpine lakes');
      await page.locator('#address').press('Enter');
      assert.equal(await val('current().url'), 'https://duckduckgo.com/?q=alpine+lakes');
      assert.ok(await val("!JSON.stringify(localStorage).includes('alpine lakes')"));
      await page.locator('#address').fill('Field notes');
      assert.equal(await page.locator('#address-matches').isVisible(), true);
      await page.locator('#address').press('ArrowDown');
      await page.locator('#address').press('Enter');
      assert.ok((await val('current().url')).includes('/Field'));
      await more();
      await action('extensions');
      await page
        .locator('#extension-file')
        .setInputFiles(path.resolve('examples/Wikipedia-Reading-Type.zip'));
      await page.getByRole('button', { name: 'Install extension', exact: true }).click();
      assert.ok(
        await val(
          "messages.some(m=>m.type==='userStyles' && m.url.includes('wikipedia') && m.css.includes('line-height'))",
        ),
      );
      await page.locator('[data-enable-ext]').uncheck();
      assert.ok(await val("messages.some(m=>m.type==='userStyles' && m.css==='')"));
      await close();
      await page.evaluate(() =>
        vaayvuEvent({
          type: 'newtab',
          id: 'web-popup',
          url: '',
          private: false,
          adopted: true,
          background: true,
        }),
      );
      assert.equal(await val('tabs.at(-1).adopted'), true);
      assert.ok((await val('current().url')).includes('/Field'));
      await page.evaluate(() => {
        vaayvuEvent({ type: 'command', command: 'selectTab9' });
        vaayvuEvent({ type: 'page', id: 'web-popup', blank: true, url: 'about:blank', loading: false });
      });
      assert.equal(await val('view'), 'web');
      assert.equal(await val('current().url'), '');
      assert.equal(await val("messages.filter(m=>m.type==='open' && m.id==='web-popup').length"), 0);
      await page.evaluate(() => vaayvuEvent({ type: 'tabclosed', id: 'web-popup' }));
      await more();
      await action('privateTab');
      await visit('https://example.org/private');
      await page.locator('#address').fill('Field');
      assert.equal(await page.locator('#address-matches').isVisible(), false);
      assert.ok(!(await val("JSON.stringify(read('history',[]))")).includes('/private'));
      await page.locator('#address').press('Escape');
      await more();
      await action('settings');
      if (out)
        await page.locator('#dialog').screenshot({ path: out + '/Vaayvu-' + platform + '-settings.png' });
      await close();
      await page.evaluate(() => {
        const t = current();
        vaayvuEvent({
          type: 'page',
          id: t.id,
          url: 'https://example.org/failed',
          failed: true,
          error: 'The test host could not be reached.',
          loading: false,
        });
      });
      await page.getByRole('button', { name: 'Try again' }).click();
      await page.waitForFunction(() => !current().error);
      assert.ok(await val("messages.some(m=>m.type==='navigate' && m.url.endsWith('/failed'))"));
      await more();
      await action('settings');
      await action('pref-tabs');
      await page.locator('#preference-newTabPosition').selectOption('after');
      await page.locator('#preference-afterClose').selectOption('lastUsed');
      await close();
      await openManager();
      await page.locator('.tab-switch').filter({ hasText: 'Field notes' }).click();
      const first = await val('activeId');
      await buttonNew().click();
      assert.equal(await val('tabs.findIndex(t => t.id === activeId)'), 1);
      await visit('https://example.org/Temporary-note');
      await openManager();
      await page
        .locator('.managed-tab')
        .filter({ hasText: 'Temporary note' })
        .locator('[data-tab-options]')
        .click();
      await page.locator('[data-tab-action="closeOne"]').click();
      assert.equal(await val('activeId'), first);
      await more();
      await action('menu-bookmarks');
      await action('bookmarks');
      await page.locator('[data-act="addBookmark"]').click();
      await page.locator('#edit-bookmark [name="title"]').fill('Vaayvu test bookmark');
      await page.locator('#edit-bookmark [name="url"]').fill('https://example.org/bookmark');
      await page.locator('#edit-bookmark button.primary').click();
      await page.locator('[data-edit-bookmark]').click();
      await page.locator('#edit-bookmark [name="title"]').fill('Updated bookmark');
      await page.locator('#edit-bookmark button.primary').click();
      assert.ok(await page.locator('.results').getByText('Updated bookmark').isVisible());
      await page.evaluate(() => importBookmarks('<TITLE>Vaayvu bookmarks</TITLE><DL><DT><A HREF="https://example.org/legacy">Saved before the rename</A></DL>'));
      const exported = await page.evaluate(() => exportBookmarkText());
      assert.match(exported, /<TITLE>Vaayvu bookmarks<\/TITLE>/);
      assert.match(exported, /Saved before the rename/);
      await page.evaluate(() =>
        write('recentlyClosed.previous-window', [
          { url: 'https://example.org/old-visit', title: 'Old window' },
        ]),
      );
      await more();
      await action('clearData');
      await page.locator('#delete-data input[name="history"]').check();
      await page.locator('#delete-data button.primary').click();
      assert.ok(
        await val(
          "Object.keys(localStorage).every(k => k !== 'vaayvu.recentlyClosed' && !k.startsWith('vaayvu.recentlyClosed.') && k !== 'vaayvu.recentlyClosed' && !k.startsWith('vaayvu.recentlyClosed.'))",
        ),
      );
      assert.equal(await val('saved()[0].title'), 'Updated bookmark');
      assert.equal(await val("messages.some(m => m.type === 'clearLegacyRecords' && m.history && !m.downloads)"), platform !== 'android');
      assert.deepEqual(errors, []);
      console.log(
        'PASS',
        platform,
        'new tab, scoped management, group/pin, India search, omnibox, extension ZIP and disable, adopted popup, private history, error retry',
      );
      await page.close();
    }
    await require('./observatory-ui.cjs')(browser);
    await require('./india-search-ui.cjs')(browser);
    await require('./account-switch-ui.cjs')(browser);
    await require('./mobile-overview-ui.cjs')(browser);
    await require('./mobile-pages-ui.cjs')(browser);
    await require('./standards-ui.cjs')(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
