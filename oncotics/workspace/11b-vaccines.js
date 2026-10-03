
/* ====================================================================
   MODULE: VACCINES & CANCER IMMUNIZATION (id: vaccines-cancer-immunization)
   A focused oncology vaccine lens, not a general vaccine portal.
   Hard boundaries: no vaccine advice, schedules, risk calculators, safety
   rankings, lot/dose/patient identifiers, narratives, or guideline scraping.
   Sub-lens registry: VAX_LENSES.
   ==================================================================== */
var VAX_LENSES = [
  ['preventive', 'Preventive Cancer Vaccines'], ['therapeutic', 'Therapeutic Cancer Vaccines'], ['antigens', 'Vaccine Antigens & Immune Biology'], ['trials', 'Vaccine Trials'],
  ['labels', 'Labels & Regulatory Records'], ['safety', 'Safety Surveillance'], ['pregnancy', 'Pregnancy / Lactation / Onco-Fertility Vaccination Link-Outs']
];
var VAX_ANTIGENS = [['CTAG1B', 'NY-ESO-1 (cancer-testis antigen)'], ['MAGEA1', 'MAGE-A1 (cancer-testis antigen)'], ['MAGEA3', 'MAGE-A3'], ['PRAME', 'PRAME'], ['WT1', 'Wilms tumor 1'], ['ACP3', 'Prostatic acid phosphatase (PAP)'], ['FOLH1', 'PSMA'], ['MUC1', 'MUC1'], ['KRAS', 'KRAS neoantigen contexts'], ['EGFR', 'EGFR'], ['ERBB2', 'HER2'], ['TERT', 'Telomerase (TERT)']];
var VAX_EXAMPLES = { preventive: ['HPV vaccine', 'Hepatitis B vaccine', 'HPV vaccine cervical cancer', 'hepatitis B vaccine hepatocellular carcinoma'], therapeutic: ['sipuleucel-T', 'talimogene laherparepvec', 'intravesical BCG', 'mRNA cancer vaccine', 'neoantigen vaccine', 'dendritic cell vaccine', 'peptide vaccine', 'mRNA-4157'], pregnancy: ['pregnancy vaccination influenza', 'Tdap vaccine pregnancy', 'RSV vaccine pregnancy', 'COVID-19 vaccine cancer survivor', 'live vaccines immunosuppression'] };
function vaxCtx() { var c = State.ctx; return c && c.type === 'vaccine' ? c.vaccine : null; }
function vaxSearchBtns(list, pickType) { return H`<div class="ow-row">${list.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${t}">${icon('syringe')}${t}</button>`; })}</div>`; }
function vaxLinkouts(ids, q) { return H`<div class="ow-card-foot">${ids.map(function (id) { return SRC[id] ? extBtn(linkout(id, q || ''), SRC[id].displayName) : ''; })}</div>`; }
function vaxLens(tab) {
  var v = vaxCtx(), c = State.ctx;
  var cur = v ? H`<div class="ow-notice ow-notice-info">${icon('syringe')}<div>Current query: <strong>${v.name}</strong> · ${badge(VAX_SUB[v.kind] || v.kind, 'vax')}${v.investigational ? badge('Investigational concept', 'warn') : ''}${v.cancers.length ? H` · cancer context (dictionary): ${v.cancers.join(', ')}` : ''}${v.note ? H`<div class="ow-small" style="margin-top:4px">${v.note}</div>` : ''}</div></div>` : '';
  if (tab === 'preventive') return H`${cur}<div class="ow-grid-2 ow-section">
      <div class="ow-card"><div class="ow-card-title">HPV vaccines and HPV-associated cancers</div><p class="ow-small ow-muted">Antigen: HPV L1 virus-like particles. Prevention context (dictionary, routing only): cervical, anal, oropharyngeal, vulvar, vaginal and penile cancers.</p>${vaxSearchBtns(['HPV vaccine', 'HPV vaccine cervical cancer'])}${vaxLinkouts(['fda_cber', 'cdc_acip', 'who_vaccines'])}</div>
      <div class="ow-card"><div class="ow-card-title">Hepatitis B vaccines and liver cancer prevention context</div><p class="ow-small ow-muted">Antigen: hepatitis B surface antigen (HBsAg). Prevention context (dictionary, routing only): hepatocellular carcinoma.</p>${vaxSearchBtns(['Hepatitis B vaccine', 'hepatitis B vaccine hepatocellular carcinoma'])}${vaxLinkouts(['fda_cber', 'cdc_acip', 'who_vaccines'])}</div></div>
    <p class="ow-subtle">Official public-health pages are linked, never copied. ${SAFETY.vaccines}</p>`;
  if (tab === 'therapeutic') return H`${cur}<div class="ow-card ow-section"><div class="ow-card-title">Therapeutic cancer vaccines and vaccine-like immunotherapies</div>
      <p class="ow-small ow-muted">Classes: autologous cellular immunotherapy (e.g. sipuleucel-T), mRNA, dendritic-cell, peptide, neoantigen and viral-vector vaccines, and oncolytic viral immunotherapy where sources describe it. Oncotics does not force a class: where a source calls a product a cellular, gene or biologic therapy, that wording is shown.</p>
      ${vaxSearchBtns(VAX_EXAMPLES.therapeutic)}</div>
    ${v && v.kind !== 'preventive' && v.kind !== 'general' ? H`<div class="ow-section">${sectionHead('Trials for ' + v.name, ['ctgov'])}${trialMini('trials:list')}</div>` : ''}
    <p class="ow-subtle">Investigational concepts (mRNA, neoantigen, dendritic-cell, peptide, viral-vector) are not approved products unless a source record says so; Oncotics never fabricates approval records.</p>`;
  if (tab === 'antigens') {
    var ag = v && v.antigenGene;
    return H`${cur}<div class="ow-card ow-section"><div class="ow-card-title">Tumor-associated and vaccine antigens (human genes)</div><p class="ow-small ow-muted">Open a gene to load live UniProt, Ensembl and MyGene biology. Viral antigens (HPV L1, HBsAg) open at UniProt.</p>
        <div class="ow-row">${VAX_ANTIGENS.map(function (a) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${a[0]}" data-type="gene" title="${a[1]}">${a[0]} <span class="ow-subtle">${a[1]}</span></button>`; })}</div>
        <div class="ow-card-foot">${extBtn('https://www.uniprot.org/uniprotkb?query=%22major%20capsid%20protein%20L1%22%20AND%20papillomavirus', 'UniProt: HPV L1 proteins')}${extBtn('https://www.uniprot.org/uniprotkb?query=%22large%20envelope%20protein%22%20AND%20%22hepatitis%20B%20virus%22', 'UniProt: HBV envelope (HBsAg)')}${extBtn(linkout('reactome', 'antigen processing cross presentation'), 'Reactome: antigen presentation')}${extBtn(linkout('reactome', 'TCR signaling'), 'Reactome: T-cell receptor signaling')}</div></div>
      ${ag ? H`<div class="ow-card ow-section">${sectionHead('Antigen gene for ' + v.name + ': ' + ag, ['mygene', 'uniprot'])}<p class="ow-small">Antigen-to-gene link is normalized by Oncotics from its vaccine dictionary (derived).</p><div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${ag}" data-type="gene">${icon('dna')}Open ${ag} biology</button></div></div>` : ''}
      <div class="ow-disclaimer">${SAFETY.expression} Antigen biology is research context and does not indicate vaccine suitability.</div>`;
  }
  if (tab === 'trials') return H`${cur}${v ? H`<div class="ow-section">${sectionHead('ClinicalTrials.gov vaccine studies', ['ctgov'])}${trialMini('trials:list')}<div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="trials">Open all in Trials (filters, locations)</button></div></div>` : H`<div class="ow-empty"><h3>Search a vaccine to list its trials</h3>${vaxSearchBtns(['cancer vaccine', 'mRNA cancer vaccine', 'HPV vaccine', 'sipuleucel-T'])}</div>`}
      <div class="ow-disclaimer">${SAFETY.trials} Public trial site locations appear on the Overview globe.</div>`;
  if (tab === 'labels') {
    var hasProd = v && v.products && v.products.length;
    return H`${cur}${hasProd ? H`<div class="ow-section">${sectionHead('openFDA biologic / vaccine labels', ['openfda-drug'])}${slot('vax:labels').status === 'idle' ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-primary" data-act="vax-labels">${icon('pill')}Load FDA labels for ${v.products.join(', ')}</button>` : slotView('vax:labels', { linkout: [{ url: linkout('dailymed', v.products[0]), label: 'DailyMed' }, { url: linkout('fda_cber', ''), label: 'FDA CBER' }], emptyMsg: 'openFDA returned no label for these product names. Vaccine labels are authoritative on DailyMed / FDA CBER.', render: function (d) {
        return H`<div class="ow-stack">${d.items.slice(0, 6).map(function (r) { var x = r.data, sec = x.sections || {};
          return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${r.title}</div><div class="ow-card-sub">${x.generic.join('; ')} · ${x.manufacturer.join('; ')} · effective ${fdaDate(x.effective)}</div></div><div class="ow-badges">${confBadge(x.confidence)}${badge('vaccine-label-section', 'vax')}</div></div>
            ${sec.indications_and_usage ? det('vxi' + r.key, 'Indications and usage (source text)', more('vxim' + r.key, sec.indications_and_usage, 600)) : ''}${sec.warnings_and_cautions ? det('vxw' + r.key, 'Warnings and precautions (source text)', more('vxwm' + r.key, sec.warnings_and_cautions, 600)) : ''}${sec.pregnancy ? det('vxp' + r.key, 'Pregnancy section (source text)', more('vxpm' + r.key, sec.pregnancy, 600)) : ''}
            <div class="ow-card-foot">${recActions(r)}${x.setId ? extBtn(LINK.dailymedSet(x.setId), 'DailyMed label') : ''}</div>${provView(r.prov)}</div>`; })}</div><div class="ow-disclaimer">${SAFETY.labelShort} ${SAFETY.vaccines}</div>`; } })}</div>` : H`<p class="ow-subtle">Label lookup runs for named products (for example Gardasil 9, Engerix-B, Provenge). Investigational concepts have no FDA label.</p>`}
      <div class="ow-card ow-section"><div class="ow-card-title">Official vaccine and biologic regulators (link-outs)</div>${vaxLinkouts(['fda_cber', 'dailymed', 'ema', 'mhra', 'tga', 'health_canada_dpd', 'pmda', 'nmpa', 'who_vaccines'], v ? v.name : '')}<p class="ow-subtle">Some regulator sites are non-English or need on-site search.</p></div>`;
  }
  if (tab === 'safety') return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.vaers}</strong></div></div>
    <div class="ow-card ow-section"><div class="ow-card-title">VAERS (passive surveillance) — link-out only</div>
      <p class="ow-small">CDC WONDER VAERS queries could not be verified for browser access from oncotics.com, so Oncotics shows no counts here. Oncotics never displays VAERS narratives, never ranks vaccines by safety, and never calculates incidence (VAERS has no denominator).</p>
      ${vaxLinkouts(['cdc_vaers'])}<div class="ow-card-foot">${extBtn('https://wonder.cdc.gov/vaers.html', 'CDC WONDER VAERS (official query tool)')}</div></div>
    <p class="ow-subtle">${badge('Passive surveillance', 'warn')} ${badge('Aggregate only', 'outline')} ${badge('No causal language', 'outline')}</p>`;
  if (tab === 'pregnancy') return H`${cur}<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.vaccines} ${SAFETY.fertility}</div></div>
    <div class="ow-card ow-section"><div class="ow-card-title">Official pregnancy, lactation and immunocompromised-host immunization pages</div>${vaxLinkouts(['cdc_pregnancy_vax', 'cdc_acip', 'who_vaccines', 'lactmed'])}<p class="ow-subtle">These pages are guidelines and are linked, never scraped or summarized.</p></div>
    <div class="ow-card ow-section"><div class="ow-card-title">Explore literature and trials (no recommendations)</div>${vaxSearchBtns(VAX_EXAMPLES.pregnancy)}</div>`;
  return '';
}
function trialMini(key) {
  return slotView(key, { skeleton: 2, linkout: [{ url: linkout('ctgov', State.ctx ? State.ctx.trialTerm || State.ctx.label : ''), label: 'Search ClinicalTrials.gov' }], emptyMsg: 'No ClinicalTrials.gov studies matched.', render: function (d) {
    return H`<p class="ow-subtle">${num(d.total)} studies (showing ${d.items.length}).</p>${table([{ label: 'Trial', render: function (r) { return H`<button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${r.data.nct}</button><div class="ow-small">${trunc(r.data.briefTitle, 120)}</div>`; } }, { label: 'Status', render: function (r) { return statusBadge(r.data.status); } }, { label: 'Phase', render: function (r) { return phaseBadges(r.data.phases); } }, { label: 'Interventions', render: function (r) { return r.data.interventions.slice(0, 3).map(function (i) { return i.name; }).join('; '); } }, { label: 'Sponsor', render: function (r) { return r.data.sponsor || '—'; } }], d.items)}`; } });
}
registerModule({
  id: 'vaccines-cancer-immunization', label: 'Vaccines & Cancer Immunization', icon: 'syringe',
  count: function () { return vaxCtx() ? slotTotal('trials:list') : null; },
  render: function () {
    var u = ui('vaccines'), v = vaxCtx(), tab = u.tab || (State.interp && State.interp.selectedKey === 'drugctx:pregnancy-vaccination' ? 'pregnancy' : v ? (v.kind === 'preventive' ? 'preventive' : v.kind === 'general' ? 'pregnancy' : 'therapeutic') : 'preventive');
    return H`${moduleHead('vaccines-cancer-immunization', H`${v ? extBtn(linkout('fda_cber', ''), 'FDA CBER') : ''}${extBtn(linkout('cdc_vaers', ''), 'VAERS (official)')}`)}
      <div class="ow-notice ow-notice-warn">${icon('shield')}<div><strong>${SAFETY.vaccines}</strong> No schedules, risk calculators, safety rankings, lot numbers, dose dates or patient identifiers. ${SAFETY.phi}</div></div>
      <div class="ow-subtabs ow-section" role="tablist" aria-label="Vaccine sub-lenses">${VAX_LENSES.map(function (t) { return H`<button type="button" role="tab" class="ow-subtab" aria-selected="${tab === t[0] ? 'true' : 'false'}" data-act="vax-tab" data-tab="${t[0]}">${t[1]}</button>`; })}</div>
      <div role="tabpanel">${safeRender(function () { return vaxLens(tab); }, 'This lens')}</div>
      <div class="ow-disclaimer">${LEGAL.vaccine}</div>`;
  },
  exportRows: function () { var s = slot('vax:labels'); if (s.status !== 'ok') return null; return { name: 'vaccine-labels', rows: s.data.items, cols: [{ label: 'Product', get: function (r) { return r.title; } }, { label: 'Generic', get: function (r) { return r.data.generic.join('; '); } }, { label: 'Manufacturer', get: function (r) { return r.data.manufacturer.join('; '); } }, { label: 'Set ID', get: function (r) { return r.data.setId; } }, { label: 'Effective', get: function (r) { return fdaDate(r.data.effective); } }, { label: 'Match', get: function (r) { return r.data.confidence; } }, { label: 'Data category', get: function () { return 'vaccine-label-section'; } }] }; }
});
DETAIL['vaccine-label'] = function (r) { return DETAIL.label(r); };
