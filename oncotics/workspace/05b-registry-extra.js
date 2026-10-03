
/* ====================================================================
   SOURCE CAPABILITY REGISTRY: FINAL CURATED EXTRA LAYER
   --------------------------------------------------------------------
   Modes (defaultMode / runtime mode):
     live                   CORS + shape verified; used by default.
     verify                 Documented public read-only API, NOT yet CORS-
                            verified from https://oncotics.com. Never called
                            automatically. A user can (a) press "Check" in the
                            Coverage Console or (b) press an explicit "Try live
                            request" button. On success the runtime mode becomes
                            "live" for this page session only; on failure the
                            official link-out is shown.
     linkout                Official site opened directly by the browser.
     authenticated-optional Needs a user-supplied key/token (memory only) AND a
                            feature flag; link-out otherwise.
     developer-reference    Community / developer resource. Never ingested as
                            clinical data.
     patient-education      Plain-language education link-out.
     ai-derived-optional    AI-derived outputs; verify-only, separately labeled.
     imaging-source         Used only by the separate Imaging Workbench page.
     unavailable / download Not usable live from a browser.
   Nothing in this block was CORS-verified from the real origin at build
   time (the build environment could not reach these hosts), so every new
   API entry is "verify". Promote to "live" only after verifying from
   https://oncotics.com (Coverage Console > Check availability) and updating
   corsVerified / lastVerifiedNote here.
   ==================================================================== */
