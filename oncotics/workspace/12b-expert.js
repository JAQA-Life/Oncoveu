
/* ====================================================================
   MODULE: EXPERT KNOWLEDGE & PATIENT EDUCATION (id: expert-knowledge)
   Keeps expert-curated (license-restricted), patient-education,
   AI-developer (verify-only) and community/open-source resources
   visibly separate. Nothing here is merged with CIViC or other
   source-reported evidence; nothing is scraped or bulk-exported.
   ==================================================================== */
var EVIDENCE_STATUS = [
  { id: 'oncokb', cls: 'Expert-curated', badgeKind: 'warn', category: 'expert-curated-license-restricted', status: 'Versioned, license-restricted expert curation', use: 'Variant oncogenicity, therapeutic implications and levels of evidence (per OncoKB terms).', limits: 'Do not bulk export or redistribute. Not merged with CIViC. Does not replace guidelines or clinician judgment.', safety: function () { return SAFETY.expert; } },
  { id: 'oncolink', cls: 'Patient education', badgeKind: 'edu', category: 'patient-education-link-out', status: 'Plain-language education', use: 'General understanding of cancer types, treatments and side effects.', limits: 'Not clinical evidence. No scraping or full-article reproduction.', safety: function () { return SAFETY.education; } },
  { id: 'radiologyinfo', cls: 'Patient education', badgeKind: 'edu', category: 'patient-education-link-out', status: 'Plain-language radiology education (RSNA/ACR)', use: 'What imaging exams involve.', limits: 'Not clinical evidence; not an interpretation of anyone’s images.', safety: function () { return SAFETY.education; } },
  { id: 'cure_cancer_with_ai_dev', cls: 'AI developer resource (verify-only)', badgeKind: 'ai', category: 'AI-derived', status: 'Verify-only; no live calls', use: 'Developer documentation for AI tooling, reviewed outside Oncotics before any integration.', limits: 'Any AI-derived output must be labeled AI-derived and kept separate from source-reported records. No PHI is ever sent.', safety: function () { return SAFETY.aiDerived; } },
  { id: 'openonco_github', cls: 'Community / open-source developer reference', badgeKind: 'dev', category: 'community-developer-reference', status: 'Repository reference only', use: 'Developer reference for open-source oncology tooling.', limits: 'GitHub raw files are never fetched as clinical data. May be incomplete or unmaintained.', safety: function () { return SAFETY.community; } }
];
function expertTerm() { var c = State.ctx; if (!c) return ''; return c.gene || (c.vaccine && c.vaccine.name) || c.disease || c.drug || (c.fertility && c.fertility.concept) || c.label; }
function oncokbPanel() {
  var c = State.ctx, g = c && (c.gene || bioGene()), s = slot('ek:oncokb');
  var url = g ? linkout('oncokb', g) : 'https://www.oncokb.org';
  var auth = CONFIG.features.oncokbAuthenticated;
  return H`<div class="ow-card ow-ek-card ow-ek-expert"><div class="ow-card-head"><div><div class="ow-card-title">${icon('star')} OncoKB ${g ? '— ' + g : ''}</div><div class="ow-card-sub">Memorial Sloan Kettering precision oncology knowledgebase</div></div><div class="ow-badges">${badge('Expert-curated', 'warn')}${badge('License-restricted', 'warn')}${badge(auth ? 'Authenticated-optional' : 'Link-out', 'outline')}</div></div>
    <p class="ow-small" style="margin-top:6px">${SAFETY.expert} OncoKB and CIViC use different evidence models; Oncotics shows them side by side and never merges them.</p>
    <div class="ow-card-foot">${extBtn(url, g ? 'Open ' + g + ' on OncoKB' : 'Open OncoKB', { primary: true })}${c && c.change ? extBtn(safeUrl('https://www.oncokb.org/gene/' + encodeURIComponent(c.gene) + '/' + encodeURIComponent(c.change.label)), 'OncoKB: ' + c.gene + ' ' + c.change.label) : ''}${extBtn('https://www.oncokb.org/terms', 'OncoKB terms of use')}</div>
    ${auth ? H`<div class="ow-section"><form class="ow-row" data-submit="set-oncokb-token"><label for="ow-okb-key" class="ow-sr">OncoKB API token</label><input id="ow-okb-key" class="ow-input" type="password" autocomplete="off" spellcheck="false" placeholder="${State.keys.oncokb ? '•••••• token set (memory only)' : 'Licensed OncoKB token (memory only)'}" style="max-width:300px"><button type="submit" class="ow-btn ow-btn-sm">Set token</button>${State.keys.oncokb ? H`<button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="clear-oncokb">Remove token</button>` : ''}</form>
      <p class="ow-subtle">Tokens are kept in memory only, are not secrets in a browser, and are cleared by refresh or Clear Session.</p>
      ${State.keys.oncokb && c && c.change ? (s.status === 'idle' ? autoAct('ek:oncokb:' + c.gene + ':' + c.change.label, 'ek-oncokb', {}, [{ url: linkout('oncokb', c.gene), label: 'OncoKB' }], 'licensed OncoKB annotation for ' + c.gene + ' ' + c.change.label) : slotView('ek:oncokb', { skeleton: 1, render: function (d) {
        return H`<dl class="ow-kv"><dt>Oncogenic</dt><dd>${orNR(d.oncogenic)}</dd><dt>Mutation effect</dt><dd>${orNR(d.effect)}</dd><dt>Highest sensitivity level</dt><dd>${orNR(d.highestSensitive)}</dd><dt>Highest resistance level</dt><dd>${orNR(d.highestResistance)}</dd><dt>Data version</dt><dd>${orNR(d.dataVersion)}</dd></dl>
          ${d.treatments.length ? table([{ label: 'Drugs', key: 'drugs' }, { label: 'Level', key: 'level' }, { label: 'Cancer type', key: 'cancer' }], d.treatments) : ''}<p class="ow-subtle">Licensed content: shown in this session only and excluded from all exports.</p>${provView(d.prov)}`; } })) : ''}</div>`
      : H`<p class="ow-subtle">The optional authenticated OncoKB mode is turned off on this deployment until OncoKB’s terms and browser access are verified for oncotics.com. No OncoKB content is fetched.</p>`}</div>`;
}
registerModule({
  id: 'expert-knowledge', label: 'Expert Knowledge & Patient Education', icon: 'star',
  count: function () { return null; },
  render: function () {
    var t = expertTerm();
    var edu = H`<div class="ow-card ow-ek-card ow-ek-edu"><div class="ow-card-head"><div><div class="ow-card-title">${icon('book')} OncoLink patient education</div><div class="ow-card-sub">Penn Medicine, Abramson Cancer Center</div></div><div class="ow-badges">${badge('Patient education', 'edu')}${badge('Link-out', 'outline')}</div></div>
      <p class="ow-small" style="margin-top:6px">${SAFETY.education} Oncotics does not fetch, scrape or reproduce OncoLink articles.</p><div class="ow-card-foot">${extBtn(linkout('oncolink', t), t ? 'OncoLink: ' + trunc(t, 40) : 'Open OncoLink', { primary: true })}${extBtn('https://www.cancer.gov/about-cancer', 'NCI: about cancer')}${extBtn(linkout('radiologyinfo', ''), 'RadiologyInfo.org')}${extBtn(linkout('nci_fertility', ''), 'NCI: fertility issues')}</div></div>`;
    var ai = H`<div class="ow-card ow-ek-card ow-ek-ai"><div class="ow-card-head"><div><div class="ow-card-title">${icon('command')} Cure Cancer With AI — developer resources</div><div class="ow-card-sub">AI developer lens</div></div><div class="ow-badges">${badge('AI-derived possible', 'ai')}${badge('Verify-only', 'warn')}</div></div>
      <p class="ow-small" style="margin-top:6px">${SRC.cure_cancer_with_ai_dev.lastVerifiedNote}</p><p class="ow-small">${SAFETY.aiDerived}</p><div class="ow-card-foot">${extBtn(linkout('cure_cancer_with_ai_dev', ''), 'Open developer page')}</div></div>`;
    var dev = H`<div class="ow-card ow-ek-card ow-ek-dev"><div class="ow-card-head"><div><div class="ow-card-title">${icon('console')} OpenOnco</div><div class="ow-card-sub">Community / open-source repository</div></div><div class="ow-badges">${badge('Community / developer reference', 'dev')}</div></div>
      <p class="ow-small" style="margin-top:6px">${SRC.openonco_github.lastVerifiedNote} ${SAFETY.community}</p><div class="ow-card-foot">${extBtn(linkout('openonco_github', ''), 'Open repository on GitHub')}</div></div>`;
    return H`${moduleHead('expert-knowledge')}
      <div class="ow-notice ow-notice-info">${icon('info')}<div><strong>${SAFETY.evidenceStatus}</strong></div></div>
      <div class="ow-grid-2 ow-section">${oncokbPanel()}${edu}${ai}${dev}</div>
      <div class="ow-section">${sectionHead('Evidentiary status at a glance', [])}${table([{ label: 'Resource', render: function (x) { return H`<strong>${SRC[x.id].displayName}</strong>`; } }, { label: 'Class', render: function (x) { return badge(x.cls, x.badgeKind); } }, { label: 'Status', key: 'status' }, { label: 'Appropriate use', key: 'use' }, { label: 'Limits', key: 'limits' }, { label: 'Data category', key: 'category' }], EVIDENCE_STATUS)}</div>
      <div class="ow-disclaimer">${SAFETY.expert} ${SAFETY.education} ${SAFETY.aiDerived} ${SAFETY.community}</div>`;
  }
});
