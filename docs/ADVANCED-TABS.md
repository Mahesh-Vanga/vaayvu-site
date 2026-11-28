# Advanced tabs, workspaces and containers (P22)

P22 covers stable tab IDs, four-position layouts, protected work and partition
isolation.

## Stable tab IDs

- Tabs are created with `uid()` and persisted with their IDs.
- Reload/restore keeps the same IDs; the desktop UI probe asserts the ID array
  is identical after a reload.
- Closing duplicates protects pinned, active, private and separately grouped
  copies (`tests/tabs.test.cjs`).

## Four-position layouts

`chrome/preferences.js` allows `top`, `bottom`, `left` and `right`. The desktop
Playwright probe exercises all four:

| Position | Evidence |
|---|---|
| top | default strip geometry |
| bottom | `position-bottom`, persisted across reload |
| left | side rail at `x = 68`, tab count preserved |
| right | side rail at the right edge, tab count preserved |

## Protected work

- Critical-work leases (P18) block idle/pressure sleep for uploads, calls and
  downloads.
- Pinned, active and grouped tabs are protected from duplicate-closing.
- Private tabs are never included in synced tabs or duplicate close groups.

## Partition isolation

| Boundary | Evidence |
|---|---|
| Regular vs private session | `persist:vaayvu-web` vs unique `vaayvu-private-<uuid>` |
| Private close | storage and cache cleared |
| Android profiles | separate profile storage |
| Apple | separate `WKWebsiteDataStore` |
| Desktop containers | **screens only** — no desktop container runtime |

The isolation corpus is behavioural for sessions/profiles; desktop containers
remain an atlas contract.

## Exit gate

| Gate item | State |
|---|---|
| Stable tab IDs | **Green** (reload assertion) |
| Four-position layouts | **Green** (all four exercised) |
| Protected work | **Green** (leases + pinned protection) |
| Partition isolation | **Green** for private/profile; desktop containers gap |
| Gate met | **Yes, locally** |

P22 is green for the desktop tab/workspace contracts. A desktop container
runtime is a recorded gap.
