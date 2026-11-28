# Document, capture and download studio (P26)

P26 covers non-destructive save-copy, safe download/recovery and native document
capability.

## Native document capability (executed)

`windows/test/content-workflow.cjs` opens a real article and produces:

| Output | Result |
|---|---|
| PDF | `%PDF`, 33,845 bytes |
| PNG capture | PNG signature, 43,904 bytes |
| MHTML | `MIME-Version`/multipart, 3,952 bytes |
| Page state | URL and title unchanged after all three exports |

Result:

```json
{"reader":true,"pdf":true,"pdfBytes":33845,"capture":true,"captureBytes":43904,
 "mhtml":true,"mhtmlBytes":3952,"unchanged":true}
```

The export uses Electron's native `printToPDF`, `capturePage` and `savePage`
(MHTML). No page is mutated, navigated or replaced by a save-copy.

## Non-destructive save-copy

- The save dialog writes to a new path; the original page is untouched.
- `savePDF`, `capture` and `savePage` re-check the tab and URL before writing, so
  a navigation during the dialog cancels the write.
- The reader extraction path does not modify the page.
- The test asserts URL and title equality before/after PDF + PNG + MHTML.

## Safe download and recovery

Implemented:

- downloads only start for an enabled website tab with a valid HTTP(S) URL;
- private/disabled/unsafe contexts are cancelled in `will-download`;
- the save dialog is titled; completed/interrupted states emit browser events;
- active downloads are cancelled on private teardown and restriction;
- finished downloads are never auto-opened.

Not implemented (screens only):

- quarantine-before-open with an integrity check;
- resumable downloads across restart;
- checksum/manifest verification for arbitrary downloads;
- a real persistence layer for the download queue.

The download screens (`s-510`–`s-515`) are contracts; no native resume/quarantine
assertion exists.

## Exit gate

| Gate item | State |
|---|---|
| Non-destructive save-copy | **Green** (URL/title unchanged) |
| Native PDF/PNG/MHTML | **Green** (executed) |
| Safe download start/cancel | **Green** (handler rules) |
| Quarantine/resume integrity | **Gap** — screens only |
| Gate met | **Partially** — save/docs green, download recovery gap |

P26's document/capture half is green. Safe download recovery remains a recorded
gap.
