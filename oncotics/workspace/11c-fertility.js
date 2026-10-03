
/* ====================================================================
   MODULE: ONCO-FERTILITY (id: onco-fertility)
   Oncology survivorship and reproductive-health evidence organizer.
   Hard boundaries: no fertility, pregnancy, contraception, lactation or
   vaccination advice; no genetic counseling; no individual gonadotoxicity
   risk score; no patient / partner / minor / clinic / ART / storage
   identifiers; guideline pages are linked, never scraped.
   Sub-lens registry: FERT_LENSES.
   ==================================================================== */
var FERT_LENSES = [
  ['overview', 'Onco-Fertility Overview'], ['gonadotoxic', 'Gonadotoxic Therapy Lens'], ['female', 'Female Risk & Preservation'], ['male', 'Male Risk & Preservation'],
  ['pregnancy', 'Pregnancy, Lactation & Contraception'], ['pregvax', 'Pregnancy / Lactation Vaccination'], ['endocrine', 'Endocrine Survivorship & Menopause'], ['pediatric', 'Pediatric / AYA Preservation'],
  ['hereditary', 'Hereditary Cancer & Reproductive Planning'], ['devices', 'Reproductive Devices & Cryopreservation'], ['trials', 'Onco-Fertility Trials'], ['literature', 'Literature & Guideline Link-Outs'], ['relationships', 'Onco-Fertility Relationship Explorer']
];
var FERT_TOPICS = {
  female: ['oocyte cryopreservation', 'embryo cryopreservation', 'ovarian tissue cryopreservation', 'ovarian suppression GnRH agonist', 'premature ovarian insufficiency'],
  male: ['sperm cryopreservation', 'testicular tissue cryopreservation', 'azoospermia after chemotherapy'],
  pregnancy: ['pregnancy after breast cancer', 'tamoxifen pregnancy', 'trastuzumab pregnancy', 'lactation chemotherapy', 'contraception during chemotherapy'],
  endocrine: ['menopause after cancer treatment', 'premature ovarian insufficiency', 'cancer survivorship endocrine'],
  pediatric: ['pediatric fertility preservation', 'adolescent fertility preservation', 'testicular tissue cryopreservation'],
  hereditary: ['BRCA1 hereditary cancer fertility planning', 'BRCA2 hereditary cancer reproductive planning', 'preimplantation genetic testing hereditary cancer'],
  devices: ['embryo culture media', 'oocyte vitrification', 'sperm cryopreservation device', 'assisted reproduction device'],
  pregvax: ['pregnancy vaccination influenza', 'Tdap vaccine pregnancy', 'RSV vaccine pregnancy', 'COVID-19 vaccine cancer survivor']
};
function fertCtx() { var c = State.ctx; return c ? (c.fertility || (c.type === 'fertility' ? c.fertility : null)) : null; }
function fertDrug() { var c = State.ctx; return c && c.type === 'drug' ? c.drug : (c && c.fertility && c.fertility.drug) || null; }
function topicBtns(list) { return H`<div class="ow-row">${list.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${t}">${t}</button>`; })}</div>`; }
function fertLinks(ids, q) { return H`<div class="ow-card-foot">${ids.map(function (id) { return SRC[id] ? extBtn(linkout(id, q || ''), SRC[id].displayName) : ''; })}</div>`; }
function reproSectionsView() {
  var lb = slot('drug:labels');
  if (!fertDrug()) return H`<p class="ow-subtle">Search a drug (for example cyclophosphamide or tamoxifen pregnancy) to show its FDA label reproductive-health sections.</p>`;
  return slotView('drug:labels', { skeleton: 1, linkout: [{ url: linkout('dailymed', fertDrug()), label: 'DailyMed' }], emptyMsg: 'openFDA returned no label for this drug.', render: function (d) {
    var r = d.items[0], sec = r.data.sections || {}, found = REPRO_SECTIONS.filter(function (k) { return sec[k]; });
    var lbl = {}; LABEL_SECTIONS.forEach(function (x) { lbl[x[0]] = x[1]; });
    return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${r.title} — reproductive-health label sections</div><div class="ow-card-sub">${r.data.generic.join('; ')} · effective ${fdaDate(r.data.effective)}</div></div><div class="ow-badges">${confBadge(r.data.confidence)}${badge('reproductive-label-section', 'fert')}</div></div>
      ${found.length ? found.map(function (k) { return det('rs-' + k + r.key, lbl[k] + ' (source text)', more('rsm-' + k + r.key, sec[k], 700), k === 'females_and_males_of_reproductive_potential'); }) : H`<p class="ow-subtle" style="margin-top:6px">This label version has no dedicated reproductive-health sections in openFDA. Check “Use in specific populations” on DailyMed.</p>`}
      <div class="ow-card-foot">${r.data.setId ? extBtn(LINK.dailymedSet(r.data.setId), 'Current label on DailyMed') : ''}${extBtn(linkout('lactmed', fertDrug()), 'LactMed (lactation)')}<button type="button" class="ow-btn ow-btn-sm" data-act="open-rec" data-key="${r.key}">Full label in Drug Intelligence</button></div>${provView(r.prov)}
      <div class="ow-disclaimer">${SAFETY.labelShort} ${SAFETY.fertility}</div></div>`; } });
}
function reproAEView() {
  var dr = fertDrug(); if (!dr) return '';
  var s = slot('fert:ae');
  return H`<div class="ow-card ow-section"><div class="ow-card-title">Structured reproductive adverse-event terms (openFDA FAERS)</div>
    <p class="ow-small ow-muted">Counts of reports listing reproductive-health MedDRA terms with ${dr}. ${SAFETY.drugAE} Counts are not rates and are not a risk score.</p>
    ${s.status === 'idle' ? autoAct('fert:ae:' + dr, 'fert-ae', {}, [{ url: linkout('faers', ''), label: 'FAERS Public Dashboard' }], 'reproductive adverse-event terms (openFDA)') : slotView('fert:ae', { skeleton: 1, linkout: [{ url: linkout('faers', ''), label: 'FAERS Public Dashboard' }], emptyMsg: 'No reproductive-health terms appear among the reported reaction terms for this drug.', render: function (d) {
      return H`${bars(d.items.map(function (x) { return [titleCase(x.term), x.count]; }), { label: 'Reproductive adverse-event terms (report counts)', color: 'var(--ow-fert)', max: 20 })}<p class="ow-subtle">Scanned the top ${num(d.scanned)} reported reaction terms. ${badge('Passive surveillance', 'warn')} ${badge('structured-reproductive-adverse-event-term', 'fert')}</p>${provView(d.prov)}`; } })}</div>`;
}
function fertTrials(term, label) {
  var key = 'fert:trials';
  var cur = ui('fert').trialTerm;
  return H`<div class="ow-section">${sectionHead(label || 'Onco-Fertility trials', ['ctgov'])}${!cur || cur !== term ? autoAct('fert:trials:' + term, 'fert-trials', { 'data-term': term }, [{ url: linkout('ctgov', term), label: 'ClinicalTrials.gov' }], 'trials for “' + term + '”') : trialMini(key)}</div>`;
}
function fertLens(tab) {
  var f = fertCtx(), c = State.ctx, dr = fertDrug();
  var cur = f ? H`<div class="ow-notice ow-notice-info">${icon('seed')}<div>Current concept: <strong>${f.concept}</strong> ${badge(FERT_SUB[f.sub] || f.sub, 'fert')}${dr ? H` · drug ${badge(dr, 'good')}` : ''}${f.gene ? H` · gene ${badge(f.gene, 'gene')}` : ''}</div></div>` : (dr ? H`<div class="ow-notice ow-notice-info">${icon('pill')}<div>Showing reproductive-health context for the drug <strong>${dr}</strong>. No individual risk is inferred.</div></div>` : '');
  switch (tab) {
    case 'overview': return H`${cur}<div class="ow-grid-2 ow-section">
        <div class="ow-card"><div class="ow-card-title">What this lens organizes</div><ul class="ow-small"><li>FDA label reproductive-health sections (source text)</li><li>Structured reproductive adverse-event terms (passive surveillance)</li><li>Fertility-preservation, survivorship and pregnancy-related trials</li><li>Reproductive and ART laboratory device records (may lag official FDA DB)</li><li>Literature and official guideline link-outs (never scraped)</li></ul></div>
        <div class="ow-card"><div class="ow-card-title">Loaded for this query</div><div class="ow-stat-grid">${statFor('trials:list', 'Related trials', 'ctgov')}${statFor('lit:list', 'Literature records', 'europepmc')}${dr ? statFor('drug:labels', 'FDA labels', 'openfda-drug') : ''}${statFor('fert:ae', 'Reproductive AE terms', 'openfda-drug')}</div></div></div>
      <div class="ow-card ow-section"><div class="ow-card-title">Start from a topic</div>${topicBtns(['fertility preservation', 'cyclophosphamide gonadotoxicity', 'tamoxifen pregnancy', 'oocyte cryopreservation', 'sperm cryopreservation', 'ovarian tissue cryopreservation', 'premature ovarian insufficiency', 'BRCA1 hereditary cancer fertility planning', 'AMH assay FDA'])}</div>`;
    case 'gonadotoxic': return H`${cur}${dr ? H`<div class="ow-section">${reproSectionsView()}</div>${reproAEView()}<div class="ow-section"><button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${dr + ' gonadotoxicity'}">${icon('book')}Literature: ${dr} gonadotoxicity</button></div>` : H`<div class="ow-card ow-section"><div class="ow-card-title">Agents frequently discussed in gonadotoxicity literature (alphabetical routing list)</div><p class="ow-small ow-muted">This is a navigation list, not a risk ranking or an individual risk score.</p>${topicBtns(Array.from(GONADO_DICT).sort())}</div>`}
      <div class="ow-disclaimer">${SAFETY.fertility} Oncotics does not calculate individual gonadotoxicity risk.</div>`;
    case 'female': return H`${cur}<div class="ow-card ow-section"><div class="ow-card-title">Female reproductive risk and preservation topics</div>${topicBtns(FERT_TOPICS.female)}${fertLinks(['nci_fertility', 'eshre_guidelines', 'asrm', 'asco_guidelines'])}</div>${fertTrials('fertility preservation', 'Fertility-preservation trials')}`;
    case 'male': return H`${cur}<div class="ow-card ow-section"><div class="ow-card-title">Male reproductive risk and preservation topics</div>${topicBtns(FERT_TOPICS.male)}<div class="ow-card-foot">${extBtn(SRC.nci_fertility.linkoutAltTemplate, 'NCI: fertility issues in boys and men with cancer')}${extBtn(linkout('asrm', ''), 'ASRM practice documents')}${extBtn(linkout('asco_guidelines', ''), 'ASCO guidelines')}</div></div>${fertTrials('sperm cryopreservation', 'Sperm / testicular preservation trials')}`;
    case 'pregnancy': return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div>No pregnancy, lactation or contraception advice is given. Label text is source-reported.</div></div><div class="ow-section">${reproSectionsView()}</div>
      <div class="ow-card ow-section"><div class="ow-card-title">Topics</div>${topicBtns(FERT_TOPICS.pregnancy)}${fertLinks(['lactmed', 'dailymed', 'nci_fertility'], dr || '')}</div>`;
    case 'pregvax': return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.vaccines}</div></div><div class="ow-card ow-section"><div class="ow-card-title">Official immunization pages (link-outs)</div>${fertLinks(['cdc_pregnancy_vax', 'cdc_acip', 'who_vaccines', 'lactmed'])}</div><div class="ow-card ow-section"><div class="ow-card-title">Explore (no recommendations)</div>${topicBtns(FERT_TOPICS.pregvax)}</div>`;
    case 'endocrine': return H`${cur}<div class="ow-card ow-section"><div class="ow-card-title">Endocrine survivorship and menopause</div>${topicBtns(FERT_TOPICS.endocrine)}<div class="ow-card-foot">${extBtn('https://www.cancer.gov/about-cancer/coping/survivorship', 'NCI: cancer survivorship')}${extBtn(linkout('asco_guidelines', ''), 'ASCO guidelines')}</div></div>${fertTrials('menopause cancer survivors', 'Survivorship / menopause trials')}`;
    case 'pediatric': return H`${cur}<div class="ow-notice ow-notice-warn">${icon('shield')}<div>Do not enter any information about a child or adolescent. ${SAFETY.phi}</div></div><div class="ow-card ow-section"><div class="ow-card-title">Pediatric and AYA fertility preservation</div>${topicBtns(FERT_TOPICS.pediatric)}<div class="ow-card-foot">${extBtn('https://www.cancer.gov/types/aya', 'NCI: adolescents and young adults with cancer')}${extBtn(linkout('nci_fertility', ''), 'NCI fertility issues')}</div></div>${fertTrials('pediatric fertility preservation', 'Pediatric / AYA preservation trials')}`;
    case 'hereditary': var g = (f && f.gene) || bioGene();
      return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.hereditary}</strong></div></div>
      <div class="ow-card ow-section"><div class="ow-card-title">Gene-disease validity and hereditary cancer resources ${g ? '— ' + g : ''}</div>${g ? H`<div class="ow-card-foot">${extBtn(linkout('clingen_gencc', g), 'ClinGen: ' + g)}${extBtn(LINK.gencc(g), 'GenCC: ' + g)}${extBtn(linkout('ncbi-gene', g), 'NCBI Gene')}${extBtn(linkout('oncokb', g), 'OncoKB (license terms)')}</div>` : topicBtns(FERT_TOPICS.hereditary)}
        <div class="ow-card-foot">${extBtn('https://www.cancer.gov/about-cancer/causes-prevention/genetics', 'NCI: cancer genetics')}${extBtn(linkout('asrm', ''), 'ASRM practice documents')}</div></div>`;
    case 'devices': var ds = slot('fert:devices');
      return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.devices} ${SAFETY.lag} ${SAFETY.ldt}</div></div>
      <div class="ow-card ow-section"><div class="ow-card-title">Reproductive and ART laboratory device records (openFDA)</div><div class="ow-row">${FERT_TOPICS.devices.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="fert-devices" data-term="${t}">${icon('device')}${t}</button>`; })}</div>
        ${ds.status === 'idle' ? autoAct('fert:devices', 'fert-devices', { 'data-term': FERT_TOPICS.devices[0] }, [{ url: linkout('fda-510k', ''), label: 'FDA 510(k) database' }], 'device records for “' + FERT_TOPICS.devices[0] + '”') : slotView('fert:devices', { skeleton: 2, linkout: [{ url: linkout('fda-510k', ''), label: 'FDA 510(k) database' }], emptyMsg: 'openFDA returned no device authorizations for this term (records may lag the official database).', render: function (d) { return H`<p class="ow-subtle">Term: “${ui('fert').devTerm}”. ${num(d.items.length)} records shown.</p><div class="ow-stack">${d.items.slice(0, 12).map(function (r) { return authCard(r); })}</div>`; } })}
        <div class="ow-card-foot">${extBtn(linkout('fda-510k', ''), 'FDA 510(k)')}${extBtn(linkout('fda-pma', ''), 'FDA PMA')}${extBtn(linkout('fda-classification', ''), 'FDA product classification')}</div></div>
      <p class="ow-subtle">Ovarian tissue cryopreservation and similar procedures are labeled with a regulatory status only where a source record reports one.</p>`;
    case 'trials': return H`${cur}${f || dr ? H`<div class="ow-section">${sectionHead('Trials for the current query', ['ctgov'])}${trialMini('trials:list')}</div>` : ''}${fertTrials('fertility preservation', 'Fertility-preservation trials')}`;
    case 'literature': return H`${cur}${f || dr ? H`<div class="ow-section">${sectionHead('Europe PMC (current query)', ['europepmc'])}${slotView('lit:list', { skeleton: 2, emptyMsg: 'No records.', render: function (d) { return H`<div class="ow-stack">${d.items.slice(0, 6).map(paperCard)}</div><div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="literature">All literature</button></div>`; } })}</div>` : ''}
      <div class="ow-card ow-section"><div class="ow-card-title">Guidelines (link-outs only; never scraped or summarized)</div>${fertLinks(['asco_guidelines', 'eshre_guidelines', 'asrm', 'nci_fertility', 'cpic'])}</div>`;
    case 'relationships': return H`${cur}<div class="ow-card ow-section"><ul class="ow-tree" aria-label="Onco-Fertility relationship flow">${fertRelTree()}</ul></div><p class="ow-subtle">Flow: cancer type → therapy → label reproductive section → adverse-event term → fertility-preservation trial → device → literature. Dashed nodes are derived links.</p>`;
  }
  return '';
}
function fertRelTree() {
  var c = State.ctx, ok = function (k) { var s = slot(k); return s.status === 'ok' ? s.data : null; };
  var dr = fertDrug(), lb = ok('drug:labels'), ae = ok('fert:ae'), ft = ok('fert:trials') || (fertCtx() ? ok('trials:list') : null), dv = ok('fert:devices'), lt = ok('lit:list'), ev = ok('civic:evidence');
  var dz = ev ? countBy(ev.items, function (r) { return r.data.disease ? r.data.disease.name : null; }).filter(function (x) { return x[0] !== 'Not reported'; })[0] : null;
  var secs = lb ? REPRO_SECTIONS.filter(function (k) { return lb.items[0].data.sections && lb.items[0].data.sections[k]; }) : [];
  return H`<li>${node('Cancer type', dz ? dz[0] + ' (CIViC evidence)' : (c && c.disease) || 'not loaded', { kind: 'warn' })}<ul>
    <li>${node('Therapy', dr || 'search a drug', { kind: 'good' })}<ul>
      <li>${node('Label reproductive sections', lb ? (secs.length ? secs.length + ' section(s)' : 'none in this label version') : 'not loaded', { kind: 'fert', src: 'openFDA label' })}</li>
      <li>${node('Adverse-event terms', ae ? ae.items.length + ' reproductive terms (passive)' : 'not loaded', { kind: 'fert', src: 'openFDA FAERS', actions: ae || !dr ? '' : H`<button type="button" class="ow-linkbtn ow-small" data-act="fert-ae">Load</button>` })}</li></ul></li>
    <li>${node('Fertility-preservation trials', ft ? num(ft.total) + ' studies' : 'not loaded', { kind: 'cyan', derived: true, src: 'ClinicalTrials.gov' })}</li>
    <li>${node('Reproductive devices', dv ? dv.items.length + ' records (may lag)' : 'not loaded', { kind: 'device', src: 'openFDA device' })}</li>
    <li>${node('Literature', lt ? num(lt.total) + ' Europe PMC records' : 'not loaded', { kind: 'lit', derived: true })}</li></ul></li>`;
}
registerModule({
  id: 'onco-fertility', label: 'Onco-Fertility', icon: 'seed',
  count: function () { return fertCtx() ? slotTotal('trials:list') : null; },
  render: function () {
    var u = ui('fert'), f = fertCtx(), tab = u.tab || (State.interp && State.interp.top && State.interp.top.lens ? State.interp.top.lens : null) || (f ? ({ gonadotoxicity: 'gonadotoxic', pregnancy: 'pregnancy', lactation: 'pregnancy', contraception: 'pregnancy', endocrine: 'endocrine', hereditary: 'hereditary', device: 'devices', pediatric: 'pediatric' }[f.sub] || 'overview') : (fertDrug() ? 'gonadotoxic' : 'overview'));
    if (!FERT_LENSES.some(function (x) { return x[0] === tab; })) tab = 'overview';
    return H`${moduleHead('onco-fertility')}
      <div class="ow-notice ow-notice-fert">${icon('seed')}<div><strong>${SAFETY.fertility}</strong> Do not enter patient, partner, minor, clinic, ART-cycle or storage identifiers, due dates or test values. ${SAFETY.phi}</div></div>
      <div class="ow-subtabs ow-section" role="tablist" aria-label="Onco-Fertility sub-lenses">${FERT_LENSES.map(function (t) { return H`<button type="button" role="tab" class="ow-subtab" aria-selected="${tab === t[0] ? 'true' : 'false'}" data-act="fert-tab" data-tab="${t[0]}">${t[1]}</button>`; })}</div>
      <div role="tabpanel">${safeRender(function () { return fertLens(tab); }, 'This lens')}</div>
      <div class="ow-disclaimer">${LEGAL.reproductive}</div>`;
  },
  exportRows: function () { var s = slot('fert:ae'); if (s.status !== 'ok') return null; return { name: 'reproductive-ae-terms', rows: s.data.items, cols: [{ label: 'MedDRA term', key: 'term' }, { label: 'Report count', key: 'count' }, { label: 'Data category', get: function () { return 'structured-reproductive-adverse-event-term'; } }, { label: 'Note', get: function () { return 'Passive surveillance; counts are not rates and do not prove causality'; } }] }; }
});
