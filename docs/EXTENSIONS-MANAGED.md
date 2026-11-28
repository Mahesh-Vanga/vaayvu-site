# Extensions and managed deployments (P12)

P12 covers desktop extensions, permission review and enterprise controls. The
shipping extension runtime is deliberately narrow: CSS-only style packages.

## Compatibility matrix

Machine-readable: `docs/EXTENSION-MATRIX.csv`.

| Feature | Desktop | Android | iOS | Status |
|---|---|---|---|---|
| CSS-only MV3-style style extension | Yes | Yes | Yes | Supported |
| Exact HTTPS site matching | Required | Required | Required | Supported |
| Wildcard / `<all_urls>` | Rejected | Rejected | Rejected | Unsupported |
| Content-script JavaScript | Rejected | Rejected | Rejected | Unsupported |
| Network-capable CSS (`url`, `@import`, `var`, escapes) | Rejected | Rejected | Rejected | Unsupported |
| Chrome Web Store install | No | No | No | Unsupported |
| Native messaging / service worker | No | No | No | Unsupported |
| Private-window application | Never | Never | Never | Blocked |
| Safe-mode bulk disable | Yes | Yes | Yes | Supported |
| Enterprise policy enforcement (MDM/GPO/plist) | Screens only | Screens only | Screens only | **Gap** |

## Extension security review

The installer (`chrome/extensions.js`) enforces:

- Manifest V3 shape, bounded name/version/description and 1–16 CSS records.
- HTTPS-only, exact-host matches; wildcards and `<all_urls>` rejected.
- CSS files only; `js`, `all_frames`, remote permissions and non-style
  permissions rejected.
- A fixed CSS property allowlist; `url()`, `@import`, `var()`, escaped
  identifiers, attribute selectors and malformed declarations rejected.
- ZIP smaller than 256 KB, at most 40 files, 32 KB per entry and 96 KB total
  expanded, no encryption.
- Private tabs never receive extension CSS.
- Safe mode disables every installed style package without deleting it.
- Review dialog shows the package name and rules before install; replacement is
  explicit.

Coverage: `tests/extensions.test.cjs` exercises install, exact-site scoping,
private-tab exclusion, unsupported feature rejection, CSS rejection and
safe-mode disable.

## Enterprise controls

Atlas screens `s-582`–`s-599` cover policy overview, conflicts, extensions,
startup, network, enrollment, kiosk, audit, diagnostics, downloads, printing,
bookmarks, passwords, safe browsing, updates, compliance and removal. They are
**screen contracts**, not a managed-policy runtime.

Missing for real managed deployment:

- MDM/GPO/plist or Android managed-configuration ingestion;
- policy signature/version validation and conflict resolution in the host;
- kiosk enforcement outside the screen contract;
- enterprise audit export and enrollment.

## Exit gate

| Gate item | State |
|---|---|
| Compatibility matrix | **Implemented** (`docs/EXTENSION-MATRIX.csv`) |
| Extension security review | **Implemented** and tested |
| Style-extension runtime | Tested across desktop, Android and iOS shared chrome |
| Enterprise controls | **Screen contracts only** — no MDM/GPO enforcement |
| Gate met | **Partially** — matrix and security review green; enterprise runtime gap |

P12's named gate is met for the extension matrix and security review. Managed
deployment enforcement is a recorded gap, not a claimed feature.
