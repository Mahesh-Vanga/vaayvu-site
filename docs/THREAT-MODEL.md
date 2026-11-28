# Privacy, security and protection depth (P08)

P08 covers the threat model, ad blocking, reputation signals and private/storage
boundaries. The security gate is executable; external hostile-site testing is a
separate activity and is not claimed without a third-party report.

## Assets

- passwords and passkeys, payment data, cookies and site storage;
- history, downloads, bookmarks, open tabs and session restore;
- private-window state and per-profile/container partitions;
- reward ledger, payout tokens and advertiser contracts;
- update channel and application integrity.

## Trust boundaries

| Boundary | Rule |
|---|---|
| Website content → browser chrome | Page content never controls chrome, IPC or files |
| Renderer → Electron main | Context isolation, sandbox, no Node in page frames |
| Regular ↔ private | Separate web sessions; private teardown clears state |
| Profile ↔ profile | Separate stores; no cross-profile reads |
| Browser ↔ sync service | Optional, account-bound, no silent upload |
| Update → install | Signed package, ASAR integrity, hardened fuses |

## Threat model

| Threat | Mitigation | Evidence |
|---|---|---|
| `javascript:`/`data:`/`file:` navigation | `webURL` allows only `http:`/`https:`, rejects credentials, control characters, backslashes and oversized URLs | `chrome/core.js`, `scripts/security-gate.cjs`, hostile corpus |
| Hostile page reaches Electron APIs | `sandbox`, `contextIsolation`, no `nodeIntegration`, no `webviewTag`, deny popups/navigation | `windows/host.cjs` |
| Permission abuse (camera, mic, location) | Session permission handlers deny; site permission prompts are explicit | `windows/host.cjs`, `SitePermissions` |
| Drive-by download | `will-download` only for enabled website tabs; quarantine screens | `windows/host.cjs`, download screens |
| Tracker/ad payload | VFD deterministic precedence; protected apexes cannot be broken | `docs/VFD-ENGINE.md` |
| Private data leaks | Private session per window; storage cleared on teardown; separate Apple store and Android profiles | host, `ChromeStorage`, Android profiles |
| Chrome UI compromised by page | CSP `default-src 'none'`, no objects/frames/forms, self scripts only | `chrome/index.html` |
| Certificate/redirect deception | Certificate error screen and redirect inspector | `tests/content-s102.test.cjs`, atlas screens |
| Supply-chain/update tamper | Signed mac package, ASAR digest, hardened fuses, Windows verifier | `verify:mac`, `verify` |
| Secret leakage in CI | read-only workflow, no `secrets.*`, ignored key/keystore/env files | security gate |

## Hostile-input corpus

`tests/fixtures/hostile-urls.json` holds rejected and accepted URL cases. The
gate runs them through the same `webURL` used for navigation.

Executed:

```text
Vaayvu security gate passed: Electron flags, CSP, permissions, private
partition, CI/secrets and hostile URL inputs.
```

This is hostile **input** testing, not a third-party hostile-site audit. A real
external test still has to exercise live malicious pages, IDN/phishing, exploit
chains and the platform WebViews.

## Security gate

```sh
node scripts/security-gate.cjs
```

Checks:

- Electron hardening flags and deny-by-default UI navigation/popups;
- permission request/check handlers;
- private session partitioning;
- CSP directives;
- CI read-only permissions and absence of repository secrets;
- ignored key/keystore/provisioning/env files;
- the hostile URL corpus and oversized URL rejection.

Wired into the CI `checks` job.

## Residual risks

- External penetration testing and live hostile-site campaigns are **not**
  performed by this repository.
- Android ships WebView (Chromium), not GeckoView; iOS uses WKWebView with
  content-blocker reporting limits.
- The Android internal release is signed with the Vaayvu keystore (new identity; upgrades from the old package ID require a fresh install).
- Sync is optional; its server hardening is covered by `sync/` tests, not by
  this gate.

## Exit gate

| Gate item | State |
|---|---|
| Threat model update | Implemented in this document |
| Ad blocking / VFD | Implemented and tested |
| Reputation / phishing screens | Implemented in atlas and tests |
| Private/storage boundaries | Implemented and checked |
| Security gate | **Green locally** |
| External hostile-site testing | **Not performed** — needs a third-party report |
| Gate met | **Partially** |

The local security gate is green. P08 stays unverified for the external
hostile-site half until a real external run is attached.
