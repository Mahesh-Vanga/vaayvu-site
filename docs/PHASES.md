# Vaayvu program phases

Canonical phase inventory for the VAAYVU program. P00–P35 are the main
program; P36–P39 are Ads and Rewards. Phase submissions fill `docs/PHASES.csv`
one at a time; unsubmitted rows stay explicitly blank rather than invented.

## Status summary

| ID | Title | Order | Status |
|---|---|---|---|
| P00 | Product charter and audit | 0 | **Verified** — owner-signed 2026-11-28 |
| P01 | Engineering workstation and repository | 1 | **Verified** — remote CI green 2026-11-28 |
| P02 | Engine feasibility lab | 2 | **Verified locally** — three engine spikes executed |
| P03 | Design tokens and navigation prototypes | 3 | **Verified locally** — token guard and probes green |
| P04 | Browser domain model and durable data | 4 | **Verified locally** — contracts tested; Electron storage on SQLite |
| P05 | Desktop minimum viable browser | 5 | **Verified locally** — current mac build signed; Windows build verified |
| P06 | Apple mobile browser | 6 | Unverified — simulator acceptance green, TestFlight upload blocked |
| P07 | Android phone/tablet browser | 7 | **Verified locally** — signed APKs and adaptive launches pass |
| P08 | Privacy, security and protection depth | 8 | Security gate green — external hostile-site testing pending |
| P09 | Content, downloads and productivity | 9 | **Core workflows verified locally** — translation/download-file gaps |
| P10 | Credentials, synchronization and backup | 10 | **Recovery/chaos green** — E2E encryption and passkey gaps |
| P11 | Advanced tab and workflow power tools | 11 | **Power tools verified locally** — recipe engine gap |
| P12 | Extensions and managed deployments | 12 | **Matrix/security review green** — enterprise enforcement gap |
| P13 | AI-assisted browser, opt-in | 13 | **Injection/privacy/cost green** — agent executor gap |
| P14 | Performance and low-memory program | 14 | **Published benchmarks green** — no joule/peak claim |
| P15 | Accessibility, languages and inclusive UX | 15 | **Accessible journeys green** — localized release gap |
| P16 | Packaging, distribution, release operations | 16 | **Signed release + rollback green** — notarization gap |
| P17 | Beta, staged launch and maintenance | 17 | **Blocked** — no real users, measured SLOs, or P35 |
| P18 | Adaptive performance and tab lifecycle | 18 | **Lifecycle trace green** — teardown/energy proxy gap |
| P19 | Efficient networking and storage | 19 | **Transport/storage recovery green** — DoH/OS disk-full gaps |
| P20 | Rasha and advanced privacy | 20 | **Ownership/enforcement audit green** — external lab gap |
| P21 | Security, credentials and update integrity | 21 | **Isolation/vault/signing green** — vault UI gap |
| P22 | Advanced tabs, workspaces and containers | 22 | **Tab/partition contracts green** — desktop container gap |
| P23 | Continuity, migrations and recovery | 23 | **Fault/backup/sentinel green** — E2E sync encryption gap |
| P24 | Research, reading, feeds and Focus | 24 | **Collection/reader/timer green** — feed engine gap |
| P25 | Guarded automation and intelligent assistance | 25 | **Automation contract green** — executor gap |
| P26 | Document, capture and download studio | 26 | **Native docs/save-copy green** — download recovery gap |
| P27 | Media and real-time work | 27 | **Blocked** — no real-device playback or call test |
| P28 | Extensions and web applications | 28 | **Extension trust green** — PWA runtime gap |
| P29 | Developer tools and standards compatibility | 29 | **Tooling/corpus green** — official WPT gap |
| P30 | Comparative performance laboratory | 30 | **Matched-device lab green** — same-runtime only |
| P31 | Design, accessibility and localization | 31 | **Presets/a11y/responsive green** — translations gap |
| P32 | Native desktop and mobile parity | 32 | **Blocked** — physical iPhone/iPad/Android missing |
| P33 | Migration, library and external search | 33 | **Import/export/search green** — account export gap |
| P34 | Managed and supervised browsing | 34 | **Policy/isolation/exit green** — MDM runtime gap |
| P35 | Operational quality and release assurance | 35 | **Blocked — no-go** — 3 critical blockers |
| P36 | Own inventory and rewards policy contracts | 36 | **Blocked** — approvals/jurisdiction pending |
| P37 | First party campaign and consent implementation | 37 | **Blocked by P36** — fixtures green |
| P38 | Reward ledger and payout integration | 38 | **Blocked by P36/P37** — ledger green |
| P39 | Monetization pilot and continuing assurance | 39 | **Blocked** — no rollout or economics |

## P00 — Product charter and audit

- **Phase ID:** P00
- **Order:** 0
- **Purpose:** Choose scope, goals, ownership, evidence rules; reconcile legacy IDs
- **Exit gate:** Signed charter; decision register; source registry
- **Dependency:** None
- **Status:** **Verified** — owner-signed 2026-11-28
- **Implementation status:** Verified; owner attestation recorded
- **Owner:** Mahesh Vanga
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified 2026-11-28; `node scripts/p00-verify.cjs` returns `verified: true`
- **Evidence:** `docs/CHARTER.md`, `docs/DECISIONS.csv`, `docs/SOURCES.csv`

### Exit gate audit

| Gate item | Artifact | State |
|---|---|---|
| Signed charter | `docs/CHARTER.md` | **Signed 2026-11-28** |
| Decision register | `docs/DECISIONS.csv` | 11 decisions seeded |
| Source registry | `docs/SOURCES.csv` | 9 sources registered |
| Legacy ID reconciliation | `docs/CHARTER.md`, `docs/SCREENS.csv` | Recorded (`vaayvu://`, `orbit://` alias, s-172 excluded) |
| Scope and evidence rules | `docs/CHARTER.md` | Recorded |

