#!/usr/bin/env python3
"""Builds the static Oncotics site into ./public_html (Hostinger-ready)."""
import json, os, shutil, html

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), 'public_html')  # oncotics/public_html (Hostinger-ready)
BASE = 'https://oncotics.com'
UPDATED = '2026-10-03'
UPDATED_H = '3 October 2026'
YEAR = '2026'
LINKEDIN = 'https://www.linkedin.com/in/amit-suresh/'
WS = '/precision-oncology-workspace/'

def e(s): return html.escape(s, quote=True)

ICON = {
 'logo': '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="#14B8A6" stroke-width="2.5"/><path d="M10 9c6 3 6 11 12 14M22 9c-6 3-6 11-12 14" fill="none" stroke="#E7F0FA" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13h8M12 19h8" stroke="#14B8A6" stroke-width="2" stroke-linecap="round"/></svg>',
 'profile': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 2.1-3 3.5-3s2.7 1 3.5 3M14.5 10h4M14.5 14h3"/></svg>',
 'arrow': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 'ext': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
 'evidence': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l1 3h3v15H5V6h3z"/><path d="M9 13l2 2 4-4"/></svg>',
 'trial': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7 15h10"/></svg>',
 'pill': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 8.5l5 7"/></svg>',
 'device': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="12" rx="2"/><path d="M8 21h8M12 15v6M8 9h2l1-2 2 4 1-2h2"/></svg>',
 'dna': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M8 7h8M8 17h8"/></svg>',
 'book': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13"/></svg>',
 'shield': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
 'graph': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11l9.4-5M7.3 13l9.4 5"/></svg>',
 'award': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/></svg>',
 'globe': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
}

ORG_ID = BASE + '/#organization'
PERSON_ID = BASE + '/about/#amit-suresh'
SITE_ID = BASE + '/#website'
APP_ID = BASE + WS + '#app'

PERSON = {
  '@type': 'Person', '@id': PERSON_ID, 'name': 'Amit Suresh',
  'jobTitle': 'Creator and Architect, Oncotics',
  'description': 'Creator and Architect of Oncotics. IICA-certified Independent Director, Genetic Engineer with an MBA in Healthcare Management, and CFI Financial Modeling & Valuation Analyst (FMVA).',
  'image': BASE + '/assets/img/amit-suresh.jpg', 'url': BASE + '/about/', 'sameAs': [LINKEDIN],
  'worksFor': {'@id': ORG_ID},
  'knowsAbout': ['Genetic engineering', 'Precision oncology', 'Healthcare management', 'Corporate governance', 'Financial modeling and valuation'],
  'hasCredential': [
    {'@type': 'EducationalOccupationalCredential', 'name': 'Certified Independent Director', 'credentialCategory': 'Certification', 'recognizedBy': {'@type': 'Organization', 'name': 'Indian Institute of Corporate Affairs (IICA)'}},
    {'@type': 'EducationalOccupationalCredential', 'name': 'MBA in Healthcare Management', 'credentialCategory': 'Degree'},
    {'@type': 'EducationalOccupationalCredential', 'name': 'Financial Modeling & Valuation Analyst (FMVA)', 'credentialCategory': 'Certification', 'recognizedBy': {'@type': 'Organization', 'name': 'Corporate Finance Institute (CFI)'}}
  ],
  'hasOccupation': {'@type': 'Occupation', 'name': 'Genetic Engineer'}
}
ORG = {
  '@type': 'Organization', '@id': ORG_ID, 'name': 'Oncotics', 'url': BASE + '/', 'logo': BASE + '/assets/img/oncotics-logo-512.png',
  'description': 'Oncotics builds privacy-first precision oncology tools that bring public cancer genomics evidence, clinical trials, FDA drug and device data, biology and literature into one research workspace.',
  'founder': {'@id': PERSON_ID}, 'sameAs': [LINKEDIN],
  'contactPoint': {'@type': 'ContactPoint', 'contactType': 'general enquiries', 'url': LINKEDIN, 'availableLanguage': ['English']}
}
WEBSITE = {'@type': 'WebSite', '@id': SITE_ID, 'name': 'Oncotics', 'url': BASE + '/', 'inLanguage': 'en', 'publisher': {'@id': ORG_ID}}

def ld(graph): return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')) + '</script>'

def crumbs(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + u} for i, (n, u) in enumerate(items)]}

IMG = '/imaging/'
NAV = [('Home', '/'), ('Workspace', WS), ('Imaging', IMG), ('About', '/about/'), ('Contact', '/contact/')]

def header(active):
    cur = ' aria-current="page"'
    links = ''.join('<a href="' + u + '"' + (cur if active == u else '') + (' class="nav-home"' if u == '/' else '') + '>' + n + '</a>' for n, u in NAV)
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
  <a class="brand" href="/" aria-label="Oncotics home">{ICON['logo']}<span>Oncotics</span></a>
  <nav class="nav" aria-label="Main">{links}<a class="btn btn-primary" href="{WS}">Open Workspace</a></nav>
