'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Ledger } = require('../chrome/reward-ledger.js');

test('funded allocations post balanced immutable entries', () => {
  const ledger = new Ledger();
  ledger.fundAllocation(1000, 'collected', 'fund-1');
  assert.equal(ledger.balances.cash, -1000);
  assert.equal(ledger.balances.pool, 1000);
  ledger.allocate(600, 'alloc-1');
  ledger.settle(600, 'settle-1');
  assert.equal(ledger.balances.pending, 0);
  assert.equal(ledger.balances.available, 600);
  assert.equal(Object.values(ledger.balances).reduce((a, b) => a + b, 0), 0);
  const duplicate = ledger.fundAllocation(1000, 'collected', 'fund-1');
  assert.equal(duplicate.duplicate, true);
  assert.equal(ledger.postings.length, 3);
  assert.throws(() => ledger.fundAllocation(500, 'collected', 'fund-1'), /different entries/);
});

test('unbalanced, unknown and uncollected funding are rejected', () => {
  const ledger = new Ledger();
  assert.throws(() => ledger.post({ id: 'bad', entries: [
    { account: 'cash', direction: 'debit', amount: 10 },
    { account: 'pool', direction: 'credit', amount: 9 },
  ] }), /not balanced/);
  assert.throws(() => ledger.post({ id: 'u', entries: [
    { account: 'cash', direction: 'debit', amount: 10 },
    { account: 'nope', direction: 'credit', amount: 10 },
  ] }), /Unknown account/);
  assert.throws(() => ledger.post({ id: 'n', entries: [
    { account: 'cash', direction: 'debit', amount: -1 },
    { account: 'pool', direction: 'credit', amount: -1 },
  ] }), /positive/);
  assert.throws(() => ledger.fundAllocation(100, 'invoiced', 'inv'), /collected net revenue/);
});

test('duplicate-safe payouts require provider approval and evidence', () => {
  const ledger = new Ledger();
  ledger.fundAllocation(1000, 'collected', 'fund');
  ledger.allocate(1000, 'alloc');
  ledger.settle(1000, 'settle');
  assert.throws(() => ledger.reservePayout(400, 'pay-1'), /Provider approval/);
  ledger.approveProvider(true);
  const first = ledger.reservePayout(400, 'pay-1');
  assert.equal(first.duplicate, false);
  assert.equal(ledger.balances.available, 600);
  assert.equal(ledger.balances.reserved, 400);
  const duplicate = ledger.reservePayout(400, 'pay-1');
  assert.equal(duplicate.duplicate, true);
  assert.throws(() => ledger.reservePayout(500, 'pay-1'), /different amount/);
  assert.throws(() => ledger.completePayout('pay-1', ''), /evidence/);
  const paid = ledger.completePayout('pay-1', 'provider-evt-1');
  assert.equal(paid.payout.state, 'paid');
  assert.equal(ledger.balances.paid, 400);
  assert.equal(ledger.completePayout('pay-1', 'provider-evt-1').duplicate, true);
  assert.throws(() => ledger.completePayout('pay-1', 'provider-evt-2'), /different evidence/);
  assert.throws(() => ledger.failPayout('pay-1'), /cannot be released/);
});

test('failed payouts release the reservation and cannot reuse paid evidence', () => {
  const ledger = new Ledger();
  ledger.fundAllocation(1000, 'collected', 'fund');
  ledger.allocate(1000, 'alloc');
  ledger.settle(1000, 'settle');
  ledger.approveProvider(true);
  ledger.reservePayout(200, 'pay-fail');
  const released = ledger.failPayout('pay-fail', 'destination rejected');
  assert.equal(released.payout.state, 'released');
  assert.equal(ledger.balances.reserved, 0);
  assert.equal(ledger.balances.available, 1000);
  assert.equal(ledger.failPayout('pay-fail').duplicate, true);
  assert.equal(Object.values(ledger.balances).reduce((a, b) => a + b, 0), 0);
});


test('P38 records provider and policy gaps instead of claiming production', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const doc = readFileSync(resolve(__dirname, '../docs/REWARD-LEDGER.md'), 'utf8');
  if (!/Provider approval \| \*\*Missing\*\*/.test(doc)) throw new Error('provider gap missing');
  if (!/Gate met \| \*\*Partially\*\*/.test(doc)) throw new Error('gate status missing');
  const phases = readFileSync(resolve(__dirname, '../docs/PHASES.csv'), 'utf8');
  if (!/P38,Reward ledger and payout integration/.test(phases)) throw new Error('phase row missing');
});
