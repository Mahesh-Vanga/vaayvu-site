# Browser domain model and durable data (P04)

P04 asks for tabs/windows/profiles/containers, SQLite, crash journals and
migration, with tested state machines and recovery. This document separates the
**shipping storage** from the **tested reference store** added here.

## Shipping storage today

| Platform | Durable data | Evidence |
|---|---|---|
| Desktop renderer | `localStorage` keys under `vaayvu.*` | `chrome/core.js` |
| iPhone / macOS | `WKWebsiteDataStore`; legacy store copied forward once with a marker | `apple/Sources/ChromeStorage.swift` |
| Android | `SharedPreferences` plus WebView storage | `android/.../BrowserActivity.java` |

Result: profiles, history, settings and recently closed tabs are durable, but
they are **not stored in SQLite**. There is no tab/window/container state machine
in the shipping path, only renderer state and screen-level recovery helpers.

## Tested reference store

`windows/domain/store.cjs` adds a real SQLite domain core using `node:sqlite`:

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

This is a reference layer, **not yet wired into Electron**. The shipping app
continues to use `localStorage`.

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

Migration history:

| Version | Change |
|---|---|
| 1 | Base tables, checks, indexes |
| 2 | `tabs.pinned`, `sessions.recovered` |

## Tested recovery

`tests/domain-store.test.cjs` covers:

1. Migration `1 → 2` preserves existing profile data and adds `pinned`.
2. Illegal tab/window transitions throw; closed is terminal; closed windows
   cannot accept tabs.
3. A simulated crash (close without `endSession`) recovers live tabs as
   `suspended`; a later launch does not recover the same session twice.
4. Containers cannot be attached to another profile; data survives reopen.

## Exit gate

| Gate item | State |
|---|---|
| Tabs/windows/profiles/containers model | SQLite reference schema implemented |
| SQLite | Implemented in `windows/domain/store.cjs` using `node:sqlite` |
| Crash journal | Implemented and tested |
| Migrations | Versioned and tested (`1 → 2`) |
| State machines | Tab and window transitions tested |
| Tested recovery | Unclean-session recovery tested |
| Integrated into shipping browser | **No** — renderer still uses `localStorage` |
| Gate met | **Yes, locally** — all four gate contracts are tested |

P04's gate is met locally by the tested contracts. Product integration remains a
separate engineering change and is tracked as a follow-up, not as phase
evidence.
