
/* ====================================================================
   MODULE 12: ADVANCED QUERY (explicit Run; raw request preview)
   Hosts are fixed per resource; users edit documented parameters only.
   ==================================================================== */
function fdaEnc(v) { return String(v || '').trim().split('').map(function (ch) { return ch === ' ' ? '+' : (/[A-Za-z0-9._\-*+:\[\]]/.test(ch) ? ch : encodeURIComponent(ch)); }).join(''); }
var FDA_PARAMS = [{ id: 'search', label: 'search (openFDA syntax)', ph: 'field:"value"+AND+field2:"value"' }, { id: 'count', label: 'count field (optional)', ph: 'e.g. event_type.exact' }, { id: 'sort', label: 'sort (optional)', ph: 'e.g. decision_date:desc' }, { id: 'limit', label: 'limit (1-100)', def: '10' }, { id: 'skip', label: 'skip', def: '0' }];
function fdaBuild(path, src) { return function (v) { var p = []; if (v.search) p.push('search=' + fdaEnc(v.search)); if (v.count) p.push('count=' + encodeURIComponent(v.count)); if (v.sort) p.push('sort=' + encodeURIComponent(v.sort)); if (!v.count) { p.push('limit=' + Math.min(100, Math.max(1, parseInt(v.limit || '10', 10) || 10))); if (v.skip && v.skip !== '0') p.push('skip=' + (parseInt(v.skip, 10) || 0)); } return { src: src, url: 'https://api.fda.gov' + path + '?' + p.join('&') }; }; }
function civicTpl(q) { return [{ id: 'gql', label: 'GraphQL query (read-only)', area: true, def: q }]; }
var ADV = [
  { id: 'civic-gene', label: 'CIViC gene', params: civicTpl('{ gene(entrezSymbol:"EGFR"){ id name fullName description link featureAliases } }') },
  { id: 'civic-variant', label: 'CIViC variant', params: civicTpl('{ browseVariants(variantName:"V600E", featureName:"BRAF", first:10){ totalCount nodes{ id name link } } }') },
  { id: 'civic-evidence', label: 'CIViC evidence', params: civicTpl('{ evidenceItems(molecularProfileName:"BRAF V600E", status:ACCEPTED, first:10){ totalCount nodes{ id name evidenceLevel significance disease{ name } therapies{ name } } } }') },
  { id: 'civic-assertion', label: 'CIViC assertion', params: civicTpl('{ assertions(molecularProfileName:"BRAF V600E", first:10){ totalCount nodes{ id name ampLevel summary } } }') },
  { id: 'civic-therapy', label: 'CIViC therapy', params: civicTpl('{ therapies(name:"Osimertinib", first:5){ nodes{ id name ncitId link } } }') },
  { id: 'civic-disease', label: 'CIViC disease', params: civicTpl('{ diseases(name:"Melanoma", first:5){ nodes{ id name doid link } } }') },
  { id: 'civic-source', label: 'CIViC source', params: civicTpl('{ sources(citationId:["27283860"], first:5){ nodes{ id citation citationId sourceType link } } }') },
  { id: 'ctgov', label: 'ClinicalTrials.gov studies', params: [{ id: 'query.term', label: 'query.term' }, { id: 'query.cond', label: 'query.cond' }, { id: 'query.intr', label: 'query.intr' }, { id: 'query.spons', label: 'query.spons' }, { id: 'query.locn', label: 'query.locn' }, { id: 'filter.overallStatus', label: 'filter.overallStatus', ph: 'RECRUITING,NOT_YET_RECRUITING' }, { id: 'filter.advanced', label: 'filter.advanced (Essie)', ph: 'AREA[Phase]PHASE3' }, { id: 'sort', label: 'sort', def: '@relevance' }, { id: 'pageSize', label: 'pageSize', def: '10' }, { id: 'fields', label: 'fields', def: 'NCTId,BriefTitle,OverallStatus,Phase' }],
    build: function (v) { var p = Object.assign({ format: 'json', countTotal: 'true' }, v); return { src: 'ctgov', url: SRC.ctgov.apiBase + '/studies?' + qs(p) }; } },
  { id: 'fda-label', label: 'openFDA drug label', params: FDA_PARAMS, build: fdaBuild('/drug/label.json', 'openfda-drug') },
  { id: 'fda-drugsfda', label: 'openFDA drug approval (Drugs@FDA)', params: FDA_PARAMS, build: fdaBuild('/drug/drugsfda.json', 'openfda-drug') },
  { id: 'fda-drugevent', label: 'openFDA drug adverse event', params: FDA_PARAMS, build: fdaBuild('/drug/event.json', 'openfda-drug') },
  { id: 'fda-drugenf', label: 'openFDA drug enforcement', params: FDA_PARAMS, build: fdaBuild('/drug/enforcement.json', 'openfda-drug') },
  { id: 'fda-devevent', label: 'openFDA device adverse event (MAUDE)', params: FDA_PARAMS, build: fdaBuild('/device/event.json', 'openfda-device'), narrativeWarning: true },
  { id: 'fda-devenf', label: 'openFDA device enforcement', params: FDA_PARAMS, build: fdaBuild('/device/enforcement.json', 'openfda-device') },
  { id: 'fda-devrecall', label: 'openFDA device recall', params: FDA_PARAMS, build: fdaBuild('/device/recall.json', 'openfda-device') },
  { id: 'fda-510k', label: 'openFDA device 510(k) / De Novo', params: FDA_PARAMS, build: fdaBuild('/device/510k.json', 'openfda-device') },
  { id: 'fda-pma', label: 'openFDA device PMA', params: FDA_PARAMS, build: fdaBuild('/device/pma.json', 'openfda-device') },
  { id: 'fda-class', label: 'openFDA device classification', params: FDA_PARAMS, build: fdaBuild('/device/classification.json', 'openfda-device') },
  { id: 'fda-udi', label: 'openFDA device UDI', params: FDA_PARAMS, build: fdaBuild('/device/udi.json', 'openfda-device') },
  { id: 'fda-reglist', label: 'openFDA device registration & listing', params: FDA_PARAMS, build: fdaBuild('/device/registrationlisting.json', 'openfda-device') },
  { id: 'ensembl-gene', label: 'Ensembl gene lookup', params: [{ id: 'symbol', label: 'Symbol or stable ID', def: 'EGFR' }], build: function (v) { var s = v.symbol || ''; return { src: 'ensembl', url: SRC.ensembl.apiBase + (/^ENS/i.test(s) ? '/lookup/id/' : '/lookup/symbol/homo_sapiens/') + encodeURIComponent(s) + '?content-type=application/json' }; } },
  { id: 'ensembl-vep', label: 'Ensembl VEP', params: [{ id: 'input', label: 'rsID or transcript HGVS', def: 'rs113488022' }], build: function (v) { var s = v.input || ''; return { src: 'ensembl', url: SRC.ensembl.apiBase + (/^rs\d+$/i.test(s) ? '/vep/human/id/' : '/vep/human/hgvs/') + encodeURIComponent(s) + '?content-type=application/json&canonical=1' + (/^(NM|XM)_/.test(s) ? '&refseq=1' : '') }; } },
  { id: 'mygene', label: 'MyGene.info query', params: [{ id: 'q', label: 'q', def: 'symbol:EGFR' }, { id: 'species', label: 'species', def: 'human' }, { id: 'fields', label: 'fields', def: 'symbol,name,summary' }, { id: 'size', label: 'size', def: '5' }], build: function (v) { return { src: 'mygene', url: SRC.mygene.apiBase + '/query?' + qs(v) }; } },
  { id: 'myvariant', label: 'MyVariant.info query', params: [{ id: 'q', label: 'q', def: 'dbsnp.rsid:rs113488022' }, { id: 'fields', label: 'fields', def: 'dbsnp.rsid,clinvar.rcv.clinical_significance,cadd.phred' }, { id: 'size', label: 'size', def: '5' }], build: function (v) { return { src: 'myvariant', url: SRC.myvariant.apiBase + '/query?' + qs(v) }; } },
  { id: 'uniprot', label: 'UniProt search', params: [{ id: 'query', label: 'query', def: 'gene_exact:EGFR AND organism_id:9606 AND reviewed:true' }, { id: 'fields', label: 'fields', def: 'accession,protein_name,length' }, { id: 'size', label: 'size', def: '5' }], build: function (v) { return { src: 'uniprot', url: SRC.uniprot.apiBase + '/uniprotkb/search?' + qs(Object.assign({ format: 'json' }, v)) }; } },
  { id: 'europepmc', label: 'Europe PMC search', params: [{ id: 'query', label: 'query', def: 'BRAF AND V600E' }, { id: 'pageSize', label: 'pageSize', def: '10' }, { id: 'sort', label: 'sort', ph: 'CITED desc' }, { id: 'resultType', label: 'resultType', def: 'lite' }], build: function (v) { return { src: 'europepmc', url: SRC.europepmc.apiBase + '/search?' + qs(Object.assign({ format: 'json' }, v)) }; } },
  { id: 'rxnorm', label: 'RxNorm drugs', params: [{ id: 'name', label: 'name', def: 'osimertinib' }], build: function (v) { return { src: 'rxnorm', url: SRC.rxnorm.apiBase + '/drugs.json?' + qs(v) }; } },
  { id: 'string', label: 'STRING interaction partners', params: [{ id: 'identifiers', label: 'identifiers', def: 'EGFR' }, { id: 'limit', label: 'limit', def: '10' }], build: function (v) { return { src: 'string', url: SRC.string.apiBase + '/json/interaction_partners?' + qs(Object.assign({ species: 9606, caller_identity: CONFIG.host }, v)) }; } },
  { id: 'reactome', label: 'Reactome pathways for UniProt accession', params: [{ id: 'acc', label: 'UniProt accession', def: 'P00533' }], build: function (v) { return { src: 'reactome', url: SRC.reactome.apiBase + '/data/mapping/UniProt/' + encodeURIComponent(v.acc || '') + '/pathways?species=9606' }; } },
  { id: 'alphafold', label: 'AlphaFold prediction', params: [{ id: 'acc', label: 'UniProt accession', def: 'P00533' }], build: function (v) { return { src: 'alphafold', url: SRC.alphafold.apiBase + '/prediction/' + encodeURIComponent(v.acc || '') }; } },
  { id: 'opentargets', label: 'Open Targets GraphQL', params: [{ id: 'gql', label: 'GraphQL query (read-only)', area: true, def: '{ target(ensemblId:"ENSG00000146648"){ approvedSymbol associatedDiseases(page:{index:0,size:5}){ rows{ score disease{ name } } } } }' }] },
  { id: 'cbioportal', label: 'cBioPortal studies', params: [{ id: 'keyword', label: 'keyword', def: 'lung' }, { id: 'pageSize', label: 'pageSize', def: '10' }], build: function (v) { return { src: 'cbioportal', url: SRC.cbioportal.apiBase + '/studies?' + qs(Object.assign({ projection: 'SUMMARY' }, v)) }; } },
  { id: 'gwas', label: 'GWAS Catalog associations', params: [{ id: 'rs_id', label: 'rs_id', def: 'rs7903146' }, { id: 'size', label: 'size', def: '10' }], build: function (v) { return { src: 'gwas', url: SRC.gwas.apiBase + '/associations?' + qs(v) }; } },
  { id: 'chembl', label: 'ChEMBL molecule search', params: [{ id: 'q', label: 'q', def: 'osimertinib' }, { id: 'limit', label: 'limit', def: '5' }], build: function (v) { return { src: 'chembl', url: SRC.chembl.apiBase + '/molecule/search.json?' + qs(v) }; } },
  { id: 'pubchem', label: 'PubChem compound properties', params: [{ id: 'name', label: 'compound name', def: 'osimertinib' }, { id: 'props', label: 'properties', def: 'MolecularFormula,MolecularWeight' }], build: function (v) { return { src: 'pubchem', url: SRC.pubchem.apiBase + '/compound/name/' + encodeURIComponent(v.name || '') + '/property/' + encodeURIComponent(v.props || 'MolecularFormula').replace(/%2C/g, ',') + '/JSON' }; } },
  { id: 'ols', label: 'EBI OLS search', params: [{ id: 'q', label: 'q', def: 'melanoma' }, { id: 'ontology', label: 'ontology', def: 'mondo,ncit' }, { id: 'rows', label: 'rows', def: '5' }], build: function (v) { return { src: 'ols', url: SRC.ols.apiBase + '/search?' + qs(v) }; } }
];
// Final curated extra layer (API resources run live) + link-out builders.
function loBuild(src, tpl) { return function (v) { return { src: src, url: tpl ? safeUrl(tpl.replace('{q}', encodeURIComponent(v.q || ''))) : linkout(src, v.q || ''), linkout: true }; }; }
ADV.push(
  { id: 'fda-vaccine-label', label: 'openFDA biologic / vaccine label (where returned)', params: [{ id: 'search', label: 'search', def: 'openfda.brand_name:"GARDASIL 9"' }, { id: 'limit', label: 'limit', def: '5' }], build: fdaBuild('/drug/label.json', 'openfda-drug') },
  { id: 'oncotree', label: 'OncoTree tumor type search', params: [{ id: 'q', label: 'name contains', def: 'melanoma' }], build: function (v) { return { src: 'oncotree', url: SRC.oncotree.apiBase + '/tumorTypes/search/name/' + encodeURIComponent(v.q || '') + '?exactMatch=false' }; } },
  { id: 'gdc', label: 'NCI GDC projects (open access)', params: [{ id: 'size', label: 'size', def: '20' }, { id: 'fields', label: 'fields', def: 'project_id,name,primary_site,disease_type,summary.case_count' }], build: function (v) { return { src: 'nci_gdc', url: SRC.nci_gdc.apiBase + '/projects?' + qs(Object.assign({ format: 'json' }, v)) }; } },
  { id: 'dgidb', label: 'DGIdb GraphQL', params: [{ id: 'gql', label: 'GraphQL query (read-only)', area: true, def: '{ genes(names:["EGFR"]){ nodes{ name interactions{ interactionScore drug{ name approved } interactionTypes{ type } } } } }' }] },
  { id: 'complex', label: 'Complex Portal search', params: [{ id: 'q', label: 'query', def: 'BRCA1' }], build: function (v) { return { src: 'complex_portal', url: SRC.complex_portal.apiBase + '/search/' + encodeURIComponent(v.q || '') + '?format=json&first=0&number=10' }; } },
  { id: 'quickgo', label: 'QuickGO annotations', params: [{ id: 'geneProductId', label: 'geneProductId (UniProt)', def: 'P00533' }, { id: 'limit', label: 'limit', def: '25' }, { id: 'includeFields', label: 'includeFields', def: 'goName' }], build: function (v) { return { src: 'quickgo', url: SRC.quickgo.apiBase + '/annotation/search?' + qs(v) }; } },
  { id: 'pdbe', label: 'PDBe best structures', params: [{ id: 'acc', label: 'UniProt accession', def: 'P00533' }], build: function (v) { return { src: 'pdbe', url: SRC.pdbe.apiBase + '/mappings/best_structures/' + encodeURIComponent(v.acc || '') }; } },
  { id: 'ebi-proteins', label: 'EBI Proteins features', params: [{ id: 'acc', label: 'UniProt accession', def: 'P00533' }, { id: 'categories', label: 'categories', def: 'DOMAINS_AND_SITES' }], build: function (v) { return { src: 'ebi_proteins', url: SRC.ebi_proteins.apiBase + '/features/' + encodeURIComponent(v.acc || '') + '?' + qs({ categories: v.categories }) }; } },
  { id: 'openalex', label: 'OpenAlex works', params: [{ id: 'search', label: 'search', def: 'osimertinib' }, { id: 'per-page', label: 'per-page', def: '10' }, { id: 'select', label: 'select', def: 'id,display_name,publication_year,cited_by_count' }], build: function (v) { return { src: 'openalex', url: SRC.openalex.apiBase + '/works?' + qs(v) }; } },
  { id: 'crossref', label: 'Crossref work by DOI', params: [{ id: 'doi', label: 'DOI', def: '10.1056/NEJMoa1713137' }], build: function (v) { return { src: 'crossref', url: SRC.crossref.apiBase + '/works/' + String(v.doi || '').split('/').map(encodeURIComponent).join('/') }; } },
  { id: 's2', label: 'Semantic Scholar paper', params: [{ id: 'id', label: 'paper id', def: 'PMID:29151359' }, { id: 'fields', label: 'fields', def: 'title,year,citationCount,referenceCount' }], build: function (v) { return { src: 'semantic_scholar', url: SRC.semantic_scholar.apiBase + '/paper/' + encodeURIComponent(v.id || '') + '?fields=' + encodeURIComponent(v.fields || 'title') }; } },
  { id: 'lo-clingen', label: 'Link-out builder: ClinGen / GenCC', params: [{ id: 'q', label: 'gene', def: 'BRCA1' }], build: loBuild('clingen_gencc') },
  { id: 'lo-hotspots', label: 'Link-out builder: Cancer Hotspots', params: [{ id: 'q', label: 'gene', def: 'KRAS' }], build: loBuild('cancer_hotspots') },
  { id: 'lo-pathways', label: 'Link-out builder: Pathway Commons', params: [{ id: 'q', label: 'gene or pathway', def: 'EGFR' }], build: loBuild('pathway_commons') },
  { id: 'lo-wikipathways', label: 'Link-out builder: WikiPathways', params: [{ id: 'q', label: 'query', def: 'EGFR' }], build: loBuild('wikipathways') },
  { id: 'lo-biogrid', label: 'Link-out builder: BioGRID', params: [{ id: 'q', label: 'gene', def: 'TP53' }], build: loBuild('biogrid') },
  { id: 'lo-intact', label: 'Link-out builder: IntAct', params: [{ id: 'q', label: 'gene or protein', def: 'EGFR' }], build: loBuild('intact') },
  { id: 'lo-hpa', label: 'Link-out builder: Human Protein Atlas', params: [{ id: 'q', label: 'gene', def: 'EGFR' }], build: loBuild('hpa') },
  { id: 'lo-gtex', label: 'Link-out builder: GTEx', params: [{ id: 'q', label: 'gene', def: 'EGFR' }], build: loBuild('gtex') },
  { id: 'lo-gxa', label: 'Link-out builder: Expression Atlas', params: [{ id: 'q', label: 'gene', def: 'EGFR' }], build: loBuild('gxa') },
  { id: 'lo-pharmgkb', label: 'Link-out builder: PharmGKB / ClinPGx', params: [{ id: 'q', label: 'gene or drug', def: 'DPYD' }], build: loBuild('pharmgkb') },
  { id: 'lo-cpic', label: 'Link-out builder: CPIC guidelines', params: [{ id: 'q', label: '(guideline list)', def: '' }], build: loBuild('cpic') },
  { id: 'lo-oncokb', label: 'Link-out builder: OncoKB (license terms)', params: [{ id: 'q', label: 'gene', def: 'BRAF' }], build: loBuild('oncokb') },
  { id: 'lo-oncolink', label: 'Link-out builder: OncoLink (patient education)', params: [{ id: 'q', label: 'topic', def: 'breast cancer' }], build: loBuild('oncolink') },
  { id: 'lo-ccai', label: 'Link-out: Cure Cancer With AI developers (verify-only)', params: [{ id: 'q', label: '(no query)', def: '' }], build: loBuild('cure_cancer_with_ai_dev') },
  { id: 'lo-openonco', label: 'Link-out: OpenOnco repository (developer reference)', params: [{ id: 'q', label: '(no query)', def: '' }], build: loBuild('openonco_github') },
  { id: 'lo-vaers', label: 'Link-out: VAERS data (passive surveillance)', params: [{ id: 'q', label: '(no query)', def: '' }], build: loBuild('cdc_vaers') },
  { id: 'lo-cber', label: 'Link-out builder: FDA CBER / DailyMed', params: [{ id: 'q', label: 'product (DailyMed search)', def: 'Gardasil' }], build: loBuild('dailymed') },
  { id: 'lo-regulators', label: 'Link-out builder: EMA', params: [{ id: 'q', label: 'product', def: 'pembrolizumab' }], build: loBuild('ema') },
  { id: 'lo-mhra', label: 'Link-out builder: MHRA products', params: [{ id: 'q', label: 'product', def: 'pembrolizumab' }], build: loBuild('mhra') },
  { id: 'lo-tga', label: 'Link-out builder: TGA ARTG', params: [{ id: 'q', label: 'product', def: 'pembrolizumab' }], build: loBuild('tga') },
  { id: 'lo-who', label: 'Link-out: WHO vaccines', params: [{ id: 'q', label: '(no query)', def: '' }], build: loBuild('who_vaccines') },
  { id: 'lo-hc', label: 'Link-out: Health Canada Drug Product Database', params: [{ id: 'q', label: '(search on site)', def: '' }], build: loBuild('health_canada_dpd') },
  { id: 'lo-pmda', label: 'Link-out: PMDA', params: [{ id: 'q', label: '(search on site)', def: '' }], build: loBuild('pmda') },
  { id: 'lo-nmpa', label: 'Link-out: NMPA', params: [{ id: 'q', label: '(search on site)', def: '' }], build: loBuild('nmpa') },
  { id: 'lo-imaging', label: 'Imaging: OHIF / DICOMweb connection (separate Imaging Workbench page)', params: [{ id: 'q', label: '(opens the Imaging Workbench)', def: '' }], build: function () { return { src: 'ohif_viewer', url: safeUrl(CONFIG.imagingUrl), linkout: true }; } }
);
ADV.forEach(function (r) {
  if (r.id === 'dgidb') r.build = function (v) { return { src: 'dgidb', url: SRC.dgidb.apiBase, method: 'POST', body: { query: v.gql || '' } }; };
  if (/^civic/.test(r.id)) r.build = function (v) { return { src: 'civic', url: SRC.civic.apiBase, method: 'POST', body: { query: v.gql || '' } }; };
  if (r.id === 'opentargets') r.build = function (v) { return { src: 'opentargets', url: SRC.opentargets.apiBase, method: 'POST', body: { query: v.gql || '' } }; };
});
function advValues(res) { var u = ui('advanced'); u.values = u.values || {}; if (!u.values[res.id]) { u.values[res.id] = {}; res.params.forEach(function (p) { if (p.def) u.values[res.id][p.id] = p.def; }); } return u.values[res.id]; }
function advValidate(res, v, req) {
  var w = [];
  if (req.body && /\bmutation\b/i.test(req.body.query)) w.push('GraphQL mutations are not allowed; read-only queries only.');
  if (req.body && !/[{}]/.test(req.body.query)) w.push('The GraphQL query looks malformed.');
  if (/^fda/.test(res.id) && v.search && /(^|[^+])\s(AND|OR)\s/.test(v.search)) w.push('openFDA expects + between clauses (e.g. a:"x"+AND+b:"y"); spaces are converted to +.');
  if (/^fda/.test(res.id) && v.limit && (parseInt(v.limit, 10) > 100)) w.push('openFDA limit is capped at 100 here.');
  var check = Object.keys(v).map(function (k) { return v[k]; }).join(' ');
  if (!checkInput(trunc(check.replace(/[\r\n\t]/g, ' '), 150)).ok && !req.body) w.push('A parameter looks like it may contain sensitive text. Remove it before running.');
  return w;
}
registerModule({
  id: 'advanced-query', label: 'Advanced Query', icon: 'query',
  count: function () { return null; },
  render: function () {
    var u = ui('advanced'), res = ADV.find(function (r) { return r.id === (u.res || 'ctgov'); }) || ADV[0];
    var v = advValues(res), req = res.build(v), warns = advValidate(res, v, req);
    var out = slot('adv:result');
    return H`${moduleHead('advanced-query')}
      <div class="ow-notice ow-notice-warn">${icon('alert')}<div>For advanced users. Requests go directly from your browser to the selected provider only after you press Run. Nothing is logged or stored. Do not enter patient information.</div></div>
      <form class="ow-card ow-section" data-submit="adv-run"><div class="ow-filters"><div class="ow-field"><label class="ow-label" for="adv-res">Resource</label><select id="adv-res" class="ow-select" data-change="adv-res">${ADV.map(function (r) { return H`<option value="${r.id}" ${r.id === res.id ? raw('selected') : ''}>${r.label} — ${SRC[r.build(advValues(r)).src].displayName}</option>`; })}</select></div></div>
        <div class="ow-filters" style="margin-top:8px">${res.params.map(function (p) { return p.area ? H`<div class="ow-field" style="grid-column:1/-1"><label class="ow-label" for="adv-${p.id}">${p.label}</label><textarea class="ow-input ow-mono" rows="5" id="adv-${p.id}" data-adv="${p.id}" spellcheck="false">${v[p.id] || ''}</textarea></div>` : H`<div class="ow-field"><label class="ow-label" for="adv-${p.id.replace(/\./g, '-')}">${p.label}</label><input class="ow-input" id="adv-${p.id.replace(/\./g, '-')}" data-adv="${p.id}" value="${v[p.id] || ''}" placeholder="${p.ph || ''}" autocomplete="off" spellcheck="false"></div>`; })}</div>
        ${res.narrativeWarning ? H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('alert')}<div>Device event records can contain source-reported narrative text (mdr_text). Do not copy patient-identifying detail.</div></div>` : ''}
        ${warns.map(function (w) { return H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('alert')}<div>${w}</div></div>`; })}
        ${!req.linkout && SRC[req.src] && !SRC[req.src].corsVerified ? H`<div class="ow-notice ow-notice-info" style="margin-top:8px">${icon('info')}<div>${SRC[req.src].displayName} has not yet been CORS-confirmed from oncotics.com. If the request fails, use the official link-out.</div></div>` : ''}
        <div class="ow-card-foot"><button type="submit" class="ow-btn ow-btn-primary">${icon(req.linkout ? 'ext' : 'search')}${req.linkout ? 'Open official source' : 'Run Query'}</button><button type="button" class="ow-btn" data-act="adv-preview">Update preview</button><span class="ow-subtle">Provider: ${SRC[req.src].displayName} · ${SRC[req.src].rateLimitPolicy || ''}</span></div>
        ${det('adv-tech', 'Technical details (raw request)', H`<pre class="ow-code">${(req.method || 'GET') + ' ' + req.url + (req.body ? '\n\n' + JSON.stringify(req.body, null, 2) : '')}</pre><p class="ow-subtle">Headers: Accept: application/json${req.body ? ', Content-Type: application/json' : ''}. cache: no-store, credentials: omit, referrerPolicy: no-referrer.</p>`, true)}</form>
      <div class="ow-section">${out.status === 'idle' ? '' : slotView('adv:result', { render: function (d) { var txt2 = JSON.stringify(d.data, null, 2) || ''; return H`<div class="ow-card"><div class="ow-card-title">Raw source response ${badge('Source-reported', 'outline')} ${/^openfda-device/.test(d.src) ? lagBadge() : ''}</div><p class="ow-subtle">${num(txt2.length)} characters${txt2.length > 60000 ? ' (first 60,000 shown)' : ''}. Retrieved ${timeStr(d.at)} (this session).</p><pre class="ow-code" tabindex="0">${txt2.slice(0, 60000)}</pre></div>`; } })}</div>`;
  }
});

/* ====================================================================
   MODULE 13: COVERAGE CONSOLE
   ==================================================================== */
var PROBES = {
  civic: { method: 'POST', body: { query: '{ __typename }' } }, ctgov: { path: '/studies?pageSize=1&fields=NCTId' }, 'openfda-drug': { url: 'https://api.fda.gov/drug/label.json?limit=1' }, 'openfda-device': { url: 'https://api.fda.gov/device/classification.json?limit=1' },
  ensembl: { path: '/info/ping?content-type=application/json' }, mygene: { path: '/metadata' }, myvariant: { path: '/metadata' }, uniprot: { path: '/uniprotkb/search?query=accession:P04637&size=1&fields=accession&format=json' },
  europepmc: { path: '/search?query=EXT_ID:27283860&format=json&pageSize=1' }, rxnorm: { path: '/version.json' }, string: { path: '/json/version' }, reactome: { path: '/data/species/main' },
  alphafold: { path: '/prediction/P04637' }, opentargets: { method: 'POST', body: { query: '{ meta { name } }' } }, cbioportal: { path: '/info' }, gwas: { path: '/associations?rs_id=rs7903146&size=1' },
  chembl: { path: '/status.json' }, pubchem: { path: '/compound/cid/2244/property/MolecularFormula/JSON' }, ols: { path: '/ontologies?size=1' },
  oncotree: { path: '/tumorTypes/search/code/MEL?exactMatch=true' }, nci_gdc: { path: '/status' }, dgidb: { method: 'POST', body: { query: '{ __typename }' } }, complex_portal: { path: '/search/BRCA1?format=json&first=0&number=1' },
  quickgo: { path: '/annotation/search?geneProductId=P04637&limit=1' }, pdbe: { path: '/mappings/best_structures/P04637' }, ebi_proteins: { path: '/features/P04637?categories=DOMAINS_AND_SITES' },
  openalex: { path: '/works/pmid:27283860?select=id' }, crossref: { path: '/works/10.1056/NEJMoa1713137' }, semantic_scholar: { path: '/paper/PMID:27283860?fields=title' }
};
async function probe(id) {
  var p = PROBES[id], s = SRC[id]; if (!p) return;
  var url = p.url || (s.apiBase + (p.path || ''));
  try { if (Runtime[id].mode === 'unavailable' && s.defaultMode === 'verify' && !Runtime[id].ok) Runtime[id].mode = 'verify'; await Net.request(id, url, { method: p.method, body: p.body, text: p.text, force: true, tryVerify: true, noCache: true, label: 'availability check' }); Runtime[id].checked = 'ok'; Runtime[id].verifiedThisSession = true; }
  catch (e) { Runtime[id].checked = e.kind; }
  scheduleRender();
}
async function probeAll() {
  var ids = Object.keys(PROBES), i = 0;
  toast('Checking ' + ids.length + ' sources (max 2 at a time)…');
  async function worker() { while (i < ids.length) { var id = ids[i++]; await probe(id); } }
  await Promise.all([worker(), worker()]);
  announce('Availability check finished.');
}
registerModule({
  id: 'coverage-console', label: 'Coverage Console', icon: 'console',
  count: function () { return null; },
  render: function () {
    return H`${moduleHead('coverage-console', H`<button type="button" class="ow-btn ow-btn-sm" data-act="probe-all">${icon('refresh')}Check availability (all live)</button><button type="button" class="ow-btn ow-btn-sm" data-act="retry">Retry failed</button><button type="button" class="ow-btn ow-btn-sm" data-act="copy-session">${icon('copy')}Copy session JSON</button><button type="button" class="ow-btn ow-btn-sm" data-act="export-csv">Export visible results</button>`)}
      <div class="ow-notice ow-notice-info">${icon('info')}<div>All API sources are called automatically as you search. Sources marked “CORS to be confirmed” have not yet been confirmed from oncotics.com; if one cannot be reached, its official link-out is shown. Imaging sources are used only on the separate Imaging Workbench page and are never contacted from this page.</div></div>
      <p class="ow-subtle">In-memory status for this page session only. Nothing is probed on page load; checks run only when you press a button. Untick \u201cUse live\u201d to stop requests to a source for this session (its official link-out stays available). Refresh clears everything.</p>
      ${table([
        { label: 'Source', render: function (s) { return H`<strong>${s.displayName}</strong><div class="ow-subtle">${s.kind}</div>`; } }, { label: 'Tier', key: 'tier' },
        { label: 'Default → runtime', render: function (s) { return H`${s.defaultMode} → ${modeBadge(s.id)}`; } },
        { label: 'CORS verified', render: function (s) { return s.corsVerified ? badge('Yes (' + CONFIG.verifiedOn + ')', 'good') : Runtime[s.id].verifiedThisSession ? badge('Checked OK this session', 'good') : badge(s.defaultMode === 'verify' ? 'Not yet (verify)' : 'n/a', s.defaultMode === 'verify' ? 'warn' : 'outline'); } },
        { label: 'Terms / auth', render: function (s) { return H`${s.licenseRestricted ? badge('License-restricted', 'warn') : ''}${s.authOptional ? badge('Token optional (memory)', 'outline') : ''}${s.id === 'semantic_scholar' ? badge('Optional key (memory)', 'outline') : ''}${!s.licenseRestricted && !s.authOptional ? H`<span class="ow-subtle">${s.verify ? 'verify' : 'public'}</span>` : ''}`; } },
        { label: 'Last status', render: function (s) { var r = Runtime[s.id]; return (r.lastStatus || '—') + (r.lastAt ? ' at ' + timeStr(r.lastAt) : '') + (r.checked ? ' · check: ' + r.checked : ''); } },
        { label: 'OK / failed / 429 / skipped', render: function (s) { var r = Runtime[s.id]; return r.ok + ' / ' + r.fail + ' / ' + r.rate + ' / ' + r.skipped; } },
        { label: 'Limits', render: function (s) { return H`<span class="ow-small">${s.rateLimitPolicy || '—'}${s.concurrencyLimit && s.defaultMode === 'live' ? ' · max ' + s.concurrencyLimit + ' parallel' : ''}</span>`; } },
        { label: 'Flags', render: function (s) { return H`${flagBadges(s)}${s.verify ? badge('Template: verify', 'warn') : ''}`; } },
        { label: 'Use live', render: function (s) { return s.defaultMode === 'live' || s.defaultMode === 'verify' ? H`<label class="ow-check"><input type="checkbox" data-change="toggle-source" value="${s.id}" ${State.prefs.disabledSources.has(s.id) ? '' : raw('checked')}><span class="ow-sr">Use live requests to ${s.displayName}</span></label>` : '\u2014'; } },
        { label: 'Action', render: function (s) { return PROBES[s.id] ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="probe" data-src="${s.id}">Check</button>` : ext(s.officialSiteUrl || linkout(s.id, ''), 'Open'); } }
      ], SOURCES, 'Source capability registry and runtime status')}
      <div class="ow-section">${det('dev-panel', 'Developer panel (technical errors; no URLs or search terms are recorded)', H`${SOURCES.filter(function (s) { return Runtime[s.id].errors.length; }).map(function (s) { return H`<p><strong>${s.displayName}</strong>: ${Runtime[s.id].errors.map(function (e) { return e.kind + (e.status ? ' ' + e.status : '') + (e.endpoint ? ' @ ' + e.endpoint : '') + ' (' + timeStr(e.at) + ')'; }).join('; ')}</p>`; })}${SOURCES.every(function (s) { return !Runtime[s.id].errors.length; }) ? H`<p class="ow-subtle">No errors recorded this session.</p>` : ''}<p class="ow-subtle">Queue: ${Net.stats().active} active, ${Net.stats().queued} waiting. Global cap ${CONFIG.globalConcurrency}. Verification notes are in each source’s registry entry (see the source code comments).</p>`)}</div>`;
  }
});

/* ====================================================================
   MODULE 14: SESSION & PRIVACY (+ shared privacy/help/disclaimer content)
   ==================================================================== */
function flowSvg() {
  return raw('<figure style="margin:0"><svg viewBox="0 0 640 150" width="100%" style="max-width:640px;display:block;color:var(--ow-text)" role="img" aria-labelledby="ow-flow-t ow-flow-d"><title id="ow-flow-t">Data flow</title><desc id="ow-flow-d">Your browser sends each request directly to a selected public API, which responds directly to your browser. There is no Oncotics server in between.</desc>'
    + '<defs><marker id="ow-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>'
    + '<rect x="10" y="40" width="170" height="70" rx="12" fill="none" stroke="#14B8A6" stroke-width="2.5"/><text x="95" y="72" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">Your browser</text><text x="95" y="93" text-anchor="middle" font-size="11" fill="currentColor">state in memory only</text>'
    + '<rect x="460" y="40" width="170" height="70" rx="12" fill="none" stroke="currentColor" stroke-width="2"/><text x="545" y="72" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">Public API</text><text x="545" y="93" text-anchor="middle" font-size="11" fill="currentColor">CIViC, CT.gov, openFDA…</text>'
    + '<line x1="185" y1="62" x2="453" y2="62" stroke="currentColor" stroke-width="2" marker-end="url(#ow-arr)"/><text x="320" y="54" text-anchor="middle" font-size="11" fill="currentColor">request (HTTPS, no cookies, no referrer)</text>'
    + '<line x1="455" y1="92" x2="187" y2="92" stroke="currentColor" stroke-width="2" marker-end="url(#ow-arr)"/><text x="320" y="110" text-anchor="middle" font-size="11" fill="currentColor">response</text>'
    + '<text x="320" y="140" text-anchor="middle" font-size="12" font-weight="700" fill="#BE123C">No Oncotics server in the middle</text></svg></figure>');
}
function flowSvg2(id, title, desc, left, leftSub, mid, midSub, right, rightSub, foot) {
  var box = function (x, t, sub, teal) { return '<rect x="' + x + '" y="34" width="180" height="70" rx="12" fill="none" stroke="' + (teal ? '#14B8A6' : 'currentColor') + '" stroke-width="' + (teal ? 2.5 : 2) + '"/><text x="' + (x + 90) + '" y="64" text-anchor="middle" font-size="13.5" font-weight="700" fill="currentColor">' + esc(t) + '</text><text x="' + (x + 90) + '" y="84" text-anchor="middle" font-size="10.5" fill="currentColor">' + esc(sub) + '</text>'; };
  return raw('<figure style="margin:0"><svg viewBox="0 0 660 140" width="100%" style="max-width:660px;display:block;color:var(--ow-text)" role="img" aria-labelledby="' + id + '-t ' + id + '-d"><title id="' + id + '-t">' + esc(title) + '</title><desc id="' + id + '-d">' + esc(desc) + '</desc>'
    + '<defs><marker id="' + id + '-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>'
    + box(6, left, leftSub, false) + box(240, mid, midSub, true) + box(474, right, rightSub, false)
    + '<line x1="190" y1="69" x2="234" y2="69" stroke="currentColor" stroke-width="2" marker-end="url(#' + id + '-a)"/><line x1="424" y1="69" x2="468" y2="69" stroke="currentColor" stroke-width="2" marker-end="url(#' + id + '-a)"/>'
    + '<text x="330" y="128" text-anchor="middle" font-size="12" font-weight="700" fill="#BE123C">' + esc(foot) + '</text></svg></figure>');
}
function allFlowSvgs() {
  return H`<div class="ow-stack"><h4>Main workspace</h4>${flowSvg()}
    <h4>Imaging Workbench (separate page)</h4>${flowSvg2('ow-flow-img', 'Imaging Workbench data flow', 'A local image, or a trusted DICOMweb endpoint you choose, is read directly by the OHIF Viewer inside your browser and stays in browser memory. There is no Oncotics server in between.', 'Local image or', 'your trusted DICOMweb endpoint', 'OHIF Viewer', 'in your browser memory', 'Your browser', 'view · annotate · local export', 'No Oncotics server in the middle · nothing uploaded or stored')}
    <h4>Geographic Activity Globe</h4>${flowSvg2('ow-flow-globe', 'Globe data flow', 'Public location fields from API records already in memory are converted in your browser into globe markers. Your device location is never used.', 'Public API records', 'trial sites, recall firms', 'Browser memory', 'public, non-PHI fields only', '3D globe markers', 'no device location', 'No Oncotics server · no stored camera state')}</div>`;
}
var PRIVACY_POINTS = ['No search data is stored by Oncotics.', 'No account required.', 'No cookies used.', 'No browser storage used.', 'Refresh clears all session data.', 'Exports are generated locally in your browser.', 'Requests are sent directly to selected public providers.', 'Each provider may apply its own API logging and rate limits.', 'Optional API keys, if used, are kept only in memory and are not secrets.', 'openFDA device records may lag official FDA databases.', 'Link-out sources are opened directly by your browser.', 'Some link-out sources may be non-English.', 'Do not enter patient identifiers, raw genomic files, VCF files, FASTQ files, device serial numbers tied to a patient, implant lot numbers tied to a patient, family medical records, protected health information, or full free-text clinical notes.',
  'Oncotics does not use controlled-access genomic data (no dbGaP or controlled GDC data).',
  'Oncotics does not upload or store DICOM or image data. Imaging is handled only on the separate Imaging Workbench page, in browser memory.',
  'DICOM files and medical images may contain protected health information (including burned-in text).',
  'AI detection and inference on the Imaging Workbench is experimental and non-diagnostic, opt-in, and never runs automatically.',
  'The 3D globe uses only public, non-PHI location records derived in memory. Device geolocation is never requested.',
  'Optional external map imagery, if you turn it on, sends tile requests to a third-party provider; it is off by default.',
  'Reproductive-health and vaccination content is organized public evidence only; do not enter partner, minor, clinic, ART-cycle, storage, lot or dose identifiers.',
  'Oncotics does not scrape guidelines, does not redistribute licensed content (for example OncoKB), and never sends PHI to AI resources.'];
function legalBlock() {
  return H`<div class="ow-card"><div class="ow-card-title">Legal notice</div><ul style="margin-top:6px" class="ow-small">
    <li>${LEGAL.copyright}</li><li>${LEGAL.privacyLegal}</li><li>${LEGAL.reproductive}</li><li>${LEGAL.vaccine}</li><li>${LEGAL.ai}</li><li>${LEGAL.imaging}</li><li>${LEGAL.purpose}</li><li>${LEGAL.noMedical}</li><li>${LEGAL.noRegulatory}</li><li>${LEGAL.notResponsible}</li>
    ${LEGAL.providers.map(function (p) { return H`<li>${p}</li>`; })}<li>${LEGAL.independent}</li></ul></div>`;
}
function privacyContent() {
  return H`<div class="ow-stack"><div class="ow-notice ow-notice-good">${icon('shield')}<div><strong>${BRAND.privacy}:</strong> Your searches are sent directly from your browser to selected public data providers and are not stored by Oncotics.</div></div>
    <div class="ow-notice ow-notice-info">${icon('globe')}<div><strong>Globe Privacy:</strong> Locations shown are derived only from public records in memory. Oncotics does not use your device location and does not store globe state.</div></div>
    <div class="ow-notice ow-notice-info">${icon('scan')}<div><strong>Imaging Privacy:</strong> Uploaded images and inference results are kept only in your browser memory. Oncotics does not store, upload, log, or train on your images.</div></div>
    ${allFlowSvgs()}
    <ul>${PRIVACY_POINTS.map(function (p) { return H`<li>${p}</li>`; })}</ul>
    <div class="ow-notice ow-notice-warn">${icon('alert')}<div>This tool is for educational and research use only. It is not a substitute for clinical judgment.</div></div>
    ${det('priv-providers', 'Providers your browser may contact (' + SOURCES.filter(function (s) { return s.defaultMode === 'live'; }).length + ' live)', H`<ul>${SOURCES.filter(function (s) { return s.defaultMode === 'live'; }).map(function (s) { return H`<li><strong>${s.displayName}</strong> (${s.apiBase.replace(/^https:\/\//, '').split('/')[0]}) — ${s.attribution}</li>`; })}</ul><p class="ow-subtle">Link-out sources (${SOURCES.filter(function (s) { return s.defaultMode !== 'live'; }).length}) are contacted only when you open them.</p>`)}
    ${legalBlock()}</div>`;
}
function privacyStatement() {
  return ['Oncotics Precision Oncology Workspace — Privacy Statement', '', 'The Oncotics Precision Oncology Workspace at ' + CONFIG.host + ' runs entirely in your web browser. Oncotics does not operate a server, proxy, database, analytics, or logging service for this tool.']
    .concat(PRIVACY_POINTS.map(function (p) { return '- ' + p; }))
    .concat(['', 'Globe Privacy: Locations shown are derived only from public records in memory. Oncotics does not use your device location and does not store globe state.', 'Imaging Privacy: Uploaded images and inference results are kept only in your browser memory. Oncotics does not store, upload, log, or train on your images.'])
    .concat(['', 'Providers contacted directly by your browser when you search: ' + SOURCES.filter(function (s) { return s.defaultMode === 'live'; }).map(function (s) { return s.displayName; }).join(', ') + '. Each provider may log requests under its own policy.', '', LEGAL.privacyLegal, LEGAL.noAdviceFull, LEGAL.notResponsible, LEGAL.independent, LEGAL.copyright]).join('\n');
}
function helpContent() {
  return H`<div class="ow-stack">
    <p>The Oncotics Workspace is a <strong>live public API workspace</strong>. Type a gene, variant, drug, device, diagnostic, disease, trial ID, PMID, rsID, HGVS notation, 510(k)/PMA/De Novo number, product code or UDI-DI and press Explore. Oncotics classifies the query, shows how it was interpreted, and loads a small set of sources first; deeper sections load when you open them.</p>
    <div class="ow-grid-2"><div><h4>Getting around</h4><ul class="ow-small"><li><kbd>/</kbd> focuses search; <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> opens commands.</li><li>Arrow keys move between modules in the rail.</li><li><kbd>Esc</kbd> closes a drawer or dialog.</li><li>Clear Session wipes all in-memory state; refresh does the same.</li></ul></div>
      <div><h4>Privacy</h4><ul class="ow-small"><li>Searches are not stored by Oncotics.</li><li>Results come from the selected providers directly.</li><li>Some sources are link-out only.</li><li>${SAFETY.phi}</li></ul></div></div>
    <div><h4>Match confidence</h4><p class="ow-small">${confBadge('Exact')} shared identifier or exact name · ${confBadge('Likely')} strong name/term match · ${confBadge('Possible')} keyword co-occurrence only · ${confBadge('Unresolved')} no confident link. Possible is never shown as Exact.</p></div>
    <div><h4>Devices and diagnostics</h4><p class="ow-small">${pathwayBadge({ pathway: '510(k)', decision: { verb: 'cleared' } })} clearance (substantial equivalence) · ${pathwayBadge({ pathway: 'De Novo', decision: { verb: 'granted' } })} De Novo classification · ${pathwayBadge({ pathway: 'PMA', decision: { verb: 'approved' } })} approval. ${lagBadge()} openFDA device records may lag the official FDA database; the official record is always linked. IVD = in vitro diagnostic; CDx = companion diagnostic (informs a drug’s use); LDT = laboratory developed test, regulated differently and never labeled FDA-cleared here.</p></div>
    <div><h4>Evidence and trial badges</h4><p class="ow-small">${levelBadge('A')} validated · ${levelBadge('B')} clinical · ${levelBadge('C')} case study · ${levelBadge('D')} preclinical · ${sigBadge('SENSITIVITYRESPONSE')} ${sigBadge('RESISTANCE')} · ${statusBadge('RECRUITING')} ${statusBadge('ACTIVE_NOT_RECRUITING')} ${statusBadge('TERMINATED')} · ${recallBadge('Class I')}</p></div>
    <div><h4>Source coverage</h4><p class="ow-small">${badge('Live', 'good')} queried by your browser · ${badge('Link-out', 'outline')} opens the official site · ${badge('Unavailable', 'bad')} failed this session (use Retry) · ${badge('Derived', 'derived')} link computed by Oncotics with a confidence label.</p></div>
    <div><h4>Interpretation confidence</h4><p class="ow-small">Overview lists every plausible reading of your query with a heuristic 0–100 routing score (${badge('Very High 90–100', 'good')} ${badge('High 75–89', 'teal')} ${badge('Medium 50–74', 'warn')} ${badge('Low 25–49', 'bad')}). ${SAFETY.interpretation} Ambiguous or low-scoring queries wait for your choice before any source is queried.</p></div>
    <div><h4>Live and link-out sources</h4><p class="ow-small">${badge('Live', 'good')} called automatically by your browser as you search; if a source cannot be reached, its official link-out is shown instead · ${badge('Link-out', 'outline')} official site opens in a new tab · ${badge('Patient education', 'edu')} · ${badge('AI-derived', 'ai')} · ${badge('Community / developer', 'dev')} · ${badge('License-restricted', 'warn')}.</p></div>
    <div class="ow-grid-2"><div><h4>Vaccines</h4><p class="ow-small">${SAFETY.vaccines} ${SAFETY.vaers}</p></div><div><h4>Onco-Fertility</h4><p class="ow-small">${SAFETY.fertility}</p></div></div>
    <div class="ow-grid-2"><div><h4>Geographic Activity Globe</h4><p class="ow-small">${SAFETY.globePrivacy} Every marker has an accessible list row. Marker size reflects counts, not clinical importance.</p></div><div><h4>Molecular Context Map</h4><p class="ow-small">${SAFETY.molmap} Solid lines are source-reported; dashed lines are derived; dotted lines are link-outs. A table fallback is always available.</p></div></div>
    <div><h4>Imaging Workbench</h4><p class="ow-small">Images are handled only on the separate <a href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">Imaging Workbench</a> page (OHIF Viewer), in browser memory, after consent. ${SAFETY.dicom} AI inference there is experimental, opt-in and never automatic.</p></div>
    <div><h4>Example searches</h4><div class="ow-row">${['EGFR', 'BRAF V600E', 'KRAS G12C', 'Osimertinib', 'Pembrolizumab', 'Non-Small Cell Lung Cancer', 'fertility preservation', 'cyclophosphamide gonadotoxicity', 'tamoxifen pregnancy label', 'HPV vaccine cervical cancer', 'sipuleucel-T prostate cancer', 'mRNA cancer vaccine trial', 'pregnancy vaccination influenza', 'embryo culture device FDA 510(k)', 'BRCA1 hereditary cancer fertility planning link-outs', 'Open Imaging Workbench'].map(function (p) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${p}">${p}</button>`; })}</div></div>
    <div><h4>Clearing the session</h4><p class="ow-small">Clear Session (or refresh) wipes every result, interpretation, globe marker, map node, board item, key and preference from memory. Nothing was stored.</p></div>
    <div class="ow-disclaimer">Educational and research use only. Not medical advice. Not regulatory advice. Not procurement advice.</div></div>`;
}
registerModule({
  id: 'session-privacy', label: 'Session & Privacy', icon: 'lock',
  count: function () { return null; },
  render: function () {
    var keyed = !!State.keys.openfda;
    return H`${moduleHead('session-privacy', H`<button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="clear-session">${icon('trash')}Clear Session</button><button type="button" class="ow-btn ow-btn-sm" data-act="export-session">${icon('download')}Export Session JSON</button><button type="button" class="ow-btn ow-btn-sm" data-act="export-csv">${icon('table')}Export Visible Table CSV</button><button type="button" class="ow-btn ow-btn-sm" data-act="copy-privacy">${icon('copy')}Copy Privacy Statement</button>`)}
      <div class="ow-grid-2"><div class="ow-stack">${privacyContent()}</div>
      <div class="ow-stack"><div class="ow-card"><div class="ow-card-title">Display preferences (memory only)</div>
          <div class="ow-row" style="margin-top:8px"><span class="ow-label" style="margin:0">Theme</span><div class="ow-seg" role="group" aria-label="Theme">${['system', 'light', 'dark'].map(function (t) { return H`<button type="button" aria-pressed="${State.prefs.theme === t ? 'true' : 'false'}" data-act="set-theme" data-theme="${t}">${titleCase(t)}</button>`; })}</div></div>
          <div class="ow-row" style="margin-top:8px"><span class="ow-label" style="margin:0">Density</span><div class="ow-seg" role="group" aria-label="Density">${['comfortable', 'compact'].map(function (t) { return H`<button type="button" aria-pressed="${State.prefs.density === t ? 'true' : 'false'}" data-act="set-density" data-density="${t}">${titleCase(t)}</button>`; })}</div></div>
          ${det('mod-vis', 'Module visibility', H`<div class="ow-row">${MODULES.filter(function (m) { return m.id !== 'overview' && m.id !== 'session-privacy'; }).map(function (m) { return H`<label class="ow-check"><input type="checkbox" data-change="toggle-module" value="${m.id}" ${State.prefs.hiddenModules.has(m.id) ? '' : raw('checked')}>${m.label}</label>`; })}</div>`)}</div>
        <div class="ow-card"><div class="ow-card-title">Optional openFDA API key</div><p class="ow-small ow-muted" style="margin-top:4px">Raises openFDA rate limits. Kept only in memory, never logged, never exported, cleared by refresh or Clear Session. Keys used in a browser are not secrets.</p>
          <form class="ow-row" data-submit="set-key" style="margin-top:8px"><label for="ow-fda-key" class="ow-sr">openFDA API key</label><input id="ow-fda-key" class="ow-input" type="password" autocomplete="off" spellcheck="false" placeholder="${keyed ? '•••••• key set (memory only)' : 'Paste key'}" style="max-width:280px"><button type="submit" class="ow-btn ow-btn-sm">Set key</button>${keyed ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="clear-key">Remove key</button>` : ''}</form></div>
        ${CONFIG.features.semanticScholarKey ? H`<div class="ow-card"><div class="ow-card-title">Optional Semantic Scholar API key</div><p class="ow-small ow-muted" style="margin-top:4px">Memory only; sent only to api.semanticscholar.org on explicit citation-radar requests; cleared by refresh or Clear Session. Not a secret in a browser.</p>
          <form class="ow-row" data-submit="set-s2-key" style="margin-top:8px"><label for="ow-s2-key" class="ow-sr">Semantic Scholar API key</label><input id="ow-s2-key" class="ow-input" type="password" autocomplete="off" spellcheck="false" placeholder="${State.keys.s2 ? '•••••• key set (memory only)' : 'Paste key'}" style="max-width:280px"><button type="submit" class="ow-btn ow-btn-sm">Set key</button>${State.keys.s2 ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="clear-s2">Remove key</button>` : ''}</form></div>` : ''}
        <div class="ow-card"><div class="ow-card-title">Sensitive-context warnings</div><ul class="ow-small" style="margin-top:6px"><li><strong>PHI:</strong> ${SAFETY.phi}</li><li><strong>Reproductive health:</strong> ${SAFETY.fertility}</li><li><strong>Vaccines:</strong> ${SAFETY.vaccines}</li><li><strong>Imaging / DICOM:</strong> ${SAFETY.dicom}</li><li><strong>AI inference:</strong> Experimental and non-diagnostic; never automatic; never sent to Oncotics.</li><li><strong>Globe:</strong> ${SAFETY.globePrivacy}</li><li><strong>Controlled access:</strong> Never requested.</li><li><strong>Guidelines:</strong> Linked only, never scraped. Licensed content (OncoKB) is never redistributed. No PHI is sent to AI resources.</li></ul></div>
        <div class="ow-card"><div class="ow-card-title">Technical credits (open-source components)</div><ul class="ow-small" style="margin-top:6px"><li>3D globe engine (when deployed on this host): CesiumJS, Apache License 2.0, © Cesium GS, Inc. and contributors. Bundled imagery: Natural Earth II (public domain). No Cesium ion services are used.</li><li>Built-in globe outlines and country centroids: Natural Earth (public domain) via world-atlas (ISC); ISO 3166 name mapping from mledoze/countries (ODbL 1.0).</li><li>Imaging Workbench viewer: OHIF Viewer (MIT), Open Health Imaging Foundation; Cornerstone3D (MIT).</li><li>Optional external map imagery (off by default): ${CONFIG.globeExternalImagery.attribution}.</li></ul></div>
        <div class="ow-card"><div class="ow-card-title">Official sources</div><div class="ow-card-foot">${CONFIG.privacyPolicyUrl ? extBtn(CONFIG.privacyPolicyUrl, 'Oncotics privacy policy') : ''}<button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="global-coverage">Open provider list</button>${extBtn('https://clinicaltrials.gov', 'ClinicalTrials.gov')}${extBtn('https://open.fda.gov', 'openFDA')}${extBtn(linkout('fda-510k', ''), 'FDA device databases')}${extBtn(linkout('fda-cdx', ''), 'FDA companion-diagnostics list')}${extBtn('https://civicdb.org', 'CIViC')}${extBtn('https://www.ensembl.org', 'Ensembl')}${extBtn('https://www.uniprot.org', 'UniProt')}${extBtn('https://europepmc.org', 'Europe PMC')}</div></div>
        <div class="ow-card"><div class="ow-card-title">Medical and legal disclaimer</div><ul class="ow-small" style="margin-top:6px">${LEGAL.longDisclaimer.map(function (l) { return H`<li>${l}</li>`; })}</ul></div></div></div>`;
  }
});