</div></header>'''

FOOTER = f'''<footer class="site-footer"><div class="wrap">
  <div class="foot-grid">
    <div><a class="brand" href="/">{ICON['logo']}<span>Oncotics</span></a>
      <p style="margin-top:12px">Privacy-first precision oncology tools. Live public evidence on genes, variants, trials, drugs, devices, diagnostics, biology and literature.</p></div>
    <div><h2>Explore</h2><ul><li><a href="{WS}">Precision Oncology Workspace</a></li><li><a href="{IMG}">Imaging Workbench</a></li><li><a href="/about/">About Oncotics</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy/">Privacy &amp; disclaimer</a></li></ul></div>
    <div><h2>Connect</h2><ul><li><a href="{LINKEDIN}" rel="noopener noreferrer me" target="_blank">Amit Suresh on LinkedIn<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="/llms.txt">llms.txt (for AI assistants)</a></li><li><a href="/sitemap.xml">Sitemap</a></li></ul></div>
  </div>
  <div class="legal">
    <p><strong>Educational and research use only. Not medical, regulatory, or procurement advice.</strong> Always verify with primary sources, current guidelines, regulators and qualified clinicians.</p>
    <p>Oncotics™ is a trademark of Oncotics. Oncotics™ is an independent interface and is not affiliated with or endorsed by the public data providers it links to unless expressly stated.</p>
    <p>© {YEAR} Oncotics™. All rights reserved.</p>
  </div>
</div></footer>'''

def page(path, title, desc, body, graph, active=None, og_type='website', og_image='/assets/img/og-oncotics.png', og_alt='Oncotics — privacy-first precision oncology workspace', extra_head=''):
    url = BASE + path
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}">
<link rel="alternate" hreflang="x-default" href="{url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="author" content="Amit Suresh">
<meta name="theme-color" content="#0B2545">
<meta name="color-scheme" content="light dark">
<meta property="og:site_name" content="Oncotics">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}{og_image}">
<meta property="og:image:alt" content="{e(og_alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{BASE}{og_image}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/assets/css/site.css?v={UPDATED}">
{extra_head}{ld(graph)}
</head>
<body>
{header(active or path)}
<main id="main" tabindex="-1">
{body}
</main>
{FOOTER}
</body>
</html>
'''

def faq_html(items):
    return '<div class="faq">' + ''.join(f'<details><summary>{e(q)}</summary><div class="a">{a}</div></details>' for q, a in items) + '</div>'

def faq_ld(items):
    import re
    strip = lambda s: re.sub(r'<[^>]+>', '', s).strip()
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': strip(a)}} for q, a in items]}

FLOW_SVG = '''<figure class="flow" style="margin:0"><svg viewBox="0 0 760 170" role="img" aria-labelledby="flow-t flow-d"><title id="flow-t">How a search travels</title><desc id="flow-d">Your browser sends each request directly to a public data provider such as ClinicalTrials.gov or openFDA, and the answer comes straight back to your browser. There is no Oncotics server in between and nothing is stored.</desc>
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
<rect x="8" y="40" width="210" height="84" rx="14" fill="none" stroke="#14B8A6" stroke-width="3"/><text x="113" y="76" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">Your browser</text><text x="113" y="100" text-anchor="middle" font-size="13" fill="currentColor">session held in memory only</text>
<rect x="542" y="40" width="210" height="84" rx="14" fill="none" stroke="currentColor" stroke-width="2"/><text x="647" y="76" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">Public data provider</text><text x="647" y="100" text-anchor="middle" font-size="13" fill="currentColor">CIViC · CT.gov · openFDA · EMBL-EBI…</text>
<line x1="224" y1="66" x2="534" y2="66" stroke="currentColor" stroke-width="2" marker-end="url(#ah)"/><text x="380" y="56" text-anchor="middle" font-size="13" fill="currentColor">request (HTTPS, no cookies, no referrer)</text>
<line x1="536" y1="100" x2="226" y2="100" stroke="currentColor" stroke-width="2" marker-end="url(#ah)"/><text x="380" y="122" text-anchor="middle" font-size="13" fill="currentColor">answer</text>
<text x="380" y="160" text-anchor="middle" font-size="14" font-weight="700" fill="#BE123C">No Oncotics server in the middle. Nothing is stored.</text></svg></figure>'''

SOURCES = [
 ('CIViC', 'https://civicdb.org', 'curated clinical evidence for cancer variants'),
 ('ClinicalTrials.gov', 'https://clinicaltrials.gov', 'registered clinical studies (U.S. National Library of Medicine)'),
 ('openFDA', 'https://open.fda.gov', 'FDA drug labels, approvals, adverse events, recalls, and device 510(k), De Novo, PMA, classification, UDI, MAUDE and recall records'),
 ('RxNorm', 'https://www.nlm.nih.gov/research/umls/rxnorm/', 'drug name normalization'),
 ('Ensembl', 'https://www.ensembl.org', 'genome annotation and variant effect prediction (VEP)'),
 ('MyGene.info and MyVariant.info', 'https://mygene.info', 'aggregated gene and variant annotation, including ClinVar and dbSNP fields'),
 ('UniProt', 'https://www.uniprot.org', 'protein function, domains and structures'),
 ('Reactome, STRING and AlphaFold DB', 'https://reactome.org', 'pathways, protein interactions and predicted structures'),
 ('Open Targets and cBioPortal', 'https://platform.opentargets.org', 'target–disease associations and cancer cohort mutation frequencies'),
 ('GWAS Catalog, ChEMBL, PubChem and EBI OLS', 'https://www.ebi.ac.uk', 'variant–trait associations, compound data and ontologies'),
 ('Europe PMC', 'https://europepmc.org', 'biomedical literature, abstracts and open-access links'),
]

