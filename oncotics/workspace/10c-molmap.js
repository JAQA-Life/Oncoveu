
/* ====================================================================
   OVERVIEW: MOLECULAR CONTEXT MAP (evidence-discovery visualization)
   --------------------------------------------------------------------
   Schema (memory only, rebuilt from loaded slots on every render):
   MMNode { id, type, label, source, sourceName, recordKey, url, category,
            confidence, relevance, expand? }
   MMEdge { id, from, to, rel, source, sourceName, category, confidence, derived }
   Edge categories: molecular-context-source-reported | molecular-context-derived-edge |
     ontology-normalized | expert-curated-license-restricted | patient-education-link-out |
     community-developer-reference | AI-derived
   Relationship labels are neutral (associated with, has evidence for,
   targeted by, tested in, linked to, mentioned in, detected by, prevention
   context, educational link-out). Never "causes", "treats" or "works for".
   ==================================================================== */
var MM_TYPES = {
  gene: ['Gene', '#4F46E5', 'circle'], protein: ['Protein', '#7C3AED', 'circle'], variant: ['Variant', '#0284C7', 'diamond'], drug: ['Drug', '#059669', 'pill'], biologic: ['Biologic', '#10B981', 'pill'],
  vaccine: ['Vaccine', '#6366F1', 'hex'], antigen: ['Antigen', '#8B5CF6', 'hex'], device: ['Device / Dx', '#9333EA', 'square'], disease: ['Disease', '#D97706', 'round'], trial: ['Trial', '#0891B2', 'square'],
  literature: ['Literature', '#EA580C', 'doc'], pathway: ['Pathway', '#A855F7', 'round'], interaction: ['Interaction partner', '#8B5CF6', 'circle'], structure: ['Structure', '#64748B', 'square'],
  evidence: ['Evidence', '#16A34A', 'diamond'], label: ['FDA label', '#047857', 'doc'], expert: ['Expert knowledge', '#B45309', 'star'], education: ['Patient education', '#0D9488', 'star'], developer: ['Developer resource', '#475569', 'star'], concept: ['Concept', '#14B8A6', 'round']
};
var MM_CAT = {
  'molecular-context-source-reported': ['Source-reported', 'solid'], 'molecular-context-derived-edge': ['Derived by Oncotics', 'dashed'], 'ontology-normalized': ['Ontology / dictionary-normalized', 'dashed'],
  'expert-curated-license-restricted': ['Expert-curated (license-restricted link-out)', 'dotted'], 'patient-education-link-out': ['Patient education link-out', 'dotted'], 'community-developer-reference': ['Community / developer reference', 'dotted'], 'AI-derived': ['AI-derived', 'dashdot']
};
var MMState = { hidden: new Set(['developer']), table: false, sel: null, limit: 18, expanded: new Set() };
function resetMMState() { MMState = { hidden: new Set(['developer']), table: false, sel: null, limit: 18, expanded: new Set() }; }
function buildMolMap() {
  var c = State.ctx; if (!c) return { nodes: [], edges: [] };
  var nodes = new Map(), edges = [], ok = function (k) { var s = slot(k); return s.status === 'ok' ? s.data : null; };
  var N = function (id, type, label, o) { if (!nodes.has(id)) nodes.set(id, Object.assign({ id: id, type: type, label: String(label), category: 'molecular-context-source-reported', confidence: 'Exact', relevance: 1 }, o || {})); else if (o && o.relevance) nodes.get(id).relevance = Math.max(nodes.get(id).relevance, o.relevance); return id; };
  var E = function (from, to, rel, src, cat, conf) { if (!from || !to || from === to) return; if (edges.some(function (e) { return e.from === from && e.to === to && e.rel === rel; })) return; edges.push({ id: 'e' + edges.length, from: from, to: to, rel: rel, source: src, sourceName: SRC[src] ? SRC[src].displayName : src, category: cat || 'molecular-context-source-reported', confidence: conf || 'Exact', derived: /derived|normalized|AI/.test(cat || '') }); };
  var g = bioGene(), center;
  // Center node
  if (c.type === 'variant' && c.gene) center = N('v:' + (c.variantName || c.label), 'variant', c.variantName || c.label, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if ((c.type === 'gene' || c.type === 'uniprot' || c.type === 'ensembl') && g) center = N('g:' + g, 'gene', g, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if (c.type === 'drug') center = N('d:' + c.drug.toLowerCase(), BIOLOGIC_END.test(c.drug) ? 'biologic' : 'drug', c.drug, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if (c.type === 'vaccine') center = N('vx:' + c.vaccine.name, 'vaccine', c.vaccine.name, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if (c.type === 'disease') center = N('dz:' + c.disease.toLowerCase(), 'disease', c.disease, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if (c.type === 'device') center = N('dev:q', 'device', c.label, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  else if (c.type === 'nct') center = N('t:' + c.nct, 'trial', c.nct, { relevance: 100, source: 'query', url: LINK.ctStudy(c.nct) });
  else center = N('q', 'concept', c.label, { relevance: 100, source: 'query', category: 'heuristic-interpretation' });
  // Gene / protein
  var geneId = null;
  if (g) {
    geneId = c.type === 'gene' || c.type === 'uniprot' || c.type === 'ensembl' ? center : N('g:' + g, 'gene', g, { relevance: 80, source: 'mygene', url: linkout('ncbi-gene', g) });
    if (geneId !== center) E(geneId, center, c.type === 'variant' ? 'has variant' : 'linked to', c.type === 'variant' ? 'civic' : 'derived', c.type === 'variant' ? 'molecular-context-source-reported' : 'molecular-context-derived-edge', c.type === 'variant' ? 'Exact' : 'Likely');
    var mg = ok('gene:mygene'), up = ok('bio:uniprot');
    var acc = up ? up.protein.data.acc : (mg && mg.items[0].data.uniprot);
    if (acc) { var pid = N('p:' + acc, 'protein', acc + (up && up.protein.data.name ? ' · ' + trunc(up.protein.data.name, 28) : ''), { relevance: 70, source: up ? 'uniprot' : 'mygene', url: LINK.uniprot(acc), recordKey: up ? up.protein.key : null, expand: 'protein' }); E(geneId, pid, 'encodes', up ? 'uniprot' : 'mygene'); }
    var re = ok('bio:reactome'); if (re && acc) re.items.slice(0, 5).forEach(function (x) { E('p:' + acc, N('pw:' + x.stId, 'pathway', trunc(x.name, 34), { relevance: 30, source: 'reactome', url: LINK.reactome(x.stId) }), 'participates in', 'reactome', x.fromSearch ? 'molecular-context-derived-edge' : 'molecular-context-source-reported', x.fromSearch ? 'Possible' : 'Exact'); });
    var st = ok('bio:string'); if (st && acc) st.items.slice(0, 6).forEach(function (x) { E('p:' + acc, N('ip:' + x.partner, 'interaction', x.partner, { relevance: 25 + 20 * (x.score || 0), source: 'string', url: linkout('string', x.partner) }), 'interacts with (score ' + (x.score != null ? Number(x.score).toFixed(2) : '?') + ')', 'string'); });
    var af = ok('bio:alphafold'); if (af && acc) E('p:' + acc, N('s:af:' + acc, 'structure', 'AlphaFold ' + af.model.id, { relevance: 20, source: 'alphafold', url: LINK.alphafold(acc) }), 'has structure (predicted)', 'alphafold');
    var pe = ok('bio:pdbe'); if (pe && acc) pe.items.slice(0, 2).forEach(function (x) { E('p:' + acc, N('s:pdb:' + x.pdb, 'structure', 'PDB ' + x.pdb + (x.resolution ? ' · ' + x.resolution + ' Å' : ''), { relevance: 22, source: 'pdbe', url: LINK.pdbe(x.pdb) }), 'has structure', 'pdbe'); });
    var ot = ok('bio:ot'); if (ot) { ot.drugs.slice(0, 4).forEach(function (x) { E(geneId, N('d:' + String(x.name).toLowerCase(), 'drug', titleCase(x.name), { relevance: 45, source: 'opentargets', url: LINK.otDrug(x.id) }), 'targeted by', 'opentargets'); }); ot.diseases.slice(0, 3).forEach(function (x) { E(geneId, N('dz:' + String(x.name).toLowerCase(), 'disease', x.name, { relevance: 35, source: 'opentargets', url: LINK.otDisease(x.id) }), 'associated with (OT score ' + (x.score != null ? Number(x.score).toFixed(2) : '?') + ')', 'opentargets'); }); }
    var dg = ok('bio:dgidb'); if (dg) dg.items.slice(0, 5).forEach(function (x) { E(geneId, N('d:' + String(x.drug).toLowerCase(), 'drug', titleCase(x.drug), { relevance: 40 + Math.min(10, x.score || 0), source: 'dgidb', url: LINK.dgidbDrug(x.drug) }), 'targeted by (DGIdb' + (x.types.length ? ': ' + x.types[0] : '') + ')', 'dgidb', 'molecular-context-source-reported', 'Likely'); });
    var gdx = ok('dev:gene-dx'); if (gdx) gdx.candidates.slice(0, 3).forEach(function (x) { E(N('dx:' + x.rec.data.number, 'device', trunc(x.rec.data.deviceName || x.rec.data.number, 30), { relevance: 30, source: 'openfda-device', recordKey: x.rec.key, url: x.rec.prov.url, category: 'molecular-context-derived-edge', confidence: x.confidence }), geneId, 'detected by (derived)', 'openfda-device', 'molecular-context-derived-edge', x.confidence); });
    // Expert / education link-outs (labeled distinctly)
    E(geneId, N('x:oncokb:' + g, 'expert', 'OncoKB: ' + g, { relevance: 12, source: 'oncokb', url: linkout('oncokb', g), category: 'expert-curated-license-restricted', confidence: 'Unresolved' }), 'expert-curated link-out', 'oncokb', 'expert-curated-license-restricted', 'Unresolved');
    E(geneId, N('x:clingen:' + g, 'expert', 'ClinGen / GenCC: ' + g, { relevance: 8, source: 'clingen_gencc', url: linkout('clingen_gencc', g), category: 'expert-curated-license-restricted', confidence: 'Unresolved' }), 'gene-disease validity link-out', 'clingen_gencc', 'expert-curated-license-restricted', 'Unresolved');
  }
  // CIViC evidence: variants, diseases, therapies
  var ev = ok('civic:evidence');
  if (ev) {
    var mps = countBy(ev.items, function (r) { return r.data.molecularProfile.name; }).slice(0, 5);
    mps.forEach(function (m) { if (c.type === 'variant' && m[0] === (c.variantName || c.label)) return; if (geneId && m[0] !== g) E(geneId, N('v:' + m[0], 'variant', m[0], { relevance: 40 + m[1], source: 'civic', url: linkout('civic', m[0]) }), 'has variant', 'civic'); });
    var anchor = c.type === 'variant' ? center : (geneId || center);
    countBy(ev.items, function (r) { return r.data.disease ? r.data.disease.name : null; }).filter(function (x) { return x[0] !== 'Not reported'; }).slice(0, 4).forEach(function (d2) { E(anchor, N('dz:' + d2[0].toLowerCase(), 'disease', d2[0], { relevance: 40 + d2[1], source: 'civic' }), 'has evidence for (' + d2[1] + ' CIViC items)', 'civic'); });
    countBy(ev.items, function (r) { return r.data.therapies.map(function (t) { return t.name; }); }).filter(function (x) { return x[0] !== 'Not reported'; }).slice(0, 4).forEach(function (t) { E(anchor, N('d:' + t[0].toLowerCase(), 'drug', t[0], { relevance: 40 + t[1], source: 'civic' }), 'has evidence for therapy (' + t[1] + ')', 'civic'); });
    var top = ev.items[0]; if (top) E(anchor, N('ev:' + top.data.id, 'evidence', top.data.name + ' · Level ' + top.data.level, { relevance: 30, source: 'civic', recordKey: top.key, url: top.prov.url }), 'has evidence', 'civic');
  }
  // Drug label, CDx
  var lb = ok('drug:labels'), drugAnchor = c.type === 'drug' ? center : null;
  if (lb && drugAnchor) { var l0 = lb.items[0]; E(drugAnchor, N('lb:' + (l0.data.setId || l0.key), 'label', 'FDA label: ' + trunc(l0.title, 26), { relevance: 50, source: 'openfda-drug', recordKey: l0.key, url: l0.prov.url, confidence: l0.data.confidence }), 'has label', 'openfda-drug', l0.data.confidence === 'Exact' ? 'molecular-context-source-reported' : 'molecular-context-derived-edge', l0.data.confidence); }
  var cdx = ok('drug:cdx'); if (cdx && drugAnchor) cdx.candidates.slice(0, 3).forEach(function (x) { E(drugAnchor, N('dx:' + x.rec.data.number, 'device', trunc(x.rec.data.deviceName || x.rec.data.number, 30), { relevance: 35, source: 'openfda-device', recordKey: x.rec.key, url: x.rec.prov.url, confidence: x.confidence }), 'linked to companion diagnostic (derived)', 'openfda-device', 'molecular-context-derived-edge', x.confidence); });
  var dgd = ok('drug:dgidb'); if (dgd && drugAnchor) dgd.items.slice(0, 5).forEach(function (x) { E(drugAnchor, N('g:' + x.gene, 'gene', x.gene, { relevance: 45, source: 'dgidb', url: LINK.dgidbGene(x.gene) }), 'interacts with gene (DGIdb' + (x.types.length ? ': ' + x.types[0] : '') + ')', 'dgidb', 'molecular-context-source-reported', 'Likely'); });
  // Vaccine: antigen + prevention context (dictionary-normalized, therefore derived)
  if (c.type === 'vaccine') {
    var v = c.vaccine;
    if (v.antigen) E(center, N('ag:' + v.antigen, 'antigen', trunc(v.antigen, 34), { relevance: 60, source: 'oncotics-dictionary', category: 'ontology-normalized', confidence: 'Likely' }), 'targets antigen', 'Oncotics vaccine dictionary', 'ontology-normalized', 'Likely');
    if (v.antigenGene) E('ag:' + v.antigen, N('g:' + v.antigenGene, 'gene', v.antigenGene, { relevance: 40, source: 'oncotics-dictionary', url: linkout('ncbi-gene', v.antigenGene), category: 'ontology-normalized' }), 'antigen gene', 'Oncotics vaccine dictionary', 'ontology-normalized', 'Likely');
    arr(v.cancers).slice(0, 4).forEach(function (dz) { E(center, N('dz:' + dz.toLowerCase(), 'disease', dz, { relevance: 45, source: 'oncotics-dictionary', category: 'ontology-normalized', confidence: 'Likely' }), v.kind === 'preventive' ? 'prevention context' : 'studied context', 'Oncotics vaccine dictionary', 'ontology-normalized', 'Likely'); });
    var vl = ok('vax:labels'); if (vl) { var v0 = vl.items[0]; E(center, N('lb:' + (v0.data.setId || v0.key), 'label', 'FDA label: ' + trunc(v0.title, 26), { relevance: 50, source: 'openfda-drug', recordKey: v0.key, url: v0.prov.url, confidence: v0.data.confidence }), 'has label', 'openfda-drug', 'molecular-context-source-reported', v0.data.confidence); }
  }
  // Trials and literature (search matches → derived "linked to"/"mentioned in")
  var tr = ok('trials:list');
  if (tr) tr.items.slice(0, 4).forEach(function (r) {
    var tid = N('t:' + r.data.nct, 'trial', r.data.nct, { relevance: 30, source: 'ctgov', recordKey: r.key, url: r.prov.url });
    E(center, tid, c.type === 'disease' ? 'has trials' : 'tested in / linked to (search match)', 'ctgov', 'molecular-context-derived-edge', 'Likely');
    r.data.interventions.slice(0, 2).forEach(function (i) { if (/DRUG|BIOLOGICAL/.test(i.type) && nodes.has('d:' + String(i.name).toLowerCase())) E('d:' + String(i.name).toLowerCase(), tid, 'tested in', 'ctgov'); });
  });
  var lit = ok('lit:list');
  if (lit) lit.items.slice(0, 3).forEach(function (r) { E(center, N('lit:' + r.data.id, 'literature', trunc(r.data.title, 30) + (r.data.year ? ' (' + r.data.year + ')' : ''), { relevance: 20, source: 'europepmc', recordKey: r.key, url: r.prov.url, confidence: 'Likely' }), 'mentioned in (search match)', 'europepmc', 'molecular-context-derived-edge', 'Likely'); });
  // Patient education / developer references (distinctly labeled; developer hidden by default)
  var topic = c.disease || (c.vaccine && c.vaccine.name) || c.label;
  E(center, N('edu:oncolink', 'education', 'OncoLink: ' + trunc(topic, 22), { relevance: 10, source: 'oncolink', url: linkout('oncolink', topic), category: 'patient-education-link-out', confidence: 'Unresolved' }), 'educational link-out', 'oncolink', 'patient-education-link-out', 'Unresolved');
  E(center, N('dev:openonco', 'developer', 'OpenOnco (GitHub)', { relevance: 4, source: 'openonco_github', url: linkout('openonco_github', ''), category: 'community-developer-reference', confidence: 'Unresolved' }), 'developer reference', 'openonco_github', 'community-developer-reference', 'Unresolved');
  return { nodes: Array.from(nodes.values()), edges: edges, center: center };
}
function mmVisible(G) {
  var keep = G.nodes.filter(function (n) { return n.id === G.center || !MMState.hidden.has(n.type); });
  keep.sort(function (a, b) { return (b.id === G.center) - (a.id === G.center) || b.relevance - a.relevance; });
  var lim = MMState.limit + MMState.expanded.size * 6;
  var vis = keep.slice(0, lim), ids = new Set(vis.map(function (n) { return n.id; }));
  // Keep nodes reachable from the center through visible nodes only.
  var adj = new Map(); G.edges.forEach(function (e) { if (ids.has(e.from) && ids.has(e.to)) { (adj.get(e.from) || adj.set(e.from, []).get(e.from)).push(e.to); (adj.get(e.to) || adj.set(e.to, []).get(e.to)).push(e.from); } });
  var seen = new Set([G.center]), q = [G.center], depth = {}; depth[G.center] = 0;
  while (q.length) { var x = q.shift(); arr(adj.get(x)).forEach(function (y) { if (!seen.has(y)) { seen.add(y); depth[y] = depth[x] + 1; q.push(y); } }); }
  vis = vis.filter(function (n) { return seen.has(n.id); });
  return { nodes: vis, edges: G.edges.filter(function (e) { return seen.has(e.from) && seen.has(e.to); }), depth: depth, hiddenCount: keep.length - vis.length };
}
function mmLayout(V, W, Hh) {
  var pos = {}, cx = W / 2, cy = Hh / 2, ring1 = V.nodes.filter(function (n) { return V.depth[n.id] === 1; }), ring2 = V.nodes.filter(function (n) { return V.depth[n.id] >= 2; });
  pos[V.nodes[0].id] = { x: cx, y: cy };
  var order = Object.keys(MM_TYPES); ring1.sort(function (a, b) { return order.indexOf(a.type) - order.indexOf(b.type) || b.relevance - a.relevance; });
  var R1x = W * 0.30, R1y = Hh * 0.33;
  ring1.forEach(function (n, i) { var a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, ring1.length); pos[n.id] = { x: cx + R1x * Math.cos(a), y: cy + R1y * Math.sin(a), a: a }; });
  var parentOf = {}; V.edges.forEach(function (e) { if (V.depth[e.to] === V.depth[e.from] + 1) parentOf[e.to] = parentOf[e.to] || e.from; if (V.depth[e.from] === V.depth[e.to] + 1) parentOf[e.from] = parentOf[e.from] || e.to; });
  var kids = {}; ring2.forEach(function (n) { var p = parentOf[n.id]; (kids[p] = kids[p] || []).push(n); });
  Object.keys(kids).forEach(function (p) { var base = pos[p] ? pos[p].a : 0, list = kids[p], spread = Math.min(0.9, 0.28 * list.length); list.forEach(function (n, i) { var a = base + (list.length > 1 ? -spread / 2 + spread * i / (list.length - 1) : 0); pos[n.id] = { x: cx + W * 0.45 * Math.cos(a), y: cy + Hh * 0.45 * Math.sin(a), a: a }; }); });
  V.nodes.forEach(function (n) { if (!pos[n.id]) pos[n.id] = { x: cx, y: cy }; pos[n.id].x = Math.max(60, Math.min(W - 60, pos[n.id].x)); pos[n.id].y = Math.max(22, Math.min(Hh - 26, pos[n.id].y)); });
  return pos;
}
function mmShape(type, x, y, r) {
  var s = (MM_TYPES[type] || MM_TYPES.concept)[2], X = x.toFixed(1), Y = y.toFixed(1);
  if (s === 'diamond') return '<path d="M' + X + ' ' + (y - r).toFixed(1) + 'L' + (x + r).toFixed(1) + ' ' + Y + 'L' + X + ' ' + (y + r).toFixed(1) + 'L' + (x - r).toFixed(1) + ' ' + Y + 'Z"/>';
  if (s === 'square' || s === 'doc') return '<rect x="' + (x - r * 0.85).toFixed(1) + '" y="' + (y - r * 0.85).toFixed(1) + '" width="' + (r * 1.7).toFixed(1) + '" height="' + (r * 1.7).toFixed(1) + '" rx="' + (s === 'doc' ? 2 : 4) + '"/>';
  if (s === 'pill') return '<rect x="' + (x - r * 1.15).toFixed(1) + '" y="' + (y - r * 0.7).toFixed(1) + '" width="' + (r * 2.3).toFixed(1) + '" height="' + (r * 1.4).toFixed(1) + '" rx="' + (r * 0.7).toFixed(1) + '"/>';
  if (s === 'hex') { var p = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i; p.push((x + r * Math.cos(a)).toFixed(1) + ' ' + (y + r * Math.sin(a)).toFixed(1)); } return '<path d="M' + p.join('L') + 'Z"/>'; }
  if (s === 'star') { var q = []; for (var j = 0; j < 10; j++) { var b = -Math.PI / 2 + Math.PI / 5 * j, rr = j % 2 ? r * 0.5 : r; q.push((x + rr * Math.cos(b)).toFixed(1) + ' ' + (y + rr * Math.sin(b)).toFixed(1)); } return '<path d="M' + q.join('L') + 'Z"/>'; }
  return '<circle cx="' + X + '" cy="' + Y + '" r="' + r + '"/>';
}
function molMapSvg(G, V) {
  var W = 820, Hh = 480, pos = mmLayout(V, W, Hh), out = [];
  var dash = { solid: '', dashed: '6 4', dotted: '2 4', dashdot: '8 3 2 3' };
  V.edges.forEach(function (e) {
    var a = pos[e.from], b = pos[e.to]; if (!a || !b) return; var st = (MM_CAT[e.category] || ['', 'solid'])[1];
    var tt = e.from === G.center ? 0.62 : e.to === G.center ? 0.38 : 0.5, mx = a.x + (b.x - a.x) * tt, my = a.y + (b.y - a.y) * tt;
    out.push('<g class="ow-mm-edge ow-mm-' + st + '"><line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"' + (dash[st] ? ' stroke-dasharray="' + dash[st] + '"' : '') + '/>' + (V.nodes.length <= 22 ? '<text x="' + mx.toFixed(1) + '" y="' + (my - 3).toFixed(1) + '" text-anchor="middle" class="ow-mm-elabel">' + esc(trunc(e.rel, 30)) + '</text>' : '') + '</g>');
  });
  V.nodes.forEach(function (n, i) {
    var p = pos[n.id], T = MM_TYPES[n.type] || MM_TYPES.concept, r = i === 0 ? 20 : 12, sel = MMState.sel === n.id;
    out.push('<g class="ow-mm-node' + (sel ? ' ow-mm-sel' : '') + (n.category !== 'molecular-context-source-reported' && n.category !== 'heuristic-interpretation' ? ' ow-mm-soft' : '') + '" tabindex="0" role="button" data-act="mm-node" data-id="' + esc(n.id) + '" aria-label="' + esc(T[0] + ': ' + n.label + '. Source ' + (n.source || 'query') + '. Press Enter for provenance and actions.') + '" style="--mm:' + T[1] + '">'
      + mmShape(n.type, p.x, p.y, r) + '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + r + 13).toFixed(1) + '" text-anchor="middle" class="ow-mm-label">' + esc(trunc(n.label, i === 0 ? 30 : 24)) + '</text>'
      + '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 3.5).toFixed(1) + '" text-anchor="middle" class="ow-mm-glyph" aria-hidden="true">' + esc(T[0].slice(0, i === 0 ? 3 : 1)) + '</text></g>');
  });
  return raw('<svg class="ow-mm-svg" viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="group" aria-label="Molecular Context Map: ' + V.nodes.length + ' nodes and ' + V.edges.length + ' relationships. A text table follows.">' + out.join('') + '</svg>');
}
function molMapPanel() {
  var G = buildMolMap(); if (!G.nodes.length) return '';
  var V = mmVisible(G), types = countBy(G.nodes.filter(function (n) { return n.id !== G.center; }), function (n) { return n.type; });
  var head = H`<div class="ow-card-head"><div><div class="ow-card-title">${icon('graph')} Molecular Context Map</div><div class="ow-card-sub">${V.nodes.length} of ${G.nodes.length} nodes · ${V.edges.length} relationships · built from records loaded in memory</div></div>
    <div class="ow-toolbar"><div class="ow-seg" role="group" aria-label="Map view"><button type="button" aria-pressed="${!MMState.table ? 'true' : 'false'}" data-act="mm-view" data-view="map">${icon('graph')} Map</button><button type="button" aria-pressed="${MMState.table ? 'true' : 'false'}" data-act="mm-view" data-view="table">${icon('table')} Table</button></div>
      <button type="button" class="ow-btn ow-btn-sm" data-act="mm-enrich">${icon('refresh')}Load biology context</button><button type="button" class="ow-btn ow-btn-sm" data-act="mm-export" data-fmt="json">${icon('download')}JSON</button><button type="button" class="ow-btn ow-btn-sm" data-act="mm-export" data-fmt="csv">${icon('table')}CSV</button></div></div>`;
  var filters = H`<div class="ow-mm-filters" role="group" aria-label="Filter node types">${types.map(function (t) { var T = MM_TYPES[t[0]] || MM_TYPES.concept, on = !MMState.hidden.has(t[0]); return H`<label class="ow-check ow-mm-chip"><input type="checkbox" data-change="mm-type" value="${t[0]}" ${on ? raw('checked') : ''}><span class="ow-mm-sw" style="--mm:${T[1]}" aria-hidden="true"></span>${T[0]} <span class="ow-subtle">(${t[1]})</span></label>`; })}</div>`;
  var legend = H`<div class="ow-mm-legend">${Object.keys(MM_CAT).map(function (k) { return H`<span class="ow-mm-lg"><svg width="34" height="10" aria-hidden="true"><line x1="0" y1="5" x2="34" y2="5" stroke="currentColor" stroke-width="2" ${raw(MM_CAT[k][1] === 'dashed' ? 'stroke-dasharray="6 4"' : MM_CAT[k][1] === 'dotted' ? 'stroke-dasharray="2 4"' : MM_CAT[k][1] === 'dashdot' ? 'stroke-dasharray="8 3 2 3"' : '')}/></svg>${MM_CAT[k][0]}</span>`; })}</div>`;
  var tbl = H`${table([{ label: 'Node', render: function (n) { var T = MM_TYPES[n.type] || MM_TYPES.concept; return H`<button type="button" class="ow-linkbtn" data-act="mm-node" data-id="${n.id}">${n.label}</button><div class="ow-subtle">${T[0]}</div>`; } }, { label: 'Source', render: function (n) { return SRC[n.source] ? SRC[n.source].displayName : (n.source || 'query'); } }, { label: 'Data category', render: function (n) { return n.category; } }, { label: 'Confidence', render: function (n) { return confBadge(n.confidence); } }], V.nodes, 'Nodes')}
    ${table([{ label: 'From', render: function (e) { var n = G.nodes.find(function (x) { return x.id === e.from; }); return n ? n.label : e.from; } }, { label: 'Relationship', key: 'rel' }, { label: 'To', render: function (e) { var n = G.nodes.find(function (x) { return x.id === e.to; }); return n ? n.label : e.to; } }, { label: 'Source', render: function (e) { return e.sourceName; } }, { label: 'Category', render: function (e) { return (MM_CAT[e.category] || [e.category])[0]; } }, { label: 'Confidence', render: function (e) { return confBadge(e.confidence); } }], V.edges, 'Relationships')}`;
  return H`<div class="ow-card ow-mm-card">${head}${filters}
    ${MMState.table ? tbl : H`<div class="ow-mm-wrap">${molMapSvg(G, V)}</div>${legend}${det('mm-table', H`${icon('table')} Text / table fallback (${V.nodes.length} nodes, ${V.edges.length} relationships)`, tbl, false)}`}
    ${V.hiddenCount > 0 ? H`<p class="ow-subtle">${V.hiddenCount} lower-relevance nodes hidden to keep the map readable. <button type="button" class="ow-linkbtn" data-act="mm-more">Show more</button></p>` : ''}
    <div class="ow-disclaimer">${SAFETY.molmap}</div></div>`;
}
function mmNodeBody(id) {
  var G = buildMolMap(), n = G.nodes.find(function (x) { return x.id === id; }); if (!n) return H`<p>This node is no longer in memory.</p>`;
  var T = MM_TYPES[n.type] || MM_TYPES.concept, es = G.edges.filter(function (e) { return e.from === id || e.to === id; });
  var name = function (nid) { var x = G.nodes.find(function (y) { return y.id === nid; }); return x ? x.label : nid; };
  var search = { gene: 'gene', protein: 'gene', variant: 'variant', drug: 'drug', biologic: 'drug', disease: 'disease', interaction: 'gene', vaccine: null, trial: null }[n.type];
  var term = n.type === 'protein' ? (bioGene() || n.label) : n.type === 'trial' ? n.label : n.label.replace(/^(OncoKB|ClinGen \/ GenCC|OncoLink|FDA label): /, '');
  return H`<div class="ow-row">${badge(T[0], 'outline')}${badge((MM_CAT[n.category] || [n.category])[0], n.category === 'molecular-context-source-reported' ? 'good' : 'derived')}${confBadge(n.confidence)}</div>
    <dl class="ow-kv ow-section"><dt>Source</dt><dd>${SRC[n.source] ? SRC[n.source].displayName : (n.source || 'Query (heuristic interpretation)')}</dd><dt>Data category</dt><dd>${n.category}</dd><dt>Retrieved</dt><dd>This session only (memory)</dd><dt>Official link</dt><dd>${n.url ? ext(n.url, 'Open') : nr()}</dd></dl>
    <h4>Relationships</h4><ul>${es.map(function (e) { return H`<li>${name(e.from)} → <strong>${e.rel}</strong> → ${name(e.to)} <span class="ow-subtle">(${e.sourceName}; ${(MM_CAT[e.category] || [e.category])[0]}; ${e.confidence})</span></li>`; })}</ul>
    <div class="ow-card-foot">${n.recordKey ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="open-rec" data-key="${n.recordKey}">Open record</button>` : ''}${search ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search-as" data-term="${term}" data-type="${search}">Explore ${T[0].toLowerCase()}</button>` : n.type === 'trial' ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="search" data-term="${n.label}">Explore trial</button>` : ''}
      ${n.expand ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="mm-expand" data-id="${n.id}">${icon('graph')}Expand neighbors (pathways, interactions, structure)</button>` : ''}
      <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="mm-pin" data-id="${n.id}">${icon('pin')}Add to Session Board</button></div>
    <div class="ow-disclaimer">${SAFETY.molmap}</div>`;
}
function molMapExport() {
  var G = buildMolMap();
  return { nodes: G.nodes.map(function (n) { return { id: n.id, type: n.type, label: n.label, source: SRC[n.source] ? SRC[n.source].displayName : n.source, category: n.category, confidence: n.confidence, url: n.url || null }; }),
    edges: G.edges.map(function (e) { return { from: e.from, to: e.to, relationship: e.rel, source: e.sourceName, category: e.category, confidence: e.confidence, derived: e.derived }; }) };
}
