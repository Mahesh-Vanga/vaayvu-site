# Operational quality and release assurance (P35)

P35 aggregates the program and decides whether a release is ready. The decision
today is **no-go**.

## Decision

```json
{"decision":"no-go","critical":3,"artifacts":6}
```

Reason: unresolved critical blockers remain. A signed build alone is not a
release.

## Signed installable artifacts

| Artifact | Present | Hash | Signed |
|---|---|---|---|
| macOS DMG | Yes | Matches manifest | Developer ID + hardened runtime |
| macOS PKG | Yes | Matches | Developer ID Installer |
| Windows x64 ZIP | Yes | Matches | Built/verified (not signed claim) |
| Android APK | Yes | Matches | Signed with Vaayvu keystore |
| iOS IPA | Yes | Matches | Development-signed; **not TestFlight** |
| iPhone simulator ZIP | Yes | Matches | Simulator artifact |

Manifest: `docs/releases/0.0.23.json`. Rollback: `docs/releases/ROLLBACK-DRILL.md`
(6/6 artifacts, `0.0.23 → 0.0.22`).

## Critical blockers

| ID | Phase | Reason |
|---|---|---|
| B-01 | P17 | No real beta cohort, measured SLOs, live security-update channel; P35 dependency unresolved |
| B-02 | P27 | No real-device playback quality or call-protection verification; no WebRTC call path |
| B-03 | P32 | No physical iPhone/iPad/Android runs; simulators/emulators only |

## High / medium blockers

| ID | Phase | Reason |
|---|---|---|
| B-00 | P00 | Charter exit artifacts unsigned by the owner |
| B-04 | P23 | Sync payload is TLS-only, not end-to-end encrypted |
| B-05 | P28 | PWA install/window/offline runtime missing |
| B-06 | P29 | Official WPT not run (WPT-style corpus only) |
| B-07 | P26 | Download quarantine/resume/integrity screens only |
| B-08 | P01 | Remote CI not observed green for the current tree |

## Phase status

- 33 phases are green locally at their contract level.
- 3 phases are **blocked**: P17, P27, P32.
- P36–P39 are not yet submitted.
- "All applicable requirements verified" is **false** while the blockers above
  remain.
- "No unresolved critical blockers" is **false**.

## What is actually assured

- Reproducible signed macOS and Windows artifacts with hashes.
- Rollback dry run.
- 1318+ shared tests, sync suite, Apple simulator suites, Android emulator
  checks, browser UI probes and security/accessibility audits.
- Explicit evidence for every gap instead of fabricated passes.

## Exit gate

| Gate item | State |
|---|---|
| Signed installable artifacts | **Green** (with iOS not TestFlight) |
| All applicable requirements verified | **No** — blockers open |
| No unresolved critical blockers | **No** — 3 critical |
| Gate met | **No** — release decision is no-go |

P35 is the release gate, not a feature phase. It stays **blocked** until the
critical blockers are closed or explicitly waived by the owner.
