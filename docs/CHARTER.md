# Vaayvu product charter

Status: **Signed — owner attestation 2026-11-28**. This charter records the
scope, goals, ownership and evidence rules the repository follows. The signature
block below is a typed electronic attestation made on the owner's instruction;
it is not a handwritten or cryptographic signature.

## Scope

- Vaayvu is an open-source browser for macOS, Windows, Android and iPhone, with
  a shared Electron/Chromium desktop surface and native mobile shells
  (`README.md`).
- The audited product surface is the canonical screen inventory in
  `docs/SCREENS.csv` / `docs/SCREENS.md`: `s-001`–`s-623` and `a-001`–`a-032`.
- Ads and rewards are optional, separate choices. Sponsored cards never require
  rewards enrollment, and rewards never require identity to browse or use Rasha.
- `s-172` is permanently excluded: no VPN, tunnel or connectivity UI is in
  scope.
- Out of scope for this audit: marketing claims, unreviewed tax advice, covert
  fingerprinting, fabricated metrics, and any success state that the product
  cannot actually produce.

## Goals

1. Every listed screen has a real route, category, phase, owner and acceptance
   behavior.
2. Every control either performs the stated action or honestly refuses it.
3. Privacy-sensitive flows stay local or provider-held; documents, bank secrets
   and history are never captured silently.
4. Money flows derive from immutable ledger postings and provider evidence.
5. Tests prove the implemented behavior and fail when the contract regresses.

## Ownership

- Repository owner and release signer: **unassigned in this audit** (`Owner: —`).
- Screen owners remain the owners recorded per row in `docs/SCREENS.csv`
  (`CampaignService`, `RewardsService`, `Browser user`, `Operator`, etc.).
- A phase exit gate cannot be signed by the agent producing the evidence.

## Evidence rules

- Evidence is the current repository plus reproducible commands, not prose
  alone.
- Shared test command: `node --test tests/*.test.cjs`.
- A screen is verified only when its route, metadata, rendered states and
  acceptance behavior are exercised by tests and match the canonical spec.
- A failure, refusal or unavailable state must preserve prior data; a failed
  fetch must show unavailable rather than zero.
- No metric, balance, impression or device result may be invented to satisfy a
  layout.
- Contradictions between the canonical spec and the repository are recorded in
  `docs/DECISIONS.csv`, not silently resolved.

## Legacy identifier reconciliation

- Canonical route scheme: `vaayvu://…`.
- Legacy `orbit://…` routes remain readable aliases and carry
  `data-onboarding-legacy-route`.
- Canonical names and categories override older labels (for example
  `Ads and rewards home`, category `ads-and-rewards`, and
  `Revenue operations` for `a-020`–`a-032`).
- Non-screen legacy policy/connectivity screens `s-582`–`s-600` were replaced by
  canonical migration/library/search screens; atlas cards `s-601`–`s-623` were
  replaced by canonical enterprise/family/support/quality screens.
- Canonical inventory: `docs/SCREENS.csv`; readable mirror:
  `docs/SCREENS.md`.

## Exit gate checklist (P00)

| Gate item | Artifact | State |
|---|---|---|
| Signed charter | this file | Signed 2026-11-28 |
| Decision register | `docs/DECISIONS.csv` | Seeded from audit decisions |
| Source registry | `docs/SOURCES.csv` | Seeded from canonical inputs |
| Scope and evidence rules | this file | Recorded |
| Legacy ID reconciliation | this file + `docs/SCREENS.csv` | Recorded |

## Signature

| Role | Name | Date | Signature |
|---|---|---|---|
| Product owner | Mahesh Vanga | 2026-11-28 | Mahesh Vanga |
| Engineering owner | Mahesh Vanga | 2026-11-28 | Mahesh Vanga |
| Evidence reviewer | Mahesh Vanga | 2026-11-28 | Mahesh Vanga |

Electronically attested on the owner's instruction. P00 may now be marked
verified.
