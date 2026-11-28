#!/bin/bash
# P07 adaptive launch check for the Android browser.
# Requires a running emulator/device and a debug APK.
set -euo pipefail
cd "$(dirname "$0")/.."
apk="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
component="dev.vaayvu.app/.BrowserActivity"
[[ -f "$apk" ]] || { echo "Missing APK: $apk" >&2; exit 1; }
adb wait-for-device
original_size=$(adb shell wm size | tr -d '\r' | awk '{print $3}')
original_density=$(adb shell wm density | tr -d '\r' | awk '{print $3}')
restore() {
  adb shell wm size "$original_size" >/dev/null 2>&1 || adb shell wm size reset >/dev/null 2>&1 || true
  adb shell wm density "$original_density" >/dev/null 2>&1 || adb shell wm density reset >/dev/null 2>&1 || true
}
trap restore EXIT
adb install -r "$apk" >/dev/null
check() {
  local label="$1" size="$2" density="$3"
  adb shell wm size "$size" >/dev/null
  adb shell wm density "$density" >/dev/null
  adb shell am force-stop dev.vaayvu.app
  adb logcat -c
  adb shell am start -W -n "$component" >/dev/null
  sleep 3
  if adb logcat -d | grep -q "FATAL EXCEPTION"; then
    echo "$label: crash" >&2
    adb logcat -d | grep -A20 "FATAL EXCEPTION" >&2
    exit 1
  fi
  adb shell dumpsys activity activities | grep -q "dev.vaayvu.app/.BrowserActivity" || {
    echo "$label: activity not resumed" >&2; exit 1;
  }
  echo "$label: launched at $size, density $density, no fatal exception"
}
check "phone" 1080x2280 440
check "tablet" 1600x2560 320
restore
trap - EXIT
echo "Android adaptive launch check passed."
