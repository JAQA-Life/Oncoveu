# Oncotics Precision Oncology Workspace: build notes (28 Sept 2026)

Deliverable: `oncotics-precision-workspace.html`. One self-contained file (~495 KB), vanilla JS, no dependencies, no build step. Recommended URL: https://oncotics.com/precision-oncology-workspace. Embed notes are in the comment at the top of the file.

## Live sources (browser CORS verified 28 Sept 2026 from a cross-origin https page)
- Tier A live: CIViC (GraphQL only), ClinicalTrials.gov v2, openFDA drug + device, Ensembl, MyGene.info, MyVariant.info, UniProt, Europe PMC.
- Tier B live (lazy / user-triggered): RxNorm, STRING, Reactome, AlphaFold, Open Targets GraphQL, cBioPortal, GWAS Catalog v2, ChEMBL, PubChem, EBI OLS4.
- Link-out only: NCI EVS (CORS failed), FDA MedWatch RSS (CORS failed), all FDA official device DBs, CDx list, MAUDE, GUDID, Drugs@FDA, DailyMed, global registries/regulators.
- Every request the app builds (167 URL/GraphQL variants) was replayed live; field paths used by the normalizers were checked against live responses.

## API facts that shaped the code
- CIViC REST v1 is retired; GraphQL `search(query:)` needs `String!`. Rejects Origin: null with HTTP 422.
- openFDA: some SPL labels (e.g. osimertinib) have an empty `openfda` block, so label lookup also matches `spl_product_data_elements`. De Novo (DEN…) records come from `/device/510k.json`. Recall class comes from `/device/enforcement.json` joined on recall number.
- Open Targets: `knownDrugs` was replaced by `drugAndClinicalCandidates`.
- GWAS Catalog: legacy v1 association endpoint timed out; v2 `/associations?rs_id=` is used.
- ClinicalTrials.gov: sorting by NCT ID or title is unsupported (HTTP 400).
- Ensembl VEP: 10–15 s; gene-symbol HGVS (BRAF:p.Val600Glu) errors without CORS headers; transcript HGVS works.
- One rsID can map to several alleles (rs113488022 → V600A/E/G/K). The app shows the choices instead of picking one.
- Europe PMC returned HTTP 503 (no CORS headers) after bursts during testing; the app spaces its requests (1 at a time, 400 ms) and shows a link-out when it is unreachable.

## Where things live in the code
- Source capability registry: `SOURCES`; link-outs: `linkout()` / `LINK`; runtime status: `Runtime`.
- Request queue, timeouts, 429 handling: `Net`; async state: `load()` slots.
- Entity detection + PHI guard: `detect()` / `checkInput()`; alias maps: `GENES`, `GENE_ALIASES`, `DRUG_BRANDS`.
- Loaders (query builders + normalizers): `Loaders.*`.
- Legal strings (only place with ™): `LEGAL`. Safety wording: `SAFETY`. Export names: `CONFIG.exportNames`.
- Public API: `window.OncoticsWorkspace` (search, openModule, openTrialByNct, openDrugByName, openDeviceByName, findCompanionDiagnosticsForDrug, findDiagnosticsForGene, addToBoard, getVisibleResults, getSessionSummary, …).

## Privacy
- No storage APIs, cookies, analytics, service workers or console logging. Search text never goes into URLs or file names. Requests use `cache: no-store`, `credentials: omit`, `referrerPolicy: no-referrer`.
- MAUDE narratives are never retained; they are fetched only on explicit click, shown while the dialog is open, and exported only after a second opt-in.
- The standalone page carries a CSP that only allows connections to the listed API hosts.

## Before release
1. Re-verify CORS from the real https://oncotics.com origin (Coverage Console → "Check availability").
2. Spot-check link-out templates flagged "verify" (FDA recall/classification/De Novo, GUDID, ANZCTR, CTIS, TGA, MHRA, EMA, jRCT, KEGG, PharmGKB, Expression Atlas, OncoKB, COSMIC, DepMap, GTEx).
3. Set `CONFIG.privacyPolicyUrl`; add the real logo in the logo slot.
4. Live smoke test: EGFR, BRAF V600E, KRAS G12C, Osimertinib, Tagrisso, NCT02296125, 27283860, rs113488022, NM_004333.6:c.1799T>A, P170019, PQP, MSI-H, companion diagnostic.

