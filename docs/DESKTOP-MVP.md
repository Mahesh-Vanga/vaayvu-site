# Desktop minimum viable browser (P05)

P05 covers the macOS-first Chromium desktop browser: tabs, omnibox, bookmarks
and downloads, with a signed internal macOS build and a Windows build.

## What is implemented

| Capability | Implementation | Native evidence |
|---|---|---|
| Chromium integration | Electron `45.4.1` with sandbox and hardened fuses | `windows/host.cjs`, `windows/package-mac.mjs` |
| Tabs | Native tab menu, placement, search, independent windows | `windows/test/desktop-windows.cjs` |
| Omnibox | `#address` form, input events, navigation | `windows/test/smoke.cjs` |
| Bookmarks | Save, list and restore bookmarks | `windows/test/desktop-windows.cjs`, `windows/test/smoke.cjs` |
| Downloads | `will-download` handling, save dialog, cancel/cleanup | `windows/test/downloads.cjs` |
| Windows build | Portable x64 archive | `tests/test/0.0.23/Vaayvu-0.0.23-Windows-x64.zip` |

Local execution on 2026-11-28:

```text
npm --prefix windows test
```

Result: 8 policy tests passed, shared UI checks passed, and the native suite
verified tab menu, placement, bookmarking, tab search, Task Manager,
independent windows, private-safe window restore and the download lifecycle.

## Signed macOS build

The current source was rebuilt and signed on 2026-11-28 (14:46 local):

```sh
npm --prefix windows run package:mac
npm --prefix windows run verify:mac
```

Output:

```text
Verified matching signed Mac app in DMG and PKG, Dock plug-in drawing and
transparency, Finder catalog, receipt, version, source bytes, Chromium notices,
ASAR integrity and hardened fuses.
```

The verifier checks the DMG and PKG signatures, Developer ID Application and
Developer ID Installer identities, hardened runtime, Dock plug-in, Finder
catalog, receipt, ASAR integrity, disabled dangerous fuses and byte parity with
the current `chrome/` tree.

## Windows build

The current source was also packaged and verified:

```sh
npm --prefix windows run package
npm --prefix windows run verify
```

Output:

```text
Verified Windows x64 PE, Vaayvu product resources, ASAR digest, hardened
Electron fuses, desktop sources and 43 shared assets.
```

## Downloads

The download lifecycle is implemented in `windows/host.cjs` and asserted by a
real Electron `DownloadItem` in `windows/test/downloads.cjs`:

- `will-download` prevents default navigation;
- the save dialog is titled and its options are read back from the live item;
- a deterministic destination writes the expected bytes, emits one completed
  `download` event and clears the in-flight set;
- cancel leaves no final or `.crdownload` file and never reports completion;
- `restrict()` cancels a lingering download during teardown.

Run:

```sh
windows/node_modules/.bin/electron windows/test/downloads.cjs
```

Result: 3 real downloads — 1 completed, 2 cancelled — save dialog
`Save download`, destination `ok.txt`.

## Exit gate

| Gate item | State |
|---|---|
| macOS-first desktop browser | Implemented |
| Chromium integration | Electron 45.4.1, sandboxed |
| Tabs | Implemented and native-tested |
| Omnibox | Implemented and native-tested |
| Bookmarks | Implemented and native-tested |
| Downloads | Implemented and native-tested |
| Signed internal macOS build | **Current source rebuilt, signed and verified** |
| Windows build | **Current source packaged and verified** |
| Downloads native assertion | `windows/test/downloads.cjs` — 3 real downloads |
| Gate met | **Yes, locally** |

P05's exit gate is met locally: the native suite now asserts real downloads, and
the macOS DMG/PKG were rebuilt from the current source with the Developer ID
Application and Installer identities.
