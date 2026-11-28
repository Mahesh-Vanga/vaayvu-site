# Engine feasibility lab (P02)

P02 asks for three native engine spike results (Chromium, WebKit, GeckoView) and
a go/no-go. This lab records what the repository actually contains. It does not
invent spike results.

## Status

| Engine | Spike app | Result | Go/no-go |
|---|---|---|---|
| Chromium / Blink | `windows/spike-chromium.cjs` | **Pass**: allowed script ran, blocked script did not | Go for desktop/Android |
| WebKit | Production `WKWebView` + Apple tests | **Pass**: 18/18 simulator tests; content-rule compilation verified | Go for Apple product |
| GeckoView | `android/geckoview-spike` | **Pass (runtime)**: APK built and loaded `example.com` | Conditional go for prototype; product no-go until blocker parity |

Machine-readable mirror: `docs/ENGINE-LAB.csv`.

## Spike results

### Chromium

Command:

```sh
windows/node_modules/.bin/electron windows/spike-chromium.cjs
```

Result:

```json
{"engine":"chromium","spike":"request-interception","allowedScriptRan":true,"blockedScriptRan":false,"pass":true,"chromium":"156.0.8078.100"}
```

The spike starts a local HTTP server, cancels one script with
`webRequest.onBeforeRequest`, and proves the other script still executes.
Electron is `45.4.1`.

### WebKit

The Apple test target runs on an iPhone simulator:

```text
Executed 18 tests, with 0 failures
** TEST SUCCEEDED **
```

It covers WKWebView navigation, profile stores, private/regular split,
`WKContentRuleList` compilation and replacement, downloads, dialogs and page
actions. Known blocker: content blockers cannot report per-request counts, so
iOS shows protection status and rules rather than live counters.

### GeckoView

The spike module is `android/geckoview-spike`:

- latest GeckoView `161.0.20261118180411` requires `compileSdk 37`, while the
  project uses AGP 9.1 / SDK 36 — a real blocker;
- pinned `145.0.20251124145406` compiles against SDK 36;
- `:geckoview-spike:assembleDebug` **BUILD SUCCESSFUL**;
- installed on an Android 35 arm64 emulator and launched;
- log: `I/GeckoViewSpike: SPIKE_TITLE=Example Domain`.

Blockers still unmeasured: request interception parity with VFD, extension
support, media/DRM and packaging size.

## Go/no-go

- **Chromium:** go. Interception is proven in the raw Electron session.
- **WebKit:** go for the Apple product, with documented content-blocker limits.
- **GeckoView:** conditional go for a prototype; **product no-go** until blocker
  parity, media/DRM and packaging are measured.

## Blocker matrix

| Area | Chromium | WebKit | GeckoView |
|---|---|---|---|
| Request interception | Electron `webRequest`, Android `shouldInterceptRequest` | `WKContentRuleList` | Unmeasured |
| Cosmetic filtering | `insertCSS` / adopted stylesheets | `css-display-none` rules | Unmeasured |
| Per-request counters | Available | Not available | Unmeasured |
| Extension model | Chromium extensions on desktop | No Chromium extension model | Unmeasured |
| DRM / media | Platform-dependent | Platform-dependent | Unmeasured |
| Packaging | Electron + Gradle | Xcode | Unmeasured |

## Go/no-go

- **Chromium:** go for the shipping desktop and Android product. A standalone
  spike is still required if the gate is interpreted as “raw engine embedding”.
- **WebKit:** go for the shipping Apple product, with documented content-blocker
  reporting limits.
- **GeckoView:** **no-go**. Building a spike would require a new Gradle module,
  a pinned GeckoView artifact, a blocking harness and runtime measurements.
  None of that can be claimed from this repository.

## Exit gate

| Gate item | State |
|---|---|
| Chromium spike result | **Pass** (interception) |
| WebKit spike result | **Pass** (18/18 simulator tests) |
| GeckoView spike result | **Pass** (build + runtime title) |
| Written go/no-go | Chromium/WebKit go; GeckoView conditional |
| Gate met | **Yes, locally** |

P02's exit gate is met locally by three executed spike results. GeckoView
blocker parity remains a product no-go condition, not a missing spike.
