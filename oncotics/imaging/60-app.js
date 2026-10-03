
/* ====================================================================
   PANELS
   ==================================================================== */
var MODAL = null;
function consentState() { return S.consent.phi && S.consent.nondiag; }
function consentBody(purpose) {
  var remote = purpose === 'remote';
  return H`<div class="oi-stack">
    <ul class="oi-list"><li>Images are processed in browser memory only.</li><li>Oncotics does not store images and does not upload images to Oncotics servers.</li><li>Oncotics does not use images for training, analytics, product improvement or human review.</li><li>DICOM files and images may contain protected health information (PHI). Burned-in PHI cannot always be automatically removed.</li><li>AI detection/inference is experimental and non-diagnostic. Do not use results for self-diagnosis or treatment decisions.</li><li>If you select remote inference, the image may be sent directly from your browser to the trusted endpoint you choose, which may log or store it under its own policy.</li><li>You are responsible for using only authorized, appropriately de-identified images where required.</li></ul>
    <label class="oi-check"><input type="checkbox" id="oi-c-phi" ${S.consent.phi ? raw('checked') : ''}><span>I understand images may contain protected health information and I am authorized to handle them.</span></label>
    <label class="oi-check"><input type="checkbox" id="oi-c-nd" ${S.consent.nondiag ? raw('checked') : ''}><span>I understand Oncotics does not store images and that AI inference is experimental and not a diagnosis.</span></label>
    ${remote ? H`<label class="oi-check"><input type="checkbox" id="oi-c-remote" ${S.consent.remote ? raw('checked') : ''}><span>I understand this image will be sent directly from my browser to the selected external inference endpoint and may be logged or stored by that provider.</span></label>` : ''}
    <p class="oi-subtle">Consent is kept in memory for this page only and is cleared by refresh or Clear Session.</p></div>`;
}
function openConsent(purpose, files) {
  MODAL = { title: purpose === 'remote' ? 'Consent required for remote inference' : 'Before loading or connecting imaging data', body: function () { return consentBody(purpose); }, foot: H`<button type="button" class="oi-btn" data-act="modal-cancel">Cancel</button><button type="button" class="oi-btn oi-btn-primary" data-act="consent-ok" data-purpose="${purpose}">Confirm and continue</button>`, purpose: purpose, files: files || null };
  renderModal();
}
function panelHome() {
  return H`<div class="oi-hero"><h2>Welcome to the Oncotics Imaging Workbench</h2>
    <p>View images with the OHIF Viewer or the built-in Oncotics Inspector, inspect lesions, measure, annotate, and — only if you choose — run experimental AI detection (built-in automatic detection, the self-hosted SAM AI segmentation model, or a model you load). Everything stays in your browser memory.</p>
    <div class="oi-grid-3">${[['shield', 'Memory-only', 'Oncotics does not upload or store DICOM/image data. Connections, uploads, inference results and annotations are memory-only; refresh or Clear Session wipes them.'], ['alert', 'PHI-aware', 'DICOM/images may contain PHI. De-identify data when possible. Patient name, ID, dates, institution, accession and operator are hidden by default.'], ['spark', 'Experimental AI only', 'AI detection/inference is opt-in, never automatic, experimental and non-diagnostic. Model cards are shown before anything runs.']].map(function (x) { return H`<div class="oi-feature">${icon(x[0])}<div><h3>${x[1]}</h3><p>${x[2]}</p></div></div>`; })}</div>
    <div class="oi-actions">
      <button type="button" class="oi-btn oi-btn-primary" data-act="panel" data-panel="connect">${icon('link')}Connect DICOMweb endpoint</button>
      <button type="button" class="oi-btn oi-btn-primary" data-act="panel" data-panel="upload">${icon('upload')}Upload local DICOM files</button>
      <button type="button" class="oi-btn" data-act="panel" data-panel="upload">${icon('image')}Upload local non-DICOM image</button>
      <button type="button" class="oi-btn" data-act="panel" data-panel="ai">${icon('spark')}Open experimental AI detection panel</button>
      <button type="button" class="oi-btn" data-act="panel" data-panel="inspect">${icon('scan')}Open manual lesion inspection</button>
      <button type="button" class="oi-btn" data-act="panel" data-panel="ohif">${icon('grid')}OHIF Viewer / user-owned OHIF instance</button>
      ${extBtn('https://www.cancerimagingarchive.net/browse-collections/', 'TCIA')}${extBtn('https://portal.imaging.datacommons.cancer.gov/explore/', 'NCI Imaging Data Commons')}
      <a class="oi-btn" href="${CONFIG.workspaceUrl}">${icon('back')}Return to the Oncotics workspace</a></div></div>
    <div class="oi-grid-2" style="margin-top:14px">${notice('warn', H`<strong>Patients and caregivers:</strong> ${TEXT.patient}`)}${notice('warn', H`<strong>Clinicians:</strong> ${TEXT.clinician}`)}</div>
    <p class="oi-subtle" style="margin-top:10px">This page is not a PACS, not a cloud image archive, not a radiology diagnostic system and not FDA-cleared software. It does not perform RECIST or response assessment.</p>`;
}
function panelConsent() {
  return H`<h2>Consent & Privacy</h2>${notice(consentState() ? 'good' : 'warn', consentState() ? 'Consent confirmed for this page session (memory only).' : 'Consent is required before any upload, DICOMweb connection, OHIF viewing or inference.')}
    <div class="oi-card" style="margin-top:12px">${consentBody(S.consent.remote ? 'remote' : 'base')}<div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-primary" data-act="consent-inline">Save consent for this session</button>${consentState() ? H`<button type="button" class="oi-btn" data-act="consent-revoke">Withdraw consent and clear imaging data</button>` : ''}</div></div>`;
}
function panelConnect() {
  var d = S.dicomweb;
  return H`<h2>Connect Source</h2>${notice('info', 'Connect to a DICOMweb endpoint you trust (QIDO-RS for search, WADO-RS for retrieval). Requests go directly from your browser to that endpoint; Oncotics does not proxy them. The URL and token stay in memory only and are never put in a URL, log or export.')}
    <form class="oi-card oi-form" data-submit="dw-connect" style="margin-top:12px" autocomplete="off">
      <label class="oi-field"><span>QIDO-RS base URL</span><input id="oi-dw-qido" class="oi-input" type="url" placeholder="https://your-pacs.example/dicom-web" value="${d.qido}" spellcheck="false"></label>
      <label class="oi-field"><span>WADO-RS base URL (optional; defaults to QIDO)</span><input id="oi-dw-wado" class="oi-input" type="url" placeholder="https://your-pacs.example/dicom-web" value="${d.wado}" spellcheck="false"></label>
      <label class="oi-field"><span>Authorization header value (optional, e.g. “Bearer …”; memory only)</span><input id="oi-dw-token" class="oi-input" type="password" placeholder="${d.token ? '•••••• set (memory only)' : 'not set'}" spellcheck="false"></label>
      <p class="oi-subtle">Tokens used in a browser are not secrets. They are masked, kept only in memory and cleared by refresh or Clear Session.</p>
      <label class="oi-check"><input type="checkbox" id="oi-dw-stow" data-change="dw-stow" ${d.stow ? raw('checked') : ''}><span>Enable STOW-RS upload in OHIF (off by default; sends data <em>to</em> the endpoint)</span></label>
      <div class="oi-card-foot"><button type="submit" class="oi-btn oi-btn-primary">${icon('link')}${d.loading ? 'Connecting…' : 'Connect (memory only)'}</button>${d.connected ? H`<button type="button" class="oi-btn" data-act="dw-disconnect">Disconnect and forget endpoint</button><button type="button" class="oi-btn" data-act="ohif-open" data-mode="dicomweb">${icon('grid')}Open this endpoint in OHIF</button>` : ''}</div></form>
    ${d.error ? notice('bad', d.error) : ''}
    ${d.studies ? H`<div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Studies on the endpoint (pseudonymous labels; patient names, IDs, dates and descriptions are not shown)</div>
      ${d.studies.length ? H`<table class="oi-table"><thead><tr><th scope="col">Study</th><th scope="col">Modalities</th><th scope="col">Series</th><th scope="col">Instances</th><th scope="col">Actions</th></tr></thead><tbody>${d.studies.map(function (s, i) { return H`<tr><td>${s.label}</td><td>${s.modalities.join(', ') || '—'}</td><td>${s.series != null ? s.series : '—'}</td><td>${s.instances != null ? s.instances : '—'}</td><td><button type="button" class="oi-btn oi-btn-sm" data-act="dw-load" data-i="${i}">Load into Inspector (memory)</button></td></tr>`; })}</tbody></table>` : H`<p class="oi-subtle">No studies returned.</p>`}</div>` : ''}`;
}
function panelUpload() {
  return H`<h2>Upload Image</h2>${notice('warn', H`<strong>${TEXT.dicom}</strong> ${TEXT.burnedIn}`)}
    <div class="oi-grid-2" style="margin-top:12px">
      <div class="oi-card"><div class="oi-card-title">${icon('upload')} DICOM files or folders (browser memory)</div><p class="oi-small">Parsed in your browser by the Oncotics Inspector (uncompressed and baseline-JPEG transfer syntaxes). Compressed syntaxes such as JPEG 2000, JPEG-LS or RLE open in the OHIF Viewer’s local mode. Nothing is uploaded; original filenames are never displayed or exported.</p>
        <label class="oi-drop" data-drop="1"><input type="file" id="oi-file-dicom" multiple data-change="files" accept=".dcm,.dicom,application/dicom,*/*"><span>${icon('upload')} Choose DICOM files</span></label>
        <label class="oi-drop"><input type="file" id="oi-file-dir" multiple webkitdirectory data-change="files"><span>${icon('upload')} Choose a DICOM folder</span></label></div>
      <div class="oi-card"><div class="oi-card-title">${icon('image')} Non-DICOM image (PNG, JPEG, WebP, BMP; TIFF where supported)</div><p class="oi-small"><strong>${TEXT.nonDicom}</strong> Not clinically equivalent to DICOM; no calibrated values. File metadata (EXIF/GPS/device) is not read and is not exported, but burned-in text in the pixels may remain.</p>
        <label class="oi-drop"><input type="file" id="oi-file-img" multiple data-change="files" accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"><span>${icon('image')} Choose images</span></label></div></div>
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">No image at hand?</div><p class="oi-small">Load a synthetic CT-like phantom generated in your browser (not a patient image; no PHI) to try the tools.</p><div class="oi-card-foot"><button type="button" class="oi-btn" data-act="phantom">Load synthetic phantom</button></div></div>
    ${S.loading ? H`<p class="oi-row" role="status"><span class="oi-spinner"></span> Reading files in memory… ${S.loading.done}/${S.loading.total}</p>` : ''}
    ${S.lastIngest && S.lastIngest.length ? notice('info', H`<ul class="oi-list">${S.lastIngest.map(function (m) { return H`<li>${m}</li>`; })}</ul>`) : ''}
    <p class="oi-subtle">Limits: up to ${CONFIG.maxFiles} files, ${CONFIG.maxTotalMB} MB per batch, ${CONFIG.maxFileMB} MB per file. Large or corrupted files fail gracefully and are not kept.</p>`;
}
function panelOhif() {
  var o = S.ohif;
  return H`<h2>OHIF Viewer</h2>${notice('info', 'The OHIF Viewer is self-hosted on this site (/assets/ohif/) and is loaded only when you click Open. It runs entirely in your browser. Its configuration keeps preferences in memory, disables the investigational-use banner in favour of this page’s consent, and never enables upload unless you turn STOW-RS on.')}
    <div class="oi-card-foot" style="margin-top:10px"><button type="button" class="oi-btn oi-btn-primary" data-act="ohif-open" data-mode="local">${icon('upload')}Open OHIF local-files mode</button><button type="button" class="oi-btn" data-act="ohif-open" data-mode="dicomweb" ${S.dicomweb.qido ? '' : raw('disabled')}>${icon('link')}Open OHIF with my DICOMweb endpoint</button>${o.status === 'open' ? H`<button type="button" class="oi-btn" data-act="ohif-close">Close viewer (wipes its state)</button>` : ''}</div>
    ${o.status === 'checking' ? H`<p class="oi-row"><span class="oi-spinner"></span> Checking for the self-hosted OHIF build…</p>` : ''}
    ${o.status === 'unavailable' ? H`${notice('warn', H`<strong>The self-hosted OHIF build is not deployed on this host.</strong> ${o.mode === 'local' ? TEXT.localUnavailable : 'Use the built-in Oncotics Inspector, or a user-owned OHIF instance.'} Site operators: run <code>oncotics/scripts/build-ohif.sh</code> to build OHIF with <code>config/oncotics.js</code> into <code>/assets/ohif/</code>.`)}
      <div class="oi-card" style="margin-top:10px"><div class="oi-card-title">Alternatives</div>
        <form class="oi-row" data-submit="ohif-user"><label class="oi-sr" for="oi-ohif-user">User-owned OHIF URL</label><input id="oi-ohif-user" class="oi-input" type="url" placeholder="https://ohif.your-institution.example/" style="max-width:360px"><button type="submit" class="oi-btn oi-btn-sm">Open my OHIF instance (new tab)</button></form>
        <p class="oi-subtle">Opens in a new tab; nothing is passed to it and the URL is not stored.</p>
        <div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-sm" data-act="ohif-demo">Official OHIF demo viewer (external host)…</button></div></div>` : ''}
    ${o.status === 'open' ? H`${notice('warn', 'OHIF’s study list, overlays and DICOM tag browser display source metadata from your files or endpoint, which can include patient names, IDs and dates. The Oncotics Inspector hides these by default; inside OHIF they are visible on screen only and are not exported by Oncotics.')}<div id="oi-ohif-mount" class="oi-ohif-mount"></div><p class="oi-subtle">Keyboard and screen-reader support inside OHIF is limited. Measurements made inside OHIF stay inside OHIF’s memory and are discarded when you close the viewer. Use the Oncotics Inspector for text-listed measurements and exports.</p>` : ''}`;
}
function seriesNav() {
  if (!S.studies.length) return '';
  return H`<div class="oi-series" role="list" aria-label="Loaded studies and series">${S.studies.map(function (st) { return H`<div role="listitem"><strong class="oi-small">${st.label}</strong>${st.series.map(function (se) { return H`<div class="oi-row oi-small"><span>${se.label} · ${se.modality} · ${se.images.length} image${se.images.length > 1 ? 's' : ''}</span>${se.images.slice(0, 1).map(function (id) { return H`<button type="button" class="oi-btn oi-btn-sm" data-act="select-img" data-id="${id}" ${S.current && seriesOf(curImg()) === se ? raw('aria-current="true"') : ''}>Open</button>`; })}<button type="button" class="oi-btn oi-btn-sm oi-btn-ghost" data-act="series-bookmark" data-id="${se.id}">Bookmark series</button></div>`; })}</div>`; })}</div>`;
}
function inspectorPanel(withTools) {
  var img = curImg();
  var tools = H`<div class="oi-toolbar" role="toolbar" aria-label="Inspector tools">${REGISTRY.tools.map(function (t) { return H`<button type="button" class="oi-tool" aria-pressed="${S.tool === t[0] ? 'true' : 'false'}" data-act="tool" data-tool="${t[0]}">${t[1]}</button>`; })}
    ${S.ai.mode === 'sam' ? H`<button type="button" class="oi-tool" aria-pressed="${S.tool === 'aiclick' ? 'true' : 'false'}" data-act="tool" data-tool="aiclick">AI click-to-segment</button>` : ''}<button type="button" class="oi-tool" data-act="view-reset">Reset view</button><button type="button" class="oi-tool" data-act="step" data-dir="-1" aria-label="Previous image">◀</button><button type="button" class="oi-tool" data-act="step" data-dir="1" aria-label="Next image">▶</button>
    <button type="button" class="oi-tool" data-act="key-image">★ Key image</button><button type="button" class="oi-tool" data-act="compare-add">+ Compare</button></div>`;
  var layers = H`<div class="oi-row oi-small" style="margin-top:6px"><label class="oi-check"><input type="checkbox" data-change="layer-ai" ${S.layers.ai ? raw('checked') : ''}>AI suggestion layer</label><label class="oi-small">opacity <input type="range" min="0.1" max="1" step="0.05" value="${S.layers.aiOpacity}" data-change="ai-opacity" aria-label="AI overlay opacity"></label>
    <label class="oi-check"><input type="checkbox" data-change="layer-ann" ${S.layers.ann ? raw('checked') : ''}>User annotations</label><label class="oi-small">opacity <input type="range" min="0.1" max="1" step="0.05" value="${S.layers.annOpacity}" data-change="ann-opacity" aria-label="Annotation opacity"></label></div>`;
  var meta = img ? H`<details class="oi-details"${S.showMeta ? raw(' open') : ''}><summary>Image information (technical fields only)</summary><dl class="oi-kv">${Object.keys(img.tech || {}).map(function (k) { return H`<dt>${k}</dt><dd>${img.tech[k]}</dd>`; })}<dt>Measurement units</dt><dd>${unitsOf(img).name} — ${unitsOf(img).note}</dd><dt>Pixel spacing</dt><dd>${img.spacing ? img.spacing.join(' × ') + ' mm (' + (img.spacingSource || 'header') + ')' : 'unknown — measurements are in pixels'}</dd>${img.lossy ? H`<dt>Compression</dt><dd>Lossy JPEG decoded by the browser (8-bit display values)</dd>` : ''}</dl>
      ${img.identityPresent && img.identityPresent.length ? H`${notice('warn', H`This file contains identifying DICOM attributes (${img.identityPresent.join(', ')}). They are hidden by default and are never exported.`)}<label class="oi-check"><input type="checkbox" data-change="show-identity" ${S.showIdentity ? raw('checked') : ''}><span>Show source identity metadata on screen (warning: may display PHI; not exported)</span></label>
        ${S.showIdentity ? H`<dl class="oi-kv oi-phi">${Object.keys(img.identity).map(function (k) { return H`<dt>${k}</dt><dd>${img.identity[k]}</dd>`; })}</dl>` : ''}` : ''}
      ${img.burnedIn && /YES/i.test(img.burnedIn) ? notice('bad', 'The DICOM header flags burned-in annotation (possible PHI in pixels).') : ''}</details>` : '';
  return H`${withTools ? tools : ''}<div class="oi-viewer-wrap"><div id="oi-viewer-mount" class="oi-viewer-mount"></div></div>${withTools ? layers : ''}
    ${img && img.frames.length > 1 ? H`<label class="oi-row oi-small" style="margin-top:6px">Frame <input type="range" min="0" max="${img.frames.length - 1}" value="${S.frame}" data-change="frame" aria-label="Frame"> ${S.frame + 1}/${img.frames.length}</label>` : ''}
    ${img && img.kind === 'gray' ? H`<div class="oi-row oi-small" style="margin-top:6px">Window presets: ${[['Soft tissue', 40, 400], ['Lung', -600, 1500], ['Bone', 400, 1800], ['Brain', 40, 80], ['Full range', (img.range.min + img.range.max) / 2, img.range.max - img.range.min]].map(function (p) { return H`<button type="button" class="oi-btn oi-btn-sm oi-btn-ghost" data-act="wl-preset" data-c="${p[1]}" data-w="${p[2]}">${p[0]}</button>`; })}</div>` : ''}
    ${S.tool !== 'pan' && S.tool !== 'wl' ? H`<p class="oi-subtle">${{ aiclick: 'AI click-to-segment: click a structure to outline it with the AI model (experimental; each click is one AI suggestion).', length: 'Drag to measure a length.', bidir: 'Drag the long axis, then drag the short axis.', rect: 'Drag a rectangle ROI.', ellipse: 'Drag an ellipse ROI.', angle: 'Click three points (vertex second).', polygon: 'Click points; double-click, Enter or click the first point to close.' }[S.tool] || ''} Measurements are listed in Annotations.</p>` : ''}
    ${meta}`;
}
function panelInspect() {
  return H`<h2>Lesion Inspection</h2>${notice('warn', TEXT.disclaimer)}${seriesNav()}${S.images.size ? inspectorPanel(true) : H`<div class="oi-empty"><h3>No images in memory</h3><p>Upload DICOM or images, connect a DICOMweb endpoint, or load the synthetic phantom.</p><div class="oi-card-foot" style="justify-content:center"><button type="button" class="oi-btn oi-btn-primary" data-act="panel" data-panel="upload">Upload Image</button><button type="button" class="oi-btn" data-act="phantom">Load synthetic phantom</button></div></div>`}
    ${S.compare.length ? H`<div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Comparison set (memory only)</div><div class="oi-compare" id="oi-compare-mount"></div><div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-sm" data-act="compare-clear">Clear comparison</button></div></div>` : ''}`;
}
function annRow(a) {
  var img = S.images.get(a.imageId), m = img ? Inspector.measure(a, img) : {};
  return H`<tr ${S.selected === a.id ? raw('class="oi-sel"') : ''}><td><button type="button" class="oi-linkbtn" data-act="select-ann" data-id="${a.id}">${a.id}</button></td><td>${a.type}</td><td><label class="oi-sr" for="oi-lab-${a.id}">Lesion label for ${a.id}</label><select id="oi-lab-${a.id}" class="oi-select" data-change="ann-label" data-id="${a.id}">${REGISTRY.lesionLabels.map(function (l) { return H`<option ${a.label === l ? raw('selected') : ''}>${l}</option>`; })}</select></td>
    <td>${img ? imgLabel(img) : '—'}</td><td class="oi-small">${Inspector.fmtMeasure(m) || '—'}</td><td>${badge(a.provenance === 'user-generated annotation' ? 'User annotation' : 'Originally AI-derived, accepted by user', a.provenance === 'user-generated annotation' ? 'teal' : 'ai')}</td>
    ${S.notesEnabled ? H`<td><label class="oi-sr" for="oi-note-${a.id}">Note for ${a.id}</label><input id="oi-note-${a.id}" class="oi-input oi-note" maxlength="140" value="${a.note || ''}" data-change="ann-note" data-id="${a.id}" placeholder="No PHI"></td>` : ''}
    <td><button type="button" class="oi-btn oi-btn-sm oi-btn-ghost" data-act="del-ann" data-id="${a.id}" aria-label="Delete ${a.id}">${icon('trash')}</button></td></tr>`;
}
function panelAnnotations() {
  return H`<h2>Annotations</h2><p class="oi-subtle">User-generated annotations, measurements and structured lesion labels, in memory only. They are never sent to any public API or inference endpoint. Labels like “metastasis suspicion” are user observations, not diagnoses.</p>
    ${S.annotations.length ? H`<div class="oi-table-wrap"><table class="oi-table"><caption>${S.annotations.length} annotation(s)</caption><thead><tr><th scope="col">ID</th><th scope="col">Type</th><th scope="col">Structured lesion label</th><th scope="col">Image</th><th scope="col">Measurement</th><th scope="col">Provenance</th>${S.notesEnabled ? H`<th scope="col">Note (memory only)</th>` : ''}<th scope="col"><span class="oi-sr">Actions</span></th></tr></thead><tbody>${S.annotations.map(annRow)}</tbody></table></div>` : H`<div class="oi-empty"><h3>No annotations yet</h3><p>Use the tools in Lesion Inspection.</p></div>`}
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Free-text notes (off by default)</div><label class="oi-check"><input type="checkbox" data-change="notes" ${S.notesEnabled ? raw('checked') : ''}><span>Enable short notes per annotation (memory only; never sent anywhere; excluded from exports unless you opt in on export)</span></label>${S.notesEnabled ? notice('bad', 'Do not type names, dates, record numbers or any other patient-identifying information into notes.') : ''}</div>
    <div class="oi-grid-2" style="margin-top:12px"><div class="oi-card"><div class="oi-card-title">Key images (${S.keyImages.length})</div>${S.keyImages.length ? H`<ul class="oi-list">${S.keyImages.map(function (k, i) { var im = S.images.get(k.imageId); return H`<li><button type="button" class="oi-linkbtn" data-act="goto-key" data-i="${i}">${im ? imgLabel(im) : 'image'}</button> · frame ${k.frame + 1}</li>`; })}</ul>` : H`<p class="oi-subtle">Use ★ Key image in the Inspector.</p>`}</div>
      <div class="oi-card"><div class="oi-card-title">Series bookmarks (${S.seriesBookmarks.length})</div>${S.seriesBookmarks.length ? H`<ul class="oi-list">${S.seriesBookmarks.map(function (b) { return H`<li>${b.label}</li>`; })}</ul>` : H`<p class="oi-subtle">Bookmark a series from the series list.</p>`}</div></div>`;
}
function panelAI() {
  var A = S.ai, img = curImg(), vis = aiVisible().filter(function (r) { return r.imageId === S.current; }), all = A.results.filter(function (r) { return r.imageId === S.current && !r.accepted; }), suppressed = all.length - vis.length;
  var modeSel = H`<fieldset class="oi-card"><legend class="oi-card-title">1 · Choose an inference source</legend>
    <label class="oi-check"><input type="radio" name="oi-ai-mode" value="none" data-change="ai-mode" ${A.mode === 'none' ? raw('checked') : ''}><span><strong>None (default)</strong> — viewing, manual measurement and annotation only.</span></label>
    <label class="oi-check"><input type="radio" name="oi-ai-mode" value="builtin" data-change="ai-mode" ${A.mode === 'builtin' ? raw('checked') : ''}><span><strong>Automatic detection — built-in (instant, no download)</strong> — finds compact regions that stand out from their surroundings on the displayed image. Rule-based computer vision, not trained AI.</span></label>
    <label class="oi-check"><input type="radio" name="oi-ai-mode" value="sam" data-change="ai-mode" ${A.mode === 'sam' ? raw('checked') : ''}><span><strong>AI detection & segmentation — SAM ViT-B (self-hosted)</strong> — finds candidate regions, then outlines each with the Segment Anything AI model; or click any structure to segment it. Runs in your browser; the image never leaves it.</span></label>
    <label class="oi-check"><input type="radio" name="oi-ai-mode" value="local" data-change="ai-mode" ${A.mode === 'local' ? raw('checked') : ''}><span><strong>Local browser model (preferred)</strong> — an ONNX model and Oncotics model manifest you load from your device. No image leaves your browser.</span></label>
    <label class="oi-check"><input type="radio" name="oi-ai-mode" value="remote" data-change="ai-mode" ${A.mode === 'remote' ? raw('checked') : ''}><span><strong>User-supplied endpoint (advanced)</strong> — the image is sent from your browser to an endpoint you type. Disabled until you enable it and consent.</span></label></fieldset>`;
  var src = '';
  if (A.mode === 'local') src = H`<div class="oi-card"><div class="oi-card-title">2 · Load model and manifest (memory only)</div>
      <label class="oi-drop"><input type="file" accept=".json,application/json" data-change="ai-manifest"><span>${icon('card')} Model manifest (oncotics-model-manifest/1 JSON)</span></label>
      <label class="oi-drop"><input type="file" accept=".onnx" data-change="ai-model"><span>${icon('spark')} ONNX model file${A.modelBytes ? ' — loaded (' + num(A.modelBytes.byteLength / 1048576, 1) + ' MB)' : ''}</span></label>
      ${A.manifestError ? notice('bad', H`<strong>Manifest rejected:</strong> ${A.manifestError}`) : ''}<p class="oi-subtle">Your own model: load it here. The WebAssembly runtime is self-hosted at ${CONFIG.ortBase}; no network request is made for inference. See the manifest format in Model Cards & Limitations.</p></div>`;
  if (A.mode === 'remote') src = H`<form class="oi-card oi-form" data-submit="ai-remote" autocomplete="off"><div class="oi-card-title">2 · Configure your trusted endpoint (memory only)</div>${notice('bad', H`<strong>This external endpoint may log, store, or process your image according to its own policy. Do not use unless trusted and authorized.</strong> ${TEXT.remote}`)}
      <label class="oi-field"><span>Endpoint URL (https)</span><input id="oi-ai-url" class="oi-input" type="url" value="${A.remote.url}" placeholder="https://inference.your-institution.example/v1/infer" spellcheck="false"></label>
      <label class="oi-field"><span>Authorization header value (optional; memory only)</span><input id="oi-ai-token" class="oi-input" type="password" placeholder="${A.remote.token ? '•••••• set' : 'not set'}"></label>
      <label class="oi-field"><span>Model name / id (optional)</span><input id="oi-ai-model" class="oi-input" value="${A.remote.model}" maxlength="80"></label>
      <p class="oi-subtle">Request: POST JSON {format:"oncotics-inference-exchange/1", image:{mime:"image/png", encoding:"base64", data, width, height}, modality, model}. Expected response: {model:{…card}, outputs:[{type, label, score, uncertainty?, box?[x0,y0,x1,y1 normalized], polygon?, point?}]}. Endpoint terms are unknown to Oncotics, so this mode is verify-only and off by default.</p>
      <div class="oi-card-foot"><button type="submit" class="oi-btn">${A.remote.enabled ? 'Update endpoint' : 'Enable this endpoint (requires consent)'}</button>${A.remote.enabled ? H`<button type="button" class="oi-btn" data-act="ai-remote-off">Disable and forget endpoint</button>` : ''}</div></form>`;
  if (A.mode === 'builtin') src = H`<div class="oi-card"><div class="oi-card-title">2 · Built-in detector</div><p class="oi-small">Runs instantly on the displayed image (current window/level) at reduced resolution. Change the window/level to target soft tissue, lung or bone. No network request is made.</p></div>`;
  if (A.mode === 'sam') src = H`<div class="oi-card"><div class="oi-card-title">2 · AI model on this site</div>
      ${SAM.status === 'checking' || SAM.status === 'unknown' ? H`<p class="oi-row oi-small"><span class="oi-spinner"></span> Checking for the self-hosted AI model…</p>` : ''}
      ${SAM.status === 'missing' ? notice('warn', H`<strong>The AI model files are not deployed on this site.</strong> Site operators: run <code>oncotics/scripts/fetch-ai-models.sh</code> to self-host SAM ViT-B (Apache-2.0) in ${SAM.base}. Until then, use Automatic detection — built-in.`) : ''}
      ${SAM.status === 'available' ? H`<p class="oi-small">Model files found on this site${SAM.sizeMB ? ' (' + num(SAM.sizeMB, 0) + ' MB)' : ''}. They download from this site once per page and stay in memory; the image never leaves your browser.</p><div class="oi-card-foot"><button type="button" class="oi-btn" data-act="sam-load">${icon('spark')}Load AI model</button></div>` : ''}
      ${SAM.status === 'loading' ? H`<p class="oi-row oi-small" role="status"><span class="oi-spinner"></span> Loading the AI model from this site… this can take a minute.</p>` : ''}
      ${SAM.status === 'ready' ? notice('good', 'AI model loaded in this browser (' + SAM.provider + ').') : ''}
      ${SAM.status === 'error' ? notice('bad', SAM.error) : ''}</div>`;
  var card = A.card ? H`<div>${modelCardView(A.card)}<label class="oi-check" style="margin-top:8px"><input type="checkbox" data-change="ai-reviewed" ${A.reviewed ? raw('checked') : ''}><span>I have reviewed the model card and limitations, and I understand outputs are experimental and not a diagnosis.</span></label></div>` : (A.mode === 'local' ? H`<p class="oi-subtle">The model card appears after a valid manifest is loaded.</p>` : A.mode === 'remote' ? H`<p class="oi-subtle">The endpoint’s model card (if it returns one) is shown after the first run; review it before relying on any output.</p>${A.remote.enabled ? H`<label class="oi-check"><input type="checkbox" data-change="ai-reviewed" ${A.reviewed ? raw('checked') : ''}><span>I understand the endpoint’s outputs are experimental and not a diagnosis.</span></label>` : ''}` : '');
  var samOk = SAM.status === 'available' || SAM.status === 'ready';
  var canRun = A.mode !== 'none' && A.reviewed && img && consentState() && !A.running && (A.mode === 'builtin' ? true : A.mode === 'sam' ? samOk : A.mode === 'local' ? (A.model && A.modelBytes) : (A.remote.enabled && S.consent.remote));
  var results = H`<div class="oi-card"><div class="oi-card-title">4 · AI suggestions for the current image ${badge('AI suggestion', 'ai')}${badge('Experimental', 'warn')}${badge('Not a diagnosis', 'bad')}</div>
    <p class="oi-small">${TEXT.confidence} ${A.card && A.card.calibrated !== 'yes' ? H`<strong>Calibration: ${A.card.calibrated}.</strong> Scores may not correspond to frequencies.` : ''}</p>
    <label class="oi-row oi-small">Threshold <input type="range" min="0" max="1" step="0.01" value="${A.threshold}" data-change="ai-threshold" aria-label="Model score threshold"> <strong>${A.threshold.toFixed(2)}</strong> ${suppressed > 0 ? H`<span class="oi-subtle">· ${suppressed} lower-scoring suggestion(s) hidden by this threshold (not discarded)</span>` : ''}</label>
    ${A.lastRun && A.lastRun.imageId === S.current && !vis.length ? notice('info', H`<strong>${TEXT.noFindings}</strong>`) : ''}
    ${vis.length ? H`<table class="oi-table"><thead><tr><th scope="col">Suggestion</th><th scope="col">Type</th><th scope="col">Label</th><th scope="col">Model score</th><th scope="col">Uncertainty</th><th scope="col">Actions</th></tr></thead><tbody>${vis.map(function (r) { return H`<tr><td>${r.id} ${badge('AI suggestion', 'ai')}</td><td>${r.type}</td><td>${r.label}</td><td>${r.score != null ? r.score.toFixed(3) : '—'} <span class="oi-subtle">(${scoreLabel(r.score)} — model output, not clinical certainty)</span></td><td>${r.uncertainty != null ? r.uncertainty.toFixed(3) : 'not provided'}</td><td>${r.type !== 'classification' && r.type !== 'heatmap' ? H`<button type="button" class="oi-btn oi-btn-sm" data-act="ai-accept" data-id="${r.id}">Accept as annotation</button>` : ''}<button type="button" class="oi-btn oi-btn-sm oi-btn-ghost" data-act="ai-reject" data-id="${r.id}">Reject / hide</button></td></tr>`; })}</tbody></table>` : ''}
    <div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-sm" data-act="ai-clear">Clear all AI results</button><button type="button" class="oi-btn oi-btn-sm" data-act="export" data-kind="inference">${icon('download')}Export inference JSON</button></div></div>`;
  return H`<h2>Experimental AI Detection & Inference</h2>
    ${notice('bad', H`<strong>${TEXT.aiWarn}</strong> ${TEXT.modelOut}`)}
    <div class="oi-grid-2" style="margin-top:10px">${notice('warn', H`<strong>Patients and caregivers:</strong> ${TEXT.patient}`)}${notice('warn', H`<strong>Clinicians:</strong> ${TEXT.clinician}`)}</div>
    <div class="oi-stack" style="margin-top:12px">${modeSel}${src}${A.mode !== 'none' ? H`<div class="oi-card"><div class="oi-card-title">3 · Review the model card, then run</div>${card}
      <div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-primary" data-act="ai-run" ${canRun ? '' : raw('disabled')}>${icon('play')}${A.running ? 'Running…' : A.mode === 'builtin' ? 'Run automatic detection on the current image' : A.mode === 'sam' ? 'Detect & segment with AI on the current image' : 'Run detection / inference on the current image'}</button>${A.mode === 'sam' ? H`<button type="button" class="oi-btn" data-act="tool" data-tool="aiclick" aria-pressed="${S.tool === 'aiclick' ? 'true' : 'false'}" ${samOk && A.reviewed && img && consentState() ? '' : raw('disabled')}>${icon('scan')}${S.tool === 'aiclick' ? 'Click-to-segment is on: click the image' : 'AI click-to-segment'}</button>` : ''}<span class="oi-subtle">${!consentState() ? 'Consent required. ' : ''}${!img ? 'Select an image. ' : ''}${!A.reviewed ? 'Confirm model-card review. ' : ''}Never runs automatically; one run at a time.</span></div>
      ${A.error ? notice('bad', A.error) : ''}</div>` : ''}
      ${S.images.size ? H`<div class="oi-card"><div class="oi-card-title">Current image</div>${inspectorPanel(false)}</div>` : ''}
      ${A.results.length || A.lastRun ? results : ''}</div>`;
}
function panelContext() {
  var C = S.context, r = C.results;
  return H`<h2>Imaging Context</h2>${notice('info', 'Explore non-PHI concepts only (a modality, topic, device or cancer type). Uploaded pixels, DICOM metadata, identifiers, inference outputs and annotations are never attached to these requests. Requests go directly from your browser to Europe PMC, ClinicalTrials.gov and openFDA.')}
    <form class="oi-row" data-submit="context" style="margin-top:10px" autocomplete="off"><label class="oi-sr" for="oi-ctx-q">Imaging concept</label><input id="oi-ctx-q" class="oi-input" maxlength="80" value="${C.q}" placeholder="e.g. breast MRI, radiomics, PET scanner" style="max-width:360px"><button type="submit" class="oi-btn oi-btn-primary">Search context</button></form>
    <div class="oi-row oi-small" style="margin-top:8px">${REGISTRY.modalities.concat(REGISTRY.topics).map(function (t) { return H`<button type="button" class="oi-btn oi-btn-sm oi-btn-ghost" data-act="context-q" data-q="${t}">${t}</button>`; })}</div>
    ${C.loading ? H`<p class="oi-row"><span class="oi-spinner"></span> Searching…</p>` : ''}
    ${r ? H`<div class="oi-grid-3" style="margin-top:12px">
      <div class="oi-card"><div class="oi-card-title">Literature (Europe PMC)</div>${r.papers ? (r.papers.length ? H`<ul class="oi-list">${r.papers.map(function (p) { return H`<li>${p.pmid ? ext('https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(p.pmid) + '/', p.title) : p.title} <span class="oi-subtle">${p.journal || ''} ${p.year || ''}</span></li>`; })}</ul>` : H`<p class="oi-subtle">No records.</p>`) : H`<p class="oi-subtle">Unavailable from this browser. ${ext('https://europepmc.org/search?query=' + encodeURIComponent(C.q), 'Open Europe PMC')}</p>`}<p class="oi-subtle">Research context; not a systematic review.</p></div>
      <div class="oi-card"><div class="oi-card-title">Imaging-related trials (ClinicalTrials.gov)</div>${r.trials ? (r.trials.length ? H`<ul class="oi-list">${r.trials.map(function (t) { return H`<li>${ext('https://clinicaltrials.gov/study/' + encodeURIComponent(t.nct), t.nct)} ${t.title} <span class="oi-subtle">${String(t.status || '').replace(/_/g, ' ').toLowerCase()}</span></li>`; })}</ul>` : H`<p class="oi-subtle">No studies.</p>`) : H`<p class="oi-subtle">Unavailable from this browser. ${ext('https://clinicaltrials.gov/search?term=' + encodeURIComponent(C.q), 'Open ClinicalTrials.gov')}</p>`}<p class="oi-subtle">Trial listings do not determine eligibility.</p></div>
      <div class="oi-card"><div class="oi-card-title">Imaging device records (openFDA 510(k))</div>${r.devices ? (r.devices.length ? H`<ul class="oi-list">${r.devices.map(function (d) { return H`<li>${ext('https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=' + encodeURIComponent(d.k), d.k)} ${d.name} <span class="oi-subtle">${d.applicant || ''} · ${d.decision || ''}</span></li>`; })}</ul>` : H`<p class="oi-subtle">No 510(k) records with this device name.</p>`) : H`<p class="oi-subtle">Unavailable from this browser.</p>`}<p class="oi-subtle">openFDA device records may lag official FDA databases. Clearance (510(k)) is not approval.</p></div></div>` : ''}
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Imaging resources (link-outs)</div><div class="oi-card-foot">${extBtn('https://www.cancerimagingarchive.net/browse-collections/', 'TCIA collections')}${extBtn('https://portal.imaging.datacommons.cancer.gov/explore/', 'NCI Imaging Data Commons')}${extBtn('https://radlex.org/', 'RadLex (RSNA)')}${extBtn('https://www.radiologyinfo.org/en', 'RadiologyInfo.org (patient education)')}${extBtn('https://www.rsna.org/', 'RSNA')}<a class="oi-btn oi-btn-sm" href="${CONFIG.workspaceUrl}">${icon('back')}Oncotics workspace (Devices & Dx, Trials, Literature)</a></div></div>`;
}
function panelExport() {
  return H`<h2>Export & Session</h2>${notice('info', 'Exports are generated in your browser and downloaded directly. By default they exclude image pixels, original filenames, patient identifiers, DICOM identity tags and UIDs, endpoint URLs, tokens and free-text notes.')}
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Local exports</div><div class="oi-card-foot">
      <button type="button" class="oi-btn" data-act="export" data-kind="annotations">${icon('download')}Annotations JSON</button><button type="button" class="oi-btn" data-act="export" data-kind="measurements">${icon('download')}Measurements CSV</button><button type="button" class="oi-btn" data-act="export" data-kind="keyimages">${icon('download')}Key image list</button>
      <button type="button" class="oi-btn" data-act="export" data-kind="inference">${icon('download')}Inference JSON</button><button type="button" class="oi-btn" data-act="export" data-kind="summary">${icon('download')}Non-PHI summary JSON</button><button type="button" class="oi-btn" data-act="export" data-kind="preview">${icon('image')}Annotated preview image (warned)</button><button type="button" class="oi-btn" data-act="print">Print current view</button></div>
      ${S.notesEnabled ? H`<label class="oi-check"><input type="checkbox" data-change="export-notes" ${S.exportNotes ? raw('checked') : ''}><span>Include free-text notes in the annotations export (check that notes contain no PHI)</span></label>` : ''}
      <p class="oi-subtle">File names never include patient names, IDs, dates, search terms or endpoint URLs.</p></div>
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Session</div><p class="oi-small">In memory now: ${S.images.size} image(s) · ${S.annotations.length} annotation(s) · ${S.ai.results.length} AI result(s) · DICOMweb ${S.dicomweb.connected ? 'connected' : 'not connected'} · OHIF ${S.ohif.status === 'open' ? 'open' : 'closed'}.</p>
      <div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-danger" data-act="clear">${icon('trash')}Clear Session (wipe all imaging state)</button></div></div>`;
}
function panelModels() {
  return H`<h2>Model Cards & Limitations</h2>${notice('bad', H`<strong>${TEXT.modelOut}</strong>`)}${notice('info', TEXT.aiDerived)}${notice('warn', TEXT.community)}
    ${S.ai.card && S.ai.card !== BUILTIN_CARD && S.ai.card !== SAM_CARD ? H`<div style="margin-top:10px"><div class="oi-card-title">Model you loaded</div>${modelCardView(S.ai.card)}</div>` : ''}
    <div class="oi-card-title" style="margin-top:12px">Built-in detection on this page</div>${modelCardView(BUILTIN_CARD)}
    <div class="oi-card-title" style="margin-top:12px">Self-hosted AI model (if deployed on this site)</div>${modelCardView(SAM_CARD)}
    <p class="oi-subtle">The default AI mode is “None”. Nothing runs until you choose a mode, review its card and press Run (or click with the AI click-to-segment tool).</p>
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Oncotics model manifest (oncotics-model-manifest/1)</div><pre class="oi-code">${JSON.stringify({ schema: 'oncotics-model-manifest/1', card: { name: 'Example lesion segmenter', version: '0.1.0', source: 'https://example.org/model-repo', license: 'Apache-2.0', intendedUse: 'Research only: highlight candidate regions on CT slices.', modality: ['CT'], imageTypes: ['DICOM', 'PNG'], validationStatus: 'research', limitations: ['Trained on a single public dataset'], failureModes: ['Misses small lesions', 'False positives at vessels'], calibrated: false, confidenceMeaning: 'Mean sigmoid output inside the region', regulatoryStatus: 'not claimed', lastVerified: '2026-01-15', link: 'https://example.org/model-card' }, input: { name: 'input', width: 256, height: 256, channels: 1, layout: 'NCHW', scale: 0.00392157, mean: [0], std: [1] }, output: { name: 'output', type: 'segmentation', labels: ['lesion'], activation: 'sigmoid', threshold: 0.5, minArea: 6 } }, null, 2)}</pre>
      <p class="oi-small">Output types: classification ([K] scores), segmentation / heatmap ([1,C,H,W] or [1,H,W]), boxes ([N,≥5]: x1,y1,x2,y2,score[,class]; boxFormat xyxy-normalized or xyxy-input), keypoints ([N,3]: x,y,score). Inputs are built from the displayed (window/levelled) image.</p></div>
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">General limitations</div><ul class="oi-list"><li>Non-DICOM images are display images, not calibrated data.</li><li>Lossy compression, resizing and window/level choices change model inputs.</li><li>Models may be biased toward the populations, scanners and protocols they were trained on.</li><li>Scores are not probabilities of cancer; calibration is often unknown.</li><li>Oncotics does not perform RECIST or response assessment and makes no regulatory claim for any model.</li></ul></div>`;
}
function panelPrivacy() {
  return H`<h2>Privacy & Safety</h2>${notice('good', H`<strong>${TEXT.badge}</strong>`)}
    <figure class="oi-flow"><svg viewBox="0 0 660 140" width="100%" role="img" aria-labelledby="oi-fl-t oi-fl-d"><title id="oi-fl-t">Imaging data flow</title><desc id="oi-fl-d">A local image or a trusted DICOMweb endpoint you choose is read by the OHIF Viewer or Oncotics Inspector inside your browser and stays in browser memory. There is no Oncotics server in between.</desc><defs><marker id="oi-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
      <rect x="6" y="34" width="180" height="70" rx="12" fill="none" stroke="currentColor" stroke-width="2"/><text x="96" y="64" text-anchor="middle" font-size="13.5" font-weight="700" fill="currentColor">Local image or</text><text x="96" y="84" text-anchor="middle" font-size="10.5" fill="currentColor">trusted DICOMweb endpoint</text>
      <rect x="240" y="34" width="180" height="70" rx="12" fill="none" stroke="#14B8A6" stroke-width="2.5"/><text x="330" y="64" text-anchor="middle" font-size="13.5" font-weight="700" fill="currentColor">OHIF / Inspector</text><text x="330" y="84" text-anchor="middle" font-size="10.5" fill="currentColor">in your browser memory</text>
      <rect x="474" y="34" width="180" height="70" rx="12" fill="none" stroke="currentColor" stroke-width="2"/><text x="564" y="64" text-anchor="middle" font-size="13.5" font-weight="700" fill="currentColor">Your browser</text><text x="564" y="84" text-anchor="middle" font-size="10.5" fill="currentColor">view · annotate · local export</text>
      <line x1="190" y1="69" x2="234" y2="69" stroke="currentColor" stroke-width="2" marker-end="url(#oi-ar)"/><line x1="424" y1="69" x2="468" y2="69" stroke="currentColor" stroke-width="2" marker-end="url(#oi-ar)"/><text x="330" y="128" text-anchor="middle" font-size="12" font-weight="700" fill="#BE123C">No Oncotics server in the middle · nothing uploaded, stored, logged or used for training</text></svg></figure>
    <div class="oi-stack">${notice('warn', TEXT.disclaimer)}${notice('warn', H`<strong>Patients and caregivers:</strong> ${TEXT.patient}`)}${notice('warn', H`<strong>Clinicians:</strong> ${TEXT.clinician}`)}${notice('bad', TEXT.aiWarn)}${notice('warn', TEXT.dicom)}${notice('warn', TEXT.remote)}${notice('info', TEXT.burnedIn)}</div>
    <div class="oi-card" style="margin-top:12px"><div class="oi-card-title">Sources used by this page</div><table class="oi-table"><thead><tr><th scope="col">Source</th><th scope="col">Mode</th><th scope="col">Notes</th></tr></thead><tbody>${REGISTRY.sources.map(function (s) { return H`<tr><td>${s.url ? ext(s.url, s.name) : s.name}</td><td>${badge(s.mode, /linkout|education/.test(s.mode) ? 'outline' : /ai/.test(s.mode) ? 'ai' : 'teal')}</td><td class="oi-small">${s.note || ''}</td></tr>`; })}</tbody></table></div>
    <div class="oi-card oi-legal" style="margin-top:12px"><div class="oi-card-title">Legal</div><ul class="oi-list oi-small"><li>${LEGAL.copyright}</li><li>${LEGAL.notice}</li><li>${LEGAL.imaging}</li><li>${LEGAL.ai}</li><li>OHIF Viewer is © the Open Health Imaging Foundation (MIT License); Cornerstone3D (MIT). ONNX Runtime Web (MIT), if deployed. Oncotics™ is independent and not affiliated with or endorsed by these projects.</li></ul></div>`;
}
var PANELS = { home: panelHome, consent: panelConsent, connect: panelConnect, upload: panelUpload, ohif: panelOhif, ai: panelAI, inspect: panelInspect, annotations: panelAnnotations, context: panelContext, export: panelExport, models: panelModels, privacy: panelPrivacy };

/* ====================================================================
   RENDER / MODAL / ACTIONS
   ==================================================================== */
var rq = false;
function scheduleRender() { if (rq) return; rq = true; requestAnimationFrame(function () { rq = false; render(); }); }
function displayControls() {
  var th = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  return H`<div class="oi-seg" role="group" aria-label="Page theme"><span class="oi-seg-l">Theme</span>${th.map(function (t) { return H`<button type="button" class="oi-seg-b" aria-pressed="${DISPLAY.theme === t[0] ? 'true' : 'false'}" data-act="theme" data-theme="${t[0]}">${t[1]}</button>`; })}</div>
    <label class="oi-seg"><span class="oi-seg-l">Viewer background</span><select class="oi-select oi-select-sm" data-change="viewer-bg" aria-label="Viewer background colour">${Object.keys(VIEWER_BG).map(function (k) { return H`<option value="${k}" ${DISPLAY.viewerBg === k ? raw('selected') : ''}>${VIEWER_BG[k][0]}</option>`; })}</select></label>`;
}
function applyTheme() { if (DISPLAY.theme === 'system') ROOT.removeAttribute('data-theme'); else ROOT.setAttribute('data-theme', DISPLAY.theme); }
function render() {
  applyTheme(); setHTML($('#oi-display'), displayControls());
  var ae = document.activeElement, fid = ae && ROOT.contains(ae) && ae.id ? ae.id : null;
  setHTML($('#oi-nav'), H`<ul role="tablist" aria-label="Imaging Workbench panels" aria-orientation="vertical">${REGISTRY.panels.map(function (p) { var sel = S.panel === p[0]; return H`<li role="presentation"><button type="button" role="tab" id="oi-tab-${p[0]}" class="oi-tab" aria-selected="${sel ? 'true' : 'false'}" tabindex="${sel ? '0' : '-1'}" aria-controls="oi-main" data-act="panel" data-panel="${p[0]}">${icon(p[2])}<span>${p[1]}</span></button></li>`; })}</ul>`);
  var main = $('#oi-main'); main.setAttribute('aria-labelledby', 'oi-tab-' + S.panel);
  var sticky = H`${S.dicomweb.connected ? H`<div class="oi-banner oi-banner-bad" role="status">${icon('alert')} ${TEXT.endpoint} <button type="button" class="oi-linkbtn" data-act="dw-disconnect">Disconnect</button></div>` : ''}${S.ai.mode === 'remote' && S.ai.remote.enabled ? H`<div class="oi-banner oi-banner-bad" role="status">${icon('alert')} Remote inference endpoint enabled: images you run are sent directly to it. <button type="button" class="oi-linkbtn" data-act="ai-remote-off">Disable</button></div>` : ''}`;
  setHTML(main, H`${sticky}${(function () { try { return PANELS[S.panel](); } catch (e) { return notice('bad', 'This panel could not be displayed.'); } })()}`);
  var vm = $('#oi-viewer-mount'); if (vm) { vm.appendChild(Inspector.el); Inspector.draw(); }
  var om = $('#oi-ohif-mount'); if (om && OHIF_FRAME && OHIF_FRAME.parentNode !== om) om.appendChild(OHIF_FRAME);
  var cm = $('#oi-compare-mount'); if (cm) { cm.innerHTML = ''; S.compare.forEach(function (c) { var im = S.images.get(c.imageId); if (!im) return; var fig = document.createElement('figure'); var cv = document.createElement('canvas'); var prevF = S.frame; S.frame = c.frame; var src = Inspector.renderToCanvas(im, false); S.frame = prevF; var sc = Math.min(1, 260 / im.w); cv.width = Math.round(im.w * sc); cv.height = Math.round(im.h * sc); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); src.width = src.height = 0; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Comparison: ' + imgLabel(im)); var cap = document.createElement('figcaption'); cap.textContent = imgLabel(im) + ' (frame ' + (c.frame + 1) + ')'; fig.appendChild(cv); fig.appendChild(cap); cm.appendChild(fig); }); }
  setHTML($('#oi-status'), H`<span>${S.images.size} image(s) in memory · ${S.annotations.length} annotation(s) · ${S.ai.results.length} AI result(s)</span><span class="oi-spacer"></span><button type="button" class="oi-btn oi-btn-sm" data-act="panel" data-panel="privacy">${icon('shield')}Privacy & Safety</button><button type="button" class="oi-btn oi-btn-sm oi-btn-danger" data-act="clear">${icon('trash')}Clear Session</button>`);
  if (fid) { var el = document.getElementById(fid); if (el && el !== document.activeElement) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}
function renderModal() {
  var L = $('#oi-layer');
  if (!MODAL) { L.innerHTML = ''; return; }
  setHTML(L, H`<div class="oi-overlay" data-act="modal-cancel"></div><div class="oi-modal" role="dialog" aria-modal="true" aria-labelledby="oi-modal-t"><div class="oi-modal-head"><h2 id="oi-modal-t">${MODAL.title}</h2><button type="button" class="oi-btn oi-btn-icon" data-act="modal-cancel" aria-label="Close dialog">${icon('x')}</button></div><div class="oi-modal-body">${MODAL.body()}</div><div class="oi-modal-foot">${MODAL.foot}</div></div>`);
  MODAL.trigger = MODAL.trigger || document.activeElement;
  var f = $('.oi-modal input, .oi-modal button'); if (f) f.focus();
}
function closeModal(result) { var m = MODAL; MODAL = null; renderModal(); if (m && m.resolve) m.resolve(result); if (m && m.trigger && document.contains(m.trigger)) try { m.trigger.focus(); } catch (e) { /* ignore */ } }
function clearSession(silent) {
  ohifClose(true);
  S.images.forEach(function (im) { im.frames.forEach(function (f) { try { f.fill(0); } catch (e) { /* ignore */ } }); im.identity = null; });
  URLS.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } }); URLS.clear();
  Inspector.clearCache(); if (S.ai.session && S.ai.session.release) { try { S.ai.session.release(); } catch (e) { /* ignore */ } }
  SAM.emb = null; SAM.embKey = null;   // image-derived AI embedding (the model itself holds no image data)
  S = freshState(); UIDS = { study: uidMapper(), series: uidMapper() }; MODAL = null; renderModal();
  Array.prototype.forEach.call(ROOT.querySelectorAll('input[type=file]'), function (i) { i.value = ''; });
  render(); if (!silent) { toast('Imaging session cleared. Nothing was stored.'); announce('Imaging session cleared: images, annotations, inference results, endpoints and tokens were wiped from memory.'); }
}
var ACT = {
  panel: function (el) { S.panel = el.getAttribute('data-panel'); scheduleRender(); setTimeout(function () { var m = $('#oi-main'); if (m) m.focus({ preventScroll: false }); }, 30); },
  'modal-cancel': function () { closeModal(false); }, 'modal-ok': function () { closeModal(true); },
  'consent-ok': function (el) {
    var phi = $('#oi-c-phi'), nd = $('#oi-c-nd'), rm = $('#oi-c-remote'), purpose = el.getAttribute('data-purpose');
    if (!phi.checked || !nd.checked || (purpose === 'remote' && !(rm && rm.checked))) { toast('Please confirm each statement to continue.'); return; }
    S.consent.phi = true; S.consent.nondiag = true; if (rm) S.consent.remote = rm.checked; S.consent.at = isoNow();
    var files = MODAL && MODAL.files; closeModal(true);
    if (purpose === 'upload' && files) ingestFiles(files);
    else if (purpose === 'connect') dwConnect();
    else if (/^ohif-/.test(purpose)) ohifOpen(purpose.slice(5));
    else if (purpose === 'remote') { S.ai.remote.enabled = !!S.consent.remote; scheduleRender(); }
    else scheduleRender();
  },
  'consent-inline': function () { var phi = $('#oi-c-phi'), nd = $('#oi-c-nd'); if (!phi.checked || !nd.checked) { toast('Please confirm both statements.'); return; } S.consent.phi = S.consent.nondiag = true; S.consent.at = isoNow(); toast('Consent saved for this page session (memory only).'); scheduleRender(); },
  'consent-revoke': function () { clearSession(true); toast('Consent withdrawn; imaging data wiped.'); },
  phantom: function () { loadPhantom(); },   // synthetic, contains no patient data: no consent needed
  'sam-load': function () { samLoad(); },
  theme: function (el) { var t = el.getAttribute('data-theme'); if (t === 'system' || t === 'light' || t === 'dark') { DISPLAY.theme = t; scheduleRender(); announce('Theme: ' + t + '.'); } },
  tool: function (el) { S.tool = el.getAttribute('data-tool'); S.pending = null; scheduleRender(); setTimeout(function () { Inspector.canvas.focus({ preventScroll: true }); }, 40); },
  'view-reset': function () { Inspector.reset(); scheduleRender(); }, step: function (el) { Inspector.step(parseInt(el.getAttribute('data-dir'), 10)); },
  'select-img': function (el) { S.current = el.getAttribute('data-id'); S.frame = 0; S.panel = S.panel === 'ai' ? 'ai' : 'inspect'; scheduleRender(); },
  'select-ann': function (el) { var a = S.annotations.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!a) return; S.selected = a.id; S.current = a.imageId; S.frame = a.frame || 0; S.panel = 'inspect'; scheduleRender(); },
  'del-ann': function (el) { removeAnn(el.getAttribute('data-id')); },
  'key-image': function () { var im = curImg(); if (!im) return; var k = S.keyImages.findIndex(function (x) { return x.imageId === im.id && x.frame === S.frame; }); if (k >= 0) S.keyImages.splice(k, 1); else S.keyImages.push({ imageId: im.id, frame: S.frame, label: imgLabel(im) }); scheduleRender(); },
  'goto-key': function (el) { var k = S.keyImages[parseInt(el.getAttribute('data-i'), 10)]; if (k) { S.current = k.imageId; S.frame = k.frame; S.panel = 'inspect'; scheduleRender(); } },
  'series-bookmark': function (el) { var id = el.getAttribute('data-id'), se = null; S.studies.forEach(function (st) { st.series.forEach(function (x) { if (x.id === id) se = { label: st.label + ' · ' + x.label, id: id }; }); }); if (se && !S.seriesBookmarks.some(function (b) { return b.id === id; })) { S.seriesBookmarks.push(se); toast('Series bookmarked (memory only).'); scheduleRender(); } },
  'compare-add': function () { var im = curImg(); if (!im) return; if (S.compare.length >= 4) { toast('Compare up to 4 images.'); return; } if (!S.compare.some(function (c) { return c.imageId === im.id && c.frame === S.frame; })) S.compare.push({ imageId: im.id, frame: S.frame }); scheduleRender(); },
  'compare-clear': function () { S.compare = []; scheduleRender(); },
  'wl-preset': function (el) { var im = curImg(); if (!im) return; im.wl = { c: parseFloat(el.getAttribute('data-c')), w: Math.max(1, parseFloat(el.getAttribute('data-w'))) }; scheduleRender(); },
  'dw-disconnect': function () { S.dicomweb = freshState().dicomweb; if (S.ohif.mode === 'dicomweb') ohifClose(); toast('Disconnected; endpoint and token forgotten.'); scheduleRender(); },
  'dw-load': function (el) { var s = S.dicomweb.studies && S.dicomweb.studies[parseInt(el.getAttribute('data-i'), 10)]; if (s) dwLoadStudy(s.uid); },
  'ohif-open': function (el) { ohifOpen(el.getAttribute('data-mode')); }, 'ohif-close': function () { ohifClose(); },
  'ohif-demo': function () { confirmBox('Open the official OHIF demo viewer?', notice('bad', H`This opens <strong>viewer.ohif.org</strong> in a new tab. Your browser will load assets from that external host, which Oncotics does not control. Files you open there are handled by that page under its own policies. Oncotics passes nothing to it.`), 'Open external viewer').then(function (ok) { if (ok) window.open(CONFIG.externalOhifDemo, '_blank', 'noopener,noreferrer'); }); },
  'ai-run': function () { runInference(); }, 'ai-accept': function (el) { acceptSuggestion(el.getAttribute('data-id')); }, 'ai-reject': function (el) { rejectSuggestion(el.getAttribute('data-id')); },
  'ai-clear': function () { S.ai.results = []; S.ai.lastRun = null; Inspector.clearCache(); scheduleRender(); toast('AI results cleared from memory.'); },
  'ai-remote-off': function () { S.ai.remote = { url: '', token: '', model: '', enabled: false }; S.consent.remote = false; if (S.ai.mode === 'remote') { S.ai.mode = 'none'; S.ai.reviewed = false; S.ai.card = null; } scheduleRender(); toast('Remote endpoint disabled and forgotten.'); },
  'context-q': function (el) { contextSearch(el.getAttribute('data-q')); },
  export: function (el) { doExport(el.getAttribute('data-kind')); }, print: function () { setTimeout(function () { window.print(); }, 30); },
  clear: function () { clearSession(false); }
};
var SUBMIT = {
  'dw-connect': function () { var q = $('#oi-dw-qido').value.trim(), w = $('#oi-dw-wado').value.trim(), t = $('#oi-dw-token').value.trim(); $('#oi-dw-token').value = ''; if (!safeUrl(q, true)) { toast('Enter a valid https QIDO-RS URL.'); return; } S.dicomweb.qido = q; S.dicomweb.wado = w && safeUrl(w, true) ? w : ''; if (t) S.dicomweb.token = t.slice(0, 4096); dwConnect(); },
  'ohif-user': function () { var u = safeUrl($('#oi-ohif-user').value.trim()); $('#oi-ohif-user').value = ''; if (!u) { toast('Enter an https URL.'); return; } window.open(u, '_blank', 'noopener,noreferrer'); },
  'ai-remote': function () { var u = $('#oi-ai-url').value.trim(), t = $('#oi-ai-token').value.trim(), m = $('#oi-ai-model').value.trim(); $('#oi-ai-token').value = ''; if (!safeUrl(u)) { toast('The endpoint URL must be https.'); return; } S.ai.remote.url = u; if (t) S.ai.remote.token = t.slice(0, 4096); S.ai.remote.model = m.slice(0, 80); S.ai.reviewed = false; if (!S.consent.remote) openConsent('remote'); else { S.ai.remote.enabled = true; scheduleRender(); } },
  context: function () { contextSearch($('#oi-ctx-q').value); }
};
var CHANGE = {
  files: function (el) { var f = el.files; ingestFiles(f); },
  'dw-stow': function (el) { if (!el.checked) { S.dicomweb.stow = false; return; } el.checked = false; confirmBox('Enable STOW-RS upload?', notice('bad', 'STOW-RS lets the OHIF Viewer send DICOM objects (for example measurements or segmentations you save) to your DICOMweb endpoint. Data then leaves your browser and is stored by that endpoint. Enable only for endpoints you are authorized to write to.'), 'Enable STOW-RS').then(function (ok) { if (ok) { S.dicomweb.stow = true; scheduleRender(); } }); },
  'layer-ai': function (el) { S.layers.ai = el.checked; Inspector.draw(); }, 'layer-ann': function (el) { S.layers.ann = el.checked; Inspector.draw(); },
  'ai-opacity': function (el) { S.layers.aiOpacity = parseFloat(el.value); Inspector.draw(); }, 'ann-opacity': function (el) { S.layers.annOpacity = parseFloat(el.value); Inspector.draw(); },
  frame: function (el) { S.frame = parseInt(el.value, 10) || 0; scheduleRender(); },
  'show-identity': function (el) { if (!el.checked) { S.showIdentity = false; scheduleRender(); return; } el.checked = false; confirmBox('Show identity metadata on screen?', notice('bad', 'This may display protected health information (names, IDs, dates, institution). It is shown only on this screen, is never exported, and is hidden again on refresh or Clear Session.'), 'Show on screen').then(function (ok) { if (ok) { S.showIdentity = true; S.showMeta = true; scheduleRender(); } }); },
  'ann-label': function (el) { var a = S.annotations.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (a && REGISTRY.lesionLabels.indexOf(el.value) >= 0) { a.label = el.value; Inspector.draw(); } },
  'ann-note': function (el) { var a = S.annotations.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (a) a.note = String(el.value || '').slice(0, 140); },
  notes: function (el) { if (!el.checked) { S.notesEnabled = false; S.exportNotes = false; S.annotations.forEach(function (a) { a.note = ''; }); scheduleRender(); return; } el.checked = false; confirmBox('Enable free-text notes?', notice('bad', 'Notes stay in memory only and are never sent anywhere, but anything you type could be identifying. Do not enter PHI. Notes are excluded from exports unless you opt in.'), 'Enable notes').then(function (ok) { if (ok) { S.notesEnabled = true; scheduleRender(); } }); },
  'export-notes': function (el) { S.exportNotes = el.checked; },
  'ai-mode': function (el) { S.ai.mode = el.value; S.ai.reviewed = false; S.ai.error = null; if (el.value !== 'local') S.ai.model = null; S.ai.card = el.value === 'builtin' ? BUILTIN_CARD : el.value === 'sam' ? SAM_CARD : null; if (el.value === 'sam') samCheck(); if (el.value !== 'sam' && S.tool === 'aiclick') S.tool = 'pan'; scheduleRender(); },
  'viewer-bg': function (el) { if (VIEWER_BG[el.value]) { DISPLAY.viewerBg = el.value; Inspector.draw(); scheduleRender(); } },
  'ai-reviewed': function (el) { S.ai.reviewed = el.checked; scheduleRender(); },
  'ai-threshold': function (el) { S.ai.threshold = parseFloat(el.value) || 0; scheduleRender(); },
  'ai-manifest': async function (el) { var f = el.files && el.files[0]; el.value = ''; if (!f) return; S.ai.manifestError = null; S.ai.reviewed = false; try { if (f.size > 1048576) throw new Error('Manifest larger than 1 MB.'); var m = JSON.parse(await f.text()), errs = validateManifest(m); if (errs.length) throw new Error(errs.join(' ')); S.ai.model = m; S.ai.card = normCard(m, 'local-browser'); S.ai.session = null; } catch (e) { S.ai.model = null; S.ai.card = null; S.ai.manifestError = e && e.message && !/JSON/.test(e.message) ? e.message : 'Invalid JSON.'; } scheduleRender(); },
  'ai-model': async function (el) { var f = el.files && el.files[0]; el.value = ''; if (!f) return; if (!/\.onnx$/i.test(f.name) || f.size > 400 * 1048576) { toast('Choose an .onnx file up to 400 MB.'); return; } S.ai.modelBytes = new Uint8Array(await f.arrayBuffer()); S.ai.session = null; S.ai.reviewed = false; scheduleRender(); }
};
ROOT.addEventListener('click', function (e) { var t = e.target.closest ? e.target.closest('[data-act]') : null; if (!t || !ROOT.contains(t) || t.tagName === 'A') return; var fn = ACT[t.getAttribute('data-act')]; if (!fn) return; e.preventDefault(); try { fn(t, e); } catch (err) { toast('That action could not be completed.'); } });
ROOT.addEventListener('change', function (e) { var t = e.target, fn = t && t.getAttribute && CHANGE[t.getAttribute('data-change')]; if (fn) { try { fn(t); } catch (err) { toast('That change could not be applied.'); } } });
ROOT.addEventListener('submit', function (e) { e.preventDefault(); var fn = SUBMIT[e.target.getAttribute('data-submit')]; if (fn) { try { fn(e.target); } catch (err) { toast('That action could not be completed.'); } } });
ROOT.addEventListener('dragover', function (e) { if (S.panel === 'upload') { e.preventDefault(); } });
ROOT.addEventListener('drop', function (e) { if (S.panel !== 'upload') return; e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && MODAL) { e.preventDefault(); closeModal(false); return; }
  if (e.key === 'Tab' && MODAL) { var f = Array.prototype.slice.call(ROOT.querySelectorAll('.oi-modal input, .oi-modal button, .oi-modal a[href]')); if (!f.length) return; var i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
  var ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('oi-tab') && /^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) {
    e.preventDefault(); var ids = REGISTRY.panels.map(function (p) { return p[0]; }), i2 = ids.indexOf(S.panel);
    i2 = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i2 + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length; S.panel = ids[i2]; render(); var nt = document.getElementById('oi-tab-' + ids[i2]); if (nt) nt.focus();
  }
});
// Leaving or restoring the page from the back/forward cache wipes everything.
window.addEventListener('pagehide', function () { clearSession(true); });
window.addEventListener('pageshow', function (e) { if (e.persisted) clearSession(true); });

/* ====================================================================
   PUBLIC API (memory only). consumeOhifBridge() is read once by
   config/oncotics.js inside the same-origin OHIF iframe.
   ==================================================================== */
window.OncoticsImaging = {
  version: '1.0.0',
  registry: REGISTRY,
  consumeOhifBridge: function () { var b = S.ohif.bridge; S.ohif.bridge = null; return b ? JSON.parse(JSON.stringify(b)) : null; },
  clearSession: function () { clearSession(false); },
  getSummary: function () { return JSON.parse(JSON.stringify(summaryExport())); },
  openPanel: function (id) { if (PANELS[id]) { S.panel = id; scheduleRender(); } }
};
Array.prototype.forEach.call(ROOT.querySelectorAll('[data-oi-year]'), function (el) { el.textContent = String(YEAR); });
render();
})();
