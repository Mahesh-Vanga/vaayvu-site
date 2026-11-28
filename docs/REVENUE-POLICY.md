# Own inventory and rewards policy contracts (P36)

P36 requires approved inventory ownership, direct advertiser terms, a privacy
model and a jurisdiction decision. The contracts are drafted; **approvals and
the jurisdiction decision are pending**, so the gate is not met.

## Inventory ownership

| Item | State |
|---|---|
| Owned inventory only | Drafted: VAAYVU start page (`sp-01`) |
| Third-party publisher inventory | Explicitly off |
| Resale | Explicitly off |
| Advertiser submission | Direct advertisers only |
| Placement registry | `a-025` contract + owned proof |

No third-party publisher inventory is claimed. An advertiser cannot resell or
swap placement.

## Direct advertiser terms

Draft `v1-draft` requires:

- business verification and authorized roles (`a-020`);
- direct advertiser relationship, no resale;
- contract version recorded;
- clear “Sponsored” disclosure;
- independent creative review (`a-023`);
- budget/pacing and verified-impression charging (`a-024`);
- kill switch without weakening Rasha (`a-031`).

Legal approval is **pending**.

## Privacy model

- Sponsored cards consent is separate from rewards enrollment.
- Rewards enrollment is separate from ads.
- No personalization without consent.
- No sensitive traits, history/profile targeting, or private-page use.
- Browsing and Rasha never require identity or rewards enrollment.
- Payout identity remains in the provider flow; browser stores minimal status.

Privacy approval is **pending**.

## Jurisdiction decision

`docs/revenue-policy.json`:

```json
{"jurisdiction":{"decision":null,"approvedRegions":[],"payoutRails":[],"status":"pending"}}
```

No country/region, payout rail, age policy or tax treatment is approved. Payout
and enrollment features must treat this as **ineligible** until a decision is
recorded.

## Approval status

| Role | Approved |
|---|---|
| Product owner | **No** |
| Legal | **No** |
| Security | **No** |
| Privacy | **No** |

`scripts/revenue-policy-check.cjs` refuses to call the policy approved while any
role, jurisdiction or region is missing.

## Exit gate

| Gate item | State |
|---|---|
| Approved inventory ownership | **Drafted; pending approval** |
| Direct advertiser terms | **Drafted; pending legal** |
| Privacy model | **Drafted; pending privacy approval** |
| Jurisdiction decision | **Pending** |
| Gate met | **No** |

P36 stays unverified until the owner/legal/privacy/security approvals and a
jurisdiction decision exist. The draft is safe-by-default: owned-only, no
resale, consent-separated and no sensitive targeting.
