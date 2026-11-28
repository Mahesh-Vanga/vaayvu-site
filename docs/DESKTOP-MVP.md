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
| Downloads | `will-download` handling, save dialog, cancel/cleanup | `windows/host.cjs` (no native-suite assertion) |
| Windows build | Portable x64 archive | `tests/test/0.0.23/Vaayvu-0.0.23-Windows-x64.zip` |

Local execution on 2026-11-28:

```text
npm --prefix windows test
```

Result: 8 policy tests passed, shared UI checks passed, and the native suite
verified tab menu, placement, bookmarking, tab search, Task Manager,
independent windows and private-safe window restore.

## Signed macOS build

The current source was packaged and signed on 2026-11-28:

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

## Downloads gap

The download lifecycle is implemented in `windows/host.cjs`:

- `will-download` prevents default navigation;
- the save dialog is titled;
- completed, interrupted and cancelled states emit browser events;
- private-session teardown cancels active downloads.

The screen contract is tested (`s-233`, `s-510`–`s-515`), but the Electron
native suite does not yet assert a real file download. That is a coverage gap,
not a fabricated pass.

## Exit gate

| Gate item | State |
|---|---|
| macOS-first desktop browser | Implemented |
| Chromium integration | Electron 45.4.1, sandboxed |
| Tabs | Implemented and native-tested |
| Omnibox | Implemented and native-tested |
| Bookmarks | Implemented and native-tested |
| Downloads | Implemented; native assertion missing |
| Signed internal macOS build | **Current source signed and verified** |
| Windows build | **Current source packaged and verified** |
| Downloads native assertion | Follow-up gap |
| Gate met | **Yes, locally** |

P05's exit gate is met locally. The download native assertion remains a test
coverage follow-up, not a build gate.
