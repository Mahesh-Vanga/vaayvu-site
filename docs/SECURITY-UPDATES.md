# Security, credentials and update integrity (P21)

P21 covers hostile-page isolation, a secure vault, permissions and signed-update
evidence.

## Hostile-page isolation (executed)

`windows/test/hostile-isolation.cjs` is part of the desktop suite. It opens a
real HTTP page and evaluates from that page:

```json
{"bridge":{"process":"undefined","require":"undefined","bridge":"undefined","electron":"undefined","nodeGlobals":"undefined"},
 "storage":{"hostile":"1","chromeSettings":null},
 "permission":"denied by session handler",
 "chromeHealthy":true}
```

Meaning:

- no `process`, `require`, Electron global or chrome bridge in the page;
- the page can use storage for **its own origin**, but cannot read
  `vaayvu.settings` from the chrome origin;
- permission requests are denied by the session handler;
- the chrome UI stays healthy after the page runs.

## Secure vault

`windows/vault.cjs` is a reference credential vault:

- AES-256-GCM authenticated encryption;
- scrypt key derivation (`N=16384, r=8, p=1`, 32-byte key, random 16-byte salt);
- random 12-byte IV per save;
- file mode `0600` and no plaintext credentials in the file;
- HTTPS-only origins, bounded username/notes;
- wrong passphrase or tampered ciphertext fails closed;
- lock zeroes the key and clears entries.

Tests: `tests/vault.test.cjs` (plaintext absence, reopen, wrong passphrase,
tamper detection, lock, HTTPS-only).

**Gap:** the vault is not wired into a shipping credential UI. The product still
delegates passkeys to platform WebAuthn and points users at the OS password
manager.

## Permissions

| Control | Evidence |
|---|---|
| Session requests denied by default | `setPermissionRequestHandler`, `setPermissionCheckHandler` |
| Native site permissions | Android `SitePermissions`, Apple `WKUIDelegate` flows |
| Private tabs | no persisted permission grants |
| Hostile geolocation | denied by the session handler |

## Signed-update evidence

- macOS DMG/PKG signed and verified (`verify:mac`).
- Windows PE/ASAR/fuses verified (`verify`).
- Release manifest with SHA-256 for every artifact
  (`docs/releases/0.0.23.json`).
- Rollback drill 6/6 artifacts (`docs/releases/ROLLBACK-DRILL.md`).

Notarization and store review remain external gaps (P16).

## Exit gate

| Gate item | State |
|---|---|
| Hostile page isolation | **Green** (E2E) |
| Secure vault | **Reference implementation tested**; not wired |
| Permission evidence | **Green** |
| Signed-update evidence | **Green** |
| External hostile lab | **Gap** (P08 external) |
| Gate met | **Yes, locally** for isolation/vault/permissions/signing |

P21 is green at the contract level. Vault integration and an external
penetration lab are recorded gaps.
