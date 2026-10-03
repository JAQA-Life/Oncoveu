# Imaging Workbench: model manifest and inference exchange formats

The Imaging Workbench (`/imaging/`) never runs AI automatically, never ships a model, and never sends
images to Oncotics. A user who wants experimental AI suggestions supplies one of the following:

- **Local browser model (preferred).** An `.onnx` file plus a manifest JSON
  (`oncotics-model-manifest/1`). Both are read in browser memory, and inference runs in ONNX Runtime Web
  (WebAssembly, single thread) self-hosted at `/assets/ort/`. No network request is made for inference.
- **User-supplied endpoint (opt-in).** This is off by default and needs a separate consent. The currently
  displayed image (rendered PNG, with no DICOM header and no file name) is POSTed directly from the
  browser to the URL the user typed. The request format is `oncotics-inference-exchange/1`.

Every result is labelled *AI-derived experimental inference*. A result is shown only as a suggestion
that the user must accept or reject. Results are never exported unless the user accepts them, and exports
always carry the non-diagnostic disclaimer.

## `oncotics-model-manifest/1`

```json
{
  "schema": "oncotics-model-manifest/1",
  "card": {
    "name": "Example lesion segmenter",
    "version": "0.3.1",
    "source": "https://github.com/example/lesion-seg",
    "link": "https://github.com/example/lesion-seg",
    "license": "Apache-2.0",
    "intendedUse": "Research only. Highlights candidate regions on single 2D CT slices.",
    "validationStatus": "Community model; internal validation on a public dataset only",
    "modality": ["CT"],
    "imageTypes": ["DICOM", "PNG"],
    "limitations": ["Not validated on contrast-enhanced studies"],
    "failureModes": ["False positives at bowel loops"],
    "calibrated": false,
    "confidenceMeaning": "Mean per-pixel sigmoid probability; not a calibrated likelihood.",
    "regulatoryStatus": "None",
    "lastVerified": "2026-09-01"
  },
  "input": {
    "name": "input",
    "width": 256, "height": 256, "channels": 1,
    "layout": "NCHW",
    "scale": 0.00392156862745098,
    "mean": [0], "std": [1]
  },
  "output": {
    "name": "output",
    "type": "segmentation",
    "activation": "sigmoid",
    "threshold": 0.5,
    "minArea": 4,
    "labels": ["candidate region"]
  }
}
```

### `card` (model card, shown before every run)

| Field | Required | Notes |
|---|---|---|
| `name`, `version`, `source`, `license`, `intendedUse`, `validationStatus` | yes | Non-empty strings. If any is missing, the model is rejected. |
| `link` | no | Only `https:` links are shown. |
| `modality`, `imageTypes`, `limitations`, `failureModes` | no | Strings or arrays of strings. |
| `calibrated` | no | `true` / `false`. If omitted, it is shown as "unknown". |
| `confidenceMeaning` | no | Explains what the score means. If omitted, the card says it is not described. |
| `regulatoryStatus` | no | Any FDA/CE/510(k)/De Novo wording is shown as a claim made by the model author and not verified by Oncotics. |
| `lastVerified` | no | Free text date. |

The user must tick "I have reviewed this model card" before inference can run. The confirmation
resets whenever the model changes.

### `input`

| Field | Required | Notes |
|---|---|---|
| `width`, `height` | yes | 1–2048. The displayed image, with the current window/level applied, is resized to this size. |
| `channels` | yes | `1`, which uses luma (0.299 R + 0.587 G + 0.114 B), or `3`, which uses RGB. |
| `layout` | no | `NCHW` (default) or `NHWC`. |
| `scale`, `mean`, `std` | no | `value = (pixel × scale − mean[c]) / std[c]`. Defaults are `1/255`, `[0]` and `[1]`. |
| `name` | no | Input tensor name. Defaults to the model's first input. |

### `output`

| `type` | Tensor expected | Post-processing |
|---|---|---|
| `classification` | `[1, K]` | `activation`: `softmax`, `sigmoid` or none. Labels come from `labels[i]`. |
| `segmentation` | `[1, C, H, W]`, `[C, H, W]` or `[1, H, W]` | Per-channel probability, then `threshold` (default 0.5), then connected components ≥ `minArea` px. A first label containing "background" is skipped. |
| `heatmap` | same as segmentation | Shown as a translucent overlay. The score is the maximum activation. |
| `boxes` | `[N, ≥5]` | Rows of `[x1, y1, x2, y2, score, (class)]`. `boxFormat` is `xyxy-normalized` (default) or `xyxy-pixels` in input-pixel units. `scoreIndex` and `classIndex` are optional. |
| `keypoints` | `[N, ≥3]` | Rows of `[x, y, score]`, using the same coordinate rules as boxes. |

`name` selects the output tensor (default is the first output), and `activation` may be `sigmoid`.
Unsupported shapes are reported as an error. Results are never guessed.

## `oncotics-inference-exchange/1` (user endpoint)

Request (browser → user endpoint; `cache: no-store`, `credentials: omit`, `referrerPolicy: no-referrer`,
120 s timeout). The optional Authorization value the user typed is sent as-is and kept in memory only.

```json
{
  "format": "oncotics-inference-exchange/1",
  "model": "optional model name typed by the user",
  "image": { "mime": "image/png", "encoding": "base64", "data": "<base64>", "width": 512, "height": 512 },
  "modality": "CT"
}
```

The response must be JSON with an `outputs` array. At most 300 outputs are read. Coordinates are
normalised (0–1).

```json
{
  "model": { "name": "…", "version": "…", "source": "…", "license": "…", "intendedUse": "…",
             "validationStatus": "…", "calibrated": false, "confidenceMeaning": "…", "regulatoryStatus": "…" },
  "outputs": [
    { "type": "boundingBox", "label": "candidate region", "score": 0.71, "uncertainty": 0.1, "box": [0.4, 0.3, 0.55, 0.47] },
    { "type": "polygon", "label": "candidate region", "score": 0.66, "polygon": [[0.41, 0.31], [0.5, 0.33], [0.47, 0.42]] },
    { "type": "keypoint", "label": "point", "score": 0.5, "point": [0.5, 0.5] }
  ]
}
```

The endpoint must send CORS headers that allow `https://oncotics.com`. The Workbench CSP allows `https:`
endpoints, plus `http://localhost` and `http://127.0.0.1` for local research servers.
