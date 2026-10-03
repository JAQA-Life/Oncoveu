
/* ====================================================================
   SEARCH PIPELINE: sanitize -> detect -> context -> plan -> lazy modules
   ==================================================================== */
var CTX_KEYS = ['gene', 'change', 'variantText', 'fusion', 'partner', 'alias', 'rsid', 'hgvs', 'hgvsKind', 'transcript', 'genomic', 'drug', 'brand', 'disease', 'abbr', 'nct', 'registry', 'regId', 'pmid', 'doi', 'deviceId', 'deviceText', 'geneHint', 'drugHint', 'ldt', 'uniprot', 'ensembl', 'rxcui', 'concept', 'biomarker', 'needGene', 'vaccine', 'fertility', 'imaging'];
function buildCtx(e) {
  var c = { type: e.type, label: e.label, raw: e.raw };
  CTX_KEYS.forEach(function (k) { if (e[k] != null) c[k] = e[k]; });
  if (c.type === 'gene') c.trialTerm = c.gene;
  if (c.type === 'variant') { c.variantName = c.change ? c.gene + ' ' + c.change.label : (c.fusion ? (c.partner ? c.partner + '::' + c.gene : c.gene) : c.gene + (c.variantText ? ' ' + c.variantText : '')); c.trialTerm = c.change ? c.gene + ' ' + c.change.label : (c.fusion && c.partner ? c.partner + '-' + c.gene : c.label); }
  if (c.type === 'rsid') c.trialTerm = c.rsid;
  if (c.type === 'device') c.deviceTerm = c.deviceId ? c.deviceId.value : c.deviceText;
  if (c.type === 'concept') c.trialTerm = c.concept;
  if (c.type === 'regid') c.trialTerm = c.regId;
  if (c.type === 'disease') c.trialTerm = c.disease;
  if (c.type === 'vaccine') c.trialTerm = (c.vaccine.synonyms && c.vaccine.synonyms[0]) || c.vaccine.name;
  if (c.type === 'fertility') c.trialTerm = c.fertility.concept;
  if (c.type === 'imaging') c.trialTerm = c.imaging.concept;
  return c;
}
function forceEntity(rawText, type) {
  var d = detect(rawText);
  var ex = arr(d.candidates).find(function (x) { return x.type === type; });
  if (ex) { ex = Object.assign({}, ex); ex.candidates = d.candidates; ex.raw = d.raw; ex.confidence = 'User-selected'; ex.reason = (ex.reason ? ex.reason + ' · ' : '') + 'type chosen by you'; return ex; }
  var t = d.raw, e = { type: type, label: t, confidence: 'User-selected', reason: 'Type chosen by you', candidates: d.candidates, raw: t };
  if (type === 'gene') { var g = normGene(t) || { symbol: t.toUpperCase() }; e.gene = g.symbol; e.label = g.symbol; }
  else if (type === 'variant') { var parts = t.split(/\s+/); e.gene = (normGene(parts[0]) || { symbol: parts[0].toUpperCase() }).symbol; e.change = parseProteinChange(parts.slice(1).join('')); e.variantText = e.change ? null : parts.slice(1).join(' '); e.label = e.gene + ' ' + (e.change ? e.change.label : (e.variantText || '')); }
  else if (type === 'drug') { var low = t.toLowerCase(); if (DRUG_BRANDS[low]) { e.brand = t; e.drug = DRUG_BRANDS[low]; } else e.drug = low; e.label = e.drug; }
  else if (type === 'disease') e.disease = t;
  else if (type === 'device') e.deviceText = t;
  else if (type === 'concept') e.concept = t;
  else if (type === 'pmid') { if (!/^\d{1,9}$/.test(t)) return null; e.pmid = t; e.label = 'PMID ' + t; }
  else if (type === 'vaccine') { var vx = findIn(VACCINE_DICT, t) || { name: t, kind: 'general', synonyms: [t] }; e.vaccine = { name: vx.name === 'Vaccine (general concept)' ? t : vx.name, kind: vx.kind, antigen: vx.antigen || null, antigenGene: vx.antigenGene || null, products: vx.products || [], cancers: vx.cancers || [], synonyms: vx.synonyms || [t], investigational: !!vx.investigational, raw: t }; e.label = e.vaccine.name; }
  else if (type === 'fertility') { var fx = findIn(FERT_DICT, t); e.fertility = { concept: fx ? fx.concept : t, sub: fx ? fx.sub : 'fertility', raw: t }; e.label = e.fertility.concept; }
  else if (type === 'imaging') { var ix = findIn(IMAGING_DICT, t); e.imaging = { concept: ix ? ix.concept : t, workbench: !!(ix && ix.workbench), raw: t }; e.label = e.imaging.concept; }
  else return null;
  return e;
}
function startGeneration() {
  if (State.searchCtrl) { try { State.searchCtrl.abort(); } catch (e) { /* ignore */ } }
  State.searchCtrl = new AbortController();
  State.gen++;
  State.slots = new Map(); State.failed.clear(); State.records = new Map(); State.conflicts = [];
  // New search: reset filters and pagination (so no hidden filter silently carries over);
  // keep only view mode, page size and sort order.
  ['evidence', 'trials', 'literature', 'drug', 'biology', 'devices', '_more', '_open', 'coverage', 'vaccines', 'fert'].forEach(function (k) {
    var prev = State.ui[k] || {}, f = prev.filters || {};
    State.ui[k] = {};
    if (prev.view) State.ui[k].view = prev.view;
    if (k === 'trials' && (f.sort || f.pageSize)) State.ui[k].filters = { status: [], sort: f.sort, pageSize: f.pageSize };
    if (k === 'literature' && (f.sort || f.pageSize)) State.ui[k].filters = { sort: f.sort, pageSize: f.pageSize };
    if (k === 'evidence' && (f.sortCol || f.pageSize)) State.ui[k].filters = { st: 'ACCEPTED', sortCol: f.sortCol, sortDir: f.sortDir, pageSize: f.pageSize };
  });
  Layers.drawer = null;
  GlobeState.filter = null; GlobeState.popup = null; Globe.sig = ''; MMState.sel = null; MMState.expanded = new Set(); MMState.limit = 18;
  clearDrafts();
}
function setAlleleChoices(c, changes) {
  // One rsID can map to several alternate alleles (e.g. V600A/E/G/K). Never pick one silently.
  var list = uniq(changes.map(function (x) { return x.label; }));
  if (list.length === 1) { c.change = changes[0]; c.variantName = c.gene + ' ' + c.change.label; c.derivedVariant = true; return true; }
  if (list.length > 1) { c.alleleChoices = list.map(function (l) { return c.gene + ' ' + l; }); }
  return false;
}
function enrichFromVariant(d, gen) {
  if (gen !== State.gen || !d || !d.items || !d.items[0]) return;
  var c = State.ctx, v = d.items[0].data;
  if (v.gene && !c.gene) c.gene = v.gene;
  if (v.rsid && !c.rsid) c.rsid = v.rsid;
  if (c.gene && !c.change) {
    var ch = d.items.map(function (r) { var x = r.data; return x.gene === c.gene && x.aaRef && x.aaPos && x.aaAlt && /^[A-Z*]$/.test(x.aaAlt) ? { ref: x.aaRef, pos: x.aaPos, alt: x.aaAlt, label: x.aaRef + x.aaPos + x.aaAlt, three: (AA1[x.aaRef] || x.aaRef) + x.aaPos + (AA1[x.aaAlt] || x.aaAlt) } : null; }).filter(Boolean);
    setAlleleChoices(c, ch);
  }
  if (c.change && slot('civic:evidence').status === 'idle') { loadEvidence(); load('civic:assertions', 'civic', function (s) { return Loaders.civicAssertions(s, civicScope(c)); }); }
  if (c.variantName && slot('trials:list').status === 'idle') { c.trialTerm = c.variantName; loadTrials(); }
  scheduleRender();
}
function enrichFromVep(d, gen) {
  if (gen !== State.gen || !d || !d.consequences) return;
  var c = State.ctx;
  var tcs = d.consequences.filter(function (x) { return x.canonical && x.aa && x.proteinStart && x.gene; });
  if (!tcs.length) tcs = d.consequences.filter(function (x) { return x.aa && x.proteinStart && x.gene; });
  if (tcs.length) {
    c.gene = c.gene || tcs[0].gene;
    var ch = tcs.filter(function (t) { return t.gene === c.gene; }).map(function (t) { var aa = String(t.aa).split('/'); return aa.length === 2 && aa[0].length === 1 && aa[1].length === 1 ? { ref: aa[0], pos: t.proteinStart, alt: aa[1], label: aa[0] + t.proteinStart + aa[1], three: (AA1[aa[0]] || aa[0]) + t.proteinStart + (AA1[aa[1]] || aa[1]) } : null; }).filter(Boolean);
    if (!c.change) setAlleleChoices(c, ch);
  }
  var rs = arr(d.colocated).find(function (x) { return /^rs\d+$/.test(x); });
  if (rs && !c.rsid) { c.rsid = rs; if (slot('var:myvariant').status === 'idle') load('var:myvariant', 'myvariant', function (s) { return Loaders.myvariant(s, { rsid: rs }); }); }
  if (c.change && slot('civic:evidence').status === 'idle') { loadEvidence(); load('civic:assertions', 'civic', function (s) { return Loaders.civicAssertions(s, civicScope(c)); }); }
  if (c.variantName && slot('trials:list').status === 'idle') { c.trialTerm = c.variantName; loadTrials(); }
  scheduleRender();
}
function executePlan(c) {
  var gen = State.gen;
  var civicAssert = function () { if (civicScope(c)) load('civic:assertions', 'civic', function (s) { return Loaders.civicAssertions(s, civicScope(c)); }); };
  switch (c.type) {
    case 'gene':
      load('gene:mygene', 'mygene', function (s) { return Loaders.mygene(s, c.gene); });
      loadEvidence(); civicAssert(); loadTrials(); loadLit(); break;
    case 'variant':
      if (c.change) load('var:myvariant', 'myvariant', function (s) { return Loaders.myvariant(s, c); });
      loadEvidence(); civicAssert(); loadTrials(); loadLit(); break;
    case 'rsid':
      load('var:myvariant', 'myvariant', async function (s) { var d = await Loaders.myvariant(s, c); setTimeout(function () { enrichFromVariant(d, gen); }, 0); return d; });
      loadLit(); break;
    case 'hgvs':
      if (c.genomic) load('var:myvariant', 'myvariant', async function (s) { var d = await Loaders.myvariant(s, c); setTimeout(function () { enrichFromVariant(d, gen); }, 0); return d; });
      else if (c.transcript) load('var:vep', 'ensembl', async function (s) { var d = await Loaders.vep(s, c); setTimeout(function () { enrichFromVep(d, gen); }, 0); return d; });
      loadLit(); break;
    case 'drug':
      load('drug:labels', 'openfda-drug', function (s) { return Loaders.drugLabels(s, c); });
      load('drug:approvals', 'openfda-drug', function (s) { return Loaders.drugsFda(s, c); });
      load('drug:rxnorm', 'rxnorm', function (s) { return Loaders.rxnorm(s, c); });
      loadTrials(); loadLit(); loadEvidence(); break;
    case 'disease':
      loadTrials(); loadEvidence(); loadLit(); load('ont:ols', 'ols', function (s) { return Loaders.ols(s, c.disease); }); break;
    case 'nct':
      load('trial:detail:' + c.nct, 'ctgov', function (s) { return Loaders.trial(s, c.nct); }); loadLit(); break;
    case 'regid': loadTrials(); loadLit(); break;
    case 'pmid': case 'doi': loadLit(); break;
    case 'device':
      if (c.ldt && (!c.deviceText || LDT_RE.test(c.deviceText))) { loadLit(); break; }  // LDTs are not FDA device records; link-outs + literature only
      var k = c.deviceId ? c.deviceId.kind : 'text';
      if (k !== 'regulation' && k !== 'udi') load('dev:auth', 'openfda-device', function (s) { return Loaders.devAuth(s, c); });
      if (k === 'productcode' || k === 'regulation' || k === 'text') load('dev:class', 'openfda-device', function (s) { return Loaders.devClass(s, c); });
      if (k === 'udi') load('dev:udi', 'openfda-device', function (s) { return Loaders.devUDI(s, c); });
      if (k === 'text' || k === '510k' || k === 'pma' || k === 'denovo') loadTrials();
      loadLit(); break;
    case 'uniprot':
      load('bio:uniprot', 'uniprot', async function (s) { var d = await Loaders.uniprot(s, null, c.uniprot); setTimeout(function () { if (gen === State.gen && d && d.protein && d.protein.data.gene) { c.gene = d.protein.data.gene; c.trialTerm = c.gene; loadEvidence(); civicAssert(); loadTrials(); } }, 0); return d; });
      loadLit(); break;
    case 'ensembl':
      load('gene:ensembl', 'ensembl', async function (s) { var d = await Loaders.ensemblGene(s, c.ensembl); setTimeout(function () { if (gen === State.gen && d && d.gene && d.gene.symbol && /^ENSG/.test(d.gene.id)) { c.gene = d.gene.symbol; c.trialTerm = c.gene; load('gene:mygene', 'mygene', function (s2) { return Loaders.mygene(s2, c.gene); }); loadEvidence(); civicAssert(); loadTrials(); } }, 0); return d; });
      loadLit(); break;
    case 'rxcui':
      load('drug:rxcui', 'rxnorm', async function (s) {
        var d = await Net.request('rxnorm', SRC.rxnorm.apiBase + '/rxcui/' + encodeURIComponent(c.rxcui) + '/properties.json', { signal: s, label: 'properties' });
        var p = get(d, 'properties'); if (!p || !p.name) return { empty: true };
        return { name: p.name, tty: p.tty };
      }); break;
    case 'vaccine':
      loadTrials(); loadLit();
      if (c.vaccine.products.length && c.vaccine.kind !== 'general') load('vax:labels', 'openfda-drug', function (s) { return Loaders.vaccineLabels(s, c); });
      break;
    case 'fertility': loadTrials(); loadLit(); break;
    case 'imaging': if (!c.imaging.workbench) { loadTrials(); loadLit(); } break;
    case 'concept':
      loadTrials(); loadLit();
      load('civic:search', 'civic', function (s) { return Loaders.civicSearch(s, c.concept); });
      if (!c.biomarker) load('ont:ols', 'ols', function (s) { return Loaders.ols(s, c.concept); });
      if (c.geneHint) loadEvidence();
      break;
    default: break;
  }
}
function runSearch(term, opts) {
  opts = opts || {};
  var chk = checkInput(String(term == null ? '' : term));
  var errEl = $('#ow-input-error');
  if (!chk.ok) {
    if (chk.reason === 'empty') { $('#ow-q').focus(); return false; }
    errEl.hidden = false; setHTML(errEl, H`<div class="ow-input-error">${PHI_MESSAGE}</div>`); announce(PHI_MESSAGE, true);
    if (opts.fromInput) $('#ow-q').value = '';                   // rejected input is not kept
    return false;
  }
  errEl.hidden = true; errEl.innerHTML = '';
  var d0 = detect(chk.value), I = interpret(chk.value, d0), e = null;
  if (opts.pick) {
    var pc = I.candidates.find(function (x) { return x.key === opts.pick; });
    if (!pc) { toast('That interpretation is no longer available.'); return false; }
    e = Object.assign({}, pc.entity, { confidence: 'User-selected', reason: (pc.entity.reason || '') + ' · interpretation chosen by you' });
    I.selectedKey = pc.key; I.userSelected = true; I.needsConfirm = false;
  } else if (opts.type) {
    e = forceEntity(chk.value, opts.type);
    if (!e) { toast('That query cannot be treated as ' + opts.type + '.'); return false; }
    var fk = I.candidates.find(function (x) { return x.entity && x.entity.type === opts.type; });
    if (!fk) { fk = mkCand(opts.type, 'manual', e.label, 95, 'Entity type set manually by you.', [sig('Manual entity type', 'pattern', 0, 'You')], e); fk.score = 95; fk.scoreLabel = scoreLabel(95); I.candidates.unshift(fk); }
    I.selectedKey = fk.key; I.userSelected = true; I.needsConfirm = false;
  } else if (I.needsConfirm) {
    // Ambiguous or low confidence: show candidates, query nothing until the user chooses.
    startGeneration();
    State.entity = null; State.ctx = null; State.interp = I;
    $('#ow-q').value = chk.value;
    setModule('overview', { quiet: true });
    announce((I.ambiguous ? 'Ambiguous query. ' : 'Low-confidence interpretation. ') + 'Choose how to treat it in the Search Interpretation panel. No source has been queried.', true);
    return true;
  } else { e = I.top.entity; I.selectedKey = I.top.key; }
  e = Object.assign({}, e); e.candidates = d0.candidates; e.raw = d0.raw || chk.value;
  var selC = I.candidates.find(function (x) { return x.key === I.selectedKey; });
  if (selC && e.confidence !== 'User-selected') e.confidence = selC.scoreLabel + ' (' + selC.score + ')';
  startGeneration();
  State.interp = I;
  State.entity = e; State.ctx = buildCtx(e);
  if (!opts.fromNav) {
    State.nav = State.nav.slice(0, State.navIndex + 1);
    State.nav.push({ term: chk.value, forced: opts.type || null, type: e.type, label: e.label });
    if (State.nav.length > 30) State.nav.shift();
    State.navIndex = State.nav.length - 1;
  }
  $('#ow-q').value = chk.value;
  executePlan(State.ctx);
  Events.emit('search', { type: e.type });
  if (selC && selC.bioTab) ui('biology').tab = selC.bioTab;
  if (selC && selC.lens) { if (selC.module === 'onco-fertility') ui('fert').tab = selC.lens; if (selC.module === 'vaccines-cancer-immunization') ui('vaccines').tab = selC.lens; }
  setModule(opts.module || 'overview', { quiet: true });
  announce('Exploring ' + e.label + ' as ' + e.type + '. Results load progressively.');
  return true;
}
function setModule(id, opts) {
  opts = opts || {};
  if (!MOD[id]) return;
  if (State.prefs.hiddenModules.has(id)) State.prefs.hiddenModules.delete(id);
  State.module = id;
  if (MOD[id].onOpen) { try { MOD[id].onOpen(); } catch (e) { /* isolated */ } }
  Events.emit('module', { id: id });
  scheduleRender();
  if (!opts.quiet) announce(MOD[id].label + ' opened.');
  if (opts.focus) setTimeout(function () { MAIN.focus({ preventScroll: false }); }, 30);
}
function clearSession(silent) {
  if (State.searchCtrl) { try { State.searchCtrl.abort(); } catch (e) { /* ignore */ } }
  Net.cancelAll(); Net.clearMemo();
  State.gen++; State.searchCtrl = null; State.entity = null; State.ctx = null;
  State.slots = new Map(); State.records = new Map(); State.failed.clear(); State.board = []; State.compare = {}; State.ui = {};
  State.prefs = { theme: 'system', density: 'comfortable', hiddenModules: new Set(), disabledSources: new Set() }; State.keys = { openfda: '', s2: '', oncokb: '' }; State.interp = null;
  resetGlobeState(); resetMMState();
  State.nav = []; State.navIndex = -1; State.lastFetch = null; State.conflicts = [];
  Layers.drawer = null; Layers.modal = null; Narr = null; clearDrafts();
  resetRuntime();
  var q = $('#ow-q'); if (q) q.value = '';
  var errEl = $('#ow-input-error'); if (errEl) { errEl.hidden = true; errEl.innerHTML = ''; }
  applyTheme(); renderHeader();
  State.module = 'overview';
  renderAll();
  Events.emit('session-cleared', {});
  if (!silent) { toast('Session cleared. Nothing was stored.'); announce('Session cleared. All in-memory data was removed.'); }
}

