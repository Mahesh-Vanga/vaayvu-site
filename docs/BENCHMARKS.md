# Published benchmark results (P14)

P14 measures the browser's pure local hot paths with no network, telemetry or
uploads. Results are published here and in
`docs/benchmarks/2026-11-28.json` for regression comparison.

## Run

```sh
node scripts/benchmark.cjs --json > current.json
node scripts/benchmark-compare.cjs docs/benchmarks/2026-11-28.json current.json
```

Environment:

| Field | Value |
|---|---|
| Product | Vaayvu 0.0.23 |
| CPU | Apple M5 |
| Platform | darwin arm64 |
| Node | 22.23.2 |
| Date | 2026-11-28T04:33:06.026Z |

## Results

| Case | Iterations | Wall time | Throughput | CPU time |
|---|---:|---:|---:|---:|
| VFD decisions | 120,000 | 127.48 ms | 941,342/s | 138.28 ms |
| URL validation | 200,000 | 35.81 ms | 5,585,747/s | 37.59 ms |
| Spaces normalize | 50,000 | 9.18 ms | 5,443,757/s | 15.13 ms |
| AI guard redaction | 20,000 | 5.89 ms | 3,397,965/s | 7.19 ms |

Heap delta: **418,720 bytes**. This is a delta, not a peak
or a leak measurement.

## What is measured

- **VFD decisions** — `vfd.decide` across ad, tracker and clean URLs with the
  bundled rule database.
- **URL validation** — `webURL` on safe, script, credential and loopback inputs.
- **Spaces normalize** — workspace state normalization.
- **AI guard redaction** — secret redaction over a mixed page/credential string.

## Energy and low memory

- CPU time is reported as an **energy proxy**. No joule measurement is claimed:
  macOS `powermetrics` needs elevated privileges and was not run.
- The benchmark runs once, locally, with no timers left behind and no network.
- Heap delta is informational. A real leak or peak-memory claim needs a
  dedicated Instruments/`vmmap` run.

## Regression gate

`scripts/benchmark-compare.cjs` fails when a case is more than 20% slower than
the baseline (configurable with `--threshold=`). Compare on the same machine;
absolute numbers vary by CPU, Node and thermal state.

## Reproducibility notes

- The rule database and source tree are part of the repository; no downloads.
- Warm-up is implicit because the same functions are exercised across large
  loops. Treat the first run on a cold machine as a smoke run and repeat once.
- This is a published baseline, not a claim of universal performance.
