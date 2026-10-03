# Oncotics website, Precision Oncology Workspace and Imaging Workbench

Everything under `oncotics/` is the static oncotics.com site. It has no backend, proxy, database,
analytics, cookies or browser storage. All data calls go directly from the visitor's browser to public
sources.

| URL | What | Source |
|---|---|---|
| `/` `/about/` `/contact/` `/privacy/` | Static pages | `site/build_site.py`, `site/assets.py` |
| `/precision-oncology-workspace/` (alias `/workspace`) | Precision Oncology Workspace (17 modules) | `workspace/*.js` → one HTML file |
| `/imaging/` (aliases `/ohif`, `/imaging-workbench`) | Oncotics Imaging Workbench (consent, memory-only upload, inspector, opt-in AI, exports) | `imaging/*.js` → one HTML file |
| `/assets/ohif/` | Self-hosted OHIF Viewer, embedded by the Workbench on request | this repository + `platform/app/public/config/oncotics.js` |
| `/assets/globe/` | Self-hosted CesiumJS for the Overview globe (optional; built-in renderer otherwise) | `scripts/fetch-vendor-assets.sh` |
| `/assets/ort/` | Self-hosted ONNX Runtime Web for local Workbench inference (optional) | `scripts/fetch-vendor-assets.sh` |
| `/assets/models/sam-b/` | Self-hosted SAM ViT-B AI model for Workbench AI detection & segmentation (optional) | `scripts/fetch-ai-models.sh` |
| `/assets/models/<pack>/` | Trained cancer AI model packs: chest X-ray, H&E pathology, 3D brain MRI tumour segmentation, 3D lung CT nodule detection (optional) | GitHub Actions "Oncotics AI model packs" (`ai/build_model_packs.py`) |

## Build

```bash
oncotics/scripts/build-site.sh            # workspace + imaging + static site -> oncotics/public_html
oncotics/scripts/fetch-vendor-assets.sh   # optional: CesiumJS 1.146.0 + ONNX Runtime Web 1.20.1 (npm registry)
oncotics/scripts/build-ohif.sh            # optional: OHIF Viewer -> public_html/assets/ohif (needs ~8 GB RAM)
oncotics/scripts/fetch-ai-models.sh       # optional: SAM ViT-B AI model -> public_html/assets/models/sam-b (~200 MB)
oncotics/scripts/package-hostinger.sh     # zip public_html for hPanel upload
```

Requirements:

- Node 20+ for `node --check` and the vendor scripts.
- Python 3.10+ with Pillow for the site.
- The repository's pnpm toolchain for OHIF.

The vendor and OHIF outputs are not committed (see `.gitignore`).

Each single-file build runs `node --check` and a privacy guard. The guard rejects storage APIs, cookies,
service workers, Cache Storage, geolocation, console logging and the retired product name.

## Source modes

Every source in the Workspace registry (Coverage Console) has a mode:

- **live** — every source with a public browser API. It is called automatically as the user searches,
  or when a section is first shown. There are no "Try live" buttons. If a source cannot be reached
  from the browser (CORS, network, rate limit, missing identifier), the section shows the official
  link-out instead.
  - Sources first verified on 28 Sept 2026 carry `corsVerified: true`.
  - The newer ones (OncoTree, NCI GDC, DGIdb, Complex Portal, QuickGO, PDBe, EBI Proteins, OpenAlex,
    Crossref, Semantic Scholar) show "CORS to be confirmed" until you run
    **Coverage Console → Check availability** from https://oncotics.com and set `corsVerified` in
    `workspace/05b-registry-extra.js`.
- **link-out** — opens the official site in a new tab. No request is made from the page.
- **unavailable** — retired or not usable from a browser (for example Open Targets Genetics).
- **imaging-source**, **patient-education**, **developer-reference** and **ai-derived-optional** —
  descriptive link-out categories. The page never fetches them.

License-restricted sources (OncoKB) are link-out unless both a feature flag and a user-entered token are
present. Tokens are memory only.

## Searching
- The global search box interprets the query; see the scores in Overview → Search Interpretation.
- A free-text clinical concept is sent to every live source with a free-text search (30 sources), and
  each result links to its official source.

## Docs

- `docs/DEPLOY-HOSTINGER.md` — upload, checks and the release checklist.
- `docs/WORKSPACE-BUILD-NOTES.md` — architecture, API facts and where things live in the code.
- `docs/IMAGING-MODEL-MANIFEST.md` — local model manifest and the user-endpoint exchange format.
- `docs/SEO-AEO-GEO.md` — metadata strategy.
