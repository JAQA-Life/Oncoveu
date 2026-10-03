#!/bin/bash
# Builds the complete Oncotics website into oncotics/public_html (Hostinger-ready):
#   1. Workspace single-file build   (oncotics/workspace/build.sh)
#   2. Imaging Workbench build        (oncotics/imaging/build.sh)
#   3. Static pages + assets + .htaccess (oncotics/site/build_site.py, assets.py; Python 3.10+ with Pillow)
#   4. Standalone copies               (oncotics/standalone/)
# Optional deploy-time vendor assets (not committed): scripts/fetch-vendor-assets.sh (CesiumJS globe,
# ONNX Runtime Web) and scripts/build-ohif.sh (self-hosted OHIF Viewer).
set -euo pipefail
cd "$(dirname "$0")/.."
workspace/build.sh
imaging/build.sh
( cd site && python3 build_site.py && python3 assets.py )
mkdir -p standalone
cp workspace/dist/oncotics-precision-workspace.html standalone/oncotics-precision-workspace.html
cp imaging/dist/oncotics-imaging-workbench.html standalone/oncotics-imaging-workbench.html
echo "Site built in $(pwd)/public_html"
