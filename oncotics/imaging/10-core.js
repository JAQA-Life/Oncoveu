/*
  Oncotics Imaging Workbench
  Built for oncotics.com. A separate page from the Oncotics Precision Oncology Workspace.
  Oncotics™ is a trademark of Oncotics.
  Educational, research and clinical-information-discovery use only. Not a radiology
  diagnostic system, not a PACS, not a cloud archive, not FDA-cleared software.
  © {current year} Oncotics™. All rights reserved.

  ----------------------------------------------------------------------
  ARCHITECTURE MAP
  ----------------------------------------------------------------------
  - CONFIG / LEGAL / TEXT ...... settings and all safety / legal wording (™ only in LEGAL).
  - REGISTRY ................... Imaging Workbench registry (sources, panels, tools, labels).
  - State ...................... ALL imaging state, in memory only. Clear Session or refresh
                                 wipes it (typed arrays are zeroed, object URLs revoked,
                                 the OHIF iframe is removed, the DICOMweb bridge is dropped).
  - DICOM ...................... minimal in-browser Part-10 parser (uncompressed + baseline
                                 JPEG); identity tags are separated and hidden by default.
  - Inspector .................. canvas viewer: window/level, zoom/pan, stack, measurements,
                                 ROIs, angle, polygon, key images, AI overlay layers.
  - AI ......................... opt-in experimental inference: (A) local ONNX model the user
                                 loads + manifest/model card, run in a browser WASM runtime
                                 self-hosted at /assets/ort/, (B) user-supplied endpoint with
                                 separate consent, (C) none (default). Never automatic.
  - OHIF ....................... self-hosted OHIF Viewer at /assets/ohif/ embedded only after
                                 an explicit click; DICOMweb settings are handed over through a
                                 same-origin, one-time, memory-only bridge (never in a URL).
  PRIVACY: no cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service
  workers, analytics or console logging. Nothing is uploaded to Oncotics.
*/
(function () {
'use strict';
var ROOT = document.getElementById('oncotics-imaging-workbench');
if (!ROOT || ROOT.__oiInit) return;
ROOT.__oiInit = true;
var YEAR = new Date().getFullYear();

var CONFIG = {
  host: 'oncotics.com',
  workspaceUrl: '/precision-oncology-workspace/',
  ohifBase: '/assets/ohif/',
  ortBase: '/assets/ort/',
  maxFiles: 1500,
  maxTotalMB: 700,
  maxFileMB: 300,
  maxImagePixels: 64e6,
  exportNames: { inference: 'Oncotics-Imaging-Inference', annotations: 'Oncotics-Imaging-Annotations', measurements: 'Oncotics-Imaging-Measurements', keyImages: 'Oncotics-Imaging-Key-Images', summary: 'Oncotics-Imaging-Summary', preview: 'Oncotics-Imaging-Annotated-Preview' },
  externalOhifDemo: 'https://viewer.ohif.org/local',
  contextHosts: { epmc: 'https://www.ebi.ac.uk/europepmc/webservices/rest', ctgov: 'https://clinicaltrials.gov/api/v2', fda: 'https://api.fda.gov' }
};
var LEGAL = {
  mark: 'Oncotics™',
  copyright: '© ' + YEAR + ' Oncotics™. All rights reserved.',
  trademark: 'Oncotics™ is a trademark of Oncotics.',
  notice: 'Oncotics™ is a trademark of Oncotics. This tool is provided for educational, research, and clinical-information-discovery purposes only. It does not provide medical, oncological, reproductive, vaccination, radiological diagnostic, regulatory, genetic counseling, or procurement advice.',
  imaging: 'Oncotics™ does not provide radiological diagnostic, medical, oncological, regulatory, or procurement advice.',
  ai: 'AI inference shown in the Oncotics™ Imaging Workbench is experimental, computationally generated, and not a diagnosis.',
  exportDisclaimer: 'Experimental AI inference and user-generated imaging annotations. Not a radiology diagnostic system. Not medical advice.'
};
var TEXT = {
  badge: 'Imaging Privacy: Uploaded images and inference results are kept only in your browser memory. Oncotics does not store, upload, log, or train on your images.',
  disclaimer: 'Oncotics Imaging Workbench is for educational, research, and clinical-information-discovery use only. It is not a radiology diagnostic system. AI detection/inference is experimental and may be incorrect. Imaging interpretations, measurements, and annotations must be confirmed by qualified radiology and oncology professionals.',
  patient: 'If you are a patient or caregiver, do not use AI detection/inference to diagnose cancer, decide treatment, delay care, or interpret scan results. Share images and reports with your clinician.',
  clinician: 'Do not use experimental AI outputs as a standalone diagnostic or treatment basis. Validate all findings through qualified radiology review and institutional workflow.',
  aiWarn: 'Model confidence is not clinical certainty. Absence of AI findings does not rule out disease. Presence of AI findings does not prove disease.',
  dicom: 'DICOM and medical images may contain protected health information. Upload only images you are authorized to handle.',
  remote: 'If you use an external inference endpoint, your image may be transmitted directly from your browser to that provider. Oncotics does not store it, but the provider may log or store it under its own policy.',
  endpoint: 'You are connected to an external imaging source. That source may log or store your requests. Use only trusted endpoints.',
  modelOut: 'Model outputs are experimental, probabilistic, and may be wrong. They are not a diagnosis, not a radiology report, and not a basis for treatment decisions.',
  community: 'Community/open-source models may be unmaintained, biased, or not clinically validated.',
  aiDerived: 'AI-derived inference is computationally generated and is not source-reported clinical evidence.',
  confidence: 'Confidence reflects the model’s internal score, not the probability that a lesion is cancer or that a finding is clinically significant.',
  noFindings: 'No AI suggestions were generated above the selected threshold. Absence of AI findings does not rule out disease.',
  annotatedExport: 'An exported image may contain visible PHI, burned-in text, or overlays derived from your uploaded image. Do not share unless authorized and appropriately de-identified.',
  burnedIn: 'Burned-in text in pixels cannot always be detected or removed. Some side-channel metadata may remain. You remain responsible for uploading only authorized, appropriately de-identified data where required.',
  phiInput: 'This input appears to contain sensitive information. Use only a non-PHI imaging modality, topic, device or cancer type.',
  nonDicom: 'Non-DICOM preview / experimental detection only.',
  localUnavailable: 'Local DICOM upload is unavailable in this OHIF configuration. Use a trusted DICOMweb endpoint or a supported local viewer build.'
};

/* ---------------- Imaging Workbench registry ---------------- */
var REGISTRY = {
  panels: [
    ['home', 'Imaging Home', 'home'], ['consent', 'Consent & Privacy', 'shield'], ['connect', 'Connect Source', 'link'], ['upload', 'Upload Image', 'upload'], ['ohif', 'OHIF Viewer', 'grid'],
    ['ai', 'Experimental AI Detection & Inference', 'spark'], ['inspect', 'Lesion Inspection', 'scan'], ['annotations', 'Annotations', 'pen'], ['context', 'Imaging Context', 'book'],
    ['export', 'Export & Session', 'download'], ['models', 'Model Cards & Limitations', 'card'], ['privacy', 'Privacy & Safety', 'lock']
  ],
  sources: [
    { id: 'ohif_viewer', name: 'OHIF Viewer (self-hosted)', mode: 'imaging-source', note: 'Loaded only after you click Open; assets from this site (/assets/ohif/).' },
    { id: 'user_dicomweb', name: 'User-supplied DICOMweb endpoint', mode: 'imaging-source', note: 'QIDO-RS / WADO-RS; STOW-RS disabled by default; URL and token in memory only.' },
    { id: 'local_dicom', name: 'Local DICOM files', mode: 'memory-only', note: 'Parsed in browser memory; uncompressed and baseline-JPEG transfer syntaxes in the Inspector; other syntaxes in OHIF.' },
    { id: 'local_raster', name: 'Local PNG / JPEG / WebP / BMP / TIFF*', mode: 'memory-only', note: 'Decoded by the browser; file metadata (EXIF/GPS) is never read and is dropped from exports. *TIFF only where the browser decodes it.' },
    { id: 'local_model', name: 'Local ONNX model (user-loaded)', mode: 'ai-derived-optional', note: 'Runs in a WebAssembly runtime self-hosted at /assets/ort/. No network request for inference.' },
    { id: 'user_inference', name: 'User-supplied inference endpoint', mode: 'ai-derived-optional', note: 'Disabled by default; separate consent; direct browser → endpoint; provider may log/store.' },
    { id: 'tcia', name: 'The Cancer Imaging Archive (TCIA)', mode: 'linkout', url: 'https://www.cancerimagingarchive.net/browse-collections/' },
    { id: 'nci_idc', name: 'NCI Imaging Data Commons', mode: 'linkout', url: 'https://portal.imaging.datacommons.cancer.gov/explore/' },
    { id: 'radlex', name: 'RadLex (RSNA)', mode: 'linkout', url: 'https://radlex.org/' },
    { id: 'radiologyinfo', name: 'RadiologyInfo.org (RSNA / ACR patient education)', mode: 'patient-education', url: 'https://www.radiologyinfo.org/en' },
    { id: 'europepmc', name: 'Europe PMC (imaging literature)', mode: 'live (non-PHI concept only)', url: 'https://europepmc.org' },
    { id: 'ctgov', name: 'ClinicalTrials.gov (imaging-related trials)', mode: 'live (non-PHI concept only)', url: 'https://clinicaltrials.gov' },
    { id: 'openfda-device', name: 'openFDA device records (imaging devices)', mode: 'live, user-triggered (may lag official FDA DB)', url: 'https://open.fda.gov/apis/device/' }
  ],
  lesionLabels: ['target lesion', 'non-target lesion', 'new lesion', 'residual disease', 'post-treatment change', 'biopsy site', 'radiation field', 'surgical bed', 'index lesion', 'lymph node', 'metastasis suspicion (user observation, not a diagnosis)', 'primary tumor', 'unknown'],
  tools: [['pan', 'Pan'], ['wl', 'Window / level'], ['length', 'Length'], ['bidir', 'Bidirectional'], ['rect', 'Rectangle ROI'], ['ellipse', 'Ellipse ROI'], ['angle', 'Angle'], ['polygon', 'Polygon / contour']],
  modalities: ['CT', 'MRI', 'PET', 'PET/CT', 'ultrasound', 'mammography', 'breast MRI', 'brain MRI', 'chest CT', 'radiography', 'SPECT'],
  topics: ['radiomics', 'image-guided biopsy', 'radiation planning', 'imaging response assessment', 'lung cancer screening CT', 'PSMA PET', 'linear accelerator', 'MRI coil', 'biopsy device', 'PET scanner']
};

/* ---------------- Safe rendering helpers (all strings escaped) ---------------- */
var RAWK = '__oiRaw';
function raw(s) { var o = {}; o[RAWK] = String(s == null ? '' : s); return o; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"'`=]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;' }[c]; }); }
function val(v) { if (v == null || v === false || v === true) return ''; if (Array.isArray(v)) return v.map(val).join(''); if (typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, RAWK)) return v[RAWK]; return esc(v); }
function H(strings) { var out = ''; for (var i = 0; i < strings.length; i++) { out += strings[i]; if (i + 1 < arguments.length) out += val(arguments[i + 1]); } return raw(out); }
function setHTML(el, c) { if (el) el.innerHTML = val(c); }
function arr(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }
function uniq(a) { var s = new Set(); return arr(a).filter(function (x) { var k = typeof x === 'string' ? x : JSON.stringify(x); if (x == null || x === '' || s.has(k)) return false; s.add(k); return true; }); }
function num(n, d) { var x = Number(n); if (!isFinite(x)) return '—'; return d != null ? x.toFixed(d) : x.toLocaleString('en-US'); }
function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function isoNow() { return new Date().toISOString(); }
function safeUrl(u, allowHttp) { try { var x = new URL(u, location.href); if (x.protocol === 'https:' || (allowHttp && x.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(x.hostname))) return x.href; } catch (e) { /* invalid */ } return ''; }
var ICONS = {
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>', shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>', scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><circle cx="12" cy="12" r="3.5"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>', book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  check: '<path d="M5 12l5 5 9-10"/>', play: '<path d="M7 4l13 8-13 8z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', back: '<path d="M15 6l-6 6 6 6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'
};
function icon(n, cls) { return raw('<svg class="oi-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[n] || ICONS.info) + '</svg>'); }
function badge(t, k) { return t ? H`<span class="oi-badge ${k ? 'oi-b-' + k : ''}">${t}</span>` : ''; }
function ext(url, label) { var u = safeUrl(url); return u ? H`<a href="${u}" target="_blank" rel="noopener noreferrer">${label}${icon('ext', 'oi-ext')}<span class="oi-sr"> (opens in a new tab)</span></a>` : H`<span>${label}</span>`; }
function extBtn(url, label) { var u = safeUrl(url); return u ? H`<a class="oi-btn oi-btn-sm" href="${u}" target="_blank" rel="noopener noreferrer">${icon('ext')}${label}<span class="oi-sr"> (opens in a new tab)</span></a>` : ''; }
function notice(kind, body) { return H`<div class="oi-notice oi-notice-${kind}">${icon(kind === 'bad' || kind === 'warn' ? 'alert' : kind === 'good' ? 'shield' : 'info')}<div>${body}</div></div>`; }
function csvCell(v) { var s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; }
function toCSV(rows, cols) { return [cols.map(function (c) { return csvCell(c[0]); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return csvCell(typeof c[1] === 'function' ? c[1](r) : r[c[1]]); }).join(','); })).join('\r\n'); }
var URLS = new Set();
function download(name, mime, data) {
  var blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  var url = URL.createObjectURL(blob); URLS.add(url);
  var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none'; ROOT.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); URLS.delete(url); a.remove(); }, 1500);
}
var $ = function (sel, el) { return (el || ROOT).querySelector(sel); };
function announce(msg, assertive) { var el = $(assertive ? '#oi-alert' : '#oi-live'); if (!el) return; el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 30); }
var toastT = null;
function toast(msg) { var t = $('.oi-toast'); if (t) t.remove(); t = document.createElement('div'); t.className = 'oi-toast'; t.setAttribute('role', 'status'); t.textContent = msg; ROOT.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 3600); }
// Input hygiene for context queries and labels (rejected input is never stored or logged).
function checkConcept(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80 || /[\r\n\t]/.test(s)) return null;
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t) || /\d{3}[\s.-]\d{3}[\s.-]\d{4}/.test(t) || /\b\d{1,2}[\/.-]\d{1,2}[\/.-](19|20)?\d{2}\b/.test(t) || /\b(19|20)\d{2}[\/.-]\d{1,2}[\/.-]\d{1,2}\b/.test(t) || /\b(mrn|dob|patient|accession|name|born)\b/i.test(t) || /\^/.test(t) || /\b\d{6,}\b/.test(t) || /\d+(\.\d+){5,}/.test(t)) return null;
  return t;
}
// Filenames are never displayed or exported. Files whose names look like they embed identifiers are rejected.
function suspiciousFilename(n) { n = String(n || ''); return /\^/.test(n) || /\b(19|20)\d{2}[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])\b/.test(n) && /[a-z]{3,}/i.test(n.replace(/\.(dcm|dicom|png|jpe?g|webp|bmp|tiff?)$/i, '')) || /\b(mrn|dob|patient|ssn|accession)\b/i.test(n) || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(n); }