The signature table in `docs/CHARTER.md` holds a typed owner attestation from
Mahesh Vanga for all three roles. The agent recorded the attestation and did not
sign on the owner's behalf.

## P01 — Engineering workstation and repository

- **Phase ID:** P01
- **Order:** 1
- **Purpose:** Pin toolchains; initialize monorepo, CI and secrets boundaries
- **Exit gate:** Green minimal CI; reproducible developer setup
- **Dependency:** P00
- **Status:** **Verified** — remote CI green 2026-11-28
- **Implementation status:** Verified in GitHub Actions run 46121708263
- **Owner:** Mahesh Vanga
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally and remotely
- **Evidence:** `.nvmrc`, `windows/package.json`, `scripts/doctor.cjs`,
  `docs/DEVELOPMENT.md`, `.github/workflows/build.yml`

### Exit gate audit

| Gate item | Artifact | State |
|---|---|---|
| Toolchains pinned | `.nvmrc` (22.13.0), `engines.node`, CI versions | Implemented |
| Monorepo initialized | `chrome/ windows/ apple/ android/ sync/ tests/` | Present; recorded |
| Minimal CI | checks job: doctor, syntax, shared tests, UI probes | Implemented |
| Reproducible setup | `docs/DEVELOPMENT.md` and `scripts/doctor.cjs` | Implemented |
| Secrets boundaries | read-only workflow, no secrets, `.gitignore` rules | Recorded |
| Green CI observed | Build Vaayvu run 46121708263 on `ac642dc` | **Green** (checks, Windows, Apple, Android) |

`node scripts/doctor.cjs` is the local gate, and the minimal CI job ran green
remotely in run 46121708263, so P01 is verified.

## P02 — Engine feasibility lab

- **Phase ID:** P02
- **Order:** 2
- **Purpose:** Build Chromium, WebKit and GeckoView spike apps; validate blockers
- **Exit gate:** Three native engine spike results and go/no-go
- **Dependency:** P01
- **Status:** **Verified locally** — 2026-11-28
- **Implementation status:** Implemented; Chromium, WebKit and GeckoView spikes executed
- **Owner:** Mahesh Vanga
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28; Chromium spike re-run and GeckoView runtime re-checked on the `vaayvu-gecko` AVD
- **Evidence:** `docs/ENGINE-LAB.md`, `docs/ENGINE-LAB.csv`, `docs/VFD-ENGINE.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Chromium spike result | **Pass** (interception) |
| WebKit spike result | **Pass** (18/18 simulator tests) |
| GeckoView spike result | **Pass** (build + runtime) |
| Written go/no-go | Chromium/WebKit go; GeckoView conditional |
| Gate met | **Yes, locally** |

The lab now has three executed spike results. GeckoView remains a product no-go
until blocker parity and media/DRM are measured.

## P03 — Design tokens and navigation prototypes

- **Phase ID:** P03
- **Order:** 3
- **Purpose:** Original brand; glass guidance; responsive layouts and a11y foundations
- **Exit gate:** Design token package and tested interactive prototypes
- **Dependency:** P02
- **Status:** **Verified locally** — 2026-11-28
- **Implementation status:** Implemented; token package and all interactive probes pass locally
- **Owner:** Mahesh Vanga
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28; all eight interactive probes pass through `scripts/run-prototypes.cjs` (evidence: `docs/benchmarks/playwright-2026-11-28.json`)
- **Evidence:** `design/tokens.json`, `scripts/check-tokens.cjs`,
  `scripts/run-prototypes.cjs`, `docs/benchmarks/playwright-2026-11-28.json`,
  `docs/DESIGN-SYSTEM.md`, `branding/`, `chrome/liquid.css`

### Exit gate audit

| Gate item | State |
|---|---|
| Design token package | Implemented in `design/tokens.json` |
| Token consistency | `node scripts/check-tokens.cjs` passes |
| Original brand | Assets present under `branding/` |
| Glass guidance | Documented from `chrome/liquid.css` |
| Responsive layouts | Breakpoints and mobile stylesheet documented |
| A11y foundations | focus-visible, reduced motion, dark and high-contrast paths |
| Tested interactive prototypes | **All 8 probes passed locally via `scripts/run-prototypes.cjs`; CI uploads the JSON** |
| Gate met | **Yes, locally** |

P03's local gate is met. Build Vaayvu runs the same explicit probe runner in
its `checks` job and uploads `prototype-evidence`.

## P04 — Browser domain model and durable data

- **Phase ID:** P04
- **Order:** 4
- **Purpose:** Tabs/windows/profiles/containers; SQLite; crash journals and migration
- **Exit gate:** State machines, migrations and tested recovery
- **Dependency:** P03
- **Status:** **Verified locally** — contracts tested
- **Implementation status:** Implemented; SQLite contracts tested and the Electron renderer persists through the SQLite key-value bridge
- **Owner:** Mahesh Vanga
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28; `tests/domain-store.test.cjs` passes 5/5 (migrations 1→3, illegal transitions, unclean recovery, container isolation, key-value persistence), plus `tests/native-store.test.cjs` and `tests/domain-bridge.test.cjs`; `windows/test/domain-store.cjs` asserts the Electron UI’s `localStorage` is the SQLite shim and its key exists in `key_values`
- **Evidence:** `windows/domain/store.cjs`, `windows/preload.cjs`,
  `windows/host.cjs`, `chrome/native-store.js`, `windows/test/domain-store.cjs`,
  `tests/domain-store.test.cjs`, `tests/native-store.test.cjs`,
  `tests/domain-bridge.test.cjs`, `docs/DOMAIN-MODEL.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Tabs/windows/profiles/containers | SQLite reference schema implemented |
| SQLite | `node:sqlite` store implemented |
| Crash journal | Implemented and tested |
| Migrations | Versioned `1 → 2`, tested |
| State machines | Tab and window transitions tested |
| Tested recovery | Unclean-session recovery tested, no repeat recovery |
| Shipping integration | Electron renderer persists through the SQLite `key_values` bridge; legacy localStorage imported once |
| Gate met | **Yes, locally** |

