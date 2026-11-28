# Comparative performance laboratory (P30)

P30 runs matched-device, same-runtime comparisons across Vaayvu configurations.
It is **not** a comparison against other browsers.

## Method

- One machine, one Node/Electron runtime, one bundled rule database.
- Two warm-up passes, then five measured runs per case.
- Reports median, min/max and coefficient of variation (CV).
- Stability gate: CV ≤ 20% for every case under shared CI load.
- No network, telemetry or remote service.

Command:

```sh
node scripts/comparative-benchmark.cjs --json
```

## Matched-device results

Environment: Apple M5, darwin arm64, Node 22.23.2,
2026-11-28T05:18:19.729Z.

| Case | Group | Median | Range | CV | Throughput |
|---|---|---:|---:|---:|---:|
| vfd-on | adblock | 114.62 ms | 114.01–119.44 ms | 2% | 1,046,939/s |
| vfd-off | adblock | 2.12 ms | 2.11–2.18 ms | 1.2% | 56,490,526/s |
| url-validation | navigation | 33.64 ms | 33.57–33.97 ms | 0.4% | 5,946,091/s |
| spaces-normalize | workspace | 5.52 ms | 5.41–5.64 ms | 1.5% | 9,060,638/s |
| guard-redaction | ai | 4.82 ms | 4.77–4.89 ms | 0.9% | 4,151,279/s |
| guard-injection | ai | 4.36 ms | 4.33–4.44 ms | 1.1% | 4,591,587/s |

Coverage: adblock, navigation, workspace, ai. Stability: **pass** (threshold 20% CV).

The ad-block on/off pair is the only direct comparison. It shows VFD decision
cost against a disabled policy on the same runtime; it does not say another
browser would be faster or slower.

## What is compared

| Comparison | Meaning |
|---|---|
| VFD on vs off | policy cost on the same corpus |
| URL validation | same function across safe/unsafe inputs |
| Spaces normalize | workspace state cost |
| Guard redaction / injection | AI guard cost |

## No misleading comparisons

- No cross-browser speed claim.
- No market-share, battery or thermal claim.
- No device other than the recorded machine.
- Same-runtime only; different Node/Electron builds can differ.
- Official WPT/other-browser results are not mixed in.

## Exit gate

| Gate item | State |
|---|---|
| Matched-device benchmarks | **Green** (one machine/runtime) |
| Coverage | **Green** (adblock, navigation, workspace, ai) |
| Stability | **Green** (all cases ≤ 2.2% CV) |
| No misleading comparisons | **Green** (explicit same-runtime scope) |
| Gate met | **Yes, locally** |

Published JSON: `docs/benchmarks/comparative-2026-11-28.json`.
