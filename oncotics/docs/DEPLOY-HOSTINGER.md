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
```

The last two steps are optional. Without them the site still works:
- The globe uses its built-in renderer.
- Local AI inference reports that the runtime is not deployed.
- "Open OHIF" reports that the viewer is not deployed.

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