/* ====================================================================
   EXPORTS (generated locally; filenames never contain search terms)
   ==================================================================== */
function exportMeta(sources) {
  return { generatedBy: BRAND.product, host: CONFIG.host, generatedAt: isoNow(), dataSources: sources || uniq(Array.from(State.slots.values()).map(function (s) { return s.src && SRC[s.src] ? SRC[s.src].displayName : null; }).filter(Boolean)),
    notes: ['Generated locally in your browser; not uploaded or stored by Oncotics.', 'openFDA device records may lag official FDA databases.', 'Device MAUDE narrative text is excluded.'],
    flags: { mayLagOfficialDb: 'openFDA device records may lag official FDA databases.', passiveSurveillance: 'Adverse event and VAERS-type reports are voluntary and do not prove causality.', aiDerived: 'AI-derived outputs, if any, are labeled AI-derived and are not source-reported evidence.', licensed: 'License-restricted content (OncoKB) is excluded.' },
    legal: { trademark: LEGAL.mark, copyright: LEGAL.copyright, disclaimer: LEGAL.exportDisclaimerFull, notice: LEGAL.trademark } };
}
function interpExport() {
  var I = State.interp; if (!I) return null;
  return { note: SAFETY.interpretation, scale: 'Heuristic 0-100 query-routing score; Very High 90-100, High 75-89, Medium 50-74, Low 25-49, Very Low 0-24.', selected: I.selectedKey || null, ambiguous: I.ambiguous, needsConfirm: I.needsConfirm,
    candidates: I.candidates.map(function (c) { return { type: typeName(c), normalized: c.normalized, score: c.score, label: c.scoreLabel, why: c.why, signals: c.signals.concat(c.liveSignals || []).map(function (x) { return x.kind + ': ' + x.text + (x.delta ? ' (' + (x.delta > 0 ? '+' : '') + x.delta + ')' : ''); }), supporting: c.supporting, conflicting: c.conflicting, flags: c.flags, category: 'heuristic-interpretation' }; }) };
}
function plainRecord(r) { var d = Object.assign({}, r.data); delete d.full; if (r.prov && r.prov.category === 'expert-curated-license-restricted') d = { excluded: 'License-restricted content is not exported.' }; return { type: r.type, title: r.title, source: r.prov ? r.prov.sourceName : r.source, data: d, provenance: r.prov }; }
function exportWarn(what, extra) {
  return confirmDialog('Export ' + what, function () { return H`<p>The file is generated locally in your browser and downloaded directly. Oncotics does not upload or keep it.</p><div class="ow-notice ow-notice-warn" style="margin-top:10px">${icon('alert')}<div>Exported content relates to your search and may reveal what you searched. Do not add patient information to exported files.</div></div>${typeof extra === 'function' ? extra() : (extra || '')}`; }, 'Download');
}
function exportJSON() {
  var m = MOD[State.module];
  var payload;
  if (m && m.exportData) payload = m.exportData();
  else if (m && m.exportRows) { var r = m.exportRows(); payload = r ? { view: m.label, records: r.rows.map(function (x) { return x.key ? plainRecord(x) : x; }) } : null; }
  if (!payload) { toast('Nothing to export in this view yet.'); return; }
  exportWarn('current view (JSON)').then(function (ok) { if (!ok) return; download(CONFIG.exportNames.results + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(), view: m.label, interpretation: interpExport(), results: payload }, null, 2)); toast('Export ready.'); });
}
function exportCSV() {
  var m = MOD[State.module], r = m && m.exportRows ? m.exportRows() : null;
  if (!r || !r.rows.length) { toast('No table to export in this view.'); return; }
  exportWarn('visible table (CSV)').then(function (ok) { if (!ok) return; download((State.module === 'device-intelligence' ? CONFIG.exportNames.devices : CONFIG.exportNames.results) + '.csv', 'text/csv;charset=utf-8', '﻿' + toCSV(r.rows, r.cols)); toast('CSV ready.'); });
}
function sessionSummary(includeQuery) {
  var rt = {}; SOURCES.forEach(function (s) { var x = Runtime[s.id]; if (x.ok || x.fail || x.mode !== s.defaultMode) rt[s.id] = { mode: x.mode, ok: x.ok, failed: x.fail, rateLimited: x.rate }; });
  var o = { metadata: exportMeta(), interpretation: interpExport(), counts: overviewCounts(), globe: { publicLocationRecords: globeLocations().length }, molecularContext: State.ctx ? { nodes: buildMolMap().nodes.length, edges: buildMolMap().edges.length } : null, conflicts: State.conflicts, sourceStatus: rt, board: State.board, comparison: State.compare };
  if (includeQuery && State.entity) o.query = State.entity.raw;
  return o;
}
function exportSession() {
  ExpState.includeQuery = false;
  exportWarn('session summary (JSON)', function () { return H`<label class="ow-check" style="margin-top:10px"><input type="checkbox" id="ow-exp-q" ${ExpState.includeQuery ? raw('checked') : ''}>Include the search text in the file</label>`; }).then(function (ok) {
    if (!ok) { ExpState.includeQuery = false; return; }
    download(CONFIG.exportNames.session + '.json', 'application/json', JSON.stringify(sessionSummary(ExpState.includeQuery), null, 2)); ExpState.includeQuery = false; toast('Session JSON ready.');
  });
}
var ExpState = { includeQuery: false };
function idList(kind) {
  var out = [];
  State.records.forEach(function (r) {
    var d = r.data || {};
    if (kind === 'nct' && d.nct) out.push(d.nct);
    if (kind === 'pmid' && d.pmid) out.push(d.pmid);
    if (kind === 'appl') arr(d.appl).forEach(function (a) { if (a) out.push(a); });
    if (kind === 'device') { if (d.number && /^(K|P|H|DEN)/.test(d.number)) out.push(d.number); if (d.productCode) out.push(d.productCode); if (d.di) out.push(d.di); }
    if (kind === 'vaccine' && r.type === 'vaccine-label') { if (d.setId) out.push('SPL set ID ' + d.setId); arr(d.appl).forEach(function (a) { if (a) out.push(a); }); }
  });
  return uniq(out);
}

