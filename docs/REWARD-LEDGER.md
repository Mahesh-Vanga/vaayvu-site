# Reward ledger and payout integration (P38)

P38 covers funded allocations, balanced immutable postings, duplicate-safe
payouts and provider approval. The ledger contract is green; provider approval
and P36/P37 are missing.

## Funded allocations

- Only **collected net revenue** can fund a reward pool; invoiced/uncollected
  revenue is rejected.
- Funding posts debit `cash` / credit `pool`.
- Allocations move `pool → pending`; settlement moves `pending → available`.
- Available rewards never include uncollected money.

## Balanced immutable postings

`chrome/reward-ledger.js`:

- every posting must have positive integer units and equal debits/credits;
- unknown accounts and unbalanced entries are rejected;
- entries are append-only; there is no edit/delete path;
- posting IDs are idempotent: replay returns the same posting; reuse with
  different entries throws;
- sum of all account balances is zero after every successful posting.

## Duplicate-safe payment tests

- payout keys are idempotent; replay returns the same payout;
- reusing a key with a different amount throws;
- a payout requires provider approval and sufficient available balance;
- reservation moves `available → reserved`;
- completion requires provider evidence and moves `reserved → paid`;
- completing twice with the same evidence is a duplicate; different evidence
  throws;
- failed/returned payouts release `reserved → available`; a paid payout cannot
  be released.

## Provider approval

The ledger has an explicit `approveProvider(true)` gate. **No provider is
wired**, no payout rail is approved, and no jurisdiction decision exists (P36).
Production payouts must remain unavailable.

## Exit gate

| Gate item | State |
|---|---|
| Funded allocations | **Green** (collected-only) |
| Balanced immutable postings | **Green** |
| Duplicate-safe payment tests | **Green** |
| Provider approval | **Missing** |
| P36/P37 approval | **Missing/blocked** |
| Gate met | **Partially** — ledger contract green, provider/approval missing |

P38 cannot be production-ready without an approved provider, jurisdiction and
the P36/P37 policy chain.
