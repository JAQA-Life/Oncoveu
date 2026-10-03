# Deploying Oncotics to Hostinger

oncotics.com is a **static website**: HTML, CSS, JavaScript and WebAssembly files. It has no server
code, database or Node.js process. All data calls go from the visitor's browser straight to the
public APIs. Any Hostinger web hosting plan can serve it from `public_html`.

There are two ways to put it there. Both serve the same files.

| | Method A: upload a zip (any plan) | Method B: Git auto-deploy (any plan with hPanel Git) |
|---|---|---|
| How | hPanel File Manager, upload and extract | hPanel → Advanced → Git pulls a branch into `public_html` |
| Updates | Re-upload the zip | Every push to the deploy branch redeploys automatically |
| Branch | — | `hostinger-deploy`, which contains only the built website at its root |

Do **not** create a Hostinger "Node.js Web App" from this repository. The repository root is the
full OHIF monorepo, so Hostinger would try to build the whole viewer. The site needs no Node.js
runtime on the server.

## 1. Build the site (on your computer, once per release)

Requirements:
- Git
- Node.js 20+ (Node 22 or 24 is fine)
- Python 3.10+ with Pillow (`pip install pillow`)
- `zip`

The OHIF build also needs about 8 GB of RAM.

```bash
git clone https://github.com/JAQA-Life/Oncoveu.git && cd Oncoveu
git checkout claude/oncotics-precision-workspace-uuswkw    # or main, once merged
oncotics/scripts/build-site.sh            # pages, Workspace, Imaging Workbench -> oncotics/public_html
oncotics/scripts/fetch-vendor-assets.sh   # self-hosted 3D globe + local AI runtime (~34 MB, from npm)
oncotics/scripts/build-ohif.sh            # self-hosted OHIF Viewer at /assets/ohif/ (~125 MB; 10–20 min)
oncotics/scripts/fetch-ai-models.sh       # self-hosted SAM ViT-B AI model at /assets/models/sam-b/ (~200 MB)
```

If you upload with File Manager instead, you can add the AI model by hand:
1. Download the two files.
   - Encoder (~180 MB): https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx
   - Decoder (~17 MB): https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx
2. Rename them to `encoder.onnx` and `decoder.onnx`.
3. Upload both to `public_html/assets/models/sam-b/`. FTP is easier than the browser for a 180 MB file.

The last two steps are optional. Without them the site still works:
- The globe uses its built-in renderer.
- Local AI inference reports that the runtime is not deployed.
- "Open OHIF" reports that the viewer is not deployed.
- "AI detection & segmentation (SAM)" reports that the model is not deployed. The built-in automatic detection still works.

Nothing falls back to an external CDN.

## 2A. Method A: upload a zip

```bash
oncotics/scripts/package-hostinger.sh     # -> oncotics/oncotics-hostinger-upload.zip
```

1. Log in to hPanel → **Websites** → oncotics.com → **Dashboard** → **File Manager**.
2. Open `public_html`. Back up or delete the default files already there (for example
   `default.php` or an old `index.html`).
3. Click **Upload** and upload `oncotics-hostinger-upload.zip`. Files up to a few hundred MB upload
   fine; for larger ones, use FTP (hPanel → Files → FTP Accounts).
4. Right-click the zip → **Extract** → extract into `public_html`, not into a sub-folder.
   - You should now see these directly inside `public_html`: `index.html`, `.htaccess`, `about/`,
     `contact/`, `privacy/`, `precision-oncology-workspace/`, `imaging/`, `assets/`, `robots.txt`,
     `sitemap.xml` and `llms.txt`.
   - `.htaccess` starts with a dot and is hidden in some views. Turn on "Show hidden files" to
     confirm it is there.
5. Delete the uploaded zip from `public_html`.
6. Continue with **3. Finish** below.

## 2B. Method B: Git auto-deploy from GitHub

1. Publish the built site to the deploy branch. This creates or updates the branch
   `hostinger-deploy`, whose root is the website. You need push access to the repository.

   ```bash
   oncotics/scripts/publish-deploy-branch.sh
   ```

2. In hPanel → **Websites** → oncotics.com → **Dashboard** → **Advanced** → **Git**:
   - Choose **Connect with GitHub** (or **Continue with GitHub**) and authorize Hostinger for the
     `JAQA-Life/Oncoveu` repository.
   - Repository: `JAQA-Life/Oncoveu`. Branch: **`hostinger-deploy`**. Directory: `public_html`. Leave
     the directory empty first; move any default files out of it.
   - Turn on automatic deployment, so a push to the branch makes Hostinger pull it.
3. Click **Deploy**. Afterwards `public_html` contains the same files as Method A.
4. For each later release, run step 1 of this guide, then `publish-deploy-branch.sh` again. Hostinger
   redeploys on push. If auto-deploy is off, click **Deploy** in hPanel → Git.

Never point hPanel Git at the source branch (`claude/oncotics-precision-workspace-uuswkw` or
`main`). That would copy the whole monorepo into `public_html`.

## Trained cancer AI model packs (Imaging Workbench)
The Workbench's "Trained cancer AI models" mode uses model packs, one folder per model:

| Folder | Model (licence) | Input | Output | Size |
|---|---|---|---|---|
| `cxr-xrv-densenet121` | TorchXRayVision DenseNet-121 (Apache-2.0) | frontal chest X-ray | 18 findings incl. Mass, Nodule, Lung Lesion + activation maps | ~27 MB |
| `path-camelyon16-resnet18` | MONAI pathology tumour detection (Apache-2.0, Camelyon16) | H&E tiles | tumour heatmap + regions | ~43 MB |
| `brain-mri-brats-segresnet` | MONAI BraTS brain tumour segmentation, SegResNet 3D (Apache-2.0) | 4 co-registered MRI volumes: T1c, T1, T2, FLAIR | tumour core / whole tumour / enhancing tumour masks + volumes (mL) | ~18 MB |
| `lung-ct-luna16-retinanet` | MONAI lung nodule detection, RetinaNet 3D (Apache-2.0, LUNA16) | chest CT series or NIfTI | 3D nodule candidate boxes + size | ~80 MB |

