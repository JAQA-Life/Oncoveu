/*
  Oncotics Precision Oncology Workspace
  Built for oncotics.com.
  Oncotics™ is a trademark of Oncotics.
  Educational and research use only. Not medical, regulatory, or procurement advice.
  Powered by selected public APIs including CIViC, ClinicalTrials.gov,
  openFDA drug and device endpoints, Ensembl, MyGene.info, MyVariant.info,
  UniProt, Europe PMC, RxNorm, STRING, Reactome, AlphaFold/EBI,
  Open Targets, cBioPortal, GWAS Catalog, ChEMBL, PubChem, and EBI OLS
  where CORS-verified.
  openFDA device records may lag official FDA databases.
  © {current year} Oncotics™. All rights reserved.

  ----------------------------------------------------------------------
  ARCHITECTURE MAP (read this first)
  ----------------------------------------------------------------------
  - CONFIG / BRAND / LEGAL ......... settings, product names, legal text.
    LEGAL is the ONLY place the ™ mark lives. Use BRAND.* for normal UI.
  - SOURCES (source capability registry) and ENDPOINTS (URL builders).
    To add a source: add a SOURCES entry (defaultMode "linkout" until CORS
    has been verified from the real oncotics.com origin), then add URL
    builders in ENDPOINTS and a loader in Loaders.
    To promote a link-out source to live: verify CORS + terms, set
    defaultMode:"live", corsVerified:true, lastVerifiedNote, and add a loader.
  - Net ............................ request queue: per-source concurrency
    caps, min spacing, global cap, AbortController timeouts, in-session
    de-duplication, 429 back-off, cache:"no-store", credentials:"omit",
    referrerPolicy:"no-referrer". A CORS/network/5xx failure marks the
    source "unavailable" for this session only; modules then show the
    official link-out. Never proxied.
  - Slots .......................... every async load writes to a keyed slot
    ({status, data, error}). Renderers read slots. Promise.allSettled-style:
    one failed slot never blocks others; partial results are flagged.
  - Detect ......................... entity resolution (local patterns +
    static alias map) with High/Medium/Low confidence and user correction.
  - Plans .......................... initial query plan per entity type
    (4-6 Tier A requests). Deeper tabs load lazily on open.
  - Modules ........................ module registry (window.OncoticsWorkspace.modules).
  - Events ......................... tiny in-memory event bus for cross-module
    hand-off (window.OncoticsWorkspace.events). No URL parameters are written.
  PRIVACY ENFORCEMENT: no storage APIs are referenced anywhere in this file;
  state lives in the closure below and is dropped on refresh or Clear
  Session. Search terms are never logged, never written to the URL and
  never included in export filenames.
*/
(function () {
'use strict';

var ROOT = document.getElementById('oncotics-precision-workspace');
if (!ROOT || ROOT.__owInit) return;
ROOT.__owInit = true;

var YEAR = new Date().getFullYear();

/* ====================================================================
   CONFIG, BRAND, LEGAL
   ==================================================================== */
var CONFIG = {
  host: 'oncotics.com',
  canonical: 'https://oncotics.com/precision-oncology-workspace',
  privacyPolicyUrl: '',            // e.g. 'https://oncotics.com/privacy' once published
  maxInputLength: 160,
  globalConcurrency: 6,
  defaultTimeoutMs: 15000,
  exportNames: {
    results: 'Oncotics-Precision-Workspace-results',
    comparison: 'Oncotics-Precision-Workspace-comparison',
    board: 'Oncotics-Precision-Workspace-session-board',
    devices: 'Oncotics-Precision-Workspace-devices',
    session: 'Oncotics-Precision-Workspace-session-summary'
  },
  // Public pan-cancer cohort used for the live cBioPortal frequency view.
  cbio: { studyId: 'msk_impact_2017', mutationProfile: 'msk_impact_2017_mutations', sampleList: 'msk_impact_2017_sequenced',
          label: 'MSK-IMPACT Clinical Sequencing Cohort (MSK, Nat Med 2017)' },
  verifiedOn: '2026-09-28'
};

var BRAND = {
  name: 'Oncotics',
  product: 'Oncotics Precision Oncology Workspace',
  short: 'Oncotics Workspace',
  privacy: 'Oncotics Privacy',
  session: 'Oncotics Session',
  support: 'Oncotics Support',
  coverage: 'Oncotics Coverage'
};

// The ™ mark appears ONLY in the strings below (legal, copyright, privacy,
// disclaimer, ownership, export metadata). Do not use LEGAL.* in ordinary UI.
var LEGAL = {
  mark: 'Oncotics™',
  copyright: '© ' + YEAR + ' Oncotics™. All rights reserved.',
  trademark: 'Oncotics™ is a trademark of Oncotics.',
  purpose: 'This tool is provided for educational and research purposes only.',
  noMedical: 'Oncotics™ does not provide medical advice.',
  noRegulatory: 'Oncotics™ does not provide regulatory or procurement advice.',
  noMedRegProc: 'Oncotics™ does not provide medical, regulatory, or procurement advice.',
  notResponsible: 'Oncotics™ is not responsible for clinical decisions made using this interface.',
  independent: 'Oncotics™ is an independent interface and is not affiliated with or endorsed by these providers unless expressly stated.',
  exportDisclaimer: 'Educational and research use only. Not medical, regulatory, or procurement advice.',
  providers: [
    'ClinicalTrials.gov data is provided by the U.S. National Library of Medicine.',
    'openFDA drug data is provided by the U.S. Food and Drug Administration.',
    'openFDA medical device data is provided by the U.S. Food and Drug Administration and may lag official FDA databases.',
    'CIViC data is provided by the CIViC project.',
    'Ensembl data is provided by EMBL-EBI.',
    'UniProt data is provided by the UniProt consortium.',
    'Europe PMC data is provided by EMBL-EBI.',
    'MyGene.info and MyVariant.info data are provided by their respective public services.',
    'RxNorm data is provided by the National Library of Medicine.'
  ],
  longDisclaimer: [
    'This tool is provided for educational and research purposes only.',
    'Do not use for direct patient treatment decisions without qualified clinical review.',
    'Clinical trial information, FDA label data, FDA device data, genomic annotations, variant predictions, literature records, pathway data, interaction data, target validation signals, and cancer genomics data may change over time and may be incomplete.',
    'Computational predictions are not clinical diagnoses.',
    'Trial listings do not determine eligibility.',
    'Adverse event reports are voluntary and do not prove causality.',
    'Device clearance (510(k)/De Novo) is not approval (PMA/HDE/CDH). Verify regulatory status with FDA before any clinical or procurement decision.',
    'MAUDE adverse-event reports are voluntary and do not prove the device caused the event.',
    'Device recalls require immediate institutional action. Oncotics surfaces the record only and does not advise on clinical response, patient management, or device replacement.',
    'openFDA device data is derived from FDA databases and may lag the official record; for time-critical safety or regulatory decisions the official FDA database and your institution’s process are authoritative.',
    'Companion-diagnostic linkage is derived from label and device text and may be incomplete; the FDA companion-diagnostics list and the drug’s current label are authoritative.',
    'LDTs are regulated differently from FDA-cleared IVDs; Oncotics does not equate them.',
    'Target validation signals are research evidence, not treatment recommendations.',
    'FDA label and approval data may be versioned; verify with current official sources.',
    'Always verify with primary clinical sources, current guidelines, trial sponsors, regulators, and qualified clinicians.',
    'Oncotics™ does not provide medical, regulatory, or procurement advice.',
    'Oncotics™ is not responsible for clinical decisions made using this interface.',
    '© ' + YEAR + ' Oncotics™. All rights reserved.'
  ]
};

var SAFETY = {
  overview: 'Overview summarizes source-reported records. It does not provide clinical, regulatory, or procurement recommendations.',
  evidence: 'Clinical evidence is source-reported and may change. Verify with current guidelines and qualified clinicians.',
  trials: 'Oncotics helps locate trial information. It does not determine eligibility. Confirm trial suitability with the trial sponsor and treating clinician.',
  variants: 'Computational predictions are not clinical diagnoses.',
  drugAE: 'Adverse event reports are voluntary and do not prove that a drug caused the event.',
  label: 'Label information may be versioned. Always verify the current FDA label before clinical use.',
  dosage: 'Dosage text is shown as source-reported label content. Oncotics does not provide dosing recommendations.',
  labelShort: 'Label text is source-reported. Oncotics does not provide dosing recommendations.',
  approvals: 'Approval history is provided by openFDA / Drugs@FDA data and may not include every regulatory action. Verify with official FDA sources.',
  drugEnf: 'Enforcement and recall data may be limited to publicly reported records. Verify with FDA sources.',
  rxnorm: 'RxNorm is terminology data. It does not establish approval, efficacy, safety, or clinical appropriateness.',
  devices: 'Device clearance is not approval. Verify regulatory status with FDA.',
  devOverview: 'Summarizes source-reported FDA device records that may lag official databases. Not medical or regulatory advice.',
  devAuth: 'Authorization records from openFDA may lag the official FDA 510(k)/PMA databases. Verify status with FDA.',
  devClass: 'Classification/UDI are source-reported; verify with FDA / GUDID.',
  maude: 'MAUDE reports are voluntary and do not prove the device caused the event. openFDA device-event data may be less complete than the official MAUDE query tool.',
  recalls: 'Recall/enforcement data may lag the official FDA recall database. For active recalls follow your institution’s process and FDA guidance.',
  cdx: 'Companion-diagnostic linkage here is derived from label and device text and may be incomplete. The FDA companion-diagnostics list and the drug’s current label are authoritative.',
  target: 'Target validation signals are research evidence, not treatment recommendations.',
  gwas: 'GWAS associations are population-level statistical signals, not individual clinical predictions.',
  literature: 'Literature records are provided for research context and do not replace systematic review or clinical guideline appraisal.',
  coverage: 'Link-out sources are opened directly by your browser. Oncotics does not fetch or store these searches.',
  lag: 'Device records may lag the official FDA database. Open the official FDA record for current status.',
  ldt: 'Laboratory developed tests (LDTs) are regulated differently from FDA-cleared or FDA-approved IVDs. Oncotics does not label an LDT as FDA-cleared.',
  phi: 'Do not enter patient-identifying information. This tool is not for protected health information.',
  board: 'The session board is temporary and is not stored by Oncotics. Do not add patient identifiers or protected health information.'
};

/* ====================================================================
   ICONS (inline SVG only)
   ==================================================================== */
var ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  command: '<path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  pin: '<path d="M12 17v4M8 3h8l-1 6 3 3H6l3-3-1-6z"/>',
  compare: '<path d="M8 3v18M16 3v18M3 8h5M16 16h5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M8 7h8M8 17h8"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/>',
  device: '<rect x="4" y="3" width="16" height="12" rx="2"/><path d="M8 21h8M12 15v6M8 9h2l1-2 2 4 1-2h2"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13"/>',
  graph: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11l9.4-5M7.3 13l9.4 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  evidence: '<path d="M9 3h6l1 3h3v15H5V6h3z"/><path d="M9 13l2 2 4-4"/>',
  trial: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7 15h10"/>',
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  query: '<path d="M4 6h16M4 12h10M4 18h6"/><circle cx="17" cy="16" r="3"/><path d="M19.5 18.5L21 20"/>',
  console: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  flow: '<rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="9" width="6" height="6" rx="1"/><path d="M8 12h8M13 9l3 3-3 3"/>'
};
function icon(name, cls) {
  var p = ICON_PATHS[name] || ICON_PATHS.info;
  return raw('<svg class="ow-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>');
}

/* ====================================================================
   SAFE RENDERING HELPERS
   All API strings pass through esc() via the H`` tagged template.
   Only values wrapped in raw() (produced by our own templates) bypass it.
   ==================================================================== */
var RAW = '__owRaw';
function raw(s) { var o = {}; o[RAW] = String(s == null ? '' : s); return o; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"'`=]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;' }[c];
  });
}
function val(v) {
  if (v == null || v === false || v === true) return '';
  if (Array.isArray(v)) { var s = ''; for (var i = 0; i < v.length; i++) s += val(v[i]); return s; }
  if (typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, RAW)) return v[RAW];
  return esc(v);
}
function H(strings) {
  var out = '';
  for (var i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i + 1 < arguments.length) out += val(arguments[i + 1]);
  }
  return raw(out);
}
function setHTML(el, content) { if (el) el.innerHTML = val(content); }
function safeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  try {
    var url = new URL(u, 'https://' + CONFIG.host);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch (e) { return ''; }
}
function ext(url, label, opts) {
  opts = opts || {};
  var u = safeUrl(url);
  if (!u) return H`<span>${label}</span>`;
  return H`<a href="${u}" target="_blank" rel="noopener noreferrer" class="${opts.cls || ''}">${label}${opts.noIcon ? '' : icon('ext', 'ow-ext')}<span class="ow-sr"> (opens in a new tab)</span></a>`;
}
function extBtn(url, label, opts) {
  opts = opts || {};
  var u = safeUrl(url);
  if (!u) return '';
  return H`<a href="${u}" target="_blank" rel="noopener noreferrer" class="ow-btn ow-btn-sm ${opts.primary ? 'ow-btn-primary' : ''}">${icon('ext')}${label}<span class="ow-sr"> (opens in a new tab)</span></a>`;
}
function badge(text, kind, title) {
  if (text == null || text === '') return '';
  return H`<span class="ow-badge ${kind ? 'ow-b-' + kind : ''}" ${title ? raw('title="' + esc(title) + '"') : ''}>${text}</span>`;
}
function nr() { return H`<span class="ow-subtle">Not reported by source</span>`; }
function orNR(v) { return (v == null || v === '' || (Array.isArray(v) && !v.length)) ? nr() : v; }

