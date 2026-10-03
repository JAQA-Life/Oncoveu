/* ====================================================================
   PER-MODULE SEARCH (independent of the common search)
   Each module's own search box queries only the live sources that module
   uses and shows the results inside that module. It does not change the
   common query, its interpretation, other modules or the Overview, and a
   common search does not clear it. State is memory only (State.ms) and is
   wiped by Clear Session.
   ==================================================================== */
// Typed jobs run when the module's own reading of the query (prefer order in MOD_SEARCH) has that type;
// free-text jobs run otherwise (or always, when they have no `needs`/`unless`).
var MS_JOB_DEFS = {
  tr: { src: 'ctgov', label: 'Clinical trials', run: function (s, t, c) { return Loaders.trials(s, c || { type: 'concept', label: t, trialTerm: t }, { pageSize: 10 }); } },
  lit: { src: 'europepmc', label: 'Literature', run: function (s, t, c) { return Loaders.literature(s, c || { type: 'concept', label: t }, c ? {} : { q: '"' + String(t).replace(/"/g, ' ') + '"' }); } },
  'civic-ev': { src: 'civic', label: 'Curated evidence items', needs: ['variant', 'gene', 'drug', 'disease'], run: function (s, t, c) { var sc = civicScope(c); return sc ? Loaders.civicEvidence(s, sc, {}, null) : { empty: true }; } },
  'civic-search': { src: 'civic', label: 'CIViC search', run: function (s, t) { return Loaders.civicSearch(s, t).then(function (d) { return d.empty ? d : { items: d.items.map(function (x) { return { title: x.name, sub: humanEnum(x.resultType || ''), url: linkout('civic', x.name) }; }) }; }); } },
  ols: { src: 'ols', label: 'Ontology terms (MONDO, NCIt, EFO)', run: function (s, t) { return Loaders.ols(s, t).then(function (d) { return d.empty ? d : { items: d.items.map(function (x) { return { title: x.label, sub: x.id + ' · ' + x.ontology, url: safeUrl(x.iri) }; }) }; }); } },
  oncotree: { src: 'oncotree', label: 'Tumor types', run: function (s, t) { return Loaders.oncotree(s, t).then(function (d) { return d.empty ? d : { items: d.items.map(function (x) { return { title: x.name, sub: x.code + (x.tissue ? ' · ' + x.tissue : ''), url: LINK.oncotree(x.code) }; }) }; }); } },
  gdcp: { src: 'nci_gdc', label: 'Research cohorts (GDC projects)', run: function (s, t) { return Loaders.gdcProjects(s, t).then(function (d) { return d.empty ? d : { items: d.items.map(function (p) { return { title: p.id + ' · ' + (p.name || ''), sub: p.cases != null ? num(p.cases) + ' cases' : '', url: LINK.gdcProject(p.id) }; }) }; }); } },
  // Drug Intelligence (typed: a drug reading)
  labels: { src: 'openfda-drug', label: 'FDA drug labels', needs: ['drug'], run: function (s, t, c) { return Loaders.drugLabels(s, c); } },
  approvals: { src: 'openfda-drug', label: 'Drugs@FDA approval records', needs: ['drug'], run: function (s, t, c) { return Loaders.drugsFda(s, c); } },
  rx: { src: 'rxnorm', label: 'RxNorm concepts', needs: ['drug'], run: function (s, t, c) { return Loaders.rxnorm(s, c); } },
  events: { src: 'openfda-drug', label: 'Most reported adverse-event terms (FAERS)', needs: ['drug'], run: function (s, t, c) { return Loaders.drugEvents(s, c); } },
  enf: { src: 'openfda-drug', label: 'Drug enforcement / recalls', needs: ['drug'], run: function (s, t, c) { return Loaders.drugEnforcement(s, c); } },
  'chembl-d': { src: 'chembl', label: 'ChEMBL molecule and mechanisms', needs: ['drug'], run: function (s, t, c) { return Loaders.chembl(s, c); } },
  'dgidb-d': { src: 'dgidb', label: 'Gene interactions (DGIdb)', needs: ['drug'], run: function (s, t, c) { return Loaders.dgidbDrug(s, c.drug); } },
  // Devices & Dx (typed: a device reading; free text otherwise)
  'dev-auth': { src: 'openfda-device', label: 'Device authorizations (510(k), PMA, De Novo)', run: function (s, t, c) { return Loaders.devAuth(s, c && c.type === 'device' ? c : { type: 'device', deviceText: t, deviceTerm: t, label: t }); } },
  'dev-class': { src: 'openfda-device', label: 'Device classification', run: function (s, t, c) { return Loaders.devClass(s, c && c.type === 'device' ? c : { type: 'device', deviceText: t, deviceTerm: t, label: t }); } },
  'dev-recalls': { src: 'openfda-device', label: 'Device recalls and enforcement', run: function (s, t, c) { return Loaders.devRecalls(s, c && c.type === 'device' ? c : { type: 'device', deviceText: t, deviceTerm: t, label: t }); } },
  // Vaccines / Onco-Fertility (typed)
  'vax-labels': { src: 'openfda-drug', label: 'FDA vaccine / biologic labels', needs: ['vaccine'], run: function (s, t, c) { return c.vaccine && c.vaccine.products && c.vaccine.products.length ? Loaders.vaccineLabels(s, c) : { empty: true }; } },
  'repro-ae': { src: 'openfda-drug', label: 'Reproductive adverse-event terms (FAERS)', needs: ['drug'], run: function (s, t, c) { return Loaders.reproAE(s, { drug: c.drug, brand: c.brand }); } },
  // Biology (typed extras)
  'myvariant-v': { src: 'myvariant', label: 'Variant annotation', needs: ['variant', 'rsid', 'hgvs'], run: function (s, t, c) { return Loaders.myvariant(s, c); } },
  'cbio-g': { src: 'cbioportal', label: 'Mutation frequency (cBioPortal cohort)', needs: ['gene', 'variant'], run: function (s, t, c) { return c.gene ? Loaders.cbio(s, c.gene) : { empty: true }; } }
};
CX_ENTRIES.forEach(function (e) { if (e.run) MS_JOB_DEFS['cx:' + e.id] = { src: e.src, label: e.label, run: e.run, pick: e.pick, from: e.from ? 'cx:' + e.from : null }; });
var MS_FREE_DRUG = ['cx:fda-label', 'cx:fda-events', 'cx:rxnorm', 'cx:chembl'];
var MS_JOBS = {
  'clinical-evidence': ['civic-ev', 'civic-search', 'cx:opentargets', 'ols', 'oncotree', 'cx:gwas'],
  'trials': ['tr'],
  'drug-intelligence': ['labels', 'approvals', 'rx', 'events', 'enf', 'chembl-d', 'dgidb-d', 'cx:pubchem'].concat(MS_FREE_DRUG.map(function (x) { return '!drug|' + x; })),
  'vaccines-cancer-immunization': ['vax-labels', 'tr', 'lit', 'cx:fda-label'],
  'device-intelligence': ['dev-auth', 'dev-class', 'dev-recalls'],
  'onco-fertility': ['tr', 'lit', 'repro-ae', 'cx:fda-events', 'cx:fda-label'],
  'biology': ['myvariant-v', 'cbio-g', 'cx:mygene', 'cx:uniprot', 'cx:string', 'cx:reactome', 'cx:quickgo', 'cx:complex', 'cx:pdbe', 'cx:ensembl', 'cx:alphafold', 'cx:ebi_proteins', 'cx:dgidb', 'cx:cbio', 'gdcp'],
  'literature': ['lit', 'cx:openalex', 'cx:crossref', 'cx:s2'],
  'expert-knowledge': ['civic-ev', 'civic-search', 'cx:opentargets', 'ols', 'oncotree'],
  'relationships': ['cx:opentargets', 'cx:mygene', 'cx:string', 'cx:reactome', 'cx:dgidb', 'cx:quickgo'],
  'global-coverage': ['tr', 'lit', 'civic-search', 'ols', 'oncotree', 'gdcp'].concat(CX_ENTRIES.filter(function (e) { return e.run; }).map(function (e) { return 'cx:' + e.id; }))
};
// Turn any loader result into { total, items: [{ title, sub, url }] }.
function msNorm(d) {
  if (!d || d.empty) return { empty: true };
  var items = arr(d.items);
  if (!items.length && d.protein) items = [d.protein];
  if (!items.length && d.molecule) items = [{ title: d.molecule.name || d.molecule.id, sub: d.molecule.id + (d.molecule.maxPhase != null ? ' · max phase ' + d.molecule.maxPhase : ''), url: LINK.chembl(d.molecule.id) }].concat(arr(d.mechanisms).map(function (m) { return { title: m.moa || 'Mechanism', sub: m.action || '' }; }));
  if (!items.length && d.reactions) items = arr(d.reactions).map(function (x) { return { title: titleCase(x.term), sub: num(x.count) + ' reports (passive surveillance)' }; });
  if (!items.length && d.concepts) items = arr(d.concepts).map(function (x) { return { title: x.name, sub: 'RxCUI ' + x.rxcui + (x.tty ? ' · ' + x.tty : ''), url: safeUrl('https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=' + encodeURIComponent(x.rxcui)) }; });
  if (!items.length && d.candidates) items = arr(d.candidates).map(function (x) { return x.rec || x; });
  items = items.map(function (x) {
    if (!x) return null;
    if (x.prov && x.title != null) return { title: x.title, url: x.prov.url || null, sub: '' };
    if (x.title != null) return x;
    var title = x.name || x.label || x.symbol || x.term || x.drug || x.gene || x.project || x.id;
    return title ? { title: String(title), sub: x.count != null ? num(x.count) : (x.score != null ? 'score ' + x.score : '') } : null;
  }).filter(Boolean);
  var total = d.total != null ? Number(d.total) : items.length;
  return items.length ? { total: total, items: items.slice(0, 6) } : { empty: true, total: total || 0 };
}
function msJobsFor(mod, ctx) {
  return arr(MS_JOBS[mod]).map(function (spec) {
    var neg = null, id = spec;
    if (spec.charAt(0) === '!') { var p = spec.slice(1).split('|'); neg = p[0]; id = p[1]; }
    var j = MS_JOB_DEFS[id]; if (!j) return null;
    if (neg && ctx && ctx.type === neg) return null;           // free-text fallback only when no typed reading
    if (j.needs && !(ctx && j.needs.indexOf(ctx.type) >= 0)) return null;
    return Object.assign({ id: id }, j);
  }).filter(Boolean);
}
function msRun(mod, text) {
  State.ms = State.ms || {};
  var prev = State.ms[mod]; if (prev && prev.ctrl) { try { prev.ctrl.abort(); } catch (e) { /* ignore */ } }
  var cfg = MOD_SEARCH[mod] || { prefer: [] }, I = interpret(text, detect(text)), pick = null;
  arr(cfg.prefer).some(function (t) { var pc = I.candidates.find(function (x) { return x.entity && x.entity.type === t && x.score >= 50; }); if (pc) pick = pc; return !!pc; });
  var ctx = null;
  if (pick) { try { var e = Object.assign({}, pick.entity); e.raw = text; ctx = buildCtx(e); } catch (x) { ctx = null; } }
  var M = { mod: mod, q: text, ctrl: new AbortController(), ctx: ctx, at: isoNow(), slots: new Map(),
    reading: pick ? { type: typeName(pick), label: pick.normalized, score: pick.score, scoreLabel: pick.scoreLabel } : null,
    best: I.candidates[0] ? { type: typeName(I.candidates[0]), score: I.candidates[0].score, scoreLabel: I.candidates[0].scoreLabel } : null };
  M.jobs = msJobsFor(mod, ctx);
  State.ms[mod] = M;
  M.jobs.forEach(function (j) { if (!j.from) msLoad(M, j, text); });
  announce('Searching ' + M.jobs.length + ' live sources for ' + modMeta(mod).label + '. The common search is unchanged.');
  scheduleRender();
}
function msLoad(M, j, value) {
  if (State.prefs.disabledSources.has(j.src)) { M.slots.set(j.id, { status: 'unavailable', src: j.src, error: mkErr('disabled', j.src) }); return; }
  M.slots.set(j.id, { status: 'loading', src: j.src });
  (async function () {
    try {
      var d = await j.run(M.ctrl.signal, value, M.ctx);
      if (!State.ms || State.ms[M.mod] !== M) return;
      var out = msNorm(d);
      M.slots.set(j.id, { status: out.empty ? 'empty' : 'ok', data: out, src: j.src });
      // Cascades (AlphaFold / EBI Proteins from UniProt, DGIdb from MyGene)
      if (!out.empty && j.pick) { var v = null; try { v = j.pick(d); } catch (x) { v = null; } if (v) M.jobs.forEach(function (k) { if (k.from === j.id) msLoad(M, k, v); }); }
    } catch (e) {
      if (!State.ms || State.ms[M.mod] !== M || (e && e.kind === 'aborted')) return;
      var st = e && e.kind === 'ratelimit' ? 'ratelimited' : (e && (e.kind === 'unavailable' || e.kind === 'linkout' || e.kind === 'disabled' || e.kind === 'verify' || e.kind === 'auth') ? 'unavailable' : 'error');
      M.slots.set(j.id, { status: st, error: e, src: j.src });
    }
    scheduleRender();
    if (M.jobs.every(function (k) { var s = M.slots.get(k.id); return !s || (s.status !== 'loading'); })) announce(modMeta(M.mod).label + ' search finished.');
  })();
}
function msClear(mod) { var M = State.ms && State.ms[mod]; if (M && M.ctrl) { try { M.ctrl.abort(); } catch (e) { /* ignore */ } } if (State.ms) delete State.ms[mod]; scheduleRender(); }
function msClearAll() { if (State.ms) Object.keys(State.ms).forEach(function (k) { var M = State.ms[k]; try { M.ctrl.abort(); } catch (e) { /* ignore */ } }); State.ms = {}; }

function msRow(M, j) {
  var s = M.slots.get(j.id) || { status: 'idle' }, src = SRC[j.src], name = src ? src.displayName : j.src;
  var lo = linkout(j.src, j.from ? '' : M.q);
  var body;
  if (s.status === 'idle') {
    var ps = j.from ? M.slots.get(j.from) : null;
    body = ps && ps.status === 'loading' ? H`<p class="ow-row ow-muted ow-small"><span class="ow-spinner" aria-hidden="true"></span> Waiting for the identifier…</p>` : H`<p class="ow-small ow-muted">No identifier to look up from this query. Use the official source.</p>`;
  } else if (s.status === 'loading') body = H`<p class="ow-row ow-muted ow-small"><span class="ow-spinner" aria-hidden="true"></span> Searching…</p>`;
  else if (s.status === 'ok') body = H`<div class="ow-small">${badge(num(s.data.total) + (s.data.total === 1 ? ' result' : ' results'), 'good')}</div><ul class="ow-cx-list">${s.data.items.map(function (x) { return H`<li>${x.url ? ext(x.url, trunc(x.title, 140)) : trunc(x.title, 140)}${x.sub ? H` <span class="ow-subtle">${trunc(x.sub, 120)}</span>` : ''}</li>`; })}</ul>`;
  else if (s.status === 'empty') body = H`<p class="ow-small ow-muted">No records for this query.</p>`;
  else body = H`<p class="ow-small ow-muted">Not reachable from this browser right now (${friendlyError(s.error).replace(/\.$/, '')}).</p>`;
  return H`<li class="ow-cx-row" data-status="${s.status}"><div class="ow-cx-head"><strong>${name}</strong> <span class="ow-subtle">${j.label}</span></div>${body}${lo ? H`<a class="ow-linkbtn ow-small" href="${lo}" target="_blank" rel="noopener noreferrer">Open ${name}<span class="ow-sr"> (opens in a new tab)</span></a>` : ''}</li>`;
}
function moduleSearchResults(mod) {
  var M = State.ms && State.ms[mod]; if (!M) return '';
  var st = M.jobs.map(function (j) { return (M.slots.get(j.id) || { status: 'idle' }).status; });
  var done = st.filter(function (x) { return x !== 'loading'; }).length, hits = st.filter(function (x) { return x === 'ok'; }).length;
  var recs = M.jobs.reduce(function (a, j) { var s = M.slots.get(j.id); return a + (s && s.status === 'ok' ? Number(s.data.total) || 0 : 0); }, 0);
  var read = M.reading ? H`read in this module as <strong>${M.reading.type}</strong> “${M.reading.label}” ${badge(M.reading.score + ' · ' + M.reading.scoreLabel, scoreKind(M.reading.score))}` : H`searched as <strong>free text</strong> (no ${modMeta(mod).label} reading reached Medium confidence)`;
  return H`<section class="ow-card ow-ms-results" aria-label="${modMeta(mod).label} search results" aria-live="polite">
    <div class="ow-card-head"><div><div class="ow-card-title">${icon('search')} ${modMeta(mod).label} search: “${M.q}”</div>
      <div class="ow-card-sub">Only this module's live sources · ${read} · ${done}/${M.jobs.length} sources answered · ${hits} with records · ${num(recs)} records reported. The common search and other modules are not changed.</div></div>
      <div class="ow-toolbar"><button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="ms-clear" data-mod="${mod}">${icon('x')}Clear this search</button></div></div>
    <ul class="ow-cx-grid">${M.jobs.map(function (j) { return msRow(M, j); })}</ul>
    <p class="ow-subtle">Results are each source's own answer to your text and are not merged or ranked across sources. Not reachable sources keep their official link-out.</p></section>`;
}