P04's gate is met locally by the tested contracts and the wired Electron storage
bridge.

## P05 — Desktop minimum viable browser

- **Phase ID:** P05
- **Order:** 5
- **Purpose:** macOS first; Chromium integration; tabs, omnibox, bookmarks, downloads
- **Exit gate:** Signed internal macOS build; Windows build follows
- **Dependency:** P04
- **Status:** **Verified locally** — current macOS DMG/PKG and Windows x64 builds verified
- **Implementation status:** Implemented; current macOS and Windows builds verified
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28; macOS 0.0.24 DMG/PKG rebuilt with Developer ID Application and Installer identities; `windows/test/downloads.cjs` asserted 3 real downloads (1 completed, 2 cancelled)
- **Evidence:** `docs/DESKTOP-MVP.md`, `windows/test/`, `windows/test/downloads.cjs`, `tests/test/0.0.24/`

### Exit gate audit

| Gate item | State |
|---|---|
| Chromium integration | Electron 45.4.1, sandboxed |
| Tabs / omnibox / bookmarks | Implemented and native-tested |
| Downloads | Implemented; **native assertion** in `windows/test/downloads.cjs` |
| Signed internal macOS build | **Current source signed and verified** |
| Windows build | **Current source packaged and verified** |
| Gate met | **Yes, locally** |

Local `npm --prefix windows test` passed, including the native download suite.
`package:mac` + `verify:mac` and `package` + `verify` both pass against the
current source.

## P06 — Apple mobile browser

- **Phase ID:** P06
- **Order:** 6
- **Purpose:** Native Swift/SwiftUI + WebKit; iPhone/iPad navigation and storage
- **Exit gate:** iOS/iPadOS TestFlight build and platform acceptance
- **Dependency:** P04
- **Status:** **Unverified** — simulator acceptance green; TestFlight upload blocked
- **Implementation status:** Implemented in native Swift/UIKit with WebKit; simulator acceptance green
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Unverified; TestFlight upload not performed
- **Evidence:** `docs/APPLE-MOBILE.md`, `apple/Sources`, `apple/Tests`

### Exit gate audit

| Gate item | State |
|---|---|
| Native Swift + WebKit | Implemented (UIKit, not SwiftUI) |
| iPhone + iPad target | Implemented (`1,2`) |
| Navigation and storage | Simulator tests |
| Platform acceptance | **18/18 simulator tests green** after removing false `canDefaultBrowser` |
| TestFlight build | **Blocked**: App Store Connect credentials/upload |
| Gate met | **Partially** |

The capability defect was real: iOS advertised `canDefaultBrowser` while the
system default cannot be set from inside the app.

## P07 — Android phone/tablet browser

- **Phase ID:** P07
- **Order:** 7
- **Purpose:** Kotlin/Compose + GeckoView; adaptive UI and permissions
- **Exit gate:** Android internal release and adaptive checks
- **Dependency:** P04
- **Status:** Implemented / verified locally
- **Implementation status:** Java/WebView product; signed debug/release APKs; phone/tablet launches pass
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28
- **Evidence:** `docs/ANDROID-MOBILE.md`, `scripts/android-adaptive-check.sh`

### Exit gate audit

| Gate item | State |
|---|---|
| Android internal release | Debug and release APKs built; release signature verified |
| Adaptive checks | Phone 1080x2280 and tablet 1600x2560 launches pass, no fatal exception |
| Unit tests | Passed |
| Kotlin/Compose/GeckoView product | **Not migrated** — recorded gap |
| Gate met | **Yes, locally** |

The release now uses a Vaayvu signing certificate and `dev.vaayvu.app`; this is a
new identity, so upgrades from the old package require a fresh install.

## P08 — Privacy, security and protection depth

- **Phase ID:** P08
- **Order:** 8
- **Purpose:** Threat-model updates; adblock; reputation; private/storage boundaries
- **Exit gate:** External hostile-site testing and security gate
- **Dependency:** P05, P06, P07
- **Status:** Security gate green / external hostile-site testing pending
- **Implementation status:** Threat model, security gate, hostile URL corpus and boundaries implemented
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Security gate green locally; external audit unverified
- **Evidence:** `docs/THREAT-MODEL.md`, `scripts/security-gate.cjs`,
  `tests/fixtures/hostile-urls.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Threat model | Implemented |
| Adblock / VFD | Implemented and tested |
| Reputation / phishing | Implemented in atlas and tests |
| Private/storage boundaries | Implemented and checked |
| Security gate | **Green locally** |
| External hostile-site testing | **Not performed** — third-party report needed |
| Gate met | **Partially** |

The local gate checks Electron flags, CSP, permission handlers, private
partitioning, CI secrets, ignored key material and a hostile URL corpus. It does
not substitute for an external audit.

## P09 — Content, downloads and productivity

- **Phase ID:** P09
- **Order:** 9
- **Purpose:** Reader, translation, PDF, capture, history and rich bookmarks
- **Exit gate:** End-to-end content workflows
- **Dependency:** P08
- **Status:** Implemented / core workflows verified locally
- **Implementation status:** Reader, PDF, capture, history and bookmarks verified; translation and download-file assertion open
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally on 2026-11-28 for core workflows
- **Evidence:** `docs/CONTENT-WORKFLOWS.md`, `windows/test/content-workflow.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Reader | **E2E tested** |
| PDF | **E2E tested** (`%PDF`) |
| Capture | **E2E tested** (PNG) |
| History | Native-tested |
| Rich bookmarks | Native-tested |
| Downloads | Implemented; real-file assertion missing |
| Translation | **Gap** — no native provider |
| Gate met | **Partially** — core workflows green, two gaps recorded |

The executed workflow result is:

```json
{"article":"Content workflow article","reader":true,"pdf":true,"pdfBytes":33845,"capture":true,"captureBytes":43904}
```

