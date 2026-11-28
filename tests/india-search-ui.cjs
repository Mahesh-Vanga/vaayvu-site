'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

module.exports = async function checkIndiaSearch(browser) {
  const fresh = await browser.newPage();
  await fresh.addInitScript(() => {
    window.events = [];
    window.VaayvuNative = { postMessage(raw) {
      const event = JSON.parse(raw);
      events.push(event);
      if (event.type === 'ready') queueMicrotask(() => vaayvuEvent({type:'ready', platform:'mac', privateSupported:true}));
    }};
  });
  try {
    await fresh.goto(pathToFileURL(resolve('chrome/index.html')).href);
    await fresh.waitForFunction(() => window.events?.some(m => m.type === 'websiteAccess' && m.enabled));
    const input = fresh.locator('#address');
    for (const [provider, host] of [['duckduckgo','duckduckgo.com'], ['google','www.google.com'], ['bing','www.bing.com']]) {
      if (provider !== 'duckduckgo') {
        await fresh.evaluate(() => command('pref-search'));
        await fresh.locator('#preference-searchProvider').selectOption(provider);
        await fresh.evaluate(() => closeDialog());
      }
      const query = provider + ' café & भारत + weather';
      await input.fill(query);
      assert.equal(await fresh.evaluate(q => events.some(event => JSON.stringify(event).includes(q)), query), false);
      await input.press('Enter');
      const target = new URL(await fresh.evaluate(() => events.filter(m => m.type === 'open' || m.type === 'navigate').at(-1).url));
      assert.equal(target.hostname, host);
      assert.deepEqual([...target.searchParams], [['q',query]]);
      assert.equal(await fresh.evaluate(() => JSON.stringify(localStorage).includes('?q=')), false);
    }
    await input.fill('wikipedia.org');
    await input.press('Enter');
    assert.equal(await fresh.evaluate(() => current().url), 'https://wikipedia.org/');
    assert.equal(await fresh.evaluate(() => events.some(m => m.type === 'indiaSearch')), false);
  } finally { await fresh.close(); }
  for (const platform of ['ios', 'android']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const traffic = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) traffic.push(request.url()); });
    await page.addInitScript(platform => {
      localStorage.setItem('vaayvu.settings', JSON.stringify({ ordinaryWeb:false, engine: 'Custom', customSearchURL: 'https://legacy.example/?q=%s' }));
      localStorage.setItem('vaayvu.tabs', JSON.stringify([
        {id:'oldtab',url:'https://legacy.example/?q=prior-search',title:'prior-search'},
        {id:'local-search',url:'',title:'Vaayvu Search',pinned:true},
      ]));
      window.sent = [];
      window.VaayvuNative = { postMessage(raw) {
        const m = JSON.parse(raw);
        sent.push(m);
        if (m.type === 'ready') queueMicrotask(() => vaayvuEvent({ type:'ready', platform, privateSupported: true }));
      } };
    }, platform);
    await page.goto(pathToFileURL(resolve('chrome/index.html')).href);
    assert.equal(await page.evaluate(() => current().url), '');
    assert.deepEqual(await page.evaluate(() => {
      const tab = tabs.find(t => t.id === 'local-search');
      return [tab.title, tab.pinned];
    }), ['Start page', true]);
    const box = page.locator('#address');
    const enter = async text => { await box.fill(text); await box.press('Enter'); };
    await enter('https://blocked.example/');
    await page.getByRole('heading', { name:'Open blocked.example?' }).first().waitFor();
    assert.equal(await page.evaluate(() => sent.some(m => m.type === 'open')), false);
    await page.evaluate(() => closeDialog());
    await enter('https://www.google.co.in/search?q=privacy-canary');
    await page.getByText(/search words stayed here/).waitFor();
    assert.equal(await page.getByRole('heading', {name:'Vaayvu Search', exact:true}).isVisible(), true);
    const logo = page.locator('.search-brand img');
    await logo.evaluate(img => img.decode());
    assert.equal(await logo.getAttribute('src'), 'assets/vaayvu.svg');
    assert.equal(await page.evaluate(() => sent.some(m => JSON.stringify(m).includes('privacy-canary'))), false);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('privacy-canary')), false);
    assert.equal(await page.evaluate(async () => {
      try { await VaayvuSync.authenticate('https://legacy.example', 'demo', 'password'); } catch (e) { return /paused/.test(e.message); }
    }), true);
    await page.evaluate(() => vaayvuEvent({type:'ready',platform:'ios',canIndiaSearch:true,privateSupported:true}));
    await enter('old-canary');
    await enter('second-canary');
    const requests = await page.evaluate(() => sent.filter(m => m.type === 'indiaSearch'));
    assert.deepEqual(requests.map(m => m.q), ['old-canary','second-canary']);
    await page.evaluate(([old, active]) => {
      const results = [{title:'Reviewed result',url:'https://indexed.example/',snippet:'<b>plain text</b>'}];
      vaayvuEvent({type:'indiaSearchResult', id:old.id, requestId:old.requestId, results:[{...results[0],title:'Stale'}]});
      vaayvuEvent({type:'indiaSearchResult', id:'unrelated-tab', requestId:active.requestId, results:[]});
      vaayvuEvent({type:'indiaSearchResult', id:active.id, requestId:active.requestId, results});
    }, requests);
    await page.getByText('Reviewed result').click();
    assert.equal(await page.locator('.india-result b').count(), 0);
    assert.equal(await page.getByText('Stale', {exact:true}).count(), 0);
    await page.locator('#dialog [data-confirm-visit]').click();
    assert.equal(await page.evaluate(() => sent.filter(m => m.type === 'open').at(-1).userApprovedVisit), true);
    await page.evaluate(() => { closeTab(activeId); command('pref-search'); });
    await page.locator('#preference-ordinaryWeb').check();
    await page.evaluate(() => closeDialog());
    await page.getByText('Reviewed result').click();
    assert.equal(await page.evaluate(() => sent.filter(m => m.type === 'open').at(-1).url), 'https://indexed.example/');
    await page.evaluate(() => { command('pref-search'); });
    await page.locator('#preference-ordinaryWeb').uncheck();
    await page.evaluate(() => closeDialog());
    assert.equal(await page.evaluate(() => mounted.size), 0);
    await page.evaluate(() => { command('privateTab'); navigate('private-canary'); });
    assert.equal(await page.locator('#directory-form input').inputValue(), 'private-canary');
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('canary')), false);
    await page.evaluate(() => { command('closeTab'); vaayvuEvent({type:'accessibility',reduceMotion:true,reduceTransparency:true}); });
    assert.equal(await page.evaluate(() => document.body.matches('.reduce-motion.reduce-transparency')), true);
    assert.deepEqual(traffic, []);
    await page.close();
  }
  console.log('PASS both phones in restricted mode, no sync or external query fallback, stale and private search isolation, explicit web switch, accessibility');
};
