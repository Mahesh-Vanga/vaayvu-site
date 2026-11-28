# Browser domain model and durable data (P04)

P04 asks for tabs/windows/profiles/containers, SQLite, crash journals and
migration, with tested state machines and recovery. This document records the
**shipping storage** and the **tested domain store** behind it.

## Shipping storage today

| Platform | Durable data | Evidence |
|---|---|---|
| Desktop renderer | SQLite `key_values` table in `vaayvu.sqlite`, through the synchronous `VaayvuStore` bridge | `windows/host.cjs`, `windows/preload.cjs`, `chrome/native-store.js` |
| iPhone / macOS | `WKWebsiteDataStore`; legacy store copied forward once with a marker | `apple/Sources/ChromeStorage.swift` |
| Android | `SharedPreferences` plus WebView storage | `android/.../BrowserActivity.java` |

The Electron UI keeps the Web Storage API, but `chrome/native-store.js` swaps
`window.localStorage` for a shim before `boot.js` runs. Reads and writes go to
SQLite through `ipcRenderer.sendSync`; values that existed before the bridge are
imported once and never overwrite newer SQLite state. Outside Electron the
bridge is absent and the normal localStorage path remains for tests and web
preview. Aggregate renderer keys (`vaayvu.tabs`, `vaayvu.history`,
`vaayvu.settings`, …) are therefore durable in SQLite. The tab/window/container
tables are still contract-tested rather than populated by the renderer.

## Domain store

`windows/domain/store.cjs` provides the SQLite domain core using `node:sqlite`:

- tables: `profiles`, `containers`, `windows`, `tabs`, `sessions`,
  `crash_journal`, `schema_migrations`;
- foreign keys enabled; containers cannot cross profiles;
- tab state machine: `opening → live → suspended → live`, any non-closed →
  `closed`, `closed` terminal;
- window state machine: `open ↔ minimized`, any non-closed → `closed`;
- statement-based migrations with `schema_migrations`;
- a crash journal for every open/transition/recovery event;
- recovery: an unclean session's non-closed tabs become `suspended` and are
  returned; recovered sessions are marked so recovery is not repeated;
- durable reopen test: title, URL, pinned flag and container survive.

The Electron storage bridge writes renderer state into the `key_values` table
of the same database, so app data now lives in SQLite rather than Chromium
localStorage.

## Schema

| Table | Purpose |
|---|---|
| `profiles` | Browser profile identity |
| `containers` | Profile-scoped container (name, colour) |
| `windows` | Window state and optional container |
| `tabs` | Tab state, URL, title, position, pin, owning session |
| `sessions` | Clean/ended and recovered markers |
| `crash_journal` | Append-only events with session and tab references |
| `schema_migrations` | Applied migration versions |
| `key_values` | Durable renderer state, keyed exactly as the Web Storage API |

Migration history:

| Version | Change |
|---|---|
| 1 | Base tables, checks, indexes |
| 2 | `tabs.pinned`, `sessions.recovered` |
| 3 | `key_values` for the shipping renderer bridge |

## Tested recovery

`tests/domain-store.test.cjs` covers:

1. Migration `1 → 2` preserves existing profile data and adds `pinned`.
2. Illegal tab/window transitions throw; closed is terminal; closed windows
   cannot accept tabs.
3. A simulated crash (close without `endSession`) recovers live tabs as
   `suspended`; a later launch does not recover the same session twice.
4. Containers cannot be attached to another profile; data survives reopen.
5. Key-value writes persist across reopen; legacy import only fills missing keys
   and never overwrites newer SQLite state (`tests/domain-store.test.cjs`).
6. The renderer shim imports legacy keys once, then reads, writes, enumerates and
   clears through the bridge, and stays a no-op outside Electron
   (`tests/native-store.test.cjs`, `tests/domain-bridge.test.cjs`).

## Exit gate

| Gate item | State |
|---|---|
| Tabs/windows/profiles/containers model | SQLite reference schema implemented |
| SQLite | Implemented in `windows/domain/store.cjs` using `node:sqlite` |
| Crash journal | Implemented and tested |
| Migrations | Versioned and tested (`1 → 2`) |
| State machines | Tab and window transitions tested |
| Tested recovery | Unclean-session recovery tested |
| Integrated into shipping browser | **Yes** — Electron renderer state is written to SQLite `key_values`; pre-bridge localStorage is imported once |
| Native shipping assertion | **Yes** — `windows/test/domain-store.cjs` proves `localStorage` is the SQLite shim (`instanceof Storage` is false), the key lands in `key_values`, and removal deletes it |
| Gate met | **Yes, locally** — domain contracts and shipping bridge are tested |

P04's gate is met locally: the domain contracts are tested and the Electron
renderer now persists through SQLite rather than Chromium localStorage.
