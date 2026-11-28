# VFD — VAAYVU Filter Database, format v1

Original VAAYVU rule format. Every rule is independently authored, carries
provenance, and is validated before it can take effect.

## Rule record

```json
{
  "id": "VFD-ADS-0007",
  "category": "ads | trackers | social | cosmetic | firstparty | exception | malware",
  "hosts": ["doubleclick.net"],
  "urlIncludes": ["/pagead/"],
  "selectors": ["ins.adsbygoogle"],
  "scope": "third-party",
  "firstParty": false,
  "action": "block | hide",
  "author": "vaayvu-filter-team",
  "evidence": "live-request-log 2026-11-24",
  "added": "2026-11-24",
  "verified": "2026-11-24",
  "expires": null
}
```

Field notes:

- `hosts`: bare registrable domains (suffix match). Never an apex that also
  serves legitimate content (`googlevideo.com`, `youtube.com`, `ytimg.com`,
  `gstatic.com`, `googleapis.com` are rejected by the compiler).
- `urlIncludes`: case-insensitive substring tokens, matched against the full
  request URL. Length 6–64 (5+ when path-anchored with `/`).
- `selectors`: plain CSS selectors for cosmetic hiding. No procedural or
  `:has()` selectors in v1 (Android WebView compatibility).
- `scope`: `"third-party"` (default) or `"any"`. `firstParty: true` marks a
  URL rule that may also match same-site requests, and it is honoured only
  in Aggressive mode.
- `action`: `"block"` (network) or `"hide"` (cosmetic).
- `category`: `ads`, `trackers`, `social` (off by default), `cosmetic`,
  `firstparty` (aggressive only), `exception`, `malware` (custom/strict only).
- `evidence`: how the rule was verified — live request log, Electron
  fixture suite, or unit test name. `added`/`verified` are ISO dates.
- `expires`: ISO date or null. Expired rules fail validation.

## Precedence (deterministic)

1. Site exception (paused site) → only `strict` custom/malware hosts apply.
2. `strict` custom + malware hosts → block everywhere, including first-party.
3. VFD `exception` rules → allow (override category blocks below).
4. Category host sets (ads / trackers / social per toggles) → block,
   third-party only.
5. VFD URL tokens → block, third-party only (or same-site only when the
   token is flagged `firstParty` and mode is Aggressive).
6. Otherwise allow.

## Validation (compiler rejects, counts, never silently applies)

- Unknown category, bad action, malformed host (full hostname rules), short
  or over-long tokens, procedural selectors, protected apexes, expired
  rules, duplicate ids. Rejection counts are reported, never hidden.
