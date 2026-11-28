# VAAYVU Ad Block — VFD Engine Architecture

## Pipeline

```
Website request → Request normalization → Site + resource classification
→ VFD rule matching (deterministic precedence) → Allow or block
→ Renderer cosmetic filtering (VFD selectors) → Protection statistics
→ Clean webpage rendering
```

Compiled once per profile in the main process (desktop), per app process
(Android), or per content-blocker list (iOS). One immutable copy is shared by
every window, tab and profile. The settings message carries only switches,
small user lists and the compiled flat policy (hosts, tokens, selectors) —
no giant downloads, no truncation.

## Precedence (identical on all platforms)

1. `strict` custom user domains — block everywhere, even first-party.
2. Paused site (user exception) — fall back to strict-only.
3. VFD `exception` rules — allow (host-only, or host+path).
4. Category hosts (`ads`, `trackers`, `social` when enabled) — third-party only.
5. URL tokens (`patterns`, `trackerPatterns`) — third-party only.
6. First-party URL tokens — same-site only, Aggressive mode only.
7. Otherwise allow.

No rule may break the browser chrome, system pages, or `about:`/`data:`/`blob:`.

## Protected apexes (compiler-enforced)

`googlevideo.com youtube.com youtu.be ytimg.com ggpht.com gstatic.com
googleapis.com googleusercontent.com facebook.com instagram.com amazon.com
reddit.com x.com adobe.com apple.com microsoft.com wikipedia.org`

A rule naming one of these is rejected at compile time with a reason. This
is why YouTube in-stream video ads (served from `googlevideo.com`) cannot be
network-blocked: the same hosts deliver the video itself.

## Native integration

- **Desktop (Electron):** `session.webRequest.onBeforeRequest` in the main
  process consults the compiled VFD sets; cosmetic CSS is injected with
  `insertCSS` per document. No Chromium security switch is touched.
- **Android (WebView):** `shouldInterceptRequest` with the same precedence;
  cosmetic CSS via adopted stylesheets; per-tab counters in PagePrivacy.
- **iPhone (WKWebView):** the flat policy compiles to `WKContentRuleList`s
  (`block` + `css-display-none` + `ignore-previous-rules` for exceptions).
  Content blockers cannot report per-request counts, so iOS shows protection
  status, version and rules — not live counters.

## What VFD v1 does not do (documented limits)

- No auto-clicking of Skip buttons and no ad-overlay scripting: detection
  only, no playback interference. Non-skippable in-stream ads on YouTube
  still play.
- No `@@`-style domain-scoped exception conditions beyond host/path lists.
- No request-type conditions beyond document-vs-subresource (main frames
  only ever match `strict`).
- No scriptlets, no redirects, no removeparam.
- No automatic list updates yet: the bundled `vfd-rules.js` ships with the
  app; `rulesVersion` tracks it. The update service validates + activates +
  rolls back (see MAINTENANCE).

## Measured performance (VFD v1, desktop V8, 2026-11-24)

- 120,000 mixed decisions (block/allow, both parties): **196 ms total,
  ~1.6 us per request** — no per-request allocation beyond one URL parse.
- Compiled rule set: ~92 hosts, ~49 URL tokens, 36 cosmetic selectors.
- No per-tab engine copies: one shared compiled set per profile; per-tab
  state is a small counter map only.
