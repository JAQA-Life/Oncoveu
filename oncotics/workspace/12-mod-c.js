
/* ====================================================================
   MODULE 6: BIOLOGY (Ensembl, MyGene, MyVariant, UniProt + Tier B enrichment)
   ==================================================================== */
var BIO_TABS = [['gene', 'Gene Lens'], ['variant', 'Variant Interpreter'], ['protein', 'Protein Biology'], ['pathways', 'Pathways'], ['interactions', 'Interactions'], ['structure', 'Structure'], ['genomics', 'Cancer Genomics'], ['targets', 'Target Validation'], ['gwas', 'GWAS / Traits'], ['expression', 'Expression & Protein Context'], ['go', 'Gene Ontology Context']];
// Live block for the extra public sources: requested automatically when the section is shown;
// if the source cannot be reached, the official link-out is shown instead.
function tryLive(key, srcId, what, label, attrs, render, linkouts, emptyMsg) {
  var s = slot(key), src = SRC[srcId];
  var lo2 = arr(linkouts).length ? arr(linkouts) : [{ url: linkout(srcId, ''), label: 'Open ' + src.displayName }];
  if (s.status === 'idle') {
    var a = { 'data-what': what }; String(attrs || '').replace(/data-([\w-]+)="([^"]*)"/g, function (m, k, v) { a['data-' + k] = v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); return m; });
    return autoAct('live:' + key, 'try-live', a, lo2, src.displayName);
  }
  return slotView(key, { skeleton: 1, linkout: lo2, emptyMsg: emptyMsg || 'No records from ' + src.displayName + '.', render: render });
}
function bioGene() {
  var c = State.ctx; if (!c) return null;
  if (c.gene) return c.gene;
  if (c.geneHint) return c.geneHint;
  var mv = slot('var:myvariant'); if (mv.status === 'ok' && mv.data.items[0].data.gene) return mv.data.items[0].data.gene;
  var up = slot('bio:uniprot'); if (up.status === 'ok' && up.data.protein.data.gene) return up.data.protein.data.gene;
  var en = slot('gene:ensembl'); if (en.status === 'ok' && en.data.gene.symbol) return en.data.gene.symbol;
  return null;
}
function bioAcc() {
  var c = State.ctx; if (c && c.uniprot) return c.uniprot;
  var up = slot('bio:uniprot'); if (up.status === 'ok') return up.data.protein.data.acc;
  var mg = slot('gene:mygene'); if (mg.status === 'ok' && mg.data.items[0].data.uniprot) return mg.data.items[0].data.uniprot;
  return null;
}
function bioEnsg() {
  var c = State.ctx; if (c && c.ensembl && /^ENSG/.test(c.ensembl)) return c.ensembl;
  var mg = slot('gene:mygene'); if (mg.status === 'ok' && mg.data.items[0].data.ensembl) return mg.data.items[0].data.ensembl;
  var en = slot('gene:ensembl'); if (en.status === 'ok' && /^ENSG/.test(en.data.gene.id)) return en.data.gene.id;
  return null;
}
function ensureProtein() {
  var g = bioGene(), acc = State.ctx && State.ctx.uniprot;
  if (slot('bio:uniprot').status === 'idle' && (g || acc)) return load('bio:uniprot', 'uniprot', function (s) { return Loaders.uniprot(s, g, acc || bioAcc()); });
  return slot('bio:uniprot').promise || Promise.resolve();
}
function bioEnsure(tab) {
  var c = State.ctx; if (!c) return;
  var g = bioGene();
  var idle = function (k) { return slot(k).status === 'idle'; };
  if (tab === 'gene' && g) {
    if (idle('gene:mygene')) load('gene:mygene', 'mygene', function (s) { return Loaders.mygene(s, g); });
    if (idle('gene:ensembl')) load('gene:ensembl', 'ensembl', function (s) { return Loaders.ensemblGene(s, c.ensembl || g); });
    if (idle('gene:civic')) load('gene:civic', 'civic', function (s) { return Loaders.civicGene(s, g); });
  }
  if (tab === 'variant') {
    if (idle('var:myvariant') && (c.rsid || (c.gene && c.change) || c.hgvs)) load('var:myvariant', 'myvariant', function (s) { return Loaders.myvariant(s, c); });
  }
  if (tab === 'protein' || tab === 'structure' || tab === 'go') ensureProtein();
  if (tab === 'pathways' && idle('bio:reactome') && (g || bioAcc())) {
    load('bio:reactome', 'reactome', async function (s) { await ensureProtein(); return Loaders.reactome(s, bioAcc(), g); });
  }
  if (tab === 'interactions' && g && idle('bio:string')) load('bio:string', 'string', function (s) { return Loaders.string(s, g); });
  if (tab === 'structure' && idle('bio:alphafold') && (g || bioAcc())) load('bio:alphafold', 'alphafold', async function (s) { await ensureProtein(); var a = bioAcc(); if (!a) return { empty: true }; return Loaders.alphafold(s, a); });
  if (tab === 'targets' && idle('bio:ot') && (g || bioEnsg())) {
    load('bio:ot', 'opentargets', async function (s) {
      var e = bioEnsg();
      if (!e && g) { if (idle('gene:mygene')) load('gene:mygene', 'mygene', function (s2) { return Loaders.mygene(s2, g); }); await slot('gene:mygene').promise; e = bioEnsg(); }
      if (!e) return { empty: true };
      return Loaders.openTargets(s, e);
    });
  }
  if (tab === 'gwas' && c.rsid && idle('bio:gwas')) load('bio:gwas', 'gwas', function (s) { return Loaders.gwas(s, c.rsid); });
}
function bioSub(tab) {
  var c = State.ctx, g = bioGene();
  var needGene = H`<div class="ow-empty"><h3>No gene resolved for this query</h3><p>Search a gene symbol, variant, rsID or UniProt accession to populate this section.</p></div>`;
  if (tab === 'gene') {
    if (!g) return needGene;
    return H`<div class="ow-grid-2"><div class="ow-card">${sectionHead('MyGene.info', ['mygene'])}${slotView('gene:mygene', { skeleton: 1, linkout: [{ url: linkout('ncbi-gene', g), label: 'NCBI Gene' }], emptyMsg: 'MyGene.info returned no human gene for this symbol.', render: function (d) {
        var cands = d.items; var r = cands[0], x = r.data;
        return H`${!d.exact ? H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>No exact symbol match; showing closest candidates. Choose carefully.</div></div>` : ''}
          <div class="ow-row">${badge(x.symbol, 'gene')}${badge(x.geneType || 'type not reported', 'outline')}${provView(r.prov) ? '' : ''}</div><p style="margin-top:6px"><strong>${x.name || ''}</strong></p>
          <dl class="ow-kv ow-section"><dt>Aliases</dt><dd>${x.aliases.join(', ') || nr()}</dd><dt>Location</dt><dd>${x.chr ? 'chr' + x.chr + ':' + num(x.start) + '-' + num(x.end) + (x.strand ? ' (strand ' + x.strand + ')' : '') : nr()}${x.cytoband ? ' · ' + x.cytoband : ''}</dd>
            <dt>Entrez Gene</dt><dd>${x.entrez ? ext(LINK.ncbiGene(x.entrez), String(x.entrez)) : nr()}</dd><dt>Ensembl</dt><dd>${x.ensembl ? ext(LINK.ensemblGene(x.ensembl), x.ensembl) : nr()}</dd><dt>UniProt</dt><dd>${x.uniprot ? ext(LINK.uniprot(x.uniprot), x.uniprot) : nr()}</dd>${x.hgnc ? H`<dt>HGNC</dt><dd>HGNC:${x.hgnc}</dd>` : ''}</dl>
          ${x.summary ? H`<div class="ow-section"><h4>Summary (RefSeq via MyGene.info)</h4>${more('mg-sum', x.summary, 500)}</div>` : ''}
          ${det('go-' + x.symbol, 'Gene Ontology terms', H`<p><strong>Biological process:</strong> ${x.go.BP.join('; ') || nr()}</p><p><strong>Molecular function:</strong> ${x.go.MF.join('; ') || nr()}</p><p><strong>Cellular component:</strong> ${x.go.CC.join('; ') || nr()}</p>`)}
          ${cands.length > 1 ? H`<p class="ow-subtle" style="margin-top:8px">Other candidates: ${cands.slice(1).map(function (r2) { return H`<button type="button" class="ow-linkbtn" data-act="search-as" data-term="${r2.data.symbol}" data-type="gene">${r2.data.symbol}</button> `; })}</p>` : ''}${provView(r.prov)}`; } })}</div>
      <div class="ow-card">${sectionHead('Ensembl', ['ensembl'])}${slotView('gene:ensembl', { skeleton: 1, linkout: [{ url: linkout('ensembl', g), label: 'Search Ensembl' }], emptyMsg: 'Ensembl has no human gene for this symbol.', render: function (d) { var x = d.gene;
        return H`<dl class="ow-kv"><dt>Stable ID</dt><dd>${ext(LINK.ensemblGene(x.id), x.id)}</dd><dt>Symbol</dt><dd>${orNR(x.symbol)}</dd><dt>Biotype</dt><dd>${orNR(x.biotype)}</dd><dt>Assembly</dt><dd>${orNR(x.assembly)}</dd><dt>Coordinates</dt><dd>${x.chr ? x.chr + ':' + num(x.start) + '-' + num(x.end) + ' (strand ' + x.strand + ')' : nr()}</dd><dt>Canonical transcript</dt><dd class="ow-mono">${orNR(x.canonical)}</dd><dt>Description</dt><dd>${orNR(x.description)}</dd></dl>`; } })}
        <div class="ow-card-foot">${extBtn(linkout('ncbi-gene', g), 'NCBI Gene')}${extBtn(linkout('oncokb', g), 'OncoKB')}${extBtn(linkout('cosmic', g), 'COSMIC')}${extBtn(linkout('depmap', g), 'DepMap')}${extBtn(linkout('gtex', g), 'GTEx')}${extBtn(linkout('hpa', g), 'Protein Atlas')}${extBtn(linkout('gxa', g), 'Expression Atlas')}${extBtn(linkout('kegg', g), 'KEGG')}${extBtn(linkout('pharmgkb', g), 'PharmGKB')}</div></div></div>
      <div class="ow-card ow-section">${sectionHead('CIViC gene summary (curated)', ['civic'])}${slotView('gene:civic', { skeleton: 1, emptyMsg: 'CIViC has no gene record for this symbol.', render: function (d) { var x = d.gene.data; return H`${x.description ? more('civic-g', x.description, 500) : nr()}${x.aliases.length ? H`<p class="ow-subtle" style="margin-top:6px">CIViC aliases: ${x.aliases.join(', ')}</p>` : ''}${provView(d.gene.prov)}`; } })}</div>
      <div class="ow-card-foot ow-section"><button type="button" class="ow-btn ow-btn-sm" data-act="bio-tab" data-tab="protein">Load protein details</button><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="clinical-evidence">View CIViC evidence</button><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="trials">View trials</button><button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="literature">View literature</button><button type="button" class="ow-btn ow-btn-sm" data-act="gene-dx" data-gene="${g}">${icon('device')}Find diagnostics that detect this target</button></div>`;
  }
  if (tab === 'variant') {
    var hasVar = c.rsid || (c.gene && c.change) || c.hgvs;
    if (!hasVar && slot('var:myvariant').status === 'idle') return H`<div class="ow-empty"><h3>Provide a variant, rsID, or HGVS notation for variant-level interpretation.</h3><p>Examples: BRAF V600E, rs113488022, NM_004333.6:c.1799T&gt;A, chr7:g.140453136A&gt;T (GRCh37).</p></div>`;
    var mv = slot('var:myvariant');
    var rs = mv.status === 'ok' ? mv.data.items[0].data.rsid : c.rsid;
    var vp = slot('var:vep');
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div><strong>${SAFETY.variants}</strong> MyVariant.info coordinates are GRCh37/hg19; Ensembl VEP uses GRCh38.</div></div>
      <div class="ow-section">${sectionHead('MyVariant.info annotation', ['myvariant'])}${slotView('var:myvariant', { linkout: [{ url: linkout('clinvar', c.label), label: 'Search ClinVar' }, { url: linkout('dbsnp', rs || c.label), label: 'Search dbSNP' }], emptyMsg: 'MyVariant.info did not resolve this variant. Try an rsID, a transcript HGVS, or check the notation.', render: function (d) {
        return H`<div class="ow-stack">${d.items.slice(0, 6).map(function (r) { var v = r.data;
          return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title ow-mono">${v.id}</div><div class="ow-card-sub">${v.gene ? v.gene + ' · ' : ''}${v.aaRef && v.aaPos ? 'p.' + v.aaRef + v.aaPos + (v.aaAlt || '') + ' · ' : ''}${v.assembly}</div></div><div class="ow-badges">${v.consequence.map(function (x) { return badge(String(x).replace(/_/g, ' '), 'variant'); })}${v.impact.map(function (x) { return badge('Impact: ' + x, x === 'HIGH' ? 'bad' : x === 'MODERATE' ? 'warn' : 'outline'); })}</div></div>
            <dl class="ow-kv ow-section"><dt>rsID</dt><dd>${v.rsid ? ext(LINK.dbsnp(v.rsid), v.rsid) : nr()}</dd><dt>Position (hg19)</dt><dd>${v.chrom ? 'chr' + v.chrom + ':' + v.pos + ' ' + (v.ref || '') + '>' + (v.alt || '') : nr()}</dd><dt>HGVS coding</dt><dd class="ow-mono ow-small">${v.hgvsc.join('; ') || nr()}</dd><dt>HGVS protein</dt><dd class="ow-mono ow-small">${v.hgvsp.join('; ') || nr()}</dd>
              <dt>ClinVar</dt><dd>${v.clinvar.length ? v.clinvar.map(function (x) { return badge(x[0] + ' ×' + x[1], /^Pathogenic|Likely pathogenic/i.test(x[0]) ? 'bad' : /benign/i.test(x[0]) ? 'good' : 'outline'); }) : nr()} ${v.clinvarId ? ext(LINK.clinvarVar(v.clinvarId), 'ClinVar ' + v.clinvarId) : ''}<div class="ow-subtle">Aggregated submitter records; not a clinical classification by Oncotics.</div></dd>
              <dt>Conditions (ClinVar)</dt><dd>${v.clinvarConditions.join('; ') || nr()}</dd><dt>CADD (phred)</dt><dd>${v.cadd != null ? v.cadd : nr()}</dd><dt>SIFT / PolyPhen-2</dt><dd>${(v.sift.join(', ') || '—') + ' / ' + (v.polyphen.join(', ') || '—')} <span class="ow-subtle">(dbNSFP codes: D=damaging, T=tolerated, P=possibly, B=benign)</span></dd>
              <dt>REVEL / AlphaMissense</dt><dd>${(v.revel != null ? v.revel : '—') + ' / ' + (v.alphamissense.join(', ') || '—')}</dd><dt>gnomAD AF (exome / genome)</dt><dd>${(v.gnomadExome != null ? v.gnomadExome : '—') + ' / ' + (v.gnomadGenome != null ? v.gnomadGenome : '—')}</dd><dt>COSMIC</dt><dd>${orNR(v.cosmic)}</dd></dl>
            <div class="ow-card-foot">${recActions(r)}${v.rsid ? extBtn(LINK.ensemblVar(v.rsid), 'Ensembl') : ''}${v.rsid ? extBtn(LINK.dbsnp(v.rsid), 'dbSNP') : ''}${extBtn(linkout('clinvar', v.rsid || c.label), 'ClinVar')}${v.gene ? extBtn(linkout('cancer_hotspots', v.gene), 'Cancer Hotspots') : ''}${v.gene ? extBtn(linkout('clingen_gencc', v.gene), 'ClinGen') : ''}${v.gene ? extBtn(linkout('oncokb', v.gene), 'OncoKB (license terms)') : ''}${v.gene ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="gene-dx" data-gene="${v.gene}">Find diagnostics for ${v.gene}</button>` : ''}</div>${provView(r.prov)}</div>`; })}</div>`; } })}</div>
      <div class="ow-section">${sectionHead('Ensembl VEP (GRCh38, canonical transcripts)', ['ensembl'])}
        ${vp.status === 'idle' ? (rs || (c.hgvs && c.transcript) ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="vep" data-rs="${rs || ''}">${icon('dna')}Run Ensembl VEP${rs ? ' for ' + rs : ''}</button> <span class="ow-subtle">VEP can take 10–15 seconds.</span>` : H`<p class="ow-subtle">VEP needs an rsID or a transcript-qualified HGVS (e.g. NM_004333.6:c.1799T&gt;A).</p>`) : slotView('var:vep', { linkout: [{ url: rs ? LINK.ensemblVar(rs) : linkout('ensembl', c.label), label: 'Open Ensembl' }], emptyMsg: 'VEP returned no consequence.', render: function (d) {
          return H`<p class="ow-small">Input ${d.input || d.id} · ${d.assembly || ''} · ${d.chr ? d.chr + ':' + d.start : ''} · alleles ${d.allele || '—'} · most severe: ${badge(String(d.mostSevere || '').replace(/_/g, ' '), 'variant')}</p>
            ${table([{ label: 'Transcript', render: function (t) { return H`<span class="ow-mono">${t.transcript}</span>${t.canonical ? badge('canonical', 'teal') : ''}`; } }, { label: 'Gene', key: 'gene' }, { label: 'Allele', key: 'allele' }, { label: 'Consequence', render: function (t) { return t.terms.join(', '); } }, { label: 'Impact', key: 'impact' }, { label: 'AA', render: function (t) { return (t.aa || '') + (t.proteinStart ? ' @' + t.proteinStart : ''); } }, { label: 'SIFT', key: 'sift' }, { label: 'PolyPhen', key: 'polyphen' }, { label: 'HGVSp', render: function (t) { return H`<span class="ow-mono ow-small">${t.hgvsp || ''}</span>`; } }], d.consequences)}`; } })}</div>`;
  }
  if (tab === 'protein') {
    if (!g && !bioAcc()) return needGene;
    return slotView('bio:uniprot', { skeleton: 2, linkout: [{ url: linkout('uniprot', g || ''), label: 'Search UniProt' }], emptyMsg: 'No reviewed human UniProt entry mapped to this gene.', render: function (d) { var r = d.protein, p = r.data;
      return H`<div class="ow-card"><div class="ow-card-head"><div><div class="ow-card-title">${p.name || ''}</div><div class="ow-card-sub">${p.acc} · ${p.entryName || ''} · ${p.gene || ''} · ${p.length ? num(p.length) + ' aa' : ''}</div></div><div class="ow-toolbar">${recActions(r, { noCompare: true })}${extBtn(LINK.uniprot(p.acc), 'UniProt')}</div></div>
        <div class="ow-section"><h4>Function</h4>${p.functionText.length ? more('up-fn', p.functionText.join('\n\n'), 700) : nr()}</div>
        <div class="ow-grid-2 ow-section"><div><h4>Domains</h4>${p.domains.length ? H`<ul>${p.domains.map(function (x) { return H`<li>${x.desc} <span class="ow-subtle">(${x.start}–${x.end})</span></li>`; })}</ul>` : nr()}</div><div><h4>Subcellular location</h4>${p.subcellular.join('; ') || nr()}</div></div>
        ${det('up-reg', 'Regions (' + p.regions.length + ')', p.regions.length ? H`<ul>${p.regions.map(function (x) { return H`<li>${x.desc} (${x.start}–${x.end})</li>`; })}</ul>` : nr())}
        ${det('up-ptm', 'Post-translational modifications (' + p.ptms.length + ' shown)', p.ptms.length ? H`<ul>${p.ptms.map(function (x) { return H`<li>${x.start}: ${x.desc}</li>`; })}</ul>` : nr())}
        ${det('up-go', 'GO terms', H`<p><strong>Biological process:</strong> ${p.go.P.join('; ') || nr()}</p><p><strong>Molecular function:</strong> ${p.go.F.join('; ') || nr()}</p><p><strong>Cellular component:</strong> ${p.go.C.join('; ') || nr()}</p>`)}
        ${det('up-dz', 'Disease annotations (' + p.diseases.length + ')', p.diseases.length ? H`<ul>${p.diseases.map(function (x) { return H`<li><strong>${x.name}</strong>${x.acronym ? ' (' + x.acronym + ')' : ''}<div class="ow-small ow-muted">${trunc(x.description || '', 400)}</div></li>`; })}</ul>` : nr())}
        ${det('up-pdb', 'PDB cross-references (' + p.pdb.length + ')', p.pdb.length ? table([{ label: 'PDB', render: function (x) { return ext(LINK.pdb(x.id), x.id); } }, { label: 'Method', key: 'method' }, { label: 'Resolution', key: 'resolution' }, { label: 'Chains', key: 'chains' }], p.pdb.slice(0, 80)) : nr())}
        <div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="bio-tab" data-tab="structure">View structure</button><button type="button" class="ow-btn ow-btn-sm" data-act="bio-tab" data-tab="pathways">Pathways</button><button type="button" class="ow-btn ow-btn-sm" data-act="bio-tab" data-tab="interactions">Interactions</button></div>${provView(r.prov)}</div>`; } });
  }
  if (tab === 'pathways') {
    if (!g && !bioAcc()) return needGene;
    return H`${slotView('bio:reactome', { linkout: [{ url: linkout('reactome', g || ''), label: 'Open Reactome pathway search' }], emptyMsg: 'Reactome returned no human pathways for this protein.', render: function (d) {
      return H`<p class="ow-subtle">${d.items.length} Reactome pathways${d.items[0] && d.items[0].fromSearch ? ' (from keyword search; not an exact protein mapping)' : ' mapped to ' + (bioAcc() || '')}.</p>${table([{ label: 'Pathway', render: function (x) { return ext(LINK.reactome(x.stId), x.name); } }, { label: 'Stable ID', render: function (x) { return H`<span class="ow-mono">${x.stId}</span>`; } }, { label: 'Disease pathway', render: function (x) { return x.disease ? badge('Disease', 'warn') : '—'; } }], d.items)}<p class="ow-subtle" style="margin-top:6px">Attribution: ${SRC.reactome.attribution}</p>`; } })}
      <div class="ow-card-foot">${extBtn(linkout('reactome', g || ''), 'Open Reactome')}${extBtn(linkout('pathway_commons', g || ''), 'Pathway Commons')}${extBtn(linkout('wikipathways', g || ''), 'WikiPathways')}${extBtn(linkout('kegg', g || ''), 'KEGG')}</div><p class="ow-subtle">Pathway data are biological context, not clinical evidence.</p>`;
  }
  if (tab === 'interactions') {
    if (!g) return needGene;
    return H`${slotView('bio:string', { linkout: [{ url: linkout('string', g), label: 'Open STRING interaction network' }], emptyMsg: 'STRING returned no partners.', render: function (d) {
      return H`${stringSvg(g, d.items.slice(0, 12))}${table([{ label: 'Partner', render: function (x) { return H`<button type="button" class="ow-linkbtn" data-act="search-as" data-term="${x.partner}" data-type="gene">${x.partner}</button>`; } }, { label: 'Combined score', render: function (x) { return x.score != null ? Number(x.score).toFixed(3) : '—'; } }, { label: 'Experimental', key: 'escore' }, { label: 'Database', key: 'dscore' }, { label: 'Text-mining', key: 'tscore' }], d.items, 'STRING functional partners (human, top 20)')}<p class="ow-subtle" style="margin-top:6px">${SRC.string.attribution} Scores are confidence estimates of functional association, not proof of physical binding.</p>`; } })}
      <div class="ow-card-foot">${extBtn(linkout('string', g), 'Open STRING interaction network')}${extBtn(linkout('intact', g), 'IntAct')}${extBtn(linkout('biogrid', g), 'BioGRID')}</div>
      <div class="ow-section">${sectionHead('Curated complexes (Complex Portal)', ['complex_portal'])}${tryLive('bio:complex', 'complex_portal', 'complex', 'Complex Portal complexes containing ' + g, 'data-gene="' + esc(g) + '"', function (d) { return H`${table([{ label: 'Complex', render: function (x) { return ext(LINK.complex(x.ac), x.name); } }, { label: 'Accession', render: function (x) { return H`<span class="ow-mono">${x.ac}</span>`; } }, { label: 'Predicted', render: function (x) { return x.predicted ? badge('Predicted', 'warn') : badge('Curated', 'good'); } }, { label: 'Description', render: function (x) { return trunc(x.description || '', 160); } }], d.items, num(d.total) + ' complexes')}${provView(d.prov)}`; }, [{ url: linkout('complex_portal', g), label: 'Complex Portal' }])}</div>`;
  }
  if (tab === 'structure') {
    if (!g && !bioAcc()) return needGene;
    return H`<div class="ow-grid-2"><div class="ow-card">${sectionHead('AlphaFold predicted model', ['alphafold'])}${slotView('bio:alphafold', { skeleton: 1, linkout: [{ url: linkout('alphafold', g || ''), label: 'Search AlphaFold DB' }], emptyMsg: 'No AlphaFold model for this accession.', render: function (d) { var m = d.model;
        return H`<dl class="ow-kv"><dt>Model</dt><dd>${ext(LINK.alphafold(bioAcc()), m.id)}</dd><dt>Mean pLDDT</dt><dd>${m.plddt != null ? m.plddt : nr()}</dd><dt>pLDDT bands</dt><dd>very high ${pct(m.veryHigh || 0, 1)} · confident ${pct(m.confident || 0, 1)} · low ${pct(m.low || 0, 1)} · very low ${pct(m.veryLow || 0, 1)}</dd><dt>Version</dt><dd>${orNR(m.version)}</dd><dt>Files</dt><dd>${m.pdbUrl ? ext(m.pdbUrl, 'PDB') : ''} ${m.cifUrl ? ext(m.cifUrl, 'mmCIF') : ''} ${m.paeImageUrl ? ext(m.paeImageUrl, 'PAE image') : ''}</dd></dl><p class="ow-subtle">Predicted structures are computational models. No 3D viewer is loaded; files open at the source.</p>`; } })}</div>
      <div class="ow-card">${sectionHead('Best experimental structures (PDBe)', ['pdbe'])}${bioAcc() ? tryLive('bio:pdbe', 'pdbe', 'pdbe', 'PDBe best structures for ' + bioAcc(), '', function (d) { return H`${table([{ label: 'PDB', render: function (x) { return ext(LINK.pdbe(x.pdb), x.pdb); } }, { label: 'Chain', key: 'chain' }, { label: 'Coverage', render: function (x) { return x.coverage != null ? pct(x.coverage, 1) : '—'; } }, { label: 'Resolution (Å)', key: 'resolution' }, { label: 'Method', key: 'method' }, { label: 'UniProt range', render: function (x) { return x.start + '–' + x.end; } }], d.items.slice(0, 15), num(d.total) + ' mapped structures (PDBe ranking)')}${provView(d.prov)}`; }, [{ url: linkout('pdbe', bioAcc()), label: 'PDBe-KB' }]) : H`<p class="ow-subtle">Load the protein first (UniProt accession needed).</p>`}</div>
      <div class="ow-card">${sectionHead('Domains and sites (EBI Proteins API)', ['ebi_proteins'])}${bioAcc() ? tryLive('bio:features', 'ebi_proteins', 'ebi_proteins', 'EBI Proteins features for ' + bioAcc(), '', function (d) { return H`${table([{ label: 'Type', key: 'type' }, { label: 'Description', key: 'description' }, { label: 'Range', render: function (x) { return x.begin + (x.end && x.end !== x.begin ? '–' + x.end : ''); } }, { label: 'Evidence items', key: 'evidence' }], d.items.slice(0, 40))}${provView(d.prov)}`; }) : H`<p class="ow-subtle">Load the protein first.</p>`}</div>
      <div class="ow-card">${sectionHead('Experimental structures (PDB via UniProt)', ['uniprot'])}${slotView('bio:uniprot', { skeleton: 1, render: function (d) { var p = d.protein.data; return p.pdb.length ? H`${table([{ label: 'PDB', render: function (x) { return ext(LINK.pdb(x.id), x.id); } }, { label: 'Method', key: 'method' }, { label: 'Resolution', key: 'resolution' }], p.pdb.slice(0, 25))}${p.pdb.length > 25 ? H`<p class="ow-subtle">${p.pdb.length - 25} more in Protein Biology.</p>` : ''}<p class="ow-subtle">Domain context: ${p.domains.map(function (x) { return x.desc + ' ' + x.start + '–' + x.end; }).join('; ') || 'not reported'}</p>` : nr(); } })}</div></div>`;
  }
  if (tab === 'genomics') {
    if (!g) return needGene;
    var cb = slot('bio:cbio');
    return H`<div class="ow-notice ow-notice-info">${icon('info')}<div>Frequencies describe the public ${CONFIG.cbio.label} research cohort (sample IDs are not displayed). They are not individual predictions.</div></div>
      <div class="ow-card-foot">${cb.status === 'idle' ? autoAct('bio:cbio:' + g, 'cbio', { 'data-gene': g }, [], g + ' mutation frequency (cBioPortal)') : ''}${extBtn(linkout('cbioportal', g), 'Open cBioPortal')}</div>
      <div class="ow-section">${slotView('bio:cbio', { linkout: [{ url: linkout('cbioportal', g), label: 'Open cBioPortal' }], emptyMsg: 'cBioPortal did not recognise this gene.', render: function (d) {
        return H`<div class="ow-stat-grid">${stat(d.mutatedSamples, 'Samples with ≥1 ' + d.gene + ' mutation', d.cohort)}${stat(d.sampleCount, 'Sequenced samples', d.cohort)}${stat(pct(d.mutatedSamples, d.sampleCount), 'Mutation frequency (samples)', 'derived by Oncotics from source counts')}${stat(d.mutationCount, 'Mutation records', 'cBioPortal')}</div>
          <div class="ow-grid-2 ow-section"><div class="ow-card"><div class="ow-card-title">Most common protein changes</div>${bars(d.byChange, { max: 15, color: 'var(--ow-variant)' })}</div><div class="ow-card"><div class="ow-card-title">Mutation types</div>${bars(d.byType.map(function (x) { return [String(x[0]).replace(/_/g, ' '), x[1]]; }), { color: 'var(--ow-protein)' })}</div></div>
          <p class="ow-subtle">Copy-number and structural-variant frequencies are not computed here. ${ext(LINK.cbioStudy(d.studyId), 'Open the study on cBioPortal')}</p>`; } })}</div>
      <div class="ow-section">${sectionHead('NCI GDC open-access mutation occurrences by project', ['nci_gdc'])}<p class="ow-subtle">${SAFETY.gdc}</p>${tryLive('bio:gdc', 'nci_gdc', 'gdc', 'NCI GDC aggregate for ' + g, 'data-gene="' + esc(g) + '"', function (d) { return H`${bars(d.items.map(function (x) { return [x.project, x.count]; }), { label: 'GDC simple somatic mutation occurrences by project', color: 'var(--ow-gene)', max: 15 })}<p class="ow-subtle">${num(d.total)} open-access occurrences (mutation–case pairs; not unique patients). Aggregate counts only.</p>${provView(d.prov)}`; }, [{ url: linkout('nci_gdc', ''), label: 'GDC Data Portal' }])}</div>
      ${c.type === 'disease' || c.disease ? H`<div class="ow-section">${sectionHead('Related cBioPortal studies', ['cbioportal'])}${slot('bio:cbioStudies').status === 'idle' ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="cbio-studies">Find studies for “${c.disease}”</button>` : slotView('bio:cbioStudies', { emptyMsg: 'No studies matched.', render: function (d) { return table([{ label: 'Study', render: function (x) { return ext(LINK.cbioStudy(x.id), x.name); } }, { label: 'Samples', render: function (x) { return num(x.samples); } }, { label: 'Citation', key: 'citation' }], d.items); } })}</div>` : ''}`;
  }
  if (tab === 'targets') {
    if (!g && !bioEnsg()) return needGene;
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.target}</div></div><div class="ow-section">${slotView('bio:ot', { linkout: [{ url: linkout('opentargets', g || ''), label: 'Open Targets Platform' }], emptyMsg: 'Open Targets has no target record for this gene.', render: function (d) {
      return H`<div class="ow-grid-2"><div class="ow-card"><div class="ow-card-title">Top associated diseases (${num(d.diseasesCount)} total)</div>${table([{ label: 'Disease', render: function (x) { return ext(LINK.otDisease(x.id), x.name); } }, { label: 'Score', render: function (x) { return x.score != null ? Number(x.score).toFixed(3) : '—'; } }, { label: 'Evidence types', render: function (x) { return x.types.filter(function (t) { return t.score > 0; }).map(function (t) { return t.id.replace(/_/g, ' '); }).join(', '); } }], d.diseases)}</div>
        <div class="ow-card"><div class="ow-card-title">Drugs and clinical candidates (${num(d.drugsCount)})</div>${table([{ label: 'Drug', render: function (x) { return H`<button type="button" class="ow-linkbtn" data-act="search-as" data-term="${x.name}" data-type="drug">${titleCase(x.name)}</button>`; } }, { label: 'Type', key: 'type' }, { label: 'Max stage', render: function (x) { return badge(humanEnum(x.stage), x.stage === 'APPROVAL' ? 'good' : 'outline'); } }, { label: 'ChEMBL', render: function (x) { return ext(LINK.otDrug(x.id), x.id); } }], d.drugs)}</div></div>
        <div class="ow-card-foot">${extBtn(LINK.otTarget(d.id), 'Open target on Open Targets')}</div>`; } })}</div>
      <div class="ow-section">${sectionHead('Druggability and gene–drug interactions (DGIdb)', ['dgidb'])}<p class="ow-subtle">${SAFETY.dgidb}</p>${g ? tryLive('bio:dgidb', 'dgidb', 'dgidb', 'DGIdb interactions for ' + g, 'data-gene="' + esc(g) + '"', function (d) { return H`${table([{ label: 'Drug', render: function (x) { return H`<button type="button" class="ow-linkbtn" data-act="search-as" data-term="${x.drug}" data-type="drug">${titleCase(x.drug)}</button>${x.approved ? badge('Approved (per DGIdb)', 'good') : ''}`; } }, { label: 'Interaction type', render: function (x) { return x.types.join(', ') || '—'; } }, { label: 'Score', render: function (x) { return x.score != null ? Number(x.score).toFixed(2) : '—'; } }, { label: 'Sources', render: function (x) { return H`<span class="ow-small">${x.sources.slice(0, 4).join(', ')}</span>`; } }, { label: 'PMIDs', render: function (x) { return x.pmids.slice(0, 3).map(function (p) { return ext(LINK.pubmed(p), p); }); } }], d.items.slice(0, 25), num(d.total) + ' interactions')}${provView(d.prov)}`; }, [{ url: LINK.dgidbGene(g), label: 'DGIdb' }]) : ''}</div>
      <div class="ow-notice ow-notice-info ow-section">${icon('info')}<div>${SRC.open_targets_genetics.lastVerifiedNote} ${extBtn(linkout('open_targets_genetics', g || ''), 'Open Targets Platform')}</div></div>`;
  }
  if (tab === 'gwas') {
    if (!c.rsid) return H`<div class="ow-empty"><h3>GWAS associations are shown for rsID queries</h3><p>Search an rsID (e.g. rs7903146). Gene-level GWAS browsing opens at the source.</p>${g ? extBtn(linkout('gwas', g), 'GWAS Catalog: ' + g) : ''}</div>`;
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.gwas}</div></div><div class="ow-section">${slotView('bio:gwas', { linkout: [{ url: linkout('gwas', c.rsid, true), label: 'GWAS Catalog' }], emptyMsg: 'No GWAS Catalog associations for this rsID.', render: function (d) {
      return table([{ label: 'Trait', render: function (x) { return x.traits.join('; ') || x.reported.join('; '); } }, { label: 'Risk allele', key: 'riskAllele' }, { label: 'p-value', render: function (x) { return x.mantissa != null ? x.mantissa + '×10^' + x.exponent : x.pvalue; } }, { label: 'Risk allele freq.', key: 'riskFrequency' }, { label: 'Effect', render: function (x) { return x.orValue ? 'OR ' + x.orValue : (x.beta || '—'); } }, { label: 'Study', render: function (x) { return x.study ? ext(LINK.gwasStudy(x.study), x.study) : '—'; } }, { label: 'Publication', render: function (x) { return x.pmid ? ext(LINK.pubmed(x.pmid), (x.author || '') + ' PMID ' + x.pmid) : '—'; } }], d.items, num(d.total) + ' associations (first 20); ancestry details at the source');
    } })}</div>`;
  }
  if (tab === 'expression') {
    if (!g) return needGene;
    return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.expression}</div></div>
      <div class="ow-grid-3 ow-section">${[['hpa', 'Human Protein Atlas', 'Tissue, cell-type, cancer and reproductive-tissue protein/RNA expression.'], ['gtex', 'GTEx Portal', 'Normal-tissue RNA expression (including reproductive tissues).'], ['gxa', 'Expression Atlas', 'Baseline and differential expression experiments.']].map(function (x) { return H`<div class="ow-card"><div class="ow-card-title">${x[1]}</div><p class="ow-small ow-muted">${x[2]}</p><p class="ow-subtle">${SRC[x[0]].lastVerifiedNote || 'Link-out (browser access not verified).'}</p><div class="ow-card-foot">${extBtn(linkout(x[0], g), x[1] + ': ' + g)}</div></div>`; })}</div>`;
  }
  if (tab === 'go') {
    var acc2 = bioAcc();
    return H`<p class="ow-subtle">GO annotations with evidence codes. MyGene.info GO terms appear in Gene Lens; QuickGO adds per-annotation evidence codes.</p>
      <div class="ow-section">${sectionHead('QuickGO annotations', ['quickgo'])}${acc2 ? tryLive('bio:quickgo', 'quickgo', 'quickgo', 'QuickGO annotations for ' + acc2, '', function (d) {
        var asp = [['biological_process', 'Biological process'], ['molecular_function', 'Molecular function'], ['cellular_component', 'Cellular component']];
        return H`<p class="ow-subtle">${num(d.total)} annotations (first 100 de-duplicated).</p><div class="ow-grid-3">${asp.map(function (a) { var l = arr(d.by[a[0]]); return H`<div class="ow-card"><div class="ow-card-title">${a[1]} (${l.length})</div><ul class="ow-small">${l.slice(0, 18).map(function (x) { return H`<li>${ext(LINK.quickgoTerm(x.id), x.name || x.id)} ${badge(x.evidence, 'outline')}${x.qualifier && x.qualifier !== 'enables' && x.qualifier !== 'involved_in' && x.qualifier !== 'located_in' ? H` <span class="ow-subtle">${x.qualifier}</span>` : ''}</li>`; })}</ul></div>`; })}</div>${provView(d.prov)}`;
      }, [{ url: linkout('quickgo', acc2), label: 'QuickGO' }]) : (slot('bio:uniprot').status === 'loading' || slot('bio:uniprot').status === 'idle' ? H`<p class="ow-row ow-muted" aria-busy="true"><span class="ow-spinner" aria-hidden="true"></span> Resolving the protein (UniProt)…</p>` : H`<div class="ow-empty"><p>No UniProt accession is available for this query from this browser. Open the official source:</p><div class="ow-card-foot">${extBtn(linkout('quickgo', bioGene() || ''), 'QuickGO')}</div></div>`)}</div>`;
  }
  return '';
}
function stringSvg(center, items) {
  if (!items.length) return '';
  var W = 520, Hh = 300, cx = W / 2, cy = Hh / 2, R = 115;
  var nodes = items.map(function (x, i) { var a = (2 * Math.PI * i) / items.length - Math.PI / 2; return { x: cx + R * 1.6 * Math.cos(a), y: cy + R * Math.sin(a), name: x.partner, s: x.score || 0 }; });
  var lines = nodes.map(function (n) { return '<line x1="' + cx + '" y1="' + cy + '" x2="' + n.x.toFixed(1) + '" y2="' + n.y.toFixed(1) + '" stroke="currentColor" stroke-opacity="' + (0.2 + 0.6 * n.s).toFixed(2) + '" stroke-width="' + (1 + 2.5 * n.s).toFixed(1) + '"/>'; }).join('');
  var dots = nodes.map(function (n) { return '<g><circle cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="16" fill="var(--ow-surface)" stroke="var(--ow-protein)" stroke-width="2"/><text x="' + n.x.toFixed(1) + '" y="' + (n.y + 30).toFixed(1) + '" text-anchor="middle" font-size="11" fill="currentColor">' + esc(n.name) + '</text></g>'; }).join('');
  return raw('<figure style="margin:0 0 10px;color:var(--ow-muted)"><svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" style="max-width:640px;display:block" role="img" aria-label="Interaction partners of ' + esc(center) + ' (text list follows)">' + lines + dots + '<circle cx="' + cx + '" cy="' + cy + '" r="24" fill="var(--ow-teal)"/><text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">' + esc(center) + '</text></svg><figcaption class="ow-subtle">Line weight reflects STRING combined score. Accessible table below.</figcaption></figure>');
}
registerModule({
  id: 'biology', label: 'Biology', icon: 'dna',
  count: function () { return null; },
  onOpen: function () { bioEnsure(ui('biology').tab || defaultBioTab()); },
  render: function () {
    var c = State.ctx;
    if (!c) return H`${moduleHead('biology')}${noQuery('biology')}`;
    var tab = ui('biology').tab || defaultBioTab();
    bioEnsure(tab);
    return H`${moduleHead('biology')}
      <div class="ow-subtabs" role="tablist" aria-label="Biology sections">${BIO_TABS.map(function (t) { return H`<button type="button" role="tab" class="ow-subtab" aria-selected="${tab === t[0] ? 'true' : 'false'}" data-act="bio-tab" data-tab="${t[0]}">${t[1]}</button>`; })}</div>
      <div role="tabpanel">${safeRender(function () { return bioSub(tab); }, 'This section')}</div>`;
  }
});
function defaultBioTab() { var c = State.ctx; return c && (c.type === 'variant' || c.type === 'rsid' || c.type === 'hgvs') ? 'variant' : c && c.type === 'uniprot' ? 'protein' : 'gene'; }
DETAIL.gene = function (r) { var x = r.data; return H`<p><strong>${x.name || ''}</strong></p><dl class="ow-kv ow-section"><dt>Aliases</dt><dd>${arr(x.aliases).join(', ') || nr()}</dd><dt>Location</dt><dd>${x.chr ? 'chr' + x.chr + ':' + x.start + '-' + x.end : nr()}</dd><dt>Entrez</dt><dd>${orNR(x.entrez)}</dd><dt>Ensembl</dt><dd>${orNR(x.ensembl)}</dd><dt>UniProt</dt><dd>${orNR(x.uniprot)}</dd></dl>${x.summary || x.description ? more('g' + r.key, x.summary || x.description, 600) : ''}${provView(r.prov)}`; };
DETAIL.variant = function (r) { var v = r.data; return H`<div class="ow-notice ow-notice-warn">${icon('alert')}<div>${SAFETY.variants}</div></div><dl class="ow-kv ow-section"><dt>ID (hg19)</dt><dd class="ow-mono">${v.id}</dd><dt>Gene</dt><dd>${orNR(v.gene)}</dd><dt>rsID</dt><dd>${orNR(v.rsid)}</dd><dt>Consequence</dt><dd>${v.consequence.join(', ') || nr()}</dd><dt>ClinVar</dt><dd>${v.clinvar.map(function (x) { return x[0] + ' ×' + x[1]; }).join('; ') || nr()}</dd><dt>CADD</dt><dd>${v.cadd != null ? v.cadd : nr()}</dd></dl>${provView(r.prov)}`; };
DETAIL.protein = function (r) { var p = r.data; return H`<p><strong>${p.name}</strong> · ${p.acc} · ${num(p.length)} aa</p><div class="ow-section">${p.functionText.length ? more('pf' + r.key, p.functionText.join('\n\n'), 600) : nr()}</div>${provView(r.prov)}`; };

/* ====================================================================
   MODULE 7: LITERATURE (Europe PMC)
   ==================================================================== */
function litFilters() { var u = ui('literature'); u.filters = u.filters || { sort: '', pageSize: 10 }; return u.filters; }
function loadLit(cursor) { var f = litFilters(); return load('lit:list', 'europepmc', function (s) { return Loaders.literature(s, State.ctx, f, cursor); }, { force: true }); }
function paperCard(r) {
  var p = r.data;
  return H`<article class="ow-card ow-fade"><div class="ow-card-head"><div style="min-width:0"><div class="ow-card-title"><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${p.title}</button></div><div class="ow-card-sub">${trunc(p.authors || '', 160)}</div><div class="ow-card-sub"><em>${p.journal || ''}</em> ${p.year || ''}</div></div>
    <div class="ow-badges">${p.oa ? badge('Open access', 'good') : ''}${p.cited != null ? badge('Cited by ' + num(p.cited), 'lit') : ''}${p.types.filter(function (t) { return /review|trial|guideline|meta/i.test(t); }).slice(0, 2).map(function (t) { return badge(titleCase(t), 'outline'); })}</div></div>
    ${p.abstract ? H`<div class="ow-card-body">${more('ab' + r.key, p.abstract, 320)}</div>` : ''}
    <div class="ow-card-foot">${recActions(r)}${p.pmid ? ext(LINK.pubmed(p.pmid), 'PMID ' + p.pmid) : ''}${p.doi ? ext(LINK.doi(p.doi), 'DOI') : ''}${ext(p.pmid ? LINK.epmc('MED', p.pmid) : LINK.epmc(p.source, p.id), 'Europe PMC')}${p.fullText.slice(0, 1).map(function (u) { return ext(u.url, 'Full text (' + (u.site || 'source') + ')'); })}</div>${provView(r.prov)}</article>`;
}
registerModule({
  id: 'literature', label: 'Literature', icon: 'book',
  count: function () { return slotTotal('lit:list'); },
  onOpen: function () { if (State.ctx && slot('lit:list').status === 'idle') loadLit(); },
  render: function () {
    if (!State.ctx) return H`${moduleHead('literature')}${noQuery('literature')}`;
    var f = litFilters(), u = ui('literature'), view = u.view || 'cards';
    var filters = H`<form class="ow-filters" data-submit="lit-filters">${txt('lit-q', 'Refine (added with AND)', f.refine, 'e.g. resistance')}${txt('lit-from', 'Year from', f.from, '2015')}${txt('lit-to', 'Year to', f.to, String(YEAR))}
      ${sel('lit-sort', 'Sort', [['', 'Relevance'], ['P_PDATE_D desc', 'Publication date (newest)'], ['CITED desc', 'Citation count']], f.sort)}${sel('lit-ps', 'Page size', [['10', '10'], ['25', '25'], ['50', '50']], String(f.pageSize))}
      <div class="ow-field"><span class="ow-label">Options</span><label class="ow-check"><input type="checkbox" id="lit-oa" ${f.oa ? raw('checked') : ''}>Open access only</label><label class="ow-check"><input type="checkbox" id="lit-rev" ${f.review ? raw('checked') : ''}>Reviews only</label></div>
      <div class="ow-row"><button type="submit" class="ow-btn ow-btn-primary ow-btn-sm">${icon('filter')}Apply</button></div></form>`;
    var list = slotView('lit:list', { linkout: [{ url: linkout('europepmc', State.ctx.label), label: 'Search Europe PMC' }, { url: linkout('pubmed', State.ctx.label), label: 'Search PubMed' }], emptyMsg: 'No Europe PMC records matched. Try fewer filters or a broader term.', render: function (d) {
      var pageIdx = (u.cursors || []).length;
      return H`${view === 'table' ? table([{ label: 'Title', render: function (r) { return H`<button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${r.key}">${r.data.title}</button>`; } }, { label: 'Year', render: function (r) { return r.data.year; } }, { label: 'Journal', render: function (r) { return r.data.journal; } }, { label: 'PMID', render: function (r) { return r.data.pmid || '—'; } }, { label: 'DOI', render: function (r) { return r.data.doi || '—'; } }, { label: 'OA', render: function (r) { return r.data.oa ? 'Yes' : 'No'; } }, { label: 'Cited', render: function (r) { return r.data.cited != null ? num(r.data.cited) : '—'; } }], d.items, num(d.total) + ' Europe PMC records') : H`<div class="ow-stack">${d.items.map(paperCard)}</div>`}
        ${pager('literature', { page: pageIdx, hasPrev: pageIdx > 0, hasNext: !!d.next, total: d.total, pageSize: f.pageSize, label: 'records' })}`; } });
    return H`${moduleHead('literature', H`${viewToggle('literature')}<button type="button" class="ow-btn ow-btn-sm" data-act="copy-ids" data-kind="pmid">${icon('copy')}Copy PMIDs</button>${slot('lit:list').status === 'ok' && slot('lit:institutions').status === 'idle' ? (autoRun('lit:institutions', function () { ACTIONS['lit-institutions'](); }), '') : ''}${extBtn(linkout('pubmed', State.ctx.label), 'PubMed')}${extBtn(linkout('openalex', State.ctx.label), 'OpenAlex')}`)}
      <div class="ow-disclaimer">${SAFETY.literature}</div><p class="ow-subtle">Abstract snippets are source text; Oncotics does not generate summaries of papers.</p>
      <div class="ow-section">${det('lit-filters', H`${icon('filter')} Filters and sorting`, filters, false)}</div><div class="ow-section">${list}</div>`;
  },
  exportRows: function () { var s = slot('lit:list'); if (s.status !== 'ok') return null; return { name: 'literature', rows: s.data.items, cols: [{ label: 'Title', get: function (r) { return r.data.title; } }, { label: 'Authors', get: function (r) { return r.data.authors; } }, { label: 'Journal', get: function (r) { return r.data.journal; } }, { label: 'Year', get: function (r) { return r.data.year; } }, { label: 'PMID', get: function (r) { return r.data.pmid; } }, { label: 'PMCID', get: function (r) { return r.data.pmcid; } }, { label: 'DOI', get: function (r) { return r.data.doi; } }, { label: 'Open access', get: function (r) { return r.data.oa; } }, { label: 'Cited by', get: function (r) { return r.data.cited; } }, { label: 'URL', get: function (r) { return r.prov.url; } }] }; }
});
DETAIL.paper = function (r) {
  var p = r.data;
  var ev = slot('civic:evidence'), related = ev.status === 'ok' && p.pmid ? ev.data.items.filter(function (e) { return e.data.source && String(e.data.source.citationId) === String(p.pmid); }) : [];
  return H`<p class="ow-muted">${p.authors || ''}</p><p><em>${p.journal || ''}</em> ${p.year || ''}</p><div class="ow-badges" style="margin-top:6px">${p.oa ? badge('Open access', 'good') : ''}${p.cited != null ? badge('Cited by ' + num(p.cited), 'lit') : ''}${p.types.map(function (t) { return badge(t, 'outline'); })}</div>
    <div class="ow-section"><h4>Abstract (source text)</h4><p class="ow-pre" style="margin-top:6px">${p.abstract || 'Abstract not reported by source.'}</p></div>
    ${p.keywords.length ? H`<p class="ow-small"><strong>Keywords:</strong> ${p.keywords.join('; ')}</p>` : ''}
    <div class="ow-card-foot">${p.pmid ? extBtn(LINK.pubmed(p.pmid), 'PubMed') : ''}${p.doi ? extBtn(LINK.doi(p.doi), 'Publisher (DOI)') : ''}${extBtn(p.pmid ? LINK.epmc('MED', p.pmid) : LINK.epmc(p.source, p.id), 'Europe PMC')}${p.fullText.map(function (u) { return extBtn(u.url, 'Full text: ' + (u.site || u.style || 'source')); })}</div>
    ${related.length ? H`<div class="ow-section"><h4>CIViC evidence citing this paper (loaded page)</h4><ul>${related.map(function (e) { return H`<li><button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${e.key}">${e.title}</button></li>`; })}</ul></div>` : ''}
    <div class="ow-section"><h4>Citation radar (citation metadata is not clinical evidence)</h4>
      ${p.pmid || p.doi ? H`<div class="ow-stack" style="margin-top:6px">
        <div>${sectionHead('OpenAlex', ['openalex'])}${tryLive('lit:oa:' + r.key, 'openalex', 'openalex-paper', 'OpenAlex', 'data-key="' + r.key + '"', function (d) { var w = d.work; return H`<dl class="ow-kv"><dt>Cited by</dt><dd>${w.cited != null ? num(w.cited) : nr()}</dd><dt>References</dt><dd>${w.refs != null ? num(w.refs) : nr()}</dd><dt>Open access</dt><dd>${w.oa ? (w.oaUrl ? ext(w.oaUrl, 'Yes — open copy') : 'Yes') : 'No / unknown'}</dd><dt>Topics</dt><dd>${w.topics.join('; ') || nr()}</dd><dt>Institution countries</dt><dd>${uniq(w.institutions.map(function (i) { return i.country; }).filter(Boolean)).join(', ') || nr()}</dd></dl>${provView(d.prov)}`; })}</div>
        ${p.doi ? H`<div>${sectionHead('Crossref', ['crossref'])}${tryLive('lit:cr:' + r.key, 'crossref', 'crossref', 'Crossref', 'data-key="' + r.key + '"', function (d) { return H`<dl class="ow-kv"><dt>Publisher</dt><dd>${orNR(d.publisher)}</dd><dt>Type</dt><dd>${orNR(d.type)}</dd><dt>Cited by (Crossref)</dt><dd>${d.cited != null ? num(d.cited) : nr()}</dd><dt>References</dt><dd>${d.refs != null ? num(d.refs) : nr()}</dd><dt>Funders</dt><dd>${d.funders.join('; ') || nr()}</dd><dt>License</dt><dd>${d.licenses.map(function (u) { return ext(u, 'license'); })}</dd></dl>${provView(d.prov)}`; })}</div>` : ''}
        <div>${sectionHead('Semantic Scholar', ['semantic_scholar'])}${tryLive('lit:s2:' + r.key, 'semantic_scholar', 's2', 'Semantic Scholar', 'data-key="' + r.key + '"', function (d) { var li = function (x) { return H`<li>${x.pmid ? H`<button type="button" class="ow-linkbtn" data-act="search" data-term="${'PMID ' + x.pmid}">${x.title}</button>` : x.title}${x.year ? ' (' + x.year + ')' : ''}</li>`; }; return H`<dl class="ow-kv"><dt>Citations</dt><dd>${d.cited != null ? num(d.cited) : nr()} (influential ${d.influential != null ? num(d.influential) : '—'})</dd><dt>References</dt><dd>${d.refs != null ? num(d.refs) : nr()}</dd></dl><div class="ow-grid-2"><div><h4>Some references</h4><ul class="ow-small">${d.references.map(li)}</ul></div><div><h4>Some citing papers</h4><ul class="ow-small">${d.citations.map(li)}</ul></div></div><p class="ow-subtle">AI-generated “TLDR” summaries are deliberately not requested.</p>${provView(d.prov)}`; })}</div></div>` : H`<p class="ow-subtle">Citation metadata needs a PMID or DOI.</p>`}</div>
    <div class="ow-disclaimer">${SAFETY.literature} ${SAFETY.citation}</div>${provView(r.prov)}`;
};

/* ====================================================================
   MODULE 8: RELATIONSHIP EXPLORER (expandable tree; memory-only navigation)
   ==================================================================== */
function node(kind, label, opts) {
  opts = opts || {};
  return H`<span class="ow-node ${opts.derived ? 'ow-derived' : ''}">${badge(kind, opts.kind || 'outline')}<span class="ow-break">${label}</span>${opts.conf ? confBadge(opts.conf) : ''}${opts.src ? H`<span class="ow-subtle">${opts.src}</span>` : ''}${opts.actions || ''}</span>`;
}
function relTree() {
  var c = State.ctx, items = [];
  var ok = function (k) { var s = slot(k); return s.status === 'ok' ? s.data : null; };
  var act = function (label, a, attrs) { return H`<button type="button" class="ow-linkbtn ow-small" data-act="${a}" ${raw(attrs || '')}>${label}</button>`; };
  var g = bioGene();
  if (g) {
    var up = ok('bio:uniprot'), re = ok('bio:reactome'), st = ok('bio:string'), af = ok('bio:alphafold');
    items.push(H`<li>${node('Gene', g, { kind: 'gene', src: 'MyGene/Ensembl', actions: act('Gene Lens', 'bio-tab', 'data-tab="gene"') })}<ul>
      <li>${node('Protein', up ? up.protein.data.acc + ' · ' + up.protein.data.name : 'not loaded', { kind: 'protein', src: 'UniProt', actions: act(up ? 'Open' : 'Load related proteins', 'rel-load', 'data-what="protein"') })}
        <ul><li>${node('Pathways', re ? re.items.length + ' Reactome pathways' : 'not loaded', { kind: 'protein', src: 'Reactome', actions: act(re ? 'Show related pathways' : 'Load related pathways', 'rel-load', 'data-what="pathways"') })}</li>
        <li>${node('Interactions', st ? st.items.slice(0, 6).map(function (x) { return x.partner; }).join(', ') + (st.items.length > 6 ? '…' : '') : 'not loaded', { kind: 'protein', src: 'STRING', actions: act(st ? 'Show related interactions' : 'Load related interactions', 'rel-load', 'data-what="interactions"') })}</li>
        <li>${node('Structure', af ? af.model.id + ' (pLDDT ' + af.model.plddt + ')' : 'not loaded', { kind: 'protein', src: 'AlphaFold', actions: act(af ? 'Show structure links' : 'Load structure links', 'rel-load', 'data-what="structure"') })}</li></ul></li>
      <li>${node('Diagnostics', slot('dev:gene-dx').status === 'ok' ? slot('dev:gene-dx').data.candidates.length + ' candidate devices (derived)' : 'not loaded', { kind: 'device', derived: true, src: 'openFDA device', actions: act('Find diagnostics that detect this target', 'gene-dx', 'data-gene="' + esc(g) + '"') })}</li></ul></li>`);
  }
  var ev = ok('civic:evidence');
  if (ev) {
    var mps = countBy(ev.items, function (r) { return r.data.molecularProfile.name; }).slice(0, 8);
    var ths = countBy(ev.items, function (r) { return r.data.therapies.map(function (t) { return t.name; }); }).filter(function (x) { return x[0] !== 'Not reported'; }).slice(0, 10);
    var dzs = countBy(ev.items, function (r) { return r.data.disease ? r.data.disease.name : null; }).filter(function (x) { return x[0] !== 'Not reported'; }).slice(0, 10);
    items.push(H`<li>${node('Evidence', num(ev.total) + ' CIViC items (' + ev.items.length + ' loaded)', { kind: 'good', src: 'CIViC', actions: act('Show all evidence', 'tab', 'data-mod="clinical-evidence"') })}<ul>
      <li>${node('Molecular profiles', mps.length + ' on this page', { kind: 'variant' })}<ul>${mps.map(function (m) { return H`<li>${node('Variant', m[0] + ' (' + m[1] + ')', { kind: 'variant', actions: act('Explore', 'search-as', 'data-term="' + esc(m[0]) + '" data-type="variant"') })}</li>`; })}</ul></li>
      <li>${node('Therapies', ths.length + ' linked', { kind: 'good' })}<ul>${ths.map(function (t) { return H`<li>${node('Therapy', t[0] + ' (' + t[1] + ')', { kind: 'good', actions: H`${act('Drug intelligence', 'search-as', 'data-term="' + esc(t[0]) + '" data-type="drug"')} ${act('All trials for this drug', 'rel-trials', 'data-term="' + esc(t[0]) + '"')}` })}</li>`; })}</ul></li>
      <li>${node('Diseases', dzs.length + ' linked', { kind: 'warn' })}<ul>${dzs.map(function (d) { return H`<li>${node('Disease', d[0] + ' (' + d[1] + ')', { kind: 'warn', actions: act('Explore disease', 'search-as', 'data-term="' + esc(d[0]) + '" data-type="disease"') })}</li>`; })}</ul></li>
      <li>${node('Sources', uniq(ev.items.map(function (r) { return r.data.source && r.data.source.citationId; })).length + ' cited papers', { kind: 'lit', actions: act('Show all sources for this evidence', 'tab', 'data-mod="clinical-evidence"') })}</li></ul></li>`);
  }
  var tr = ok('trials:list');
  if (tr) items.push(H`<li>${node('Trials', num(tr.total) + ' ClinicalTrials.gov studies', { kind: 'cyan', src: 'ClinicalTrials.gov', actions: act('Open trials', 'tab', 'data-mod="trials"') })}<ul>${tr.items.slice(0, 8).map(function (r) { return H`<li>${node('Trial', r.data.nct + ' · ' + trunc(r.data.briefTitle, 90), { kind: 'cyan', actions: act('Details', 'open-rec', 'data-key="' + r.key + '"') })}<ul>${r.data.interventions.slice(0, 4).map(function (i) { var isDev = /DEVICE|DIAGNOSTIC/.test(i.type), isDrug = /DRUG|BIOLOGICAL|COMBINATION/.test(i.type); return H`<li>${node(humanEnum(i.type), i.name, { kind: isDev ? 'device' : isDrug ? 'good' : 'outline', actions: isDrug ? act('All FDA records for this intervention', 'search-as', 'data-term="' + esc(i.name) + '" data-type="drug"') : isDev ? act('Devices & Dx', 'search-as', 'data-term="' + esc(i.name) + '" data-type="device"') : '' })}</li>`; })}</ul></li>`; })}</ul></li>`);
  var lb = ok('drug:labels'), cdx = ok('drug:cdx');
  if (lb) items.push(H`<li>${node('FDA drug', lb.items[0].title, { kind: 'good', src: 'openFDA', conf: lb.items[0].data.confidence, actions: act('Drug intelligence', 'tab', 'data-mod="drug-intelligence"') })}<ul><li>${node('Companion diagnostics', cdx ? cdx.candidates.length + ' candidate devices' : 'not loaded', { kind: 'device', derived: true, src: 'derived by Oncotics', actions: act(cdx ? 'Show companion diagnostics for this drug' : 'Find companion diagnostics', 'drug-cdx') })}${cdx ? H`<ul>${cdx.candidates.slice(0, 8).map(function (x) { return H`<li>${node('CDx', (x.rec.data.deviceName || x.rec.data.number) + ' · ' + x.rec.data.number, { kind: 'device', derived: true, conf: x.confidence, actions: H`${act('Details', 'open-rec', 'data-key="' + x.rec.key + '"')} ${x.rec.data.productCode ? act('Recalls for this product code', 'rel-recalls', 'data-code="' + esc(x.rec.data.productCode) + '"') : ''}` })}</li>`; })}</ul>` : ''}</li></ul></li>`);
  var au = ok('dev:auth');
  if (au) items.push(H`<li>${node('Devices', au.items.length + ' authorizations', { kind: 'device', src: 'openFDA device', actions: act('Devices & Dx', 'tab', 'data-mod="device-intelligence"') })}<ul>${au.items.slice(0, 8).map(function (r) { return H`<li>${node(r.data.pathway, r.data.number + ' · ' + trunc(r.data.deviceName || '', 80), { kind: 'device', actions: H`${act('Details', 'open-rec', 'data-key="' + r.key + '"')} ${r.data.productCode ? act('Show device recalls for this product code', 'rel-recalls', 'data-code="' + esc(r.data.productCode) + '"') : ''} ${r.data.productCode ? act('Show MAUDE events', 'rel-events', 'data-code="' + esc(r.data.productCode) + '"') : ''}` })}</li>`; })}</ul></li>`);
  if (c.type === 'vaccine') {
    var v = c.vaccine, vl = ok('vax:labels');
    items.push(H`<li>${node('Vaccine', v.name + ' · ' + (VAX_SUB[v.kind] || v.kind), { kind: 'vax', src: 'Oncotics vaccine dictionary (routing)', actions: act('Vaccines & Cancer Immunization', 'tab', 'data-mod="vaccines-cancer-immunization"') })}<ul>
      ${v.antigen ? H`<li>${node('Antigen', v.antigen, { kind: 'protein', derived: true, conf: 'Likely' })}${v.antigenGene ? H`<ul><li>${node('Gene', v.antigenGene, { kind: 'gene', derived: true, actions: act('Open gene', 'search-as', 'data-term="' + esc(v.antigenGene) + '" data-type="gene"') })}</li></ul>` : ''}</li>` : ''}
      ${arr(v.cancers).map(function (dz) { return H`<li>${node(v.kind === 'preventive' ? 'Prevention context' : 'Cancer context', dz, { kind: 'warn', derived: true, conf: 'Likely', actions: H`${act('OncoTree / disease', 'search-as', 'data-term="' + esc(dz) + '" data-type="disease"')}` })}</li>`; })}
      <li>${node('FDA label', vl ? vl.items.length + ' openFDA labels' : (v.products.length ? 'not loaded' : 'no named product'), { kind: 'good', src: 'openFDA' })}</li></ul></li>`);
  }
  if (c.fertility) items.push(H`<li>${node('Onco-Fertility', c.fertility.concept, { kind: 'fert', src: 'Oncotics routing dictionary', actions: act('Open Onco-Fertility', 'tab', 'data-mod="onco-fertility"') })}<ul>${fertRelTree()}</ul></li>`);
  if (c.type === 'imaging') items.push(H`<li>${node('Imaging', c.imaging.concept, { kind: 'img', actions: H`<a class="ow-linkbtn ow-small" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">Imaging Workbench (separate page)</a>` })}<ul><li>${node('Imaging devices', slot('img:devices').status === 'ok' ? slot('img:devices').data.items.length + ' openFDA records' : 'not loaded', { kind: 'device', actions: act('Load', 'img-devices') })}</li></ul></li>`);
  var li = ok('lit:list');
  if (li) items.push(H`<li>${node('Literature', num(li.total) + ' Europe PMC records', { kind: 'lit', src: 'Europe PMC', actions: act('Show related literature', 'tab', 'data-mod="literature"') })}<ul>${li.items.slice(0, 5).map(function (r) { return H`<li>${node('Paper', trunc(r.data.title, 110) + (r.data.year ? ' (' + r.data.year + ')' : ''), { kind: 'lit', actions: act('Details', 'open-rec', 'data-key="' + r.key + '"') })}</li>`; })}</ul></li>`);
  return items;
}
registerModule({
  id: 'relationships', label: 'Relationship Explorer', icon: 'graph',
  count: function () { return null; },
  render: function () {
    if (!State.ctx) return H`${moduleHead('relationships')}${noQuery('the relationship explorer')}`;
    var items = relTree();
    var crumbs = State.nav.map(function (n, i) { return H`${i ? icon('chevron') : ''}<button type="button" class="ow-btn ow-btn-sm ${i === State.navIndex ? 'ow-btn-primary' : 'ow-btn-ghost'}" data-act="nav-go" data-i="${i}" ${i === State.navIndex ? raw('aria-current="step"') : ''}><span class="ow-small">${humanEnum(n.type)}:</span> ${trunc(n.label, 40)}</button>`; });
    return H`${moduleHead('relationships', H`<button type="button" class="ow-btn ow-btn-sm" data-act="nav-back" ${State.navIndex > 0 ? '' : raw('disabled')}>${icon('back')}Back</button><button type="button" class="ow-btn ow-btn-sm" data-act="nav-fwd" ${State.navIndex < State.nav.length - 1 ? '' : raw('disabled')}>Forward${icon('chevron')}</button>`)}
      <nav class="ow-crumbs" aria-label="Exploration trail (this session only)">${crumbs}</nav>
      <p class="ow-subtle">Flows: Gene → Variant → Evidence → Therapy → Disease → Trial → FDA record → Literature · Drug → Companion Dx → Device → Recalls/Events · Vaccine → Antigen → Cancer type → Trial → Literature · Cancer type → Therapy → Label reproductive section → AE term → Fertility-preservation trial → Device → Literature · Imaging concept → Device → Imaging Workbench (link-out, no PHI). Dashed nodes are links derived by Oncotics and carry a confidence label; “Possible” is never shown as “Exact”.</p>
      <div class="ow-card ow-section"><ul class="ow-tree" aria-label="Relationship tree"><li>${node('Query', State.ctx.label, { kind: 'teal' })}<ul>${items.length ? items : H`<li class="ow-subtle">Relationships appear as sources load.</li>`}</ul></li></ul></div>`;
  }
});

/* ====================================================================
   MODULE 9: GLOBAL COVERAGE
   ==================================================================== */
function extractIds() {
  var found = { NCT: new Set(), PMID: new Set(), DOI: new Set(), rsID: new Set(), '510(k)': new Set(), 'De Novo': new Set(), PMA: new Set(), 'Product code': new Set(), 'UDI-DI': new Set(), Application: new Set(), UniProt: new Set(), Ensembl: new Set(), ISRCTN: new Set(), EudraCT: new Set(), RxCUI: new Set() };
  State.records.forEach(function (r) {
    var d = r.data || {};
    if (d.nct) found.NCT.add(d.nct); if (d.pmid) found.PMID.add(String(d.pmid)); if (d.doi) found.DOI.add(d.doi); if (d.rsid) found.rsID.add(d.rsid);
    if (d.source && d.source.sourceType === 'PUBMED' && d.source.citationId) found.PMID.add(String(d.source.citationId));
    if (d.number && /^K\d/.test(d.number)) found['510(k)'].add(d.number); if (d.number && /^DEN/.test(d.number)) found['De Novo'].add(d.number); if (d.number && /^[PH]\d{6}/.test(d.number)) found.PMA.add(d.number);
    if (d.productCode) found['Product code'].add(d.productCode); if (d.di) found['UDI-DI'].add(d.di); arr(d.appl).forEach(function (a) { if (a) found.Application.add(a); });
    if (d.acc) found.UniProt.add(d.acc); if (d.ensembl) found.Ensembl.add(d.ensembl);
    var blob = JSON.stringify(d.full || '') ;
    (blob.match(/ISRCTN\d{8}/g) || []).forEach(function (x) { found.ISRCTN.add(x); });
    (blob.match(/\b20\d{2}-\d{6}-\d{2}\b/g) || []).forEach(function (x) { found.EudraCT.add(x); });
  });
  var rx = slot('drug:rxnorm'); if (rx.status === 'ok' && rx.data.rxcui) found.RxCUI.add(rx.data.rxcui);
  return found;
}
registerModule({
  id: 'global-coverage', label: 'Global Coverage', icon: 'globe',
  count: function () { return SOURCES.length; },
  render: function () {
    var u = ui('coverage');
    var q = u.q != null ? u.q : (State.ctx ? (State.ctx.regId || State.ctx.label) : '');
    var src = u.src || 'who-ictrp';
    var s = SRC[src];
    var url = linkout(src, q);
    var ids = extractIds();
    var idHtml = Object.keys(ids).filter(function (k) { return ids[k].size; }).map(function (k) { return H`<div style="margin-bottom:6px"><strong class="ow-small">${k}</strong> <span class="ow-row" style="display:inline-flex">${Array.from(ids[k]).slice(0, 30).map(function (v) { return idChip('', v); })}</span></div>`; });
    var groups = [['Imaging (Imaging Workbench page only)', /imaging|Imaging|viewer|inference|radiolog/i], ['Vaccines & immunization', /vaccin|immuniz|Vaccin/i], ['Reproductive health & survivorship', /reproduct|lactation|fertility|Reproductive/i], ['Expert knowledge, patient education, AI & community', /Expert|education|AI developer|Community|knowledgebase/i], ['Trials & registries', /trial/i], ['Devices & diagnostics', /Device|diagnostic|identifier|recall|classification|Companion/i], ['Regulators, drugs & safety', /Regulator|Safety|approvals|labels|adverse|Drug|guideline|surveillance/i], ['Biology, genomics, terminology & literature', /./]];
    var used = new Set();
    return H`${moduleHead('global-coverage')}
      <div class="ow-notice ow-notice-info">${icon('globe')}<div><strong>There is no single authoritative live API covering all oncology knowledge, trials, drugs, devices, diagnostics, vaccines, survivorship, patient education, AI developer resources, community resources, and imaging workflows. Oncotics combines selected live public APIs, licensed/verified optional sources, and official link-outs.</strong> ${SAFETY.coverage}</div></div>
      <div class="ow-card ow-section"><div class="ow-card-title">Link-out builder</div><form class="ow-filters" data-submit="coverage-open" style="margin-top:8px">
        <div class="ow-field"><label class="ow-label" for="cov-src">Official source</label><select id="cov-src" class="ow-select" data-change="coverage-src">${SOURCES.filter(function (x) { return x.linkoutSearchUrlTemplate; }).map(function (x) { return H`<option value="${x.id}" ${x.id === src ? raw('selected') : ''}>${x.region} — ${x.displayName}</option>`; })}</select></div>
        ${txt('cov-q', 'Query to open (editable)', q, '')}
        <div class="ow-row"><button type="submit" class="ow-btn ow-btn-primary ow-btn-sm">${icon('ext')}Open official source</button><button type="button" class="ow-btn ow-btn-sm" data-act="coverage-copy">${icon('copy')}Copy search link</button></div></form>
        <p class="ow-subtle" style="margin-top:8px">Will open: <span class="ow-mono ow-break">${url}</span> ${badge('Official source', 'teal')} ${s && s.language ? badge(s.language, 'outline') : ''} ${s && s.verify ? badge('Template: verify before release', 'warn') : ''}${s && s.note ? H` · ${s.note}` : ''}</p></div>
      ${idHtml.length ? H`<div class="ow-card ow-section"><div class="ow-card-title">Identifiers found in loaded records</div><p class="ow-subtle">Select an identifier to explore it (in memory; nothing is saved).</p><div style="margin-top:8px">${idHtml}</div></div>` : ''}
      ${groups.map(function (gp) {
        var list = SOURCES.filter(function (x) { if (used.has(x.id)) return false; if (gp[1].test(x.kind || '')) { used.add(x.id); return true; } return false; });
        return H`<div class="ow-section">${sectionHead(gp[0], [])}${table([
          { label: 'Region', render: function (x) { return x.region; } }, { label: 'Source', render: function (x) { return H`<strong>${x.displayName}</strong>`; } }, { label: 'Kind', key: 'kind' },
          { label: 'Mode', render: function (x) { return modeBadge(x.id); } },
          { label: 'Language', render: function (x) { return x.language || '—'; } },
          { label: 'Flags', render: function (x) { return flagBadges(x); } },
          { label: 'Notes', render: function (x) { return H`${x.verify ? badge('Template: verify before release', 'warn') : ''}<span class="ow-small">${x.note || (x.defaultMode !== 'live' ? (x.lastVerifiedNote || 'Official link-out') : x.attribution)}</span>`; } },
          { label: 'Official link', render: function (x) { return ext(x.officialSiteUrl || linkout(x.id, ''), 'Open'); } }], list)}</div>`;
      })}`;
  }
});

/* ====================================================================
   MODULE 10: COMPARISON  |  MODULE 11: SESSION BOARD
   ==================================================================== */
var CMP_GROUP = { trial: 'Trials', label: 'Drugs', approval: 'Drugs', 'device-auth': 'Devices / IVDs / CDx', 'device-class': 'Devices / IVDs / CDx', 'device-udi': 'Devices / IVDs / CDx', variant: 'Variants', gene: 'Genes', evidence: 'Evidence', assertion: 'Evidence', paper: 'Literature' };
var CMP_FIELDS = {
  Trials: [['NCT ID', 'nct'], ['Title', 'briefTitle'], ['Status', 'status'], ['Phase', function (d) { return arr(d.phases).join(', '); }], ['Study type', 'studyType'], ['Conditions', function (d) { return arr(d.conditions).join('; '); }], ['Interventions', function (d) { return arr(d.interventions).map(function (i) { return i.name; }).join('; '); }], ['Sponsor', 'sponsor'], ['Enrollment', 'enrollment'], ['Start', 'start'], ['Completion', 'completion'], ['Sites', 'siteCount'], ['Countries', function (d) { return arr(d.countries).join(', '); }], ['Outcome measures', function (d) { var o = get(d, 'full.protocolSection.outcomesModule'); return o ? arr(o.primaryOutcomes).length + arr(o.secondaryOutcomes).length : 'Open details to load'; }], ['Eligibility (sex / ages)', function (d) { var e = get(d, 'full.protocolSection.eligibilityModule'); return e ? [e.sex, e.minimumAge, e.maximumAge].filter(Boolean).join(' · ') : 'Open details to load'; }]],
  Drugs: [['Generic', function (d) { return arr(d.generic).join('; '); }], ['Brand', function (d) { return arr(d.brand).concat(arr(d.products).map(function (p) { return p.brand; })).filter(Boolean).join('; '); }], ['Manufacturer / sponsor', function (d) { return arr(d.manufacturer).join('; ') || d.sponsor; }], ['Application', function (d) { return arr(d.appl).join('; '); }], ['Product type', function (d) { return arr(d.productType).join('; '); }], ['Dosage form', function (d) { return arr(d.products).map(function (p) { return p.form; }).join('; '); }], ['Route', function (d) { return arr(d.route).concat(arr(d.products).map(function (p) { return p.route; })).join('; '); }], ['Marketing status', function (d) { return uniq(arr(d.products).map(function (p) { return p.status; })).join('; '); }], ['Latest submission', function (d) { return d.submissions && d.submissions[0] ? fdaDate(d.submissions[0].date) : ''; }], ['Label effective', function (d) { return fdaDate(d.effective || ''); }], ['Match confidence', 'confidence']],
  'Devices / IVDs / CDx': [['Device name', function (d) { return d.deviceName || d.brand; }], ['Product code', function (d) { return d.productCode || arr(d.productCodes).map(function (p) { return p.code; }).join(', '); }], ['Regulation', 'regulation'], ['Class', 'deviceClass'], ['Panel', 'panel'], ['Authorization type', function (d) { return d.pathway ? d.pathway + ' (' + d.pathwayVerb + ')' : ''; }], ['Authorization number', 'number'], ['Decision', function (d) { return d.decision ? d.decision.label : ''; }], ['Decision date', 'decisionDate'], ['Manufacturer / owner', function (d) { return d.applicant || d.company; }], ['UDI-DI', 'di'], ['Oncology tags', function (d) { return arr(d.tags).join(', '); }], ['Provenance', function () { return 'openFDA (may lag official FDA database)'; }]],
  Variants: [['ID (hg19)', 'id'], ['rsID', 'rsid'], ['Gene', 'gene'], ['HGVS c.', function (d) { return arr(d.hgvsc).join('; '); }], ['HGVS p.', function (d) { return arr(d.hgvsp).join('; '); }], ['Consequence', function (d) { return arr(d.consequence).join(', '); }], ['Impact', function (d) { return arr(d.impact).join(', '); }], ['ClinVar', function (d) { return arr(d.clinvar).map(function (x) { return x[0]; }).join('; '); }], ['CADD', 'cadd']],
  Genes: [['Symbol', 'symbol'], ['Name', 'name'], ['Aliases', function (d) { return arr(d.aliases).join(', '); }], ['Chromosome', 'chr'], ['UniProt', 'uniprot'], ['Ensembl', 'ensembl'], ['Entrez', 'entrez']],
  Evidence: [['ID', 'name'], ['Molecular profile', function (d) { return d.molecularProfile && d.molecularProfile.name; }], ['Disease', function (d) { return d.disease && d.disease.name; }], ['Therapy', function (d) { return arr(d.therapies).map(function (t) { return t.name; }).join(' + '); }], ['Level / AMP', function (d) { return d.level || d.amp; }], ['Significance', 'significance'], ['Type', 'type'], ['Source', function (d) { return d.source ? d.source.citation : ''; }]],
  Literature: [['Title', 'title'], ['Year', 'year'], ['Journal', 'journal'], ['PMID', 'pmid'], ['DOI', 'doi'], ['Open access', function (d) { return d.oa ? 'Yes' : 'No'; }], ['Cited by', 'cited']]
};
function cmpVal(f, d) { try { var v = typeof f[1] === 'function' ? f[1](d) : d[f[1]]; return v == null || v === '' ? '—' : v; } catch (e) { return '—'; } }
registerModule({
  id: 'comparison', label: 'Comparison', icon: 'compare',
  count: function () { var n = 0; Object.keys(State.compare).forEach(function (k) { n += State.compare[k].length; }); return n || null; },
  render: function () {
    var groups = Object.keys(State.compare).filter(function (k) { return State.compare[k].length; });
    return H`${moduleHead('comparison', H`<button type="button" class="ow-btn ow-btn-sm" data-act="export-compare-json">${icon('download')}Comparison JSON</button><button type="button" class="ow-btn ow-btn-sm" data-act="export-compare-csv">${icon('table')}Comparison CSV</button><button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="compare-clear">Clear comparison</button>`)}
      <p class="ow-subtle">Up to 5 items per type, in memory only. Add items with “Compare” on any card or detail panel. No free-text notes.</p>
      ${!groups.length ? H`<div class="ow-empty"><h3>Nothing to compare yet</h3><p>Use “Compare” on trials, drugs, devices, variants, genes, evidence or papers.</p></div>` : groups.map(function (gname) {
        var list = State.compare[gname], fields = CMP_FIELDS[gname] || [];
        return H`<div class="ow-section">${sectionHead(gname + ' (' + list.length + '/5)', [])}<div class="ow-table-wrap"><table class="ow-table"><thead><tr><th scope="col">Field</th>${list.map(function (r, i) { return H`<th scope="col">${trunc(r.title, 60)} <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="compare-remove" data-group="${gname}" data-i="${i}" aria-label="Remove ${r.title} from comparison">${icon('x')}</button></th>`; })}</tr></thead>
          <tbody>${fields.map(function (f) { return H`<tr><th scope="row">${f[0]}</th>${list.map(function (r) { return H`<td>${cmpVal(f, r.data)}</td>`; })}</tr>`; })}<tr><th scope="row">Official link</th>${list.map(function (r) { return H`<td>${r.prov && r.prov.url ? ext(r.prov.url, r.prov.sourceName) : '—'}</td>`; })}</tr></tbody></table></div></div>`;
      })}`;
  }
});
registerModule({
  id: 'session-board', label: 'Session Board', icon: 'board',
  count: function () { return State.board.length || null; },
  render: function () {
    return H`${moduleHead('session-board', H`<button type="button" class="ow-btn ow-btn-sm" data-act="export-board">${icon('download')}Export board JSON</button><button type="button" class="ow-btn ow-btn-sm" data-act="print">${icon('print')}Print board</button><button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="board-clear">Clear board</button>`)}
      <div class="ow-notice ow-notice-warn">${icon('shield')}<div>${SAFETY.board}</div></div>
      ${!State.board.length ? H`<div class="ow-empty ow-section"><h3>The board is empty</h3><p>Pin genes, variants, drugs, devices, diagnostics, trials, evidence, assertions and papers with “Board”.</p></div>` : H`<div class="ow-grid ow-section">${State.board.map(function (r, i) {
        return H`<div class="ow-card"><div class="ow-row">${badge(humanEnum(r.type), 'outline')}${r.prov ? H`<span class="ow-subtle">${r.prov.sourceName}</span>` : ''}</div><div class="ow-card-title" style="margin-top:6px">${trunc(r.title, 160)}</div>
          <div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="board-open" data-i="${i}">Details</button>${CMP_GROUP[r.type] ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="board-compare" data-i="${i}">${icon('compare')}Compare</button>` : ''}<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="board-remove" data-i="${i}" aria-label="Remove ${r.title} from board">${icon('x')}Remove</button></div>
          ${r.prov && r.prov.url ? H`<div class="ow-prov">${ext(r.prov.url, 'Official record')}${r.prov.mayLag ? lagBadge() : ''}${r.prov.category === 'derived' ? badge('Derived', 'derived') : ''}</div>` : ''}</div>`; })}</div>`}`;
  }
});