# ---------------------------------------------------------------- HOME
HOME_FAQ = [
 ('What is Oncotics?', '<p>Oncotics is a free, privacy-first precision oncology research workspace at oncotics.com. You type a gene, variant, drug, device, diagnostic, disease or trial ID, and Oncotics shows live public evidence about it — clinical evidence, trials, FDA drug and device records, biology and literature — in one place, with the source of every fact.</p>'),
 ('Who is Oncotics for?', '<p>Cancer researchers, clinicians preparing for qualified review, bioinformaticians, oncology pharmacists, clinical trial navigators, regulatory affairs and laboratory medicine teams, biomedical students and anyone learning precision oncology.</p>'),
 ('Is Oncotics free? Do I need an account?', '<p>Yes, it is free, and no account is needed. Open the <a href="' + WS + '">Precision Oncology Workspace</a> and start searching.</p>'),
 ('Does Oncotics store my searches?', '<p>No. Oncotics has no backend, database, cookies, browser storage or analytics. Your browser sends each request directly to the public data provider, and everything is cleared when you refresh the page or press Clear Session. Each provider may log requests under its own policy.</p>'),
 ('Where does the data come from?', '<p>From public, documented sources including CIViC, ClinicalTrials.gov, openFDA, RxNorm, Ensembl, MyGene.info, MyVariant.info, UniProt, Reactome, STRING, AlphaFold DB, Open Targets, cBioPortal, the GWAS Catalog, ChEMBL, PubChem, EBI OLS and Europe PMC. Sources that cannot be queried safely from a browser are offered as clearly labeled official links.</p>'),
 ('Can Oncotics tell me which treatment or trial is right for a patient?', '<p>No. Oncotics is for education and research. It does not diagnose, recommend treatments or dosing, or decide trial eligibility. Confirm everything with current guidelines, trial sponsors, regulators and qualified clinicians.</p>'),
 ('What is the difference between FDA clearance and FDA approval for devices?', '<p>A 510(k) is a clearance based on substantial equivalence, and a De Novo is a classification for novel lower-risk devices. A PMA is an approval for higher-risk devices. Oncotics labels each record with its correct pathway and never calls a 510(k) “approved”.</p>'),
 ('Can I search for companion diagnostics?', '<p>Yes. Open a targeted therapy and choose “Find companion diagnostics”. Oncotics shows statements from the drug label and device records that name the drug, each with a confidence label, next to the FDA’s official companion-diagnostics list, which remains the authoritative source.</p>'),
 ('What kinds of queries does it understand?', '<p>Gene symbols (EGFR), variants (BRAF V600E), rsIDs (rs113488022), HGVS (NM_004333.6:c.1799T&gt;A), drugs and brands (osimertinib, Tagrisso), diseases (melanoma), trial IDs (NCT02296125), PMIDs, DOIs, UniProt and Ensembl IDs, 510(k), De Novo and PMA numbers, FDA product codes, regulation numbers and UDI-DIs.</p>'),
 ('Can I upload medical images?', '<p>Only on the separate <a href="' + IMG + '">Oncotics Imaging Workbench</a>, after a consent step. Images are read in your browser memory, are never uploaded to or stored by Oncotics, and are wiped on refresh or Clear Session. Experimental AI inference there is opt-in, never automatic and not a diagnosis.</p>'),
 ('Does Oncotics give vaccine or fertility advice?', '<p>No. The Vaccines &amp; Cancer Immunization and Onco-Fertility modules organize public evidence and official link-outs. They do not give vaccination, schedule, fertility, pregnancy, contraception or genetic-counseling advice.</p>'),
 ('What is the interpretation confidence score?', '<p>A heuristic 0–100 query-routing score showing how strongly Oncotics believes your query is, for example, a variant rather than a gene. It is not a probability and not a clinical certainty score.</p>'),
 ('Should I enter patient information?', '<p>No. Do not enter names, dates of birth, record numbers, device serial or lot numbers tied to a patient, genomic files or clinical notes. The workspace rejects inputs that look like personal health information.</p>'),
]
home_body = f'''
<div class="hero"><div class="wrap">
  <span class="eyebrow">Precision oncology · Live public evidence</span>
  <h1>Every piece of public cancer evidence, in one private workspace.</h1>
  <p class="lead">Oncotics brings live clinical evidence, clinical trials, FDA drug and device records, gene and protein biology, and literature together for any gene, variant, drug, device, diagnostic, disease or trial — without ever storing what you search.</p>
  <div class="actions"><a class="btn btn-primary" href="{WS}">Open the free Workspace {ICON['arrow']}</a><a class="btn btn-ghost" href="#how-it-works">See how it works</a></div>
  <ul class="trust" aria-label="Key facts"><li>Free · no sign-up</li><li>No cookies or tracking</li><li>Searches never stored</li><li>19 live public sources + verified-on-request extras</li><li>Every fact shows its source</li><li>Every query interpretation scored</li></ul>
</div></div>

<section id="what" aria-labelledby="what-h"><div class="wrap">
  <div class="section-head"><span class="kicker">What Oncotics does</span><h2 id="what-h">What is Oncotics?</h2></div>
  <div class="answer"><p><strong>Oncotics is a free, privacy-first precision oncology workspace.</strong> Type a gene, variant, drug, device, diagnostic, disease or trial ID and Oncotics works out what it is, asks the right public databases directly from your browser, and connects the answers: curated evidence, trials, FDA labels, approvals, safety signals, device clearances and approvals, companion diagnostics, protein biology and papers. Each result carries its source, retrieval time and a link to the official record.</p></div>
  <div class="grid" style="margin-top:28px">
    <article class="card"><span class="ico">{ICON['evidence']}</span><h3>Clinical evidence</h3><p>Curated variant–drug–disease evidence and clinical assertions with evidence levels, AMP/ASCO/CAP tiers and citations.</p><p class="src">Source: CIViC</p></article>
    <article class="card"><span class="ico">{ICON['trial']}</span><h3>Clinical trials</h3><p>Search by gene, variant, drug, device or condition; filter by status, phase, age and location; read full study details.</p><p class="src">Source: ClinicalTrials.gov</p></article>
    <article class="card"><span class="ico">{ICON['pill']}</span><h3>Drug intelligence</h3><p>FDA labels, Drugs@FDA approval history, FAERS adverse-event summaries, enforcement reports, RxNorm names and chemistry.</p><p class="src">Sources: openFDA, RxNorm, ChEMBL, PubChem</p></article>
    <article class="card"><span class="ico">{ICON['device']}</span><h3>Devices &amp; diagnostics</h3><p>510(k), De Novo and PMA records, classification, UDI, MAUDE events, recalls and companion-diagnostic links — with clearance and approval kept distinct.</p><p class="src">Source: openFDA device endpoints (may lag official FDA databases)</p></article>
    <article class="card"><span class="ico">{ICON['dna']}</span><h3>Biology</h3><p>Gene and variant annotation, variant effect prediction, protein function, pathways, interactions, structures, cancer mutation frequency, target validation and GWAS.</p><p class="src">Sources: Ensembl, MyGene, MyVariant, UniProt, Reactome, STRING, AlphaFold, Open Targets, cBioPortal, GWAS Catalog</p></article>
    <article class="card"><span class="ico">{ICON['shield']}</span><h3>Vaccines &amp; cancer immunization</h3><p>Preventive cancer vaccines (HPV, hepatitis B), therapeutic cancer vaccines, antigens, vaccine trials, labels and official public-health link-outs. No vaccine advice, schedules or safety rankings.</p><p class="src">Sources: ClinicalTrials.gov, openFDA, Europe PMC, FDA CBER, CDC, WHO</p></article>
    <article class="card"><span class="ico">{ICON['award']}</span><h3>Onco-Fertility &amp; survivorship</h3><p>Label reproductive-health sections, reproductive adverse-event terms, fertility-preservation trials, ART device records and guideline link-outs. No fertility, pregnancy or genetic-counseling advice.</p><p class="src">Sources: openFDA, ClinicalTrials.gov, Europe PMC, NCI, ASCO, ESHRE, ASRM, LactMed</p></article>
    <article class="card"><span class="ico">{ICON['globe']}</span><h3>Interpretation, globe &amp; molecular map</h3><p>Every plausible reading of your query with a heuristic confidence score; a 3D globe of public trial and recall locations; and a molecular context map of genes, proteins, drugs, trials and papers.</p><p class="src">Built in your browser from loaded public records</p></article>
    <article class="card"><span class="ico">{ICON['device']}</span><h3>Imaging Workbench</h3><p>A separate page for viewing DICOM and images with the OHIF Viewer or the Oncotics Inspector, measuring, annotating and — only if you choose — running experimental AI with your own model. Images stay in browser memory.</p><p class="src"><a href="{IMG}">Open the Imaging Workbench</a></p></article>
    <article class="card"><span class="ico">{ICON['book']}</span><h3>Literature</h3><p>Relevant papers with abstracts, open-access links and citation counts, filterable by year, reviews and open access.</p><p class="src">Source: Europe PMC</p></article>
  </div>
</div></section>

<section class="alt" id="who" aria-labelledby="who-h"><div class="wrap">
  <div class="section-head"><span class="kicker">Who benefits</span><h2 id="who-h">Who benefits from Oncotics, and how?</h2><p>Anyone who needs a fast, sourced overview of public precision oncology evidence — without jumping between a dozen websites or handing over their search history.</p></div>
  <div class="table-wrap"><table>
    <caption>How different people use Oncotics</caption>
    <thead><tr><th scope="col">Who</th><th scope="col">How Oncotics helps</th></tr></thead>
    <tbody>
      <tr><th scope="row">Cancer researchers</th><td>See evidence, trials, biology and papers for a gene or variant on one screen, with sources to cite.</td></tr>
      <tr><th scope="row">Clinicians (for qualified review)</th><td>Gather the published evidence, labels and open trials behind a biomarker before discussing it with colleagues — never as a treatment decision.</td></tr>
      <tr><th scope="row">Bioinformaticians</th><td>Check variant consequences across Ensembl VEP and MyVariant, with transcript-level detail and conflicts shown side by side.</td></tr>
      <tr><th scope="row">Oncology pharmacists</th><td>Review FDA label sections, approval history, adverse-event summaries and recalls for a drug in minutes.</td></tr>
      <tr><th scope="row">Clinical trial navigators</th><td>Filter trials by biomarker, status, phase, age and location, and open full study records.</td></tr>
      <tr><th scope="row">Regulatory affairs &amp; laboratory medicine</th><td>Look up 510(k), De Novo and PMA records, product codes, UDI, MAUDE and recalls, and possible companion-diagnostic links.</td></tr>
      <tr><th scope="row">Students &amp; educators</th><td>Learn how genes, variants, drugs, trials and diagnostics connect, using real public data.</td></tr>
    </tbody>
  </table></div>
</div></section>

<section id="how-it-works" aria-labelledby="how-h"><div class="wrap">
  <div class="section-head"><span class="kicker">How it works</span><h2 id="how-h">How does Oncotics work?</h2></div>
  <ol class="steps">
    <li><h3>Type anything</h3><p>A gene, variant, rsID, HGVS, drug or brand, disease, trial ID, PMID, device number, product code or UDI-DI.</p></li>
    <li><h3>Oncotics interprets it</h3><p>It lists every plausible interpretation with a heuristic 0–100 confidence score and the signals behind it, and asks you to choose when a query is ambiguous. It never guesses silently.</p></li>
    <li><h3>Your browser asks the sources</h3><p>A small set of live public sources is queried first, directly from your browser. Deeper sources load when you open them.</p></li>
    <li><h3>Explore connected evidence</h3><p>Move from gene to variant to evidence, therapy, trial, FDA record, device and paper. Compare, pin and export — all in memory.</p></li>
  </ol>
  <div style="margin-top:32px">{FLOW_SVG}</div>
</div></section>

<section class="alt" id="when" aria-labelledby="when-h"><div class="wrap grid-2">
  <div><span class="kicker">When to use it</span><h2 id="when-h">When is Oncotics useful?</h2>
    <ul class="checklist">
      <li>Starting a literature review or grant background on a gene or biomarker.</li>
      <li>Checking which trials mention a variant such as KRAS G12C, and which are recruiting.</li>
      <li>Reviewing a drug’s current FDA label, approvals and reported adverse events.</li>
      <li>Confirming whether a diagnostic is FDA-cleared (510(k)), De Novo, or approved (PMA).</li>
      <li>Looking up an rsID or HGVS notation and its predicted consequence.</li>
      <li>Teaching precision oncology with real, sourced examples.</li>
    </ul></div>
  <div><span class="kicker">Why Oncotics</span><h2>Why was Oncotics built?</h2>
    <p>Precision oncology evidence is spread across many public databases, each with its own search, identifiers and caveats. Oncotics connects them in one place while staying honest: live data is labeled live, links are labeled links, fuzzy matches are never shown as exact, and every record points back to its official source.</p>
    <p>It is private because health-related searches are sensitive. There is no server to collect them.</p></div>
</div></section>

<section id="where" aria-labelledby="where-h"><div class="wrap">
  <div class="section-head"><span class="kicker">Where</span><h2 id="where-h">Where does the data come from, and where does Oncotics run?</h2>
    <p>Oncotics runs in your web browser on any device — desktop, tablet or phone — at <a href="{WS}">oncotics.com{WS}</a>. The data comes directly from these public providers:</p></div>
  <ul class="grid" style="list-style:none;padding:0">{''.join(f'<li class="card"><h3 style="margin-top:0"><a href="{u}" rel="noopener noreferrer" target="_blank">{e(n)}<span class="sr-only"> (opens in a new tab)</span></a></h3><p>{e(d)}</p></li>' for n, u, d in SOURCES)}</ul>
  <p class="meta-line" style="margin-top:18px">Worldwide trial registries and regulators — WHO ICTRP, EU CTIS, ISRCTN, ANZCTR, CTRI, EMA, MHRA, PMDA, NMPA, TGA, Health Canada and CDSCO — are available as labeled official links from the Workspace’s Global Coverage panel.</p>
</div></section>

<section class="alt" id="privacy" aria-labelledby="priv-h"><div class="wrap grid-2">
  <div><span class="kicker">Privacy by design</span><h2 id="priv-h">What happens to my searches?</h2>
    <ul class="checklist"><li>No account, cookies, browser storage, analytics or tracking pixels.</li><li>No Oncotics server: requests go straight from your browser to the provider.</li><li>Nothing is saved; refresh or Clear Session wipes everything.</li><li>Exports are created on your device and never uploaded.</li><li>Inputs that look like patient information are rejected.</li></ul>
    <p><a href="/privacy/">Read the full privacy statement</a></p></div>
  <div><span class="kicker">What Oncotics is not</span><h2>Responsible by default</h2>
    <div class="notice"><p><strong>Educational and research use only.</strong> Oncotics does not diagnose, recommend treatments or dosing, determine trial eligibility, or give regulatory or procurement advice.</p><p style="margin:0">Computational predictions are not diagnoses, adverse-event reports do not prove causality, and openFDA device records may lag official FDA databases.</p></div></div>
</div></section>

<section id="faq" aria-labelledby="faq-h"><div class="wrap">
  <div class="section-head"><span class="kicker">FAQ</span><h2 id="faq-h">Frequently asked questions</h2></div>
  {faq_html(HOME_FAQ)}
</div></section>

<section style="padding-top:0"><div class="wrap"><div class="cta-band">
  <div><h2>Start exploring in seconds</h2><p>Free, private and sourced. No sign-up.</p></div>
  <a class="btn btn-primary" href="{WS}">Open the Workspace {ICON['arrow']}</a>
</div><p class="meta-line" style="margin-top:16px">Last updated {UPDATED_H}. Created by <a href="/about/">Amit Suresh</a>.</p></div></section>
'''
home_graph = [ORG, WEBSITE, PERSON,
  {'@type': 'WebPage', '@id': BASE + '/#webpage', 'url': BASE + '/', 'name': 'Oncotics — Privacy-First Precision Oncology Workspace', 'isPartOf': {'@id': SITE_ID}, 'about': {'@id': APP_ID}, 'inLanguage': 'en', 'dateModified': UPDATED, 'author': {'@id': PERSON_ID}, 'publisher': {'@id': ORG_ID},
   'speakable': {'@type': 'SpeakableSpecification', 'cssSelector': ['.answer', '#faq summary']}},
  {'@type': 'SoftwareApplication', '@id': APP_ID, 'name': 'Oncotics Precision Oncology Workspace', 'url': BASE + WS, 'applicationCategory': 'HealthApplication', 'operatingSystem': 'Any modern web browser', 'isAccessibleForFree': True,
   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'creator': {'@id': PERSON_ID}, 'publisher': {'@id': ORG_ID},
   'description': 'Free, privacy-first research workspace for cancer genes, variants, clinical evidence, clinical trials, FDA drug and device data, diagnostics, biology and literature. Educational and research use only.',
   'featureList': ['CIViC clinical evidence', 'ClinicalTrials.gov search', 'openFDA drug labels, approvals, adverse events and enforcement', 'openFDA device 510(k), De Novo, PMA, classification, UDI, MAUDE and recalls', 'Companion diagnostic discovery with confidence labels', 'Gene, variant and protein biology', 'Europe PMC literature', 'No data storage; runs in the browser']},
  faq_ld(HOME_FAQ), crumbs([('Home', '/')])]