Each folder holds `model.onnx`, converted from the authors' official weights, `pack.json` (model
card, pre/post-processing, SHA-256 checksum and the numerical check against the original model) and
the source licence/README files. The two 3D packs are checked twice in GitHub Actions: the ONNX model
against the original PyTorch weights, and the Workbench running in Chromium against MONAI's own
pipeline (pre-processing, sliding window, detector post-processing).

1. On GitHub, open the repository, then **Actions**, then **Oncotics AI model packs**. If Actions is
   disabled, enable it once under **Settings → Actions → General → Allow all actions**.
2. The workflow runs on every push that changes `oncotics/ai/` or `oncotics/imaging/`. You can
   also click **Run workflow**. A full run takes about an hour (it downloads four models and tests
   them in a browser).
3. When it is green, open the run and download the artifact **oncotics-ai-model-packs** (a zip,
   about 160 MB). Artifacts are kept for 30 days; run the workflow again to get a fresh one.
4. Unzip it. You get the four folders above.
5. Upload them to `public_html/assets/models/`, keeping each folder with all its files:
   - **FTP (recommended for the 80 MB lung model):** hPanel → **Files → FTP Accounts** shows the
     host, user and password. In FileZilla, open `public_html/assets/`, create `models` if needed,
     and drag the four folders into it.
   - **File Manager:** open `public_html/assets/`, create `models`, open it, create a folder with
     the exact name of each pack, open it, click **Upload** and select all files from that
     folder of the zip. Or upload the whole zip into `public_html/assets/models/`, right-click →
     **Extract**, and check that the folders are directly inside `models/` (not in an extra
     sub-folder).
   You should end up with, for example,
   `public_html/assets/models/lung-ct-luna16-retinanet/model.onnx` and `.../pack.json`.
6. Upload the site zip again (or at least `public_html/.htaccess`). It now sends
   `Cross-Origin-Embedder-Policy: credentialless` on `/imaging/`, `/assets/ort/` and
   `/assets/ohif/`, which lets Chrome, Edge and Firefox run the 3D models on several CPU threads
   (Safari runs them on one thread).
7. Open https://oncotics.com/imaging/ → **Experimental AI Detection & Inference** →
   **Trained cancer AI models**. Each model shows **Load model**. After loading it shows
   "checksum verified".

What to expect from the 3D models (in the visitor's own browser; nothing is uploaded):
- **Brain MRI**: load the four NIfTI files of one case (for example BraTS `*_t1ce`, `*_t1`, `*_t2`,
  `*_flair`). The sequences are assigned automatically from the file names; check them in the
  panel. A 240 × 240 × 155 case runs 18 windows, usually 1–5 minutes.
- **Lung CT**: open a CT series (or NIfTI) and choose a region. A rectangle drawn around the area of
  interest (one window) takes about 1–3 minutes; a ±30 mm slab across the body 5–20 minutes; a whole
  scan can take an hour or more on a laptop. The panel shows an estimate before you run, progress
  while it runs, and a **Stop** button.



## 3. Finish (both methods)

1. hPanel → **Security → SSL**: make sure the free SSL certificate is installed and active. The
   `.htaccess` forces `https://oncotics.com`.
2. hPanel → **Performance → Cache Manager** (or CDN): purge the cache after every deployment.
3. Do not enable Hostinger features that inject scripts into pages (analytics, chat or cookie
   banners). The Content-Security-Policy and the privacy promises depend on there being none.

## Check after upload
- https://oncotics.com/ · /about/ · /contact/ · /privacy/ · /precision-oncology-workspace/
- https://www.oncotics.com and http://oncotics.com redirect to https://oncotics.com
- https://oncotics.com/workspace redirects to the Workspace
- https://oncotics.com/imaging/ loads the Imaging Workbench; /ohif and /imaging-workbench redirect to it
- https://oncotics.com/assets/ohif/ serves the OHIF Viewer (if deployed). In the Workbench, choose **Open OHIF**: the viewer opens inside the page with local files only, unless you entered your own DICOMweb endpoint.
- `.wasm` files are served as `application/wasm` and `.mjs` files as `text/javascript` (set in `.htaccess`). If LiteSpeed ignores them, add the types in hPanel.
- A missing page such as https://oncotics.com/xyz shows the Oncotics 404 page
- In the Workspace, open **Coverage Console → Check availability (all live)** to confirm every live source answers from your real domain.
- Search: EGFR, BRAF V600E, Osimertinib, NCT02296125, P170019, companion diagnostic.

## Updating later
Rebuild, then either upload the new zip (Method A) or run `publish-deploy-branch.sh` (Method B). HTML files are served with `no-cache`, so changes show immediately; CSS and images are cached for 30 days (the stylesheet link carries a `?v=` date — change it when you change the CSS).

## Important
- Do not add analytics, chat widgets, cookie banners or external scripts: the pages' privacy promises and Content-Security-Policy depend on there being none.
- Do not put the Workspace in a sandboxed iframe (CIViC rejects `Origin: null`).
- Never host images or DICOM files on oncotics.com. The Workbench reads files in browser memory only, and OHIF uses the user's own endpoint.
- All API sources are called live from the visitor's browser. Run **Coverage Console → Check availability** on the real domain once after each deployment. Sources that cannot be reached from oncotics.com automatically show their official link-outs.
