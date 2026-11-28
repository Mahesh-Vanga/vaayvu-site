#!/usr/bin/env bash
# Publishes the current website/locathara/ to the locathara-secure Cloudflare Worker.
set -euo pipefail

# Script is at website/locathara/deploy-cloudflare.sh
# Repo root is two levels up from script directory
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$REPO_ROOT/website/locathara/cloudflare"
PUBLIC="$WORK/public"
SITE_SRC="$REPO_ROOT/website/locathara"

echo "📦 Preparing locathara.com for Cloudflare deployment..."

rm -rf "$PUBLIC"
mkdir -p "$PUBLIC"

rsync -a \
  --exclude 'README.md' \
  --exclude 'deploy*.sh' \
  --exclude 'sync-downloads.sh' \
  --exclude 'cloudflare' \
  --exclude 'downloads' \
  --exclude 'CNAME' \
  --exclude '.nojekyll' \
  --exclude '.DS_Store' \
  --exclude '*.map' \
  "$SITE_SRC/" "$PUBLIC/"

echo "🚀 Deploying to Cloudflare Workers..."
cd "$WORK"
# Use --config to avoid picking up root wrangler.jsonc
npx --yes wrangler@latest deploy --config wrangler.jsonc

echo "✅ Published. https://locathara.com is served by the edge Worker."
echo ""
echo "📋 Next steps for Wix domain:"
echo "   1. In Wix dashboard: Domains → Manage → DNS Records"
echo "   2. Add/Update these records:"
echo "      Type: CNAME   Name: @        Value: locathara-secure.<your-subdomain>.workers.dev"
echo "      Type: CNAME   Name: www      Value: locathara-secure.<your-subdomain>.workers.dev"
echo "   3. Or change nameservers to Cloudflare and add domain in Cloudflare dashboard"
echo "   4. Enable 'Always Use HTTPS' in Cloudflare SSL/TLS settings"