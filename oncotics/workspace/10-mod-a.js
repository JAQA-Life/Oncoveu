
/* ====================================================================
   MODULE 1: OVERVIEW
   ==================================================================== */
var MODULE_INFO = [
  ['overview', 'Overview', 'home', 'Search interpretation with confidence scores, counts, Geographic Activity Globe and Molecular Context Map.'],
  ['clinical-evidence', 'Clinical Evidence', 'evidence', 'CIViC curated evidence items and clinical assertions; OncoKB link-out.'],
  ['trials', 'Trials', 'trial', 'ClinicalTrials.gov search with filters, sorting and full study detail.'],
  ['drug-intelligence', 'Drug Intelligence', 'pill', 'openFDA labels, approvals, safety, enforcement, RxNorm, chemistry and PGx link-outs.'],
  ['vaccines-cancer-immunization', 'Vaccines & Cancer Immunization', 'syringe', 'Preventive and therapeutic cancer vaccines, antigens, trials, labels and official link-outs. No vaccine advice.'],
  ['device-intelligence', 'Devices & Dx', 'device', 'openFDA device authorizations, classification, UDI, MAUDE events, recalls and CDx links.'],
  ['onco-fertility', 'Onco-Fertility', 'seed', 'Survivorship and reproductive-health evidence organizer: labels, AE terms, trials, devices and guideline link-outs. No fertility advice.'],
  ['biology', 'Biology', 'dna', 'Gene, variant, protein, pathways, interactions, structure, cancer genomics, targets, GWAS, expression and GO.'],
  ['literature', 'Literature', 'book', 'Europe PMC search with abstracts, open-access links and citation radar.'],
  ['expert-knowledge', 'Expert Knowledge & Patient Education', 'star', 'OncoKB, OncoLink, AI developer and community resources, labeled by evidentiary status.'],
  ['relationships', 'Relationship Explorer', 'graph', 'Move through genes, variants, evidence, therapies, trials, devices, vaccines and papers.'],
  ['global-coverage', 'Global Coverage', 'globe', 'Worldwide trial, regulatory, device, vaccine, reproductive and imaging sources (live vs link-out).'],
  ['comparison', 'Comparison', 'compare', 'Side-by-side comparison of up to 5 records per type.'],
  ['session-board', 'Session Board', 'board', 'Temporary in-memory research board.'],
  ['advanced-query', 'Advanced Query', 'query', 'Power-user request builder with raw endpoint preview.'],
  ['coverage-console', 'Coverage Console', 'console', 'Live source status, request counts, capability flags and availability checks.'],
  ['session-privacy', 'Session & Privacy', 'lock', 'Privacy model, legal notices, optional keys and session controls.']
];
function modMeta(id) { var m = MODULE_INFO.find(function (x) { return x[0] === id; }); return { id: m[0], label: m[1], icon: m[2], desc: m[3] }; }
function moduleHead(id, extra) {
  var m = modMeta(id);
  return H`<div class="ow-module-head"><div><h2>${m.label}</h2><p>${m.desc}</p></div><div class="ow-toolbar">${extra || ''}</div></div>`;
}
function slotTotal(key, field) { var s = slot(key); if (s.status === 'ok' && s.data) return field ? get(s.data, field) : (s.data.total != null ? s.data.total : arr(s.data.items).length); if (s.status === 'empty') return 0; return null; }
function slotMark(key) { var s = slot(key); return { idle: 'not loaded', loading: 'loading…', error: 'failed', unavailable: 'unavailable', ratelimited: 'rate-limited' }[s.status] || null; }
function statFor(key, label, srcId, field) {
  var n = slotTotal(key, field), mark = slotMark(key);
  return stat(n != null ? n : (mark === 'loading…' ? H`<span class="ow-spinner" aria-label="loading"></span>` : '—'), label, (SRC[srcId] ? SRC[srcId].displayName : '') + (n == null && mark ? ' · ' + mark : ''));
}
function primaryRecord() {
  var c = State.ctx; if (!c) return null;
  var pick = function (k) { var s = slot(k); return s.status === 'ok' && s.data && s.data.items && s.data.items[0]; };
  if (c.type === 'gene') return pick('gene:mygene');
  if (c.type === 'variant' || c.type === 'rsid' || c.type === 'hgvs') return pick('var:myvariant');
  if (c.type === 'drug') return pick('drug:labels') || pick('drug:approvals');
  if (c.type === 'nct') { var t = slot('trial:detail:' + c.nct); return t.data && t.data.trial; }
  if (c.type === 'pmid' || c.type === 'doi') return pick('lit:list');
  if (c.type === 'device') return pick('dev:auth') || pick('dev:class') || pick('dev:udi');
  if (c.type === 'uniprot') { var u = slot('bio:uniprot'); return u.data && u.data.protein; }
  return null;
}
var CORRECT_TYPES = [['gene', 'Gene'], ['variant', 'Variant'], ['drug', 'Drug / biologic'], ['disease', 'Disease / cancer type'], ['device', 'Device / diagnostic'], ['vaccine', 'Vaccine'], ['fertility', 'Onco-Fertility concept'], ['imaging', 'Imaging concept'], ['concept', 'Free-text concept'], ['pmid', 'PMID']];
function welcome() {
  return H`<div class="ow-hero ow-fade">
    <h2>Welcome to the Oncotics Precision Oncology Workspace</h2>
    <p class="ow-muted" style="margin-top:6px;max-width:860px">Start with a gene, variant, drug, device, diagnostic, disease, or trial ID. Oncotics works out what you typed, asks a small set of live public sources first, and loads deeper sources only when you open them.</p>
    <div class="ow-grid-3" style="margin-top:16px">
      <div class="ow-feature"><span class="ow-feature-ico">${icon('shield')}</span><div><h3>Private by design</h3><p class="ow-small ow-muted">Your browser talks directly to each public provider. No Oncotics server, no cookies, no browser storage, no analytics. Refresh or Clear Session wipes everything.</p></div></div>
      <div class="ow-feature"><span class="ow-feature-ico">${icon('flow')}</span><div><h3>Live where verified</h3><p class="ow-small ow-muted">Sources are live only after browser access was verified. Everything else is a clearly labeled official link-out. Every record shows where it came from.</p></div></div>
      <div class="ow-feature"><span class="ow-feature-ico">${icon('device')}</span><div><h3>Devices &amp; diagnostics, carefully</h3><p class="ow-small ow-muted">openFDA device records may lag official FDA databases. Clearance (510(k)/De Novo) is not approval (PMA). IVD, CDx and LDT are kept distinct.</p></div></div>
      <div class="ow-feature"><span class="ow-feature-ico">${icon('search')}</span><div><h3>Every interpretation, scored</h3><p class="ow-small ow-muted">Overview shows all plausible readings of your query with heuristic 0–100 routing scores and the signals behind them. Ambiguous queries wait for your choice.</p></div></div>
      <div class="ow-feature"><span class="ow-feature-ico">${icon('globe')}</span><div><h3>Globe and molecular context</h3><p class="ow-small ow-muted">Public trial and recall locations on a 3D globe (never your location) and a compact map of genes, proteins, drugs, trials and papers, each with provenance.</p></div></div>
      <div class="ow-feature"><span class="ow-feature-ico">${icon('scan')}</span><div><h3>Separate Imaging Workbench</h3><p class="ow-small ow-muted">Images are handled only on a separate OHIF-based page, in browser memory, with explicit consent. <a href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">Open Imaging Workbench</a>.</p></div></div>
    </div>
    <div class="ow-section"><h4>Example searches</h4><div class="ow-row" style="margin-top:8px">${['EGFR', 'BRAF V600E', 'KRAS G12C', 'rs113488022', 'Osimertinib', 'Pembrolizumab', 'Non-Small Cell Lung Cancer', 'NCT02296125', 'HPV vaccine cervical cancer', 'sipuleucel-T', 'mRNA cancer vaccine', 'fertility preservation', 'cyclophosphamide', 'tamoxifen pregnancy', 'pregnancy vaccination influenza', 'embryo culture device FDA 510(k)', 'BRCA1 hereditary cancer fertility planning', 'P170019', 'PD-L1 IHC'].map(function (p) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${p}">${p}</button>`; })}</div></div>
    <div class="ow-section"><h4>Modules</h4><div class="ow-grid" style="margin-top:8px">${MODULE_INFO.map(function (m) { return H`<button type="button" class="ow-card" style="text-align:left;cursor:pointer;font:inherit;color:inherit" data-act="tab" data-mod="${m[0]}"><div class="ow-row">${icon(m[2])}<strong>${m[1]}</strong></div><p class="ow-small ow-muted" style="margin-top:4px">${m[3]}</p></button>`; })}</div></div>
    <div class="ow-disclaimer">Educational and research use only. Not medical advice. Not regulatory or procurement advice. ${SAFETY.phi}</div>
  </div>`;
}
function interpretationCard() {
  var e = State.entity, c = State.ctx;
  var cands = arr(e.candidates);
  var norm = [];
  if (c.gene) norm.push('Gene ' + c.gene);
  if (c.variantName) norm.push('Variant ' + c.variantName);
  if (c.change && c.change.three) norm.push('Protein change p.' + c.change.three);
  if (c.drug) norm.push('Drug ' + c.drug + (c.brand ? ' (brand ' + c.brand + ')' : ''));
  if (c.disease) norm.push('Disease ' + c.disease);
  if (c.deviceId) norm.push(c.deviceId.kind.toUpperCase() + ' ' + c.deviceId.value);
  if (c.geneHint) norm.push('Target hint ' + c.geneHint);
  return H`<div class="ow-card ow-fade">
    <div class="ow-card-head"><div><div class="ow-subtle">Interpreted as</div><div class="ow-row" style="margin-top:4px">${typeBadge(e.type)}<strong class="ow-break" style="font-size:1.1rem">${e.label}</strong>${badge('Confidence: ' + e.confidence, e.confidence === 'High' ? 'good' : e.confidence === 'Medium' ? 'warn' : e.confidence === 'User-selected' ? 'teal' : 'bad')}</div></div>
      <div class="ow-toolbar">${primaryRecord() ? recActions(primaryRecord()) : ''}</div></div>
    <p class="ow-small ow-muted" style="margin-top:6px">${e.reason || ''}${norm.length ? ' · Normalized terms used: ' + norm.join('; ') : ''}</p>
    ${c.alleleChoices ? H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('alert')}<div><strong>This identifier maps to more than one protein change.</strong> Oncotics does not pick one for you. Choose the allele to explore evidence and trials: <span class="ow-row" style="display:inline-flex;margin-top:4px">${c.alleleChoices.map(function (a) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${a}" data-type="variant">${a}</button>`; })}</span></div></div>` : ''}
    ${c.derivedVariant ? H`<p class="ow-subtle" style="margin-top:6px">Protein change ${c.variantName} was derived by Oncotics from ${c.type === 'rsid' || c.genomic ? 'MyVariant.info' : 'Ensembl VEP'} (normalized by Oncotics).</p>` : ''}
    ${e.type === 'ambiguous' ? H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('alert')}<div><strong>This query is ambiguous.</strong> Add a gene symbol or a transcript, or choose how to treat it below. Oncotics does not guess silently.</div></div>` : ''}
    ${e.ambiguous || cands.length > 1 ? H`<div class="ow-notice ow-notice-info" style="margin-top:8px">${icon('info')}<div><strong>Other interpretations:</strong> <span class="ow-row" style="display:inline-flex">${cands.slice(1).map(function (x) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="correct" data-type="${x.type}">${typeBadge(x.type)} ${x.label} · ${x.confidence}</button>`; })}</span></div></div>` : ''}
    <details class="ow-details" style="margin-top:8px"><summary>Was this wrong? Treat the query as…</summary><div class="ow-details-body ow-row">${CORRECT_TYPES.filter(function (t) { return t[0] !== e.type; }).map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="correct" data-type="${t[0]}">${t[1]}</button>`; })}</div></details>
  </div>`;
}
function conflictPanel() {
  var list = detectConflicts();
  if (!list.length) return '';
  return H`<div class="ow-card" style="border-color:var(--ow-warn)"><div class="ow-card-title">${icon('alert')} Source discrepancy</div>
    <p class="ow-small ow-muted">Oncotics shows each source’s statement side by side and does not adjudicate clinical or regulatory status.</p>
    <div class="ow-stack" style="margin-top:8px">${list.map(function (c) { return H`<div class="ow-notice ow-notice-warn"><div><strong>${c.title}</strong><div class="ow-grid-2" style="margin-top:6px">${c.sides.map(function (s) { return H`<div><div class="ow-subtle">${s.source}</div><div>${s.statement}</div>${s.url ? ext(s.url, 'Open source') : ''}</div>`; })}</div></div></div>`; })}</div></div>`;
}
function detectConflicts() {
  var out = [];
  // 1. CIViC evidence pointing in opposite directions for the same disease + therapy.
  var ev = slot('civic:evidence');
  if (ev.status === 'ok') {
    var groups = new Map();
    ev.data.items.forEach(function (r) { var d = r.data; if (!d.disease || !d.therapies.length) return; var k = d.disease.name + ' | ' + d.therapies.map(function (t) { return t.name; }).sort().join(' + ') + ' | ' + (d.molecularProfile.name || ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    groups.forEach(function (list, k) {
      var sens = list.filter(function (r) { return /SENSITIV/.test(r.data.significance) && r.data.direction === 'SUPPORTS'; });
      var res = list.filter(function (r) { return /RESIST/.test(r.data.significance) && r.data.direction === 'SUPPORTS'; });
      if (sens.length && res.length) out.push({ title: 'Sensitivity and resistance evidence for ' + k.replace(/ \| /g, ' · '), sides: [
        { source: 'CIViC ' + sens.map(function (r) { return r.data.name; }).join(', '), statement: 'Supports sensitivity/response (levels ' + uniq(sens.map(function (r) { return r.data.level; })).join(', ') + ')', url: sens[0].prov.url },
        { source: 'CIViC ' + res.map(function (r) { return r.data.name; }).join(', '), statement: 'Supports resistance (levels ' + uniq(res.map(function (r) { return r.data.level; })).join(', ') + ')', url: res[0].prov.url }] });
    });
  }
  // 2. Variant consequence: MyVariant (SnpEff, GRCh37) vs Ensembl VEP (canonical transcript).
  var mv = slot('var:myvariant'), vp = slot('var:vep');
  if (mv.status === 'ok' && vp.status === 'ok' && vp.data.mostSevere) {
    var a = arr(mv.data.items[0].data.consequence).map(function (x) { return String(x).split('&')[0]; });
    if (a.length && a.indexOf(vp.data.mostSevere) < 0) out.push({ title: 'Variant consequence differs between annotation sources (often due to transcript choice)', sides: [
      { source: 'MyVariant.info (SnpEff)', statement: a.join(', '), url: mv.data.items[0].prov.url }, { source: 'Ensembl VEP (most severe)', statement: vp.data.mostSevere, url: vp.data.id ? LINK.ensemblVar(vp.data.id) : '' }] });
  }
  // 3. Device: regulatory verb in text vs pathway.
  var au = slot('dev:auth');
  if (au.status === 'ok') au.data.items.forEach(function (r) {
    var d = r.data, text = String(d.aoStatement || d.summary || '');
    if (d.pathway === '510(k)' && /\bapprov(al|ed)\b/i.test(text)) out.push({ title: d.number + ': record text uses “approval” but the pathway is 510(k) clearance', sides: [{ source: 'openFDA 510(k) record', statement: d.decision.label, url: r.prov.url }, { source: 'Official FDA database', statement: 'Verify the authoritative status', url: LINK.k510(d.number) }] });
    if (d.pathway === 'PMA' && /\bclear(ed|ance)\b/i.test(text)) out.push({ title: d.number + ': record text mentions “clearance” but the pathway is PMA approval', sides: [{ source: 'openFDA PMA record', statement: d.decision.label, url: r.prov.url }, { source: 'Official FDA database', statement: 'Verify the authoritative status', url: LINK.pma(d.number) }] });
  });
  // 4. Same product code, different class/panel across records.
  var cl = slot('dev:class');
  if (cl.status === 'ok') {
    var by = new Map(); cl.data.items.forEach(function (r) { var k = r.data.productCode; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    by.forEach(function (list, k) { var classes = uniq(list.map(function (r) { return r.data.deviceClass + ' / ' + r.data.panel; })); if (classes.length > 1) out.push({ title: 'Product code ' + k + ' reported with different class/panel', sides: list.slice(0, 2).map(function (r) { return { source: 'openFDA classification', statement: r.data.deviceClass + ' / panel ' + r.data.panel, url: r.prov.url }; }) }); });
  }
  // 5. CDx named in the label but not found among device records.
  var cdx = slot('drug:cdx');
  if (cdx.status === 'ok' && cdx.data.sentences.length && !cdx.data.candidates.some(function (c) { return c.confidence !== 'Possible'; })) {
    out.push({ title: 'The drug label refers to a diagnostic test, but no matching device record was found in openFDA', sides: [{ source: 'openFDA drug label', statement: trunc(cdx.data.sentences[0].text, 200), url: '' }, { source: 'FDA companion-diagnostics list (authoritative)', statement: 'Check the official list', url: linkout('fda-cdx', '') }] });
  }
  State.conflicts = out;
  return out;
}
registerModule({
  id: 'overview', label: 'Overview', icon: 'home',
  count: function () { return null; },
  render: function () {
    if (!State.ctx && State.interp) return H`${moduleHead('overview')}${interpretationPanel()}<div class="ow-disclaimer">${SAFETY.overview}</div>`;
    if (!State.ctx) return welcome();
    var c = State.ctx;
    var stats = [];
    var isDrug = c.type === 'drug', isDev = c.type === 'device';
    if (civicScope(c) || slot('civic:evidence').status !== 'idle') stats.push(statFor('civic:evidence', 'CIViC evidence items', 'civic'));
    if (civicScope(c) || slot('civic:assertions').status !== 'idle') stats.push(statFor('civic:assertions', 'CIViC assertions', 'civic'));
    if (c.type !== 'pmid' && c.type !== 'doi') stats.push(c.type === 'nct' ? stat(slot('trial:detail:' + c.nct).status === 'ok' ? 1 : (slot('trial:detail:' + c.nct).status === 'empty' ? 0 : null), 'Trial record', 'ClinicalTrials.gov API v2') : statFor('trials:list', 'Clinical trials', 'ctgov'));
    if (isDrug) stats.push(statFor('drug:labels', 'FDA drug labels', 'openfda-drug'), statFor('drug:approvals', 'FDA approval records', 'openfda-drug'), statFor('drug:events', 'Drug adverse event reports', 'openfda-drug'), statFor('drug:enf', 'Drug enforcement records', 'openfda-drug'));
    if (isDev || slot('dev:auth').status !== 'idle') stats.push(statFor('dev:auth', 'Device authorizations', 'openfda-device', null), statFor('dev:class', 'Device classifications', 'openfda-device'), statFor('dev:udi', 'UDI records', 'openfda-device'), statFor('dev:events', 'Device adverse events (MAUDE)', 'openfda-device'), statFor('dev:recalls', 'Device recalls / enforcement', 'openfda-device'));
    if (c.type === 'gene' || c.gene) stats.push(statFor('gene:mygene', 'Gene annotations', 'mygene'));
    if (c.type === 'variant' || c.type === 'rsid' || c.type === 'hgvs') stats.push(statFor('var:myvariant', 'Variant annotations', 'myvariant'));
    if (slot('bio:uniprot').status !== 'idle') stats.push(stat(slot('bio:uniprot').status === 'ok' ? 1 : (slot('bio:uniprot').status === 'empty' ? 0 : null), 'Protein records', 'UniProt'));
    if (slot('bio:reactome').status !== 'idle') stats.push(statFor('bio:reactome', 'Pathways', 'reactome'));
    if (slot('bio:string').status !== 'idle') stats.push(statFor('bio:string', 'Interaction partners', 'string'));
    stats.push(statFor('lit:list', 'Literature records', 'europepmc'));

    var dist = [];
    var tr = slot('trials:list');
    if (tr.status === 'ok') {
      dist.push(H`<div class="ow-card"><div class="ow-card-title">Trial status (this page)</div>${bars(countBy(tr.data.items, function (r) { return humanEnum(r.data.status); }), { label: 'Trial status distribution' })}</div>`);
      dist.push(H`<div class="ow-card"><div class="ow-card-title">Trial phase (this page)</div>${bars(countBy(tr.data.items, function (r) { return r.data.phases.length ? r.data.phases.map(function (p) { return String(p).replace(/^PHASE/, 'Phase ').replace('EARLY_Phase 1', 'Early Phase 1'); }) : 'Not reported'; }), { label: 'Trial phase distribution', color: 'var(--ow-variant)' })}</div>`);
    }
    var ev = slot('civic:evidence');
    if (ev.status === 'ok') dist.push(H`<div class="ow-card"><div class="ow-card-title">Evidence level (this page)</div>${bars(countBy(ev.data.items, function (r) { return 'Level ' + r.data.level; }).sort(), { label: 'Evidence level distribution', color: 'var(--ow-good)' })}</div>`);
    var au = slot('dev:auth');
    if (au.status === 'ok') {
      dist.push(H`<div class="ow-card"><div class="ow-card-title">Device authorization type</div>${bars(countBy(au.data.items, function (r) { return r.data.pathway === 'PMA' ? 'Approval (PMA)' : r.data.pathway === 'De Novo' ? 'De Novo classification' : 'Clearance (510(k))'; }), { label: 'Clearance vs approval', color: 'var(--ow-device)' })}</div>`);
      dist.push(H`<div class="ow-card"><div class="ow-card-title">Device class</div>${bars(countBy(au.data.items, function (r) { return r.data.deviceClass || 'Not reported'; }), { label: 'Device class distribution', color: 'var(--ow-device)' })}</div>`);
    }
    var rc = slot('dev:recalls');
    if (rc.status === 'ok') dist.push(H`<div class="ow-card"><div class="ow-card-title">Recall classification</div>${bars(countBy(rc.data.items, function (r) { return r.data.classification || 'Not reported'; }), { label: 'Recall classification', color: 'var(--ow-bad)' })}</div>`);
    var dv = slot('dev:events');
    if (dv.status === 'ok' && dv.data.byType) dist.push(H`<div class="ow-card"><div class="ow-card-title">MAUDE report type (all matching)</div>${bars(dv.data.byType.map(function (x) { return [x.term, x.count]; }), { label: 'MAUDE report type', color: 'var(--ow-warn)' })}</div>`);
    var lit = slot('lit:list');
    if (lit.status === 'ok') dist.push(H`<div class="ow-card"><div class="ow-card-title">Publication year (this page)</div>${bars(countBy(lit.data.items, function (r) { return r.data.year; }).sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); }), { label: 'Literature year distribution', color: 'var(--ow-lit)' })}</div>`);

    var tops = [];
    var topOf = function (key) { var s = slot(key); return s.status === 'ok' && s.data.items && s.data.items[0]; };
    var te = topOf('civic:evidence'); if (te) tops.push(['Top evidence item', te]);
    if (ev.status === 'ok') {
      var th = countBy(ev.data.items, function (r) { return r.data.therapies.map(function (t) { return t.name; }); }).filter(function (x) { return x[0] !== 'Not reported'; })[0];
      var dz = countBy(ev.data.items, function (r) { return r.data.disease ? r.data.disease.name : null; }).filter(function (x) { return x[0] !== 'Not reported'; })[0];
      if (th) tops.push(['Most frequent therapy in evidence', { title: th[0] + ' (' + th[1] + ' items on this page)', term: th[0], asType: 'drug' }]);
      if (dz) tops.push(['Most frequent disease in evidence', { title: dz[0] + ' (' + dz[1] + ' items on this page)', term: dz[0], asType: 'disease' }]);
    }
    var tt = topOf('trials:list'); if (tt) tops.push(['Top trial (by current sort)', tt]);
    var tl = topOf('drug:labels'); if (tl) tops.push(['Top FDA label match', tl]);
    var td = topOf('dev:auth'); if (td) tops.push(['Most recent device authorization', td]);
    var tp = topOf('lit:list'); if (tp) tops.push(['Top paper (relevance)', tp]);

    var used = uniq(Array.from(State.slots.values()).map(function (s) { return s.src; }).filter(Boolean));
    return H`${moduleHead('overview', H`<button type="button" class="ow-btn ow-btn-sm" data-act="export-json">${icon('download')}Export overview</button><button type="button" class="ow-btn ow-btn-sm" data-act="print">${icon('print')}Print</button>`)}
      ${interpretationPanel()}
      ${imagingContextCard()}
      ${cancerTypeCard()}
      ${partialFailure() ? H`<div class="ow-notice ow-notice-warn" style="margin-top:12px">${icon('alert')}<div><strong>Partial results.</strong> Some sources could not be loaded. Other sources are still shown. <button type="button" class="ow-linkbtn" data-act="retry">Retry failed requests</button></div></div>` : ''}
      ${c.ldt ? H`<div class="ow-notice ow-notice-warn" style="margin-top:12px">${icon('alert')}<div>${SAFETY.ldt} ${ext(linkout('fda-cdx', ''), 'FDA companion-diagnostics list')}</div></div>` : ''}
      <div class="ow-section">${conflictPanel()}</div>
      <div class="ow-section"><h3 style="margin-bottom:8px">Records by source</h3><div class="ow-stat-grid">${stats}</div></div>
      <div class="ow-section"><h3 style="margin-bottom:8px">Counts by module</h3><div class="ow-modcounts">${moduleCounts().map(function (m) { var mm = MOD[m[0]] ? modMeta(m[0]) : null; return H`<button type="button" class="ow-modcount" data-act="tab" data-mod="${m[0]}"><span class="ow-modcount-n">${m[2] == null ? '—' : (typeof m[2] === 'number' ? num(m[2]) : m[2])}</span><span class="ow-modcount-l">${mm ? icon(mm.icon) : ''}${m[1]}</span></button>`; })}</div><p class="ow-subtle" style="margin-top:4px">“—” means not loaded yet; deeper modules load when you open them.</p></div>
      <div class="ow-section ow-ov-visuals">${safeRender(globePanel, 'Geographic Activity Globe')}${safeRender(molMapPanel, 'Molecular Context Map')}</div>
      ${tops.length ? H`<div class="ow-section"><h3 style="margin-bottom:8px">Top matches</h3><div class="ow-grid">${tops.map(function (t) {
        var r = t[1];
        return H`<div class="ow-card"><div class="ow-subtle">${t[0]}</div><div class="ow-card-title" style="margin-top:4px">${r.key ? H`<button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${trunc(r.title, 140)}</button>` : r.title}</div>${r.term ? H`<div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${r.term}" data-type="${r.asType}">Explore ${r.asType}</button></div>` : ''}</div>`;
      })}</div></div>` : ''}
      ${dist.length ? H`<div class="ow-section"><h3 style="margin-bottom:8px">Distributions</h3><div class="ow-grid">${dist}</div></div>` : ''}
      <div class="ow-section"><h3 style="margin-bottom:8px">Quick actions</h3><div class="ow-row">
        ${['clinical-evidence', 'trials', 'drug-intelligence', 'device-intelligence', 'vaccines-cancer-immunization', 'onco-fertility', 'biology', 'literature', 'expert-knowledge', 'relationships'].map(function (id) { var m = modMeta(id); return H`<button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="${id}">${icon(m.icon)}Open ${m.label}</button>`; })}
        ${c.gene ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="gene-dx" data-gene="${c.gene}">${icon('device')}Find diagnostics that detect ${c.gene}</button>` : ''}
        ${c.type === 'imaging' || /imaging|mri|\bct\b|pet|radiol/i.test(c.label || '') ? H`<a class="ow-btn ow-btn-sm" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">${icon('scan')}Open Imaging Workbench<span class="ow-sr"> (opens a separate page)</span></a>` : ''}
        ${primaryRecord() ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="pin" data-key="${primaryRecord().key}">${icon('pin')}Add to Session Board</button><button type="button" class="ow-btn ow-btn-sm" data-act="compare" data-key="${primaryRecord().key}">${icon('compare')}Compare</button>` : ''}
        <button type="button" class="ow-btn ow-btn-sm" data-act="export-json">${icon('download')}Export current in-memory results</button>
      </div></div>
      <div class="ow-section"><h3 style="margin-bottom:8px">Source availability for this query</h3><div class="ow-row">${used.map(function (id) { var r = Runtime[id]; return badge(SRC[id].displayName + ': ' + r.mode, r.mode === 'live' ? 'good' : r.mode === 'unavailable' ? 'bad' : 'warn'); })}</div></div>
      <div class="ow-disclaimer">${SAFETY.overview}</div>`;
  },
  exportData: function () { return { interpretation: interpExport(), counts: overviewCounts(), moduleCounts: moduleCounts().map(function (m) { return { module: m[1], count: m[2] }; }), conflicts: State.conflicts, globeLocations: globeExportRows().rows.length, molecularContext: State.ctx ? molMapExport() : null }; }
});
function overviewCounts() {
  var o = {}; State.slots.forEach(function (s, k) { if (s.status === 'ok' || s.status === 'empty') o[k] = s.data && s.data.total != null ? s.data.total : (s.data && s.data.items ? s.data.items.length : 0); else o[k] = s.status; }); return o;
}

/* ====================================================================
   MODULE 2: CLINICAL EVIDENCE (CIViC)
   ==================================================================== */
var EV_TYPES = ['PREDICTIVE', 'DIAGNOSTIC', 'PROGNOSTIC', 'PREDISPOSING', 'ONCOGENIC', 'FUNCTIONAL'];
var EV_SIGS = ['SENSITIVITYRESPONSE', 'RESISTANCE', 'REDUCED_SENSITIVITY', 'ADVERSE_RESPONSE', 'BETTER_OUTCOME', 'POOR_OUTCOME', 'POSITIVE', 'NEGATIVE', 'PATHOGENIC', 'LIKELY_PATHOGENIC', 'UNCERTAIN_SIGNIFICANCE', 'PREDISPOSITION', 'ONCOGENICITY', 'LIKELY_ONCOGENIC', 'GAIN_OF_FUNCTION', 'LOSS_OF_FUNCTION'];
function evidenceFilters() { var f = ui('evidence'); f.filters = f.filters || { st: 'ACCEPTED', sortCol: 'EVIDENCE_LEVEL', sortDir: 'ASC', pageSize: 25 }; return f.filters; }
function loadEvidence(after) {
  var f = evidenceFilters(), u = ui('evidence');
  var scope = civicScope(State.ctx) || {};
  if (!scope.mp && !scope.th && !scope.dz && !f.th && !f.dz) { State.slots.set('civic:evidence', { status: 'empty', data: { empty: true, noScope: true } }); scheduleRender(); return; }
  return load('civic:evidence', 'civic', function (sig) { return Loaders.civicEvidence(sig, scope, f, after); }, { force: true });
}
function sel(id, label, options, value) {
  return H`<div class="ow-field"><label class="ow-label" for="${id}">${label}</label><select class="ow-select" id="${id}" name="${id}">${options.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : humanEnum(o); return H`<option value="${v}" ${String(value || '') === String(v) ? raw('selected') : ''}>${l}</option>`; })}</select></div>`;
}
function txt(id, label, value, ph) { return H`<div class="ow-field"><label class="ow-label" for="${id}">${label}</label><input class="ow-input" id="${id}" name="${id}" value="${value || ''}" placeholder="${ph || ''}" maxlength="80" autocomplete="off"></div>`; }
function evidenceCard(r) {
  var d = r.data;
  return H`<article class="ow-card ow-fade">
    <div class="ow-card-head"><div style="min-width:0"><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${d.name}</button> · ${d.molecularProfile.name || 'Molecular profile not reported'}</div>
      <div class="ow-card-sub">${d.disease ? d.disease.name : 'Disease not reported'}${d.therapies.length ? ' · ' + d.therapies.map(function (t) { return t.name; }).join(' + ') : ''}</div></div>
      <div class="ow-badges">${levelBadge(d.level)}${badge(humanEnum(d.type), 'protein')}${sigBadge(d.significance)}${badge(humanEnum(d.direction), 'outline')}${d.status !== 'ACCEPTED' ? badge(humanEnum(d.status), 'warn') : ''}${d.rating ? badge('Rating ' + d.rating + '/5', 'outline') : ''}</div></div>
    <div class="ow-card-body">${more('ev' + d.id, d.description, 280)}</div>
    <div class="ow-card-foot">${recActions(r)}${d.source && d.source.citationId && d.source.sourceType === 'PUBMED' ? ext(LINK.pubmed(d.source.citationId), (d.source.citation || 'PubMed') + ' (PMID ' + d.source.citationId + ')') : (d.source ? H`<span class="ow-subtle">${d.source.citation || ''}</span>` : '')}${d.therapies.length ? d.therapies.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="search-as" data-term="${t.name}" data-type="drug">${icon('pill')}${t.name}</button>`; }) : ''}</div>
    ${provView(r.prov)}
  </article>`;
}
function assertionCard(r) {
  var d = r.data;
  return H`<article class="ow-card"><div class="ow-card-head"><div style="min-width:0"><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${d.name}</button> · ${d.molecularProfile.name || ''}</div><div class="ow-card-sub">${d.disease ? d.disease.name : ''}${d.therapies.length ? ' · ' + d.therapies.map(function (t) { return t.name; }).join(' + ') : ''}</div></div>
    <div class="ow-badges">${d.amp ? badge('AMP/ASCO/CAP ' + humanEnum(d.amp).replace('Tier I Level', 'Tier I · Level').replace('Tier Ii Level', 'Tier II · Level').replace('Tier Iii', 'Tier III').replace('Tier Iv', 'Tier IV'), /TIER_I_/.test(d.amp) ? 'good' : 'variant') : ''}${badge(humanEnum(d.type), 'protein')}${sigBadge(d.significance)}${badge(humanEnum(d.status), d.status === 'ACCEPTED' ? 'good' : 'warn')}${d.nccn ? badge('NCCN: ' + d.nccn + (d.nccnVersion ? ' v' + d.nccnVersion : ''), 'teal') : ''}</div></div>
    <div class="ow-card-body">${d.summary || nr()}</div><div class="ow-card-foot">${recActions(r)}</div>${provView(r.prov)}</article>`;
}
registerModule({
  id: 'clinical-evidence', label: 'Clinical Evidence', icon: 'evidence',
  count: function () { return slotTotal('civic:evidence'); },
  onOpen: function () { if (State.ctx && slot('civic:evidence').status === 'idle') loadEvidence(); if (State.ctx && slot('civic:assertions').status === 'idle' && civicScope(State.ctx)) load('civic:assertions', 'civic', function (s) { return Loaders.civicAssertions(s, civicScope(State.ctx)); }); },
  render: function () {
    if (!State.ctx) return H`${moduleHead('clinical-evidence')}${noQuery('clinical evidence')}`;
    var f = evidenceFilters(), u = ui('evidence');
    var view = u.view || 'cards';
    var scope = civicScope(State.ctx);
    var filters = H`<form class="ow-filters" data-submit="evidence-filters">
      ${sel('ev-et', 'Evidence type', [['', 'Any']].concat(EV_TYPES), f.et)}
      ${sel('ev-sg', 'Clinical significance', [['', 'Any']].concat(EV_SIGS.map(function (s) { return [s, humanEnum(s.replace('SENSITIVITYRESPONSE', 'SENSITIVITY_RESPONSE'))]; })), f.sg)}
      ${sel('ev-lv', 'Evidence level', [['', 'Any'], ['A', 'A — Validated'], ['B', 'B — Clinical'], ['C', 'C — Case study'], ['D', 'D — Preclinical'], ['E', 'E — Inferential']], f.lv)}
      ${sel('ev-st', 'Status', [['ACCEPTED', 'Accepted'], ['SUBMITTED', 'Submitted'], ['NON_REJECTED', 'Accepted + submitted'], ['ALL', 'All (incl. rejected)']], f.st)}
      ${txt('ev-th', 'Therapy contains', f.th, 'e.g. Osimertinib')}
      ${txt('ev-dz', 'Disease contains', f.dz, 'e.g. Melanoma')}
      ${txt('ev-ds', 'Description keyword', f.ds, 'e.g. phase 3')}
      ${sel('ev-sort', 'Sort', [['EVIDENCE_LEVEL|ASC', 'Evidence level (A first)'], ['EVIDENCE_RATING|DESC', 'Rating (high first)'], ['ID|DESC', 'Newest ID first'], ['DISEASE_NAME|ASC', 'Disease A–Z'], ['SIGNIFICANCE|ASC', 'Significance']], (f.sortCol || 'EVIDENCE_LEVEL') + '|' + (f.sortDir || 'ASC'))}
      ${sel('ev-ps', 'Page size', [['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']], String(f.pageSize || 25))}
      <div class="ow-row"><button type="submit" class="ow-btn ow-btn-primary ow-btn-sm">${icon('filter')}Apply</button><button type="button" class="ow-btn ow-btn-sm" data-act="evidence-reset">Reset</button></div>
    </form>`;
    var s = slot('civic:evidence');
    var list = slotView('civic:evidence', {
      linkout: [{ url: linkout('civic', State.ctx.label), label: 'Search CIViC' }],
      empty: function (d) { return d && d.noScope ? H`<div class="ow-empty"><h3>CIViC is organized by gene, variant, therapy and disease</h3><p>Search one of those, or enter a therapy or disease in the filters above.</p>${State.ctx.alleleChoices ? H`<p>This identifier maps to several protein changes: ${State.ctx.alleleChoices.map(function (a) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${a}" data-type="variant">${a}</button> `; })}</p>` : ''}${extBtn(linkout('civic', State.ctx.label), 'Search CIViC')}</div>` : H`<div class="ow-empty"><h3>No CIViC evidence for this query and filter</h3><p>Try Status “Accepted + submitted”, remove filters, or search a gene symbol.</p>${extBtn(linkout('civic', State.ctx.label), 'Search CIViC')}</div>`; },
      render: function (d) {
        var pageIdx = (u.cursors || []).length;
        return H`${view === 'table' ? table([
          { label: 'EID', render: function (r) { return H`<button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${r.data.name}</button>`; } },
          { label: 'Molecular profile', render: function (r) { return r.data.molecularProfile.name; } },
          { label: 'Disease', render: function (r) { return r.data.disease ? r.data.disease.name : nr(); } },
          { label: 'Therapies', render: function (r) { return r.data.therapies.map(function (t) { return t.name; }).join(' + ') || '—'; } },
          { label: 'Type', render: function (r) { return humanEnum(r.data.type); } },
          { label: 'Significance', render: function (r) { return sigBadge(r.data.significance); } },
          { label: 'Level', render: function (r) { return levelBadge(r.data.level); } },
          { label: 'Source', render: function (r) { return r.data.source ? (r.data.source.citation || '') + (r.data.source.citationId ? ' (' + r.data.source.citationId + ')' : '') : ''; } }
        ], d.items, 'CIViC evidence items (' + num(d.total) + ' total)') : H`<div class="ow-stack">${d.items.map(evidenceCard)}</div>`}
        ${pager('evidence', { page: pageIdx, hasPrev: pageIdx > 0, hasNext: !!(d.pageInfo && d.pageInfo.hasNextPage), total: d.total, pageSize: f.pageSize || 25, label: 'evidence items' })}`;
      }
    });
    var as = scope ? slotView('civic:assertions', { skeleton: 1, emptyMsg: 'No CIViC clinical assertions for this query.', render: function (d) { return H`<div class="ow-stack">${d.items.slice(0, ui('evidence').allAssertions ? 50 : 4).map(assertionCard)}</div>${d.items.length > 4 && !ui('evidence').allAssertions ? H`<button type="button" class="ow-btn ow-btn-sm" style="margin-top:8px" data-act="evidence-all-assertions">Show all ${d.items.length} assertions</button>` : ''}`; } }) : '';
    return H`${moduleHead('clinical-evidence', H`${viewToggle('evidence')}${extBtn(linkout('civic', State.ctx.label), 'Open CIViC')}`)}
      <div class="ow-disclaimer">${SAFETY.evidence}</div>
      ${scope ? H`<p class="ow-subtle">Scope: ${scope.mp ? 'molecular profiles containing “' + scope.mp + '”' : scope.th ? 'therapy “' + scope.th + '”' : 'disease “' + scope.dz + '”'} (CIViC name matching).</p>` : ''}
      ${scope ? H`<div class="ow-section">${sectionHead('Clinical assertions', ['civic'])}${as}</div>` : ''}
      <div class="ow-section">${sectionHead('Evidence items', ['civic'], s.status === 'ok' ? badge(num(s.data.total) + ' total', 'teal') : '')}
        ${det('ev-filters', H`${icon('filter')} Filters and sorting`, filters, false)}
        <div style="margin-top:10px">${list}</div></div>
      <div class="ow-section">${conflictPanel()}</div>`;
  },
  exportRows: function () {
    var s = slot('civic:evidence'); if (s.status !== 'ok') return null;
    return { name: 'evidence', rows: s.data.items, cols: [
      { label: 'EID', get: function (r) { return r.data.name; } }, { label: 'Molecular profile', get: function (r) { return r.data.molecularProfile.name; } }, { label: 'Disease', get: function (r) { return r.data.disease && r.data.disease.name; } },
      { label: 'Therapies', get: function (r) { return r.data.therapies.map(function (t) { return t.name; }).join(' + '); } }, { label: 'Type', get: function (r) { return r.data.type; } }, { label: 'Direction', get: function (r) { return r.data.direction; } },
      { label: 'Significance', get: function (r) { return r.data.significance; } }, { label: 'Level', get: function (r) { return r.data.level; } }, { label: 'Status', get: function (r) { return r.data.status; } },
      { label: 'Citation', get: function (r) { return r.data.source && r.data.source.citation; } }, { label: 'PMID', get: function (r) { return r.data.source && r.data.source.citationId; } }, { label: 'CIViC URL', get: function (r) { return r.prov.url; } }] };
  }
});
DETAIL.evidence = function (r) {
  var d = r.data;
  return H`<div class="ow-badges">${levelBadge(d.level)}${badge(humanEnum(d.type), 'protein')}${sigBadge(d.significance)}${badge(humanEnum(d.direction), 'outline')}${badge(humanEnum(d.status), d.status === 'ACCEPTED' ? 'good' : 'warn')}${d.origin ? badge(humanEnum(d.origin) + ' origin', 'outline') : ''}</div>
    <div class="ow-section"><p class="ow-pre">${d.description || 'Not reported by source'}</p></div>
    <dl class="ow-kv ow-section"><dt>Molecular profile</dt><dd>${d.molecularProfile.name ? ext(LINK.civic(d.molecularProfile.link), d.molecularProfile.name) : nr()}</dd>
      <dt>Disease</dt><dd>${d.disease ? H`${ext(LINK.civic(d.disease.link), d.disease.name)}${d.disease.doid ? H` <span class="ow-subtle">DOID:${d.disease.doid}</span>` : ''}` : nr()}</dd>
      <dt>Therapies</dt><dd>${d.therapies.length ? d.therapies.map(function (t) { return H`<div>${ext(LINK.civic(t.link), t.name)} ${t.ncitId ? H`<span class="ow-subtle">NCIt ${t.ncitId}</span>` : ''} <button type="button" class="ow-linkbtn ow-small" data-act="search-as" data-term="${t.name}" data-type="drug">Drug intelligence</button></div>`; }) : 'None (not a predictive item or not reported)'}</dd>
      <dt>Evidence rating</dt><dd>${d.rating ? d.rating + ' / 5' : nr()}</dd>
      <dt>Source</dt><dd>${d.source ? H`${d.source.citation || ''} ${d.source.sourceType === 'PUBMED' && d.source.citationId ? ext(LINK.pubmed(d.source.citationId), 'PMID ' + d.source.citationId) : H`<span class="ow-mono">${d.source.citationId || ''}</span>`} ${ext(LINK.civic(d.source.link), 'CIViC source')}` : nr()}</dd></dl>
    <div class="ow-disclaimer">${SAFETY.evidence}</div>${provView(r.prov)}`;
};
DETAIL.assertion = function (r) {
  var d = r.data;
  return H`<div class="ow-badges">${d.amp ? badge('AMP/ASCO/CAP ' + humanEnum(d.amp), 'good') : ''}${badge(humanEnum(d.type), 'protein')}${sigBadge(d.significance)}${badge(humanEnum(d.status), d.status === 'ACCEPTED' ? 'good' : 'warn')}</div>
    <div class="ow-section"><p>${d.summary || nr()}</p></div>
    <dl class="ow-kv ow-section"><dt>Molecular profile</dt><dd>${d.molecularProfile.name || nr()}</dd><dt>Disease</dt><dd>${d.disease ? d.disease.name : nr()}</dd>
      <dt>Therapies</dt><dd>${d.therapies.map(function (t) { return t.name; }).join(' + ') || '—'}</dd><dt>NCCN guideline</dt><dd>${d.nccn ? d.nccn + (d.nccnVersion ? ' (version ' + d.nccnVersion + ')' : '') : 'Not reported by source'}</dd></dl>
    <div class="ow-disclaimer">${SAFETY.evidence}</div>${provView(r.prov)}`;
};

