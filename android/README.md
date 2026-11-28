# Vaayvu for Android

Vaayvu runs on Android 10 (API 29) and newer. It uses the installed Android System WebView or Chrome provider. Private tabs require a provider with multi-profile support.

## Install the preview

Copy the signed APK for your installation to the phone, open it and follow Android’s install prompt. If prompted, allow the file manager to install this APK. You can turn that permission off after installation. To make Vaayvu your default, select it in **Settings → Apps → Default apps → Browser app**.

Use `Vaayvu-0.0.23-Android.apk` (build 60) for a fresh installation or to update build 50 and earlier builds signed with the same local release certificate. Android keeps browser profiles, sites, permissions and Vaayvu ID in the existing app storage. Installations signed with a different certificate require their original signing key for an in-place update.

## Search and privacy

New Android profiles open ordinary websites and search with DuckDuckGo. **Settings → Search and address bar** offers DuckDuckGo, Google or Bing. The selected provider receives a submitted query and may use servers outside India. Turn off **Allow ordinary websites** to use India-only search. This closes active website views, blocks service-worker network loads and cancels active Android Downloads transfers. Finished files stay in place. In India-only mode, confirm a result or a typed address to browse in one tab. That site receives your visit and may use servers outside India. Clipboard sharing, bookmark exports, external-app links and account sync stay paused.

The release ships without a verified live India search deployment. In India-only mode, typed searches match the bundled website directory and curated topics, as well as local bookmarks, favorites and regular history. Queries in that mode stay on the device in the distributed APKs. Operators can build with a reviewed `search/client-deployment.json`. The native search client checks expiry, hostname, TLS trust and the exact server certificate’s public-key pin. It sends a bounded JSON POST to that single endpoint. For residency verification and deployment instructions see `search/README.md`.

Vaayvu requests that the Android keyboard skip personalized learning for its browser interface, excludes that interface from Android content capture and autofill, disables Android backups and protects its window from screenshots and Recents previews. The **Capture page** tool still saves a website image when ordinary browsing is enabled. A separately installed keyboard, dictation service, VPN, DNS resolver or device-management agent has its own data handling. Vaayvu cannot control those services or verify the physical route of a network packet.

The interface follows Android’s animation scale, blur availability and high-contrast preference. System bars follow Vaayvu’s active phone theme.

## Build from source

Install JDK 17 and the Android SDK, including platform 36 and build tools 36.0.0. From the repository root, run

```sh
android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. The build bundles the shared interface from `chrome/`. Development builds use a local debug key. Android requires matching signatures for an in-place update. Uninstalling the app erases its local browsing data.

## Sign a release

For your own distribution, keep the release keystore and its password in separate private backups. Update builds must use the original distribution key. With the Android SDK’s build-tools directory in your PATH, run

```sh
android/gradlew -p android :app:assembleRelease
apksigner sign --ks /path/to/your-release-keystore.p12 --ks-key-alias vaayvu-release \
  --out Vaayvu-Browser-Android.apk android/app/build/outputs/apk/release/app-release-unsigned.apk
apksigner verify --verbose --print-certs Vaayvu-Browser-Android.apk
```

The Android system Downloads service saves public HTTP(S) files after confirmation. Completed downloads appear in Vaayvu’s Downloads with an option to open the saved file. Repeat downloads receive distinct filenames. Password-protected downloads that require website session cookies are currently unsupported.

## Android menu tools

To inspect a regular web page, choose **Page actions → Inspect page**. Vaayvu opens a fresh copy with its own browsing data. Connect the phone to a trusted computer, authorize USB debugging, then open `chrome://inspect/#devices` in desktop Chromium and choose **inspect** for that copy. Tap **Done** on the phone to end the session. The original tab’s sign-in and unsaved changes stay in that tab.

- Zoom changes the scale of page content independently for each open tab. Fullscreen hides the Android system bars.
- **Print** opens Android’s print sheet. To save a PDF, select **Save as PDF** in that sheet. **Save page** writes an MHTML web archive, and **Capture page** saves the visible website area as a PNG. The system file picker lets you choose the destination.
- Import and export browser bookmarks using UTF-8 HTML files of up to 2 MB. Android opens only the document you select.
- Long-press a website link to open it in a foreground, background or private tab, copy it or share it. Links around images also offer separate image actions. Links and forms that request a new window keep their native WebView, including form submissions.
- **Desktop site** changes the user agent for the selected tab. The default browser control opens Android’s browser selection dialog. Use the system Back button to dismiss an overlay, leave fullscreen video, or navigate through a tab.
- A website must obtain your consent before requesting camera, microphone, or approximate location. The dialog names the visible website. Android then asks for any required system permission. Site decisions apply to the current request.
- Import a supported Manifest V3 style extension through the Android document picker. Vaayvu applies enabled CSS to the approved HTTPS hosts in regular tabs. Tracking protection filters listed third-party requests and accepts up to 128 additional DNS names.
- Android’s system password and VPN settings, clipboard and supported launchers’ pinned web shortcuts are available from Vaayvu.
- The phone tab overview shows small snapshots of recently displayed regular tabs. The snapshots stay in memory and disappear when their tab closes. Swiping down the page collapses the browser bars, and scrolling back up reveals them.
- On WebView providers with multi-profile support, **Profiles** creates separate browser sessions for work, personal browsing, or other uses. Each profile keeps its own tabs, site sign-ins, bookmarks, settings, downloads history and Vaayvu ID. Switching profiles closes private tabs. The Personal profile retains your existing browser data, and Vaayvu reopens the last selected profile.
- The current-page privacy report lists blocked network requests and their domains. **Listen to page** uses an installed offline Android speech voice. Vaayvu leaves the system speech recognizer off for address-bar searches.
- From a regular page, choose a reminder in an hour, a day, or a week. Android requests notification permission on the first reminder and opens the saved URL when you tap the notification. Delivery uses inexact alarms and can be delayed by Android’s power controls.
- Clearing website data resets the regular tabs’ isolated WebView profile, including website cookies, storage and cache. It keeps your Vaayvu account, bookmarks and preferences. On older WebViews that share website and app storage, update the WebView provider to enable isolated clearing. Legacy data in an older shared WebView profile cannot be erased separately from Vaayvu’s local account on those engines.
