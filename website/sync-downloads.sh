#!/usr/bin/env bash
# Copies a packaged Vaayvu release into website/downloads/ so the page can serve
# it, then writes a checksum file next to the artifacts.
set -euo pipefail

VERSION="${1:-0.0.23}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tests/test/$VERSION"
DEST="$ROOT/website/downloads"

if [ ! -d "$SRC" ]; then
  echo "No release folder at $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"
copied=0
for artifact in Android.apk Windows-x64.zip macOS.dmg macOS.pkg; do
  file="$SRC/Vaayvu-$VERSION-$artifact"
  if [ -f "$file" ]; then
    cp "$file" "$DEST/"
    copied=$((copied + 1))
  else
    echo "Missing $file" >&2
  fi
done

if [ "$copied" -eq 0 ]; then
  echo "Nothing copied. Check the version and the release folder." >&2
  exit 1
fi

( cd "$DEST" && shasum -a 256 Vaayvu-"$VERSION"-* > SHA256SUMS.txt )
echo "Copied $copied artifact(s) for $VERSION into $DEST"
cat "$DEST/SHA256SUMS.txt"
