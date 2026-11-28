# Content, downloads and productivity (P09)

P09 covers reader, translation, PDF, capture, history and rich bookmarks. The
end-to-end content workflow is executable; translation remains a recorded gap.

## Executed end-to-end workflow

`windows/test/content-workflow.cjs` runs inside the desktop Electron suite:

```sh
npm --prefix windows test
```

It opens a real local article, runs reader extraction, generates a PDF and
captures a PNG.

Result:

```json
{"article":"Content workflow article","reader":true,"pdf":true,"pdfBytes":33845,"capture":true,"captureBytes":43904,"mhtml":true,"mhtmlBytes":3952,"unchanged":true}
```

This exercises:

1. navigation to a real page in a tab;
2. reader extraction that keeps article text and drops the hidden form value;
3. `printToPDF` output starting with `%PDF`;
4. `capturePage` output starting with the PNG signature.

The suite is now part of `windows/test/run.cjs`, so the desktop test command runs
reader, smoke, VFD, native tabs and content workflow together.

## Other content workflows

| Workflow | Evidence | State |
|---|---|---|
| Reader extraction | content workflow + native smoke | Tested end-to-end |
| PDF export | content workflow (`%PDF`) | Tested end-to-end |
| Screen capture | content workflow (PNG) | Tested end-to-end |
| History and navigation | native smoke | Tested |
| Rich bookmarks | native desktop suite (create, edit, import, export) | Tested |
| Downloads | `will-download` handler, queue screens | Implemented; no real-file native assertion |
| Translation | no native translation provider is advertised | **Not implemented as a product workflow** |

Translation is not faked. The UI only offers translation when a host advertises
`canTranslate`; no shipping host does, so the screen reports the capability as
unavailable instead of pretending to translate.

## Downloads gap

`windows/host.cjs` prevents default navigation, titles the save dialog, tracks
completed/interrupted/cancelled states and cancels on private teardown. The
download screens are tested. A native assertion that writes and verifies a real
file is still missing, so downloads are not claimed as end-to-end tested.

## Exit gate

| Gate item | State |
|---|---|
| Reader | **E2E tested** |
| PDF | **E2E tested** |
| Capture | **E2E tested** |
| History | Native-tested |
| Rich bookmarks | Native-tested |
| Downloads | Implemented; file assertion missing |
| Translation | **Gap** — no provider |
| End-to-end content workflows | **Yes, locally** for reader/PDF/capture/bookmarks/history |
| Gate met | **Partially** — translation and download-file assertion open |

P09's core content workflows are green. Translation and the download-file
assertion are recorded gaps, not hidden passes.
