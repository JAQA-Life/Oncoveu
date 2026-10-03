#!/usr/bin/env python3
"""Generates images, icons, SEO/GEO files, .htaccess and the integrated Workspace page."""
import os, re, json, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), 'public_html')  # oncotics/public_html (Hostinger-ready)
IMG = os.path.join(OUT, 'assets/img'); os.makedirs(IMG, exist_ok=True)
PHOTO = os.path.join(ROOT, 'src', 'amit-suresh-original.jpg')
WS_SRC = os.path.join(ROOT, 'src', 'oncotics-precision-workspace.html')  # standalone Workspace build (workspace/build.sh)
IMG_SRC = os.path.join(ROOT, 'src', 'oncotics-imaging-workbench.html')  # Imaging Workbench build (imaging/build.sh)
BASE = 'https://oncotics.com'
UPDATED = '2026-10-03'
NAVY = (11, 37, 69); TEAL = (20, 184, 166); LIGHT = (231, 240, 250)
FB = os.environ.get('ONCOTICS_FONT_BOLD', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'); FR = os.environ.get('ONCOTICS_FONT', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')

# ---- Photo (strip metadata, web sizes)
ph = Image.open(PHOTO).convert('RGB')
ph.save(os.path.join(IMG, 'amit-suresh.jpg'), 'JPEG', quality=86, optimize=True, progressive=True)
ph.save(os.path.join(IMG, 'amit-suresh.webp'), 'WEBP', quality=82, method=6)

# ---- Logo mark renderer
def mark(size, bg=None):
    S = size * 4
    im = Image.new('RGBA', (S, S), bg + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S / 32.0
    w = max(2, int(2.5 * k))
    d.ellipse([1.5 * k, 1.5 * k, 30.5 * k, 30.5 * k], outline=TEAL + (255,), width=w)
    def curve(p0, p1, p2, p3, col, wid):
        pts = []
        for i in range(41):
            t = i / 40
            x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0]
            y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]
            pts.append((x * k, y * k))
        d.line(pts, fill=col, width=wid, joint='curve')
    strand = LIGHT + (255,) if bg else (11, 37, 69, 255)
    curve((10, 9), (16, 12), (16, 20), (22, 23), strand, int(2.2 * k))
    curve((22, 9), (16, 12), (16, 20), (10, 23), strand, int(2.2 * k))
    d.line([(12 * k, 13 * k), (20 * k, 13 * k)], fill=TEAL + (255,), width=int(2 * k))
    d.line([(12 * k, 19 * k), (20 * k, 19 * k)], fill=TEAL + (255,), width=int(2 * k))
    return im.resize((size, size), Image.LANCZOS)

for s, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (192, 'assets/img/icon-192.png'), (512, 'assets/img/icon-512.png')]:
    im = mark(s, NAVY)
    if name == 'apple-touch-icon.png' or 'icon-' in name:
        im = im.convert('RGB')
    im.save(os.path.join(OUT, name))
