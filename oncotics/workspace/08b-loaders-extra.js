
/* ====================================================================
   LOADERS: FINAL CURATED EXTRA LAYER
   All "verify"-mode sources are called ONLY from explicit user actions
   (buttons labeled "Try live request"), with tryVerify:true. Shapes are
   validated; anything missing renders as "Not reported by source".
   No controlled-access data, no keys embedded, nothing persisted.
   ==================================================================== */
var TV = { tryVerify: true };
function vreq(src, url, signal, label, extra) { return Net.request(src, url, Object.assign({ signal: signal, label: label, notFoundEmpty: true }, TV, extra || {})); }

/* ---- OncoTree: cancer-type normalization ---- */
Loaders.oncotree = async function (signal, text) {
  var d = await vreq('oncotree', SRC.oncotree.apiBase + '/tumorTypes/search/name/' + encodeURIComponent(String(text).trim()) + '?exactMatch=false', signal, 'tumorTypes/search/name');
  if (!Array.isArray(d)) { if (d == null) return { empty: true }; throw mkErr('shape', 'oncotree'); }
  var items = d.slice(0, 15).map(function (x) {
    var ext2 = x.externalReferences || {};
    return { code: x.code, name: x.name, mainType: x.mainType, tissue: x.tissue, parent: x.parent, level: x.level, nci: arr(ext2.NCI), umls: arr(ext2.UMLS), color: x.color,
      prov: prov('oncotree', 'tumorTypes/search/name', x.code, LINK.oncotree(x.code), { category: 'ontology-normalized' }) };
  }).filter(function (x) { return x.code && x.name; });
  var low = String(text).toLowerCase();
  items.sort(function (a, b) { return (b.name.toLowerCase() === low) - (a.name.toLowerCase() === low) || (a.level || 9) - (b.level || 9); });
  items.forEach(function (x) { x.confidence = x.name.toLowerCase() === low ? 'Exact' : x.name.toLowerCase().indexOf(low) >= 0 ? 'Likely' : 'Possible'; });
  return items.length ? { items: items } : { empty: true };
};

/* ---- NCI GDC (open-access aggregate only) ---- */
Loaders.gdcGene = async function (signal, gene) {
  var filters = { op: 'in', content: { field: 'ssm.consequence.transcript.gene.symbol', value: [gene] } };
  var d = await vreq('nci_gdc', SRC.nci_gdc.apiBase + '/ssm_occurrences?' + qs({ filters: JSON.stringify(filters), facets: 'case.project.project_id', size: 0 }), signal, 'ssm_occurrences facets');
  var b = arr(get(d, 'data.aggregations') && get(d, 'data.aggregations')['case.project.project_id'] && get(d, 'data.aggregations')['case.project.project_id'].buckets);
  var total = get(d, 'data.pagination.total');
  if (!b.length) return { empty: true, total: total || 0 };
  return { gene: gene, total: total, items: b.slice(0, 25).map(function (x) { return { project: x.key, count: x.doc_count }; }), prov: prov('nci_gdc', 'ssm_occurrences (aggregate facets)', gene, linkout('nci_gdc', ''), { category: 'public-cohort-aggregate' }) };
};
Loaders.gdcProjects = async function (signal, text) {
  var d = await vreq('nci_gdc', SRC.nci_gdc.apiBase + '/projects?' + qs({ size: 100, fields: 'project_id,name,primary_site,disease_type,program.name,summary.case_count', format: 'json' }), signal, 'projects');
  var hits = arr(get(d, 'data.hits'));
  if (!hits.length) return { empty: true };
  var words = String(text || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3 && !/cancer|carcinoma|tumou?r|neoplasm/.test(w); });
  var items = hits.map(function (h) { return { id: h.project_id, name: h.name, sites: arr(h.primary_site), diseases: arr(h.disease_type), program: get(h, 'program.name'), cases: get(h, 'summary.case_count') }; })
    .filter(function (p) { if (!words.length) return true; var blob = (p.name + ' ' + p.sites.join(' ') + ' ' + p.diseases.join(' ')).toLowerCase(); return words.some(function (w) { return blob.indexOf(w) >= 0; }); })
    .sort(function (a, b) { return (b.cases || 0) - (a.cases || 0); }).slice(0, 25);
  return items.length ? { items: items, prov: prov('nci_gdc', 'projects', null, linkout('nci_gdc', ''), { category: 'public-cohort-aggregate', confidence: 'Possible' }) } : { empty: true };
};