## Changes from the brief
- The quick pill "NCT04234567" was replaced with NCT02296125 (FLAURA); NCT04234567 returns 404 on ClinicalTrials.gov.

---

# Version 2.0.0 additions (3 Oct 2026)

The build is now `workspace/build.sh`. It concatenates parts 04–14 into one IIFE, runs `node --check`
and the privacy and name guards, and writes `dist/oncotics-precision-workspace.html` (~840 KB). The
site build copies that file to `/precision-oncology-workspace/`.

## New parts
- `05b-registry-extra.js` holds the feature flags (`CONFIG.features`), the extra sources (OncoTree,
  GDC, DGIdb, Complex Portal, QuickGO, PDBe, EBI Proteins, OpenAlex, Crossref, Semantic Scholar,
  OncoKB, and many link-outs), the per-source flags, `FETCHABLE_MODES`, and the legal and safety
  strings.
- `07b-interpret.js` is the Search Interpretation engine. It is heuristic, gives 0–100 scores, and
  labels them Very High (≥90), High (≥75), Medium (≥50), Low (≥30) or Very Low.
  - It asks for confirmation when the top score is below 50, or when the top two are within 10 points
    and the second is at least 50. No source is called until the user picks a reading.
  - It has vaccine, fertility, gonadotoxicity and imaging dictionaries, and extra PHI patterns (lot
    numbers, dose times, ART cycle and storage IDs, due dates, lab values, DICOM UIDs).
- `07c-geo-data.js` is generated by `tools/build-geo.mjs` from Natural Earth (world-atlas 110m) and
  world-countries. It holds the land polygons and country centroids.
- `08b-loaders-extra.js` holds the loaders for the extra sources. They are live, like every other API
  source.
  - DGIdb (gene and drug) and OncoTree with NCI GDC projects (disease) start with the search.
  - Complex Portal, PDBe, EBI Proteins, QuickGO, GDC gene aggregates, OpenAlex, Crossref and Semantic
    Scholar start when their section is first shown.
  - `autoRun` / `autoAct` in `09-ui.js` start each request once per search. Any failure renders the
    official link-out.
- `10b-globe.js` is the Geographic Activity Globe. Locations come only from records already in memory:
  trial sites with public coordinates, state and country centroids, recall firms and OpenAlex
  institutions.
  - The renderer is self-hosted CesiumJS (`/assets/globe/`, no Ion token, Natural Earth II imagery
    shipped with Cesium, credits hidden). If those assets are missing, WebGL is unavailable or the
    page is opened from `file:`, the built-in canvas renderer is used.
  - OpenStreetMap imagery is opt-in, with a warning.
  - An accessible list is always present.
- `10c-molmap.js` is the Molecular Context Map: an SVG radial graph with provenance per edge
  (source-reported, derived, link-out), filters, a table fallback and an export.
- `10d-overview-interp.js` holds the interpretation panel, the module counts and the imaging context card.
- `11b-vaccines.js` is Vaccines & Cancer Immunization (7 lenses). `11c-fertility.js` is Onco-Fertility
  (13 lenses). `12b-expert.js` is Expert Knowledge & Patient Education.
  - These are evidence-navigation views only. They do not give schedules, safety rankings, or vaccine,
    fertility, pregnancy or contraception advice.

## CSP
- `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`. `'wasm-unsafe-eval'` is needed only for
  CesiumJS's WebAssembly helpers. `'unsafe-eval'` is **not** allowed.
- The bundled Knockout 3.5.1 in Cesium uses `(0,eval)("this")` to find the global object. When
  `fetch-vendor-assets.sh` copies Cesium, it rewrites that expression to `globalThis` and fails if the
  patch no longer applies. `assets/globe/ONCOTICS-PATCHES.txt` records the patch.
- `connect-src` lists every fetchable API host. Add a host there before adding a loader for it.

## Before release (additions)
1. From https://oncotics.com, open **Coverage Console → Check availability**. For each source that
   answers, set `corsVerified: true` in `05b-registry-extra.js`. A source that does not answer keeps
   working as a link-out automatically.
2. Confirm the globe says "High-fidelity 3D renderer (self-hosted)" once `assets/globe/` is deployed.
3. Imaging Workbench checks:
   - Load a DICOM file and a PNG, measure a length, and export JSON/CSV.
   - Check that the export has no file names, UIDs or patient tags.
   - Open OHIF, then clear the session.
