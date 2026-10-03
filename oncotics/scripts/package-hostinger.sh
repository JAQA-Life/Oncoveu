#!/bin/bash
# Zips oncotics/public_html (including .htaccess and any deployed vendor assets) into
# oncotics/oncotics-hostinger-upload.zip for upload through hPanel File Manager.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f oncotics-hostinger-upload.zip
( cd public_html && zip -qr -X ../oncotics-hostinger-upload.zip . -x '*.map' )
for d in assets/globe assets/ort assets/ohif; do [ -d "public_html/$d" ] || echo "Note: public_html/$d is not present (optional; see docs/DEPLOY-HOSTINGER.md)."; done
ls -lh oncotics-hostinger-upload.zip