/* ---- DGIdb 5 (GraphQL) ---- */
function dgidbGQL(query, variables, signal, label) {
  return Net.request('dgidb', SRC.dgidb.apiBase, Object.assign({ method: 'POST', body: { query: query, variables: variables }, signal: signal, graphql: true, label: label }, TV))
    .then(function (d) { if (!d || !d.data) throw mkErr('shape', 'dgidb'); return d.data; });
}
Loaders.dgidbGene = async function (signal, gene) {
  var d = await dgidbGQL('query($n:[String!]){ genes(names:$n){ nodes{ name longName interactions{ interactionScore interactionTypes{ type directionality } drug{ name conceptId approved } publications{ pmid } sources{ sourceDbName } } } } }', { n: [String(gene).toUpperCase()] }, signal, 'genes.interactions');
  var node = first(arr(get(d, 'genes.nodes'))); if (!node) return { empty: true };
  var items = arr(node.interactions).map(function (i) { return { drug: get(i, 'drug.name'), conceptId: get(i, 'drug.conceptId'), approved: get(i, 'drug.approved'), score: i.interactionScore, types: arr(i.interactionTypes).map(function (t) { return t.type + (t.directionality ? ' (' + t.directionality + ')' : ''); }), pmids: arr(i.publications).map(function (p) { return p.pmid; }).filter(Boolean).slice(0, 8), sources: arr(i.sources).map(function (s) { return s.sourceDbName; }) }; })
    .filter(function (x) { return x.drug; }).sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
  return items.length ? { gene: node.name, longName: node.longName, items: items, total: items.length, prov: prov('dgidb', 'genes.interactions', node.name, LINK.dgidbGene(node.name), { category: 'druggability-annotation' }) } : { empty: true };
};
Loaders.dgidbDrug = async function (signal, drug) {
  var d = await dgidbGQL('query($n:[String!]){ drugs(names:$n){ nodes{ name conceptId approved interactions{ interactionScore interactionTypes{ type directionality } gene{ name longName conceptId } sources{ sourceDbName } } } } }', { n: [String(drug).toUpperCase()] }, signal, 'drugs.interactions');
  var node = first(arr(get(d, 'drugs.nodes'))); if (!node) return { empty: true };
  var items = arr(node.interactions).map(function (i) { return { gene: get(i, 'gene.name'), longName: get(i, 'gene.longName'), score: i.interactionScore, types: arr(i.interactionTypes).map(function (t) { return t.type; }), sources: arr(i.sources).map(function (s) { return s.sourceDbName; }) }; })
    .filter(function (x) { return x.gene; }).sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
  return items.length ? { drug: node.name, approved: node.approved, items: items, total: items.length, prov: prov('dgidb', 'drugs.interactions', node.conceptId, LINK.dgidbDrug(node.name), { category: 'druggability-annotation' }) } : { empty: true };
};

/* ---- Complex Portal, QuickGO, PDBe, EBI Proteins ---- */
Loaders.complexPortal = async function (signal, gene) {
  var d = await vreq('complex_portal', SRC.complex_portal.apiBase + '/search/' + encodeURIComponent(gene) + '?' + qs({ format: 'json', first: 0, number: 15, filters: 'species_f:("Homo sapiens")' }), signal, 'search');
  var els = arr(d && d.elements); if (!els.length) return { empty: true };
  return { total: d.totalNumberOfResults, items: els.map(function (e) { return { ac: e.complexAC, name: e.complexName, organism: e.organismName, description: e.description, predicted: e.predictedComplex }; }), prov: prov('complex_portal', 'search', gene, linkout('complex_portal', gene), { category: 'curated-interaction' }) };
};
Loaders.quickgo = async function (signal, acc) {
  var d = await vreq('quickgo', SRC.quickgo.apiBase + '/annotation/search?' + qs({ geneProductId: acc, includeFields: 'goName', limit: 100 }), signal, 'annotation/search');
  var r = arr(d && d.results); if (!r.length) return { empty: true };
  var by = { biological_process: [], molecular_function: [], cellular_component: [] };
  var seen = new Set();
  r.forEach(function (x) { var k = x.goId + '|' + x.goEvidence; if (seen.has(k)) return; seen.add(k); (by[x.goAspect] || (by[x.goAspect] = [])).push({ id: x.goId, name: x.goName, evidence: x.goEvidence, qualifier: x.qualifier, reference: x.reference, assignedBy: x.assignedBy }); });
  return { acc: acc, total: d.numberOfHits, by: by, prov: prov('quickgo', 'annotation/search', acc, linkout('quickgo', acc), { category: 'source-reported' }) };
};
Loaders.pdbe = async function (signal, acc) {
  var d = await vreq('pdbe', SRC.pdbe.apiBase + '/mappings/best_structures/' + encodeURIComponent(acc), signal, 'mappings/best_structures');
  var list = d && arr(d[acc]); if (!list.length) return { empty: true };
  return { acc: acc, items: list.slice(0, 40).map(function (x) { return { pdb: x.pdb_id, chain: x.chain_id, coverage: x.coverage, resolution: x.resolution, method: x.experimental_method, start: x.unp_start, end: x.unp_end }; }), total: list.length, prov: prov('pdbe', 'mappings/best_structures', acc, linkout('pdbe', acc), { category: 'source-reported' }) };
};
Loaders.ebiProteins = async function (signal, acc) {
  var d = await vreq('ebi_proteins', SRC.ebi_proteins.apiBase + '/features/' + encodeURIComponent(acc) + '?' + qs({ categories: 'DOMAINS_AND_SITES,MOLECULE_PROCESSING' }), signal, 'features');
  var f = arr(d && d.features); if (!f.length) return { empty: true };
  return { acc: acc, items: f.slice(0, 120).map(function (x) { return { type: x.type, category: x.category, description: x.description, begin: x.begin, end: x.end, evidence: arr(x.evidences).length }; }), prov: prov('ebi_proteins', 'features', acc, linkout('ebi_proteins', acc), { category: 'source-reported' }) };
};

