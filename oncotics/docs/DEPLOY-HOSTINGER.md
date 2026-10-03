# Deploying Oncotics to Hostinger

Upload file: `oncotics-hostinger-upload.zip` (its contents go directly inside `public_html`).

## Build the upload
```bash
oncotics/scripts/build-site.sh            # pages, Workspace, Imaging Workbench
oncotics/scripts/fetch-vendor-assets.sh   # optional: self-hosted globe renderer + local AI runtime (~34 MB)
oncotics/scripts/build-ohif.sh            # optional: self-hosted OHIF Viewer at /assets/ohif/ (~125 MB)
oncotics/scripts/package-hostinger.sh     # -> oncotics/oncotics-hostinger-upload.zip
```
Without the optional parts, the site still works:
- The globe uses its built-in renderer.
- Local AI inference reports that the runtime is not deployed.
- "Open OHIF" reports that the viewer is not deployed.

Nothing falls back to an external CDN.

## Steps (hPanel)
1. Log in to hPanel → **Websites** → oncotics.com → **File Manager**.
2. Open `public_html`. Back up or delete the default files already there (e.g. `default.php`, an old `index.html`).
3. Click **Upload** and upload `oncotics-hostinger-upload.zip`.
4. Right-click the zip → **Extract** → extract into `public_html` (not into a sub-folder).
   You should now see `index.html`, `.htaccess`, `about/`, `contact/`, `privacy/`, `precision-oncology-workspace/`, `imaging/`, `assets/`, `robots.txt`, `sitemap.xml`, `llms.txt` directly inside `public_html`.
   `.htaccess` starts with a dot and is hidden in some views; enable "Show hidden files" to confirm it is there.
5. Delete the uploaded zip from `public_html`.
6. hPanel → **Security → SSL**: make sure the free SSL certificate is installed and active. (The `.htaccess` forces `https://oncotics.com`.)
7. If you use the Hostinger CDN or LiteSpeed cache, purge the cache after uploading.

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
Edit the files and re-upload only what changed. HTML files are served with `no-cache`, so changes show immediately; CSS and images are cached for 30 days (the stylesheet link carries a `?v=` date — change it when you change the CSS).

## Important
- Do not add analytics, chat widgets, cookie banners or external scripts: the pages' privacy promises and Content-Security-Policy depend on there being none.
- Do not put the Workspace in a sandboxed iframe (CIViC rejects `Origin: null`).
- Never host images or DICOM files on oncotics.com. The Workbench reads files in browser memory only, and OHIF uses the user's own endpoint.
- Sources marked "verify" in the Coverage Console must be re-checked from the real domain before being promoted to "live".
