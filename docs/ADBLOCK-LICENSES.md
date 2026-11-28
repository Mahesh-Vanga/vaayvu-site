# VAAYVU Ad Block — Licence & SBOM (VFD era)

## Status: original VAAYVU implementation, no third-party filtering code or data

All previously bundled third-party filter data (EasyList/EasyPrivacy extracts,
community hosts files) and their generators were removed and are not present
in this repository. No SponsorBlock code or databases were ever integrated.

## VAAYVU-owned components (all rights reserved by VAAYVU)

| Asset | Description |
|---|---|
| `chrome/vfd.js` | VAAYVU filter compiler + matcher (original code, docs/VFD-FORMAT.md) |
| `chrome/vfd-rules.js` | VAAYVU Filter Database v1 (original rules, each with recorded provenance) |
| `chrome/adblock.js`, `chrome/ad-hosts.js`, `chrome/ad-rules.js`, `chrome/ad-selectors.css` | REMOVED (superseded third-party-derived implementation) |
| `branding/build-ad-hosts.py`, `branding/build-ad-rules.py` | REMOVED (generated the old third-party datasets) |
| `windows/policy.cjs` VFD matcher, `windows/host.cjs` integration, `windows/test/vfd.cjs`, `windows/test/policy.test.cjs` VFD cases | Original VAAYVU code + tests |
| Android `TrackerProtection` VFD matcher, `BrowserActivity`/`BrowserTab`/`PagePrivacy` integration, `VfdTest` | Original VAAYVU code + tests |
| iOS `compileAdBlock` VFD path, `BrowserHost` integration, `NavigationTests` VFD case | Original VAAYVU code + tests |
| `docs/VFD-FORMAT.md`, `docs/VFD-ENGINE.md`, `docs/VFD-MAINTENANCE.md` | Original documentation |

## References studied, not incorporated

Chromium, Brave `adblock-rust` (architecture reference only), Brave Shields,
uBlock Origin, uAssets, AdGuard, EasyList, EasyPrivacy, Fanboy lists,
someonewhocares.org, Peter Lowe's list, StevenBlack/hosts, filterlists.com,
webosbrew/youtube-webos and this repo's `youtube-webos` fork (GPL-3.0-only —
concepts studied only; **no code copied into VAAYVU**), SponsorBlock
(never integrated; no authorization sought or granted).

BLUF: the VFD rule database was written by hand for this project. It was not
generated from, converted from, or systematically reproduced from any of the
above lists. Where a well-known ad-server hostname also appears in those
lists, that is a fact about the server, not copied expression — and every VFD
rule carries its own independent evidence trail.

## 0.0.15 cleanup

The legacy on-device fallback list (`chrome/tracking.json`, enforced only
when VFD ad blocking is off) no longer names any other browser vendor: the
Brave/rewards entries were deleted. The remaining hosts are generic ad,
analytics and tracker domains, also covered by VFD’s own rules.

## Historical record

Intermediate builds (0.0.8–0.0.14) bundled generated third-party datasets
(EasyList dual GPLv3/CC BY-SA with attribution "The EasyList authors
(https://easylist.to/)"; StevenBlack MIT notice obligation). Those files and
their generators are deleted from the tree. To the extent any such build was
distributed, the corresponding attribution and notice obligations from that
time continue to be recorded here.