# ---------------------------------------------------------------- ABOUT
CREDS = [
 ('IICA-certified Independent Director', 'Certified by the Indian Institute of Corporate Affairs (IICA)'),
 ('Genetic Engineer', 'Trained in genetic engineering'),
 ('MBA in Healthcare Management', 'Management training focused on healthcare'),
 ('CFI FMVA', 'Financial Modeling &amp; Valuation Analyst, Corporate Finance Institute (CFI)'),
]
check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
about_body = f'''
<div class="hero page-hero"><div class="wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">About</li></ol></nav>
  <h1>About Oncotics</h1>
  <p class="lead">Oncotics builds honest, private tools that make public precision oncology evidence easier to find, connect and verify.</p>
</div></div>

<section aria-labelledby="mission-h"><div class="wrap grid-2">
  <div><span class="kicker">Our mission</span><h2 id="mission-h">What is Oncotics’ mission?</h2>
    <div class="answer"><p>To give everyone working in or learning about cancer a single, trustworthy place to explore public evidence on genes, variants, drugs, devices, diagnostics and trials — with every fact traceable to its source and no search ever stored.</p></div></div>
  <div><span class="kicker">Principles</span><h2>How Oncotics is built</h2>
    <ul class="checklist">
      <li><strong>Honest.</strong> Live data is labeled live; links are labeled links; possible matches are never shown as exact.</li>
      <li><strong>Private.</strong> No backend, cookies, storage or analytics. Your browser talks to the sources directly.</li>
      <li><strong>Transparent.</strong> Every record shows its source, retrieval time and official link.</li>
      <li><strong>Responsible.</strong> Clear boundaries: no diagnosis, treatment, eligibility, regulatory or procurement advice.</li>
      <li><strong>Accessible.</strong> Keyboard-friendly, screen-reader aware, mobile-ready, light and dark modes.</li>
    </ul></div>
</div></section>

<section class="alt" id="amit-suresh" aria-labelledby="founder-h"><div class="wrap">
  <div class="founder">
    <figure><picture><source srcset="/assets/img/amit-suresh.webp" type="image/webp"><img src="/assets/img/amit-suresh.jpg" width="400" height="400" alt="Portrait of Amit Suresh, Creator and Architect of Oncotics" loading="lazy" decoding="async"></picture></figure>
    <div>
      <span class="kicker">Creator and Architect</span>
      <h2 id="founder-h">Amit Suresh</h2>
      <p class="role">Creator and Architect, Oncotics</p>
      <p>Amit Suresh created and architected Oncotics and the Oncotics Precision Oncology Workspace. He brings together training in genetic engineering, healthcare management, corporate governance and financial analysis.</p>
      <h3>Qualifications</h3>
      <ul class="creds">{''.join(f'<li>{check}<div><strong>{t}</strong><span>{d}</span></div></li>' for t, d in CREDS)}</ul>
      <a class="btn btn-li" href="{LINKEDIN}" target="_blank" rel="noopener noreferrer me">{ICON['profile']}Connect with Amit on LinkedIn<span class="sr-only"> (opens in a new tab)</span></a>
    </div>
  </div>
</div></section>

<section aria-labelledby="what2-h"><div class="wrap">
  <div class="section-head"><span class="kicker">The product</span><h2 id="what2-h">What has Oncotics built?</h2><p>The <a href="{WS}">Oncotics Precision Oncology Workspace</a>: a free browser workspace connecting 19 live public sources across clinical evidence, trials, drugs, devices and diagnostics, biology and literature, plus official links to worldwide registries and regulators.</p></div>
  <div class="cta-band"><div><h2>See it for yourself</h2><p>No sign-up. Nothing stored.</p></div><a class="btn btn-primary" href="{WS}">Open the Workspace {ICON['arrow']}</a></div>
</div></section>
'''
about_graph = [ORG, WEBSITE, PERSON,
  {'@type': 'AboutPage', '@id': BASE + '/about/#webpage', 'url': BASE + '/about/', 'name': 'About Oncotics', 'isPartOf': {'@id': SITE_ID}, 'about': {'@id': ORG_ID}, 'mainEntity': {'@id': PERSON_ID}, 'dateModified': UPDATED, 'inLanguage': 'en'},
  crumbs([('Home', '/'), ('About', '/about/')])]

