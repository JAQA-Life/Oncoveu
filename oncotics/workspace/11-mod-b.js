
/* ====================================================================
   MODULE 4: DRUG INTELLIGENCE (openFDA drug + RxNorm + ChEMBL + PubChem)
   ==================================================================== */
var DRUG_TABS = [['identity', 'Identity'], ['regulatory', 'Regulatory status'], ['label', 'Label'], ['approvals', 'Approval history'], ['safety', 'Safety'], ['enforcement', 'Enforcement / recalls'], ['trials', 'Related trials'], ['chemistry', 'Chemical / biological context'], ['cdx', 'Companion diagnostics']];
function drugLabel() {
  var s = slot('drug:labels'); if (s.status !== 'ok') return null;
  var i = ui('drug').labelIdx || 0; return s.data.items[i] || s.data.items[0];
}
function drugApprovals() { var s = slot('drug:approvals'); return s.status === 'ok' ? s.data.items : []; }
function linkedTherapies() {
  var ev = slot('civic:evidence'); if (ev.status !== 'ok') return [];
  return countBy(ev.data.items, function (r) { return r.data.therapies.map(function (t) { return t.name; }); }).filter(function (x) { return x[0] !== 'Not reported'; });
}
function drugSubtab(tab) {
  var c = State.ctx, L = drugLabel(), ap = drugApprovals();
  if (tab === 'identity') {
    var rx = slot('drug:rxnorm');
    return H`<dl class="ow-kv"><dt>Query</dt><dd>${c.drug}${c.brand ? ' (brand ' + c.brand + ' normalized to generic by Oncotics)' : ''}</dd>
      <dt>Generic name(s)</dt><dd>${L ? (L.data.generic.join('; ') || nr()) : nr()}</dd><dt>Brand name(s)</dt><dd>${uniq((L ? L.data.brand : []).concat(ap.reduce(function (a, r) { return a.concat(r.data.products.map(function (p) { return p.brand; })); }, []))).join('; ') || nr()}</dd>
      <dt>Substance</dt><dd>${L ? (L.data.substance.join('; ') || nr()) : nr()}</dd><dt>Manufacturer(s)</dt><dd>${L ? (L.data.manufacturer.join('; ') || nr()) : nr()}</dd>
      <dt>Application number(s)</dt><dd>${uniq((L ? L.data.appl : []).concat(ap.map(function (r) { return r.data.appl; }))).map(function (a) { return H`<span>${ext(LINK.applNo(a), a)} </span>`; }) || nr()}</dd>
      <dt>SPL set ID</dt><dd>${L && L.data.setId ? H`<span class="ow-mono">${L.data.setId}</span> ${ext(LINK.dailymedSet(L.data.setId), 'DailyMed')}` : nr()}</dd>
      <dt>RxCUI</dt><dd>${rx.status === 'ok' && rx.data.rxcui ? H`${ext(linkout('rxnorm', rx.data.rxcui, true), rx.data.rxcui)}` : slotMark('drug:rxnorm') || nr()}</dd>
      <dt>Label RxCUIs</dt><dd>${L && L.data.rxcui.length ? L.data.rxcui.slice(0, 8).join(', ') : nr()}</dd></dl>
      ${L && L.data.openfdaEmpty ? H`<div class="ow-notice ow-notice-warn" style="margin-top:8px">${icon('info')}<div>This SPL label has no openFDA identity block; it was matched on product text (${L.data.confidence} match). Verify on DailyMed.</div></div>` : ''}
      <div class="ow-section">${sectionHead('RxNorm normalization', ['rxnorm'])}<div class="ow-disclaimer">${SAFETY.rxnorm}</div>
      ${slotView('drug:rxnorm', { skeleton: 1, linkout: [{ url: linkout('rxnorm', c.drug), label: 'Open RxNav' }], emptyMsg: 'RxNorm returned no concept for this name.', render: function (d) {
        return H`${d.related && d.related.length ? H`<p class="ow-small"><strong>Related ingredient / brand concepts:</strong> ${d.related.map(function (x) { return H`${badge(x.tty, 'outline')} ${x.name} <span class="ow-subtle">(${x.rxcui})</span>; `; })}</p>` : ''}
        ${d.concepts.length ? det('rx-concepts', 'RxNorm clinical/branded drug concepts (' + d.concepts.length + ')', table([{ label: 'RxCUI', key: 'rxcui' }, { label: 'Type', key: 'tty' }, { label: 'Name', key: 'name' }], d.concepts)) : ''}`; } })}</div>`;
  }
  if (tab === 'regulatory') {
    return slotView('drug:approvals', { linkout: [{ url: linkout('drugsatfda', ''), label: 'Drugs@FDA' }], emptyMsg: 'No Drugs@FDA application records matched in openFDA. Investigational drugs will not have FDA approval records.', render: function (d) {
      return H`<div class="ow-disclaimer">${SAFETY.approvals}</div><div class="ow-stack">${d.items.map(function (r) { var a = r.data; return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${a.appl} · ${a.sponsor || ''}</div><div class="ow-card-sub">${a.generic.join('; ')}</div></div><div class="ow-badges">${confBadge(a.confidence)}${badge(/^BLA/.test(a.appl) ? 'BLA (biologic)' : /^NDA/.test(a.appl) ? 'NDA' : /^ANDA/.test(a.appl) ? 'ANDA (generic)' : 'Application', 'outline')}</div></div>
        ${table([{ label: 'Product', render: function (p) { return p.number; } }, { label: 'Brand', render: function (p) { return p.brand; } }, { label: 'Dosage form', render: function (p) { return p.form; } }, { label: 'Route', render: function (p) { return p.route; } }, { label: 'Strength / ingredient', render: function (p) { return p.ingredients.join('; '); } }, { label: 'Marketing status', render: function (p) { return badge(p.status || 'Not reported', /Prescription|Over-the-counter/i.test(p.status || '') ? 'good' : /Discontinued/i.test(p.status || '') ? 'bad' : 'outline'); } }, { label: 'Reference drug', render: function (p) { return p.reference || '—'; } }], a.products)}
        ${provView(r.prov)}</div>`; })}</div>`; } });
  }
  if (tab === 'label') {
    var ls = slot('drug:labels');
    return slotView('drug:labels', { linkout: [{ url: linkout('dailymed', c.drug), label: 'Search DailyMed' }], emptyMsg: 'No openFDA SPL label matched this name.', render: function (d) {
      var sel2 = d.items.length > 1 ? H`<div class="ow-field" style="max-width:520px;margin-bottom:10px"><label class="ow-label" for="drug-label-pick">Label (${d.items.length} candidates, ranked by match confidence)</label><select id="drug-label-pick" class="ow-select" data-change="drug-label-pick">${d.items.map(function (r, i) { return H`<option value="${i}" ${i === (ui('drug').labelIdx || 0) ? raw('selected') : ''}>${r.data.confidence} · ${r.title} · ${r.data.manufacturer[0] || ''} · effective ${fdaDate(r.data.effective)}</option>`; })}</select></div>` : '';
      var l = drugLabel();
      var secs = LABEL_SECTIONS.filter(function (s) { return l.data.sections[s[0]]; });
      return H`${sel2}<div class="ow-row">${confBadge(l.data.confidence)}${badge('Label version ' + (l.data.version || '?') + ' · effective ' + fdaDate(l.data.effective), 'outline')}${ext(LINK.dailymedSet(l.data.setId), 'Current label on DailyMed')}</div>
        <div class="ow-disclaimer">${SAFETY.label} ${SAFETY.dosage}</div>
        ${secs.map(function (s, i) { return det('lbl-' + l.data.setId + '-' + s[0], H`${s[1]}${s[0] === 'boxed_warning' ? badge('Boxed warning', 'bad') : ''}${s[0] === 'dosage_and_administration' ? badge('Source-reported; not a dosing recommendation', 'warn') : ''}`, H`<p class="ow-pre">${trunc(l.data.sections[s[0]], 20000)}</p>`, s[0] === 'boxed_warning' || s[0] === 'indications_and_usage'); })}
        ${!secs.length ? nr() : ''}${provView(l.prov)}`; } });
  }
  if (tab === 'approvals') {
    return slotView('drug:approvals', { emptyMsg: 'No approval history in openFDA Drugs@FDA for this name.', render: function (d) {
      var subs = []; d.items.forEach(function (r) { r.data.submissions.forEach(function (s) { subs.push(Object.assign({ appl: r.data.appl }, s)); }); });
      subs.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      return H`<div class="ow-disclaimer">${SAFETY.approvals}</div>${table([{ label: 'Date', render: function (s) { return fdaDate(s.date); } }, { label: 'Application', render: function (s) { return s.appl; } }, { label: 'Submission', render: function (s) { return (s.type || '') + ' ' + (s.number || ''); } }, { label: 'Status', render: function (s) { return badge(s.status === 'AP' ? 'Approved (AP)' : s.status || '—', s.status === 'AP' ? 'good' : 'outline'); } }, { label: 'Class', render: function (s) { return s.classCode || '—'; } }, { label: 'Review', render: function (s) { return s.priority || '—'; } }, { label: 'Documents', render: function (s) { return s.docs.slice(0, 3).map(function (x) { return H`<div>${ext(x.url, x.type || 'Document')}</div>`; }); } }], subs.slice(0, 80), 'Submissions timeline (newest first)')}`; } });
  }
  if (tab === 'safety') {
    if (slot('drug:events').status === 'idle') load('drug:events', 'openfda-drug', function (s) { return Loaders.drugEvents(s, c); });
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.drugAE}</strong> Counts reflect reports received by FAERS as indexed by openFDA, not incidence.</div></div>
      <div class="ow-section">${slotView('drug:events', { linkout: [{ url: linkout('faers', ''), label: 'FAERS Public Dashboard' }, { url: linkout('medwatch', ''), label: 'MedWatch' }], emptyMsg: 'No FAERS reports matched this name in openFDA.', render: function (d) {
        return H`<div class="ow-stat-grid">${stat(d.total, 'Reports mentioning this drug (any role)', 'openFDA FAERS')}${d.serious ? d.serious.map(function (x) { return stat(x.count, x.term === 1 || x.term === '1' ? 'Serious reports' : 'Non-serious reports', 'serious flag'); }) : ''}${stat(d.lastUpdated || '—', 'Dataset last updated', 'openFDA meta')}</div>
          <div class="ow-grid-2 ow-section"><div class="ow-card"><div class="ow-card-title">Most frequently reported reactions (MedDRA PT)</div>${d.reactions ? bars(d.reactions.map(function (x) { return [titleCase(x.term), x.count]; }), { max: 15, label: 'Reported reactions', color: 'var(--ow-warn)' }) : nr()}</div>
          <div class="ow-card"><div class="ow-card-title">Reported reaction outcomes</div>${d.outcomes ? bars(d.outcomes.map(function (x) { return [{ 1: 'Recovered/resolved', 2: 'Recovering/resolving', 3: 'Not recovered/not resolved', 4: 'Recovered with sequelae', 5: 'Fatal', 6: 'Unknown' }[x.term] || String(x.term), x.count]; }), { label: 'Outcomes', color: 'var(--ow-bad)' }) : nr()}</div></div>
          ${d.partial ? H`<p class="ow-subtle">Some aggregations could not be loaded.</p>` : ''}
          <div class="ow-card-foot">${extBtn(linkout('faers', ''), 'FAERS Public Dashboard (official)')}${extBtn(linkout('medwatch', ''), 'FDA MedWatch safety alerts')}</div>`; } })}</div>`;
  }
  if (tab === 'enforcement') {
    if (slot('drug:enf').status === 'idle') load('drug:enf', 'openfda-drug', function (s) { return Loaders.drugEnforcement(s, c); });
    return H`<div class="ow-disclaimer">${SAFETY.drugEnf}</div>${slotView('drug:enf', { emptyMsg: 'No drug enforcement reports matched in openFDA.', linkout: [{ url: 'https://www.accessdata.fda.gov/scripts/ires/index.cfm', label: 'FDA Enforcement Report' }], render: function (d) {
      return H`<div class="ow-stack">${d.items.map(function (r) { var e = r.data; return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${e.recallNumber || e.eventId} · ${e.firm || ''}</div><div class="ow-card-sub">${trunc(e.product, 200)}</div></div><div class="ow-badges">${recallBadge(e.classification)}${badge(e.status || 'Status not reported', 'outline')}</div></div><div class="ow-card-body"><strong>Reason:</strong> ${e.reason || nr()}<div class="ow-subtle">Initiated ${e.initiated || '—'} · Reported ${e.reported || '—'} · ${[e.city, e.state, e.country].filter(Boolean).join(', ')} · ${e.voluntary || ''}</div></div>${provView(r.prov)}</div>`; })}</div>`; } })}`;
  }
  if (tab === 'trials') {
    return H`<div class="ow-notice ow-notice-info">${icon('info')}<div>${SAFETY.trials}</div></div>${slotView('trials:list', { skeleton: 2, emptyMsg: 'No ClinicalTrials.gov studies list this intervention.', render: function (d) {
      return H`${table([{ label: 'NCT ID', render: function (r) { return H`<button type="button" class="ow-linkbtn ow-mono" data-act="open-rec" data-key="${r.key}">${r.data.nct}</button>`; } }, { label: 'Title', render: function (r) { return r.data.briefTitle; } }, { label: 'Status', render: function (r) { return statusBadge(r.data.status); } }, { label: 'Phase', render: function (r) { return phaseBadges(r.data.phases); } }, { label: 'Conditions', render: function (r) { return r.data.conditions.slice(0, 3).join('; '); } }, { label: 'Sponsor', render: function (r) { return r.data.sponsor; } }], d.items, num(d.total) + ' studies list this intervention')}<div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="trials">Open Trials module</button></div>`; } })}`;
  }
  if (tab === 'chemistry') {
    var anyLoaded = slot('drug:chembl').status !== 'idle' || slot('drug:pubchem').status !== 'idle';
    return H`${anyLoaded ? '' : autoAct('drug:chem', 'drug-chem', {}, [{ url: linkout('chembl', c.drug), label: 'Search ChEMBL' }, { url: linkout('pubchem', c.drug), label: 'Search PubChem' }], 'chemical context (ChEMBL, PubChem)')}
      ${anyLoaded ? H`<div class="ow-grid-2"><div class="ow-card">${sectionHead('ChEMBL', ['chembl'])}${slotView('drug:chembl', { skeleton: 1, linkout: [{ url: linkout('chembl', c.drug), label: 'Search ChEMBL' }], emptyMsg: 'ChEMBL returned no molecule for this name.', render: function (d) { var m = d.molecule;
          return H`<dl class="ow-kv"><dt>ChEMBL ID</dt><dd>${ext(LINK.chembl(m.id), m.id)}</dd><dt>Preferred name</dt><dd>${orNR(m.name)}</dd><dt>Molecule type</dt><dd>${orNR(m.type)}</dd><dt>Max phase</dt><dd>${m.maxPhase != null ? m.maxPhase : nr()}</dd><dt>First approval</dt><dd>${orNR(m.firstApproval)}</dd><dt>Synonyms</dt><dd>${m.synonyms.join('; ') || nr()}</dd>${m.props && m.props.full_mwt ? H`<dt>Molecular weight</dt><dd>${m.props.full_mwt}</dd><dt>Formula</dt><dd>${orNR(m.props.full_molformula)}</dd>` : ''}</dl>
            <h4 style="margin-top:12px">Mechanisms of action</h4>${d.mechanisms.length ? H`<ul>${d.mechanisms.map(function (x) { return H`<li>${x.moa || ''} ${badge(x.action || '', 'outline')} <span class="ow-subtle">${x.target || ''}</span>${x.comment ? H`<div class="ow-small ow-muted">${x.comment}</div>` : ''}</li>`; })}</ul>` : nr()}`; } })}</div>
        <div class="ow-card">${sectionHead('PubChem', ['pubchem'])}${slotView('drug:pubchem', { skeleton: 1, linkout: [{ url: linkout('pubchem', c.drug), label: 'Search PubChem' }], emptyMsg: 'PubChem has no compound for this name (biologics are usually not compounds).', render: function (d) { var p = d.props;
          return H`<dl class="ow-kv"><dt>CID</dt><dd>${ext(LINK.pubchemCid(p.CID), String(p.CID))}</dd><dt>Formula</dt><dd>${orNR(p.MolecularFormula)}</dd><dt>Molecular weight</dt><dd>${orNR(p.MolecularWeight)}</dd><dt>XLogP</dt><dd>${p.XLogP != null ? p.XLogP : nr()}</dd><dt>InChIKey</dt><dd class="ow-mono">${orNR(p.InChIKey)}</dd><dt>IUPAC name</dt><dd class="ow-break ow-small">${orNR(p.IUPACName)}</dd></dl>`; } })}</div></div>` : ''}
      <div class="ow-section">${sectionHead('Gene interactions (DGIdb)', ['dgidb'])}<p class="ow-subtle">${SAFETY.dgidb}</p>${slot('drug:dgidb').status === 'idle' ? autoAct('drug:dgidb', 'try-live', { 'data-what': 'dgidb-drug' }, [{ url: LINK.dgidbDrug(c.drug), label: 'DGIdb' }], 'DGIdb gene interactions') : slotView('drug:dgidb', { skeleton: 1, linkout: [{ url: LINK.dgidbDrug(c.drug), label: 'DGIdb' }], emptyMsg: 'DGIdb has no interaction records for this drug name.', render: function (d) {
        return H`${table([{ label: 'Gene', render: function (x) { return H`<button type="button" class="ow-linkbtn" data-act="search-as" data-term="${x.gene}" data-type="gene">${x.gene}</button>`; } }, { label: 'Interaction type', render: function (x) { return x.types.join(', ') || '—'; } }, { label: 'Score', render: function (x) { return x.score != null ? Number(x.score).toFixed(2) : '—'; } }, { label: 'Sources', render: function (x) { return x.sources.slice(0, 4).join(', '); } }], d.items.slice(0, 25))}${provView(d.prov)}`; } })}</div>`;
  }
  if (tab === 'cdx') {
    var cs = slot('drug:cdx');
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.cdx}</div></div>
      <div class="ow-card-foot">${extBtn(linkout('fda-cdx', ''), 'FDA companion-diagnostics list (official CDx source)', { primary: true })}${cs.status === 'idle' ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="drug-cdx">${icon('device')}Find companion diagnostics</button>` : ''}</div>
      ${cs.status === 'idle' ? H`<p class="ow-subtle" style="margin-top:8px">Opt-in: scans the loaded label for diagnostic-test statements and searches openFDA PMA approval-order text for this drug name (1–2 requests).</p>` : ''}
      <div class="ow-section">${slotView('drug:cdx', { emptyMsg: 'No diagnostic statements in the label and no device records naming this drug. Check the FDA list.', render: function (d) { return cdxView(d); } })}</div>`;
  }
  return '';
}
function cdxView(d) {
  return H`${d.sentences.length ? H`<div class="ow-card"><div class="ow-card-title">Label statements about diagnostic testing (quoted from the current openFDA label)</div><ul style="margin-top:6px">${d.sentences.map(function (s) { return H`<li style="margin-bottom:6px"><q>${s.text}</q> <span class="ow-subtle">— ${humanEnum(s.section)}</span></li>`; })}</ul></div>` : (d.labelLoaded ? H`<p class="ow-subtle">No diagnostic-test statements found in the loaded label sections.</p>` : H`<p class="ow-subtle">No label loaded, so label text was not scanned.</p>`)}
    <div class="ow-section"><h3 style="margin-bottom:8px">Candidate diagnostics (derived by Oncotics)</h3>${d.candidates.length ? H`<div class="ow-stack">${d.candidates.map(function (x) { var r = x.rec, a = r.data;
      return H`<div class="ow-card" style="border-style:dashed"><div class="ow-card-head"><div style="min-width:0"><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${a.deviceName || a.genericName || a.number}</button></div><div class="ow-card-sub">${a.number} · ${a.applicant || ''} · product code ${a.productCode || '—'} · ${a.deviceClass || 'class not reported'} · ${a.panel || ''}</div></div>
        <div class="ow-badges">${badge('Derived link', 'derived')}${confBadge(x.confidence)}${pathwayBadge(a)}${lagBadge()}</div></div>
        <p class="ow-small" style="margin-top:6px"><strong>Basis:</strong> ${x.basis}</p>${x.quote ? H`<p class="ow-small ow-muted"><q>${trunc(x.quote, 400)}</q></p>` : ''}
        <div class="ow-card-foot">${recActions(r)}${extBtn(LINK.pma(a.number), 'Official FDA PMA record')}</div></div>`; })}</div>` : H`<p class="ow-subtle">No device records named this drug. Unresolved — check the FDA list.</p>`}</div>`;
}
registerModule({
  id: 'drug-intelligence', label: 'Drug Intelligence', icon: 'pill',
  count: function () { return State.ctx && State.ctx.type === 'drug' ? slotTotal('drug:labels') : null; },
  onOpen: function () { if (State.ctx && State.ctx.type === 'drug' && slot('drug:events').status === 'idle' && (ui('drug').tab || 'identity') === 'safety') load('drug:events', 'openfda-drug', function (s) { return Loaders.drugEvents(s, State.ctx); }); },
  render: function () {
    var c = State.ctx;
    if (!c) return H`${moduleHead('drug-intelligence')}${noQuery('drug intelligence')}`;
    if (c.type !== 'drug') {
      var th = linkedTherapies();
      var trialDrugs = slot('trials:list').status === 'ok' ? countBy(slot('trials:list').data.items, function (r) { return r.data.interventions.filter(function (i) { return /DRUG|BIOLOGICAL/.test(i.type); }).map(function (i) { return i.name; }); }).slice(0, 12) : [];
      return H`${moduleHead('drug-intelligence')}<div class="ow-empty"><h3>Drug Intelligence opens for drug queries</h3><p>Search a generic or brand name (e.g. Osimertinib or Tagrisso), or pick a therapy linked to your current query.</p></div>
        ${th.length ? H`<div class="ow-section"><h3 style="margin-bottom:8px">Therapies in CIViC evidence for this query</h3><div class="ow-row">${th.slice(0, 20).map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${t[0]}" data-type="drug">${icon('pill')}${t[0]} <span class="ow-subtle">(${t[1]})</span></button>`; })}</div></div>` : ''}
        ${trialDrugs.length ? H`<div class="ow-section"><h3 style="margin-bottom:8px">Drug interventions in the current trial page</h3><div class="ow-row">${trialDrugs.map(function (t) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${t[0]}" data-type="drug">${icon('pill')}${t[0]}</button>`; })}</div></div>` : ''}`;
    }
    var L = drugLabel(), ap = drugApprovals();
    var tab = ui('drug').tab || 'identity';
    var status = uniq(ap.reduce(function (a, r) { return a.concat(r.data.products.map(function (p) { return p.status; })); }, [])).filter(Boolean);
    var name = titleCase(c.drug);
    return H`${moduleHead('drug-intelligence', H`<button type="button" class="ow-btn ow-btn-sm" data-act="copy-ids" data-kind="appl">${icon('copy')}Copy application numbers</button>${extBtn(linkout('dailymed', c.drug), 'DailyMed')}${extBtn(linkout('drugsatfda', ''), 'Drugs@FDA')}`)}
      <div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title" style="font-size:1.2rem">${name}</div><div class="ow-card-sub">${L ? (L.data.brand.join(', ') || L.title) : 'No FDA label matched'}${L && L.data.manufacturer.length ? ' · ' + L.data.manufacturer[0] : ''}</div></div>
        <div class="ow-badges">${L ? confBadge(L.data.confidence) : ''}${status.map(function (s) { return badge(s, /Prescription|Over-the-counter/i.test(s) ? 'good' : /Discontinued/i.test(s) ? 'bad' : 'outline'); })}${L ? L.data.productType.map(function (p) { return badge(titleCase(p), 'outline'); }) : ''}${L ? L.data.route.map(function (p) { return badge(titleCase(p), 'outline'); }) : ''}</div></div>
        <p class="ow-subtle" style="margin-top:6px">Application numbers: ${uniq(ap.map(function (r) { return r.data.appl; }).concat(L ? L.data.appl : [])).join(', ') || 'not reported'}${slot('drug:rxnorm').status === 'ok' && slot('drug:rxnorm').data.rxcui ? ' · RxCUI ' + slot('drug:rxnorm').data.rxcui : ''}${slot('drug:chembl').status === 'ok' ? ' · ChEMBL ' + slot('drug:chembl').data.molecule.id : ''}${slot('drug:pubchem').status === 'ok' ? ' · PubChem CID ' + slot('drug:pubchem').data.props.CID : ''}</p>
        <div class="ow-card-foot">${L ? recActions(L) : ''}<button type="button" class="ow-btn ow-btn-sm" data-act="drug-cdx">${icon('device')}Find companion diagnostics</button>${extBtn(linkout('ctgov', c.drug), 'Trials on ClinicalTrials.gov')}</div></div>
      <div class="ow-subtabs ow-section" role="tablist" aria-label="Drug sections">${DRUG_TABS.map(function (t) { return H`<button type="button" role="tab" class="ow-subtab" aria-selected="${tab === t[0] ? 'true' : 'false'}" data-act="drug-tab" data-tab="${t[0]}">${t[1]}</button>`; })}</div>
      <div role="tabpanel">${safeRender(function () { return drugSubtab(tab); }, 'This section')}</div>`;
  },
  exportRows: function () {
    var ap = drugApprovals(); if (!ap.length) return null;
    var rows = []; ap.forEach(function (r) { r.data.products.forEach(function (p) { rows.push({ appl: r.data.appl, sponsor: r.data.sponsor, p: p, conf: r.data.confidence }); }); });
    return { name: 'drug-products', rows: rows, cols: [{ label: 'Application', get: function (x) { return x.appl; } }, { label: 'Sponsor', get: function (x) { return x.sponsor; } }, { label: 'Brand', get: function (x) { return x.p.brand; } }, { label: 'Dosage form', get: function (x) { return x.p.form; } }, { label: 'Route', get: function (x) { return x.p.route; } }, { label: 'Marketing status', get: function (x) { return x.p.status; } }, { label: 'Ingredients', get: function (x) { return x.p.ingredients.join('; '); } }, { label: 'Match confidence', get: function (x) { return x.conf; } }] };
  }
});
DETAIL.label = function (r) { return H`<p>${r.data.spl ? trunc(r.data.spl, 300) : ''}</p><div class="ow-badges">${confBadge(r.data.confidence)}</div><dl class="ow-kv ow-section"><dt>Brand</dt><dd>${r.data.brand.join('; ') || nr()}</dd><dt>Generic</dt><dd>${r.data.generic.join('; ') || nr()}</dd><dt>Manufacturer</dt><dd>${r.data.manufacturer.join('; ') || nr()}</dd><dt>Application</dt><dd>${r.data.appl.join('; ') || nr()}</dd><dt>Effective</dt><dd>${fdaDate(r.data.effective)}</dd></dl><div class="ow-disclaimer">${SAFETY.label}</div><div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="drug-intelligence">Open in Drug Intelligence</button></div>${provView(r.prov)}`; };
DETAIL.approval = function (r) { var a = r.data; return H`<div class="ow-badges">${confBadge(a.confidence)}</div><dl class="ow-kv ow-section"><dt>Application</dt><dd>${ext(LINK.applNo(a.appl), a.appl)}</dd><dt>Sponsor</dt><dd>${orNR(a.sponsor)}</dd><dt>Products</dt><dd>${a.products.map(function (p) { return H`<div>${p.brand} · ${p.form} · ${p.route} · ${p.status}</div>`; })}</dd><dt>Latest submission</dt><dd>${a.submissions[0] ? a.submissions[0].type + ' ' + a.submissions[0].number + ' · ' + fdaDate(a.submissions[0].date) : nr()}</dd></dl><div class="ow-disclaimer">${SAFETY.approvals}</div>${provView(r.prov)}`; };
DETAIL['drug-enforcement'] = function (r) { var e = r.data; return H`<div class="ow-badges">${recallBadge(e.classification)}${badge(e.status || '', 'outline')}</div><dl class="ow-kv ow-section"><dt>Product</dt><dd>${orNR(e.product)}</dd><dt>Reason</dt><dd>${orNR(e.reason)}</dd><dt>Firm</dt><dd>${orNR(e.firm)}</dd><dt>Distribution</dt><dd>${orNR(e.distribution)}</dd></dl><div class="ow-disclaimer">${SAFETY.drugEnf}</div>${provView(r.prov)}`; };