mark(512, NAVY).convert('RGB').save(os.path.join(IMG, 'oncotics-logo-512.png'))
# favicon.ico (16, 32, 48)
mark(64, NAVY).save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
open(os.path.join(OUT, 'favicon.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B2545"/><circle cx="16" cy="16" r="12.5" fill="none" stroke="#14B8A6" stroke-width="2.3"/><path d="M11 10c5 2.5 5 9.5 10 12M21 10c-5 2.5-5 9.5-10 12" fill="none" stroke="#E7F0FA" stroke-width="2" stroke-linecap="round"/><path d="M12.5 13.5h7M12.5 18.5h7" stroke="#14B8A6" stroke-width="1.8" stroke-linecap="round"/></svg>')

# ---- Open Graph images (1200x630)
def og_base():
    im = Image.new('RGB', (1200, 630), NAVY)
    glow = Image.new('RGB', (1200, 630), NAVY); gd = ImageDraw.Draw(glow)
    gd.ellipse([700, -350, 1500, 350], fill=(18, 110, 110)); glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(im, glow, 0.55)
def text(d, xy, s, size, bold=True, fill=(255, 255, 255)):
    d.text(xy, s, font=ImageFont.truetype(FB if bold else FR, size), fill=fill)
im = og_base(); d = ImageDraw.Draw(im)
im.paste(mark(96, NAVY), (80, 80), mark(96, NAVY))
text(d, (196, 100), 'Oncotics', 54)
text(d, (80, 230), 'Precision oncology evidence,', 58)
text(d, (80, 302), 'in one private workspace.', 58)
text(d, (80, 400), 'Clinical evidence · Trials · FDA drugs & devices · Diagnostics', 28, False, (201, 216, 234))
text(d, (80, 442), 'Biology · Literature — free, no sign-up, nothing stored', 28, False, (201, 216, 234))
d.rounded_rectangle([80, 520, 346, 572], radius=26, fill=TEAL); text(d, (106, 530), 'oncotics.com', 28, True, (4, 32, 29))
im.save(os.path.join(IMG, 'og-oncotics.png'), optimize=True)

im = og_base(); d = ImageDraw.Draw(im)
p = ph.resize((360, 360), Image.LANCZOS); m = Image.new('L', (360, 360), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 360, 360], radius=36, fill=255)
im.paste(p, (770, 135), m)
im.paste(mark(72, NAVY), (80, 80), mark(72, NAVY)); text(d, (170, 92), 'Oncotics', 44)
text(d, (80, 220), 'Amit Suresh', 64)
text(d, (80, 305), 'Creator and Architect', 36, True, (94, 234, 212))
for i, line in enumerate(['IICA-certified Independent Director', 'Genetic Engineer', 'MBA in Healthcare Management', 'CFI FMVA']):
    text(d, (80, 375 + i * 42), line, 28, False, (201, 216, 234))
im.save(os.path.join(IMG, 'og-amit-suresh.jpg'), 'JPEG', quality=86, optimize=True, progressive=True)