/* ====================================================================
   MODULE 3: TRIALS (ClinicalTrials.gov v2)
   ==================================================================== */
var CT_STATUSES = ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'SUSPENDED', 'TERMINATED', 'WITHDRAWN', 'UNKNOWN'];
function trialFilters() { var u = ui('trials'); u.filters = u.filters || { sort: '@relevance', pageSize: 10, status: [] }; return u.filters; }
function loadTrials(pageToken) {
  var f = Object.assign({}, trialFilters(), { pageToken: pageToken || null });
  return load('trials:list', 'ctgov', function (sig) { return Loaders.trials(sig, State.ctx, f); }, { force: true });
}
function interventionRoute(i) {
  var t = String(i.type || '').toUpperCase();
  if (t === 'DRUG' || t === 'BIOLOGICAL' || t === 'COMBINATION_PRODUCT') return H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="search-as" data-term="${i.name}" data-type="drug">${icon('pill')}FDA drug intelligence</button>`;
  if (t === 'DEVICE' || t === 'DIAGNOSTIC_TEST') return H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="search-as" data-term="${i.name}" data-type="device">${icon('device')}Devices &amp; Dx</button>`;
  return H`<span class="ow-subtle">FDA drug label lookup may not apply to this intervention type.</span>`;
}
function trialCard(r) {
  var d = r.data;
  return H`<article class="ow-card ow-fade">
    <div class="ow-card-head"><div style="min-width:0"><div class="ow-row"><span class="ow-mono ow-small">${d.nct}</span>${d.acronym ? badge(d.acronym, 'outline') : ''}</div>
      <div class="ow-card-title" style="margin-top:2px"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${d.briefTitle || d.officialTitle || 'Title not reported'}</button></div>
      <div class="ow-card-sub">${d.sponsor || 'Sponsor not reported'}</div></div>
      <div class="ow-badges">${statusBadge(d.status)}${phaseBadges(d.phases)}${d.studyType ? badge(humanEnum(d.studyType), 'outline') : ''}</div></div>
    <dl class="ow-kv ow-card-body"><dt>Conditions</dt><dd>${d.conditions.slice(0, 6).join('; ') || nr()}${d.conditions.length > 6 ? ' +' + (d.conditions.length - 6) + ' more' : ''}</dd>
      <dt>Interventions</dt><dd>${d.interventions.length ? d.interventions.slice(0, 6).map(function (i) { return H`<div>${badge(humanEnum(i.type), 'outline')} ${i.name}</div>`; }) : nr()}</dd>
      <dt>Locations</dt><dd>${d.siteCount ? num(d.siteCount) + ' site' + (d.siteCount > 1 ? 's' : '') + ' · ' + d.countries.slice(0, 6).join(', ') + (d.countries.length > 6 ? ' +' + (d.countries.length - 6) : '') : nr()}</dd>
      <dt>Dates</dt><dd>Start ${d.start || '—'} · Primary completion ${d.primaryCompletion || '—'} · Completion ${d.completion || '—'}</dd>
      <dt>Enrollment</dt><dd>${d.enrollment != null ? num(d.enrollment) + (d.enrollmentType ? ' (' + humanEnum(d.enrollmentType) + ')' : '') : nr()} · Last updated ${d.lastUpdate || '—'}</dd></dl>
    <div class="ow-card-foot">${recActions(r)}${extBtn(LINK.ctStudy(d.nct), 'Open on ClinicalTrials.gov')}${uniq(d.interventions.map(function (i) { return i.type; })).length ? interventionRoute(d.interventions.find(function (i) { return /DRUG|BIOLOGICAL|DEVICE|DIAGNOSTIC|COMBINATION/.test(i.type); }) || d.interventions[0]) : ''}</div>
    ${provView(r.prov)}
  </article>`;
}
function trialDetailBody(nct) {
  var key = 'trial:detail:' + nct;
  if (slot(key).status === 'idle') load(key, 'ctgov', function (sig) { return Loaders.trial(sig, nct); });
  return slotView(key, {
    skeleton: 3, linkout: [{ url: LINK.ctStudy(nct), label: 'Open on ClinicalTrials.gov' }],
    empty: function () { return H`<div class="ow-empty"><h3>${nct} was not found on ClinicalTrials.gov</h3><p>Check the identifier. Trials registered elsewhere can be searched from Global Coverage.</p>${extBtn(linkout('ctgov', nct), 'Search ClinicalTrials.gov')}${extBtn(linkout('pubmed', nct), 'Search PubMed')}</div>`; },
    render: function (d) { return trialFull(d.trial); }
  });
}
function trialFull(rec) {
  var s = rec.data.full || {}, p = s.protocolSection || {};
  var id = p.identificationModule || {}, st = p.statusModule || {}, sp = p.sponsorCollaboratorsModule || {}, ov = p.oversightModule || {}, de = p.descriptionModule || {}, co = p.conditionsModule || {};
  var ds = p.designModule || {}, ai = p.armsInterventionsModule || {}, om = p.outcomesModule || {}, el = p.eligibilityModule || {}, cl = p.contactsLocationsModule || {}, rf = p.referencesModule || {}, ipd = p.ipdSharingStatementModule || {};
  var d = rec.data;
  var locs = arr(cl.locations);
  var byCountry = new Map(); locs.forEach(function (l) { var k = l.country || 'Country not reported'; if (!byCountry.has(k)) byCountry.set(k, []); byCountry.get(k).push(l); });
  var outcomes = function (list, kind) { return arr(list).map(function (o) { return H`<li><strong>${kind}:</strong> ${o.measure || ''}${o.timeFrame ? H` <span class="ow-subtle">(Time frame: ${o.timeFrame})</span>` : ''}${o.description ? H`<div class="ow-small ow-muted">${trunc(o.description, 500)}</div>` : ''}</li>`; }); };
  var k = 'tr-' + d.nct;
  return H`<div class="ow-badges">${statusBadge(d.status)}${phaseBadges(d.phases)}${d.studyType ? badge(humanEnum(d.studyType), 'outline') : ''}${s.hasResults ? badge('Results posted', 'good') : ''}</div>
    <p class="ow-small ow-muted" style="margin-top:6px">${d.officialTitle || ''}</p>
    <div class="ow-notice ow-notice-info" style="margin-top:10px">${icon('info')}<div>${SAFETY.trials}</div></div>
    <div class="ow-card-foot">${extBtn(LINK.ctStudy(d.nct), 'Official study page', { primary: true })}<button type="button" class="ow-btn ow-btn-sm" data-act="compare" data-key="${rec.key}">${icon('compare')}Compare</button><button type="button" class="ow-btn ow-btn-sm" data-act="pin" data-key="${rec.key}">${icon('pin')}Board</button></div>
    <div class="ow-section">
    ${det(k + '-ov', 'Overview', H`<dl class="ow-kv"><dt>NCT ID</dt><dd class="ow-mono">${d.nct}</dd><dt>Acronym</dt><dd>${orNR(id.acronym)}</dd><dt>Brief summary</dt><dd>${more(k + 'bs', de.briefSummary || '', 600)}</dd>
      ${de.detailedDescription ? H`<dt>Detailed description</dt><dd>${more(k + 'dd', de.detailedDescription, 400)}</dd>` : ''}
      <dt>Conditions</dt><dd>${arr(co.conditions).join('; ') || nr()}</dd><dt>Keywords</dt><dd>${arr(co.keywords).join('; ') || nr()}</dd>
      <dt>Start</dt><dd>${orNR(get(st, 'startDateStruct.date'))}</dd><dt>Primary completion</dt><dd>${orNR(get(st, 'primaryCompletionDateStruct.date'))}</dd><dt>Completion</dt><dd>${orNR(get(st, 'completionDateStruct.date'))}</dd>
      <dt>Last update posted</dt><dd>${orNR(get(st, 'lastUpdatePostDateStruct.date'))}</dd><dt>Enrollment</dt><dd>${d.enrollment != null ? num(d.enrollment) + (d.enrollmentType ? ' (' + humanEnum(d.enrollmentType) + ')' : '') : nr()}</dd>
      <dt>Lead sponsor</dt><dd>${orNR(get(sp, 'leadSponsor.name'))}</dd><dt>Collaborators</dt><dd>${arr(sp.collaborators).map(function (c) { return c.name; }).join('; ') || nr()}</dd>
      <dt>Responsible party</dt><dd>${get(sp, 'responsibleParty.type') ? humanEnum(get(sp, 'responsibleParty.type')) + (get(sp, 'responsibleParty.investigatorFullName') ? ' — ' + get(sp, 'responsibleParty.investigatorFullName') : '') : nr()}</dd>
      <dt>FDA-regulated</dt><dd>Drug: ${ov.isFdaRegulatedDrug == null ? '—' : ov.isFdaRegulatedDrug ? 'Yes' : 'No'} · Device: ${ov.isFdaRegulatedDevice == null ? '—' : ov.isFdaRegulatedDevice ? 'Yes' : 'No'}${ov.oversightHasDmc != null ? ' · DMC: ' + (ov.oversightHasDmc ? 'Yes' : 'No') : ''}</dd></dl>`, true)}
    ${det(k + '-de', 'Design', H`<dl class="ow-kv"><dt>Allocation</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.allocation')))}</dd><dt>Intervention model</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.interventionModel')))}</dd>
      <dt>Masking</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.maskingInfo.masking')))}</dd><dt>Primary purpose</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.primaryPurpose')))}</dd>
      <dt>Observational model</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.observationalModel')))}</dd><dt>Time perspective</dt><dd>${orNR(humanEnum(get(ds, 'designInfo.timePerspective')))}</dd>
      <dt>Biospecimen retention</dt><dd>${orNR(humanEnum(get(ds, 'bioSpec.retention')))}</dd></dl>`)}
    ${det(k + '-arms', 'Arms / groups (' + arr(ai.armGroups).length + ')', arr(ai.armGroups).length ? H`<ul>${arr(ai.armGroups).map(function (a) { return H`<li><strong>${a.label}</strong> ${a.type ? badge(humanEnum(a.type), 'outline') : ''}<div class="ow-small">${trunc(a.description || '', 600)}</div>${arr(a.interventionNames).length ? H`<div class="ow-subtle">Interventions: ${arr(a.interventionNames).join('; ')}</div>` : ''}</li>`; })}</ul>` : nr())}
    ${det(k + '-int', 'Interventions (' + arr(ai.interventions).length + ')', arr(ai.interventions).length ? H`<ul>${arr(ai.interventions).map(function (i) { return H`<li style="margin-bottom:8px"><strong>${i.name}</strong> ${badge(humanEnum(i.type), 'outline')}${arr(i.otherNames).length ? H`<div class="ow-subtle">Other names: ${arr(i.otherNames).join('; ')}</div>` : ''}<div class="ow-small">${trunc(i.description || '', 500)}</div><div>${interventionRoute(i)}</div></li>`; })}</ul>` : nr())}
    ${det(k + '-out', 'Outcomes', H`<ul>${outcomes(om.primaryOutcomes, 'Primary')}${outcomes(om.secondaryOutcomes, 'Secondary')}${outcomes(om.otherOutcomes, 'Other')}</ul>`)}
    ${det(k + '-el', 'Eligibility', H`<dl class="ow-kv"><dt>Sex</dt><dd>${orNR(humanEnum(el.sex))}</dd><dt>Minimum age</dt><dd>${orNR(el.minimumAge)}</dd><dt>Maximum age</dt><dd>${orNR(el.maximumAge)}</dd><dt>Age groups</dt><dd>${arr(el.stdAges).map(humanEnum).join(', ') || nr()}</dd>
      <dt>Healthy volunteers</dt><dd>${el.healthyVolunteers == null ? nr() : el.healthyVolunteers ? 'Accepted' : 'Not accepted'}</dd>${el.samplingMethod ? H`<dt>Sampling method</dt><dd>${humanEnum(el.samplingMethod)}</dd>` : ''}${el.studyPopulation ? H`<dt>Study population</dt><dd>${trunc(el.studyPopulation, 600)}</dd>` : ''}</dl>
      <div class="ow-notice ow-notice-warn" style="margin:10px 0">${icon('info')}<div>Criteria are shown as registered. Oncotics does not determine eligibility.</div></div>${more(k + 'elc', el.eligibilityCriteria || 'Not reported by source', 1200)}`)}
    ${det(k + '-loc', 'Locations (' + locs.length + ')', locs.length ? H`<p class="ow-subtle">Coordinates are shown as text only; no map tiles are loaded.</p>${Array.from(byCountry.entries()).map(function (e) { return det(k + '-c-' + e[0], e[0] + ' (' + e[1].length + ')', H`<ul>${e[1].slice(0, 200).map(function (l) { return H`<li style="margin-bottom:6px"><strong>${l.facility || 'Facility not reported'}</strong> ${l.status ? statusBadge(l.status) : ''}<div class="ow-small">${[l.city, l.state, l.zip].filter(Boolean).join(', ')}</div>${arr(l.contacts).map(function (c) { return H`<div class="ow-small ow-muted">${c.role ? humanEnum(c.role) + ': ' : ''}${c.name || ''}${c.phone ? ' · ' + c.phone : ''}${c.email ? ' · ' + c.email : ''}</div>`; })}${l.geoPoint ? H`<div class="ow-subtle">Coordinates ${l.geoPoint.lat}, ${l.geoPoint.lon}</div>` : ''}</li>`; })}</ul>`); })}` : nr())}
    ${det(k + '-cc', 'Central contacts and officials', H`${arr(cl.centralContacts).map(function (c) { return H`<div class="ow-small">${c.role ? humanEnum(c.role) + ': ' : ''}${c.name || ''}${c.phone ? ' · ' + c.phone : ''}${c.email ? ' · ' + c.email : ''}</div>`; })}${arr(cl.overallOfficials).map(function (o) { return H`<div class="ow-small">${o.role ? humanEnum(o.role) + ': ' : ''}${o.name || ''}${o.affiliation ? ' — ' + o.affiliation : ''}</div>`; })}${!arr(cl.centralContacts).length && !arr(cl.overallOfficials).length ? nr() : ''}`)}
    ${det(k + '-ref', 'References (' + arr(rf.references).length + ')', H`<ul>${arr(rf.references).map(function (x) { return H`<li style="margin-bottom:6px">${x.type ? badge(humanEnum(x.type), 'lit') : ''} ${x.citation || ''} ${x.pmid ? ext(LINK.pubmed(x.pmid), 'PMID ' + x.pmid) : ''}</li>`; })}${arr(rf.seeAlsoLinks).map(function (x) { return H`<li>${ext(x.url, x.label || x.url)}</li>`; })}</ul>${!arr(rf.references).length && !arr(rf.seeAlsoLinks).length ? nr() : ''}`)}
    ${det(k + '-ipd', 'Data sharing (IPD)', H`<dl class="ow-kv"><dt>Plan</dt><dd>${orNR(humanEnum(ipd.ipdSharing))}</dd><dt>Description</dt><dd>${orNR(ipd.description)}</dd><dt>Time frame</dt><dd>${orNR(ipd.timeFrame)}</dd><dt>Access criteria</dt><dd>${orNR(ipd.accessCriteria)}</dd><dt>Link</dt><dd>${ipd.url ? ext(ipd.url, ipd.url) : nr()}</dd></dl>`)}
    ${det(k + '-pt', 'Participant view', H`<p>${de.briefSummary ? trunc(de.briefSummary, 700) : 'A plain-language summary is not reported by the source.'}</p><p class="ow-small" style="margin-top:8px">Discuss trial suitability with a qualified clinician and the trial sponsor. ${ext(LINK.ctStudy(d.nct), 'Official study page')}</p>`)}
    </div>${provView(rec.prov)}`;
}
DETAIL.trial = function (r) { return r.data.full ? trialFull(r) : trialDetailBody(r.data.nct); };
registerModule({
  id: 'trials', label: 'Trials', icon: 'trial',
  count: function () { return State.ctx && State.ctx.type === 'nct' ? (slot('trial:detail:' + State.ctx.nct).status === 'ok' ? 1 : null) : slotTotal('trials:list'); },
  onOpen: function () { if (State.ctx && State.ctx.type !== 'nct' && slot('trials:list').status === 'idle') loadTrials(); },
  render: function () {
    if (!State.ctx) return H`${moduleHead('trials')}${noQuery('trials')}`;
    var c = State.ctx;
    if (c.type === 'nct') return H`${moduleHead('trials', extBtn(LINK.ctStudy(c.nct), 'Open on ClinicalTrials.gov'))}<h3 style="margin-bottom:6px">${c.nct}</h3>${trialDetailBody(c.nct)}`;
    var f = trialFilters(), u = ui('trials'), view = u.view || 'cards';
    var filters = H`<form data-submit="trial-filters"><fieldset style="border:0;padding:0;margin:0 0 10px"><legend class="ow-label">Recruitment status</legend><div class="ow-row">${CT_STATUSES.map(function (s) { return H`<label class="ow-check"><input type="checkbox" name="tr-status" value="${s}" ${f.status.indexOf(s) >= 0 ? raw('checked') : ''}>${humanEnum(s)}</label>`; })}</div></fieldset>
      <div class="ow-filters">
      ${sel('tr-phase', 'Phase', [['', 'Any'], ['EARLY_PHASE1', 'Early Phase 1'], ['PHASE1', 'Phase 1'], ['PHASE2', 'Phase 2'], ['PHASE3', 'Phase 3'], ['PHASE4', 'Phase 4'], ['NA', 'Not applicable']], f.phase)}
      ${sel('tr-type', 'Study type', [['', 'Any'], ['INTERVENTIONAL', 'Interventional'], ['OBSERVATIONAL', 'Observational'], ['EXPANDED_ACCESS', 'Expanded access']], f.type)}
      ${sel('tr-age', 'Age group', [['', 'Any'], ['CHILD', 'Child'], ['ADULT', 'Adult'], ['OLDER_ADULT', 'Older adult']], f.age)}
      ${sel('tr-hv', 'Healthy volunteers', [['', 'Any'], ['yes', 'Accepted'], ['no', 'Not accepted']], f.hv)}
      ${sel('tr-results', 'Results posted', [['', 'Any'], ['with', 'With results'], ['without', 'Without results']], f.results)}
      ${txt('tr-cond', 'Condition', f.cond, 'e.g. lung cancer')}
      ${txt('tr-intr', 'Intervention', f.intr, 'e.g. osimertinib')}
      ${txt('tr-spons', 'Sponsor', f.spons, 'e.g. AstraZeneca')}
      ${txt('tr-locn', 'Location (country, state or city)', f.locn, 'e.g. India')}
      ${txt('tr-kw', 'Additional keyword', f.kw, '')}
      ${txt('tr-from', 'Start date from (YYYY-MM-DD)', f.startFrom, '2020-01-01')}
      ${txt('tr-to', 'Start date to (YYYY-MM-DD)', f.startTo, '')}
      ${sel('tr-sort', 'Sort', [['@relevance', 'Relevance'], ['LastUpdatePostDate:desc', 'Last updated (newest)'], ['StartDate:desc', 'Start date (newest)'], ['StartDate:asc', 'Start date (oldest)'], ['PrimaryCompletionDate:desc', 'Primary completion (latest)'], ['CompletionDate:desc', 'Completion (latest)'], ['EnrollmentCount:desc', 'Enrollment (largest)']], f.sort)}
      ${sel('tr-ps', 'Page size', [['10', '10'], ['25', '25'], ['50', '50']], String(f.pageSize))}
      <div class="ow-row"><button type="submit" class="ow-btn ow-btn-primary ow-btn-sm">${icon('filter')}Apply</button><button type="button" class="ow-btn ow-btn-sm" data-act="trial-reset">Reset</button></div></div>
      <p class="ow-subtle" style="margin-top:8px">Sorting by NCT ID or title is not supported by the ClinicalTrials.gov API. Filters and pages are kept in memory only.</p></form>`;
    var list = slotView('trials:list', {
      linkout: [{ url: linkout('ctgov', c.trialTerm || c.label), label: 'Search ClinicalTrials.gov' }],
      emptyMsg: 'No trials matched. Try removing filters, a broader term, or a condition instead of a gene.',
      render: function (d0) {
        var pageIdx = (u.tokens || []).length;
        // Globe location filter (in memory): only records at the selected location are shown.
        var gf = GlobeState.filter, d = gf ? Object.assign({}, d0, { items: d0.items.filter(function (r) { return gf.keys.indexOf(r.key) >= 0; }) }) : d0;
        return H`${gf ? H`<div class="ow-notice ow-notice-info" style="margin-bottom:8px">${icon('filter')}<div>Globe filter: <strong>${gf.label}</strong> — ${d.items.length} of ${d0.items.length} trials on this page. <button type="button" class="ow-linkbtn" data-act="globe-unfilter">Remove filter</button></div></div>` : ''}${view === 'table' ? table([
          { label: 'NCT ID', render: function (r) { return H`<button type="button" class="ow-linkbtn ow-mono" data-act="open-rec" data-key="${r.key}">${r.data.nct}</button>`; } },
          { label: 'Title', render: function (r) { return r.data.briefTitle; } }, { label: 'Status', render: function (r) { return statusBadge(r.data.status); } },
          { label: 'Phase', render: function (r) { return phaseBadges(r.data.phases); } }, { label: 'Conditions', render: function (r) { return r.data.conditions.slice(0, 3).join('; '); } },
          { label: 'Sponsor', render: function (r) { return r.data.sponsor; } }, { label: 'Enrollment', render: function (r) { return r.data.enrollment != null ? num(r.data.enrollment) : '—'; } },
          { label: 'Start', render: function (r) { return r.data.start || '—'; } }, { label: 'Updated', render: function (r) { return r.data.lastUpdate || '—'; } }
        ], d.items, 'ClinicalTrials.gov studies (' + num(d.total) + ' total)') : H`<div class="ow-stack">${d.items.map(trialCard)}</div>`}
        ${pager('trials', { page: pageIdx, hasPrev: pageIdx > 0, hasNext: !!d.nextPageToken, total: d.total, pageSize: f.pageSize, label: 'studies' })}`;
      }
    });
    var s = slot('trials:list');
    return H`${moduleHead('trials', H`${viewToggle('trials')}<button type="button" class="ow-btn ow-btn-sm" data-act="copy-ids" data-kind="nct">${icon('copy')}Copy NCT IDs</button>${extBtn(linkout('ctgov', c.trialTerm || c.label), 'Open ClinicalTrials.gov')}`)}
      <div class="ow-notice ow-notice-info">${icon('info')}<div>${SAFETY.trials}</div></div>
      <p class="ow-subtle" style="margin-top:8px">Query: ${c.type === 'drug' ? 'intervention' : c.type === 'disease' ? 'condition' : 'term'} “${c.type === 'drug' ? c.drug : c.type === 'disease' ? c.disease : (c.trialTerm || c.label)}” ${s.status === 'ok' ? '· ' + num(s.data.total) + ' studies' : ''}</p>
      <div class="ow-section">${det('tr-filters', H`${icon('filter')} Filters, sorting and page size`, filters, false)}</div>
      <div class="ow-section">${list}</div>`;
  },
  exportRows: function () {
    var s = slot('trials:list'); if (s.status !== 'ok') return null;
    return { name: 'trials', rows: s.data.items, cols: [{ label: 'NCT ID', get: function (r) { return r.data.nct; } }, { label: 'Brief title', get: function (r) { return r.data.briefTitle; } }, { label: 'Status', get: function (r) { return r.data.status; } },
      { label: 'Phase', get: function (r) { return r.data.phases.join('|'); } }, { label: 'Study type', get: function (r) { return r.data.studyType; } }, { label: 'Conditions', get: function (r) { return r.data.conditions.join('; '); } },
      { label: 'Interventions', get: function (r) { return r.data.interventions.map(function (i) { return i.type + ': ' + i.name; }).join('; '); } }, { label: 'Sponsor', get: function (r) { return r.data.sponsor; } },
      { label: 'Enrollment', get: function (r) { return r.data.enrollment; } }, { label: 'Start', get: function (r) { return r.data.start; } }, { label: 'Primary completion', get: function (r) { return r.data.primaryCompletion; } },
      { label: 'Completion', get: function (r) { return r.data.completion; } }, { label: 'Last update', get: function (r) { return r.data.lastUpdate; } }, { label: 'Countries', get: function (r) { return r.data.countries.join('; '); } }, { label: 'URL', get: function (r) { return r.prov.url; } }] };
  }
});
