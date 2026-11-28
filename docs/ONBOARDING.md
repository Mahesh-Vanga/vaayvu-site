# VAAYVU First-Run Onboarding — Routes `vaayvu://onboarding/s-001`…`s-020` plus `vaayvu://start-page/s-051`, Phases `p00` / `p05`

## Scope

First open after a fresh install only. Returning users, upgraded profiles and
automation never see it. Implemented once in the shared `chrome/` layer, so
Windows, macOS, Linux, Android, iPhone and iPad all inherit the identical
flow.

## Atlas categories and phases

| Screen range | Category | Phase |
|---|---|---|
| s-001–s-020 | onboarding | p00 |
| s-021–s-050 | window chrome | p03 |
| s-051 | start page (defaults) | p05 |
| s-052–s-065 | start page | p05 |
| **s-066–s-095** | **tabs** | **p05** |
| **s-096–s-125** | **content** | **p09** |
| **s-126–s-140** | **sidebar** | **p09** |
| **s-166–s-185** | **security & privacy** | **p08** |
| **s-186–s-202** | **settings** | **p04** |
| **s-203–s-218** | **ai** | **p13** |
| **s-219–s-232** | **accounts** | **p10** |
| **s-233–s-250** | **system** | **p16** |
| **s-251–s-263** | **resilience** | **p04** |
| **s-264–s-281** | **security** | **p08** |
| **s-282–s-291** | **sync-credentials** | **p10** |
| **s-292–s-306** | **ai-trust** | **p13** |
| **s-307–s-323** | **content** | **p14** |
| **s-324–s-331** | **quality** | **p16** |
| **s-332** | **onboarding** | **p03** |
| **s-333–s-337** | **settings** | **p03/p05** |
| **s-338** | **error** | **p05** |
| **s-339** | **permissions** | **p05** |
| **s-340** | **navigation** | **p05** |
| **s-341** | **error** | **p05** |
| **s-342** | **navigation** | **p05** |
| **s-343** | **private** | **p05** |
| **s-344–s-353** | **security-privacy** | **p08** |
| **s-354–s-359** | **resources** | **p18** |
| **s-360–s-365** | **lifecycle** | **p18** |
| **s-366–s-371** | **compute** | **p18** |
| **s-372–s-377** | **energy** | **p18** |
| **s-378–s-383** | **transport** | **p19** |
| **s-384–s-389** | **storage** | **p19** |
| **s-390–s-395** | **rasha** | **p20** |
| **s-396–s-401** | **rasha-research** | **p20** |
| **s-402–s-407** | **privacy-boundaries** | **p20** |
| **s-408–s-413** | **fingerprint** | **p20** |
| **s-414–s-419** | **trusted-navigation** | **p21** |
| **s-420–s-425** | **credentials** | **p21** |
| **s-426–s-431** | **maintenance** | **p21** |
| **s-432–s-437** | **tab-layout** | **p22** |
| **s-438–s-443** | **workspaces** | **p22** |
| **s-444–s-449** | **containers** | **p22** |
| **s-450–s-455** | **continuity** | **p23** |
| **s-456–s-461** | **preservation** | **p23** |
| **s-462–s-467** | **research** | **p24** |
| **s-468–s-473** | **reader** | **p24** |
| **s-474–s-479** | **feeds** | **p24** |
| **s-480–s-485** | **focus** | **p24** |
| **s-486–s-491** | **workflow** | **p25** |
| **s-492–s-497** | **assistant** | **p25** |
| **s-498–s-503** | **documents** | **p26** |
| **s-504–s-509** | **capture** | **p26** |
| **s-510–s-515** | **downloads** | **p26** |
| **s-516–s-521** | **media** | **p27** |
| **s-522–s-527** | **realtime** | **p27** |
| **s-528–s-533** | **extensions** | **p28** |
| **s-534–s-539** | **webapps** | **p28** |
| **s-540–s-545** | **devstudio** | **p29** |
| **s-546–s-551** | **compatlab** | **p29** |
| **s-552–s-557** | **benchlab** | **p30** |
| **s-558–s-563** | **appearance** | **p31** |
| **s-564–s-569** | **accessibility** | **p31** |
| **s-570–s-575** | **mobile** | **p32** |
| **s-576–s-581** | **desktop** | **p32** |
| **s-582–s-599** | **policy** | **p33** |
| **s-600–s-605** | **connectivity** | **p34** |
| **s-606–s-611** | **support** | **p34** |
| **s-612–s-617** | **data** | **p35** |
| **s-618–s-623** | **performance-guard** | **p35** |
| **a-001–a-019** | **ads** | **p36–p38** |
| **a-020–a-032** | **campaigns** | **p36–p39** |
| **s-141–s-165** | **manager** | **p09** |

Content screens implemented: **s-096**, **s-097**, **s-098**, **s-099**, **s-100**, **s-101**, **s-103**, **s-105**, **s-106**, **s-107**, **s-108**, **s-109**, **s-110**, **s-111**.

The tabs range is enforced as a numeric range in `chrome/onboarding.js`, so a
new tab screen in this range automatically uses `vaayvu://tabs/…`, the `tabs`
atlas category and phase `p05`.

## Pipeline

```
Install → first UI load → chrome/boot.js (blocking, head)
  → decision before first paint → splash (logo, <300 ms)
  → chrome/onboarding.js (defer) → s-020 unsupported system, when the host reports the OS floor
  → s-016 update prompt, when the host reports an update
  → s-017 what’s new, when the installed version has unseen notes
  → s-001 splash
  → Continue / Skip for now
  → s-002 welcome + value prop + import/sync → Get started
  → s-011 privacy setup (search, shield level, usage opt-in, DNS) → Continue
  → s-012 appearance setup (theme, tab orientation, accent, wallpaper) → Continue
  → s-015 setup checklist (import, sync, default, passwords, extensions) → Continue
  → s-051 start page defaults, phase p05 (logo, search, shortcuts, reading list)
  → Continue
  (s-003 exists but is no longer navigated to from s-002)
```

## Boot gate (`chrome/boot.js`)

Loaded as a blocking `<script src>` after the stylesheets and before any
deferred script, so the decision is made before the first paint:

- **New install** — no `vaayvu.onboarding` record and no existing profile
  data (`vaayvu.*` settings/adBlock keys) →
  `html[data-onboarding="show"]`, splash paints on frame one.
- **Returning user** — record with status `done` or `skipped` → hidden, no
  flash (the flag is set before the body parses).
- **Upgrade** — profile data exists but no record → written off as
  `skipped/existing-profile`, never shown.
- **Automation** — `navigator.webdriver` → hidden (`automation`), so Playwright
  suites are never blocked by the overlay.
- **Unusable storage** — probed once; broken storage hides the gate
  (`no-storage`) instead of nagging on every launch.

Measured decision point: `performance.now()` at head-script time, asserted
`< 300 ms` in `tests/onboarding.test.cjs`. Assets are local (no network), so
first contentful paint of the splash is well inside the budget.

## Crash-loop fallback

Two independent releases, so a broken boot can never trap a user:

1. **Attempt counter** — each uncompleted launch increments
   `vaayvu.onboardingAttempts`. On the fourth, the gate records
   `skipped/crash-loop` and boots straight into the browser.
2. **Take-over watchdog** — if `chrome/onboarding.js` has not signalled
   `window.__vaayvuOnboardingReady` within 5 s of the splash showing, the
   gate records `skipped/boot-timeout` and hides itself.

Completing or skipping the flow clears the attempt counter.

## Step `s-001` — boot/splash

Route `vaayvu://onboarding/s-001`, phase `p00`, category onboarding, core
priority. The splash is the first thing painted: logo, wordmark and an honest
boot status, with no settings written at this point.

| Element | Behaviour |
|---|---|
| **Logo** | the in-app Vaayvu mark, loaded from local assets only |
| **Sub-300 ms** | the shell paints before any network request; the splash states it |
| **Crash-loop guard** | three unfinished launches skip onboarding and open the browser |
| **Fallback** | if the UI does not take over in 5 s, boot steps aside |
| **Continue** | advances to s-002 without writing settings |
| **Skip onboarding** | records `skipped` and ends the flow with recommended defaults |

**Back** from s-002 returns to the splash. Shield categories are not part of
the atlas onboarding; the browser keeps its recommended defaults, so an exit
always leaves a fully armed browser.

## Step `s-002` — welcome, value prop, import/sync

Route `vaayvu://onboarding/s-002`, phase `p00`, category onboarding,
capability-gated, core priority. Shown only after s-001 on a new install.

- **Value prop** — three honest lines: ads/trackers/popups blocked by
  default, stats and settings stay on the device, per-site pause in one tap.
- **Import bookmarks** — runs `command('bookmarkImport')`, shown only when
  the platform reports `capabilities.canImportBookmarks`.
- **Sync with Vaayvu ID** — runs `command('account')`, shown only when the
  sync module is present.
- **Get started** — advances to s-011 (the chain continues to s-012, s-015 and
  s-051; the record is written when the flow finishes). **Back** returns to
  s-001.
- **Atlas exits not wired yet** — s-003 (default browser), s-004 (import
  source picker), s-007 (sync intro) and s-332 (provider choice) are the five
  possible S-002 destinations in the v1 atlas. Only s-011 is connected today;
  s-004 is built and testable on its own route, and the others follow before
  the exits are wired.

Capabilities arrive with the native `ready` message; if a step is already on
screen it re-renders so step counts, choices and gates are correct the moment
the platform reports them (live s-001 checkbox edits survive the re-render).

## Step `s-004` — import source picker (standalone)

Route `vaayvu://onboarding/s-004`, phase `p00`, category onboarding,
capability-gated, core priority. Built against the v1 atlas as one of the five
S-002 exits, but **deliberately not wired** yet — the welcome screen still
opens the native import directly. Until navigation is connected, the screen is
reachable through the internal `window.__vaayvuOnboardingOpen('s-004')` hook
that the flow and the automated checks use, and **Back** returns to whichever
screen opened it.

| Group | Sources | Real action |
|---|---|---|
| **Bookmarks** | Chrome, Edge, Brave, Arc, Safari, Firefox, Opera, Vivaldi, HTML file | selecting a source shows that browser's actual export path and a **Choose file** button that runs `command('bookmarkImport')` — the native picker that reads browser-exported HTML (2 MB limit on desktop/iOS, streamed on Android) |
| **Passwords** | CSV file, 1Password, Bitwarden | shows the real export path and **Choose CSV**, which feeds the same local CSV importer and password store as s-015 |

Gating: the Bookmarks group appears only with
`capabilities.canImportBookmarks`; the Passwords group only with
`capabilities.canImportPasswords` (and the local password store). If neither
is reported the screen states that import is unavailable on the device
instead of showing dead tiles. No third-party importer or vendor API is used —
every source converges on Vaayvu's own HTML/CSV readers.

## Step `s-005` — import process (standalone)

Route `vaayvu://onboarding/s-005`, phase `p00`, category onboarding,
capability-gated, core priority. Built as the import progress/summary stage of
the atlas and **not wired** yet: S-004 still imports directly. The screen owns
a real, cancellable job, and the future handoff is already defined as
`window.__vaayvuOnboardingOpen('s-005', { sourceId, kind, text })`, where
`kind` is `bookmarks` or `passwords` and `text` is the file the user chose.

| Element | Behaviour |
|---|---|
| **Pre source** | shows the selected source's mark and name (Chrome, 1Password, HTML file, …) plus whether the job is in progress or finished |
| **Cancel** | real cancellation: entries import in 25-item batches, so Cancel stops every remaining batch and keeps what already landed; the summary says exactly how many were added before the stop |
| **Partial failure** | after parsing, the screen compares found/imported/skipped from actual results — bookmarks skip duplicates, invalid addresses and the 2,000 limit; password rows skip when website, username or password is missing; a clean import says "Imported all N" |
| **Counts** | bookmarks parse the same Netscape `HREF` links the native importer reads; password CSVs use the s-015 column map, so 1Password/Bitwarden exports report the same numbers |
| **Idle / unsupported / oversize** | without a job it says "No import in progress" instead of faking progress; unsupported capabilities and files over 2 MB get their own honest state |

**Done** (or **Back** when idle) returns to the screen that opened it. No
import library, vendor API or external parser is involved.

## Step `s-006` — import results (standalone)

Route `vaayvu://onboarding/s-006`, phase `p00`, category onboarding,
capability-gated, core priority. Built as the detailed results stage after
s-005 and **not wired** yet. It renders the same job the process screen owns
(`window.__vaayvuOnboardingOpen('s-006', { sourceId, kind, text })` starts one,
or opening it after s-005 shows that job's outcome).

| Element | Behaviour |
|---|---|
| **Counts** | Found / Imported / Skipped tiles are read from the job (`total`, `added`, `total − added`) — no estimates |
| **What was skipped** | every skip is recorded with its reason while the file is read: bookmarks — *Already saved*, *Not a website address*, *Bookmark limit reached*; passwords — *Missing website*, *Missing username*, *Missing password*, *Password limit reached*, *Unrecognised columns*; the list shows the first six affected entries |
| **Fix links** | inline repair where repair is possible: an invalid bookmark address opens Website/Title fields and **Add bookmark**; an incomplete password row opens Website/Username/Password and **Save password**. Saving adds the real entry, increments Imported, decrements Skipped and removes the reason. Duplicates, the store limit and unrecognised CSV columns carry no Fix link because this screen cannot honestly repair them |

`Done` returns to the opener. The screen never claims a fix it did not make —
the counts and reasons are recomputed from the job after every repair.

## Step `s-007` — sync intro (standalone)

Route `vaayvu://onboarding/s-007`, phase `p00`, category onboarding,
capability-gated, core priority. Built as one of the five S-002 exits and
**not wired** yet; reachable through
`window.__vaayvuOnboardingOpen('s-007')`.

| Action | Real flow |
|---|---|
| **Create a Vaayvu ID** | `command('register')` → the existing registration sheet (server address, ID, password of 12+ characters, optional local bookmarks). The sheet renders in the browser's top layer above the onboarding overlay |
| **Pair this device** | `command('account')` → the sign-in sheet for an ID that already exists. This build has no QR/number pairing — pairing means signing in with the same server and ID |
| **Skip for now** | closes back to the opener without writing an account |

The screen states what sync does and does not carry (bookmarks and regular
open tabs sync; private tabs and history stay off the server), matching the
auth sheet's own note.

Gating: hidden actions with an explanation when the shared sync client is
missing, and when India-only browsing (`settings.ordinaryWeb === false`) has
paused sync. If a session already exists, the screen shows “Signed in as …”
with the server origin and a **Done** action instead of sign-up buttons.

## Step `s-008` — create account (standalone)

Route `vaayvu://onboarding/s-008`, phase `p00`, category onboarding,
capability-gated, core priority. Built as the account-creation step and **not
wired** yet; preview with `window.__vaayvuOnboardingOpen('s-008')`.

The atlas lists **email link**, **passkey** and **SSO**. All three screens are
built now; their server endpoints connect later. Each is a selectable row
that opens its own sheet:

| Method | Sheet |
|---|---|
| **Email link** | email field, **Send link**, then a **Check your email** state (no mail is sent yet) |
| **Passkey** | **Create passkey**, then a passkey-ready state |
| **SSO** | Google / Microsoft / GitHub / Okta provider buttons, then a provider preview |
| **Create a Vaayvu ID** | `command('register')` → the real registration sheet (server address, ID, 12+ character password) |

Every success state is labelled as a preview; no account is created until the
endpoints exist.

Gating: hidden actions with an explanation when the sync client is missing or
India-only browsing has paused account creation. If a session already exists,
the screen says “Already signed in as …” and offers **Done** rather than a
second account. Turning these rows into actions later needs server endpoints
and native capability flags — the layout is ready for that, but nothing is
pretended today.

## Step `s-009` — sign in (standalone)

Route `vaayvu://onboarding/s-009`, phase `p00`, category onboarding,
capability-gated, core priority. Built as the sign-in counterpart to s-008 and
**not wired** yet; preview with
`window.__vaayvuOnboardingOpen('s-009')`.

The atlas lists **passkey**, **email link**, **TOTP** and **recovery code**.
All four screens are built now; their endpoints connect later:

| Method | Sheet |
|---|---|
| **Passkey** | **Use passkey**, then a passkey-ready state |
| **Email link** | email field, **Send link**, then **Check your email** |
| **Authenticator code** | 6-digit field, **Verify code**, then an accepted preview |
| **Recovery code** | recovery-code field, **Use recovery code**, then an accepted preview |
| **Sign in with a Vaayvu ID** | `command('account')` → the real "Connect to Vaayvu Sync" sheet |

Each success state says no server verified it yet.

Gating: explains when the sync client is missing or India-only browsing has
paused sign-in; when a session already exists it shows “Signed in as …” with
**Done** instead of methods. Implementing the four methods later needs server
endpoints and native capabilities — the rows can become actions without a
layout change.

## Step `s-010` — recovery phrase (standalone)

Route `vaayvu://onboarding/s-010`, phase `p00`, category onboarding,
capability-gated, core priority. **Not wired** yet; preview with
`window.__vaayvuOnboardingOpen('s-010', { phrase })`.

The full atlas flow is implemented and tested: a **24-word grid**, **Copy**
(`navigator.clipboard`, with an honest toast when unavailable), **Print**
(`window.print()` with print CSS that hides the browser chrome; button hidden
where `print` is not a function), **Continue** to a **3-word confirmation** of
randomly chosen positions (wrong words are named and the step stays put), and
an **I lost it** flow that states plainly the account cannot be recovered and
offers a new Vaayvu ID.

**Preview phrase:** when the host supplies a real 24-word phrase, that phrase
is used. When it does not, the screen renders a clearly labelled **Preview
phrase** — sample words for the screen, never tied to an account and never
stored. The copy/print/confirm/lost mechanics are identical for both. The
phrase is kept in memory only: never written to storage, the onboarding record
or a log, and it is cleared when the screen closes. Incomplete input (anything
other than 24 words) is rejected by count.

## Step `s-013` — feature tour (standalone)

Route `vaayvu://onboarding/s-013`, phase `p00`, category onboarding,
capability-gated, core priority. **Not wired** yet; preview with
`window.__vaayvuOnboardingOpen('s-013')`.

Five short stops with accurate copy, not mock screenshots:

| Stop | Copy |
|---|---|
| **Omnibox** | one bar for searches and addresses; suggestions from bookmarks/history stay on device |
| **Tabs** | top or sidebar placement; pin, split and close from the tab menu |
| **Spaces** | separate tabs, pinned pages and accent per space |
| **Sidebar** | desktop sidebar holds tabs, spaces and tools; open/auto-hide/closed in Settings |
| **Page Q&A** | Page tools → Ask about this page sends the question and excerpt to the user's sync server and its configured model; connect sync to use it |

`Next` advances, `Back` steps backwards (and closes from the first stop),
**Done** on the last stop closes to the opener. The tour always carries all
five atlas stops; less capable devices still see the copy and the prerequisite
in the same place.

## Step `s-014` — notification primer (standalone)

Route `vaayvu://onboarding/s-014`, phase `p00`, category onboarding,
capability-gated, core priority. **Not wired** yet; preview with
`window.__vaayvuOnboardingOpen('s-014')`.

Notifications in Vaayvu are only for **page reminders** — the capability the
mobile builds report as `canPageReminder`. The primer explains that before the
real OS prompt:

| Element | Behaviour |
|---|---|
| **Enable notifications** | `command('requestNotifications')` → Android `POST_NOTIFICATIONS` runtime prompt (SDK 33+) or iOS `UNUserNotificationCenter.requestAuthorization`; the native layer reports grant/deny through its own notice |
| **Not now** | closes without asking |
| **After handing over** | the screen says “Your device is asking now” and never claims permission was granted — the OS owns that answer |
| **Unsupported platform** | desktop builds do not use notifications, so they show an honest “Notifications are not used in this build” state with Back |

The screen does not read back permission status; reopening it starts at the
explainer again rather than remembering a grant it cannot verify.

## Step `s-016` — update available (standalone, capability-gated)

Route `vaayvu://onboarding/s-016`, phase `p00`, category onboarding,
capability-gated, core priority. The screen is owned by the onboarding layer;
the **host owns the update**. It opens automatically when the native layer
reports an update in its `ready` payload (`update`) or sends
`updateAvailable`, and it can be previewed with
`window.__vaayvuOnboardingOpen('s-016')` once `window.__vaayvuUpdate` or
`capabilities.update` is set.

| Element | Behaviour |
|---|---|
| **Version** | `update.version`, compared with `BROWSER_VERSION`; the same version never prompts |
| **Size** | `update.size` (string) or `update.sizeBytes`; omitted when the host does not know it |
| **Notes** | `update.notes` string array, capped at six lines; an honest “fixes bugs” line when empty |
| **Later** | writes `vaayvu.update.dismissed` with the version and closes back to the screen that opened s-016 (normally s-001) |
| **Install & relaunch** | sends `installUpdate` to the host, records `vaayvu.update.installing`, and waits — it never fakes progress |
| **Progress / failure** | `updateProgress` (percent), `updateReady` and `updateError` update the status line and re-enable the action |
| **No host answer** | after 15 seconds the status says the update is still downloading instead of claiming an install is in flight |

The desktop host answers `installUpdate` with `updateError` unless an updater
is configured; builds without one say so plainly. Store builds (App Store,
Play) should perform the install natively and report progress through the same
three events.

## Step `s-017` — what’s new (standalone, capability-gated)

Route `vaayvu://onboarding/s-017`, phase `p00`, category onboarding,
capability-gated, core priority. Notes come from the host in the `ready`
payload (`releaseNotes`) or a `releaseNotes` event, and can be previewed with
`window.__vaayvuWhatsNewPrompt()` or
`window.__vaayvuOnboardingOpen('s-017')` once
`window.__vaayvuReleaseNotes` is set.

| Element | Behaviour |
|---|---|
| **Version** | `releaseNotes.version`, which must equal the installed version; notes for another release never show |
| **Date** | optional `releaseNotes.date`, printed next to the version |
| **Notes** | `releaseNotes.notes`, up to eight real release lines; no notes means no screen |
| **Feature-tour links** | `releaseNotes.links` as `{ label, tour }`; each opens s-013 at that stop (`omnibox`, `tabs`, `spaces`, `sidebar`, `ai`) |
| **Continue** | writes `vaayvu.whatsNew.seen` for the version and returns to the chain |
| **Repeat launches** | a seen version never prompts again; the notes can still be opened deliberately |
| **Ordering** | s-016 runs first while an update is available; s-017 only appears when no update is waiting |

## Step `s-020` — unsupported system (standalone, capability-gated)

Route `vaayvu://onboarding/s-020`, phase `p00`, category onboarding,
capability-gated, core priority. Only the native layer can decide that the OS
is below the supported floor; it reports the shape in the `ready` payload
(`unsupportedSystem`) or with an `unsupportedSystem` event. Preview with
`window.__vaayvuUnsupportedPrompt()` or
`window.__vaayvuOnboardingOpen('s-020')` once `window.__vaayvuUnsupported` is
set.

| Element | Behaviour |
|---|---|
| **Current system** | `unsupportedSystem.current`, shown verbatim |
| **Minimum** | `unsupportedSystem.minimum`, shown next to the current system |
| **Why** | `unsupportedSystem.why`, the real reason the floor exists |
| **Download older version** | validates `legacyUrl` as HTTP(S) and sends `openExternal`; the desktop host opens it in the system browser, outside onboarding |
| **No older build** | the download action is omitted and the note says no older build is published for the device |
| **Continue** | closes the screen and returns to the chain; it never claims the device is supported |
| **Ordering** | runs before s-016 and s-017, because a below-floor system can block the app itself |

`active: false` (or no data) hides the screen entirely.

## Step `s-018` — crash restore (standalone, capability-gated)

Route `vaayvu://onboarding/s-018`, phase `p00`, category onboarding,
capability-gated, core priority. The host reports the previous session in the
`ready` payload (`capabilities.crashRestore`) or through a `crashRestore`
event. The report may be `{ tabs: [...] }` or an array of tabs; when the host
only says the last launch failed, the stored `vaayvu.tabs` list is used. With
no restorable HTTP(S) page the screen never appears and
`__vaayvuCrashRestorePrompt()` returns false. Preview with
`window.__vaayvuOnboardingOpen('s-018')` once
`window.__vaayvuCrashRestore = { tabs: [...] }` is set.

| Element | Behaviour |
|---|---|
| **Tab list** | real titles and hosts, up to six shown with an exact “and N more tabs” line; duplicate and non-HTTP(S) URLs are dropped |
| **Restore N tabs** | opens each reported page through `addTab`, keeps pinned state and records `restoredTabs`; pages already open are counted, not duplicated |
| **Discard** | leaves the pages closed and records `crashRestore: "discarded"`; a stored crashed session also has its `tabs`/`active` keys removed |
| **No host list** | reads saved `vaayvu.tabs` only when the host reports a crash, never on a normal launch |
| **Ordering** | runs before s-019 safe mode, s-020 unsupported, s-016/s-017 and s-021 |
| **Repeat launches** | the chosen action is recorded in `vaayvu.onboarding`; the same report cannot loop in one launch |

Crash restore and safe mode are recovery surfaces: they can reveal the
onboarding layer even when the boot gate stayed hidden for a returning
profile. The rest of the first-run chain stays gated to `boot.show`.

## Step `s-019` — safe mode prompt (standalone, capability-gated)

Route `vaayvu://onboarding/s-019`, phase `p00`, category onboarding,
capability-gated, core priority. This screen is not part of the normal
first-run chain. The host reports an unclean previous launch in the `ready`
payload (`capabilities.safeMode`) or through a `safeMode` event; without that
report the screen never appears and `__vaayvuSafeModePrompt()` returns false.
Preview it with `window.__vaayvuOnboardingOpen('s-019')` once
`window.__vaayvuSafeMode = { reason, crashes }` is set.

| Choice | Behaviour |
|---|---|
| **Disable extensions** | turns off every installed style extension through `VaayvuExtensions.disableAll()` and leaves the packages installed so they can be re-enabled; then closes into the browser |
| **Reset Vaayvu** | asks once in-screen, then restores default settings through `VaayvuPreferences.reset()`, drops the shield policy so recommended rules return, and disables style extensions. Bookmarks, passwords, history, tabs and downloads are kept. The page reloads so the defaults apply |
| **Continue** | closes the prompt without changing anything |

The prompt shows the host's reason when supplied, otherwise the number of
unclean starts, and the real number of installed style extensions. Nothing is
written until a choice is made. Every exit records the route and the chosen
safe-mode action in `vaayvu.onboarding`, so the prompt does not loop. The host
is responsible for clearing its safe-mode report once recovery succeeds.

## Screen `s-021` — main window, light (window chrome, phase p03)

Route `vaayvu://window-chrome/s-021`, phase `p03`, category **window chrome**,
capability-gated, core priority. A labelled map of the window — **frame, tab
strip, toolbar, content** — drawn in the light palette so it matches the v1
atlas capture even when the person chose a dark theme. It is informational:
there is no setting to change, and it does not run inside the p00 onboarding
chain.

| Element | Behaviour |
|---|---|
| **Frame** | window edge, traffic lights and title bar |
| **Tab strip** | active tab plus Work/Study tabs and the new-tab control |
| **Toolbar** | back/forward/reload, address, Rasha Shield, menu |
| **Content** | start-page search, favorites and the Shield pill |
| **Continue** | closes back to the setup chain |
| **Platform gate** | `mainWindow: false` hides the screen entirely |
| **Entry** | a `mainWindow` event, `window.__vaayvuMainWindowPrompt()`, or `window.__vaayvuOnboardingOpen('s-021')`; it is not auto-opened by the p00 `ready` chain |
| **Category / phase** | sets `data-atlas-category="window-chrome"` and `data-onboarding-phase="p03"` |

## Screen `s-022` — main window, dark (window chrome, phase p03)

Route `vaayvu://window-chrome/s-022`, phase `p03`, category **window chrome**,
capability-gated, core priority. The same labelled map as s-021 — **frame, tab
strip, toolbar, content** — using the dark tokens instead of the light palette
(`onboarding-mainwindow is-dark`). It is informational and does not run inside
the p00 onboarding chain.

| Element | Behaviour |
|---|---|
| **Entry** | `{ type: 'mainWindow', theme: 'dark' }`, `window.__vaayvuMainWindowPrompt('dark')`, or `window.__vaayvuOnboardingOpen('s-022')` |
| **Platform gate** | `mainWindow: false` hides s-021 and s-022 together |
| **Region labels** | unchanged: 01 Frame, 02 Tab strip, 03 Toolbar, 04 Content |
| **Category / phase** | `data-atlas-category="window-chrome"`, `data-onboarding-phase="p03"` |
| **Continue** | closes back to the chain |

## Screen `s-023` — compact window (window chrome, phase p03)

Route `vaayvu://window-chrome/s-023`, phase `p03`, category **window chrome**,
capability-gated, core priority. This map shows the same window at a narrow
width: the frame keeps the page, toolbar labels drop to icons, and actions
that no longer fit move into the overflow menu instead of disappearing.

| Element | Behaviour |
|---|---|
| **Narrow frame** | a 320 px-max window inside the atlas stage, with traffic lights, the active tab and a second tab |
| **Icon-only** | tab and toolbar controls become square icon targets; the address stays the widest element |
| **Overflow** | the open menu lists New tab, Find in page, Bookmark and Split view |
| **Region labels** | 01 Narrow, 02 Icon only, 03 Overflow |
| **Entry** | a `compactWindow` event, `window.__vaayvuCompactWindowPrompt()`, or `window.__vaayvuOnboardingOpen('s-023')`; never auto-opened by the p00 ready chain |
| **Platform gate** | `compactWindow: false` hides it; `mainWindow: false` hides it with s-021/s-022 |
| **Category / phase** | `data-atlas-category="window-chrome"`, `data-onboarding-phase="p03"` |
| **Continue** | closes back to the setup chain |

## Screen `s-024` — fullscreen (window chrome, phase p03)

Route `vaayvu://window-chrome/s-024`, phase `p03`, category **window chrome**,
capability-gated, core priority. A live preview of full screen: the tab strip,
address and Shield are hidden, and the top edge reveals them again.

| Element | Behaviour |
|---|---|
| **Hidden chrome** | `.fs-chrome` starts above the frame; only the page is visible |
| **Edge reveal** | hovering/pointing at the top 56 px adds `is-revealed` and slides the chrome down |
| **Reveal chrome / Hide chrome** | the same state, operable by keyboard and touch |
| **Continue** | closes back to the chain |
| **Platform gate** | `fullscreen: false` hides the screen |
| **Entry** | `{ type: 'fullscreen' }`, `window.__vaayvuFullscreenPrompt()`, or `window.__vaayvuOnboardingOpen('s-024')`; not part of the p00 ready chain |

## Screen `s-025` — horizontal tab strip (window chrome, phase p03)

Route `vaayvu://window-chrome/s-025`, phase `p03`, category **window chrome**,
capability-gated, core priority. A map of the horizontal tab strip: active,
pinned and grouped pages share one row, with new tab, overflow and tab search
at the end.

| Element | Behaviour |
|---|---|
| **Tabs** | active Observatory tab plus Work and Study tabs; the row shrinks before it hides a tab |
| **New tab** | the `+` control sits after the last visible tab |
| **Overflow** | `»` carries a count and opens a menu of tabs that no longer fit |
| **Search** | the magnifier expands the tab-search field with its shortcut |
| **Region labels** | 01 Tabs, 02 New tab, 03 Overflow, 04 Search |
| **Entry** | a `horizontalTabs`/`tabStrip` event, `window.__vaayvuHorizontalTabsPrompt()`, or `window.__vaayvuOnboardingOpen('s-025')`; not part of the p00 ready chain |
| **Platform gate** | `horizontalTabs: false` or `tabStrip: false` hides it; `mainWindow: false` hides it with the other window maps |
| **Continue** | closes back to the setup chain |

## Screen `s-026` — vertical tab rail (window chrome, phase p03)

Route `vaayvu://window-chrome/s-026`, phase `p03`, category **window chrome**,
capability-gated, core priority. A working preview of the rail: tabs form a
tree under the page that opened them, groups fold, spaces sit at the foot, and
the whole rail collapses to icons.

| Element | Behaviour |
|---|---|
| **Tree** | a group row with child tabs; active tab keeps the accent |
| **Groups** | Design and Research fold independently and keep their tabs |
| **Spaces** | Personal, Work and Study dots at the bottom of the rail |
| **Collapse** | narrows the rail to icons and keeps every target; Expand restores it |
| **Platform gate** | `verticalRail: false` hides the screen |
| **Entry** | `{ type: 'verticalRail' }`, `window.__vaayvuVerticalRailPrompt()`, or `window.__vaayvuOnboardingOpen('s-026')`; not part of the p00 ready chain |

## Screen `s-027` — tab overflow menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-027`, phase `p03`, category **window chrome**,
capability-gated, core priority. The expanded overflow menu: every open tab in
one list, a search field, and a close control on each row.

| Element | Behaviour |
|---|---|
| **All tabs** | active Observatory, Work, Study, Mail and News with real title/host rows |
| **Search** | “Search all tabs” field sits above the list, with Esc to dismiss |
| **Close** | each row has its own `×`; closing is separate from switching |
| **Active state** | the current tab keeps the accent bar and a stronger title |
| **Region labels** | 01 All tabs, 02 Search, 03 Close |
| **Entry** | a `tabOverflow`/`tabMenu` event, `window.__vaayvuTabOverflowPrompt()`, or `window.__vaayvuOnboardingOpen('s-027')`; not part of the p00 ready chain |
| **Platform gate** | `tabMenu: false`, `tabOverflow: false`, `horizontalTabs: false` or `mainWindow: false` hides it |
| **Continue** | closes back to the setup chain |

## Screen `s-028` — toolbar, default (window chrome, phase p03)

Route `vaayvu://window-chrome/s-028`, phase `p03`, category **window chrome**,
capability-gated, core priority. The default toolbar in one row: navigation,
omnibox, Rasha Shield, extensions, profile and menu.

| Element | Behaviour |
|---|---|
| **Navigation** | back, forward and reload grouped on the left |
| **Omnibox** | search or address; focusing shows local suggestions only |
| **Rasha Shield** | toggles protection for this site and says so; other tabs keep theirs |
| **Extensions / profile / menu** | each explains the surface it opens |
| **Platform gate** | `toolbar: false` hides the screen |
| **Entry** | `{ type: 'toolbar' }`, `window.__vaayvuToolbarPrompt()`, or `window.__vaayvuOnboardingOpen('s-028')`; not part of the p00 ready chain |

## Screen `s-029` — toolbar customize (window chrome, phase p03)

Route `vaayvu://window-chrome/s-029`, phase `p03`, category **window chrome**,
capability-gated, core priority. A working preview of toolbar editing: drag
grips reorder the row, Hide/Show move controls between Toolbar and Available,
and Reset restores the default set.

| Element | Behaviour |
|---|---|
| **Drag** | shown controls are draggable; dropping one on another reorders the preview and keeps the control |
| **Show/hide** | Hide moves a control to Available; Show appends it back to the row |
| **Reset** | one action restores the seven default controls |
| **Guard** | the last visible control cannot be hidden |
| **Preview** | chips update immediately as the order or visibility changes |
| **Platform gate** | `toolbarCustomize: false` hides the editor; `toolbar: false` hides it with s-028 |
| **Entry** | a `toolbarCustomize`/`customizeToolbar` event, `window.__vaayvuToolbarCustomizePrompt()`, or `window.__vaayvuOnboardingOpen('s-029')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-030` — omnibox, idle (window chrome, phase p03)

Route `vaayvu://window-chrome/s-030`, phase `p03`, category **window chrome**,
capability-gated, core priority. The omnibox at rest: the full URL, the
security chip and the page actions that stay visible.

| Element | Behaviour |
|---|---|
| **URL** | shows `https://vaayvu.com/` by default, or `capabilities.omniboxUrl` when the host provides one |
| **Security chip** | opens real site details: secure HTTPS, first-party cookies, no permissions |
| **Bookmark** | toggles saved state and announces it |
| **Reader** | toggles Reader view for the page |
| **Find / Share** | report the bar or sheet they open |
| **Platform gate** | `omnibox: false` hides the screen |
| **Entry** | `{ type: 'omniboxIdle' }`, `window.__vaayvuOmniboxPrompt()`, or `window.__vaayvuOnboardingOpen('s-030')`; not part of the p00 ready chain |

## Screen `s-031` — omnibox expanded (window chrome, phase p03)

Route `vaayvu://window-chrome/s-031`, phase `p03`, category **window chrome**,
capability-gated, core priority. The expanded omnibox with suggestions in
three sections: **This device**, **Search** and **Actions**.

| Element | Behaviour |
|---|---|
| **Suggestions** | bookmark, history, page, search and action rows with title, source and kind |
| **Sections** | This device first, then Search, then Actions; the list stays grouped by source |
| **Keyboard** | ↑ ↓ moves the selected row and focus, wrapping at both ends; Enter activates it |
| **Open selected** | the same action for touch, with a status line naming the chosen row |
| **Platform gate** | `omnibox: false`, `omniboxSuggestions: false` or `toolbar: false` hides the screen |
| **Entry** | an `omnibox`/`omniboxExpanded` event, `window.__vaayvuOmniboxExpandedPrompt()`, or `window.__vaayvuOnboardingOpen('s-031')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-032` — security chip popover (window chrome, phase p03)

Route `vaayvu://window-chrome/s-032`, phase `p03`, category **window chrome**,
capability-gated, core priority. The site-information panel behind the
security chip: connection, certificate, cookies and permissions.

| Element | Behaviour |
|---|---|
| **Connection** | HTTPS status and protocol; host may supply real values in `capabilities.securityInfo` |
| **Certificate** | validity, host and issuer — no fingerprint is invented |
| **Cookies** | first-party and third-party counts; **Manage cookies** lists them, **Clear site cookies** sets both to zero |
| **Permissions** | Camera, Microphone and Location cycle Ask → Allowed → Blocked, per site |
| **Platform gate** | `securityChip: false` hides the screen |
| **Entry** | `{ type: 'securityChip' }`, `window.__vaayvuSecurityChipPrompt()`, or `window.__vaayvuOnboardingOpen('s-032')`; not part of the p00 ready chain |

## Screen `s-033` — permissions chip (window chrome, phase p03)

Route `vaayvu://window-chrome/s-033`, phase `p03`, category **window chrome**,
capability-gated, core priority. The compact permission chip inside the
omnibox, with the active camera grant and its revoke path.

| Element | Behaviour |
|---|---|
| **Active chip** | Camera stays visible while allowed; the dot and colour show Allowed, Ask or Blocked |
| **Details** | names the site, the exact grant and the effect |
| **Revoke** | sets the grant back to Ask and says the site must ask again |
| **Allow / Reset** | returns an Ask or Blocked permission to Allowed or Ask |
| **Other permissions** | Microphone and Location states stay visible below the panel |
| **Close** | hides the panel; the chip and its state stay in the omnibox |
| **Platform gate** | `permissionsChip: false`, `permissions: false`, `omnibox: false` or `securityChip: false` hides it |
| **Entry** | a `permissionsChip`/`permissionChip` event, `window.__vaayvuPermissionsChipPrompt()`, or `window.__vaayvuOnboardingOpen('s-033')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-035` — bookmarks bar (window chrome, phase p03)

Route `vaayvu://window-chrome/s-035`, phase `p03`, category **window chrome**,
capability-gated, core priority. The bar under the toolbar: folders, visible
bookmarks, overflow and edit mode.

| Element | Behaviour |
|---|---|
| **Folders** | Design and Reading open a menu of their saved pages |
| **Overflow** | `»` carries a count and opens the bookmarks that no longer fit |
| **Edit** | adds a remove control to every visible bookmark or folder; Done leaves the mode |
| **Remove / Reset** | removal is local to the preview; Reset restores the sample row |
| **Region labels** | 01 Folders, 02 Overflow, 03 Edit |
| **Platform gate** | `bookmarksBar: false` or `bookmarks: false` hides the screen |
| **Entry** | a `bookmarksBar`/`bookmarksBarPreview` event, `window.__vaayvuBookmarksBarPrompt()`, or `window.__vaayvuOnboardingOpen('s-035')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-034` — page actions chip (window chrome, phase p03)

Route `vaayvu://window-chrome/s-034`, phase `p03`, category **window chrome**,
capability-gated, core priority. The page-actions popover in the toolbar:
Reader, Translate, Zoom and the reading list.

| Element | Behaviour |
|---|---|
| **Reader** | toggles Reader view and reports the state |
| **Translate** | toggles translation to English and reports it |
| **Zoom** | −/+ steps at 10%, clamped 50–200%; host can seed any value in range |
| **Reading list** | adds or removes the page and reports it |
| **Capability rows** | `canReader`, `canTranslate`, `canZoom`, `canReadingList` hide individual rows |
| **Platform gate** | `pageActions: false` hides the screen |
| **Entry** | `{ type: 'pageActions' }`, `window.__vaayvuPageActionsPrompt()`, or `window.__vaayvuOnboardingOpen('s-034')`; not part of the p00 ready chain |

## Screen `s-037` — find bar (window chrome, phase p03)

Route `vaayvu://window-chrome/s-037`, phase `p03`, category **window chrome**,
capability-gated, core priority. The page find bar with a query, match count,
step controls and the two match options.

| Element | Behaviour |
|---|---|
| **Input** | sample query “vaayvu” in the find field |
| **Count** | `N of M` updates with every step and every option |
| **Prev / next** | step through matches and wrap at both ends |
| **Match case** | narrows the count to exact-case matches |
| **Whole word** | narrows the count to whole-word matches; combines with case |
| **Close** | hides the bar and leaves a Find button on the page |
| **Region labels** | 01 Input, 02 Count, 03 Options, 04 Close |
| **Platform gate** | `findBar: false` or `pageFind: false` hides the screen |
| **Entry** | a `findBar`/`findBarPreview` event, `window.__vaayvuFindBarPrompt()`, or `window.__vaayvuOnboardingOpen('s-037')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-036` — status / hover URL (window chrome, phase p03)

Route `vaayvu://window-chrome/s-036`, phase `p03`, category **window chrome**,
capability-gated, core priority. The bottom-left status shows the full
destination of the link under the pointer, and whether the scheme is safe.

| Element | Behaviour |
|---|---|
| **Bottom-left** | the status stays in the window corner, out of the page |
| **Full URL** | shows the whole destination, not a shortened label |
| **Safety** | HTTPS reads **Secure**; HTTP reads **Not secure** with the reason |
| **Hover** | pointing at a link updates the status without opening it |
| **Host seed** | `capabilities.hoverUrl` sets the starting destination |
| **Platform gate** | `statusBar: false` hides the screen |
| **Entry** | `{ type: 'hoverUrl' }`, `window.__vaayvuHoverUrlPrompt()`, or `window.__vaayvuOnboardingOpen('s-036')`; not part of the p00 ready chain |

## Screen `s-038` — download bubble (window chrome, phase p03)

Route `vaayvu://window-chrome/s-038`, phase `p03`, category **window chrome**,
capability-gated, core priority. The toolbar download bubble with an active
transfer and a completed file.

| Element | Behaviour |
|---|---|
| **Active** | name, size, speed and a real progress bar at 62% |
| **Completed** | finished file stays listed until cleared |
| **Pause / Resume** | keeps the transfer at 62% and reports the state |
| **Reveal** | calls the host’s `openDownloads` command and says the folder is opening |
| **No reveal** | `canOpenDownloads: false` hides both reveal buttons |
| **Platform gate** | `downloadBubble: false` hides the screen |
| **Entry** | `{ type: 'downloadBubble' }`, `window.__vaayvuDownloadBubblePrompt()`, or `window.__vaayvuOnboardingOpen('s-038')`; not part of the p00 ready chain |

## Screen `s-039` — download shelf (window chrome, phase p03)

Route `vaayvu://window-chrome/s-039`, phase `p03`, category **window chrome**,
capability-gated, core priority. The shelf at the bottom of the window, plus
its download-history drawer.

| Element | Behaviour |
|---|---|
| **Shelf** | three completed files stay at the bottom without covering the page |
| **History** | opens a right-side drawer with older downloads, source and date |
| **Clear** | removes the shelf and the history together; the empty state is explicit |
| **Open** | a shelf row reports the file it would open in the preview |
| **Region labels** | 01 Shelf, 02 History, 03 Clear |
| **Platform gate** | `downloadShelf: false` or `downloads: false` hides the screen |
| **Entry** | a `downloadShelf`/`downloadShelfPreview` event, `window.__vaayvuDownloadShelfPrompt()`, or `window.__vaayvuOnboardingOpen('s-039')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-040` — extension overflow (window chrome, phase p03)

Route `vaayvu://window-chrome/s-040`, phase `p03`, category **window chrome**,
capability-gated, core priority. Pinned extensions in the toolbar, the rest
behind one overflow control, and the manager beneath them.

| Element | Behaviour |
|---|---|
| **Pinned** | icons stay in the toolbar in order; each opens with a status |
| **Overflow** | the remaining count sits on one control; the menu lists them all |
| **Pin / Unpin** | moves an extension between the toolbar and overflow and updates the count |
| **Manager** | calls the real `extensions` command |
| **Platform gate** | `extensionOverflow: false` hides the screen |
| **Entry** | `{ type: 'extensionOverflow' }`, `window.__vaayvuExtensionOverflowPrompt()`, or `window.__vaayvuOnboardingOpen('s-040')`; not part of the p00 ready chain |

## Screen `s-041` — profile menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-041`, phase `p03`, category **window chrome**,
capability-gated, core priority. The profile menu with profiles, spaces, guest
and manage in one surface. Route `s-042` remains the separate space switcher.

| Element | Behaviour |
|---|---|
| **Profiles** | Personal, Work and Study; selecting one updates the menu header |
| **Spaces** | Personal, Work and Study chips select the active space |
| **Guest** | opens a guest window with temporary storage; hidden when `canGuestWindow: false` |
| **Manage** | opens a small manager with Create profile; Done closes it |
| **Region labels** | 01 Profiles, 02 Spaces, 03 Guest, 04 Manage |
| **Platform gate** | `profileMenu: false` or `profiles: false` hides the screen |
| **Entry** | a `profileMenu`/`profileMenuPreview` event, `window.__vaayvuProfileMenuPrompt()`, or `window.__vaayvuOnboardingOpen('s-041')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-042` — space switcher (window chrome, phase p03)

Route `vaayvu://window-chrome/s-042`, phase `p03`, category **window chrome**,
capability-gated, core priority. The space switcher with icons, accents, add
and edit.

| Element | Behaviour |
|---|---|
| **Spaces** | Personal, Work and Study switch without mixing tabs or pins |
| **Icons** | six choices update the active space immediately |
| **Colours** | six accents update the active space immediately |
| **Add** | appends a new space, selects it and reports the name |
| **Edit** | opens icon/colour controls for the active space |
| **Region labels** | 01 Spaces, 02 Icons, 03 Colours, 04 Add / edit |
| **Platform gate** | `spaceSwitcher: false` hides the screen |
| **Entry** | a `spaceSwitcher` event, `window.__vaayvuSpaceSwitcherPrompt()`, or `window.__vaayvuOnboardingOpen('s-042')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-044` — macOS menu bar (window chrome, phase p03)

Route `vaayvu://window-chrome/s-044`, phase `p03`, category **window chrome**,
capability-gated, core priority. The macOS menu bar in atlas order: File,
Edit, View, History, Bookmarks, People, Tab, Window and Help.

| Element | Behaviour |
|---|---|
| **Menu bar** | app name left of every menu, horizontally scrollable at narrow widths |
| **Menus** | choosing one opens its items and shortcut keys |
| **Items** | selecting one reports the path, e.g. View → Reader View |
| **Platform gate** | `menuBar: false` hides the screen |
| **Entry** | `{ type: 'menuBar' }`, `window.__vaayvuMenuBarPrompt()`, or `window.__vaayvuOnboardingOpen('s-044')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-043` — app menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-043`, phase `p03`, category **window chrome**,
capability-gated, core priority. The browser/app menu with new, library, app
and quit actions.

| Section | Rows |
|---|---|
| **New** | New tab, New window, New private window |
| **Library** | History, Bookmarks, Downloads |
| **App** | Settings, Help and shortcuts |
| **Quit** | asks once; the native app menu owns the real close in this preview |

| Element | Behaviour |
|---|---|
| **Region labels** | 01 New, 02 Library, 03 App, 04 Quit |
| **Platform gate** | `appMenu: false` or `browserMenu: false` hides the screen |
| **Entry** | an `appMenu`/`browserMenu` event, `window.__vaayvuAppMenuPrompt()`, or `window.__vaayvuOnboardingOpen('s-043')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-046` — page context menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-046`, phase `p03`, category **window chrome**,
capability-gated, core priority. The right-click menu on page content:
Back, Forward, Reload, Save Page As…, Print…, Translate…, Reader View and
Inspect.

| Element | Behaviour |
|---|---|
| **History** | Back, Forward and Reload call the real commands |
| **Save / Print** | call `savePage` and `print` |
| **Reader** | calls `reader` and toggles the label to Exit Reader View |
| **Translate** | sends `translatePage`; honest fallback when no host handler exists |
| **Inspect** | calls `inspect` |
| **Platform gate** | `pageContext: false` hides the screen |
| **Entry** | `{ type: 'pageContext' }`, `window.__vaayvuPageContextPrompt()`, or `window.__vaayvuOnboardingOpen('s-046')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-045` — jump list (window chrome, phase p03)

Route `vaayvu://window-chrome/s-045`, phase `p03`, category **window chrome**,
capability-gated, core priority. The taskbar jump list: recent pages, tasks and
the new-window paths.

| Section | Behaviour |
|---|---|
| **Recent** | three recent pages with their host; selecting one reports it |
| **Tasks** | New window, New private window and New tab |
| **Taskbar** | the app icon opens and closes the jump list |
| **Region labels** | 01 Recent, 02 Tasks, 03 Taskbar |
| **Platform gate** | `jumpList: false` or `taskbar: false` hides the screen |
| **Entry** | a `jumpList`/`taskbarJumpList` event, `window.__vaayvuJumpListPrompt()`, or `window.__vaayvuOnboardingOpen('s-045')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-048` — image / video context menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-048`, phase `p03`, category **window chrome**,
capability-gated, core priority. The right-click menu on media: Save, Copy,
Open in new tab, Search, Picture-in-Picture and Cast.

| Element | Behaviour |
|---|---|
| **Save / Copy / Open / Search** | send `saveMedia`, `copyMedia`, `openMedia` and `searchMedia` with the media kind |
| **Picture-in-Picture** | sends `pictureInPicture` / `exitPictureInPicture` and toggles the label |
| **Cast** | sends `castMedia` and says it is looking for devices |
| **Video / image** | `mediaKind` chooses labels; an image hides Picture-in-Picture |
| **Platform gates** | `imageContext: false` hides the screen; `canPictureInPicture` and `canCast` hide those rows |
| **Entry** | `{ type: 'mediaContext' }`, `window.__vaayvuMediaContextPrompt()`, or `window.__vaayvuOnboardingOpen('s-048')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-047` — link context menu (window chrome, phase p03)

Route `vaayvu://window-chrome/s-047`, phase `p03`, category **window chrome**,
capability-gated, core priority. The menu on a link, with every open target and
the link actions.

| Section | Rows |
|---|---|
| **Open** | New tab, New window, Private window, Split view |
| **Link** | Copy link, Share link |
| **Send** | Send to your device |

| Element | Behaviour |
|---|---|
| **Target** | the highlighted link sits in the page mock; the menu carries its address |
| **Region labels** | 01 Open, 02 Link, 03 Send |
| **Platform gate** | `linkContext: false` or `contextMenu: false` hides the screen |
| **Entry** | a `linkContext`/`linkContextMenu` event, `window.__vaayvuLinkContextPrompt()`, or `window.__vaayvuOnboardingOpen('s-047')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-049` — toast / undo host (window chrome, phase p03)

Route `vaayvu://window-chrome/s-049`, phase `p03`, category **window chrome**,
capability-gated, core priority. The host for close-tab undo, bookmark,
download, sync and error notices.

| Element | Behaviour |
|---|---|
| **Close tab** | Tab closed · Undo restores it |
| **Bookmark** | Bookmark saved · Undo removes it |
| **Download** | Download complete · Show calls `openDownloads` |
| **Sync** | Bookmarks synced · Details points to Settings → Sync |
| **Error** | Sync failed · Retry stays until the toast is dismissed |
| **Dismiss** | removes the toast and reports it |
| **Platform gate** | `toastHost: false` hides the screen |
| **Entry** | `{ type: 'toastHost' }`, `window.__vaayvuToastHostPrompt()`, or `window.__vaayvuOnboardingOpen('s-049')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-050` — command palette (window chrome, phase p03)

Route `vaayvu://window-chrome/s-050`, phase `p03`, category **window chrome**,
capability-gated, core priority. The command palette opened with ⌘K or Ctrl+K,
grouped into Actions, Tabs, History, Settings and AI.

| Element | Behaviour |
|---|---|
| **Shortcut** | ⌘K / Ctrl+K is printed in the field and the region label |
| **Sections** | Actions, Tabs, History, Settings, AI; each row carries its section |
| **Keyboard** | ↑ ↓ moves the highlight and focus, wrapping; Enter runs the row |
| **Run selected** | the same action for touch, with a status line |
| **Close** | hides the panel; Open command bar brings it back |
| **Platform gate** | `commandPalette: false` or `commandBar: false` hides the screen |
| **Entry** | a `commandPalette`/`commandBar` event, `window.__vaayvuCommandPalettePrompt()`, or `window.__vaayvuOnboardingOpen('s-050')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-052` — start page, customized (start page, phase p05)

Route `vaayvu://start-page/s-052`, phase `p05`, category **start page**,
capability-gated, core priority. Wallpaper, widgets and layout for the start
page, with a live preview.

| Element | Behaviour |
|---|---|
| **Wallpaper** | Observatory, Ridge, Dusk or Paper; the preview changes immediately |
| **Widgets** | Clock, Weather, Reading list and Spaces toggle in the preview |
| **Layout** | Centered, Sidebar or Compact |
| **Host seed** | `capabilities.startPage` supplies wallpaper, layout and widget state |
| **Platform gate** | `startPageCustomize: false` hides the screen |
| **Entry** | `{ type: 'startPageCustomize' }`, `window.__vaayvuStartPageCustomizePrompt()`, or `window.__vaayvuOnboardingOpen('s-052')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-053` — start page, zero state (start page, phase p05)

Route `vaayvu://start-page/s-053`, phase `p05`, category **start page**,
capability-gated, core priority. The first-run start page with no history,
favorites or shortcuts, and an import path.

| Element | Behaviour |
|---|---|
| **First run** | the Vaayvu mark and wordmark with an empty search field |
| **No history** | explicit empty copy and four dashed shortcut placeholders |
| **Import bookmarks** | reports that the native bookmark picker would open |
| **Start fresh** | leaves the page quiet and reports the choice |
| **Region labels** | 01 First run, 02 No history, 03 Import |
| **Platform gate** | `startPage: false` or `startPageZero: false` hides the screen |
| **Entry** | a `startPageZero`/`startPageEmpty` event, `window.__vaayvuStartPageZeroPrompt()`, or `window.__vaayvuOnboardingOpen('s-053')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-055` — frequently visited (start page, phase p05)

Route `vaayvu://start-page/s-055`, phase `p05`, category **start page**,
capability-gated, core priority. The automatic frequently-visited grid with
hide and remove controls.

| Element | Behaviour |
|---|---|
| **Auto** | tiles come from this profile’s history; the switch pauses updates |
| **Hide** | dims and marks a tile hidden while leaving the visit in history |
| **Remove** | deletes the tile from the page |
| **Edit** | reveals Hide and Remove on each tile; Done leaves the mode |
| **Reset** | restores the six sample sites and re-enables auto |
| **Region labels** | 01 Auto, 02 Hide, 03 Remove |
| **Platform gate** | `frequentVisited: false` or `startPage: false` hides the screen |
| **Entry** | a `frequentVisited`/`startPageFrequent` event, `window.__vaayvuFrequentVisitedPrompt()`, or `window.__vaayvuOnboardingOpen('s-055')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-057` — spaces overview (start page, phase p05)

Route `vaayvu://start-page/s-057`, phase `p05`, category **start page**,
capability-gated, core priority. Cards for every space, each with the recent
pages that belong to it.

| Element | Behaviour |
|---|---|
| **Cards** | Personal, Work and Study with icon, tab count and accent |
| **Recents** | the last three pages stay with the space that opened them |
| **Switch** | opening a card selects that space in the preview |
| **Region labels** | 01 Cards, 02 Recents, 03 Switch |
| **Platform gate** | `spacesOverview: false` or `spaces: false` hides the screen |
| **Entry** | a `spacesOverview`/`startPageSpaces` event, `window.__vaayvuSpacesOverviewPrompt()`, or `window.__vaayvuOnboardingOpen('s-057')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-054` — shortcut editor (start page, phase p05)

Route `vaayvu://start-page/s-054`, phase `p05`, category **start page**,
capability-gated, core priority. Add, edit, delete and reorder start-page
shortcuts, each with its favicon mark and colour.

| Element | Behaviour |
|---|---|
| **Add** | appends a tile, selects it and opens its fields |
| **Edit** | name and URL save together; a non-HTTP(S) URL is refused with a reason |
| **Delete** | removes the selected tile and selects the next |
| **Reorder** | up/down arrows move a tile in the grid |
| **Favicon** | first letter and per-tile colour identify the site |
| **Host seed** | `capabilities.shortcuts` supplies names, URLs and colours |
| **Platform gate** | `shortcutEditor: false` hides the screen |
| **Entry** | `{ type: 'shortcutEditor' }`, `window.__vaayvuShortcutEditorPrompt()`, or `window.__vaayvuOnboardingOpen('s-054')`; not part of the p00 ready chain |

## Screen `s-056` — continue browsing (start page, phase p05)

Route `vaayvu://start-page/s-056`, phase `p05`, category **start page**,
capability-gated, core priority. Recent tabs from the last session, with
per-tab and restore-all actions.

| Element | Behaviour |
|---|---|
| **Recent tabs** | title and real host for each page |
| **Restore** | sends `restoreTab` with the URL |
| **Restore all** | sends `restoreTabs` with every URL |
| **Dismiss** | clears the list without opening anything |
| **Host seed** | `capabilities.recentTabs` supplies the list |
| **Platform gate** | `continueBrowsing: false` hides the screen |
| **Entry** | `{ type: 'continueBrowsing' }`, `window.__vaayvuContinueBrowsingPrompt()`, or `window.__vaayvuOnboardingOpen('s-056')`; not part of the p00 ready chain |

## Screen `s-059` — AI prompt bar (start page, phase p05)

Route `vaayvu://start-page/s-059`, phase `p05`, category **start page**,
capability-gated, core priority. The start-page prompt with “Ask about
anything” and its suggestion chips.

| Element | Behaviour |
|---|---|
| **Prompt** | a question field with a send action and an empty state |
| **Suggestions** | Summarize this page, Explain this code, Compare these tabs, Draft a reply, Find a fact |
| **Source** | the question and page excerpt go to the user’s Vaayvu sync server and its model |
| **Sync state** | shows connected; a Connect to sync action appears when it is not |
| **Region labels** | 01 Prompt, 02 Suggestions, 03 Source |
| **Platform gate** | `ai: false` or `pageQA: false` hides the screen |
| **Entry** | an `aiPrompt`/`aiBar` event, `window.__vaayvuAiPromptPrompt()`, or `window.__vaayvuOnboardingOpen('s-059')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-058` — reading list preview (start page, phase p05)

Route `vaayvu://start-page/s-058`, phase `p05`, category **start page**,
capability-gated, core priority. Three saved pages with host and reading time,
plus Open all.

| Element | Behaviour |
|---|---|
| **Saved pages** | three items with title, host and minutes |
| **Open** | sends `openReading` with that URL |
| **Open all** | sends `openReadingList` with every URL |
| **Host seed** | `capabilities.readingList` supplies titles, URLs and minutes |
| **Platform gate** | `readingListPreview: false` hides the screen |
| **Entry** | `{ type: 'readingListPreview' }`, `window.__vaayvuReadingListPrompt()`, or `window.__vaayvuOnboardingOpen('s-058')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-060` — news feed, opt-in (start page, phase p05)

Route `vaayvu://start-page/s-060`, phase `p05`, category **start page**,
capability-gated, core priority. A news feed that stays off until the person
turns it on.

| Element | Behaviour |
|---|---|
| **Off by default** | nothing is fetched; the card explains that reading stays on the device |
| **Switch** | turns the feed on or off and reports the state |
| **Topics** | six choices; selected topics are chips |
| **Sources** | The Verge, Ars Technica, MDN Blog and Reuters |
| **Hide** | hides one story without changing the feed |
| **Host seed** | `capabilities.newsFeed` can supply enabled, topics, sources and hidden stories |
| **Platform gate** | `newsFeed: false` hides the screen |
| **Entry** | `{ type: 'newsFeed' }`, `window.__vaayvuNewsFeedPrompt()`, or `window.__vaayvuOnboardingOpen('s-060')`; not part of the p00 ready chain |

## Screen `s-061` — widgets (start page, phase p05)

Route `vaayvu://start-page/s-061`, phase `p05`, category **start page**,
capability-gated, core priority. The start-page widgets: local clock, weather
and opt-in stocks.

| Element | Behaviour |
|---|---|
| **Clock** | current local time and date, rendered from the device clock |
| **Weather** | no invented temperature; Choose city explains that the city is sent to Open-Meteo |
| **Stocks** | off by default; enabling says a provider is required and no quotes are bundled |
| **Region labels** | 01 Clock, 02 Weather, 03 Stocks |
| **Platform gate** | `widgets: false` or `startPage: false` hides the screen |
| **Entry** | a `widgets`/`startPageWidgets` event, `window.__vaayvuWidgetsPrompt()`, or `window.__vaayvuOnboardingOpen('s-061')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-062` — wallpaper picker (start page, phase p05)

Route `vaayvu://start-page/s-062`, phase `p05`, category **start page**,
capability-gated, core priority. Built-in scenes, gradients, a local image,
blur and wallpaper sync.

| Element | Behaviour |
|---|---|
| **Built-in** | Observatory, Ridge, Dusk, Paper, Alpine dusk, Soft gradient |
| **Gradients** | Sunrise, Mint, Graphite, Rose |
| **Image** | Choose image explains the picker and that the image stays on this device |
| **Blur** | 0–24 px slider updates the preview and status live |
| **Sync** | wallpaper sync says it uses the user’s Vaayvu sync server; off keeps it local |
| **Region labels** | 01 Built-in, 02 Gradient and image, 03 Blur, 04 Sync |
| **Platform gate** | `wallpaperPicker: false` or `startPage: false` hides the screen |
| **Entry** | a `wallpaperPicker`/`startPageWallpaper` event, `window.__vaayvuWallpaperPrompt()`, or `window.__vaayvuOnboardingOpen('s-062')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-064` — offline start (start page, phase p05)

Route `vaayvu://start-page/s-064`, phase `p05`, category **start page**,
capability-gated, core priority. The start page without a connection:
cached shortcuts stay reachable and Retry checks again.

| Element | Behaviour |
|---|---|
| **Offline** | a clear banner; the page never pretends to be online |
| **Cached shortcuts** | Vaayvu, GitHub, Docs and Wikipedia with a Cached label |
| **Open cached** | reports that the cached copy opens and the live page needs a connection |
| **Retry** | checks once; repeat attempts say it is still offline and keep the cache visible |
| **Region labels** | 01 Offline, 02 Cached shortcuts, 03 Retry |
| **Platform gate** | `offlineStart: false` or `offline: false` hides the screen |
| **Entry** | an `offlineStart`/`startPageOffline` event, `window.__vaayvuOfflineStartPrompt()`, or `window.__vaayvuOnboardingOpen('s-064')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-063` — start page settings (start page, phase p05)

Route `vaayvu://start-page/s-063`, phase `p05`, category **start page**,
capability-gated, core priority. Section toggles and layout for the start page,
with a live preview above the controls.

| Element | Behaviour |
|---|---|
| **Sections** | Search, Spaces, Favorites, Recently visited, Reading list, Continue browsing and News feed, each on/off |
| **Layout** | Centered, Sidebar or Compact; the preview follows |
| **Preview** | every toggle and layout change repaints the stage |
| **Host seed** | `capabilities.startSettings` supplies sections and layout |
| **Platform gate** | `startSettings: false` hides the screen |
| **Entry** | `{ type: 'startSettings' }`, `window.__vaayvuStartSettingsPrompt()`, or `window.__vaayvuOnboardingOpen('s-063')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-065` — private start (start page, phase p05)

Route `vaayvu://start-page/s-065`, phase `p05`, category **start page**,
capability-gated, core priority. The private window explainer with an omnibox
that has nothing local to suggest.

| Element | Behaviour |
|---|---|
| **Private badge** | states what the window is |
| **Guarantees** | no history, no local suggestions, no sync/profile, cookies clear on close |
| **Suggestions** | Check suggestions shows the honest empty result |
| **Platform gate** | `privateStart: false` hides the screen |
| **Entry** | `{ type: 'privateStart' }`, `window.__vaayvuPrivateStartPrompt()`, or `window.__vaayvuOnboardingOpen('s-065')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-066` — active tab (start page, phase p05)

Route `vaayvu://start-page/s-066`, phase `p05`, category **start page**,
capability-gated, core priority. The anatomy of the active tab in a strip.

| Element | Behaviour |
|---|---|
| **Favicon and title** | the page mark and name share the active row |
| **Audio** | speaker toggles between Playing and Muted |
| **Close** | closes the tab and leaves a Reopen control |
| **Group colour** | six swatches change the tab edge, favicon and detail |
| **Region labels** | 01 Favicon and title, 02 Audio, 03 Close, 04 Group colour |
| **Platform gate** | `activeTab: false` or `startPage: false` hides the screen |
| **Entry** | an `activeTab`/`startPageActiveTab` event, `window.__vaayvuActiveTabPrompt()`, or `window.__vaayvuOnboardingOpen('s-066')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-067` — inactive tab (start page, phase p05)

Route `vaayvu://start-page/s-067`, phase `p05`, category **start page**,
capability-gated, core priority. A background tab is dimmed; its pin and close
actions appear on hover or keyboard focus.

| Element | Behaviour |
|---|---|
| **Dimmed tab** | the background tab sits quieter than the active one |
| **Hover actions** | Pin and Close appear without taking space at rest; always visible on touch |
| **Activate** | clicking the dimmed tab makes it the active page |
| **Pin / Close** | report the result; closing removes the tab |
| **Platform gate** | `inactiveTab: false` hides the screen |
| **Entry** | `{ type: 'inactiveTab' }`, `window.__vaayvuInactiveTabPrompt()`, or `window.__vaayvuOnboardingOpen('s-067')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-068` — pinned tab (tabs, phase p05)

Route `vaayvu://tabs/s-068`, phase `p05`, category **tabs**,
capability-gated, core priority. Pinned tabs keep only their favicon and sit in
a fixed zone left of the regular strip.

| Element | Behaviour |
|---|---|
| **Favicon only** | a pinned tab shows its mark and drops the title |
| **Fixed zone** | pinned tabs stay left of the divider in their own order |
| **Pin** | a regular tab moves into the fixed zone and keeps its mark |
| **Unpin** | returns the tab to the regular strip with its title |
| **Activate** | clicking any tab makes it active |
| **Platform gate** | `pinnedTab: false` hides the screen |
| **Entry** | `{ type: 'pinnedTab' }`, `window.__vaayvuPinnedTabPrompt()`, or `window.__vaayvuOnboardingOpen('s-068')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-069` — muted tab (start page, phase p05)

Route `vaayvu://start-page/s-069`, phase `p05`, category **start page**,
capability-gated, core priority. The muted tab state and its unmute action.

| Element | Behaviour |
|---|---|
| **Muted icon** | speaker with a slash shows this tab is silent |
| **Unmute** | restores sound without reloading the page; the icon becomes a normal speaker |
| **Scope** | only this tab changes; other tabs keep their own audio |
| **Region labels** | 01 Muted icon, 02 Unmute, 03 Scope |
| **Platform gate** | `mutedTab: false` or `startPage: false` hides the screen |
| **Entry** | a `mutedTab`/`startPageMutedTab` event, `window.__vaayvuMutedTabPrompt()`, or `window.__vaayvuOnboardingOpen('s-069')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Tabs screens `s-066`–`s-069` (category tabs, phase p05)

All four live under `vaayvu://tabs/<screen>`, phase `p05`, category **tabs**,
capability-gated:

| Screen | Route | Focus |
|---|---|---|
| **s-066** | `vaayvu://tabs/s-066` | Active tab: favicon, title, audio, close and group colour |
| **s-067** | `vaayvu://tabs/s-067` | Inactive tab: dimmed, hover actions, activate |
| **s-068** | `vaayvu://tabs/s-068` | Pinned tab: favicon only, fixed zone, pin/unpin |
| **s-069** | `vaayvu://tabs/s-069` | Muted tab: muted audio state and toggle |
| **s-070** | `vaayvu://tabs/s-070` | Playing audio: animated speaker, click to mute |
| **s-071** | `vaayvu://tabs/s-071` | Loading tab: spinner, progress bar, settles on favicon |
| **s-073** | `vaayvu://tabs/s-073` | Sleeping tab: dimmed, Sleeping badge, wake on click |
| **s-074** | `vaayvu://tabs/s-074` | Hover preview: thumbnail, title, URL, close and mute |
| **s-075** | `vaayvu://tabs/s-075` | Collapsed group: coloured header, tab count, expand |
| **s-076** | `vaayvu://tabs/s-076` | Expanded group: tabs, edit, close, group |
| **s-077** | `vaayvu://tabs/s-077` | Stack archive: archived stacks, restore, search |
| **s-078** | `vaayvu://tabs/s-078` | Split 2-up: divider, swap, close pane, focus |
| **s-079** | `vaayvu://tabs/s-079` | Split 3/4-up: grid of three or four panes, per-pane toolbar |
| **s-080** | `vaayvu://tabs/s-080` | Tab search: fuzzy match, preview, switch, new window |
| **s-081** | `vaayvu://tabs/s-081` | Mobile tab grid: cards, groups, close all, private |
| **s-082** | `vaayvu://tabs/s-082` | Mobile tab list: compact rows, search |
| **s-083** | `vaayvu://tabs/s-083` | Group editor: name, colour, emoji, save, sync |
| **s-084** | `vaayvu://tabs/s-084` | Tab content menu: 25 actions in five sections (TAB-017) |
| **s-085** | `vaayvu://tabs/s-085` | Drag to reorder: lift, gap, auto-scroll, drop |
| **s-087** | `vaayvu://tabs/s-087` | Close undo toast: 8-second countdown, Undo, Close all |
| **s-089** | `vaayvu://tabs/s-089` | Audio mixer: per-tab volume, mute, focus |
| **s-091** | `vaayvu://tabs/s-091` | Tab sync panel: other devices, open, send |
| **s-092** | `vaayvu://tabs/s-092` | Private tabs: private styling, no history |
| **s-093** | `vaayvu://tabs/s-093` | Mobile overflow: close all, new tab, search |
| **s-094** | `vaayvu://tabs/s-094` | Tab swipe: interactive drag between tabs |
| **s-095** | `vaayvu://tabs/s-095` | Empty tab state: no tabs, one New tab CTA |

Each is opt-in through its event (`activeTab`, `inactiveTab`, `pinnedTab`,
`mutedTab`, `playingAudio`, `loadingTab`, `sleepingTab`, `hoverPreview`,
`groupCollapsed`, `groupExpanded`, `stackArchive`, `split2Up`, `splitGrid`,
`tabSearch`, `mobileTabGrid`, `mobileTabList`, `groupEditor`,
`tabContentMenu`, `dragReorder`, `closeUndo`, `audioMixer`, `tabSync`,
`privateTabs`, `mobileOverflow`, `tabSwipe`, `emptyTabState`), its
`window.__vaayvu…Prompt()` hook, or
`window.__vaayvuOnboardingOpen('<screen>')`.

## Screen `s-072` — crashed tab (tabs, phase p05)

Route `vaayvu://tabs/s-072`, phase `p05`, category **tabs**, capability-gated,
core priority. The sad-tab state with reload and report.

| Element | Behaviour |
|---|---|
| **Sad tab** | a crash mark replaces the favicon; the page title is kept |
| **Reload** | asks the tab to start again and says it returns when the process restarts |
| **Report** | marks Reported and says the report is queued on this device; no telemetry backend is configured |
| **Region labels** | 01 Sad tab, 02 Reload, 03 Report |
| **Platform gate** | `crashedTab: false` hides the screen |
| **Entry** | a `crashedTab`/`tabCrashed` event, `window.__vaayvuCrashedTabPrompt()`, or `window.__vaayvuOnboardingOpen('s-072')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-074` — hover preview (tabs, phase p05)

Route `vaayvu://tabs/s-074`, phase `p05`, category **tabs**, capability-gated,
core priority. The tab hover preview with its thumbnail and controls.

| Element | Behaviour |
|---|---|
| **Thumbnail** | a small page sketch, not a second live tab |
| **Title and URL** | page title and shortened address |
| **Mute** | toggles tab audio and updates the speaker in the preview and strip |
| **Close** | closes the tab and offers Reopen |
| **Region labels** | 01 Thumbnail, 02 Title and URL, 03 Close and mute |
| **Platform gate** | `hoverPreview: false` or `tabs: false` hides the screen |
| **Entry** | a `hoverPreview`/`tabHoverPreview` event, `window.__vaayvuHoverPreviewPrompt()`, or `window.__vaayvuOnboardingOpen('s-074')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-076` — group expanded (tabs, phase p05)

Route `vaayvu://tabs/s-076`, phase `p05`, category **tabs**, capability-gated,
core priority. An open tab group with its tabs, editor and close controls.

| Element | Behaviour |
|---|---|
| **Tabs** | Arc paper, Browser shells, Reading type and Tab colours stay visible |
| **Edit** | opens a name field and colour swatches; Save applies both |
| **Close** | closes one tab or the whole group; Reopen restores the group |
| **Group** | header keeps the colour and the live count |
| **Region labels** | 01 Tabs, 02 Edit, 03 Close, 04 Group |
| **Platform gate** | `groupExpanded: false` or `tabs: false` hides the screen |
| **Entry** | a `groupExpanded`/`tabGroupExpanded` event, `window.__vaayvuGroupExpandedPrompt()`, or `window.__vaayvuOnboardingOpen('s-076')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-077` — stack archive (tabs, phase p05)

Route `vaayvu://tabs/s-077`, phase `p05`, category **tabs**, capability-gated,
core priority. Archived tabs kept as stacks you can search and restore.

| Element | Behaviour |
|---|---|
| **Stacks** | a space archives as one stack with its pages and archive date |
| **Restore** | restores the whole stack or a single page and removes it from the archive |
| **Search** | filters by page title, host or stack name as you type |
| **Region labels** | 01 Stacks, 02 Restore, 03 Search |
| **Platform gate** | `archive: false` or `tabs: false` hides the screen |
| **Entry** | a `stackArchive`/`archivedTabs` event, `window.__vaayvuStackArchivePrompt()`, or `window.__vaayvuOnboardingOpen('s-077')`; not part of the p00 ready chain |
| **Continue** | resets the archive and returns to the setup chain |

## Screen `s-078` — split 2-up (tabs, phase p05)

Route `vaayvu://tabs/s-078`, phase `p05`, category **tabs**, capability-gated,
core priority. Two panes share one window, each holding its own page.

| Element | Behaviour |
|---|---|
| **Divider** | separates the panes and cycles 50% / 65% / 35% |
| **Swap** | exchanges the two panes; the focused side follows |
| **Close pane** | the remaining pane takes the full window; Reopen restores the split |
| **Focus** | a pane owns the omnibox and keyboard; the active pane is ringed |
| **Region labels** | 01 Divider, 02 Swap, 03 Close pane, 04 Focus |
| **Platform gate** | `split2Up: false` or `tabs: false` hides the screen |
| **Entry** | a `split2Up`/`splitView` event, `window.__vaayvuSplit2UpPrompt()`, or `window.__vaayvuOnboardingOpen('s-078')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-079` — split 3/4-up (tabs, phase p05)

Route `vaayvu://tabs/s-079`, phase `p05`, category **tabs**, capability-gated,
core priority. Three or four panes in a grid, each with its own toolbar.

| Element | Behaviour |
|---|---|
| **Grid** | 4-up shows a 2×2 grid; 3-up shows three equal columns |
| **Pane** | click a pane title to focus it; the focused pane keeps the accent |
| **Toolbar** | Back, forward and reload act on that pane only; Back is disabled at the first page and Forward at the third |
| **Close and add** | close any pane, then Add pane restores it; closing all panes shows an honest empty state |
| **Region labels** | 01 Grid, 02 Pane, 03 Toolbar, 04 Close and add |
| **Platform gate** | `splitGrid: false` or `splitView: false` hides the screen |
| **Entry** | a `splitGrid`/`gridSplit` event, `window.__vaayvuSplitGridPrompt()`, or `window.__vaayvuOnboardingOpen('s-079')`; not part of the p00 ready chain |
| **Continue** | resets the grid and returns to the setup chain |

## Screen `s-080` — tab search (tabs, phase p05)

Route `vaayvu://tabs/s-080`, phase `p05`, category **tabs**, capability-gated,
core priority. Fuzzy tab search with a preview and two ways to land.

| Element | Behaviour |
|---|---|
| **Fuzzy** | letters match in order across title, address and space |
| **Preview** | the selected result is shown with title, host and space before switching |
| **Switch** | jumps to the existing tab |
| **New window** | opens the selected tab in a new window instead |
| **Region labels** | 01 Fuzzy, 02 Preview, 03 Switch |
| **Platform gate** | `tabSearch: false` or `tabs: false` hides the screen |
| **Entry** | a `tabSearch`/`searchTabs` event, `window.__vaayvuTabSearchPrompt()`, or `window.__vaayvuOnboardingOpen('s-080')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-081` — mobile tab grid (tabs, phase p05)

Route `vaayvu://tabs/s-081`, phase `p05`, category **tabs**, capability-gated,
core priority. The phone tab switcher: grouped cards, close all and private tabs.

| Element | Behaviour |
|---|---|
| **Cards** | every tab is a card with its icon, title and host; click to select |
| **Groups** | cards stay under Research and Personal and keep the group colour |
| **Close all** | closes every card in the current view and says no history was written |
| **Private** | a separate green private view; its tabs never enter history |
| **Restore** | after Close all, Restore brings the cards back |
| **Region labels** | 01 Cards, 02 Groups, 03 Close all, 04 Private |
| **Platform gate** | `mobileTabGrid: false` or `tabs: false` hides the screen |
| **Entry** | a `mobileTabGrid`/`mobileTabs` event, `window.__vaayvuMobileTabGridPrompt()`, or `window.__vaayvuOnboardingOpen('s-081')`; not part of the p00 ready chain |
| **Continue** | resets both views and returns to the setup chain |

## Screen `s-082` — mobile tab list (tabs, phase p05)

Route `vaayvu://tabs/s-082`, phase `p05`, category **tabs**, capability-gated,
core priority. The compact phone tab list with search.

| Element | Behaviour |
|---|---|
| **Rows** | one short row per tab with icon, title and host |
| **Search** | filters by title, host or group as you type and reports how many match |
| **Group tag** | each row shows the group it belongs to |
| **Clear** | empties the search and restores every row |
| **Region labels** | 01 Rows, 02 Search, 03 Group tag |
| **Platform gate** | `mobileTabList: false` or `tabs: false` hides the screen |
| **Entry** | a `mobileTabList`/`mobileList` event, `window.__vaayvuMobileTabListPrompt()`, or `window.__vaayvuOnboardingOpen('s-082')`; not part of the p00 ready chain |
| **Continue** | resets the list and search, then returns to the setup chain |

## Screen `s-083` — tab group editor (tabs, phase p05)

Route `vaayvu://tabs/s-083`, phase `p05`, category **tabs**, capability-gated,
core priority. Edit a group’s name, colour and emoji, then save and choose
whether it syncs.

| Element | Behaviour |
|---|---|
| **Name** | the preview header follows every keystroke; saved state clears on change |
| **Colour** | six swatches repaint the header, count and tab edges |
| **Emoji** | six marks replace the header glyph |
| **Save** | writes the group on this device and shows a Saved badge |
| **Sync** | on/off switch; the save message states the honest sync state |
| **Region labels** | 01 Name, 02 Colour and emoji, 03 Save, 04 Sync |
| **Platform gate** | `groupEditor: false` or `tabs: false` hides the screen |
| **Entry** | a `groupEditor`/`tabGroupEditor` event, `window.__vaayvuGroupEditorPrompt()`, or `window.__vaayvuOnboardingOpen('s-083')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-084` — tab content menu (tabs, phase p05)

Route `vaayvu://tabs/s-084`, phase `p05`, category **tabs**, capability-gated,
core priority. The full tab content menu from TAB-017: exactly 25 actions,
grouped into five sections and scoped to one tab.

| Section | Actions |
|---|---|
| **Tab** (8) | New tab to the right, Duplicate, Pin, Mute, Add to reading list, Bookmark, Copy link, Copy title |
| **Group** (4) | Add to group, Remove from group, Move to new window, Move to space |
| **Page** (6) | Reload, Reload without cache, Save page as, Print, Translate, Open in reader |
| **Share** (3) | Share tab, Send to device, Show QR code |
| **Close** (4) | Close tab, Close other tabs, Close tabs to the right, Reopen closed tab |

**Pin**, **mute**, **group** and **close/reopen** update the tab badges and the
item labels; every other action reports its selection in the status line.
**Reset menu** clears the state, **Continue** closes back to the chain.

| Element | Behaviour |
|---|---|
| **Count** | the header states 25 actions |
| **State** | Pinned / Muted / Research / Closed badges follow the actions |
| **Platform gate** | `tabContentMenu: false` or `tabs: false` hides the screen |
| **Entry** | a `tabContentMenu`/`tabMenu` event, `window.__vaayvuTabContentMenuPrompt()`, or `window.__vaayvuOnboardingOpen('s-084')`; not part of the p00 ready chain |

## Screen `s-085` — drag to reorder (tabs, phase p05)

Route `vaayvu://tabs/s-085`, phase `p05`, category **tabs**, capability-gated,
core priority. Reordering the tab strip by drag.

| Element | Behaviour |
|---|---|
| **Lift** | a tab lifts above the strip as a floating chip |
| **Gap** | a dashed gap marks exactly where the lifted tab will land; Earlier and Later move it |
| **Auto-scroll** | while lifted, the strip follows the pointer near an edge; the toggle shows its state |
| **Drop** | commits the new order and clears the gap and chip |
| **Cancel** | restores the original order honestly |
| **Region labels** | 01 Lift, 02 Gap, 03 Auto-scroll, 04 Drop |
| **Platform gate** | `dragReorder: false` or `tabs: false` hides the screen |
| **Entry** | a `dragReorder`/`tabReorder` event, `window.__vaayvuDragReorderPrompt()`, or `window.__vaayvuOnboardingOpen('s-085')`; not part of the p00 ready chain |
| **Continue** | resets the strip and returns to the setup chain |

## Screen `s-087` — close undo toast (tabs, phase p05)

Route `vaayvu://tabs/s-087`, phase `p05`, category **tabs**, capability-gated,
core priority. A batch close leaves an eight-second toast with Undo, while
Close all can fold the last remaining tab into the same batch.

| Element | Behaviour |
|---|---|
| **8 seconds** | the toast counts down; at zero it leaves and History is the only route back |
| **Undo** | restores every closed tab in order and ends the countdown |
| **Close all** | closes the remaining tabs and restarts the same eight-second window |
| **Dismiss** | drops the toast without restoring; closed tabs stay in History |
| **Region labels** | 01 8 seconds, 02 Undo, 03 Close all |
| **Platform gate** | `closeUndo: false` or `tabs: false` hides the screen |
| **Entry** | a `closeUndo`/`tabsClosed` event, `window.__vaayvuCloseUndoPrompt()`, or `window.__vaayvuOnboardingOpen('s-087')`; not part of the p00 ready chain |
| **Continue** | stops the timer and closes back to the setup chain |

## Screen `s-086` — tear-off preview (tabs, phase p05)

Route `vaayvu://tabs/s-086`, phase `p05`, category **tabs**, capability-gated,
core priority. Dragging a tab out of the strip to open it in a new window.

| Element | Behaviour |
|---|---|
| **Ghost window** | lifting a tab shows a floating preview of the new window and a gap in the strip |
| **Drop** | Drop to detach commits the new window; Cancel leaves the tab where it was |
| **Detach** | the tab leaves the main window and the detached window offers Reattach |
| **Reattach** | returns the tab to its original place in the strip |
| **Region labels** | 01 Ghost window, 02 Drop, 03 Detach, 04 Reattach |
| **Platform gate** | `tearOff: false` or `tabs: false` hides the screen |
| **Entry** | a `tearOff`/`tearOffPreview` event, `window.__vaayvuTearOffPrompt()`, or `window.__vaayvuOnboardingOpen('s-086')`; not part of the p00 ready chain |
| **Continue** | resets the window and returns to the setup chain |

## Screen `s-089` — audio mixer (tabs, phase p05)

Route `vaayvu://tabs/s-089`, phase `p05`, category **tabs**, capability-gated,
core priority. Per-tab volume, mute and focus in one panel.

| Element | Behaviour |
|---|---|
| **Per-tab volume** | a slider changes that tab only and raises it out of mute |
| **Mute** | keeps the level; unmute returns to the stored percentage |
| **Focus** | brings the tab forward without touching its sound |
| **Mute all / Unmute all** | flips every row together |
| **Reset levels** | restores the starting volumes and clears mute |
| **Region labels** | 01 Per-tab volume, 02 Mute, 03 Focus |
| **Platform gate** | `audioMixer: false` or `tabs: false` hides the screen |
| **Entry** | an `audioMixer`/`tabAudioMixer` event, `window.__vaayvuAudioMixerPrompt()`, or `window.__vaayvuOnboardingOpen('s-089')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-088` — recently closed (tabs, phase p05)

Route `vaayvu://tabs/s-088`, phase `p05`, category **tabs**, capability-gated,
core priority. The recently-closed panel for tabs, windows and groups.

| Element | Behaviour |
|---|---|
| **Tabs** | closed tabs with host and when they closed |
| **Windows** | a closed window with its tab count |
| **Groups** | a closed group with its page count |
| **Restore** | restores one item or Restore all; the list, counts and status update |
| **Empty state** | says nothing is closed once the list is cleared |
| **Region labels** | 01 Tabs, 02 Windows, 03 Groups, 04 Restore |
| **Platform gate** | `recentlyClosed: false` or `tabs: false` hides the screen |
| **Entry** | a `recentlyClosed`/`closedItems` event, `window.__vaayvuRecentlyClosedPrompt()`, or `window.__vaayvuOnboardingOpen('s-088')`; not part of the p00 ready chain |
| **Continue** | resets the list and returns to the setup chain |

## Screen `s-091` — tab sync panel (tabs, phase p05)

Route `vaayvu://tabs/s-091`, phase `p05`, category **tabs**, capability-gated,
core priority. Other devices and their open tabs, with Open and Send.

| Element | Behaviour |
|---|---|
| **Other devices** | each device lists its open tabs and last-seen time |
| **Open** | pulls that tab into this window and marks it Opened |
| **Send** | pushes the current tab to one device; that chip reads Sent |
| **Region labels** | 01 Other devices, 02 Open, 03 Send |
| **Platform gate** | `tabSync: false` or `tabs: false` hides the screen |
| **Entry** | a `tabSync`/`syncPanel` event, `window.__vaayvuTabSyncPrompt()`, or `window.__vaayvuOnboardingOpen('s-091')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-090` — tab memory panel (tabs, phase p05)

Route `vaayvu://tabs/s-090`, phase `p05`, category **tabs**, capability-gated,
core priority. Per-tab memory with discard and protect.

| Element | Behaviour |
|---|---|
| **Per-tab RAM** | every row shows its tab's memory, and the header totals the panel |
| **Discard** | frees that tab's RAM, leaves the tab in place and disabled until reloaded |
| **Protect** | Protected rows cannot be discarded; unprotecting re-enables Discard |
| **Reload** | a discarded row can reload its page and put its RAM back |
| **Region labels** | 01 Per-tab RAM, 02 Discard, 03 Protect, 04 Reload |
| **Platform gate** | `memoryPanel: false` or `tabs: false` hides the screen |
| **Entry** | a `memoryPanel`/`tabMemory` event, `window.__vaayvuMemoryPanelPrompt()`, or `window.__vaayvuOnboardingOpen('s-090')`; not part of the p00 ready chain |
| **Continue** | resets every row and returns to the setup chain |

## Screen `s-092` — private tabs (tabs, phase p05)

Route `vaayvu://tabs/s-092`, phase `p05`, category **tabs**, capability-gated,
core priority. Private-window styling and its empty history.

| Element | Behaviour |
|---|---|
| **Private styling** | dark window, mask mark and a "Not saved to history" note |
| **No history** | the History block always shows 0 entries and says private tabs are never written |
| **New tab** | adds a private tab and keeps history at 0 |
| **Close** | drops every private tab and confirms nothing was written; Reopen restores them |
| **Region labels** | 01 Private styling, 02 No history, 03 New tab, 04 Close |
| **Platform gate** | `privateTabs: false` or `tabs: false` hides the screen |
| **Entry** | a `privateTabs`/`privateWindow` event, `window.__vaayvuPrivateTabsPrompt()`, or `window.__vaayvuOnboardingOpen('s-092')`; not part of the p00 ready chain |
| **Continue** | resets the window and returns to the setup chain |

## Screen `s-093` — mobile overflow (tabs, phase p05)

Route `vaayvu://tabs/s-093`, phase `p05`, category **tabs**, capability-gated,
core priority. The mobile overflow sheet with three actions.

| Element | Behaviour |
|---|---|
| **Close all** | first tap asks; second closes every tab and leaves an honest empty sheet |
| **New tab** | adds one tab and updates the count immediately |
| **Search** | opens a field and filters the sheet as you type |
| **Region labels** | 01 Close all, 02 New tab, 03 Search |
| **Platform gate** | `mobileOverflow: false` or `tabs: false` hides the screen |
| **Entry** | a `mobileOverflow`/`tabOverflowSheet` event, `window.__vaayvuMobileOverflowPrompt()`, or `window.__vaayvuOnboardingOpen('s-093')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-094` — tab swipe (tabs, phase p05)

Route `vaayvu://tabs/s-094`, phase `p05`, category **tabs**, capability-gated,
core priority. Interactive horizontal swipe between tabs.

| Element | Behaviour |
|---|---|
| **Swipe** | pointer drag moves the track with the finger; a full drag changes tab |
| **Settle** | a short drag snaps back to the current tab |
| **Dots** | tap any dot to jump directly; previous/next buttons also work |
| **Region labels** | 01 Swipe, 02 Settle, 03 Dots |
| **Platform gate** | `tabSwipe: false` or `tabs: false` hides the screen |
| **Entry** | a `tabSwipe`/`swipeTabs` event, `window.__vaayvuTabSwipePrompt()`, or `window.__vaayvuOnboardingOpen('s-094')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-095` — empty tab state (tabs, phase p05)

Route `vaayvu://tabs/s-095`, phase `p05`, category **tabs**, capability-gated,
core priority. The final tabs screen: an empty window that says so and offers
one clear New tab CTA.

| Element | Behaviour |
|---|---|
| **No tabs** | the strip reads No tabs and the stage says nothing was lost |
| **New tab CTA** | opens one tab, updates the strip and shows the new-tab page |
| **Reset** | returns to the empty state |
| **Region labels** | 01 No tabs, 02 New tab, 03 Fresh start |
| **Platform gate** | `emptyTabState: false` or `tabs: false` hides the screen |
| **Entry** | an `emptyTabState`/`noTabs` event, `window.__vaayvuEmptyTabStatePrompt()`, or `window.__vaayvuOnboardingOpen('s-095')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-097` — loaded page (content, phase p09)

Route `vaayvu://content/s-097`, phase `p09`, category **content**,
capability-gated, core priority. A finished page where content, status and
chrome all agree.

| Element | Behaviour |
|---|---|
| **Content** | a real article column with kicker, headline, byline, body and pull quote |
| **Status** | Loaded/Reloaded, secure connection, size and ready state; can be hidden |
| **Chrome** | tab strip, reload, omnibox with lock and the page URL |
| **Reload** | updates the status to Reloaded and reports it |
| **Region labels** | 01 Content, 02 Status, 03 Chrome |
| **Platform gate** | `loadedPage: false` hides the screen |
| **Entry** | a `loadedPage`/`pageLoaded` event, `window.__vaayvuLoadedPagePrompt()`, or `window.__vaayvuOnboardingOpen('s-097')`; not part of the p00 ready chain |
| **Continue** | closes back to the setup chain |

## Screen `s-098` — back/forward menu (content, phase p09)

Route `vaayvu://content/s-098`, phase `p09`, category **content**,
capability-gated, core priority. The long-press Back/Forward history menu.

| Element | Behaviour |
|---|---|
| **Long-press** | opens the full Back or Forward history |
| **Titles** | every entry shows the page title and host, newest first |
| **Jump** | choosing a title reports the page it went to |
| **Full history** | recent pages show first; Show full history reveals the older ones |
| **Region labels** | 01 Long-press, 02 Titles, 03 Jump, 04 Full history |
| **Platform gate** | `backForwardMenu: false` or `history: false` hides the screen |
| **Entry** | a `backForwardMenu`/`historyMenu` event, `window.__vaayvuBackForwardMenuPrompt()`, or `window.__vaayvuOnboardingOpen('s-098')`; not part of the p00 ready chain |
| **Continue** | resets the menu and returns to the setup chain |

## Screen `s-099` — DNS error (content, phase p09)

Route `vaayvu://content/s-099`, phase `p09`, category **content**,
capability-gated, core priority. A failed lookup explained plainly, with
retry, search and a separate offline state.

| Element | Behaviour |
|---|---|
| **Explain** | host name, plain-language cause and `DNS_PROBE_FINISHED_NXDOMAIN` |
| **Retry** | reports the same failure honestly and counts attempts |
| **Search** | turns the address into a search instead of a dead link |
| **Offline** | separate title and status; retry asks for a connection first |
| **Region labels** | 01 Explain, 02 Retry, 03 Search, 04 Offline |
| **Platform gate** | `dnsError: false` hides the screen |
| **Entry** | a `dnsError`/`dnsFailure` event, `window.__vaayvuDnsErrorPrompt()`, or `window.__vaayvuOnboardingOpen('s-099')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-100` — offline error (content, phase p09)

Route `vaayvu://content/s-100`, phase `p09`, category **content**,
capability-gated, core priority. Offline is distinct from a DNS failure; the
page offers a cached copy, retry and concrete network help.

| Element | Behaviour |
|---|---|
| **Cached copy** | read-only article with “Cached copy · 2 hours ago”; toggle to hide |
| **Retry** | counts attempts and reports the network still being away |
| **Network help** | Wi-Fi, airplane mode and router checks, not a generic apology |
| **Offline** | its own title, chip and status bar; never claims the page is live |
| **Region labels** | 01 Cached copy, 02 Retry, 03 Network help |
| **Platform gate** | `offlineError: false` hides the screen |
| **Entry** | an `offlineError`/`networkOffline` event, `window.__vaayvuOfflineErrorPrompt()`, or `window.__vaayvuOnboardingOpen('s-100')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-096` — loading page (content, phase p09)

Route `vaayvu://content/s-096`, phase `p09`, category **content**,
capability-gated, core priority. A page still arriving: progress, stop and a
skeleton that never fakes content.

| Element | Behaviour |
|---|---|
| **Progress** | bar and tab spinner agree; Advance steps 35 → 60 → 85 → 100 |
| **Stop** | freezes at the current percentage, dims the skeleton and marks the page incomplete |
| **Skeleton** | kicker, title, byline, lines and image placeholders hold the layout |
| **Reload / Restart** | Stop becomes Reload at the end; Restart always starts over |
| **Region labels** | 01 Progress, 02 Stop, 03 Skeleton |
| **Platform gate** | `loadingPage: false` hides the screen |
| **Entry** | a `loadingPage`/`pageLoading` event, `window.__vaayvuLoadingPagePrompt()`, or `window.__vaayvuOnboardingOpen('s-096')`; not part of the p00 ready chain |
| **Continue** | resets the load and closes back to the chain |

## Screen `s-101` — timeout (content, phase p09)

Route `vaayvu://content/s-101`, phase `p09`, category **content**,
capability-gated, core priority. A server that never answered, explained
plainly with retry and inspectable details.

| Element | Behaviour |
|---|---|
| **Retry** | reports another timeout and counts attempts; never fakes a load |
| **Details** | expands address, wait time, `ERR_TIMED_OUT`, attempts, network and server state |
| **Status** | stays “Timed out · No response after 30 s”; the page is never shown as loaded |
| **Region labels** | 01 Retry, 02 Details, 03 Status |
| **Platform gate** | `timeoutError: false` hides the screen |
| **Entry** | a `timeoutError`/`pageTimeout` event, `window.__vaayvuTimeoutErrorPrompt()`, or `window.__vaayvuOnboardingOpen('s-101')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-103` — renderer crash (content, phase p09)

Route `vaayvu://content/s-103`, phase `p09`, category **content**,
capability-gated, core priority. The page process stopped; reload, restore or
report it without disturbing other tabs.

| Element | Behaviour |
|---|---|
| **Reload** | requests a restart, counts attempts, never claims success |
| **Restore** | shows the last snapshot read-only with its age; toggle to hide |
| **Report** | queues one crash report on the device and disables the button |
| **Status** | Renderer stopped / Snapshot restored, plus reload count |
| **Region labels** | 01 Reload, 02 Restore, 03 Report |
| **Platform gate** | `rendererCrash: false` hides the screen |
| **Entry** | a `rendererCrash`/`pageCrashed` event, `window.__vaayvuRendererCrashPrompt()`, or `window.__vaayvuOnboardingOpen('s-103')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-102` — certificate error (content, phase p09)

Route `vaayvu://content/s-102`, phase `p09`, category **content**,
capability-gated, core priority. A blocked certificate with explain, guarded
proceed and report.

| Element | Behaviour |
|---|---|
| **Why** | three concrete reasons: the reason, the name mismatch, the untrusted issuer |
| **Advanced** | issued to, issuer, validity and the address that was opened |
| **Proceed (guarded)** | opening it first reveals Advanced; Proceed anyway needs a second press and then labels the window unsafe |
| **Report** | marks Reported and says the report stays on this device; no telemetry backend is configured |
| **Region labels** | 01 Why, 02 Advanced, 03 Proceed (guarded), 04 Report |
| **Platform gate** | `certificateError: false` or `content: false` hides the screen |
| **Entry** | a `certificateError`/`certError` event, `window.__vaayvuCertificateErrorPrompt()`, or `window.__vaayvuOnboardingOpen('s-102')`; not part of the p00 ready chain |
| **Continue** | resets the certificate state and returns to the setup chain |

Host fields come from `capabilities.certificateError` (`host`, `reason`,
`issuedTo`, `issuer`, `validity`).

## Screen `s-105` — policy blocked (content, phase p09)

Route `vaayvu://content/s-105`, phase `p09`, category **content**,
capability-gated, core priority. A managed device blocks the site with the
administrator’s own message and a real contact path.

| Element | Behaviour |
|---|---|
| **Admin message** | the organisation’s wording and why the site is outside policy |
| **Contact** | administrator email, extension and hours; Copy email |
| **Details** | policy name, rule, administrator and device scope |
| **Status** | Blocked by policy · Managed device |
| **Region labels** | 01 Admin message, 02 Contact, 03 Details |
| **Platform gate** | `policyBlocked: false` hides the screen |
| **Entry** | a `policyBlocked`/`blockedByAdmin` event, `window.__vaayvuPolicyBlockedPrompt()`, or `window.__vaayvuOnboardingOpen('s-105')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-104` — out of memory (content, phase p09)

Route `vaayvu://content/s-104`, phase `p09`, category **content**,
capability-gated, core priority. A memory limit with close, reload and report.

| Element | Behaviour |
|---|---|
| **Close tabs** | closes the three heaviest tabs, frees their RAM and never closes the last one |
| **Reload** | restarts the page with a fresh heap and reports the memory released |
| **Report** | marks Reported and says the report stays on this device; no telemetry backend is configured |
| **Memory** | the meter, used MB, limit and heavy-tab list update after every action |
| **Region labels** | 01 Close tabs, 02 Reload, 03 Report, 04 Memory |
| **Platform gate** | `outOfMemory: false` or `content: false` hides the screen |
| **Entry** | an `outOfMemory`/`oom` event, `window.__vaayvuOutOfMemoryPrompt()`, or `window.__vaayvuOnboardingOpen('s-104')`; not part of the p00 ready chain |
| **Continue** | resets the memory state and returns to the setup chain |

## Screen `s-106` — unsafe site (content, phase p09)

Route `vaayvu://content/s-106`, phase `p09`, category **content**,
capability-gated, core priority. A trusted local warning for a known malicious
domain with no automatic bypass.

| Element | Behaviour |
|---|---|
| **Trusted warning** | malware/phishing tags, local list match, `RASHA_MALWARE_MATCH` |
| **Back** | returns to safety and states the site was not opened |
| **Source** | list name, version, matched host and “no network lookup” note |
| **Report** | false-positive or outdated-warning report stays on the device; block remains |
| **No bypass** | the screen offers no proceed action |
| **Region labels** | 01 Trusted warning, 02 Source, 03 Report, 04 No bypass |
| **Platform gate** | `unsafeSite: false` hides the screen |
| **Entry** | an `unsafeSite`/`malwareWarning` event, `window.__vaayvuUnsafeSitePrompt()`, or `window.__vaayvuOnboardingOpen('s-106')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-107` — captive portal (content, phase p09)

Route `vaayvu://content/s-107`, phase `p09`, category **content**,
capability-gated, core priority. A network login wall with detection, a local
login preview and an honest retry.

| Element | Behaviour |
|---|---|
| **Detect** | shows the local probe, HTTP redirect and portal name |
| **Open login** | opens Airport Wi-Fi’s sign-in page with a credential field |
| **Retry** | before sign-in it says the portal is still there; after sign-in it reaches Online |
| **Status** | Portal detected / Login open / Signed in / Online, plus retry count |
| **Region labels** | 01 Detect, 02 Open login, 03 Retry |
| **Platform gate** | `captivePortal: false` hides the screen |
| **Entry** | a `captivePortal`/`networkLogin` event, `window.__vaayvuCaptivePortalPrompt()`, or `window.__vaayvuOnboardingOpen('s-107')`; not part of the p00 ready chain |
| **Continue** | resets the state and closes back to the chain |

## Screen `s-108` — PDF viewer (content, phase p09)

Route `vaayvu://content/s-108`, phase `p09`, category **content**,
capability-gated, core priority. A local PDF with page navigation, zoom,
rotation, search and document actions.

| Element | Behaviour |
|---|---|
| **Pages** | previous/next with a 1 / 12 count and disabled bounds |
| **Zoom** | 50–200% in 25% steps; page scales live |
| **Rotate** | 0° → 90° → 180° → 270° |
| **Search** | field with live match count from the document text |
| **Print / Save / Share** | each reports its request honestly |
| **Region labels** | 01 Pages, 02 Zoom and rotate, 03 Search, 04 Print, save, share |
| **Platform gate** | `pdfViewer: false` hides the screen |
| **Entry** | a `pdfViewer`/`pdfOpen` event, `window.__vaayvuPdfViewerPrompt()`, or `window.__vaayvuOnboardingOpen('s-108')`; not part of the p00 ready chain |
| **Continue** | resets the viewer and closes back to the chain |

## Screen `s-109` — PDF annotate and sign (content, phase p09)

Route `vaayvu://content/s-109`, phase `p09`, category **content**,
capability-gated, core priority. A PDF that can be marked up and signed on
the device.

| Element | Behaviour |
|---|---|
| **Highlight** | marks the paragraph and counts highlights |
| **Draw** | adds a freehand stroke to the page |
| **Text** | adds a note in the margin |
| **Signature** | places a signature block marked “signed on this device” |
| **Forms** | fills the document’s name/date fields |
| **Region labels** | 01 Highlight, 02 Draw, 03 Text, 04 Signature, 05 Forms |
| **Platform gate** | `pdfAnnotate: false` hides the screen |
| **Entry** | a `pdfAnnotate`/`pdfSign` event, `window.__vaayvuPdfAnnotatePrompt()`, or `window.__vaayvuOnboardingOpen('s-109')`; not part of the p00 ready chain |
| **Continue** | resets every mark and closes back to the chain |

## Screen `s-110` — reader mode (content, phase p09)

Route `vaayvu://content/s-110`, phase `p09`, category **content**,
capability-gated, core priority. A clean article view with reading controls.

| Element | Behaviour |
|---|---|
| **Article** | headline, byline and body in a readable column |
| **Theme** | Light / Sepia / Dark on the whole surface |
| **Font** | Serif / Sans |
| **Width** | Narrow / Medium / Wide measure |
| **TTS** | Read aloud when speech synthesis exists; otherwise states it is unavailable |
| **Region labels** | 01 Article, 02 Theme, 03 Font and width, 04 TTS |
| **Platform gate** | `readerMode: false` hides the screen |
| **Entry** | a `readerMode`/`readerView` event, `window.__vaayvuReaderModePrompt()`, or `window.__vaayvuOnboardingOpen('s-110')`; not part of the p00 ready chain |
| **Continue** | stops speech, resets the view and closes back to the chain |

## Screen `s-111` — reader settings (content, phase p09)

Route `vaayvu://content/s-111`, phase `p09`, category **content**,
capability-gated, core priority. A settings sheet with a live article preview.

| Element | Behaviour |
|---|---|
| **Theme** | Light / Sepia / Dark |
| **Size** | 14 / 16 / 18 / 20 px body text |
| **Line height** | Compact 1.4 / Normal 1.6 / Relaxed 1.8 |
| **Font** | Serif / Sans |
| **Margins** | Narrow / Medium / Wide |
| **Live preview** | every change repaints the article immediately |
| **Region labels** | 01 Theme, 02 Size, 03 Line height, 04 Font, 05 Margins |
| **Platform gate** | `readerSettings: false` hides the screen |
| **Entry** | a `readerSettings`/`readerPrefs` event, `window.__vaayvuReaderSettingsPrompt()`, or `window.__vaayvuOnboardingOpen('s-111')`; not part of the p00 ready chain |
| **Apply / Reset / Continue** | confirms, restores defaults, or exits to the chain |

## Priority and phase model

The runtime exposes the priority as `data-atlas-priority`.

| Priority | Screens |
|---|---|
| core | s-001 – s-108 |
| conditional | s-109 – s-171 |
| excluded | s-172 |
| conditional | s-173 – s-250 |
| trust | s-251 – s-291 |
| advanced | s-292 – s-331 |
| core | s-332 – s-341 |
| next | s-342 – s-343 |
| core | s-344 – s-353 |
| required | s-354 – s-623 |

Phase ranges:

| Phase | Screens |
|---|---|
| p00 | s-001 – s-020 |
| p03 | s-021 – s-050 |
| p05 | s-051 – s-095 |
| p09 | s-096 – s-165 |
| p08 | s-166 – s-185 |
| p04 | s-186 – s-202 |
| p13 | s-203 – s-218 |
| p10 | s-219 – s-232 |
| p16 | s-233 – s-250 |
| p04 | s-251 – s-263 |
| p08 | s-264 – s-281 |
| p10 | s-282 – s-291 |
| p13 | s-292 – s-306 |
| p14 | s-307 – s-323 |
| p16 | s-324 – s-331 |
| p03 | s-332 – s-335 |
| p05 | s-336 – s-343 |
| p08 | s-344 – s-353 |
| p18 | s-354 – s-377 |
| p19 | s-378 – s-389 |
| p20 | s-390 – s-413 |
| p21 | s-414 – s-431 |
| p22 | s-432 – s-449 |
| p23 | s-450 – s-461 |
| p24 | s-462 – s-485 |
| p25 | s-486 – s-497 |
| p26 | s-498 – s-515 |
| p27 | s-516 – s-527 |
| p28 | s-528 – s-539 |
| p29 | s-540 – s-551 |
| p30 | s-552 – s-557 |
| p31 | s-558 – s-569 |
| p32 | s-570 – s-581 |
| p33 | s-582 – s-599 |
| p34 | s-600 – s-611 |
| p35 | s-612 – s-623 |

## Content and sidebar batch s-112 – s-128

All phase `p09`, capability-gated.

| # | Screen | Purpose |
|---|---|---|
| s-112 | Translate prompt | detect, translate, never translate, settings |
| s-113 | Translated page | original toggle, feedback, source |
| s-114 | Find results | highlight, count, scroll |
| s-115 | View source | syntax, search, save |
| s-116 | Fullscreen video | controls, exit, PiP |
| s-117 | PiP window | always on top, controls, back to tab |
| s-118 | Mini player | audio/video, expand, close |
| s-119 | Print preview | paper, margins, pages, headers, scale, Save PDF |
| s-120 | Save page | format, name, location |
| s-121 | Screenshot capture | visible, full page, region |
| s-122 | Screenshot annotate | crop, draw, text, blur, copy, save |
| s-123 | Share sheet | apps, copy, QR, send to device |
| s-124 | QR and share | QR, copy link, expiry |
| s-125 | Send to device | device list, progress, failure |
| s-126 | Sidebar shell | tabs, panels, resize, collapse |
| s-127 | Bookmarks panel | tree, search, add |
| s-128 | History panel | grouped by day/device, search |

s-112 – s-125 use `vaayvu://content/<id>`; s-126 – s-128 use
`vaayvu://sidebar/<id>` with category **sidebar**.

## Sidebar s-129 – s-140 and managers s-141 – s-160

All phase `p09`, conditional priority, capability-gated.

| Range | Category | Route |
|---|---|---|
| s-129 – s-140 | sidebar | `vaayvu://sidebar/<id>` |
| s-141 – s-160 | manager | `vaayvu://managers/<id>` |

Screens: reading list, downloads, notes, highlights, AI chat, extensions,
spaces, tab tree, sync activity, site info, performance, sidebar settings;
bookmark manager/editor, history manager/detail, downloads manager/detail,
password list/detail/generator, passkeys, addresses, payment methods,
identity, extensions manager/detail/install, site settings/detail,
cookies/storage, certificates.

## Screen `s-161` — clear browsing data (manager, phase p09)

Route `vaayvu://managers/s-161`, phase `p09`, category **manager**,
capability-gated, conditional priority.

| Element | Behaviour |
|---|---|
| **Ranges** | last hour, 24 hours, 7 days, 4 weeks, all time |
| **Types** | history, cookies/site data, cached files, download history, autofill |
| **Estimated size** | live estimate from the selected types and range |
| **Confirm** | first press arms, second press clears; nothing is removed before that |
| **Result** | “Browsing data cleared” and the estimate drops to 0 MB |

Entry: `vaayvuEvent({ type: 'clearBrowsingData' })`,
`window.__vaayvuClearBrowsingDataPrompt()`, or
`window.__vaayvuOnboardingOpen('s-161')`.

## Screen `s-162` — import and export (manager, phase p09)

Route `vaayvu://managers/s-162`, phase `p09`, category **manager**,
capability-gated, conditional priority.

| Element | Behaviour |
|---|---|
| **Sources** | Chrome, Edge, Brave, Arc, Safari, Firefox, Opera, Vivaldi, HTML, CSV, 1Password, Bitwarden |
| **Formats** | HTML, CSV or JSON |
| **Warnings** | import merges without deleting; sensitive exports are plain text and require acknowledgement |
| **Run** | starts the import or requests the export with an honest status |

Entry: `vaayvuEvent({ type: 'importExport' })`,
`window.__vaayvuImportExportPrompt()`, or `window.__vaayvuOnboardingOpen('s-162')`.

## Screen `s-163` — profile manager (manager, phase p09)

Route `vaayvu://managers/s-163`, phase `p09`, category **manager**,
capability-gated, conditional priority.

| Element | Behaviour |
|---|---|
| **Profiles** | current profile marked; click another to switch |
| **Avatars** | M, W, R or wave for the active profile |
| **Colours** | five swatches repaint the avatar |
| **Add** | appends a new profile and makes it current |
| **Delete** | removes the current profile; the last profile is protected |

Entry: `vaayvuEvent({ type: 'profileManager' })`,
`window.__vaayvuProfileManagerPrompt()`, or `window.__vaayvuOnboardingOpen('s-163')`.

## Screen `s-164` — space manager (manager, phase p09)

Route `vaayvu://managers/s-164`, phase `p09`, category **manager**,
capability-gated, conditional priority.

| Element | Behaviour |
|---|---|
| **Name** | live-edited for the selected space |
| **Icon** | W, S, wave, books or briefcase |
| **Colour** | five accent swatches |
| **Cookie jar** | isolate cookies per space |
| **Sync** | include or exclude the space |
| **Add / Delete / Save** | the last space cannot be deleted |

Entry: `vaayvuEvent({ type: 'spaceManager' })`,
`window.__vaayvuSpaceManagerPrompt()`, or `window.__vaayvuOnboardingOpen('s-164')`.

## Screen `s-165` — search engines (manager, phase p09)

Route `vaayvu://managers/s-165`, phase `p09`, category **manager**,
capability-gated, conditional priority.

| Element | Behaviour |
|---|---|
| **List** | every engine with its keyword and Default/Private badges |
| **Add** | name and keyword create a new engine |
| **Keyword** | shown per engine; used in the address bar |
| **Default** | sets the normal-window engine |
| **Private default** | sets the private-window engine independently |
| **Delete** | removes an engine and repairs defaults if needed |

Entry: `vaayvuEvent({ type: 'systemSearchEngines' })`,
`window.__vaayvuSystemSearchEnginesPrompt()`, or `window.__vaayvuOnboardingOpen('s-165')`.

## Screen `s-166` — site protection panel (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-166`, phase `p08`, category
**security-privacy**, conditional priority, gate `siteProtectionPanel`.

- Current origin with per-host status
- Ads, tracking, social widgets and cookie banners pause independently
- Malware/scam protection and custom blocked domains stay active
- Resume all, Ad blocker settings (S-191) and local diagnostics (S-351) actions

Entry: `vaayvuEvent({ type: 'siteProtection' })`,
`window.__vaayvuSiteProtectionPrompt()`, or `__vaayvuOnboardingOpen('s-166')`.

## Screen `s-167` — privacy dashboard (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-167`, phase `p08`, category
**security-privacy**, conditional, gate `privacyDashboard`.

- Weekly or 30-day totals
- Per-day blocked chart
- Trackers, cookies, fingerprint attempts and ads with plain explanations
- Fingerprint raw data is never stored

Entry: `vaayvuEvent({ type: 'privacyDashboard' })`,
`window.__vaayvuPrivacyDashboardPrompt()`, or `__vaayvuOnboardingOpen('s-167')`.

## Screen `s-168` — tracker detail (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-168`, phase `p08`, category
**security-privacy**, conditional, gate `trackerDetail`.

- Company, category, domain and request count
- Default action: blocked before connect
- Allow on this site, then block again
- Copy domain

Entry: `vaayvuEvent({ type: 'trackerDetail' })`,
`window.__vaayvuTrackerDetailPrompt()`, or `__vaayvuOnboardingOpen('s-168')`.

## Screen `s-169` — cookie banner details (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-169`, phase `p08`, category
**security-privacy**, conditional, gate `cookieBannerDetails`.

- Hide supported banners on/off
- Never auto-accepts, never rejects optional cookies, never implies consent
- Supported and unsupported banner scope stated plainly

Entry: `vaayvuEvent({ type: 'cookieBannerDetails' })`,
`window.__vaayvuCookieBannerDetailsPrompt()`, or `__vaayvuOnboardingOpen('s-169')`.

## Screen `s-170` — fingerprint settings (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-170`, phase `p08`, category
**security-privacy**, conditional, gate `fingerprintSettings`.

- Standard / Strict mode
- Strict normalises every supported vector
- Standard exposes Canvas, WebGL, Audio, Fonts, Screen, Timezone and WebRTC toggles
- Platform limitations stated instead of overpromising

Entry: `vaayvuEvent({ type: 'fingerprintSettings' })`,
`window.__vaayvuFingerprintSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-170')`.

## Screen `s-171` — DNS proxy (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-171`, phase `p08`, category
**security-privacy**, conditional, gate `dnsProxy`.

- Provider: System, Cloudflare, Quad9 or custom DoH
- Custom DoH URL validation
- Proxy on/off with optional PAC URL
- Optional proxy authentication

Entry: `vaayvuEvent({ type: 'dnsProxy' })`,
`window.__vaayvuDnsProxyPrompt()`, or `__vaayvuOnboardingOpen('s-171')`.

## Screen `s-173` — firewall (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-173`, phase `p08`, category
**security-privacy**, conditional, gate `firewall`.

- Per-app rules with Allow/Block
- Per-site exact-host rules
- Logs with recent allow/block decisions

**s-172 is an excluded historical VPN record and is intentionally not implemented.**

Entry: `vaayvuEvent({ type: 'firewall' })`,
`window.__vaayvuFirewallPrompt()`, or `__vaayvuOnboardingOpen('s-173')`.

## Screen `s-174` — breach monitor (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-174`, phase `p08`, category
**security-privacy**, conditional, gate `breachMonitor`.

- Opt-in monitoring, off by default
- Email validated before checking
- Breach list with name, date and exposed data
- Per-breach action (change password / review)

Entry: `vaayvuEvent({ type: 'breachMonitor' })`,
`window.__vaayvuBreachMonitorPrompt()`, or `__vaayvuOnboardingOpen('s-174')`.

## Screen `s-175` — malware and scam protection (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-175`, phase `p08`, category
**security-privacy**, conditional, gate `malwareProtection`.

- Known-domain protection on/off, independent of ad pulses
- List freshness with Update now
- Review exceptions: allow a domain after a false positive, remove it later

Entry: `vaayvuEvent({ type: 'malwareProtection' })`,
`window.__vaayvuMalwareProtectionPrompt()`, or `__vaayvuOnboardingOpen('s-175')`.

## Screen `s-176` — permission audit (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-176`, phase `p08`, category
**security-privacy**, conditional, gate `permissionAudit`.

- Timeline of permission grants and changes with site, permission and time
- Filter by camera, microphone or location
- Revoke from the list; revoke is idempotent

Entry: `vaayvuEvent({ type: 'permissionAudit' })`,
`window.__vaayvuPermissionAuditPrompt()`, or `__vaayvuOnboardingOpen('s-176')`.

## Screen `s-177` — private window (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-177`, phase `p08`, category
**security-privacy**, conditional, gate `privateWindow`.

- Explains no history, no local suggestions, cookies cleared on close, no sync/profile
- Close all requires confirmation
- Closed state confirms session data was cleared

Entry: `vaayvuEvent({ type: 'privateWindow' })`,
`window.__vaayvuPrivateWindowPrompt()`, or `__vaayvuOnboardingOpen('s-177')`.

## Screen `s-178` — guest window (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-178`, phase `p08`, category
**security-privacy**, conditional, gate `guestWindow`.

- Isolated session with no profile
- Extensions, bookmarks and passwords unavailable to the guest
- Close requires confirmation and discards all guest data

Entry: `vaayvuEvent({ type: 'guestWindow' })`,
`window.__vaayvuGuestWindowPrompt()`, or `__vaayvuOnboardingOpen('s-178')`.

## Screen `s-179` — kids mode (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-179`, phase `p08`, category
**security-privacy**, conditional, gate `kidsMode`.

- Allowlist with add/remove
- Daily time limit (30 / 60 / 120 minutes) and usage
- PIN lock for settings
- Local weekly report

Entry: `vaayvuEvent({ type: 'kidsMode' })`,
`window.__vaayvuKidsModePrompt()`, or `__vaayvuOnboardingOpen('s-179')`.

## Screen `s-180` — panic clear (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-180`, phase `p08`, category
**security-privacy**, conditional, gate `panicClear`.

- Choose session, cookies and history independently
- Two-step confirmation before clearing
- Result states exactly what was cleared

Entry: `vaayvuEvent({ type: 'panicClear' })`,
`window.__vaayvuPanicClearPrompt()`, or `__vaayvuOnboardingOpen('s-180')`.

## Screen `s-181` — permission prompt (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-181`, phase `p08`, category
**security-privacy**, conditional, gate `permissionPrompt`.

- Camera request from meet.example
- **Allow once**, **Allow and remember**, **Block**
- **Learn more** explains scope without jargon
- Result states what was remembered

Entry: `vaayvuEvent({ type: 'permissionPrompt' })`,
`window.__vaayvuPermissionPromptScreenPrompt()`, or `__vaayvuOnboardingOpen('s-181')`.

## Screen `s-182` — permission blocked (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-182`, phase `p08`, category
**security-privacy**, conditional, gate `permissionBlocked`.

- States the site and blocked permission
- Exact unblock steps: Site info → Permissions → Allow
- Open site settings (S-158) and ask the site to retry

Entry: `vaayvuEvent({ type: 'permissionBlocked' })`,
`window.__vaayvuPermissionBlockedPrompt()`, or `__vaayvuOnboardingOpen('s-182')`.

## Screen `s-183` — site data prompt (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-183`, phase `p08`, category
**security-privacy**, conditional, gate `siteDataPrompt`.

- Local storage and cache sizes for the current site
- Allow storage, clear site data, manage all origins (S-159)

Entry: `vaayvuEvent({ type: 'siteDataPrompt' })`,
`window.__vaayvuSiteDataPromptPrompt()`, or `__vaayvuOnboardingOpen('s-183')`.

## Screen `s-184` — HTTPS upgrade interstitial (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-184`, phase `p08`, category
**security-privacy**, conditional, gate `httpsUpgrade`.

- States the secure version is unavailable
- Why: HTTP is clear text and changeable on this network
- Proceed is explicit, never automatic
- Back to safety leaves the HTTP page unopened

Entry: `vaayvuEvent({ type: 'httpsUpgrade' })`,
`window.__vaayvuHttpsUpgradePrompt()`, or `__vaayvuOnboardingOpen('s-184')`.

## Screen `s-185` — insecure form warning (security & privacy, phase p08)

Route `vaayvu://security-privacy/s-185`, phase `p08`, category
**security-privacy**, conditional, gate `insecureForm`.

- Password field on HTTP is detected
- Submission is **blocked**, not warned-and-allowed
- Why explains transit risk
- Leave this page returns without submitting

Entry: `vaayvuEvent({ type: 'insecureForm' })`,
`window.__vaayvuInsecureFormPrompt()`, or `__vaayvuOnboardingOpen('s-185')`.

## Screen `s-186` — settings root (settings, phase p04)

Route `vaayvu://settings/s-186`, phase `p04`, category **settings**,
conditional, gate `settingsRoot`.

- Search filters titles and help text
- Nine core categories with stable targets
- Sync status states the effective local state
- More settings action

Entry: `vaayvuEvent({ type: 'settingsRoot' })`,
`window.__vaayvuSettingsRootPrompt()`, or `__vaayvuOnboardingOpen('s-186')`.

## Screen `s-187` — appearance (settings, phase p04)

Route `vaayvu://settings/s-187`, phase `p04`, category **settings**,
conditional, gate `appearanceSettings`.

- Theme: system / light / dark
- Five accent colours
- Tabs: top / bottom / left / right
- Sidebar: auto / left / right
- Bookmarks bar show/hide
- Motion on/reduced, with live preview

Entry: `vaayvuEvent({ type: 'appearanceSettings' })`,
`window.__vaayvuAppearanceSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-187')`.

## Screen `s-188` — tabs and spaces (settings, phase p04)

Route `vaayvu://settings/s-188`, phase `p04`, category **settings**,
conditional, gate `tabsSpacesSettings`.

- Tab position: top / bottom / left / right
- After closing: next / previous / opener
- Sleep after 5 / 15 / 30 / 60 minutes
- Tab groups and split view toggles

Entry: `vaayvuEvent({ type: 'tabsSpacesSettings' })`,
`window.__vaayvuTabsSpacesSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-188')`.

## Screen `s-189` — search and omnibox (settings, phase p04)

Route `vaayvu://settings/s-189`, phase `p04`, category **settings**,
conditional, gate `searchOmniboxSettings`.

- Default engine: DuckDuckGo / Google / Bing / Brave
- Local suggestions: history, bookmarks, open tabs; remote is opt-in
- Page actions and shield status visibility
- AI in the omnibox toggle
- Manage search engines (S-165)

Entry: `vaayvuEvent({ type: 'searchOmniboxSettings' })`,
`window.__vaayvuSearchOmniboxSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-189')`.

## Screen `s-190` — privacy (settings, phase p04)

Route `vaayvu://settings/s-190`, phase `p04`, category **settings**,
conditional, gate `privacySettings`.

- Cookie policy: allow all / block third-party / block all
- HTTPS-only mode
- Links to fingerprint (S-170), DNS (S-171), partitions (S-402) and clear data (S-161)

Entry: `vaayvuEvent({ type: 'privacySettings' })`,
`window.__vaayvuPrivacySettingsPrompt()`, or `__vaayvuOnboardingOpen('s-190')`.

## Screen `s-191` — Rasha ad blocker (settings, phase p04)

Route `vaayvu://settings/s-191`, phase `p04`, category **settings**,
conditional, gate `rashaSettings`.

- Five independent categories: Ads, Tracking, Social widgets, Cookie banners, Malware
- Custom blocked domains with validation
- Exact-host pauses with Resume
- Rule generation, freshness and supported protection status
- Diagnostics and scoped reset

Entry: `vaayvuEvent({ type: 'rashaSettings' })`,
`window.__vaayvuRashaSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-191')`.

## Screen `s-192` — passwords and autofill (settings, phase p04)

Route `vaayvu://settings/s-192`, phase `p04`, category **settings**,
conditional, gate `passwordsAutofillSettings`.

- Vault (S-147), passkeys (S-150), addresses (S-151), cards (S-152)
- Offer to save passwords, autofill, device authentication
- Credential health (S-420)

Entry: `vaayvuEvent({ type: 'passwordsAutofillSettings' })`,
`window.__vaayvuPasswordsSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-192')`.

## Screen `s-193` — payments (settings, phase p04)

Route `vaayvu://settings/s-193`, phase `p04`, category **settings**,
conditional, gate `paymentsSettings`.

- Saved cards (S-152)
- Card autofill toggle
- CVC policy: always ask / remember
- Scan card

Entry: `vaayvuEvent({ type: 'paymentsSettings' })`,
`window.__vaayvuPaymentsSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-193')`.

## Screen `s-194` — downloads (settings, phase p04)

Route `vaayvu://settings/s-194`, phase `p04`, category **settings**,
conditional, gate `downloadsSettings`.

- Location: Downloads / Desktop / Ask
- Ask where to save
- Scan downloads
- Speed limit: unlimited / 5 MB/s / 1 MB/s
- Pause on metered connections

Entry: `vaayvuEvent({ type: 'downloadsSettings' })`,
`window.__vaayvuDownloadsSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-194')`.

## Screen `s-195` — languages and translate (settings, phase p04)

Route `vaayvu://settings/s-195`, phase `p04`, category **settings**,
conditional, gate `languagesSettings`.

- Interface language: English / Hindi / Marathi / Tamil
- Spellcheck toggle
- Offer to translate pages
- Offline language pack download

Entry: `vaayvuEvent({ type: 'languagesSettings' })`,
`window.__vaayvuLanguagesSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-195')`.

## Screen `s-196` — accessibility (settings, phase p04)

Route `vaayvu://settings/s-196`, phase `p04`, category **settings**,
conditional, gate `accessibilitySettings`.

- Screen reader optimisations
- Reduce motion
- Contrast: standard / high
- Default zoom: 100 / 110 / 125 / 150%
- Caret browsing

Entry: `vaayvuEvent({ type: 'accessibilitySettings' })`,
`window.__vaayvuAccessibilitySettingsPrompt()`, or `__vaayvuOnboardingOpen('s-196')`.

## Screen `s-197` — system and performance (settings, phase p04)

Route `vaayvu://settings/s-197`, phase `p04`, category **settings**,
conditional, gate `systemPerformanceSettings`.

- Memory saver and mode: balanced / maximum
- Battery saver
- GPU acceleration
- Startup: continue session / start page
- Proxy link (S-171)

Entry: `vaayvuEvent({ type: 'systemPerformanceSettings' })`,
`window.__vaayvuSystemPerformanceSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-197')`.

## Screen `s-198` — extensions (settings, phase p04)

Route `vaayvu://settings/s-198`, phase `p04`, category **settings**,
conditional, gate `extensionsSettings`.

- Developer mode
- Automatic updates
- Default site access: all / on click / specific
- Manage extensions (S-154) and capability catalog (S-528)

Entry: `vaayvuEvent({ type: 'extensionsSettings' })`,
`window.__vaayvuExtensionsSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-198')`.

## Screen `s-199` — sync (settings, phase p04)

Route `vaayvu://settings/s-199`, phase `p04`, category **settings**,
conditional, gate `syncSettings`.

- Sync profile on/off
- Entities: bookmarks, open tabs, passwords, settings, extensions
- Devices (S-220), recovery (S-232), diagnostics (S-137)

Entry: `vaayvuEvent({ type: 'syncSettings' })`,
`window.__vaayvuSyncSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-199')`.

## Screen `s-200` — AI (settings, phase p04)

Route `vaayvu://settings/s-200`, phase `p04`, category **settings**,
conditional, gate `aiSettings`.

- Model: auto / on-device / cloud
- Memory, page context, agent actions
- Retention: session / 30 days / none
- Training on your data, off by default
- Quota (S-215) and memory list (S-212)

Entry: `vaayvuEvent({ type: 'aiSettings' })`,
`window.__vaayvuAiSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-200')`.

## Screen `s-201` — advanced (settings, phase p04)

Route `vaayvu://settings/s-201`, phase `p04`, category **settings**,
conditional, gate `advancedSettings`.

- Independent experimental flags
- Diagnostics (S-237)
- Reset all experiments

Entry: `vaayvuEvent({ type: 'advancedSettings' })`,
`window.__vaayvuAdvancedSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-201')`.

## Screen `s-202` — about and reset (settings, phase p04)

Route `vaayvu://settings/s-202`, phase `p04`, category **settings**,
conditional, gate `aboutReset`.

- Version 0.0.23, Stable channel
- Update check (S-016)
- Credits and licences
- Guarded reset of all settings; saved data kept

Entry: `vaayvuEvent({ type: 'aboutReset' })`,
`window.__vaayvuAboutResetPrompt()`, or `__vaayvuOnboardingOpen('s-202')`.

## Screen `s-203` — AI launcher (AI, phase p13)

Route `vaayvu://ai/s-203`, phase `p13`, category **ai**, conditional,
gate `aiLauncher`.

- Toolbar launcher and keyboard shortcut
- Selection actions (S-208), page chat (S-204), summarize (S-205)
- Consent first: nothing sent until a source is chosen; private pages excluded

Entry: `vaayvuEvent({ type: 'aiLauncher' })`,
`window.__vaayvuAiLauncherPrompt()`, or `__vaayvuOnboardingOpen('s-203')`.

## Screen `s-204` — chat with page (AI, phase p13)

Route `vaayvu://ai/s-204`, phase `p13`, category **ai**, conditional,
gate `chatWithPage`.

- Removable page-context chip
- Thread with citations linking to quoted passages
- Ask input and citation open actions

Entry: `vaayvuEvent({ type: 'chatWithPage' })`,
`window.__vaayvuChatWithPagePrompt()`, or `__vaayvuOnboardingOpen('s-204')`.

## Screen `s-205` — summarize (AI, phase p13)

Route `vaayvu://ai/s-205`, phase `p13`, category **ai**, conditional,
gate `summarize`.

- TL;DR or bullets
- Short or long length
- Copy summary

Entry: `vaayvuEvent({ type: 'summarize' })`,
`window.__vaayvuSummarizePrompt()`, or `__vaayvuOnboardingOpen('s-205')`.

## Screen `s-206` — compare tabs (AI, phase p13)

Route `vaayvu://ai/s-206`, phase `p13`, category **ai**, conditional,
gate `compareTabs`.

- Pick two or more tabs
- Side-by-side table: topic, length, key point
- Citations per cell

Entry: `vaayvuEvent({ type: 'compareTabs' })`,
`window.__vaayvuCompareTabsPrompt()`, or `__vaayvuOnboardingOpen('s-206')`.

## Screen `s-207` — compose rewrite (AI, phase p13)

Route `vaayvu://ai/s-207`, phase `p13`, category **ai**, conditional,
gate `composeRewrite`.

- Tone: neutral / friendly / formal / concise
- Length: shorter / same / longer
- Rewrite, then Insert or Replace draft

Entry: `vaayvuEvent({ type: 'composeRewrite' })`,
`window.__vaayvuComposeRewritePrompt()`, or `__vaayvuOnboardingOpen('s-207')`.

## Screen `s-208` — selection actions (AI, phase p13)

Route `vaayvu://ai/s-208`, phase `p13`, category **ai**, conditional,
gate `selectionActions`.

- Selected quote shown
- Explain, Translate, Rewrite, Search
- Each action produces its own honest preview

Entry: `vaayvuEvent({ type: 'selectionActions' })`,
`window.__vaayvuSelectionActionsPrompt()`, or `__vaayvuOnboardingOpen('s-208')`.

## Screen `s-209` — agent plan (AI, phase p13)

Route `vaayvu://ai/s-209`, phase `p13`, category **ai**, conditional,
gate `agentPlan`.

- Three planned steps, each included or skipped
- Permissions: read page, click, form fill
- Estimated cost before approval
- Approve or cancel

Entry: `vaayvuEvent({ type: 'agentPlan' })`,
`window.__vaayvuAgentPlanPrompt()`, or `__vaayvuOnboardingOpen('s-209')`.

## Screen `s-210` — agent run (AI, phase p13)

Route `vaayvu://ai/s-210`, phase `p13`, category **ai**, conditional,
gate `agentRun`.

- Progress bar and percentage
- Pause/resume and stop
- Live log of each step
- Stopped disables further steps

Entry: `vaayvuEvent({ type: 'agentRun' })`,
`window.__vaayvuAgentRunPrompt()`, or `__vaayvuOnboardingOpen('s-210')`.

## Screen `s-211` — agent receipts (AI, phase p13)

Route `vaayvu://ai/s-211`, phase `p13`, category **ai**, conditional,
gate `agentReceipts`.

- Every agent action with time and screenshot receipt
- Undo one action
- Undo all remaining actions

Entry: `vaayvuEvent({ type: 'agentReceipts' })`,
`window.__vaayvuAgentReceiptsPrompt()`, or `__vaayvuOnboardingOpen('s-211')`.

## Screen `s-212` — AI memory (AI, phase p13)

Route `vaayvu://ai/s-212`, phase `p13`, category **ai**, conditional,
gate `aiMemory`.

- List of saved memories
- Edit or delete an item
- Scope: this site or all chats
- Add a new memory

Entry: `vaayvuEvent({ type: 'aiMemory' })`,
`window.__vaayvuAiMemoryPrompt()`, or `__vaayvuOnboardingOpen('s-212')`.

## Screen `s-213` — AI settings (AI, phase p13)

Route `vaayvu://ai/s-213`, phase `p13`, category **ai**, conditional,
gate `aiSettingsScreen`.

- Provider: on-device / cloud
- Model: Vaayvu local / cloud standard / cloud max
- Retention: session / 30 days / none
- Training on your data, off by default
- Save

Entry: `vaayvuEvent({ type: 'aiSettingsScreen' })`,
`window.__vaayvuAiSettingsScreenPrompt()`, or `__vaayvuOnboardingOpen('s-213')`.

## Screen `s-214` — AI usage and quotas (AI, phase p13)

Route `vaayvu://ai/s-214`, phase `p13`, category **ai**, conditional,
gate `aiUsageQuotas`.

- Period: this week / this month
- Quota bar with requests and reset date
- Breakdown by feature: chat, summaries, agent runs
- Warn threshold: 50 / 80 / 95%
- Plans (S-215) and usage history (S-216)

Entry: `vaayvuEvent({ type: 'aiUsageQuotas' })`,
`window.__vaayvuAiUsageQuotasPrompt()`, or `__vaayvuOnboardingOpen('s-214')`.

## Screen `s-215` — plans and upgrade (AI, phase p13)

Route `vaayvu://ai/s-215`, phase `p13`, category **ai**, conditional,
gate `plansUpgrade`.

- Billing cycle: monthly / yearly (two months free)
- Free / Plus / Pro with prices and quotas
- Choose, then confirm the change
- Restore purchase, billing (S-219) and feature comparison

Entry: `vaayvuEvent({ type: 'plansUpgrade' })`,
`window.__vaayvuPlansUpgradePrompt()`, or `__vaayvuOnboardingOpen('s-215')`.

## Screen `s-216` — usage history (AI, phase p13)

Route `vaayvu://ai/s-216`, phase `p13`, category **ai**, conditional,
gate `usageHistory`.

- Range: last 7 or 30 days
- Entries with feature, time, tokens and completed/blocked status
- Total tokens for the selected period
- Export CSV; guarded clear of the local log

Entry: `vaayvuEvent({ type: 'usageHistory' })`,
`window.__vaayvuUsageHistoryPrompt()`, or `__vaayvuOnboardingOpen('s-216')`.

## Screen `s-217` — AI consent (AI, phase p13)

Route `vaayvu://ai/s-217`, phase `p13`, category **ai**, conditional,
gate `aiConsent`.

- Separate scopes: page content, selected text, chat history, saved memory
- Destination: on-device / cloud
- Explicit consent checkbox; grant requires at least one scope
- Decline and withdraw (withdraw resets every scope)

Entry: `vaayvuEvent({ type: 'aiConsent' })`,
`window.__vaayvuAiConsentPrompt()`, or `__vaayvuOnboardingOpen('s-217')`.

## Screen `s-218` — AI logs and transparency (AI, phase p13)

Route `vaayvu://ai/s-218`, phase `p13`, category **ai**, conditional,
gate `aiLogs`.

- Every AI request with feature, time, provider and model
- Details: purpose, data categories sent, retention
- Export log; guarded clear of the request log

Entry: `vaayvuEvent({ type: 'aiLogs' })`,
`window.__vaayvuAiLogsPrompt()`, or `__vaayvuOnboardingOpen('s-218')`.

## Screen `s-219` — accounts and profiles (accounts, phase p10)

Route `vaayvu://accounts/s-219`, phase `p10`, category **accounts**,
conditional, gate `accountsProfiles`.

- Profile list with the active profile marked
- Switch, rename, delete (guarded; at least one profile kept)
- Add a new profile
- Account and sync link (S-220)

Entry: `vaayvuEvent({ type: 'accountsProfiles' })`,
`window.__vaayvuAccountsProfilesPrompt()`, or `__vaayvuOnboardingOpen('s-219')`.

## Screen `s-220` — account and sync devices (accounts, phase p10)

Route `vaayvu://accounts/s-220`, phase `p10`, category **accounts**,
conditional, gate `accountSyncDevices`.

- Verified account, metadata-only sync
- Sync toggle for this device
- Device list with last-active time; revoke with confirmation
- Pairing code for a new device; recovery key (S-232); sign out of sync

Entry: `vaayvuEvent({ type: 'accountSyncDevices' })`,
`window.__vaayvuAccountSyncDevicesPrompt()`, or `__vaayvuOnboardingOpen('s-220')`.

## Screen `s-221` — sign-in methods (accounts, phase p10)

Route `vaayvu://accounts/s-221`, phase `p10`, category **accounts**,
conditional, gate `signInMethods`.

- Passkeys: list, add, remove with confirmation
- Two-factor authentication toggle
- Change password with current-password and 8-character validation
- One-time recovery codes

Entry: `vaayvuEvent({ type: 'signInMethods' })`,
`window.__vaayvuSignInMethodsPrompt()`, or `__vaayvuOnboardingOpen('s-221')`.

## Screen `s-222` — profile data and avatars (accounts, phase p10)

Route `vaayvu://accounts/s-222`, phase `p10`, category **accounts**,
conditional, gate `profileData`.

- Display name with live initials preview
- Avatar colour: blue / green / amber / rose / violet
- Photo upload and remove (falls back to initials)
- Save applies the name and colour

Entry: `vaayvuEvent({ type: 'profileData' })`,
`window.__vaayvuProfileDataPrompt()`, or `__vaayvuOnboardingOpen('s-222')`.

## Screen `s-223` — subscription and billing (accounts, phase p10)

Route `vaayvu://accounts/s-223`, phase `p10`, category **accounts**,
conditional, gate `subscriptionBilling`.

- Plan status, renewal date, billing email
- Card ending and update form (full number and MM/YY validated)
- Invoice receipts
- Cancel with confirmation (access until period end) and resume

Entry: `vaayvuEvent({ type: 'subscriptionBilling' })`,
`window.__vaayvuSubscriptionBillingPrompt()`, or `__vaayvuOnboardingOpen('s-223')`.

## Screen `s-224` — connected apps (accounts, phase p10)

Route `vaayvu://accounts/s-224`, phase `p10`, category **accounts**,
conditional, gate `connectedApps`.

- Connected apps with scopes and last-used time
- Details: exact scope plus keychain storage note
- Connect from the available list
- Revoke with confirmation; capability catalog (S-528)

Entry: `vaayvuEvent({ type: 'connectedApps' })`,
`window.__vaayvuConnectedAppsPrompt()`, or `__vaayvuOnboardingOpen('s-224')`.

## Screen `s-225` — data export (accounts, phase p10)

Route `vaayvu://accounts/s-225`, phase `p10`, category **accounts**,
conditional, gate `dataExport`.

- Categories: bookmarks, history, settings, passwords, tabs, autofill
- Format: JSON / CSV / HTML
- Encryption with a passphrase, mandatory for sensitive categories
- Created export downloads; recent exports can be downloaded again

Entry: `vaayvuEvent({ type: 'dataExport' })`,
`window.__vaayvuDataExportPrompt()`, or `__vaayvuOnboardingOpen('s-225')`.

## Screen `s-226` — data import (accounts, phase p10)

Route `vaayvu://accounts/s-226`, phase `p10`, category **accounts**,
conditional, gate `dataImport`.

- Source: Vaayvu, Chrome, Firefox, Safari or bookmarks HTML
- File name required before preview
- Preview counts for bookmarks, history and passwords
- Merge or replace duplicates; undo the import

Entry: `vaayvuEvent({ type: 'dataImport' })`,
`window.__vaayvuDataImportPrompt()`, or `__vaayvuOnboardingOpen('s-226')`.

## Screen `s-227` — delete account (accounts, phase p10)

Route `vaayvu://accounts/s-227`, phase `p10`, category **accounts**,
conditional, gate `deleteAccount`.

- Consequences: synced data erased, subscriptions stop, local profile stays
- 30-day grace period
- Confirmation requires typing `DELETE` and the password
- Scheduled deletion can be cancelled

Entry: `vaayvuEvent({ type: 'deleteAccount' })`,
`window.__vaayvuDeleteAccountPrompt()`, or `__vaayvuOnboardingOpen('s-227')`.

## Screen `s-228` — account recovery (accounts, phase p10)

Route `vaayvu://accounts/s-228`, phase `p10`, category **accounts**,
conditional, gate `accountRecovery`.

- Verified recovery email and optional phone (validated)
- Trusted contact invite (email validated)
- Recovery delay: 1 / 24 / 72 hours
- Offline recovery key generation and download; help link (S-232)

Entry: `vaayvuEvent({ type: 'accountRecovery' })`,
`window.__vaayvuAccountRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-228')`.

## Screen `s-229` — sessions and devices (accounts, phase p10)

Route `vaayvu://accounts/s-229`, phase `p10`, category **accounts**,
conditional, gate `sessionsDevices`.

- Signed-in sites with account and last-active time
- Sign out of one site (guarded; clears that site's cookies)
- Sign out everywhere (guarded)
- Local-only scope note; account devices link (S-220)

Entry: `vaayvuEvent({ type: 'sessionsDevices' })`,
`window.__vaayvuSessionsDevicesPrompt()`, or `__vaayvuOnboardingOpen('s-229')`.

## Screen `s-230` — family and child accounts (accounts, phase p10)

Route `vaayvu://accounts/s-230`, phase `p10`, category **accounts**,
conditional, gate `familyAccounts`.

- Family group with owner and child members
- Child supervision toggle; remove child with confirmation
- Invite by email (validated)
- Safe search, mature-site blocking, daily time limit
- Kids mode link (S-179)

Entry: `vaayvuEvent({ type: 'familyAccounts' })`,
`window.__vaayvuFamilyAccountsPrompt()`, or `__vaayvuOnboardingOpen('s-230')`.

## Screen `s-231` — profile lock (accounts, phase p10)

Route `vaayvu://accounts/s-231`, phase `p10`, category **accounts**,
conditional, gate `profileLock`.

- Lock toggle; unlock with device passcode or a 4–8 digit profile PIN
- Auto-lock after 1 / 5 / 15 minutes
- Lock at startup
- Lock now and a real unlock flow with wrong-PIN feedback

Entry: `vaayvuEvent({ type: 'profileLock' })`,
`window.__vaayvuProfileLockPrompt()`, or `__vaayvuOnboardingOpen('s-231')`.

## Screen `s-232` — account help and recovery (accounts, phase p10)

Route `vaayvu://accounts/s-232`, phase `p10`, category **accounts**,
conditional, gate `accountHelp`.

- Four topics with guided steps: sign-in, lost key, lockout, billing
- Support message required before sending
- Optional diagnostics (version, platform, errors; never page content)
- Real ticket reference and reply route

Entry: `vaayvuEvent({ type: 'accountHelp' })`,
`window.__vaayvuAccountHelpPrompt()`, or `__vaayvuOnboardingOpen('s-232')`.

## Screen `s-233` — downloads (system, phase p16)

Route `vaayvu://system/s-233`, phase `p16`, category **system**,
conditional, gate `systemDownloadsManager`.

- Filter: all / in progress / completed; search by file name
- Pause, resume, retry or cancel a download
- Open a completed file or the downloads folder
- Clear completed list (files kept); settings link (S-194)

Entry: `vaayvuEvent({ type: 'systemDownloadsManager' })`,
`window.__vaayvuDownloadsManagerPrompt()`, or `__vaayvuOnboardingOpen('s-233')`.

## Screen `s-234` — task manager (system, phase p16)

Route `vaayvu://system/s-234`, phase `p16`, category **system**,
conditional, gate `taskManager`.

- Sort by memory, CPU or name; search by task name
- Live total memory and task count
- Details: process count and reclaimable memory
- End one task; guarded end of all background tasks

Entry: `vaayvuEvent({ type: 'taskManager' })`,
`window.__vaayvuTaskManagerPrompt()`, or `__vaayvuOnboardingOpen('s-234')`.

## Screen `s-235` — battery and energy (system, phase p16)

Route `vaayvu://system/s-235`, phase `p16`, category **system**,
conditional, gate `batteryEnergy`.

- Battery level, charging state and time estimate
- Energy saver toggle (changes the estimate)
- Video on battery: auto / limit HD / pause autoplay
- Sync on battery toggle; per-site energy impact; task manager link (S-234)

Entry: `vaayvuEvent({ type: 'batteryEnergy' })`,
`window.__vaayvuBatteryEnergyPrompt()`, or `__vaayvuOnboardingOpen('s-235')`.

## Screen `s-236` — storage and cleanup (system, phase p16)

Route `vaayvu://system/s-236`, phase `p16`, category **system**,
conditional, gate `storageCleanup`.

- Storage by category: cache, cookies, history, downloads, site data
- Total used and selected size
- Smart cleanup (cache + site data, never history)
- Clean selected with confirmation; last-cleaned date; site data link (S-183)

Entry: `vaayvuEvent({ type: 'storageCleanup' })`,
`window.__vaayvuStorageCleanupPrompt()`, or `__vaayvuOnboardingOpen('s-236')`.

## Screen `s-237` — diagnostics (system, phase p16)

Route `vaayvu://system/s-237`, phase `p16`, category **system**,
conditional, gate `diagnostics`.

- Environment: version, platform, network, sync, weekly crashes
- Copy diagnostics; network check updates the timestamp
- Recent log excerpt
- Redacted diagnostics bundle with download; explicit privacy note

Entry: `vaayvuEvent({ type: 'diagnostics' })`,
`window.__vaayvuDiagnosticsPrompt()`, or `__vaayvuOnboardingOpen('s-237')`.

## Screen `s-238` — crash reports (system, phase p16)

Route `vaayvu://system/s-238`, phase `p16`, category **system**,
conditional, gate `crashReports`.

- Automatic sending toggle; off means nothing leaves the device
- Stored reports with source, time and sent state
- Details: signature, build, platform only
- Send one report; delete one or all (guarded)

Entry: `vaayvuEvent({ type: 'crashReports' })`,
`window.__vaayvuCrashReportsPrompt()`, or `__vaayvuOnboardingOpen('s-238')`.

## Screen `s-239` — update and channels (system, phase p16)

Route `vaayvu://system/s-239`, phase `p16`, category **system**,
conditional, gate `updateChannels`.

- Installed version 0.0.23 and current channel
- Channels: stable / beta / nightly
- Automatic updates toggle
- Check reports the real latest per channel; download queues for restart
- Release notes link (S-017)

Entry: `vaayvuEvent({ type: 'updateChannels' })`,
`window.__vaayvuUpdateChannelsPrompt()`, or `__vaayvuOnboardingOpen('s-239')`.

## Screen `s-240` — release notes (system, phase p16)

Route `vaayvu://system/s-240`, phase `p16`, category **system**,
conditional, gate `releaseNotesScreen`.

- Three recent versions with dates
- New / Improved / Fixed groups
- Search filters the visible notes
- Update and channels (S-239) and What's new tour (S-017)

Entry: `vaayvuEvent({ type: 'releaseNotesScreen' })`,
`window.__vaayvuReleaseNotesScreenPrompt()`, or `__vaayvuOnboardingOpen('s-240')`.

## Screen `s-241` — licences and notices (system, phase p16)

Route `vaayvu://system/s-241`, phase `p16`, category **system**,
conditional, gate `licencesNotices`.

- Six components with version and licence
- Filter by licence family; search by name or licence
- Notice detail: role and where the full text lives
- Copy attribution text; open licence documents

Entry: `vaayvuEvent({ type: 'licencesNotices' })`,
`window.__vaayvuLicencesNoticesPrompt()`, or `__vaayvuOnboardingOpen('s-241')`.

## Screen `s-242` — privacy and terms (system, phase p16)

Route `vaayvu://system/s-242`, phase `p16`, category **system**,
conditional, gate `privacyTerms`.

- Documents: privacy policy, terms, cookies and storage
- Updated date; expandable plain-language sections
- Search filters sections by word
- Save a copy, print, licences link (S-241)

Entry: `vaayvuEvent({ type: 'privacyTerms' })`,
`window.__vaayvuPrivacyTermsPrompt()`, or `__vaayvuOnboardingOpen('s-242')`.

## Screen `s-243` — keyboard shortcuts (system, phase p16)

Route `vaayvu://system/s-243`, phase `p16`, category **system**,
conditional, gate `keyboardShortcuts`.

- Ten shortcuts grouped by tabs, navigation, privacy and AI
- Group filter and search by action or keys
- Single-key shortcuts toggle (advanced)
- Reset to defaults and print list

Entry: `vaayvuEvent({ type: 'keyboardShortcuts' })`,
`window.__vaayvuKeyboardShortcutsPrompt()`, or `__vaayvuOnboardingOpen('s-243')`.

## Screen `s-244` — touch gestures (system, phase p16)

Route `vaayvu://system/s-244`, phase `p16`, category **system**,
conditional, gate `touchGestures`.

- Two-finger swipe back/forward; pinch zoom
- Three-finger tab switch; long-press preview
- Sensitivity: low / normal / high
- Reset to defaults; visual gesture strip

Entry: `vaayvuEvent({ type: 'touchGestures' })`,
`window.__vaayvuTouchGesturesPrompt()`, or `__vaayvuOnboardingOpen('s-244')`.

## Screen `s-245` — default browser and links (system, phase p16)

Route `vaayvu://system/s-245`, phase `p16`, category **system**,
conditional, gate `defaultBrowser`.

- Default-browser status with an honest OS-settings handoff
- External link target: new tab / same tab / new window
- Protocol handlers for mailto:, tel: and webcal: (system app / Vaayvu / ask)
- Ask before leaving Vaayvu

Entry: `vaayvuEvent({ type: 'defaultBrowser' })`,
`window.__vaayvuDefaultBrowserPrompt()`, or `__vaayvuOnboardingOpen('s-245')`.

## Screen `s-246` — search engines (system, phase p16)

Route `vaayvu://system/s-246`, phase `p16`, category **system**,
conditional, gate `systemSearchEngines`.

- Five built-in engines with their query URLs
- Set default; add a custom engine (name + URL containing `%s`)
- Edit or remove custom engines; removing the default falls back to Vaayvu
- Search suggestions toggle (local first, provider opt-in)

Entry: `vaayvuEvent({ type: 'searchEngines' })`,
`window.__vaayvuSearchEnginesPrompt()`, or `__vaayvuOnboardingOpen('s-246')`.

## Screen `s-247` — proxy and network (system, phase p16)

Route `vaayvu://system/s-247`, phase `p16`, category **system**,
conditional, gate `proxyNetwork`.

- Proxy mode: system / direct / manual / PAC
- Manual host and port (1–65535) or PAC URL validation
- Bypass list
- DNS over HTTPS with Cloudflare / Quad9 / System resolver
- Save, test connection, DNS proxy link (S-171)

Entry: `vaayvuEvent({ type: 'proxyNetwork' })`,
`window.__vaayvuProxyNetworkPrompt()`, or `__vaayvuOnboardingOpen('s-247')`.

## Screen `s-248` — date, time and units (system, phase p16)

Route `vaayvu://system/s-248`, phase `p16`, category **system**,
conditional, gate `dateTimeUnits`.

- Live preview of time, date, number and weight
- Time zone: system / Asia/Kolkata / UTC; 24-hour clock
- Date order: D/M/Y, M/D/Y, Y-M-D; week starts Monday or Sunday
- Units: metric or imperial; Indian or international number grouping

Entry: `vaayvuEvent({ type: 'dateTimeUnits' })`,
`window.__vaayvuDateTimeUnitsPrompt()`, or `__vaayvuOnboardingOpen('s-248')`.

## Screen `s-249` — notifications and alerts (system, phase p16)

Route `vaayvu://system/s-249`, phase `p16`, category **system**,
conditional, gate `notificationsAlerts`.

- Master notification toggle
- Per-type: downloads, sync, security, AI, tips, updates
- Quiet hours with start and end times; sound toggle
- Test notification and system permission handoff

Entry: `vaayvuEvent({ type: 'notificationsAlerts' })`,
`window.__vaayvuNotificationsAlertsPrompt()`, or `__vaayvuOnboardingOpen('s-249')`.

## Screen `s-250` — system info and reset (system, phase p16)

Route `vaayvu://system/s-250`, phase `p16`, category **system**,
conditional, gate `systemInfoReset`.

- OS, memory, storage, graphics and version summary
- Copy system info
- Restart renderer (tabs reload; session kept)
- Guarded reset of all browser state (bookmarks and passwords kept)
- Storage and cleanup (S-236) and diagnostics (S-237)

Entry: `vaayvuEvent({ type: 'systemInfoReset' })`,
`window.__vaayvuSystemInfoResetPrompt()`, or `__vaayvuOnboardingOpen('s-250')`.

## Screen `s-251` — browser startup health (resilience, phase p04)

Route `vaayvu://resilience/s-251`, phase `p04`, category **resilience**,
priority **trust**, gate `startupHealth`.

- Failed stage (session restore), last successful startup, crash-loop marker
- Profile schema, disk availability and verified update state
- Continue with the intact profile (guarded; failing workload skipped)
- Recovery choices (S-254) and safe diagnostics (S-260)

Acceptance: a repeated crash offers recovery before restoring the failing
workload; continuing never erases the profile; diagnostics omit private-session
URLs and credentials.

Entry: `vaayvuEvent({ type: 'startupHealth' })`,
`window.__vaayvuStartupHealthPrompt()`, or `__vaayvuOnboardingOpen('s-251')`.

## Screen `s-252` — engine integrity and update status (resilience, phase p04)

Route `vaayvu://resilience/s-252`, phase `p04`, category **resilience**,
priority **trust**, gate `engineIntegrity`.

- Installed app/engine revisions and package date
- Signed digest, compatibility range and pending update
- Inspect versions (engine, build, libraries)
- Local integrity check: verified online, or offline with the
  locally-verified-only explanation; failure blocks browsing and points to S-264

Acceptance: versions come from installed metadata; a signature failure is never
shown as verified; offline verification distinguishes local verification from
unavailable update status.

Entry: `vaayvuEvent({ type: 'engineIntegrity' })`,
`window.__vaayvuEngineIntegrityPrompt()`, or `__vaayvuOnboardingOpen('s-252')`.

## Screen `s-253` — profile lock/unlock (resilience, phase p04)

Route `vaayvu://resilience/s-253`, phase `p04`, category **resilience**,
priority **trust**, gate `profileUnlock`.

- Locked state hides history, tabs, passwords and site data
- Lock policy, OS authentication capability and failed-attempt count
- Unlock with device passcode; failed authentication stays locked
- Reviewed app-PIN fallback, explicitly not labelled as OS biometrics
- Switch profile without loading locked data

Acceptance: locked data is never rendered behind the prompt; failure leaves the
profile locked; unsupported authentication shows the fallback honestly.

Entry: `vaayvuEvent({ type: 'profileUnlock' })`,
`window.__vaayvuProfileUnlockPrompt()`, or `__vaayvuOnboardingOpen('s-253')`.

## Screen `s-254` — profile recovery choice (resilience, phase p04)

Route `vaayvu://resilience/s-254`, phase `p04`, category **resilience**,
priority **trust**, gate `profileRecovery`.

- Sources: last good snapshot, older backup, damaged current profile
- Usable entities and exactly what is missing; schema shown
- Older unsupported schema is read-only and cannot be previewed
- Compare versions; preview a recovery copy (S-257); cancel keeps all files

Acceptance: a choice names exactly what is usable or missing; selecting a row
never overwrites a source; unsupported schemas stay read-only with an
explanation.

Entry: `vaayvuEvent({ type: 'profileRecovery' })`,
`window.__vaayvuProfileRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-254')`.

## Screen `s-255` — damaged session salvage (resilience, phase p04)

Route `vaayvu://resilience/s-255`, phase `p04`, category **resilience**,
priority **trust**, gate `sessionSalvage`.

- Journal segments, readable tab records and corrupt indices
- Scan runs on a copy; corrupt records are skipped individually
- Select recoverable regular tabs and open them in a new session
- Redacted salvage report (windows, corrupt indices, errors; no credentials)
- Private-session tabs are never reconstructed

Entry: `vaayvuEvent({ type: 'sessionSalvage' })`,
`window.__vaayvuSessionSalvagePrompt()`, or `__vaayvuOnboardingOpen('s-255')`.

## Screen `s-256` — backup catalogue (resilience, phase p04)

Route `vaayvu://resilience/s-256`, phase `p04`, category **resilience**,
priority **trust**, gate `backupCatalogue`.

- Locally available backups with ID, time, schema and integrity
- Missing files show unavailable, never restorable
- Inspect entity counts; encrypted backups require local unlock first
- Restore preview (S-257); listing never restores or uploads

Entry: `vaayvuEvent({ type: 'backupCatalogue' })`,
`window.__vaayvuBackupCataloguePrompt()`, or `__vaayvuOnboardingOpen('s-256')`.

## Screen `s-257` — backup restore preview (resilience, phase p04)

Route `vaayvu://resilience/s-257`, phase `p04`, category **resilience**,
priority **trust**, gate `restorePreview`.

- Selected backup, target profile, space and schema conversion
- Entity-by-entity changes with conflict outcome
- Destination: new recovery profile or reviewed merge (conflicts keep both)
- Read-only until confirmation; interruption leaves profile and backup intact

Entry: `vaayvuEvent({ type: 'restorePreview' })`,
`window.__vaayvuRestorePreviewPrompt()`, or `__vaayvuOnboardingOpen('s-257')`.

## Screen `s-258` — migration dry run summary (resilience, phase p04)

Route `vaayvu://resilience/s-258`, phase `p04`, category **resilience**,
priority **trust**, gate `migrationDryRun`.

- Source 12 → target 14, steps, affected keys, conflicts, rollback journal
- Dry run on a disposable copy; live profile untouched
- Unsupported keys are retained in the migration report
- Approval requires a completed dry run and verified backup
- Simulated failure restores the last coherent schema state

Entry: `vaayvuEvent({ type: 'migrationDryRun' })`,
`window.__vaayvuMigrationDryRunPrompt()`, or `__vaayvuOnboardingOpen('s-258')`.

## Screen `s-259` — crash journal inspection (resilience, phase p04)

Route `vaayvu://resilience/s-259`, phase `p04`, category **resilience**,
priority **trust**, gate `crashJournal`.

- Sanitized crash metadata: component, signature, versions, retention
- No raw memory dumps collected by default
- Redaction preview and redacted export (private URLs and tokens removed)
- Missing symbols shown as a limitation; links to recovery (S-254)

Entry: `vaayvuEvent({ type: 'crashJournal' })`,
`window.__vaayvuCrashJournalPrompt()`, or `__vaayvuOnboardingOpen('s-259')`.

## Screen `s-260` — safe mode diagnostic wizard (resilience, phase p04)

Route `vaayvu://resilience/s-260`, phase `p04`, category **resilience**,
priority **trust**, gate `safeModeWizard`.

- Safe-mode scope: extensions and restored-tab policy only
- Start a temporary session; re-enable suspects one at a time
- Sandbox, certificate checks and HTTPS upgrades remain enabled
- Exit restores the previous extension state
- Results explain every temporary change

Entry: `vaayvuEvent({ type: 'safeModeWizard' })`,
`window.__vaayvuSafeModeWizardPrompt()`, or `__vaayvuOnboardingOpen('s-260')`.

## Screen `s-261` — new profile isolation wizard (resilience, phase p04)

Route `vaayvu://resilience/s-261`, phase `p04`, category **resilience**,
priority **trust**, gate `profileIsolation`.

- Name and destination with duplicate-name validation
- Isolated cookie jar, cache and credential store
- Optional import entities, none selected by default
- Private sessions are never offered as an import source
- Create, then open in its own window; current profile untouched

Entry: `vaayvuEvent({ type: 'profileIsolation' })`,
`window.__vaayvuProfileIsolationPrompt()`, or `__vaayvuOnboardingOpen('s-261')`.

## Screen `s-262` — container isolation test page (resilience, phase p04)

Route `vaayvu://resilience/s-262`, phase `p04`, category **resilience**,
priority **trust**, gate `containerIsolation`.

- Controlled fixture origins (`test-a.vaayvu.test`) and two container IDs
- Cookie and localStorage probes; same-origin comparison across containers
- Unsupported HTTP cache partition is reported, never marked passed
- Redacted capability report without real browsing credentials

Entry: `vaayvuEvent({ type: 'containerIsolation' })`,
`window.__vaayvuContainerIsolationPrompt()`, or `__vaayvuOnboardingOpen('s-262')`.

## Screen `s-263` — security incident notice (resilience, phase p04)

Route `vaayvu://resilience/s-263`, phase `p04`, category **resilience**,
priority **trust**, gate `securityIncident`.

- Signed advisory from the authenticated channel only
- Severity, affected range vs installed version, fixed version, freshness
- Remediation through S-264; local exposure check without speculative claims
- Dismiss hides the banner for the session but not the advisory

Entry: `vaayvuEvent({ type: 'securityIncident' })`,
`window.__vaayvuSecurityIncidentPrompt()`, or `__vaayvuOnboardingOpen('s-263')`.

## Screen `s-264` — emergency update required (security, phase p08)

Route `vaayvu://security/s-264`, phase `p08`, category **security**,
priority **trust**, gate `emergencyUpdate`.

- Verified package metadata: version, size, signature, recovery version
- Installation readiness; save regular work before restart
- Temporarily restricted capability with an honest reason
- Unsigned package is rejected; failed install keeps 0.0.23 intact and offers retry

Entry: `vaayvuEvent({ type: 'emergencyUpdate' })`,
`window.__vaayvuEmergencyUpdatePrompt()`, or `__vaayvuOnboardingOpen('s-264')`.

## Screen `s-265` — engine version mismatch (security, phase p08)

Route `vaayvu://security/s-265`, phase `p08`, category **security**,
priority **trust**, gate `engineMismatch`.

- Actual engine revision vs required range; incompatible component named
- Diagnostics for packaged libraries and profile schema
- Signed 0.0.25 update selected for restart; binaries never force-loaded
- Safe recovery link (S-260); no automatic schema downgrade

Entry: `vaayvuEvent({ type: 'engineMismatch' })`,
`window.__vaayvuEngineMismatchPrompt()`, or `__vaayvuOnboardingOpen('s-265')`.

## Screen `s-266` — unsupported DRM explanation (security, phase p08)

Route `vaayvu://security/s-266`, phase `p08`, category **security**,
priority **trust**, gate `drmExplanation`.

- Requested protected capability vs the licensed path that exists
- OS/engine limitation and publisher error code
- No bypass or media extraction; unprotected media stays usable
- Retry capability check; publisher help; return to the page

Entry: `vaayvuEvent({ type: 'drmExplanation' })`,
`window.__vaayvuDrmExplanationPrompt()`, or `__vaayvuOnboardingOpen('s-266')`.

## Screen `s-267` — streaming compatibility page (security, phase p08)

Route `vaayvu://security/s-267`, phase `p08`, category **security**,
priority **trust**, gate `streamingCompatibility`.

- Codec decode capability and supported fallback
- Transport/network state separate from DRM rights limits
- No 4K claim without target-device evidence
- Redacted diagnostics exclude playback tokens and signed media URLs
- Return to the player at the supported quality

Entry: `vaayvuEvent({ type: 'streamingCompatibility' })`,
`window.__vaayvuStreamingCompatibilityPrompt()`, or `__vaayvuOnboardingOpen('s-267')`.

## Screen `s-268` — extension API compatibility warning (security, phase p08)

Route `vaayvu://security/s-268`, phase `p08`, category **security**,
priority **trust**, gate `extensionApiWarning`.

- Extension manifest, required APIs and engine/API level
- Unsupported capabilities labelled before installation
- Security-critical gaps cannot be silently ignored
- Install with limits or cancel; unavailable native capability cannot be granted

Entry: `vaayvuEvent({ type: 'extensionApiWarning' })`,
`window.__vaayvuExtensionApiWarningPrompt()`, or `__vaayvuOnboardingOpen('s-268')`.

## Screen `s-269` — extension permission diff review (security, phase p08)

Route `vaayvu://security/s-269`, phase `p08`, category **security**,
priority **trust**, gate `permissionDiff`.

- Installed vs candidate manifests with provenance
- Added host permissions in origin-level wording; removed scopes
- Explicit approval gate before new host access is granted
- Decline keeps the previous extension version and permissions

Entry: `vaayvuEvent({ type: 'permissionDiff' })`,
`window.__vaayvuPermissionDiffPrompt()`, or `__vaayvuOnboardingOpen('s-269')`.

## Screen `s-270` — extension sandbox isolation alert (security, phase p08)

Route `vaayvu://security/s-270`, phase `p08`, category **security**,
priority **trust**, gate `sandboxIsolation`.

- Trusted browser-generated isolation alert; extension cannot forge it
- Extension ID, failure signal, affected process and disabled capabilities
- Incident details omit unrelated profile data
- Terminate process; quarantine stays active across restarts
- Quarantine review link (S-271)

Entry: `vaayvuEvent({ type: 'sandboxIsolation' })`,
`window.__vaayvuSandboxIsolationPrompt()`, or `__vaayvuOnboardingOpen('s-270')`.

## Screen `s-271` — malicious extension quarantine (security, phase p08)

Route `vaayvu://security/s-271`, phase `p08`, category **security**,
priority **trust**, gate `quarantineReview`.

- Package digest, reason, source evidence, version and permissions
- Quarantined code cannot execute while review is open
- Removal and stored-data deletion are separate, explicit choices
- Redacted false-positive report (digest, version, match; no history or secrets)

Entry: `vaayvuEvent({ type: 'quarantineReview' })`,
`window.__vaayvuQuarantineReviewPrompt()`, or `__vaayvuOnboardingOpen('s-271')`.

## Screen `s-272` — extension rollback details (security, phase p08)

Route `vaayvu://security/s-272`, phase `p08`, category **security**,
priority **trust**, gate `rollbackDetails`.

- Current version and eligible rollback candidates
- Signatures and data-schema compatibility
- Known-vulnerable version excluded from routine rollback
- Rollback keeps previous permissions; failure preserves recoverable state

Entry: `vaayvuEvent({ type: 'rollbackDetails' })`,
`window.__vaayvuRollbackDetailsPrompt()`, or `__vaayvuOnboardingOpen('s-272')`.

## Screen `s-273` — permission active-indicator center (security, phase p08)

Route `vaayvu://security/s-273`, phase `p08`, category **security**,
priority **trust**, gate `permissionIndicators`.

- Live camera, microphone and location sessions (not remembered grants)
- Committed origin, frame scope and start time per session
- Cross-origin frames named without attributing them to the top page
- Stop a live session; persistent site settings link (S-157)

Entry: `vaayvuEvent({ type: 'permissionIndicators' })`,
`window.__vaayvuPermissionIndicatorsPrompt()`, or `__vaayvuOnboardingOpen('s-273')`.

## Screen `s-274` — permission one-time session sheet (security, phase p08)

Route `vaayvu://security/s-274`, phase `p08`, category **security**,
priority **trust**, gate `oneTimeSheet`.

- Requested capability with requesting and top-level origins
- One-time lifetime: tab close or ten minutes, whichever first
- Platform permission state shown
- Allow once or deny; denial never becomes a persistent allow
- Cross-origin navigation requires a new grant

Entry: `vaayvuEvent({ type: 'oneTimeSheet' })`,
`window.__vaayvuOneTimeSheetPrompt()`, or `__vaayvuOnboardingOpen('s-274')`.

## Screen `s-275` — clipboard cross-origin warning (security, phase p08)

Route `vaayvu://security/s-275`, phase `p08`, category **security**,
priority **trust**, gate `clipboardWarning`.

- Requester origin and frame, operation (`readText` vs `writeText`)
- User activation and OS permission state
- Clipboard content never displayed before authorization
- Allow once or deny (clipboard unchanged); redirects require a new prompt

Entry: `vaayvuEvent({ type: 'clipboardWarning' })`,
`window.__vaayvuClipboardWarningPrompt()`, or `__vaayvuOnboardingOpen('s-275')`.

## Screen `s-276` — dangerous download quarantine (security, phase p08)

Route `vaayvu://security/s-276`, phase `p08`, category **security**,
priority **trust**, gate `downloadQuarantine`.

- Download ID, verified origin, filename and quarantine state
- Detection reason; suspected is distinguished from proven malicious
- Quarantined file cannot auto-open or execute
- Removal requires explicit confirmation; cancelling leaves the file untouched
- Redacted false-positive review request

Entry: `vaayvuEvent({ type: 'downloadQuarantine' })`,
`window.__vaayvuDownloadQuarantinePrompt()`, or `__vaayvuOnboardingOpen('s-276')`.

## Screen `s-277` — download resumed after restart (security, phase p08)

Route `vaayvu://security/s-277`, phase `p08`, category **security**,
priority **trust**, gate `downloadResume`.

- Partial file, verified byte offset and server range support
- ETag/Last-Modified validators; mismatch blocks unsafe concatenation
- Resume waits for final size and checksum before completion
- Restart requires a destination; conflicts need keep-both or replace
- Cancel keeps the partial file

Entry: `vaayvuEvent({ type: 'downloadResume' })`,
`window.__vaayvuDownloadResumePrompt()`, or `__vaayvuOnboardingOpen('s-277')`.

## Screen `s-278` — download hash and origin verification (security, phase p08)

Route `vaayvu://security/s-278`, phase `p08`, category **security**,
priority **trust**, gate `downloadIntegrity`.

- Source origin and full redirect chain
- Local digest calculation with a visible failed state
- Expected digest provenance; same-server unsigned match is not authenticity
- Missing publisher signature reported as unavailable
- Redacted verification record

Entry: `vaayvuEvent({ type: 'downloadIntegrity' })`,
`window.__vaayvuDownloadIntegrityPrompt()`, or `__vaayvuOnboardingOpen('s-278')`.

## Screen `s-279` — file upload privacy notice (security, phase p08)

Route `vaayvu://security/s-279`, phase `p08`, category **security**,
priority **trust**, gate `uploadPrivacy`.

- Selected files with sizes; removal before upload
- Exact destination origin and form scope
- Metadata exposure disclosure; optional local metadata removal
- Selection alone never transmits contents; upload requires explicit action

Entry: `vaayvuEvent({ type: 'uploadPrivacy' })`,
`window.__vaayvuUploadPrivacyPrompt()`, or `__vaayvuOnboardingOpen('s-279')`.

## Screen `s-280` — device storage pressure recovery (security, phase p08)

Route `vaayvu://security/s-280`, phase `p08`, category **security**,
priority **trust**, gate `storagePressure`.

- Free-space status and per-category cache usage
- Category-level reclaim choices; downloads marked protected
- Passwords, bookmarks and unsaved documents excluded
- Consequence preview; confirm only the chosen scope
- Failure reports remaining pressure without false reclaimed totals

Entry: `vaayvuEvent({ type: 'storagePressure' })`,
`window.__vaayvuStoragePressurePrompt()`, or `__vaayvuOnboardingOpen('s-280')`.

## Screen `s-281` — sync offline journal recovery (security, phase p08)

Route `vaayvu://security/s-281`, phase `p08`, category **security**,
priority **trust**, gate `syncJournal`.

- Local cursor, remote acknowledged sequence and queued operations
- Retryable entries and conflicts; encrypted journal with key epoch
- Auth required to resume; idempotency keys prevent duplicate records
- Conflicts open without discarding the journal; auth/key failure keeps it intact
- Private-session events never enter the journal

Entry: `vaayvuEvent({ type: 'syncJournal' })`,
`window.__vaayvuSyncJournalPrompt()`, or `__vaayvuOnboardingOpen('s-281')`.

## Screen `s-282` — sync retention compaction monitor (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-282`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `retentionMonitor`.

- Acknowledged device cursors, including a stale active device
- Tombstone horizon and compaction candidates
- Blocked tombstones held by the oldest active cursor
- Read-only preview; compaction removes only safe tombstones
- Local cache vs server-held metadata distinction

Entry: `vaayvuEvent({ type: 'retentionMonitor' })`,
`window.__vaayvuRetentionMonitorPrompt()`, or `__vaayvuOnboardingOpen('s-282')`.

## Screen `s-283` — sync stale device recovery (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-283`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `staleDevice`.

- Selected stale device, last acknowledgment, key epoch and journal gap
- Stale writes cannot resurrect deleted records
- Rebootstrap requires a current encrypted snapshot and authorization
- Revocation is explicit; being offline alone is not a reason
- Remotely downloaded data is not claimed erased

Entry: `vaayvuEvent({ type: 'staleDevice' })`,
`window.__vaayvuStaleDevicePrompt()`, or `__vaayvuOnboardingOpen('s-283')`.

## Screen `s-284` — sync revoked device confirmation (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-284`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `revocationConfirm`.

- Device identity and active sessions
- Revocation scope limited to this device; key rotation for re-pairing
- Acknowledgment status and completed/pending effects
- New sync access blocked; downloaded data not claimed erased
- Other devices stay signed in

Entry: `vaayvuEvent({ type: 'revocationConfirm' })`,
`window.__vaayvuRevocationConfirmPrompt()`, or `__vaayvuOnboardingOpen('s-284')`.

## Screen `s-285` — sync key change safety wizard (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-285`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `keyRotation`.

- Current and pending key epochs with authorized devices
- Re-encryption progress; new data encrypted only after commit
- Interruption keeps the old decrypt path and rollback state
- Recovery readiness and device reauthorization
- Raw key material never appears in logs or exports

Entry: `vaayvuEvent({ type: 'keyRotation' })`,
`window.__vaayvuKeyRotationPrompt()`, or `__vaayvuOnboardingOpen('s-285')`.

## Screen `s-286` — recovery phrase offline verification (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-286`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `recoveryVerify`.

- Local phrase entry with autocomplete and spellcheck disabled
- Format version and secure-memory lifetime shown
- Verification never uploads, copies or screenshots the phrase
- Incorrect material returns a safe error without partial-match leakage
- Input cleared from memory after verification

Entry: `vaayvuEvent({ type: 'recoveryVerify' })`,
`window.__vaayvuRecoveryVerifyPrompt()`, or `__vaayvuOnboardingOpen('s-286')`.

## Screen `s-287` — account deletion export confirmation (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-287`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `deletionExport`.

- Account identifier and synced entity scope
- Export must succeed before deletion can be confirmed
- Deleting the account is separate from local files
- Legal/financial records retained with the reason stated
- 30-day grace period and cancellation

Entry: `vaayvuEvent({ type: 'deletionExport' })`,
`window.__vaayvuDeletionExportPrompt()`, or `__vaayvuOnboardingOpen('s-287')`.

## Screen `s-288` — credential conflict resolution (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-288`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `credentialConflict`.

- Encrypted conflict list with origin/account labels and modified times
- Plaintext secrets only after explicit authentication
- Choose A, B or keep both; no timestamp-based auto-overwrite
- Atomic commit; failure preserves both encrypted versions

Entry: `vaayvuEvent({ type: 'credentialConflict' })`,
`window.__vaayvuCredentialConflictPrompt()`, or `__vaayvuOnboardingOpen('s-288')`.

## Screen `s-289` — passkey availability explainer (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-289`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `passkeyExplainer`.

- Relying party, platform authenticator capability and account state
- Cross-device routes (phone QR, security key)
- OS authenticator performs the signature; browser does not impersonate it
- Non-exportable keys; no recovery-copy promise
- Continue with authenticator or use another sign-in method

Entry: `vaayvuEvent({ type: 'passkeyExplainer' })`,
`window.__vaayvuPasskeyExplainerPrompt()`, or `__vaayvuOnboardingOpen('s-289')`.

## Screen `s-290` — passkey migration notice (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-290`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `passkeyMigration`.

- Provider migration support and relying-party association
- Transfer scope: passkeys only; no silent password conversion
- Completion requires provider evidence
- Source credentials retained automatically after transfer
- Cancel keeps existing credentials

Entry: `vaayvuEvent({ type: 'passkeyMigration' })`,
`window.__vaayvuPasskeyMigrationPrompt()`, or `__vaayvuOnboardingOpen('s-290')`.

## Screen `s-291` — credential phishing site warning (sync-credentials, phase p10)

Route `vaayvu://sync-credentials/s-291`, phase `p10`, category
**sync-credentials**, priority **trust**, gate `phishingWarning`.

- Saved credential origin vs committed destination origin
- Registrable-domain mismatch with lookalike host
- Trusted site-identity text is browser-owned; page content cannot rewrite it
- No autofill override; cancel leaves the vault entry untouched
- Absence of a threat-list match is not presented as proof of safety

Entry: `vaayvuEvent({ type: 'phishingWarning' })`,
`window.__vaayvuPhishingWarningPrompt()`, or `__vaayvuOnboardingOpen('s-291')`.

## Screen `s-292` — omnibox Unicode hostname analysis (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-292`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `hostnameAnalysis`.

- Typed host, Unicode form and engine-supplied ASCII form
- Script mix as a review signal, not proof of maliciousness
- Registrable-domain boundary and analysis version
- Copy visible destination without normalization
- Return to editing; destination never changed silently

Entry: `vaayvuEvent({ type: 'hostnameAnalysis' })`,
`window.__vaayvuHostnameAnalysisPrompt()`, or `__vaayvuOnboardingOpen('s-292')`.

## Screen `s-293` — lookalike URL review (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-293`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `lookalikeReview`.

- Requested URL, canonical origin and locally matched familiar host
- Similarity reason; no remote lookup without separate disclosure
- Suggested alternatives never auto-open
- Mandatory engine security block cannot be overridden
- Edit the address; destination unchanged until explicit navigation

Entry: `vaayvuEvent({ type: 'lookalikeReview' })`,
`window.__vaayvuLookalikeReviewPrompt()`, or `__vaayvuOnboardingOpen('s-293')`.

## Screen `s-294` — local network access prompt (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-294`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `localNetwork`.

- Requesting origin, capability, user activation and OS permission
- No background subnet scan to populate the prompt
- Grant bound to origin and tab; ends at tab close
- OS firewall remains authoritative; no system-wide exemption claimed
- Deny is not stored as an allow

Entry: `vaayvuEvent({ type: 'localNetwork' })`,
`window.__vaayvuLocalNetworkPrompt()`, or `__vaayvuOnboardingOpen('s-294')`.

## Screen `s-295` — third-party cookie exception explainer (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-295`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `storageAccess`.

- Top-level site and embedded origin both visible
- Blocked reason, proposed lifetime and affected data
- Grant a narrowly scoped exception or keep partitioning
- Revoke an active exception; expiry ends access automatically
- Other embedded origins and the global restriction stay in force

Entry: `vaayvuEvent({ type: 'storageAccess' })`,
`window.__vaayvuStorageAccessPrompt()`, or `__vaayvuOnboardingOpen('s-295')`.

## Screen `s-296` — incognito limitations explainer (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-296`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `incognitoLimits`.

- History and cookies ephemeral; downloads persist separately
- Network visibility stated plainly; no invisibility claim
- Private-mode permissions are separate from persistent grants
- Extensions disabled by default in private windows
- Closing the session removes ephemeral browser state

Entry: `vaayvuEvent({ type: 'incognitoLimits' })`,
`window.__vaayvuIncognitoLimitsPrompt()`, or `__vaayvuOnboardingOpen('s-296')`.

## Screen `s-297` — user consent for AI page context (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-297`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `pageContextConsent`.

- Selected origin and exact character scope
- Local/remote processor named; sensitive fields excluded
- Preview the exact excerpt before authorization
- Task-only consent; new pages/origins require new consent
- Decline sends nothing

Entry: `vaayvuEvent({ type: 'pageContextConsent' })`,
`window.__vaayvuPageContextConsentPrompt()`, or `__vaayvuOnboardingOpen('s-297')`.

## Screen `s-298` — AI source permission picker (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-298`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `sourcePicker`.

- Regular tabs and files with origin labels and size estimates
- Only checked sources are included; protected pages excluded
- Credential fields excluded automatically
- Confirm revalidates origins; changed sources are revalidated before dispatch

Entry: `vaayvuEvent({ type: 'sourcePicker' })`,
`window.__vaayvuSourcePickerPrompt()`, or `__vaayvuOnboardingOpen('s-298')`.

## Screen `s-299` — AI personal data redaction preview (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-299`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `redactionPreview`.

- Local preview with detected sensitive spans
- Redaction described as best-effort, not guaranteed secret detection
- Remove or restore extra content before approval
- Final payload digest fixed; hidden content cannot be appended later
- Cancel discards the unsent payload; provider receives nothing

Entry: `vaayvuEvent({ type: 'redactionPreview' })`,
`window.__vaayvuRedactionPreviewPrompt()`, or `__vaayvuOnboardingOpen('s-299')`.

## Screen `s-300` — AI tool action approval (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-300`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `toolApproval`.

- Concrete typed action, exact target origin/account and affected records
- Cost and one-shot authorization; page content cannot approve
- Review side effects before approving
- Target changes reset approval and require renewed review
- Reject or return for edits; external state untouched

Entry: `vaayvuEvent({ type: 'toolApproval' })`,
`window.__vaayvuToolApprovalPrompt()`, or `__vaayvuOnboardingOpen('s-300')`.

## Screen `s-301` — AI action receipt verification (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-301`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `actionReceipt`.

- Action ID, authorized command, actual result and timing
- Unknown outcome distinguished from confirmed failure
- Local evidence reference; receipt omits secrets and private content
- Undo only for supported inverse operations

Entry: `vaayvuEvent({ type: 'actionReceipt' })`,
`window.__vaayvuActionReceiptPrompt()`, or `__vaayvuOnboardingOpen('s-301')`.

## Screen `s-302` — AI prompt injection risk alert (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-302`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `injectionAlert`.

- Untrusted instruction source and affected pending action
- Blocked capability: external tools and permission changes
- Detection framed as a risk signal, not perfect attack discovery
- Stop the action; continue content-only analysis without approving it
- Review source scope

Entry: `vaayvuEvent({ type: 'injectionAlert' })`,
`window.__vaayvuInjectionAlertPrompt()`, or `__vaayvuOnboardingOpen('s-302')`.

## Screen `s-303` — AI provider outage fallback (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-303`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `providerFallback`.

- Provider status, queued task and honest payload outcome
- Retry with the same authorized scope; idempotent tool actions
- Cancel queued work
- Alternative processor requires boundary review before switching
- No silent reroute to another provider

Entry: `vaayvuEvent({ type: 'providerFallback' })`,
`window.__vaayvuProviderFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-303')`.

## Screen `s-304` — AI cost controls (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-304`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `costControls`.

- Token budget, usage source and configured limit
- Estimated task cost clearly distinct from billed cost
- Client pause at the limit; not described as server-enforced
- Usage fetch failure keeps the last known spend
- Browsing unaffected by the AI pause

Entry: `vaayvuEvent({ type: 'costControls' })`,
`window.__vaayvuCostControlsPrompt()`, or `__vaayvuOnboardingOpen('s-304')`.

## Screen `s-305` — AI on-device memory warning (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-305`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `localModelWarning`.

- Model size vs measured available memory; no unmeasured performance promise
- Protected workloads (calls/uploads) remain unaffected by model failure
- Load can fail honestly; choose a smaller model or cancel
- Unload releases memory without closing tabs
- Cloud alternative requires separate context consent

Entry: `vaayvuEvent({ type: 'localModelWarning' })`,
`window.__vaayvuLocalModelWarningPrompt()`, or `__vaayvuOnboardingOpen('s-305')`.

## Screen `s-306` — AI history deletion audit (ai-trust, phase p13)

Route `vaayvu://ai-trust/s-306`, phase `p13`, category **ai-trust**,
priority **advanced**, gate `historyAudit`.

- Selected conversation IDs with local/provider retention scopes
- Preview removal; local deletion distinct from provider erasure
- Provider deletion pending or failed with a retriable request
- Audit keeps minimal metadata, not deleted conversation content

Entry: `vaayvuEvent({ type: 'historyAudit' })`,
`window.__vaayvuHistoryAuditPrompt()`, or `__vaayvuOnboardingOpen('s-306')`.

## Screen `s-307` — reader extraction failure fallback (content, phase p14)

Route `vaayvu://content/s-307`, phase `p14`, category **content**,
priority **advanced**, gate `readerFallback`.

- Original URL, extraction outcome and supported content type
- Locally retained reading position (42%)
- Reader options disabled when no usable text exists
- Failed extraction never replaces the page with fabricated text
- Retry keeps scroll and form state; source attribution preserved

Entry: `vaayvuEvent({ type: 'readerFallback' })`,
`window.__vaayvuReaderFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-307')`.

## Screen `s-308` — PDF cryptographic signature limitations (content, phase p14)

Route `vaayvu://content/s-308`, phase `p14`, category **content**,
priority **advanced**, gate `pdfSignature`.

- Signature presence vs drawn signature image
- Validation capability; unsupported algorithm stays indeterminate
- Certificate chain and timestamp trust shown honestly
- Document modification state; editing warns of invalidation
- Save a copy before edits

Entry: `vaayvuEvent({ type: 'pdfSignature' })`,
`window.__vaayvuPdfSignaturePrompt()`, or `__vaayvuOnboardingOpen('s-308')`.

## Screen `s-309` — PDF data loss confirmation (content, phase p14)

Route `vaayvu://content/s-309`, phase `p14`, category **content**,
priority **advanced**, gate `pdfDataLoss`.

- Unsaved annotations/form fields, original path and destination conflict
- Save to a new copy; existing source not overwritten silently
- Discard only after explicit confirmation
- Save failure keeps in-memory work
- Cancel close and continue editing

Entry: `vaayvuEvent({ type: 'pdfDataLoss' })`,
`window.__vaayvuPdfDataLossPrompt()`, or `__vaayvuOnboardingOpen('s-309')`.

## Screen `s-310` — WebRTC session preservation warning (content, phase p14)

Route `vaayvu://content/s-310`, phase `p14`, category **content**,
priority **advanced**, gate `realtimeWarning`.

- Active call/tab, media devices and recording/upload state
- Requested suspension never interrupts the call silently
- Keep session, end call then suspend, or cancel suspension
- Reconnection limits stated without a restoration guarantee
- Ending stops device sessions and indicators

Entry: `vaayvuEvent({ type: 'realtimeWarning' })`,
`window.__vaayvuRealtimeWarningPrompt()`, or `__vaayvuOnboardingOpen('s-310')`.

## Screen `s-311` — screen-share permanent indicator (content, phase p14)

Route `vaayvu://content/s-311`, phase `p14`, category **content**,
priority **advanced**, gate `screenShare`.

- Capture target, requesting origin and sharing duration
- Trusted indicator stays visible; page content cannot forge it
- Inspect capture scope; stop sharing immediately
- Change source requires confirmation and a fresh picker
- Stop hides the indicator and ends frames to the origin

Entry: `vaayvuEvent({ type: 'screenShare' })`,
`window.__vaayvuScreenSharePrompt()`, or `__vaayvuOnboardingOpen('s-311')`.

## Screen `s-312` — tab snapshot data sensitivity notice (content, phase p14)

Route `vaayvu://content/s-312`, phase `p14`, category **content**,
priority **advanced**, gate `snapshotNotice`.

- Regular-tab thumbnail scope and 30-day retention
- Sensitive-content suppression for password fields and protected pages
- Private tabs never create persistent previews
- Disabling future capture does not claim old thumbnails were deleted
- Clear saved thumbnails with explicit scope

Entry: `vaayvuEvent({ type: 'snapshotNotice' })`,
`window.__vaayvuSnapshotNoticePrompt()`, or `__vaayvuOnboardingOpen('s-312')`.

## Screen `s-313` — tab restore conflict resolver (content, phase p14)

Route `vaayvu://content/s-313`, phase `p14`, category **content**,
priority **advanced**, gate `restoreConflict`.

- Saved vs live tab generations and protected unsaved state
- Duplicate URLs with deterministic, reversible handling
- Restore into a new window or additive merge
- Live unsaved form input never overwritten
- Private session data absent from candidates

Entry: `vaayvuEvent({ type: 'restoreConflict' })`,
`window.__vaayvuRestoreConflictPrompt()`, or `__vaayvuOnboardingOpen('s-313')`.

## Screen `s-314` — tab discard exemption list (content, phase p14)

Route `vaayvu://content/s-314`, phase `p14`, category **content**,
priority **advanced**, gate `discardExemption`.

- Exempt tab/site rules with reason, scope and expiry
- Active workloads (calls, uploads) protected automatically where detectable
- Add a narrow, time-limited exemption; remove without closing the tab
- No promise of survival under OS process termination
- Expired rules cease exempting automatically

Entry: `vaayvuEvent({ type: 'discardExemption' })`,
`window.__vaayvuDiscardExemptionPrompt()`, or `__vaayvuOnboardingOpen('s-314')`.

## Screen `s-315` — tab memory profiler (content, phase p14)

Route `vaayvu://content/s-315`, phase `p14`, category **content**,
priority **advanced**, gate `memoryProfiler`.

- Process-to-tab attribution with sample time
- Private vs shared memory; shared counted once
- Unavailable attribution labelled unavailable
- Sampled, not continuous; definitions shown
- Sleep action reports no fabricated RAM-saved figure

Entry: `vaayvuEvent({ type: 'memoryProfiler' })`,
`window.__vaayvuMemoryProfilerPrompt()`, or `__vaayvuOnboardingOpen('s-315')`.

## Screen `s-316` — background activity detector (content, phase p14)

Route `vaayvu://content/s-316`, phase `p14`, category **content**,
priority **advanced**, gate `backgroundActivity`.

- CPU/network/audio signals from engine callbacks with sample interval
- Quiet interval not treated as proof of permanent inactivity
- Mute or close through ordinary explicit actions
- Uploads and calls protected before throttling; policy explained

Entry: `vaayvuEvent({ type: 'backgroundActivity' })`,
`window.__vaayvuBackgroundActivityPrompt()`, or `__vaayvuOnboardingOpen('s-316')`.

## Screen `s-317` — battery saver exclusion list (content, phase p14)

Route `vaayvu://content/s-317`, phase `p14`, category **content**,
priority **advanced**, gate `batteryExclusions`.

- Battery policy and available OS signals (percentage/charging)
- Exceptions with reason and expiry; only energy behavior changes
- Active media/call leases protected from silent interruption
- Engine isolation never weakened by an exception
- Restore defaults removes exceptions without touching isolation

Entry: `vaayvuEvent({ type: 'batteryExclusions' })`,
`window.__vaayvuBatteryExclusionsPrompt()`, or `__vaayvuOnboardingOpen('s-317')`.

## Screen `s-318` — benchmark scene runner (content, phase p14)

Route `vaayvu://content/s-318`, phase `p14`, category **content**,
priority **advanced**, gate `benchmarkRunner`.

- Versioned workload and fixed fixtures; isolated test profile
- Device profile, browser versions, settings, repetitions and output path
- Cancelled runs are not counted; partial samples discarded
- Raw measurements saved with conditions; missing metrics stay missing
- Real credentials and private profiles excluded

Entry: `vaayvuEvent({ type: 'benchmarkRunner' })`,
`window.__vaayvuBenchmarkRunnerPrompt()`, or `__vaayvuOnboardingOpen('s-318')`.

## Screen `s-319` — benchmark baseline comparison (content, phase p14)

Route `vaayvu://content/s-319`, phase `p14`, category **content**,
priority **advanced**, gate `benchmarkComparison`.

- Baseline and current run IDs with comparable conditions
- Median/p95 distributions; no fastest-run cherry-pick
- Incompatible workloads visibly excluded
- No significance claim without a stated method
- Export declared comparison scope including exclusions

Entry: `vaayvuEvent({ type: 'benchmarkComparison' })`,
`window.__vaayvuBenchmarkComparisonPrompt()`, or `__vaayvuOnboardingOpen('s-319')`.

## Screen `s-320` — benchmark reproducibility report (content, phase p14)

Route `vaayvu://content/s-320`, phase `p14`, category **content**,
priority **advanced**, gate `reproducibility`.

- Workload digest, app/engine revision, OS/device and power mode
- Trace presence and sample count; missing traces explicit
- Exact command recipe and scene settings
- Environment gaps marked rather than estimated
- Export redacts URLs and tokens

Entry: `vaayvuEvent({ type: 'reproducibility' })`,
`window.__vaayvuReproducibilityPrompt()`, or `__vaayvuOnboardingOpen('s-320')`.

## Screen `s-321` — benchmark device list (content, phase p14)

Route `vaayvu://content/s-321`, phase `p14`, category **content**,
priority **advanced**, gate `deviceList`.

- Device model, OS, architecture and signing/deployment capability
- Availability and prior run evidence
- Listed without an artifact stays unverified
- Unavailable hardware cannot be selected as a target
- Export minimizes device identifiers

Entry: `vaayvuEvent({ type: 'deviceList' })`,
`window.__vaayvuDeviceListPrompt()`, or `__vaayvuOnboardingOpen('s-321')`.

## Screen `s-322` — high contrast surface inspector (content, phase p14)

Route `vaayvu://content/s-322`, phase `p14`, category **content**,
priority **advanced**, gate `contrastInspector`.

- Foreground/background tokens and measured ratios
- Method: WCAG 2.2 relative luminance on rendered colors, text role/size
- Focus ring and disabled-state meaning remain perceivable
- Switch to high-contrast tokens; record findings by component
- Preview not labeled full conformance

Entry: `vaayvuEvent({ type: 'contrastInspector' })`,
`window.__vaayvuContrastInspectorPrompt()`, or `__vaayvuOnboardingOpen('s-322')`.

## Screen `s-323` — reduced transparency theme inspector (content, phase p14)

Route `vaayvu://content/s-323`, phase `p14`, category **content**,
priority **advanced**, gate `transparencyInspector`.

- Material tokens, transparency state and opaque fallback
- OS reduced-transparency preference honored where available
- Critical origin text and form labels legible over varied backgrounds
- Compare clear vs opaque presets with identical controls
- Switching material never resets profile data or tab placement

Entry: `vaayvuEvent({ type: 'transparencyInspector' })`,
`window.__vaayvuTransparencyInspectorPrompt()`, or `__vaayvuOnboardingOpen('s-323')`.

## Screen `s-324` — screen reader route explorer (quality, phase p16)

Route `vaayvu://quality/s-324`, phase `p16`, category **quality**,
priority **advanced**, gate `routeExplorer`.

- Route tree in reading order with accessible names and roles
- Focus destinations traversed without pointer input
- Modal scope; closing returns focus to the trigger
- Live updates announced without repetitive timer chatter
- Record unlabeled or unreachable actions

Entry: `vaayvuEvent({ type: 'routeExplorer' })`,
`window.__vaayvuRouteExplorerPrompt()`, or `__vaayvuOnboardingOpen('s-324')`.

## Screen `s-325` — keyboard shortcut conflict resolver (quality, phase p16)

Route `vaayvu://quality/s-325`, phase `p16`, category **quality**,
priority **advanced**, gate `shortcutConflict`.

- Action IDs, chords and scope; collisions shown
- OS-reserved combinations protected
- Resolve explicitly (keep one, reassign the other)
- Text-entry fields never fire destructive commands
- Restore selected defaults

Entry: `vaayvuEvent({ type: 'shortcutConflict' })`,
`window.__vaayvuShortcutConflictPrompt()`, or `__vaayvuOnboardingOpen('s-325')`.

## Screen `s-326` — foldable posture transition (quality, phase p16)

Route `vaayvu://quality/s-326`, phase `p16`, category **quality**,
priority **advanced**, gate `foldablePosture`.

- Viewport bounds and pane adaptation on posture change
- Posture callback capability; unsupported falls back to viewport layout
- Hinge/safe area keeps essential controls clear
- Session, selected tab and form input preserved
- Layout preferences explain rail fallback

Entry: `vaayvuEvent({ type: 'foldablePosture' })`,
`window.__vaayvuFoldablePosturePrompt()`, or `__vaayvuOnboardingOpen('s-326')`.

## Screen `s-327` — iPad multiple window restore (quality, phase p16)

Route `vaayvu://quality/s-327`, phase `p16`, category **quality**,
priority **advanced**, gate `ipadRestore`.

- Scene identifiers and regular-window snapshots
- Tab-to-window mapping with one owner per tab
- Duplicate scene mapping resolved without duplication
- Private scenes excluded; no durable snapshots
- OS-restricted restoration described accurately; new window option

Entry: `vaayvuEvent({ type: 'ipadRestore' })`,
`window.__vaayvuIpadRestorePrompt()`, or `__vaayvuOnboardingOpen('s-327')`.

## Screen `s-328` — Windows Snap compatibility inspector (quality, phase p16)

Route `vaayvu://quality/s-328`, phase `p16`, category **quality**,
priority **advanced**, gate `windowsSnap`.

- Window bounds, DPI scale and minimum size fixtures
- Snap transitions preserve tab identity and focus
- Titlebar hit regions exclude trusted origin controls
- Platform capability stated; Mac evidence is not Windows completion
- Evidence saved as Mac-lane preview only

Entry: `vaayvuEvent({ type: 'windowsSnap' })`,
`window.__vaayvuWindowsSnapPrompt()`, or `__vaayvuOnboardingOpen('s-328')`.

## Screen `s-329` — Linux compositor compatibility inspector (quality, phase p16)

Route `vaayvu://quality/s-329`, phase `p16`, category **quality**,
priority **advanced**, gate `linuxCompositor`.

- Display protocol/compositor, fractional scale, decorations, input methods
- Wayland/X11 differences recorded explicitly
- Fractional scaling keeps controls visible and hit testing intact
- No Linux target attached: evidence export disabled
- Linux results require a real target run; remain a later lane

Entry: `vaayvuEvent({ type: 'linuxCompositor' })`,
`window.__vaayvuLinuxCompositorPrompt()`, or `__vaayvuOnboardingOpen('s-329')`.

## Screen `s-330` — upstream engine patch readiness (quality, phase p16)

Route `vaayvu://quality/s-330`, phase `p16`, category **quality**,
priority **advanced**, gate `upstreamReadiness`.

- Pinned revision, security patches, merge status and dependencies
- Required regression checks; unresolved merge/test blocks approval
- Security readiness shown separately from feature completeness
- Approval only after required checks; evidence lists gaps
- Patch review never fabricates device validation

Entry: `vaayvuEvent({ type: 'upstreamReadiness' })`,
`window.__vaayvuUpstreamReadinessPrompt()`, or `__vaayvuOnboardingOpen('s-330')`.

## Screen `s-331` — release rollout and rollback status (quality, phase p16)

Route `vaayvu://quality/s-331`, phase `p16`, category **quality**,
priority **advanced**, gate `releaseRollout`.

- Signed release manifest, cohort and crash/regression signals
- Pause/resume rollout
- Rollback target compatibility and migration check
- Audited rollback with a recorded reason
- Feature rollback never disables browser security

Entry: `vaayvuEvent({ type: 'releaseRollout' })`,
`window.__vaayvuReleaseRolloutPrompt()`, or `__vaayvuOnboardingOpen('s-331')`.

## Screen `s-332` — provider choice onboarding (onboarding, phase p03)

Route `vaayvu://onboarding/s-332`, phase `p03`, category **onboarding**,
priority **core**, gate `providerChoice`.

- Google, Bing, Brave Search, DuckDuckGo with the default marked
- Save selection and continue to search setup (S-051)
- Skip keeps DuckDuckGo

Entry: `vaayvuEvent({ type: 'providerChoice' })`,
`window.__vaayvuProviderChoicePrompt()`, or `__vaayvuOnboardingOpen('s-332')`.

## Screen `s-333` — search provider settings overview (settings, phase p03)

Route `vaayvu://settings/s-333`, phase `p03`, category **settings**,
priority **core**, gate `providerSettings`.

- Regular default and private default displayed separately
- Remote suggestion consent state
- Custom provider count and add action
- Links to S-334, S-335, S-336 and S-339

Entry: `vaayvuEvent({ type: 'providerSettings' })`,
`window.__vaayvuProviderSettingsPrompt()`, or `__vaayvuOnboardingOpen('s-333')`.

## Screen `s-334` — regular default provider picker (settings, phase p03)

Route `vaayvu://settings/s-334`, phase `p03`, category **settings**,
priority **core**, gate `regularProviderPicker`.

- Radio list with descriptions and current selection
- Save writes the regular default and returns to S-333
- Cancel keeps the previous value

Entry: `vaayvuEvent({ type: 'regularProviderPicker' })`,
`window.__vaayvuRegularProviderPickerPrompt()`, or `__vaayvuOnboardingOpen('s-334')`.

## Screen `s-335` — private default provider picker (settings, phase p03)

Route `vaayvu://settings/s-335`, phase `p03`, category **settings**,
priority **core**, gate `privateProviderPicker`.

- Private-window disclaimer: no regular history or autocomplete suggestions
- Private-only default selection
- Save returns to S-333; cancel keeps the previous value

Entry: `vaayvuEvent({ type: 'privateProviderPicker' })`,
`window.__vaayvuPrivateProviderPickerPrompt()`, or `__vaayvuOnboardingOpen('s-335')`.

## Screen `s-336` — add custom search provider (settings, phase p05)

Route `vaayvu://settings/s-336`, phase `p05`, category **settings**,
priority **core**, gate `addCustomProvider`.

- Name, HTTPS URL template with `%s`, unique keyword
- Test URL validates the template over HTTPS
- Invalid input retains the draft and points to S-338
- Save adds the provider and returns to S-333

Entry: `vaayvuEvent({ type: 'addCustomProvider' })`,
`window.__vaayvuAddCustomProviderPrompt()`, or `__vaayvuOnboardingOpen('s-336')`.

## Screen `s-337` — edit custom search provider (settings, phase p05)

Route `vaayvu://settings/s-337`, phase `p05`, category **settings**,
priority **core**, gate `editCustomProvider`.

- Modify name, HTTPS template and keyword with validation
- Save replaces the definition atomically
- Delete requires explicit confirmation; built-ins unaffected
- Cancel discards edits and keeps the saved definition

Entry: `vaayvuEvent({ type: 'editCustomProvider' })`,
`window.__vaayvuEditCustomProviderPrompt()`, or `__vaayvuOnboardingOpen('s-337')`.

## Screen `s-338` — invalid search provider error (error, phase p05)

Route `vaayvu://error/s-338`, phase `p05`, category **error**,
priority **core**, gate `providerError`.

- Draft retained exactly as typed
- Line-specific errors: unsafe scheme, duplicate keyword, missing placeholder
- No partial commit
- Correct input link back to S-336

Entry: `vaayvuEvent({ type: 'providerError' })`,
`window.__vaayvuProviderErrorPrompt()`, or `__vaayvuOnboardingOpen('s-338')`.

## Screen `s-339` — remote search suggestions consent (permissions, phase p05)

Route `vaayvu://permissions/s-339`, phase `p05`, category **permissions**,
priority **core**, gate `suggestionConsent`.

- Plain-language notice that typed characters may be sent to the provider
- Local and remote suggestions distinguished
- Explicit on/off; save returns to S-333
- Cancel keeps the previous consent

Entry: `vaayvuEvent({ type: 'suggestionConsent' })`,
`window.__vaayvuSuggestionConsentPrompt()`, or `__vaayvuOnboardingOpen('s-339')`.

## Screen `s-340` — search execution loading (navigation, phase p05)

Route `vaayvu://navigation/s-340`, phase `p05`, category **navigation**,
priority **core**, gate `searchLoading`.

- Query classified as search vs URL
- Provider pending, destination in the current tab
- Navigate to results (S-097) without a duplicate tab
- Timeout path to S-341; cancel leaves the tab unchanged

Entry: `vaayvuEvent({ type: 'searchLoading' })`,
`window.__vaayvuSearchLoadingPrompt()`, or `__vaayvuOnboardingOpen('s-340')`.

## Screen `s-341` — provider unavailable recovery (error, phase p05)

Route `vaayvu://error/s-341`, phase `p05`, category **error**,
priority **core**, gate `providerRecovery`.

- DNS/timeout reason shown
- Query retained unchanged
- Retry the same provider
- Change provider only through explicit choice (S-342); no silent switching

Entry: `vaayvuEvent({ type: 'providerRecovery' })`,
`window.__vaayvuProviderRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-341')`.

## Screen `s-342` — search provider switcher quick action (navigation, phase p05)

Route `vaayvu://navigation/s-342`, phase `p05`, category **navigation**,
priority **next**, gate `providerSwitcher`.

- On-demand provider list for one query only
- Saved default unchanged
- Keyboard (arrows + Enter) and mobile bottom-sheet parity
- Selection preserved for the recovery screen

Entry: `vaayvuEvent({ type: 'providerSwitcher' })`,
`window.__vaayvuProviderSwitcherPrompt()`, or `__vaayvuOnboardingOpen('s-342')`.

## Screen `s-343` — private search no-leak state (private, phase p05)

Route `vaayvu://private/s-343`, phase `p05`, category **private**,
priority **next**, gate `privateSearch`.

- Ephemeral private window
- Local-only suggestions by default; remote needs separate consent
- Regular history never read or written
- Start private query continues to S-340

Entry: `vaayvuEvent({ type: 'privateSearch' })`,
`window.__vaayvuPrivateSearchPrompt()`, or `__vaayvuOnboardingOpen('s-343')`.

## Screen `s-344` — custom blocked domains editor (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-344`, phase `p08`, category
**security-privacy**, priority **core**, gate `blockedDomains`.

- One bare host per line; IDNA-lowercase and trailing dot normalized
- Duplicates removed; URLs, ports, wildcards and public suffixes rejected
- Canonical-name preview before save
- One invalid line blocks the whole save; previous rules stay active
- Save installs atomically; cancel leaves the generation unchanged

Entry: `vaayvuEvent({ type: 'blockedDomains' })`,
`window.__vaayvuBlockedDomainsPrompt()`, or `__vaayvuOnboardingOpen('s-344')`.

## Screen `s-345` — domain validation errors (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-345`, phase `p08`, category
**security-privacy**, priority **core**, gate `domainErrors`.

- Exact line and reason for each invalid entry
- Draft text retained; previous generation still active
- No partial application
- Correct lines link back to S-344

Entry: `vaayvuEvent({ type: 'domainErrors' })`,
`window.__vaayvuDomainErrorsPrompt()`, or `__vaayvuOnboardingOpen('s-345')`.

## Screen `s-346` — applying protection rules (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-346`, phase `p08`, category
**security-privacy**, priority **core**, gate `applyRules`.

- Compile a new generation in a bounded background task
- Verify signature schema and fixture manifest
- Install through the native adapter; await complete acknowledgment
- Promote the generation only after ack; last good stays effective on failure
- Late acknowledgments for older attempts cannot become current

Entry: `vaayvuEvent({ type: 'applyRules' })`,
`window.__vaayvuApplyRulesPrompt()`, or `__vaayvuOnboardingOpen('s-346')`.

## Screen `s-347` — protection update failure (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-347`, phase `p08`, category
**security-privacy**, priority **core**, gate `updateFailure`.

- Failure stage and last successful generation
- Last successful update timestamp never refreshed by failure
- Browsing continues under the last working rules
- Bounded retry; diagnostics redact URL paths and query values

Entry: `vaayvuEvent({ type: 'updateFailure' })`,
`window.__vaayvuUpdateFailurePrompt()`, or `__vaayvuOnboardingOpen('s-347')`.

## Screen `s-348` — site pause manager (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-348`, phase `p08`, category
**security-privacy**, priority **core**, gate `sitePauses`.

- Exact-host category pauses with expiry
- Malware and custom domain blocks always active
- Remove a pause; new generation applies (S-346)
- Other pauses and blocks unchanged

Entry: `vaayvuEvent({ type: 'sitePauses' })`,
`window.__vaayvuSitePausesPrompt()`, or `__vaayvuOnboardingOpen('s-348')`.

## Screen `s-349` — custom domain blocked page (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-349`, phase `p08`, category
**security-privacy**, priority **core**, gate `blockedPage`.

- Trusted local interstitial, not rendered by the blocked site
- Requested host and exact matched custom rule
- Scope: host and subdomains; unrelated similar domains unaffected
- Manage blocked domains (S-344), back to safe page, or start page

Entry: `vaayvuEvent({ type: 'blockedPage' })`,
`window.__vaayvuBlockedPagePrompt()`, or `__vaayvuOnboardingOpen('s-349')`.

## Screen `s-350` — Rasha rule collection details (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-350`, phase `p08`, category
**security-privacy**, priority **core**, gate `ruleCollection`.

- Original Rasha category, VAAYVU provenance and authors
- Version, generation and verified update time
- Capability: network and cosmetic matching with exact/subdomain scope
- Review evidence with fixture results and explicit unsupported semantics
- Research intake link (S-396)

Entry: `vaayvuEvent({ type: 'ruleCollection' })`,
`window.__vaayvuRuleCollectionPrompt()`, or `__vaayvuOnboardingOpen('s-350')`.

## Screen `s-351` — local blocking diagnostics (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-351`, phase `p08`, category
**security-privacy**, priority **core**, gate `blockDiagnostics`.

- Observed block reasons with timestamps and redacted hosts
- Aggregate counters shown unavailable when the engine does not expose them
- Unknown attribution labelled unknown, never counted as blocked
- Return to site protection (S-166)

Entry: `vaayvuEvent({ type: 'blockDiagnostics' })`,
`window.__vaayvuBlockDiagnosticsPrompt()`, or `__vaayvuOnboardingOpen('s-351')`.

## Screen `s-352` — reset ad blocker confirmation (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-352`, phase `p08`, category
**security-privacy**, priority **core**, gate `resetBlocker`.

- Independent reset scope: categories, custom domains, site pauses
- Unselected items preserved; malware protection always retained
- Confirm applies a new generation (S-346); cancel changes nothing

Entry: `vaayvuEvent({ type: 'resetBlocker' })`,
`window.__vaayvuResetBlockerPrompt()`, or `__vaayvuOnboardingOpen('s-352')`.

## Screen `s-353` — discard unsaved blocker changes (security-privacy, phase p08)

Route `vaayvu://security-privacy/s-353`, phase `p08`, category
**security-privacy**, priority **core**, gate `discardBlockerDraft`.

- Draft retained; closing never silently saves or discards
- Continue editing preserves every typed line
- Discard requires explicit confirmation and affects only the draft
- Active generation remains unchanged

Entry: `vaayvuEvent({ type: 'discardBlockerDraft' })`,
`window.__vaayvuDiscardBlockerDraftPrompt()`, or `__vaayvuOnboardingOpen('s-353')`.

## Screen `s-354` — resource budget center (resources, phase p18)

Route `vaayvu://resources/s-354`, phase `p18`, category **resources**,
priority **required**, gate `resourceBudget`.

- Device capacity and OS pressure; soft/hard targets are not guarantees
- Measured process-tree usage separate from the target
- Shared renderer memory counted once; two tabs never both report it in full
- Measurement source/time shown; unavailable GPU metric labelled unavailable
- Edit budgets (S-355) and timeline (S-356)

Entry: `vaayvuEvent({ type: 'resourceBudget' })`,
`window.__vaayvuResourceBudgetPrompt()`, or `__vaayvuOnboardingOpen('s-354')`.

## Screen `s-355` — device memory budget editor (resources, phase p18)

Route `vaayvu://resources/s-355`, phase `p18`, category **resources**,
priority **required**, gate `memoryBudgetEditor`.

- Physical RAM with reserve and soft/hard thresholds
- Validation: hard > soft, reserve < soft
- Preview before commit; invalid values keep the last policy
- Atomic commit of only supported values

Entry: `vaayvuEvent({ type: 'memoryBudgetEditor' })`,
`window.__vaayvuMemoryBudgetEditorPrompt()`, or `__vaayvuOnboardingOpen('s-355')`.

## Screen `s-356` — memory pressure timeline (resources, phase p18)

Route `vaayvu://resources/s-356`, phase `p18`, category **resources**,
priority **required**, gate `pressureTimeline`.

- Pressure tier changes with recovery dwell and hysteresis
- Bounded timestamped samples and actual process totals
- Native PSS unavailable is labelled, never replaced by an estimate
- Alternating spikes do not cause discard loops
- Repeated cycles compared after warm-up; transient GC spike not a leak

Entry: `vaayvuEvent({ type: 'pressureTimeline' })`,
`window.__vaayvuPressureTimelinePrompt()`, or `__vaayvuOnboardingOpen('s-356')`.

## Screen `s-357` — critical workload leases (resources, phase p18)

Route `vaayvu://resources/s-357`, phase `p18`, category **resources**,
priority **required**, gate `workloadLeases`.

- Automatic leases for calls, recording, uploads, audible media, unsaved edits
- Detection limits disclosed; unknown state favors preservation
- Explicit pins have no expiry until removed
- Ended activity releases its lease; closing a tab invalidates only its lease

Entry: `vaayvuEvent({ type: 'workloadLeases' })`,
`window.__vaayvuWorkloadLeasesPrompt()`, or `__vaayvuOnboardingOpen('s-357')`.

## Screen `s-358` — reclaim impact preview (resources, phase p18)

Route `vaayvu://resources/s-358`, phase `p18`, category **resources**,
priority **required**, gate `reclaimPreview`.

- Background candidates ranked by recency, pressure and recoverability
- Estimated savings clearly labelled as estimates
- Pinned forms and private tabs excluded regardless of size
- Caches trimmed before renderer discard; isolation never weakened
- Preview before apply; cancel discards nothing

Entry: `vaayvuEvent({ type: 'reclaimPreview' })`,
`window.__vaayvuReclaimPreviewPrompt()`, or `__vaayvuOnboardingOpen('s-358')`.

## Screen `s-359` — resource recovery state (resources, phase p18)

Route `vaayvu://resources/s-359`, phase `p18`, category **resources**,
priority **required**, gate `resourceRecovery`.

- Failed reclaim stage and remaining pressure
- Tab ID, URL and safe metadata preserved; page JS state not claimed after OS kill
- Retry or resume; reload explained where required
- Last known-good thresholds restored when a commit is rejected
- Disk-full commit cannot silently reset configuration

Entry: `vaayvuEvent({ type: 'resourceRecovery' })`,
`window.__vaayvuResourceRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-359')`.

## Screen `s-360` — lifecycle policy details (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-360`, phase `p18`, category **lifecycle**,
priority **required**, gate `lifecyclePolicy`.

- Typed states: active, throttled, frozen, discarded, restoring, failed
- Frozen never shown after renderer destruction
- Selected tab restored first; obsolete resume work cancelled
- Freeze/discard delays and restore concurrency displayed
- Stale content cannot become the active origin

Entry: `vaayvuEvent({ type: 'lifecyclePolicy' })`,
`window.__vaayvuLifecyclePolicyPrompt()`, or `__vaayvuOnboardingOpen('s-360')`.

## Screen `s-361` — tab preservation rules (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-361`, phase `p18`, category **lifecycle**,
priority **required**, gate `preservationRules`.

- Per-tab/site exemption with visible scope and activity reason
- Keep until close or timed expiry; expiry removes the override
- Live playback preserved only where the engine allows; eviction restarts it
- Partial uploads not treated as resumable without evidence
- No promise to keep all video decoders alive under OS eviction

Entry: `vaayvuEvent({ type: 'preservationRules' })`,
`window.__vaayvuPreservationRulesPrompt()`, or `__vaayvuOnboardingOpen('s-361')`.

## Screen `s-362` — tab state snapshot review (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-362`, phase `p18`, category **lifecycle**,
priority **required**, gate `snapshotReview`.

- Restorable metadata: URL, title, scroll/reader location, stable IDs
- Password fields, private tabs and cookies excluded
- Snapshot consent control
- Checksum and schema validation; tampered snapshot quarantined, never executed
- Origin-bound metadata only

Entry: `vaayvuEvent({ type: 'snapshotReview' })`,
`window.__vaayvuSnapshotReviewPrompt()`, or `__vaayvuOnboardingOpen('s-362')`.

## Screen `s-363` — suspension decision explanation (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-363`, phase `p18`, category **lifecycle**,
priority **required**, gate `suspensionReason`.

- Distinct reasons: memory pressure, inactivity, manual sleep, OS eviction
- Elapsed suspended time and current state
- Unknown OS eviction never attributed to a user action
- Resume now or keep active

Entry: `vaayvuEvent({ type: 'suspensionReason' })`,
`window.__vaayvuSuspensionReasonPrompt()`, or `__vaayvuOnboardingOpen('s-363')`.

## Screen `s-364` — resume progress (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-364`, phase `p18`, category **lifecycle**,
priority **required**, gate `resumeProgress`.

- Warm resume/reload label and progress
- p50/p95 timing measured only at interactive content
- Selected tab first; limited restore concurrency; no 100-tab startup burst
- URL retained on offline/DNS failure; retry never navigates elsewhere
- Cancel leaves the tab suspended with its URL

Entry: `vaayvuEvent({ type: 'resumeProgress' })`,
`window.__vaayvuResumeProgressPrompt()`, or `__vaayvuOnboardingOpen('s-364')`.

## Screen `s-365` — restore divergence review (lifecycle, phase p18)

Route `vaayvu://lifecycle/s-365`, phase `p18`, category **lifecycle**,
priority **required**, gate `restoreDivergence`.

- Snapshot origin vs committed origin
- Cross-origin scroll/form/reader metadata dropped, never injected
- Keep only tab ID and safe session metadata
- Reload, dismiss, or replay committed events idempotently
- No duplicate tabs; active selection preserved

Entry: `vaayvuEvent({ type: 'restoreDivergence' })`,
`window.__vaayvuRestoreDivergencePrompt()`, or `__vaayvuOnboardingOpen('s-365')`.

## Screen `s-366` — compute workload center (compute, phase p18)

Route `vaayvu://compute/s-366`, phase `p18`, category **compute**,
priority **required**, gate `computeCenter`.

- Process groups: browser, renderer, GPU, utility, network
- Shared renderer CPU counted once; no per-tab summation
- Native scheduling favors interactive tab within bounds
- No process-wide boost that starves OS/security services
- Background task inspector link (S-367)

Entry: `vaayvuEvent({ type: 'computeCenter' })`,
`window.__vaayvuComputeCenterPrompt()`, or `__vaayvuOnboardingOpen('s-366')`.

## Screen `s-367` — background task inspector (compute, phase p18)

Route `vaayvu://compute/s-367`, phase `p18`, category **compute**,
priority **required**, gate `backgroundTasks`.

- Timer and worker attribution with last activity
- Unknown attribution shown as unknown, never zero
- Hidden-document throttling; audio/calls exempt
- App-owned sampling stops when the inspector closes

Entry: `vaayvuEvent({ type: 'backgroundTasks' })`,
`window.__vaayvuBackgroundTasksPrompt()`, or `__vaayvuOnboardingOpen('s-367')`.

## Screen `s-368` — rendering quality controls (compute, phase p18)

Route `vaayvu://compute/s-368`, phase `p18`, category **compute**,
priority **required**, gate `renderingQuality`.

- Hardware acceleration status; restart indicated when required
- Expensive blur/glass toggled, automatically disabled by high contrast or reduced transparency
- Compatibility overrides respect the engine blacklist
- No unsafe driver flags, no isolation weakening; reduced motion wins

Entry: `vaayvuEvent({ type: 'renderingQuality' })`,
`window.__vaayvuRenderingQualityPrompt()`, or `__vaayvuOnboardingOpen('s-368')`.

## Screen `s-369` — frame pacing report (compute, phase p18)

Route `vaayvu://compute/s-369`, phase `p18`, category **compute**,
priority **required**, gate `framePacing`.

- Display refresh capability distinct from measured page frame rate
- Controlled interaction measures frames and dropped frames
- Click-to-response measured separately for chrome and content
- Content latency not claimed as browser overhead

Entry: `vaayvuEvent({ type: 'framePacing' })`,
`window.__vaayvuFramePacingPrompt()`, or `__vaayvuOnboardingOpen('s-369')`.

## Screen `s-370` — graphics fallback notice (compute, phase p18)

Route `vaayvu://compute/s-370`, phase `p18`, category **compute**,
priority **required**, gate `graphicsFallback`.

- GPU reset or unavailable accelerator with fallback reason
- Supported rendering context recreated; navigation and session preserved
- Affected GPU feature recorded (e.g. hardware video decode)
- Engine blacklist and safety restrictions retained; no benchmark bypass
- Repeated failures enter a warned safe software fallback

Entry: `vaayvuEvent({ type: 'graphicsFallback' })`,
`window.__vaayvuGraphicsFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-370')`.

## Screen `s-371` — workload priority editor (compute, phase p18)

Route `vaayvu://compute/s-371`, phase `p18`, category **compute**,
priority **required**, gate `workloadPriority`.

- Active work tab and allowed background work
- Bounded temporary priority (15/30/60 min); expiry restores policy
- Cancels stale thumbnail/index work; it cannot touch the replacement document
- Save affects only this tab, not unrelated tabs

Entry: `vaayvuEvent({ type: 'workloadPriority' })`,
`window.__vaayvuWorkloadPriorityPrompt()`, or `__vaayvuOnboardingOpen('s-371')`.

## Screen `s-372` — energy profile center (energy, phase p18)

Route `vaayvu://energy/s-372`, phase `p18`, category **energy**,
priority **required**, gate `energyCenter`.

- Power state and thermal status where supported
- Measured drain distinct from model estimate
- Unsupported sensors labelled unavailable (no fictional battery percentage)
- Policy switch reduces polling/effects without layout jumps
- Focus and selected tab unchanged; security checks remain functional

Entry: `vaayvuEvent({ type: 'energyCenter' })`,
`window.__vaayvuEnergyCenterPrompt()`, or `__vaayvuOnboardingOpen('s-372')`.

## Screen `s-373` — power schedule editor (energy, phase p18)

Route `vaayvu://energy/s-373`, phase `p18`, category **energy**,
priority **required**, gate `powerSchedule`.

- Enter/exit battery thresholds with hysteresis
- Charging behaviour avoids saver above 50%
- Deferred thumbnail/index work resumes safely
- Invalid threshold pair leaves the previous schedule unchanged
- Manual override available from the profile

Entry: `vaayvuEvent({ type: 'powerSchedule' })`,
`window.__vaayvuPowerSchedulePrompt()`, or `__vaayvuOnboardingOpen('s-373')`.

## Screen `s-374` — energy intensive tab detail (energy, phase p18)

Route `vaayvu://energy/s-374`, phase `p18`, category **energy**,
priority **required**, gate `energyTab`.

- Observed CPU/GPU proxies with time range and limits
- Hardware decode and dropped-frame monitoring
- CPU percentage not converted into exact battery savings
- Mitigation reduces background work only; resolution never silently lowered

Entry: `vaayvuEvent({ type: 'energyTab' })`,
`window.__vaayvuEnergyTabPrompt()`, or `__vaayvuOnboardingOpen('s-374')`.

## Screen `s-375` — thermal mitigation notice (energy, phase p18)

Route `vaayvu://energy/s-375`, phase `p18`, category **energy**,
priority **required**, gate `thermalNotice`.

- Thermal tier with hysteresis
- Mitigations limited to blur, polling and optional work
- Active call/recording protected from cosmetic policy
- Sensor oscillation suppressed; no renderer surface recreation
- Gradual restore after recovery

Entry: `vaayvuEvent({ type: 'thermalNotice' })`,
`window.__vaayvuThermalNoticePrompt()`, or `__vaayvuOnboardingOpen('s-375')`.

## Screen `s-376` — battery exception manager (energy, phase p18)

Route `vaayvu://energy/s-376`, phase `p18`, category **energy**,
priority **required**, gate `batteryExceptionsManager`.

- Temporary scoped exceptions for live activity, with expiry
- Calls/media protected even without exceptions
- Exceptions never disable certificate checks or network safety
- Noncritical notifications mutable; safety-critical always shown

Entry: `vaayvuEvent({ type: 'batteryExceptionsManager' })`,
`window.__vaayvuBatteryExceptionsManagerPrompt()`, or `__vaayvuOnboardingOpen('s-376')`.

## Screen `s-377` — energy benchmark result (energy, phase p18)

Route `vaayvu://energy/s-377`, phase `p18`, category **energy**,
priority **required**, gate `energyBenchmark`.

- Measured proxy with uncertainty, duration and repetitions
- Conditions recorded: brightness, quality, network, workload, ambient, OS updates
- Mismatched conditions refused as separate runs, never ranked
- Baseline export contains raw conditions and samples only

Entry: `vaayvuEvent({ type: 'energyBenchmark' })`,
`window.__vaayvuEnergyBenchmarkPrompt()`, or `__vaayvuOnboardingOpen('s-377')`.

## Screen `s-378` — connection health overview (transport, phase p19)

Route `vaayvu://transport/s-378`, phase `p19`, category **transport**,
priority **required**, gate `connectionHealth`.

- Engine-reported HTTP/2, HTTP/3/QUIC support and connectivity
- DNS mode and cache policy
- Connection pooling isolated per profile/privacy partition
- Unavailable protocols never shown as active
- Diagnostics export link (S-383)

Entry: `vaayvuEvent({ type: 'connectionHealth' })`,
`window.__vaayvuConnectionHealthPrompt()`, or `__vaayvuOnboardingOpen('s-378')`.

## Screen `s-379` — per-origin connection inspector (transport, phase p19)

Route `vaayvu://transport/s-379`, phase `p19`, category **transport**,
priority **required**, gate `perOriginConnection`.

- Committed origin with HTTP version and TLS status
- Response source distinguishes network, HTTP cache, service worker, unknown
- Connection reuse where available
- Engine facts only; page text cannot spoof the inspector
- Cached response not evidence of a new network request

Entry: `vaayvuEvent({ type: 'perOriginConnection' })`,
`window.__vaayvuPerOriginConnectionPrompt()`, or `__vaayvuOnboardingOpen('s-379')`.

## Screen `s-380` — speculative loading controls (transport, phase p19)

Route `vaayvu://transport/s-380`, phase `p19`, category **transport**,
priority **required**, gate `speculativeLoading`.

- Preconnect limited to same origin and bounded concurrency
- Prefetch with byte budget; deferred on metered unless security needs
- Strict privacy/private mode disables cross-origin speculation
- Typing alone never contacts a provider
- No ornamental remote requests; user downloads never interrupted

Entry: `vaayvuEvent({ type: 'speculativeLoading' })`,
`window.__vaayvuSpeculativeLoadingPrompt()`, or `__vaayvuOnboardingOpen('s-380')`.

## Screen `s-381` — network retry state (transport, phase p19)

Route `vaayvu://transport/s-381`, phase `p19`, category **transport**,
priority **required**, gate `networkRetry`.

- Offline, timeout, DNS and certificate states distinguished
- Query and origin retained; idempotent GET retry only
- Certificate failure never downgraded to HTTP
- POST/payment forms never automatically replayed
- Cancel retains the query

Entry: `vaayvuEvent({ type: 'networkRetry' })`,
`window.__vaayvuNetworkRetryPrompt()`, or `__vaayvuOnboardingOpen('s-381')`.

## Screen `s-382` — encrypted DNS configuration (transport, phase p19)

Route `vaayvu://transport/s-382`, phase `p19`, category **transport**,
priority **required**, gate `encryptedDns`.

- DoH provider and exact endpoint disclosed
- Effective encryption verified by test; unknown labelled unknown
- Malformed endpoint rejected; previous resolver config retained
- Test required before apply; fallback policy shown first

Entry: `vaayvuEvent({ type: 'encryptedDns' })`,
`window.__vaayvuEncryptedDnsPrompt()`, or `__vaayvuOnboardingOpen('s-382')`.

## Screen `s-383` — connection diagnostics export (transport, phase p19)

Route `vaayvu://transport/s-383`, phase `p19`, category **transport**,
priority **required**, gate `diagnosticsExport`.

- Cold/warm DNS, connect, TLS and TTFB with matched conditions
- Failure categories counted separately
- Redaction preview removes credentials, cookies, query strings and page content
- Private-session traces excluded
- External latency not attributed to engine performance

Entry: `vaayvuEvent({ type: 'diagnosticsExport' })`,
`window.__vaayvuDiagnosticsExportPrompt()`, or `__vaayvuOnboardingOpen('s-383')`.

## Screen `s-384` — storage breakdown center (storage, phase p19)

Route `vaayvu://storage/s-384`, phase `p19`, category **storage**,
priority **required**, gate `storageBreakdown`.

- Measured cache, site data, downloads metadata, snapshots, indexes
- External downloaded files excluded from disposable cache
- Per-profile usage; shared storage marked unknown
- Bounded rescan; no per-refresh walk of every site directory
- Reclaim preview (S-387)

Entry: `vaayvuEvent({ type: 'storageBreakdown' })`,
`window.__vaayvuStorageBreakdownPrompt()`, or `__vaayvuOnboardingOpen('s-384')`.

## Screen `s-385` — per-origin quota detail (storage, phase p19)

Route `vaayvu://storage/s-385`, phase `p19`, category **storage**,
priority **required**, gate `quotaDetail`.

- Origin and container partition with measured usage
- Same-domain accounts in separate containers keep separate usage
- Quota exhaustion preserves browser metadata
- Cleanup scoped to this origin/container only

Entry: `vaayvuEvent({ type: 'quotaDetail' })`,
`window.__vaayvuQuotaDetailPrompt()`, or `__vaayvuOnboardingOpen('s-385')`.

## Screen `s-386` — cache policy editor (storage, phase p19)

Route `vaayvu://storage/s-386`, phase `p19`, category **storage**,
priority **required**, gate `cachePolicy`.

- Bounded soft cache budget and retention
- Stale, unreferenced app-owned cache evicted first
- Pinned offline data and user files never treated as cache
- Unsupported engine controls disabled, not simulated
- Preview before saving

Entry: `vaayvuEvent({ type: 'cachePolicy' })`,
`window.__vaayvuCachePolicyPrompt()`, or `__vaayvuOnboardingOpen('s-386')`.

## Screen `s-387` — storage reclaim preview (storage, phase p19)

Route `vaayvu://storage/s-387`, phase `p19`, category **storage**,
priority **required**, gate `storageReclaim`.

- Selected categories with exact sizes
- Affected sign-ins listed per origin
- Confirm or cancel; cancel leaves all selected data intact
- Partial failure names exactly which categories were not cleared

Entry: `vaayvuEvent({ type: 'storageReclaim' })`,
`window.__vaayvuStorageReclaimPrompt()`, or `__vaayvuOnboardingOpen('s-387')`.

## Screen `s-388` — disk pressure safe state (storage, phase p19)

Route `vaayvu://storage/s-388`, phase `p19`, category **storage**,
priority **required**, gate `diskPressure`.

- Failed transaction surfaces read-only state
- Last committed configuration preserved
- No false “Saved” after write failure
- Export to available storage copies only; source kept
- Cancel removes nothing

Entry: `vaayvuEvent({ type: 'diskPressure' })`,
`window.__vaayvuDiskPressurePrompt()`, or `__vaayvuOnboardingOpen('s-388')`.

## Screen `s-389` — storage integrity report (storage, phase p19)

Route `vaayvu://storage/s-389`, phase `p19`, category **storage**,
priority **required**, gate `integrityReport`.

- Manifest references, checksums and schema verified
- Unattached app files listed, never auto-cleaned
- Corrupt new database refused; previous version remains recoverable
- Last verified maintenance timestamp

Entry: `vaayvuEvent({ type: 'integrityReport' })`,
`window.__vaayvuIntegrityReportPrompt()`, or `__vaayvuOnboardingOpen('s-389')`.

## Screen `s-390` — Rasha engine health (rasha, phase p20)

Route `vaayvu://rasha/s-390`, phase `p20`, category **rasha**,
priority **required**, gate `rashaHealth`.

- Active generation, hash, compiler version and freshness
- Authored/reviewed rule counts; no external blocking engine
- Unsupported semantics listed, never approximated
- Deterministic compile: same inputs → same hash
- Unattributed rules quarantined, none active
- Bounded compile for pathological patterns

Entry: `vaayvuEvent({ type: 'rashaHealth' })`,
`window.__vaayvuRashaHealthPrompt()`, or `__vaayvuOnboardingOpen('s-390')`.

## Screen `s-391` — Rasha rule inspection (rasha, phase p20)

Route `vaayvu://rasha/s-391`, phase `p20`, category **rasha**,
priority **required**, gate `ruleInspection`.

- Rule ID, category, scope and provenance
- Matching only by exact host or dot-boundary descendants
- `notexample.com` and `example.com.evil.test` never match `example.com`
- Missing context cannot broaden a rule; private policy doesn't mutate generation

Entry: `vaayvuEvent({ type: 'ruleInspection' })`,
`window.__vaayvuRuleInspectionPrompt()`, or `__vaayvuOnboardingOpen('s-391')`.

## Screen `s-392` — Rasha selector editor (rasha, phase p20)

Route `vaayvu://rasha/s-392`, phase `p20`, category **rasha**,
priority **required**, gate `selectorEditor`.

- Scoped selector preview for one site
- Saves the original CSS rule bound to approved scope
- Refuses selectors targeting every dialog or critical login/payment forms
- Disable removes only Rasha-owned styles; consent and site storage untouched

Entry: `vaayvuEvent({ type: 'selectorEditor' })`,
`window.__vaayvuSelectorEditorPrompt()`, or `__vaayvuOnboardingOpen('s-392')`.

## Screen `s-393` — Rasha rule conflict review (rasha, phase p20)

Route `vaayvu://rasha/s-393`, phase `p20`, category **rasha**,
priority **required**, gate `ruleConflict`.

- Overlapping categories with deterministic precedence
- Ads pause cannot permit a tracking-blocked request
- Threat and custom blocks remain mandatory during category pauses
- Exception scope limited to exact host and selected category

Entry: `vaayvuEvent({ type: 'ruleConflict' })`,
`window.__vaayvuRuleConflictPrompt()`, or `__vaayvuOnboardingOpen('s-393')`.

## Screen `s-394` — Rasha generation comparison (rasha, phase p20)

Route `vaayvu://rasha/s-394`, phase `p20`, category **rasha**,
priority **required**, gate `generationCompare`.

- Candidate vs active generation and rule counts
- Synthetic fixture server logs prove blocked requests never arrive
- Unsupported redirect/worker interception reported, never broadened
- Cosmetic hides counted separately from network prevention

Entry: `vaayvuEvent({ type: 'generationCompare' })`,
`window.__vaayvuGenerationComparePrompt()`, or `__vaayvuOnboardingOpen('s-394')`.

## Screen `s-395` — Rasha quarantine and rollback (rasha, phase p20)

Route `vaayvu://rasha/s-395`, phase `p20`, category **rasha**,
priority **required**, gate `quarantineRollback`.

- Failed/signature-rejected generation quarantined
- Last known-good generation retained and active
- Each observed block counted once; cosmetic events separate; unknown not counted
- Retry candidate staged; rollback verified without touching engine safety

Entry: `vaayvuEvent({ type: 'quarantineRollback' })`,
`window.__vaayvuQuarantineRollbackPrompt()`, or `__vaayvuOnboardingOpen('s-395')`.

## Screen `s-396` — Rasha research intake (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-396`, phase `p20`, category
**rasha-research**, priority **required**, gate `researchIntake`.

- Public synthetic fixture and independently observed behaviour
- Host redacted to registrable domain; path/query and cookies removed
- Author and category recorded
- Private sessions excluded by default
- Report preview required before optional transmission
- Competitor lists and browsing histories never accepted

Entry: `vaayvuEvent({ type: 'researchIntake' })`,
`window.__vaayvuResearchIntakePrompt()`, or `__vaayvuOnboardingOpen('s-396')`.

## Screen `s-397` — rule candidate review (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-397`, phase `p20`, category
**rasha-research**, priority **required**, gate `candidateReview`.

- Original rule, supporting observation and expected behaviour
- Independent review required for broad/threat/exception rules
- Temporary exceptions need reason, owner and expiry
- Language/region metadata from reviewed local fixtures only
- Unreviewed candidate cannot enter production; no copied lists or tracking

Entry: `vaayvuEvent({ type: 'candidateReview' })`,
`window.__vaayvuCandidateReviewPrompt()`, or `__vaayvuOnboardingOpen('s-397')`.

## Screen `s-398` — coverage corpus dashboard (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-398`, phase `p20`, category
**rasha-research**, priority **required**, gate `coverageCorpus`.

- Regions, locales and resource kinds covered
- Pinned HTML and server logs for repeatability
- Ordinary-page fixtures required alongside blocked resources
- Unversioned live sites never the sole evidence
- Reviewed source provenance only

Entry: `vaayvuEvent({ type: 'coverageCorpus' })`,
`window.__vaayvuCoverageCorpusPrompt()`, or `__vaayvuOnboardingOpen('s-398')`.

## Screen `s-399` — compatibility triage (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-399`, phase `p20`, category
**rasha-research**, priority **required**, gate `compatibilityTriage`.

- Classify login/payment/media/accessibility failures
- Minimal scoped correction tied to category and context
- Aesthetic cleanup cannot override functional regressions
- Broad allow-all refused; other protections intact
- Rerun verifies the regression is fixed

Entry: `vaayvuEvent({ type: 'compatibilityTriage' })`,
`window.__vaayvuCompatibilityTriagePrompt()`, or `__vaayvuOnboardingOpen('s-399')`.

## Screen `s-400` — release signing review (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-400`, phase `p20`, category
**rasha-research**, priority **required**, gate `signingReview`.

- Manifest and build hash; established signing key
- Tampered hash, downgrade or wrong key rejected
- Reviewer approval audited before staging
- Staged rollout with aggregate, redacted stability signals
- Pause on regression; previous generation remains active
- No browsing history or page content collected

Entry: `vaayvuEvent({ type: 'signingReview' })`,
`window.__vaayvuSigningReviewPrompt()`, or `__vaayvuOnboardingOpen('s-400')`.

## Screen `s-401` — faulty rule containment (rasha-research, phase p20)

Route `vaayvu://rasha-research/s-401`, phase `p20`, category
**rasha-research**, priority **required**, gate `faultContainment`.

- Faulty rule quarantined; impacted generation identified
- Signed known-good generation retained for authorized rollback
- Precision/recall on labeled corpus, false positives and matcher cost
- Rollback leaves engine security and user custom rules intact
- No universal claims from a single test page

Entry: `vaayvuEvent({ type: 'faultContainment' })`,
`window.__vaayvuFaultContainmentPrompt()`, or `__vaayvuOnboardingOpen('s-401')`.

## Screen `s-402` — privacy partition overview (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-402`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `privacyPartition`.

- Cookies and adapter-backed storage partitioned by top-level context
- Ephemeral third-party storage with honest lifecycle and retention notes
- Context-aware, time-limited storage access grants; cleanup rules per host
- Guest context independent and disposable where supported
- Unsupported storage kinds labelled unavailable, never assumed isolated
- Fixture test: two unrelated sites get distinct keys for the same embed
- Guest test: regular bookmarks are not exposed by default

Entry: `vaayvuEvent({ type: 'privacyPartition' })`,
`window.__vaayvuPrivacyPartitionPrompt()`, or `__vaayvuOnboardingOpen('s-402')`.

## Screen `s-403` — partition detail inspector (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-403`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `partitionDetail`.

- Top-level site key and storage kinds with partitioned/blocked/unknown labels
- Third-party access grants with expiry
- Key bound to engine origin, profile and container identifiers
- Unsupported kinds (e.g. IndexedDB) reported unavailable, never assumed
- Space labels are display metadata only and cannot create isolation

Entry: `vaayvuEvent({ type: 'partitionDetail' })`,
`window.__vaayvuPartitionDetailPrompt()`, or `__vaayvuOnboardingOpen('s-403')`.

## Screen `s-404` — storage access grant review (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-404`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `storageGrant`.

- Requesting frame and committed top-level origin shown together
- Supported API grants require context-aware user approval
- Session-only duration; persistent expansion refused
- Revocation clears the grant and shows the reload requirement
- Changed top-level origin invalidates prior approval; unrelated frames inherit nothing

Entry: `vaayvuEvent({ type: 'storageGrant' })`,
`window.__vaayvuStorageGrantPrompt()`, or `__vaayvuOnboardingOpen('s-404')`.

## Screen `s-405` — automatic site cleanup rule editor (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-405`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `cleanupRule`.

- Explicit opt-in per exact host for selected data categories on tab close
- Scope line states parent/subdomain exclusion plainly
- Preview names the categories and warns when active tabs share the storage
- Field-specific errors: missing host, wildcard/path/space, no category
- Whole registrable-domain removal refused under an exact-host label
- Unrelated origins preserved

Entry: `vaayvuEvent({ type: 'cleanupRule' })`,
`window.__vaayvuCleanupRulePrompt()`, or `__vaayvuOnboardingOpen('s-405')`.

## Screen `s-406` — selective cleanup result (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-406`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `cleanupResult`.

- Per-category deletion outcomes with adapter-reported failure
- Partial success stated as partial; no full-success claim after a rejection
- Retry only failed operations
- Sign-out consequence limited to the cleaned host
- Downloads retained and disclosed
- Private context cleared on last close; no physical secure-erase claim

Entry: `vaayvuEvent({ type: 'cleanupResult' })`,
`window.__vaayvuCleanupResultPrompt()`, or `__vaayvuOnboardingOpen('s-406')`.

## Screen `s-407` — private leakage audit (privacy-boundaries, phase p20)

Route `vaayvu://privacy-boundaries/s-407`, phase `p20`, category
**privacy-boundaries**, priority **required**, gate `leakageAudit`.

- Sentinel audit for cookies, history, suggestions, crash journal, logs and sync
- Independent login fixtures per supported partition
- Any private sentinel in regular persistence blocks release
- Shared engine process explicitly does not imply shared cookies
- Export restricted to redacted results; sentinel values never included

Entry: `vaayvuEvent({ type: 'leakageAudit' })`,
`window.__vaayvuLeakageAuditPrompt()`, or `__vaayvuOnboardingOpen('s-407')`.

## Screen `s-408` — fingerprint protection controls (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-408`, phase `p20`, category **fingerprint**,
priority **required**, gate `fingerprintControls`.

- Supported protections grouped by API family (canvas, audio, GPU, fonts, hardware hints)
- Standard and stronger reviewed policy modes; no injected scripts
- User-selected language and text rendering preserved
- Known-tracker bounce protection and GPC signal available
- Unsupported APIs listed as unavailable rather than faked

Entry: `vaayvuEvent({ type: 'fingerprintControls' })`,
`window.__vaayvuFingerprintControlsPrompt()`, or `__vaayvuOnboardingOpen('s-408')`.

## Screen `s-409` — API exposure detail (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-409`, phase `p20`, category **fingerprint**,
priority **required**, gate `apiExposure`.

- Canvas, audio, fonts, languages, WebGL/WebGPU and hardware hints listed per surface
- Reviewed normalization or site-scoped variation where supported
- Renderer/driver fields reduced through supported upstream hooks
- Repeated calls stay coherent within a site
- Graphics compatibility fixtures run; no fabricated benchmark numbers
- User language and text rendering preserved; unsupported hooks labeled

Entry: `vaayvuEvent({ type: 'apiExposure' })`,
`window.__vaayvuApiExposurePrompt()`, or `__vaayvuOnboardingOpen('s-409')`.

## Screen `s-410` — tracking redirect inspector (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-410`, phase `p20`, category **fingerprint**,
priority **required**, gate `redirectInspector`.

- Observed redirect hops and reviewed tracking-parameter classification
- Cleanup removes known tracking parameters only, under safe context rules
- Signed URLs, authentication, payment and unknown parameters preserved
- Identity-provider and payment redirects never rewritten
- No extra DNS lookup to validate user-entered blocked domains; alias limits disclosed

Entry: `vaayvuEvent({ type: 'redirectInspector' })`,
`window.__vaayvuRedirectInspectorPrompt()`, or `__vaayvuOnboardingOpen('s-410')`.

## Screen `s-411` — scoped privacy exception editor (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-411`, phase `p20`, category **fingerprint**,
priority **required**, gate `privacyException`.

- Exact origin plus one protection category
- Temporary lifetime (24 hours) with compatibility warning
- Sandbox, certificate validation and Rasha threat blocks cannot be disabled
- GPC exposed under user policy without asserting legal effect or site honoring
- Field-specific origin validation (no scheme, path or wildcard)

Entry: `vaayvuEvent({ type: 'privacyException' })`,
`window.__vaayvuPrivacyExceptionPrompt()`, or `__vaayvuOnboardingOpen('s-411')`.

## Screen `s-412` — fingerprint compatibility warning (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-412`, phase `p20`, category **fingerprint**,
priority **required**, gate `fingerprintCompat`.

- Names the affected feature and the single protection involved
- Narrow diagnostic recovery scoped to one origin for 24 hours
- Safe return to the page without changing settings
- Sandbox, certificate validation and Rasha blocks unaffected
- Global protection downgrade after one broken page is refused

Entry: `vaayvuEvent({ type: 'fingerprintCompat' })`,
`window.__vaayvuFingerprintCompatPrompt()`, or `__vaayvuOnboardingOpen('s-412')`.

## Screen `s-413` — privacy regression results (fingerprint, phase p20)

Route `vaayvu://fingerprint/s-413`, phase `p20`, category **fingerprint**,
priority **required**, gate `privacyRegression`.

- Synthetic cross-site comparison, repeat stability within and across partitions
- Qualitative entropy proxy, false-positive counts
- Video, drawing, conferencing and accessibility fixtures under both modes
- A single public score is not proof of anonymity
- Broken required workflow is triaged as blocking before release

Entry: `vaayvuEvent({ type: 'privacyRegression' })`,
`window.__vaayvuPrivacyRegressionPrompt()`, or `__vaayvuOnboardingOpen('s-413')`.

## Screen `s-414` — trusted origin detail (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-414`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `trustedOrigin`.

- Committed origin from engine navigation, not page title or markup
- Certificate summary and redirect status
- Cross-origin redirect clears the previous safe indicator
- Canonical host from the maintained parser; URL userinfo never names the destination
- Punycode/mixed-script lookalike review

Entry: `vaayvuEvent({ type: 'trustedOrigin' })`,
`window.__vaayvuTrustedOriginPrompt()`, or `__vaayvuOnboardingOpen('s-414')`.

## Screen `s-415` — active capability sessions (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-415`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `capabilitySessions`.

- Camera, microphone, screen capture, location, USB/Bluetooth and clipboard status
- Live state from trusted engine/OS events; hidden-tab capture stays visible
- Revocation reflected only after the adapter confirms; restart explained where needed
- Clipboard requires an explicit user gesture; forged page messages refused

Entry: `vaayvuEvent({ type: 'capabilitySessions' })`,
`window.__vaayvuCapabilitySessionsPrompt()`, or `__vaayvuOnboardingOpen('s-415')`.

## Screen `s-416` — grant scope editor (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-416`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `grantScope`.

- Origin/frame, permission type and duration (once, session, persistent)
- Persistent scope requires a deliberate second confirmation
- Explicit denial preserved; repeated prompts throttled
- Revocation clears the grant
- Changing origin never inherits prior authorization

Entry: `vaayvuEvent({ type: 'grantScope' })`,
`window.__vaayvuGrantScopePrompt()`, or `__vaayvuOnboardingOpen('s-416')`.

## Screen `s-417` — suspicious redirect review (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-417`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `suspiciousRedirect`.

- Trusted source and exact destination with scheme shown
- Sensitive external launch requires a user gesture
- Blocked threats cannot be bypassed through the redirect chain
- `javascript:` and unsupported schemes rejected
- Web content cannot silently launch privileged applications

Entry: `vaayvuEvent({ type: 'suspiciousRedirect' })`,
`window.__vaayvuSuspiciousRedirectPrompt()`, or `__vaayvuOnboardingOpen('s-417')`.

## Screen `s-418` — security recovery center (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-418`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `securityRecovery`.

- Certificate, engine safety and malicious-site warning variants
- Warning source and reason shown; upstream TLS validation stays enforced
- Safe back leaves nothing loaded from the untrusted origin
- No silent certificate bypass or disabled TLS verification
- No claim of complete phishing detection; no generic unsafe bypass

Entry: `vaayvuEvent({ type: 'securityRecovery' })`,
`window.__vaayvuSecurityRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-418')`.

## Screen `s-419` — permission event review (trusted-navigation, phase p21)

Route `vaayvu://trusted-navigation/s-419`, phase `p21`, category
**trusted-navigation**, priority **required**, gate `permissionEvents`.

- Bounded local grant/revoke metadata with expiry
- No camera, microphone or page content in the log
- Private-session events excluded from the regular log
- Untrusted frames denied file, vault and update APIs
- Clearing the event log removes metadata only

Entry: `vaayvuEvent({ type: 'permissionEvents' })`,
`window.__vaayvuPermissionEventsPrompt()`, or `__vaayvuOnboardingOpen('s-419')`.

## Screen `s-420` — credential health overview (credentials, phase p21)

Route `vaayvu://credentials/s-420`, phase `p21`, category **credentials**,
priority **required**, gate `credentialHealth`.

- Credential, passkey and masked payment-card counts
- Reuse and weak-pattern checks run locally; no secret or hash transmitted
- Remote breach lookup off by default and refused without reviewed consent
- Lookalike hosts and untrusted frames receive no saved password
- Payment authorization cannot be fabricated or silently submitted

Entry: `vaayvuEvent({ type: 'credentialHealth' })`,
`window.__vaayvuCredentialHealthPrompt()`, or `__vaayvuOnboardingOpen('s-420')`.

## Screen `s-421` — origin match review (credentials, phase p21)

Route `vaayvu://credentials/s-421`, phase `p21`, category **credentials**,
priority **required**, gate `originMatch`.

- Committed origin and credential binding shown together
- Fill requires an explicit user gesture on a matching top-level context
- Hidden or off-screen password fields are never autofilled
- Changed frame origin blocks fill until the binding matches
- Generated passwords use secure random, stay masked and are never logged

Entry: `vaayvuEvent({ type: 'originMatch' })`,
`window.__vaayvuOriginMatchPrompt()`, or `__vaayvuOnboardingOpen('s-421')`.

## Screen `s-422` — passkey enrollment status (credentials, phase p21)

Route `vaayvu://credentials/s-422`, phase `p21`, category **credentials**,
priority **required**, gate `passkeyEnrollment`.

- Truthful platform-authenticator availability and relying party
- Enrollment outcomes: waiting, enrolled, canceled, failed
- Existing password retained through cancel and failure
- Recovery via another device or password fallback
- Passkey security never emulated with password storage

Entry: `vaayvuEvent({ type: 'passkeyEnrollment' })`,
`window.__vaayvuPasskeyEnrollmentPrompt()`, or `__vaayvuOnboardingOpen('s-422')`.

## Screen `s-423` — credential import preview (credentials, phase p21)

Route `vaayvu://credentials/s-423`, phase `p21`, category **credentials**,
priority **required**, gate `credentialImport`.

- Source format, entry count and target vault shown
- Duplicate origins/accounts previewed; distinct identities preserved
- Conflicting passwords kept for review instead of overwritten
- Private-mode and empty values excluded
- Validation required before commit; malformed rows abort with the vault intact
- Unavailable key leaves the previous vault unchanged

Entry: `vaayvuEvent({ type: 'credentialImport' })`,
`window.__vaayvuCredentialImportPrompt()`, or `__vaayvuOnboardingOpen('s-423')`.

## Screen `s-424` — secure export confirmation (credentials, phase p21)

Route `vaayvu://credentials/s-424`, phase `p21`, category **credentials**,
priority **required**, gate `secureExport`.

- Exact selected scope and user-chosen destination
- OS authentication required before writing
- Plaintext format risk disclosed; encrypted claim only when verified
- Result reports location and format without previewing secrets
- Cancel leaves the vault unchanged; no plaintext in logs or temp cache

Entry: `vaayvuEvent({ type: 'secureExport' })`,
`window.__vaayvuSecureExportPrompt()`, or `__vaayvuOnboardingOpen('s-424')`.

## Screen `s-425` — vault recovery state (credentials, phase p21)

Route `vaayvu://credentials/s-425`, phase `p21`, category **credentials**,
priority **required**, gate `vaultRecovery`.

- Locked vault with missing OS key explained without data loss
- Recovery via key retry, encrypted backup or another trusted device
- Automatic destructive new-vault creation refused
- Private form content never written to logs or regular profile
- Sentinel check confirms no private form data persisted

Entry: `vaayvuEvent({ type: 'vaultRecovery' })`,
`window.__vaayvuVaultRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-425')`.

## Screen `s-426` — update health center (maintenance, phase p21)

Route `vaayvu://maintenance/s-426`, phase `p21`, category **maintenance**,
priority **required**, gate `updateHealth`.

- Exact shipped app and engine revisions from build metadata
- Channel and security-update state
- Critical patch with action state and remediation owner
- Critical patches not deferred for monthly feature cadence
- Unknown engine revision shown as unknown, never guessed

Entry: `vaayvuEvent({ type: 'updateHealth' })`,
`window.__vaayvuUpdateHealthPrompt()`, or `__vaayvuOnboardingOpen('s-426')`.

## Screen `s-427` — update integrity detail (maintenance, phase p21)

Route `vaayvu://maintenance/s-427`, phase `p21`, category **maintenance**,
priority **required**, gate `updateIntegrity`.

- Signed manifest, digest, version and trusted release key
- Trusted key rotation policy applied
- Altered digest and unapproved downgrade rejected
- Platform signing/notarization requirements shown and enforced
- OS signing bypass refused

Entry: `vaayvuEvent({ type: 'updateIntegrity' })`,
`window.__vaayvuUpdateIntegrityPrompt()`, or `__vaayvuOnboardingOpen('s-427')`.

## Screen `s-428` — update installation review (maintenance, phase p21)

Route `vaayvu://maintenance/s-428`, phase `p21`, category **maintenance**,
priority **required**, gate `updateInstall`.

- Restart requirement with defer option
- Active calls, downloads and unsaved forms surfaced before restart
- Measured staging space; insufficient space leaves package and profile intact
- Install proceeds only after protected work is safe
- Forced optional restart during a call refused

Entry: `vaayvuEvent({ type: 'updateInstall' })`,
`window.__vaayvuUpdateInstallPrompt()`, or `__vaayvuOnboardingOpen('s-428')`.

## Screen `s-429` — update interrupted recovery (maintenance, phase p21)

Route `vaayvu://maintenance/s-429`, phase `p21`, category **maintenance**,
priority **required**, gate `updateRecovery`.

- Last verified version remains running
- Partial staged artifact and manifest state shown
- Changed remote content invalidates partial bytes and restarts the download
- Interrupted installation never marks the version as updated
- Recovery preserves the previous installation or documented platform path

Entry: `vaayvuEvent({ type: 'updateRecovery' })`,
`window.__vaayvuUpdateRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-429')`.

## Screen `s-430` — release rollback review (maintenance, phase p21)

Route `vaayvu://maintenance/s-430`, phase `p21`, category **maintenance**,
priority **required**, gate `releaseRollback`.

- Signed previous binary verified
- Newer schema fields preserved, not silently dropped
- Restore-safe backup required before rollback
- Limited safe chrome keeps profiles available during a crash loop
- No automatic data erasure to fix startup failure

Entry: `vaayvuEvent({ type: 'releaseRollback' })`,
`window.__vaayvuReleaseRollbackPrompt()`, or `__vaayvuOnboardingOpen('s-430')`.

## Screen `s-431` — dependency security ledger (maintenance, phase p21)

Route `vaayvu://maintenance/s-431`, phase `p21`, category **maintenance**,
priority **required**, gate `dependencyLedger`.

- Pinned SBOM with engine, dependency and license records; Rasha boundary first-party
- Forbidden third-party blocker dependency blocks shipment
- CVE triage with patched-release record
- Patch evidence: build ID, signing, regression and rollout manifest
- Source commit alone cannot certify a shipped update
- Release notes exclude secret crash logs and exploit details

Entry: `vaayvuEvent({ type: 'dependencyLedger' })`,
`window.__vaayvuDependencyLedgerPrompt()`, or `__vaayvuOnboardingOpen('s-431')`.

## Screen `s-432` — four-side tab position chooser (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-432`, phase `p22`, category **tab-layout**,
priority **required**, gate `tabPlacement`.

- Top, bottom, left and right placement with current selection
- Open tab IDs, order, active page and media preserved on change
- Compact layouts fall back to a tab switcher and retain the preferred placement
- Settings and touch menus expose the same choices; no right-click requirement

Entry: `vaayvuEvent({ type: 'tabPlacement' })`,
`window.__vaayvuTabPlacementPrompt()`, or `__vaayvuOnboardingOpen('s-432')`.

## Screen `s-433` — tab layout size editor (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-433`, phase `p22`, category **tab-layout**,
priority **required**, gate `tabSize`.

- Bounded vertical width (180–420 px) with field-specific validation
- Compact/comfortable density with readable title truncation
- Keyboard resize from the separator
- Minimum content width preserved at maximum width
- 100-tab simulation keeps the new-tab control reachable
- Cancel restores the last committed width

Entry: `vaayvuEvent({ type: 'tabSize' })`,
`window.__vaayvuTabSizePrompt()`, or `__vaayvuOnboardingOpen('s-433')`.

## Screen `s-434` — nested group tree (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-434`, phase `p22`, category **tab-layout**,
priority **required**, gate `nestedGroups`.

- Stable parent-child group IDs and pinned tabs
- Cycles rejected when moving a group into its own descendant
- Collapse keeps the active tab location discoverable
- Drag and keyboard share one committed ordering
- Pointer loss restores the committed position; tabs are never duplicated or lost

Entry: `vaayvuEvent({ type: 'nestedGroups' })`,
`window.__vaayvuNestedGroupsPrompt()`, or `__vaayvuOnboardingOpen('s-434')`.

## Screen `s-435` — tab selection and batch review (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-435`, phase `p22`, category **tab-layout**,
priority **required**, gate `tabSelection`.

- Exact selected stable IDs shown before any action
- Pinned tabs and tabs with unsaved forms excluded
- Preview required before closing
- Same-URL tabs remain separate sessions and histories
- Bulk close never includes unselected or pinned tabs

Entry: `vaayvuEvent({ type: 'tabSelection' })`,
`window.__vaayvuTabSelectionPrompt()`, or `__vaayvuOnboardingOpen('s-435')`.

## Screen `s-436` — tab movement confirmation (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-436`, phase `p22`, category **tab-layout**,
priority **required**, gate `tabMovement`.

- Source/destination window, group and profile shown
- Same-profile move uses stable IDs and one active owner
- Copy creates a distinct tab object; source unchanged
- Cross-profile move requires fresh navigation with isolation disclosure and no cookie carry
- Destination failure leaves the source tab intact

Entry: `vaayvuEvent({ type: 'tabMovement' })`,
`window.__vaayvuTabMovementPrompt()`, or `__vaayvuOnboardingOpen('s-436')`.

## Screen `s-437` — layout restoration state (tab-layout, phase p22)

Route `vaayvu://tab-layout/s-437`, phase `p22`, category **tab-layout**,
priority **required**, gate `layoutRestore`.

- Stored placement and active responsive layout (rail/grid/strip)
- Rotation preserves tab selection and toolbar controls
- Invalid stored setting falls back visibly without resetting theme or density
- Reset affects layout only
- Hardware keyboard and pointer supported across layouts

Entry: `vaayvuEvent({ type: 'layoutRestore' })`,
`window.__vaayvuLayoutRestorePrompt()`, or `__vaayvuOnboardingOpen('s-437')`.

## Screen `s-438` — workspace project dashboard (workspaces, phase p22)

Route `vaayvu://workspaces/s-438`, phase `p22`, category **workspaces**,
priority **required**, gate `workspaceDash`.

- Stable space ID linked to profile (and optional real container)
- Actual windows, tab count, notes, layouts and recent activity
- Display name changes never create cookie isolation
- Private workspace titles excluded from the regular dashboard
- Open space reports real tab counts

Entry: `vaayvuEvent({ type: 'workspaceDash' })`,
`window.__vaayvuWorkspaceDashPrompt()`, or `__vaayvuOnboardingOpen('s-438')`.

## Screen `s-439` — workspace template editor (workspaces, phase p22)

Route `vaayvu://workspaces/s-439`, phase `p22`, category **workspaces**,
priority **required**, gate `workspaceTemplate`.

- Name, validated https destinations, pane layout and startup options
- `javascript:`, `data:` and non-https URLs rejected with a field error
- No credentials or scripts stored in the template
- Preview shows tabs and panes before opening
- Concurrent initial loads capped; bulk requests limited

Entry: `vaayvuEvent({ type: 'workspaceTemplate' })`,
`window.__vaayvuWorkspaceTemplatePrompt()`, or `__vaayvuOnboardingOpen('s-439')`.

## Screen `s-440` — saved pane layout gallery (workspaces, phase p22)

Route `vaayvu://workspaces/s-440`, phase `p22`, category **workspaces**,
priority **required**, gate `paneGallery`.

- Named layouts with orientation and active pane
- Split geometry restored within device constraints
- Toolbar address/security/find/print/share follow the active pane
- Narrow phone falls back to the tab switcher without losing tabs
- Same-URL panes remain distinct objects and states

Entry: `vaayvuEvent({ type: 'paneGallery' })`,
`window.__vaayvuPaneGalleryPrompt()`, or `__vaayvuOnboardingOpen('s-440')`.

## Screen `s-441` — workspace transition preview (workspaces, phase p22)

Route `vaayvu://workspaces/s-441`, phase `p22`, category **workspaces**,
priority **required**, gate `workspaceTransition`.

- Current work and destination tab counts
- Calls, uploads and unsaved work preserved through the switch
- Per-window independent space selection
- Background tasks never discarded automatically
- Other windows unchanged unless explicitly configured

Entry: `vaayvuEvent({ type: 'workspaceTransition' })`,
`window.__vaayvuWorkspaceTransitionPrompt()`, or `__vaayvuOnboardingOpen('s-441')`.

## Screen `s-442` — workspace archive review (workspaces, phase p22)

Route `vaayvu://workspaces/s-442`, phase `p22`, category **workspaces**,
priority **required**, gate `workspaceArchive`.

- Archive scope limited to tab references, notes and layout metadata
- User files, bookmarks and downloads retained
- Protected tabs stay open; archiving is not profile deletion
- Restore path shown for archived references
- Metadata removal separate; cancel retains everything

Entry: `vaayvuEvent({ type: 'workspaceArchive' })`,
`window.__vaayvuWorkspaceArchivePrompt()`, or `__vaayvuOnboardingOpen('s-442')`.

## Screen `s-443` — workspace restore conflict (workspaces, phase p22)

Route `vaayvu://workspaces/s-443`, phase `p22`, category **workspaces**,
priority **required**, gate `workspaceRestore`.

- Missing tabs listed, never dropped silently
- Duplicate IDs resolved with new stable IDs
- Stale layouts fall back within device constraints
- Current project preserved until an explicit choice
- Distinct tabs never deduplicated by URL
- Private workspaces never sync or appear on remote devices

Entry: `vaayvuEvent({ type: 'workspaceRestore' })`,
`window.__vaayvuWorkspaceRestorePrompt()`, or `__vaayvuOnboardingOpen('s-443')`.

## Screen `s-444` — container manager (containers, phase p22)

Route `vaayvu://containers/s-444`, phase `p22`, category **containers**,
priority **required**, gate `containerManager`.

- Containers with color, icon and visible text label
- Storage partitions created only through verified engine facilities
- Separate containers do not share cookies without an approved capability
- Color alone cannot communicate identity or security scope
- Temporary containers disclose their expiry

Entry: `vaayvuEvent({ type: 'containerManager' })`,
`window.__vaayvuContainerManagerPrompt()`, or `__vaayvuOnboardingOpen('s-444')`.

## Screen `s-445` — container creation wizard (containers, phase p22)

Route `vaayvu://containers/s-445`, phase `p22`, category **containers**,
priority **required**, gate `containerCreate`.

- Name, profile and storage policy before creation
- Stable ID and storage partition allocated before success is shown
- Isolation proof via cookie sentinel
- Temporary containers disclose expiry and cleanup; data never enters regular persistence
- Failed allocation produces no usable-looking container
- Skipping isolation proof refused

Entry: `vaayvuEvent({ type: 'containerCreate' })`,
`window.__vaayvuContainerCreatePrompt()`, or `__vaayvuOnboardingOpen('s-445')`.

## Screen `s-446` — container assignment rules (containers, phase p22)

Route `vaayvu://containers/s-446`, phase `p22`, category **containers**,
priority **required**, gate `containerRules`.

- Deterministic precedence: explicit tab → exact host → default
- Equal-priority conflicts flagged for review, never arbitrary
- Per-navigation manual override without rewriting the rule
- Fresh container context does not carry prior account state
- Default container shown for unmatched hosts

Entry: `vaayvuEvent({ type: 'containerRules' })`,
`window.__vaayvuContainerRulesPrompt()`, or `__vaayvuOnboardingOpen('s-446')`.

## Screen `s-447` — container tab transfer review (containers, phase p22)

Route `vaayvu://containers/s-447`, phase `p22`, category **containers**,
priority **required**, gate `containerTransfer`.

- Source and destination containers shown
- Destination opens with a fresh URL-only navigation
- Cookies, passwords and live DOM never cross containers
- Source tab kept until the destination confirms load
- Destination failure leaves the source open

Entry: `vaayvuEvent({ type: 'containerTransfer' })`,
`window.__vaayvuContainerTransferPrompt()`, or `__vaayvuOnboardingOpen('s-447')`.

## Screen `s-448` — container data management (containers, phase p22)

Route `vaayvu://containers/s-448`, phase `p22`, category **containers**,
priority **required**, gate `containerData`.

- Supported data categories measured per container
- Unknown byte counts shown unavailable, never zero
- Active tabs and revocable capability grants listed
- Removal scoped to an explicit container ID
- Other containers and profile data untouched

Entry: `vaayvuEvent({ type: 'containerData' })`,
`window.__vaayvuContainerDataPrompt()`, or `__vaayvuOnboardingOpen('s-448')`.

## Screen `s-449` — container unavailable fallback (containers, phase p22)

Route `vaayvu://containers/s-449`, phase `p22`, category **containers**,
priority **required**, gate `containerFallback`.

- Unsupported adapter state with no cosmetic isolation offer
- Separate-profile alternative with its own storage
- Cross-context test covers cookies, service workers, cache, permissions and credentials
- Any sentinel leak blocks the isolated-container claim
- Isolation never advertised without a real storage partition

Entry: `vaayvuEvent({ type: 'containerFallback' })`,
`window.__vaayvuContainerFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-449')`.

## Screen `s-450` — continue project on device (continuity, phase p23)

Route `vaayvu://continuity/s-450`, phase `p23`, category **continuity**,
priority **required**, gate `continueProject`.

- Trusted device list with one selected destination
- Project summary with stable tab/group IDs and approved notes
- Destination app/engine/layout capabilities advertised, missing ones named
- Private tabs, cookies, passwords and page DOM excluded by default
- Preview required before sending; untrusted devices refused

Entry: `vaayvuEvent({ type: 'continueProject' })`,
`window.__vaayvuContinueProjectPrompt()`, or `__vaayvuOnboardingOpen('s-450')`.

## Screen `s-451` — handoff consent sheet (continuity, phase p23)

Route `vaayvu://continuity/s-451`, phase `p23`, category **continuity**,
priority **required**, gate `handoffConsent`.

- Included fields, target device and excluded values shown before transmit
- Recipient pairing and trust verified through reviewed crypto
- Cancellation sends no payload
- Revoked or unknown devices cannot receive the payload
- Cookies and other secrets refused from inclusion

Entry: `vaayvuEvent({ type: 'handoffConsent' })`,
`window.__vaayvuHandoffConsentPrompt()`, or `__vaayvuOnboardingOpen('s-451')`.

## Screen `s-452` — handoff incoming review (continuity, phase p23)

Route `vaayvu://continuity/s-452`, phase `p23`, category **continuity**,
priority **required**, gate `handoffIncoming`.

- Sender device, exact data and layout fallback shown
- Recipient acceptance required; open-as-new or merge offered
- Merge adds tabs and never overwrites local ones
- Declining imports nothing
- No raw execution context, extension secrets or cookies transferred

Entry: `vaayvuEvent({ type: 'handoffIncoming' })`,
`window.__vaayvuHandoffIncomingPrompt()`, or `__vaayvuOnboardingOpen('s-452')`.

## Screen `s-453` — sync change journal (continuity, phase p23)

Route `vaayvu://continuity/s-453`, phase `p23`, category **continuity**,
priority **required**, gate `syncJournal`.

- Pending and acknowledged operations with timestamps
- Offline queue quota shown; full queue pauses with a warning and drops nothing
- Local operation commits before enqueue
- Operations apply once by op ID
- Conflicts resolve by op ID, never by URL dedupe; replay cannot duplicate or delete tabs

Entry: `vaayvuEvent({ type: 'syncJournal' })`,
`window.__vaayvuSyncJournalPrompt()`, or `__vaayvuOnboardingOpen('s-453')`.

## Screen `s-454` — device trust and key rotation (continuity, phase p23)

Route `vaayvu://continuity/s-454`, phase `p23`, category **continuity**,
priority **required**, gate `deviceTrust`.

- Paired devices and current key epoch
- Rotation affects future access; old epoch no longer accepted
- Revocation blocks future access but cannot erase copied data remotely
- No remote-erasure guarantee and no server-side plaintext key
- Offline recovery verified with the user-held key

Entry: `vaayvuEvent({ type: 'deviceTrust' })`,
`window.__vaayvuDeviceTrustPrompt()`, or `__vaayvuOnboardingOpen('s-454')`.

## Screen `s-455` — continuity recovery state (continuity, phase p23)

Route `vaayvu://continuity/s-455`, phase `p23`, category **continuity**,
priority **required**, gate `continuityRecovery`.

- Offline, revoked, stale and incompatible schema states
- Local work retained; retry after connectivity returns
- Local export works without the account service
- Unsupported remote schema cannot overwrite local data; fields preserved for migration
- Browser never depends on the account service for local browsing

Entry: `vaayvuEvent({ type: 'continuityRecovery' })`,
`window.__vaayvuContinuityRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-455')`.

## Screen `s-456` — backup inventory detail (preservation, phase p23)

Route `vaayvu://preservation/s-456`, phase `p23`, category **preservation**,
priority **required**, gate `backupInventory`.

- Versioned backups with size, timestamp, checksum and encryption
- Explicit collection scope; credentials excluded
- Existing backups never deleted or overwritten without permission
- Capacity exhaustion pauses and warns; nothing purged
- Corruption offers repair preview only; no automatic reset

Entry: `vaayvuEvent({ type: 'backupInventory' })`,
`window.__vaayvuBackupInventoryPrompt()`, or `__vaayvuOnboardingOpen('s-456')`.

## Screen `s-457` — backup creation review (preservation, phase p23)

Route `vaayvu://preservation/s-457`, phase `p23`, category **preservation**,
priority **required**, gate `backupCreate`.

- Selected collections with credentials and payment data excluded
- User-chosen destination, never an insecure temporary location
- Reviewed encryption applied only when requested
- Staged write verified before completion
- Interruption leaves the backup incomplete and the prior backup valid

Entry: `vaayvuEvent({ type: 'backupCreate' })`,
`window.__vaayvuBackupCreatePrompt()`, or `__vaayvuOnboardingOpen('s-457')`.

## Screen `s-458` — migration compatibility matrix (preservation, phase p23)

Route `vaayvu://preservation/s-458`, phase `p23`, category **preservation**,
priority **required**, gate `migrationMatrix`.

- Source/target schema, preserved fields and stable IDs
- Unknown future fields retained and surfaced, never dropped
- Conflicts resolved without dropping records
- Dry run before apply; original database preserved
- Failed migration leaves the last known-good schema intact

Entry: `vaayvuEvent({ type: 'migrationMatrix' })`,
`window.__vaayvuMigrationMatrixPrompt()`, or `__vaayvuOnboardingOpen('s-458')`.

## Screen `s-459` — interrupted write recovery (preservation, phase p23)

Route `vaayvu://preservation/s-459`, phase `p23`, category **preservation**,
priority **required**, gate `writeRecovery`.

- Last committed transaction and quarantined partial record
- Unrelated records intact after an abrupt kill
- Committed work replayed idempotently
- Read-only mode never claims changes were saved
- Unsaved changes export locally; writable recovery only after the store returns

Entry: `vaayvuEvent({ type: 'writeRecovery' })`,
`window.__vaayvuWriteRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-459')`.

## Screen `s-460` — restore merge review (preservation, phase p23)

Route `vaayvu://preservation/s-460`, phase `p23`, category **preservation**,
priority **required**, gate `restoreMerge`.

- Incoming and current record counts with stable IDs
- Conflicting same-URL records kept as distinct identities
- Current work untouched without explicit overwrite approval
- Preview required before applying the merge
- Credentials never stored as plaintext in generic backup JSON

Entry: `vaayvuEvent({ type: 'restoreMerge' })`,
`window.__vaayvuRestoreMergePrompt()`, or `__vaayvuOnboardingOpen('s-460')`.

## Screen `s-461` — recovery evidence export (preservation, phase p23)

Route `vaayvu://preservation/s-461`, phase `p23`, category **preservation**,
priority **required**, gate `recoveryEvidence`.

- Report contains error classes, failing record IDs and schema version
- Browsing history, credentials, page content and private sessions excluded
- User-chosen export destination
- Test matrix: disk full, power loss, corrupt checksum, duplicate replay, old schema
- Any silent data loss blocks the migration release

Entry: `vaayvuEvent({ type: 'recoveryEvidence' })`,
`window.__vaayvuRecoveryEvidencePrompt()`, or `__vaayvuOnboardingOpen('s-461')`.

## Screen `s-462` — research collection dashboard (research, phase p24)

Route `vaayvu://research/s-462`, phase `p24`, category **research**,
priority **required**, gate `researchDashboard`.

- Collections with source, note and tag counts
- Stable source IDs stored locally; offline availability shown
- Associated open tabs listed without scraping unselected pages
- No web crawling or public search infrastructure
- Private-browsing sources excluded by default

Entry: `vaayvuEvent({ type: 'researchDashboard' })`,
`window.__vaayvuResearchDashboardPrompt()`, or `__vaayvuOnboardingOpen('s-462')`.

## Screen `s-463` — source capture review (research, phase p24)

Route `vaayvu://research/s-463`, phase `p24`, category **research**,
priority **required**, gate `sourceCapture`.

- Committed URL, title and user-selected excerpt
- Capture time and origin recorded with the excerpt
- Deliberate selection required; page auto-capture refused
- Sensitive form contents never captured
- Later remote changes never rewrite the saved quote

Entry: `vaayvuEvent({ type: 'sourceCapture' })`,
`window.__vaayvuSourceCapturePrompt()`, or `__vaayvuOnboardingOpen('s-463')`.

## Screen `s-464` — citation and quote inspector (research, phase p24)

Route `vaayvu://research/s-464`, phase `p24`, category **research**,
priority **required**, gate `citationInspector`.

- Source reference, exact excerpt and timestamp
- Annotation visually distinct from quoted text
- Text/position anchors with fallback when content changes
- Unverified generated text never presented as a quote
- Changed pages require approval before reattaching a note

Entry: `vaayvuEvent({ type: 'citationInspector' })`,
`window.__vaayvuCitationInspectorPrompt()`, or `__vaayvuOnboardingOpen('s-464')`.

## Screen `s-465` — local collection search (research, phase p24)

Route `vaayvu://research/s-465`, phase `p24`, category **research**,
priority **required**, gate `collectionSearch`.

- Query limited to explicitly saved local content
- Filters (all/notes/sources/tags) shown with match results
- Bounded index storage; deleted sources removed after commit
- Private history and unsaved pages excluded
- Results report sources and criteria, not invented relevance scores

Entry: `vaayvuEvent({ type: 'collectionSearch' })`,
`window.__vaayvuCollectionSearchPrompt()`, or `__vaayvuOnboardingOpen('s-465')`.

## Screen `s-466` — research export review (research, phase p24)

Route `vaayvu://research/s-466`, phase `p24`, category **research**,
priority **required**, gate `researchExport`.

- Selected citations, notes and source links only
- Markdown, HTML or supported citation format
- User-chosen destination; existing file never overwritten silently
- Preview required before writing
- Exported file reopened and verified for complete records
- No private history or unsaved pages in the export

Entry: `vaayvuEvent({ type: 'researchExport' })`,
`window.__vaayvuResearchExportPrompt()`, or `__vaayvuOnboardingOpen('s-466')`.

## Screen `s-467` — missing source recovery (research, phase p24)

Route `vaayvu://research/s-467`, phase `p24`, category **research**,
priority **required**, gate `sourceRecovery`.

- Unreachable/changed source marked honestly
- Saved snapshot offered with its capture time
- Saved excerpt never claimed to reflect the latest page
- Original link retained for retry
- Stable IDs and schema version exportable for future restore

Entry: `vaayvuEvent({ type: 'sourceRecovery' })`,
`window.__vaayvuSourceRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-467')`.

## Screen `s-468` — reading dashboard detail (reader, phase p24)

Route `vaayvu://reader/s-468`, phase `p24`, category **reader**,
priority **required**, gate `readingDashboard`.

- Saved-article counts come from real shelf items
- Reading list kept separate from bookmarks
- Recent destinations show distinct permitted visits with title, host and time
- Offline badges and user-added feeds only
- Private sessions and disabled history never appear

Entry: `vaayvuEvent({ type: 'readingDashboard' })`,
`window.__vaayvuReadingDashboardPrompt()`, or `__vaayvuOnboardingOpen('s-468')`.

## Screen `s-469` — reader extraction preview (reader, phase p24)

Route `vaayvu://reader/s-469`, phase `p24`, category **reader**,
priority **required**, gate `readerExtraction`.

- Title and source retained from the committed page
- Extraction local or through an approved engine API
- Partial/low-confidence results labeled honestly
- Failure leaves the original page intact
- Return opens the exact source tab at the saved scroll position
- Reader mode cannot replace the trusted origin with a display title

Entry: `vaayvuEvent({ type: 'readerExtraction' })`,
`window.__vaayvuReaderExtractionPrompt()`, or `__vaayvuOnboardingOpen('s-469')`.

## Screen `s-470` — reader typography editor (reader, phase p24)

Route `vaayvu://reader/s-470`, phase `p24`, category **reader**,
priority **required**, gate `readerTypography`.

- Font size, line measure and spacing persisted locally
- OS text-size and reduced-contrast preferences honored
- Large text keeps controls and source link visible
- Speech uses the OS voice with pause/resume and language selection
- Remote speech refused without explicit disclosure and consent

Entry: `vaayvuEvent({ type: 'readerTypography' })`,
`window.__vaayvuReaderTypographyPrompt()`, or `__vaayvuOnboardingOpen('s-470')`.

## Screen `s-471` — offline article download review (reader, phase p24)

Route `vaayvu://reader/s-471`, phase `p24`, category **reader**,
priority **required**, gate `offlineArticle`.

- Source and provenance shown before saving
- Only legally and technically available content saved
- Paywalls, DRM and access controls never bypassed
- Estimated and actual size reported; transfer resumable where supported
- Storage shortage never evicts existing articles or notes

Entry: `vaayvuEvent({ type: 'offlineArticle' })`,
`window.__vaayvuOfflineArticlePrompt()`, or `__vaayvuOnboardingOpen('s-471')`.

## Screen `s-472` — reading progress library (reader, phase p24)

Route `vaayvu://reader/s-472`, phase `p24`, category **reader**,
priority **required**, gate `readingProgress`.

- Stable article IDs, positions and last access stored locally
- Read/unread states preserved
- Archive reversible with undo; bookmarks kept separate
- Changed article layout falls back instead of restoring an invalid offset
- Bulk removal requires explicit scope

Entry: `vaayvuEvent({ type: 'readingProgress' })`,
`window.__vaayvuReadingProgressPrompt()`, or `__vaayvuOnboardingOpen('s-472')`.

## Screen `s-473` — reader unavailable recovery (reader, phase p24)

Route `vaayvu://reader/s-473`, phase `p24`, category **reader**,
priority **required**, gate `readerUnavailable`.

- Extraction failure and unsupported document explained
- Missing snapshot stated; original URL offered
- Retry or read the original; nothing force-extracted
- Content matrix covers multi-column, RTL, code, images, keyboard and screen reader
- No fabricated article text

Entry: `vaayvuEvent({ type: 'readerUnavailable' })`,
`window.__vaayvuReaderUnavailablePrompt()`, or `__vaayvuOnboardingOpen('s-473')`.

## Screen `s-474` — RSS subscription manager (feeds, phase p24)

Route `vaayvu://feeds/s-474`, phase `p24`, category **feeds**,
priority **required**, gate `feedManager`.

- Only user-added or approved sources fetched
- Refresh status, unread counts and folders
- Source IDs and item GUID/URL for deterministic duplicates
- No background crawl of visited websites
- Same-title articles with distinct GUIDs both retained

Entry: `vaayvuEvent({ type: 'feedManager' })`,
`window.__vaayvuFeedManagerPrompt()`, or `__vaayvuOnboardingOpen('s-474')`.

## Screen `s-475` — add feed validation (feeds, phase p24)

Route `vaayvu://feeds/s-475`, phase `p24`, category **feeds**,
priority **required**, gate `feedValidation`.

- HTTPS feed URL required; file, javascript and embedded credentials rejected
- Redirects follow normal engine policy
- Source identity and sample sanitized items shown before saving
- Preview failure never adds the subscription silently

Entry: `vaayvuEvent({ type: 'feedValidation' })`,
`window.__vaayvuFeedValidationPrompt()`, or `__vaayvuOnboardingOpen('s-475')`.

## Screen `s-476` — feed article view (feeds, phase p24)

Route `vaayvu://feeds/s-476`, phase `p24`, category **feeds**,
priority **required**, gate `feedArticle`.

- Untrusted feed markup sanitized in an isolated view
- Publisher attribution and link retained
- Feed scripts/inline handlers cannot access browser APIs
- Read/unread and saved GUIDs stored locally; optional encrypted sync
- Private subscription data never syncs to the regular account

Entry: `vaayvuEvent({ type: 'feedArticle' })`,
`window.__vaayvuFeedArticlePrompt()`, or `__vaayvuOnboardingOpen('s-476')`.

## Screen `s-477` — feed refresh preferences (feeds, phase p24)

Route `vaayvu://feeds/s-477`, phase `p24`, category **feeds**,
priority **required**, gate `feedRefresh`.

- Per-source refresh interval
- Metered-network and battery policy respected
- ETag/Last-Modified conditional requests used
- Bounded response size and coalesced reconnects; no refresh storm
- Refresh reports skipped work honestly

Entry: `vaayvuEvent({ type: 'feedRefresh' })`,
`window.__vaayvuFeedRefreshPrompt()`, or `__vaayvuOnboardingOpen('s-477')`.

## Screen `s-478` — feed import/export review (feeds, phase p24)

Route `vaayvu://feeds/s-478`, phase `p24`, category **feeds**,
priority **required**, gate `feedTransfer`.

- OPML preview validates each feed URL before import
- Insecure entries rejected; duplicates listed explicitly
- Import requires user approval
- Export writes selected metadata to a user-chosen file
- Existing files never overwritten without approval

Entry: `vaayvuEvent({ type: 'feedTransfer' })`,
`window.__vaayvuFeedTransferPrompt()`, or `__vaayvuOnboardingOpen('s-478')`.

## Screen `s-479` — feed failure state (feeds, phase p24)

Route `vaayvu://feeds/s-479`, phase `p24`, category **feeds**,
priority **required**, gate `feedFailure`.

- Invalid feed, offline and parser-limit errors shown honestly
- Last successful cache retained with its real age
- Failed refresh never invents or replaces items
- Subscription removal keeps separately saved articles
- Saved-article deletion requires explicit, separate action

Entry: `vaayvuEvent({ type: 'feedFailure' })`,
`window.__vaayvuFeedFailurePrompt()`, or `__vaayvuOnboardingOpen('s-479')`.

## Screen `s-480` — observatory focus workspace (focus, phase p24)

Route `vaayvu://focus/s-480`, phase `p24`, category **focus**,
priority **required**, gate `focusWorkspace`.

- Large 25-minute timer with idle/running/paused/completed states
- Monotonic elapsed time; dashboard section switches never reset the timer
- Actual active space and tab count shown
- Tab manager opens without hidden destructive actions
- Start, pause, resume and reset are explicit controls

Entry: `vaayvuEvent({ type: 'focusWorkspace' })`,
`window.__vaayvuFocusWorkspacePrompt()`, or `__vaayvuOnboardingOpen('s-480')`.

## Screen `s-481` — focus session preferences (focus, phase p24)

Route `vaayvu://focus/s-481`, phase `p24`, category **focus**,
priority **required**, gate `focusPreferences`.

- Bounded focus (5–120) and break (1–30) durations; 25/5 default
- Invalid durations never alter the active timer
- Sound toggle and optional notification permission after user intent
- Denied notifications do not stop the timer
- Background policy limits stated honestly

Entry: `vaayvuEvent({ type: 'focusPreferences' })`,
`window.__vaayvuFocusPreferencesPrompt()`, or `__vaayvuOnboardingOpen('s-481')`.

## Screen `s-482` — distraction schedule editor (focus, phase p24)

Route `vaayvu://focus/s-482`, phase `p24`, category **focus**,
priority **required**, gate `distractionSchedule`.

- User-defined limited hosts with exact-host validation
- Emergency/allowed host exempt
- Browser-scope limits only; OS-wide interception refused
- Explicit reversible 15-minute override
- DST and timezone changes preserve intended local hours

Entry: `vaayvuEvent({ type: 'distractionSchedule' })`,
`window.__vaayvuDistractionSchedulePrompt()`, or `__vaayvuOnboardingOpen('s-482')`.

## Screen `s-483` — focus running indicator (focus, phase p24)

Route `vaayvu://focus/s-483`, phase `p24`, category **focus**,
priority **required**, gate `focusRunning`.

- Remaining time from a monotonic deadline
- Calls, uploads and unsaved forms explicitly protected
- pPause/end only through explicit controls
- OS suspension explained; restoration re-reads the deadline
- Focus never stops uploads, mutes calls or closes work tabs automatically

Entry: `vaayvuEvent({ type: 'focusRunning' })`,
`window.__vaayvuFocusRunningPrompt()`, or `__vaayvuOnboardingOpen('s-483')`.

## Screen `s-484` — focus completed summary (focus, phase p24)

Route `vaayvu://focus/s-484`, phase `p24`, category **focus**,
priority **required**, gate `focusSummary`.

- Actual elapsed duration only
- Optional local note with a 140-character limit, editable later
- Private-session note not written to regular history without deliberate save
- Reset and start-again controls
- No fabricated productivity score

Entry: `vaayvuEvent({ type: 'focusSummary' })`,
`window.__vaayvuFocusSummaryPrompt()`, or `__vaayvuOnboardingOpen('s-484')`.

## Screen `s-485` — focus interrupted recovery (focus, phase p24)

Route `vaayvu://focus/s-485`, phase `p24`, category **focus**,
priority **required**, gate `focusRecovery`.

- Sleep, OS eviction and interruption explained
- Remaining time restored from a monotonic deadline
- Manual clock changes cannot extend or invert the timer
- Notification denial leaves the timer functional
- Atomic timer controls; milestone announcements only, never each tick

Entry: `vaayvuEvent({ type: 'focusRecovery' })`,
`window.__vaayvuFocusRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-485')`.

## Screen `s-486` — workflow library (workflow, phase p25)

Route `vaayvu://workflow/s-486`, phase `p25`, category **workflow**,
priority **required**, gate `workflowLibrary`.

- Stable workflow IDs and typed, allowlisted actions
- Explicit input schema per workflow
- Versioned definitions; copy/edit never mutates historical receipts
- Recent run receipts readable
- No downloaded executable workflow code

Entry: `vaayvuEvent({ type: 'workflowLibrary' })`,
`window.__vaayvuWorkflowLibraryPrompt()`, or `__vaayvuOnboardingOpen('s-486')`.

## Screen `s-487` — workflow builder (workflow, phase p25)

Route `vaayvu://workflow/s-487`, phase `p25`, category **workflow**,
priority **required**, gate `workflowBuilder`.

- Typed steps from an allowlist with declared capabilities
- Validated destination and typed inputs
- Local typed conditions with bounded loops and timeouts
- OS-supported scheduling with explicit limits
- Unknown commands and external scripts rejected

Entry: `vaayvuEvent({ type: 'workflowBuilder' })`,
`window.__vaayvuWorkflowBuilderPrompt()`, or `__vaayvuOnboardingOpen('s-487')`.

## Screen `s-488` — workflow dry run (workflow, phase p25)

Route `vaayvu://workflow/s-488`, phase `p25`, category **workflow**,
priority **required**, gate `workflowDryRun`.

- Resolved steps, destination and estimated side effects
- Capabilities, profile, origin and platform checked before execution
- Irreversible effects flagged for approval at execution
- Dry run sends nothing and mutates no site state
- Unsupported steps skipped only with an explicit user decision

Entry: `vaayvuEvent({ type: 'workflowDryRun' })`,
`window.__vaayvuWorkflowDryRunPrompt()`, or `__vaayvuOnboardingOpen('s-488')`.

## Screen `s-489` — workflow execution monitor (workflow, phase p25)

Route `vaayvu://workflow/s-489`, phase `p25`, category **workflow**,
priority **required**, gate `workflowMonitor`.

- Current step, progress and approval checkpoints
- Pause/cancel between safe steps
- In-flight actions marked uncertain until confirmed
- Cancellation never claims an external action was reversed
- Local reversible retries keyed by run/step ID and never duplicated

Entry: `vaayvuEvent({ type: 'workflowMonitor' })`,
`window.__vaayvuWorkflowMonitorPrompt()`, or `__vaayvuOnboardingOpen('s-489')`.

## Screen `s-490` — workflow action approval (workflow, phase p25)

Route `vaayvu://workflow/s-490`, phase `p25`, category **workflow**,
priority **required**, gate `workflowApproval`.

- Exact origin, data, recipient and consequence before an external write
- One-time deliberate approval; blanket approval refused
- Skip continues the workflow without the step
- In-flight uncertainty and receipts handled elsewhere
- Vault secrets and raw form contents never exposed to steps

Entry: `vaayvuEvent({ type: 'workflowApproval' })`,
`window.__vaayvuWorkflowApprovalPrompt()`, or `__vaayvuOnboardingOpen('s-490')`.

## Screen `s-491` — workflow run receipt (workflow, phase p25)

Route `vaayvu://workflow/s-491`, phase `p25`, category **workflow**,
priority **required**, gate `workflowReceipt`.

- Completed steps, errors and actual outcomes persisted
- Receipts record uncertainty and partial completion
- Undo only for supported reversible actions
- No universal undo claim for external messages
- Imported workflows validated as inert data and never auto-run

Entry: `vaayvuEvent({ type: 'workflowReceipt' })`,
`window.__vaayvuWorkflowReceiptPrompt()`, or `__vaayvuOnboardingOpen('s-491')`.

## Screen `s-492` — assistant capability dashboard (assistant, phase p25)

Route `vaayvu://assistant/s-492`, phase `p25`, category **assistant**,
priority **required**, gate `assistantDashboard`.

- Assistant disabled by default; explicit opt-in only
- Local vs external provider with exact data flow disclosed
- Hardware/model availability and honest working-RAM limits
- Cost cap for external providers; current contexts empty
- Normal browsing needs no AI service

Entry: `vaayvuEvent({ type: 'assistantDashboard' })`,
`window.__vaayvuAssistantDashboardPrompt()`, or `__vaayvuOnboardingOpen('s-492')`.

## Screen `s-493` — assistant context preview (assistant, phase p25)

Route `vaayvu://assistant/s-493`, phase `p25`, category **assistant**,
priority **required**, gate `assistantContext`.

- Only user-selected text and active-tab metadata shared
- Redaction preview before sending
- Chosen recipient/provider shown
- Passwords, payment fields and unrelated tabs excluded
- Page text and files treated as untrusted data, never commands

Entry: `vaayvuEvent({ type: 'assistantContext' })`,
`window.__vaayvuAssistantContextPrompt()`, or `__vaayvuOnboardingOpen('s-493')`.

## Screen `s-494` — evidence-linked answer panel (assistant, phase p25)

Route `vaayvu://assistant/s-494`, phase `p25`, category **assistant**,
priority **required**, gate `assistantEvidence`.

- Factual claims linked to actually selected sources
- Unsupported conclusions labeled, never given a fake citation
- Generated text never presented as an observed quote
- Copy includes source references
- Rewrites preview before replacing text; unsaved forms never overwritten silently

Entry: `vaayvuEvent({ type: 'assistantEvidence' })`,
`window.__vaayvuAssistantEvidencePrompt()`, or `__vaayvuOnboardingOpen('s-494')`.

## Screen `s-495` — multi-tab comparison workspace (assistant, phase p25)

Route `vaayvu://assistant/s-495`, phase `p25`, category **assistant**,
priority **required**, gate `assistantCompare`.

- Explicit selected tab IDs and comparison criteria
- Each comparison cell cites its source tab
- Missing values shown unknown, never inferred
- Restricted/private content never scraped
- User-approved answer and citations saved to the collection

Entry: `vaayvuEvent({ type: 'assistantCompare' })`,
`window.__vaayvuAssistantComparePrompt()`, or `__vaayvuOnboardingOpen('s-495')`.

## Screen `s-496` — assistant memory manager (assistant, phase p25)

Route `vaayvu://assistant/s-496`, phase `p25`, category **assistant**,
priority **required**, gate `assistantMemory`.

- Only user-approved durable memories stored
- Memory kept separate from browsing history; never harvested from it
- Private context excluded by default
- Edit, export and deletion review with exact scope
- Clearing memory never erases other browser data

Entry: `vaayvuEvent({ type: 'assistantMemory' })`,
`window.__vaayvuAssistantMemoryPrompt()`, or `__vaayvuOnboardingOpen('s-496')`.

## Screen `s-497` — assistant blocked or unavailable state (assistant, phase p25)

Route `vaayvu://assistant/s-497`, phase `p25`, category **assistant**,
priority **required**, gate `assistantBlocked`.

- Offline, unsupported model, budget exhausted, rejected context and unsafe request states
- Requests stop or ask; no invented partial output
- Provider never switches silently
- Quota/network failures pause cleanly
- External actions only via workflow approval and receipts

Entry: `vaayvuEvent({ type: 'assistantBlocked' })`,
`window.__vaayvuAssistantBlockedPrompt()`, or `__vaayvuOnboardingOpen('s-497')`.

## Screen `s-498` — document workspace (documents, phase p26)

Route `vaayvu://documents/s-498`, phase `p26`, category **documents**,
priority **required**, gate `documentWorkspace`.

- Engine PDF renderer with paging, zoom and outline
- Thumbnails, page search and visible selected page
- Text layer detection; image-only PDFs labeled non-searchable
- Annotation toolbar available
- Malformed documents gain no browser privileges

Entry: `vaayvuEvent({ type: 'documentWorkspace' })`,
`window.__vaayvuDocumentWorkspacePrompt()`, or `__vaayvuOnboardingOpen('s-498')`.

## Screen `s-499` — annotation properties (documents, phase p26)

Route `vaayvu://documents/s-499`, phase `p26`, category **documents**,
priority **required**, gate `annotationProperties`.

- Annotation bound to document hash, page and text anchor
- Type, color, note and author label with semantic names
- Keyboard/voice alternatives and readable contrast
- Original PDF bytes preserved unless explicitly saved as a copy
- Color alone never identifies annotation state; cancel retains annotations

Entry: `vaayvuEvent({ type: 'annotationProperties' })`,
`window.__vaayvuAnnotationPropertiesPrompt()`, or `__vaayvuOnboardingOpen('s-499')`.

## Screen `s-500` — document comparison view (documents, phase p26)

Route `vaayvu://documents/s-500`, phase `p26`, category **documents**,
priority **required**, gate `documentCompare`.

- Two user-selected documents bound to hashes and revisions
- Aligned pages and changed/unchanged text spans
- Confidence reported per page; scanned pages labeled low confidence
- Missing extraction produces no OCR or comparison
- Changed source invalidates the previous result

Entry: `vaayvuEvent({ type: 'documentCompare' })`,
`window.__vaayvuDocumentComparePrompt()`, or `__vaayvuOnboardingOpen('s-500')`.

## Screen `s-501` — document save copy review (documents, phase p26)

Route `vaayvu://documents/s-501`, phase `p26`, category **documents**,
priority **required**, gate `documentSave`.

- User-chosen destination and new filename
- Atomic write followed by openability verification
- Original preserved by default; overwrite requires explicit permission
- Flattening permanently removes editable fields and is disclosed
- Unsupported features listed before saving

Entry: `vaayvuEvent({ type: 'documentSave' })`,
`window.__vaayvuDocumentSavePrompt()`, or `__vaayvuOnboardingOpen('s-501')`.

## Screen `s-502` — document signature information (documents, phase p26)

Route `vaayvu://documents/s-502`, phase `p26`, category **documents**,
priority **required**, gate `documentSignature`.

- Verified cryptographic signature distinguished from a drawn mark
- Certificate provenance and signing status shown
- Content changes may invalidate the original signature
- Drawn mark never advertised as legally or cryptographically verified
- Signed originals never silently modified

Entry: `vaayvuEvent({ type: 'documentSignature' })`,
`window.__vaayvuDocumentSignaturePrompt()`, or `__vaayvuOnboardingOpen('s-502')`.

## Screen `s-503` — document unsupported or recovery state (documents, phase p26)

Route `vaayvu://documents/s-503`, phase `p26`, category **documents**,
priority **required**, gate `documentRecovery`.

- Encrypted, corrupt, unsupported, missing-source and save-failure states
- Passwords, DRM and permissions respected; no bypass
- Visible pages render incrementally; obsolete renders cancelled
- Thumbnail rasters bounded; 1000-page documents never allocated at once
- Original preserved through open or save failure

Entry: `vaayvuEvent({ type: 'documentRecovery' })`,
`window.__vaayvuDocumentRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-503')`.

## Screen `s-504` — capture mode chooser (capture, phase p26)

Route `vaayvu://capture/s-504`, phase `p26`, category **capture**,
priority **required**, gate `captureMode`.

- Viewport, selected region or full supported page of the active tab
- Private captures stay temporary until explicit export
- No hidden screenshot or capture of unrelated tabs/windows
- DRM/protected frames stay black and are never reconstructed
- OS/engine capture restrictions respected

Entry: `vaayvuEvent({ type: 'captureMode' })`,
`window.__vaayvuCaptureModePrompt()`, or `__vaayvuOnboardingOpen('s-504')`.

## Screen `s-505` — capture region review (capture, phase p26)

Route `vaayvu://capture/s-505`, phase `p26`, category **capture**,
priority **required**, gate `captureRegion`.

- Bounds clamped to actual content with display scale and scroll state
- Zero-area or invalid selection rejected before allocation
- Irreversible pixel masking applied in the exported copy
- Removable overlay never described as redaction
- Share preview shows exactly what leaves the browser

Entry: `vaayvuEvent({ type: 'captureRegion' })`,
`window.__vaayvuCaptureRegionPrompt()`, or `__vaayvuOnboardingOpen('s-505')`.

## Screen `s-506` — capture annotation editor (capture, phase p26)

Route `vaayvu://capture/s-506`, phase `p26`, category **capture**,
priority **required**, gate `captureAnnotate`.

- Crop, mask and text annotations on the captured image
- Undo edits without touching the original capture
- Tiled processing within memory limits
- Infinite-scroll capture bounded by the explicit user selection
- Cancel never deletes the original capture

Entry: `vaayvuEvent({ type: 'captureAnnotate' })`,
`window.__vaayvuCaptureAnnotatePrompt()`, or `__vaayvuOnboardingOpen('s-506')`.

## Screen `s-507` — print layout editor (capture, phase p26)

Route `vaayvu://capture/s-507`, phase `p26`, category **capture**,
priority **required**, gate `printLayout`.

- Paper, orientation, margins, scaling and page range
- Options mapped to native printing support
- Unsupported sizes labeled unavailable, never substituted
- Preview verifies selected page range and layout
- Preview never claims omitted pages will print

Entry: `vaayvuEvent({ type: 'printLayout' })`,
`window.__vaayvuPrintLayoutPrompt()`, or `__vaayvuOnboardingOpen('s-507')`.

## Screen `s-508` — export destination review (capture, phase p26)

Route `vaayvu://capture/s-508`, phase `p26`, category **capture**,
priority **required**, gate `exportDestination`.

- Format, sanitized filename and full destination path
- Path traversal and unsafe filenames rejected
- Existing files ask before overwrite
- Output verified by actual signature and openability
- Extension rename never described as format conversion

Entry: `vaayvuEvent({ type: 'exportDestination' })`,
`window.__vaayvuExportDestinationPrompt()`, or `__vaayvuOnboardingOpen('s-508')`.

## Screen `s-509` — capture print failure recovery (capture, phase p26)

Route `vaayvu://capture/s-509`, phase `p26`, category **capture**,
priority **required**, gate `captureRecovery`.

- Protected page, allocation limit, printer unavailable and export failure states
- Temporary allocations released on cancel
- Original document/screenshot assets retained
- Private captures temporary until explicit export
- No automatic upload, sync or regular history entry

Entry: `vaayvuEvent({ type: 'captureRecovery' })`,
`window.__vaayvuCaptureRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-509')`.

## Screen `s-510` — download queue manager (downloads, phase p26)

Route `vaayvu://downloads/s-510`, phase `p26`, category **downloads**,
priority **required**, gate `downloadQueue`.

- Active, paused, completed, failed and unsafe items
- Native progress, state and byte counts; estimated totals separated
- Unknown length never shown as a fabricated percentage
- Queue limits without starving a user-selected download
- Canceling one item never stops unrelated downloads

Entry: `vaayvuEvent({ type: 'downloadQueue' })`,
`window.__vaayvuDownloadQueuePrompt()`, or `__vaayvuOnboardingOpen('s-510')`.

## Screen `s-511` — download origin and integrity detail (downloads, phase p26)

Route `vaayvu://downloads/s-511`, phase `p26`, category **downloads**,
priority **required**, gate `downloadOrigin`.

- Committed source origin with spoof warnings
- Expected size, supplied digest and verified bytes
- Hash mismatch can never be labeled complete
- Safe filename parsing; hidden double extensions flagged
- Path traversal and spoofed origins remain warned

Entry: `vaayvuEvent({ type: 'downloadOrigin' })`,
`window.__vaayvuDownloadOriginPrompt()`, or `__vaayvuOnboardingOpen('s-511')`.

## Screen `s-512` — download destination chooser (downloads, phase p26)

Route `vaayvu://downloads/s-512`, phase `p26`, category **downloads**,
priority **required**, gate `downloadDestination`.

- User-chosen directory and explicit conflict policy
- Existing file never overwritten without permission
- Available storage checked; partial file staged then renamed
- Disk-full retains the last valid file and reports failure
- Destination and name previewed before writing

Entry: `vaayvuEvent({ type: 'downloadDestination' })`,
`window.__vaayvuDownloadDestinationPrompt()`, or `__vaayvuOnboardingOpen('s-512')`.

## Screen `s-513` — download resumption review (downloads, phase p26)

Route `vaayvu://downloads/s-513`, phase `p26`, category **downloads**,
priority **required**, gate `downloadResumption`.

- Partial state and reconciled records after restart
- Resume only when the ETag/remote identity matches
- Changed content cannot be appended; explicit restart
- Restart asks first on metered connections
- No silent restart of large transfers

Entry: `vaayvuEvent({ type: 'downloadResumption' })`,
`window.__vaayvuDownloadResumptionPrompt()`, or `__vaayvuOnboardingOpen('s-513')`.

## Screen `s-514` — download quarantine review (downloads, phase p26)

Route `vaayvu://downloads/s-514`, phase `p26`, category **downloads**,
priority **required**, gate `downloadQuarantineReview`.

- Engine/OS threat warning and quarantine state retained
- Safe cancel keeps the file quarantined
- Clearing a list entry is distinct from deleting the file
- Opening a suspect file cannot bypass mandatory checks
- False-positive report reviewed before any release

Entry: `vaayvuEvent({ type: 'downloadQuarantineReview' })`,
`window.__vaayvuDownloadQuarantineReviewPrompt()`, or `__vaayvuOnboardingOpen('s-514')`.

## Screen `s-515` — download failure recovery (downloads, phase p26)

Route `vaayvu://downloads/s-515`, phase `p26`, category **downloads**,
priority **required**, gate `downloadFailure`.

- Exact recoverable network, permission, disk or integrity error
- Partial data retained safely
- Retry or alternate destination offered
- Mobile OS suspension limits communicated
- Never claims saved when the OS denies the write

Entry: `vaayvuEvent({ type: 'downloadFailure' })`,
`window.__vaayvuDownloadFailurePrompt()`, or `__vaayvuOnboardingOpen('s-515')`.

## Screen `s-516` — global media center (media, phase p27)

Route `vaayvu://media/s-516`, phase `p27`, category **media**,
priority **required**, gate `mediaCenter`.

- Actual playing tabs and sources from engine/OS media sessions
- Play/pause, mute and solo controls with clear scope
- Active call audio keeps priority
- PiP availability reported truthfully
- No invented playback status for unsupported sites

Entry: `vaayvuEvent({ type: 'mediaCenter' })`,
`window.__vaayvuMediaCenterPrompt()`, or `__vaayvuOnboardingOpen('s-516')`.

## Screen `s-517` — per-tab media detail (media, phase p27)

Route `vaayvu://media/s-517`, phase `p27`, category **media**,
priority **required**, gate `mediaDetail`.

- Observed resolution and codec from the media session
- Hardware decode with explicit software fallback
- Dropped frames and network status only when measurable
- OS eviction disclosed; no promise of resuming without reload
- Resolution/GPU never guessed from the URL; unsupported codecs not forced

Entry: `vaayvuEvent({ type: 'mediaDetail' })`,
`window.__vaayvuMediaDetailPrompt()`, or `__vaayvuOnboardingOpen('s-517')`.

## Screen `s-518` — media playlist library (media, phase p27)

Route `vaayvu://media/s-518`, phase `p27`, category **media**,
priority **required**, gate `mediaPlaylist`.

- Saved links and metadata with stable IDs
- Offline label only for legally available local items
- Online-only links never shown as offline playable
- Playback order persists
- DRM streams never downloaded or extracted without authorization

Entry: `vaayvuEvent({ type: 'mediaPlaylist' })`,
`window.__vaayvuMediaPlaylistPrompt()`, or `__vaayvuOnboardingOpen('s-518')`.

## Screen `s-519` — playlist editor (media, phase p27)

Route `vaayvu://media/s-519`, phase `p27`, category **media**,
priority **required**, gate `playlistEditor`.

- Validated https source URLs with distinct identities
- Reorder and metadata edits persisted with undo
- Supported playback positions saved per media identity and profile
- Removing an entry never deletes the media file without explicit consent
- Different source revisions do not inherit stale timestamps

Entry: `vaayvuEvent({ type: 'playlistEditor' })`,
`window.__vaayvuPlaylistEditorPrompt()`, or `__vaayvuOnboardingOpen('s-519')`.

## Screen `s-520` — playback compatibility state (media, phase p27)

Route `vaayvu://media/s-520`, phase `p27`, category **media**,
priority **required**, gate `playbackCompat`.

- Licensed DRM capability reported accurately (e.g. Widevine L3, no 4K)
- Unsupported platforms explained; DRM never bypassed
- Codec/hardware decode availability and safe fallback
- Background OS restrictions disclosed
- PiP failure returns to original playback without duplicate audio

Entry: `vaayvuEvent({ type: 'playbackCompat' })`,
`window.__vaayvuPlaybackCompatPrompt()`, or `__vaayvuOnboardingOpen('s-520')`.

## Screen `s-521` — media continuity review (media, phase p27)

Route `vaayvu://media/s-521`, phase `p27`, category **media**,
priority **required**, gate `mediaContinuity`.

- Approved URL and supported playback position transferred to a trusted device
- No raw DRM keys, cookies or protected media transferred
- 4K/8K only where destination and site support it
- Quality and dropped frames measured, never assumed
- Lower resolution cannot be presented as a quality win

Entry: `vaayvuEvent({ type: 'mediaContinuity' })`,
`window.__vaayvuMediaContinuityPrompt()`, or `__vaayvuOnboardingOpen('s-521')`.

## Screen `s-522` — live collaboration status (realtime, phase p27)

Route `vaayvu://realtime/s-522`, phase `p27`, category **realtime**,
priority **required**, gate `collabStatus`.

- Active calls and screen shares from trusted WebRTC/media events
- Capture indicators stay visible even when the tab is hidden
- Committed origin shown; tab titles are never evidence
- Background screen sharing is never silent
- Indicator clears only after the engine confirms capture ended

Entry: `vaayvuEvent({ type: 'collabStatus' })`,
`window.__vaayvuCollabStatusPrompt()`, or `__vaayvuOnboardingOpen('s-522')`.

## Screen `s-523` — call protection detail (realtime, phase p27)

Route `vaayvu://realtime/s-523`, phase `p27`, category **realtime**,
priority **required**, gate `callProtection`.

- Protected workload lease for the active call
- Optional discard, freeze and restart blocked
- CPU and packet-loss stats shown only with provenance
- End call releases the lease explicitly
- OS process termination still disclosed as possible

Entry: `vaayvuEvent({ type: 'callProtection' })`,
`window.__vaayvuCallProtectionPrompt()`, or `__vaayvuOnboardingOpen('s-523')`.

## Screen `s-524` — device selection sheet (realtime, phase p27)

Route `vaayvu://realtime/s-524`, phase `p27`, category **realtime**,
priority **required**, gate `deviceSelection`.

- Microphone, camera and output choices within the authorized call context
- Switching preserves the call where supported
- Device errors and permission limits surfaced honestly
- Persistent unique device IDs not exposed unnecessarily
- Call continues through output/camera changes

Entry: `vaayvuEvent({ type: 'deviceSelection' })`,
`window.__vaayvuDeviceSelectionPrompt()`, or `__vaayvuOnboardingOpen('s-524')`.

## Screen `s-525` — screen share scope review (realtime, phase p27)

Route `vaayvu://realtime/s-525`, phase `p27`, category **realtime**,
priority **required**, gate `screenShareScope`.

- Exact window/tab/display surface shown
- Visible browser-level warning and OS-supported consent
- Untrusted sites cannot silently select the entire display
- Stop request verified before the indicator clears
- Indicator never cleared before actual cessation

Entry: `vaayvuEvent({ type: 'screenShareScope' })`,
`window.__vaayvuScreenShareScopePrompt()`, or `__vaayvuOnboardingOpen('s-525')`.

## Screen `s-526` — connection recovery state (realtime, phase p27)

Route `vaayvu://realtime/s-526`, phase `p27`, category **realtime**,
priority **required**, gate `callRecovery`.

- Network change and call interruption explained
- Safe reconnection on Wi-Fi/cellular change
- Active tab preserved without forced reload
- Unrelated submitted forms never replayed
- Private call metadata kept out of regular history and sync

Entry: `vaayvuEvent({ type: 'callRecovery' })`,
`window.__vaayvuCallRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-526')`.

## Screen `s-527` — collaboration benchmark report (realtime, phase p27)

Route `vaayvu://realtime/s-527`, phase `p27`, category **realtime**,
priority **required**, gate `collabBenchmark`.

- Matched call resolution, participants, duration and network
- CPU, energy and quality measured over the same workload
- Lifecycle: mute, screen share, device change, background
- Different call quality cannot count as an efficiency win
- Interrupted protected call blocks release

Entry: `vaayvuEvent({ type: 'collabBenchmark' })`,
`window.__vaayvuCollabBenchmarkPrompt()`, or `__vaayvuOnboardingOpen('s-527')`.

## Screen `s-528` — extension capability catalog (extensions, phase p28)

Route `vaayvu://extensions/s-528`, phase `p28`, category **extensions**,
priority **required**, gate `extensionCatalog`.

- Installed items with pinned-engine API support, not assumed Chrome parity
- Source and provenance validated through the trusted package mechanism
- Permissions listed per extension
- Unsupported APIs labeled unavailable
- Unrecognized/malformed packages never auto-installed

Entry: `vaayvuEvent({ type: 'extensionCatalog' })`,
`window.__vaayvuExtensionCatalogPrompt()`, or `__vaayvuOnboardingOpen('s-528')`.

## Screen `s-529` — extension permission diff (extensions, phase p28)

Route `vaayvu://extensions/s-529`, phase `p28`, category **extensions**,
priority **required**, gate `extensionPermissionDiff`.

- Current vs new permissions with affected origins
- Exact added access shown before enabling
- Prior verified version stays until approval and load
- New privileges never inherited without explicit approval
- Failed update cannot delete extension data

Entry: `vaayvuEvent({ type: 'extensionPermissionDiff' })`,
`window.__vaayvuExtensionPermissionDiffPrompt()`, or `__vaayvuOnboardingOpen('s-529')`.

## Screen `s-530` — extension site access editor (extensions, phase p28)

Route `vaayvu://extensions/s-530`, phase `p28`, category **extensions**,
priority **required**, gate `extensionSiteAccess`.

- Exact supported host access with once/always/ask duration
- Revocation verified after removal
- Private browsing extensions unavailable without explicit opt-in
- Global wildcard requires separate broad-access review
- Private content never flows into regular extension storage without policy

Entry: `vaayvuEvent({ type: 'extensionSiteAccess' })`,
`window.__vaayvuExtensionSiteAccessPrompt()`, or `__vaayvuOnboardingOpen('s-530')`.

## Screen `s-531` — extension activity inspector (extensions, phase p28)

Route `vaayvu://extensions/s-531`, phase `p28`, category **extensions**,
priority **required**, gate `extensionActivity`.

- Supported CPU/memory accounting with provenance and limitations
- Shared renderer cost never double-counted
- Permission grant/revoke events with timestamps
- One extension disabled for a controlled test without deletion
- Other extensions and browser security unchanged

Entry: `vaayvuEvent({ type: 'extensionActivity' })`,
`window.__vaayvuExtensionActivityPrompt()`, or `__vaayvuOnboardingOpen('s-531')`.

## Screen `s-532` — extension quarantine recovery (extensions, phase p28)

Route `vaayvu://extensions/s-532`, phase `p28`, category **extensions**,
priority **required**, gate `extensionQuarantine`.

- Unsafe/incompatible update disabled with evidence preserved
- No automatic destructive removal
- Verified compatible previous version restored through the supported mechanism
- Suspect code never executed for testing
- Known vulnerable version cannot return as normal stable without review

Entry: `vaayvuEvent({ type: 'extensionQuarantine' })`,
`window.__vaayvuExtensionQuarantinePrompt()`, or `__vaayvuOnboardingOpen('s-532')`.

## Screen `s-533` — extension portability review (extensions, phase p28)

Route `vaayvu://extensions/s-533`, phase `p28`, category **extensions**,
priority **required**, gate `extensionPortability`.

- Supported and unsupported extensions listed per target device
- Metadata-only sync for approved identities; credentials excluded
- Desktop extension parity never claimed by name on mobile
- Rasha operates independently with no vendor blocker package
- Extension availability is not a runtime Rasha requirement

Entry: `vaayvuEvent({ type: 'extensionPortability' })`,
`window.__vaayvuExtensionPortabilityPrompt()`, or `__vaayvuOnboardingOpen('s-533')`.

## Screen `s-534` — web app installation review (webapps, phase p28)

Route `vaayvu://webapps/s-534`, phase `p28`, category **webapps**,
priority **required**, gate `webAppInstall`.

- Committed origin and validated manifest name
- Requested scope, icon and OS support shown
- Install requires explicit user consent; auto-install refused
- Malformed manifest cannot spoof installed identity or add privileges
- Supported capabilities explained before install

Entry: `vaayvuEvent({ type: 'webAppInstall' })`,
`window.__vaayvuWebAppInstallPrompt()`, or `__vaayvuOnboardingOpen('s-534')`.

## Screen `s-535` — installed web apps manager (webapps, phase p28)

Route `vaayvu://webapps/s-535`, phase `p28`, category **webapps**,
priority **required**, gate `installedApps`.

- App identity bound to validated origin, scope and profile
- Launch, permissions and update review
- Unexpected origin/scope change requires review
- Same-title apps cannot overwrite each other
- Removal separates app scope from site-data retention

Entry: `vaayvuEvent({ type: 'installedApps' })`,
`window.__vaayvuInstalledAppsPrompt()`, or `__vaayvuOnboardingOpen('s-535')`.

## Screen `s-536` — web app window settings (webapps, phase p28)

Route `vaayvu://webapps/s-536`, phase `p28`, category **webapps**,
priority **required**, gate `webAppWindow`.

- Supported window mode and shortcuts
- Security origin always visible; escape path to trusted chrome accessible
- Profile/container identity binds the window
- Launch does not leak other profile cookies
- Supported window state restore only

Entry: `vaayvuEvent({ type: 'webAppWindow' })`,
`window.__vaayvuWebAppWindowPrompt()`, or `__vaayvuOnboardingOpen('s-536')`.

## Screen `s-537` — offline web app status (webapps, phase p28)

Route `vaayvu://webapps/s-537`, phase `p28`, category **webapps**,
priority **required**, gate `webAppOffline`.

- Service worker and cache state as reported
- Last successful load and retry
- Offline claimed only for supported routes/caches
- Site-data revocation requires consent and leaves unrelated data
- No guarantee of offline operation for every web app

Entry: `vaayvuEvent({ type: 'webAppOffline' })`,
`window.__vaayvuWebAppOfflinePrompt()`, or `__vaayvuOnboardingOpen('s-537')`.

## Screen `s-538` — web app permission review (webapps, phase p28)

Route `vaayvu://webapps/s-538`, phase `p28`, category **webapps**,
priority **required**, gate `webAppPermissions`.

- Origin-bound grants matching browser permission policy
- Installed status cannot bypass camera/mic/location prompts
- OS-supported notifications only with explicit consent and revocation
- Revocation reflects actual OS/engine state
- No notification request without user intent

Entry: `vaayvuEvent({ type: 'webAppPermissions' })`,
`window.__vaayvuWebAppPermissionsPrompt()`, or `__vaayvuOnboardingOpen('s-538')`.

## Screen `s-539` — web app unavailable or removal state (webapps, phase p28)

Route `vaayvu://webapps/s-539`, phase `p28`, category **webapps**,
priority **required**, gate `webAppRemoval`.

- Unsupported install/update explained
- Bookmark/Home Screen shortcut offered and never labeled a full installed app
- Removal separates the app from site data
- Downloaded files and browsing data never silently deleted
- Cancel retains app, data and files

Entry: `vaayvuEvent({ type: 'webAppRemoval' })`,
`window.__vaayvuWebAppRemovalPrompt()`, or `__vaayvuOnboardingOpen('s-539')`.

## Screen `s-540` — developer studio launcher (devstudio, phase p29)

Route `vaayvu://devstudio/s-540`, phase `p29`, category **devstudio**,
priority **required**, gate `devStudio`.

- Selected target tab and scope
- Native DOM, console, network, storage and profiling tools
- Attach/detach through maintained engine APIs
- Webpages cannot attach to privileged chrome
- Unsupported panels labeled, not simulated

Entry: `vaayvuEvent({ type: 'devStudio' })`,
`window.__vaayvuDevStudioPrompt()`, or `__vaayvuOnboardingOpen('s-540')`.

## Screen `s-541` — network trace workspace (devstudio, phase p29)

Route `vaayvu://devstudio/s-541`, phase `p29`, category **devstudio**,
priority **required**, gate `networkTrace`.

- Engine-reported request method, status and timing
- Cookies, credentials, tokens and queries redacted by default
- Selected-target scope; private traces never auto-persisted or uploaded
- CSS hides are not counted as prevented network requests
- Capture start/stop with memory-only retention until detach

Entry: `vaayvuEvent({ type: 'networkTrace' })`,
`window.__vaayvuNetworkTracePrompt()`, or `__vaayvuOnboardingOpen('s-541')`.

## Screen `s-542` — performance trace workspace (devstudio, phase p29)

Route `vaayvu://devstudio/s-542`, phase `p29`, category **devstudio**,
priority **required**, gate `performanceTrace`.

- Bounded engine instrumentation with explicit start/stop
- Actual CPU tasks and frame timing; no fabricated data
- Trace overhead reported
- Stops on target close or detach; resources released
- Old trace cannot continue silently against a new origin

Entry: `vaayvuEvent({ type: 'performanceTrace' })`,
`window.__vaayvuPerformanceTracePrompt()`, or `__vaayvuOnboardingOpen('s-542')`.

## Screen `s-543` — storage inspection workspace (devstudio, phase p29)

Route `vaayvu://devstudio/s-543`, phase `p29`, category **devstudio**,
priority **required**, gate `storageInspection`.

- Origin-scoped storage for the selected target and profile partition
- Supported read/edit/delete controls
- Exact key/category preview and explicit confirmation before delete
- Other profiles not accessible through the inspector
- No bulk delete without explicit scope; cancel preserves storage

Entry: `vaayvuEvent({ type: 'storageInspection' })`,
`window.__vaayvuStorageInspectionPrompt()`, or `__vaayvuOnboardingOpen('s-543')`.

## Screen `s-544` — remote device debugging review (devstudio, phase p29)

Route `vaayvu://devstudio/s-544`, phase `p29`, category **devstudio**,
priority **required**, gate `remoteDebug`.

- Target device, scoped app and local pairing
- Authenticated narrowly scoped session
- Debug port never public by default
- Closed session tokens cannot reattach silently
- Revoke confirms disconnect and expires access

Entry: `vaayvuEvent({ type: 'remoteDebug' })`,
`window.__vaayvuRemoteDebugPrompt()`, or `__vaayvuOnboardingOpen('s-544')`.

## Screen `s-545` — debug export and detach (devstudio, phase p29)

Route `vaayvu://devstudio/s-545`, phase `p29`, category **devstudio**,
priority **required**, gate `debugExport`.

- Redacted trace exported to a user-chosen destination
- Supported format written and verified by reopening
- Existing traces never overwritten without approval
- Safe detach releases session resources
- Hostile page, private tab and extension boundaries tested; privileged data cannot escape

Entry: `vaayvuEvent({ type: 'debugExport' })`,
`window.__vaayvuDebugExportPrompt()`, or `__vaayvuOnboardingOpen('s-545')`.

## Screen `s-546` — compatibility scenario library (compatlab, phase p29)

Route `vaayvu://compatlab/s-546`, phase `p29`, category **compatlab**,
priority **required**, gate `compatLibrary`.

- Banking, shopping, calls, office, streaming, accessibility and standards fixtures
- Deterministic local fixtures plus authorized live workflows
- Exact build, engine, OS, hardware, flags and fixture revision recorded
- Homepage-only tests cannot certify critical compatibility
- Unknown builds cannot be compared as the same build

Entry: `vaayvuEvent({ type: 'compatLibrary' })`,
`window.__vaayvuCompatLibraryPrompt()`, or `__vaayvuOnboardingOpen('s-546')`.

## Screen `s-547` — site capability report (compatlab, phase p29)

Route `vaayvu://compatlab/s-547`, phase `p29`, category **compatlab**,
priority **required**, gate `siteCapability`.

- Verified WebRTC, WebAuthn, WebGL/WebGPU, Wasm, media and storage support
- Engine version and expected outcome recorded
- Pass, blocked, unsupported, failed and skipped reported separately
- API name presence alone is not compatibility
- Skipped cases never counted as passes

Entry: `vaayvuEvent({ type: 'siteCapability' })`,
`window.__vaayvuSiteCapabilityPrompt()`, or `__vaayvuOnboardingOpen('s-547')`.

## Screen `s-548` — regression comparison workspace (compatlab, phase p29)

Route `vaayvu://compatlab/s-548`, phase `p29`, category **compatlab**,
priority **required**, gate `regressionCompare`.

- Same steps and fixture re-run on prior/current builds
- Failing step and trace attached as evidence
- Task success, visual fidelity and data preservation verified first
- Broken workflow blocks scoring and release
- Live-site drift without reproducible baseline not attributed solely to VAAYVU

Entry: `vaayvuEvent({ type: 'regressionCompare' })`,
`window.__vaayvuRegressionComparePrompt()`, or `__vaayvuOnboardingOpen('s-548')`.

## Screen `s-549` — web standards result explorer (compatlab, phase p29)

Route `vaayvu://compatlab/s-549`, phase `p29`, category **compatlab**,
priority **required**, gate `standardsExplorer`.

- Pinned Web Platform Tests subsets
- Passed, failed and skipped counts with reasons
- Upstream expected failures preserved
- Desktop, iOS/iPadOS and Android tracked separately
- No cherry-picked pass rate; one device cannot certify all platforms

Entry: `vaayvuEvent({ type: 'standardsExplorer' })`,
`window.__vaayvuStandardsExplorerPrompt()`, or `__vaayvuOnboardingOpen('s-549')`.

## Screen `s-550` — compatibility exception review (compatlab, phase p29)

Route `vaayvu://compatlab/s-550`, phase `p29`, category **compatlab**,
priority **required**, gate `compatException`.

- Exact origin/category/expiry for a narrow exception
- Security impact recorded; engine isolation and certificate safety unchanged
- Login, payment, media and document controls tested per category combination
- Blocked checkout or control prevents release
- Exception expiry and review evidence retained

Entry: `vaayvuEvent({ type: 'compatException' })`,
`window.__vaayvuCompatExceptionPrompt()`, or `__vaayvuOnboardingOpen('s-550')`.

## Screen `s-551` — release blocking compatibility report (compatlab, phase p29)

Route `vaayvu://compatlab/s-551`, phase `p29`, category **compatlab**,
priority **required**, gate `compatGate`.

- Severity, owners, device evidence and remediation
- Critical security, data loss or broken core workflow blocks release
- Issues cannot be hidden with UI screens
- Measured supported capabilities and known limitations published
- No universal fastest/safest claim from selective benchmarks

Entry: `vaayvuEvent({ type: 'compatGate' })`,
`window.__vaayvuCompatGatePrompt()`, or `__vaayvuOnboardingOpen('s-551')`.

## Screen `s-552` — benchmark workload designer (benchlab, phase p30)

Route `vaayvu://benchlab/s-552`, phase `p30`, category **benchlab**,
priority **required**, gate `benchWorkload`.

- Same hardware, OS, engine, fixtures, flags and repetitions recorded
- Tab counts 1/5/10/20/50/100 bounded by safe capacity
- Fixed resolution, cache state and cold/warm profiles
- Different resolution/cache states cannot be compared as equivalent
- Failed or OOM runs remain in the report

Entry: `vaayvuEvent({ type: 'benchWorkload' })`,
`window.__vaayvuBenchWorkloadPrompt()`, or `__vaayvuOnboardingOpen('s-552')`.

## Screen `s-553` — benchmark runner dashboard (benchlab, phase p30)

Route `vaayvu://benchlab/s-553`, phase `p30`, category **benchlab**,
priority **required**, gate `benchRunDashboard`.

- Run ID with process metrics and success/fail state
- Time to usable chrome and first navigation measured separately
- Interrupt retains partial results with status
- Official Speedometer and real user tasks
- Splash does not count as usable startup; synthetic score is not universal speed

Entry: `vaayvuEvent({ type: 'benchRunDashboard' })`,
`window.__vaayvuBenchRunnerPrompt()`, or `__vaayvuOnboardingOpen('s-553')`.

## Screen `s-554` — resource comparison explorer (benchlab, phase p30)

Route `vaayvu://benchlab/s-554`, phase `p30`, category **benchlab**,
priority **required**, gate `resourceCompare`.

- Browser/renderer/GPU/utility process metrics with shared accounting
- Shared memory not double-counted; peak and steady state separated
- CPU/GPU and supported energy metrics over matched durations
- MotionMark and real frame traces for visual workloads
- Lower energy from shortened/failed tasks is not a win

Entry: `vaayvuEvent({ type: 'resourceCompare' })`,
`window.__vaayvuResourceComparePrompt()`, or `__vaayvuOnboardingOpen('s-554')`.

## Screen `s-555` — benchmark outlier review (benchlab, phase p30)

Route `vaayvu://benchlab/s-555`, phase `p30`, category **benchlab**,
priority **required**, gate `benchOutliers`.

- Raw samples with median and p95 where meaningful
- Outliers and failed workloads retained with reasons
- Thermal, power, brightness, network, cache and background workload recorded
- No best-only headline without the full distribution
- Uncontrolled OS updates or thermal events tagged invalid and repeated

Entry: `vaayvuEvent({ type: 'benchOutliers' })`,
`window.__vaayvuBenchOutliersPrompt()`, or `__vaayvuOnboardingOpen('s-555')`.

## Screen `s-556` — Rasha matcher microbenchmark (benchlab, phase p30)

Route `vaayvu://benchlab/s-556`, phase `p30`, category **benchlab**,
priority **required**, gate `rashaMicrobench`.

- Original compiler build time and matcher allocations
- Hit/miss lookup latency and index memory bytes
- Coverage, true positives and false positives on independently authored fixtures
- Comparisons require equivalent coverage and FP burden
- Smaller rule list alone is not superior

Entry: `vaayvuEvent({ type: 'rashaMicrobench' })`,
`window.__vaayvuRashaMicrobenchPrompt()`, or `__vaayvuOnboardingOpen('s-556')`.

## Screen `s-557` — competitive evidence release report (benchlab, phase p30)

Route `vaayvu://benchlab/s-557`, phase `p30`, category **benchlab**,
priority **required**, gate `benchRelease`.

- Same-device matched evidence with denominator, dates and versions
- Tradeoffs disclosed together
- Each release compared against its verified baseline with alert thresholds
- Security or functionality regressions cannot be traded for score
- No universal victory or multi-year lead claim

Entry: `vaayvuEvent({ type: 'benchRelease' })`,
`window.__vaayvuBenchReleasePrompt()`, or `__vaayvuOnboardingOpen('s-557')`.

## Screen `s-558` — preset selection studio (appearance, phase p31)

Route `vaayvu://appearance/s-558`, phase `p31`, category **appearance**,
priority **required**, gate `presetStudio`.

- Preset 1 Original (default) and Preset 2 Observatory
- Shared navigation, tabs, menus and real service state
- Preview without committing
- Switching never resets tabs, bookmarks, Rasha rules or preferences
- Saved choice retained across upgrades

Entry: `vaayvuEvent({ type: 'presetStudio' })`,
`window.__vaayvuPresetStudioPrompt()`, or `__vaayvuOnboardingOpen('s-558')`.

## Screen `s-559` — theme scene gallery (appearance, phase p31)

Route `vaayvu://appearance/s-559`, phase `p31`, category **appearance**,
priority **required**, gate `themeGallery`.

- Harbor, Ridge, Dusk and Paper scenes
- Locally bundled assets; no network wallpaper fetch or tracker
- Overview, Reading and Focus share real workspace state
- No fake weather, headlines or protection metrics
- Scene choice applies without changing stored data

Entry: `vaayvuEvent({ type: 'themeGallery' })`,
`window.__vaayvuThemeGalleryPrompt()`, or `__vaayvuOnboardingOpen('s-559')`.

## Screen `s-560` — native material controls (appearance, phase p31)

Route `vaayvu://appearance/s-560`, phase `p31`, category **appearance**,
priority **required**, gate `nativeMaterial`.

- Supported OS materials with opaque high-contrast fallback
- Reduce-transparency and contrast preferences honored
- Safety text stays readable above the approved threshold
- Motion respects system settings; obsolete animation cancelled
- Trusted security prompts never drawn in ornamental glass

Entry: `vaayvuEvent({ type: 'nativeMaterial' })`,
`window.__vaayvuNativeMaterialPrompt()`, or `__vaayvuOnboardingOpen('s-560')`.

## Screen `s-561` — toolbar arrangement editor (appearance, phase p31)

Route `vaayvu://appearance/s-561`, phase `p31`, category **appearance**,
priority **required**, gate `toolbarArrange`.

- Supported commands with accessible names
- Drag/keyboard reordering persisted
- Icon visibility toggles keep accessible labels
- Origin and security controls cannot be removed
- Reset restores toolbar only; history, Rasha rules and data preserved

Entry: `vaayvuEvent({ type: 'toolbarArrange' })`,
`window.__vaayvuToolbarArrangePrompt()`, or `__vaayvuOnboardingOpen('s-561')`.

## Screen `s-562` — responsive chrome preview (appearance, phase p31)

Route `vaayvu://appearance/s-562`, phase `p31`, category **appearance**,
priority **required**, gate `responsiveChrome`.

- Phone, tablet and desktop widths with safe areas
- Four-position tabs with overflow state
- macOS window controls beside tabs; Android/iOS safe areas respected
- Origin and essential navigation never clipped
- No fake system controls conflicting with OS behavior

Entry: `vaayvuEvent({ type: 'responsiveChrome' })`,
`window.__vaayvuResponsiveChromePrompt()`, or `__vaayvuOnboardingOpen('s-562')`.

## Screen `s-563` — appearance fallback state (appearance, phase p31)

Route `vaayvu://appearance/s-563`, phase `p31`, category **appearance**,
priority **required**, gate `appearanceFallback`.

- Unsupported native material falls back to solid high-contrast styling
- Selected theme/placement retained for capable layouts
- Low-power mode reduces effects without losing controls
- Variants: both presets, orientation, light/dark, high contrast
- Fallback never overwrites preference; pixel match is not a usability check

Entry: `vaayvuEvent({ type: 'appearanceFallback' })`,
`window.__vaayvuAppearanceFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-563')`.

## Screen `s-564` — accessibility preference overview (accessibility, phase p31)

Route `vaayvu://accessibility/s-564`, phase `p31`, category **accessibility**,
priority **required**, gate `a11yOverview`.

- Text scaling, contrast, motion, keyboard and assistive-tech status
- Roles, accessible names, state and help on trusted chrome controls
- Origin and security text never truncated below readable size
- 200%+ text remains navigable
- Icon-only controls without accessible names block release

Entry: `vaayvuEvent({ type: 'a11yOverview' })`,
`window.__vaayvuA11yOverviewPrompt()`, or `__vaayvuOnboardingOpen('s-564')`.

## Screen `s-565` — keyboard command editor (accessibility, phase p31)

Route `vaayvu://accessibility/s-565`, phase `p31`, category **accessibility**,
priority **required**, gate `keyboardEditor`.

- Searchable command list with chord assignment
- OS-reserved, duplicate and context-incompatible chords rejected before save
- Keyboard routes for navigation, reorder, menus, dialogs and close/restore
- Reset restores only the selected default shortcut
- No pointer-only critical action

Entry: `vaayvuEvent({ type: 'keyboardEditor' })`,
`window.__vaayvuKeyboardEditorPrompt()`, or `__vaayvuOnboardingOpen('s-565')`.

## Screen `s-566` — assistive navigation guide (accessibility, phase p31)

Route `vaayvu://accessibility/s-566`, phase `p31`, category **accessibility**,
priority **required**, gate `assistiveNav`.

- Screen-reader landmarks and logical focus order
- Focus restored after dialogs, route transitions, errors and tab moves
- Visible/semantic alternatives to long press, swipe and drag
- Focus cannot escape a modal to unrelated content
- No touch-only path for a critical action

Entry: `vaayvuEvent({ type: 'assistiveNav' })`,
`window.__vaayvuAssistiveNavPrompt()`, or `__vaayvuOnboardingOpen('s-566')`.

## Screen `s-567` — language and direction preview (accessibility, phase p31)

Route `vaayvu://accessibility/s-567`, phase `p31`, category **accessibility**,
priority **required**, gate `languagePreview`.

- Locale, Telugu and other scripts rendered locally
- RTL mirroring keeps canonical host and trusted direction readable
- Bidi controls cannot obscure or spoof the registrable host
- Enter during IME composition finalizes text, never premature search
- Resource keys, pluralization and locale formatting

Entry: `vaayvuEvent({ type: 'languagePreview' })`,
`window.__vaayvuLanguagePreviewPrompt()`, or `__vaayvuOnboardingOpen('s-567')`.

## Screen `s-568` — accessibility audit report (accessibility, phase p31)

Route `vaayvu://accessibility/s-568`, phase `p31`, category **accessibility**,
priority **required**, gate `a11yAudit`.

- Journey results with expected labels
- VoiceOver, TalkBack and desktop screen-reader evidence
- Accessible contrast and logical touch targets verified
- Automated scanner alone cannot certify usability
- Glass or styling cannot reduce safety text below the approved threshold

Entry: `vaayvuEvent({ type: 'a11yAudit' })`,
`window.__vaayvuA11yAuditPrompt()`, or `__vaayvuOnboardingOpen('s-568')`.

## Screen `s-569` — accessibility fallback state (accessibility, phase p31)

Route `vaayvu://accessibility/s-569`, phase `p31`, category **accessibility**,
priority **required**, gate `a11yFallback`.

- Unsupported gesture/material state explained
- Visible and semantic equivalent offered
- Selected preference retained for capable devices
- Fallback never removes capability or resets unrelated settings

Entry: `vaayvuEvent({ type: 'a11yFallback' })`,
`window.__vaayvuA11yFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-569')`.

## Screen `s-570` — mobile tab overview controls (mobile, phase p32)

Route `vaayvu://mobile/s-570`, phase `p32`, category **mobile**,
priority **required**, gate `mobileTabs`.

- Grid/list switch with the same stable tab objects
- Groups, active tab and search
- Private titles never shown in the regular grid
- New/select/close/group reachable with many tabs and safe areas
- Close supports undo; view switch never duplicates tabs

Entry: `vaayvuEvent({ type: 'mobileTabs' })`,
`window.__vaayvuMobileTabsPrompt()`, or `__vaayvuOnboardingOpen('s-570')`.

## Screen `s-571` — tablet split layout editor (mobile, phase p32)

Route `vaayvu://mobile/s-571`, phase `p32`, category **mobile**,
priority **required**, gate `tabletSplit`.

- Engine/OS supported panes with minimum usable width
- Keyboard focus, shortcuts and pointer share one action registry
- Safe-area aware panes
- Unsupported split falls back without faking concurrent rendering
- No pointer-only critical control

Entry: `vaayvuEvent({ type: 'tabletSplit' })`,
`window.__vaayvuTabletSplitPrompt()`, or `__vaayvuOnboardingOpen('s-571')`.

## Screen `s-572` — mobile address placement controls (mobile, phase p32)

Route `vaayvu://mobile/s-572`, phase `p32`, category **mobile**,
priority **required**, gate `mobileAddress`.

- Top or bottom address placement with reachability
- Origin and security controls always visible
- Back and new-tab actions never concealed in compact layout
- Accessible tap targets and search submit controls
- Keyboard and notch cannot hide essential chrome

Entry: `vaayvuEvent({ type: 'mobileAddress' })`,
`window.__vaayvuMobileAddressPrompt()`, or `__vaayvuOnboardingOpen('s-572')`.

## Screen `s-573` — window posture transition state (mobile, phase p32)

Route `vaayvu://mobile/s-573`, phase `p32`, category **mobile**,
priority **required**, gate `postureTransition`.

- Rotation and fold restore active tab, scroll metadata and selected space
- Preferred layout reapplied on resize
- Supported iPad/Android multiwindow only
- Recreating UI never resets the browsing session
- No universal desktop-style multitasking promise on phones

Entry: `vaayvuEvent({ type: 'postureTransition' })`,
`window.__vaayvuPostureTransitionPrompt()`, or `__vaayvuOnboardingOpen('s-573')`.

## Screen `s-574` — mobile background recovery (mobile, phase p32)

Route `vaayvu://mobile/s-574`, phase `p32`, category **mobile**,
priority **required**, gate `mobileRecovery`.

- OS suspension/eviction explained
- Minimal safe metadata retained; reload needs stated
- Device pressure handled; active work protected where OS permits
- No guarantee of live renderer state after an OS kill
- No reload-free claim without measured evidence

Entry: `vaayvuEvent({ type: 'mobileRecovery' })`,
`window.__vaayvuMobileRecoveryPrompt()`, or `__vaayvuOnboardingOpen('s-574')`.

## Screen `s-575` — platform capability review (mobile, phase p32)

Route `vaayvu://mobile/s-575`, phase `p32`, category **mobile**,
priority **required**, gate `platformCapability`.

- Supported native gestures, keyboard, downloads and blocker features
- Unavailable features listed explicitly
- Default browser only through OS-supported user choice
- Same feature slice run on phone and tablet physical devices
- Emulator-only results cannot certify hardware media or energy

Entry: `vaayvuEvent({ type: 'platformCapability' })`,
`window.__vaayvuPlatformCapabilityPrompt()`, or `__vaayvuOnboardingOpen('s-575')`.

## Screen `s-576` — native window arrangement (desktop, phase p32)

Route `vaayvu://desktop/s-576`, phase `p32`, category **desktop**,
priority **required**, gate `windowArrange`.

- Stable window and profile IDs
- Supported geometry per display
- Restore clamped to available displays and safe areas
- Closing one window never erases another window state
- No unreachable saved window

Entry: `vaayvuEvent({ type: 'windowArrange' })`,
`window.__vaayvuWindowArrangePrompt()`, or `__vaayvuOnboardingOpen('s-576')`.

## Screen `s-577` — desktop titlebar controls (desktop, phase p32)

Route `vaayvu://desktop/s-577`, phase `p32`, category **desktop**,
priority **required**, gate `titlebarControls`.

- Native traffic lights/window controls remain reachable
- Tabs placed beside controls with safe drag regions
- Supported Snap/compositor behavior only
- Native caption and accessibility behavior preserved
- No emulation of unsupported OS features

Entry: `vaayvuEvent({ type: 'titlebarControls' })`,
`window.__vaayvuTitlebarControlsPrompt()`, or `__vaayvuOnboardingOpen('s-577')`.

## Screen `s-578` — window snapshot review (desktop, phase p32)

Route `vaayvu://desktop/s-578`, phase `p32`, category **desktop**,
priority **required**, gate `windowSnapshot`.

- Safe geometry and tab/pane metadata saved
- Active pane restored first
- Private page data and secret form contents excluded
- Fullscreen keeps trusted escape controls reachable
- Restore clamped to visible displays

Entry: `vaayvuEvent({ type: 'windowSnapshot' })`,
`window.__vaayvuWindowSnapshotPrompt()`, or `__vaayvuOnboardingOpen('s-578')`.

## Screen `s-579` — desktop integration settings (desktop, phase p32)

Route `vaayvu://desktop/s-579`, phase `p32`, category **desktop**,
priority **required**, gate `desktopIntegration`.

- Default browser and protocol registration through OS prompts after user choice
- Existing associations never silently overridden
- Dock/taskbar and supported shortcuts
- Dropped/opened files validated and scoped to the profile
- No arbitrary path traversal or privileged code

Entry: `vaayvuEvent({ type: 'desktopIntegration' })`,
`window.__vaayvuDesktopIntegrationPrompt()`, or `__vaayvuOnboardingOpen('s-579')`.

## Screen `s-580` — desktop platform fallback (desktop, phase p32)

Route `vaayvu://desktop/s-580`, phase `p32`, category **desktop**,
priority **required**, gate `desktopFallback`.

- Missing display/compositor falls back to solid bounded layout
- Saved window preference retained
- Window/tab commands dispatch to the actual focused window and profile
- Background update never steals focus
- Unsupported Snap/material not emulated

Entry: `vaayvuEvent({ type: 'desktopFallback' })`,
`window.__vaayvuDesktopFallbackPrompt()`, or `__vaayvuOnboardingOpen('s-580')`.

## Screen `s-581` — desktop build capability report (desktop, phase p32)

Route `vaayvu://desktop/s-581`, phase `p32`, category **desktop**,
priority **required**, gate `desktopBuild`.

- Apple Silicon and x64 architectures listed separately
- Declared and tested OS support
- Signed/notarized package and exact engine revision
- Native tests: resize, fullscreen, display removal, controls, shortcuts, crash recovery
- Unsupported builds not called universally installable; visual preview insufficient

Entry: `vaayvuEvent({ type: 'desktopBuild' })`,
`window.__vaayvuDesktopBuildPrompt()`, or `__vaayvuOnboardingOpen('s-581')`.

## Screen `s-582` — managed policy overview (policy, phase p33)

Route `vaayvu://policy/s-582`, phase `p33`, category **policy**,
priority **required**, gate `policyOverview`.

- Policy source (device management/enrollment) shown; signed payload only
- Applied policy count, last refresh and read-only managed values
- Conflicts surfaced for review
- Local UI cannot override managed values
- Compliance is never fabricated; no plaintext secrets in source detail

Entry: `vaayvuEvent({ type: 'policyOverview' })`,
`window.__vaayvuPolicyOverviewPrompt()`, or `__vaayvuOnboardingOpen('s-582')`.

## Screen `s-583` — policy value detail (policy, phase p33)

Route `vaayvu://policy/s-583`, phase `p33`, category **policy**,
priority **required**, gate `policyDetail`.

- Exact key, type and effective value
- Source and machine/user precedence shown
- Scope across profiles on the device
- Managed values cannot be overridden from the UI
- Unknown keys preserved and listed, never guessed

Entry: `vaayvuEvent({ type: 'policyDetail' })`,
`window.__vaayvuPolicyDetailPrompt()`, or `__vaayvuOnboardingOpen('s-583')`.

## Screen `s-584` — policy conflict review (policy, phase p33)

Route `vaayvu://policy/s-584`, phase `p33`, category **policy**,
priority **required**, gate `policyConflict`.

- Conflicting machine and user policy sources shown side by side
- Resolution follows documented precedence
- Conflict recorded and visible to the user
- No arbitrary pick; conflicts cannot be hidden

Entry: `vaayvuEvent({ type: 'policyConflict' })`,
`window.__vaayvuPolicyConflictPrompt()`, or `__vaayvuOnboardingOpen('s-584')`.

## Screen `s-585` — managed extension allowlist (policy, phase p33)

Route `vaayvu://policy/s-585`, phase `p33`, category **policy**,
priority **required**, gate `policyExtensions`.

- Policy allowlist with validated extension identities
- Force-installed items cannot be removed locally
- Blocked identities cannot be installed
- Unknown packages never installed automatically
- User installs limited to approved sources

Entry: `vaayvuEvent({ type: 'policyExtensions' })`,
`window.__vaayvuPolicyExtensionsPrompt()`, or `__vaayvuOnboardingOpen('s-585')`.

## Screen `s-586` — startup, homepage and new-tab policy (policy, phase p33)

Route `vaayvu://policy/s-586`, phase `p33`, category **policy**,
priority **required**, gate `policyStartup`.

- Managed startup pages, homepage and new-tab destination
- Values read-only; local override not offered
- Only https destinations accepted by policy validation
- Javascript and non-https URLs rejected
- Refresh does not alter destinations

Entry: `vaayvuEvent({ type: 'policyStartup' })`,
`window.__vaayvuPolicyStartupPrompt()`, or `__vaayvuOnboardingOpen('s-586')`.

## Screen `s-587` — proxy and certificate policy (policy, phase p33)

Route `vaayvu://policy/s-587`, phase `p33`, category **policy**,
priority **required**, gate `policyNetwork`.

- Managed proxy/PAC and bypass list
- Policy-installed trusted certificate authorities
- Certificate validation remains mandatory
- Proxy cannot be bypassed locally
- Unapproved CAs cannot be installed

Entry: `vaayvuEvent({ type: 'policyNetwork' })`,
`window.__vaayvuPolicyNetworkPrompt()`, or `__vaayvuOnboardingOpen('s-587')`.

## Screen `s-588` — managed browser enrollment status (policy, phase p33)

Route `vaayvu://policy/s-588`, phase `p33`, category **policy**,
priority **required**, gate `policyEnrollment`.

- Enrolled/unmanaged state with management service
- Signed last check-in and policy channel
- Device identifier scoped to management, not exposed to sites
- Enrollment cannot be fabricated
- Unenrollment is an OS action and preserves browsing data

Entry: `vaayvuEvent({ type: 'policyEnrollment' })`,
`window.__vaayvuPolicyEnrollmentPrompt()`, or `__vaayvuOnboardingOpen('s-588')`.

## Screen `s-589` — kiosk mode review (policy, phase p33)

Route `vaayvu://policy/s-589`, phase `p33`, category **policy**,
priority **required**, gate `kioskMode`.

- Restricted single-surface kiosk with managed URL
- No new tabs, downloads or settings access
- Exit control visible and management-authorized
- Enforcement only where the OS supports it
- No faked kiosk enforcement

Entry: `vaayvuEvent({ type: 'kioskMode' })`,
`window.__vaayvuKioskModePrompt()`, or `__vaayvuOnboardingOpen('s-589')`.

## Screen `s-590` — policy audit log (policy, phase p33)

Route `vaayvu://policy/s-590`, phase `p33`, category **policy**,
priority **required**, gate `policyAudit`.

- Local events for policy apply, conflict and enrollment refresh
- Bounded 30-day retention
- Secrets, page content and private browsing excluded
- Redacted JSON export to a user-chosen destination

Entry: `vaayvuEvent({ type: 'policyAudit' })`,
`window.__vaayvuPolicyAuditPrompt()`, or `__vaayvuOnboardingOpen('s-590')`.

## Screen `s-591` — policy diagnostics export (policy, phase p33)

Route `vaayvu://policy/s-591`, phase `p33`, category **policy**,
priority **required**, gate `policyDiagnostics`.

- Bundle with policy IDs, effective values, conflicts and enrollment state
- Tenant secrets, tokens and user data excluded
- User-chosen destination; file reopened and verified
- Existing files never overwritten without approval

Entry: `vaayvuEvent({ type: 'policyDiagnostics' })`,
`window.__vaayvuPolicyDiagnosticsPrompt()`, or `__vaayvuOnboardingOpen('s-591')`.

## Screen `s-592` — policy-protected downloads (policy, phase p33)

Route `vaayvu://policy/s-592`, phase `p33`, category **policy**,
priority **required**, gate `policyDownloads`.

- Managed denylist for dangerous file types
- Engine/OS scan before open where available
- Managed download directory while enrolled
- Restrictions and scanning cannot be bypassed locally

Entry: `vaayvuEvent({ type: 'policyDownloads' })`,
`window.__vaayvuPolicyDownloadsPrompt()`, or `__vaayvuOnboardingOpen('s-592')`.

## Screen `s-593` — managed printing policy (policy, phase p33)

Route `vaayvu://policy/s-593`, phase `p33`, category **policy**,
priority **required**, gate `policyPrinting`.

- Managed allowlist of printers
- Required organization header
- Managed PDF/export destination
- Denied printers or export types cannot be added locally
- Export restrictions cannot be bypassed

Entry: `vaayvuEvent({ type: 'policyPrinting' })`,
`window.__vaayvuPolicyPrintingPrompt()`, or `__vaayvuOnboardingOpen('s-593')`.

## Screen `s-594` — managed bookmarks and shortcuts (policy, phase p33)

Route `vaayvu://policy/s-594`, phase `p33`, category **policy**,
priority **required**, gate `policyBookmarks`.

- Policy-managed bookmark folder with pinned position
- Entries read-only; user cannot rename, move or delete
- Managed entries excluded from personal sync
- Folder cannot be hidden while policy applies

Entry: `vaayvuEvent({ type: 'policyBookmarks' })`,
`window.__vaayvuPolicyBookmarksPrompt()`, or `__vaayvuOnboardingOpen('s-594')`.

## Screen `s-595` — managed password manager policy (policy, phase p33)

Route `vaayvu://policy/s-595`, phase `p33`, category **policy**,
priority **required**, gate `policyPasswords`.

- Password manager enabled/disabled and OS-backed vault status
- Autofill and import rules from policy
- Vault export denied when policy requires it
- Managed values cannot be bypassed locally
- No plaintext export

Entry: `vaayvuEvent({ type: 'policyPasswords' })`,
`window.__vaayvuPolicyPasswordsPrompt()`, or `__vaayvuOnboardingOpen('s-595')`.

## Screen `s-596` — policy-managed safe browsing level (policy, phase p33)

Route `vaayvu://policy/s-596`, phase `p33`, category **policy**,
priority **required**, gate `policySafeBrowsing`.

- Managed security level (e.g. Enhanced)
- Mandatory Rasha blocks never disabled by level
- Certificate validation always enforced
- Managed value cannot be downgraded locally

Entry: `vaayvuEvent({ type: 'policySafeBrowsing' })`,
`window.__vaayvuPolicySafeBrowsingPrompt()`, or `__vaayvuOnboardingOpen('s-596')`.

## Screen `s-597` — policy-based update channel lock (policy, phase p33)

Route `vaayvu://policy/s-597`, phase `p33`, category **policy**,
priority **required**, gate `policyUpdates`.

- Managed update channel locked by policy
- Automatic security updates and critical patch priority
- Restart deferral capped by policy
- Channel and limits not editable locally

Entry: `vaayvuEvent({ type: 'policyUpdates' })`,
`window.__vaayvuPolicyUpdatesPrompt()`, or `__vaayvuOnboardingOpen('s-597')`.

## Screen `s-598` — policy compliance summary (policy, phase p33)

Route `vaayvu://policy/s-598`, phase `p33`, category **policy**,
priority **required**, gate `policyCompliance`.

- Passing checks require signed check-in and local policy state
- Pending checks surface the required action
- Unknown checks are not counted as passes
- Re-evaluation keeps pending/unknown visible

Entry: `vaayvuEvent({ type: 'policyCompliance' })`,
`window.__vaayvuPolicyCompliancePrompt()`, or `__vaayvuOnboardingOpen('s-598')`.

## Screen `s-599` — policy removal / unmanaged transition (policy, phase p33)

Route `vaayvu://policy/s-599`, phase `p33`, category **policy**,
priority **required**, gate `policyRemoval`.

- Removal only after the OS reports the management source gone
- Managed values revert to local defaults or retained user choices
- Tabs, bookmarks and settings preserved
- Read-only flags cleared after verified removal
- Removal recorded locally; no destructive erase

Entry: `vaayvuEvent({ type: 'policyRemoval' })`,
`window.__vaayvuPolicyRemovalPrompt()`, or `__vaayvuOnboardingOpen('s-599')`.

## Screen `s-600` — captive portal connectivity check (connectivity, phase p34)

Route `vaayvu://connectivity/s-600`, phase `p34`, category **connectivity**,
priority **required**, gate `captivePortal`.

- Captive-portal probe distinguishes online, portal and offline
- Portal opens in a separate tab with the plain-HTTP warning
- No credential autofill or automatic submission
- Portal URL disclosed; probe state can be rechecked

Entry: `vaayvuEvent({ type: 'captivePortal' })`,
`window.__vaayvuCaptivePortalPrompt()`, or `__vaayvuOnboardingOpen('s-600')`.

## Screens `s-601` – `s-623` — final atlas ranges

Routes: `vaayvu://connectivity/…` (s-601–s-605), `vaayvu://support/…`
(s-606–s-611), `vaayvu://data/…` (s-612–s-617) and
`vaayvu://performance-guard/…` (s-618–s-623).

Each screen has a unique gate (`card601`–`card623`), a real renderer with
rows and controls, and stateful status messages. Highlights:

- **s-601–s-605**: portal isolation, DNS fallback, proxy auth, offline cache
  honesty, redacted connectivity export.
- **s-606–s-611**: redacted support bundle, safe mode, measured health,
  bounded log retention, consented remote support, incident timeline.
- **s-612–s-617**: retention window, cookie/cache inspectors, autofill
  (CVC never stored), site-data export, explicit clear review.
- **s-618–s-623**: startup/tab budgets, memory alerts, background limits,
  regression gate, measured resource report.

Entry: `__vaayvuAtlasCardPrompt('s-6xx')` or `__vaayvuOnboardingOpen('s-6xx')`.

## Screens `a-001` – `a-032` — ads and rewards

Routes: `vaayvu://ads/<id>` for user surfaces (`a-001`–`a-019`) and
`vaayvu://campaigns/<id>` for operator surfaces (`a-020`–`a-032`).
Phases follow the atlas (`p36`–`p39`); all are required and have gates
`ad001`–`ad032`.

- **a-001–a-008**: consent, terms, eligibility, sponsored card, why-this-ad,
  reporting, advertiser exclusions.
- **a-009–a-019**: ledger balances, receipts, pending earnings, payout method,
  identity handoff, payout review, provider states, appeals, statements, exit.
- **a-020–a-027**: advertiser verification, briefs, creative review, budgets,
  inventory authorization, delivery diagnostics, fraud review.
- **a-028–a-032**: reconciliation, pool approval, payout operations, kill
  switch, release evidence.

Entry: `__vaayvuAdsPrompt('a-001')` or `__vaayvuOnboardingOpen('a-001')`.

## Step `s-011` — privacy setup

Route `vaayvu://onboarding/s-011`, phase `p00`, category onboarding,
capability-gated, core priority. Shown after s-002 on every platform
(desktop, Apple, Android); the chain is s-001 → s-002 → s-011 → browser.
The screen heading changes to "Privacy setup" while it is on screen.

| Control | Wiring | Effect |
|---|---|---|
| **Search engine** (DuckDuckGo / Google / Bing) | `VaayvuPreferences.commit({ searchProvider })` | address-bar searches use the chosen provider |
| **Shield level** (Standard / Strong) | `adBlockConfig.lists.aggressive` + `write` + `sendBlocklist(true)` | Strong adds same-site ad paths and YouTube ads; the blocklist is pushed immediately |
| **Anonymous usage data** | `VaayvuPreferences.commit({ telemetryConsent })` | consent is stored on the device. **No data is sent from this build — there is no telemetry backend yet**; reporting ships with a future update |
| **DNS settings** | `command('dnsSettings')` → OS deep link | capability-gated row (`canDnsSettings`): Windows opens `ms-settings:network-dns`, Android opens network settings where Private DNS lives. Not emitted on iOS/macOS, so the row is hidden there |

**Continue** advances to s-012. **Back** returns to s-002; nothing is
recorded until the flow finishes.

## Step `s-012` — appearance setup

Route `vaayvu://onboarding/s-012`, phase `p00`, category onboarding,
capability-gated rows, core priority. Shown after s-011 on every platform;
the chain is s-001 → s-002 → s-011 → s-012 → s-015 → browser. The screen heading
changes to "Appearance setup" while it is on screen.

| Control | Wiring | Effect |
|---|---|---|
| **Theme** (Follow device / Light / Dark) | `VaayvuPreferences.commit({ theme })` | `commit` applies it immediately (`applyTheme`) |
| **Tab position** (Top / Bottom / Left / Right) | `commit({ tabPosition })` + `render(true)` | desktop-only row (same `desktop` gate as Settings: hidden on iOS, Android and narrow layouts); `render → drawRail → renderBrowserBars` repositions the tab strip at once |
| **Accent** (Aurora / Ember / Forest / Ocean / Rose / Graphite) | active space theme via `VaayvuSpaces.update` + `saveSpaces` + `applySpaceTheme` | the space accent store the space editor uses; row hidden when spaces are unavailable (e.g. private windows) |
| **Wallpaper** (Observatory / Ridge / Dusk / Paper / Alpine dusk / Soft gradient) | `commit({ wallpaper })` + `applyTheme` | `commit` does not repaint the start page, so `applyTheme` re-reads `settings.wallpaper` onto `document.body` |

Accent and tab-position lists come from `VaayvuSpaces.THEME_IDS` / `THEMES`
and the same choices maps the Settings dialog uses — no duplicated copies.

**Continue** advances to s-015. **Back** returns to s-011.

## Step `s-015` — setup checklist

Route `vaayvu://onboarding/s-015`, phase `p00`, category onboarding,
capability-gated rows, core priority. Shown after s-012 on every platform;
the chain is s-001 → s-002 → s-011 → s-012 → s-015 → browser. The screen
heading changes to "Onboarding checklist" while it is on screen.

Each row opens the surface that already exists in the browser, and the
completion marks are read from live device state — a row is never marked
done because the user clicked it:

| Row | Action | Mark source |
|---|---|---|
| **Import bookmarks** | `command('bookmarkImport')` → native file picker | `bookmarks` list is non-empty (`Imported`) |
| **Sync with Vaayvu ID** | `command('account')` → sign-in sheet | `sync.session` is set (`Signed in`); hidden when the shared sync client is unavailable |
| **Set Vaayvu as default** | `command('requestDefaultBrowser')` → OS deep link (RoleManager / Settings) | none — the OS owns this setting and the page cannot read it back, so the row stays actionable and never claims success; hidden where `canDefaultBrowser` is false (currently macOS) |
| **Import passwords** | hidden CSV picker read with `file.text()`, parsed by the built-in RFC 4180 reader, merged into the same local store the Passwords dialog uses (`site` + `username` identity) | saved-password count (`N saved`); hidden unless `canImportPasswords` |
| **Add an extension** | `command('extensions')` → style-extension manager | installed `vaayvu.styleExtension.*` packages (`Added`); hidden unless `canUserStyles` |

The importer accepts the CSV layouts browsers export (column order is read
from the header, so `name,url,username,password` and Firefox/Safari's
`url,username,password,…` both work), decodes doubled quotes, caps a file at
2000 rows and updates instead of duplicating on re-import. Passwords are
stored locally in the existing app store — the same plaintext-on-device model
as the Passwords dialog, which the flow links to for system-managed
credentials.

When the shell regains focus (file picker closed, sign-in returned, OS
settings left), the screen re-renders so the marks reflect what actually
happened.

**Continue** advances to s-051. **Back** returns to s-012.

## Step `s-051` — start page defaults

Route `vaayvu://start-page/s-051`, phase **`p05`** (the earlier screens are
`p00`; `html[data-onboarding-phase]` and the completion record switch to
`p05` here), category onboarding, capability-gated, core priority. Shown
after s-015 on every platform; the chain is
s-001 → s-002 → s-011 → s-012 → s-015 → s-051 → browser. The heading is
"Your start page".

The screen previews the real start page rather than inventing settings:

| Element | Source | Behaviour |
|---|---|---|
| **Logo** | `assets/vaayvu.svg` + wordmark | same mark the Observatory hero renders |
| **Search** | `VaayvuPreferences` provider list + `commit({ searchProvider })` | changes the engine the start page and address bar use; row hidden if the preferences module is unavailable |
| **Shortcuts** | live `favorites` array (defaults to the four built-in shortcuts) | read-only tiles; editing stays in the start-page favorites editor, so there are no dead buttons inside the overlay; hidden if favorites are unavailable |
| **Reading list** | live `read('reading', [])` count | shows the saved-page count or an explanatory line; hidden if the reading store is unavailable |
| **Continue** | `finish('done')` | completes onboarding with `route: vaayvu://start-page/s-051`, `phase: p05`, `steps` including all six screens and the truthful `checklist` snapshot |

**Back** returns to s-015.

## Step `s-003` — default-browser request (re-prompt only)

Route `vaayvu://onboarding/s-003`, phase `p00`, category onboarding,
capability-gated, core priority.

**Navigation from s-002 was removed by request:** `Get started` on s-002
completes the first-run flow directly, on every platform. The s-003 screen
itself is fully intact and is reached **only through the deferred re-prompt**
below (or a direct render in tests). Whenever it appears it still requires
`capabilities.canDefaultBrowser` — a platform without a supported OS request
completes immediately with `defaultBrowser: "unsupported"` rather than showing
a button that cannot work. The capability matrix:

| Platform | Capability | Deep link |
|---|---|---|
| Android | `canDefaultBrowser` from `RoleManager.isRoleAvailable(ROLE_BROWSER)` | `createRequestRoleIntent(ROLE_BROWSER)` system dialog |
| iOS / iPadOS | `canDefaultBrowser: true` | `UIApplication.openSettingsURLString` → Settings → Vaayvu, where the system default-browser picker lives |
| Windows | `canDefaultBrowser: process.platform === 'win32'` | `shell.openExternal('ms-settings:defaultapps')` |
| macOS / Linux | not emitted | no supported programmatic request — a re-prompt there completes with `unsupported` |

- **Value prop explainer** — links open in Vaayvu, Rasha Shield protects every
  link, changeable any time in device settings.
- **Set as default** — runs `command('requestDefaultBrowser')` (the real OS
  request) and completes with `defaultBrowser: "requested"`. The screen ends
  immediately so the browser is ready when the user returns from the system UI.
- **Not now** — completes with `defaultBrowser: "deferred"`,
  `deferredAt: now` and `defaultBrowserPrompts` incremented.

Because first-run navigation no longer reaches s-003, a fresh install never
writes a `deferred` record; the screen stays dormant until a profile that
deferred under an earlier build reaches its re-prompt window.

### Re-prompt logic

`chrome/boot.js` re-opens **only s-003** when all three hold:

1. the record says `defaultBrowser === "deferred"`,
2. at least **7 days** have passed since `deferredAt`,
3. `defaultBrowserPrompts < 3`.

The re-prompt bypasses the returning-user and upgrade checks (the profile is
complete — only the ask comes back), keeps the crash-loop attempt counter, and
preserves the earlier record's `steps` and `categories`. A granted
(`"requested"`) ask never re-prompts.

## State record

`localStorage['vaayvu.onboarding']`:

```json
{ "route": "vaayvu://onboarding/s-003", "phase": "p00",
  "status": "done|skipped", "steps": ["s-001", "s-002", "s-003"],
  "categories": { "ads": true, "...": true },
  "defaultBrowser": "requested|deferred", "defaultBrowserPrompts": 1,
  "deferredAt": 1764000000000, "completedAt": 1764000000000 }
```

A skip at s-001 records `route: vaayvu://onboarding/s-001`,
`steps: ["s-001"]` and no `categories` key. A flow that ends at s-002
(capability absent) records `route: vaayvu://onboarding/s-002` and no
`defaultBrowser` key.

The route and phase are also mirrored on the document as
`html[data-onboarding-route]` / `html[data-onboarding-phase]` while the splash
is up, so native tooling and tests can read them without touching storage.

## Tests

- `tests/onboarding.test.cjs` — 9 cases: new install, returning user,
  upgrade (both key generations), crash-loop counter and skip, automation,
  boot-timeout watchdog both ways, hostile storage.
- `tests/onboarding-steps.test.cjs` — 112 cases: s-001 render, Continue
  applies categories and advances, capability gating, import/sync commands,
  Get started advances to s-011 on every platform, Back with picks preserved, Skip short-circuits, ready-time
  re-render, s-011 render/navigation/DNS gate/controls writing real settings,
  s-012 render/gating/controls writing real settings,
  s-015 render/gating/actions/live marks, password CSV import (quotes,
  re-import dedupe, empty file), s-051 render/gating/search commit,
  s-004 eleven sources/gating/export steps/CSV groups/Back to opener,
  s-005 idle/partial/clean/password/cancel/gating/return,
  s-006 idle/counts/reasons/inline fixes/clean/unrecognised/return,
  s-007 create/pair/skip, no-client and India-only notes, connected state,
  s-008 method availability/password registration/no-client/India-only/
  signed-in/return, s-009 method availability/password sign-in/no-client/
  India-only/signed-in/return, s-010 no-phrase/24 words/copy/print/3-word
  confirm/wrong words/lost/incomplete/return, s-013 full walk/per-device
  gating/back/done, s-014 primer/native hand-off/no-grant-claim/unsupported/
  return, s-019 gating/render/disable/reset confirm/continue/event priority,
  Back between steps,
  s-003 set-default and deferral through the re-prompt,
  re-prompt with progress preserved, incapable-platform completion.
- `tests/window-chrome-s045.test.cjs` — 7 jump-list cases: route, recent,
  tasks, taskbar toggle, gating, Continue and event entry.
- `tests/tabs-s081.test.cjs` — 9 mobile-grid cases: route/phase, grouped
  cards, private view, close all in both views, restore, selection, gating and
  event entry.
- `tests/content-s104.test.cjs` — 10 out-of-memory cases: route/phase/category,
  meter and heavy tabs, Close tabs, last-tab guard, Reload, Report, Reset,
  gating and event entry.
- `tests/content-s102.test.cjs` — 10 certificate cases: route/phase/category,
  host fields, Why, Advanced, guarded proceed, report, reset, gating and event
  entry.
- `tests/content-s098.test.cjs` — 9 history-menu cases: route/phase/category,
  back titles, Forward, long-press full history, full toggle, jump, gating and
  event entry.
- `tests/tabs-s092.test.cjs` — 8 private-tab cases: route/phase, private
  styling, 0-entry history, new tab, close/reopen, gating and event entry.
- `tests/tabs-s090.test.cjs` — 8 memory-panel cases: route/phase, per-tab
  RAM, discard, reload, protect, gating and event entry.
- `tests/tabs-s088.test.cjs` — 8 recently-closed cases: route/phase, three
  sections, per-section restore verbs, Restore all, gating and event entry.
- `tests/tabs-s086.test.cjs` — 9 tear-off cases: route/phase, ghost window,
  gap, cancel, detach, reattach, gating and event entry.
- `tests/tabs-s085.test.cjs` — 9 drag-reorder cases: route/phase, lift, gap
  movement, auto-scroll, drop, cancel, gating and event entry.
- `tests/tabs-s082.test.cjs` — 8 mobile-list cases: route/phase, compact rows,
  search by title/host/group, clear, selection, gating and event entry.
- `tests/tabs-s079.test.cjs` — 9 split-grid cases: route/phase, 4-up grid,
  per-pane toolbar, 3/4-up layout, reload/history scope, focus, close/add,
  empty state, gating and event entry.
- `tests/tabs-s077.test.cjs` — 7 stack-archive cases: route/phase,
  stacks, restore stack, restore page, search, gating and event entry.
- `tests/tabs-s076.test.cjs` — 7 expanded-group cases: route/phase,
  tabs, close tab/group, edit name/colour, gating and event entry.
- `tests/tabs-s074.test.cjs` — 6 hover-preview cases: route/phase,
  thumbnail/title/URL, mute, close/reopen, gating and event entry.
- `tests/tabs-s072.test.cjs` — 6 crashed-tab cases: route/phase, sad tab,
  reload/report, gating, Continue and event entry.
- `tests/start-page-s069.test.cjs` — 6 muted-tab cases: route/phase,
  muted icon, unmute, gating, Continue and event entry.
- `tests/start-page-s066.test.cjs` — 7 active-tab cases: route/phase,
  parts, audio, close/reopen, group colour, gating, Continue and event entry.
- `tests/start-page-s064.test.cjs` — 6 offline-start cases: route/phase,
  cached shortcuts, retries, gating, Continue and event entry.
- `tests/start-page-s061.test.cjs` — 7 widget cases: route/phase, clock,
  weather source, opt-in stocks, gating, Continue and event entry.
- `tests/start-page-s059.test.cjs` — 7 AI-prompt cases: route/phase,
  suggestions, send states, gating, Continue and event entry.
- `tests/start-page-s057.test.cjs` — 6 spaces-overview cases: route/phase,
  cards, recents, selection, gating, Continue and event entry.
- `tests/start-page-s055.test.cjs` — 8 frequently-visited cases: route/phase,
  auto toggle, hide/remove/reset, gating, Continue and event entry.
- `tests/start-page-s053.test.cjs` — 6 zero-state cases: route/phase,
  empty state, import/start-fresh, gating, Continue and event entry.
- `tests/window-chrome-s050.test.cjs` — 8 command-palette cases: route,
  sections, shortcut, arrow wrap, run, close/reopen, gating and event entry.
- `tests/window-chrome-s047.test.cjs` — 6 link-context cases: route, all
  actions, gating, Continue and event entry.
- `tests/window-chrome-s043.test.cjs` — 7 app-menu cases: route, all rows,
  gating, action messages, quit confirmation, Continue and event entry.
- `tests/window-chrome-s041.test.cjs` — 8 profile-menu cases: route,
  gating, profile/space switches, guest/manage, Continue, event entry and the
  separate s-042 space-switcher guard.
- `tests/window-chrome-s039.test.cjs` — 8 download-shelf cases: route,
  gating, history drawer, clear, row open, Continue and event entry.
- `tests/window-chrome-s037.test.cjs` — 8 find-bar cases: route, gating,
  count/step/wrap, match options, close/reopen, Continue and event entry.
- `tests/window-chrome-s035.test.cjs` — 7 bookmarks-bar cases: route,
  folders/overflow, edit/remove/reset, gating, Continue and event entry.
- `tests/window-chrome-s033.test.cjs` — 7 permissions-chip cases: route,
  gating, active chip, revoke, allow/close, Continue and event entry.
- `tests/window-chrome-s031.test.cjs` — 7 expanded-omnibox cases: route,
  phase/category, sections, arrow-key wrap, row choice, Continue and event entry.
- `tests/window-chrome-s029.test.cjs` — 8 toolbar-customize cases: route,
  phase/category, drag reorder, show/hide, reset, Continue and event entry.
- `tests/window-chrome-s027.test.cjs` — 5 tab-overflow cases: route,
  phase/category, all-tabs/search/close map, platform opt-out, Continue and
  event entry.
- `tests/window-chrome-s025.test.cjs` — 5 horizontal-strip cases: route,
  phase/category, tab/new-tab/overflow/search map, platform opt-out, Continue
  and event entry.
- `tests/window-chrome-s023.test.cjs` — 5 compact-window cases: route,
  phase/category, icon-only/overflow map, platform opt-out, Continue and event
  entry.
- `tests/onboarding-s018.test.cjs` — 7 crash-restore/recovery cases: gating,
  render/sanitising, restore, discard, event ordering and revealing the layer
  on a launch where the boot gate stayed hidden.
- Boot gate re-prompt cases in `tests/onboarding.test.cjs`: eligible after a
  week, waits out the interval, stops at three prompts, granted never
  re-prompts.
- Electron suites (`smoke`, `vfd`, `desktop-windows`) run against fresh
  profiles with the splash active.
- `windows/test/package-parity.cjs` releases the splash explicitly before its
  locator-based checks.

## Known limits

- The splash only gates the browser UI; native launch screens are unchanged
  (they are platform-owned and already instant).
- Clearing site data resets the record, so onboarding runs again — treated as
  a new install by design.
- The s-015 password import writes into the existing local password store,
  which keeps entries in plaintext on the device (same model as the Passwords
  dialog). It is not a system credential provider; system-managed credentials
  stay with the platform password manager.
- Default-browser status cannot be read back from the page, so the s-015 row
  opens the OS setting without claiming the browser became default.