/* ====================================================================
   COMMAND PALETTE (in memory; no history)
   ==================================================================== */
function paletteItems() {
  var q = (ui('cmd').q || '').trim(), low = q.toLowerCase();
  var items = [];
  if (q && checkInput(q).ok) items.push({ label: 'Search “' + trunc(q, 60) + '”', run: function () { closeLayer('modal'); runSearch(q); } });
  MODULES.forEach(function (m) { items.push({ label: 'Go to ' + m.label, run: function () { closeLayer('modal'); setModule(m.id, { focus: true }); } }); });
  [['Clear session', function () { closeLayer('modal'); clearSession(); }], ['Export current view (JSON)', function () { closeLayer('modal'); exportJSON(); }], ['Export visible table (CSV)', function () { closeLayer('modal'); exportCSV(); }],
    ['Open privacy information', function () { Layers.modal = null; ACTIONS.privacy(); }], ['Open Coverage Console', function () { closeLayer('modal'); setModule('coverage-console'); }],
    ['Compare selected items', function () { closeLayer('modal'); setModule('comparison'); }], ['Add current primary record to Session Board', function () { closeLayer('modal'); var r = primaryRecord(); if (r) pinRecord(r); else toast('No primary record yet.'); }],
    ['Toggle theme', function () { closeLayer('modal'); ACTIONS.theme(); }], ['Run advanced query', function () { closeLayer('modal'); setModule('advanced-query'); }],
    ['Open official FDA device databases', function () { closeLayer('modal'); window.open(linkout('fda-510k', ''), '_blank', 'noopener,noreferrer'); }],
    ['Open FDA companion-diagnostics list', function () { closeLayer('modal'); window.open(linkout('fda-cdx', ''), '_blank', 'noopener,noreferrer'); }],
    ['Help', function () { Layers.modal = null; ACTIONS.help(); }],
    ['Open Imaging Workbench (separate page)', function () { closeLayer('modal'); window.open(CONFIG.imagingUrl, '_blank', 'noopener,noreferrer'); }],
    ['Toggle globe list / globe view', function () { closeLayer('modal'); GlobeState.view = GlobeState.view === 'list' ? 'globe' : 'list'; setModule('overview'); }],
    ['Open Molecular Context Map table', function () { closeLayer('modal'); MMState.table = true; setModule('overview'); }],
    ['Open Vaccines & Cancer Immunization', function () { closeLayer('modal'); setModule('vaccines-cancer-immunization'); }],
    ['Open Onco-Fertility', function () { closeLayer('modal'); setModule('onco-fertility'); }], ['Print current view', function () { closeLayer('modal'); setTimeout(function () { window.print(); }, 50); }]
  ].forEach(function (x) { items.push({ label: x[0], run: x[1] }); });
  if (low) items = items.filter(function (it, i) { return i === 0 && /^Search/.test(it.label) || it.label.toLowerCase().indexOf(low) >= 0; });
  return items.slice(0, 40);
}
function openPalette() {
  ui('cmd').q = ''; ui('cmd').i = 0;
  openModal('Commands', function () {
    var items = paletteItems(), sel2 = Math.min(ui('cmd').i || 0, Math.max(0, items.length - 1));
    return H`<label for="ow-cmd-input" class="ow-sr">Type a command or search</label><input id="ow-cmd-input" class="ow-input" autocomplete="off" spellcheck="false" placeholder="Type a command, module name or search term…" value="${ui('cmd').q || ''}" role="combobox" aria-expanded="true" aria-controls="ow-cmd-list" aria-activedescendant="ow-cmd-${sel2}" autofocus>
      <ul class="ow-cmd-list" id="ow-cmd-list" role="listbox" aria-label="Commands">${items.map(function (it, i) { return H`<li role="presentation"><button type="button" role="option" id="ow-cmd-${i}" aria-selected="${i === sel2 ? 'true' : 'false'}" data-act="cmd-run" data-i="${i}">${it.label}</button></li>`; })}</ul>
      <p class="ow-subtle" style="margin-top:8px">↑↓ to move, Enter to run, Esc to close. Nothing typed here is stored. ${SAFETY.phi}</p>`;
  }, { small: false });
}

/* ====================================================================
   BOARD / COMPARE helpers
   ==================================================================== */
