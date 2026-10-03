#!/bin/bash
# Builds the self-hosted OHIF Viewer for the Oncotics Imaging Workbench and copies it to
# oncotics/public_html/assets/ohif/ (served at https://oncotics.com/assets/ohif/).
#   - PUBLIC_URL=/assets/ohif/  APP_CONFIG=config/oncotics.js (privacy-hardened config)
#   - removes the unused service-worker bundle and replaces init-service-worker.js with an
#     unregister-only script (OHIF never registers a service worker on oncotics.com)
# Requirements: the repository's pnpm/Node toolchain (see package.json "packageManager").
# Usage: oncotics/scripts/build-ohif.sh [--skip-install]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/oncotics/public_html/assets/ohif"
PNPM="${PNPM:-npx -y pnpm@12.8.1}"
cd "$ROOT"
if [ "${1:-}" != "--skip-install" ]; then CYPRESS_INSTALL_BINARY=0 $PNPM install --frozen-lockfile; fi
cd "$ROOT/platform/app"
NODE_ENV=production PUBLIC_URL=/assets/ohif/ APP_CONFIG=config/oncotics.js QUICK_BUILD="${QUICK_BUILD:-false}" \
  NODE_OPTIONS="--max-old-space-size=${OHIF_BUILD_MEMORY_MB:-8192}" npx rsbuild build --config ../../rsbuild.config.ts --config-loader jiti
rm -rf "$OUT"; mkdir -p "$OUT"
cp -R dist/. "$OUT/"
rm -f "$OUT"/sw.js "$OUT"/sw.js.map "$OUT"/workbox-*.js
find "$OUT" -name "*.map" -delete   # do not publish source maps
cat > "$OUT/init-service-worker.js" <<'JS'
// Oncotics: no service worker is used. Unregister any left over from older deployments.
if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function (r) { r.forEach(function (x) { x.unregister(); }); }); }
JS
# Sanity checks: the Oncotics config is the active app-config, and no external CDN is referenced by index.html.
grep -q "oncotics-user-dicomweb" "$OUT/app-config.js" || { echo "app-config.js is not config/oncotics.js" >&2; exit 1; }
if grep -Eo 'src="https?://[^"]+"' "$OUT/index.html" | grep -v 'oncotics.com'; then echo "External script reference found in index.html" >&2; exit 1; fi
du -sh "$OUT"
echo "OHIF built into $OUT"
