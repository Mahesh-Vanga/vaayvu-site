'use strict';
/**
 * Reference managed/supervised policy contract: signed, scoped, transparent and
 * safely exitable. It is not wired to an MDM/GPO runtime.
 */
const VaayvuManagedPolicy = (() => {
  let crypto = null;
  try { crypto = require('node:crypto'); } catch {}

  const MAX_RULES = 64;
  const REQUIRED = ['version', 'id', 'issuer', 'issuedAt', 'expiresAt', 'scope', 'rules', 'signature'];
  const clean = (value, max) => String(value ?? '').trim().slice(0, max);

  function canonical(policy) {
    return JSON.stringify({
      version: policy.version,
      id: policy.id,
      issuer: policy.issuer,
      issuedAt: policy.issuedAt,
      expiresAt: policy.expiresAt,
      scope: { profileId: policy.scope?.profileId ?? '' },
      rules: (policy.rules || []).map((rule) => ({ id: rule.id, label: rule.label, value: rule.value })),
    });
  }

  function sign(policy, key) {
    if (!crypto) throw new Error('Signing needs a crypto provider.');
    if (typeof key !== 'string' || key.length < 16) throw new Error('Use an authorized policy key.');
    return crypto.createHmac('sha256', key).update(canonical(policy)).digest('hex');
  }

  function verify(policy, key, { now = Date.now() } = {}) {
    if (!policy || typeof policy !== 'object') return { ok: false, reason: 'Policy is missing.' };
    for (const field of REQUIRED) if (policy[field] == null) return { ok: false, reason: 'Policy field missing: ' + field };
    if (policy.version !== 1) return { ok: false, reason: 'Unsupported policy version.' };
    if (typeof key !== 'string' || key.length < 16) return { ok: false, reason: 'Policy key is not authorized.' };
    if (!Number.isFinite(policy.issuedAt) || !Number.isFinite(policy.expiresAt)) return { ok: false, reason: 'Policy dates are invalid.' };
    if (policy.expiresAt <= now) return { ok: false, reason: 'Policy expired.' };
    if (policy.issuedAt > now + 300000) return { ok: false, reason: 'Policy is from the future.' };
    if (!Array.isArray(policy.rules) || policy.rules.length > MAX_RULES) return { ok: false, reason: 'Policy rule count is invalid.' };
    for (const rule of policy.rules) {
      if (!rule || !clean(rule.id, 64) || !clean(rule.label, 120) || typeof rule.value !== 'string' || rule.value.length > 512)
        return { ok: false, reason: 'Policy rule is malformed.' };
    }
    let expected = '';
    try { expected = sign(policy, key); } catch (error) { return { ok: false, reason: error.message }; }
    let actual = String(policy.signature || '');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
      return { ok: false, reason: 'Policy signature is not authorized.' };
    return { ok: true, reason: '', policy, summary: summarize(policy) };
  }

  function summarize(policy) {
    return {
      id: policy.id,
      issuer: policy.issuer,
      issuedAt: policy.issuedAt,
      expiresAt: policy.expiresAt,
      scope: policy.scope?.profileId || 'all profiles',
      rules: policy.rules.map((rule) => ({ id: rule.id, label: rule.label, value: rule.value })),
    };
  }

  function appliesTo(policy, profileId) {
    if (!policy || !policy.scope) return false;
    if (!policy.scope.profileId) return true;
    return policy.scope.profileId === profileId;
  }

  function exitDecision({ supervised = false, code = '', expected = '', guardian = false } = {}) {
    if (!supervised) return { allowed: true, reason: 'Ordinary browsing can be left normally.' };
    if (guardian === true) return { allowed: true, reason: 'Guardian authorized the exit.' };
    if (expected && code && clean(code, 40).length === clean(expected, 40).length &&
        crypto && crypto.timingSafeEqual(Buffer.from(clean(code, 40)), Buffer.from(clean(expected, 40))))
      return { allowed: true, reason: 'Supervision PIN accepted.' };
    return { allowed: false, reason: 'A guardian or supervision PIN is required; the device owner can still remove the app at the OS level.' };
  }

  return { MAX_RULES, canonical, sign, verify, summarize, appliesTo, exitDecision };
})();
if (typeof module !== 'undefined') module.exports = VaayvuManagedPolicy;
