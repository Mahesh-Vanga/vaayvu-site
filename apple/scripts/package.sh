#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
staging=$(mktemp -d "${TMPDIR:-/tmp}/vaayvu-package.XXXXXXXX")
trap 'rm -rf "$staging"' EXIT
if [[ "${1:-device}" == device ]]; then
    : "${APPLE_DEVELOPMENT_TEAM:?Set APPLE_DEVELOPMENT_TEAM to the team of your installed development profile}"
    archive="$staging/Browser.xcarchive"
    xcodebuild -project apple/Vaayvu.xcodeproj -scheme "Vaayvu iPhone" -configuration Release \
        -destination 'generic/platform=iOS' -derivedDataPath "$staging/build" -archivePath "$archive" \
        CODE_SIGN_STYLE=Automatic "DEVELOPMENT_TEAM=$APPLE_DEVELOPMENT_TEAM" \
        'CODE_SIGN_IDENTITY=Apple Development' -quiet archive
    options="$staging/ExportOptions.plist"
    plutil -create xml1 "$options"
    plutil -insert method -string debugging "$options"
    plutil -insert signingStyle -string automatic "$options"
    plutil -insert teamID -string "$APPLE_DEVELOPMENT_TEAM" "$options"
    plutil -insert destination -string export "$options"
    plutil -insert manageAppVersionAndBuildNumber -bool NO "$options"
    xcodebuild -exportArchive -archivePath "$archive" -exportPath "$staging/export" \
        -exportOptionsPlist "$options" -quiet
    exports=("$staging/export/"*.ipa)
    if [[ ${#exports[@]} -ne 1 || ! -f "${exports[0]}" ]]; then
        echo "Expected one exported device IPA." >&2
        exit 1
    fi
    ditto -x -k "${exports[0]}" "$staging/verify"
    apps=("$staging/verify/Payload/"*.app)
    app="${apps[0]}"
    codesign --verify --strict --deep "$app"
    # Finder recreates .DS_Store files at any moment; they are never shipped
    # (the packager filters dotfiles), so exclude them from the parity diff.
    find chrome -name .DS_Store -delete 2>/dev/null || true
    diff -qr chrome "$app/chrome"
    name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$app/Info.plist")
    version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist")
    target="${VAAYVU_OUTPUT_DIR:-$PWD/tests/test/$version}/$name-$version-iOS.ipa"
    mkdir -p "$(dirname "$target")"
    install -m 600 "${exports[0]}" "$target"
    echo "Built $target"
    exit 0
fi
if [[ "$1" != ios ]]; then
    echo "Usage: $0 [device|ios]" >&2
    exit 2
fi
xcodebuild -project apple/Vaayvu.xcodeproj -scheme "Vaayvu iPhone" -configuration Release \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$staging/build" CODE_SIGNING_ALLOWED=NO -quiet build
built_apps=("$staging/build/Build/Products/Release-iphonesimulator/"*.app)
if [[ ${#built_apps[@]} -ne 1 || ! -d "${built_apps[0]}" ]]; then
    echo "Expected one built iPhone Simulator application." >&2
    exit 1
fi
app="${built_apps[0]}"
app_name="${app##*/}"
brand="${app_name%.app}"
version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist")
binary=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app/Info.plist")
dist="${VAAYVU_OUTPUT_DIR:-$PWD/tests/test/$version}"
installed="$dist/iPhone-Simulator/$app_name"
xcrun strip -S "$app/$binary"
codesign --force --timestamp=none --sign - "$app"
codesign --verify --strict --deep "$app"
diff -qr chrome "$app/chrome"
mkdir -p "$installed"
rsync -a --delete "$app/" "$installed/"
archive="$staging/$brand-$version-iPhoneSimulator.zip"
ditto --norsrc --noextattr -c -k --keepParent "$installed" "$archive"
mv -f "$archive" "$dist/"
echo "Built $installed"