/* ---- Citation intelligence: OpenAlex, Crossref, Semantic Scholar ---- */
function oaWork(w) {
  var inst = []; arr(w.authorships).forEach(function (a) { arr(a.institutions).forEach(function (i) { if (i && i.display_name) inst.push({ name: i.display_name, country: i.country_code || null, ror: i.ror || null }); }); });
  return { id: w.id, title: w.display_name || w.title, year: w.publication_year, cited: w.cited_by_count, refs: w.referenced_works_count, oa: get(w, 'open_access.is_oa'), oaUrl: get(w, 'open_access.oa_url'), doi: w.doi, pmid: get(w, 'ids.pmid'), type: w.type,
    institutions: uniq(inst.map(function (x) { return JSON.stringify(x); })).map(function (x) { return JSON.parse(x); }).slice(0, 60), topics: arr(w.topics).slice(0, 5).map(function (t) { return t.display_name; }), countsByYear: arr(w.counts_by_year).slice(0, 8) };
}
Loaders.openalexWork = async function (signal, p) {
  var id = p.pmid ? 'pmid:' + p.pmid : (p.doi ? 'doi:' + p.doi : null); if (!id) return { empty: true };
  var d = await vreq('openalex', SRC.openalex.apiBase + '/works/' + id, signal, 'works/{id}');
  if (!d || !d.id) return { empty: true };
  return { work: oaWork(d), prov: prov('openalex', 'works/{id}', d.id, LINK.openalex(d.id), { category: 'citation-metadata' }) };
};
// Institutions (with country codes) for the currently loaded literature page: one request.
Loaders.openalexInstitutions = async function (signal, pmids) {
  pmids = uniq(arr(pmids).filter(function (x) { return /^\d{1,9}$/.test(String(x)); })).slice(0, 25);
  if (!pmids.length) return { empty: true };
  var d = await vreq('openalex', SRC.openalex.apiBase + '/works?' + qs({ filter: 'pmid:' + pmids.join('|'), 'per-page': 25, select: 'id,display_name,publication_year,ids,authorships' }), signal, 'works?filter=pmid');
  var res = arr(d && d.results); if (!res.length) return { empty: true };
  return { items: res.map(oaWork), prov: prov('openalex', 'works?filter=pmid', null, linkout('openalex', ''), { category: 'citation-metadata' }) };
};
Loaders.crossref = async function (signal, doi) {
  var d = await vreq('crossref', SRC.crossref.apiBase + '/works/' + String(doi).split('/').map(encodeURIComponent).join('/'), signal, 'works/{doi}');
  var m = d && d.message; if (!m) return { empty: true };
  var dp = get(m, 'published.date-parts') || get(m, 'issued.date-parts');
  return { doi: m.DOI, title: first(arr(m.title)), journal: first(arr(m['container-title'])), publisher: m.publisher, type: m.type, year: dp && dp[0] ? dp[0][0] : null, cited: m['is-referenced-by-count'], refs: m['references-count'],
    licenses: arr(m.license).map(function (l) { return l.URL; }).slice(0, 3), funders: arr(m.funder).map(function (f) { return f.name; }).slice(0, 6), prov: prov('crossref', 'works/{doi}', m.DOI, LINK.doi(m.DOI), { category: 'citation-metadata' }) };
};
Loaders.semanticScholar = async function (signal, p) {
  var id = p.pmid ? 'PMID:' + p.pmid : (p.doi ? 'DOI:' + p.doi : null); if (!id) return { empty: true };
  // tldr (an AI-generated summary) is deliberately NOT requested: Oncotics does not show unsourced AI summaries.
  var fields = 'title,year,citationCount,influentialCitationCount,referenceCount,isOpenAccess,externalIds,references.title,references.year,references.externalIds,citations.title,citations.year,citations.externalIds';
  var d = await vreq('semantic_scholar', SRC.semantic_scholar.apiBase + '/paper/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent(fields), signal, 'paper/{id}', { headers: State.keys.s2 ? { 'x-api-key': State.keys.s2 } : null });
  if (!d || !d.paperId) return { empty: true };
  var mapP = function (x) { return { title: x.title, year: x.year, pmid: get(x, 'externalIds.PubMed'), doi: get(x, 'externalIds.DOI') }; };
  return { id: d.paperId, title: d.title, year: d.year, cited: d.citationCount, influential: d.influentialCitationCount, refs: d.referenceCount, oa: d.isOpenAccess,
    references: arr(d.references).filter(function (x) { return x.title; }).slice(0, 10).map(mapP), citations: arr(d.citations).filter(function (x) { return x.title; }).slice(0, 10).map(mapP),
    prov: prov('semantic_scholar', 'paper/{id}', d.paperId, LINK.s2(d.paperId), { category: 'citation-metadata' }) };
};

/* ---- Vaccines: openFDA biologic/vaccine labels (where returned) ---- */
Loaders.vaccineLabels = async function (signal, ctx) {
  var v = ctx.vaccine || {}; var products = arr(v.products); if (!products.length) return { empty: true };
  var d = await Loaders.drugLabels(signal, { drug: products[0].toLowerCase(), extraTerms: products.slice(1).map(function (x) { return x.toLowerCase(); }) });
  if (!d || d.empty) return { empty: true };
  d.items.forEach(function (r) { r.type = 'vaccine-label'; r.prov.category = 'vaccine-label-section'; });
  return d;
};

/* ---- Onco-Fertility: structured reproductive adverse-event TERMS (counts only; no narratives) ---- */
var REPRO_PT = /AMENORRH|INFERTIL|AZOOSPERM|OLIGOSPERM|OVARIAN FAILURE|PREMATURE OVARIAN|OVARIAN INSUFFICIENCY|PREMATURE MENOPAUSE|MENOPAUS|MENSTRUA|HYPOGONADISM|TESTICULAR|SPERM|EJACULAT|ABORTION|MISCARR|FOETAL|FETAL|PREGNANCY|CONGENITAL|TERATO|PREMATURE BABY|STILLBIRTH|LACTATION|BREAST FEEDING|EXPOSURE VIA BREAST MILK|MATERNAL EXPOSURE|PATERNAL EXPOSURE/;
Loaders.reproAE = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var search = [fOR('patient.drug.openfda.generic_name', terms), fOR('patient.drug.openfda.brand_name', terms)].join('+');
  var d = await fdaGet('openfda-drug', '/drug/event.json', search, 'count=patient.reaction.reactionmeddrapt.exact&limit=1000', signal, 'drug/event count (reproductive terms)');
  var res = arr(d && d.results); if (!res.length) return { empty: true };
  var items = res.filter(function (x) { return REPRO_PT.test(String(x.term || '').toUpperCase()); }).slice(0, 30).map(function (x) { return { term: x.term, count: x.count }; });
  return items.length ? { items: items, scanned: res.length, prov: prov('openfda-drug', 'drug/event (count of reaction terms)', null, linkout('faers', ''), { category: 'structured-reproductive-adverse-event-term' }) } : { empty: true, scanned: res.length };
};

