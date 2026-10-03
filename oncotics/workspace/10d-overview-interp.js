
/* ====================================================================
   OVERVIEW: SEARCH INTERPRETATION PANEL (+ module counts, imaging card)
   ==================================================================== */
function scoreBadge(c) { return H`<span class="ow-score ow-score-${scoreKind(c.score)}" title="Heuristic query-routing score (0–100), not a probability"><span class="ow-score-num">${c.score}</span><span class="ow-score-of">/100</span><span class="ow-score-lbl">${c.scoreLabel}</span></span>`; }
function scoreMeter(c) { return H`<span class="ow-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.score}" aria-label="Interpretation confidence ${c.score} of 100, ${c.scoreLabel}"><span style="width:${c.score}%"></span></span>`; }
function interpTypeBadge(c) { var k = { gene: 'gene', protein: 'protein', variant: 'variant', rsid: 'variant', hgvs: 'variant', drug: 'good', biologic: 'good', disease: 'warn', nct: 'cyan', regid: 'cyan', pmid: 'lit', doi: 'lit', device: 'device', vaccine: 'vax', fertility: 'fert', drugctx: 'fert', genectx: 'fert', imaging: 'img', target: 'protein', concept: 'outline' }[c.type] || 'outline'; return badge(typeName(c), k); }
function candidateCard(c, I, isTop) {
  var sel = I.selectedKey === c.key && State.ctx;
  var sigs = c.signals.concat(c.liveSignals || []);
  var mod = MOD[c.module] ? modMeta(c.module) : null;
  return H`<article class="ow-icard ${isTop ? 'ow-icard-top' : ''} ${sel ? 'ow-icard-sel' : ''}" aria-label="${typeName(c)} interpretation, confidence ${c.score} of 100">
    <div class="ow-icard-head"><div style="min-width:0">${isTop ? H`<div class="ow-subtle">${I.needsConfirm ? 'Highest-scoring candidate (not applied)' : 'Top interpretation'}</div>` : ''}<div class="ow-row" style="margin-top:2px">${interpTypeBadge(c)}<strong class="ow-break">${c.normalized}</strong>${sel ? badge('In use', 'teal') : ''}${c.derived ? badge('Live-derived', 'derived') : ''}</div></div>${scoreBadge(c)}</div>
    ${scoreMeter(c)}
    <p class="ow-small" style="margin-top:6px"><strong>Why:</strong> ${c.why}</p>
    ${sigs.length ? H`<ul class="ow-sigs">${sigs.map(function (s) { return H`<li class="ow-sig ow-sig-${s.kind}"><span class="ow-sig-k">${{ pattern: 'Pattern', dictionary: 'Dictionary', live: 'Live', agreement: 'Agreement', conflict: 'Conflict', penalty: 'Penalty' }[s.kind] || s.kind}</span> ${s.text}${s.delta ? H` <span class="ow-subtle">(${s.delta > 0 ? '+' : ''}${s.delta})</span>` : ''}</li>`; })}</ul>` : ''}
    <div class="ow-isrc"><span><strong>Supporting sources:</strong> ${c.supporting.length ? c.supporting.join(', ') : H`<span class="ow-subtle">${sel || isTop ? 'none yet (loads progressively)' : 'not queried for this alternative'}</span>`}</span>
      <span><strong>Conflicting sources:</strong> ${c.conflicting.length ? H`<span class="ow-bad-t">${c.conflicting.join(', ')}</span>` : H`<span class="ow-subtle">none</span>`}</span></div>
    ${c.flags.length ? H`<div class="ow-badges" style="margin-top:6px">${c.flags.map(function (f) { return badge(f, 'warn'); })}</div>` : ''}
    <div class="ow-card-foot">
      ${sel ? '' : H`<button type="button" class="ow-btn ow-btn-sm ${isTop ? 'ow-btn-primary' : ''}" data-act="interp-use" data-key="${c.key}">${icon('check')}Use this interpretation</button>`}
      <button type="button" class="ow-btn ow-btn-sm" data-act="interp-search" data-key="${c.key}">Search as ${typeName(c).toLowerCase()}</button>
      <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="interp-refine">Refine query</button>
      <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="interp-sources" data-key="${c.key}">Show all sources</button>
      <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="interp-pin" data-key="${c.key}">${icon('pin')}Add to session board</button>
      ${mod && c.module !== 'overview' ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="interp-module" data-key="${c.key}">${icon(mod.icon)}Open ${mod.label}</button>` : ''}
      ${c.type === 'imaging' ? H`<a class="ow-btn ow-btn-sm" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">${icon('scan')}Open Imaging Workbench<span class="ow-sr"> (opens a separate page)</span></a>` : ''}
    </div></article>`;
}
function interpretationPanel() {
  var I = liveInterpretation(); if (!I) return '';
  // The applied interpretation (or the highest-scoring one) first; every other interpretation follows by score.
  var applied = State.ctx ? I.candidates.find(function (x) { return x.key === I.selectedKey; }) : null;
  var top = applied || I.candidates[0], rest = I.candidates.filter(function (x) { return x !== top; }).sort(function (a, b) { return b.score - a.score; });
  var c = State.ctx;
  var norm = [];
  if (c) {
    if (c.gene) norm.push('Gene ' + c.gene); if (c.variantName) norm.push('Variant ' + c.variantName); if (c.change && c.change.three) norm.push('Protein change p.' + c.change.three);
    if (c.drug) norm.push('Drug ' + c.drug + (c.brand ? ' (brand ' + c.brand + ')' : '')); if (c.disease) norm.push('Disease ' + c.disease); if (c.deviceId) norm.push(c.deviceId.kind.toUpperCase() + ' ' + c.deviceId.value);
    if (c.vaccine) norm.push('Vaccine ' + c.vaccine.name + ' (' + (VAX_SUB[c.vaccine.kind] || c.vaccine.kind) + ')'); if (c.fertility) norm.push('Onco-Fertility concept ' + c.fertility.concept); if (c.imaging) norm.push('Imaging concept ' + c.imaging.concept);
    if (c.trialTerm) norm.push('Trial query “' + c.trialTerm + '”'); if (c.geneHint) norm.push('Target hint ' + c.geneHint);
  }
  return H`<section class="ow-card ow-interp ow-fade" aria-labelledby="ow-interp-h">
    <div class="ow-card-head"><div><h3 id="ow-interp-h">${icon('search')} Search Interpretation</h3><p class="ow-small ow-muted">Query: <strong class="ow-break">“${I.query}”</strong> · ${I.candidates.length} interpretation${I.candidates.length === 1 ? '' : 's'} considered</p></div>
      <div class="ow-toolbar"><button type="button" class="ow-btn ow-btn-sm" data-act="interp-export">${icon('download')}Export interpretation</button><button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="interp-help">${icon('help')}How scoring works</button></div></div>
    ${I.autoConcept ? H`<div class="ow-notice ow-notice-info" style="margin-top:8px">${icon('search')}<div><strong>Searched as a free-text clinical concept.</strong> No specific gene, drug, disease, trial or device reading reached Medium confidence, so your exact text was sent to every live source with a free-text search (see below). Choose another reading here to re-run it that way.</div></div>` : ''}
    ${I.needsConfirm ? H`<div class="ow-notice ow-notice-warn" role="alert" style="margin-top:8px">${icon('alert')}<div><strong>${I.ambiguous ? 'Ambiguous query.' : 'Low-confidence interpretation.'}</strong> ${I.ambiguous ? 'Two or more interpretations score within 10 points of each other.' : 'No interpretation scored 50 or higher.'} Oncotics has not queried any source yet. Choose how to treat the query, refine it, or set the entity type manually.</div></div>` : ''}
    ${c && c.alleleChoices ? H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('alert')}<div><strong>This identifier maps to more than one protein change.</strong> Oncotics does not pick one for you: <span class="ow-row" style="display:inline-flex;margin-top:4px">${c.alleleChoices.map(function (a) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${a}" data-type="variant">${a}</button>`; })}</span></div></div>` : ''}
    ${c && c.derivedVariant ? H`<p class="ow-subtle" style="margin-top:6px">Protein change ${c.variantName} was derived by Oncotics from ${c.type === 'rsid' || c.genomic ? 'MyVariant.info' : 'Ensembl VEP'} (normalized by Oncotics).</p>` : ''}
    ${allConfidenceTable(I)}
    ${conceptAnalytics()}
    <div class="ow-interp-grid">${candidateCard(top, I, true)}${rest.length ? H`<div class="ow-stack"><div class="ow-subtle" style="font-weight:600">Other interpretations</div>${rest.map(function (x) { return candidateCard(x, I, false); })}</div>` : ''}</div>
    ${norm.length ? H`<p class="ow-small" style="margin-top:10px"><strong>Normalized terms used downstream:</strong> ${norm.join(' · ')}</p>` : ''}
    <details class="ow-details" style="margin-top:8px"><summary>Set the entity type manually</summary><div class="ow-details-body ow-row">${CORRECT_TYPES.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="correct" data-type="${t[0]}">${t[1]}</button>`; })}</div></details>
    <p class="ow-disclaimer" style="margin-top:10px">${SAFETY.interpretation} Scores are heuristic (0–100; Very High 90–100, High 75–89, Medium 50–74, Low 25–49, Very Low 0–24), not statistical probabilities.</p>
  </section>`;
}
function interpHelp() {
  return H`<div class="ow-stack"><p>${SAFETY.interpretation}</p>
    <p>Every query is matched against local patterns (NCT, PMID, DOI, rsID, HGVS, 510(k)/PMA/De Novo, product code, UDI-DI), Oncotics routing dictionaries (genes and aliases, drugs and brands, diseases, vaccines, Onco-Fertility concepts, imaging concepts) and, once records load, live source agreement or conflict (for example MyGene.info exact symbol hits, CIViC evidence, openFDA label matches, ClinicalTrials.gov record lookups).</p>
    ${table([{ label: 'Range', key: 'r' }, { label: 'Label', key: 'l' }, { label: 'Meaning', key: 'm' }], [{ r: '90–100', l: 'Very High', m: 'Exact identifier or strong dictionary match, usually confirmed by a live source' }, { r: '75–89', l: 'High', m: 'Strong match; alternatives remain visible' }, { r: '50–74', l: 'Medium', m: 'Plausible; check the alternatives' }, { r: '25–49', l: 'Low', m: 'Weak; Oncotics asks you to confirm before querying' }, { r: '0–24', l: 'Very Low', m: 'Unlikely' }])}
    <p>When two specific interpretations both score at least 50 and are within 10 points of each other, Oncotics asks you to choose first. When no specific reading reaches 50, the query runs as a free-text clinical concept across every live source; each source that returns records adds a live signal, and exact name matches in the sources appear as live-derived alternative readings. Penalties are shown (for example specificity penalties when a long phrase only partly matches a disease name).</p>
    <div class="ow-disclaimer">Dictionaries are routing hints only and are never presented as results.</div></div>`;
}
function interpSourcesFor(c) {
  var t = c.entity && c.entity.type;
  var m = { gene: ['mygene', 'civic', 'ctgov', 'europepmc', 'ensembl', 'uniprot', 'opentargets', 'dgidb', 'oncokb', 'clingen_gencc'], variant: ['myvariant', 'civic', 'ctgov', 'europepmc', 'ensembl', 'cancer_hotspots', 'oncokb', 'clinvar'], rsid: ['myvariant', 'ensembl', 'gwas', 'europepmc', 'dbsnp'], hgvs: ['ensembl', 'myvariant', 'europepmc'],
    drug: ['openfda-drug', 'rxnorm', 'ctgov', 'europepmc', 'civic', 'chembl', 'pubchem', 'dgidb', 'pharmgkb', 'cpic', 'dailymed', 'lactmed'], disease: ['ctgov', 'civic', 'europepmc', 'ols', 'oncotree', 'nci_gdc', 'cbioportal', 'ncit'], nct: ['ctgov', 'europepmc'], pmid: ['europepmc', 'openalex', 'crossref', 'semantic_scholar', 'pubmed'], doi: ['europepmc', 'crossref', 'openalex'],
    device: ['openfda-device', 'ctgov', 'europepmc', 'fda-510k', 'fda-pma', 'fda-denovo', 'gudid', 'fda-cdx', 'maude'], vaccine: ['ctgov', 'europepmc', 'openfda-drug', 'rxnorm', 'fda_cber', 'dailymed', 'cdc_vaers', 'cdc_acip', 'cdc_pregnancy_vax', 'who_vaccines', 'ema'], fertility: ['ctgov', 'europepmc', 'openfda-drug', 'openfda-device', 'nci_fertility', 'asco_guidelines', 'eshre_guidelines', 'asrm', 'lactmed', 'clingen_gencc'],
    imaging: ['europepmc', 'ctgov', 'openfda-device', 'tcia', 'nci_idc', 'radlex', 'radiologyinfo', 'ohif_viewer'], concept: ['ctgov', 'europepmc', 'civic', 'ols'] }[t] || ['ctgov', 'europepmc'];
  if (c.entity && c.entity.fertility) m = m.concat(['nci_fertility', 'lactmed', 'asco_guidelines']);
  return uniq(m).map(function (id) { return SRC[id]; }).filter(Boolean);
}
function moduleCounts() {
  var rows = moduleCountsBase();
  // Free-text concept: modules also count the records their live sources returned.
  if (cxIsConcept()) rows.forEach(function (r) { var cn = cxModuleCount(r[0]); if (cn != null && r[0] !== 'overview' && r[0] !== 'relationships') r[2] = Math.max(typeof r[2] === 'number' ? r[2] : 0, cn); });
  return rows;
}
function moduleCountsBase() {
  var sum = function (keys) { var n = null, any = false; keys.forEach(function (k) { var v = slotTotal(k); if (v != null) { n = (n || 0) + v; any = true; } }); return any ? n : null; };
  var gl = globeLocations().length, G = State.ctx ? buildMolMap() : { nodes: [], edges: [] };
  return [['clinical-evidence', 'Clinical evidence', sum(['civic:evidence', 'civic:assertions'])], ['trials', 'Trials', sum(['trials:list'])], ['drug-intelligence', 'Drug intelligence', sum(['drug:labels', 'drug:approvals'])],
    ['device-intelligence', 'Devices & diagnostics', sum(['dev:auth', 'dev:class', 'dev:udi'])], ['vaccines-cancer-immunization', 'Vaccines & cancer immunization', State.ctx && State.ctx.type === 'vaccine' ? sum(['trials:list', 'vax:labels']) : sum(['vax:labels'])],
    ['onco-fertility', 'Onco-Fertility', State.ctx && State.ctx.fertility ? sum(['trials:list', 'fert:ae', 'fert:trials']) : sum(['fert:ae', 'fert:trials'])], ['biology', 'Biology', sum(['gene:mygene', 'var:myvariant', 'bio:uniprot', 'bio:reactome', 'bio:string'])], ['literature', 'Literature', sum(['lit:list'])],
    ['expert-knowledge', 'Expert knowledge & patient education', 4], ['global-coverage', 'Developer / community resources', 2], ['overview', 'Geographic locations found', gl], ['relationships', 'Molecular context nodes / edges', G.nodes.length ? G.nodes.length + ' / ' + G.edges.length : null]];
}
function imagingContextCard() {
  var c = State.ctx; if (!c || !(c.type === 'imaging' || /imaging|scan|mri|ct|pet|radiol/i.test(c.label || ''))) return '';
  return H`<div class="ow-card ow-img-card"><div class="ow-card-head"><div><div class="ow-card-title">${icon('scan')} Oncotics Imaging Workbench</div><div class="ow-card-sub">A separate page for memory-only image viewing (OHIF), lesion inspection, annotations and opt-in experimental AI inference.</div></div>
    <a class="ow-btn ow-btn-primary" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">${icon('scan')}Open Imaging Workbench<span class="ow-sr"> (opens a separate page)</span></a></div>
    <p class="ow-small" style="margin-top:6px">Nothing imaging-related is loaded on this page. Context queries here use only the non-PHI concept “${c.imaging ? c.imaging.concept : c.label}”; no image data is ever attached. ${SAFETY.imaging}</p>
    <div class="ow-card-foot">${extBtn(linkout('tcia', ''), 'TCIA collections')}${extBtn(linkout('nci_idc', ''), 'NCI Imaging Data Commons')}${extBtn(linkout('radlex', ''), 'RadLex')}${extBtn(linkout('radiologyinfo', ''), 'RadiologyInfo.org (patient education)')}</div>
    ${c.imaging && c.imaging.workbench ? '' : H`<div class="ow-section">${sectionHead('Imaging device records (openFDA)', ['openfda-device'])}${slot('img:devices').status === 'idle' ? autoAct('img:devices', 'img-devices', {}, [{ url: linkout('fda-510k', ''), label: 'FDA 510(k) database' }], 'imaging device records') : slotView('img:devices', { skeleton: 1, linkout: [{ url: linkout('fda-510k', ''), label: 'FDA 510(k) database' }], emptyMsg: 'openFDA returned no device authorizations for this imaging concept (records may lag the official database).', render: function (d) { return H`<p class="ow-subtle">${num(d.items.length)} records shown. ${SAFETY.lag}</p><div class="ow-stack">${d.items.slice(0, 6).map(function (r) { return authCard(r); })}</div>`; } })}</div>`}</div>`;
}
// Cancer type context (OncoTree + NCI GDC project aggregate), loaded live with disease queries.
function cancerTypeCard() {
  var ot = slot('ont:oncotree'), gp = slot('bio:gdcProjects'); if (ot.status === 'idle' && gp.status === 'idle') return '';
  var c = State.ctx, term = c ? (c.disease || c.concept || c.label || '') : '';
  return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${icon('dna')} Cancer type context</div><div class="ow-card-sub">Ontology matches and public research cohorts for “${term}”. Context only; not a diagnosis.</div></div></div>
    <div class="ow-grid-2"><div>${sectionHead('OncoTree tumor types', ['oncotree'])}${slotView('ont:oncotree', { skeleton: 1, linkout: [{ url: LINK.oncotree(term), label: 'OncoTree' }], emptyMsg: 'OncoTree has no tumor type matching this name.', render: function (d) {
      return H`<ul>${d.items.slice(0, 6).map(function (x) { return H`<li>${ext(LINK.oncotree(x.code), x.code)} ${x.name} ${badge(x.confidence, x.confidence === 'Exact' ? 'good' : 'outline')} <span class="ow-subtle">${x.tissue || ''}${x.mainType ? ' · ' + x.mainType : ''}</span></li>`; })}</ul>`; } })}</div>
    <div>${sectionHead('NCI GDC projects (open-access aggregate)', ['nci_gdc'])}${slotView('bio:gdcProjects', { skeleton: 1, linkout: [{ url: linkout('nci_gdc', ''), label: 'NCI GDC Data Portal' }], emptyMsg: 'No GDC project names matched this term.', render: function (d) {
      return H`<ul>${d.items.slice(0, 6).map(function (p) { return H`<li>${ext(LINK.gdcProject(p.id), p.id)} ${p.name || ''} <span class="ow-subtle">${p.cases != null ? num(p.cases) + ' cases' : ''}${p.program ? ' · ' + p.program : ''}</span></li>`; })}</ul><p class="ow-subtle">${SAFETY.gdc}</p>`; } })}</div></div></div>`;
}

// Confidence for EVERY entity type, on every search (fixed order). A type the interpreter matched shows
// that candidate's score; any other type gets an automatic score from local patterns plus the live type
// probes started with every search (MyGene, RxNorm, ChEMBL, EBI OLS, openFDA devices; see startTypeProbes).
var TYPE_MEMBERS = { gene: ['gene', 'genectx', 'protein', 'target'], variant: ['variant', 'rsid', 'hgvs', 'ambiguous'], drug: ['drug', 'biologic', 'drugctx', 'rxcui'], disease: ['disease'], device: ['device'],
  vaccine: ['vaccine'], fertility: ['fertility', 'drugctx', 'genectx'], imaging: ['imaging'], concept: ['concept'], pmid: ['pmid', 'doi'] };
function typeProbe(id) { var e = CX_BY_ID[id], s = e ? slot(cxKey(e)) : { status: 'idle' }; return s; }
function typeAutoScore(type, q) {
  var t = String(q || '').trim(), low = t.toLowerCase(), cn = cxNorm(t), sc = 0, why = [], sup = [], pending = false;
  var addW = function (n, text, src) { sc += n; why.push(text); if (src) sup.push(src); };
  var probe = function (id, fn) { var s = typeProbe(id); if (s.status === 'loading') pending = true; else if (s.status === 'ok' && s.data && !s.data.empty) fn(arr(s.data.items)); return s.status; };
  switch (type) {
    case 'gene':
      if (/^[A-Z][A-Z0-9]{1,9}(-[A-Z0-9]{1,4})?$/.test(t)) addW(18, 'Looks like a gene symbol, but it is not in the Oncotics gene list'); else addW(3, 'No gene symbol or alias pattern matched');
      if (probe('mygene', function (it) { if (/^[A-Za-z][A-Za-z0-9-]{1,14}$/.test(t) && it.some(function (x) { return cxNorm(x.symbol) === cn; })) addW(50, 'MyGene.info reports a human gene with exactly this symbol', 'MyGene.info'); else addW(4, 'MyGene.info returned related genes, but none with this exact symbol', 'MyGene.info'); }) === 'empty') why.push('MyGene.info found no human gene');
      break;
    case 'variant':
      var toks = t.split(/\s+/); if (toks.length >= 2 && parseProteinChange(toks.slice(1).join(''))) addW(22, 'Contains a protein-change notation'); else if (/\b[A-Z]\d{1,4}[A-Z*]\b|c\.\d|p\.[A-Z]/.test(t)) addW(14, 'Contains a variant-like token'); else addW(2, 'No variant notation (gene + protein change, rsID or HGVS) found');
      break;
    case 'drug':
      if (/(mab|nib|tinib|ciclib|parib|platin|rubicin|taxel|mustine|lisib|rafenib|zomib|cept|leucel)$/i.test(low)) addW(28, 'Ends like a drug or biologic name'); else addW(4, 'No drug or brand name matched');
      probe('rxnorm', function (it) { if (it.some(function (x) { return cxNorm(x.title) === cn; })) addW(45, 'RxNorm has a concept with exactly this name', 'RxNorm'); else addW(5, 'RxNorm returned approximate matches only', 'RxNorm'); });
      probe('chembl', function (it) { if (it.some(function (x) { return cxNorm(x.title) === cn; })) addW(15, 'ChEMBL has a molecule with exactly this name', 'ChEMBL'); });
      break;
    case 'disease':
      if (/cancer|carcinoma|tumou?r|neoplasm|leuka?emia|lymphoma|myeloma|sarcoma|melanoma|glioma|blastoma|mesothelioma|disease|syndrome/i.test(t)) addW(30, 'Contains a disease or cancer term'); else addW(5, 'No disease or cancer term matched');
      var ol = slot('ont:ols'); if (ol.status === 'loading') pending = true; else if (ol.status === 'ok') { if (arr(ol.data.items).some(function (x) { return cxNorm(x.label) === cn; })) addW(40, 'EBI OLS has an ontology term (MONDO / NCIt / EFO) with exactly this label', 'EBI OLS'); else addW(6, 'EBI OLS returned related ontology terms', 'EBI OLS'); }
      break;
    case 'device':
      if (/\b(test|assay|kit|device|panel|diagnostic|dx|sequencing|ngs|pcr|ihc|510\(k\)|pma|implant|catheter|pump|system)\b/i.test(t)) addW(25, 'Contains a device or diagnostic term'); else addW(3, 'No device term, 510(k)/PMA/De Novo number, product code or UDI matched');
      probe('fda-device', function (it) { addW(Math.min(25, 8 + it.length * 3), 'openFDA has device authorization records matching this name', 'openFDA device'); });
      break;
    case 'vaccine': if (/vaccin|immuni[sz]|toxoid|booster/i.test(t)) addW(30, 'Contains a vaccine or immunization term'); else addW(1, 'No vaccine or immunization term matched'); break;
    case 'fertility': if (/fertil|pregnan|ovar|sperm|embryo|oocyte|reproduct|lactat|breastfeed|contracept|menopaus|gonad|amh\b|ivf\b/i.test(t)) addW(30, 'Contains a reproductive-health term'); else addW(1, 'No Onco-Fertility term matched'); break;
    case 'imaging': if (/imaging|scan|\bmri\b|\bct\b|\bpet\b|ultrasound|radiolog|mammogra|x-?ray|dicom|radiomic/i.test(t)) addW(30, 'Contains an imaging term'); else addW(1, 'No imaging term matched'); break;
    case 'concept': addW(20, 'Any text can be searched as a free-text clinical concept'); var lt = slotTotal('lit:list'), tt = slotTotal('trials:list'); if (lt) addW(Math.min(10, 2 + Math.round(Math.log10(lt + 1) * 3)), 'Europe PMC has records for it', 'Europe PMC'); if (tt) addW(Math.min(8, 2 + Math.round(Math.log10(tt + 1) * 3)), 'ClinicalTrials.gov has studies for it', 'ClinicalTrials.gov'); break;
    case 'pmid': if (/^(pmid:?\s*)?\d{1,9}$/i.test(t)) addW(60, 'Looks like a PMID'); else addW(0, 'Not a PMID (PMIDs are 1–9 digits)'); break;
  }
  sc = Math.max(0, Math.min(89, sc));
  return { score: sc, scoreLabel: scoreLabel(sc), why: why.join('; '), supporting: uniq(sup), pending: pending };
}
function typeConfidenceRows(I) {
  var q = I.query, sel = State.ctx ? I.selectedKey : null;
  var rows = CORRECT_TYPES.map(function (ct) {
    var type = ct[0], mem = TYPE_MEMBERS[type] || [type];
    var cands = I.candidates.filter(function (c) { return mem.indexOf(c.type) >= 0; }).sort(function (a, b) { return (b.key === sel) - (a.key === sel) || b.score - a.score; });
    var c = cands[0];
    if (c) return { type: type, name: ct[1], cand: c, reading: c.normalized, score: c.score, scoreLabel: c.scoreLabel, why: c.why, supporting: c.supporting, conflicting: c.conflicting, inUse: c.key === sel, origin: c.derivedType ? 'Live-derived reading' : 'Interpreter' };
    var a = typeAutoScore(type, q);
    var canForce = false; try { canForce = !!forceEntity(q, type); } catch (e) { canForce = false; }
    return { type: type, name: ct[1], cand: null, reading: q, score: a.score, scoreLabel: a.scoreLabel, why: a.why, supporting: a.supporting, conflicting: [], inUse: false, origin: a.pending ? 'Automatic (live checks loading…)' : 'Automatic', canForce: canForce };
  });
  // Readings of other kinds (trial IDs, accessions) are listed after the ten entity types.
  var covered = [].concat.apply([], Object.keys(TYPE_MEMBERS).map(function (k) { return TYPE_MEMBERS[k]; }));
  I.candidates.filter(function (c) { return covered.indexOf(c.type) < 0; }).forEach(function (c) { rows.push({ type: c.type, name: typeName(c), cand: c, reading: c.normalized, score: c.score, scoreLabel: c.scoreLabel, why: c.why, supporting: c.supporting, conflicting: c.conflicting, inUse: c.key === sel, origin: 'Interpreter' }); });
  return rows;
}
function allConfidenceTable(I) {
  var rows = typeConfidenceRows(I), best = rows.reduce(function (m, r) { return r.score > m ? r.score : m; }, 0);
  return H`<div class="ow-section"><h4>Confidence by entity type (${rows.length})</h4>
    <p class="ow-subtle">Every search is scored for every entity type. Types the interpreter matched show that reading's score; the others are scored automatically from text patterns and quick live checks (MyGene.info, RxNorm, ChEMBL, EBI OLS, openFDA devices). Scores are heuristic routing scores (0–100), not probabilities.</p>
    <div class="ow-table-wrap"><table class="ow-table ow-conf-table"><caption class="ow-sr">Interpretation confidence for every entity type</caption>
    <thead><tr><th scope="col">Entity type</th><th scope="col">Reading</th><th scope="col">Confidence</th><th scope="col">Why</th><th scope="col">Sources</th><th scope="col">Status</th></tr></thead><tbody>${rows.map(function (r) {
      var act = r.inUse ? badge('In use', 'good') : r.cand ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="interp-use" data-key="${r.cand.key}">Use</button>` : r.canForce ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="search-as" data-term="${I.query}" data-type="${r.type}">Search as ${r.name.toLowerCase()}</button>` : H`<span class="ow-subtle ow-small">Not applicable</span>`;
      return H`<tr class="${r.inUse ? 'ow-conf-sel' : ''} ${r.score === best && best > 0 ? 'ow-conf-best' : ''}"><th scope="row"><span class="ow-badge">${r.name}</span><div class="ow-subtle ow-small">${r.origin}</div></th><td class="ow-conf-reading"><strong>${trunc(r.reading, 60)}</strong></td>
        <td><div class="ow-conf-cell">${scoreMeter({ score: r.score, scoreLabel: r.scoreLabel })}<span class="ow-score-inline ow-score-${scoreKind(r.score)}">${r.score} · ${r.scoreLabel}</span></div></td>
        <td class="ow-small">${trunc(r.why || '', 160)}</td>
        <td class="ow-small">${arr(r.supporting).length ? arr(r.supporting).slice(0, 3).join(', ') + (r.supporting.length > 3 ? ' +' + (r.supporting.length - 3) : '') : H`<span class="ow-subtle">—</span>`}${arr(r.conflicting).length ? H`<div class="ow-bad-t">${r.conflicting.length} conflicting</div>` : ''}</td>
        <td>${act}</td></tr>`; })}</tbody></table></div></div>`;
}
