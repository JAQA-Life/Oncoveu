
/* ====================================================================
   INGEST (memory only): local files, DICOMweb, synthetic phantom
   ==================================================================== */
var STUDY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function ensureSeries(studyKey, seriesKey, modality) {
  var st = S.studies.find(function (x) { return x.key === studyKey; });
  if (!st) { st = { key: studyKey, id: 'st' + (S.studies.length + 1), label: 'Study ' + (S.studies.length + 1), series: [] }; S.studies.push(st); }
  var se = st.series.find(function (x) { return x.key === seriesKey; });
  if (!se) { se = { key: seriesKey, id: st.id + 's' + (st.series.length + 1), label: 'Series ' + STUDY_LETTERS[st.series.length % 26] + (st.series.length >= 26 ? Math.floor(st.series.length / 26) : ''), modality: modality, images: [] }; st.series.push(se); }
  return se;
}
function addImage(rec, studyKey, seriesKey, order) {
  var se = ensureSeries(studyKey, seriesKey, rec.modality);
  rec.id = 'im' + (S.order.length + 1); rec.seriesId = se.id; rec.label = 'Image ' + (se.images.length + 1); rec.order = order || 0;
  S.images.set(rec.id, rec); S.order.push(rec.id); se.images.push(rec.id);
  se.images.sort(function (a, b) { return (S.images.get(a).order || 0) - (S.images.get(b).order || 0); });
  se.images.forEach(function (id, i) { S.images.get(id).label = 'Image ' + (i + 1); });
  if (!S.current) { S.current = rec.id; S.frame = 0; }
  return rec;
}
function grayRecord(frames, w, h, extra) {
  var st = grayStats(frames[0]), wc = extra.wc, ww = extra.ww;
  var wl = wc && ww && ww[0] > 0 ? { c: wc[0], w: ww[0] } : { c: (st.min + st.max) / 2, w: Math.max(1, st.max - st.min) };
  return Object.assign({ kind: 'gray', frames: frames, w: w, h: h, range: st, wl: { c: wl.c, w: wl.w }, wl0: wl }, extra);
}
async function ingestDicomBuffer(buf, source, uidMaps) {
  var p = parseDicom(buf), I = p.info;
  var px = await extractPixels(p);
  var base = { isDicom: true, source: source, modality: I.modality, spacing: I.spacing && I.spacing.length >= 2 ? I.spacing.slice(0, 2) : (I.spacing && I.spacing.length === 1 ? [I.spacing[0], I.spacing[0]] : null), spacingSource: I.spacingSource, rescaled: I.slope !== 1 || I.intercept !== 0, unitsTag: I.units || I.rescaleType || '', tech: p.tech, identity: p.identity, identityPresent: p.identityPresent, burnedIn: I.burnedIn, lossy: !!px.lossy, tsName: I.tsName, invert: !!px.invert,
    // Slice geometry for 3D AI (kept in memory, never displayed or exported)
    geo: { ipp: I.ipp && I.ipp.length === 3 ? I.ipp : null, iop: I.iop && I.iop.length === 6 ? I.iop : null, thickness: I.thickness, frames: px.frames.length } };
  var rec = px.kind === 'gray' ? grayRecord(px.frames, I.cols, I.rows, Object.assign(base, { wc: I.wc, ww: I.ww })) : Object.assign(base, { kind: 'rgb', frames: px.frames, w: I.cols, h: I.rows, range: { min: 0, max: 255 }, wl: { c: 128, w: 256 }, wl0: { c: 128, w: 256 } });
  delete rec.wc; delete rec.ww;
  // Study/series grouping keys are kept in memory only (UIDs are never displayed or exported).
  return addImage(rec, uidMaps.study(I.studyUid || 'unknown-study'), uidMaps.series(I.seriesUid || ('series-' + I.seriesNo)), I.instNo);
}
function uidMapper() { var m = new Map(); return function (uid) { if (!m.has(uid)) m.set(uid, 'k' + m.size + '_' + Math.random().toString(36).slice(2, 8)); return m.get(uid); }; }
var UIDS = { study: uidMapper(), series: uidMapper() };
async function ingestFiles(fileList) {
  if (!S.consent.phi || !S.consent.nondiag) { openConsent('upload', fileList); return; }
  var files = Array.prototype.slice.call(fileList || []).slice(0, CONFIG.maxFiles), total = files.reduce(function (a, f) { return a + f.size; }, 0);
  if (!files.length) return;
  if (total > CONFIG.maxTotalMB * 1048576) { toast('These files total ' + Math.round(total / 1048576) + ' MB, above the ' + CONFIG.maxTotalMB + ' MB in-browser limit. Load fewer files or use OHIF with a DICOMweb endpoint.'); return; }
  var ok = 0, rejected = 0, failed = {}, nameRejected = 0, batch = 'b' + (++NIFTI_BATCH.n);
  S.loading = { done: 0, total: files.length }; scheduleRender();
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    try {
      if (suspiciousFilename(f.name)) { nameRejected++; continue; }        // never stored, never logged
      if (f.size > CONFIG.maxFileMB * 1048576) { rejected++; continue; }
      var isRaster = /^image\/(png|jpeg|webp|bmp|tiff)$/i.test(f.type) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(f.name);
      if (/\.nii(\.gz)?$/i.test(f.name)) {
        var nb = await f.arrayBuffer();
        await ingestNifti(nb, f.name, batch);                          // only a sequence hint is derived from the name
        nb = null;
      } else if (isRaster) {
        var d = await decodeBitmap(f);
        addImage({ isDicom: false, source: 'local-raster', modality: 'non-DICOM', kind: 'rgb', frames: [d.rgba], w: d.w, h: d.h, range: { min: 0, max: 255 }, wl: { c: 128, w: 256 }, wl0: { c: 128, w: 256 }, spacing: null, tech: { Format: (f.type || 'image').replace('image/', '').toUpperCase(), Width: d.w, Height: d.h, Note: 'File metadata (EXIF/GPS/device) is not read and is not exported.' }, identity: {}, identityPresent: [] }, 'raster-' + (S.order.length + 1), 'raster-series-' + (S.order.length + 1), 0);
      } else {
        var buf = await f.arrayBuffer();
        await ingestDicomBuffer(buf, 'local-dicom', UIDS);
        buf = null;
      }
      ok++;
    } catch (e) { var msg = e && e.kind ? dicomErrorText(e) : (/tif/i.test(f.name) ? 'This browser cannot decode TIFF images.' : 'The file could not be read.'); failed[msg] = (failed[msg] || 0) + 1; }
    S.loading.done = i + 1; if (i % 8 === 0) scheduleRender();
  }
  S.loading = null; Inspector.clearCache();
  var msgs = []; if (ok) msgs.push(ok + ' image' + (ok > 1 ? 's' : '') + ' loaded into browser memory'); if (nameRejected) msgs.push(nameRejected + ' file(s) rejected because the file name appears to contain identifiers'); if (rejected) msgs.push(rejected + ' file(s) too large');
  Object.keys(failed).forEach(function (k) { msgs.push(failed[k] + ' × ' + k); });
  S.lastIngest = msgs; toast(msgs[0] || 'Nothing loaded.'); announce(msgs.join('. '));
  if (ok) S.panel = 'inspect';
  scheduleRender();
}
// Synthetic phantom: generated in the browser, contains no patient data (for trying tools only).
function loadPhantom() {
  var w = 512, h = 512, fr = new Float32Array(w * h), seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
    var dx = (x - 256) / 210, dy = (y - 262) / 170, v = -1000;
    if (dx * dx + dy * dy < 1) { v = 40; var l1 = Math.pow((x - 170) / 70, 2) + Math.pow((y - 240) / 95, 2), l2 = Math.pow((x - 342) / 70, 2) + Math.pow((y - 240) / 95, 2); if (l1 < 1 || l2 < 1) v = -820; if (Math.pow((x - 256) / 26, 2) + Math.pow((y - 300) / 26, 2) < 1) v = 700; if (Math.pow((x - 330) / 13, 2) + Math.pow((y - 205) / 13, 2) < 1) v = 35; }
    fr[y * w + x] = v + (rnd() - 0.5) * 24;
  }
  addImage(grayRecord([fr], w, h, { isDicom: true, synthetic: true, source: 'synthetic', modality: 'CT', spacing: [0.7, 0.7], spacingSource: 'synthetic phantom', rescaled: true, unitsTag: '', wc: [-400], ww: [1500], tech: { Modality: 'CT (synthetic)', Rows: h, Columns: w, 'Pixel spacing (mm)': '0.7\\0.7', Note: 'Synthetic phantom generated in your browser. Not a patient image.' }, identity: {}, identityPresent: [] }), 'synthetic-study', 'synthetic-series', 1);
  S.panel = 'inspect'; toast('Synthetic phantom loaded (not a patient image).'); scheduleRender();
}
/* ---------------- DICOMweb (memory only; direct from the browser) ---------------- */
function dwHeaders(accept) { var h = { Accept: accept }; if (S.dicomweb.token) h.Authorization = S.dicomweb.token; return h; }
async function dwFetch(url, accept, asBuf) {
  var ctrl = new AbortController(), tm = setTimeout(function () { ctrl.abort(); }, 60000);
  try { var r = await fetch(url, { headers: dwHeaders(accept), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: ctrl.signal }); if (!r.ok) throw new Error('http-' + r.status); return asBuf ? { buf: await r.arrayBuffer(), type: r.headers.get('content-type') } : await r.json(); }
  finally { clearTimeout(tm); }
}
var DW_TAG = function (o, t) { var v = o && o[t] && o[t].Value; return v && v.length ? v[0] : null; };
async function dwConnect() {
  if (!S.consent.phi || !S.consent.nondiag) { openConsent('connect'); return; }
  var q = safeUrl(S.dicomweb.qido, true); if (!q) { toast('QIDO-RS base URL must be https (or http://localhost for local testing).'); return; }
  S.dicomweb.loading = true; S.dicomweb.error = null; scheduleRender();
  try {
    var list = await dwFetch(q.replace(/\/$/, '') + '/studies?limit=50&includefield=00081030', 'application/dicom+json');
    if (!Array.isArray(list)) throw new Error('shape');
    // PHI-safe labels: patient names/IDs/dates/descriptions are never displayed.
    S.dicomweb.studies = list.slice(0, 50).map(function (s, i) { return { uid: DW_TAG(s, '0020000D'), label: 'Remote study ' + (i + 1), modalities: (s['00080061'] && s['00080061'].Value) || [], series: DW_TAG(s, '00201206'), instances: DW_TAG(s, '00201208') }; }).filter(function (s) { return s.uid; });
    S.dicomweb.connected = true; toast('Connected (memory only). ' + S.dicomweb.studies.length + ' studies listed with pseudonymous labels.');
  } catch (e) { S.dicomweb.error = /^http-/.test(e.message) ? 'The endpoint answered ' + e.message.replace('http-', 'HTTP ') + '.' : 'The endpoint could not be reached or did not return DICOM JSON (check CORS on the endpoint).'; }
  S.dicomweb.loading = false; scheduleRender();
}
async function dwLoadStudy(uid) {
  var q = safeUrl(S.dicomweb.qido, true).replace(/\/$/, ''), w = (safeUrl(S.dicomweb.wado || S.dicomweb.qido, true) || q).replace(/\/$/, '');
  S.loading = { done: 0, total: 0 }; scheduleRender();
  try {
    var series = await dwFetch(q + '/studies/' + encodeURIComponent(uid) + '/series', 'application/dicom+json'), ok = 0, fail = 0;
    for (var i = 0; i < Math.min(series.length, 8); i++) {
      var se = DW_TAG(series[i], '0020000E'); if (!se) continue;
      var inst = await dwFetch(q + '/studies/' + encodeURIComponent(uid) + '/series/' + encodeURIComponent(se) + '/instances', 'application/dicom+json');
      var ids = inst.map(function (x) { return DW_TAG(x, '00080018'); }).filter(Boolean).slice(0, 300); S.loading.total += ids.length; scheduleRender();
      for (var j = 0; j < ids.length; j++) {
        try { var r = await dwFetch(w + '/studies/' + encodeURIComponent(uid) + '/series/' + encodeURIComponent(se) + '/instances/' + encodeURIComponent(ids[j]), 'multipart/related; type="application/dicom"; transfer-syntax=*', true);
          var parts = parseMultipart(r.buf, r.type); for (var k = 0; k < parts.length; k++) { var u8 = parts[k]; await ingestDicomBuffer(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), 'dicomweb', UIDS); ok++; } }
        catch (e) { fail++; }
        S.loading.done++; if (j % 6 === 0) scheduleRender();
      }
    }
    toast(ok + ' instance(s) retrieved into memory' + (fail ? '; ' + fail + ' could not be decoded here (use OHIF)' : '') + '.'); if (ok) S.panel = 'inspect';
  } catch (e) { toast('Study retrieval failed. Check WADO-RS and CORS on the endpoint.'); }
  S.loading = null; Inspector.clearCache(); scheduleRender();
}
/* ---------------- OHIF (self-hosted; explicit action only) ---------------- */
var OHIF_FRAME = null;
async function ohifProbe() {
  if (S.ohif.available != null) return S.ohif.available;
  try { var r = await fetch(CONFIG.ohifBase + 'app-config.js', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }); S.ohif.available = r.ok; } catch (e) { S.ohif.available = false; }
  return S.ohif.available;
}
async function ohifOpen(mode) {
  if (!S.consent.phi || !S.consent.nondiag) { openConsent('ohif-' + mode); return; }
  ohifClose(true);
  S.ohif.status = 'checking'; S.ohif.mode = mode; S.panel = 'ohif'; scheduleRender();
  var ok = await ohifProbe();
  if (!ok) { S.ohif.status = 'unavailable'; scheduleRender(); return; }
  if (mode === 'dicomweb') {
    if (!S.dicomweb.qido) { S.ohif.status = 'closed'; toast('Enter a DICOMweb endpoint in Connect Source first.'); S.panel = 'connect'; scheduleRender(); return; }
    // One-time, same-origin, memory-only hand-over read by config/oncotics.js inside the iframe.
    S.ohif.bridge = { qidoRoot: S.dicomweb.qido.replace(/\/$/, ''), wadoRoot: (S.dicomweb.wado || S.dicomweb.qido).replace(/\/$/, ''), authorization: S.dicomweb.token || null, stow: !!S.dicomweb.stow };
  } else S.ohif.bridge = { local: true };
  OHIF_FRAME = document.createElement('iframe'); OHIF_FRAME.className = 'oi-ohif-frame'; OHIF_FRAME.title = 'OHIF Viewer (self-hosted, runs in your browser)';
  OHIF_FRAME.setAttribute('referrerpolicy', 'no-referrer'); OHIF_FRAME.setAttribute('allow', 'fullscreen');
  OHIF_FRAME.src = CONFIG.ohifBase + (mode === 'local' ? 'local' : '');
  S.ohif.status = 'open'; scheduleRender();
}
function ohifClose(silent) { if (OHIF_FRAME) { try { OHIF_FRAME.src = 'about:blank'; } catch (e) { /* ignore */ } OHIF_FRAME.remove(); OHIF_FRAME = null; } S.ohif.bridge = null; if (!silent) { S.ohif.status = 'closed'; scheduleRender(); } }
/* ---------------- Imaging context (non-PHI concepts only; never image data) ---------------- */
async function contextSearch(q) {
  var t = checkConcept(q); if (!t) { toast(TEXT.phiInput); return; }
  S.context = { q: t, loading: true, results: null, error: null }; scheduleRender();
  var opt = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors' };
  var get = function (u) { return fetch(u, opt).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }); };
  var res = await Promise.allSettled([
    get(CONFIG.contextHosts.epmc + '/search?format=json&pageSize=8&query=' + encodeURIComponent('"' + t + '" AND (cancer OR oncology OR tumor)')),
    get(CONFIG.contextHosts.ctgov + '/studies?format=json&pageSize=8&fields=NCTId,BriefTitle,OverallStatus&query.term=' + encodeURIComponent(t + ' AND cancer')),
    get(CONFIG.contextHosts.fda + '/device/510k.json?limit=8&search=device_name:' + encodeURIComponent('"' + t.replace(/"/g, '') + '"'))
  ]);
  var v = function (i) { return res[i].status === 'fulfilled' ? res[i].value : null; };
  S.context.results = {
    papers: ((v(0) || {}).resultList || {}).result ? v(0).resultList.result.map(function (p) { return { title: String(p.title || '').replace(/<[^>]*>/g, ''), year: p.pubYear, pmid: p.pmid, journal: p.journalTitle }; }) : null,
    trials: v(1) && Array.isArray(v(1).studies) ? v(1).studies.map(function (s) { var p = s.protocolSection || {}; return { nct: (p.identificationModule || {}).nctId, title: (p.identificationModule || {}).briefTitle, status: (p.statusModule || {}).overallStatus }; }) : null,
    devices: v(2) && Array.isArray(v(2).results) ? v(2).results.map(function (d) { return { k: d.k_number, name: d.device_name, applicant: d.applicant, date: d.decision_date, decision: d.decision_description }; }) : (res[2].status === 'fulfilled' ? [] : null),
    failed: res.filter(function (r) { return r.status === 'rejected'; }).length
  };
  S.context.loading = false; scheduleRender();
}
/* ---------------- Exports (generated locally; no identifiers, pixels, URLs, tokens or filenames) ---------------- */
function exportMeta() { return { generatedBy: 'Oncotics Imaging Workbench', host: CONFIG.host, generatedAt: isoNow(), privacy: { storedByOncotics: false, uploadedToOncotics: false, memoryOnly: true, usedForTraining: false, usedForAnalytics: false, excluded: ['image pixels', 'original filenames', 'patient identifiers', 'DICOM identity tags', 'DICOM UIDs', 'endpoint URLs', 'tokens', 'free-text notes (unless you opted in)'] }, legal: { trademark: LEGAL.mark, copyright: LEGAL.copyright, disclaimer: LEGAL.exportDisclaimer } }; }
function imgRef(id) { var img = S.images.get(id); if (!img) return null; var se = seriesOf(img), st = se && S.studies.find(function (x) { return x.series.indexOf(se) >= 0; }); return { studyLabel: st ? st.label : null, seriesLabel: se ? se.label : null, imageLabel: img.label, modality: img.isDicom ? img.modality : 'non-DICOM', width: img.w, height: img.h, pixelSpacingKnown: !!img.spacing, synthetic: !!img.synthetic }; }
function annExport() { return S.annotations.map(function (a) { var img = S.images.get(a.imageId), m = img ? Inspector.measure(a, img) : {}; var o = { id: a.id, type: a.type, label: a.label, image: imgRef(a.imageId), frame: a.frame || 0, points: a.points.map(function (p) { return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; }), measurement: m, provenance: a.provenance === 'user-generated annotation' ? 'imaging-user-generated-annotation' : a.provenance, aiOrigin: a.aiOrigin || null, maskReference: a.mask ? 'memory-only' : undefined, createdAt: a.createdAt }; if (S.exportNotes && a.note) o.note = a.note; return o; }); }
function inferenceExport() {
  var c = S.ai.card || {};
  return Object.assign(exportMeta(), { model: { name: c.name || null, version: c.version || null, source: c.source || null, license: c.license || null, runtime: c.runtime || (S.ai.mode === 'local' ? 'local-browser' : S.ai.mode === 'remote' ? 'user-endpoint' : 'none'), regulatoryStatus: c.regulatoryStatus || 'unknown / not claimed', validationStatus: c.validationStatus || null, calibrated: c.calibrated || 'unknown' },
    threshold: S.ai.threshold, lastRun: S.ai.lastRun,
    outputs: S.ai.results.filter(function (r) { return !r.rejected; }).map(function (r) { return { id: r.id, type: r.type, label: 'AI suggestion: ' + r.label, score: r.score, scoreMeaning: 'Model output, not clinical certainty', uncertainty: r.uncertainty, aboveThreshold: r.score == null || r.score >= S.ai.threshold, accepted: !!r.accepted, coordinates: r.box ? r.box.map(function (v) { return Math.round(v * 10) / 10; }) : r.polygon ? r.polygon.map(function (p) { return [Math.round(p.x), Math.round(p.y)]; }) : r.point ? [Math.round(r.point.x), Math.round(r.point.y)] : [], maskReference: r.mask ? 'memory-only' : undefined, measurement: r.detail || undefined, partOf: r.group || undefined, input: imgRef(r.imageId), sliceIndex: r.frame || 0, provenance: 'AI-derived experimental inference' }; }),
    warnings: [TEXT.modelOut, TEXT.confidence, TEXT.aiWarn] });
}
function summaryExport() {
  var mods = {}; S.images.forEach(function (i) { var k = i.isDicom ? i.modality : 'non-DICOM'; mods[k] = (mods[k] || 0) + 1; });
  return Object.assign(exportMeta(), { counts: { studies: S.studies.length, images: S.images.size, annotations: S.annotations.length, keyImages: S.keyImages.length, aiSuggestions: S.ai.results.length, acceptedAiSuggestions: S.ai.results.filter(function (r) { return r.accepted; }).length }, modalities: mods, modelCard: S.ai.card || null, lesionLabels: uniq(S.annotations.map(function (a) { return a.label; })) });
}
function confirmBox(title, body, ok) {
  return new Promise(function (resolve) { MODAL = { title: title, body: function () { return body; }, foot: H`<button type="button" class="oi-btn" data-act="modal-cancel">Cancel</button><button type="button" class="oi-btn oi-btn-primary" data-act="modal-ok">${ok || 'Continue'}</button>`, resolve: resolve }; renderModal(); });
}
function doExport(kind) {
  if (kind === 'inference') { if (!S.ai.results.length) return toast('No inference results in memory.'); download(CONFIG.exportNames.inference + '.json', 'application/json', JSON.stringify(inferenceExport(), null, 2)); }
  if (kind === 'annotations') { if (!S.annotations.length) return toast('No annotations in memory.'); download(CONFIG.exportNames.annotations + '.json', 'application/json', JSON.stringify(Object.assign(exportMeta(), { annotations: annExport(), notesIncluded: !!S.exportNotes }), null, 2)); }
  if (kind === 'measurements') { var rows = annExport(); if (!rows.length) return toast('No measurements in memory.'); download(CONFIG.exportNames.measurements + '.csv', 'text/csv;charset=utf-8', '﻿' + toCSV(rows, [['Annotation', 'id'], ['Type', 'type'], ['Lesion label', 'label'], ['Study', function (r) { return r.image && r.image.studyLabel; }], ['Series', function (r) { return r.image && r.image.seriesLabel; }], ['Image', function (r) { return r.image && r.image.imageLabel; }], ['Frame', 'frame'], ['Length', function (r) { return r.measurement.length != null ? r.measurement.length.toFixed(2) : ''; }], ['Long axis', function (r) { return r.measurement.long != null ? r.measurement.long.toFixed(2) : ''; }], ['Short axis', function (r) { return r.measurement.short != null ? r.measurement.short.toFixed(2) : ''; }], ['Unit', function (r) { return r.measurement.unit; }], ['Area', function (r) { return r.measurement.area != null ? r.measurement.area.toFixed(2) : ''; }], ['Area unit', function (r) { return r.measurement.areaUnit || ''; }], ['Mean', function (r) { return r.measurement.mean != null ? r.measurement.mean.toFixed(2) : ''; }], ['SD', function (r) { return r.measurement.sd != null ? r.measurement.sd.toFixed(2) : ''; }], ['Value unit', function (r) { return r.measurement.valueUnit || ''; }], ['Angle (deg)', function (r) { return r.measurement.angle != null ? r.measurement.angle.toFixed(1) : ''; }], ['Provenance', 'provenance'], ['Legal', function () { return LEGAL.exportDisclaimer + ' ' + LEGAL.copyright; }]])); }
  if (kind === 'keyimages') { if (!S.keyImages.length) return toast('No key images bookmarked.'); download(CONFIG.exportNames.keyImages + '.json', 'application/json', JSON.stringify(Object.assign(exportMeta(), { keyImages: S.keyImages.map(function (k) { return { image: imgRef(k.imageId), frame: k.frame, label: k.label }; }), seriesBookmarks: S.seriesBookmarks }), null, 2)); }
  if (kind === 'summary') download(CONFIG.exportNames.summary + '.json', 'application/json', JSON.stringify(summaryExport(), null, 2));
  if (kind === 'preview') {
    var img = curImg(); if (!img) return toast('Select an image first.');
    confirmBox('Export annotated preview image?', notice('bad', H`<strong>${TEXT.annotatedExport}</strong> ${img.burnedIn && /YES/i.test(img.burnedIn) ? 'The DICOM header flags burned-in annotation for this image.' : ''}`), 'Export image').then(function (ok) { if (!ok) return; var c = Inspector.renderToCanvas(img, true); c.toBlob(function (b) { if (b) download(CONFIG.exportNames.preview + '.png', 'image/png', b); c.width = c.height = 0; }, 'image/png'); });
  }
}