/* ---- OncoKB (authenticated-optional; feature-flagged OFF by default) ---- */
Loaders.oncokb = async function (signal, ctx) {
  if (!CONFIG.features.oncokbAuthenticated) throw mkErr('linkout', 'oncokb');
  if (!State.keys.oncokb) throw mkErr('auth', 'oncokb');
  if (!ctx || !ctx.gene || !ctx.change) return { empty: true };
  var rt = Runtime.oncokb; rt.mode = 'verify';
  var d = await Net.request('oncokb', SRC.oncokb.apiBase + '/annotate/mutations/byProteinChange?' + qs({ hugoSymbol: ctx.gene, alteration: ctx.change.label, referenceGenome: 'GRCh37' }), { signal: signal, tryVerify: true, noCache: true, label: 'annotate/mutations/byProteinChange', headers: { Authorization: 'Bearer ' + State.keys.oncokb } });
  if (!d) return { empty: true };
  return { licensed: true, oncogenic: d.oncogenic, effect: get(d, 'mutationEffect.knownEffect'), highestSensitive: d.highestSensitiveLevel, highestResistance: d.highestResistanceLevel, dataVersion: d.dataVersion, lastUpdate: d.lastUpdate,
    treatments: arr(d.treatments).slice(0, 20).map(function (t) { return { drugs: arr(t.drugs).map(function (x) { return x.drugName; }).join(' + '), level: t.level, cancer: get(t, 'levelAssociatedCancerType.name') }; }),
    prov: prov('oncokb', 'annotate/mutations/byProteinChange', ctx.gene + ' ' + ctx.change.label, linkout('oncokb', ctx.gene), { category: 'expert-curated-license-restricted' }) };
};
