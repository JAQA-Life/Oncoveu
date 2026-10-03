#!/bin/bash
# Fetches pinned open-source runtime assets from the npm registry and self-hosts them, so the
# pages never load third-party CDNs at runtime:
#   - CesiumJS 1.146.0 (Apache-2.0)          -> public_html/assets/globe/  (Overview 3D globe)
#   - ONNX Runtime Web 1.20.1 (MIT), WASM + WebGPU -> public_html/assets/ort/ (Imaging local inference)
# Without these, the workspace uses its built-in canvas globe and local inference reports
# "runtime not deployed" (no silent fallback to any external host).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(pwd)/public_html/assets"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
( cd "$TMP" && npm pack cesium@1.146.0 onnxruntime-web@1.20.1 >/dev/null )
mkdir -p "$TMP/cesium" "$TMP/ort"
tar xzf "$TMP"/cesium-1.146.0.tgz -C "$TMP/cesium"; tar xzf "$TMP"/onnxruntime-web-1.20.1.tgz -C "$TMP/ort"
rm -rf "$OUT/globe" "$OUT/ort"; mkdir -p "$OUT/globe" "$OUT/ort"
cp -R "$TMP/cesium/package/Build/Cesium/." "$OUT/globe/"
cp "$TMP/cesium/package/LICENSE.md" "$OUT/globe/LICENSE.md"
# CSP compatibility: the bundled Knockout 3.5.1 resolves the global object with
# `this||(0,eval)("this")`, which needs 'unsafe-eval' when loaded as an ES module (where
# `this` is undefined). Replace it with the equivalent `globalThis` so the workspace CSP can
# stay without 'unsafe-eval'. The patch is verified below; the build fails if it no longer applies.
for f in index.js Cesium.js; do
  sed -i 's/this||(0,eval)("this")/this||globalThis/g' "$OUT/globe/$f"
  if grep -q '(0,eval)("this")' "$OUT/globe/$f"; then echo "Cesium CSP patch did not apply to $f" >&2; exit 1; fi
done
echo "Patched: Knockout global lookup -> globalThis (CSP, no unsafe-eval)" > "$OUT/globe/ONCOTICS-PATCHES.txt"
# WebAssembly runtime + the WebGPU runtime (used by the self-hosted SAM AI model when the browser supports WebGPU)
for f in ort.wasm.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm ort.webgpu.min.mjs ort-wasm-simd-threaded.jsep.mjs ort-wasm-simd-threaded.jsep.wasm; do cp "$TMP/ort/package/dist/$f" "$OUT/ort/"; done
cp "$TMP/ort/package/LICENSE" "$OUT/ort/LICENSE" 2>/dev/null || true
du -sh "$OUT/globe" "$OUT/ort"
