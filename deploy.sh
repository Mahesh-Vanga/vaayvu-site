#!/usr/bin/env bash
# Publishes website/ to the vaayvu-site GitHub Pages repository.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${VAAYVU_SITE_DIR:-$HOME/.cache/vaayvu-site}"
REPO="https://github.com/Mahesh-Vanga/vaayvu-site.git"

if [ ! -d "$WORK/.git" ]; then
  mkdir -p "$(dirname "$WORK")"
  git clone "$REPO" "$WORK"
fi

rsync -a --delete \
  --exclude '.git' \
  --exclude 'downloads' \
  --exclude '.DS_Store' \
  "$ROOT/website/" "$WORK/"

touch "$WORK/.nojekyll"
printf 'vaayvu.com\n' > "$WORK/CNAME"

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo "No site changes to publish."
  exit 0
fi
git -c user.name="Mahesh Vanga" -c user.email="maheshvanga52@gmail.com" \
  commit -m "Update vaayvu.com"
git push origin main
echo "Published. GitHub Pages will rebuild in a minute."
