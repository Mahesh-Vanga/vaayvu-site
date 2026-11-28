# Adaptive performance and tab lifecycle (P18)

P18 covers pressure response, critical-work leases and reproducible RAM/CPU/
energy-proxy traces for tab sleep and wake.

## What ships

- `sleepTab` closes an idle hidden renderer and keeps only its address.
- `sleepIdleTabs` uses `VAAYVU_TAB_SLEEP_MS` (default 5 minutes).
- `reclaimUnderPressure` sleeps the stalest background tabs when app working set
  passes 1.4 GiB (override: `VAAYVU_PRESSURE_BYTES`).
- Active, visible split panes, audible tabs and loading tabs are never slept.
- **Critical-work leases**: `criticalWork` IPC sets a short-lived lease
  (`30 s`–`1 h`, default `5 min`). Leased tabs are skipped by idle sleep and
  pressure reclaim. Leases expire; wake clears them.
- `wakeTab` rebuilds the renderer and reloads the address untouched.

## Measured trace

`windows/test/lifecycle-pressure.cjs` runs in the desktop suite:

```sh
npm --prefix windows test
```

Recorded result (`docs/benchmarks/lifecycle-2026-11-28.json`):

| Field | Value |
|---|---|
| Tabs | 4 |
| Slept under pressure | t1, t3 |
| Lease-protected | t2 |
| Active-protected | t4 |
| Woke | t1 |
| RAM working set | 611,568 KB |
| Heap delta | 2,241,168 bytes |
| CPU | 93.35 ms |
| Elapsed | 304 ms |

The test sets `VAAYVU_PRESSURE_BYTES=1` to force the pressure branch, asserts
that stale unleased tabs sleep, the leased tab and active tab stay alive, then
releases the lease and verifies sleep and wake.

Renderer `close` is stubbed in this harness so Electron can exit cleanly. The
sleep decision, lease protection, active protection, pressure threshold and wake
path are real; the renderer teardown cost is not part of this trace.

## Reproduce

```sh
windows/node_modules/.bin/electron windows/test/lifecycle-pressure.cjs
```

Machine: Apple M5, Node 22.23.2, Electron 45.4.1, 2026-11-28.

## Energy and memory limits

- CPU time is an energy **proxy**; no joule measurement is claimed.
- Working-set and heap delta are snapshots, not peaks or leak proofs.
- A real memory trace needs Instruments/`vmmap` on a built app.

## Exit gate

| Gate item | State |
|---|---|
| Measured pressure response | **Green** (threshold branch + sleep count) |
| Critical-work leases | **Implemented and tested** |
| Reproducible RAM/CPU trace | **Published** |
| Energy trace | **CPU proxy only** |
| Renderer teardown cost | **Not measured** — close stubbed in harness |
| Gate met | **Yes, locally** for pressure/leases/trace; teardown cost open |

P18's lifecycle contracts are green. A full renderer teardown/energy trace is a
recorded measurement gap.