/* ====================================================================
   GENERIC UTILITIES
   ==================================================================== */
function arr(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }
function first(x) { return Array.isArray(x) ? x[0] : x; }
function uniq(a) { var s = new Set(), o = []; arr(a).forEach(function (x) { var k = typeof x === 'string' ? x : JSON.stringify(x); if (x != null && x !== '' && !s.has(k)) { s.add(k); o.push(x); } }); return o; }
function get(o, path) { var p = path.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
function num(n) { var x = Number(n); return isFinite(x) ? x.toLocaleString('en-US') : '—'; }
function pct(a, b) { return b ? (100 * a / b).toFixed(a / b < 0.01 ? 2 : 1) + '%' : '—'; }
function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }
function titleCase(s) { return String(s || '').toLowerCase().replace(/(^|[\s_-])([a-z])/g, function (m, a, b) { return (a === '_' ? ' ' : a) + b.toUpperCase(); }); }
function humanEnum(s) { return titleCase(String(s || '').replace(/_/g, ' ')); }
function fdaDate(s) { s = String(s || ''); return /^\d{8}$/.test(s) ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : s; }
function timeStr(t) { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } }
function isoNow() { return new Date().toISOString(); }
function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
function countBy(items, fn) { var m = new Map(); arr(items).forEach(function (x) { arr(fn(x)).forEach(function (k) { if (k == null || k === '') k = 'Not reported'; m.set(k, (m.get(k) || 0) + 1); }); }); return Array.from(m.entries()).sort(function (a, b) { return b[1] - a[1]; }); }
function csvCell(v) {
  var s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;            // formula-injection guard
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(rows, cols) {
  var head = cols.map(function (c) { return csvCell(c.label); }).join(',');
  var body = rows.map(function (r) { return cols.map(function (c) { return csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key]); }).join(','); });
  return [head].concat(body).join('\r\n');
}
function download(name, mime, text) {
  var blob = new Blob([text], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  ROOT.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise(function (res, rej) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    ROOT.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? res() : rej(new Error('copy')); } catch (e) { rej(e); }
    ta.remove();
  });
}
function uid(p) { uid.n = (uid.n || 0) + 1; return (p || 'k') + uid.n; }

/* ====================================================================
   EVENT BUS (in-memory only)
   ==================================================================== */
var Events = (function () {
  var map = new Map();
  return {
    on: function (name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); return function () { map.get(name).delete(fn); }; },
    emit: function (name, payload) { (map.get(name) || []).forEach(function (fn) { try { fn(payload); } catch (e) { /* never break the bus */ } }); },
    clear: function () { map.clear(); }
  };
})();
