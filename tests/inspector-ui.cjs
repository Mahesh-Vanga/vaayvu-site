'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VAAYVU_TEST_CHROME, headless: true });
  try {
    for (const platform of ['mac', 'windows', 'android', 'ios']) {
      const phone = platform === 'android' || platform === 'ios';
      const context = await browser.newContext({ viewport: { width: phone ? 390 : 1100, height: 790 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(platform => {
        window.vaayvuWindow = { id: 'main', profileId: 'local' };
        window.sentMessages = [];
        window.VaayvuNative = {
          postMessage(raw) {
            const message = JSON.parse(raw);
            window.sentMessages.push(message);
            if (message.type === 'ready') {
              queueMicrotask(() => vaayvuEvent({
                type: 'ready', platform, canInspect: true, canNativeInspector: platform !== 'ios',
                chromiumDesktop: platform === 'windows' || platform === 'mac',
              }));
            }
            if (message.type === 'open' || message.type === 'navigate') {
              queueMicrotask(() => vaayvuEvent({
                type: 'page', id: message.id, url: message.url, title: 'Inspector fixture', loading: false,
              }));
            }
          },
        };
      }, platform);
      await page.goto(pathToFileURL(path.resolve('chrome/index.html')).href);
      await page.evaluate(() => navigate('https://inspect.example/fixture'));
      await page.waitForFunction(() => pageInspector.available());
      if (phone) {
        await page.getByRole('button', { name: 'Page actions', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Browser menu', exact: true }).click();
        await page.getByRole('button', { name: 'More tools', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Inspect page', exact: true }).click();
      const sent = await page.evaluate(() => sentMessages.filter(m => ['inspection', 'openDeveloperTools', 'inspectPage', 'inspectorAction'].includes(m.type)));
      assert.equal(sent.length, 1);
      if (platform === 'ios') {
        assert.equal(sent[0].type, 'inspection');
        assert.equal(sent[0].enabled, true);
      } else {
        assert.equal(sent[0].type, 'openDeveloperTools');
        assert.equal(sent[0].url, 'https://inspect.example/fixture');
      }
      assert.equal(await page.locator('#inspector-dock, #desktop-inspector').count(), 0);
      assert.equal(await page.locator('script[src*="inspector"],link[href*="inspector"]').count(), 0);
      assert.equal(await page.locator('#dialog').evaluate(el => el.open), false);
      const rectangle = await page.locator('#viewport').boundingBox();
      assert.ok(rectangle.width > 100 && rectangle.height > 100);

      await page.evaluate(request => {
        vaayvuEvent({ type: 'nativeInspectorUnavailable', id: request.id, url: request.url });
      }, sent[0]);
      assert.equal(await page.evaluate(() => sentMessages.some(m => m.type === 'inspectPage')), false);

      for (const state of ['loading', 'failed', 'private', 'guest']) {
        assert.deepEqual(await page.evaluate(state => {
          const tab = current();
          tab.loading = state === 'loading';
          tab.error = state === 'failed' ? 'Failed to load' : '';
          tab.private = state === 'private';
          windowInfo.guest = state === 'guest';
          const count = sentMessages.length;
          command('inspect');
          return [pageInspector.available(), sentMessages.slice(count).some(m => ['inspection', 'openDeveloperTools'].includes(m.type))];
        }, state), [false, false]);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(platform + ' native Inspect routing passed');
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

