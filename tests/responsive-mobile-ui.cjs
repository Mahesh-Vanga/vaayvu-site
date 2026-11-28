const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function reachable(locator, description) {
  await locator.waitFor({ state: 'visible' });
  await locator.page().waitForFunction(() => !document.querySelector('#dialog[open]')?.getAnimations().some(a => a.playState === 'running'));
  assert.ok(await locator.evaluate((button) => {
    const r = button.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const label = button.getAttribute('aria-label') || button.textContent.trim();
    return label && r.width >= 24 && r.height >= 24 && r.left >= -1 && r.right <= innerWidth + 1 &&
      r.top >= -1 && r.bottom <= innerHeight + 1 && button.contains(hit);
  }), description);
}

module.exports = async function checkResponsiveMobile(browser) {
  const url = pathToFileURL(resolve('chrome/index.html')).href;
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  try {
    await phone.addInitScript(() => {
      localStorage.setItem('vaayvu.settings', JSON.stringify({ordinaryWeb:true}));
      window.VaayvuNative = { postMessage(raw) {
        const m = JSON.parse(raw);
        if (m.type === 'ready') queueMicrotask(() => vaayvuEvent({
          type: 'ready', platform: 'ios', privateSupported: true, canProfiles: true, canZoom: true,
        }));
        if (m.type === 'open' || m.type === 'navigate') queueMicrotask(() => vaayvuEvent({
          type: 'page', id: m.id, url: m.url, title: 'Field guide', loading: false,
        }));
      } };
    });
    const page = await phone.newPage();
    page.setDefaultTimeout(3000);
    await page.goto(url);
    const actions = (name) => page.locator('#dialog [data-overview="' + name + '"]').first();
    const manage = page.locator('#mobilebar [data-act="tabOverview"]');
    await page.locator('.phone-home').waitFor();
    await page.locator('#address').fill('https://guide.example/');
    await page.locator('#address').press('Enter');
    for (const [width, height] of [[320,568], [360,740], [390,844], [844,390], [390,844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => narrowLayout.matches), true);
      await reachable(manage, 'Tab overview entry at ' + width);
      await manage.click();
      assert.ok(await page.getByRole('heading', { name: 'Tabs', exact: true }).isVisible());
      for (const action of ['groups', 'privacy', 'search', 'sort', 'more', 'add', 'done']) {
        await reachable(actions(action), action + ' at ' + width);
      }
      const grid = await page.locator('#ov-grid').evaluate(el => ({
        columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
        height: el.clientHeight, overflow: el.scrollWidth - el.clientWidth,
        left: el.getBoundingClientRect().left,
      }));
      assert.equal(grid.columns, 2);
      assert.ok(grid.height >= 110 && grid.overflow <= 1, 'Scrollable tab cards at ' + width);
      if (width > height) assert.ok(grid.left > 150, 'Landscape tab cards sit beside controls');
      await actions('groups').click();
      const profiles = page.locator('#dialog [data-act="profiles"]');
      await profiles.scrollIntoViewIfNeeded();
      await reachable(profiles, 'Profile switcher at ' + width);
      await actions('back').click();
      await actions('done').click();
      const library = page.locator('#mobilebar [data-act="mobileLibrary"]');
      await reachable(library, 'Library at ' + width);
      await library.click();
      assert.ok(await page.getByRole('searchbox').last().isVisible());
      await page.evaluate(() => closeDialog());
      const pageActions = page.locator('#toolbar [data-act="pageActions"]');
      await reachable(pageActions, 'Page actions at ' + width);
      await pageActions.click();
      const customize = page.locator('#dialog [data-act="phonePageEdit"]');
      await customize.scrollIntoViewIfNeeded();
      await reachable(customize, 'Customize page actions at ' + width);
      await customize.click();
      await page.locator('[data-phone-pin="find"]').waitFor();
      await page.evaluate(() => { closeDialog(); command('settings'); });
      assert.ok(await page.locator('#settings-filter').isVisible());
      assert.ok(await page.locator('#prefs-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await page.evaluate(() => closeDialog());
    }
  } finally {
    await phone.close();
  }
  const desktop = await browser.newPage({ viewport: { width:844, height:390 }, hasTouch:false });
  try {
    await desktop.goto(url);
    assert.equal(await desktop.evaluate(() => narrowLayout.matches), false);
    assert.equal(await desktop.locator('#mobilebar').isVisible(), false);
    await desktop.locator('#hero-input').waitFor();
    await desktop.setViewportSize({width:600, height:740});
    await desktop.locator('.phone-home').waitFor();
    await desktop.setViewportSize({width:844, height:390});
    await desktop.locator('#hero-input').waitFor();
    console.log('PASS phone touch targets, sheets and tab grid at 320/360/390 and rotated 844×390; desktop resize');
  } finally {
    await desktop.close();
  }
};
