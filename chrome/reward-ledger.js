'use strict';
/**
 * Reference reward ledger: balanced immutable postings, funded allocations,
 * reserved payouts and idempotent provider settlement. No provider is wired.
 */
const VaayvuRewardLedger = (() => {
  const ACCOUNTS = ['cash', 'pool', 'pending', 'available', 'reserved', 'paid', 'fees'];
  const clean = (value, max) => String(value ?? '').trim().slice(0, max);

  class Ledger {
    constructor() {
      this.balances = Object.fromEntries(ACCOUNTS.map((account) => [account, 0]));
      this.postings = [];
      this.byId = new Map();
      this.payouts = new Map();
      this.providerApproved = false;
    }

    approveProvider(approved) {
      this.providerApproved = approved === true;
      return this.providerApproved;
    }

    post({ id, kind, entries }) {
      const postingId = clean(id, 80);
      if (!postingId) throw new Error('Posting id is required.');
      if (this.byId.has(postingId)) {
        const existing = this.byId.get(postingId);
        const same = JSON.stringify(existing.entries) === JSON.stringify(entries);
        if (!same) throw new Error('Posting id reused with different entries.');
        return { duplicate: true, posting: existing };
      }
      if (!Array.isArray(entries) || !entries.length) throw new Error('Posting needs entries.');
      let debit = 0, credit = 0;
      const normalized = entries.map((entry) => {
        const account = clean(entry.account, 24);
        if (!ACCOUNTS.includes(account)) throw new Error('Unknown account: ' + account);
        const amount = Number(entry.amount);
        if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Amounts must be positive integer units.');
        if (entry.direction === 'debit') debit += amount;
        else if (entry.direction === 'credit') credit += amount;
        else throw new Error('Direction must be debit or credit.');
        return { account, direction: entry.direction, amount };
      });
      if (debit !== credit) throw new Error('Posting is not balanced.');
      for (const entry of normalized) {
        this.balances[entry.account] += entry.direction === 'credit' ? entry.amount : -entry.amount;
      }
      const posting = { id: postingId, kind: clean(kind, 40) || 'posting', entries: normalized, at: Date.now() };
      this.postings.push(posting);
      this.byId.set(postingId, posting);
      return { duplicate: false, posting };
    }

    fundAllocation(amount, source, id = 'fund-' + Date.now()) {
      if (source !== 'collected') throw new Error('Only collected net revenue can fund rewards.');
      return this.post({ id, kind: 'funding', entries: [
        { account: 'cash', direction: 'debit', amount },
        { account: 'pool', direction: 'credit', amount },
      ] });
    }

    allocate(amount, id = 'allocate-' + Date.now()) {
      return this.post({ id, kind: 'allocation', entries: [
        { account: 'pool', direction: 'debit', amount },
        { account: 'pending', direction: 'credit', amount },
      ] });
    }

    settle(amount, id = 'settle-' + Date.now()) {
      return this.post({ id, kind: 'settlement', entries: [
        { account: 'pending', direction: 'debit', amount },
        { account: 'available', direction: 'credit', amount },
      ] });
    }

    reservePayout(amount, key) {
      const payoutKey = clean(key, 80);
      if (!payoutKey) throw new Error('Payout idempotency key is required.');
      if (this.payouts.has(payoutKey)) {
        const existing = this.payouts.get(payoutKey);
        if (existing.amount !== amount) throw new Error('Payout key reused with a different amount.');
        return { duplicate: true, payout: existing };
      }
      if (!this.providerApproved) throw new Error('Provider approval is required for payouts.');
      if (this.balances.available < amount) throw new Error('Insufficient available balance.');
      const posting = this.post({ id: 'reserve-' + payoutKey, kind: 'payout-reserve', entries: [
        { account: 'available', direction: 'debit', amount },
        { account: 'reserved', direction: 'credit', amount },
      ] });
      const payout = { key: payoutKey, amount, state: 'reserved', postingId: posting.posting.id };
      this.payouts.set(payoutKey, payout);
      return { duplicate: false, payout };
    }

    completePayout(key, providerEventId) {
      const payout = this.payouts.get(clean(key, 80));
      if (!payout) throw new Error('Unknown payout.');
      if (!clean(providerEventId, 120)) throw new Error('Provider evidence is required.');
      if (payout.state === 'paid') {
        if (payout.providerEventId !== providerEventId) throw new Error('Payout already settled with different evidence.');
        return { duplicate: true, payout };
      }
      if (payout.state !== 'reserved') throw new Error('Payout cannot be completed from ' + payout.state + '.');
      this.post({ id: 'paid-' + payout.key, kind: 'payout-paid', entries: [
        { account: 'reserved', direction: 'debit', amount: payout.amount },
        { account: 'paid', direction: 'credit', amount: payout.amount },
      ] });
      payout.state = 'paid';
      payout.providerEventId = clean(providerEventId, 120);
      return { duplicate: false, payout };
    }

    failPayout(key, reason = 'provider failure') {
      const payout = this.payouts.get(clean(key, 80));
      if (!payout) throw new Error('Unknown payout.');
      if (payout.state === 'paid') throw new Error('Paid payout cannot be released.');
      if (payout.state === 'released') return { duplicate: true, payout };
      this.post({ id: 'release-' + payout.key, kind: 'payout-release', entries: [
        { account: 'reserved', direction: 'debit', amount: payout.amount },
        { account: 'available', direction: 'credit', amount: payout.amount },
      ] });
      payout.state = 'released';
      payout.reason = clean(reason, 200);
      return { duplicate: false, payout };
    }

    snapshot() {
      return { balances: { ...this.balances }, postings: this.postings.length, payouts: [...this.payouts.values()].map((p) => ({ ...p })) };
    }
  }

  return { ACCOUNTS, Ledger };
})();
if (typeof module !== 'undefined') module.exports = VaayvuRewardLedger;