var VERIFY_NOTE = 'Not yet CORS-verified from https://oncotics.com. Never called automatically; use “Check” in the Coverage Console or an explicit “Try live request” button. Falls back to the official link-out.';
Object.assign(CONFIG, {
  features: {
    oncokbAuthenticated: false,   // optional OncoKB token flow: off until terms + CORS are verified for oncotics.com
    semanticScholarKey: true,     // optional S2 key field (memory only)
    globeCesium: true,            // use the self-hosted CesiumJS globe when /assets/globe/ is deployed
    globeExternalImagery: true    // allow the user to opt in to external map imagery (warned)
  },
  imagingUrl: '/imaging/',
  globeAssetBase: '/assets/globe/',
  globeExternalImagery: { label: 'OpenStreetMap standard tiles', template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors (ODbL)', host: 'tile.openstreetmap.org' }
});
Object.assign(CONFIG.exportNames, {
  globe: 'Oncotics-Precision-Workspace-globe-locations',
  molmap: 'Oncotics-Precision-Workspace-molecular-context',
  interpretation: 'Oncotics-Precision-Workspace-interpretation'
});
Object.assign(BRAND, {
  imaging: 'Oncotics Imaging Workbench',
  fertility: 'Oncotics Onco-Fertility',
  vaccines: 'Oncotics Vaccines & Cancer Immunization',
  help: 'Oncotics Help'
});
Object.assign(LEGAL, {
  privacyLegal: 'Oncotics™ is a trademark of Oncotics. This tool is provided for educational, research, and clinical-information-discovery purposes only. It does not provide medical, oncological, reproductive, vaccination, radiological diagnostic, regulatory, genetic counseling, or procurement advice.',
  noAdviceFull: 'Oncotics™ does not provide medical, oncological, reproductive, vaccination, radiological diagnostic, regulatory, genetic counseling, or procurement advice.',
  reproductive: 'Oncotics™ does not provide fertility, pregnancy, contraception, lactation, vaccination, or genetic counseling advice. Reproductive-health content is organized public evidence only.',
  vaccine: 'Oncotics™ does not provide vaccination recommendations, schedules, risk/benefit assessments, or individualized vaccine safety judgments.',
  ai: 'AI-derived outputs shown or linked by Oncotics™ are computationally generated, experimental, and not source-reported clinical evidence.',
  imaging: 'Oncotics™ does not provide radiological diagnostic, medical, oncological, regulatory, or procurement advice. The Oncotics Imaging Workbench is not a radiology diagnostic system.',
  exportDisclaimerFull: 'Educational and research use only. Not medical, vaccination, reproductive, radiological diagnostic, regulatory, genetic counseling, or procurement advice.'
});
LEGAL.longDisclaimer.splice(LEGAL.longDisclaimer.length - 3, 0,
  'This tool is provided for educational, research, and clinical-information-discovery purposes only. Do not use for direct patient treatment, fertility, pregnancy, contraception, vaccination, radiological diagnosis, genetic counseling, procurement, or regulatory decisions without qualified professional review.',
  'Interpretation confidence is a query-routing score. It is not a diagnostic, prognostic, therapeutic, regulatory, or clinical certainty score.',
  'Vaccine adverse event reports are voluntary and do not prove causality. VAERS data cannot be used alone to determine vaccine safety or individual patient risk.',
  'Expert-curated, patient-education, AI-derived, and community/open-source resources have different evidentiary status. Oncotics labels them separately and does not adjudicate differences.',
  'The Geographic Activity Globe shows only public, non-PHI location records derived in memory. It is not an epidemiologic truth engine and does not display patient locations.',
  'The Molecular Context Map is an evidence-discovery visualization, not a clinical recommendation graph.',
  LEGAL.noAdviceFull
);
Object.assign(SAFETY, {
  overview: 'Overview summarizes source-reported records, derived query interpretations, public location records, and experimental visual context. It does not provide clinical, regulatory, reproductive, vaccination, or radiological diagnostic recommendations.',
  interpretation: 'Interpretation confidence is a query-routing score. It is not a diagnostic, prognostic, therapeutic, regulatory, or clinical certainty score.',
  vaccines: 'Oncotics does not provide vaccination recommendations, schedule advice, risk/benefit assessments, or individualized safety judgments.',
  vaers: 'Vaccine adverse event reports are voluntary and do not prove causality. VAERS data cannot be used alone to determine vaccine safety or individual patient risk.',
  fertility: 'Oncotics Onco-Fertility helps organize public evidence. It does not provide fertility, pregnancy, contraception, vaccination, genetic counseling, or treatment recommendations.',
  hereditary: 'Hereditary cancer and gene-disease validity resources are not patient-specific inherited-risk assessments. Genetic counseling should be provided by qualified professionals.',
  expert: 'Expert-curated records are versioned and license-restricted. They do not replace current guidelines or clinician judgment.',
  aiDerived: 'AI-derived outputs are computationally generated and are not source-reported clinical evidence.',
  education: 'Patient education resources are for general understanding only and do not replace clinical advice.',
  community: 'Community/open-source resources may be incomplete, unmaintained, or not clinically validated.',
  evidenceStatus: 'Expert-curated, patient-education, AI-derived, and community/open-source resources have different evidentiary status. Oncotics labels them separately and does not adjudicate differences.',
  imaging: 'Oncotics Imaging Workbench is not a radiology diagnostic system. Imaging interpretations, measurements, and annotations must be confirmed by qualified radiology and oncology professionals.',
  dicom: 'DICOM data may contain protected health information. Do not load imaging data unless authorized and appropriately de-identified where possible.',
  globe: 'Geographic Activity Globe shows only public, non-PHI location records derived in memory. It is not an epidemiologic truth engine and does not display patient locations.',
  globePrivacy: 'Globe locations are derived only from public records loaded in memory. Oncotics does not use your device location, does not store globe state, and does not display patient-identifying locations.',
  molmap: 'Molecular Context Map is an evidence-discovery visualization. Relationships may be source-reported, ontology-normalized, derived by Oncotics, AI-derived, patient education, expert-curated, or community-developer. It is not a clinical recommendation graph.',
  pgx: 'Pharmacogenomic resources are educational link-outs and are not dosing advice.',
  oncotree: 'OncoTree normalization is descriptive cancer-type terminology, not a diagnosis.',
  gdc: 'NCI GDC open-access aggregate data describe research cohorts, not individual predictions. Controlled-access data are never requested.',
  dgidb: 'Drug–gene interaction records are research annotations, not treatment recommendations.',
  hotspots: 'Recurrence of a mutation at a hotspot is not proof of clinical actionability.',
  citation: 'Citation metadata is not clinical evidence.',
  expression: 'Expression context is not a patient biomarker result.',
  externalTiles: 'Optional map imagery may send requests to a third-party provider. Oncotics does not store your globe view.'
});
SAFETY.phi = 'Do not enter patient-identifying information. This tool is not for protected health information.';

// Capability flags shown in the Coverage Console and Global Coverage.
var FLAG_DEFS = [
  ['mayLagOfficialDb', 'May lag official DB', 'lag'], ['passiveSurveillance', 'Passive surveillance', 'warn'], ['guidelineLinkOutOnly', 'Guideline link-out only', 'outline'],
  ['reproductiveHealthSensitive', 'Reproductive-health sensitive', 'fert'], ['vaccineSensitive', 'Vaccine sensitive', 'vax'], ['licenseRestricted', 'License-restricted', 'warn'],
  ['patientEducation', 'Patient education', 'edu'], ['aiDerivedPossible', 'AI-derived possible', 'ai'], ['communityDeveloper', 'Community / developer', 'dev'],
  ['imagingDicomSensitive', 'Imaging / DICOM sensitive', 'img'], ['globeLocationSource', 'Globe location source', 'globe'], ['externalTileProviderPossible', 'External tile provider possible', 'warn'],
  ['controlledAccessProhibited', 'Controlled access prohibited', 'outline'], ['memoryOnlyImageProcessing', 'Memory-only image processing', 'good'], ['safetySurveillanceAggregateOnly', 'Aggregate surveillance only', 'warn']
];
function mkSrc(o) { return Object.assign({ tier: 'B', defaultMode: 'verify', corsVerified: false, language: 'English', publicDataOnly: true, controlledAccessProhibited: true, lastVerifiedNote: VERIFY_NOTE, concurrencyLimit: 1, minIntervalMs: 400, timeoutMs: 15000 }, o); }
function lo(o) { return mkSrc(Object.assign({ tier: 'C', defaultMode: 'linkout', lastVerifiedNote: 'Official link-out (opened by your browser). Template should be spot-checked before release.', verify: true }, o)); }
var EXTRA_SOURCES = [
  // ---- A. Cancer ontology and cohort context
  mkSrc({ id: 'oncotree', displayName: 'OncoTree (MSK)', region: 'Global', kind: 'Cancer type ontology', apiBase: 'https://oncotree.mskcc.org/api', endpoints: ['/tumorTypes/search/name/{query}?exactMatch=false', '/tumorTypes/search/code/{code}'],
    linkoutSearchUrlTemplate: 'https://oncotree.mskcc.org/?search_term={q}', officialDocsUrl: 'https://oncotree.mskcc.org/swagger-ui.html', officialSiteUrl: 'https://oncotree.mskcc.org', attribution: 'Cancer type ontology from OncoTree (Memorial Sloan Kettering).', safetyNote: 'OncoTree normalization is descriptive, not a diagnosis.', rateLimitPolicy: 'Fair use', featureFlag: 'oncotree', verify: true }),
  mkSrc({ id: 'nci_gdc', displayName: 'NCI Genomic Data Commons (open access)', region: 'United States', kind: 'Public cancer genomics data commons', apiBase: 'https://api.gdc.cancer.gov', endpoints: ['/ssm_occurrences?facets=case.project.project_id (open access aggregate)', '/projects'],
    linkoutSearchUrlTemplate: 'https://portal.gdc.cancer.gov/', officialDocsUrl: 'https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/', officialSiteUrl: 'https://portal.gdc.cancer.gov', attribution: 'Open-access data from the NCI Genomic Data Commons. Controlled-access data are never requested.', safetyNote: 'Cohort research context, not individual prediction.', rateLimitPolicy: 'Fair use; user-triggered only', featureFlag: 'gdc', timeoutMs: 25000 }),
  // ---- B. Druggability and target validation
  mkSrc({ id: 'dgidb', displayName: 'DGIdb 5 (Drug–Gene Interaction Database)', region: 'United States', kind: 'Gene–drug interactions & druggability', apiBase: 'https://dgidb.org/api/graphql', endpoints: ['POST /api/graphql genes(names:[…]){ nodes{ interactions{…} } }', 'POST drugs(names:[…])'],
    linkoutSearchUrlTemplate: 'https://dgidb.org/results?searchType=gene&searchTerms={q}', officialDocsUrl: 'https://dgidb.org/api', officialSiteUrl: 'https://dgidb.org', attribution: 'Drug–gene interaction data from DGIdb (Washington University School of Medicine).', safetyNote: 'Research annotation, not a treatment recommendation.', rateLimitPolicy: 'Fair use; tab-triggered only', featureFlag: 'dgidb', timeoutMs: 20000 }),
  mkSrc({ id: 'open_targets_genetics', displayName: 'Open Targets Genetics (retired portal)', region: 'Global', kind: 'Genetics fine-mapping / credible sets', tier: 'C', defaultMode: 'unavailable',
    linkoutSearchUrlTemplate: 'https://platform.opentargets.org/search?q={q}', officialSiteUrl: 'https://platform.opentargets.org', attribution: 'Open Targets.', lastVerifiedNote: 'The standalone Open Targets Genetics portal was retired; its genetics evidence (credible sets, L2G) is served by the Open Targets Platform. Oncotics shows Platform data in Target Validation and links out for credible sets.', safetyNote: SAFETY.target }),
  // ---- C. Variant and gene knowledge
  lo({ id: 'cancer_hotspots', displayName: 'Cancer Hotspots', region: 'United States', kind: 'Recurrent mutation hotspots', linkoutSearchUrlTemplate: 'https://www.cancerhotspots.org/#/home', officialSiteUrl: 'https://www.cancerhotspots.org', attribution: 'Cancer Hotspots (MSK).', lastVerifiedNote: 'No documented, CORS-verified public JSON API confirmed for browser use; link-out only.', note: 'Search the gene on the site.', safetyNote: 'Recurrence is not proof of actionability.' }),
  lo({ id: 'clingen_gencc', displayName: 'ClinGen / GenCC', region: 'Global', kind: 'Gene–disease validity (germline)', linkoutSearchUrlTemplate: 'https://search.clinicalgenome.org/kb/genes?search={q}', linkoutAltTemplate: 'https://search.thegencc.org/?search={q}', officialSiteUrl: 'https://clinicalgenome.org', attribution: 'ClinGen and the Gene Curation Coalition (GenCC).', reproductiveHealthSensitive: true, safetyNote: 'Not patient-specific inherited-risk counseling.' }),
  // OncoKB is defined in the base registry; flags are merged below.
  // ---- D. Pathways, interactions, ontology, structure
  lo({ id: 'pathway_commons', displayName: 'Pathway Commons', region: 'Global', kind: 'Aggregated pathways', linkoutSearchUrlTemplate: 'https://apps.pathwaycommons.org/search?q={q}&type=Pathway', officialSiteUrl: 'https://www.pathwaycommons.org', attribution: 'Pathway Commons.' }),
  lo({ id: 'wikipathways', displayName: 'WikiPathways', region: 'Global', kind: 'Community-curated pathways', linkoutSearchUrlTemplate: 'https://www.wikipathways.org/search.html?query={q}', officialSiteUrl: 'https://www.wikipathways.org', attribution: 'WikiPathways (CC0).' }),
  lo({ id: 'biogrid', displayName: 'BioGRID', region: 'Global', kind: 'Curated interactions', linkoutSearchUrlTemplate: 'https://thebiogrid.org/search.php?search={q}&organism=9606', officialSiteUrl: 'https://thebiogrid.org', attribution: 'BioGRID (MIT license data).', lastVerifiedNote: 'The BioGRID REST API requires a personal access key; Oncotics does not embed keys, so BioGRID is link-out only.', verify: false }),
  lo({ id: 'intact', displayName: 'IntAct (EMBL-EBI)', region: 'Global (EMBL-EBI)', kind: 'Curated molecular interactions', linkoutSearchUrlTemplate: 'https://www.ebi.ac.uk/intact/search?query={q}', officialSiteUrl: 'https://www.ebi.ac.uk/intact', attribution: 'IntAct / EMBL-EBI (CC BY 4.0).' }),
  mkSrc({ id: 'complex_portal', displayName: 'Complex Portal (EMBL-EBI)', region: 'Global (EMBL-EBI)', kind: 'Curated macromolecular complexes', apiBase: 'https://www.ebi.ac.uk/intact/complex-ws', endpoints: ['/search/{query}?format=json&first=0&number=10&filters=species_f:("Homo sapiens")'],
    linkoutSearchUrlTemplate: 'https://www.ebi.ac.uk/complexportal/complex/search?query={q}&species=Homo%20sapiens', officialSiteUrl: 'https://www.ebi.ac.uk/complexportal', attribution: 'Complex Portal / EMBL-EBI (CC0).', rateLimitPolicy: 'Fair use', featureFlag: 'complexPortal' }),
  mkSrc({ id: 'quickgo', displayName: 'QuickGO (EMBL-EBI)', region: 'Global (EMBL-EBI)', kind: 'Gene Ontology annotations', apiBase: 'https://www.ebi.ac.uk/QuickGO/services', endpoints: ['/annotation/search?geneProductId={uniprot}&includeFields=goName&limit=100'],
    linkoutSearchUrlTemplate: 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId={q}', officialDocsUrl: 'https://www.ebi.ac.uk/QuickGO/api/index.html', officialSiteUrl: 'https://www.ebi.ac.uk/QuickGO', attribution: 'Gene Ontology annotations via QuickGO / EMBL-EBI (CC BY 4.0).', rateLimitPolicy: 'Fair use', featureFlag: 'quickgo' }),
  mkSrc({ id: 'pdbe', displayName: 'PDBe (EMBL-EBI)', region: 'Global (EMBL-EBI)', kind: 'Experimental structures & mappings', apiBase: 'https://www.ebi.ac.uk/pdbe/api', endpoints: ['/mappings/best_structures/{uniprot}'],
    linkoutSearchUrlTemplate: 'https://www.ebi.ac.uk/pdbe/pdbe-kb/proteins/{q}', linkoutDetailUrlTemplate: 'https://www.ebi.ac.uk/pdbe/entry/pdb/{id}', officialDocsUrl: 'https://www.ebi.ac.uk/pdbe/api/doc/', officialSiteUrl: 'https://www.ebi.ac.uk/pdbe', attribution: 'Structure data from PDBe / EMBL-EBI (CC0).', rateLimitPolicy: 'Fair use', featureFlag: 'pdbe' }),
  mkSrc({ id: 'ebi_proteins', displayName: 'EBI Proteins API', region: 'Global (EMBL-EBI)', kind: 'Protein features & variation', apiBase: 'https://www.ebi.ac.uk/proteins/api', endpoints: ['/features/{uniprot}?categories=DOMAINS_AND_SITES,MOLECULE_PROCESSING'],
    linkoutSearchUrlTemplate: 'https://www.uniprot.org/uniprotkb/{q}/entry#family_and_domains', officialDocsUrl: 'https://www.ebi.ac.uk/proteins/api/doc/', officialSiteUrl: 'https://www.ebi.ac.uk/proteins/api/doc/', attribution: 'Protein features via the EBI Proteins API (UniProt, CC BY 4.0).', rateLimitPolicy: 'Fair use', featureFlag: 'ebiProteins' }),
  // ---- E. Literature and citation intelligence
  mkSrc({ id: 'openalex', displayName: 'OpenAlex', region: 'Global', kind: 'Citation metadata (open scholarly graph)', apiBase: 'https://api.openalex.org', endpoints: ['/works/pmid:{pmid}', '/works/doi:{doi}', '/works?search={q}&per-page=10'],
    linkoutSearchUrlTemplate: 'https://openalex.org/works?filter=default.search:{q}', officialDocsUrl: 'https://docs.openalex.org', officialSiteUrl: 'https://openalex.org', attribution: 'Citation metadata from OpenAlex (CC0).', safetyNote: 'Citation metadata is not clinical evidence.', rateLimitPolicy: 'Polite pool; ~10 requests/second, daily caps apply', globeLocationSource: true, featureFlag: 'openalex' }),
  mkSrc({ id: 'crossref', displayName: 'Crossref REST API', region: 'Global', kind: 'DOI metadata', apiBase: 'https://api.crossref.org', endpoints: ['/works/{doi}'],
    linkoutSearchUrlTemplate: 'https://search.crossref.org/search/works?q={q}&from_ui=yes', officialDocsUrl: 'https://api.crossref.org/swagger-ui/index.html', officialSiteUrl: 'https://www.crossref.org', attribution: 'DOI metadata from Crossref (metadata generally CC0).', safetyNote: 'Citation metadata is not clinical evidence.', rateLimitPolicy: 'Public pool; be gentle', featureFlag: 'crossref' }),
  mkSrc({ id: 'semantic_scholar', displayName: 'Semantic Scholar Graph API', region: 'Global', kind: 'Citation graph (references / citing papers)', apiBase: 'https://api.semanticscholar.org/graph/v1', endpoints: ['/paper/PMID:{pmid}?fields=…', '/paper/DOI:{doi}?fields=…'],
    linkoutSearchUrlTemplate: 'https://www.semanticscholar.org/search?q={q}', officialDocsUrl: 'https://api.semanticscholar.org/api-docs/', officialSiteUrl: 'https://www.semanticscholar.org', attribution: 'Citation graph data from Semantic Scholar (Allen Institute for AI).', safetyNote: 'Citation metadata is not clinical evidence.', rateLimitPolicy: 'Shared unauthenticated pool is heavily rate-limited; optional key (memory only)', minIntervalMs: 1100, featureFlag: 'semanticScholar' }),
  // ---- G. Pharmacogenomics
  lo({ id: 'cpic', displayName: 'CPIC guidelines', region: 'Global', kind: 'Pharmacogenomics guidelines', linkoutSearchUrlTemplate: 'https://cpicpgx.org/guidelines/', officialSiteUrl: 'https://cpicpgx.org', attribution: 'Clinical Pharmacogenetics Implementation Consortium.', guidelineLinkOutOnly: true, note: 'Guideline list on site (no deep search link).', safetyNote: 'Educational; not dosing advice.' }),
  // ---- H. Vaccines & regulatory link-outs
  lo({ id: 'fda_cber', displayName: 'FDA CBER: vaccines licensed for use in the U.S.', region: 'United States', kind: 'Vaccine / biologic regulator', linkoutSearchUrlTemplate: 'https://www.fda.gov/vaccines-blood-biologics/vaccines/vaccines-licensed-use-united-states', officialSiteUrl: 'https://www.fda.gov/vaccines-blood-biologics', attribution: 'U.S. FDA Center for Biologics Evaluation and Research.', vaccineSensitive: true }),
  lo({ id: 'cdc_vaers', displayName: 'VAERS (CDC / FDA)', region: 'United States', kind: 'Vaccine safety surveillance (passive)', linkoutSearchUrlTemplate: 'https://vaers.hhs.gov/data.html', officialSiteUrl: 'https://vaers.hhs.gov', attribution: 'Vaccine Adverse Event Reporting System (CDC/FDA).', vaccineSensitive: true, passiveSurveillance: true, safetySurveillanceAggregateOnly: true,
    lastVerifiedNote: 'CDC WONDER VAERS queries are XML/POST without browser CORS; link-out only. No narratives, no rankings, no incidence calculation.', safetyNote: 'Voluntary reports; do not prove causality.' }),
  lo({ id: 'cdc_acip', displayName: 'CDC ACIP vaccine recommendations', region: 'United States', kind: 'Immunization guideline (link-out)', linkoutSearchUrlTemplate: 'https://www.cdc.gov/acip/', officialSiteUrl: 'https://www.cdc.gov/acip/', attribution: 'U.S. CDC.', vaccineSensitive: true, guidelineLinkOutOnly: true }),
  lo({ id: 'cdc_pregnancy_vax', displayName: 'CDC vaccines during pregnancy', region: 'United States', kind: 'Pregnancy immunization guidance (link-out)', linkoutSearchUrlTemplate: 'https://www.cdc.gov/vaccines-pregnancy/', officialSiteUrl: 'https://www.cdc.gov/vaccines-pregnancy/', attribution: 'U.S. CDC.', vaccineSensitive: true, reproductiveHealthSensitive: true, guidelineLinkOutOnly: true }),
  lo({ id: 'who_vaccines', displayName: 'WHO immunization, vaccines and biologicals', region: 'Global', kind: 'Vaccine guidance (link-out)', linkoutSearchUrlTemplate: 'https://www.who.int/teams/immunization-vaccines-and-biologicals', officialSiteUrl: 'https://www.who.int/health-topics/vaccines-and-immunization', attribution: 'World Health Organization.', vaccineSensitive: true, guidelineLinkOutOnly: true }),
  lo({ id: 'health_canada_dpd', displayName: 'Health Canada Drug Product Database', region: 'Canada', kind: 'Regulator (drugs, biologics, vaccines)', linkoutSearchUrlTemplate: 'https://health-products.canada.ca/dpd-bdpp/', officialSiteUrl: 'https://health-products.canada.ca/dpd-bdpp/', language: 'English / French', attribution: 'Health Canada.', note: 'Search form on site.', vaccineSensitive: true }),
  // ---- Onco-Fertility / reproductive link-outs (guidelines are never scraped)
  lo({ id: 'nci_fertility', displayName: 'NCI: fertility issues in people with cancer', region: 'United States', kind: 'Patient education (reproductive health)', linkoutSearchUrlTemplate: 'https://www.cancer.gov/about-cancer/treatment/side-effects/fertility-women', linkoutAltTemplate: 'https://www.cancer.gov/about-cancer/treatment/side-effects/fertility-men', officialSiteUrl: 'https://www.cancer.gov', attribution: 'U.S. National Cancer Institute.', patientEducation: true, reproductiveHealthSensitive: true }),
  lo({ id: 'asco_guidelines', displayName: 'ASCO guidelines (fertility preservation and survivorship)', region: 'United States', kind: 'Clinical practice guideline (link-out)', linkoutSearchUrlTemplate: 'https://www.asco.org/guidelines', officialSiteUrl: 'https://www.asco.org/guidelines', attribution: 'American Society of Clinical Oncology.', guidelineLinkOutOnly: true, reproductiveHealthSensitive: true, note: 'Open the guideline list; Oncotics does not reproduce guideline text.' }),
  lo({ id: 'eshre_guidelines', displayName: 'ESHRE guidelines (female fertility preservation)', region: 'Europe', kind: 'Clinical practice guideline (link-out)', linkoutSearchUrlTemplate: 'https://www.eshre.eu/Guidelines-and-Legal/Guidelines', officialSiteUrl: 'https://www.eshre.eu', attribution: 'European Society of Human Reproduction and Embryology.', guidelineLinkOutOnly: true, reproductiveHealthSensitive: true }),
  lo({ id: 'asrm', displayName: 'ASRM practice documents', region: 'United States', kind: 'Reproductive medicine guidance (link-out)', linkoutSearchUrlTemplate: 'https://www.asrm.org/practice-guidance/practice-committee-documents/', officialSiteUrl: 'https://www.asrm.org', attribution: 'American Society for Reproductive Medicine.', guidelineLinkOutOnly: true, reproductiveHealthSensitive: true }),
  lo({ id: 'lactmed', displayName: 'LactMed (NLM Drugs and Lactation Database)', region: 'United States', kind: 'Lactation drug information (link-out)', linkoutSearchUrlTemplate: 'https://www.ncbi.nlm.nih.gov/books/NBK501922/?term={q}', officialSiteUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK501922/', attribution: 'U.S. National Library of Medicine.', reproductiveHealthSensitive: true }),
  // ---- I. Patient education, AI developer and community resources
  lo({ id: 'oncolink', displayName: 'OncoLink (Penn Medicine) patient education', region: 'United States', kind: 'Patient education', defaultMode: 'patient-education', linkoutSearchUrlTemplate: 'https://www.oncolink.org/search?q={q}', officialSiteUrl: 'https://www.oncolink.org', attribution: 'OncoLink, Abramson Cancer Center, Penn Medicine.', patientEducation: true,
    lastVerifiedNote: 'Patient-education link-out. api.oncolink.org was not verified for public browser use; no content is fetched, scraped, or reproduced.' }),
  lo({ id: 'cure_cancer_with_ai_dev', displayName: 'Cure Cancer With AI — developer resources', region: 'Global', kind: 'AI developer resource (verify-only)', defaultMode: 'ai-derived-optional', linkoutSearchUrlTemplate: 'https://www.curecancerwithai.com/developers', officialSiteUrl: 'https://www.curecancerwithai.com/developers', attribution: 'Cure Cancer With AI.', aiDerivedPossible: true,
    lastVerifiedNote: 'Verify-only. No documented public API, CORS policy, terms, or provenance was verified, so no live calls are made. Any AI-derived output must be labeled AI-derived and kept separate from source-reported records. No PHI is ever sent.' }),
  lo({ id: 'openonco_github', displayName: 'OpenOnco (GitHub)', region: 'Global', kind: 'Community / open-source developer reference', defaultMode: 'developer-reference', linkoutSearchUrlTemplate: 'https://github.com/romeo111/OpenOnco', officialSiteUrl: 'https://github.com/romeo111/OpenOnco', attribution: 'OpenOnco contributors (see repository license).', communityDeveloper: true,
    lastVerifiedNote: 'Developer/community reference only. GitHub raw files are never fetched as live clinical data.' }),
  // ---- J. Imaging (used only by the separate Imaging Workbench page; never queried from this page)
  mkSrc({ id: 'ohif_viewer', displayName: 'OHIF Viewer (self-hosted, Imaging Workbench)', region: 'Global', kind: 'Imaging viewer (separate page)', tier: 'I', defaultMode: 'imaging-source', officialSiteUrl: 'https://ohif.org', attribution: 'OHIF Viewer (MIT license), Open Health Imaging Foundation.', imagingDicomSensitive: true, memoryOnlyImageProcessing: true, lastVerifiedNote: 'Loaded only on /imaging after explicit user action. Never loaded by this page.' }),
  mkSrc({ id: 'user_dicomweb', displayName: 'User-supplied DICOMweb endpoint', region: 'User-defined', kind: 'Imaging source (QIDO/WADO; STOW off)', tier: 'I', defaultMode: 'imaging-source', imagingDicomSensitive: true, lastVerifiedNote: 'Imaging Workbench only. Endpoint URL and token stay in memory; requests go directly from the browser; STOW-RS disabled by default.' }),
  mkSrc({ id: 'local_dicom', displayName: 'Local DICOM import (browser memory)', region: 'Your device', kind: 'Imaging source (memory-only)', tier: 'I', defaultMode: 'imaging-source', imagingDicomSensitive: true, memoryOnlyImageProcessing: true, lastVerifiedNote: 'Imaging Workbench only. Files are read in browser memory and never uploaded.' }),
  mkSrc({ id: 'local_raster', displayName: 'Local non-DICOM image (browser memory)', region: 'Your device', kind: 'Imaging source (preview / experimental only)', tier: 'I', defaultMode: 'imaging-source', imagingDicomSensitive: true, memoryOnlyImageProcessing: true, lastVerifiedNote: 'Imaging Workbench only. PNG/JPEG/WebP/BMP (TIFF where the browser decodes it); metadata is not read; memory-only.' }),
  mkSrc({ id: 'local_model', displayName: 'Local browser AI model (ONNX, user-loaded)', region: 'Your device', kind: 'Experimental inference (no network)', tier: 'I', defaultMode: 'imaging-source', aiDerivedPossible: true, memoryOnlyImageProcessing: true, lastVerifiedNote: 'Imaging Workbench only. Runs only after model-card review and an explicit Run click; no image leaves the browser.' }),
  mkSrc({ id: 'user_inference', displayName: 'User-supplied inference endpoint', region: 'User-defined', kind: 'Experimental remote inference (opt-in)', tier: 'I', defaultMode: 'imaging-source', aiDerivedPossible: true, imagingDicomSensitive: true, lastVerifiedNote: 'Imaging Workbench only; disabled by default; separate consent; direct browser → endpoint; the provider may log or store data.' }),
  lo({ id: 'tcia', displayName: 'The Cancer Imaging Archive (TCIA)', region: 'United States', kind: 'Public de-identified imaging collections', linkoutSearchUrlTemplate: 'https://www.cancerimagingarchive.net/browse-collections/', officialSiteUrl: 'https://www.cancerimagingarchive.net', attribution: 'The Cancer Imaging Archive.', imagingDicomSensitive: false }),
  lo({ id: 'nci_idc', displayName: 'NCI Imaging Data Commons', region: 'United States', kind: 'Public cancer imaging data commons', linkoutSearchUrlTemplate: 'https://portal.imaging.datacommons.cancer.gov/explore/', officialSiteUrl: 'https://datacommons.cancer.gov/repository/imaging-data-commons', attribution: 'NCI Imaging Data Commons.' }),
  lo({ id: 'radlex', displayName: 'RadLex (RSNA radiology lexicon)', region: 'Global', kind: 'Radiology ontology', linkoutSearchUrlTemplate: 'https://radlex.org/', officialSiteUrl: 'https://radlex.org', attribution: 'RadLex, Radiological Society of North America.', note: 'Search on site.' }),
  lo({ id: 'radiologyinfo', displayName: 'RadiologyInfo.org (RSNA / ACR)', region: 'United States', kind: 'Radiology patient education', defaultMode: 'patient-education', linkoutSearchUrlTemplate: 'https://www.radiologyinfo.org/en', officialSiteUrl: 'https://www.radiologyinfo.org', attribution: 'RSNA and ACR.', patientEducation: true, note: 'Search on site.' })
];
EXTRA_SOURCES.forEach(function (s) { SOURCES.push(s); });
// Flags for sources defined in the base registry.
var BASE_FLAGS = {
  ctgov: { globeLocationSource: true, vaccineSensitive: true, reproductiveHealthSensitive: true }, 'openfda-drug': { globeLocationSource: true, passiveSurveillance: true, vaccineSensitive: true, reproductiveHealthSensitive: true },
  'openfda-device': { globeLocationSource: true, passiveSurveillance: true }, europepmc: { vaccineSensitive: true, reproductiveHealthSensitive: true }, rxnorm: { vaccineSensitive: true },
  oncokb: { defaultMode: 'linkout', licenseRestricted: true, authOptional: true, kind: 'Expert-curated precision oncology knowledgebase', apiBase: 'https://www.oncokb.org/api/v1', endpoints: ['GET /annotate/mutations/byProteinChange (requires a licensed token)'],
    lastVerifiedNote: 'Link-out by default. The optional authenticated mode is feature-flagged off until OncoKB terms and browser CORS are verified for oncotics.com. Never bulk-exported; never merged with CIViC.', safetyNote: SAFETY.expert },
  pharmgkb: { safetyNote: SAFETY.pgx }, cbioportal: { publicDataOnly: true }, maude: { passiveSurveillance: true }, faers: { passiveSurveillance: true }, medwatch: { passiveSurveillance: true },
  gtex: { reproductiveHealthSensitive: false }, hpa: {}, gxa: { lastVerifiedNote: 'Expression Atlas JSON endpoints were not verified for browser CORS; link-out only.' }
};
Object.keys(BASE_FLAGS).forEach(function (id) { var s = SOURCES.find(function (x) { return x.id === id; }); if (s) Object.assign(s, BASE_FLAGS[id]); });
SOURCES.forEach(function (s) {
  SRC[s.id] = s;
  if (s.concurrencyLimit == null) s.concurrencyLimit = 1; if (!s.timeoutMs) s.timeoutMs = CONFIG.defaultTimeoutMs;
  if (s.publicDataOnly == null) s.publicDataOnly = true; if (s.controlledAccessProhibited == null) s.controlledAccessProhibited = true;
  s.status = s.status || (s.defaultMode === 'live' ? (s.corsVerified ? 'verified' : 'verify') : s.defaultMode === 'verify' ? 'verify (live candidate)' : s.defaultMode);
  if (!s.featureFlag) s.featureFlag = s.id;
});
var FETCHABLE_MODES = { live: 1, verify: 1, 'rate-limited': 1, unavailable: 1 };
resetRuntime();
Object.assign(LINK, {
  oncotree: function (code) { return safeUrl('https://oncotree.mskcc.org/?search_term=' + encodeURIComponent(code || '')); },
  gdcProject: function (p) { return safeUrl('https://portal.gdc.cancer.gov/projects/' + encodeURIComponent(p)); },
  dgidbGene: function (g) { return linkout('dgidb', g); },
  dgidbDrug: function (d) { return safeUrl('https://dgidb.org/results?searchType=drug&searchTerms=' + encodeURIComponent(d)); },
  openalex: function (id) { return safeUrl('https://openalex.org/' + encodeURIComponent(String(id || '').replace(/^https:\/\/openalex\.org\//, ''))); },
  s2: function (id) { return safeUrl('https://www.semanticscholar.org/paper/' + encodeURIComponent(id)); },
  quickgoTerm: function (go) { return safeUrl('https://www.ebi.ac.uk/QuickGO/term/' + encodeURIComponent(go)); },
  pdbe: function (id) { return linkout('pdbe', id, true); },
  complex: function (ac) { return safeUrl('https://www.ebi.ac.uk/complexportal/complex/' + encodeURIComponent(ac)); },
  gencc: function (g) { return safeUrl('https://search.thegencc.org/?search=' + encodeURIComponent(g || '')); },
  imaging: function () { return CONFIG.imagingUrl; }
});
