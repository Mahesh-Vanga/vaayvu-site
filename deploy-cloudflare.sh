#!/usr/bin/env bash
# Publishes the current website/ to the vaayvu-secure Cloudflare Worker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$ROOT/website/cloudflare"
PUBLIC="$WORK/public"

rm -rf "$PUBLIC"
rsync -a \
  --exclude 'README.md' \
  --exclude 'deploy.sh' \
  --exclude 'deploy-cloudflare.sh' \
  --exclude 'sync-downloads.sh' \
  --exclude 'cloudflare' \
  --exclude 'downloads' \
  --exclude 'CNAME' \
  --exclude '.nojekyll' \
  --exclude '.DS_Store' \
  "$ROOT/website/" "$PUBLIC/"

cd "$WORK"
npx --yes wrangler@latest deploy
echo "Published. https://vaayvu.com is served by the edge Worker."
