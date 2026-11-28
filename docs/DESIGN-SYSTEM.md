# Design system and navigation prototypes (P03)

P03 covers the original brand, glass guidance, responsive layouts and
accessibility foundations. The token package is executable evidence; the
prototype results are recorded, not invented.

## Token package

`design/tokens.json` is the machine-readable package. It is not a copy that can
drift: `scripts/check-tokens.cjs` parses `chrome/styles.css` and fails when any
token value differs.

```sh
node scripts/check-tokens.cjs
```

Contents:

| Group | Tokens |
|---|---|
| Color, light and dark | `bg surface surface-glass text text-secondary muted line line-soft tint accent accent-soft accent-hover rail rail-soft` |
| Radius | `radius-sm radius-md radius-lg radius-xl` |
| Layout | `side` |
| Shadow | `shadow-sm shadow-md shadow-lg` |
| Motion | reduced-motion duration |
| Typography | system family stack |

Values are sourced from the `:root` and `:root[data-theme="dark"]` blocks in
`chrome/styles.css`. The dark theme, focus-visible outline and
`prefers-reduced-motion` rule are required by the checker.

## Original brand

| Asset | Path |
|---|---|
| Primary mark | `branding/vaayvu-mark.svg` |
| Transparent vector | `branding/Vaayvu_16K_Vector_Transparent.svg` |
| Wind monogram | `branding/Vaayvu_V_Wind_16K.svg` |
| App icons | `branding/vaayvu-appicon.png`, `branding/vaayvu-1024.png` |
| Export scripts | `branding/export-icons.cjs`, `branding/export-app-icons.cjs` |

The brand is a V/wind mark; the UI accent is blue (`#0071e3` light,
`#0a84ff` dark), not an arbitrary gradient.

## Glass guidance

Glass surfaces live in `chrome/liquid.css`, not scattered through the main
stylesheet. The glass tokens are fill, rim, edge, glint, depth and shadow, with
separate light and dark values.

Rules:

1. Glass is a surface treatment, not a substitute for contrast. Text keeps
   `--text` on a glass fill that meets the light/dark pair.
2. Glass is limited to chrome (toolbar, panels, sheets), never page content.
3. A glass control keeps a solid focus ring; blur must not remove focus.
4. When reduced motion is requested, glass transitions collapse with every other
   transition.
5. High contrast disables decorative glass treatments where the stylesheet
   already scopes them.

## Responsive layout

Breakpoints in `chrome/styles.css`:

| Width / capability | Behavior |
|---|---|
| `min-width: 1500px` | Expanded desktop chrome |
| `min-width: 761px` and fine pointer | Pointer-driven desktop layout |
| `761px–1050px` | Compact desktop layout |
| `max-width: 760px`, or coarse pointer under 1024×540 | Mobile layout |
| `max-width: 420px` | Narrow phone adjustments |
| `hover: none` | Touch-safe controls |

Layout tokens (`--side`) and the mobile stylesheet (`chrome/mobile.css`) keep
the same semantic structure across widths.

## Accessibility foundations

- Global `:focus-visible` outline for buttons, links, inputs, selects and
  textareas.
- `@media (prefers-reduced-motion: reduce)` collapses animation, transition and
  smooth scrolling, plus a `.reduce-motion` class for explicit control.
- Dark theme via `data-theme="dark"`; high-contrast mode via `.high-contrast`.
- Interactive prototypes assert minimum 24×24 px hit areas and on-screen
  reachability (`tests/responsive-mobile-ui.cjs`).

## Tested interactive prototypes

| Prototype | Test |
|---|---|
| Desktop and phone browser shell | `tests/browser-ui.cjs` |
| Responsive mobile controls and hit areas | `tests/responsive-mobile-ui.cjs` |
| Mobile pages and overview | `tests/mobile-pages-ui.cjs`, `tests/mobile-overview-ui.cjs` |
| Desktop tab strip | `tests/desktop-tab-strip-ui.cjs` |
| Start page / Observatory | `tests/observatory-ui.cjs` |
| Inspector | `tests/inspector-ui.cjs` |
| Account switch | `tests/account-switch-ui.cjs` |

These are Playwright probes wired into the CI `checks` job. On 2026-11-28 the
Chromium binary was installed locally and the probes were executed:

```text
PASS mac, ios and android browser suites
PASS Observatory offline reading, reduced motion and focus timer
PASS restricted-mode phones, search isolation and accessibility
PASS account-bound reader consent, device selection and bookmark editor
PASS phone touch targets and sheets at 320/360/390 and rotated 844x390
PASS mobile overview, mobile library and page display
PASS desktop tab strips for Mac and Windows
PASS native Inspect routing on mac, windows, android and ios
```

## Exit gate

| Gate item | State |
|---|---|
| Design token package | Implemented: `design/tokens.json` + `scripts/check-tokens.cjs` |
| Token consistency guard | Passing locally |
| Original brand assets | Present under `branding/` |
| Glass guidance | Documented, sourced from `chrome/liquid.css` |
| Responsive layouts | Implemented; breakpoints documented |
| A11y foundations | focus-visible, reduced motion, dark and high-contrast paths |
| Tested interactive prototypes | **Executed locally: all Playwright probes passed** |
| Gate met | **Yes, locally** — token guard and interactive probes are green |

P03 is verified locally. Remote CI still needs the same run, but the local
token guard and interactive probes are green.
