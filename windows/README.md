# Vaayvu for desktop

On Windows, extract the versioned `Vaayvu-<version>-Windows-x64.zip` archive and open `Vaayvu.exe` inside the extracted Vaayvu folder. This unsigned portable build for 64-bit Windows 10 and 11 includes Chromium, fonts, language resources and the browser interface. Windows may display an unknown-publisher notice.

On Apple Silicon Macs, drag Vaayvu from the DMG into Applications or run the PKG installer. Both contain the same Developer ID–signed app. These local test packages have not been submitted for Apple notarization.

New profiles browse ordinary websites and search using DuckDuckGo. Choose DuckDuckGo, Google or Bing in **Settings → Search and address bar**. Submitting sends the query to your provider, whose servers may be outside India. Turn off **Allow ordinary websites** for on-device directory, reference article and personal-library matches. In that mode, confirm a result or a typed address to browse in just one tab. That site may use servers outside India. Operators can configure a reviewed regional endpoint at build time. This release has none.

The shared interface sends commands over a bridge that is available only to its packaged main frame. Each website runs in a separate sandboxed Chromium view. Regular tabs share a persistent website session. Private tabs share a temporary in-memory session that closes with the last private tab. The trusted interface uses separate storage for settings, bookmarks and account state. While a private website is visible, Vaayvu requests screen-capture protection from Windows.

The browser supports tab history, split view, find, link context menus, form submissions to new tabs, popup tab adoption, local reader extraction, downloads, bookmark import/export, PDF printing, web archives and screenshots. The Windows host denies website device-permission requests. The archive does not install shell associations or an automatic updater. To update a portable installation, close Vaayvu and replace its extracted application folder. The Windows user's application-data folder holds the browser profile.

## Development

On a regular webpage, press **F12**, choose **View → Inspect Page**, or right-click an element and choose **Inspect element**. Each action opens the bundled Chromium DevTools beside the page. Right-clicking selects the element under the pointer.

Use Node 22.12 or newer. From the repository root run

```sh
cd windows
npm ci
npx --no-install install-electron
npm start
```

For a live preview on a Mac, run `npm run preview` from the `windows` directory. The preview opens a local Inspect example in a temporary profile and picks up interface changes. A fresh installation opens the Observatory with the same light desktop layout. Existing profiles restore their own settings. To reproduce the reference layout in an existing profile, choose **Tab Bar Alignment → Top** in the tab bar menu and **Desktop sidebar → On**, **Color theme → Light** in Appearance.

`npm test` runs the navigation policy tests and launches a real Electron window with a disposable profile. It exercises the bundled interface, a local HTTP website, an in-memory sync server, private tabs and synthetic responses for the optional provider endpoints. `npm run package` creates the Windows x64 archive on Windows or macOS. `npm run verify` checks the PE architecture, product metadata, executable integrity settings and byte-for-byte agreement between the archive and the source interface. On Windows the verifier also launches the extracted Vaayvu.exe with a disposable profile and waits for its browser window. The Windows CI job runs these steps.

The pinned Electron runtime provides Chromium. Rebuild the portable archive with a supported, security-updated Electron version when updating the runtime. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

On macOS 26 or later with Xcode 26 or later, run `npm run package:mac` to build the Apple Silicon DMG and PKG in the versioned folder under `tests/test`. Xcode compiles the Finder icon catalog and the Dock plug-in. Packaging uses Developer ID Application and Installer identities from the keychain. If several identities are available, set `VAAYVU_MAC_APPLICATION_IDENTITY` and `VAAYVU_MAC_INSTALLER_IDENTITY` to the desired certificate names. Run `npm run package:source` to archive the matching desktop, Android, iPhone and shared browser source.

To check a signed DMG against its source, make Playwright available to Node, then run `node test/package-parity.cjs /path/to/Vaayvu.dmg` from this directory. The check mounts the disk image read-only, launches both copies with fresh profiles and exercises the sidebar, tabs, blocking controls, saved themes and Chromium DevTools.
