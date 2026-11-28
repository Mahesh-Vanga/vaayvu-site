const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkMobileOverview(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 812 } });
  try {
    const sample = await context.newPage();
    await sample.setContent(
      '<main style="padding:24px"><h1>Test article</h1><p>A local tab preview.</p></main>',
    );
    const image =
      'data:image/jpeg;base64,' + (await sample.screenshot({ type: 'jpeg', quality: 45 })).toString('base64');
    await sample.close();
    await context.addInitScript((thumbnail) => {
      localStorage.setItem('vaayvu.settings', JSON.stringify({ordinaryWeb:true}));
      if (!localStorage.getItem('overviewQA')) {
        localStorage.setItem(
          'vaayvu.spaces',
          JSON.stringify({
            active: 'personal',
            list: [
              { id: 'personal', name: 'Personal' },
              { id: 'work', name: 'Work' },
            ],
          }),
        );
        localStorage.setItem(
          'vaayvu.tabs',
          JSON.stringify([
            { id: 'zeta', title: 'Zeta', url: 'https://zeta.example/', space: 'personal' },
            { id: 'alpha', title: 'Alpha', url: 'https://alpha.example/', space: 'personal' },
            { id: 'outside', title: 'Other space', url: 'https://elsewhere.example/', space: 'work' },
          ]),
        );
        localStorage.setItem('vaayvu.active', JSON.stringify('zeta'));
        localStorage.setItem('overviewQA', 'true');
      }
      window.messages = [];
      window.VaayvuNative = {
        postMessage(raw) {
          const m = JSON.parse(raw);
          window.messages.push(m);
          if (m.type === 'ready')
            queueMicrotask(() =>
              vaayvuEvent({
                type: 'ready',
                platform: 'ios',
                privateSupported: true,
                canTabPreviews: true,
                canProfiles: true,
                canCopy: true,
              }),
            );
          if (m.type === 'open' || m.type === 'navigate')
            queueMicrotask(() =>
              vaayvuEvent({
                type: 'page',
                id: m.id,
                url: m.url,
                title: new URL(m.url).hostname.split('.')[0],
                loading: false,
              }),
            );
          if (m.type === 'tabPreviews' && !window.deferPreviews)
            for (const t of m.tabs)
              queueMicrotask(() =>
                vaayvuEvent({
                  type: 'tabPreview',
                  requestId: m.requestId,
                  id: t.id,
                  url: t.url,
                  image: thumbnail,
                }),
              );
        },
      };
    }, image);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(pathToFileURL(resolve('chrome/index.html')).href);
    const open = () => page.locator('#mobilebar [data-act="tabOverview"]').click();
    const action = (k) =>
      page
        .locator('dialog [data-overview="' + k + '"]')
        .first()
        .click();
    const group = (name) => page.locator('.ov-group').filter({ hasText: name }).click();
    const create = async (name) => {
      await page.locator('#ov-new-group input').fill(name);
      await page.locator('#ov-new-group button.primary').click();
    };
    await page.waitForFunction(() => current().id === 'zeta' && !current().loading);
    const setLoading = (loading) => page.evaluate((state) => {
      const { id, url, title } = current();
      vaayvuEvent({ type: 'page', id, url, title, loading: state });
    }, loading);
    const previewRequests = () => page.evaluate(() =>
      messages.filter((m) => m.type === 'tabPreviews' && m.tabs.some((t) => t.id === 'zeta')),
    );
    const deliver = (batch) => page.evaluate(({ batch, image }) => {
      const tab = batch.tabs.find((t) => t.id === 'zeta');
      vaayvuEvent({ type: 'tabPreview', requestId: batch.requestId, id: tab.id, url: tab.url, image });
    }, { batch, image });
    const preview = page.locator('[data-ov-tab="zeta"] > img');
    await page.evaluate(() => { window.deferPreviews = true; });
    await setLoading(true);
    await open();
    const overviewBrand = page.locator('.ov-heading > img');
    await overviewBrand.evaluate(img => img.decode());
    assert.equal(await overviewBrand.getAttribute('src'), 'assets/vaayvu.svg');
    assert.equal((await previewRequests()).length, 0, 'A loading tab is not captured');
    await setLoading(false);
    const first = await previewRequests();
    assert.equal(first.length, 1, 'Unchanged URL and title request a preview when loading finishes');
    await deliver(first[0]);
    await preview.waitFor();
    await setLoading(true);
    assert.equal(await preview.count(), 0, 'Reload immediately removes the previous image');
    await setLoading(false);
    const next = await previewRequests();
    assert.equal(next.length, 2, 'Finishing the same URL again requests a fresh preview');
    await deliver(first[0]);
    assert.equal(await preview.count(), 0, 'A delayed reply from before the reload is discarded');
    await deliver(next[1]);
    await preview.waitFor();
    await page.evaluate(() => { window.deferPreviews = false; });
    assert.equal(await page.locator('.ov-card').count(), 2);
    assert.equal(await page.locator('[data-ov-tab="alpha"] img').count(), 0);
    assert.equal(
      await page
        .locator('#ov-grid')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      2,
    );
    await action('sort');
    await page.locator('[data-ov-sort="title"]').click();
    assert.deepEqual(
      await page.locator('[data-ov-tab]').evaluateAll((els) => els.map((e) => e.dataset.ovTab)),
      ['alpha', 'zeta'],
    );
    await action('more');
    await action('copy');
    assert.match(
      await page.evaluate(() => messages.filter((m) => m.type === 'copy').at(-1).text),
      /^https:\/\/alpha\.example\/\nhttps:\/\/zeta\.example\/$/,
    );
    await action('more');
    await action('select');
    await page.locator('[data-ov-tab="alpha"]').click();
    await action('more');
    await action('groupFrom');
    await create('Reading');
    assert.equal(await page.locator('.ov-card').count(), 1);
    assert.equal(await page.locator('[data-ov-tab]').getAttribute('data-ov-tab'), 'alpha');
    await action('groups');
    assert.equal(await page.locator('#dialog [data-act="profiles"]').count(), 1);
    assert.equal(await page.locator('#dialog [data-act="spaceSheet"]').count(), 1);
    await action('groupNew');
    await create('Empty group');
    assert.equal(await page.locator('.ov-card').count(), 0);
    await action('add');
    assert.equal(await page.evaluate(() => tabGroups[current().group].name), 'Empty group');
    await open();
    assert.equal(await page.locator('.ov-start > .tab-brand').getAttribute('src'), 'assets/vaayvu.svg');
    assert.equal(await page.locator('.ov-caption > .tab-brand').getAttribute('src'), 'assets/vaayvu.svg');
    assert.equal(await page.locator('.ov-tile > img').count(), 0);
    await action('privacy');
    assert.equal(await page.locator('.ov-card').count(), 0);
    await action('add');
    assert.equal(await page.evaluate(() => current().private), true);
    await page.locator('#address').fill('https://private.example/');
    await page.locator('#address').press('Enter');
    await open();
    assert.equal(await page.locator('.ov-card').count(), 1);
    assert.equal(await page.locator('.ov-card img').count(), 0);
    await page.evaluate(() => { capabilities.canProfiles = false; });
    await action('groups');
    assert.equal(await page.locator('#dialog [data-act="profiles"]').count(), 0);
    await group('All tabs');
    assert.equal(await page.locator('.ov-card').count(), 3);
    await action('search');
    await page.locator('#ov-search').fill('zeta');
    assert.equal(await page.locator('.ov-card').count(), 1);
    await page.locator('[data-ov-close="zeta"]').click();
    assert.equal(await page.locator('.ov-card').count(), 0);
    assert.ok(await page.evaluate(() => tabs.some((t) => t.id === 'outside') && tabs.some((t) => t.private)));
    assert.ok(
      await page.evaluate(() =>
        messages
          .filter((m) => m.type === 'tabPreviews')
          .every((m) => m.tabs.every((t) => !t.url.includes('private') && !t.url.includes('elsewhere'))),
      ),
    );
    assert.ok(
      await page.evaluate(() =>
        Object.values(localStorage).every(
          (v) => !v.includes('data:image/jpeg;base64') && !v.includes('private.example'),
        ),
      ),
    );
    assert.deepEqual(errors, []);
    await require('./responsive-mobile-ui.cjs')(browser);
    console.log(
      'PASS mobile overview, scoped groups, regular/private switch, real thumbnail bridge and in-memory boundaries',
    );
  } finally {
    await context.close();
  }
};
