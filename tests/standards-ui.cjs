'use strict';
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function checkStandards(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(resolve('tests/fixtures/standards.html')).href);
    const results = await page.evaluate(() => window.__results);
    assert.equal(results.hostname, 'xn--r8jz45g.xn--zckzah');
    assert.equal(results.param, '2');
    assert.equal(results.intl, '1.234,5');
    assert.equal(results.dialog, 'function');
    assert.equal(results.resize, 'function');
    assert.equal(results.animate, 'function');
    assert.equal(results.grid, 'grid');
    assert.equal(results.logical, '12px');
    assert.equal(results.supports, true);
    assert.equal(results.formValid, false);
    assert.equal(results.storage, 'ok');
    await page.fill('#form [name="q"]', 'answer');
    assert.equal(await page.evaluate(() => document.getElementById('form').checkValidity()), true);
    assert.equal(await page.evaluate(() => { const d = document.getElementById('dialog'); d.showModal(); return d.open; }), true);
    assert.equal(await page.evaluate(() => { document.getElementById('dialog').close(); return document.getElementById('dialog').open; }), false);
    console.log('PASS standards corpus: URL, Intl, dialog, grid, logical properties, form validation and storage');
  } finally {
    await page.close();
  }
};
