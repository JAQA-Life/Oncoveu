
/* ====================================================================
   ENDPOINT HELPERS + LOADERS
   Each loader: (signal, ...args) -> normalized object { items, total, ... }
   or { empty: true }. Response shapes are validated before use; anything
   missing renders as "Not reported by source". Nothing is invented.
   ==================================================================== */
function qs(params) {
  return Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
}
// openFDA search expressions: phrase-quoted terms; '+' between clauses = OR, '+AND+' = AND.
function fq(field, term) { return field + ':' + encodeURIComponent('"' + String(term).replace(/["\\]/g, ' ').trim() + '"'); }
function fOR(field, terms) { return uniq(arr(terms).filter(Boolean)).map(function (t) { return fq(field, t); }).join('+'); }
function fdaGet(src, path, search, extra, signal, label) {
  var url = 'https://api.fda.gov' + path + '?' + (search ? 'search=' + search : '') + (extra ? (search ? '&' : '') + extra : '');
  return Net.request(src, url, { signal: signal, notFoundEmpty: true, label: label || path });
}
function fdaTotal(d) { return d && d.meta && d.meta.results ? d.meta.results.total : (d && d.results ? d.results.length : 0); }
function fdaLastUpdated(d) { return d && d.meta ? d.meta.last_updated : null; }

/* ---------------- CIViC (GraphQL) ---------------- */
function civicGQL(query, variables, signal, label) {
  return Net.request('civic', SRC.civic.apiBase, { method: 'POST', body: { query: query, variables: variables || {} }, signal: signal, graphql: true, label: label || 'graphql' })
    .then(function (d) { if (!d || !d.data) throw mkErr('shape', 'civic'); return d.data; });
}
// Build argument lists dynamically so only provided filters are sent.
function gqlArgs(spec, values) {
  var decl = [], args = [], vars = {};
  Object.keys(spec).forEach(function (name) {
    var v = values[name];
    if (v == null || v === '') return;
    decl.push('$' + name + ':' + spec[name].type);
    args.push(spec[name].arg + ':$' + name);
    vars[name] = v;
  });
  return { decl: decl.length ? '(' + decl.join(',') + ')' : '', args: args.join(','), vars: vars };
}
var CIVIC_EV_FIELDS = 'id name link description evidenceLevel evidenceType evidenceDirection significance status evidenceRating variantOrigin molecularProfile{id name link} disease{id name link doid} therapies{id name link ncitId} source{id citation citationId sourceType link}';
var CIVIC_AS_FIELDS = 'id name link summary ampLevel assertionType assertionDirection significance status nccnGuideline{name} nccnGuidelineVersion molecularProfile{id name link} disease{id name link doid} therapies{id name link ncitId}';
var CIVIC_EV_SPEC = {
  mp: { type: 'String', arg: 'molecularProfileName' }, th: { type: 'String', arg: 'therapyName' }, dz: { type: 'String', arg: 'diseaseName' },
  et: { type: 'EvidenceType', arg: 'evidenceType' }, sg: { type: 'EvidenceSignificance', arg: 'significance' }, lv: { type: 'EvidenceLevel', arg: 'evidenceLevel' },
  ds: { type: 'String', arg: 'description' }, st: { type: 'EvidenceStatusFilter', arg: 'status' }, sort: { type: 'EvidenceSort', arg: 'sortBy' }, first: { type: 'Int', arg: 'first' }, after: { type: 'String', arg: 'after' }
};
function civicScope(ctx) {
  if (!ctx) return null;
  if (ctx.type === 'variant' && ctx.gene) return { mp: ctx.variantName || ctx.gene };
  if (ctx.type === 'gene') return { mp: ctx.gene };
  if (ctx.type === 'rsid' || ctx.type === 'hgvs' || ctx.type === 'uniprot' || ctx.type === 'ensembl') return ctx.variantName ? { mp: ctx.variantName } : (ctx.gene && (ctx.type === 'uniprot' || ctx.type === 'ensembl') ? { mp: ctx.gene } : null);
  if (ctx.type === 'drug') return { th: titleCase(ctx.drug) };
  if (ctx.type === 'disease') return { dz: ctx.disease };
  if (ctx.type === 'concept' && ctx.geneHint) return { mp: ctx.geneHint };
  return null;
}
function normCivicEvidence(n) {
  var mp = n.molecularProfile || {};
  var rec = putRecord('evidence', (n.name || 'EID' + n.id) + (mp.name ? ' \u00b7 ' + mp.name : ''), 'civic', {
    id: n.id, name: n.name, description: n.description, level: n.evidenceLevel, type: n.evidenceType, direction: n.evidenceDirection, significance: n.significance,
    status: n.status, rating: n.evidenceRating, origin: n.variantOrigin, molecularProfile: mp, disease: n.disease || null, therapies: arr(n.therapies), source: n.source || null
  }, prov('civic', 'evidenceItems', n.name || n.id, LINK.civic(n.link)));
  return rec;
}
function normCivicAssertion(n) {
  return putRecord('assertion', (n.name || 'AID' + n.id) + (n.molecularProfile ? ' \u00b7 ' + n.molecularProfile.name : ''), 'civic', {
    id: n.id, name: n.name, summary: n.summary, amp: n.ampLevel, type: n.assertionType, direction: n.assertionDirection, significance: n.significance, status: n.status,
    nccn: n.nccnGuideline ? n.nccnGuideline.name : null, nccnVersion: n.nccnGuidelineVersion, molecularProfile: n.molecularProfile || {}, disease: n.disease || null, therapies: arr(n.therapies)
  }, prov('civic', 'assertions', n.name || n.id, LINK.civic(n.link)));
}
var Loaders = {};
Loaders.civicEvidence = async function (signal, scope, f, after) {
  f = f || {};
  var vals = Object.assign({}, scope, { et: f.et, sg: f.sg, lv: f.lv, ds: f.ds, st: f.st || 'ACCEPTED', first: f.pageSize || 25, after: after || null });
  if (f.th && !vals.th) vals.th = f.th;
  if (f.dz && !vals.dz) vals.dz = f.dz;
  vals.sort = { column: f.sortCol || 'EVIDENCE_LEVEL', direction: f.sortDir || 'ASC' };
  var g = gqlArgs(CIVIC_EV_SPEC, vals);
  var q = 'query' + g.decl + '{ evidenceItems(' + g.args + '){ totalCount pageInfo{ hasNextPage endCursor } nodes{ ' + CIVIC_EV_FIELDS + ' } } }';
  var d = await civicGQL(q, g.vars, signal, 'evidenceItems');
  var e = d.evidenceItems; if (!e) throw mkErr('shape', 'civic');
  var items = arr(e.nodes).map(normCivicEvidence);
  return { items: items, total: e.totalCount || 0, pageInfo: e.pageInfo || {}, empty: !items.length };
};
Loaders.civicAssertions = async function (signal, scope) {
  var spec = { mp: { type: 'String', arg: 'molecularProfileName' }, th: { type: 'String', arg: 'therapyName' }, dz: { type: 'String', arg: 'diseaseName' }, first: { type: 'Int', arg: 'first' } };
  var g = gqlArgs(spec, Object.assign({}, scope, { first: 25 }));
  var d = await civicGQL('query' + g.decl + '{ assertions(' + g.args + '){ totalCount nodes{ ' + CIVIC_AS_FIELDS + ' } } }', g.vars, signal, 'assertions');
  var a = d.assertions; if (!a) throw mkErr('shape', 'civic');
  var items = arr(a.nodes).filter(function (n) { return n.status !== 'REJECTED'; }).map(normCivicAssertion);
  return { items: items, total: a.totalCount || 0, empty: !items.length };
};
Loaders.civicGene = async function (signal, symbol) {
  var d = await civicGQL('query($s:String!){ gene(entrezSymbol:$s){ id name fullName description link entrezId featureAliases } }', { s: symbol }, signal, 'gene');
  if (!d.gene) return { empty: true };
  var g = d.gene;
  return { gene: putRecord('gene', g.name, 'civic', { symbol: g.name, name: g.fullName, description: g.description, aliases: arr(g.featureAliases), entrez: g.entrezId, civicId: g.id }, prov('civic', 'gene', g.name, LINK.civic(g.link))) };
};
Loaders.civicTherapy = async function (signal, name) {
  var d = await civicGQL('query($n:String){ therapies(name:$n, first:5){ nodes{ id name link ncitId } } }', { n: name }, signal, 'therapies');
  var nodes = d.therapies ? arr(d.therapies.nodes) : [];
  return nodes.length ? { items: nodes } : { empty: true };
};
Loaders.civicSearch = async function (signal, text) {
  var d = await civicGQL('query($q:String!){ search(query:$q){ id name resultType } }', { q: text }, signal, 'search');
  var items = arr(d.search).slice(0, 20);
  return items.length ? { items: items } : { empty: true };
};

/* ---------------- ClinicalTrials.gov v2 ---------------- */
var CT_LIST_FIELDS = 'NCTId,BriefTitle,OfficialTitle,Acronym,OverallStatus,Phase,StudyType,Condition,InterventionName,InterventionType,LeadSponsorName,StartDate,PrimaryCompletionDate,CompletionDate,EnrollmentCount,LastUpdatePostDate,LocationCountry';
function normTrial(s, full) {
  var p = (s && s.protocolSection) || {};
  var id = p.identificationModule || {}, st = p.statusModule || {}, sp = p.sponsorCollaboratorsModule || {}, cond = p.conditionsModule || {}, des = p.designModule || {}, ai = p.armsInterventionsModule || {}, cl = p.contactsLocationsModule || {};
  var locs = arr(cl.locations);
  var data = {
    nct: id.nctId, briefTitle: id.briefTitle, officialTitle: id.officialTitle, acronym: id.acronym,
    status: st.overallStatus, phases: arr(des.phases), studyType: des.studyType, conditions: arr(cond.conditions), keywords: arr(cond.keywords),
    interventions: arr(ai.interventions).map(function (i) { return { type: i.type, name: i.name, description: i.description, otherNames: arr(i.otherNames), arms: arr(i.armGroupLabels) }; }),
    sponsor: sp.leadSponsor ? sp.leadSponsor.name : null, sponsorClass: sp.leadSponsor ? sp.leadSponsor.class : null,
    start: get(st, 'startDateStruct.date'), primaryCompletion: get(st, 'primaryCompletionDateStruct.date'), completion: get(st, 'completionDateStruct.date'),
    lastUpdate: get(st, 'lastUpdatePostDateStruct.date'), enrollment: get(des, 'enrollmentInfo.count'), enrollmentType: get(des, 'enrollmentInfo.type'),
    countries: uniq(locs.map(function (l) { return l.country; })), siteCount: locs.length,
    // Public site-level location fields only (facility, city, state, country, recruitment status, geo point).
    // Site contact names, phone numbers and e-mails are deliberately not retained.
    sites: locs.filter(function (l) { return l && (l.city || l.geoPoint); }).slice(0, 500).map(function (l) { var gp = l.geoPoint || {}; return { facility: l.facility || null, city: l.city || null, state: l.state || null, country: l.country || null, status: l.status || null, lat: typeof gp.lat === 'number' && isFinite(gp.lat) ? gp.lat : null, lon: typeof gp.lon === 'number' && isFinite(gp.lon) ? gp.lon : null }; })
  };
  if (full) data.full = s;
  return putRecord('trial', (data.nct || '') + ' \u00b7 ' + (data.briefTitle || data.officialTitle || ''), 'ctgov', data, prov('ctgov', full ? 'studies/{nctId}' : 'studies', data.nct, LINK.ctStudy(data.nct)));
}
function ctParams(ctx, f) {
  f = f || {};
  var p = { format: 'json', countTotal: 'true', pageSize: f.pageSize || 10, fields: CT_LIST_FIELDS };
  var base = ctx || {};
  if (base.type === 'drug') { p['query.intr'] = base.drug; if (base.fertility) p['query.term'] = base.fertility.sub === 'pregnancy' || base.fertility.sub === 'lactation' ? 'pregnancy OR lactation' : 'fertility OR gonadotoxicity OR ovarian OR infertility'; }
  else if (base.type === 'vaccine') { var vv = base.vaccine || {}; if (vv.kind !== 'general' && !vv.investigational && vv.products && vv.products.length) p['query.intr'] = vv.name; else p['query.term'] = (vv.synonyms && vv.synonyms[0] ? vv.synonyms[0] : base.label) + (vv.kind === 'general' ? ' AND cancer' : '') + (vv.pregnancy ? ' AND pregnancy' : ''); }
  else if (base.type === 'fertility') p['query.term'] = (base.fertility && base.fertility.concept) || base.label;
  else if (base.type === 'imaging') p['query.term'] = ((base.imaging && base.imaging.concept) || base.label) + ' AND cancer';
  else if (base.type === 'gene' && base.fertility) p['query.term'] = base.gene + ' AND (fertility OR reproductive OR pregnancy)';
  else if (base.type === 'disease') p['query.cond'] = base.disease;
  else if (base.type === 'device') p['query.term'] = base.deviceTerm || base.label;
  else if (base.type === 'regid') p['query.term'] = base.regId;
  else p['query.term'] = base.trialTerm || base.label;
  if (f.cond) p['query.cond'] = f.cond;
  if (f.intr) p['query.intr'] = f.intr;
  if (f.spons) p['query.spons'] = f.spons;
  if (f.locn) p['query.locn'] = f.locn;
  if (f.kw) p['query.term'] = (p['query.term'] ? p['query.term'] + ' AND ' : '') + f.kw;
  if (f.status && f.status.length) p['filter.overallStatus'] = f.status.join(',');
  var adv = [];
  if (f.phase) adv.push('AREA[Phase]' + f.phase);
  if (f.type) adv.push('AREA[StudyType]' + f.type);
  if (f.age) adv.push('AREA[StdAge]' + f.age);
  if (f.hv === 'yes') adv.push('AREA[HealthyVolunteers]true');
  if (f.hv === 'no') adv.push('AREA[HealthyVolunteers]false');
  if (f.results === 'with') adv.push('AREA[HasResults]true');
  if (f.results === 'without') adv.push('AREA[HasResults]false');
  if (f.startFrom || f.startTo) adv.push('AREA[StartDate]RANGE[' + (f.startFrom || 'MIN') + ',' + (f.startTo || 'MAX') + ']');
  if (adv.length) p['filter.advanced'] = adv.join(' AND ');
  p.sort = f.sort || '@relevance';
  if (f.pageToken) p.pageToken = f.pageToken;
  return p;
}
Loaders.trials = async function (signal, ctx, f) {
  var d = await Net.request('ctgov', SRC.ctgov.apiBase + '/studies?' + qs(ctParams(ctx, f)), { signal: signal, label: 'studies' });
  if (!d || !Array.isArray(d.studies)) throw mkErr('shape', 'ctgov');
  var items = d.studies.map(function (s) { return normTrial(s); });
  return { items: items, total: d.totalCount || items.length, nextPageToken: d.nextPageToken || null, empty: !items.length };
};
Loaders.trial = async function (signal, nct) {
  var d = await Net.request('ctgov', SRC.ctgov.apiBase + '/studies/' + encodeURIComponent(nct) + '?format=json', { signal: signal, notFoundEmpty: true, label: 'studies/{nctId}' });
  if (!d) return { empty: true, notFound: true };
  if (!d.protocolSection) throw mkErr('shape', 'ctgov');
  return { trial: normTrial(d, true) };
};

/* ---------------- openFDA: drugs ---------------- */
function drugTerms(ctx) {
  var t = [ctx.drug];
  if (ctx.brand) t.push(ctx.brand);
  arr(ctx.extraTerms).forEach(function (x) { t.push(x); });
  return uniq(t.filter(Boolean).map(function (x) { return String(x).trim(); }));
}
function labelMatch(l, terms) {
  var of = l.openfda || {}; var low = terms.map(function (t) { return t.toLowerCase(); });
  var g = arr(of.generic_name).map(function (x) { return x.toLowerCase(); }), b = arr(of.brand_name).map(function (x) { return x.toLowerCase(); }), subs = arr(of.substance_name).map(function (x) { return x.toLowerCase(); });
  if (low.some(function (t) { return g.indexOf(t) >= 0 || b.indexOf(t) >= 0; })) return 'Exact';
  if (low.some(function (t) { return g.concat(b, subs).some(function (x) { return x.split(/[\s,-]+/).indexOf(t) >= 0 || x.indexOf(t) === 0; }); })) return 'Likely';
  var spl = String(first(l.spl_product_data_elements) || '').toLowerCase().split(/\s+/).slice(0, 4);
  if (low.some(function (t) { return spl.indexOf(t.split(' ')[0]) >= 0; })) return 'Likely';
  return 'Possible';
}
var CONF_RANK = { Exact: 0, Likely: 1, Possible: 2, Unresolved: 3 };
Loaders.drugLabels = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var search = [fOR('openfda.generic_name', terms), fOR('openfda.brand_name', terms), fOR('openfda.substance_name', terms), fOR('spl_product_data_elements', terms)].join('+');
  var d = await fdaGet('openfda-drug', '/drug/label.json', search, 'limit=20', signal, 'drug/label');
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  var items = d.results.map(function (l) {
    var of = l.openfda || {};
    var conf = labelMatch(l, terms);
    var title = first(of.brand_name) || trunc(first(l.spl_product_data_elements) || 'SPL label', 60);
    return putRecord('label', title, 'openfda-drug', {
      brand: arr(of.brand_name), generic: arr(of.generic_name), substance: arr(of.substance_name), manufacturer: arr(of.manufacturer_name), appl: arr(of.application_number),
      productType: arr(of.product_type), route: arr(of.route), rxcui: arr(of.rxcui), splId: l.id, setId: l.set_id, version: l.version, effective: l.effective_time,
      spl: first(l.spl_product_data_elements), openfdaEmpty: !Object.keys(of).length, sections: pickLabelSections(l), confidence: conf
    }, prov('openfda-drug', 'drug/label', l.set_id, l.set_id ? LINK.dailymedSet(l.set_id) : '', { confidence: conf, category: conf === 'Exact' ? 'source-reported' : 'ambiguous' }));
  }).sort(function (a, b) { return CONF_RANK[a.data.confidence] - CONF_RANK[b.data.confidence] || String(b.data.effective || '').localeCompare(String(a.data.effective || '')); });
  return { items: items, total: fdaTotal(d), lastUpdated: fdaLastUpdated(d) };
};
var LABEL_SECTIONS = [
  ['boxed_warning', 'Boxed warning'], ['indications_and_usage', 'Indications and usage'], ['dosage_and_administration', 'Dosage and administration'], ['dosage_forms_and_strengths', 'Dosage forms and strengths'],
  ['contraindications', 'Contraindications'], ['warnings_and_cautions', 'Warnings and precautions'], ['adverse_reactions', 'Adverse reactions'], ['drug_interactions', 'Drug interactions'],
  ['use_in_specific_populations', 'Use in specific populations'], ['overdosage', 'Overdosage'], ['description', 'Description'], ['clinical_pharmacology', 'Clinical pharmacology'],
  ['mechanism_of_action', 'Mechanism of action'], ['nonclinical_toxicology', 'Nonclinical toxicology'], ['clinical_studies', 'Clinical studies'], ['how_supplied', 'How supplied / storage and handling'],
  ['storage_and_handling', 'Storage and handling'], ['information_for_patients', 'Patient counseling information'], ['recent_major_changes', 'Recent major changes'],
  // Reproductive-health label sections (shown in Onco-Fertility; source-reported text only)
  ['pregnancy', 'Pregnancy'], ['lactation', 'Lactation'], ['nursing_mothers', 'Nursing mothers'], ['females_and_males_of_reproductive_potential', 'Females and males of reproductive potential'],
  ['teratogenic_effects', 'Teratogenic effects'], ['carcinogenesis_and_mutagenesis_and_impairment_of_fertility', 'Carcinogenesis, mutagenesis, impairment of fertility'], ['pregnancy_or_breast_feeding', 'Pregnancy or breast feeding']
];
var REPRO_SECTIONS = ['females_and_males_of_reproductive_potential', 'carcinogenesis_and_mutagenesis_and_impairment_of_fertility', 'pregnancy', 'teratogenic_effects', 'lactation', 'nursing_mothers', 'pregnancy_or_breast_feeding'];
function pickLabelSections(l) { var o = {}; LABEL_SECTIONS.forEach(function (s) { if (l[s[0]]) o[s[0]] = arr(l[s[0]]).join('\n\n'); }); return o; }
Loaders.drugsFda = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var up = terms.map(function (t) { return t.toUpperCase(); });
  var search = [fOR('openfda.generic_name', terms), fOR('openfda.brand_name', terms), fOR('products.brand_name', up), fOR('products.active_ingredients.name', up)].join('+');
  var d = await fdaGet('openfda-drug', '/drug/drugsfda.json', search, 'limit=20', signal, 'drug/drugsfda');
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  var low = terms.map(function (t) { return t.toLowerCase(); });
  var items = d.results.map(function (a) {
    var prods = arr(a.products);
    var names = prods.map(function (p) { return String(p.brand_name || '').toLowerCase(); }).concat(prods.reduce(function (acc, p) { return acc.concat(arr(p.active_ingredients).map(function (i) { return String(i.name || '').toLowerCase(); })); }, []), arr(get(a, 'openfda.generic_name')).map(function (x) { return x.toLowerCase(); }));
    var conf = names.some(function (n) { return low.indexOf(n) >= 0; }) ? 'Exact' : (names.some(function (n) { return low.some(function (t) { return n.indexOf(t) >= 0; }); }) ? 'Likely' : 'Possible');
    return putRecord('approval', (a.application_number || '') + ' \u00b7 ' + (first(prods.map(function (p) { return p.brand_name; })) || a.sponsor_name || ''), 'openfda-drug', {
      appl: a.application_number, sponsor: a.sponsor_name, products: prods.map(function (p) { return { brand: p.brand_name, number: p.product_number, form: p.dosage_form, route: p.route, status: p.marketing_status, reference: p.reference_drug, referenceStandard: p.reference_standard, te: p.te_code, ingredients: arr(p.active_ingredients).map(function (i) { return (i.name || '') + (i.strength ? ' ' + i.strength : ''); }) }; }),
      submissions: arr(a.submissions).map(function (s) { return { type: s.submission_type, number: s.submission_number, status: s.submission_status, date: s.submission_status_date, priority: s.review_priority, classCode: s.submission_class_code_description || s.submission_class_code, docs: arr(s.application_docs).map(function (x) { return { type: x.type, url: x.url, date: x.date }; }) }; })
        .sort(function (x, y) { return String(y.date || '').localeCompare(String(x.date || '')); }),
      generic: arr(get(a, 'openfda.generic_name')), brand: arr(get(a, 'openfda.brand_name')), confidence: conf
    }, prov('openfda-drug', 'drug/drugsfda', a.application_number, LINK.applNo(a.application_number), { confidence: conf }));
  }).sort(function (a, b) { return CONF_RANK[a.data.confidence] - CONF_RANK[b.data.confidence]; });
  return { items: items, total: fdaTotal(d), lastUpdated: fdaLastUpdated(d) };
};
Loaders.drugEvents = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var search = [fOR('patient.drug.openfda.generic_name', terms), fOR('patient.drug.openfda.brand_name', terms)].join('+');
  var base = await fdaGet('openfda-drug', '/drug/event.json', search, 'limit=1', signal, 'drug/event');
  if (!base || !fdaTotal(base)) return { empty: true };
  var res = await Promise.allSettled([
    fdaGet('openfda-drug', '/drug/event.json', search, 'count=serious', signal, 'drug/event count'),
    fdaGet('openfda-drug', '/drug/event.json', search, 'count=patient.reaction.reactionmeddrapt.exact&limit=15', signal, 'drug/event count'),
    fdaGet('openfda-drug', '/drug/event.json', search, 'count=patient.reaction.reactionoutcome', signal, 'drug/event count')
  ]);
  var val = function (r) { return r.status === 'fulfilled' && r.value && Array.isArray(r.value.results) ? r.value.results : null; };
  return { total: fdaTotal(base), lastUpdated: fdaLastUpdated(base), serious: val(res[0]), reactions: val(res[1]), outcomes: val(res[2]), partial: res.some(function (r) { return r.status === 'rejected'; }) };
};
Loaders.drugEnforcement = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var search = [fOR('openfda.generic_name', terms), fOR('openfda.brand_name', terms), fOR('product_description', terms)].join('+');
  var d = await fdaGet('openfda-drug', '/drug/enforcement.json', search, 'limit=25&sort=report_date:desc', signal, 'drug/enforcement');
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  return { total: fdaTotal(d), items: d.results.map(function (r) {
    return putRecord('drug-enforcement', (r.recall_number || r.event_id || '') + ' \u00b7 ' + (r.classification || ''), 'openfda-drug', {
      recallNumber: r.recall_number, eventId: r.event_id, status: r.status, classification: r.classification, reason: r.reason_for_recall, product: r.product_description,
      firm: r.recalling_firm, city: r.city, state: r.state, country: r.country, initiated: fdaDate(r.recall_initiation_date), reported: fdaDate(r.report_date), voluntary: r.voluntary_mandated, distribution: r.distribution_pattern
    }, prov('openfda-drug', 'drug/enforcement', r.recall_number, 'https://www.accessdata.fda.gov/scripts/ires/index.cfm'));
  }) };
};
Loaders.rxnorm = async function (signal, ctx) {
  var name = ctx.brand || ctx.drug;
  var ids = await Net.request('rxnorm', SRC.rxnorm.apiBase + '/rxcui.json?' + qs({ name: name, search: 2 }), { signal: signal, label: 'rxcui' });
  var rxcui = first(get(ids, 'idGroup.rxnormId'));
  var drugs = await Net.request('rxnorm', SRC.rxnorm.apiBase + '/drugs.json?' + qs({ name: ctx.drug }), { signal: signal, label: 'drugs' });
  var groups = arr(get(drugs, 'drugGroup.conceptGroup'));
  var concepts = []; groups.forEach(function (g) { arr(g.conceptProperties).forEach(function (c) { concepts.push({ rxcui: c.rxcui, name: c.name, tty: c.tty || g.tty, synonym: c.synonym }); }); });
  var related = null;
  if (rxcui) {
    var r = await Net.request('rxnorm', SRC.rxnorm.apiBase + '/rxcui/' + encodeURIComponent(rxcui) + '/related.json?tty=IN+BN+PIN', { signal: signal, label: 'related' }).catch(function () { return null; });
    related = []; arr(get(r, 'relatedGroup.conceptGroup')).forEach(function (g) { arr(g.conceptProperties).forEach(function (c) { related.push({ rxcui: c.rxcui, name: c.name, tty: c.tty }); }); });
  }
  if (!rxcui && !concepts.length) return { empty: true };
  return { rxcui: rxcui, concepts: concepts.slice(0, 40), related: related };
};
Loaders.chembl = async function (signal, ctx) {
  var d = await Net.request('chembl', SRC.chembl.apiBase + '/molecule/search.json?' + qs({ q: ctx.drug, limit: 3 }), { signal: signal, label: 'molecule/search' });
  var mols = arr(d && d.molecules);
  if (!mols.length) return { empty: true };
  var m = mols[0];
  var mech = await Net.request('chembl', SRC.chembl.apiBase + '/mechanism.json?' + qs({ molecule_chembl_id: m.molecule_chembl_id, limit: 10 }), { signal: signal, label: 'mechanism' }).catch(function () { return null; });
  return { molecule: { id: m.molecule_chembl_id, name: m.pref_name, type: m.molecule_type, maxPhase: m.max_phase, firstApproval: m.first_approval, synonyms: uniq(arr(m.molecule_synonyms).map(function (s) { return s.molecule_synonym; })).slice(0, 12), props: m.molecule_properties || {} },
    mechanisms: arr(mech && mech.mechanisms).map(function (x) { return { moa: x.mechanism_of_action, action: x.action_type, target: x.target_chembl_id, comment: x.mechanism_comment }; }), others: mols.slice(1).map(function (x) { return { id: x.molecule_chembl_id, name: x.pref_name }; }) };
};
Loaders.pubchem = async function (signal, ctx) {
  var d = await Net.request('pubchem', SRC.pubchem.apiBase + '/compound/name/' + encodeURIComponent(ctx.drug) + '/property/MolecularFormula,MolecularWeight,IUPACName,InChIKey,XLogP/JSON', { signal: signal, notFoundEmpty: true, label: 'compound/property' });
  var p = first(get(d, 'PropertyTable.Properties'));
  return p ? { props: p } : { empty: true };
};