## P10 — Credentials, synchronization and backup

- **Phase ID:** P10
- **Order:** 10
- **Purpose:** Passkeys and OS credential stores; encrypted sync and recovery
- **Exit gate:** Multi-device recovery and data loss chaos tests
- **Dependency:** P09
- **Status:** Implemented / recovery and chaos tests green
- **Implementation status:** Recovery and chaos tests added; sync is TLS/scrypt without E2E payload encryption; passkeys platform-delegated
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally for recovery/chaos; encryption and passkey verification open
- **Evidence:** `docs/CREDENTIALS-SYNC.md`, `sync/recovery.test.mjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Passkeys / OS credential store | Platform-delegated, not independently verified |
| Encrypted sync | TLS + hashed credentials; **no E2E payload encryption** |
| Backup/restore | Documented and restore-tested |
| Multi-device recovery | **Tested** across restart |
| Data-loss chaos | **Tested** (rejected batch, corrupt DB, tombstones, ordering) |
| Gate met | **Yes, locally** for recovery/chaos |

`node --test sync/*.test.mjs` → 7 tests, 7 pass.

## P11 — Advanced tab and workflow power tools

- **Phase ID:** P11
- **Order:** 11
- **Purpose:** Spaces, tab triage, vertical tabs, split view, notes and session recipes
- **Exit gate:** Power user journeys with robust restore
- **Dependency:** P10
- **Status:** Implemented / power tools verified locally
- **Implementation status:** Spaces, triage, vertical tabs, split, notes and restore tested
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally; recipe engine and split pane probe open
- **Evidence:** `docs/POWER-TOOLS.md`, `chrome/spaces.js`, `tests/spaces.test.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Spaces | Implemented + unit-tested |
| Tab triage | Implemented + tested |
| Vertical tabs | Implemented + screen-tested |
| Split view | Implemented; screen-tested, no native pane probe |
| Notes | Implemented + UI-tested |
| Robust restore | Crash restore + native window restore tested |
| Session recipes | **Gap** — screens only |
| Gate met | **Yes, locally** for journeys; recipe engine gap recorded |

## P12 — Extensions and managed deployments

- **Phase ID:** P12
- **Order:** 12
- **Purpose:** Desktop extensions, permission review, enterprise controls
- **Exit gate:** Compatibility matrix and extension security review
- **Dependency:** P11
- **Status:** Implemented / matrix and security review green
- **Implementation status:** CSS-only extension runtime, matrix and review complete; enterprise enforcement gap
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally for matrix/security; enterprise runtime open
- **Evidence:** `docs/EXTENSIONS-MANAGED.md`, `docs/EXTENSION-MATRIX.csv`

### Exit gate audit

| Gate item | State |
|---|---|
| Compatibility matrix | **Implemented** |
| Extension security review | **Implemented** and tested |
| Style extensions | Supported on desktop, Android and iOS shared chrome |
| Scripts / store / native messaging | Explicitly unsupported |
| Enterprise policy enforcement | **Screen contracts only** |
| Gate met | **Partially** — matrix/review green, MDM/GPO runtime gap |

`tests/extensions.test.cjs` proves exact-site scoping, private-tab exclusion,
unsupported feature rejection, CSS rejection and safe-mode disable.

## P13 — AI-assisted browser, opt-in

- **Phase ID:** P13
- **Order:** 13
- **Purpose:** Local-first context selection; summaries, compare and guarded agents
- **Exit gate:** Prompt-injection tests, privacy and cost gates
- **Dependency:** P12
- **Status:** Implemented / injection privacy and cost gates green
- **Implementation status:** Ask flow + local guard + server untrusted wrapper; summaries/compare/agent executor gaps
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally for injection/privacy/cost
- **Evidence:** `docs/AI-OPTIN.md`, `chrome/ai-guard.js`, `sync/ai-guard.test.mjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Prompt-injection tests | **Green** (client corpus + server payload) |
| Privacy gates | **Green** (private blocked, secrets redacted, untrusted JSON) |
| Cost gates | **Green** (8k local tokens, 32k chars, 12/15 min, 768 output) |
| Guarded agents | Policy guard green; **no executor** |
| Gate met | **Yes, locally** for injection/privacy/cost |

The sync suite runs 8 tests: 8 pass.

## P14 — Performance and low-memory program

- **Phase ID:** P14
- **Order:** 14
- **Purpose:** Telemetry-free local profiler; baselines, regressions and energy testing
- **Exit gate:** Published reproducible benchmark results
- **Dependency:** P13
- **Status:** Implemented / published benchmarks green
- **Implementation status:** Local benchmark, JSON baseline and regression comparator published
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally
- **Evidence:** `docs/BENCHMARKS.md`, `docs/benchmarks/2026-11-28.json`,
  `scripts/benchmark.cjs`, `scripts/benchmark-compare.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Telemetry-free local profiler | **Implemented** |
| Published results | **Published** with machine, Node and date |
| Reproducible command | `node scripts/benchmark.cjs --json` |
| Baseline / regression gate | **Implemented** at 20% threshold |
| Energy testing | CPU-time proxy only; no joule claim |
| Low-memory claim | Heap delta only; no peak/leak claim |
| Gate met | **Yes, locally** |

Published VFD decision throughput: 120,000 decisions in 127.48 ms on the
recorded M5/Node 22.23.2 run.

## P15 — Accessibility, languages and inclusive UX

- **Phase ID:** P15
- **Order:** 15
- **Purpose:** VoiceOver/TalkBack/Narrator; RTL/CJK; reduced effects
- **Exit gate:** Accessible journeys and localized release
- **Dependency:** P14
- **Status:** Implemented / accessible journeys green; localization gap
- **Implementation status:** Accessibility audit, RTL/CJK primitives and reduced effects; no translated catalog
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally for accessibility/RTL/CJK; localized release and screen-reader devices open
- **Evidence:** `docs/ACCESSIBILITY-I18N.md`, `scripts/a11y-audit.cjs`, `chrome/i18n.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Labels, roles, focus | **Green** |
| Reduced motion / contrast | **Green** |
| 24 px targets and responsive probes | **Green** |
| RTL | **Implemented** |
| CJK | **Implemented** |
| VoiceOver / TalkBack / Narrator | **Not device-verified** |
| Localized release | **Gap** — English strings only |
| Gate met | **Partially** |

`node scripts/a11y-audit.cjs` passes and is wired into CI.

## P16 — Packaging, distribution, release operations

- **Phase ID:** P16
- **Order:** 16
- **Purpose:** Signing, notarization, store review, updates, incident response
- **Exit gate:** Reproducible signed release and rollback drill
- **Dependency:** P15
- **Status:** Implemented / signed release and rollback drill green
- **Implementation status:** Signed artifacts, checksums, manifest and rollback dry run; notarization/store/updater gaps
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Verified locally for signed release + rollback dry run
- **Evidence:** `docs/RELEASE-OPS.md`, `docs/releases/0.0.23.json`,
  `docs/releases/ROLLBACK-DRILL.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Signed macOS release | **Green** (DMG + PKG verified) |
| Windows release | **Green** (PE + ASAR verified) |
| Checksums / manifest | **Generated** |
| Rollback drill | **Pass** (6/6 artifacts, 0.0.23 → 0.0.22) |
| Notarization | **Gap** — no credentials |
| Store review | **Gap** — not submitted |
| Live updater | **Gap** — screens only |
| Gate met | **Yes, locally** |

## P17 — Beta, staged launch and maintenance

- **Phase ID:** P17
- **Order:** 17
- **Purpose:** Opt-in beta, bug triage, release governance and roadmap
- **Exit gate:** Real users, verified SLOs and maintained security updates
- **Dependency:** P16, P35
- **Status:** Blocked / governance drafted
- **Implementation status:** Beta policy, triage, governance and SLO targets drafted; no users or measurements
- **Owner:** —
- **Origin:** V25 baseline (22 Nov 2026)
- **Verification:** Unverified; real users and measured SLOs absent
- **Evidence:** `docs/BETA-MAINTENANCE.md`, `docs/slo.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Opt-in beta | Drafted, **no users** |
| Triage / governance / roadmap | Drafted |
| SLOs | Targets only, **unmeasured** |
| Real users | **None recorded** |
| Maintained security updates | Policy only |
| P35 dependency | **Not submitted** |
| Gate met | **No** |

This gate is external. It cannot be closed by code or documentation alone.

## P18 — Adaptive performance and tab lifecycle

- **Phase ID:** P18
- **Order:** 18
- **Purpose:** Adaptive performance and tab lifecycle
- **Exit gate:** Measured pressure response, critical-work leases and reproducible RAM/CPU/energy traces.
- **Dependency:** P04, P05, P06, P07
- **Status:** Implemented / lifecycle trace green
- **Implementation status:** Pressure reclaim, idle sleep, wake and expiring critical-work leases tested
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; teardown cost and joule energy open
- **Evidence:** `docs/TAB-LIFECYCLE.md`,
  `docs/benchmarks/lifecycle-2026-11-28.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Measured pressure response | **Green** |
| Critical-work leases | **Implemented/tested** |
| RAM/CPU trace | **Published** |
| Energy trace | CPU proxy only |
| Renderer teardown cost | **Not measured** — close stubbed |
| Gate met | **Yes, locally** for pressure/leases/trace |

Recorded trace: 4 tabs, t1/t3 slept, t2 lease-protected, t4 active-protected,
t1 woke, 611,568 KB working set, 93.35 ms CPU, 304 ms elapsed.

## P19 — Efficient networking and storage

- **Phase ID:** P19
- **Order:** 19
- **Purpose:** Efficient networking and storage
- **Exit gate:** Verified transport, origin-safe caches, disk-full recovery and no data loss.
- **Dependency:** P04, P05, P06, P07
- **Status:** Implemented / transport and storage recovery green
- **Implementation status:** Bounded transport, partition-safe caches, quota-safe storage and no-loss tests
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; OS disk-full and DoH open
- **Evidence:** `docs/NETWORK-STORAGE.md`, `chrome/storage.js`,
  `tests/network-storage.test.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Transport | **Verified** (HTTP(S), TLS sync) |
| Origin-safe caches | **Implemented/source-verified** |
| Disk-full recovery | **Quota-injection tested**; OS run missing |
| No data loss | **Tested** |
| Gate met | **Yes, locally** |

`chrome/storage.js` returns `{ok:false, reason:'quota'}` and keeps the old value;
the UI shows an honest storage-full toast.

## P20 — Rasha and advanced privacy

- **Phase ID:** P20
- **Order:** 20
- **Purpose:** Rasha and advanced privacy
- **Exit gate:** First-party ownership audit; original rules; safe engine enforcement and isolation corpus.
- **Dependency:** P08, P19
- **Status:** Implemented / ownership and enforcement audit green
- **Implementation status:** 47 original rules audited, protected apex/precedence/private pause tested, isolation corpus
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; external fingerprinting lab open
- **Evidence:** `docs/RAASHA-PRIVACY.md`,
  `scripts/vfd-ownership-audit.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| First-party ownership audit | **Green** |
| Original rules | **47 rules, provenance complete** |
| Protected apex / precedence | **Green** |
| Private-tab paused-site behavior | **Green** |
| Isolation corpus | **Green** (VFD/session/storage) |
| External fingerprinting lab | **Gap** (P08 external) |
| Gate met | **Yes, locally** |

Audit output: `47 rules`, `0 rejected`, `363` ad hosts, `174` tracker hosts,
`108` cosmetic selectors, `78` tokens.

## P21 — Security, credentials and update integrity

- **Phase ID:** P21
- **Order:** 21
- **Purpose:** Security, credentials and update integrity
- **Exit gate:** Hostile page isolation, secure vault, permission and signed-update evidence.
- **Dependency:** P08, P04, P05, P06, P07
- **Status:** Implemented / isolation vault and signing evidence green
- **Implementation status:** Hostile E2E, AES-GCM vault reference, permission handlers, signed manifests
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; vault UI integration and external lab open
- **Evidence:** `docs/SECURITY-UPDATES.md`,
  `windows/test/hostile-isolation.cjs`, `windows/vault.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Hostile page isolation | **Green** (E2E) |
| Secure vault | **Reference tested**; not wired |
| Permissions | **Green** |
| Signed-update evidence | **Green** |
| External hostile lab | **Gap** |
| Gate met | **Yes, locally** |

The hostile page saw `process`/`require`/bridge as undefined, could not read
chrome storage, and the UI stayed healthy.

## P22 — Advanced tabs, workspaces and containers

- **Phase ID:** P22
- **Order:** 22
- **Purpose:** Advanced tabs, workspaces and containers
- **Exit gate:** Stable tab IDs, four-position layouts, protected work and proven partition isolation.
- **Dependency:** P04, P18, P21
- **Status:** Implemented / tab and partition contracts green
- **Implementation status:** Stable IDs, four layouts, pinned/lease protection, session/profile partitions
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; desktop container runtime open
- **Evidence:** `docs/ADVANCED-TABS.md`,
  `tests/desktop-tab-strip-ui.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Stable tab IDs | **Green** (reload assertion) |
| Four-position layouts | **Green** (top/bottom/left/right) |
| Protected work | **Green** (leases + pinned) |
| Partition isolation | **Green** for private/profile; containers gap |
| Gate met | **Yes, locally** |

The desktop probe now asserts the exact tab-ID array before and after reload.

## P23 — Continuity, migrations and recovery

- **Phase ID:** P23
- **Order:** 23
- **Purpose:** Continuity, migrations and recovery
- **Exit gate:** Encrypted sync, crash/fault injection, verified backup/restore; private sentinel absent.
- **Dependency:** P10, P21, P22
- **Status:** Implemented / fault backup sentinel green; E2E sync gap
- **Implementation status:** Fault injection, backup/restore, rollback and sentinel pass; sync is TLS-only
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally for faults/backup/sentinel; E2E encryption open
- **Evidence:** `docs/CONTINUITY-RECOVERY.md`,
  `sync/privacy-sentinel.test.mjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Encrypted sync | **TLS only; no E2E payload encryption** |
| Crash/fault injection | **Green** |
| Verified backup/restore | **Green** |
| Private sentinel absent | **Green** (DB, WAL, SHM, snapshot) |
| Gate met | **Partially** |

The private sentinel is absent from every SQLite file and from the snapshot.
E2E sync encryption is the remaining blocker.

## P24 — Research, reading, feeds and Focus

- **Phase ID:** P24
- **Order:** 24
- **Purpose:** Research, reading, feeds and Focus
- **Exit gate:** Local-first collection/reader workflows; reliable timer and safe offline content.
- **Dependency:** P09, P22, P23
- **Status:** Implemented / collection reader timer green; feeds gap
- **Implementation status:** Collection module, reading list/reader/offline, persistent focus deadline
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; feed engine and research UI open
- **Evidence:** `docs/RESEARCH-READING.md`, `chrome/collections.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Local-first collections | **Reference module tested**; not wired |
| Reading list / reader / offline | **Green** |
| Reliable timer | **Green** (absolute deadline persists) |
| Safe offline content | **Green** |
| Feeds | **Gap** — screens only |
| Gate met | **Yes, locally** |

The focus timer now persists `vaayvu.focusUntil` and resumes after reload.

## P25 — Guarded automation and intelligent assistance

- **Phase ID:** P25
- **Order:** 25
- **Purpose:** Guarded automation and intelligent assistance
- **Exit gate:** Dry-run/approval/receipts, no unconsented context, prompt-injection tests.
- **Dependency:** P13, P21, P24
- **Status:** Implemented / automation contract green; executor gap
- **Implementation status:** Dry-run, named approval, receipt, consent and injection blocking tested
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; shipping executor open
- **Evidence:** `docs/AUTOMATION.md`, `chrome/automation.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Dry-run | **Green** |
| Approval | **Green** (named, single-use) |
| Receipts | **Green** (no page text) |
| No unconsented context | **Green** |
| Prompt injection | **Green** |
| Shipping executor | **Gap** |
| Gate met | **Yes, locally** for the contract |

Destructive and injection-bearing steps are blocked before approval; execution
needs consent and a matching URL.

## P26 — Document, capture and download studio

- **Phase ID:** P26
- **Order:** 26
- **Purpose:** Document, capture and download studio
- **Exit gate:** Non-destructive save-copy, safe download/recovery, actual native document capability.
- **Dependency:** P09, P19, P21
- **Status:** Implemented / save-copy and native documents green; download recovery gap
- **Implementation status:** Native PDF/PNG/MHTML with unchanged page; download start/cancel rules
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; quarantine/resume open
- **Evidence:** `docs/DOCUMENT-STUDIO.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Native PDF/PNG/MHTML | **Green** |
| Non-destructive save-copy | **Green** (URL/title unchanged) |
| Safe download start/cancel | **Green** |
| Quarantine/resume/integrity | **Gap** — screens only |
| Gate met | **Partially** |

Executed: PDF 33,845 bytes, PNG 43,904 bytes, MHTML 3,952 bytes, page URL/title
unchanged.

## P27 — Media and real-time work

- **Phase ID:** P27
- **Order:** 27
- **Purpose:** Media and real-time work
- **Exit gate:** Verified playback quality and call protections on real devices.
- **Dependency:** P18, P19, P21
- **Status:** Blocked / no real-device media or call verification
- **Implementation status:** Native playback + safe permissions; no quality measurement or WebRTC call path
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Unverified
- **Evidence:** `docs/MEDIA-REALTIME.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Playback quality | **Not measured** |
| Call protections | **No product call path** |
| Real-device test | **Not run** |
| Gate met | **No** |

Screens and deny-by-default permissions are not playback/call evidence.

## P28 — Extensions and web applications

- **Phase ID:** P28
- **Order:** 28
- **Purpose:** Extensions and web applications
- **Exit gate:** Trusted extension permissions, PWA capability and no forbidden Rasha dependency.
- **Dependency:** P12, P21
- **Status:** Implemented / extension trust green; PWA gap
- **Implementation status:** CSS-only extensions, no script grants, Rasha-independent; PWA screens only
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally for extension trust and Rasha independence; PWA runtime open
- **Evidence:** `docs/WEBAPPS-EXTENSIONS.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Trusted extension permissions | **Green** |
| No forbidden Rasha dependency | **Green** |
| PWA capability | **Gap** — no install/window/offline runtime |
| Gate met | **Partially** |

PWA install, standalone window and offline app shell are contracts, not runtime.

## P29 — Developer tools and standards compatibility

- **Phase ID:** P29
- **Order:** 29
- **Purpose:** Developer tools and standards compatibility
- **Exit gate:** Native tooling, WPT subset, website task corpus and explicit unsupported cases.
- **Dependency:** P21, P20, P27, P28
- **Status:** Implemented / native tooling and standards corpus green; official WPT gap
- **Implementation status:** Inspection on all platforms; WPT-style corpus; unsupported cases documented
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; official WPT open
- **Evidence:** `docs/COMPATIBILITY.md`, `tests/standards-ui.cjs`

### Exit gate audit

| Gate item | State |
|---|---|
| Native tooling | **Green** |
| WPT subset | **WPT-style corpus only** |
| Website task corpus | **Partial** |
| Unsupported cases | **Documented** |
| Gate met | **Partially** — official WPT is the blocker |

The local corpus passes URL/IDN, Intl, dialog, ResizeObserver, animations, grid,
logical properties, form validation and origin storage.

## P30 — Comparative performance laboratory

- **Phase ID:** P30
- **Order:** 30
- **Purpose:** Comparative performance laboratory
- **Exit gate:** Matched-device benchmarks, coverage and stability; no misleading comparisons.
- **Dependency:** P14, P18, P20, P27, P29
- **Status:** Implemented / matched-device lab green
- **Implementation status:** Six cases, five runs, median/range/CV, same-runtime scope
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally
- **Evidence:** `docs/COMPARATIVE-PERF.md`,
  `docs/benchmarks/comparative-2026-11-28.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Matched-device | **Green** (one machine/runtime) |
| Coverage | **Green** (adblock, navigation, workspace, ai) |
| Stability | **Green** (all ≤ 2.2% CV) |
| No misleading comparisons | **Green** (explicit same-runtime) |
| Gate met | **Yes, locally** |

VFD on: 114.19 ms median; off: 1.99 ms median. This is policy cost on the same
runtime, not a cross-browser claim.

## P31 — Design, accessibility and localization

- **Phase ID:** P31
- **Order:** 31
- **Purpose:** Design, accessibility and localization
- **Exit gate:** Two presets, complete accessible journeys, responsive safe chrome.
- **Dependency:** P03, P15, P22, P24
- **Status:** Implemented / presets a11y and responsive chrome green
- **Implementation status:** Light/dark presets, a11y audit, responsive probes; no translated catalog
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; translations and screen-reader devices open
- **Evidence:** `docs/DESIGN-A11Y-L10N.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Two presets | **Green** (light/dark; high contrast extra) |
| Accessible journeys | **Green locally** |
| Responsive safe chrome | **Green** |
| Localization | Infrastructure only — **no translated catalog** |
| Gate met | **Yes, locally** |

Screen-reader device runs and a translated release remain recorded gaps.

## P32 — Native desktop and mobile parity

- **Phase ID:** P32
- **Order:** 32
- **Purpose:** Native desktop and mobile parity
- **Exit gate:** Physical Mac/iPhone/iPad/Android evidence; optional desktop targets separately verified.
- **Dependency:** P05, P06, P07, P31
- **Status:** Blocked / physical mobile devices missing
- **Implementation status:** Physical Mac green; iPhone/iPad simulators 18/18; Android emulators green; Windows package verified
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Partial; no physical iPhone/iPad/Android
- **Evidence:** `docs/PARITY.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Physical Mac | **Green** |
| Physical iPhone | **Missing** |
| Physical iPad | **Missing** (simulator 18/18) |
| Physical Android | **Missing** (emulator green) |
| Windows package | Verified, not run |
| Gate met | **No** |

An iPad popover crash was found and fixed; the iPad simulator now passes 18/18.
Physical device runs are still required.

## P33 — Migration, library and external search

- **Phase ID:** P33
- **Order:** 33
- **Purpose:** Migration, library and external search
- **Exit gate:** Safe import/export and validated external search; no public index or private leak.
- **Dependency:** P23, P24, P21
- **Status:** Implemented / import export and search validation green
- **Implementation status:** Bounded bookmark import/export, migrations, pinned search, no index, private isolation
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; account data export open
- **Evidence:** `docs/MIGRATION-SEARCH.md`

### Exit gate audit

| Gate item | State |
|---|---|
| Safe import/export | **Green** (bookmarks); account export gap |
| Validated external search | **Green** |
| No public index | **Green** (none shipped) |
| No private leak | **Green** (sentinel + isolation) |
| Gate met | **Yes, locally** |

Imported/exported bookmarks are bounded, escaped and URL-validated; private
searches never reach sync or snapshots.

## P34 — Managed and supervised browsing

- **Phase ID:** P34
- **Order:** 34
- **Purpose:** Managed and supervised browsing
- **Exit gate:** Transparent authorized policies, isolation and safe exit.
- **Dependency:** P21, P23, P32
- **Status:** Implemented / policy isolation and safe exit contract green
- **Implementation status:** Signed scoped policy, full disclosure, profile isolation, guardian/PIN exit
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Verified locally; MDM/GPO runtime open
- **Evidence:** `docs/MANAGED-SUPERVISED.md`, `chrome/managed-policy.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Transparent authorized policies | **Green** (contract) |
| Isolation | **Green** (profile scope/sessions) |
| Safe exit | **Green** (guardian/PIN, OS removal noted) |
| MDM/GPO ingestion | **Gap** |
| Gate met | **Yes, locally** |

Tampered/expired/wrong-key policies are rejected. Supervised exit never hides
the OS-level removal path.

## P35 — Operational quality and release assurance

- **Phase ID:** P35
- **Order:** 35
- **Purpose:** Operational quality and release assurance
- **Exit gate:** Signed installable artifacts, all applicable requirements verified, no unresolved critical blockers.
- **Dependency:** P16, P20, P25, P26, P27, P28, P29, P30, P31, P32, P33, P34
- **Status:** Blocked / release decision **no-go**
- **Implementation status:** Signed artifacts and rollback pass; 3 critical blockers remain
- **Owner:** —
- **Origin:** R4 required scope
- **Verification:** Unverified; no-go
- **Evidence:** `docs/RELEASE-ASSURANCE.md`, `docs/release-readiness.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Signed installable artifacts | **Green** (iOS dev-signed, not TestFlight) |
| All applicable requirements verified | **No** |
| No unresolved critical blockers | **No** — P17, P27, P32 |
| Gate met | **No** |

Release decision: **no-go**. `scripts/release-readiness.cjs` aggregates phase
status, artifact hashes and explicit blockers.

## P36 — Own inventory and rewards policy contracts

- **Phase ID:** P36
- **Order:** 36
- **Purpose:** Own inventory and rewards policy contracts
- **Exit gate:** Approved inventory ownership, direct advertiser terms, privacy model and jurisdiction decision
- **Dependency:** P08 P14 P21 P31
- **Status:** Blocked / contracts drafted; approvals and jurisdiction pending
- **Implementation status:** Owned-only, direct-advertiser, consent-separated draft validated; no approvals
- **Owner:** —
- **Origin:** R5 own inventory and rewards extension
- **Verification:** Unverified
- **Evidence:** `docs/REVENUE-POLICY.md`, `docs/revenue-policy.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Inventory ownership | Drafted; pending approval |
| Direct advertiser terms | Drafted; pending legal |
| Privacy model | Drafted; pending privacy |
| Jurisdiction | **Pending** — no region/rail |
| Gate met | **No** |

Policy check output: `status: draft`, missing all four approvals, jurisdiction
`pending`. Enrollment/payout must treat unapproved regions as ineligible.

## P37 — First party campaign and consent implementation

- **Phase ID:** P37
- **Order:** 37
- **Purpose:** First party campaign and consent implementation
- **Exit gate:** Signed creatives, explicit consent, independent Rasha and zero unauthorized placement fixtures
- **Dependency:** P36
- **Status:** Blocked by P36 / technical fixtures green
- **Implementation status:** HMAC creatives, consent, owned allowlist, cap and Rasha independence tested
- **Owner:** —
- **Origin:** R5 own inventory and rewards extension
- **Verification:** Unverified for production; P36 approvals missing
- **Evidence:** `docs/CAMPAIGN-CONSENT.md`, `chrome/campaign.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Signed creatives | **Green** (fixture contract) |
| Explicit consent | **Green** |
| Independent Rasha | **Green** |
| Zero unauthorized placements | **Green** |
| P36 approvals | **Pending** |
| Campaign runtime | **Gap** |
| Gate met | **Partially** |

Unsigned/tampered creatives, third-party placements, private tabs and the daily
cap are all rejected without recording an impression.

## P38 — Reward ledger and payout integration

- **Phase ID:** P38
- **Order:** 38
- **Purpose:** Reward ledger and payout integration
- **Exit gate:** Funded allocations, balanced immutable postings, duplicate-safe payment tests and provider approval
- **Dependency:** P36 P37
- **Status:** Blocked by P36/P37 / ledger contract green
- **Implementation status:** Collected-only funding, balanced append-only postings, idempotent payouts, provider gate
- **Owner:** —
- **Origin:** R5 own inventory and rewards extension
- **Verification:** Unverified for production; provider approval missing
- **Evidence:** `docs/REWARD-LEDGER.md`, `chrome/reward-ledger.js`

### Exit gate audit

| Gate item | State |
|---|---|
| Funded allocations | **Green** (collected-only) |
| Balanced immutable postings | **Green** |
| Duplicate-safe payments | **Green** |
| Provider approval | **Missing** |
| Gate met | **Partially** |

Payout keys and provider evidence are idempotent; a paid payout cannot be
released or completed with different evidence. No provider is approved or wired.

## P39 — Monetization pilot and continuing assurance

- **Phase ID:** P39
- **Order:** 39
- **Purpose:** Monetization pilot and continuing assurance
- **Exit gate:** Limited approved rollout, reconciliation, incident kill switch, user support and monitored economics
- **Dependency:** P35 P37 P38
- **Status:** Blocked / no approved rollout or measured economics
- **Implementation status:** Plan/checker ready; rollout 0%, approvals missing, reconciliation pending, support no SLA, economics unmeasured
- **Owner:** —
- **Origin:** R5 own inventory and rewards extension
- **Verification:** Unverified
- **Evidence:** `docs/MONETIZATION-PILOT.md`, `docs/pilot-plan.json`

### Exit gate audit

| Gate item | State |
|---|---|
| Limited approved rollout | **No** (0%) |
| Reconciliation | **Pending** |
| Kill switch | **Green** (tested, Rasha intact) |
| User support | **Draft, no SLA** |
| Monitored economics | **No** |
| Gate met | **No** |

`scripts/pilot-check.cjs` refuses any rollout above 0% without approvals, a
release go, passed reconciliation, ready support and measured economics.
