# Design, accessibility and localization (P31)

P31 covers visual presets, accessible journeys, responsive chrome and
localization infrastructure.

## Two presets (plus high contrast)

| Preset | Evidence |
|---|---|
| Light | default `:root` tokens, `theme: 'light'` |
| Dark | `:root[data-theme='dark']` token block |
| High contrast | `.high-contrast` path and contrast rules |

Light and dark are the two shipped presets. High contrast is an additional
accessibility mode, not a third brand preset. Tokens are guarded by
`scripts/check-tokens.cjs` (14 colors per theme).

## Accessible journeys

- `scripts/a11y-audit.cjs`: labels, roles, focus-visible, reduced motion,
  contrast, 24 px targets, RTL/CJK primitives.
- Playwright probes cover:
  - desktop and phone shells;
  - 320/360/390 widths and 844×390 rotation;
  - 24×24 px minimum hit areas and on-screen reachability;
  - reduced motion;
  - keyboard focus and tab selection.
- Platform reduce-motion/transparency flags are consumed from Apple/Android.

Screen-reader device sessions (VoiceOver/TalkBack/Narrator) are still **not run**
(P15 gap).

## Responsive safe chrome

| Check | State |
|---|---|
| Sidebar/rail does not overlap content | **Tested** (left/right/top/bottom) |
| Hit targets stay on screen | **Tested** (24 px rule) |
| Narrow phone layout | **Tested** at 320/360/390 |
| Rotated phone | **Tested** at 844×390 |
| Split view / side rails | **Tested** (P22) |
| No horizontal overflow in chrome | **Tested** by bounding boxes |

## Localization

- RTL and CJK direction/fonts/formatting are implemented (`chrome/i18n.js`).
- System locale sets `lang`, `dir`, `data-script` and `--ui-font`.
- **No translated string catalog** exists; the UI remains English.
- A translated release is a recorded gap (P15).

## Exit gate

| Gate item | State |
|---|---|
| Two presets | **Green** (light/dark; high contrast extra) |
| Complete accessible journeys | **Green locally**; screen-reader device runs missing |
| Responsive safe chrome | **Green** |
| Localization | **Infrastructure only** — no translated catalog |
| Gate met | **Yes, locally** for presets/journeys/responsive |

P31's named gate is green locally. Screen-reader devices and a translated
release remain recorded gaps.