/* ---------------- openFDA: devices ---------------- */
var DEV_CLASS = { '1': 'Class I', '2': 'Class II', '3': 'Class III', 'U': 'Unclassified', 'N': 'Not classified', 'f': 'HDE' };
var SUBMISSION_TYPE = { '1': '510(k)', '2': 'PMA', '4': '510(k) exempt' };
function decision510(code, isDeNovo) {
  code = String(code || '');
  if (isDeNovo || /^DEN/.test(code)) return /^DENG/.test(code) ? { label: 'De Novo request granted', verb: 'granted', kind: 'good' } : { label: 'De Novo decision code ' + code + ' (verify)', verb: 'verify', kind: '' };
  if (/^SE/.test(code)) return { label: 'Cleared \u2014 substantially equivalent (' + code + ')', verb: 'cleared', kind: 'good' };
  if (/^N/.test(code)) return { label: 'Not cleared \u2014 decision code ' + code, verb: 'not cleared', kind: 'bad' };
  return { label: code ? 'Decision code ' + code + ' (verify with FDA)' : 'Decision not reported by source', verb: 'verify', kind: '' };
}
function decisionPMA(code, supplement) {
  code = String(code || '');
  if (code === 'APPR') return { label: supplement ? 'Supplement approved' : 'Approved', verb: 'approved', kind: 'good' };
  if (code === 'OK30') return { label: '30-day notice acknowledged', verb: 'acknowledged', kind: '' };
  if (/^DEN|DENY/.test(code)) return { label: 'Denied (' + code + ')', verb: 'denied', kind: 'bad' };
  if (/WD|WITH/.test(code)) return { label: 'Withdrawn (' + code + ')', verb: 'withdrawn', kind: 'warn' };
  return { label: code ? 'Decision code ' + code + ' (verify with FDA)' : 'Decision not reported by source', verb: 'verify', kind: '' };
}
function oncologyTags(text) {
  var t = String(text || '').toLowerCase(), tags = [];
  if (/radiat|linear accelerator|linac|brachy|proton|gamma knife|radiotherapy|radiosurg/.test(t)) tags.push('Radiation therapy');
  if (/robot|surgical|laparoscop|endoscop/.test(t)) tags.push('Surgical / robotic');
  if (/infusion|pump|port|catheter|drug delivery/.test(t)) tags.push('Infusion / drug delivery');
  if (/imaging|pet|tomograph|mri|magnetic resonance|ultrasound|x-ray|mammograph|scanner/.test(t)) tags.push('Imaging');
  if (/sequencing|ngs|mutation|companion|in vitro|assay|pcr|immunohisto|ihc|fish|ctdna|cfdna|cell-free|liquid biopsy|tumor profil|somatic|germline|test/.test(t)) tags.push('IVD / CDx / NGS');
  if (/software|algorithm|artificial intelligence|machine learning|computer-assisted|cad/.test(t)) tags.push('SaMD / AI-ML');
  if (/prosthe|reconstruct|breast implant|tissue expander/.test(t)) tags.push('Prosthetic / reconstructive');
  if (/monitor|wearable/.test(t)) tags.push('Monitoring / wearable');
  if (/ablation|cryo|hyperthermia|electrochemotherapy|tumor treating/.test(t)) tags.push('Ablation / local therapy');
  return tags;
}
function norm510k(r) {
  var dn = /^DEN/i.test(r.k_number || '');
  var dec = decision510(r.decision_code, dn);
  var of = r.openfda || {};
  return putRecord('device-auth', (r.k_number || '') + ' \u00b7 ' + (r.device_name || ''), 'openfda-device', {
    pathway: dn ? 'De Novo' : '510(k)', pathwayVerb: dn ? 'De Novo classification' : 'Clearance', number: r.k_number, decisionCode: r.decision_code, decision: dec, decisionDate: r.decision_date, received: r.date_received,
    applicant: r.applicant, deviceName: r.device_name, productCode: r.product_code, regulation: first(of.regulation_number), panel: r.advisory_committee_description, deviceClass: DEV_CLASS[first(of.device_class)] || first(of.device_class),
    clearanceType: r.clearance_type, summary: r.statement_or_summary, thirdParty: r.third_party_flag, expedited: r.expedited_review_flag, tags: oncologyTags((r.device_name || '') + ' ' + (of.device_name || '') + ' ' + (of.medical_specialty_description || ''))
  }, prov('openfda-device', 'device/510k', r.k_number, LINK.k510(r.k_number), { mayLag: true }));
}
function normPMA(rows) {
  // Group original + supplements under one PMA number.
  var groups = new Map();
  rows.forEach(function (r) { var k = r.pma_number || 'unknown'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  var out = [];
  groups.forEach(function (list, num) {
    list.sort(function (a, b) { return String(b.decision_date || '').localeCompare(String(a.decision_date || '')); });
    var orig = list.find(function (r) { return !r.supplement_number; }) || null;
    var head = orig || list[list.length - 1];
    var of = head.openfda || {};
    var dec = decisionPMA(head.decision_code, !orig);
    out.push(putRecord('device-auth', num + ' \u00b7 ' + (head.trade_name || head.generic_name || ''), 'openfda-device', {
      pathway: 'PMA', pathwayVerb: 'Approval', number: num, original: !!orig, decisionCode: head.decision_code, decision: dec, decisionDate: head.decision_date, received: head.date_received,
      applicant: head.applicant, deviceName: head.trade_name, genericName: head.generic_name, productCode: head.product_code, regulation: first(of.regulation_number), panel: head.advisory_committee_description,
      deviceClass: DEV_CLASS[first(of.device_class)] || first(of.device_class), aoStatement: head.ao_statement, docket: head.docket_number, expedited: head.expedited_review_flag,
      supplements: list.filter(function (r) { return r.supplement_number; }).map(function (r) { return { number: r.supplement_number, date: r.decision_date, type: r.supplement_type, reason: r.supplement_reason, code: r.decision_code, ao: r.ao_statement, trade: r.trade_name }; }),
      tags: oncologyTags((head.trade_name || '') + ' ' + (head.generic_name || '') + ' ' + (head.ao_statement || ''))
    }, prov('openfda-device', 'device/pma', num, LINK.pma(num), { mayLag: true })));
  });
  return out;
}
function normClass(r) {
  return putRecord('device-class', (r.product_code || '') + ' \u00b7 ' + (r.device_name || ''), 'openfda-device', {
    productCode: r.product_code, deviceName: r.device_name, deviceClass: DEV_CLASS[r.device_class] || r.device_class, regulation: r.regulation_number, panel: r.review_panel, specialty: r.medical_specialty_description,
    definition: r.definition, submissionType: SUBMISSION_TYPE[r.submission_type_id] || (r.submission_type_id ? 'Submission type code ' + r.submission_type_id + ' (verify)' : null),
    implant: r.implant_flag, lifeSustaining: r.life_sustain_support_flag, gmpExempt: r.gmp_exempt_flag, thirdParty: r.third_party_flag, pmaNumbers: arr(get(r, 'openfda.pma_number')).slice(0, 20),
    k510: arr(get(r, 'openfda.k_number')).slice(0, 20), tags: oncologyTags((r.device_name || '') + ' ' + (r.definition || ''))
  }, prov('openfda-device', 'device/classification', r.product_code, LINK.productCode(r.product_code), { mayLag: true }));
}
function normUDI(r) {
  var di = (arr(r.identifiers).find(function (i) { return i.type === 'Primary'; }) || arr(r.identifiers)[0] || {});
  return putRecord('device-udi', (r.brand_name || '') + (r.version_or_model_number ? ' \u00b7 ' + r.version_or_model_number : ''), 'openfda-device', {
    di: di.id, agency: di.issuing_agency, brand: r.brand_name, model: r.version_or_model_number, company: r.company_name, description: r.device_description,
    productCodes: arr(r.product_codes).map(function (p) { return { code: p.code, name: p.name }; }), gmdn: arr(r.gmdn_terms).map(function (g) { return g.name; }),
    submissions: arr(r.premarket_submissions).map(function (s) { return s.submission_number + (s.supplement_number ? ' S' + s.supplement_number : ''); }), distribution: r.commercial_distribution_status,
    rx: r.is_rx, otc: r.is_otc, kit: r.is_kit, mri: r.mri_safety, published: r.publish_date, recordStatus: r.record_status
  }, prov('openfda-device', 'device/udi', di.id, di.id ? LINK.gudid(di.id) : linkout('gudid', r.brand_name || ''), { mayLag: true }));
}
function deviceSearch(ctx) {
  // Returns openFDA search expressions for each endpoint based on context.
  var id = ctx.deviceId, t = ctx.deviceText;
  if (id) {
    if (id.kind === '510k' || id.kind === 'denovo') return { k510: fq('k_number', id.value), udi: fq('premarket_submissions.submission_number', id.value), recall: fq('k_numbers', id.value), event: fq('pma_pmn_number', id.value) };
    if (id.kind === 'pma' || id.kind === 'hde') return { pma: fq('pma_number', id.value), udi: fq('premarket_submissions.submission_number', id.value), recall: fq('pma_numbers', id.value), event: fq('pma_pmn_number', id.value) };
    if (id.kind === 'productcode') return { cls: fq('product_code', id.value), k510: fq('product_code', id.value), pma: fq('product_code', id.value), udi: fq('product_codes.code', id.value), recall: fq('product_code', id.value), event: fq('device.device_report_product_code', id.value) };
    if (id.kind === 'regulation') return { cls: fq('regulation_number', id.value) };
    if (id.kind === 'udi') return { udi: fq('identifiers.id', id.value) };
  }
  if (t) {
    var terms = [t];
    var core = t.replace(/\b(fda|device|devices|system|the|an?|test|tests)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (core && core.toLowerCase() !== t.toLowerCase() && core.length > 2) terms.push(core);
    return {
      cls: fOR('device_name', terms), k510: [fOR('device_name', terms), fOR('applicant', [t])].join('+'), pma: [fOR('trade_name', terms), fOR('generic_name', terms), fOR('ao_statement', [t])].join('+'),
      udi: [fOR('brand_name', terms), fOR('device_description', [t])].join('+'), recall: fOR('product_description', terms), event: [fOR('device.brand_name', terms), fOR('device.generic_name', terms)].join('+'),
      enf: fOR('product_description', terms)
    };
  }
  return {};
}
Loaders.devAuth = async function (signal, ctx) {
  var s = deviceSearch(ctx), jobs = [];
  if (s.k510) jobs.push(fdaGet('openfda-device', '/device/510k.json', s.k510, 'limit=50&sort=decision_date:desc', signal, 'device/510k').then(function (d) { return { kind: '510k', d: d }; }));
  if (s.pma) jobs.push(fdaGet('openfda-device', '/device/pma.json', s.pma, 'limit=100&sort=decision_date:desc', signal, 'device/pma').then(function (d) { return { kind: 'pma', d: d }; }));
  if (!jobs.length) return { empty: true };
  var res = await Promise.allSettled(jobs);
  var items = [], totals = {}, failed = 0;
  res.forEach(function (r) {
    if (r.status !== 'fulfilled') { failed++; return; }
    var d = r.value.d; if (!d || !Array.isArray(d.results)) { totals[r.value.kind] = 0; return; }
    totals[r.value.kind] = fdaTotal(d);
    if (r.value.kind === '510k') items = items.concat(d.results.map(norm510k)); else items = items.concat(normPMA(d.results));
  });
  if (failed === res.length) throw res[0].reason;
  items.sort(function (a, b) { return String(b.data.decisionDate || '').localeCompare(String(a.data.decisionDate || '')); });
  return { items: items, totals: totals, partial: failed > 0, empty: !items.length };
};
Loaders.devClass = async function (signal, ctx) {
  var s = deviceSearch(ctx);
  var search = s.cls;
  if (!search) {
    // derive product codes from loaded authorizations
    var codes = uniq((slot('dev:auth').data ? slot('dev:auth').data.items : []).map(function (r) { return r.data.productCode; })).slice(0, 10);
    if (!codes.length) return { empty: true };
    search = fOR('product_code', codes);
  }
  var d = await fdaGet('openfda-device', '/device/classification.json', search, 'limit=25', signal, 'device/classification');
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  return { items: d.results.map(normClass), total: fdaTotal(d) };
};
Loaders.devUDI = async function (signal, ctx) {
  var s = deviceSearch(ctx);
  if (!s.udi) return { empty: true };
  var d = await fdaGet('openfda-device', '/device/udi.json', s.udi, 'limit=15', signal, 'device/udi');
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  return { items: d.results.map(normUDI), total: fdaTotal(d) };
};
Loaders.devEvents = async function (signal, ctx, page) {
  var s = deviceSearch(ctx); var search = s.event;
  if (!search) {
    var codes = uniq((slot('dev:auth').data ? slot('dev:auth').data.items : []).map(function (r) { return r.data.productCode; })).slice(0, 5);
    if (!codes.length) return { empty: true };
    search = fOR('device.device_report_product_code', codes);
  }
  var skip = (page || 0) * 10;
  var res = await Promise.allSettled([
    fdaGet('openfda-device', '/device/event.json', search, 'limit=10&skip=' + skip + '&sort=date_received:desc', signal, 'device/event'),
    fdaGet('openfda-device', '/device/event.json', search, 'count=event_type.exact', signal, 'device/event count'),
    fdaGet('openfda-device', '/device/event.json', search, 'count=product_problems.exact&limit=12', signal, 'device/event count')
  ]);
  if (res[0].status !== 'fulfilled') throw res[0].reason;
  var d = res[0].value;
  if (!d || !Array.isArray(d.results) || !d.results.length) return { empty: true };
  var items = d.results.map(function (r) {
    // Whitelist structured fields only. Narrative (mdr_text), patient demographics,
    // lot/serial numbers and contact data are deliberately NOT retained.
    var devs = arr(r.device).map(function (x) { return { brand: x.brand_name, generic: x.generic_name, manufacturer: x.manufacturer_d_name, productCode: x.device_report_product_code }; });
    var outcomes = uniq(arr(r.patient).reduce(function (acc, p) { return acc.concat(arr(p.sequence_number_outcome)); }, []).map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x.length > 2; }));
    return putRecord('device-event', (r.report_number || r.mdr_report_key || '') + ' \u00b7 ' + (r.event_type || ''), 'openfda-device', {
      mdrKey: r.mdr_report_key, reportNumber: r.report_number, eventType: r.event_type, eventDate: fdaDate(r.date_of_event), received: fdaDate(r.date_received), adverseFlag: r.adverse_event_flag,
      productProblemFlag: r.product_problem_flag, problems: arr(r.product_problems), devices: devs, outcomes: outcomes, remedial: arr(r.remedial_action), source: r.report_source_code,
      reporterOccupation: r.reporter_occupation_code, submission: r.pma_pmn_number, typeOfReport: arr(r.type_of_report)
    }, prov('openfda-device', 'device/event', r.mdr_report_key, LINK.maude(r.mdr_report_key), { mayLag: true }));
  });
  var cnt = function (r) { return r.status === 'fulfilled' && r.value && Array.isArray(r.value.results) ? r.value.results : null; };
  return { items: items, total: fdaTotal(d), page: page || 0, byType: cnt(res[1]), problems: cnt(res[2]), search: search, partial: res.some(function (r) { return r.status === 'rejected'; }) };
};
Loaders.devRecalls = async function (signal, ctx) {
  var s = deviceSearch(ctx); var search = s.recall;
  if (!search) {
    var codes = uniq((slot('dev:auth').data ? slot('dev:auth').data.items : []).map(function (r) { return r.data.productCode; })).slice(0, 5);
    if (!codes.length) return { empty: true };
    search = fOR('product_code', codes);
  }
  var d = await fdaGet('openfda-device', '/device/recall.json', search, 'limit=25&sort=event_date_initiated:desc', signal, 'device/recall');
  var recalls = d && Array.isArray(d.results) ? d.results : [];
  var enfItems = [];
  var nums = uniq(recalls.map(function (r) { return r.product_res_number; })).slice(0, 25);
  if (nums.length) {
    var e = await fdaGet('openfda-device', '/device/enforcement.json', fOR('recall_number', nums), 'limit=25', signal, 'device/enforcement').catch(function () { return null; });
    enfItems = e && Array.isArray(e.results) ? e.results : [];
  } else if (s.enf) {
    var e2 = await fdaGet('openfda-device', '/device/enforcement.json', s.enf, 'limit=25&sort=report_date:desc', signal, 'device/enforcement').catch(function () { return null; });
    enfItems = e2 && Array.isArray(e2.results) ? e2.results : [];
  }
  var enfBy = new Map(enfItems.map(function (x) { return [x.recall_number, x]; }));
  var items = recalls.map(function (r) {
    var en = enfBy.get(r.product_res_number) || {};
    enfBy.delete(r.product_res_number);
    return recallRecord(r, en);
  }).concat(Array.from(enfBy.values()).map(function (en) { return recallRecord({}, en); }));
  if (!items.length) return { empty: true };
  return { items: items, total: Math.max(fdaTotal(d), items.length) };
};
function recallRecord(r, en) {
  var num = r.product_res_number || en.recall_number;
  return putRecord('device-recall', (num || '') + ' \u00b7 ' + (en.classification || 'Classification not reported'), 'openfda-device', {
    recallNumber: num, eventNumber: r.res_event_number || en.event_id, cfresId: r.cfres_id, status: r.recall_status || en.status, classification: en.classification || null,
    reason: r.reason_for_recall || en.reason_for_recall, rootCause: r.root_cause_description, product: r.product_description || en.product_description, productCode: r.product_code, firm: r.recalling_firm || en.recalling_firm,
    country: en.country, state: r.state || en.state, initiated: r.event_date_initiated || fdaDate(en.recall_initiation_date), terminated: r.event_date_terminated || fdaDate(en.termination_date),
    reportDate: fdaDate(en.report_date), k510: arr(r.k_numbers), pma: arr(r.pma_numbers), action: r.action, voluntary: en.voluntary_mandated, distribution: r.distribution_pattern || en.distribution_pattern,
    deviceClass: DEV_CLASS[first(get(r, 'openfda.device_class'))] || null
  }, prov('openfda-device', r.product_res_number ? 'device/recall + device/enforcement' : 'device/enforcement', num, LINK.recall(r.cfres_id), { mayLag: true }));
}
/* Companion-diagnostic discovery (opt-in). Confidence rules:
   Exact    = the drug label text contains the device's PMA/510(k) number (shared identifier)
   Likely   = the drug name appears in the device approval-order / intended-use statement
   Possible = keyword co-occurrence only (e.g. a gene named in the label and in a device name)
   Possible is never upgraded silently. */
var CDX_SENTENCE_RE = /(companion diagnostic|FDA[- ]approved test|FDA[- ]cleared test|approved test for|test (?:for|to) (?:the )?(?:detection|detect|select|identify)|select patients)/i;
function labelCdxSentences(label) {
  if (!label || !label.data || !label.data.sections) return [];
  var out = [];
  ['indications_and_usage', 'dosage_and_administration', 'clinical_studies', 'warnings_and_cautions'].forEach(function (k) {
    var txt = label.data.sections[k]; if (!txt) return;
    String(txt).split(/(?<=[.;])\s+/).forEach(function (s) { if (CDX_SENTENCE_RE.test(s) && out.length < 8) out.push({ section: k, text: trunc(s.trim(), 420) }); });
  });
  return out;
}
Loaders.cdxForDrug = async function (signal, ctx) {
  var terms = drugTerms(ctx);
  var labelSlot = slot('drug:labels');
  var label = labelSlot.data && labelSlot.data.items ? labelSlot.data.items[0] : null;
  var sentences = labelCdxSentences(label);
  var labelText = label ? Object.keys(label.data.sections).map(function (k) { return label.data.sections[k]; }).join(' ') : '';
  var d = await fdaGet('openfda-device', '/device/pma.json', fOR('ao_statement', terms), 'limit=100&sort=decision_date:desc', signal, 'device/pma (CDx)');
  var groups = d && Array.isArray(d.results) ? normPMA(d.results) : [];
  var cands = groups.map(function (g) {
    var num = g.data.number;
    var conf = labelText && num && labelText.indexOf(num) >= 0 ? 'Exact' : 'Likely';
    var quote = (g.data.supplements.concat([{ ao: g.data.aoStatement }]).map(function (x) { return x.ao; }).find(function (a) { return a && terms.some(function (t) { return a.toLowerCase().indexOf(t.toLowerCase()) >= 0; }); })) || g.data.aoStatement;
    return { rec: g, confidence: conf, basis: conf === 'Exact' ? 'Device number appears in the drug label text' : 'Drug name appears in the device approval-order statement', quote: quote };
  });
  // Possible: genes mentioned in label indications that also appear in device trade/generic names.
  var genes = [];
  if (label && label.data.sections.indications_and_usage) {
    String(label.data.sections.indications_and_usage).split(/[^A-Za-z0-9-]+/).forEach(function (w) { if (GENES.has(w) && genes.indexOf(w) < 0 && !GENE_WORDS.has(w)) genes.push(w); });
  }
  if (genes.length) {
    var gp = await fdaGet('openfda-device', '/device/pma.json', [fOR('trade_name', genes.slice(0, 4)), fOR('generic_name', genes.slice(0, 4))].join('+'), 'limit=60&sort=decision_date:desc', signal, 'device/pma (gene)').catch(function () { return null; });
    var have = new Set(cands.map(function (c) { return c.rec.data.number; }));
    (gp && Array.isArray(gp.results) ? normPMA(gp.results) : []).forEach(function (g) {
      if (!have.has(g.data.number)) cands.push({ rec: g, confidence: 'Possible', basis: 'Keyword co-occurrence only: ' + genes.slice(0, 4).join(', ') + ' named in label indications and device name', quote: null });
    });
  }
  cands.sort(function (a, b) { return CONF_RANK[a.confidence] - CONF_RANK[b.confidence]; });
  cands.forEach(function (c) { c.rec.prov.category = 'derived'; c.rec.prov.confidence = c.confidence; });
  return { sentences: sentences, candidates: cands, genes: genes, labelLoaded: !!label, empty: !cands.length && !sentences.length };
};
Loaders.diagnosticsForGene = async function (signal, gene) {
  var search = [fOR('trade_name', [gene]), fOR('generic_name', [gene]), fOR('ao_statement', [gene])].join('+');
  var res = await Promise.allSettled([
    fdaGet('openfda-device', '/device/pma.json', search, 'limit=100&sort=decision_date:desc', signal, 'device/pma (gene)'),
    fdaGet('openfda-device', '/device/510k.json', fOR('device_name', [gene]), 'limit=25&sort=decision_date:desc', signal, 'device/510k (gene)')
  ]);
  if (res.every(function (r) { return r.status === 'rejected'; })) throw res[0].reason;
  var out = [];
  if (res[0].status === 'fulfilled' && res[0].value && res[0].value.results) normPMA(res[0].value.results).forEach(function (g) {
    var inName = ((g.data.deviceName || '') + ' ' + (g.data.genericName || '')).toUpperCase().indexOf(gene) >= 0;
    g.prov.category = 'derived'; g.prov.confidence = inName ? 'Likely' : 'Possible';
    out.push({ rec: g, confidence: inName ? 'Likely' : 'Possible', basis: inName ? gene + ' appears in the device name' : gene + ' appears only in approval-order text' });
  });
  if (res[1].status === 'fulfilled' && res[1].value && res[1].value.results) res[1].value.results.map(norm510k).forEach(function (r) { r.prov.category = 'derived'; r.prov.confidence = 'Likely'; out.push({ rec: r, confidence: 'Likely', basis: gene + ' appears in the device name' }); });
  out.sort(function (a, b) { return CONF_RANK[a.confidence] - CONF_RANK[b.confidence]; });
  return out.length ? { candidates: out, gene: gene } : { empty: true, gene: gene };
};

/* ---------------- Genes / variants / proteins ---------------- */
Loaders.mygene = async function (signal, symbol) {
  var d = await Net.request('mygene', SRC.mygene.apiBase + '/query?' + qs({ q: 'symbol:' + symbol, species: 'human', size: 5, fields: 'symbol,name,alias,summary,type_of_gene,genomic_pos,map_location,ensembl.gene,uniprot.Swiss-Prot,entrezgene,go.BP.term,go.MF.term,go.CC.term,HGNC' }), { signal: signal, label: 'query' });
  var hits = arr(d && d.hits);
  if (!hits.length) return { empty: true };
  var exact = hits.filter(function (h) { return String(h.symbol).toUpperCase() === symbol.toUpperCase(); });
  var items = (exact.length ? exact : hits).map(function (h) {
    var gp = Array.isArray(h.genomic_pos) ? (h.genomic_pos.find(function (x) { return /^[0-9XYM]+$/.test(String(x.chr)); }) || h.genomic_pos[0]) : h.genomic_pos;
    return putRecord('gene', h.symbol, 'mygene', {
      symbol: h.symbol, name: h.name, aliases: arr(h.alias), summary: h.summary, geneType: h.type_of_gene, chr: gp ? gp.chr : null, start: gp ? gp.start : null, end: gp ? gp.end : null, strand: gp ? gp.strand : null,
      cytoband: h.map_location, ensembl: first(arr(get(h, 'ensembl')).map(function (e) { return e.gene; })) || get(h, 'ensembl.gene'), uniprot: first(arr(get(h, 'uniprot.Swiss-Prot'))), entrez: h.entrezgene || h._id, hgnc: h.HGNC,
      go: { BP: uniq(arr(get(h, 'go.BP')).map(function (g) { return g.term; })).slice(0, 12), MF: uniq(arr(get(h, 'go.MF')).map(function (g) { return g.term; })).slice(0, 12), CC: uniq(arr(get(h, 'go.CC')).map(function (g) { return g.term; })).slice(0, 12) }
    }, prov('mygene', 'query', h.entrezgene || h._id, LINK.ncbiGene(h.entrezgene || h._id), { confidence: exact.length ? 'Exact' : 'Possible' }));
  });
  return { items: items, exact: exact.length > 0 };
};
Loaders.ensemblGene = async function (signal, symbolOrId) {
  var isId = /^ENS[GTP]\d+/i.test(symbolOrId);
  var url = SRC.ensembl.apiBase + (isId ? '/lookup/id/' + encodeURIComponent(symbolOrId) : '/lookup/symbol/homo_sapiens/' + encodeURIComponent(symbolOrId)) + '?content-type=application/json';
  var d = await Net.request('ensembl', url, { signal: signal, notFoundEmpty: true, label: isId ? 'lookup/id' : 'lookup/symbol' }).catch(function (e) { if (e.kind === 'http') return null; throw e; });
  if (!d || !d.id) return { empty: true };
  return { gene: { id: d.id, symbol: d.display_name, description: d.description, biotype: d.biotype, chr: d.seq_region_name, start: d.start, end: d.end, strand: d.strand, assembly: d.assembly_name, canonical: d.canonical_transcript, objectType: d.object_type, parent: d.Parent } };
};
var MV_FIELDS = '_id,chrom,vcf,dbsnp.rsid,dbsnp.gene.symbol,clinvar.variant_id,clinvar.rcv.clinical_significance,clinvar.rcv.conditions.name,clinvar.rcv.review_status,clinvar.hgvs,cadd.phred,cadd.consequence,dbnsfp.genename,dbnsfp.aa,dbnsfp.hgvsc,dbnsfp.hgvsp,dbnsfp.sift.pred,dbnsfp.polyphen2.hdiv.pred,dbnsfp.revel.score,dbnsfp.alphamissense.pred,snpeff.ann.effect,snpeff.ann.putative_impact,snpeff.ann.hgvs_c,snpeff.ann.hgvs_p,snpeff.ann.feature_id,gnomad_exome.af.af,gnomad_genome.af.af,cosmic.cosmic_id';
function normMyVariant(h) {
  var ann = arr(get(h, 'snpeff.ann'));
  var rcv = arr(get(h, 'clinvar.rcv'));
  var sig = countBy(rcv, function (r) { return r.clinical_significance; });
  var dbn = h.dbnsfp || {};
  var aa = arr(dbn.aa)[0] || {};
  var gene = first(arr(dbn.genename)) || get(h, 'dbsnp.gene.symbol') || first(arr(get(h, 'dbsnp.gene')).map(function (g) { return g.symbol; })) || (ann[0] && ann[0].gene_name);
  return putRecord('variant', h._id, 'myvariant', {
    id: h._id, rsid: get(h, 'dbsnp.rsid'), gene: gene, chrom: h.chrom, pos: get(h, 'vcf.position'), ref: get(h, 'vcf.ref'), alt: get(h, 'vcf.alt'),
    hgvsc: uniq(arr(dbn.hgvsc).concat(ann.map(function (a) { return a.hgvs_c; }))).slice(0, 4), hgvsp: uniq(arr(dbn.hgvsp).concat(ann.map(function (a) { return a.hgvs_p; }))).slice(0, 4),
    aaRef: first(arr(aa.ref)), aaPos: first(arr(aa.pos)), aaAlt: first(arr(aa.alt)),
    consequence: uniq(ann.map(function (a) { return a.effect; })).slice(0, 3), impact: uniq(ann.map(function (a) { return a.putative_impact; })).slice(0, 2),
    sift: uniq(arr(get(dbn, 'sift.pred'))).slice(0, 3), polyphen: uniq(arr(get(dbn, 'polyphen2.hdiv.pred'))).slice(0, 3), revel: first(arr(get(dbn, 'revel.score'))), alphamissense: uniq(arr(get(dbn, 'alphamissense.pred'))).slice(0, 2),
    cadd: get(h, 'cadd.phred'), clinvarId: get(h, 'clinvar.variant_id'), clinvar: sig, clinvarConditions: uniq(rcv.reduce(function (a, r) { return a.concat(arr(r.conditions).map(function (c) { return c.name; })); }, [])).slice(0, 8),
    gnomadExome: get(h, 'gnomad_exome.af.af'), gnomadGenome: get(h, 'gnomad_genome.af.af'), cosmic: get(h, 'cosmic.cosmic_id'), assembly: 'GRCh37/hg19 (MyVariant default)'
  }, prov('myvariant', 'query', h._id, 'https://myvariant.info/v1/variant/' + encodeURIComponent(h._id)));
}
Loaders.myvariant = async function (signal, ctx) {
  var url;
  if (ctx.type === 'hgvs' && ctx.genomic) url = SRC.myvariant.apiBase + '/variant/' + encodeURIComponent(ctx.hgvs) + '?' + qs({ fields: MV_FIELDS });
  else {
    var q;
    if (ctx.rsid) q = 'dbsnp.rsid:' + ctx.rsid;
    else if (ctx.gene && ctx.change && ctx.change.alt && ctx.change.alt.length === 1) q = 'dbnsfp.genename:' + ctx.gene + ' AND dbnsfp.aa.ref:' + ctx.change.ref + ' AND dbnsfp.aa.pos:' + ctx.change.pos + ' AND dbnsfp.aa.alt:' + ctx.change.alt;
    else if (ctx.hgvs) q = '"' + ctx.hgvs.replace(/"/g, '') + '"';
    else return { empty: true, reason: 'needVariant' };
    url = SRC.myvariant.apiBase + '/query?' + qs({ q: q, fields: MV_FIELDS, size: 10 });
  }
  var d = await Net.request('myvariant', url, { signal: signal, notFoundEmpty: true, label: ctx.genomic ? 'variant' : 'query' });
  var hits = !d ? [] : (d.hits ? d.hits : (d._id ? [d] : []));
  if (!hits.length) return { empty: true };
  return { items: hits.map(normMyVariant), total: d.total || hits.length };
};
Loaders.vep = async function (signal, ctx, rsid) {
  var id = rsid || ctx.rsid;
  var url;
  if (id) url = SRC.ensembl.apiBase + '/vep/human/id/' + encodeURIComponent(id) + '?content-type=application/json&canonical=1&hgvs=1';
  else if (ctx.hgvs && ctx.transcript) url = SRC.ensembl.apiBase + '/vep/human/hgvs/' + encodeURIComponent(ctx.hgvs) + '?content-type=application/json&canonical=1&hgvs=1' + (/^(NM|NR|XM)_/i.test(ctx.transcript) ? '&refseq=1' : '');
  else return { empty: true, reason: 'needId' };
  var d = await Net.request('ensembl', url, { signal: signal, label: id ? 'vep/id' : 'vep/hgvs', timeoutMs: 35000 });
  var v = first(arr(d));
  if (!v) return { empty: true };
  var tcs = arr(v.transcript_consequences);
  var canon = tcs.filter(function (t) { return t.canonical === 1; });
  return { id: v.id || v.input, input: v.input, assembly: v.assembly_name, chr: v.seq_region_name, start: v.start, end: v.end, allele: v.allele_string, mostSevere: v.most_severe_consequence,
    colocated: arr(v.colocated_variants).map(function (c) { return c.id; }).filter(Boolean).slice(0, 8),
    consequences: (canon.length ? canon : tcs).slice(0, 12).map(function (t) { return { transcript: t.transcript_id, gene: t.gene_symbol, terms: arr(t.consequence_terms), impact: t.impact, aa: t.amino_acids, proteinStart: t.protein_start, hgvsc: t.hgvsc, hgvsp: t.hgvsp, sift: t.sift_prediction, polyphen: t.polyphen_prediction, canonical: t.canonical === 1, allele: t.variant_allele }; }) };
};
Loaders.uniprot = async function (signal, gene, acc) {
  var q = acc ? 'accession:' + acc : 'gene_exact:' + gene + ' AND organism_id:9606 AND reviewed:true';
  var d = await Net.request('uniprot', SRC.uniprot.apiBase + '/uniprotkb/search?' + qs({ query: q, size: 1, format: 'json', fields: 'accession,id,protein_name,gene_names,length,cc_function,cc_subcellular_location,ft_domain,ft_region,ft_mod_res,go_p,go_f,go_c,xref_pdb,cc_disease' }), { signal: signal, label: 'uniprotkb/search' });
  var e = first(arr(d && d.results));
  if (!e) return { empty: true };
  var comments = arr(e.comments);
  var txt = function (type) { return comments.filter(function (c) { return c.commentType === type; }).reduce(function (a, c) { return a.concat(arr(c.texts).map(function (t) { return t.value; })); }, []); };
  var feats = arr(e.features);
  var ft = function (type) { return feats.filter(function (f) { return f.type === type; }).map(function (f) { return { desc: f.description, start: get(f, 'location.start.value'), end: get(f, 'location.end.value') }; }); };
  var xrefs = arr(e.uniProtKBCrossReferences);
  var go = { P: [], F: [], C: [] };
  xrefs.filter(function (x) { return x.database === 'GO'; }).forEach(function (x) { var term = (arr(x.properties).find(function (p) { return p.key === 'GoTerm'; }) || {}).value || ''; var k = term.charAt(0); if (go[k] && go[k].length < 15) go[k].push(term.slice(2)); });
  var pdb = xrefs.filter(function (x) { return x.database === 'PDB'; }).map(function (x) { var pr = {}; arr(x.properties).forEach(function (p) { pr[p.key] = p.value; }); return { id: x.id, method: pr.Method, resolution: pr.Resolution, chains: pr.Chains }; });
  var rec = putRecord('protein', e.primaryAccession + ' \u00b7 ' + (get(e, 'proteinDescription.recommendedName.fullName.value') || ''), 'uniprot', {
    acc: e.primaryAccession, entryName: e.uniProtkbId, name: get(e, 'proteinDescription.recommendedName.fullName.value'), gene: get(first(arr(e.genes)) || {}, 'geneName.value'), length: get(e, 'sequence.length'),
    functionText: txt('FUNCTION'), subcellular: comments.filter(function (c) { return c.commentType === 'SUBCELLULAR LOCATION'; }).reduce(function (a, c) { return a.concat(arr(c.subcellularLocations).map(function (s) { return get(s, 'location.value'); })); }, []).filter(Boolean),
    diseases: comments.filter(function (c) { return c.commentType === 'DISEASE' && c.disease; }).map(function (c) { return { name: c.disease.diseaseId, acronym: c.disease.acronym, description: c.disease.description }; }),
    domains: ft('Domain'), regions: ft('Region').slice(0, 15), ptms: ft('Modified residue').slice(0, 25), go: go, pdb: pdb
  }, prov('uniprot', 'uniprotkb/search', e.primaryAccession, LINK.uniprot(e.primaryAccession)));
  return { protein: rec };
};
Loaders.reactome = async function (signal, acc, gene) {
  var d = acc ? await Net.request('reactome', SRC.reactome.apiBase + '/data/mapping/UniProt/' + encodeURIComponent(acc) + '/pathways?species=9606', { signal: signal, notFoundEmpty: true, label: 'mapping/pathways' }) : null;
  var items = arr(d).map(function (p) { return { stId: p.stId, name: p.displayName, disease: p.isInDisease, diagram: p.hasDiagram }; });
  if (!items.length && gene) {
    var s = await Net.request('reactome', SRC.reactome.apiBase + '/search/query?' + qs({ query: gene, species: 'Homo sapiens', types: 'Pathway', cluster: 'true' }), { signal: signal, notFoundEmpty: true, label: 'search/query' });
    arr(s && s.results).forEach(function (g) { arr(g.entries).forEach(function (e) { items.push({ stId: e.stId, name: stripTags(e.name), disease: e.isDisease, fromSearch: true }); }); });
  }
  return items.length ? { items: items.slice(0, 60) } : { empty: true };
};
Loaders.string = async function (signal, gene) {
  var d = await Net.request('string', SRC.string.apiBase + '/json/interaction_partners?' + qs({ identifiers: gene, species: 9606, limit: 20, caller_identity: CONFIG.host }), { signal: signal, label: 'interaction_partners' });
  var items = arr(d).map(function (x) { return { partner: x.preferredName_B, score: x.score, escore: x.escore, dscore: x.dscore, tscore: x.tscore, id: x.stringId_B }; });
  return items.length ? { items: items } : { empty: true };
};
Loaders.alphafold = async function (signal, acc) {
  var d = await Net.request('alphafold', SRC.alphafold.apiBase + '/prediction/' + encodeURIComponent(acc), { signal: signal, notFoundEmpty: true, label: 'prediction' });
  var m = first(arr(d));
  if (!m) return { empty: true };
  return { model: { id: m.modelEntityId || m.entryId, plddt: m.globalMetricValue, veryHigh: m.fractionPlddtVeryHigh, confident: m.fractionPlddtConfident, low: m.fractionPlddtLow, veryLow: m.fractionPlddtVeryLow, version: m.latestVersion, created: m.modelCreatedDate, pdbUrl: m.pdbUrl, cifUrl: m.cifUrl, paeImageUrl: m.paeImageUrl } };
};
Loaders.openTargets = async function (signal, ensg) {
  var q = 'query($id:String!){ target(ensemblId:$id){ id approvedSymbol approvedName associatedDiseases(page:{index:0,size:15}){ count rows{ score disease{ id name } datatypeScores{ id score } } } drugAndClinicalCandidates{ count rows{ maxClinicalStage drug{ id name drugType } } } } }';
  var d = await Net.request('opentargets', SRC.opentargets.apiBase, { method: 'POST', body: { query: q, variables: { id: ensg } }, signal: signal, graphql: true, label: 'target' });
  var t = get(d, 'data.target');
  if (!t) return { empty: true };
  var stageRank = { APPROVAL: 0, PHASE_4: 1, PHASE_3: 2, PHASE_2: 3, PHASE_1: 4, EARLY_PHASE_1: 5 };
  var drugs = arr(get(t, 'drugAndClinicalCandidates.rows')).map(function (r) { return { id: get(r, 'drug.id'), name: get(r, 'drug.name'), type: get(r, 'drug.drugType'), stage: r.maxClinicalStage }; })
    .sort(function (a, b) { return (stageRank[a.stage] != null ? stageRank[a.stage] : 9) - (stageRank[b.stage] != null ? stageRank[b.stage] : 9); });
  return { id: t.id, symbol: t.approvedSymbol, name: t.approvedName, diseasesCount: get(t, 'associatedDiseases.count'), diseases: arr(get(t, 'associatedDiseases.rows')).map(function (r) { return { id: get(r, 'disease.id'), name: get(r, 'disease.name'), score: r.score, types: arr(r.datatypeScores) }; }),
    drugsCount: get(t, 'drugAndClinicalCandidates.count'), drugs: drugs.slice(0, 40) };
};
Loaders.cbio = async function (signal, gene) {
  var c = CONFIG.cbio;
  var g = await Net.request('cbioportal', SRC.cbioportal.apiBase + '/genes/' + encodeURIComponent(gene), { signal: signal, notFoundEmpty: true, label: 'genes' });
  if (!g || !g.entrezGeneId) return { empty: true, reason: 'gene' };
  var sl = await Net.request('cbioportal', SRC.cbioportal.apiBase + '/sample-lists/' + c.sampleList + '?projection=SUMMARY', { signal: signal, label: 'sample-lists' });
  var muts = await Net.request('cbioportal', SRC.cbioportal.apiBase + '/molecular-profiles/' + c.mutationProfile + '/mutations?' + qs({ sampleListId: c.sampleList, entrezGeneId: g.entrezGeneId, projection: 'SUMMARY' }), { signal: signal, label: 'mutations', timeoutMs: 40000 });
  var list = arr(muts);
  var samples = new Set(list.map(function (m) { return m.sampleId; }));
  var byChange = countBy(list, function (m) { return m.proteinChange; }).slice(0, 15);
  var byType = countBy(list, function (m) { return m.mutationType; }).slice(0, 8);
  // Sample IDs are de-identified research IDs; only aggregate counts are kept.
  return { gene: gene, entrez: g.entrezGeneId, cohort: c.label, studyId: c.studyId, sampleCount: sl ? sl.sampleCount : null, mutatedSamples: samples.size, mutationCount: list.length, byChange: byChange, byType: byType };
};
Loaders.cbioStudies = async function (signal, keyword) {
  var d = await Net.request('cbioportal', SRC.cbioportal.apiBase + '/studies?' + qs({ keyword: keyword, projection: 'SUMMARY', pageSize: 12 }), { signal: signal, label: 'studies' });
  var items = arr(d).map(function (s) { return { id: s.studyId, name: s.name, samples: s.allSampleCount, pmid: s.pmid, citation: s.citation }; });
  return items.length ? { items: items } : { empty: true };
};
Loaders.gwas = async function (signal, rsid) {
  var d = await Net.request('gwas', SRC.gwas.apiBase + '/associations?' + qs({ rs_id: rsid, size: 20 }), { signal: signal, notFoundEmpty: true, label: 'associations' });
  var list = arr(get(d, '_embedded.associations'));
  if (!list.length) return { empty: true };
  return { total: get(d, 'page.totalElements') || list.length, items: list.map(function (a) { return { id: a.association_id, traits: arr(a.efo_traits).map(function (t) { return t.efo_trait; }), reported: arr(a.reported_trait), pvalue: a.p_value, mantissa: a.pvalue_mantissa, exponent: a.pvalue_exponent, riskAllele: arr(a.snp_effect_allele).join(', '), riskFrequency: a.risk_frequency, beta: a.beta, orValue: a.or_per_copy_number || a.or_value, study: a.accession_id, pmid: a.pubmed_id, author: a.first_author, genes: arr(a.mapped_genes) }; }) };
};
Loaders.ols = async function (signal, text) {
  var d = await Net.request('ols', SRC.ols.apiBase + '/search?' + qs({ q: text, ontology: 'mondo,ncit,efo', rows: 8, fieldList: 'iri,label,obo_id,ontology_name,description,short_form' }), { signal: signal, label: 'search' });
  var docs = arr(get(d, 'response.docs'));
  return docs.length ? { items: docs.map(function (x) { return { label: x.label, id: x.obo_id || x.short_form, ontology: x.ontology_name, iri: x.iri, description: first(arr(x.description)) }; }) } : { empty: true };
};

/* ---------------- Europe PMC ---------------- */
function epmcQuery(ctx) {
  if (!ctx) return '';
  switch (ctx.type) {
    case 'pmid': return 'EXT_ID:' + ctx.pmid + ' AND SRC:MED';
    case 'doi': return 'DOI:"' + ctx.doi.replace(/"/g, '') + '"';
    case 'gene': return ctx.fertility ? '"' + ctx.gene + '" AND (fertility OR reproductive OR "preimplantation genetic" OR "family planning" OR pregnancy)' : '"' + ctx.gene + '" AND (cancer OR tumor OR tumour OR oncology OR carcinoma)';
    case 'variant': if (ctx.fusion && ctx.partner) return '"' + ctx.partner + '-' + ctx.gene + '" OR "' + ctx.partner + '::' + ctx.gene + '"';
      return ctx.change ? '"' + ctx.gene + '" AND ("' + ctx.change.label + '" OR "' + ctx.change.three + '")' : '"' + ctx.gene + '" AND "' + (ctx.variantText || '').replace(/"/g, '') + '"';
    case 'rsid': return '"' + ctx.rsid + '"';
    case 'hgvs': return '"' + ctx.hgvs.replace(/"/g, '') + '"';
    case 'drug': var dq = '"' + ctx.drug + '"' + (ctx.brand ? ' OR "' + ctx.brand + '"' : '');
      return ctx.fertility ? '(' + dq + ') AND (' + reproTerms(ctx.fertility.sub) + ')' : dq;
    case 'vaccine': var v = ctx.vaccine || {}; var vq = '(' + uniq(arr(v.synonyms).concat(arr(v.products))).slice(0, 6).map(function (x) { return '"' + String(x).replace(/"/g, '') + '"'; }).join(' OR ') + ')';
      if (v.pregnancy) return vq + ' AND (pregnancy OR pregnant OR lactation) AND (cancer OR oncology OR "cancer survivor*")';
      return v.kind === 'general' ? vq + ' AND (cancer OR oncology OR chemotherapy OR immunocompromised)' : vq + (v.kind === 'preventive' ? ' AND (cancer OR neoplasia OR carcinoma OR "cancer prevention")' : ' AND (cancer OR tumor OR tumour OR oncology)');
    case 'fertility': var f = ctx.fertility || {}; return '"' + String(f.concept || ctx.label).replace(/"/g, '') + '" AND (cancer OR oncology OR chemotherapy OR tumor OR survivors)';
    case 'imaging': var im = ctx.imaging || {}; return '"' + String(im.concept || ctx.label).replace(/"/g, '') + '" AND (cancer OR oncology OR tumor OR tumour)';
    case 'disease': return '"' + ctx.disease.replace(/"/g, '') + '"';
    case 'nct': return '"' + ctx.nct + '"';
    case 'regid': return '"' + ctx.regId + '"';
    case 'device': return ctx.deviceId ? '"' + ctx.deviceId.value + '"' : '"' + String(ctx.deviceText || '').replace(/"/g, '') + '"';
    case 'uniprot': return '"' + ctx.uniprot + '"';
    case 'ensembl': return '"' + ctx.ensembl + '"';
    default: return String(ctx.label || '').replace(/[()]/g, ' ');
  }
}
function reproTerms(sub) {
  if (sub === 'pregnancy') return 'pregnancy OR pregnant OR teratogen* OR "fetal"';
  if (sub === 'lactation') return 'lactation OR breastfeeding OR "breast milk"';
  if (sub === 'contraception') return 'contraception OR contraceptive';
  return 'fertility OR gonadotoxic* OR infertility OR amenorrhea OR amenorrhoea OR azoospermia OR "ovarian reserve" OR "ovarian insufficiency"';
}
function normPaper(r) {
  var title = stripTags(r.title || '');
  return putRecord('paper', title || ('Record ' + r.id), 'europepmc', {
    id: r.id, source: r.source, pmid: r.pmid, pmcid: r.pmcid, doi: r.doi, title: title, authors: r.authorString, journal: r.journalTitle || get(r, 'journalInfo.journal.title'), year: r.pubYear,
    abstract: stripTags(r.abstractText || ''), oa: r.isOpenAccess === 'Y', cited: r.citedByCount, types: arr(get(r, 'pubTypeList.pubType')), keywords: arr(get(r, 'keywordList.keyword')).slice(0, 10),
    fullText: arr(get(r, 'fullTextUrlList.fullTextUrl')).filter(function (u) { return u.availabilityCode === 'OA' || u.availabilityCode === 'F'; }).map(function (u) { return { url: u.url, site: u.site, style: u.documentStyle }; }).slice(0, 3)
  }, prov('europepmc', 'search', r.pmid || r.id, r.pmid ? LINK.epmc('MED', r.pmid) : LINK.epmc(r.source, r.id)));
}
Loaders.literature = async function (signal, ctx, f, cursor) {
  f = f || {};
  var q = f.q || epmcQuery(ctx);
  if (!q) return { empty: true };
  var extra = [];
  if (f.oa) extra.push('OPEN_ACCESS:y');
  if (f.review) extra.push('PUB_TYPE:"review"');
  if (f.from || f.to) extra.push('PUB_YEAR:[' + (f.from || 1900) + ' TO ' + (f.to || YEAR) + ']');
  if (extra.length) q = '(' + q + ') AND ' + extra.join(' AND ');
  var d = await Net.request('europepmc', SRC.europepmc.apiBase + '/search?' + qs({ query: q, format: 'json', resultType: 'core', pageSize: f.pageSize || 10, cursorMark: cursor || '*', sort: f.sort || '' }), { signal: signal, label: 'search' });
  var list = arr(get(d, 'resultList.result'));
  if (!list.length) return { empty: true, total: d ? d.hitCount : 0 };
  return { items: list.map(normPaper), total: d.hitCount, next: d.nextCursorMark && d.nextCursorMark !== cursor ? d.nextCursorMark : null };
};
