'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkMobilePages(browser) {
  for (const platform of ['ios', 'android']) {
    const page = await browser.newPage({ viewport: { width: platform === 'ios' ? 390 : 360, height: 790 } });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((platform) => {
      localStorage.setItem('vaayvu.settings', JSON.stringify({ordinaryWeb:true}));
      localStorage.setItem(
        'vaayvu.history',
        JSON.stringify([{ url: 'https://example.org/field', title: 'Field guide', at: 1 }]),
      );
      const emit = (m) => queueMicrotask(() => vaayvuEvent(m));
      window.sent = [];
      window.VaayvuNative = {
        postMessage(raw) {
          const m = JSON.parse(raw);
          sent.push(m);
          if (m.type === 'ready')
            emit({
              type: 'ready',
              platform,
              privateSupported: true,
              canZoom: true,
              canCopy: true,
              canDesktopSite: true,
              canPageDisplay: true,
              canPageReminder: true,
              canReadAloud: true,
              canVoiceSearch: platform === 'android',
              canPrivacyReport: platform === 'android',
            });
          if (['open', 'navigate'].includes(m.type) && m.url)
            emit({ type: 'page', id: m.id, url: m.url, title: 'Field guide', loading: false });
          if (m.type === 'extract')
            emit({ type: 'text', id: m.id, url: current().url, text: 'An illustrated field guide.' });
          if (m.type === 'privacyReport')
            emit({ ...m, url: current().url, blocked: 3, domains: [{ host: 'tracker.example', count: 3 }] });
        },
      };
    }, platform);
    await page.goto(pathToFileURL(path.resolve('chrome/index.html')).href);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const panel = () => button('Page actions').click();
    const dismiss = () => button('Close dialog').click();
    await page.locator('.phone-tiles .phone-tile').first().waitFor();
    assert.equal(await page.locator('.phone-tiles .phone-tile').count(), 4);
    await page.locator('.phone-cards button').filter({ hasText: 'Field guide' }).click();
    await page.waitForFunction(() => view === 'web' && !current().loading);
    await panel();
    await button('Customize page actions').click();
    await page.locator('[data-phone-pin="phoneNote"]').check();
    await button('Done').click();
    assert.equal(await page.locator('.phone-primary-actions [data-act="phoneNote"]').count(), 1);
    await button('Page note').click();
    await page.locator('#phone-note-form textarea').fill('Read the appendix.');
    await button('Save note').click();
    await panel();
    await button('Listen to page').click();
    await page.waitForFunction(() =>
      sent.some((m) => m.type === 'readAloud' && m.text === 'An illustrated field guide.'),
    );
    await panel();
    await button('Privacy and connection').click();
    await page.getByText('HTTPS connection', { exact: true }).waitFor();
    if (platform === 'android') await page.getByText('tracker.example', { exact: true }).waitFor();
    await dismiss();
    await panel();
    await button('Remind me').click();
    await button('In one hour').click();
    assert.equal(
      await page.evaluate(
        () => sent.at(-1).seconds || sent.findLast((x) => x.type === 'pageReminder').seconds,
      ),
      3600,
    );
    await panel();
    await button('Website settings').click();
    await page.getByLabel('Appearance for this website').selectOption('dark');
    await button('Save website preference').click();
    assert.ok(await page.evaluate(() => sent.some((m) => m.type === 'pageDisplay' && m.action === 'dark')));
    await dismiss();
    await panel();
    await button('Page zoom').click();
    await button('125%').click();
    await dismiss();
    await page.evaluate(() => vaayvuEvent({ type: 'pageScroll', id: activeId, collapsed: true }));
    await button('Show browser controls').click();
    await button('Share current page').click();
    assert.ok(await page.evaluate(() => sent.some((m) => m.type === 'share')));
    await panel();
    await button('Save bookmark').click();
    await button('Save location').click();
    assert.deepEqual(
      await page.evaluate(() =>
        bookmarkTopics([{ title: 'Coastal cycling guide' }, { title: 'Mountain cycling' }]),
      ),
      [['cycling', 2]],
    );
    await button('New folder').click();
    await page.getByLabel('Folder name').fill('Outdoors');
    await button('Save folder').click();
    await button('Organize Field guide').click();
    await page.getByLabel('Folder on this device').selectOption({ label: 'Outdoors' });
    await button('Save location').click();
    assert.equal(await page.locator('#dialog-title').textContent(), 'Outdoors');
    await page.locator('#phone-library-search').fill('missing');
    await page.getByText('No matches', { exact: true }).waitFor();
    await dismiss();
    await page.evaluate(() => addTab(true));
    assert.equal(await page.locator('.phone-cards, .phone-tiles').count(), 0);
    await button('Open library').click();
    await page.getByText('Switch to a regular tab to open your personal library.').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }

  const page = await browser.newPage();
  await page.setContent('<main><h1>Article</h1><aside>Promoted panel</aside></main>');
  const script = fs.readFileSync(path.resolve('chrome/page-display.js'), 'utf8');
  const run = (action) =>
    page.evaluate(({ script, action }) => (0, eval)('(' + script + ')')(action), { script, action });
  assert.equal(await run('pick'), 'picking');
  await page.getByText('Promoted panel').click();
  assert.equal(await page.locator('aside').isVisible(), false);
  await run('undo');
  assert.equal(await page.locator('aside').isVisible(), true);
  await run('dark');
  await run('light');
  assert.equal(await page.evaluate(() => document.documentElement.style.filter), '');
  await page.close();
  console.log(
    'PASS mobile library, local notes, customizable actions, privacy, reminders, speech, share, compact toolbar, private browsing and reversible page display',
  );
};
