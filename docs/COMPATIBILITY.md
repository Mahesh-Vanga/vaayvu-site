# Developer tools and standards compatibility (P29)

P29 covers native tooling, a standards corpus, website tasks and explicit
unsupported cases.

## Native tooling

| Platform | Tooling | Evidence |
|---|---|---|
| Desktop (Electron) | Chromium DevTools, remote inspection | `tests/inspector-ui.cjs` (mac + windows) |
| Android | `ChromiumInspectionActivity` remote DevTools | `tests/inspector-ui.cjs` (android) |
| Apple | `WKWebView.isInspectable` + Safari Develop | `tests/inspector-ui.cjs` (ios) |

Inspection is explicit per tab and can be revoked.

## Standards corpus (WPT-style, not official WPT)

`tests/fixtures/standards.html` + `tests/standards-ui.cjs` exercise:

- WHATWG URL parsing and IDN (`https://例え.テスト/` → punycode);
- `URLSearchParams`;
- `Intl.NumberFormat` (`de-DE` → `1.234,5`);
- `<dialog>` + `showModal`/`close`;
- `ResizeObserver`;
- Web Animations (`Element.animate`);
- CSS grid and logical properties (`margin-inline-start: 12px`);
- `CSS.supports`;
- required-field form validation;
- origin-scoped `localStorage`.

Result: **PASS**.

This is a **WPT-style subset**, not a run of the official web-platform-tests
suite. No official WPT checkout, harness or pass rate is claimed.

## Website task corpus

The corpus represents common site tasks:

| Task | Coverage |
|---|---|
| URL/IDN navigation | URL parser test |
| Form validation and submit readiness | required field test |
| Modal dialogs | `<dialog>` test |
| Responsive layout | grid + logical property test |
| Local storage | same-origin get/set |
| Rich media | engine playback (not device-verified, P27) |
| Downloads/uploads | host handlers (P26/P19) |

## Explicit unsupported cases

| Case | Status |
|---|---|
| Official WPT pass rate | **Not run** |
| DRM / EME beyond platform engine | screens only |
| JavaScript extensions / store packages | rejected (P12/P28) |
| PWA install/offline runtime | missing (P28) |
| WebUSB / WebSerial / WebHID | not product features |
| Screen share / WebRTC calls | missing (P27) |
| Legacy NPAPI/PPAPI plugins | never supported |

## Exit gate

| Gate item | State |
|---|---|
| Native tooling | **Green** |
| WPT subset | **WPT-style corpus only; official WPT missing** |
| Website task corpus | **Partial** (core tasks, no media/device matrix) |
| Explicit unsupported cases | **Documented** |
| Gate met | **Partially** — official WPT is the blocker |

P29 is green for native tooling and the local standards corpus. An official WPT
run is still required for the named gate.
