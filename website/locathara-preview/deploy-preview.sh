#!/usr/bin/env bash
# Publishes the preview site to the locathara-secure Cloudflare Worker.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$REPO_ROOT/website/locathara-preview/cloudflare"
PUBLIC="$WORK/public"
SITE_SRC="$REPO_ROOT/website/locathara-preview"

echo "📦 Preparing locathara-preview for Cloudflare deployment..."

rm -rf "$PUBLIC"
mkdir -p "$PUBLIC"

rsync -a \
  --exclude 'README.md' \
  --exclude 'deploy*.sh' \
  --exclude 'cloudflare' \
  --exclude '*.map' \
  --exclude '.DS_Store' \
  "$SITE_SRC/" "$PUBLIC/"

echo "🚀 Deploying to Cloudflare Workers..."
cd "$WORK"
npx --yes wrangler@latest deploy --config wrangler.jsonc

echo "✅ Published preview to https://locathara-secure.maheshvanga52.workers.dev"