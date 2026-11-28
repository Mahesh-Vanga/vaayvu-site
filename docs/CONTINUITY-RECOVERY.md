# Continuity, migrations and recovery (P23)

P23 covers encrypted sync, crash/fault injection, verified backup/restore and a
private sentinel. Fault recovery and the sentinel are green; end-to-end sync
encryption is not implemented.

## Encrypted sync

| Layer | State |
|---|---|
| Transport | TLS required beyond loopback; loopback HTTP allowed |
| Password verifier | Salted scrypt |
| Session tokens | SHA-256 hashed |
| Bookmark/tab payload | **Server-readable — no end-to-end encryption** |
| Client-side vault | AES-256-GCM reference (`windows/vault.cjs`), not wired to sync |

Transport encryption and credential hashing exist. End-to-end payload
encryption does **not**; a server operator can read regular URLs and titles.
This is the remaining gate gap.

## Crash and fault injection

| Fault | Test |
|---|---|
| Unclean session → tabs suspended, no repeat recovery | `tests/domain-store.test.cjs` |
| Migration `1 → 2` preserves rows | `tests/domain-store.test.cjs` |
| Rejected sync batch leaves snapshot intact | `sync/recovery.test.mjs` |
| Corrupt SQLite fails closed | `sync/recovery.test.mjs` |
| Server restart preserves offline catch-up | `sync/recovery.test.mjs` |
| Out-of-order writes / deletion ties | `sync/recovery.test.mjs` |
| Pressure sleep/lease/wake | `windows/test/lifecycle-pressure.cjs` |
| Quota failure preserves old settings | `tests/network-storage.test.cjs` |

## Backup and restore

- Sync backup: stop the service, copy the database, reopen; multi-device state
  and bookmarks restore (`sync/recovery.test.mjs`).
- Release rollback: 6/6 artifacts verified, previous DMG checked
  (`docs/releases/ROLLBACK-DRILL.md`).
- Domain store migration preserves rows across versions.

## Private sentinel

`sync/privacy-sentinel.test.mjs` uses a unique sentinel URL on a private page:

- private tab sync is rejected with 400;
- private page handoff is rejected with 400;
- private Ask is rejected with 400;
- the sentinel is absent from **every** SQLite file (main, WAL, SHM) and from
  the returned snapshot;
- a regular URL in the same request is stored and returned.

Result: the private sentinel never reaches sync storage or the wire.

## Exit gate

| Gate item | State |
|---|---|
| Encrypted sync | **Transport TLS only; E2E payload encryption missing** |
| Crash/fault injection | **Green** |
| Verified backup/restore | **Green** |
| Private sentinel absent | **Green** |
| Gate met | **Partially** — E2E sync encryption is the blocker |

P23 cannot be marked fully green until sync payloads are encrypted
end-to-end (or the program explicitly accepts TLS-only as the definition).
