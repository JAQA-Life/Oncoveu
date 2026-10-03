/* ====================================================================
   FREE-TEXT CONCEPT FAN-OUT
   A "Free-text clinical concept" query is sent to EVERY live source that
   offers a public free-text search. Sources that need an identifier
   (AlphaFold, EBI Proteins, DGIdb) are cascaded from the top UniProt /
   MyGene hit. Sources without a browser API, and any source that cannot
   be reached, are shown as official link-outs. Each result row keeps its
   source and URL; nothing is ranked across sources or merged.
   ==================================================================== */
var CX_STRIP = /<[^>]*>/g;
function cxText(v) { return String(v == null ? '' : v).replace(CX_STRIP, '').replace(/\s+/g, ' ').trim(); }
function cxOut(total, items) { items = arr(items).filter(function (x) { return x && x.title; }); return items.length ? { total: total != null ? total : items.length, items: items.slice(0, 5) } : { empty: true, total: 0 }; }
function cxRec(r) { return { title: r.title, url: r.prov && r.prov.url, key: r.key }; }
function cxWords(text) { return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; }); }

// Each entry: id, src, label, and one of
//   slot: an existing search slot loaded by executePlan (summarized here, not re-fetched)
//   run(signal, text): a direct free-text request
//   from + run(signal, value): cascaded from another entry's top hit (value = that entry's `pick`)
var CX_ENTRIES = [
  { id: 'trials', src: 'ctgov', label: 'Clinical trials', slot: 'trials:list', summ: function (d) { return cxOut(d.total, arr(d.items).map(cxRec)); } },
  { id: 'lit', src: 'europepmc', label: 'Literature', slot: 'lit:list', summ: function (d) { return cxOut(d.total, arr(d.items).map(cxRec)); } },
  { id: 'civic', src: 'civic', label: 'Curated clinical evidence', slot: 'civic:search', summ: function (d) { return cxOut(null, arr(d.items).map(function (x) { return { title: x.name, sub: humanEnum(x.resultType || ''), url: linkout('civic', x.name) }; })); } },
  { id: 'ols', src: 'ols', label: 'Ontology terms (MONDO, NCIt, EFO)', slot: 'ont:ols', summ: function (d) { return cxOut(null, arr(d.items).map(function (x) { return { title: x.label, sub: x.id + ' · ' + x.ontology, url: safeUrl(x.iri) }; })); } },
  { id: 'oncotree', src: 'oncotree', label: 'Tumor types', slot: 'ont:oncotree', summ: function (d) { return cxOut(null, arr(d.items).map(function (x) { return { title: x.name, sub: x.code + (x.tissue ? ' · ' + x.tissue : ''), url: LINK.oncotree(x.code), as: { term: x.name, type: 'disease' } }; })); } },
  { id: 'gdc', src: 'nci_gdc', label: 'Research cohorts (GDC projects)', slot: 'bio:gdcProjects', summ: function (d) { return cxOut(null, arr(d.items).map(function (p) { return { title: p.id + ' · ' + (p.name || ''), sub: p.cases != null ? num(p.cases) + ' cases' : '', url: LINK.gdcProject(p.id) }; })); } },
  { id: 'fda-label', src: 'openfda-drug', label: 'Drug labels mentioning it (indications)', run: async function (s, t) {
    var d = await fdaGet('openfda-drug', '/drug/label.json', fq('indications_and_usage', t), 'limit=10', s, 'drug/label (indications)');
    return cxOut(fdaTotal(d), arr(d && d.results).map(function (l) { var o = l.openfda || {}, g = first(arr(o.generic_name)), b = first(arr(o.brand_name)); return { title: titleCase(g || b || 'Label'), sub: b && g ? b : '', url: linkout('dailymed', g || b || ''), as: g ? { term: g, type: 'drug' } : null }; })); } },
  { id: 'fda-events', src: 'openfda-drug', label: 'Drugs most reported with this reaction (FAERS counts)', run: async function (s, t) {
    var d = await fdaGet('openfda-drug', '/drug/event.json', fq('patient.reaction.reactionmeddrapt', t), 'count=patient.drug.openfda.generic_name.exact&limit=8', s, 'drug/event (count)');
    return cxOut(null, arr(d && d.results).map(function (x) { return { title: titleCase(x.term), sub: num(x.count) + ' reports (passive surveillance; not a rate)', url: linkout('faers', ''), as: { term: x.term, type: 'drug' } }; })); } },
  { id: 'fda-device', src: 'openfda-device', label: 'Device authorizations (510(k), PMA)', run: async function (s, t) {
    var d = await Loaders.devAuth(s, { type: 'device', deviceText: t, deviceTerm: t, label: t });
    return cxOut(d.totals ? Object.keys(d.totals).reduce(function (a, k) { return a + (d.totals[k] || 0); }, 0) : null, arr(d.items).map(cxRec)); } },
  { id: 'rxnorm', src: 'rxnorm', label: 'Drug vocabulary (approximate match)', run: async function (s, t) {
    var d = await Net.request('rxnorm', SRC.rxnorm.apiBase + '/approximateTerm.json?' + qs({ term: t, maxEntries: 6 }), { signal: s, label: 'approximateTerm' });
    var seen = new Set();
    return cxOut(null, arr(get(d, 'approximateGroup.candidate')).filter(function (c) { if (!c.rxcui || seen.has(c.rxcui)) return false; seen.add(c.rxcui); return true; }).map(function (c) { return { title: c.name || ('RxCUI ' + c.rxcui), sub: 'RxCUI ' + c.rxcui + (c.score != null ? ' · match score ' + Math.round(c.score) : ''), url: safeUrl('https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=' + encodeURIComponent(c.rxcui)), as: c.name ? { term: c.name, type: 'drug' } : null }; })); } },
  { id: 'mygene', src: 'mygene', label: 'Genes (full-text)', pick: function (d) { return d.items[0] && d.items[0].symbol; }, run: async function (s, t) {
    var d = await Net.request('mygene', SRC.mygene.apiBase + '/query?' + qs({ q: t, species: 'human', size: 6, fields: 'symbol,name,entrezgene' }), { signal: s, label: 'query (free text)' });
    return cxOut(d && d.total, arr(d && d.hits).filter(function (h) { return h.symbol; }).map(function (h) { return { title: h.symbol, sub: h.name || '', symbol: h.symbol, url: h.entrezgene ? safeUrl('https://www.ncbi.nlm.nih.gov/gene/' + h.entrezgene) : linkout('ncbi-gene', h.symbol), as: { term: h.symbol, type: 'gene' } }; })); } },
  { id: 'myvariant', src: 'myvariant', label: 'ClinVar variants for this condition', run: async function (s, t) {
    var d = await Net.request('myvariant', SRC.myvariant.apiBase + '/query?' + qs({ q: 'clinvar.rcv.conditions.name:"' + String(t).replace(/["\\]/g, ' ') + '"', size: 6, fields: 'clinvar.gene.symbol,clinvar.hgvs.coding,clinvar.rcv.clinical_significance,dbsnp.rsid' }), { signal: s, label: 'query (ClinVar condition)' });
    return cxOut(d && d.total, arr(d && d.hits).map(function (h) { var cv = h.clinvar || {}, rcv = first(arr(cv.rcv)) || {}, rs = get(h, 'dbsnp.rsid'); return { title: (get(cv, 'gene.symbol') || '') + ' ' + (first(arr(get(cv, 'hgvs.coding'))) || h._id), sub: (rcv.clinical_significance || 'significance not reported') + (rs ? ' · ' + rs : ''), url: rs ? linkout('dbsnp', rs, true) : linkout('clinvar', t), as: rs ? { term: rs, type: 'rsid' } : null }; })); } },
  { id: 'ensembl', src: 'ensembl', label: 'Genome cross-references', run: async function (s, t) {
    var d = await Net.request('ensembl', SRC.ensembl.apiBase + '/xrefs/name/homo_sapiens/' + encodeURIComponent(t) + '?content-type=application/json', { signal: s, notFoundEmpty: true, label: 'xrefs/name' });
    return cxOut(null, arr(d).map(function (x) { return { title: x.display_id || x.primary_id, sub: (x.dbname || '') + (x.description ? ' · ' + x.description : ''), url: linkout('ensembl', x.display_id || x.primary_id) }; })); } },
  { id: 'uniprot', src: 'uniprot', label: 'Proteins (reviewed, human)', pick: function (d) { return d.items[0] && d.items[0].acc; }, run: async function (s, t) {
    var d = await Net.request('uniprot', SRC.uniprot.apiBase + '/uniprotkb/search?' + qs({ query: '(' + t + ') AND organism_id:9606 AND reviewed:true', size: 6, format: 'json', fields: 'accession,protein_name,gene_primary' }), { signal: s, label: 'uniprotkb/search (free text)' });
    return cxOut(null, arr(d && d.results).map(function (e) { var g = get(e, 'genes.0.geneName.value'); return { title: (get(e, 'proteinDescription.recommendedName.fullName.value') || e.primaryAccession), sub: e.primaryAccession + (g ? ' · ' + g : ''), acc: e.primaryAccession, url: linkout('uniprot', e.primaryAccession, true), as: g ? { term: g, type: 'gene' } : null }; })); } },
  { id: 'string', src: 'string', label: 'Protein network identifiers', run: async function (s, t) {
    var d = await Net.request('string', SRC.string.apiBase + '/json/get_string_ids?' + qs({ identifiers: t, species: 9606, limit: 5, caller_identity: 'oncotics.com' }), { signal: s, notFoundEmpty: true, label: 'get_string_ids' });
    return cxOut(null, arr(d).map(function (x) { return { title: x.preferredName, sub: cxText(x.annotation).slice(0, 120), url: linkout('string', x.preferredName), as: x.preferredName ? { term: x.preferredName, type: 'gene' } : null }; })); } },
  { id: 'reactome', src: 'reactome', label: 'Pathways', run: async function (s, t) {
    var d = await Net.request('reactome', SRC.reactome.apiBase + '/search/query?' + qs({ query: t, species: 'Homo sapiens', types: 'Pathway', cluster: 'true', rows: 6 }), { signal: s, notFoundEmpty: true, label: 'search/query' });
    var items = []; arr(d && d.results).forEach(function (g) { arr(g.entries).forEach(function (e) { items.push({ title: cxText(e.name), sub: e.stId, url: safeUrl('https://reactome.org/content/detail/' + encodeURIComponent(e.stId)) }); }); });
    return cxOut(d && d.found, items); } },
  { id: 'opentargets', src: 'opentargets', label: 'Targets, diseases and drugs', run: async function (s, t) {
    var d = await Net.request('opentargets', SRC.opentargets.apiBase, { method: 'POST', body: { query: 'query($q:String!){ search(queryString:$q, entityNames:["target","disease","drug"], page:{index:0,size:8}){ total hits{ id entity name description } } }', variables: { q: t } }, signal: s, graphql: true, label: 'search' });
    var r = get(d, 'data.search'); if (!r) throw mkErr('shape', 'opentargets');
    var page = { target: 'target', disease: 'disease', drug: 'drug' }, typ = { target: 'gene', disease: 'disease', drug: 'drug' };
    return cxOut(r.total, arr(r.hits).map(function (h) { return { title: h.name, sub: h.entity + ' · ' + h.id, url: page[h.entity] ? safeUrl('https://platform.opentargets.org/' + page[h.entity] + '/' + encodeURIComponent(h.id)) : linkout('opentargets', t), as: typ[h.entity] ? { term: h.name, type: typ[h.entity] } : null }; })); } },
  { id: 'cbio', src: 'cbioportal', label: 'Cancer genomics studies', run: async function (s, t) {
    var d = await Loaders.cbioStudies(s, t); if (d.empty) return d;
    return cxOut(null, d.items.map(function (x) { return { title: x.name, sub: (x.samples ? num(x.samples) + ' samples · ' : '') + x.id, url: safeUrl('https://www.cbioportal.org/study/summary?id=' + encodeURIComponent(x.id)) }; })); } },
  { id: 'gwas', src: 'gwas', label: 'GWAS associations for this trait', run: async function (s, t) {
    var d = await Net.request('gwas', SRC.gwas.apiBase + '/associations?' + qs({ efo_trait: t, size: 20 }), { signal: s, notFoundEmpty: true, label: 'associations (trait)' });
    // Keep only associations whose trait text actually contains a query word (guards against an ignored filter).
    var w = cxWords(t);
    var list = arr(get(d, '_embedded.associations')).filter(function (a) { var blob = (arr(a.efo_traits).map(function (x) { return x.efo_trait; }).join(' ') + ' ' + arr(a.reported_trait).join(' ')).toLowerCase(); return w.some(function (x) { return blob.indexOf(x) >= 0; }); });
    return cxOut(null, list.map(function (a) { return { title: arr(a.efo_traits).map(function (x) { return x.efo_trait; }).join('; ') || arr(a.reported_trait).join('; '), sub: (a.risk_allele || arr(a.snp_effect_allele).join(', ') || '') + (a.p_value != null ? ' · p=' + a.p_value : ''), url: linkout('gwas', t) }; })); } },
  { id: 'chembl', src: 'chembl', label: 'Molecules', run: async function (s, t) {
    var d = await Net.request('chembl', SRC.chembl.apiBase + '/molecule/search.json?' + qs({ q: t, limit: 6 }), { signal: s, label: 'molecule/search' });
    return cxOut(get(d, 'page_meta.total_count'), arr(d && d.molecules).map(function (m) { return { title: m.pref_name || m.molecule_chembl_id, sub: m.molecule_chembl_id + (m.max_phase != null ? ' · max phase ' + m.max_phase : ''), url: LINK.chembl(m.molecule_chembl_id), as: m.pref_name ? { term: m.pref_name, type: 'drug' } : null }; })); } },
  { id: 'pubchem', src: 'pubchem', label: 'Compound (exact name)', run: async function (s, t) {
    var d = await Loaders.pubchem(s, { drug: t }); if (d.empty) return d;
    return cxOut(1, [{ title: d.props.IUPACName ? cxText(d.props.IUPACName).slice(0, 90) : 'CID ' + d.props.CID, sub: 'CID ' + d.props.CID + (d.props.MolecularFormula ? ' · ' + d.props.MolecularFormula : ''), url: LINK.pubchemCid(d.props.CID) }]); } },
  { id: 'complex', src: 'complex_portal', label: 'Curated protein complexes', run: async function (s, t) {
    var d = await Loaders.complexPortal(s, t); if (d.empty) return d;
    return cxOut(d.total, d.items.map(function (x) { return { title: x.name, sub: x.ac, url: linkout('complex_portal', x.ac) }; })); } },
  { id: 'quickgo', src: 'quickgo', label: 'Gene Ontology terms', run: async function (s, t) {
    var d = await vreq('quickgo', SRC.quickgo.apiBase + '/ontology/go/search?' + qs({ query: t, limit: 6 }), s, 'ontology/go/search');
    return cxOut(d && d.numberOfHits, arr(d && d.results).map(function (x) { return { title: x.name, sub: x.id + (x.aspect ? ' · ' + humanEnum(x.aspect) : ''), url: safeUrl('https://www.ebi.ac.uk/QuickGO/term/' + encodeURIComponent(x.id)) }; })); } },
  { id: 'pdbe', src: 'pdbe', label: 'Experimental structures', run: async function (s, t) {
    var d = await vreq('pdbe', 'https://www.ebi.ac.uk/pdbe/search/pdb/select?' + qs({ q: t, wt: 'json', rows: 6, fl: 'pdb_id,title', group: 'true', 'group.field': 'pdb_id', 'group.ngroups': 'true' }), s, 'search/pdb/select');
    var docs = []; arr(get(d, 'grouped.pdb_id.groups')).forEach(function (g) { var x = first(arr(get(g, 'doclist.docs'))); if (x) docs.push(x); });
    if (!docs.length) docs = arr(get(d, 'response.docs'));
    return cxOut(get(d, 'grouped.pdb_id.ngroups') || get(d, 'response.numFound'), docs.map(function (x) { return { title: String(x.pdb_id || '').toUpperCase() + ' · ' + cxText(x.title), url: safeUrl('https://www.ebi.ac.uk/pdbe/entry/pdb/' + encodeURIComponent(x.pdb_id)) }; })); } },
  { id: 'openalex', src: 'openalex', label: 'Scholarly works', run: async function (s, t) {
    var d = await vreq('openalex', SRC.openalex.apiBase + '/works?' + qs({ search: t, 'per-page': 6, select: 'id,display_name,publication_year,cited_by_count' }), s, 'works?search');
    return cxOut(get(d, 'meta.count'), arr(d && d.results).map(function (w) { return { title: w.display_name, sub: (w.publication_year || '') + (w.cited_by_count != null ? ' · cited ' + num(w.cited_by_count) : ''), url: LINK.openalex(w.id) }; })); } },
  { id: 'crossref', src: 'crossref', label: 'DOI-registered works', run: async function (s, t) {
    var d = await vreq('crossref', SRC.crossref.apiBase + '/works?' + qs({ query: t, rows: 6, select: 'DOI,title,issued,container-title' }), s, 'works?query');
    var m = d && d.message;
    return cxOut(m && m['total-results'], arr(m && m.items).map(function (x) { var y = get(x, 'issued.date-parts.0.0'); return { title: first(arr(x.title)) || x.DOI, sub: (first(arr(x['container-title'])) || '') + (y ? ' · ' + y : ''), url: LINK.doi(x.DOI) }; })); } },
  { id: 's2', src: 'semantic_scholar', label: 'Papers (Semantic Scholar)', run: async function (s, t) {
    var d = await vreq('semantic_scholar', SRC.semantic_scholar.apiBase + '/paper/search?' + qs({ query: t, limit: 6, fields: 'title,year,externalIds' }), s, 'paper/search', { headers: State.keys.s2 ? { 'x-api-key': State.keys.s2 } : null });
    return cxOut(d && d.total, arr(d && d.data).map(function (p) { return { title: p.title, sub: String(p.year || ''), url: LINK.s2(p.paperId) }; })); } },
  // Cascaded: these APIs need an identifier, taken from the top hit of another source.
  { id: 'alphafold', src: 'alphafold', label: 'Predicted structure (top UniProt hit)', from: 'uniprot', run: async function (s, acc) {
    var d = await Loaders.alphafold(s, acc); if (d.empty) return d;
    return cxOut(1, [{ title: (d.model.id || acc) + (d.model.plddt != null ? ' · mean pLDDT ' + Number(d.model.plddt).toFixed(1) : ''), sub: 'Model for ' + acc + ' (predicted, not experimental)', url: linkout('alphafold', acc, true) }]); } },
  { id: 'ebi_proteins', src: 'ebi_proteins', label: 'Protein features (top UniProt hit)', from: 'uniprot', run: async function (s, acc) {
    var d = await Loaders.ebiProteins(s, acc); if (d.empty) return d;
    return cxOut(d.items.length, d.items.filter(function (x) { return x.description || x.type; }).map(function (x) { return { title: humanEnum(x.type || '') + (x.description ? ': ' + x.description : ''), sub: acc + ' ' + (x.begin || '') + '–' + (x.end || ''), url: linkout('ebi_proteins', acc) }; })); } },
  { id: 'dgidb', src: 'dgidb', label: 'Drug–gene interactions (top MyGene hit)', from: 'mygene', run: async function (s, sym) {
    var d = await Loaders.dgidbGene(s, sym); if (d.empty) return d;
    return cxOut(d.total, d.items.map(function (x) { return { title: titleCase(x.drug) + ' → ' + d.gene, sub: x.types.join(', ') || 'interaction type not reported', url: LINK.dgidbGene(d.gene), as: { term: x.drug, type: 'drug' } }; })); } }
];
var CX_BY_ID = {}; CX_ENTRIES.forEach(function (e) { CX_BY_ID[e.id] = e; });
function cxKey(e) { return e.slot || 'cx:' + e.id; }

// Started by executePlan for concept queries.
function startConceptFanout(text) {
  var gen = State.gen;
  CX_ENTRIES.forEach(function (e) {
    if (e.slot || e.from) return;
    load('cx:' + e.id, e.src, async function (s) {
      var d = await e.run(s, text);
      var deps = CX_ENTRIES.filter(function (x) { return x.from === e.id; });
      if (deps.length && d && !d.empty && e.pick) {
        var v = e.pick(d);
        if (v) setTimeout(function () { if (gen !== State.gen) return; deps.forEach(function (x) { load('cx:' + x.id, x.src, function (s2) { return x.run(s2, v); }); }); }, 0);
      }
      return d;
    });
  });
}

function cxRow(e) {
  var s = slot(cxKey(e)), src = SRC[e.src], term = State.ctx ? (State.ctx.concept || State.ctx.label) : '';
  var lo = e.from === 'uniprot' || e.from === 'mygene' ? linkout(e.src, '') : linkout(e.src, term);
  var head = H`<div class="ow-cx-head"><strong>${src ? src.displayName : e.src}</strong> <span class="ow-subtle">${e.label}</span></div>`;
  var foot = lo ? H`<a class="ow-linkbtn ow-small" href="${lo}" target="_blank" rel="noopener noreferrer">Open ${src ? src.displayName : 'source'}<span class="ow-sr"> (opens in a new tab)</span></a>` : '';
  var body;
  if (s.status === 'idle') {
    var parent = e.from ? slot(cxKey(CX_BY_ID[e.from])) : null;
    body = parent && (parent.status === 'loading' || parent.status === 'idle') ? H`<p class="ow-row ow-muted ow-small"><span class="ow-spinner" aria-hidden="true"></span> Waiting for ${SRC[CX_BY_ID[e.from].src].displayName}…</p>` : H`<p class="ow-small ow-muted">No identifier to look up from this query. Use the official source.</p>`;
  } else if (s.status === 'loading') body = H`<p class="ow-row ow-muted ow-small"><span class="ow-spinner" aria-hidden="true"></span> Searching…</p>`;
  else if (s.status === 'ok') {
    var d = e.summ ? e.summ(s.data) : s.data;
    if (!d || d.empty) body = H`<p class="ow-small ow-muted">No records for this term.</p>`;
    else body = H`<div class="ow-small">${badge(num(d.total) + (d.total === 1 ? ' result' : ' results'), 'good')}</div><ul class="ow-cx-list">${d.items.map(function (x) { return H`<li>${x.url ? ext(x.url, x.title) : x.title}${x.sub ? H` <span class="ow-subtle">${x.sub}</span>` : ''}${x.as ? H` <button type="button" class="ow-linkbtn ow-small" data-act="search-as" data-term="${x.as.term}" data-type="${x.as.type}">Search as ${x.as.type}</button>` : ''}</li>`; })}</ul>`;
  } else if (s.status === 'empty') body = H`<p class="ow-small ow-muted">No records for this term.</p>`;
  else body = H`<p class="ow-small ow-muted">Not reachable from this browser right now (${friendlyError(s.error).replace(/\.$/, '')}).</p>`;
  return H`<li class="ow-cx-row" data-status="${s.status}">${head}${body}${foot}</li>`;
}
function conceptFanoutPanel() {
  var c = State.ctx; if (!c || c.type !== 'concept') return '';
  var rows = CX_ENTRIES.filter(function (e) { return !State.prefs.disabledSources.has(e.src); });
  var st = rows.map(function (e) { return slot(cxKey(e)).status; });
  var done = st.filter(function (x) { return x !== 'loading' && x !== 'idle'; }).length, hits = st.filter(function (x) { return x === 'ok'; }).length;
  var liveIds = new Set(CX_ENTRIES.map(function (e) { return e.src; }));
  var los = SOURCES.filter(function (s) { return !liveIds.has(s.id) && ['linkout', 'patient-education'].indexOf(s.defaultMode) >= 0 && s.linkoutSearchUrlTemplate && /\{q\}/.test(s.linkoutSearchUrlTemplate); }).slice(0, 40);
  return H`<div class="ow-card ow-cx-card"><div class="ow-card-head"><div><div class="ow-card-title">${icon('search')} “${c.concept}” across all live sources</div>
      <div class="ow-card-sub">Free-text concept: searched in ${rows.length} live public sources from your browser · ${done} answered · ${hits} with records. Results are listed per source and are not merged or ranked across sources.</div></div></div>
    <ul class="ow-cx-grid">${rows.map(cxRow)}</ul>
    ${los.length ? H`<div class="ow-section"><div class="ow-small"><strong>Also search on official sites</strong> (no browser API):</div><div class="ow-card-foot">${los.map(function (s) { return extBtn(linkout(s.id, c.concept), s.displayName); })}</div></div>` : ''}
    <p class="ow-subtle">Each source answers your exact text with its own search. A match here is a lexical search hit, not an assertion of clinical relevance. Use “Search as …” to re-run the workspace with a specific interpretation.</p></div>`;
}