function pinRecord(rec) {
  if (State.board.some(function (b) { return b.type === rec.type && b.title === rec.title; })) { toast('Already on the Session Board.'); return; }
  State.board.push(snapshot(rec)); toast('Added to Session Board (memory only).'); Events.emit('record-pinned', { type: rec.type }); scheduleRender();
}
function compareRecord(rec) {
  var g = CMP_GROUP[rec.type]; if (!g) { toast('This record type cannot be compared.'); return; }
  var list = State.compare[g] || (State.compare[g] = []);
  if (list.some(function (x) { return x.title === rec.title; })) { toast('Already in comparison.'); return; }
  if (list.length >= 5) { toast('Compare up to 5 ' + g.toLowerCase() + '. Remove one first.'); return; }
  list.push(snapshot(rec)); toast('Added to comparison (' + list.length + '/5).'); scheduleRender();
}
function openRecord(rec) {
  if (!rec) { toast('This record is no longer in memory. Run the search again.'); return; }
  openDrawer(rec.title, function () { return DETAIL[rec.type] ? DETAIL[rec.type](rec) : H`<pre class="ow-code">${JSON.stringify(rec.data, null, 2)}</pre>${provView(rec.prov)}`; });
}

/* ====================================================================
   MAUDE narrative (explicit action only; never stored, logged or exported by default)
   ==================================================================== */
var Narr = null;
function narrativeView() {
  if (!Narr) return '';
  if (Narr.status === 'loading') return H`<p class="ow-row"><span class="ow-spinner"></span> Loading source text…</p>`;
  if (Narr.status === 'error') return H`<div class="ow-notice ow-notice-bad">${icon('alert')}<div>${friendlyError(Narr.error)} ${ext(LINK.maude(Narr.key), 'Open the official MAUDE record')}</div></div>`;
  return H`<div class="ow-notice ow-notice-bad">${icon('alert')}<div><strong>Contains source-reported text — do not copy patient-identifying detail.</strong> This text is shown only while this dialog is open. It is not stored, logged or included in exports.</div></div>
    <div class="ow-section">${Narr.texts.length ? Narr.texts.map(function (t) { return H`<h4>${t.type || 'Text'}</h4><p class="ow-pre" style="margin:4px 0 12px">${t.text}</p>`; }) : H`<p>No narrative text reported by source.</p>`}</div>
    <div class="ow-disclaimer">${SAFETY.maude}</div><div class="ow-card-foot">${extBtn(LINK.maude(Narr.key), 'Official MAUDE record')}<button type="button" class="ow-btn ow-btn-sm" data-act="narrative-export">Export this narrative (opt-in)</button></div>`;
}

/* ====================================================================
   ACTIONS (event delegation via data-act)
   ==================================================================== */