# ---------------------------------------------------------------- CONTACT
CONTACT_FAQ = [
 ('How do I contact Oncotics?', '<p>Send a message to Amit Suresh, Creator and Architect of Oncotics, on LinkedIn: <a href="' + LINKEDIN + '" rel="noopener noreferrer" target="_blank">linkedin.com/in/amit-suresh</a>.</p>'),
 ('Can I send patient details for advice?', '<p>No. Oncotics does not provide medical advice and cannot receive personal health information. Please do not send names, dates of birth, record numbers, reports or images about a patient.</p>'),
 ('Can I suggest a data source or report a problem?', '<p>Yes. Suggestions for new public sources, broken links, data discrepancies and accessibility issues are welcome via LinkedIn.</p>'),
]
contact_body = f'''
<div class="hero page-hero"><div class="wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Contact</li></ol></nav>
  <h1>Contact Oncotics</h1>
  <p class="lead">The best way to reach Oncotics is a LinkedIn message to Amit Suresh, Creator and Architect.</p>
  <div class="actions"><a class="btn btn-li" href="{LINKEDIN}" target="_blank" rel="noopener noreferrer me">{ICON['profile']}Message Amit on LinkedIn<span class="sr-only"> (opens in a new tab)</span></a></div>
</div></div>

<section aria-labelledby="topics-h"><div class="wrap grid-2">
  <div class="contact-card"><span class="kicker">Get in touch about</span><h2 id="topics-h">What can I contact Oncotics about?</h2>
    <ul class="checklist"><li>Feedback on the Precision Oncology Workspace</li><li>Suggestions for new public data sources</li><li>Data discrepancies or broken official links</li><li>Accessibility issues</li><li>Research, education or institutional collaboration</li></ul>
    <a class="btn btn-li" href="{LINKEDIN}" target="_blank" rel="noopener noreferrer me">{ICON['profile']}Connect on LinkedIn<span class="sr-only"> (opens in a new tab)</span></a></div>
  <div><span class="kicker">Please note</span><h2>Before you write</h2>
    <div class="notice"><p><strong>Do not send patient information.</strong> Oncotics cannot give medical advice and does not accept names, dates of birth, record numbers, test reports, images or device serial numbers tied to a person.</p><p style="margin:0">For a medical question, speak with a qualified clinician.</p></div></div>
</div></section>

<section class="alt" aria-labelledby="cfaq-h"><div class="wrap"><div class="section-head"><h2 id="cfaq-h">Contact FAQ</h2></div>{faq_html(CONTACT_FAQ)}</div></section>
'''
contact_graph = [ORG, WEBSITE, PERSON,
  {'@type': 'ContactPage', '@id': BASE + '/contact/#webpage', 'url': BASE + '/contact/', 'name': 'Contact Oncotics', 'isPartOf': {'@id': SITE_ID}, 'about': {'@id': ORG_ID}, 'dateModified': UPDATED, 'inLanguage': 'en'},
  faq_ld(CONTACT_FAQ), crumbs([('Home', '/'), ('Contact', '/contact/')])]

