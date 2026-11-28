const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function testObservatory(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const calls = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https:\/\/(api\.open-meteo\.com|hn\.algolia\.com)\//, async route => {
    const url = new URL(route.request().url());
    calls.push(url);
    const response = url.host === 'api.open-meteo.com' ? {current:{temperature_2m:24.2,time:'2026-11-21T09:00'}} :
      {hits:[{title:'First article',url:'https://example.com/article'},{title:'Invalid link',url:'about:blank'}]};
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  try {
    await page.addInitScript(() => localStorage.setItem("vaayvu.settings", JSON.stringify({ordinaryWeb:false})));
    await page.goto(pathToFileURL(resolve('chrome/index.html')).href);
    const choose = name => page.locator('[data-desk-view="' + name + '"]').click();
    assert.equal(await page.locator('.obs-hero').evaluate(el => getComputedStyle(el,'::before').animationName), 'none');
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1240, 820]]) {
      await page.setViewportSize({width, height});
      const wordmark = page.locator('.obs-wordmark');
      assert.equal(await wordmark.textContent(), 'Vaayvu');
      const mark = wordmark.locator('img');
      assert.equal(await mark.getAttribute('src'), 'assets/vaayvu.svg');
      await mark.evaluate(img => img.decode());
      const layout = await wordmark.evaluate(brand => {
        const hero = brand.closest('.obs-hero');
        const bounds = sel => hero.querySelector(sel).getBoundingClientRect();
        const logo = brand.getBoundingClientRect();
        const overlaps = other => logo.left < other.right && logo.right > other.left && logo.top < other.bottom && logo.bottom > other.top;
        const search = JSON.stringify(bounds('#hero-form'));
        const header = brand.parentNode;
        brand.remove();
        const originalSearch = JSON.stringify(bounds('#hero-form'));
        header.prepend(brand);
        return {
          overlap:['.obs-mode','.obs-date','h1','#hero-form'].filter(sel => overlaps(bounds(sel))),
          search, originalSearch,
          logoBackground:getComputedStyle(brand).backgroundColor,
        };
      });
      assert.equal(layout.search, layout.originalSearch, 'Search field shifted at ' + width);
      assert.deepEqual(layout.overlap, [], 'Dashboard controls overlap at ' + width);
      assert.equal(layout.logoBackground, 'rgba(0, 0, 0, 0)');
    }
    await page.setViewportSize({width:390, height:844});
    await page.locator('[data-note="1"]').click();
    await page.locator('[data-note="read"]').click();
    assert.equal(await page.locator('#dialog-title').textContent(), 'Look along the twilight line');
    await page.getByRole('button',{name:'Close dialog'}).click();
    await choose('reading');
    await page.locator('[data-live="headlines"]').click();
    assert.equal(await page.locator('[data-load-live]').count(), 0);
    assert.equal(calls.length, 0);
    await page.getByRole('button',{name:'Close dialog'}).click();
    await choose('focus');
    await page.locator('#focus-toggle').click();
    // A lost or duplicated click leaves no deadline behind, so confirm the
    // stored value before reloading instead of asserting after the fact.
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = await page.evaluate(() => Number(localStorage.getItem('vaayvu.focusUntil')) > Date.now());
      if (started) break;
      await page.locator('#focus-toggle').click();
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => Number(localStorage.getItem('vaayvu.focusUntil')) > Date.now());
    assert.equal(await page.locator('#focus-status').textContent(), 'Session in progress', 'focus starts before reload');
    await page.reload();
    await choose('focus');
    await page.waitForFunction(() => document.querySelector('#focus-status')?.textContent === 'Session in progress', null, { timeout: 5000 });
    assert.equal(await page.locator('#focus-status').textContent(), 'Session in progress', 'focus deadline survives reload');
    await choose('overview'); await choose('focus');
    await page.evaluate(() => { focusUntil = Date.now() - 1; updateDeskClock(); });
    assert.equal(await page.locator('#focus-status').textContent(), 'Session complete');
    await page.evaluate(() => VaayvuPreferences.commit({ordinaryWeb:true}));
    await choose('overview');
    await page.locator('[data-live="weather"]').click();
    await page.locator('#forecast-city').selectOption('Hyderabad');
    await page.locator('[data-load-live="weather"]').click();
    await page.getByText('24°C', {exact:true}).waitFor();
    assert.equal(calls[0].searchParams.get('latitude'), '17.39');
    await page.locator('[data-live="headlines"]').click();
    await page.locator('[data-load-live="headlines"]').click();
    await page.getByText('First article').waitFor();
    assert.equal(await page.getByText('Invalid link').count(),0);
    assert.equal(calls.length,2);
    await page.evaluate(() => VaayvuPreferences.commit({ordinaryWeb:false}));
    assert.equal(await page.getByText('First article').count(),0);
    assert.equal(await page.getByText('24°C').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS Observatory offline reading, reduced motion, focus timer, explicit forecast and headlines, and strict-mode reset');
  } finally { await page.close(); }
};
