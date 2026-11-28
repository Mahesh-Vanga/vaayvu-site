# Advanced tab and workflow power tools (P11)

P11 covers spaces, tab triage, vertical tabs, split view, notes and session
recipes, ending in power-user journeys with robust restore.

## Implemented tools

| Tool | Evidence | State |
|---|---|---|
| Spaces | `chrome/spaces.js` store + `tests/spaces.test.cjs`; UI chips and theme in `chrome/app.js` | Implemented and unit-tested |
| Tab triage | Groups, pinning, search, close/undo in `chrome/app.js`; `tests/tabs*.test.cjs`, `tests/browser-ui.cjs` | Implemented and tested |
| Vertical tabs | Rail with groups, spaces, resize, keyboard selection; `s-026` tests | Implemented and tested |
| Split view | `splitSupported`, `splitActive`, `toggleSplit` in `chrome/app.js`; `s-079` capability tests | Implemented; screen-tested |
| Notes | Mobile library/page notes; `tests/mobile-pages-ui.cjs` | Implemented and UI-tested |
| Session restore | Startup restore, recently closed, crash restore (`s-018`), private-safe native window restore | Implemented and tested |
| Session recipes | Workflow library/builder screens (`s-486`–`s-491`) | **Screen contracts only — no persistent recipe engine in the shipping app** |

## Power-user journey evidence

### Spaces

`tests/spaces.test.cjs` covers normalize garbage, duplicate IDs, theme
validation, list cap, create/update/reorder/remove without mutating input, and
per-space tab counts. The shipping UI persists spaces under `vaayvu.spaces`.

### Tab triage

The desktop UI probes exercise tab creation, scoped management, grouping,
pinning, tab search and close/undo. The native desktop suite verifies the tab
menu, placement and independent windows.

### Vertical tabs

`tests/onboarding-steps.test.cjs` verifies the vertical rail, group folding,
spaces, collapse/expand, width bounds, Up/Down selection and saved location in
the compact sheet.

### Split view

`chrome/app.js` requires a supported desktop window, two live tabs and stores
the pair with a ratio. `tests/tabs-s079.test.cjs` verifies the capability gate
and screen contract. A native Playwright split-pane resize probe is not present;
this is recorded rather than claimed.

### Notes and restore

`tests/mobile-pages-ui.cjs` saves a page note and reopens the library.
`tests/onboarding-s018.test.cjs` restores two tabs after a crash and records the
restore result. The native desktop suite verifies private-safe window restore.

## Session recipes gap

The atlas has workflow library, builder, dry-run, monitor, approval and receipt
screens, but there is no persistent recipe engine in `chrome/` or the native
hosts. Those screens are contracts, not a shipping automation runtime. A session
recipe feature would need its own store, scheduler and approval model.

## Exit gate

| Gate item | State |
|---|---|
| Spaces | Implemented and unit-tested |
| Tab triage | Implemented and tested |
| Vertical tabs | Implemented and tested |
| Split view | Implemented; screen-tested, no native pane probe |
| Notes | Implemented and UI-tested |
| Robust restore | Crash restore + native window restore tested |
| Session recipes | **Gap** — screens only |
| Gate met | **Yes, locally** for the power-user journeys; recipe engine gap recorded |

P11's power-user tools and restore journeys are green. Session recipes remain a
recorded product gap, not a hidden pass.