# ---- Manifest
json.dump({'name': 'Oncotics Precision Oncology Workspace', 'short_name': 'Oncotics', 'description': 'Privacy-first precision oncology research workspace.',
           'start_url': '/precision-oncology-workspace/', 'scope': '/', 'display': 'standalone', 'background_color': '#0B2545', 'theme_color': '#0B2545',
           'icons': [{'src': '/assets/img/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/assets/img/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]},
          open(os.path.join(OUT, 'site.webmanifest'), 'w'), indent=2)

# ---- Workspace page, integrated into the site
ws = open(WS_SRC).read()
ws = ws.replace('https://oncotics.com/precision-oncology-workspace"', 'https://oncotics.com/precision-oncology-workspace/"')
ws = ws.replace("canonical: 'https://oncotics.com/precision-oncology-workspace',", "canonical: 'https://oncotics.com/precision-oncology-workspace/',")
ws = ws.replace("privacyPolicyUrl: '',", "privacyPolicyUrl: 'https://oncotics.com/privacy/',")
ws = ws.replace('"url": "https://oncotics.com/precision-oncology-workspace",', '"url": "https://oncotics.com/precision-oncology-workspace/",')
ws = ws.replace('<meta name="color-scheme" content="light dark">', '''<meta name="color-scheme" content="light dark">
<meta name="author" content="Amit Suresh">
<meta name="theme-color" content="#0B2545">
<meta property="og:site_name" content="Oncotics">
<meta property="og:image" content="https://oncotics.com/assets/img/og-oncotics.png">
<meta property="og:image:alt" content="Oncotics — privacy-first precision oncology workspace">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Oncotics Precision Oncology Workspace">
<meta name="twitter:description" content="Free, privacy-first workspace for cancer genes, variants, trials, FDA drugs and devices, diagnostics, biology and literature.">
<meta name="twitter:image" content="https://oncotics.com/assets/img/og-oncotics.png">
<link rel="alternate" hreflang="en" href="https://oncotics.com/precision-oncology-workspace/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">''')
ws = ws.replace('<title>Oncotics Precision Oncology Workspace | Evidence, Trials, Drugs, Devices, Vaccines, Onco-Fertility, Biology &amp; Literature</title>', '<title>Oncotics Precision Oncology Workspace — Free &amp; Private</title>')
assert '<title>Oncotics Precision Oncology Workspace — Free &amp; Private</title>' in ws
ws = ws.replace('content="Explore cancer genes, variants, drugs, devices, diagnostics, trials, FDA drug and device intelligence, biology, and literature through a privacy-first Oncotics workspace powered by selected live public APIs."', 'content="Search cancer genes, variants, drugs, devices, diagnostics and trials across 19 live public sources. Free, private, nothing stored. Research use only."')
ws = ws.replace("img-src data:;", "img-src 'self' data:;").replace("manifest-src 'none'", "manifest-src 'self'")
# richer JSON-LD for the tool page
ld_old = ws[ws.index('<script type="application/ld+json">'):ws.index('</script>', ws.index('<script type="application/ld+json">')) + 9]
ld_new = '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': [
  {'@type': 'SoftwareApplication', '@id': BASE + '/precision-oncology-workspace/#app', 'name': 'Oncotics Precision Oncology Workspace', 'url': BASE + '/precision-oncology-workspace/',
   'applicationCategory': 'HealthApplication', 'operatingSystem': 'Any modern web browser', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
   'description': 'Privacy-first research workspace that queries selected public oncology data providers directly from the browser. Educational and research use only; not medical, regulatory, or procurement advice.',
   'creator': {'@id': BASE + '/about/#amit-suresh'}, 'publisher': {'@id': BASE + '/#organization'}},
  {'@type': 'WebPage', '@id': BASE + '/precision-oncology-workspace/#webpage', 'url': BASE + '/precision-oncology-workspace/', 'name': 'Oncotics Precision Oncology Workspace', 'isPartOf': {'@id': BASE + '/#website'}, 'mainEntity': {'@id': BASE + '/precision-oncology-workspace/#app'}, 'dateModified': UPDATED, 'inLanguage': 'en'},
  {'@type': 'Organization', '@id': BASE + '/#organization', 'name': 'Oncotics', 'url': BASE + '/', 'founder': {'@type': 'Person', '@id': BASE + '/about/#amit-suresh', 'name': 'Amit Suresh', 'url': BASE + '/about/', 'sameAs': ['https://www.linkedin.com/in/amit-suresh/']}},
  {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Precision Oncology Workspace', 'item': BASE + '/precision-oncology-workspace/'}]}
]}, ensure_ascii=False, separators=(',', ':')) + '</script>'
ws = ws.replace(ld_old, ld_new)
SITE_BAR = '''<style>
.ow-sitebar{background:#071A33;color:#D6E3F2;font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;border-bottom:1px solid rgba(255,255,255,.08)}
.ow-sitebar .in{max-width:1560px;margin:0 auto;padding:0 16px;display:flex;align-items:center;gap:6px;min-height:46px;overflow-x:auto}
.ow-sitebar a{color:#D6E3F2;text-decoration:none;padding:9px 11px;border-radius:9px;white-space:nowrap}
.ow-sitebar a:hover{background:rgba(255,255,255,.08);color:#fff}
.ow-sitebar a[aria-current]{background:rgba(20,184,166,.2);color:#fff}
.ow-sitebar a:focus-visible{outline:3px solid #38BDF8;outline-offset:1px}
.ow-sitebar .home{display:inline-flex;align-items:center;gap:8px;color:#fff;font-weight:800;font-size:16px;margin-right:auto}
.ow-sitebar svg{width:24px;height:24px}
main.oncotics-workspace .ow-skip:not(:focus){top:-160px}
@media (max-width:600px){.ow-sitebar .navhome{display:none}.ow-sitebar a{padding:9px 8px}}
.ow-sitefoot{background:#071A33;color:#9FB3CC;font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:18px 16px 90px;text-align:center}
.ow-sitefoot a{color:#D6E3F2}
@media print{.ow-sitebar,.ow-sitefoot{display:none}}
</style>
<nav class="ow-sitebar" aria-label="Site"><div class="in"><a class="home" href="/" aria-label="Oncotics home"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="#14B8A6" stroke-width="2.5"/><path d="M10 9c6 3 6 11 12 14M22 9c-6 3-6 11-12 14" fill="none" stroke="#E7F0FA" stroke-width="2.2" stroke-linecap="round"/><path d="M12 13h8M12 19h8" stroke="#14B8A6" stroke-width="2" stroke-linecap="round"/></svg>Oncotics</a><a class="navhome" href="/">Home</a><a href="/precision-oncology-workspace/" aria-current="page">Workspace</a><a href="/imaging/">Imaging</a><a href="/about/">About</a><a href="/contact/">Contact</a></div></nav>
'''
SITE_FOOT = '''<div class="ow-sitefoot"><a href="/">Home</a> · <a href="/imaging/">Imaging Workbench</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy &amp; disclaimer</a><br>Created by <a href="/about/">Amit Suresh</a> · © 2026 Oncotics™. All rights reserved.</div>
'''
ws = ws.replace('<body>\n', '<body>\n' + SITE_BAR, 1)
ws = ws.replace('</main>\n<script id="oncotics-workspace-script">', '</main>\n' + SITE_FOOT + '<script id="oncotics-workspace-script">', 1)
assert 'ow-sitebar' in ws and 'ow-sitefoot' in ws
os.makedirs(os.path.join(OUT, 'precision-oncology-workspace'), exist_ok=True)
open(os.path.join(OUT, 'precision-oncology-workspace/index.html'), 'w').write(ws)

# ---- Imaging Workbench page (separate page; OHIF assets load only on explicit action)
im = open(IMG_SRC).read()
im = im.replace('<meta name="color-scheme" content="dark light">', '''<meta name="color-scheme" content="dark light">
<meta name="author" content="Amit Suresh">
<meta name="theme-color" content="#0B2545">
<meta property="og:site_name" content="Oncotics">
<meta property="og:title" content="Oncotics Imaging Workbench">
<meta property="og:description" content="Memory-only DICOM and image viewing (OHIF), lesion inspection, annotation and opt-in experimental AI. Nothing uploaded or stored.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://oncotics.com/imaging/">
<meta property="og:image" content="https://oncotics.com/assets/img/og-oncotics.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script type="application/ld+json">''' + json.dumps({'@context': 'https://schema.org', '@graph': [
  {'@type': 'SoftwareApplication', '@id': BASE + '/imaging/#app', 'name': 'Oncotics Imaging Workbench', 'url': BASE + '/imaging/', 'applicationCategory': 'HealthApplication', 'operatingSystem': 'Any modern web browser', 'isAccessibleForFree': True,
   'description': 'Privacy-first imaging workbench powered by the OHIF Viewer: memory-only DICOM and image viewing, measurement, annotation and opt-in experimental AI inference. Not a radiology diagnostic system.', 'publisher': {'@id': BASE + '/#organization'}},
  {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Imaging Workbench', 'item': BASE + '/imaging/'}]}]}, ensure_ascii=False, separators=(',', ':')) + '</script>')
IMG_BAR = SITE_BAR.replace('<a href="/precision-oncology-workspace/" aria-current="page">Workspace</a><a href="/imaging/">Imaging</a>', '<a href="/precision-oncology-workspace/">Workspace</a><a href="/imaging/" aria-current="page">Imaging</a>').replace('main.oncotics-workspace .ow-skip:not(:focus){top:-160px}', 'main.oncotics-imaging .oi-skip:not(:focus){top:-160px}')
im = im.replace('<body>\n', '<body>\n' + IMG_BAR, 1)
im = im.replace('</main>\n<script id="oncotics-imaging-script">', '</main>\n' + SITE_FOOT + '<script id="oncotics-imaging-script">', 1)
assert 'ow-sitebar' in im and 'ow-sitefoot' in im and 'aria-current="page">Imaging' in im
os.makedirs(os.path.join(OUT, 'imaging'), exist_ok=True)
open(os.path.join(OUT, 'imaging/index.html'), 'w').write(im)

# ---- robots, sitemap, llms
open(os.path.join(OUT, 'robots.txt'), 'w').write(f'''# Oncotics — search engines and AI assistants are welcome to index public pages.
User-agent: *
Allow: /
Disallow: /404.html

# AI / answer-engine crawlers (explicitly allowed for GEO visibility)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: {BASE}/sitemap.xml
''')
urls = [('/', '1.0', 'weekly'), ('/precision-oncology-workspace/', '0.9', 'weekly'), ('/imaging/', '0.8', 'monthly'), ('/about/', '0.8', 'monthly'), ('/contact/', '0.6', 'yearly'), ('/privacy/', '0.4', 'yearly')]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
for u, pr, cf in urls:
    img = f'\n    <image:image><image:loc>{BASE}/assets/img/amit-suresh.jpg</image:loc></image:image>' if u == '/about/' else ''
    sm += f'  <url>\n    <loc>{BASE}{u}</loc>\n    <lastmod>{UPDATED}</lastmod>\n    <changefreq>{cf}</changefreq>\n    <priority>{pr}</priority>{img}\n  </url>\n'
open(os.path.join(OUT, 'sitemap.xml'), 'w').write(sm + '</urlset>\n')

LLMS = f'''# Oncotics

> Oncotics (oncotics.com) builds privacy-first precision oncology tools. Its flagship, the Oncotics Precision Oncology Workspace, is a free browser-based research workspace that shows live public evidence for any cancer gene, variant, drug, medical device, diagnostic, disease or clinical trial — clinical evidence, trials, FDA drug and device records, companion diagnostics, biology and literature — without storing searches. Educational and research use only; not medical, regulatory or procurement advice.

Key facts:
- Name: Oncotics. Website: {BASE}/
- Creator and Architect: Amit Suresh — IICA-certified Independent Director (Indian Institute of Corporate Affairs), Genetic Engineer, MBA in Healthcare Management, CFI Financial Modeling & Valuation Analyst (FMVA). LinkedIn: https://www.linkedin.com/in/amit-suresh/
- Contact: LinkedIn message to Amit Suresh (no patient information).
- Price: free; no account or sign-up.
- Privacy: no backend, no cookies, no browser storage, no analytics; the browser queries public providers directly; nothing is stored; refresh or "Clear Session" wipes all data.
- Live sources (19): CIViC, ClinicalTrials.gov, openFDA drug endpoints, openFDA device endpoints, Ensembl, MyGene.info, MyVariant.info, UniProt, Europe PMC, RxNorm, STRING, Reactome, AlphaFold DB, Open Targets Platform, cBioPortal, GWAS Catalog, ChEMBL, PubChem, EBI OLS.
- Link-out sources: NCI Thesaurus, FDA 510(k)/De Novo/PMA/recall/classification databases, AccessGUDID, FDA companion-diagnostics list, MAUDE, MedWatch, Drugs@FDA, DailyMed, NCBI Gene, ClinVar, dbSNP, PubMed, OncoKB, COSMIC, DepMap, GTEx, Human Protein Atlas, WHO ICTRP, ISRCTN, ANZCTR, EU CTIS, EU CTR, Health Canada, TGA, EMA, PMDA, NMPA, MHRA, CDSCO, CTRI, jRCT.
- Verify-on-request sources (documented public APIs, called only on explicit user action until verified from oncotics.com): OncoTree, NCI GDC (open access), DGIdb, Complex Portal, QuickGO, PDBe, EBI Proteins, OpenAlex, Crossref, Semantic Scholar.
- Modules: Overview (search interpretation with heuristic confidence scores, Geographic Activity Globe, Molecular Context Map), Clinical Evidence, Trials, Drug Intelligence, Vaccines & Cancer Immunization, Devices & Dx, Onco-Fertility, Biology, Literature, Expert Knowledge & Patient Education, Relationship Explorer, Global Coverage, Comparison, Session Board, Advanced Query, Coverage Console, Session & Privacy.
- Imaging Workbench ({BASE}/imaging/): separate page powered by a self-hosted OHIF Viewer; memory-only DICOM/image viewing, measurement, annotation and opt-in experimental AI inference with a user-loaded model; not a radiology diagnostic system; nothing uploaded or stored.
- No vaccine, fertility, pregnancy, contraception, genetic-counseling or radiological diagnostic advice.
- Accepted queries: gene symbols (EGFR), variants (BRAF V600E), rsIDs, HGVS, drugs and brand names, diseases, NCT IDs and other registry IDs, PMIDs, DOIs, UniProt and Ensembl IDs, 510(k)/De Novo/PMA numbers, FDA product codes, regulation numbers, UDI-DIs.
- Regulatory vocabulary: 510(k) = clearance; De Novo = classification; PMA = approval. openFDA device records may lag official FDA databases.

## Pages
- [Home]({BASE}/): what Oncotics does, who benefits, how, when, why and where; FAQ.
- [Precision Oncology Workspace]({BASE}/precision-oncology-workspace/): the free research tool.
- [Imaging Workbench]({BASE}/imaging/): separate memory-only imaging page (OHIF Viewer, Oncotics Inspector, opt-in experimental AI).
- [About]({BASE}/about/): mission, principles, and Amit Suresh, Creator and Architect.
- [Contact]({BASE}/contact/): contact via LinkedIn.
- [Privacy & disclaimer]({BASE}/privacy/): privacy statement and medical/regulatory disclaimer.

## Optional
- [Full text for AI assistants]({BASE}/llms-full.txt)
'''
open(os.path.join(OUT, 'llms.txt'), 'w').write(LLMS)

def page_text(fn):
    h = open(os.path.join(OUT, fn)).read()
    m = re.search(r'<main[^>]*>(.*)</main>', h, re.S); t = m.group(1) if m else ''
    t = re.sub(r'<(script|style|svg)[\s\S]*?</\1>', ' ', t)
    t = re.sub(r'</(h1|h2|h3|p|li|tr|summary|div|section)>', '\n', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    import html as H
    t = H.unescape(t); t = re.sub(r'[ \t]+', ' ', t); t = re.sub(r'\n\s*\n+', '\n', t)
    return '\n'.join(l.strip() for l in t.split('\n') if l.strip())
full = LLMS + '\n\n'
for title, fn, u in [('Home', 'index.html', '/'), ('About', 'about/index.html', '/about/'), ('Contact', 'contact/index.html', '/contact/'), ('Privacy & disclaimer', 'privacy/index.html', '/privacy/')]:
    full += f'\n---\n\n# {title} ({BASE}{u})\n\n' + page_text(fn) + '\n'
open(os.path.join(OUT, 'llms-full.txt'), 'w').write(full)

open(os.path.join(OUT, 'humans.txt'), 'w').write('/* TEAM */\nCreator and Architect: Amit Suresh\nLinkedIn: https://www.linkedin.com/in/amit-suresh/\n\n/* SITE */\nLast update: ' + UPDATED + '\nStandards: HTML5, CSS3, schema.org JSON-LD\nNo cookies, no analytics, no trackers.\n')

# ---- .htaccess (Apache / LiteSpeed on Hostinger)
open(os.path.join(OUT, '.htaccess'), 'w').write(r'''# Oncotics — Hostinger (LiteSpeed/Apache) configuration
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html
AddDefaultCharset UTF-8
AddType application/manifest+json .webmanifest
AddType image/webp .webp
AddType text/plain .txt
AddType application/wasm .wasm
AddType text/javascript .mjs

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Force HTTPS and the bare domain (https://oncotics.com)
  RewriteCond %{HTTPS} off [OR]
  RewriteCond %{HTTP_HOST} ^www\.oncotics\.com$ [NC]
  RewriteRule ^(.*)$ https://oncotics.com/$1 [L,R=301]
  # Friendly aliases for the Workspace
  RewriteRule ^workspace/?$ /precision-oncology-workspace/ [L,R=301]
  RewriteRule ^precision-oncology-workspace\.html$ /precision-oncology-workspace/ [L,R=301]
  # Imaging Workbench aliases
  RewriteRule ^ohif/?$ /imaging/ [L,R=301]
  RewriteRule ^imaging-workbench/?$ /imaging/ [L,R=301]
  # Self-hosted OHIF Viewer (single-page app): client routes fall back to its index.html
  RewriteCond %{REQUEST_URI} ^/assets/ohif/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^assets/ohif/ /assets/ohif/index.html [L]
  # Drop explicit index.html from URLs (canonical folder URLs)
  RewriteCond %{THE_REQUEST} \s/+(.*/)?index\.html[\s?] [NC]
  RewriteRule ^(.*/)?index\.html$ /%1 [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  Header always set Cross-Origin-Opener-Policy "same-origin"
  # Content-Security-Policy is set per page with <meta> tags (the Workspace needs its own API allow-list).
  <FilesMatch "\.(html)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  # Self-hosted globe (CesiumJS) and inference runtime (ONNX Runtime Web) assets
  <FilesMatch "\.(wasm|mjs|glb|ktx2|json)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  <FilesMatch "\.(css|js|png|jpg|jpeg|webp|svg|ico|webmanifest)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  <FilesMatch "\.(txt|xml)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/xml application/json application/ld+json image/svg+xml application/manifest+json
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 30 days"
  ExpiresByType image/png "access plus 30 days"
  ExpiresByType image/jpeg "access plus 30 days"
  ExpiresByType image/webp "access plus 30 days"
  ExpiresByType image/svg+xml "access plus 30 days"
  ExpiresByType image/x-icon "access plus 30 days"
</IfModule>
''')
print('assets done')