# ---------------------------------------------------------------- PRIVACY
privacy_body = f'''
<div class="hero page-hero"><div class="wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Privacy &amp; disclaimer</li></ol></nav>
  <h1>Privacy &amp; disclaimer</h1>
  <p class="lead">Oncotics does not collect, store or analyze your searches.</p>
  <p class="meta-line">Effective {UPDATED_H}</p>
</div></div>
<section aria-labelledby="p1"><div class="wrap" style="max-width:880px">
  <h2 id="p1">Privacy statement</h2>
  <div class="answer"><p><strong>Oncotics Privacy:</strong> your searches are sent directly from your browser to selected public data providers and are not stored by Oncotics.</p></div>
  <ul class="checklist" style="margin-top:22px">
    <li>No account is required.</li>
    <li>This website and the Workspace set no cookies and use no browser storage (localStorage, sessionStorage or IndexedDB), no service workers, analytics, tracking pixels, heatmaps or session replay.</li>
    <li>Oncotics runs no backend, proxy, database or logging service for the Workspace. Session data lives only in your browser’s memory and is cleared on refresh or Clear Session.</li>
    <li>Requests are sent directly to public providers such as CIViC, ClinicalTrials.gov, openFDA, EMBL-EBI services, RxNorm and others. Each provider may log requests according to its own policy.</li>
    <li>Link-out sources open directly in your browser; some may be in languages other than English.</li>
    <li>Exports (JSON, CSV, print) are generated on your device and are never uploaded. File names never contain your search terms.</li>
    <li>An optional openFDA API key, if you enter one, is kept only in memory for the session. Keys used in a browser are not secrets.</li>
    <li>Your web host may keep standard server access logs for this website’s pages (for example IP address and page requested) for security and operations; Oncotics does not use them to profile visitors. Workspace searches are not sent to this server.</li>
  </ul>
  <h2 style="margin-top:36px">Imaging Workbench and Geographic Activity Globe</h2>
  <div class="answer"><p><strong>Imaging Privacy:</strong> uploaded images and inference results are kept only in your browser memory. Oncotics does not store, upload, log, or train on your images.</p></div>
  <ul class="checklist" style="margin-top:14px">
    <li>The <a href="/imaging/">Imaging Workbench</a> is a separate page. DICOM and image files are read in browser memory after you consent; DICOMweb endpoints and tokens you enter stay in memory; STOW-RS upload is off by default.</li>
    <li>DICOM files and images may contain protected health information, including burned-in text. De-identify data where possible. Patient name, ID, dates, institution and accession are hidden by default and never exported.</li>
    <li>Experimental AI detection/inference runs only after you load a model, review its model card and press Run. If you choose a remote endpoint, the image goes directly from your browser to that provider, which may log or store it.</li>
    <li><strong>Globe Privacy:</strong> locations shown are derived only from public records in memory. Oncotics does not use your device location and does not store globe state. Optional external map imagery is off by default and, if enabled, sends tile requests to a third-party provider.</li>
  </ul>
  <h2 style="margin-top:36px">Do not enter personal health information</h2>
  <p>Do not enter patient identifiers, names, dates of birth, medical record numbers, raw genomic files (VCF, FASTQ, BAM), family medical records, device serial or implant lot numbers tied to a patient, or free-text clinical notes. The Workspace rejects inputs that look like this.</p>
  <h2 style="margin-top:36px">Medical, regulatory and procurement disclaimer</h2>
  <ul>
    <li>This tool is provided for educational and research purposes only. Do not use it for direct patient treatment decisions without qualified clinical review.</li>
    <li>Trial information, FDA label and device data, genomic annotations, variant predictions, literature, pathway, interaction, target validation and cancer genomics data may change and may be incomplete.</li>
    <li>Computational predictions are not clinical diagnoses. Trial listings do not determine eligibility. Adverse event and MAUDE reports are voluntary and do not prove causality.</li>
    <li>Device clearance (510(k)/De Novo) is not approval (PMA/HDE/CDH). openFDA device data may lag the official FDA record; the official FDA database and your institution’s process are authoritative. Recalls require institutional action; Oncotics surfaces records only.</li>
    <li>Companion-diagnostic links are derived from label and device text and may be incomplete; the FDA companion-diagnostics list and current drug label are authoritative. LDTs are regulated differently from FDA-cleared or approved IVDs.</li>
    <li>Target validation signals are research evidence, not treatment recommendations.</li>
  </ul>
  <h2 style="margin-top:36px">Legal</h2>
  <ul>
    <li>© {YEAR} Oncotics™. All rights reserved.</li>
    <li>Oncotics™ is a trademark of Oncotics.</li>
    <li>Oncotics™ is a trademark of Oncotics. This tool is provided for educational, research, and clinical-information-discovery purposes only. It does not provide medical, oncological, reproductive, vaccination, radiological diagnostic, regulatory, genetic counseling, or procurement advice.</li>
    <li>Oncotics™ is not responsible for clinical decisions made using this interface. The Oncotics™ Imaging Workbench is not a radiology diagnostic system, PACS or FDA-cleared software.</li>
    <li>ClinicalTrials.gov data is provided by the U.S. National Library of Medicine. openFDA data is provided by the U.S. Food and Drug Administration. CIViC data is provided by the CIViC project. Ensembl, Europe PMC and other EMBL-EBI data are provided by EMBL-EBI. UniProt data is provided by the UniProt consortium. RxNorm data is provided by the National Library of Medicine. MyGene.info and MyVariant.info data are provided by their respective services.</li>
    <li>Oncotics™ is an independent interface and is not affiliated with or endorsed by these providers unless expressly stated.</li>
  </ul>
  <p style="margin-top:28px">Questions? <a href="/contact/">Contact Oncotics</a>.</p>
</div></section>
'''
privacy_graph = [ORG, WEBSITE, {'@type': 'WebPage', '@id': BASE + '/privacy/#webpage', 'url': BASE + '/privacy/', 'name': 'Privacy & disclaimer — Oncotics', 'isPartOf': {'@id': SITE_ID}, 'dateModified': UPDATED, 'inLanguage': 'en'}, crumbs([('Home', '/'), ('Privacy & disclaimer', '/privacy/')])]

