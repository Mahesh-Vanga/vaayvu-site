# Apple mobile browser (P06)

P06 covers the native Swift Apple browser: WebKit, iPhone/iPad navigation and
storage, ending in a TestFlight build and platform acceptance.

## Implementation

| Area | Evidence | State |
|---|---|---|
| Native Swift app | `apple/Sources/App.swift` (`UIApplicationDelegate`, UIKit) | Implemented |
| WebKit | `WKWebView` in `BrowserHost`, `ChromeStorage` | Implemented |
| iPhone + iPad | `TARGETED_DEVICE_FAMILY = "1,2"` in project and `project.yml` | Implemented |
| Navigation | Tabs, address focus, tab selection, native links | Tested in `NavigationTests` |
| Storage | `WKWebsiteDataStore`, legacy copy with marker, private store split | Tested in `PhoneInteractionTests` |
| App packaging | `apple/scripts/package.sh` (device IPA and simulator app) | Implemented |

Note on UI framework: the app is native Swift with **UIKit**, not SwiftUI. That
is a deliberate existing architecture; this audit does not rewrite it to
SwiftUI just to match a phrase.

## Defect fixed in this audit

`apple/Sources/PageActions.swift` advertised `canDefaultBrowser: true` on iOS.
iOS cannot set the default browser from inside the app, and the platform test
correctly expected the capability to be absent. The false capability was
removed, and the focused test now passes.

## Local test run

```sh
xcodebuild -project apple/Vaayvu.xcodeproj -scheme 'Vaayvu iPhone' \
  -destination 'id=<simulator>' -parallel-testing-enabled NO test
```

Initial full run: 18 tests, 17 passed, 1 failed at
`NavigationTests.testIsolatedUserStylesAndDesktopPreference` because of the false
`canDefaultBrowser` capability.

After the fix, the focused test passes. Full-suite result is recorded below when
the run completes:

| Run | Result |
|---|---|
| Initial full suite | 17/18, one capability failure |
| Focused retest | 1/1 passed |
| Full suite after fix | **18/18 passed, 0 failures** (`TEST SUCCEEDED`) |

## TestFlight gate

The repository can produce a development-signed device IPA
(`apple/scripts/package.sh device`, export method `debugging`). That is **not** a
TestFlight build.

Missing for TestFlight:

- App Store Connect app record and team credentials;
- distribution certificate/profile (or App Store Connect API key);
- archive upload and processing;
- internal tester group and platform acceptance record.

No TestFlight upload is claimed. The existing
`tests/test/0.0.23/Vaayvu-0.0.23-iOS.ipa` is a development IPA, not TestFlight.

## Exit gate

| Gate item | State |
|---|---|
| Native Swift + WebKit | Implemented |
| iPhone and iPad target | Implemented (`1,2`) |
| Navigation and storage | Tested |
| Platform acceptance | **18/18 simulator tests green** after the capability fix |
| TestFlight build | **Blocked**: needs App Store Connect credentials and upload |
| Gate met | **Partially** — code and simulator acceptance done, TestFlight external |

P06 stays unverified for the TestFlight half until an upload is actually
processed and accepted.
