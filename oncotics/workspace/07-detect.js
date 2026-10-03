
/* ====================================================================
   INPUT HYGIENE / PHI GUARD
   Rejected input is never stored, logged or echoed back.
   ==================================================================== */
var PHI_MESSAGE = 'This input appears too broad or may contain sensitive text. Please search a gene, variant, drug, device, diagnostic, disease, trial ID, PMID, rsID, HGVS notation, 510(k) number, PMA number, product code, or UDI-DI.';
function checkInput(s) {
  if (typeof s !== 'string') return { ok: false };
  if (/[\r\n\t]/.test(s)) return { ok: false, reason: 'multiline' };
  var t = s.trim().replace(/\s+/g, ' ');
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > CONFIG.maxInputLength) return { ok: false, reason: 'length' };
  var checks = [
    /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,                                          // email
    /(\+?\d{1,3}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/,              // phone
    /\b\d{3}-\d{2}-\d{4}\b/,                                                 // SSN-like
    /\b\d{1,2}[\/.]\d{1,2}[\/.](19|20)?\d{2}\b/,                             // dd/mm/yy dates
    /\b(19|20)\d{2}[\/.]\d{1,2}[\/.]\d{1,2}\b/,                              // yyyy/mm/dd dates
    /\b(dob|d\.o\.b|date of birth|born on|mrn|medical record|patient name|pt name|ssn|social security|insurance id|member id)\b/i,
    /\b(serial (no|number|#)|lot (no|number|#)|batch (no|number)|implant(ed)? (serial|lot))\b/i,
    /\((10|11|17|21)\)/,                                                      // GS1 production identifiers (lot/serial/dates)
    /\b(mr|mrs|ms|miss)\.?\s+[A-Z][a-z]+/,                                   // honorific + name
    /\b\d{1,3}\s*(yo|y\/o|year[- ]old|yrs? old)\b/i,                         // age statements
    /(^|\s)\d{1,3}\s?(M|F)(\s|$)/,                                            // "54 F"
    /\b(my|our) (mother|father|mom|dad|wife|husband|son|daughter|patient|child|sister|brother)\b/i,
    /\.(vcf|fastq|fq|bam|cram|sam|maf)(\.gz)?\b/i, /^#?CHROM\b/i, /^[ACGTN]{40,}$/i
  ];
  for (var i = 0; i < checks.length; i++) if (checks[i].test(t)) return { ok: false, reason: 'phi' };
  if (t.split(' ').length > 12) return { ok: false, reason: 'broad' };
  return { ok: true, value: t };
}

/* ====================================================================
   STATIC ALIAS MAP (routing hints only; never presented as results)
   ==================================================================== */
var GENES = new Set(('ABL1 ABL2 ACVR1 AKT1 AKT2 AKT3 ALK AMER1 APC AR ARAF ARID1A ARID1B ARID2 ASXL1 ATM ATR ATRX AURKA AURKB AXIN1 AXIN2 B2M BAP1 BARD1 BCL2 BCL6 BCOR BCR BIRC5 BLM BRAF BRCA1 BRCA2 BRD4 BRIP1 BTK CALR CARD11 CBL CCND1 CCND2 CCND3 CCNE1 CD19 CD22 CD274 CD38 CD79A CD79B CDC73 CDH1 CDK12 CDK4 CDK6 CDKN1A CDKN1B CDKN2A CDKN2B CDKN2C CEACAM5 CEBPA CHEK1 CHEK2 CIC CLDN18 CREBBP CRLF2 CSF1R CSF3R CTCF CTLA4 CTNNB1 CUL3 CXCR4 DAXX DDR2 DICER1 DLL3 DNMT3A DOT1L EED EGFR EIF1AX EML4 EP300 EPCAM EPHA2 ERBB2 ERBB3 ERBB4 ERCC2 ERCC4 ERG ESR1 ETV1 ETV4 ETV6 EWSR1 EZH2 FANCA FANCC FANCD2 FAT1 FBXW7 FGF19 FGF3 FGF4 FGFR1 FGFR2 FGFR3 FGFR4 FH FLCN FLT1 FLT3 FLT4 FOLR1 FOXA1 FOXL2 FUBP1 GATA2 GATA3 GNA11 GNAQ GNAS GPRC5D H3-3A HNF1A HRAS IDH1 IDH2 IGF1R IKZF1 IL7R INPP4B IRF4 JAK1 JAK2 JAK3 KDM5C KDM6A KDR KEAP1 KIT KMT2A KMT2C KMT2D KRAS LRP1B MAP2K1 MAP2K2 MAP2K4 MAP3K1 MAX MCL1 MDM2 MDM4 MED12 MEF2B MEN1 MET MITF MKI67 MLH1 MPL MRE11 MS4A1 MSH2 MSH3 MSH6 MSLN MTOR MUTYH MYC MYCL MYCN MYD88 NBN NECTIN4 NF1 NF2 NFE2L2 NKX2-1 NOTCH1 NOTCH2 NOTCH3 NPM1 NRAS NRG1 NSD1 NSD2 NTRK1 NTRK2 NTRK3 NUTM1 PALB2 PAX5 PAX8 PBRM1 PDCD1 PDCD1LG2 PDGFRA PDGFRB PGR PHF6 PIK3CA PIK3CB PIK3R1 PIM1 PMS2 POLD1 POLE PPARG PPM1D PPP2R1A PRDM1 PRKACA PTCH1 PTEN PTPN11 RAC1 RAD21 RAD50 RAD51 RAD51B RAD51C RAD51D RAF1 RARA RB1 RBM10 RET RHOA RICTOR RNF43 ROS1 RUNX1 SDHA SDHB SDHC SDHD SETD2 SF3B1 SMAD2 SMAD3 SMAD4 SMARCA4 SMARCB1 SMO SOCS1 SOX2 SOX9 SPOP SRC SRSF2 STAG2 STAT3 STK11 SUFU SUZ12 TACSTD2 TAF1 TBX3 TCF7L2 TERT TET2 TGFBR2 TMPRSS2 TNFAIP3 TNFRSF17 TP53 TP63 TSC1 TSC2 TSHR U2AF1 VEGFA VHL WT1 XPO1 ZRSR2').split(' '));
var GENE_WORDS = new Set(['MET', 'MAX', 'KIT', 'RET', 'SRC', 'ERG', 'FH', 'AR', 'ATM', 'ATR', 'CIC', 'BLM', 'APC', 'NBN', 'PGR']); // need uppercase input
var GENE_ALIASES = { HER2: 'ERBB2', NEU: 'ERBB2', HER1: 'EGFR', ERBB1: 'EGFR', HER3: 'ERBB3', HER4: 'ERBB4', 'PD-L1': 'CD274', PDL1: 'CD274', 'PD-1': 'PDCD1', PD1: 'PDCD1', 'PD-L2': 'PDCD1LG2',
  TRKA: 'NTRK1', TRKB: 'NTRK2', TRKC: 'NTRK3', 'C-KIT': 'KIT', 'C-MET': 'MET', MLL: 'KMT2A', P53: 'TP53', P16: 'CDKN2A', BCMA: 'TNFRSF17', TROP2: 'TACSTD2', 'TROP-2': 'TACSTD2', CD20: 'MS4A1', H3F3A: 'H3-3A',
  WHSC1: 'NSD2', 'CLAUDIN18.2': 'CLDN18', 'CLDN18.2': 'CLDN18', NECTIN: 'NECTIN4', CEA: 'CEACAM5', 'C-MYC': 'MYC', 'N-MYC': 'MYCN', 'FLT-3': 'FLT3' };
var BIOMARKERS = { 'MSI-H': 'microsatellite instability high (MSI-H)', 'MSI-HIGH': 'microsatellite instability high (MSI-H)', MSI: 'microsatellite instability', DMMR: 'deficient mismatch repair (dMMR)',
  'TMB-HIGH': 'tumor mutational burden high (TMB-high)', 'TMB-H': 'tumor mutational burden high (TMB-high)', TMB: 'tumor mutational burden', HRD: 'homologous recombination deficiency (HRD)' };
var DRUG_BRANDS = {
  tagrisso: 'osimertinib', iressa: 'gefitinib', tarceva: 'erlotinib', gilotrif: 'afatinib', vizimpro: 'dacomitinib', rybrevant: 'amivantamab', lazcluze: 'lazertinib', exkivity: 'mobocertinib',
  alecensa: 'alectinib', alunbrig: 'brigatinib', zykadia: 'ceritinib', xalkori: 'crizotinib', lorbrena: 'lorlatinib', rozlytrek: 'entrectinib', vitrakvi: 'larotrectinib', augtyro: 'repotrectinib',
  tabrecta: 'capmatinib', tepmetko: 'tepotinib', retevmo: 'selpercatinib', gavreto: 'pralsetinib', lumakras: 'sotorasib', krazati: 'adagrasib', tafinlar: 'dabrafenib', mekinist: 'trametinib',
  zelboraf: 'vemurafenib', cotellic: 'cobimetinib', braftovi: 'encorafenib', mektovi: 'binimetinib', ojemda: 'tovorafenib', gleevec: 'imatinib', glivec: 'imatinib', sprycel: 'dasatinib', tasigna: 'nilotinib',
  bosulif: 'bosutinib', iclusig: 'ponatinib', scemblix: 'asciminib', imbruvica: 'ibrutinib', calquence: 'acalabrutinib', brukinsa: 'zanubrutinib', jaypirca: 'pirtobrutinib', venclexta: 'venetoclax',
  zydelig: 'idelalisib', piqray: 'alpelisib', itovebi: 'inavolisib', truqap: 'capivasertib', afinitor: 'everolimus', ibrance: 'palbociclib', kisqali: 'ribociclib', verzenio: 'abemaciclib',
  lynparza: 'olaparib', zejula: 'niraparib', rubraca: 'rucaparib', talzenna: 'talazoparib', herceptin: 'trastuzumab', perjeta: 'pertuzumab', enhertu: 'trastuzumab deruxtecan', kadcyla: 'ado-trastuzumab emtansine',
  tukysa: 'tucatinib', tykerb: 'lapatinib', nerlynx: 'neratinib', keytruda: 'pembrolizumab', opdivo: 'nivolumab', yervoy: 'ipilimumab', tecentriq: 'atezolizumab', imfinzi: 'durvalumab', bavencio: 'avelumab',
  libtayo: 'cemiplimab', jemperli: 'dostarlimab', imjudo: 'tremelimumab', avastin: 'bevacizumab', cyramza: 'ramucirumab', erbitux: 'cetuximab', vectibix: 'panitumumab', rituxan: 'rituximab', gazyva: 'obinutuzumab',
  darzalex: 'daratumumab', sarclisa: 'isatuximab', empliciti: 'elotuzumab', blincyto: 'blinatumomab', tecvayli: 'teclistamab', talvey: 'talquetamab', elrexfio: 'elranatamab', imdelltra: 'tarlatamab',
  trodelvy: 'sacituzumab govitecan', padcev: 'enfortumab vedotin', adcetris: 'brentuximab vedotin', polivy: 'polatuzumab vedotin', elahere: 'mirvetuximab soravtansine', tivdak: 'tisotumab vedotin',
  datroway: 'datopotamab deruxtecan', revlimid: 'lenalidomide', pomalyst: 'pomalidomide', thalomid: 'thalidomide', velcade: 'bortezomib', kyprolis: 'carfilzomib', ninlaro: 'ixazomib', vidaza: 'azacitidine',
  dacogen: 'decitabine', tibsovo: 'ivosidenib', idhifa: 'enasidenib', rezlidhia: 'olutasidenib', voranigo: 'vorasidenib', rydapt: 'midostaurin', xospata: 'gilteritinib', vanflyta: 'quizartinib',
  jakafi: 'ruxolitinib', inrebic: 'fedratinib', vonjo: 'pacritinib', ojjaara: 'momelotinib', revuforj: 'revumenib', sutent: 'sunitinib', nexavar: 'sorafenib', votrient: 'pazopanib', inlyta: 'axitinib',
  cabometyx: 'cabozantinib', lenvima: 'lenvatinib', stivarga: 'regorafenib', fotivda: 'tivozanib', welireg: 'belzutifan', balversa: 'erdafitinib', pemazyre: 'pemigatinib', lytgobi: 'futibatinib',
  ayvakit: 'avapritinib', qinlock: 'ripretinib', koselugo: 'selumetinib', tazverik: 'tazemetostat', femara: 'letrozole', arimidex: 'anastrozole', aromasin: 'exemestane', faslodex: 'fulvestrant',
  orserdu: 'elacestrant', xtandi: 'enzalutamide', zytiga: 'abiraterone', erleada: 'apalutamide', nubeqa: 'darolutamide', pluvicto: 'lutetium Lu 177 vipivotide tetraxetan', lutathera: 'lutetium Lu 177 dotatate',
  taxol: 'paclitaxel', taxotere: 'docetaxel', abraxane: 'paclitaxel protein-bound', gemzar: 'gemcitabine', alimta: 'pemetrexed', xeloda: 'capecitabine', camptosar: 'irinotecan', temodar: 'temozolomide',
  kymriah: 'tisagenlecleucel', yescarta: 'axicabtagene ciloleucel', breyanzi: 'lisocabtagene maraleucel', abecma: 'idecabtagene vicleucel', carvykti: 'ciltacabtagene autoleucel', imlygic: 'talimogene laherparepvec',
  xpovio: 'selinexor', vyloy: 'zolbetuximab', kimmtrak: 'tebentafusp', amtagvi: 'lifileucel', bizengri: 'zenocutuzumab', tevimbra: 'tislelizumab', loqtorzi: 'toripalimab', zynyz: 'retifanlimab',
  halaven: 'eribulin', yondelis: 'trabectedin', lonsurf: 'trifluridine and tipiracil', ensacove: 'ensartinib', ibtrozi: 'taletrectinib'
};
var DRUGS = new Set(Object.keys(DRUG_BRANDS).map(function (k) { return DRUG_BRANDS[k].toLowerCase(); }).concat(('cisplatin carboplatin oxaliplatin fluorouracil 5-fluorouracil doxorubicin cyclophosphamide etoposide vincristine methotrexate cytarabine tamoxifen mitomycin bleomycin ifosfamide topotecan vinorelbine bendamustine chlorambucil busulfan melphalan hydroxyurea arsenic trioxide tretinoin dexamethasone prednisone leucovorin ziftomenib zongertinib sunvozertinib amivantamab-vmjw trastuzumab-deruxtecan nab-paclitaxel relatlimab').split(' ')));
var DISEASE_ABBR = { NSCLC: 'Non-Small Cell Lung Cancer', SCLC: 'Small Cell Lung Cancer', CRC: 'Colorectal Cancer', HCC: 'Hepatocellular Carcinoma', AML: 'Acute Myeloid Leukemia', CML: 'Chronic Myeloid Leukemia',
  CLL: 'Chronic Lymphocytic Leukemia', ALL: 'Acute Lymphoblastic Leukemia', MDS: 'Myelodysplastic Syndromes', GIST: 'Gastrointestinal Stromal Tumor', DLBCL: 'Diffuse Large B-Cell Lymphoma', RCC: 'Renal Cell Carcinoma',
  TNBC: 'Triple Negative Breast Cancer', HNSCC: 'Head and Neck Squamous Cell Carcinoma', MCRPC: 'Metastatic Castration-Resistant Prostate Cancer', MM: 'Multiple Myeloma', PDAC: 'Pancreatic Ductal Adenocarcinoma' };
var DISEASE_RE = /\b(cancers?|carcinomas?|adenocarcinoma|sarcomas?|lymphomas?|leuka?emias?|melanomas?|myelomas?|gliomas?|glioblastoma|\w*blastoma|neoplasms?|tumou?rs?|mesothelioma|myelodysplastic|myeloproliferative|malignan\w*|metasta\w*|oncology)\b/i;
var DEVICE_RE = /\b(assay|test|tests|cdx|companion diagnostics?|diagnostics?|ivds?|in vitro|panel|kit|device|system|scanner|accelerator|linac|pump|catheter|port|stent|robot(ic)?|software|algorithm|ai|sequencing|ngs|liquid biopsy|biopsy|imaging|pet|mri|ultrasound|endoscope|probe|monitor|wearable|implant|laser|ablation|cryoablation|brachytherapy|pcr|ihc|fish|pharmdx|ctdna|cfdna|immunohistochemistry|samd)\b/i;
var LDT_RE = /\b(ldt|ldts|laboratory[- ]developed tests?)\b/i;
var AA3 = { Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C', Gln: 'Q', Glu: 'E', Gly: 'G', His: 'H', Ile: 'I', Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P', Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V', Ter: '*', Sec: 'U' };
var AA1 = {}; Object.keys(AA3).forEach(function (k) { AA1[AA3[k]] = k; });

function normGene(tok) {
  if (!tok) return null;
  var u = tok.toUpperCase();
  if (GENE_ALIASES[u]) return { symbol: GENE_ALIASES[u], alias: tok, known: true };
  if (GENES.has(u)) {
    if (GENE_WORDS.has(u) && tok !== u) return null;
    return { symbol: u, known: true };
  }
  if (/^[A-Z][A-Z0-9-]{1,9}$/.test(tok) && /\d|^[A-Z]{3,}$/.test(tok)) return { symbol: tok, known: false };
  return null;
}
function aaTo1(s) { if (!s) return s; if (s.length === 3 && AA3[s[0].toUpperCase() + s.slice(1).toLowerCase()]) return AA3[s[0].toUpperCase() + s.slice(1).toLowerCase()]; return s.toUpperCase(); }
function parseProteinChange(s) {
  var m = /^(?:p\.)?\(?([A-Za-z]{3}|[A-Za-z])(\d{1,5})([A-Za-z]{3}|[A-Za-z*]|fs\*?\d*|del|dup|ins[A-Za-z]*|delins[A-Za-z]*)\)?$/.exec(s);
  if (!m) return null;
  var ref = aaTo1(m[1]); var pos = parseInt(m[2], 10); var alt = m[3];
  if (!/^[A-Z*]$/.test(ref) && ref.length !== 1) return null;
  var altN = /^(fs|del|dup|ins|delins)/i.test(alt) ? alt.toLowerCase() : aaTo1(alt);
  if (!/^[A-Z*]$/.test(altN) && !/^(fs|del|dup|ins|delins)/.test(altN)) return null;
  return { ref: ref, pos: pos, alt: altN, label: ref + pos + (altN.length === 1 ? altN : altN) , three: (AA1[ref] || ref) + pos + (AA1[altN] || altN) };
}

/* ====================================================================
   ENTITY DETECTION
   Returns { type, value, label, confidence, notes[], candidates[], ...fields }
   ==================================================================== */
function cand(type, label, extra, confidence, reason) { return Object.assign({ type: type, label: label, confidence: confidence || 'Medium', reason: reason || '' }, extra || {}); }
function detect(q) {
  var t = q.trim(); var u = t.toUpperCase(); var c = [];
  var m;
  // Prefixed identifiers
  if ((m = /^pmid[:\s]*(\d{1,9})$/i.exec(t))) return done([cand('pmid', 'PMID ' + m[1], { pmid: m[1] }, 'High', 'PMID prefix')]);
  if ((m = /^rxcui[:\s]*(\d{1,9})$/i.exec(t))) return done([cand('rxcui', 'RxCUI ' + m[1], { rxcui: m[1] }, 'High', 'RxCUI prefix')]);
  if ((m = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i.exec(t))) return done([cand('doi', 'DOI ' + m[1], { doi: m[1] }, 'High', 'DOI pattern')]);
  if ((m = /^NCT\d{8}$/i.exec(t))) return done([cand('nct', u, { nct: u }, 'High', 'NCT identifier')]);
  if ((m = /^ISRCTN\d{8}$/i.exec(t))) return done([cand('regid', u, { registry: 'isrctn', regId: u }, 'High', 'ISRCTN identifier (link-out + ClinicalTrials.gov secondary-ID search)')]);
  if ((m = /^ACTRN\d{14}$/i.exec(t))) return done([cand('regid', u, { registry: 'anzctr', regId: u }, 'High', 'ANZCTR identifier')]);
  if ((m = /^CTRI\/\d{4}\/\d{2,3}\/\d{6}$/i.exec(t))) return done([cand('regid', u, { registry: 'ctri', regId: u }, 'High', 'CTRI identifier')]);
  if ((m = /^UMIN\d{9}$/i.exec(t)) || (m = /^jRCT[a-z0-9]{6,}$/i.exec(t))) return done([cand('regid', t, { registry: 'jrct', regId: t }, 'High', 'Japanese registry identifier')]);
  if ((m = /^(20\d{2}-\d{6}-\d{2})(-\d{2})?$/.exec(t))) return done([cand('regid', t, { registry: m[2] ? 'eu-ctis' : 'eu-ctr', regId: t }, 'High', m[2] ? 'EU CT number (CTIS)' : 'EudraCT number')]);
  if ((m = /^rs\d{1,10}$/i.exec(t))) return done([cand('rsid', t.toLowerCase(), { rsid: t.toLowerCase() }, 'High', 'dbSNP rsID')]);
  // HGVS
  if ((m = /^((?:NM|NR|NC|NP|XM|LRG)_\d+(?:\.\d+)?|ENS[TP]\d{11}(?:\.\d+)?|LRG_\d+t?\d*)(?:\([A-Z0-9-]+\))?:([cgnp])\.(\S+)$/i.exec(t))) return done([cand('hgvs', t, { hgvs: t, hgvsKind: m[2].toLowerCase(), transcript: m[1] }, 'High', 'Transcript-qualified HGVS')]);
  if ((m = /^(?:chr)?([0-9]{1,2}|X|Y|M|MT):g\.(\d+)([ACGT]+)>([ACGT]+)$/i.exec(t))) return done([cand('hgvs', t, { hgvs: 'chr' + m[1].toUpperCase().replace(/^MT$/, 'M') + ':g.' + m[2] + m[3].toUpperCase() + '>' + m[4].toUpperCase(), hgvsKind: 'g', genomic: true }, 'High', 'Genomic HGVS (MyVariant uses GRCh37/hg19 coordinates)')]);
  if (/^[cgp]\.\S+$/i.test(t)) {
    var pc0 = /^p\./i.test(t) ? parseProteinChange(t) : null;
    return done([cand('ambiguous', t, { hgvs: t, needGene: true, change: pc0 }, 'Low', 'HGVS without a gene or transcript: add a gene symbol (e.g. BRAF ' + (pc0 ? pc0.label : t) + ') or a transcript (e.g. NM_004333.6:' + t + ')')]);
  }
  // Ensembl / UniProt
  if ((m = /^ENSG\d{11}(\.\d+)?$/i.exec(t))) return done([cand('ensembl', u, { ensembl: u.replace(/\.\d+$/, '') }, 'High', 'Ensembl gene ID')]);
  if ((m = /^ENS[TP]\d{11}(\.\d+)?$/i.exec(t))) return done([cand('ensembl', u, { ensembl: u.replace(/\.\d+$/, '') }, 'High', 'Ensembl transcript/protein ID')]);
  // Device identifiers
  if ((m = /^(K\d{6,7})$/i.exec(t))) return done([cand('device', u, { deviceId: { kind: '510k', value: u } }, 'High', '510(k) number pattern (verify)')]);
  if ((m = /^(DEN\d{6,7})$/i.exec(t))) return done([cand('device', u, { deviceId: { kind: 'denovo', value: u } }, 'High', 'De Novo number pattern (verify)')]);
  if ((m = /^([PH]\d{6})(S\d{3})?$/i.exec(t))) return done([cand('device', u, { deviceId: { kind: u[0] === 'H' ? 'hde' : 'pma', value: m[1].toUpperCase(), supplement: m[2] ? m[2].toUpperCase() : null } }, 'High', (u[0] === 'H' ? 'HDE' : 'PMA') + ' number pattern (verify)')]);
  if ((m = /^\d{3}\.\d{4}$/.exec(t))) return done([cand('device', t, { deviceId: { kind: 'regulation', value: t } }, 'High', 'Regulation number (21 CFR) pattern')]);
  if ((m = /^(?:\(01\))?(\d{14})$/.exec(t))) return done([cand('device', m[1], { deviceId: { kind: 'udi', value: m[1] } }, 'Medium', 'UDI-DI (GS1 GTIN-14) pattern (verify)')]);
  // Numbers: PMID vs RxCUI
  if ((m = /^\d{1,9}$/.exec(t))) {
    var list = [cand('pmid', 'PMID ' + t, { pmid: t }, t.length >= 7 ? 'High' : 'Medium', 'Numeric: PubMed ID')];
    list.push(cand('rxcui', 'RxCUI ' + t, { rxcui: t }, 'Low', 'Numeric: could be an RxNorm concept ID'));
    return done(list);
  }
  if ((m = /^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/.exec(u)) && /^[A-Z0-9]+$/.test(t)) {
    c.push(cand('uniprot', u, { uniprot: u }, 'Medium', 'UniProt accession pattern'));
  }
  // Biomarkers
  if (BIOMARKERS[u]) return done([cand('concept', BIOMARKERS[u], { concept: BIOMARKERS[u], biomarker: true }, 'High', 'Tumor-agnostic biomarker concept')]);
  // LDT
  if (LDT_RE.test(t)) return done([cand('device', t, { deviceText: t.replace(LDT_RE, '').trim() || t, ldt: true }, 'Medium', 'Laboratory developed test concept: regulated differently from FDA-cleared/approved IVDs')]);
  // Variants: GENE + change / fusion / amplification / exon
  var tokens = t.replace(/[:_]/g, ' ').replace(/\s+/g, ' ').split(' ');
  if (tokens.length >= 2) {
    var g0 = normGene(tokens[0]);
    var rest = tokens.slice(1).join(' ');
    var pc = parseProteinChange(rest.replace(/^\(|\)$/g, ''));
    if (g0 && pc) return done([cand('variant', g0.symbol + ' ' + pc.label, { gene: g0.symbol, change: pc, alias: g0.alias }, g0.known ? 'High' : 'Medium', 'Gene + protein change' + (g0.alias ? ' (alias ' + g0.alias + ' → ' + g0.symbol + ')' : ''))]);
    if (g0 && /^(fusions?|rearrangements?|amplification|amp|overexpression|deletion|loss|mutations?|mutant|exon \d{1,2}( (deletion|insertion|skipping|mutation|del|ins))?|itd|tkd)$/i.test(rest)) {
      return done([cand('variant', g0.symbol + ' ' + rest, { gene: g0.symbol, change: null, variantText: rest, alias: g0.alias }, g0.known ? 'High' : 'Medium', 'Gene + variant class')]);
    }
  }
  if ((m = /^([A-Z0-9]{2,10})[-:]{1,2}([A-Z0-9]{2,10})( fusion)?$/i.exec(t)) && normGene(m[1].toUpperCase()) && normGene(m[2].toUpperCase()) && (GENES.has(m[1].toUpperCase()) || GENES.has(m[2].toUpperCase()))) {
    var g1 = m[1].toUpperCase(), g2 = m[2].toUpperCase();
    return done([cand('variant', g1 + '::' + g2 + ' fusion', { gene: GENES.has(g2) ? g2 : g1, partner: GENES.has(g2) ? g1 : g2, change: null, variantText: g1 + '-' + g2 + ' fusion', fusion: true }, 'Medium', 'Gene fusion pattern')]);
  }
  // Single-token gene
  if (tokens.length === 1 && !(c.length && c[0].type === 'uniprot')) {
    var g = normGene(t);
    if (g && g.known) c.unshift(cand('gene', g.symbol, { gene: g.symbol, alias: g.alias }, 'High', g.alias ? 'Alias ' + g.alias + ' → ' + g.symbol + ' (normalized by Oncotics)' : 'Known cancer gene symbol'));
    else if (g && !g.known) {
      if (/^[A-Z]{3}$/.test(t)) c.push(cand('device', t, { deviceId: { kind: 'productcode', value: t } }, 'Medium', 'Three-letter FDA device product code pattern (not a known cancer gene symbol)'));
      c.push(cand('gene', g.symbol, { gene: g.symbol }, 'Medium', 'Looks like a gene symbol'));
    }
    if (DISEASE_ABBR[u] && (u !== 'ALL' || t === 'ALL') && (u !== 'MM' || t === 'MM')) c.unshift(cand('disease', DISEASE_ABBR[u], { disease: DISEASE_ABBR[u], abbr: u }, 'High', 'Disease abbreviation ' + u));
  }
  // Drugs
  var low = t.toLowerCase();
  if (DRUG_BRANDS[low]) c.unshift(cand('drug', DRUG_BRANDS[low], { drug: DRUG_BRANDS[low], brand: t }, 'High', 'Brand name ' + t + ' → ' + DRUG_BRANDS[low]));
  else if (DRUGS.has(low)) c.unshift(cand('drug', low, { drug: low }, 'High', 'Known oncology drug name'));
  else if (/(mab|nib|lib|sib|tinib|ciclib|parib|rafenib|zomib|lisib|stat|platin|taxel|rubicin|mide|leucel|tecan|vedotin|deruxtecan|tansine|gene|cept)$/i.test(low.split(' ').pop()) && !DISEASE_RE.test(t)) c.push(cand('drug', low, { drug: low }, 'Medium', 'Drug-like name ending'));
  // Diseases
  if (DISEASE_RE.test(t) && !DEVICE_RE.test(t)) c.unshift(cand('disease', t, { disease: t }, 'High', 'Disease term'));
  // Devices & diagnostics (free text)
  if (DEVICE_RE.test(t)) {
    var geneHint = null; tokens.forEach(function (k) { var gg = normGene(k); if (gg && gg.known && !geneHint) geneHint = gg.symbol; });
    var drugHint = null; tokens.forEach(function (k) { var kl = k.toLowerCase(); if (!drugHint && (DRUGS.has(kl) || DRUG_BRANDS[kl])) drugHint = DRUG_BRANDS[kl] || kl; });
    c.unshift(cand('device', t, { deviceText: t, geneHint: geneHint, drugHint: drugHint }, 'High', 'Device / diagnostic term' + (geneHint ? ' (target ' + geneHint + ')' : '')));
  }
  if (!c.length) {
    var gh = null; tokens.forEach(function (k) { var gg = normGene(k); if (gg && gg.known && !gh) gh = gg.symbol; });
    c.push(cand('concept', t, { concept: t, geneHint: gh }, 'Low', 'Free-text concept'));
  }
  return done(c);

  function done(list) {
    // de-duplicate by type
    var seen = new Set(), out = [];
    list.forEach(function (x) { if (!seen.has(x.type)) { seen.add(x.type); out.push(x); } });
    var primary = out[0];
    primary.candidates = out;
    primary.raw = t;
    primary.ambiguous = out.length > 1 && out[1].confidence !== 'Low' && out[0].confidence !== 'High';
    return primary;
  }
}
