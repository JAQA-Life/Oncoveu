#!/bin/bash
# Builds the single-file Oncotics Precision Oncology Workspace from its parts.
# Output: dist/oncotics-precision-workspace.html (standalone) — also copied to
# ../site/src/ for the site build (assets.py integrates it into public_html).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
JS_PARTS="04-core.js 05-registry.js 05b-registry-extra.js 06-net.js 07-detect.js 07b-interpret.js 07c-geo-data.js 08-loaders.js 08b-loaders-extra.js 09-ui.js 10-mod-a.js 10b-globe.js 10c-molmap.js 10d-overview-interp.js 10e-concept-fanout.js 10f-module-search.js 11-mod-b.js 11b-vaccines.js 11c-fertility.js 12-mod-c.js 12b-expert.js 13-mod-d.js 14-app.js"
cat $JS_PARTS > dist/app.js
node --check dist/app.js
{ cat 01-head.html 02-style.html 03-markup.html; echo '<script id="oncotics-workspace-script">'; cat dist/app.js; echo '</script>'; echo '</body>'; echo '</html>'; } > dist/oncotics-precision-workspace.html
# Privacy guard: the workspace must never reference browser storage APIs.
if grep -nE "(localStorage|sessionStorage|indexedDB)\s*[.[]|document\.cookie|serviceWorker\s*\.|caches\.open|navigator\.geolocation|console\.(log|info|debug|warn|error)" dist/app.js; then echo "Privacy guard failed: forbidden API referenced" >&2; exit 1; fi
if grep -n "Onco""Gx" dist/oncotics-precision-workspace.html; then echo "Brand guard failed" >&2; exit 1; fi
cp dist/oncotics-precision-workspace.html ../site/src/oncotics-precision-workspace.html
wc -c dist/oncotics-precision-workspace.html
