# Accessibility, languages and inclusive UX (P15)

P15 covers VoiceOver/TalkBack/Narrator, RTL/CJK and reduced effects. Accessibility
checks are executable; a translated release is not.

## Accessibility

| Control | Evidence |
|---|---|
| Labels and roles | 60+ `aria-label`/role attributes in `chrome/index.html` |
| Keyboard focus | Global `:focus-visible` outline for buttons, links, inputs, selects, textareas |
| Reduced motion | `prefers-reduced-motion` media queries and a `.reduce-motion` class |
| Contrast | Dark theme and `.high-contrast` path |
| Touch targets | Playwright probe requires at least 24×24 px and on-screen reachability |
| Responsive journeys | Desktop, phone 320/360/390, rotated 844×390 probes |
| Apple platform flags | `UIAccessibility.isReduceMotionEnabled` and reduce-transparency are sent to chrome |
| Audit | `node scripts/a11y-audit.cjs`, wired into CI |

Screen-reader status: platform engines expose web content to VoiceOver,
TalkBack and Narrator, but no device screen-reader session was run here. That is
recorded, not claimed.

## Languages and scripts

`chrome/i18n.js` provides:

- locale normalization and canonical tags;
- RTL direction for Arabic, Hebrew, Persian, Urdu and related locales;
- CJK script detection and a CJK font stack;
- Arabic/RTL font stack;
- locale-aware number and date formatting;
- `apply(document, locale)` sets `lang`, `dir`, `data-script` and the
  `--ui-font` variable.

`chrome/app.js` applies the system locale at startup. CSS includes `[dir="rtl"]`
mirroring for the rail and collapse controls, start-aligned dialogs, and
`[data-script="cjk"]` line-height/letter-spacing adjustments.

What this does **not** do: translate the UI strings. The interface is English;
no string catalog or translated release exists. Direction, fonts and formatting
are real, but a localized release is a recorded gap.

## Executed audit

```text
Vaayvu accessibility audit passed: labels, focus, reduce motion, contrast,
24px targets, RTL and CJK primitives.
```

Forced-colors and platform screen-reader verification still need device runs.

## Exit gate

| Gate item | State |
|---|---|
| Accessible journeys | **Green locally**: labels, focus, reduce motion, contrast, 24px targets, responsive probes |
| VoiceOver / TalkBack / Narrator | **Not device-verified** |
| RTL | **Implemented** (dir, fonts, mirrored rail) |
| CJK | **Implemented** (script, font stack, line-height) |
| Reduced effects | **Implemented** and tested |
| Localized release | **Gap** — no translated string catalog |
| Gate met | **Partially** — accessibility green, localized release not |

P15's accessible journeys are green. The localized release and screen-reader
device runs are explicit gaps.