function recOf(el) { return State.records.get(el.getAttribute('data-key')); }
Object.assign(ACTIONS, {
  tab: function (el) { setModule(el.getAttribute('data-mod'), { quiet: false }); },
  search: function (el) { runSearch(el.getAttribute('data-term')); },
  'search-as': function (el) { runSearch(el.getAttribute('data-term'), { type: el.getAttribute('data-type') }); },
  correct: function (el) { if (State.entity) runSearch(State.entity.raw, { type: el.getAttribute('data-type') }); },
  'open-rec': function (el) { openRecord(recOf(el)); },
  pin: function (el) { var r = recOf(el); if (r) pinRecord(r); },
  compare: function (el) { var r = recOf(el); if (r) compareRecord(r); },
  'close-layer': function (el) { closeLayer(el.getAttribute('data-layer')); },
  retry: function () { retryFailed(); },
  'retry-slot': function (el) { var f = State.failed.get(el.getAttribute('data-key')); if (f) { var rt = Runtime[f.src]; if (rt && FETCHABLE_MODES[rt.mode]) { rt.mode = SRC[f.src].defaultMode === 'verify' && !rt.ok ? 'verify' : 'live'; rt.pausedUntil = 0; } State.failed.delete(el.getAttribute('data-key')); f.retry(); } },
  'clear-session': function () { clearSession(); },
  privacy: function () { openModal('Oncotics Privacy', privacyContent); },
  help: function () { openModal('Help — Oncotics Workspace', helpContent); },
  disclaimer: function () { openModal('Medical, regulatory and legal disclaimer', function () { return H`<ul>${LEGAL.longDisclaimer.map(function (l) { return H`<li style="margin-bottom:6px">${l}</li>`; })}</ul>`; }, { small: false }); },
  theme: function () { var order = ['system', 'light', 'dark']; State.prefs.theme = order[(order.indexOf(State.prefs.theme) + 1) % 3]; applyTheme(); renderHeader(); scheduleRender(); announce('Theme: ' + State.prefs.theme); },
  'set-theme': function (el) { State.prefs.theme = el.getAttribute('data-theme'); applyTheme(); renderHeader(); scheduleRender(); },
  'set-density': function (el) { State.prefs.density = el.getAttribute('data-density'); applyTheme(); scheduleRender(); },
  cmd: function () { openPalette(); },
  'cmd-run': function (el) { var it = paletteItems()[parseInt(el.getAttribute('data-i'), 10)]; if (it) it.run(); },
  view: function (el) { ui(el.getAttribute('data-mod')).view = el.getAttribute('data-view'); scheduleRender(); },
  more: function (el) { var k = el.getAttribute('data-key'); ui('_more')[k] = !ui('_more')[k]; scheduleRender(); },
  page: function (el) {
    var mod = el.getAttribute('data-mod'), dir = el.getAttribute('data-dir');
    if (mod === 'evidence') { var u = ui('evidence'); u.cursors = u.cursors || []; var d = slot('civic:evidence').data;
      if (dir === 'next' && d && d.pageInfo) { u.cursors.push(d.pageInfo.endCursor); loadEvidence(d.pageInfo.endCursor); } else if (dir === 'prev') { u.cursors.pop(); loadEvidence(u.cursors[u.cursors.length - 1] || null); } else if (dir === 'first') { u.cursors = []; loadEvidence(null); } }
    if (mod === 'trials') { var t = ui('trials'); t.tokens = t.tokens || []; var td = slot('trials:list').data;
      if (dir === 'next' && td && td.nextPageToken) { t.tokens.push(td.nextPageToken); loadTrials(td.nextPageToken); } else if (dir === 'prev') { t.tokens.pop(); loadTrials(t.tokens[t.tokens.length - 1] || null); } else if (dir === 'first') { t.tokens = []; loadTrials(null); } }
    if (mod === 'literature') { var l = ui('literature'); l.cursors = l.cursors || []; var ld = slot('lit:list').data;
      if (dir === 'next' && ld && ld.next) { l.cursors.push(ld.next); loadLit(ld.next); } else if (dir === 'prev') { l.cursors.pop(); loadLit(l.cursors[l.cursors.length - 1] || null); } else if (dir === 'first') { l.cursors = []; loadLit(null); } }
    if (mod === 'dev-events') { var ed = slot('dev:events').data, p = ed ? ed.page : 0; p = dir === 'next' ? p + 1 : dir === 'prev' ? Math.max(0, p - 1) : 0; load('dev:events', 'openfda-device', function (s) { return Loaders.devEvents(s, State.ctx, p); }, { force: true }); }
    announce('Loading page…');
  },
  'evidence-reset': function () { clearDrafts();  ui('evidence').filters = null; ui('evidence').cursors = []; loadEvidence(); },
  'evidence-all-assertions': function () { ui('evidence').allAssertions = true; scheduleRender(); },
  'trial-reset': function () { clearDrafts(); ui('trials').filters = null; ui('trials').tokens = []; loadTrials(); },
  'drug-tab': function (el) { ui('drug').tab = el.getAttribute('data-tab'); scheduleRender(); },
  'dev-tab': function (el) { ui('devices').tab = el.getAttribute('data-tab'); scheduleRender(); },
  'bio-tab': function (el) { ui('biology').tab = el.getAttribute('data-tab'); if (State.module !== 'biology') setModule('biology'); bioEnsure(ui('biology').tab); scheduleRender(); },
  'drug-cdx': function () {
    var c = State.ctx; if (!c || c.type !== 'drug') return;
    ui('drug').tab = 'cdx'; if (State.module !== 'drug-intelligence') setModule('drug-intelligence');
    load('drug:cdx', 'openfda-device', async function (s) { if (slot('drug:labels').promise) await slot('drug:labels').promise; return Loaders.cdxForDrug(s, c); });
  },
  'drug-chem': function () { var c = State.ctx; load('drug:chembl', 'chembl', function (s) { return Loaders.chembl(s, c); }); load('drug:pubchem', 'pubchem', function (s) { return Loaders.pubchem(s, c); }); },
  'gene-dx': function (el) { var g = el.getAttribute('data-gene'); if (!g) return; ui('devices').tab = 'cdx'; setModule('device-intelligence'); load('dev:gene-dx', 'openfda-device', function (s) { return Loaders.diagnosticsForGene(s, g); }, { force: slot('dev:gene-dx').data && slot('dev:gene-dx').data.gene !== g }); },
  'dev-events': function () { load('dev:events', 'openfda-device', function (s) { return Loaders.devEvents(s, State.ctx, 0); }); },
  'dev-recalls': function () { load('dev:recalls', 'openfda-device', function (s) { return Loaders.devRecalls(s, State.ctx); }); },
  vep: function (el) { var rs = el.getAttribute('data-rs'); load('var:vep', 'ensembl', function (s) { return Loaders.vep(s, State.ctx, rs || null); }); },
  cbio: function (el) { var g = el.getAttribute('data-gene'); load('bio:cbio', 'cbioportal', function (s) { return Loaders.cbio(s, g); }); },
  'cbio-studies': function () { load('bio:cbioStudies', 'cbioportal', function (s) { return Loaders.cbioStudies(s, State.ctx.disease); }); },
  'rel-load': function (el) { bioEnsure(el.getAttribute('data-what')); scheduleRender(); },
  'rel-trials': function (el) { runSearch(el.getAttribute('data-term'), { type: 'drug', module: 'trials' }); },
  'rel-recalls': function (el) { if (runSearch(el.getAttribute('data-code'), { type: 'device', module: 'device-intelligence' })) { ui('devices').tab = 'recalls'; ACTIONS['dev-recalls'](); } },
  'rel-events': function (el) { if (runSearch(el.getAttribute('data-code'), { type: 'device', module: 'device-intelligence' })) { ui('devices').tab = 'events'; ACTIONS['dev-events'](); } },
  'nav-back': function () { navTo(State.navIndex - 1); }, 'nav-fwd': function () { navTo(State.navIndex + 1); }, 'nav-go': function (el) { navTo(parseInt(el.getAttribute('data-i'), 10)); },
  narrative: function (el) {
    var key = el.getAttribute('data-mdr'); if (!key) return;
    Narr = { key: key, status: 'loading', texts: [] };
    openModal('MAUDE report ' + key + ' — source-reported narrative', narrativeView, { onClose: function () { Narr = null; } });
    Net.request('openfda-device', 'https://api.fda.gov/device/event.json?search=' + fq('mdr_report_key', key) + '&limit=1', { noCache: true, force: true, label: 'device/event (narrative)' })
      .then(function (d) { if (!Narr || Narr.key !== key) return; var r = first(arr(d && d.results)); Narr.status = 'ok'; Narr.texts = arr(r && r.mdr_text).map(function (t) { return { type: t.text_type_code, text: t.text }; }); renderLayers(); })
      .catch(function (e) { if (!Narr) return; Narr.status = 'error'; Narr.error = e; renderLayers(); });
  },
  'narrative-export': function () {
    if (!Narr || Narr.status !== 'ok') return;
    var n = { key: Narr.key, texts: Narr.texts.slice() };
    Layers.modal = null; Narr = null; renderLayers();
    confirmDialog('Export source-reported narrative?', H`<div class="ow-notice ow-notice-bad">${icon('alert')}<div>This file will contain source-reported free text that may include sensitive details. Only continue if you need it, and do not share patient-identifying detail.</div></div>`, 'Export narrative').then(function (ok) {
      if (ok) download(CONFIG.exportNames.devices + '-narrative.json', 'application/json', JSON.stringify({ metadata: exportMeta(['openFDA medical device endpoints']), mdrReportKey: n.key, sourceReportedText: n.texts, warning: 'Contains source-reported text. Do not copy patient-identifying detail. MAUDE reports are voluntary and do not prove causality.' }, null, 2));
    });
  },
  'copy-ids': function (el) {
    var kind = el.getAttribute('data-kind'), ids = idList(kind);
    if (!ids.length) { toast('No identifiers of this kind are loaded.'); return; }
    confirmDialog('Copy ' + ids.length + ' identifiers', H`<p>The identifiers will be placed on your clipboard. They relate to your current search and may reveal what you searched.</p><pre class="ow-code">${ids.slice(0, 50).join('\n')}${ids.length > 50 ? '\n…' : ''}</pre>`, 'Copy').then(function (ok) { if (ok) copyText(ids.join('\n')).then(function () { toast('Copied ' + ids.length + ' identifiers.'); }, function () { toast('Copy failed; select the list manually.'); }); });
  },
  'export-json': function () { exportJSON(); }, 'export-csv': function () { exportCSV(); }, 'export-session': function () { exportSession(); },
  'export-devices': function () {
    var r = MOD['device-intelligence'].exportRows();
    if (!r) { toast('No device records loaded.'); return; }
    exportWarn('device records (JSON)').then(function (ok) { if (ok) download(CONFIG.exportNames.devices + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(['openFDA medical device endpoints']), records: r.rows.map(plainRecord) }, null, 2)); });
  },
  'export-board': function () { if (!State.board.length) { toast('The board is empty.'); return; } exportWarn('session board (JSON)').then(function (ok) { if (ok) download(CONFIG.exportNames.board + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(), board: State.board.map(plainRecord) }, null, 2)); }); },
  'export-compare-json': function () { if (!Object.keys(State.compare).some(function (k) { return State.compare[k].length; })) { toast('Nothing to compare yet.'); return; } exportWarn('comparison (JSON)').then(function (ok) { if (ok) { var o = {}; Object.keys(State.compare).forEach(function (k) { o[k] = State.compare[k].map(plainRecord); }); download(CONFIG.exportNames.comparison + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(), comparison: o }, null, 2)); } }); },
  'export-compare-csv': function () {
    var rows = []; Object.keys(State.compare).forEach(function (g) { var list = State.compare[g]; (CMP_FIELDS[g] || []).forEach(function (f) { var row = { group: g, field: f[0] }; list.forEach(function (r, i) { var v = cmpVal(f, r.data); row['item' + (i + 1)] = typeof v === 'object' ? val(v).replace(/<[^>]*>/g, '') : v; }); rows.push(row); }); });
    if (!rows.length) { toast('Nothing to compare yet.'); return; }
    var cols = [{ label: 'Group', key: 'group' }, { label: 'Field', key: 'field' }, { label: 'Item 1', key: 'item1' }, { label: 'Item 2', key: 'item2' }, { label: 'Item 3', key: 'item3' }, { label: 'Item 4', key: 'item4' }, { label: 'Item 5', key: 'item5' }];
    exportWarn('comparison (CSV)').then(function (ok) { if (ok) download(CONFIG.exportNames.comparison + '.csv', 'text/csv;charset=utf-8', '﻿' + toCSV(rows, cols)); });
  },
  print: function () { setTimeout(function () { window.print(); }, 30); },
  'copy-session': function () { exportWarn('session JSON to clipboard').then(function (ok) { if (ok) copyText(JSON.stringify(sessionSummary(false), null, 2)).then(function () { toast('Session JSON copied (search text excluded).'); }); }); },
  'copy-privacy': function () { copyText(privacyStatement()).then(function () { toast('Privacy statement copied.'); }, function () { toast('Copy failed.'); }); },
  probe: function (el) { probe(el.getAttribute('data-src')); },
  'probe-all': function () { probeAll(); },
  'clear-key': function () { State.keys.openfda = ''; Net.clearMemo(); toast('openFDA key removed from memory.'); scheduleRender(); },
  'adv-preview': function () { readAdv(); scheduleRender(); },
  'coverage-copy': function () { var u = ui('coverage'); var inp = $('#cov-q'); if (inp) u.q = inp.value; var url = linkout(u.src || 'who-ictrp', u.q || ''); confirmDialog('Copy search link', H`<p>This link may contain your search text:</p><pre class="ow-code">${url}</pre>`, 'Copy').then(function (ok) { if (ok) copyText(url).then(function () { toast('Link copied.'); }); }); },
  'board-open': function (el) { openRecord(State.board[parseInt(el.getAttribute('data-i'), 10)]); },
  'board-remove': function (el) { State.board.splice(parseInt(el.getAttribute('data-i'), 10), 1); scheduleRender(); },
  'board-compare': function (el) { compareRecord(State.board[parseInt(el.getAttribute('data-i'), 10)]); },
  'board-clear': function () { State.board = []; scheduleRender(); toast('Board cleared.'); },
  'compare-remove': function (el) { var g = el.getAttribute('data-group'); State.compare[g].splice(parseInt(el.getAttribute('data-i'), 10), 1); scheduleRender(); },
  'compare-clear': function () { State.compare = {}; scheduleRender(); toast('Comparison cleared.'); }
});
function navTo(i) { var n = State.nav[i]; if (!n) return; State.navIndex = i; runSearch(n.term, { type: n.forced, fromNav: true, module: 'relationships' }); }
function readAdv() {
  var u = ui('advanced'), res = ADV.find(function (r) { return r.id === (u.res || 'ctgov'); }) || ADV[0], v = advValues(res);
  Array.prototype.forEach.call(ROOT.querySelectorAll('[data-adv]'), function (el) { v[el.getAttribute('data-adv')] = el.value; });
  return { res: res, v: v };
}
var SUBMITS = {
  'evidence-filters': function (f) { var e = evidenceFilters(); var sv = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    e.et = sv('ev-et') || null; e.sg = sv('ev-sg') || null; e.lv = sv('ev-lv') || null; e.st = sv('ev-st') || 'ACCEPTED'; e.th = sv('ev-th') || null; e.dz = sv('ev-dz') || null; e.ds = sv('ev-ds') || null;
    var so = sv('ev-sort').split('|'); e.sortCol = so[0]; e.sortDir = so[1]; e.pageSize = parseInt(sv('ev-ps'), 10) || 25;
    if ([e.th, e.dz, e.ds].some(function (x) { return x && !checkInput(x).ok; })) { toast(PHI_MESSAGE); return; }
    ui('evidence').cursors = []; loadEvidence(); announce('Filters applied.'); },
  'trial-filters': function (form) { var t = trialFilters(); var sv = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    t.status = Array.prototype.filter.call(form.querySelectorAll('input[name="tr-status"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
    t.phase = sv('tr-phase'); t.type = sv('tr-type'); t.age = sv('tr-age'); t.hv = sv('tr-hv'); t.results = sv('tr-results'); t.cond = sv('tr-cond'); t.intr = sv('tr-intr'); t.spons = sv('tr-spons'); t.locn = sv('tr-locn'); t.kw = sv('tr-kw');
    t.startFrom = /^\d{4}-\d{2}-\d{2}$/.test(sv('tr-from')) ? sv('tr-from') : ''; t.startTo = /^\d{4}-\d{2}-\d{2}$/.test(sv('tr-to')) ? sv('tr-to') : ''; t.sort = sv('tr-sort') || '@relevance'; t.pageSize = parseInt(sv('tr-ps'), 10) || 10;
    if ([t.cond, t.intr, t.spons, t.locn, t.kw].some(function (x) { return x && !checkInput(x).ok; })) { toast(PHI_MESSAGE); return; }
    ui('trials').tokens = []; loadTrials(); announce('Filters applied.'); },
  'lit-filters': function () { var f = litFilters(); var sv = function (id) { var el = $('#' + id); return el ? el.value.trim() : ''; };
    f.refine = sv('lit-q'); f.from = /^\d{4}$/.test(sv('lit-from')) ? sv('lit-from') : ''; f.to = /^\d{4}$/.test(sv('lit-to')) ? sv('lit-to') : ''; f.sort = sv('lit-sort'); f.pageSize = parseInt(sv('lit-ps'), 10) || 15; f.oa = $('#lit-oa').checked; f.review = $('#lit-rev').checked;
    if (f.refine && !checkInput(f.refine).ok) { toast(PHI_MESSAGE); return; }
    f.q = f.refine ? '(' + epmcQuery(State.ctx) + ') AND (' + f.refine.replace(/[()]/g, ' ') + ')' : null;
    ui('literature').cursors = []; loadLit(); announce('Filters applied.'); },
  'dev-filters': function () { var f = devFilters(); var sv = function (id) { var el = $('#' + id); return el ? el.value : ''; }; f.pathway = sv('dv-path'); f.cls = sv('dv-cls'); f.panel = sv('dv-panel'); f.tag = sv('dv-tag'); f.sort = sv('dv-sort'); scheduleRender(); },
  'coverage-open': function () { var u = ui('coverage'); u.q = $('#cov-q').value; if (u.q && !checkInput(u.q).ok) { toast(PHI_MESSAGE); return; } var url = linkout(u.src || 'who-ictrp', u.q); if (url) window.open(url, '_blank', 'noopener,noreferrer'); scheduleRender(); },
  'adv-run': function () {
    var a = readAdv(), req = a.res.build(a.v), w = advValidate(a.res, a.v, req);
    if (w.some(function (x) { return /sensitive|mutations/.test(x); })) { toast(w[0]); scheduleRender(); return; }
    load('adv:result', req.src, async function (s) { var d = await Net.request(req.src, req.url, { method: req.method, body: req.body, signal: s, noCache: true, notFoundEmpty: true, label: 'advanced query' }); return d == null ? { empty: true } : { data: d, src: req.src, at: Date.now() }; }, { force: true });
  },
  'set-key': function () { var el = $('#ow-fda-key'); var v = el ? el.value.trim() : ''; if (el) el.value = ''; if (!/^[A-Za-z0-9]{20,64}$/.test(v)) { toast('That does not look like an openFDA key.'); return; } State.keys.openfda = v; Net.clearMemo(); toast('openFDA key set for this session (memory only).'); scheduleRender(); }
};
var CHANGES = {
  'drug-label-pick': function (el) { ui('drug').labelIdx = parseInt(el.value, 10) || 0; scheduleRender(); },
  'coverage-src': function (el) { var u = ui('coverage'); var inp = $('#cov-q'); if (inp) u.q = inp.value; u.src = el.value; scheduleRender(); },
  'adv-res': function (el) { clearDrafts(); ui('advanced').res = el.value; State.slots.delete('adv:result'); scheduleRender(); },
  'toggle-source': function (el) { if (el.checked) State.prefs.disabledSources.delete(el.value); else State.prefs.disabledSources.add(el.value); toast((el.checked ? 'Live requests enabled for ' : 'Live requests turned off for ') + SRC[el.value].displayName + ' (this session only).'); scheduleRender(); },
  'toggle-module': function (el) { if (el.checked) State.prefs.hiddenModules.delete(el.value); else State.prefs.hiddenModules.add(el.value); scheduleRender(); }
};

/* ====================================================================
   ACTIONS / SUBMITS / CHANGES for interpretation, globe, molecular map,
   verify-mode sources, vaccines, Onco-Fertility, imaging context, expert.
   (Inserted into 14-app.js by build.sh before EVENT WIRING.)
   ==================================================================== */
function interpCand(el) { var I = State.interp; return I ? I.candidates.find(function (x) { return x.key === el.getAttribute('data-key'); }) : null; }
Object.assign(ACTIONS, {
  'interp-use': function (el) { if (State.interp) runSearch(State.interp.query, { pick: el.getAttribute('data-key') }); },
  'interp-search': function (el) { var c = interpCand(el); if (c) runSearch(State.interp.query, { pick: c.key, module: MOD[c.module] ? c.module : 'overview' }); },
  'interp-refine': function () { var q = $('#ow-q'); if (q) { q.focus(); q.select(); } announce('Edit the query in the search box and press Explore.'); },
  'interp-sources': function (el) {
    var c = interpCand(el); if (!c) return;
    openModal('Sources for “' + typeName(c) + '”', function () { var list = interpSourcesFor(c); return H`<p class="ow-subtle">Sources Oncotics may use for this interpretation. Live sources are queried directly by your browser; others open the official site.</p>${table([{ label: 'Source', render: function (x) { return H`<strong>${x.displayName}</strong>`; } }, { label: 'Mode', render: function (x) { return modeBadge(x.id); } }, { label: 'Kind', key: 'kind' }, { label: 'Flags', render: function (x) { return flagBadges(x); } }, { label: 'Official', render: function (x) { return ext(x.officialSiteUrl || linkout(x.id, ''), 'Open'); } }], list)}`; });
  },
  'interp-pin': function (el) { var c = interpCand(el); if (!c) return; pinRecord(putRecord('interpretation', typeName(c) + ': ' + c.normalized + ' (' + c.score + ' ' + c.scoreLabel + ')', 'oncotics', { type: c.type, normalized: c.normalized, score: c.score, label: c.scoreLabel, why: c.why }, { source: 'oncotics', sourceName: 'Oncotics interpretation (heuristic)', endpoint: 'interpretation', retrievedAt: isoNow(), category: 'heuristic-interpretation' })); },
  'interp-module': function (el) { var c = interpCand(el); if (!c) return; if (State.interp.selectedKey === c.key && State.ctx) setModule(c.module, { focus: true }); else runSearch(State.interp.query, { pick: c.key, module: c.module }); },
  'interp-export': function () { var x = interpExport(); if (!x) { toast('No interpretation yet.'); return; } exportWarn('search interpretation (JSON)').then(function (ok) { if (ok) download(CONFIG.exportNames.interpretation + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(['Oncotics interpretation engine']), interpretation: x }, null, 2)); }); },
  'interp-help': function () { openModal('How interpretation confidence works', interpHelp); },
  // ---- Globe
  'globe-view': function (el) { GlobeState.view = el.getAttribute('data-view'); scheduleRender(); },
  'globe-reset': function () { if (Globe.engine) Globe.engine.reset(); },
  'globe-fly': function (el) { GlobeState.view = 'globe'; scheduleRender(); setTimeout(function () { if (Globe.engine) Globe.engine.flyTo(parseFloat(el.getAttribute('data-lat')), parseFloat(el.getAttribute('data-lon')), 2.2); }, 60); },
  'globe-cluster': function (el) { var c = clusterLocations(locFiltered(globeLocations()), 3).find(function (x) { return x.id === el.getAttribute('data-id'); }); if (c) Globe.openPopup(c.items); },
  'globe-clear': function () { resetGlobeState(); State.slots.delete('lit:institutions'); State.slots.delete('trials:sites'); State.records.forEach(function (r) { if (r.type === 'trial') delete r.data.sites; }); scheduleRender(); toast('Globe state cleared (memory only).'); },
  'globe-filter': function () { var items = GlobeState.popup || []; var keys = uniq(items.map(function (x) { return x.recordKey; }).filter(Boolean)); var lbl = countBy(items, function (x) { return x.country || x.label; }).slice(0, 2).map(function (x) { return x[0]; }).join(', '); GlobeState.filter = { keys: keys, label: lbl }; closeLayer('modal'); toast('Filtered to ' + lbl + ' (memory only).'); scheduleRender(); },
  'globe-unfilter': function () { GlobeState.filter = null; scheduleRender(); },
  'globe-pin': function () { var items = GlobeState.popup || []; if (!items.length) return; var lbl = countBy(items, function (x) { return x.country || x.label; }).slice(0, 2).map(function (x) { return x[0]; }).join(', '); pinRecord(putRecord('globe-cluster', 'Location cluster: ' + lbl + ' (' + items.length + ' public records)', 'oncotics', { label: lbl, records: items.length, kinds: countBy(items, function (x) { return x.kind; }), recordIds: uniq(items.map(function (x) { return x.recordId; }).filter(Boolean)).slice(0, 50) }, { source: 'oncotics', sourceName: 'Derived globe cluster (public records)', endpoint: 'globe', retrievedAt: isoNow(), category: 'globe-derived-cluster' })); },
  'globe-export': function () { var r = globeExportRows(); if (!r.rows.length) { toast('No public locations loaded.'); return; } exportWarn('globe location list (JSON + CSV)').then(function (ok) { if (!ok) return; download(CONFIG.exportNames.globe + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(), note: SAFETY.globe, locations: r.rows }, null, 2)); setTimeout(function () { download(CONFIG.exportNames.globe + '.csv', 'text/csv;charset=utf-8', '﻿' + toCSV(r.rows, r.cols)); }, 300); }); },
  'trial-sites': function () {
    var tr = slot('trials:list'); if (tr.status !== 'ok') return; var ids = tr.data.items.map(function (r) { return r.data.nct; }).filter(Boolean).slice(0, 10);
    load('trials:sites', 'ctgov', async function (sg) {
      var d = await Net.request('ctgov', SRC.ctgov.apiBase + '/studies?' + qs({ format: 'json', 'filter.ids': ids.join(','), pageSize: ids.length }), { signal: sg, label: 'studies (site locations)' });
      var n = 0; arr(d && d.studies).forEach(function (st) { var nr2 = normTrial(st, false); State.records.delete(nr2.key); var tgt = tr.data.items.find(function (r) { return r.data.nct === nr2.data.nct; }); if (tgt) { tgt.data.sites = nr2.data.sites; n += nr2.data.sites.length; } });
      Globe.sig = ''; return n ? { sites: n, total: n, items: [] } : { empty: true };
    }, { force: true });
  },
  'lit-institutions': function () { var l = slot('lit:list'); if (l.status !== 'ok') return; load('lit:institutions', 'openalex', function (sg) { return Loaders.openalexInstitutions(sg, l.data.items.map(function (r) { return r.data.pmid; })); }); },
  // ---- Molecular Context Map
  'mm-view': function (el) { MMState.table = el.getAttribute('data-view') === 'table'; scheduleRender(); },
  'mm-node': function (el) { var id = el.getAttribute('data-id'); MMState.sel = id; var G = buildMolMap(), n = G.nodes.find(function (x) { return x.id === id; }); openDrawer(n ? (MM_TYPES[n.type] || MM_TYPES.concept)[0] + ': ' + n.label : 'Node', function () { return mmNodeBody(id); }, { onClose: function () { MMState.sel = null; } }); },
  'mm-more': function () { MMState.limit += 10; scheduleRender(); },
  'mm-expand': function (el) { MMState.expanded.add(el.getAttribute('data-id')); ['protein', 'pathways', 'interactions', 'structure'].forEach(function (t) { bioEnsure(t); }); closeLayer('drawer'); toast('Loading neighbors (Reactome, STRING, AlphaFold)…'); },
  'mm-enrich': function () { if (!State.ctx) return; ['gene', 'protein', 'pathways', 'interactions'].forEach(function (t) { bioEnsure(t); }); toast('Loading biology context for the map…'); },
  'mm-pin': function (el) { var G = buildMolMap(), n = G.nodes.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!n) return; pinRecord(putRecord('molecular-node', (MM_TYPES[n.type] || MM_TYPES.concept)[0] + ': ' + n.label, n.source || 'oncotics', { type: n.type, label: n.label, category: n.category, confidence: n.confidence, url: n.url || null }, { source: n.source || 'oncotics', sourceName: SRC[n.source] ? SRC[n.source].displayName : 'Oncotics', endpoint: 'molecular context map', retrievedAt: isoNow(), category: n.category, url: n.url || null })); },
  'mm-export': function (el) {
    if (!State.ctx) return; var fmt = el.getAttribute('data-fmt'), x = molMapExport();
    exportWarn('molecular context map (' + fmt.toUpperCase() + ')').then(function (ok) { if (!ok) return;
      if (fmt === 'csv') download(CONFIG.exportNames.molmap + '.csv', 'text/csv;charset=utf-8', '﻿' + toCSV(x.edges.map(function (e) { var f = x.nodes.find(function (n) { return n.id === e.from; }), t = x.nodes.find(function (n) { return n.id === e.to; }); return Object.assign({ fromLabel: f ? f.label : e.from, toLabel: t ? t.label : e.to }, e); }), [{ label: 'From', key: 'fromLabel' }, { label: 'Relationship', key: 'relationship' }, { label: 'To', key: 'toLabel' }, { label: 'Source', key: 'source' }, { label: 'Category', key: 'category' }, { label: 'Confidence', key: 'confidence' }, { label: 'Derived', key: 'derived' }]));
      else download(CONFIG.exportNames.molmap + '.json', 'application/json', JSON.stringify({ metadata: exportMeta(), note: SAFETY.molmap, graph: x }, null, 2)); });
  },
  // ---- Verify-mode sources (explicit user action only)
  'try-live': function (el) {
    var w = el.getAttribute('data-what'), c = State.ctx, g = el.getAttribute('data-gene') || bioGene(), key = el.getAttribute('data-key'), rec = key ? State.records.get(key) : null;
    var withAcc = function (k, src, fn) { load(k, src, async function (sg) { await ensureProtein(); var a = bioAcc(); if (!a) return { empty: true }; return fn(sg, a); }); };
    if (w === 'pdbe') withAcc('bio:pdbe', 'pdbe', Loaders.pdbe);
    else if (w === 'ebi_proteins') withAcc('bio:features', 'ebi_proteins', Loaders.ebiProteins);
    else if (w === 'quickgo') withAcc('bio:quickgo', 'quickgo', Loaders.quickgo);
    else if (w === 'complex' && g) load('bio:complex', 'complex_portal', function (sg) { return Loaders.complexPortal(sg, g); });
    else if (w === 'gdc' && g) load('bio:gdc', 'nci_gdc', function (sg) { return Loaders.gdcGene(sg, g); });
    else if (w === 'gdc-projects' && c) load('bio:gdcProjects', 'nci_gdc', function (sg) { return Loaders.gdcProjects(sg, c.disease || c.label); });
    else if (w === 'dgidb' && g) load('bio:dgidb', 'dgidb', function (sg) { return Loaders.dgidbGene(sg, g); });
    else if (w === 'dgidb-drug' && c && c.drug) load('drug:dgidb', 'dgidb', function (sg) { return Loaders.dgidbDrug(sg, c.drug); });
    else if (w === 'oncotree' && c) load('ont:oncotree', 'oncotree', function (sg) { return Loaders.oncotree(sg, el.getAttribute('data-term') || c.disease || c.label); });
    else if (w === 'openalex-paper' && rec) load('lit:oa:' + key, 'openalex', function (sg) { return Loaders.openalexWork(sg, rec.data); });
    else if (w === 'crossref' && rec && rec.data.doi) load('lit:cr:' + key, 'crossref', function (sg) { return Loaders.crossref(sg, rec.data.doi); });
    else if (w === 's2' && rec) load('lit:s2:' + key, 'semantic_scholar', function (sg) { return Loaders.semanticScholar(sg, rec.data); });
  },
  // ---- Vaccines / Onco-Fertility / imaging context / expert
  'vax-tab': function (el) { ui('vaccines').tab = el.getAttribute('data-tab'); scheduleRender(); },
  'vax-labels': function () { var c = State.ctx; if (c && c.type === 'vaccine') load('vax:labels', 'openfda-drug', function (sg) { return Loaders.vaccineLabels(sg, c); }); },
  'fert-tab': function (el) { ui('fert').tab = el.getAttribute('data-tab'); scheduleRender(); },
  'fert-ae': function () { var dr = fertDrug(); if (dr) load('fert:ae', 'openfda-drug', function (sg) { return Loaders.reproAE(sg, { drug: dr, brand: State.ctx && State.ctx.brand }); }); },
  'fert-trials': function (el) { var t = el.getAttribute('data-term'); ui('fert').trialTerm = t; load('fert:trials', 'ctgov', function (sg) { return Loaders.trials(sg, { type: 'concept', trialTerm: t, label: t }, { pageSize: 10 }); }, { force: true }); },
  'fert-devices': function (el) { var t = el.getAttribute('data-term'); ui('fert').devTerm = t; load('fert:devices', 'openfda-device', function (sg) { return Loaders.devAuth(sg, { type: 'device', deviceText: t, deviceTerm: t, label: t }); }, { force: true }); },
  'img-devices': function () { var c = State.ctx; if (!c) return; var t = c.imaging ? c.imaging.concept : c.label; load('img:devices', 'openfda-device', function (sg) { return Loaders.devAuth(sg, { type: 'device', deviceText: t, deviceTerm: t, label: t }); }, { force: true }); toast('Loading imaging device records from openFDA (may lag official DB)…'); },
  'ek-oncokb': function () { load('ek:oncokb', 'oncokb', function (sg) { return Loaders.oncokb(sg, State.ctx); }, { force: true }); },
  'clear-oncokb': function () { State.keys.oncokb = ''; State.slots.delete('ek:oncokb'); toast('OncoKB token removed from memory.'); scheduleRender(); },
  'clear-s2': function () { State.keys.s2 = ''; Net.clearMemo(); toast('Semantic Scholar key removed from memory.'); scheduleRender(); }
});
Object.assign(SUBMITS, {
  'set-s2-key': function () { var el = $('#ow-s2-key'); var v = el ? el.value.trim() : ''; if (el) el.value = ''; if (!/^[A-Za-z0-9]{20,80}$/.test(v)) { toast('That does not look like a Semantic Scholar key.'); return; } State.keys.s2 = v; Net.clearMemo(); toast('Semantic Scholar key set for this session (memory only).'); scheduleRender(); },
  'set-oncokb-token': function () { var el = $('#ow-okb-key'); var v = el ? el.value.trim() : ''; if (el) el.value = ''; if (!CONFIG.features.oncokbAuthenticated) return; if (!/^[A-Za-z0-9-]{20,80}$/.test(v)) { toast('That does not look like an OncoKB token.'); return; } State.keys.oncokb = v; toast('OncoKB token set for this session (memory only).'); scheduleRender(); },
  'adv-run': function () {
    var a = readAdv(), req = a.res.build(a.v), w = advValidate(a.res, a.v, req);
    if (w.some(function (x) { return /sensitive|mutations/.test(x); })) { toast(w[0]); scheduleRender(); return; }
    if (req.linkout) { if (req.url) window.open(req.url, '_blank', 'noopener,noreferrer'); return; }
    load('adv:result', req.src, async function (s) { var d = await Net.request(req.src, req.url, { method: req.method, body: req.body, signal: s, noCache: true, notFoundEmpty: true, tryVerify: true, label: 'advanced query' }); return d == null ? { empty: true } : { data: d, src: req.src, at: Date.now() }; }, { force: true });
  }
});
Object.assign(CHANGES, {
  'globe-kind': function (el) { if (el.checked) GlobeState.hidden.delete(el.value); else GlobeState.hidden.add(el.value); scheduleRender(); },
  'globe-imagery': function (el) {
    if (!el.checked) { GlobeState.imagery = false; if (Globe.engine && Globe.engine.setImagery) Globe.engine.setImagery(false); scheduleRender(); return; }
    el.checked = false;
    confirmDialog('Enable external map imagery?', H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.externalTiles} Tile requests reveal the map area you view to ${CONFIG.globeExternalImagery.host}. Turn it off at any time; it is never remembered.</div></div>`, 'Enable imagery').then(function (ok) { if (!ok) return; GlobeState.imagery = true; if (Globe.engine && Globe.engine.setImagery) Globe.engine.setImagery(true); scheduleRender(); });
  },
  'mm-type': function (el) { if (el.checked) MMState.hidden.delete(el.value); else MMState.hidden.add(el.value); scheduleRender(); }
});
Globe.openPopup = function (items) { GlobeState.popup = items.slice(0, 300); openModal('Public locations at this marker', globePopupBody, { onClose: function () { GlobeState.popup = null; } }); };

/* ====================================================================
   EVENT WIRING + KEYBOARD
   ==================================================================== */
ROOT.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!t || !ROOT.contains(t)) return;
  var fn = ACTIONS[t.getAttribute('data-act')];
  if (!fn) return;
  if (t.tagName === 'A') return;
  e.preventDefault();
  try { fn(t, e); } catch (err) { toast('That action could not be completed.'); }
});
ROOT.addEventListener('change', function (e) {
  var t = e.target; if (!t || !t.getAttribute) return;
  if (t.id === 'ow-exp-q') { ExpState.includeQuery = t.checked; return; }
  if (MAIN.contains(t) && t.closest && t.closest('form') && draftKey(t) && !t.getAttribute('data-change')) Drafts[draftKey(t)] = t.type === 'checkbox' ? t.checked : t.value;
  var fn = CHANGES[t.getAttribute('data-change')]; if (fn) fn(t);
});
ROOT.addEventListener('submit', function (e) {
  var f = e.target; e.preventDefault();
  if (f.id === 'ow-search-form') { runSearch($('#ow-q').value, { fromInput: true }); return; }
  var fn = SUBMITS[f.getAttribute('data-submit')]; if (fn) { try { fn(f); } catch (err) { toast('That action could not be completed.'); } clearDrafts(f); }
});
ROOT.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-ow-det]')) ui('_open')[d.getAttribute('data-ow-det')] = d.open; }, true);
ROOT.addEventListener('input', function (e) {
  var t = e.target;
  if (t && MAIN.contains(t) && t.closest && t.closest('form') && draftKey(t)) Drafts[draftKey(t)] = t.type === 'checkbox' ? t.checked : t.value;
  if (t.id === 'ow-cmd-input') { ui('cmd').q = t.value; ui('cmd').i = 0; renderLayers(); var el = $('#ow-cmd-input'); if (el) { el.focus(); var n = el.value.length; try { el.setSelectionRange(n, n); } catch (x) { /* ignore */ } } }
  if (t.id === 'ow-q') { var errEl = $('#ow-input-error'); if (errEl && !errEl.hidden) { errEl.hidden = true; errEl.innerHTML = ''; } }
});
document.addEventListener('keydown', function (e) {
  var ae = document.activeElement;
  var inField = ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable);
  var ours = !ae || ae === document.body || ROOT.contains(ae);
  if (!ours) return;
  if (e.key === 'Escape' && (Layers.modal || Layers.drawer)) { e.preventDefault(); closeLayer(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && ae && ae.getAttribute && ae.getAttribute('role') === 'button' && ae.hasAttribute('data-act') && !/^(BUTTON|A|INPUT)$/.test(ae.tagName)) { e.preventDefault(); var fnk = ACTIONS[ae.getAttribute('data-act')]; if (fnk) { try { fnk(ae, e); } catch (err) { toast('That action could not be completed.'); } } return; }
  if (e.key === 'Tab' && (Layers.modal || Layers.drawer)) { trapFocus(e); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
  if (e.key === '/' && !inField && !Layers.modal && !Layers.drawer) { e.preventDefault(); var q = $('#ow-q'); q.focus(); q.select(); return; }
  if (ae && ae.id === 'ow-cmd-input') {
    var items = paletteItems(), i = ui('cmd').i || 0;
    if (e.key === 'ArrowDown') { e.preventDefault(); ui('cmd').i = Math.min(items.length - 1, i + 1); renderLayers(); $('#ow-cmd-input').focus(); var o = $('#ow-cmd-' + ui('cmd').i); if (o) o.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ui('cmd').i = Math.max(0, i - 1); renderLayers(); $('#ow-cmd-input').focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[i]) items[i].run(); }
    return;
  }
  if (ae && ae.classList && ae.classList.contains('ow-tab')) {
    var tabs = Array.prototype.slice.call(RAIL.querySelectorAll('.ow-tab')), idx = tabs.indexOf(ae), next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); setModule(next.getAttribute('data-mod'), { quiet: true }); renderAll(); var nt = document.getElementById(next.id); if (nt) nt.focus(); }
  }
});
// Restored from the back/forward cache: wipe everything so no prior session is shown.
window.addEventListener('pageshow', function (e) { if (e.persisted) clearSession(true); });

/* ====================================================================
   PRINT HEADER/FOOTER + MAIN WRAPPER
   ==================================================================== */
var baseRenderMain = renderMain;
renderMain = function () {
  baseRenderMain();
  var extra = '';
  if (isNullOrigin()) extra += val(H`<div class="ow-notice ow-notice-warn ow-noprint" style="margin-bottom:12px">${icon('alert')}<div><strong>This page is running from a local file or a sandboxed frame (Origin: null).</strong> Some providers (notably CIViC) reject such requests. Serve the page from a web address, e.g. <code>python3 -m http.server</code>.</div></div>`);
  var used = uniq(Array.from(State.slots.values()).map(function (s) { return s.src && SRC[s.src] ? SRC[s.src].attribution : null; }).filter(Boolean));
  var printBlock = val(H`<div class="ow-print-only" style="margin-top:24px;border-top:1px solid #999;padding-top:8px;font-size:11px"><p><strong>${BRAND.product}</strong> — printed ${new Date().toLocaleString()} from the current in-memory view.${State.entity ? ' Query type: ' + State.entity.type + '.' : ''}</p><p>Sources: ${used.join(' ') || 'none loaded'}</p><p>Retrieval timestamps apply to this session only. Educational and research use only. Not medical, regulatory, or procurement advice. openFDA device records may lag official FDA databases.</p><p>${LEGAL.copyright} ${LEGAL.trademark}</p></div>`);
  if (extra) MAIN.insertAdjacentHTML('afterbegin', extra);
  MAIN.insertAdjacentHTML('beforeend', printBlock);
  try { Globe.attach(); } catch (e) { /* the accessible list view remains available */ }
};

/* ====================================================================
   PUBLIC API (memory only; never writes URLs or storage)
   ==================================================================== */
function sanitizeEntity(ent) {
  if (!ent || typeof ent !== 'object') return null;
  var title = String(ent.title || '').slice(0, 200);
  if (!title || !checkInput(title.slice(0, 150)).ok) return null;
  var type = /^[a-z-]{2,20}$/.test(ent.type || '') ? ent.type : 'external';
  var data = {}; try { data = JSON.parse(JSON.stringify(ent.data || {})); if (JSON.stringify(data).length > 20000) data = {}; } catch (e) { data = {}; }
  return { key: uid('x'), type: type, title: title, source: 'external', data: data, prov: { source: 'external', sourceName: 'Provided by host page', endpoint: 'api', retrievedAt: isoNow(), category: 'normalized', url: safeUrl(ent.url || '') || null } };
}
var API = {
  version: '2.0.0',
  modules: MOD,
  events: Events,
  search: function (o) { return runSearch(o && o.term, { type: o && o.type }); },
  openModule: function (o) { setModule(o && o.moduleId, { focus: true }); },
  openTrialByNct: function (o) { return runSearch(o && o.nctId, { module: 'trials' }); },
  openDrugByName: function (o) { return runSearch(o && o.name, { type: 'drug', module: 'drug-intelligence' }); },
  openDeviceByName: function (o) { return runSearch(o && o.name, { type: 'device', module: 'device-intelligence' }); },
  openDeviceByAuthorization: function (o) { return runSearch(o && o.number, { module: 'device-intelligence' }); },
  openProductCode: function (o) { return runSearch(o && o.code, { type: 'device', module: 'device-intelligence' }); },
  openUdi: function (o) { return runSearch(o && o.udiDi, { module: 'device-intelligence' }); },
  findCompanionDiagnosticsForDrug: function (o) { if (runSearch((o && (o.name || o.applicationNumber)) || '', { type: 'drug', module: 'drug-intelligence' })) ACTIONS['drug-cdx'](); },
  findDiagnosticsForGene: function (o) { var g = o && o.symbol; if (g && runSearch(g, { type: 'gene' })) ACTIONS['gene-dx']({ getAttribute: function () { return State.ctx.gene; } }); },
  findDiagnosticsForVariant: function (o) { if (runSearch((o && (o.rsid || o.hgvs)) || '', { module: 'device-intelligence' })) { ui('devices').tab = 'cdx'; var p = slot('var:myvariant').promise || slot('var:vep').promise || Promise.resolve(); p.then(function () { setTimeout(function () { if (State.ctx && State.ctx.gene) ACTIONS['gene-dx']({ getAttribute: function () { return State.ctx.gene; } }); }, 50); }); } },
  openVariant: function (o) { return runSearch((o && (o.rsid || o.hgvs)) || '', { module: 'biology' }); },
  openGene: function (o) { return runSearch(o && o.symbol, { type: 'gene' }); },
  addToBoard: function (o) { var r = sanitizeEntity(o && o.entity); if (r) { State.board.push(r); scheduleRender(); return true; } return false; },
  addToCompare: function (o) { var r = sanitizeEntity(o && o.entity); if (r && CMP_GROUP[r.type]) { compareRecord(r); return true; } return false; },
  clearSession: function () { clearSession(); },
  getVisibleResults: function () { var m = MOD[State.module], r = m && m.exportRows ? m.exportRows() : null; return r ? JSON.parse(JSON.stringify(r.rows.map(function (x) { return x.key ? plainRecord(x) : x; }))) : []; },
  getSessionSummary: function () { return JSON.parse(JSON.stringify(sessionSummary(false))); },
  openDrugIntelligence: function (o) { return o && o.name ? API.openDrugByName(o) : setModule('drug-intelligence'); },
  openClinicalEvidence: function (o) { return o && o.term ? runSearch(o.term, { module: 'clinical-evidence' }) : setModule('clinical-evidence'); },
  openBiology: function (o) { return o && o.term ? runSearch(o.term, { module: 'biology' }) : setModule('biology'); },
  openTrials: function (o) { return o && o.term ? runSearch(o.term, { module: 'trials' }) : setModule('trials'); },
  openLiterature: function (o) { return o && o.term ? runSearch(o.term, { module: 'literature' }) : setModule('literature'); },
  openVaccines: function (o) { return o && o.term ? runSearch(o.term, { type: 'vaccine', module: 'vaccines-cancer-immunization' }) : setModule('vaccines-cancer-immunization'); },
  openOncoFertility: function (o) { return o && o.term ? runSearch(o.term, { module: 'onco-fertility' }) : setModule('onco-fertility'); },
  openExpertKnowledge: function () { setModule('expert-knowledge'); },
  getInterpretation: function () { var x = interpExport(); return x ? JSON.parse(JSON.stringify(x)) : null; },
  getGlobeLocations: function () { return JSON.parse(JSON.stringify(globeLocations())); },
  getMolecularContext: function () { return State.ctx ? JSON.parse(JSON.stringify(molMapExport())) : null; },
  imagingWorkbenchUrl: function () { return CONFIG.imagingUrl; },
  sources: function () { return SOURCES.map(function (s) { return { id: s.id, displayName: s.displayName, defaultMode: s.defaultMode, runtimeMode: Runtime[s.id].mode, corsVerified: !!s.corsVerified }; }); }
};
window.OncoticsWorkspace = API;

/* ====================================================================
   INIT (no network requests on load)
   ==================================================================== */
renderHeader();
applyTheme();
renderAll();
})();
