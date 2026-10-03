#!/bin/bash
# Builds the single-file Oncotics Imaging Workbench page.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
cat 10-core.js 20-dicom.js 30-viewer.js 40-ai.js 45-ai-detect.js 50-panels.js 60-app.js > dist/imaging.js
node --check dist/imaging.js
{ cat 01-head.html 02-style.html 03-markup.html; echo '<script id="oncotics-imaging-script">'; cat dist/imaging.js; echo '</script>'; echo '</body>'; echo '</html>'; } > dist/oncotics-imaging-workbench.html
if grep -nE "(localStorage|sessionStorage|indexedDB)\s*[.[]|document\.cookie|serviceWorker\s*\.|caches\.open|navigator\.geolocation|console\.(log|info|debug|warn|error)" dist/imaging.js; then echo "Privacy guard failed" >&2; exit 1; fi
if grep -n "Onco""Gx" dist/oncotics-imaging-workbench.html; then echo "Brand guard failed" >&2; exit 1; fi
cp dist/oncotics-imaging-workbench.html ../site/src/oncotics-imaging-workbench.html
wc -c dist/oncotics-imaging-workbench.html
