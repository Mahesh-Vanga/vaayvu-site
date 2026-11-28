# Beta, staged launch and maintenance (P17)

P17 covers opt-in beta, bug triage, release governance and roadmap. The exit gate
requires real users, verified SLOs and maintained security updates. No beta
cohort exists in this repository, so the gate is **not met**.

## Current status

| Item | State |
|---|---|
| Opt-in beta policy | Drafted |
| Staged rollout plan | Drafted |
| Bug triage matrix | Drafted |
| Release governance | Drafted |
| SLO targets | Defined in `docs/slo.json` |
| SLO measurements | **None** — `status: unmeasured` |
| Real beta users | **Zero recorded** |
| Maintained security updates | Process defined; no live channel |
| P35 release evidence | **Missing dependency** |

The Chrome/Electron build has no telemetry. Measuring SLOs requires an explicit
opt-in crash/performance channel with user consent; inventing numbers would
violate the evidence rules in the charter.

## Opt-in beta

- Beta is a separate update channel, never enabled silently.
- The user must opt in, can leave at any time, and keeps a stable fallback.
- Beta builds are signed and use the same rollback artifacts as stable.
- Crash reports are opt-in, locally redacted, and never include page content,
  history or credentials.
- No beta user is enrolled by this audit.

## Staged launch

| Stage | Audience | Entry gate | Exit gate |
|---|---|---|---|
| Internal | maintainers | Signed build + rollback drill | No S1/S2 open |
| 1% | opt-in | Beta consent + crash channel | Crash-free ≥ target, no data loss |
| 5% | opt-in | 1% SLOs hold for a full window | No regression in startup/update |
| 25% | opt-in | 5% SLOs hold | Support load bounded |
| 100% | stable | 25% SLOs hold + security sign-off | Rollback ready |

Promotion pauses automatically when an SLO is unmeasured or breached.

## Bug triage

| Severity | Example | Response | Release impact |
|---|---|---|---|
| S1 | Data loss, credential leak, RCE | Immediate | Stop rollout, rollback |
| S2 | Crash loop, payment/payout error | 24 hours | Block promotion |
| S3 | Broken core journey | 7 days | Fix or documented exception |
| S4 | Cosmetic / copy | Next cycle | None |

Every S1/S2 needs an owner, reproduction, evidence and a rollback/forward-fix
decision.

## Release governance

- Release owner, security reviewer and support owner sign each promotion.
- Go/no-go checklist: signed artifacts, manifest hashes, rollback drill,
  security gate, accessibility audit, no open S1/S2.
- Roadmap items are admitted only with owner, evidence and phase mapping.
- Incident response follows `docs/RELEASE-OPS.md`.

## Security update cadence

| Severity | Target |
|---|---|
| Critical | 24 hours |
| High | 7 days |
| Medium | 30 days |
| Low | Next release |

The cadence is a policy, not a measured service level. No live security-update
channel is running.

## Exit gate

| Gate item | State |
|---|---|
| Opt-in beta | **Drafted, no users** |
| Bug triage / governance / roadmap | **Drafted** |
| SLOs | **Targets only, unmeasured** |
| Real users | **None recorded** |
| Maintained security updates | **Policy only** |
| P35 dependency | **Not submitted** |
| Gate met | **No** |

This phase cannot be marked verified without a real beta cohort, an opted-in
measurement channel and the P35 release evidence.
