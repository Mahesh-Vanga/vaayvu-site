'use strict';
/**
 * First-party campaign contract: signed creatives, explicit ads consent,
 * owned-placement allowlist, frequency cap and Rasha independence.
 * Reference policy layer; no campaign runtime is wired.
 */
const VaayvuCampaign = (() => {
  let crypto = null;
  try { crypto = require('node:crypto'); } catch {}

  const MAX_FREQUENCY = 3;
  const OWNED = new Set(['sp-01']);
  const clean = (value, max) => String(value ?? '').trim().slice(0, max);

  function canonical(creative) {
    return JSON.stringify({
      id: clean(creative.id, 64),
      advertiser: clean(creative.advertiser, 120),
      title: clean(creative.title, 200),
      destination: clean(creative.destination, 8192),
      placement: clean(creative.placement, 64),
      version: Number(creative.version) || 0,
    });
  }

  function signCreative(creative, key) {
    if (!crypto) throw new Error('Signing needs a crypto provider.');
    if (typeof key !== 'string' || key.length < 16) throw new Error('Use an authorized campaign key.');
    return crypto.createHmac('sha256', key).update(canonical(creative)).digest('hex');
  }

  function verifyCreative(creative, key) {
    if (!creative || typeof creative !== 'object') return false;
    if (!clean(creative.id, 64) || !clean(creative.advertiser, 120) || !clean(creative.title, 200)) return false;
    try {
      const url = new URL(creative.destination);
      if (!['https:'].includes(url.protocol) || url.username || url.password) return false;
    } catch { return false; }
    if (typeof key !== 'string' || key.length < 16) return false;
    let expected = '';
    try { expected = signCreative(creative, key); } catch { return false; }
    const actual = String(creative.signature || '');
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }

  function consentDecision({ adsConsent = false, rewardsConsent = false, privateTab = false } = {}) {
    if (privateTab) return { allowed: false, reason: 'Private tabs never receive sponsored cards.' };
    if (adsConsent !== true) return { allowed: false, reason: 'Sponsored cards need explicit consent.' };
    return { allowed: true, rewardsConsent: rewardsConsent === true, reason: '' };
  }

  function placementDecision(placement, approved = OWNED) {
    const id = clean(placement, 64);
    return approved.has(id)
      ? { allowed: true, reason: '' }
      : { allowed: false, reason: 'Unauthorized placement ' + (id || '(missing)') + ' cannot serve.' };
  }

  function rashaIndependent({ adsEnabled = false, rashaEnabled = true } = {}) {
    return {
      adsWithoutRasha: adsEnabled === true && rashaEnabled === false,
      rashaWithoutAds: rashaEnabled === true && adsEnabled === false,
      note: 'Ads and Rasha are independent switches.',
    };
  }

  function eligible({ creative, key, consent, placement, impressionsToday = 0, privateTab = false } = {}) {
    if (privateTab) return { eligible: false, reason: 'Private tab.' };
    const signed = verifyCreative(creative, key);
    if (!signed) return { eligible: false, reason: 'Creative is not signed by an authorized key.' };
    const place = placementDecision(placement || creative?.placement);
    if (!place.allowed) return { eligible: false, reason: place.reason };
    const decision = consentDecision({ adsConsent: consent === true, privateTab });
    if (!decision.allowed) return { eligible: false, reason: decision.reason };
    if (Number(impressionsToday) >= MAX_FREQUENCY) return { eligible: false, reason: 'Daily frequency cap reached; no impression recorded.' };
    return { eligible: true, reason: '' };
  }

  return { MAX_FREQUENCY, OWNED, canonical, signCreative, verifyCreative, consentDecision, placementDecision, rashaIndependent, eligible };
})();
if (typeof module !== 'undefined') module.exports = VaayvuCampaign;