nf_body = f'''<div class="hero page-hero"><div class="wrap"><h1>Page not found</h1><p class="lead">The page you were looking for isn’t here. It may have moved.</p>
<div class="actions"><a class="btn btn-primary" href="/">Go to the home page</a><a class="btn btn-ghost" href="{WS}">Open the Workspace</a></div></div></div>'''

PAGES = [
 ('/', 'index.html', 'Oncotics — Free, Private Precision Oncology Workspace',
  'Free, privacy-first precision oncology workspace: live cancer evidence, clinical trials, FDA drug and device data, diagnostics, biology and literature.', home_body, home_graph),
 ('/about/', 'about/index.html', 'About Oncotics — Created by Amit Suresh, Creator and Architect',
  'Meet Amit Suresh, Creator and Architect of Oncotics: IICA-certified Independent Director, Genetic Engineer, MBA in Healthcare Management and CFI FMVA.', about_body, about_graph),
 ('/contact/', 'contact/index.html', 'Contact Oncotics — Message Amit Suresh on LinkedIn',
  'Contact Oncotics on LinkedIn. Message Amit Suresh, Creator and Architect, about feedback, data sources or collaboration. Please do not send patient data.', contact_body, contact_graph),
 ('/privacy/', 'privacy/index.html', 'Privacy & Disclaimer — Oncotics',
  'Oncotics does not collect or store searches: no cookies, browser storage, analytics or backend. Read the privacy statement and medical disclaimer.', privacy_body, privacy_graph),
]

