# Migration, library and external search (P33)

P33 covers safe import/export, library migration and validated external search
without a public index or private leak.

## Safe import/export

Bookmarks:

- import accepts one HTML/HTM file up to **2 MB**, reads a bounded buffer and
  never expands archives;
- export caps the text at **2 MB** and writes only when ordinary browsing is
  enabled;
- exported URLs/titles are HTML-escaped (`exportBookmarkText` uses `e()`);
- imported URLs pass the same HTTP(S) validation before entering the library;
- browser UI tests cover create/edit/import/export and replacement.

Data:

- account data export/import screens exist (`s-225`, `s-226`) as contracts;
- no full account export runtime is implemented — recorded gap.

## Library migration

| Migration | State |
|---|---|
| Apple separate chrome store marker | Implemented |
| SQLite domain migrations `1 → 2` | Tested |
| Sync tombstones / offline catch-up | Tested |
| Bookmark HTML import/export | Tested |

## External search

| Check | State |
|---|---|
| Built-in providers | HTTPS-only hardcoded endpoints |
| Custom template | Must be HTTPS, one `%s`, no whitespace/backslash/marker, bounded |
| Search provider selection | Explicit; ordinary web required |
| India search | Reviewed origin, TLS hostname + leaf SPKI pin, redirects rejected |
| Local suggestions | Stay on device; no public index |
| Private search | Never synced/suggested; stale/private isolation tested |
| Public index | **None** — the browser ships no public search index |

No query is sent unless the user submits it. Private tabs do not feed local
suggestions or sync.

## No private leak

- `sync/privacy-sentinel.test.mjs` proves private pages never enter SQLite,
  WAL/SHM or sync snapshots.
- Browser UI probes assert stale and private search isolation.
- Search suggestions filter private tabs before rendering.

## Exit gate

| Gate item | State |
|---|---|
| Safe import/export | **Green** for bookmarks; account data export gap |
| Validated external search | **Green** |
| No public index | **Green** (none shipped) |
| No private leak | **Green** (sentinel + isolation probes) |
| Gate met | **Yes, locally** |

P33's named gate is green. A full account data export runtime remains a recorded
gap.
