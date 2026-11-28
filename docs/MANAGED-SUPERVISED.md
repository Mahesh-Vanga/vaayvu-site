# Managed and supervised browsing (P34)

P34 covers transparent authorized policies, isolation and safe exit. A signed
policy contract and tests exist; no MDM/GPO runtime is wired.

## Policy contract

`chrome/managed-policy.js`:

- versioned policy with issuer, issue/expiry, profile scope, rules and HMAC
  signature;
- **every rule is disclosed** in the summary; no hidden rules;
- expired, future-dated, wrong-key, tampered, oversized or malformed policies
  are rejected;
- a policy applies only to its scoped profile; other profiles are unaffected;
- maximum 64 rules with bounded labels/values.

The policy is an HMAC-signed object verified with an authorized key. Production
MDM ingestion, key distribution and GPO/plist parsing are **not implemented**.

## Isolation

- Scoped policies do not cross profiles (`appliesTo`).
- Private and regular profiles keep separate sessions/stores (P19/P21/P22).
- Android profiles and Apple stores remain separate.
- Family/supervision and enterprise screens are contracts; no hidden profile
  merge.

## Safe exit

`exitDecision`:

- ordinary browsing exits normally;
- supervised mode accepts a guardian authorization or the correct supervision
  PIN;
- a wrong/empty PIN is refused;
- the refusal states that the **device owner can still remove the app at the OS
  level** — the browser does not trap the user.

Kiosk screen `s-248` validates URL, allowlist, 4-digit PIN and exit; the state is
tested.

## Transparency

- The policy summary shows issuer, scope, expiry and every rule.
- No covert installation: supervised setup screens require guardian consent and
  reject covert install/monitoring (P12/P34 screens).
- Managed state must be visible; a hidden policy is a test failure.

## Exit gate

| Gate item | State |
|---|---|
| Transparent authorized policies | **Green** at contract level |
| Isolation | **Green** for profile scope + sessions |
| Safe exit | **Green** (guardian/PIN, no trap) |
| MDM/GPO runtime | **Gap** — screens/reference only |
| Gate met | **Yes, locally** for the contract |

P34's named gate is green at the contract level. Real managed deployment still
needs an MDM/GPO ingestion and key-distribution implementation.