def build():
    # Rebuild generated files but keep deploy-time vendor assets (self-hosted OHIF, globe, inference runtime).
    KEEP = {os.path.join('assets', 'ohif'), os.path.join('assets', 'globe'), os.path.join('assets', 'ort')}
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        fp = os.path.join(OUT, name)
        if name == 'assets':
            for sub in os.listdir(fp):
                if os.path.join('assets', sub) in KEEP: continue
                sp = os.path.join(fp, sub)
                shutil.rmtree(sp) if os.path.isdir(sp) else os.remove(sp)
            continue
        shutil.rmtree(fp) if os.path.isdir(fp) else os.remove(fp)
    for path, fname, title, desc, body, graph in PAGES:
        fp = os.path.join(OUT, fname); os.makedirs(os.path.dirname(fp), exist_ok=True)
        extra = ''
        og_type = 'profile' if path == '/about/' else 'website'
        og_img = '/assets/img/og-amit-suresh.jpg' if path == '/about/' else '/assets/img/og-oncotics.png'
        og_alt = 'Amit Suresh, Creator and Architect of Oncotics' if path == '/about/' else 'Oncotics — privacy-first precision oncology workspace'
        if path == '/about/': extra = '<meta property="profile:first_name" content="Amit">\n<meta property="profile:last_name" content="Suresh">\n'
        open(fp, 'w').write(page(path, title, desc, body, graph, og_type=og_type, og_image=og_img, og_alt=og_alt, extra_head=extra))
    nf = page('/404.html', 'Page not found — Oncotics', 'This page could not be found on oncotics.com.', nf_body, [WEBSITE], active='none')
    nf = nf.replace('<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">', '<meta name="robots" content="noindex, follow">')
    open(os.path.join(OUT, '404.html'), 'w').write(nf)
    os.makedirs(os.path.join(OUT, 'assets/css'), exist_ok=True)
    shutil.copy(os.path.join(ROOT, 'src/site.css'), os.path.join(OUT, 'assets/css/site.css'))
    return [p[0] for p in PAGES]

if __name__ == '__main__':
    print(build())