/* ---------------- State (memory only) ---------------- */
function freshState() {
  return {
    panel: 'home',
    consent: { phi: false, nondiag: false, remote: false, at: null },
    studies: [],            // [{ id, label, series: [{ id, label, modality, images: [imageId] }] }]
    images: new Map(),      // id -> image record (pixels in memory)
    order: [],              // image ids in load order
    current: null,          // current image id
    frame: 0,
    showMeta: false,
    tool: 'pan',
    annotations: [],        // user annotations (incl. accepted AI suggestions)
    pending: null,          // annotation in progress
    selected: null,
    keyImages: [], seriesBookmarks: [], compare: [],
    notesEnabled: false, exportNotes: false,
    layers: { ai: true, ann: true, aiOpacity: 0.55, annOpacity: 1 },
    ai: { mode: 'none', reviewed: false, running: false, model: null, manifestError: null, modelBytes: null, session: null, results: [], threshold: 0.5, error: null, lastRun: null, remote: { url: '', token: '', model: '', enabled: false } },
    dicomweb: { qido: '', wado: '', token: '', stow: false, connected: false, studies: null, error: null, loading: false },
    ohif: { status: 'closed', mode: null, available: null, bridge: null, userUrl: '' },
    context: { q: '', loading: false, results: null, error: null },
    nextAnn: 1, errors: []
  };
}
var S = freshState();
