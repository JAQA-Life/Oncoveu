#!/bin/bash
# Self-hosts the AI model used by the Imaging Workbench "AI detection & segmentation" mode:
#   Segment Anything Model (SAM) ViT-B, Meta AI, Apache-2.0 (https://github.com/facebookresearch/segment-anything),
#   ONNX export used by the OHIF Viewer / Cornerstone (encoder fp16 ~180 MB, decoder ~17 MB).
# Files go to oncotics/public_html/assets/models/sam-b/{encoder.onnx,decoder.onnx} and are served from
# oncotics.com only. The page never downloads models from any other host.
# Override the sources with SAM_ENCODER_URL / SAM_DECODER_URL (for example an internal mirror).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(pwd)/public_html/assets/models/sam-b"
ENC="${SAM_ENCODER_URL:-https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx}"
DEC="${SAM_DECODER_URL:-https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx}"
mkdir -p "$OUT"
fetch() { curl -fL --retry 3 --retry-delay 2 -o "$2.part" "$1" && mv "$2.part" "$2"; }
fetch "$ENC" "$OUT/encoder.onnx"
fetch "$DEC" "$OUT/decoder.onnx"
# Sanity checks: real model files, not an HTML error page.
for f in encoder.onnx decoder.onnx; do
  sz=$(wc -c < "$OUT/$f"); if [ "$sz" -lt 1000000 ]; then echo "$f is too small ($sz bytes); download failed" >&2; exit 1; fi
  if head -c 512 "$OUT/$f" | grep -qi "<html"; then echo "$f looks like an HTML page; download failed" >&2; exit 1; fi
done
cat > "$OUT/README.txt" <<TXT
Segment Anything Model (SAM) ViT-B - Meta AI - Apache License 2.0
https://github.com/facebookresearch/segment-anything
ONNX export: $ENC and $DEC
Used by the Oncotics Imaging Workbench in the browser only. Not trained or validated for medical imaging.
TXT
du -sh "$OUT"
