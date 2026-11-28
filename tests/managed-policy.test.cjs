'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../chrome/managed-policy.js');

const key = 'authorized-policy-key-123456';
function make(over = {}) {
  const base = {
    version: 1,
    id: 'policy-work-1',
    issuer: 'Acme IT',
    issuedAt: Date.now() - 1000,
    expiresAt: Date.now() + 86400000,
    scope: { profileId: 'work' },
    rules: [
      { id: 'home', label: 'Startup page', value: 'https://intranet.example/' },
      { id: 'extensions', label: 'Extensions', value: 'blocked' },
    ],
    ...over,
  };
  return { ...base, signature: policy.sign(base, key) };
}

test('a signed scoped policy verifies and reveals every rule', () => {
  const record = make();
  const result = policy.verify(record, key);
  assert.equal(result.ok, true);
  assert.equal(result.summary.issuer, 'Acme IT');
  assert.equal(result.summary.scope, 'work');
  assert.equal(result.summary.rules.length, 2);
  assert.equal(policy.appliesTo(record, 'work'), true);
  assert.equal(policy.appliesTo(record, 'personal'), false);
});

test('tampered expired wrong-key and malformed policies are rejected', () => {
  const valid = make();
  assert.equal(policy.verify({ ...valid, issuer: 'Attacker' }, key).ok, false);
  assert.equal(policy.verify({ ...valid, rules: [{ id: 'x', label: 'Hidden', value: 'on' }] }, key).ok, false);
  assert.equal(policy.verify(valid, 'different-policy-key-999').ok, false);
  assert.equal(policy.verify(make({ expiresAt: Date.now() - 1 }), key).ok, false);
  assert.equal(policy.verify(make({ version: 2 }), key).ok, false);
  assert.equal(policy.verify(make({ rules: Array.from({ length: 65 }, (_, i) => ({ id: 'r' + i, label: 'r', value: 'v' })) }), key).ok, false);
  assert.equal(policy.verify(make({ issuedAt: Date.now() + 600000 }), key).ok, false);
});

test('safe exit never traps the owner and requires guardian or PIN when supervised', () => {
  assert.deepEqual(policy.exitDecision({ supervised: false }), { allowed: true, reason: 'Ordinary browsing can be left normally.' });
  assert.equal(policy.exitDecision({ supervised: true, code: '1234', expected: '9999' }).allowed, false);
  assert.equal(policy.exitDecision({ supervised: true, code: '', expected: '9999' }).allowed, false);
  assert.equal(policy.exitDecision({ supervised: true, code: '9999', expected: '9999' }).allowed, true);
  assert.equal(policy.exitDecision({ supervised: true, guardian: true }).allowed, true);
  assert.match(policy.exitDecision({ supervised: true }).reason, /OS level/);
});