/* ====================================================================
   MODULE 5: DEVICES & DX (openFDA device endpoints; may lag official DBs)
   ==================================================================== */
var DEV_TABS = [['overview', 'Overview'], ['cdx', 'Companion Dx & IVDs'], ['auth', 'Authorizations'], ['class', 'Classification & UDI'], ['events', 'Adverse events (MAUDE)'], ['recalls', 'Recalls & enforcement']];
function devFilters() { var u = ui('devices'); u.filters = u.filters || {}; return u.filters; }
function devFilter(items) {
  var f = devFilters();
  return items.filter(function (r) {
    var d = r.data;
    if (f.pathway && d.pathway !== f.pathway) return false;
    if (f.cls && d.deviceClass !== f.cls) return false;
    if (f.panel && d.panel !== f.panel) return false;
    if (f.tag && arr(d.tags).indexOf(f.tag) < 0) return false;
    return true;
  }).sort(function (a, b) {
    var s = f.sort || 'date';
    if (s === 'class') return String(b.data.deviceClass || '').localeCompare(String(a.data.deviceClass || ''));
    if (s === 'code') return String(a.data.productCode || '').localeCompare(String(b.data.productCode || ''));
    return String(b.data.decisionDate || '').localeCompare(String(a.data.decisionDate || ''));
  });
}
function authCard(r) {
  var a = r.data;
  return H`<article class="ow-card ow-fade"><div class="ow-card-head"><div style="min-width:0"><div class="ow-row"><span class="ow-mono ow-small">${a.number}</span>${a.productCode ? badge('Product code ' + a.productCode, 'outline') : ''}</div>
    <div class="ow-card-title" style="margin-top:2px"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${a.deviceName || a.genericName || 'Device name not reported'}</button></div><div class="ow-card-sub">${a.applicant || 'Applicant not reported'}${a.genericName && a.deviceName ? ' · ' + a.genericName : ''}</div></div>
    <div class="ow-badges">${pathwayBadge(a)}${classBadge(a.deviceClass)}${a.panel ? badge(a.panel, 'outline') : ''}${arr(a.tags).slice(0, 2).map(function (t) { return badge(t, 'device'); })}</div></div>
    <p class="ow-small" style="margin-top:6px">${a.decision.label} · decision ${a.decisionDate || '—'}${a.received ? ' · received ' + a.received : ''}${a.pathway === 'PMA' && a.supplements.length ? ' · ' + a.supplements.length + ' supplement record' + (a.supplements.length > 1 ? 's' : '') : ''}</p>
    ${a.aoStatement ? H`<div class="ow-card-body">${more('ao' + r.key, a.aoStatement, 240)}</div>` : ''}
    <div class="ow-card-foot">${recActions(r)}${extBtn(a.pathway === 'PMA' ? LINK.pma(a.number) : LINK.k510(a.number), 'Official FDA record')}${lagBadge()}</div>${provView(r.prov)}</article>`;
}
function devSubtab(tab) {
  var c = State.ctx;
  var noDevQuery = c.type !== 'device';
  if (tab === 'overview') {
    var au = slot('dev:auth');
    return H`<div class="ow-disclaimer">${SAFETY.devOverview}</div>
      <div class="ow-stat-grid">${statFor('dev:auth', 'Authorizations (510(k), De Novo, PMA)', 'openfda-device')}${statFor('dev:class', 'Classification records', 'openfda-device')}${statFor('dev:udi', 'UDI records', 'openfda-device')}${statFor('dev:events', 'Adverse-event reports (MAUDE)', 'openfda-device')}${statFor('dev:recalls', 'Recall / enforcement records', 'openfda-device')}${statFor('lit:list', 'Literature', 'europepmc')}</div>
      ${au.status === 'ok' ? H`<div class="ow-grid ow-section"><div class="ow-card"><div class="ow-card-title">Clearance vs approval</div>${bars(countBy(au.data.items, function (r) { return r.data.pathway === 'PMA' ? 'Approval (PMA)' : r.data.pathway === 'De Novo' ? 'De Novo' : 'Clearance (510(k))'; }), { color: 'var(--ow-device)' })}</div><div class="ow-card"><div class="ow-card-title">Device class</div>${bars(countBy(au.data.items, function (r) { return r.data.deviceClass || 'Not reported'; }), { color: 'var(--ow-device)' })}</div><div class="ow-card"><div class="ow-card-title">Top product codes</div>${bars(countBy(au.data.items, function (r) { return r.data.productCode; }), { max: 8, color: 'var(--ow-device)' })}</div></div>
        <div class="ow-section"><h3 style="margin-bottom:8px">Top matched device</h3>${authCard(au.data.items[0])}</div>` : slotView('dev:auth', { emptyMsg: 'No authorization records matched.', render: function () { return ''; } })}
      <div class="ow-card-foot ow-section">${c.drugHint ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${c.drugHint}" data-type="drug">${icon('pill')}Drug Intelligence: ${c.drugHint}</button>` : ''}${c.geneHint ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${c.geneHint}" data-type="gene">${icon('dna')}Evidence &amp; biology: ${c.geneHint}</button>` : ''}<button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="trials">${icon('trial')}Trials using this device</button><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="literature">${icon('book')}Literature</button></div>`;
  }
  if (tab === 'cdx') {
    var gdx = slot('dev:gene-dx');
    var gene = c.geneHint || c.gene;
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.cdx}</div></div>
      <div class="ow-notice ow-notice-info">${icon('info')}<div><strong>IVD</strong> = in vitro diagnostic. <strong>CDx</strong> = companion diagnostic that informs a drug’s use. <strong>LDT</strong> = laboratory developed test, regulated differently; Oncotics never labels an LDT as FDA-cleared.</div></div>
      <div class="ow-card-foot">${extBtn(linkout('fda-cdx', ''), 'FDA companion-diagnostics list (official CDx source)', { primary: true })}${gene && gdx.status === 'idle' ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="gene-dx" data-gene="${gene}">${icon('device')}Find diagnostics that detect ${gene}</button>` : ''}${c.drugHint ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${c.drugHint}" data-type="drug">Find CDx for ${c.drugHint} (Drug Intelligence)</button>` : ''}</div>
      ${gdx.status !== 'idle' ? H`<div class="ow-section">${sectionHead('Diagnostics that may detect ' + (gdx.data && gdx.data.gene || gene), ['openfda-device'], badge('Derived', 'derived'))}${slotView('dev:gene-dx', { emptyMsg: 'No device records name this gene.', render: function (d) { return H`<div class="ow-stack">${d.candidates.slice(0, 30).map(function (x) { var a = x.rec.data; return H`<div class="ow-card" style="border-style:dashed"><div class="ow-card-head"><div><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${x.rec.key}">${a.deviceName || a.genericName}</button></div><div class="ow-card-sub">${a.number} · ${a.applicant || ''} · ${a.productCode || ''}</div></div><div class="ow-badges">${confBadge(x.confidence)}${pathwayBadge(a)}${lagBadge()}</div></div><p class="ow-small"><strong>Basis:</strong> ${x.basis}</p></div>`; })}</div>`; } })}</div>` : ''}
      ${noDevQuery ? '' : H`<div class="ow-section">${sectionHead('IVD / CDx authorizations in this result', ['openfda-device'])}${slotView('dev:auth', { skeleton: 1, render: function (d) { var ivd = d.items.filter(function (r) { return arr(r.data.tags).indexOf('IVD / CDx / NGS') >= 0 || /CDx|companion/i.test((r.data.deviceName || '') + (r.data.aoStatement || '')); }); return ivd.length ? H`<div class="ow-stack">${ivd.slice(0, 20).map(authCard)}</div>` : H`<p class="ow-subtle">No IVD/CDx-type records in the loaded authorizations.</p>`; } })}</div>`}`;
  }
  if (noDevQuery) return H`<div class="ow-empty"><h3>This section needs a device or diagnostic query</h3><p>Search a device name, 510(k)/PMA/De Novo number, product code, regulation number or UDI-DI.</p></div>`;
  if (tab === 'auth') {
    var f = devFilters();
    var s = slot('dev:auth');
    var opts = s.status === 'ok' ? { panels: uniq(s.data.items.map(function (r) { return r.data.panel; })).filter(Boolean), classes: uniq(s.data.items.map(function (r) { return r.data.deviceClass; })).filter(Boolean), tags: uniq(s.data.items.reduce(function (a, r) { return a.concat(r.data.tags); }, [])) } : { panels: [], classes: [], tags: [] };
    return H`<div class="ow-disclaimer">${SAFETY.devAuth} ${SAFETY.devices}</div>
      <form class="ow-filters" data-submit="dev-filters" style="margin-bottom:10px">${sel('dv-path', 'Authorization type', [['', 'Any'], ['510(k)', 'Clearance — 510(k)'], ['De Novo', 'De Novo classification'], ['PMA', 'Approval — PMA']], f.pathway)}${sel('dv-cls', 'Device class', [['', 'Any']].concat(opts.classes), f.cls)}${sel('dv-panel', 'Panel', [['', 'Any']].concat(opts.panels), f.panel)}${sel('dv-tag', 'Oncology relevance', [['', 'Any']].concat(opts.tags), f.tag)}${sel('dv-sort', 'Sort', [['date', 'Decision date (newest)'], ['class', 'Device class'], ['code', 'Product code']], f.sort)}<div class="ow-row"><button type="submit" class="ow-btn ow-btn-primary ow-btn-sm">Apply</button></div></form>
      ${slotView('dev:auth', { linkout: [{ url: linkout('fda-510k', ''), label: 'FDA 510(k) database' }, { url: linkout('fda-pma', ''), label: 'FDA PMA database' }], emptyMsg: 'No 510(k), De Novo or PMA records matched in openFDA.', render: function (d) {
        var items = devFilter(d.items);
        var view = ui('devices').view || 'cards';
        return H`<p class="ow-subtle">${num(d.totals['510k'] || 0)} 510(k)/De Novo and ${num(d.totals.pma || 0)} PMA source rows matched; PMA supplements are grouped under their PMA number. Showing ${items.length}.</p>
          ${view === 'table' ? table([{ label: 'Number', render: function (r) { return H`<button type="button" class="ow-linkbtn ow-mono" data-act="open-rec" data-key="${r.key}">${r.data.number}</button>`; } }, { label: 'Pathway', render: function (r) { return pathwayBadge(r.data); } }, { label: 'Device', render: function (r) { return r.data.deviceName; } }, { label: 'Applicant', render: function (r) { return r.data.applicant; } }, { label: 'Code', render: function (r) { return r.data.productCode; } }, { label: 'Class', render: function (r) { return r.data.deviceClass || '—'; } }, { label: 'Decision', render: function (r) { return r.data.decisionDate; } }], items) : H`<div class="ow-stack">${items.slice(0, 60).map(authCard)}</div>`}`; } })}`;
  }
  if (tab === 'class') {
    if (slot('dev:class').status === 'idle') load('dev:class', 'openfda-device', function (sg) { return Loaders.devClass(sg, c); });
    if (slot('dev:udi').status === 'idle') load('dev:udi', 'openfda-device', function (sg) { return Loaders.devUDI(sg, c); });
    return H`<div class="ow-disclaimer">${SAFETY.devClass}</div>
      <div class="ow-section">${sectionHead('Device classification', ['openfda-device'], lagBadge())}${slotView('dev:class', { linkout: [{ url: linkout('fda-classification', ''), label: 'FDA classification database' }], emptyMsg: 'No classification record matched.', render: function (d) {
        return table([{ label: 'Product code', render: function (r) { return H`<button type="button" class="ow-linkbtn ow-mono" data-act="open-rec" data-key="${r.key}">${r.data.productCode}</button>`; } }, { label: 'Device name', render: function (r) { return r.data.deviceName; } }, { label: 'Class', render: function (r) { return classBadge(r.data.deviceClass); } }, { label: 'Regulation (21 CFR)', render: function (r) { return r.data.regulation ? ext(LINK.cfr(r.data.regulation), r.data.regulation) : nr(); } }, { label: 'Panel', render: function (r) { return r.data.panel || '—'; } }, { label: 'Submission', render: function (r) { return r.data.submissionType || '—'; } }, { label: 'Oncology tags', render: function (r) { return r.data.tags.map(function (t) { return badge(t, 'device'); }); } }, { label: 'Official', render: function (r) { return ext(LINK.productCode(r.data.productCode), 'FDA'); } }], d.items, 'openFDA classification records');
      } })}</div>
      <div class="ow-section">${sectionHead('Unique Device Identification (GUDID-derived)', ['openfda-device'], lagBadge())}${slotView('dev:udi', { linkout: [{ url: linkout('gudid', c.deviceText || (c.deviceId && c.deviceId.value) || ''), label: 'AccessGUDID' }], emptyMsg: 'No UDI records matched.', render: function (d) {
        return table([{ label: 'UDI-DI', render: function (r) { return r.data.di ? ext(LINK.gudid(r.data.di), r.data.di) : nr(); } }, { label: 'Brand / model', render: function (r) { return (r.data.brand || '') + (r.data.model ? ' · ' + r.data.model : ''); } }, { label: 'Company', render: function (r) { return r.data.company; } }, { label: 'Product codes', render: function (r) { return r.data.productCodes.map(function (p) { return p.code; }).join(', '); } }, { label: 'Premarket', render: function (r) { return r.data.submissions.slice(0, 4).join(', '); } }, { label: 'Distribution', render: function (r) { return r.data.distribution || '—'; } }, { label: 'Rx / OTC', render: function (r) { return r.data.rx === 'true' ? 'Rx' : r.data.otc === 'true' ? 'OTC' : '—'; } }], d.items, 'Device-level identifiers only; no production identifiers (lot/serial) are requested or displayed.');
      } })}</div>`;
  }
  if (tab === 'events') {
    var ev = slot('dev:events');
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.maude}</strong> Structured fields only. Free-text narratives are hidden and can be opened one report at a time.</div></div>
      <div class="ow-notice ow-notice-info">${icon('shield')}<div>${SAFETY.phi} Device serial numbers, lot numbers and patient–device pairings are not accepted, displayed or stored.</div></div>
      <div class="ow-card-foot">${ev.status === 'idle' ? autoAct('dev:events', 'dev-events', {}, [], 'adverse-event summary (openFDA)') : ''}${extBtn(LINK.maude(), 'MAUDE public query tool (official)')}</div>
      <div class="ow-section">${slotView('dev:events', { emptyMsg: 'No MAUDE-derived reports matched in openFDA.', linkout: [{ url: LINK.maude(), label: 'MAUDE' }], render: function (d) {
        return H`<div class="ow-grid-2"><div class="ow-card"><div class="ow-card-title">Report type (all ${num(d.total)} matching)</div>${d.byType ? bars(d.byType.map(function (x) { return [x.term, x.count]; }), { color: 'var(--ow-warn)' }) : nr()}</div><div class="ow-card"><div class="ow-card-title">Most reported product problems</div>${d.problems ? bars(d.problems.map(function (x) { return [x.term, x.count]; }), { color: 'var(--ow-device)' }) : nr()}</div></div>
          <div class="ow-section">${table([{ label: 'Report', render: function (r) { return H`<button type="button" class="ow-linkbtn ow-mono" data-act="open-rec" data-key="${r.key}">${r.data.reportNumber || r.data.mdrKey}</button>`; } }, { label: 'Type', render: function (r) { return badge(r.data.eventType || 'Not reported', /Death/i.test(r.data.eventType) ? 'bad' : /Injury/i.test(r.data.eventType) ? 'warn' : 'outline'); } }, { label: 'Event date', render: function (r) { return r.data.eventDate || '—'; } }, { label: 'Received', render: function (r) { return r.data.received || '—'; } }, { label: 'Device', render: function (r) { return r.data.devices.map(function (x) { return (x.brand || x.generic || '') + (x.productCode ? ' (' + x.productCode + ')' : ''); }).join('; '); } }, { label: 'Manufacturer', render: function (r) { return uniq(r.data.devices.map(function (x) { return x.manufacturer; })).join('; '); } }, { label: 'Problems', render: function (r) { return r.data.problems.slice(0, 3).join('; '); } }, { label: 'Narrative', render: function (r) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="narrative" data-mdr="${r.data.mdrKey}">Show source text</button>`; } }], d.items, 'Most recently received reports (structured fields)')}
          ${pager('dev-events', { page: d.page, hasPrev: d.page > 0, hasNext: (d.page + 1) * 10 < d.total && d.page < 49, total: d.total, pageSize: 10, label: 'reports' })}</div>`; } })}</div>`;
  }
  if (tab === 'recalls') {
    var rc = slot('dev:recalls');
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.recalls}</strong> Oncotics surfaces the record only and does not advise on clinical response, patient management or device replacement.</div></div>
      <div class="ow-card-foot">${rc.status === 'idle' ? autoAct('dev:recalls', 'dev-recalls', {}, [], 'recalls and enforcement (openFDA)') : ''}${extBtn(LINK.recall(), 'FDA device recall database (official)')}${extBtn(linkout('medwatch', ''), 'FDA MedWatch safety alerts')}</div>
      <div class="ow-section">${slotView('dev:recalls', { emptyMsg: 'No recall or enforcement records matched in openFDA.', render: function (d) {
        var items = d.items.slice().sort(function (a, b) { var r = function (x) { return x.data.classification === 'Class I' ? 0 : x.data.classification === 'Class II' ? 1 : 2; }; return r(a) - r(b) || String(b.data.initiated || '').localeCompare(String(a.data.initiated || '')); });
        return H`<div class="ow-card">${bars(countBy(items, function (r) { return r.data.classification || 'Classification not reported'; }), { label: 'Recall classification', color: 'var(--ow-bad)' })}</div><div class="ow-stack ow-section">${items.map(function (r) { var x = r.data; return H`<article class="ow-card" ${x.classification === 'Class I' ? raw('style="border-color:var(--ow-bad)"') : ''}><div class="ow-card-head"><div style="min-width:0"><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${x.recallNumber || x.eventNumber}</button> · ${x.firm || ''}</div><div class="ow-card-sub">${trunc(x.product, 220)}</div></div><div class="ow-badges">${recallBadge(x.classification)}${badge(x.status || 'Status not reported', 'outline')}${lagBadge()}</div></div>
          <div class="ow-card-body"><strong>Reason:</strong> ${x.reason ? trunc(x.reason, 500) : nr()}${x.rootCause ? H`<div class="ow-subtle">Root cause: ${x.rootCause}</div>` : ''}<div class="ow-subtle">Initiated ${x.initiated || '—'}${x.terminated ? ' · terminated ' + x.terminated : ''} · ${[x.state, x.country].filter(Boolean).join(', ')}${x.productCode ? ' · product code ' + x.productCode : ''}</div></div>
          <div class="ow-card-foot">${recActions(r, { noCompare: true })}${extBtn(LINK.recall(x.cfresId), 'Official FDA recall record')}</div>${provView(r.prov)}</article>`; })}</div>`; } })}</div>`;
  }
  return '';
}
registerModule({
  id: 'device-intelligence', label: 'Devices & Dx', icon: 'device',
  count: function () { return State.ctx && State.ctx.type === 'device' ? slotTotal('dev:auth') : null; },
  render: function () {
    var c = State.ctx;
    var tab = ui('devices').tab || 'overview';
    if (!c) return H`${moduleHead('device-intelligence')}<div class="ow-notice ow-notice-info">${icon('info')}<div>${SAFETY.devices} ${SAFETY.lag}</div></div>${noQuery('Devices & Dx')}`;
    var title = c.type === 'device' ? (c.deviceId ? c.deviceId.kind.toUpperCase().replace('PRODUCTCODE', 'Product code').replace('REGULATION', 'Regulation').replace('UDI', 'UDI-DI').replace('DENOVO', 'De Novo').replace('510K', '510(k)') + ' ' + c.deviceId.value : c.deviceText) : null;
    return H`${moduleHead('device-intelligence', H`${viewToggle('devices')}<button type="button" class="ow-btn ow-btn-sm" data-act="copy-ids" data-kind="device">${icon('copy')}Copy device numbers</button><button type="button" class="ow-btn ow-btn-sm" data-act="export-devices">${icon('download')}Export devices</button>`)}
      <div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>Device clearance (510(k)/De Novo) is not approval (PMA/HDE/CDH).</strong> openFDA device records are derived from FDA databases and may lag the official record; for time-critical safety or regulatory decisions, the official FDA record and your institution’s process are authoritative.</div></div>
      ${c.ldt ? H`<div class="ow-notice ow-notice-bad" style="margin-top:8px">${icon('alert')}<div>${SAFETY.ldt}</div></div>` : ''}
      ${title ? H`<h3 style="margin:12px 0 4px">${title}</h3>` : H`<p class="ow-subtle" style="margin-top:10px">Device endpoints are not loaded automatically for ${c.type} searches. Use the actions below.</p>`}
      <div class="ow-subtabs" role="tablist" aria-label="Device sections">${DEV_TABS.map(function (t) { return H`<button type="button" role="tab" class="ow-subtab" aria-selected="${tab === t[0] ? 'true' : 'false'}" data-act="dev-tab" data-tab="${t[0]}">${t[1]}</button>`; })}</div>
      <div role="tabpanel">${safeRender(function () { return devSubtab(tab); }, 'This section')}</div>`;
  },
  exportRows: function () {
    var rows = [];
    ['dev:auth', 'dev:class', 'dev:udi', 'dev:events', 'dev:recalls'].forEach(function (k) { var s = slot(k); if (s.status === 'ok') s.data.items.forEach(function (r) { rows.push(r); }); });
    if (!rows.length) return null;
    return { name: 'devices', rows: rows, cols: [{ label: 'Record type', get: function (r) { return r.type; } }, { label: 'Identifier', get: function (r) { return r.prov.recordId; } }, { label: 'Title', get: function (r) { return r.title; } },
      { label: 'Pathway', get: function (r) { return r.data.pathway || ''; } }, { label: 'Decision', get: function (r) { return r.data.decision ? r.data.decision.label : ''; } }, { label: 'Product code', get: function (r) { return r.data.productCode || arr(r.data.productCodes).map(function (p) { return p.code; }).join('; '); } },
      { label: 'Class', get: function (r) { return r.data.deviceClass || ''; } }, { label: 'Recall classification', get: function (r) { return r.data.classification || ''; } }, { label: 'Event type', get: function (r) { return r.data.eventType || ''; } },
      { label: 'Date', get: function (r) { return r.data.decisionDate || r.data.initiated || r.data.received || r.data.published || ''; } }, { label: 'Provenance', get: function (r) { return 'openFDA (may lag official FDA database)'; } }, { label: 'Official link', get: function (r) { return r.prov.url; } }] };
  }
});
function namedEntities(text) {
  // Derived cross-links: drug and gene names that literally appear in device record text.
  var words = String(text || '').split(/[^A-Za-z0-9-]+/), drugs = [], genes = [];
  words.forEach(function (w) { var lw = w.toLowerCase(); var d = DRUG_BRANDS[lw] || (DRUGS.has(lw) ? lw : null); if (d && drugs.indexOf(d) < 0) drugs.push(d); if (GENES.has(w) && !GENE_WORDS.has(w) && genes.indexOf(w) < 0) genes.push(w); });
  return { drugs: drugs.slice(0, 12), genes: genes.slice(0, 12) };
}
DETAIL['device-auth'] = function (r) {
  var a = r.data;
  var named = namedEntities([a.deviceName, a.genericName, a.aoStatement].concat(arr(a.supplements).map(function (s) { return s.ao; })).join(' '));
  return H`<div class="ow-badges">${pathwayBadge(a)}${classBadge(a.deviceClass)}${a.panel ? badge(a.panel, 'outline') : ''}${arr(a.tags).map(function (t) { return badge(t, 'device'); })}${lagBadge()}</div>
    <div class="ow-notice ow-notice-warn" style="margin-top:10px">${icon('alert')}<div>${a.pathway === 'PMA' ? 'PMA is an approval pathway.' : a.pathway === 'De Novo' ? 'De Novo is a classification request for novel low-to-moderate-risk devices; it is not a PMA approval.' : '510(k) is a clearance pathway (substantial equivalence); it is not an approval.'} ${SAFETY.devAuth}</div></div>
    <dl class="ow-kv ow-section"><dt>Number</dt><dd class="ow-mono">${a.number}</dd><dt>Pathway</dt><dd>${a.pathway} (${a.pathwayVerb})</dd><dt>Decision</dt><dd>${a.decision.label}</dd><dt>Decision date</dt><dd>${orNR(a.decisionDate)}</dd><dt>Received</dt><dd>${orNR(a.received)}</dd>
      <dt>Applicant</dt><dd>${orNR(a.applicant)}</dd><dt>Device name</dt><dd>${orNR(a.deviceName)}</dd>${a.genericName ? H`<dt>Generic name</dt><dd>${a.genericName}</dd>` : ''}<dt>Product code</dt><dd>${a.productCode ? H`${a.productCode} ${ext(LINK.productCode(a.productCode), 'classification')}` : nr()}</dd>
      <dt>Regulation</dt><dd>${a.regulation ? ext(LINK.cfr(a.regulation), '21 CFR ' + a.regulation) : nr()}</dd><dt>Panel</dt><dd>${orNR(a.panel)}</dd><dt>Class</dt><dd>${orNR(a.deviceClass)}</dd>${a.clearanceType ? H`<dt>510(k) type</dt><dd>${a.clearanceType}</dd>` : ''}</dl>
    ${a.aoStatement ? H`<div class="ow-section"><h4>Approval order statement / intended use (source-reported)</h4><p class="ow-pre" style="margin-top:6px">${a.aoStatement}</p></div>` : ''}
    ${a.supplements && a.supplements.length ? det('sup-' + a.number, 'PMA supplements (' + a.supplements.length + ')', table([{ label: 'Supplement', key: 'number' }, { label: 'Decision date', key: 'date' }, { label: 'Type', key: 'type' }, { label: 'Reason', key: 'reason' }, { label: 'Code', key: 'code' }, { label: 'Statement', render: function (s) { return trunc(s.ao || '', 300); } }], a.supplements.slice(0, 150))) : ''}
    ${named.drugs.length || named.genes.length ? H`<div class="ow-section ow-card" style="border-style:dashed"><div class="ow-row">${badge('Derived by Oncotics', 'derived')}${confBadge('Possible')}</div><p class="ow-small" style="margin-top:6px">Names that appear in this record’s text. This is keyword co-occurrence only, not a verified companion-diagnostic claim; check the FDA companion-diagnostics list and the drug label.</p>
      <div class="ow-row" style="margin-top:6px">${named.drugs.map(function (d) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${d}" data-type="drug">${icon('pill')}${titleCase(d)}</button>`; })}${named.genes.map(function (g) { return H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${g}" data-type="gene">${icon('dna')}${g}</button>`; })}</div><div class="ow-card-foot">${extBtn(linkout('fda-cdx', ''), 'FDA companion-diagnostics list')}</div></div>` : ''}
    <div class="ow-card-foot">${extBtn(a.pathway === 'PMA' ? LINK.pma(a.number) : LINK.k510(a.number), 'Official FDA record', { primary: true })}${a.productCode ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${a.productCode}" data-type="device">Explore product code ${a.productCode}</button>` : ''}<button type="button" class="ow-btn ow-btn-sm" data-act="compare" data-key="${r.key}">${icon('compare')}Compare</button><button type="button" class="ow-btn ow-btn-sm" data-act="pin" data-key="${r.key}">${icon('pin')}Board</button></div>${provView(r.prov)}`;
};
DETAIL['device-class'] = function (r) { var a = r.data; return H`<div class="ow-badges">${classBadge(a.deviceClass)}${a.tags.map(function (t) { return badge(t, 'device'); })}${lagBadge()}</div><dl class="ow-kv ow-section"><dt>Product code</dt><dd>${a.productCode}</dd><dt>Device name</dt><dd>${a.deviceName}</dd><dt>Regulation</dt><dd>${a.regulation ? ext(LINK.cfr(a.regulation), '21 CFR ' + a.regulation) : nr()}</dd><dt>Panel</dt><dd>${orNR(a.panel)}</dd><dt>Specialty</dt><dd>${orNR(a.specialty)}</dd><dt>Submission type</dt><dd>${orNR(a.submissionType)}</dd><dt>Implant / life-sustaining</dt><dd>${a.implant || '—'} / ${a.lifeSustaining || '—'}</dd><dt>Definition</dt><dd>${orNR(a.definition)}</dd><dt>Linked PMA numbers</dt><dd>${a.pmaNumbers.join(', ') || nr()}</dd></dl><div class="ow-disclaimer">${SAFETY.devClass}</div>${provView(r.prov)}`; };
DETAIL['device-udi'] = function (r) { var a = r.data; return H`<div class="ow-badges">${lagBadge()}</div><dl class="ow-kv ow-section"><dt>UDI-DI</dt><dd class="ow-mono">${orNR(a.di)} ${a.agency ? '(' + a.agency + ')' : ''}</dd><dt>Brand</dt><dd>${orNR(a.brand)}</dd><dt>Version / model</dt><dd>${orNR(a.model)}</dd><dt>Company</dt><dd>${orNR(a.company)}</dd><dt>Description</dt><dd>${orNR(a.description)}</dd><dt>GMDN</dt><dd>${a.gmdn.join('; ') || nr()}</dd><dt>Product codes</dt><dd>${a.productCodes.map(function (p) { return p.code + ' — ' + p.name; }).join('; ') || nr()}</dd><dt>Premarket submissions</dt><dd>${a.submissions.join(', ') || nr()}</dd><dt>MRI safety</dt><dd>${orNR(a.mri)}</dd></dl><div class="ow-disclaimer">${SAFETY.devClass}</div>${provView(r.prov)}`; };
DETAIL['device-event'] = function (r) { var a = r.data; return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.maude}</div></div><dl class="ow-kv ow-section"><dt>Report number</dt><dd class="ow-mono">${orNR(a.reportNumber)}</dd><dt>Event type</dt><dd>${orNR(a.eventType)}</dd><dt>Event date</dt><dd>${orNR(a.eventDate)}</dd><dt>Received</dt><dd>${orNR(a.received)}</dd><dt>Device(s)</dt><dd>${a.devices.map(function (x) { return H`<div>${x.brand || ''} · ${x.generic || ''} · ${x.manufacturer || ''} ${x.productCode ? '(' + x.productCode + ')' : ''}</div>`; })}</dd><dt>Product problems</dt><dd>${a.problems.join('; ') || nr()}</dd><dt>Patient outcome codes</dt><dd>${a.outcomes.join('; ') || nr()}</dd><dt>Remedial action</dt><dd>${a.remedial.join('; ') || nr()}</dd><dt>Report source</dt><dd>${orNR(a.source)}</dd><dt>Premarket number</dt><dd>${orNR(a.submission)}</dd></dl><div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="narrative" data-mdr="${a.mdrKey}">Show source-reported narrative</button>${extBtn(LINK.maude(a.mdrKey), 'Official MAUDE record')}</div>${provView(r.prov)}`; };
DETAIL['device-recall'] = function (r) { var x = r.data; return H`<div class="ow-badges">${recallBadge(x.classification)}${badge(x.status || '', 'outline')}${lagBadge()}</div><div class="ow-notice ow-notice-warn" style="margin-top:10px">${icon('alert')}<div>${SAFETY.recalls}</div></div><dl class="ow-kv ow-section"><dt>Recall number</dt><dd class="ow-mono">${orNR(x.recallNumber)}</dd><dt>Event number</dt><dd>${orNR(x.eventNumber)}</dd><dt>Product</dt><dd>${orNR(x.product)}</dd><dt>Reason</dt><dd>${orNR(x.reason)}</dd><dt>Root cause</dt><dd>${orNR(x.rootCause)}</dd><dt>Firm</dt><dd>${orNR(x.firm)}</dd><dt>Initiated / terminated</dt><dd>${x.initiated || '—'} / ${x.terminated || '—'}</dd><dt>Linked submissions</dt><dd>${x.k510.concat(x.pma).join(', ') || nr()}</dd><dt>Firm action (source text)</dt><dd>${x.action ? trunc(x.action, 1200) : nr()}</dd><dt>Distribution</dt><dd>${x.distribution ? trunc(x.distribution, 600) : nr()}</dd></dl><div class="ow-card-foot">${extBtn(LINK.recall(x.cfresId), 'Official FDA recall record', { primary: true })}</div>${provView(r.prov)}`; };
