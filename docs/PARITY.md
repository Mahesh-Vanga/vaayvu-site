# Native desktop and mobile parity (P32)

P32 requires physical Mac/iPhone/iPad/Android evidence. This environment has a
physical Mac, simulators/emulators for the rest, and a cross-built Windows
package. Physical iPhone/iPad/Android runs are **not** available.

## Evidence matrix

| Target | Evidence | Physical? |
|---|---|---|
| macOS | Electron suite, signed DMG/PKG, `verify:mac`, real Mac host | **Yes** |
| iPhone | 18/18 simulator tests | No |
| iPad | 18/18 simulator tests (after popover fix) | No |
| Android | debug/release APK, phone + tablet adaptive launches on emulator | No |
| Windows | x64 package + `verify` (PE/ASAR/fuses) | No runtime |

## iPad bug found and fixed

The iPad simulator crashed in `UIPopoverPresentationController` because a test
presented `UIActivityViewController` without a popover source. The product share
path already sets `sourceView`/`sourceRect`; the test did not.

Fix:

```swift
picker.popoverPresentationController?.sourceView = host.view
picker.popoverPresentationController?.sourceRect = CGRect(x: host.view.bounds.midX, y: 8, width: 1, height: 1)
```

After the fix the full iPad simulator suite passes **18/18**. This is a real
parity defect in the test harness, now closed.

## Optional desktop targets

| Target | State |
|---|---|
| macOS arm64 | Signed and verified |
| Windows x64 | Packaged and verified; not executed on Windows hardware |
| Linux | Not built |

## Exit gate

| Gate item | State |
|---|---|
| Physical Mac | **Green** |
| Physical iPhone | **Not available** |
| Physical iPad | **Not available** (simulator green) |
| Physical Android | **Not available** (emulator green) |
| Optional desktop targets | Windows verified; Linux absent |
| Gate met | **No** — physical iPhone/iPad/Android missing |

P32 cannot be fully green without physical device runs. The iPad popover crash
was found and fixed via the simulator, and all simulated targets pass.
