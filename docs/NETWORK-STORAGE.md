# Efficient networking and storage (P19)

P19 covers transport validation, origin-safe caches, disk-full recovery and data
preservation.

## Transport

| Rule | Evidence |
|---|---|
| Only bounded `http:`/`https:` URLs | `windows/policy.cjs` `website`; `chrome/core.js` `webURL` |
| Credentials in URLs rejected | `website` and `webURL` |
| Control characters, whitespace and backslashes rejected | `webURL` hardening (P08) |
| Sync requires TLS or loopback HTTP | `syncDestination` |
| Proxy/TLS certificate handling | Electron session defaults; certificate-error screen |

Encrypted DNS is a screen contract (`s-382`) and is **not** wired to a DoH
resolver in this repository.

## Origin-safe caches and storage

- Regular browsing uses `persist:vaayvu-web`.
- Private browsing uses a fresh `vaayvu-private-<uuid>` session per window.
- Private close clears storage and cache (`clearStorageData`, `clearCache`).
- Cookies-only clearing is separate from cache clearing.
- Android profiles use separate WebView/profile storage; Apple uses a separate
  `WKWebsiteDataStore`.
- Cross-origin reads rely on the engine's same-origin policy; the browser does
  not expose one origin's storage to another.

## Disk-full recovery

`chrome/storage.js` is the quota-safe layer used by the chrome UI:

- `write` catches `QuotaExceededError`/unavailable storage and returns
  `{ok:false, reason}`;
- the previous value stays intact because the failed `setItem` never commits;
- `read` falls back on corrupt JSON;
- storage keys use the Vaayvu prefix only;
- the UI shows “Device storage is full or unavailable.” and keeps the old setting.

Tested with a fake storage that throws on a target key: the old value is read
back unchanged, and other keys still write.

## No data loss

- Quota failure preserves the previous setting.
- Domain-store migrations preserve SQLite rows (P04).
- Sync recovery preserves offline changes, tombstones and backups (P10).
- Failed downloads are not counted as completed; release manifests keep hashes
  (P16).

## Gaps

- No OS-level disk-full run (filling a real volume) is performed; the recovery
  path is tested by injecting `QuotaExceededError`.
- No DoH resolver is implemented; the screen is a contract.
- No byte-level cache-origin probe is run; partitioning and clear paths are
  verified in source and native session setup.

## Exit gate

| Gate item | State |
|---|---|
| Transport | **Verified** (bounded HTTP(S), TLS sync) |
| Origin-safe caches | **Implemented** and source-verified |
| Disk-full recovery | **Tested by quota injection**; OS-level run missing |
| No data loss | **Tested** across quota failure, migrations and sync recovery |
| Gate met | **Yes, locally** for transport/cache/recovery logic |

P19's contracts are green. A real full-disk experiment and DoH implementation
remain recorded gaps.
