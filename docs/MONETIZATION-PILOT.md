# Monetization pilot and continuing assurance (P39)

P39 is the revenue pilot gate. There is **no approved rollout and no measured
economics**. The decision is **blocked**.

## Current state

| Item | State |
|---|---|
| Rollout stage | **none** (0%) |
| Product/legal/security/privacy approvals | missing |
| P35 release | **no-go** |
| P36 policy | **blocked** |
| P37 campaign | **blocked** |
| P38 ledger/provider | **blocked** |
| Reconciliation | pending |
| Kill switch | implemented/tested, Rasha unaffected |
| Support ownership/SLA | draft, no SLA |
| Economics | **unmeasured** |

## Rollout stages

| Stage | Entry gate |
|---|---|
| Internal | signed build, rollback, all approvals |
| 1% | reconciliation pass + economics dashboard |
| 5% | 1% stable for a full window |
| 25% | 5% stable, support load bounded |
| 100% | 25% stable, security sign-off |

Promotion pauses automatically if any approval, reconciliation, support or
economics check is missing. `scripts/pilot-check.cjs` enforces this.

## Reconciliation

- source must be **collected net revenue**;
- the pilot must match invoices, collections, refunds and verified impressions;
- no uncollected invoiced revenue can fund rewards;
- status remains `pending` until an actual run is recorded.

## Incident kill switch

- `a-031` stops a campaign and revokes signed creative eligibility;
- Rasha protection stays enabled;
- audit history is preserved;
- no rollback weakness (tested).

Kill switch is ready; it is not evidence of a pilot.

## User support

- `a-017` reward appeals and `a-030` payout operations are contracts;
- no support SLA, staffing or live queue exists.

## Monitored economics

The plan lists funded pool, collected revenue, verified impressions, payouts and
fees. **None are measured** — `values` is null and `monitored` is false. No
invented revenue or impression numbers are published.

## Exit gate

| Gate item | State |
|---|---|
| Limited approved rollout | **No** |
| Reconciliation | **Pending** |
| Incident kill switch | **Green** (tested) |
| User support | **Draft, no SLA** |
| Monitored economics | **No** |
| Gate met | **No** |

P39 stays blocked until P35–P38 approvals, a reconciliation run, support
ownership and real monitored economics exist.
