# Rasha and advanced privacy (P20)

P20 covers first-party ownership, original VFD rules, safe enforcement and the
isolation corpus.

## First-party ownership audit

`node scripts/vfd-ownership-audit.cjs`:

```json
{"passed":true,"rules":47,"rejected":0,"adsHosts":363,"trackerHosts":174,"cosmeticSelectors":108,"tokens":78}
```

Checks:

- `VFD/1` format and a version;
- every rule ID matches `VFD-CATEGORY-NNNN`, unique, valid category;
- every rule has `evidence` and `added` provenance;
- every rule carries hosts, selectors, tokens, URL includes or first-party
  entries;
- no validation rejects;
- forbidden third-party-derived files are absent, and no `easylist`,
  `easyprivacy`, `fanboy`, `stevenblack`, `peter-lowe`, `someonewhocares` or
  `ublock` data file exists in `chrome/`, `branding/` or `docs/`.

`docs/ADBLOCK-LICENSES.md` states the implementation and rule database are
original VAAYVU work; historical third-party data is recorded and removed.

## Original rules

| Category | Rules |
|---|---:|
| ads | 30 |
| trackers | 9 |
| social | 1 |
| firstparty | 2 |
| cosmetic | 5 |
| **Total** | **47** |

Compiled coverage: 363 ad hosts, 174 tracker hosts, 108 cosmetic selectors and
78 URL tokens. Every rule keeps its own evidence trail.

## Safe engine enforcement

Audited invariants:

1. Protected apexes (`youtube.com`, `google.com`, `apple.com`, …) reject rules
   that would break the site itself.
2. Dedicated ad/tracker hosts are blocked even when they share a parent domain
   with the document.
3. First-party URL tokens are only blocked in aggressive mode.
4. Third-party URL tokens are blocked in standard mode.
5. Paused sites relax blocking for regular tabs.
6. Private tabs ignore the paused-site exception.
7. Exceptions and strict user rules follow the documented precedence.
8. Cosmetic filtering is CSS-only; no scriptlets or redirects.

Coverage: `tests/vfd.test.cjs`, `windows/test/vfd.cjs`, Android `VfdTest`,
Apple navigation VFD case and the new audit.

## Isolation corpus

| Boundary | Evidence |
|---|---|
| Regular vs private web session | Unique `vaayvu-private-<uuid>` partition, cleared on close |
| Private tab VFD behavior | Paused-site exception ignored |
| Profile/container storage | Android profiles, Apple separate `WKWebsiteDataStore`, container screens |
| Cross-origin storage | Engine same-origin policy; no app-level sharing |
| Downloaded/uploaded page data | Quarantine and origin screens; no auto-upload |

The isolation corpus is behavioural (VFD + session + storage). It is not a live
fingerprinting or hostile-site lab; that remains the P08 external gap.

## Exit gate

| Gate item | State |
|---|---|
| First-party ownership audit | **Green** |
| Original rules | **Audited** (47 rules, provenance complete) |
| Safe engine enforcement | **Green** (protected apex, precedence, private pause) |
| Isolation corpus | **Green** for VFD/session/storage boundaries |
| External fingerprinting lab | **Gap** (P08 external) |
| Gate met | **Yes, locally** |

The audit is wired into CI.
