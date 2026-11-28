# Android phone/tablet browser (P07)

P07 covers the Android browser, adaptive UI and permissions, ending in an
internal release and adaptive checks.

## Implementation reality

| Area | Evidence | State |
|---|---|---|
| Android app | Java + `android.webkit.WebView` (`BrowserActivity`, `BrowserTab`) | Implemented |
| Kotlin / Compose | No Kotlin sources; `compileDebugKotlin NO-SOURCE` | **Not used** |
| GeckoView | Only the P02 spike module (`android/geckoview-spike`) | **Not the product engine** |
| Phone + tablet | Single resizeable activity, `configChanges` covers size/orientation | Implemented |
| Adaptive UI | Shared `chrome/` responsive styles at 320/360/390 and wide layouts | Implemented |
| Permissions | `SitePermissions`, notification permission, WebView permission requests | Implemented |
| Unit tests | `:app:testDebugUnitTest` | Passed |
| Internal release | Signed release APK | Built and signature-verified |

The product Android browser is **not** Kotlin/Compose/GeckoView. P02 proved
GeckoView can build and load a page, but migrating the shipping app is a
separate program. This phase is judged on the exit gate, and the architecture
gap is recorded rather than hidden.

## Adaptive checks

Added `scripts/android-adaptive-check.sh`. It installs the debug APK, launches
the browser at a phone size and a tablet size, and fails on a fatal exception or
if the activity is not resumed.

Execution on 2026-11-28 (Android 35 arm64 emulator):

```text
phone: launched at 1080x2280, density 440, no fatal exception
tablet: launched at 1600x2560, density 320, no fatal exception
Android adaptive launch check passed.
```

The activity declares:

```xml
android:configChanges="keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode"
```

so size and orientation changes are handled without recreating the browser.

## Internal release

```sh
android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug
android/gradlew -p android :app:assembleRelease
```

Results:

- unit tests passed;
- debug APK assembled;
- release APK assembled (6.0 MB);
- `apksigner verify` passed.

Signing: the release uses `android/keystore/vaayvu-release.keystore` with
certificate DN `CN=Vaayvu, OU=Vaayvu, O=Vaayvu` (SHA-256
`c1659960c5d730a3b057456db8c2fa1abfb242f9c3a8aba2ef3c0120073f0a38`), package `dev.vaayvu.app`. This
is a new signing identity; upgrades from the old package require a fresh install
or a separate migration path.

## Permissions

- `SitePermissions` maps WebView permission requests to Android runtime
  permissions and denies unsupported ones.
- Notification permission is requested only when a reminder/notification path
  needs it (`POST_NOTIFICATIONS` on API 33+).
- No broad storage or location permission is requested by the browser shell.

## Exit gate

| Gate item | State |
|---|---|
| Android internal release | **Built and signed**, including debug and release APKs |
| Adaptive checks | **Phone and tablet launches pass**, no fatal exception |
| Unit tests | Passed |
| Kotlin/Compose/GeckoView product | **Not migrated** — recorded gap |
| Gate met | **Yes, locally** for release + adaptive; architecture gap remains |

P07's gate is met locally. The Kotlin/Compose/GeckoView migration is a separate
architecture decision, not a release blocker.
