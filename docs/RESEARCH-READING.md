# Research, reading, feeds and Focus (P24)

P24 covers local-first collection/reader workflows, a reliable focus timer and
safe offline content.

## Local-first collections

`chrome/collections.js` is a dependency-free research collection store:

- sources keep URL, title, excerpt, note, tags and timestamp;
- HTTPS/HTTP only, no embedded credentials;
- duplicate URLs are rejected per collection;
- caps: 50 collections, 2,000 sources, 12 tags, bounded text fields;
- search across title, URL, excerpt, note and tags;
- export to JSON or Markdown;
- save/load through local storage; quota failure returns false.

This module is **not yet wired to a shipping research screen**. The reading list
is the shipping local-first workflow.

## Reading and offline content

- Mobile library and reading list are UI-tested (`tests/mobile-pages-ui.cjs`).
- Reader extraction keeps article text and drops hidden form values (P09 E2E).
- Cached-copy screens are read-only and labelled (`s-100` tests).
- Offline pages never imply a live network state.

## Focus timer

- Deadline-based countdown, not decrement-per-tick.
- The deadline is persisted under `vaayvu.focusUntil`.
- Reload resumes the session; expiry clears the deadline and shows complete.
- `tests/observatory-ui.cjs` now starts a session, reloads, and asserts it is
  still in progress.

## Feeds

Feed manager, validation, article, refresh, transfer and failure screens exist
(`s-474`–`s-479`) as **contracts**. There is no shipping feed engine, scheduler
or parser. This is a recorded gap, not a hidden pass.

## Exit gate

| Gate item | State |
|---|---|
| Local-first collection workflow | **Reference module tested**; not wired |
| Reading list / reader / offline | **Green** (UI + E2E) |
| Reliable timer | **Green** (deadline persists across reload) |
| Safe offline content | **Green** (read-only cached copy, extraction) |
| Feeds | **Gap** — screens only |
| Gate met | **Yes, locally** for collection/reader/timer/offline |

The gate's named workflows are green at the contract level. Feed execution and
a research UI remain recorded gaps.
