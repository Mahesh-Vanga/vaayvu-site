'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const campaign = require('../chrome/campaign.js');

const key = 'authorized-campaign-key-123456';
function creative(over = {}) {
  const base = {
    id: 'creative-1',
    advertiser: 'Acme Learning',
    title: 'Learn more',
    destination: 'https://acme.example/learn',
    placement: 'sp-01',
    version: 1,
    ...over,
  };
  return { ...base, signature: campaign.signCreative(base, key) };
}

test('only signed creatives on owned placements are eligible', () => {
  const card = creative();
  assert.equal(campaign.verifyCreative(card, key), true);
  assert.equal(campaign.eligible({ creative: card, key, consent: true, placement: 'sp-01', impressionsToday: 0 }).eligible, true);
  assert.equal(campaign.verifyCreative({ ...card, title: 'Tampered' }, key), false);
  assert.equal(campaign.eligible({ creative: { ...card, title: 'Tampered' }, key, consent: true, placement: 'sp-01' }).eligible, false);
  assert.equal(campaign.eligible({ creative: card, key, consent: true, placement: 'third-party-1' }).eligible, false);
  assert.match(campaign.placementDecision('third-party-1').reason, /Unauthorized placement/);
});

test('ads consent is explicit and separate from rewards', () => {
  const card = creative();
  assert.equal(campaign.consentDecision({ adsConsent: false, rewardsConsent: true }).allowed, false);
  assert.equal(campaign.consentDecision({ adsConsent: true, rewardsConsent: false }).allowed, true);
  assert.equal(campaign.consentDecision({ adsConsent: true, privateTab: true }).allowed, false);
  assert.equal(campaign.eligible({ creative: card, key, consent: false, placement: 'sp-01' }).eligible, false);
  assert.equal(campaign.eligible({ creative: card, key, consent: true, placement: 'sp-01', privateTab: true }).eligible, false);
});

test('Rasha is independent in both directions', () => {
  assert.deepEqual(campaign.rashaIndependent({ adsEnabled: false, rashaEnabled: true }), {
    adsWithoutRasha: false,
    rashaWithoutAds: true,
    note: 'Ads and Rasha are independent switches.',
  });
  assert.equal(campaign.rashaIndependent({ adsEnabled: true, rashaEnabled: false }).adsWithoutRasha, true);
});

test('the daily cap blocks without recording an impression', () => {
  const card = creative();
  const blocked = campaign.eligible({ creative: card, key, consent: true, placement: 'sp-01', impressionsToday: 3 });
  assert.equal(blocked.eligible, false);
  assert.match(blocked.reason, /frequency cap/);
  assert.equal(campaign.MAX_FREQUENCY, 3);
});


test('P37 records the P36 dependency and runtime gap', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const doc = readFileSync(resolve(__dirname, '../docs/CAMPAIGN-CONSENT.md'), 'utf8');
  if (!/P36 approvals|P36 approval/.test(doc)) throw new Error('approval gap missing');
  if (!/Gate met \| \*\*Partially\*\*/.test(doc)) throw new Error('gate status missing');
  const phases = readFileSync(resolve(__dirname, '../docs/PHASES.csv'), 'utf8');
  if (!/P37,First party campaign and consent implementation/.test(phases)) throw new Error('phase row missing');
});
