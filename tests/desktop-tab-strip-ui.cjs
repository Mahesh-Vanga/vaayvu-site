'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const shell = pathToFileURL(path.resolve(__dirname, '../chrome/index.html')).href;
async function checkDesktop(browser, platform) {
  const page = await browser.newPage({ viewport: { width: 1190, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((platform) => {
    window.hostMenus = [];
    window.titlebarReports = [];
    window.VaayvuNative = { postMessage(json) {
      const message = JSON.parse(json);
      if (message.type === 'ready') queueMicrotask(() => vaayvuEvent({ type: 'ready', platform, chromiumDesktop: true, canTabBarMenu: true, canSampleTabMemory: true }));
      if (message.type === 'tabBarMenu') hostMenus.push(message);
      if (message.type === 'titlebarTabs') titlebarReports.push(message);
      if (message.type === 'sampleTabMemory') {
        window.lastSample = message;
        const samples = Object.fromEntries(message.ids.map(id => [id, {pid: 31, bytes: 50 * 1048576}]));
        queueMicrotask(() => vaayvuEvent({type: 'tabMemory', requestId: message.requestId, samples}));
      }
      if (message.type === 'open')
        queueMicrotask(() => vaayvuEvent({ type: 'page', id: message.id, title: 'Example', url: message.url, loading: false }));
    } };
  }, platform);
  await page.goto(shell);
  const strip = page.locator('#top-tabs');
  const actions = strip.getByRole('button', { name: 'Tab bar actions' });
  await actions.waitFor();
  assert.equal(await strip.evaluate((el) => el.getBoundingClientRect().y), 0);
  if (platform === 'mac')
    assert.equal(await page.evaluate(() => titlebarReports.at(-1).height), (await strip.boundingBox()).height);
  const nav = page.getByRole('navigation', { name: 'Library' });
  for (const name of ['Start page', 'Bookmarks', 'History', 'Other devices'])
    assert.equal(await nav.getByRole('button', {name, exact: true}).isVisible(), true);
  assert.equal(await page.locator('#rail').evaluate((el) => el.offsetWidth), 68);
  const brand = page.locator('#compact-space-menu img');
  await brand.evaluate(img => img.decode());
  assert.equal(await brand.getAttribute('src'), 'assets/vaayvu.svg');
  const brandBounds = await brand.boundingBox();
  assert.deepEqual([brandBounds.width, brandBounds.height], [27, 27]);
  const tabLogo = strip.locator('[data-select] > img.tab-brand');
  assert.equal(await tabLogo.getAttribute('src'), 'assets/vaayvu.svg');
  const tabLogoBounds = await tabLogo.boundingBox();
  assert.deepEqual([tabLogoBounds.width, tabLogoBounds.height], [14, 14]);
  await page.locator('#compact-space-menu').click();
  assert.equal(await page.locator('#dialog').evaluate((el) => el.open), true);
  await page.locator('#dialog [aria-label="Close dialog"]').click();

  await strip.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.locator('#address').fill('https://example.org/');
  await page.locator('#address').press('Enter');
  await page.waitForFunction(() => current().url === 'https://example.org/');
  assert.equal(await strip.locator('.chosen .tab-brand').count(), 0);
  assert.equal(await tabLogo.count(), 1);
  const visibleTabs = await strip.locator('[data-tab-row]').count();
  const blank = await page.evaluate(() => {
    const add = document.querySelector('.strip-new').getBoundingClientRect();
    return { x: Math.round(add.right + 12), y: Math.round(add.y + add.height / 2) };
  });
  await page.mouse.dblclick(blank.x, blank.y);
  await page.mouse.click(blank.x, blank.y, {button: 'right'});
  assert.deepEqual(await page.evaluate(() => hostMenus), Array(2).fill({
    type: 'tabBarMenu', position: 'top', canBookmark: true, searchPinned: true, ...blank,
  }));
  assert.equal(await strip.locator('[data-tab-row]').count(), visibleTabs);
  await actions.focus();
  await actions.press('Enter');
  const expected = await actions.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
  });
  assert.deepEqual(await page.evaluate(() => [hostMenus.at(-1).x, hostMenus.at(-1).y]), expected);
  await strip.locator('[data-tab-row]').first().click({button: 'right'});
  assert.equal(await page.evaluate(() => hostMenus.length), 3);
  assert.equal(await page.locator('#dialog').evaluate(el => el.open), true);
  await page.locator('#dialog [aria-label="Close dialog"]').click();

  const act = (command) => page.evaluate((command) => vaayvuEvent({type: 'command', command}), command);
  await act('position-bottom');
  assert.equal(await strip.evaluate(el => el.getBoundingClientRect().bottom), 760);
  let toolbar = await page.locator('#toolbar').boundingBox();
  assert.equal(toolbar.y, 0);
  if (platform === 'mac') {
    assert.ok(await page.locator('.sidebar-open').evaluate((el) => el.getBoundingClientRect().x >= 78));
    assert.ok(toolbar.height >= 56);
    assert.equal(await page.evaluate(() => titlebarReports.at(-1).height), toolbar.height);
  }
  await act('toggleTabSearch');
  assert.equal(await page.locator('#pinned-tab-search').isVisible(), false);
  const stableIds = await page.evaluate(() => tabs.map((tab) => tab.id));
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.tabPosition === 'bottom');
  assert.deepEqual(await page.evaluate(() => tabs.map((tab) => tab.id)), stableIds, 'tab ids survive reload');
  assert.equal(await strip.locator('[data-tab-row]').count(), visibleTabs);
  assert.equal(await page.locator('#pinned-tab-search').isVisible(), false);
  for (const position of ['left', 'right']) {
    await act('position-' + position);
    assert.equal(await strip.isVisible(), false);
    const rail = await page.locator('#rail').boundingBox();
    assert.equal(rail.x, 0);
    assert.equal(rail.width, 68);
    const sideTabs = await page.locator('#side-tabs').boundingBox();
    if (position === 'left') assert.equal(sideTabs.x, rail.width);
    else assert.equal(sideTabs.x + sideTabs.width, 1190);
    assert.equal(await page.locator('#side-tabs [data-tab-row]').count(), visibleTabs);
    assert.equal(await page.locator('#side-tabs .tab-brand').count(), 1);
    const menu = page.locator('#vertical-tab-actions');
    if (platform === 'mac')
      assert.equal(await page.evaluate(() => titlebarReports.at(-1).height), (await page.locator('#toolbar').boundingBox()).height);
    assert.equal(await menu.isVisible(), true);
    await menu.click();
    assert.equal(await page.evaluate(() => hostMenus.at(-1).position), position);
  }
  await act('position-top');
  for (const width of [700, 530]) {
    await page.setViewportSize({ width, height: 720 });
    await actions.waitFor();
    assert.equal(await page.locator('#mobilebar').isVisible(), false);
    assert.ok((await actions.boundingBox()).x < width);
    assert.equal(await page.locator('#rail').evaluate(el => !el.inert && el.getBoundingClientRect().x === 0), true);
    if (platform === 'mac') {
      const geometry = await strip.evaluate(el => ({
        inset: parseFloat(getComputedStyle(el).borderLeftWidth),
        underlying: document.elementFromPoint(54, 22)?.closest('[data-tab-row]')?.dataset.tabRow,
      }));
      assert.ok(geometry.inset >= 78, JSON.stringify({width, geometry}));
      assert.equal(geometry.underlying, undefined);
    }
    await act('position-right');
    assert.equal(await page.locator('#vertical-tab-actions').isVisible(), true);
    await act('position-top');
  }
  await page.setViewportSize({ width: 1190, height: 760 });
  await actions.waitFor();
  assert.equal(await strip.locator('[data-tab-row]').count(), visibleTabs);
  await act('performance');
  assert.equal(await page.getByRole('heading', {name: 'Task Manager'}).isVisible(), true);
  assert.equal(await page.getByText('50 MiB', {exact: true}).isVisible(), true);
  assert.equal(await page.getByText('Unloaded', {exact: true}).isVisible(), true);
  const firstRequest = await page.evaluate(() => lastSample.requestId);
  await page.getByRole('button', {name: 'Refresh memory'}).click();
  assert.notEqual(await page.evaluate(() => lastSample.requestId), firstRequest);
  await page.locator('#dialog [aria-label="Close dialog"]').click();
  await page.setViewportSize({width: 530, height: 720});
  for (let i = 0; i < 12; i++) await strip.locator('.strip-new').click();
  const list = page.locator('#strip-items');
  assert.ok(await list.evaluate(el => el.scrollWidth > el.clientWidth && el.scrollLeft > 0));
  const selected = await list.locator('.chosen').boundingBox();
  const add = await strip.locator('.strip-new').boundingBox();
  assert.ok(selected.x + selected.width <= add.x + 1 && add.x + add.width < 530);
  await strip.locator('.strip-new').focus();
  await page.evaluate(() => render(true));
  assert.equal(await strip.locator('.strip-new').evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VAAYVU_TEST_CHROME, headless: true });
  try {
    for (const platform of ['mac', 'windows']) await checkDesktop(browser, platform);
    console.log('Desktop tab strips, menu gestures, persisted settings and sidebar passed for Mac and Windows host layouts.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
