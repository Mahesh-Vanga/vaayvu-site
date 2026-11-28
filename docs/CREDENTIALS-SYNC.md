# Credentials, synchronization and backup (P10)

P10 covers passkeys/OS credential stores, encrypted sync and recovery. The
recovery and data-loss chaos gate is executable; end-to-end encryption and
passkey verification remain recorded gaps.

## Credentials

| Area | State |
|---|---|
| Passkeys / WebAuthn | Delegated to the platform engine (Chromium, WKWebView, Android WebView). No custom credential vault. |
| OS password manager | The settings UI points to the device credential settings; the browser does not store passwords itself. |
| Sync account password | Salted `scrypt` verification on the server. |
| Session tokens | Stored as hashes; 30-day sessions; logout revokes the token. |
| Sync payload | Readable by the server operator; transport must be TLS. **No end-to-end encryption.** |

The server never stores a plaintext password. `sync/server.mjs` uses `scrypt`
with a per-account salt and compares in constant time; session tokens are
SHA-256 hashed in SQLite.

Passkeys are an engine/platform feature, not an app-level keychain. That is
honest but not equivalent to an independently tested credential vault.

## Synchronization

`sync/README.md` documents the service:

- bookmarks merge by `updatedAt`; deletion wins ties; tombstones survive for
  offline devices;
- each device owns its tab snapshot; private pages are rejected;
- the server stores regular URLs and titles in SQLite; the operator can read
  them;
- TLS is required beyond loopback; Docker Compose provides automatic HTTPS;
- password auth, hashed tokens, rate limits and device/bookmark caps are
  enforced.

Encryption boundary:

| Layer | State |
|---|---|
| Transport | TLS required beyond loopback |
| Password at rest | Salted scrypt verifier only |
| Session tokens at rest | Hashed |
| Bookmark/tab payload at rest | **Not encrypted** — server-readable |
| End-to-end encryption | **Not implemented** |

## Backup and restore

The documented safe backup is: stop the service, copy its data directory,
restart. Restore by replacing the directory with permissions restricted to the
service user. The database defaults to `sync/data/vaayvu.sqlite`.

## Multi-device recovery and chaos tests

New `sync/recovery.test.mjs` (4 tests):

1. **Offline catch-up across restart** — a phone that was offline receives new
   bookmarks and the deletion tombstone after the server restarts.
2. **Backup restore** — a stopped-service database copy restores both devices
   and all bookmarks.
3. **Rejected batch + corrupt database** — an invalid bookmark batch leaves the
   previous snapshot intact; a corrupt database fails closed instead of serving
   empty data.
4. **Out-of-order writes and deletion ties** — older timestamps do not win;
   a deletion at the same timestamp wins.

Execution:

```text
node --test sync/*.test.mjs
# tests 7, pass 7, fail 0
```

That includes the original 3 sync tests plus these 4 recovery/chaos tests.

## Exit gate

| Gate item | State |
|---|---|
| Passkeys / OS credential store | Platform-delegated, not independently verified |
| Encrypted sync | TLS + hashed credentials; **no E2E payload encryption** |
| Backup | Documented and restore-tested |
| Multi-device recovery | **Tested** across restart |
| Data-loss chaos tests | **Tested**: rejected batch, corrupt DB, tombstones, ordering |
| Gate met | **Yes, locally** for recovery/chaos; encryption and passkey gaps recorded |

P10's named exit gate is green. End-to-end payload encryption and an independent
passkey test are not claimed.
