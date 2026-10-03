
/* ====================================================================
   SEARCH INTERPRETATION ENGINE (Overview intelligence layer)
   --------------------------------------------------------------------
   Produces ALL plausible interpretations of a query, each with a
   heuristic 0-100 entity-resolution score, qualitative label, the
   signals used, supporting/conflicting sources and ambiguity flags.
   Scores are query-routing heuristics, NOT statistical probabilities and
   NOT clinical certainty. Dictionaries below are routing hints only and
   are never displayed as results.

   Schema (InterpretationCandidate):
   { key, type, subtype, label, normalized, base, score, scoreLabel,
     why, signals: [{ text, kind: pattern|dictionary|live|agreement|conflict|penalty, delta, source }],
     supporting: [sourceName], conflicting: [sourceName], flags: [string],
     module, entity }   // entity = detect-shaped object used to execute the plan
   Interpretation: { query, candidates, top, ambiguous, needsConfirm, builtAt }
   ==================================================================== */
PHI_MESSAGE = 'This input appears too broad or may contain sensitive information. Please search a gene, variant, drug, device, vaccine, disease, trial ID, PMID, rsID, HGVS, fertility preservation concept, gonadotoxicity term, cancer vaccine concept, pregnancy vaccination concept, imaging modality, or non-PHI clinical concept.';
// Extra PHI patterns for reproductive, vaccination and imaging contexts (input is rejected, never stored or logged).
var PHI_EXTRA = [
  /\b(lot|batch)\s*(no\.?|number|#)?\s*[:#]?\s*[A-Z]{0,3}\d[A-Z0-9]{3,}\b/i,                         // vaccine / implant lot numbers
  /\b(dose|shot|injection)\s*(#|no\.?)?\s*\d\b.*\b(given|on|received)\b/i,                             // dose dates
  /\b(ivf|art|ivf\/icsi|icsi|retrieval|transfer)\s*cycle\s*(#|no\.?|number)?\s*\d+/i,                  // ART cycle numbers
  /\b(tank|cane|straw|canister|dewar|storage|cryo)\s*(id|#|no\.?|number|account)\s*[:#]?\s*[A-Z0-9-]{2,}/i, // cryostorage identifiers
  /\b(due date|edd|lmp|last menstrual period|conceived on|conception date|gestational age|weeks pregnant|delivery date)\b/i,
  /\b(semen analysis|sperm count|motility)\s*[:=]?\s*\d/i,
  /\b(amh|fsh|lh|estradiol|e2|testosterone|inhibin)\s*(level|value|result)?\s*(of|is|was|=|:)?\s*\d+(\.\d+)?\s*(ng|pmol|miu|iu|pg|nmol|mmol)/i,
  /\b(accession|study instance uid|patient id|mrn)\s*[:#]?\s*[A-Z0-9.]{4,}/i,
  /\b\d+(\.\d+){6,}\b/,                                                                               // DICOM UID-like strings
  /\b(vaccination card|immuni[sz]ation record|vaccine record)\b/i
];
var baseCheckInput = checkInput;
checkInput = function (s) {
  var r = baseCheckInput(s);
  if (!r.ok) return r;
  for (var i = 0; i < PHI_EXTRA.length; i++) if (PHI_EXTRA[i].test(r.value)) return { ok: false, reason: 'phi' };
  return r;
};
['MAGEA1', 'MAGEA3', 'MAGEA4', 'CTAG1B', 'CTAG2', 'PRAME', 'ACP3', 'MUC1', 'TERT', 'SSX2', 'AFP', 'KLK3', 'FOLH1', 'AMH', 'AMHR2', 'FSHR', 'LHCGR', 'CYP19A1', 'CD3E', 'HLA-A', 'B2M', 'TAP1'].forEach(function (g) { GENES.add(g); });
Object.assign(GENE_ALIASES, { 'NY-ESO-1': 'CTAG1B', NYESO1: 'CTAG1B', 'MAGE-A1': 'MAGEA1', 'MAGE-A3': 'MAGEA3', 'MAGE-A4': 'MAGEA4', PSMA: 'FOLH1', PSA: 'KLK3', 'MUC-1': 'MUC1', ACPP: 'ACP3' });

/* ---------------- Routing dictionaries (hints only) ---------------- */
// Vaccines relevant to oncology. kind: preventive | therapeutic | oncolytic | immunotherapy-context | general
var VACCINE_DICT = [
  { re: /\b(hpv|human papillomavirus|papilloma ?virus)\b.*\bvaccin|\bvaccin\w*\b.*\b(hpv|papillomavirus)\b|\bgardasil( ?9)?\b|\bcervarix\b|\b9vhpv\b/i, name: 'HPV vaccine', kind: 'preventive', antigen: 'HPV L1 virus-like particles', products: ['Gardasil 9', 'Gardasil', 'Cervarix'], cancers: ['Cervical Cancer', 'Anal Cancer', 'Oropharyngeal Cancer', 'Vulvar Cancer', 'Vaginal Cancer', 'Penile Cancer'], synonyms: ['HPV vaccine', 'human papillomavirus vaccine', 'HPV vaccination'] },
  { re: /\b(hep(atitis)? ?b|hbv)\b.*\bvaccin|\bvaccin\w*\b.*\b(hepatitis b|hbv)\b|\bengerix\b|\brecombivax\b|\bheplisav\b|\bprehevbrio\b/i, name: 'Hepatitis B vaccine', kind: 'preventive', antigen: 'Hepatitis B surface antigen (HBsAg)', products: ['Engerix-B', 'Recombivax HB', 'Heplisav-B', 'PreHevbrio'], cancers: ['Hepatocellular Carcinoma'], synonyms: ['hepatitis B vaccine', 'HBV vaccine', 'hepatitis B vaccination'] },
  { re: /\bsipuleucel(-?t)?\b|\bprovenge\b/i, name: 'sipuleucel-T', kind: 'therapeutic', antigen: 'PA2024 (prostatic acid phosphatase fusion protein)', antigenGene: 'ACP3', products: ['Provenge'], cancers: ['Prostate Cancer'], synonyms: ['sipuleucel-T', 'Provenge'], note: 'Source records may classify this as an autologous cellular immunotherapy; Oncotics does not force a classification.' },
  { re: /\btalimogene\b|\bimlygic\b|\bt-?vec\b/i, name: 'talimogene laherparepvec', kind: 'oncolytic', antigen: 'GM-CSF-expressing oncolytic HSV-1', products: ['Imlygic'], cancers: ['Melanoma'], synonyms: ['talimogene laherparepvec', 'T-VEC', 'Imlygic'], note: 'Oncolytic viral immunotherapy; shown here only where sources describe vaccine-like immunotherapy.' },
  { re: /\b(intravesical )?bcg\b|\btice bcg\b/i, name: 'BCG (intravesical)', kind: 'immunotherapy-context', antigen: 'Live attenuated Mycobacterium bovis', products: ['TICE BCG'], cancers: ['Bladder Cancer'], synonyms: ['BCG', 'Bacillus Calmette-Guerin', 'intravesical BCG'] },
  { re: /\bmrna[- ]?4157\b|\bv940\b|\bintismeran\b/i, name: 'mRNA-4157 (V940, intismeran autogene)', kind: 'therapeutic', investigational: true, antigen: 'Individualized neoantigens', cancers: ['Melanoma', 'Non-Small Cell Lung Cancer'], synonyms: ['mRNA-4157', 'V940', 'intismeran autogene'] },
  { re: /\bautogene cevumeran\b|\bbnt122\b|\bro7198457\b/i, name: 'autogene cevumeran (BNT122)', kind: 'therapeutic', investigational: true, antigen: 'Individualized neoantigens', cancers: ['Pancreatic Cancer', 'Colorectal Cancer'], synonyms: ['autogene cevumeran', 'BNT122'] },
  { re: /\bmrna\b.*\b(cancer|tumou?r|neoantigen|personali[sz]ed)\b.*\bvaccin|\bmrna (cancer )?vaccin\w*\b.*\b(cancer|tumou?r)?/i, name: 'mRNA cancer vaccine', kind: 'therapeutic', investigational: true, antigen: 'Tumor-associated or neoantigens (platform)', synonyms: ['mRNA cancer vaccine', 'mRNA vaccine cancer', 'personalized cancer vaccine'] },
  { re: /\bneo-?antigen\b.*\bvaccin|\bpersonali[sz]ed (cancer )?vaccin/i, name: 'Neoantigen vaccine', kind: 'therapeutic', investigational: true, antigen: 'Patient-specific neoantigens', synonyms: ['neoantigen vaccine', 'personalized neoantigen vaccine'] },
  { re: /\bdendritic[- ]cell\b.*\bvaccin|\bdc vaccin/i, name: 'Dendritic cell vaccine', kind: 'therapeutic', investigational: true, synonyms: ['dendritic cell vaccine'] },
  { re: /\bpeptide\b.*\bvaccin/i, name: 'Peptide vaccine', kind: 'therapeutic', investigational: true, synonyms: ['peptide vaccine'] },
  { re: /\b(viral[- ]vector|adenoviral|poxvir\w*)\b.*\bvaccin/i, name: 'Viral vector cancer vaccine', kind: 'therapeutic', investigational: true, synonyms: ['viral vector vaccine'] },
  { re: /\b(cancer|tumou?r|oncolog\w*|therapeutic)\b.*\bvaccin|\bvaccin\w*\b.*\b(cancer|tumou?r|carcinoma|melanoma|lymphoma|leuka?emia)\b/i, name: 'Cancer vaccine', kind: 'therapeutic', investigational: true, synonyms: ['cancer vaccine', 'therapeutic cancer vaccine'] },
  { re: /\b(influenza|flu)\b.*\bvaccin|\bvaccin\w*\b.*\b(influenza|flu)\b/i, name: 'Influenza vaccine', kind: 'general', synonyms: ['influenza vaccine', 'influenza vaccination'] },
  { re: /\btdap\b/i, name: 'Tdap vaccine', kind: 'general', synonyms: ['Tdap', 'Tdap vaccine'] },
  { re: /\brsv\b.*\bvaccin|\bvaccin\w*\b.*\brsv\b|\babrysvo\b|\barexvy\b/i, name: 'RSV vaccine', kind: 'general', synonyms: ['RSV vaccine', 'respiratory syncytial virus vaccine'] },
  { re: /\b(covid(-?19)?|sars-?cov-?2)\b.*\bvaccin|\bvaccin\w*\b.*\b(covid|sars-?cov-?2)\b/i, name: 'COVID-19 vaccine', kind: 'general', synonyms: ['COVID-19 vaccine', 'SARS-CoV-2 vaccine'] },
  { re: /\b(zoster|shingles|shingrix)\b/i, name: 'Zoster vaccine', kind: 'general', synonyms: ['recombinant zoster vaccine', 'Shingrix'] },
  { re: /\bpneumococcal\b/i, name: 'Pneumococcal vaccine', kind: 'general', synonyms: ['pneumococcal vaccine'] },
  { re: /\blive (attenuated )?vaccin\w*\b/i, name: 'Live vaccines', kind: 'general', synonyms: ['live vaccine', 'live attenuated vaccine'] },
  { re: /\bvaccin\w*\b|\bimmuni[sz]ation\b/i, name: 'Vaccine (general concept)', kind: 'general', generic: true, synonyms: ['vaccine'] }
];
// Onco-Fertility concepts. sub: fertility | gonadotoxicity | pregnancy | lactation | contraception | endocrine | hereditary | device | pediatric
var FERT_DICT = [
  { re: /\bonco-?fertility\b/i, concept: 'oncofertility', sub: 'fertility' },
  { re: /\bfertility[- ]preserv\w*\b|\bpreserv\w* fertility\b/i, concept: 'fertility preservation', sub: 'fertility' },
  { re: /\b(oocyte|egg)s? (cryo\w*|freez\w*|vitrif\w*|banking)\b|\bmature oocyte cryopreservation\b/i, concept: 'oocyte cryopreservation', sub: 'fertility' },
  { re: /\bembryo (cryo\w*|freez\w*|banking|vitrif\w*)\b/i, concept: 'embryo cryopreservation', sub: 'fertility' },
  { re: /\bovarian tissue (cryo\w*|freez\w*|transplant\w*)\b/i, concept: 'ovarian tissue cryopreservation', sub: 'fertility' },
  { re: /\btesticular tissue (cryo\w*|freez\w*)\b/i, concept: 'testicular tissue cryopreservation', sub: 'pediatric' },
  { re: /\bsperm (bank\w*|cryo\w*|freez\w*)\b|\bsemen cryo\w*\b/i, concept: 'sperm cryopreservation', sub: 'fertility' },
  { re: /\b(gnrh|lhrh)[- ]?(agonist|analog\w*)?\b.*\b(ovar\w*|fertility|protect\w*|suppress\w*)\b|\bovarian suppression\b/i, concept: 'ovarian suppression with GnRH agonist', sub: 'fertility' },
  { re: /\bgonado-?tox\w*\b/i, concept: 'gonadotoxicity', sub: 'gonadotoxicity' },
  { re: /\b(premature ovarian (insufficiency|failure)|primary ovarian insufficiency|\bpoi\b)\b/i, concept: 'premature ovarian insufficiency', sub: 'gonadotoxicity' },
  { re: /\b(chemotherapy[- ]induced )?amenorrh(o)?ea\b/i, concept: 'chemotherapy-induced amenorrhea', sub: 'gonadotoxicity' },
  { re: /\b(azoospermia|oligospermia|infertility|sterility)\b/i, concept: 'infertility after cancer treatment', sub: 'gonadotoxicity' },
  { re: /\bovarian reserve\b|\banti-?m(ü|u)llerian\b|\bamh\b/i, concept: 'ovarian reserve (AMH)', sub: 'gonadotoxicity' },
  { re: /\bpregnan\w*\b/i, concept: 'pregnancy', sub: 'pregnancy' },
  { re: /\b(lactation|breast-?feeding|breastfeed\w*|nursing mothers?)\b/i, concept: 'lactation', sub: 'lactation' },
  { re: /\b(contracept\w*|birth control)\b/i, concept: 'contraception', sub: 'contraception' },
  { re: /\b(early |premature |induced )?menopaus\w*\b|\bhot flash\w*\b|\bvasomotor\b/i, concept: 'menopause and endocrine survivorship', sub: 'endocrine' },
  { re: /\bsurvivorship\b/i, concept: 'cancer survivorship', sub: 'endocrine' },
  { re: /\b(hereditary|germline|inherited)\b.*\b(cancer|syndrome|fertility|reproductive|family planning)\b|\b(preimplantation genetic|pgt-?m|pgd)\b|\breproductive planning\b|\bfamily planning\b|\bfertility planning\b/i, concept: 'hereditary cancer and reproductive planning', sub: 'hereditary' },
  { re: /\b(embryo culture|ivf|in vitro fertili[sz]ation|icsi|assisted reproduct\w*|\bart\b lab|vitrification (kit|device|media)|cryopreservation (device|media|kit)|culture media)\b/i, concept: 'assisted reproduction laboratory devices', sub: 'device' },
  { re: /\b(pediatric|paediatric|child(hood)?|adolescent|aya|young adult)\b.*\b(fertility|gonad\w*|oncofertility)\b|\b(fertility|gonad\w*)\b.*\b(pediatric|paediatric|child(hood)?|adolescent|aya)\b/i, concept: 'pediatric and AYA fertility preservation', sub: 'pediatric' }
];
// Alkylating / platinum / other agents commonly discussed in gonadotoxicity literature (routing hint only: no risk is inferred).
var GONADO_DICT = new Set('cyclophosphamide ifosfamide busulfan melphalan chlorambucil bendamustine procarbazine carmustine lomustine thiotepa mechlorethamine dacarbazine temozolomide cisplatin carboplatin oxaliplatin doxorubicin'.split(' '));
var IMAGING_DICT = [
  { re: /\b(open )?imaging workbench\b|\bohif\b|\bdicom(web)?\b|\bpacs\b/i, concept: 'Oncotics Imaging Workbench', workbench: true },
  { re: /\bbreast mri\b/i, concept: 'breast MRI' }, { re: /\bbrain mri\b/i, concept: 'brain MRI' }, { re: /\b(low[- ]dose )?chest ct\b|\bldct\b/i, concept: 'chest CT' },
  { re: /\bpet[\/ -]?ct\b|\bpet[\/ -]?mri?\b|\bpsma pet\b|\bfdg[- ]pet\b|\bpet scan\b/i, concept: 'PET imaging' }, { re: /\bmammogra\w*\b|\btomosynthesis\b/i, concept: 'mammography' },
  { re: /\bmri\b|\bmagnetic resonance\b/i, concept: 'MRI' }, { re: /\bct scan\b|\bcomputed tomography\b|\bcect\b/i, concept: 'CT' }, { re: /\bultrasound\b|\bsonograph\w*\b/i, concept: 'ultrasound' },
  { re: /\bspect\b/i, concept: 'SPECT' }, { re: /\bx-?ray\b|\bradiograph\w*\b/i, concept: 'radiography' },
  { re: /\bradiomics?\b/i, concept: 'radiomics' }, { re: /\bimage[- ]guided biops\w*\b/i, concept: 'image-guided biopsy' }, { re: /\bradiation (therapy )?planning\b|\bradiotherapy planning\b/i, concept: 'radiation planning' },
  { re: /\b(response assessment|recist|lugano|rano)\b/i, concept: 'imaging response assessment' }, { re: /\b(oncologic |cancer )?imaging\b|\bradiolog\w*\b/i, concept: 'oncologic imaging' }
];
var BIOLOGIC_END = /(mab|cept|leucel|kinra|ase|vec|cel|tide)$/i;

function scoreLabel(n) { return n >= 90 ? 'Very High' : n >= 75 ? 'High' : n >= 50 ? 'Medium' : n >= 25 ? 'Low' : 'Very Low'; }
function scoreKind(n) { return n >= 90 ? 'good' : n >= 75 ? 'teal' : n >= 50 ? 'warn' : 'bad'; }
var DETECT_BASE = { High: 88, Medium: 62, Low: 30, 'User-selected': 95 };
var TYPE_INFO = {
  gene: ['Gene', 'clinical-evidence'], variant: ['Variant', 'clinical-evidence'], rsid: ['rsID / variant', 'biology'], hgvs: ['HGVS variant', 'biology'], drug: ['Drug', 'drug-intelligence'],
  biologic: ['Biologic', 'drug-intelligence'], disease: ['Disease / cancer type', 'trials'], nct: ['Trial ID', 'trials'], regid: ['Registry trial ID', 'trials'], pmid: ['PMID', 'literature'], doi: ['DOI', 'literature'],
  device: ['Device / diagnostic', 'device-intelligence'], concept: ['Free-text clinical concept', 'literature'], uniprot: ['Protein accession', 'biology'], ensembl: ['Ensembl accession', 'biology'], rxcui: ['RxNorm concept', 'drug-intelligence'],
  ambiguous: ['Incomplete notation', 'overview'], protein: ['Protein', 'biology'], vaccine: ['Vaccine', 'vaccines-cancer-immunization'], fertility: ['Onco-Fertility concept', 'onco-fertility'],
  imaging: ['Imaging concept', 'overview'], drugctx: ['Drug + reproductive concept', 'onco-fertility'], genectx: ['Gene + reproductive / hereditary concept', 'onco-fertility'], target: ['Drug-target context', 'drug-intelligence']
};
var VAX_SUB = { preventive: 'Preventive cancer vaccine', therapeutic: 'Therapeutic cancer vaccine', oncolytic: 'Oncolytic viral immunotherapy', 'immunotherapy-context': 'Immunotherapy (vaccine-derived)', general: 'Vaccine (immunization context)' };
var FERT_SUB = { fertility: 'Fertility preservation concept', gonadotoxicity: 'Gonadotoxicity concept', pregnancy: 'Pregnancy concept', lactation: 'Lactation concept', contraception: 'Contraception concept', endocrine: 'Endocrine survivorship concept', hereditary: 'Hereditary cancer / reproductive planning concept', device: 'Reproductive device / ART lab concept', pediatric: 'Pediatric / AYA fertility concept' };
function typeName(c) { if (c.type === 'device' && c.subtype === 'reproductive') return 'Reproductive / ART laboratory device'; if (c.type === 'vaccine') return VAX_SUB[c.subtype] || 'Vaccine'; if (c.type === 'fertility') return FERT_SUB[c.subtype] || 'Onco-Fertility concept'; if (c.type === 'drugctx' && c.subtype === 'pregnancy-vaccination') return 'Pregnancy / lactation vaccination concept'; return (TYPE_INFO[c.type] || [humanEnum(c.type)])[0]; }

function mkCand(type, subtype, label, base, why, signals, entity, extra) {
  return Object.assign({ key: type + (subtype ? ':' + subtype : ''), type: type, subtype: subtype || null, label: label, normalized: label, base: Math.max(0, Math.min(99, base)), why: why, signals: signals || [], supporting: [], conflicting: [], flags: [], module: (TYPE_INFO[type] || [null, 'overview'])[1], entity: entity }, extra || {});
}
function sig(text, kind, delta, source) { return { text: text, kind: kind, delta: delta || 0, source: source || 'Oncotics local rules' }; }
function findIn(dict, t) { for (var i = 0; i < dict.length; i++) if (dict[i].re.test(t)) return dict[i]; return null; }
function tokenDrug(tokens) { for (var i = 0; i < tokens.length; i++) { var k = tokens[i].toLowerCase(); if (DRUG_BRANDS[k]) return { drug: DRUG_BRANDS[k], brand: tokens[i] }; if (DRUGS.has(k)) return { drug: k }; } return null; }
function tokenGene(tokens) { for (var i = 0; i < tokens.length; i++) { var g = normGene(tokens[i]); if (g && g.known && !(GENE_WORDS.has(tokens[i].toUpperCase()) && tokens[i] !== tokens[i].toUpperCase())) return g.symbol; } return null; }

function interpret(q, d) {
  var t = q.trim(), low = t.toLowerCase(), tokens = t.split(/\s+/), list = [];
  // 1) Pattern/dictionary detection from the base resolver.
  arr(d.candidates).forEach(function (x, i) {
    var base = DETECT_BASE[x.confidence] || 40, s = [];
    var r = x.reason || '';
    if (/NCT identifier|PMID prefix|DOI pattern|dbSNP rsID|Transcript-qualified HGVS|Ensembl (gene|transcript)|ISRCTN|ANZCTR|CTRI|EU CT|EudraCT|Japanese registry|Genomic HGVS/.test(r)) { base = 97; s.push(sig('Exact identifier pattern: ' + r, 'pattern', 0)); }
    else if (/510\(k\)|De Novo|PMA|HDE/.test(r)) { base = 66; s.push(sig(r + ' — pattern only; the record must be verified', 'pattern', 0)); x.verify = true; }
    else if (/UDI-DI/.test(r)) { base = 60; s.push(sig(r, 'pattern', 0)); }
    else if (/product code/i.test(r)) { base = 52; s.push(sig(r, 'pattern', 0)); }
    else if (r) s.push(sig(r, /Brand|Known|Alias|abbreviation|Disease term|Device/.test(r) ? 'dictionary' : 'pattern', 0));
    var type = x.type;
    if (type === 'variant' && x.change) { base += 4; s.push(sig('Protein-style change ' + x.change.label + ' parsed (p.' + x.change.three + ')', 'pattern', 4)); if (GENES.has(x.gene)) s.push(sig('Gene symbol ' + x.gene + ' recognized', 'dictionary', 0)); }
    if (type === 'gene' && x.confidence === 'High') { base += 2; s.push(sig('Exact cancer-gene symbol match', 'dictionary', 2)); }
    if (type === 'drug' && x.brand) { s.push(sig('Brand name dictionary: ' + x.brand + ' → ' + x.drug, 'dictionary', 0)); }
    if (type === 'drug' && x.confidence === 'High') { base += 2; s.push(sig('Exact drug dictionary hit', 'dictionary', 2)); }
    if (type === 'drug' && BIOLOGIC_END.test(x.drug || '')) { type = 'biologic'; }
    if (type === 'disease' && tokens.length > 3 && (tokenGene(tokens) || tokenDrug(tokens) || /vaccin|fertil|pregnan/i.test(t))) { base -= 30; s.push(sig('Specificity penalty: the whole query is broader than a disease name', 'penalty', -30)); }
    if (type === 'disease' && /vaccin/i.test(t)) { base -= 10; s.push(sig('Query also names a vaccine', 'penalty', -10)); }
    if (type === 'concept') { s.push(sig('No specific identifier, symbol or dictionary term matched', 'penalty', 0)); }
    var c = mkCand(type, null, x.label, base, x.reason || '', s, x);
    if (type === 'biologic') c.flags.push('Biologic naming pattern (e.g. -mab, -cel): searched as a drug/biologic');
    if (x.verify) c.flags.push('Pattern match only — verify against the official FDA database');
    list.push(c);
  });
  // 2) Variant → also offer the gene alone; multi-token → free-text context.
  var v = list.find(function (c) { return c.type === 'variant'; });
  if (v) {
    var ge = v.entity.gene;
    list.push(mkCand('gene', null, ge, 62, 'Query contains the gene symbol ' + ge + ', but the variant pattern is stronger.', [sig('Gene symbol ' + ge + ' present', 'dictionary', 0), sig('Variant pattern takes precedence', 'penalty', -26)], { type: 'gene', gene: ge, label: ge, confidence: 'Medium', reason: 'Gene part of a variant query' }));
  }
  // 3) Single gene → protein and drug-target context alternatives.
  var g1 = list.find(function (c) { return c.type === 'gene' && c.base >= 85; });
  if (g1 && tokens.length === 1) {
    list.push(mkCand('protein', null, g1.entity.gene + ' protein', 54, 'The gene symbol also names its protein product; UniProt resolution happens in Biology.', [sig('Gene symbol doubles as protein name', 'dictionary', 0)], { type: 'gene', gene: g1.entity.gene, label: g1.entity.gene, confidence: 'Medium', reason: 'Protein of ' + g1.entity.gene }, { module: 'biology', bioTab: 'protein' }));
    list.push(mkCand('target', null, g1.entity.gene + ' as a drug target', 44, 'Drugs, biologics and trials that target ' + g1.entity.gene + ' (Open Targets / DGIdb / CIViC therapies).', [sig('Gene could be read as a drug-target concept', 'dictionary', 0)], { type: 'concept', concept: g1.entity.gene + ' targeted therapy', geneHint: g1.entity.gene, label: g1.entity.gene + ' targeted therapy', confidence: 'Low', reason: 'Drug-target context' }, { module: 'drug-intelligence' }));
  }
  // 4) Vaccines.
  var vx = findIn(VACCINE_DICT, t);
  if (vx) {
    var vbase = vx.generic ? 76 : (tokens.length <= 4 ? 93 : 88), vs = [sig('Vaccine dictionary: ' + vx.name + ' (' + (VAX_SUB[vx.kind] || vx.kind) + ')', 'dictionary', 0)];
    if (vx.investigational) vs.push(sig('Investigational concept: no approved product is implied', 'dictionary', 0));
    var vent = { type: 'vaccine', label: vx.name, vaccine: { name: vx.name, kind: vx.kind, antigen: vx.antigen || null, antigenGene: vx.antigenGene || null, products: vx.products || [], cancers: vx.cancers || [], synonyms: vx.synonyms || [vx.name], investigational: !!vx.investigational, note: vx.note || null, raw: t }, confidence: 'High', reason: 'Vaccine dictionary' };
    var vc = mkCand('vaccine', vx.kind, vx.name, vbase, (VAX_SUB[vx.kind] || 'Vaccine') + ' concept recognized' + (vx.cancers && vx.cancers.length ? ' (cancer context: ' + vx.cancers.slice(0, 3).join(', ') + ')' : '') + '.', vs, vent);
    if (vx.note) vc.flags.push(vx.note);
    list.push(vc);
    if (vx.products && vx.products.length) list.push(mkCand('biologic', null, vx.products[0] + ' (biologic label)', vx.kind === 'therapeutic' ? 70 : 50, 'Named product: FDA biologic/vaccine labels where openFDA returns them.', [sig('Product name in vaccine dictionary', 'dictionary', 0)], { type: 'drug', drug: vx.products[0].toLowerCase(), label: vx.products[0], confidence: 'Medium', reason: 'Vaccine/biologic product' }));
    if (vx.kind === 'preventive' && vx.cancers.length) list.push(mkCand('disease', 'prevention', vx.cancers[0] + ' (prevention context)', 46, 'Preventive vaccines are linked to cancer-prevention context; this treats the query as the disease.', [sig('Vaccine dictionary prevention context', 'dictionary', 0)], { type: 'disease', disease: vx.cancers[0], label: vx.cancers[0], confidence: 'Low', reason: 'Prevention context' }));
  }
  // 5) Onco-Fertility concepts (+ compounds with drug / gene / vaccine).
  var fx = findIn(FERT_DICT, t), td = tokenDrug(tokens), tg = tokenGene(tokens);
  if (fx) {
    var fent = { type: 'fertility', label: fx.concept, fertility: { concept: fx.concept, sub: fx.sub, raw: t }, confidence: 'High', reason: 'Onco-Fertility dictionary' };
    var fsig = [sig('Onco-Fertility dictionary: ' + fx.concept + ' (' + (FERT_SUB[fx.sub] || fx.sub) + ')', 'dictionary', 0)];
    if (vx && /pregnan|lactation/.test(fx.sub) && !vx.generic) {
      var pv = mkCand('drugctx', 'pregnancy-vaccination', vx.name + ' + ' + fx.concept, 90, 'Vaccine and pregnancy/lactation terms together: official immunization link-outs, trials and literature only.', fsig.concat([sig('Vaccine dictionary: ' + vx.name, 'dictionary', 0)]), Object.assign({}, vent, { type: 'vaccine', vaccine: Object.assign({}, vent.vaccine, { pregnancy: true }), fertility: fent.fertility }), { module: 'vaccines-cancer-immunization', lens: 'pregnancy' });
      list.push(pv);
      list.forEach(function (c) { if (c.type === 'vaccine') { c.base -= 14; c.signals.push(sig('A combined vaccine + pregnancy interpretation is more specific', 'penalty', -14)); } });
    }
    var fbase = tokens.length <= 4 ? 90 : 84;
    if (DEVICE_RE.test(t) && fx.sub !== 'device') { fbase -= 18; fsig.push(sig('Query also names an assay/device', 'penalty', -18)); }
    if (td || (tg && fx.sub === 'hereditary') || (DEVICE_RE.test(t) && fx.sub === 'device')) fbase -= 26;
    if (vx && !vx.generic) fbase -= 22;
    list.push(mkCand('fertility', fx.sub, fx.concept, fbase, (FERT_SUB[fx.sub] || 'Onco-Fertility concept') + ' recognized. Routes to trials, literature and official guideline link-outs; no advice is generated.', fsig, fent));
    if (td) {
      list.push(mkCand('drugctx', fx.sub, td.drug + ' + ' + fx.concept, 87, 'Drug and reproductive concept together: label reproductive sections, reproductive adverse-event terms, trials and literature side by side. No single clinical answer is given.', [sig('Drug dictionary: ' + td.drug, 'dictionary', 0)].concat(fsig), { type: 'drug', drug: td.drug, brand: td.brand || null, label: td.drug, fertility: { concept: fx.concept, sub: fx.sub, drug: td.drug, raw: t }, confidence: 'High', reason: 'Drug + reproductive concept' }, { module: 'onco-fertility' }));
      list.forEach(function (c) { if ((c.type === 'drug' || c.type === 'biologic') && c.entity.drug === td.drug) { c.base = Math.min(c.base, 64); c.signals.push(sig('Query also contains a reproductive-health concept', 'penalty', 0)); } });
      if (!list.some(function (c) { return c.type === 'drug'; })) list.push(mkCand('drug', null, td.drug, 64, 'The query contains the drug name ' + td.drug + '.', [sig('Drug dictionary: ' + td.drug, 'dictionary', 0)], { type: 'drug', drug: td.drug, brand: td.brand || null, label: td.drug, confidence: 'Medium', reason: 'Drug token' }));
    }
    if (tg && fx.sub === 'hereditary') {
      list.push(mkCand('genectx', 'hereditary', tg + ' + hereditary / reproductive planning', 84, 'Gene with hereditary-cancer or reproductive-planning terms: gene-disease validity link-outs, literature and trials. Not genetic counseling.', [sig('Gene symbol ' + tg, 'dictionary', 0)].concat(fsig), { type: 'gene', gene: tg, label: tg, fertility: { concept: fx.concept, sub: 'hereditary', gene: tg, raw: t }, confidence: 'High', reason: 'Gene + hereditary concept' }, { module: 'onco-fertility', lens: 'hereditary' }));
      if (!list.some(function (c) { return c.type === 'gene'; })) list.push(mkCand('gene', null, tg, 66, 'The query contains the gene symbol ' + tg + '.', [sig('Gene symbol ' + tg, 'dictionary', 0)], { type: 'gene', gene: tg, label: tg, confidence: 'Medium', reason: 'Gene token' }));
    }
    if (fx.sub === 'device' && DEVICE_RE.test(t)) list.forEach(function (c) { if (c.type === 'device' && !c.subtype) { c.base -= 10; c.signals.push(sig('A reproductive-device interpretation is more specific', 'penalty', -10)); } });
    if (fx.sub === 'device' && DEVICE_RE.test(t)) list.push(mkCand('device', 'reproductive', t, 90, 'Reproductive / ART laboratory device concept: openFDA device records (may lag official DB) and FDA database link-outs.', [sig('Device term + ART concept', 'dictionary', 0)].concat(fsig), { type: 'device', deviceText: t.replace(/\b(fda|510\(k\)|510k|pma)\b/ig, '').replace(/\s+/g, ' ').trim() || t, label: t, fertility: { concept: fx.concept, sub: 'device', raw: t }, confidence: 'High', reason: 'Reproductive device' }, { module: 'onco-fertility', lens: 'devices' }));
  } else if (td && GONADO_DICT.has(td.drug)) {
    list.push(mkCand('fertility', 'gonadotoxicity', td.drug + ' gonadotoxicity context', 58, td.drug + ' is in Oncotics’ routing list of agents frequently discussed in gonadotoxicity literature. This is a routing hint only; no risk is inferred.', [sig('Gonadotoxicity routing dictionary (hint only)', 'dictionary', 0)], { type: 'drug', drug: td.drug, label: td.drug, fertility: { concept: 'gonadotoxicity', sub: 'gonadotoxicity', drug: td.drug, raw: t }, confidence: 'Medium', reason: 'Onco-Fertility lens' }, { module: 'onco-fertility', lens: 'gonadotoxic' }));
  }
  // 6) Imaging concepts.
  var ix = findIn(IMAGING_DICT, t);
  if (ix) {
    var ib = ix.workbench ? 95 : (tokens.length <= 3 ? 80 : 66);
    var ic = mkCand('imaging', ix.workbench ? 'workbench' : 'modality', ix.concept, ib, ix.workbench ? 'Imaging Workbench request: opens the separate OHIF page; nothing is loaded here.' : 'Imaging modality / radiology topic: literature, imaging-related trials and device records (user-triggered). Use the separate Imaging Workbench for images.', [sig('Imaging dictionary: ' + ix.concept, 'dictionary', 0)], { type: 'imaging', label: ix.concept, imaging: { concept: ix.concept, workbench: !!ix.workbench, raw: t }, confidence: 'High', reason: 'Imaging dictionary' });
    ic.flags.push('Imaging context only: no image data is attached to any query');
    list.push(ic);
    list.forEach(function (c) { if (c.type === 'device' && !c.entity.deviceId && c !== ic) { c.base -= ix.workbench ? 60 : 8; c.signals.push(sig('Imaging concept dictionary matched first', 'penalty', ix.workbench ? -60 : -8)); } });
  }
  // 7) Multi-token free-text concept (always offered as a low alternative).
  if (tokens.length >= 2 && !list.some(function (c) { return c.type === 'concept'; })) list.push(mkCand('concept', null, t, 31, 'Literature and trials may mention the combined phrase.', [sig('Combined free-text phrase', 'pattern', 0)], { type: 'concept', concept: t, label: t, geneHint: tg, confidence: 'Low', reason: 'Free-text concept' }));
  if (tokens.length === 1 && list.length === 1 && list[0].type === 'concept') list[0].base = 28;
  // De-duplicate by key (keep highest), score, sort.
  var by = new Map(); list.forEach(function (c) { var k = c.key + '|' + c.label.toLowerCase(); if (!by.has(k) || by.get(k).base < c.base) by.set(k, c); });
  var out = Array.from(by.values());
  out.forEach(function (c) { c.score = Math.max(0, Math.min(99, Math.round(c.base))); c.scoreLabel = scoreLabel(c.score); });
  out.sort(function (a, b) { return b.score - a.score; });
  return finalize({ query: t, candidates: out.slice(0, 8), builtAt: isoNow() });
}
function finalize(I) {
  var c = I.candidates; I.top = c[0];
  I.ambiguous = !!(c[1] && c[1].score >= 50 && c[0].score - c[1].score < 10);
  I.needsConfirm = !c[0] || c[0].score < 50 || I.ambiguous;
  c.forEach(function (x, i) { x.flags = uniq(x.flags.concat(i > 0 && I.top && I.top.score - x.score < 10 && x.score >= 50 ? ['Close to the top interpretation'] : [])); });
  return I;
}

/* Live-resolution signals: re-scored from in-memory slots on every render
   (no network; adds source agreement / conflict signals). */
function liveSignals(c) {
  var out = [], sup = [], con = [];
  var ok = function (k) { var s = slot(k); return s.status === 'ok' ? s.data : null; };
  var empty = function (k) { return slot(k).status === 'empty'; };
  var add = function (text, delta, src, kind) { out.push(sig(text, kind || (delta >= 0 ? 'live' : 'conflict'), delta, src)); if (delta >= 0) sup.push(src); else con.push(src); };
  var t = c.type, ev = ok('civic:evidence'), tr = ok('trials:list'), lit = ok('lit:list');
  if (t === 'gene' || t === 'genectx' || t === 'protein') {
    var mg = ok('gene:mygene'); if (mg) add(mg.exact ? 'MyGene.info exact symbol hit' : 'MyGene.info returned only fuzzy candidates', mg.exact ? 4 : -6, 'MyGene.info'); else if (empty('gene:mygene')) add('MyGene.info returned no human gene', -12, 'MyGene.info');
    var up = ok('bio:uniprot'); if (up) add('UniProt reviewed entry ' + up.protein.data.acc, 2, 'UniProt');
  }
  if (t === 'variant' || t === 'rsid' || t === 'hgvs') {
    var mv = ok('var:myvariant'); if (mv) add('MyVariant.info returned ' + mv.items.length + ' candidate variant' + (mv.items.length > 1 ? 's' : ''), 3, 'MyVariant.info'); else if (empty('var:myvariant')) add('MyVariant.info did not resolve this notation', -10, 'MyVariant.info');
    var vp = ok('var:vep'); if (vp) add('Ensembl VEP returned consequences', 2, 'Ensembl VEP');
  }
  if (ev && (t === 'gene' || t === 'variant' || t === 'drug' || t === 'disease' || t === 'genectx')) add('CIViC returned ' + num(ev.total) + ' evidence item' + (ev.total === 1 ? '' : 's'), ev.total ? 3 : 0, 'CIViC');
  else if (empty('civic:evidence') && (t === 'variant')) add('CIViC returned no evidence for this exact molecular profile', -2, 'CIViC');
  if (t === 'drug' || t === 'biologic' || t === 'drugctx') {
    var lb = ok('drug:labels');
    if (lb) { var best = lb.items[0].data.confidence; add('openFDA label match: ' + best, best === 'Exact' ? 4 : best === 'Likely' ? 1 : -6, 'openFDA drug label'); }
    else if (empty('drug:labels')) add('openFDA returned no drug label', -5, 'openFDA drug label');
    var rx = ok('drug:rxnorm'); if (rx) add('RxNorm concept resolved' + (rx.rxcui ? ' (RxCUI ' + rx.rxcui + ')' : ''), 2, 'RxNorm');
  }
  if (t === 'disease') { var ol = ok('ont:ols'); if (ol) add('EBI OLS resolved ' + ol.items[0].id + ' (' + ol.items[0].label + ')', 2, 'EBI OLS'); var ot = ok('ont:oncotree'); if (ot) add('OncoTree matched ' + ot.items[0].code + ' (' + ot.items[0].name + ')', 3, 'OncoTree'); }
  if (t === 'nct') { var td = slot('trial:detail:' + (c.entity.nct || '')); if (td.status === 'ok') add('ClinicalTrials.gov record found', 2, 'ClinicalTrials.gov'); else if (td.status === 'empty') add('ClinicalTrials.gov has no record with this NCT ID', -45, 'ClinicalTrials.gov'); }
  if (t === 'pmid' || t === 'doi') { if (lit) add('Europe PMC record found', 2, 'Europe PMC'); else if (empty('lit:list')) add('Europe PMC has no matching record', -30, 'Europe PMC'); }
  if (t === 'device') { var au = ok('dev:auth'); if (au) add('openFDA device authorization record found (may lag official DB)', 8, 'openFDA device'); else if (empty('dev:auth')) add('openFDA returned no authorization record (records may lag the official FDA database)', -12, 'openFDA device'); }
  if ((t === 'vaccine' || t === 'fertility' || t === 'imaging' || t === 'concept' || t === 'drugctx') && tr) add('ClinicalTrials.gov returned ' + num(tr.total) + ' related studies', tr.total ? 1 : 0, 'ClinicalTrials.gov');
  if ((t === 'vaccine' || t === 'fertility' || t === 'imaging' || t === 'concept') && lit) add('Europe PMC returned ' + num(lit.total) + ' records', lit.total ? 1 : 0, 'Europe PMC');
  return { signals: out, supporting: uniq(sup), conflicting: uniq(con) };
}
function liveInterpretation() {
  var I = State.interp; if (!I) return null;
  var sel = State.entity && State.ctx ? I.selectedKey : null;
  I.candidates.forEach(function (c) {
    var L = c.key === sel || (!sel && c === I.top) ? liveSignals(c) : { signals: [], supporting: [], conflicting: [] };
    c.liveSignals = L.signals; c.supporting = L.supporting; c.conflicting = L.conflicting;
    var delta = L.signals.reduce(function (a, x) { return a + x.delta; }, 0);
    c.score = Math.max(0, Math.min(99, Math.round(c.base + delta))); c.scoreLabel = scoreLabel(c.score);
  });
  // Label-mentioned target genes (live-derived alternative for drug queries).
  var lb = slot('drug:labels');
  if (State.ctx && (State.ctx.type === 'drug') && lb.status === 'ok' && !I.candidates.some(function (c) { return c.key === 'gene:label-target'; })) {
    var moa = String((lb.data.items[0].data.sections || {}).mechanism_of_action || '') + ' ' + String((lb.data.items[0].data.sections || {}).indications_and_usage || '');
    var hits = uniq((moa.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) || []).map(function (x) { return GENE_ALIASES[x] || x; }).filter(function (x) { return GENES.has(x) && !GENE_WORDS.has(x); })).slice(0, 3);
    if (hits.length) {
      var gc = mkCand('gene', 'label-target', hits[0], 50, 'The current FDA label text mentions ' + hits.join(', ') + ' (live-derived target hint).', [sig('openFDA label mechanism/indication text mentions ' + hits.join(', '), 'live', 0, 'openFDA drug label')], { type: 'gene', gene: hits[0], label: hits[0], confidence: 'Medium', reason: 'Target mentioned in FDA label' }, { derived: true });
      gc.key = 'gene:label-target'; gc.score = 50; gc.scoreLabel = scoreLabel(50); gc.supporting = ['openFDA drug label']; gc.flags.push('Derived by Oncotics from label text');
      I.candidates.push(gc);
    }
  }
  return I;
}
