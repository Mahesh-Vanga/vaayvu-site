# First-party campaign and consent implementation (P37)

P37 covers signed creatives, explicit ads consent, independent Rasha and zero
unauthorized placements. The fixture/policy layer is green; P36 approval and a
campaign runtime are still missing.

## Signed creatives

`chrome/campaign.js`:

- canonical creative: id, advertiser, title, HTTPS destination, owned placement,
  version;
- HMAC-SHA256 signature with an authorized campaign key;
- tampered title/destination or unsigned creative is rejected;
- HTTPS-only destination with no embedded credentials;
- no signed creative means no card.

## Explicit consent

- ads consent must be `true`; rewards enrollment does **not** imply ads consent;
- ads consent does not imply rewards enrollment;
- private tabs never receive sponsored cards;
- no personalization or sensitive targeting (P36 policy).

## Independent Rasha

| Combination | Result |
|---|---|
| Ads off, Rasha on | Rasha stays enabled |
| Ads on, Rasha off | Ads do not enable Rasha |
| Either switch | No coupling |

Kill switch stops ads while leaving Rasha protections active (`a-031`).

## Zero unauthorized placement fixtures

Allowed placements are an explicit owned allowlist (`sp-01`). Any other ID is
rejected with a reason. Tests cover:

- third-party placement rejected;
- tampered creative rejected;
- unsigned creative rejected;
- consent missing rejected;
- private tab rejected;
- daily cap (3) rejected without recording an impression.

Ads screens `a-001`–`a-032` are audited and tested, but they are contracts.

## Exit gate

| Gate item | State |
|---|---|
| Signed creatives | **Green** at fixture contract |
| Explicit consent | **Green** |
| Independent Rasha | **Green** |
| Zero unauthorized placements | **Green** |
| P36 approval | **Pending** |
| Campaign runtime | **Gap** |
| Gate met | **Partially** — technical fixtures green, approval/runtime missing |

P37 cannot be a production implementation while P36 has no approvals or
jurisdiction decision.
