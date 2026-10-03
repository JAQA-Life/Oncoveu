/* ====================================================================
   3D TRAINED CANCER AI (self-hosted packs; schema oncotics-model-pack/1)
     brain-mri-brats-segresnet  MONAI brats_mri_segmentation (SegResNet): T1c+T1+T2+FLAIR
                                -> tumour core / whole tumour / enhancing tumour masks + volumes
     lung-ct-luna16-retinanet   MONAI lung_nodule_ct_detection (RetinaNet): chest CT
                                -> 3D lung nodule candidate boxes
   This file is a port of oncotics/ai/pipeline3d.py, which build_model_packs.py
   checks against MONAI itself (NormalizeIntensity, sliding_window_inference,
   RetinaNetDetector). The network runs in a Web Worker (ONNX Runtime Web,
   WebAssembly) so the page stays responsive; every window can be cancelled.
   Volumes are assembled in memory from a NIfTI file or a DICOM series
   (ImagePositionPatient / ImageOrientationPatient). Nothing leaves the browser.
   ==================================================================== */
var TASKS_3D = { 'brain-mri-seg-3d': 1, 'lung-ct-detection-3d': 1 };
var BRAIN_CH_COLORS = { 'Whole tumor': [74, 222, 128], 'Tumor core': [251, 146, 60], 'Enhancing tumor': [248, 113, 113] };
function v3() { if (!S.ai.v3) S.ai.v3 = { ch: {}, roi: 'slab', slabMm: 30, progress: null, cancel: false, secPerTile: {} }; return S.ai.v3; }
function is3dPack(e) { return !!(e && e.pack && TASKS_3D[e.pack.task]); }
function cancelled() { var e = new Error('cancelled'); return e; }

/* ---------------- Web Worker running the ONNX session ---------------- */
var WORKER_SRC = [
  'var ort = null, sess = null;',
  'self.onmessage = async function (e) { var m = e.data; try {',
  '  if (m.type === "init") { var mod = await import(m.ortUrl); ort = mod.InferenceSession ? mod : mod.default; ort.env.wasm.wasmPaths = m.base; ort.env.wasm.numThreads = m.threads; ort.env.wasm.proxy = false; ort.env.logLevel = "fatal";',
  '    sess = await ort.InferenceSession.create(new Uint8Array(m.model), { executionProviders: ["wasm"], graphOptimizationLevel: "all" }); self.postMessage({ type: "ready", id: m.id }); }',
  '  else if (m.type === "run") { var feeds = {}; feeds[m.input] = new ort.Tensor("float32", m.data, m.dims); var out = await sess.run(feeds), res = {}, tr = [];',
  '    for (var i = 0; i < m.outputs.length; i++) { var t = out[m.outputs[i]], d = new Float32Array(t.data); res[m.outputs[i]] = { data: d, dims: Array.prototype.slice.call(t.dims) }; tr.push(d.buffer); }',
  '    self.postMessage({ type: "out", id: m.id, out: res }, tr); }',
  '} catch (err) { self.postMessage({ type: "error", id: m.id }); } };'
].join('\n');
function cpuThreads() { return window.crossOriginIsolated && typeof SharedArrayBuffer === 'function' ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1; }
function workerStart(e) {
  if (e.worker) return Promise.resolve(e.worker);
  var url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })), w;
  try { w = new Worker(url, { type: 'module' }); } finally { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }
  var W = { w: w, seq: 0, pending: new Map() };
  w.onmessage = function (ev) { var m = ev.data, p = W.pending.get(m.id); if (!p) return; W.pending.delete(m.id); if (m.type === 'error') p.reject(new Error('worker')); else p.resolve(m); };
  w.onerror = function () { W.pending.forEach(function (p) { p.reject(new Error('worker')); }); W.pending.clear(); };
  e.worker = W;
  var threads = cpuThreads();
  return workerCall(e, { type: 'init', ortUrl: new URL(CONFIG.ortBase + 'ort.wasm.min.mjs', location.href).href, base: new URL(CONFIG.ortBase, location.href).href, threads: threads, model: e.bytes.slice(0) }).then(function () { return W; });
}
function workerCall(e, msg, transfer) {
  var W = e.worker; if (!W) return Promise.reject(new Error('worker'));
  return new Promise(function (resolve, reject) { msg.id = ++W.seq; W.pending.set(msg.id, { resolve: resolve, reject: reject }); W.w.postMessage(msg, transfer || (msg.model ? [msg.model] : [])); });
}
function workerStop(e) { if (!e || !e.worker) return; e.worker.pending.forEach(function (p) { p.reject(cancelled()); }); e.worker.w.terminate(); e.worker = null; }
async function runWindow(e, data, dims) {
  if (v3().cancel) throw cancelled();
  await workerStart(e);
  var P = e.pack, outs = (P.output.cls ? P.output.cls.concat(P.output.box) : [P.output.name]);
  var m = await workerCall(e, { type: 'run', input: P.input.name, data: data, dims: dims, outputs: outs }, [data.buffer]);
  return outs.map(function (k) { return m.out[k]; });
}

/* ---------------- Volumes (NIfTI record or DICOM series) ---------------- */
function volKeyOf(img) { return img ? (img.vol ? img.id : img.seriesId) : null; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function volCandidates() {
  var out = [];
  S.studies.forEach(function (st) {
    st.series.forEach(function (se) {
      var ims = se.images.map(function (id) { return S.images.get(id); }).filter(function (im) { return im && im.kind === 'gray'; });
      ims.forEach(function (im) { if (im.vol) out.push({ key: im.id, img: im, n: im.vol.n.slice(), label: st.label + ' · ' + se.label + (im.vol.nt > 1 ? ' · volume ' + (im.vol.t + 1) : '') + (im.seqHint ? ' (' + im.seqHint + ')' : '') }); });
      var dic = ims.filter(function (im) { return !im.vol && im.isDicom && !im.synthetic; });
      if (dic.length >= 8 || (dic.length === 1 && dic[0].frames.length >= 8)) out.push({ key: se.id, img: dic[0], n: [dic[0].w, dic[0].h, dic.length > 1 ? dic.length : dic[0].frames.length], label: st.label + ' · ' + se.label + ' · ' + (se.modality || 'DICOM') + ' series' });
    });
  });
  return out;
}
function buildVolume(key) {
  var img = S.images.get(key);
  if (img && img.vol) {
    var V0 = img.vol, n = V0.n, colIdx = new Int32Array(n[0]), rowOff = new Int32Array(n[1]);
    for (var i = 0; i < n[0]; i++) colIdx[i] = V0.flipX ? n[0] - 1 - i : i;
    for (var j = 0; j < n[1]; j++) rowOff[j] = (V0.flipY ? n[1] - 1 - j : j) * n[0];
    return { key: key, n: n.slice(), slices: img.frames, colIdx: colIdx, rowOff: rowOff, sp: V0.sp.slice(), dirs: V0.dirs, approx: false, w: img.w, h: img.h,
      ref: function (k) { return { imageId: img.id, frame: k }; }, toDisp: function (i2, j2) { return [V0.flipX ? n[0] - 1 - i2 : i2, V0.flipY ? n[1] - 1 - j2 : j2]; }, refs: [img.id] };
  }
  var se = null; S.studies.forEach(function (st) { st.series.forEach(function (x) { if (x.id === key) se = x; }); });
  if (!se) throw new Error('no-volume');
  var ims = se.images.map(function (id) { return S.images.get(id); }).filter(function (im) { return im && im.kind === 'gray' && im.isDicom && !im.vol; });
  if (!ims.length) throw new Error('no-volume');
  var a = ims[0], W = a.w, Hh = a.h; ims = ims.filter(function (im) { return im.w === W && im.h === Hh; });
  if (!a.spacing) throw new Error('no-spacing');
  var geo = a.geo || {}, iop = geo.iop || null, approx = !iop, row = iop ? iop.slice(0, 3) : [1, 0, 0], col = iop ? iop.slice(3, 6) : [0, 1, 0], nrm = cross(row, col), slices, refs, dz;
  if (ims.length === 1 && a.frames.length > 1) {
    slices = a.frames; refs = a.frames.map(function (f, k) { return { imageId: a.id, frame: k }; }); dz = geo.thickness || 1; approx = true;
  } else {
    var withPos = ims.every(function (im) { return im.geo && im.geo.ipp; });
    var pos = ims.map(function (im, k) { return { im: im, z: withPos ? dot(im.geo.ipp, nrm) : (im.order || k) }; }).sort(function (p, q) { return p.z - q.z; });
    if (withPos) {
      var d = []; for (var q = 1; q < pos.length; q++) d.push(pos[q].z - pos[q - 1].z);
      var ds = d.slice().sort(function (x, y) { return x - y; }), med = ds[Math.floor(ds.length / 2)];
      if (!(med > 1e-3) || d.some(function (x) { return Math.abs(x - med) > 0.2 * med; })) throw new Error('irregular');
      dz = med;
    } else { dz = geo.thickness || 1; approx = true; }
    slices = pos.map(function (p) { return p.im.frames[0]; }); refs = pos.map(function (p) { return { imageId: p.im.id, frame: 0 }; });
  }
  var ras = function (v) { return [-v[0], -v[1], v[2]]; }, ci = new Int32Array(W), ro = new Int32Array(Hh);
  for (var x = 0; x < W; x++) ci[x] = x; for (var y = 0; y < Hh; y++) ro[y] = y * W;
  return { key: key, n: [W, Hh, slices.length], slices: slices, colIdx: ci, rowOff: ro, sp: [a.spacing[1], a.spacing[0], dz], dirs: [ras(row), ras(col), ras(nrm)], approx: approx, w: W, h: Hh,
    ref: function (k) { return refs[k]; }, toDisp: function (i2, j2) { return [i2, j2]; }, refs: refs.map(function (r) { return r.imageId; }) };
}
// RAS orientation plan (as MONAI Orientation "RAS" on near-axis-aligned volumes): perm[w] = voxel axis, flip[w].
function rasPlan(V) {
  var pairs = [], perm = [null, null, null], flip = [false, false, false], used = [false, false, false];
  for (var a = 0; a < 3; a++) for (var w = 0; w < 3; w++) pairs.push([Math.abs(V.dirs[a][w]), a, w]);
  pairs.sort(function (p, q) { return q[0] - p[0]; });
  pairs.forEach(function (p) { if (!used[p[1]] && perm[p[2]] == null) { perm[p[2]] = p[1]; flip[p[2]] = V.dirs[p[1]][p[2]] < 0; used[p[1]] = true; } });
  return { perm: perm, flip: flip };
}
function gridSize(V, plan, pix) { return [0, 1, 2].map(function (w) { var a = plan.perm[w]; return Math.floor((V.n[a] - 1) * V.sp[a] / pix[w] + 1e-6) + 1; }); }
// Voxel index along axis a <-> output index along w (voxel centres; MONAI Spacing keeps voxel 0 aligned).
function toOut(V, plan, pix, w, idx) { var a = plan.perm[w], o = plan.flip[w] ? V.n[a] - 1 - idx : idx; return o * V.sp[a] / pix[w]; }
function toVox(V, plan, pix, w, m) { var a = plan.perm[w], o = m * pix[w] / V.sp[a]; return plan.flip[w] ? V.n[a] - 1 - o : o; }
// Trilinear resampling of the ROI [lo, hi) of the RAS output grid. Output C-order, last axis fastest.
async function resampleRAS(V, plan, pix, lo, hi) {
  var sz = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], out = new Float32Array(sz[0] * sz[1] * sz[2]), ax = [];
  for (var w = 0; w < 3; w++) {
    var a = plan.perm[w], na = V.n[a], i0 = new Int32Array(sz[w]), i1 = new Int32Array(sz[w]), f = new Float32Array(sz[w]);
    for (var m = 0; m < sz[w]; m++) { var c = Math.max(0, Math.min(na - 1, toVox(V, plan, pix, w, lo[w] + m))), b = Math.floor(c); i0[m] = b; i1[m] = Math.min(na - 1, b + 1); f[m] = c - b; }
    ax.push({ a: a, i0: i0, i1: i1, f: f });
  }
  var I0 = [0, 0, 0], I1 = [0, 0, 0], F = [0, 0, 0], S2 = V.slices, ci = V.colIdx, ro = V.rowOff, p = 0;
  for (var m0 = 0; m0 < sz[0]; m0++) {
    I0[ax[0].a] = ax[0].i0[m0]; I1[ax[0].a] = ax[0].i1[m0]; F[ax[0].a] = ax[0].f[m0];
    for (var m1 = 0; m1 < sz[1]; m1++) {
      I0[ax[1].a] = ax[1].i0[m1]; I1[ax[1].a] = ax[1].i1[m1]; F[ax[1].a] = ax[1].f[m1];
      for (var m2 = 0; m2 < sz[2]; m2++) {
        I0[ax[2].a] = ax[2].i0[m2]; I1[ax[2].a] = ax[2].i1[m2]; F[ax[2].a] = ax[2].f[m2];
        var x0 = ci[I0[0]], x1 = ci[I1[0]], y0 = ro[I0[1]], y1 = ro[I1[1]], s0 = S2[I0[2]], s1 = S2[I1[2]], fx = F[0], fy = F[1], fz = F[2];
        var c00 = s0[y0 + x0] * (1 - fx) + s0[y0 + x1] * fx, c01 = s0[y1 + x0] * (1 - fx) + s0[y1 + x1] * fx, c10 = s1[y0 + x0] * (1 - fx) + s1[y0 + x1] * fx, c11 = s1[y1 + x0] * (1 - fx) + s1[y1 + x1] * fx;
        out[p++] = ((c00 * (1 - fy) + c01 * fy) * (1 - fz)) + ((c10 * (1 - fy) + c11 * fy) * fz);
      }
    }
    if (m0 % 32 === 31) { if (v3().cancel) throw cancelled(); await new Promise(function (r) { setTimeout(r, 0); }); }
  }
  return out;
}

/* ---------------- Sliding windows (pipeline3d.scan_starts) ---------------- */
function scanStarts(size, roi, overlap) {
  if (roi === size) return [0];
  var interval = Math.floor(roi * (1 - overlap)); if (interval <= 0) interval = 1;
  var num = Math.ceil((size - roi) / interval) + 1, out = [];
  for (var i = 0; i < num; i++) out.push(Math.min(i * interval, size - roi));
  return out;
}
function progress(phase, done, total, t0) {
  var P = v3(), el = (Date.now() - t0) / 1000;
  P.progress = { phase: phase, done: done, total: total, left: done > 0 ? el / done * (total - done) : null };
  scheduleRender();
}
function fmtSec(s) { return s == null ? 'estimating…' : s < 90 ? Math.max(1, Math.round(s)) + ' s' : Math.round(s / 60) + ' min'; }

/* ---------------- Brain MRI: BraTS SegResNet ---------------- */
function brainChannels(P) { return P.input.channels; }
function brainAutoAssign(P) {
  var A = v3().ch, cands = volCandidates();
  brainChannels(P).forEach(function (c) {
    if (A[c] && cands.some(function (x) { return x.key === A[c]; })) return;
    var hit = cands.find(function (x) { return x.img.seqHint === c && !brainChannels(P).some(function (o) { return o !== c && A[o] === x.key; }); });
    A[c] = hit ? hit.key : '';
  });
}
function brainCheck(P) {
  var A = v3().ch, keys = brainChannels(P).map(function (c) { return A[c]; });
  if (keys.some(function (k) { return !k; })) return 'Assign a volume to each of the four sequences.';
  if (keys.some(function (k, i) { return keys.indexOf(k) !== i; })) return 'Each sequence needs a different volume.';
  var c = volCandidates(), ns = keys.map(function (k) { var x = c.find(function (y) { return y.key === k; }); return x ? x.n.join('×') : null; });
  if (ns.some(function (n) { return !n; })) return 'A selected volume is no longer in memory.';
  if (ns.some(function (n) { return n !== ns[0]; })) return 'The four volumes must be on the same voxel grid (same matrix size); they are ' + ns.join(', ') + '. Co-register them first (BraTS files already are).';
  return null;
}
async function runBrain(e) {
  var P = e.pack, err = brainCheck(P); if (err) throw new Error('brain-input');
  var chs = brainChannels(P), Vs = chs.map(function (c) { return buildVolume(v3().ch[c]); }), n = Vs[0].n, N = n[0] * n[1] * n[2], C = chs.length;
  var X = new Float32Array(C * N), t0 = Date.now();
  progress('Reading and normalising the four volumes', 0, 1, t0);
  for (var c = 0; c < C; c++) {
    var V = Vs[c], base = c * N, s1 = 0, s2 = 0, cnt = 0;
    for (var k = 0; k < n[2]; k++) { var sl = V.slices[k]; for (var j = 0; j < n[1]; j++) { var ro = V.rowOff[j]; for (var i = 0; i < n[0]; i++) { var v = sl[ro + V.colIdx[i]]; X[base + (i * n[1] + j) * n[2] + k] = v; if (v !== 0) { s1 += v; cnt++; } } } }
    if (cnt) {   // NormalizeIntensity(nonzero=True, channel_wise=True), population std
      var mean = s1 / cnt; for (var q = 0; q < N; q++) { var x = X[base + q]; if (x !== 0) s2 += (x - mean) * (x - mean); }
      var sd = Math.sqrt(s2 / cnt) || 1; for (q = 0; q < N; q++) if (X[base + q] !== 0) X[base + q] = (X[base + q] - mean) / sd;
    }
    await new Promise(function (r) { setTimeout(r, 0); }); if (v3().cancel) throw cancelled();
  }
  var roi = P.inferer.roi, ov = P.inferer.overlap, pad = [0, 1, 2].map(function (a) { return Math.max(roi[a] - n[a], 0); }), lo = pad.map(function (p) { return Math.floor(p / 2); }), ps = [0, 1, 2].map(function (a) { return n[a] + pad[a]; });
  var st = [scanStarts(ps[0], roi[0], ov), scanStarts(ps[1], roi[1], ov), scanStarts(ps[2], roi[2], ov)], wins = [];
  st[0].forEach(function (x) { st[1].forEach(function (y) { st[2].forEach(function (z) { wins.push([x, y, z]); }); }); });
  var K = P.labels.length, acc = new Float32Array(K * N), cntm = new Uint8Array(N), R = roi[0] * roi[1] * roi[2];
  t0 = Date.now();
  for (var wi = 0; wi < wins.length; wi++) {
    progress('Brain tumour AI: window ' + (wi + 1) + ' of ' + wins.length, wi, wins.length, t0);
    var ws = wins[wi], inp = new Float32Array(C * R);
    for (c = 0; c < C; c++) for (var a0 = 0; a0 < roi[0]; a0++) { var gi = ws[0] + a0 - lo[0]; if (gi < 0 || gi >= n[0]) continue;
      for (var a1 = 0; a1 < roi[1]; a1++) { var gj = ws[1] + a1 - lo[1]; if (gj < 0 || gj >= n[1]) continue;
        var srcB = c * N + (gi * n[1] + gj) * n[2], dstB = ((c * roi[0] + a0) * roi[1] + a1) * roi[2];
        for (var a2 = 0; a2 < roi[2]; a2++) { var gk = ws[2] + a2 - lo[2]; if (gk >= 0 && gk < n[2]) inp[dstB + a2] = X[srcB + gk]; } } }
    var o = (await runWindow(e, inp, [1, C, roi[0], roi[1], roi[2]]))[0].data;
    for (var kk = 0; kk < K; kk++) for (a0 = 0; a0 < roi[0]; a0++) { gi = ws[0] + a0 - lo[0]; if (gi < 0 || gi >= n[0]) continue;
      for (a1 = 0; a1 < roi[1]; a1++) { gj = ws[1] + a1 - lo[1]; if (gj < 0 || gj >= n[1]) continue;
        var ob = ((kk * roi[0] + a0) * roi[1] + a1) * roi[2], gb = (gi * n[1] + gj) * n[2];
        for (a2 = 0; a2 < roi[2]; a2++) { gk = ws[2] + a2 - lo[2]; if (gk < 0 || gk >= n[2]) continue; acc[kk * N + gb + gk] += o[ob + a2]; if (kk === 0) cntm[gb + gk]++; } } }
  }
  v3().secPerTile[P.id] = (Date.now() - t0) / 1000 / wins.length;
  X = null;
  return brainResults(e, Vs, acc, cntm, n);
}
function brainResults(e, Vs, acc, cntm, n) {
  var P = e.pack, N = n[0] * n[1] * n[2], thr = P.output.threshold, V = Vs[0], vox = V.sp[0] * V.sp[1] * V.sp[2], keyBase = 'b' + Date.now(), res = [];
  var order = ['Whole tumor', 'Tumor core', 'Enhancing tumor'].map(function (l) { return P.labels.indexOf(l); }).filter(function (i) { return i >= 0; });
  P.labels.forEach(function (l, i) { if (order.indexOf(i) < 0) order.push(i); });
  var vols = Vs.map(function (x) { return x.key; });
  order.forEach(function (kk) {
    var label = P.labels[kk], sid = nextAiId(), count = 0, psum = 0, kmin = Infinity, kmax = -1, per = [];
    for (var k = 0; k < n[2]; k++) {
      var md = null, sc = 0, sn = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (var j = 0; j < n[1]; j++) for (var i = 0; i < n[0]; i++) {
        var g = (i * n[1] + j) * n[2] + k, p = 1 / (1 + Math.exp(-acc[kk * N + g] / cntm[g]));
        if (p > thr) { if (!md) md = new Uint8Array(V.w * V.h); var d = V.toDisp(i, j); md[d[1] * V.w + d[0]] = 1; sc += p; sn++; if (d[0] < x0) x0 = d[0]; if (d[0] > x1) x1 = d[0]; if (d[1] < y0) y0 = d[1]; if (d[1] > y1) y1 = d[1]; }
      }
      if (md) { per.push({ k: k, md: md, score: sc / sn, bbox: [x0, y0, x1 + 1, y1 + 1] }); count += sn; psum += sc; kmin = Math.min(kmin, k); kmax = Math.max(kmax, k); }
    }
    var ml = count * vox / 1000, color = BRAIN_CH_COLORS[label] || [232, 121, 249], note = (P.labelNotes || {})[label] || '';
    var mid = per.length ? per[Math.floor(per.length / 2)].k : null;
    res.push(packResult(e, { id: Vs[0].ref(0).imageId }, { id: sid, type: 'segmentation-3d', label: label + (note ? ' — ' + note : ''), score: count ? psum / count : null, vols: vols, color: color,
      detail: count ? num(ml, 1) + ' mL · ' + count.toLocaleString('en-US') + ' voxels · slices ' + (kmin + 1) + '–' + (kmax + 1) + ' of ' + n[2] : 'No voxels above the threshold', gotoFrame: mid, frame: mid || 0, volumeMl: ml, voxels: count }));
    // Per-slice masks, shown on every one of the four volumes.
    var d0 = V.toDisp(0, 0).join(',');
    Vs.forEach(function (Vc) {
      if (Vc.toDisp(0, 0).join(',') !== d0 || Vc.w !== V.w || Vc.h !== V.h) return;      // displayed differently: masks would not line up
      per.forEach(function (q) { var ref = Vc.ref(q.k); res.push(packResult(e, { id: ref.imageId }, { id: sid + '.' + Vc.key + '.' + (q.k + 1), group: sid, vol: Vc.key, type: 'mask', label: label + ' (slice ' + (q.k + 1) + ')', score: q.score, frame: ref.frame, color: color, mask: { key: keyBase + sid + Vc.key + q.k, w: Vc.w, h: Vc.h, data: q.md, bbox: q.bbox } })); });
    });
  });
  res.volKeys = vols;
  return res;
}

/* ---------------- Lung CT: LUNA16 RetinaNet ---------------- */
function lungRoi(V, plan, P) {
  var pix = P.input.pixdimMm, M = gridSize(V, plan, pix), R = v3(), img = curImg(), lo = [0, 0, 0], hi = M.slice(), wk = plan.perm.indexOf(2);
  var curK = 0; if (img) { for (var k = 0; k < V.n[2]; k++) { var r = V.ref(k); if (r.imageId === img.id && r.frame === S.frame) { curK = k; break; } } }
  var limit = function (w, a0, a1) { var b0 = toOut(V, plan, pix, w, a0), b1 = toOut(V, plan, pix, w, a1); lo[w] = Math.max(0, Math.floor(Math.min(b0, b1))); hi[w] = Math.min(M[w], Math.ceil(Math.max(b0, b1)) + 1); };
  var half = 0;
  if (R.roi !== 'whole') {
    half = Math.max(10, Math.min(200, Number(R.slabMm) || 30)) / V.sp[2];
    limit(wk, Math.max(0, curK - half), Math.min(V.n[2] - 1, curK + half));
  }
  if (R.roi !== 'rect') {
    // Crop in-plane to the body outline (> -500 HU) + 10 mm: air outside the body scales to 0, the model's own padding value.
    var b = bodyBox(V, R.roi === 'whole' ? 0 : Math.max(0, Math.floor(curK - half)), R.roi === 'whole' ? V.n[2] - 1 : Math.min(V.n[2] - 1, Math.ceil(curK + half)));
    if (b) { var mi = Math.ceil(10 / V.sp[0]), mj = Math.ceil(10 / V.sp[1]); limit(plan.perm.indexOf(0), Math.max(0, b[0] - mi), Math.min(V.n[0] - 1, b[1] + mi)); limit(plan.perm.indexOf(1), Math.max(0, b[2] - mj), Math.min(V.n[1] - 1, b[3] + mj)); }
  }
  if (R.roi === 'rect') {
    var a = S.annotations.find(function (x) { return x.id === S.selected; });
    if (!a || a.type !== 'rect' || V.refs.indexOf(a.imageId) < 0) throw new Error('lung-rect');
    var p0 = V.toDisp(Math.round(a.points[0].x), Math.round(a.points[0].y)), p1 = V.toDisp(Math.round(a.points[1].x), Math.round(a.points[1].y)), m = 8;
    limit(plan.perm.indexOf(0), Math.max(0, Math.min(p0[0], p1[0]) - m), Math.min(V.n[0] - 1, Math.max(p0[0], p1[0]) + m));
    limit(plan.perm.indexOf(1), Math.max(0, Math.min(p0[1], p1[1]) - m), Math.min(V.n[1] - 1, Math.max(p0[1], p1[1]) + m));
  }
  for (var w = 0; w < 3; w++) if (hi[w] - lo[w] < 16) { var c = Math.floor((lo[w] + hi[w]) / 2); lo[w] = Math.max(0, Math.min(M[w] - 16, c - 8)); hi[w] = Math.min(M[w], lo[w] + 16); }
  return { lo: lo, hi: hi, M: M };
}
var BODY_CACHE = { key: null, box: null };
function bodyBox(V, k0, k1) {
  var ck = V.key + '|' + k0 + '|' + k1; if (BODY_CACHE.key === ck) return BODY_CACHE.box;
  var i0 = Infinity, i1 = -1, j0 = Infinity, j1 = -1, lowest = Infinity, step = Math.max(1, Math.floor((k1 - k0) / 24));
  for (var k = k0; k <= k1; k += step) { var sl = V.slices[k]; for (var j = 0; j < V.n[1]; j += 2) { var ro = V.rowOff[j]; for (var i = 0; i < V.n[0]; i += 2) { var v = sl[ro + V.colIdx[i]]; if (v < lowest) lowest = v; if (v > -500) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } } } }
  var box = lowest < -900 && i1 > i0 && j1 > j0 ? [i0, i1 + 1, j0, j1 + 1] : null;            // only for CT in HU with air around the body
  BODY_CACHE.key = ck; BODY_CACHE.box = box; return box;
}
function isCtLike(img) { return !!img && (/CT/.test(String(img.modality || '')) || (!!img.vol && img.range && img.range.min < -900)); }
function lungPlanFor(P, key) {
  if (!isCtLike(S.images.get(key) || curImg())) throw new Error('not-ct');
  var V = buildVolume(key), plan = rasPlan(V), roi = lungRoi(V, plan, P), size = [0, 1, 2].map(function (w) { return roi.hi[w] - roi.lo[w]; });
  var sd = P.input.sizeDivisible, psize = size.map(function (s, i) { return Math.ceil(s / sd[i]) * sd[i]; }), t = P.inferer.tile.map(function (x, i) { return Math.min(x, psize[i]); });
  var st = [0, 1, 2].map(function (i) { return scanStarts(psize[i], t[i], P.inferer.overlap); });
  return { V: V, plan: plan, roi: roi, size: size, psize: psize, tile: t, starts: st, nwin: st[0].length * st[1].length * st[2].length };
}
function lungEstimate(P) {
  try {
    var img = curImg(), L = lungPlanFor(P, volKeyOf(img)), full = P.inferer.tile[0] * P.inferer.tile[1] * P.inferer.tile[2], per = v3().secPerTile[P.id] ? v3().secPerTile[P.id] / (v3().lastTileVox || full) : (200 / cpuThreads()) / full;
    return { L: L, sec: L.nwin * per * L.tile[0] * L.tile[1] * L.tile[2], mm: L.size.map(function (s, w) { return s * P.input.pixdimMm[w]; }) };
  } catch (err) { return { error: err.message }; }
}
async function runLung(e) {
  var P = e.pack, img = curImg(); if (!img) throw new Error('no-volume');
  var L = lungPlanFor(P, volKeyOf(img)), V = L.V, t0 = Date.now(), I = P.input.intensity;
  if (V.n[2] < 16) throw new Error('no-volume');
  progress('Resampling the CT to ' + P.input.pixdimMm.join(' × ') + ' mm (RAS)', 0, 1, t0);
  var vol = await resampleRAS(V, L.plan, P.input.pixdimMm, L.roi.lo, L.roi.hi), sz = L.size, ps = L.psize, t = L.tile;
  var padded = new Float32Array(ps[0] * ps[1] * ps[2]);    // zeros at the end (pad_images); 0 = -1024 HU after scaling
  for (var x = 0; x < sz[0]; x++) for (var y = 0; y < sz[1]; y++) { var sb = (x * sz[1] + y) * sz[2], db = (x * ps[1] + y) * ps[2];
    for (var z = 0; z < sz[2]; z++) { var v = vol[sb + z]; if (I.clip) v = Math.max(I.aMin, Math.min(I.aMax, v)); padded[db + z] = (v - I.aMin) / (I.aMax - I.aMin) * (I.bMax - I.bMin) + I.bMin; } }
  vol = null;
  var wins = []; L.starts[0].forEach(function (a) { L.starts[1].forEach(function (b) { L.starts[2].forEach(function (c) { wins.push([a, b, c]); }); }); });
  var nl = P.output.cls.length, acc = null, cnt = null, grids = null, T = t[0] * t[1] * t[2];
  t0 = Date.now();
  for (var wi = 0; wi < wins.length; wi++) {
    progress('Lung nodule AI: window ' + (wi + 1) + ' of ' + wins.length, wi, wins.length, t0);
    var s = wins[wi], inp = new Float32Array(T);
    for (x = 0; x < t[0]; x++) for (y = 0; y < t[1]; y++) { var src = ((s[0] + x) * ps[1] + s[1] + y) * ps[2] + s[2], dst = (x * t[1] + y) * t[2]; inp.set(padded.subarray(src, src + t[2]), dst); }
    var outs = await runWindow(e, inp, [1, 1, t[0], t[1], t[2]]);
    if (!acc) {
      acc = []; cnt = []; grids = [];
      outs.forEach(function (o) { var st2 = [0, 1, 2].map(function (i) { return t[i] / o.dims[2 + i]; }), g = [0, 1, 2].map(function (i) { return ps[i] / st2[i]; }); grids.push({ st: st2, g: g, ch: o.dims[1] }); acc.push(new Float32Array(o.dims[1] * g[0] * g[1] * g[2])); cnt.push(new Uint8Array(g[0] * g[1] * g[2])); });
    }
    outs.forEach(function (o, l) {
      var G = grids[l], g = G.g, d = o.dims, ox = s[0] / G.st[0], oy = s[1] / G.st[1], oz = s[2] / G.st[2], gl = g[0] * g[1] * g[2], wl = d[2] * d[3] * d[4];
      for (var ch = 0; ch < d[1]; ch++) for (var a0 = 0; a0 < d[2]; a0++) for (var a1 = 0; a1 < d[3]; a1++) { var ob = ch * wl + (a0 * d[3] + a1) * d[4], gb = ch * gl + ((ox + a0) * g[1] + oy + a1) * g[2] + oz;
        for (var a2 = 0; a2 < d[4]; a2++) acc[l][gb + a2] += o.data[ob + a2]; }
      for (a0 = 0; a0 < d[2]; a0++) for (a1 = 0; a1 < d[3]; a1++) { var cb = ((ox + a0) * g[1] + oy + a1) * g[2] + oz; for (a2 = 0; a2 < d[4]; a2++) cnt[l][cb + a2]++; }
    });
  }
  v3().secPerTile[P.id] = (Date.now() - t0) / 1000 / wins.length; v3().lastTileVox = T;
  padded = null;
  for (var l = 0; l < acc.length; l++) { var G2 = grids[l], gl2 = G2.g[0] * G2.g[1] * G2.g[2]; for (var q = 0; q < acc[l].length; q++) acc[l][q] /= cnt[l][q % gl2]; }
  var det = lungDetect(P, ps, acc.slice(0, nl), acc.slice(nl), grids.slice(0, nl), sz);
  return lungResults(e, L, det);
}
// pipeline3d.lung_detect: anchors, box decoding, per-level threshold + top-k, clip, NMS.
function lungDetect(P, ps, cls, box, grids, imgSize) {
  var A = P.output.anchorsPerLocation, wts = P.boxCoder.weights, clip = P.boxCoder.clip, Sel = P.selector, cand = [];
  for (var l = 0; l < cls.length; l++) {
    var g = grids[l].g, gl = g[0] * g[1] * g[2], st = [ps[0] / g[0], ps[1] / g[1], ps[2] / g[2]], cell = P.anchors.cellAnchors[l], lev = [];
    for (var loc = 0; loc < gl; loc++) for (var a = 0; a < A; a++) {
      var sc = 1 / (1 + Math.exp(-cls[l][a * gl + loc])); if (sc > Sel.scoreThresh) lev.push([sc, loc, a]);
    }
    lev.sort(function (p, q) { return q[0] - p[0]; }); lev = lev.slice(0, Sel.topkPerLevel);
    lev.forEach(function (c) {
      var loc2 = c[1], a2 = c[2], ix = Math.floor(loc2 / (g[1] * g[2])), iy = Math.floor(loc2 / g[2]) % g[1], iz = loc2 % g[2], sh = [ix * st[0], iy * st[1], iz * st[2]], b = new Float32Array(6);
      for (var ax = 0; ax < 3; ax++) {
        var lo = sh[ax] + cell[a2][ax], hi = sh[ax] + cell[a2][ax + 3], wd = hi - lo, ctr = (lo + hi) / 2;
        var dx = box[l][(a2 * 6 + ax) * gl + loc2] / wts[ax], dw = Math.min(box[l][(a2 * 6 + ax + 3) * gl + loc2] / wts[ax + 3], clip);
        var pc = dx * wd + ctr, pw = Math.exp(dw) * wd;
        b[ax] = Math.max(0, Math.min(imgSize[ax], pc - 0.5 * pw)); b[ax + 3] = Math.max(0, Math.min(imgSize[ax], pc + 0.5 * pw));
      }
      if (b[3] >= b[0] + 1 && b[4] >= b[1] + 1 && b[5] >= b[2] + 1) cand.push({ b: b, s: c[0] });
    });
  }
  cand.sort(function (p, q) { return q.s - p.s; });
  var keep = [], alive = cand.map(function () { return true; }), vol = function (b) { return (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]); };
  for (var i = 0; i < cand.length; i++) {
    if (!alive[i]) continue; keep.push(cand[i]); if (keep.length >= Sel.detectionsPerImage) break;
    var bi = cand[i].b, vi = vol(bi);
    for (var j = i + 1; j < cand.length; j++) {
      if (!alive[j]) continue; var bj = cand[j].b, inter = 1;
      for (var ax2 = 0; ax2 < 3; ax2++) { var d = Math.min(bi[ax2 + 3], bj[ax2 + 3]) - Math.max(bi[ax2], bj[ax2]); if (d <= 0) { inter = 0; break; } inter *= d; }
      if (inter / (vi + vol(bj) - inter + 1.1920929e-7) > Sel.nmsThresh) alive[j] = false;
    }
  }
  return keep;
}
function lungResults(e, L, det) {
  var P = e.pack, V = L.V, plan = L.plan, pix = P.input.pixdimMm, res = [], keyed = [];
  det.slice(0, 50).forEach(function (d, n) {
    // Box (output voxel-edge coordinates in the ROI) -> voxel ranges of the source volume.
    var rng = [null, null, null], mm = [];
    for (var w = 0; w < 3; w++) {
      var a = plan.perm[w], c0 = toVox(V, plan, pix, w, L.roi.lo[w] + d.b[w] - 0.5), c1 = toVox(V, plan, pix, w, L.roi.lo[w] + d.b[w + 3] - 0.5);
      rng[a] = [Math.min(c0, c1) + 0.5, Math.max(c0, c1) + 0.5]; mm.push((d.b[w + 3] - d.b[w]) * pix[w]);
    }
    var sid = nextAiId(), k0 = Math.max(0, Math.floor(rng[2][0])), k1 = Math.min(V.n[2] - 1, Math.ceil(rng[2][1]) - 1), kc = Math.round((rng[2][0] + rng[2][1]) / 2 - 0.5);
    if (k1 < k0) k1 = k0; kc = Math.max(k0, Math.min(k1, kc));
    var p0 = V.toDisp(rng[0][0], rng[1][0]), p1 = V.toDisp(rng[0][1], rng[1][1]), bx = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
    if (V.toDisp(0, 0)[0] !== 0) { bx[0] += 1; bx[2] += 1; } if (V.toDisp(0, 0)[1] !== 0) { bx[1] += 1; bx[3] += 1; }   // flipped display axes: edge, not centre
    var refC = V.ref(kc);
    res.push(packResult(e, { id: refC.imageId }, { id: sid, type: 'detection-3d', label: 'Lung nodule candidate', score: d.s, vols: [V.key], frame: refC.frame, gotoFrame: kc, gotoImage: refC.imageId,
      boxRas: [0, 1, 2, 3, 4, 5].map(function (q) { return L.roi.lo[q % 3] + d.b[q]; }), detail: 'about ' + mm.map(function (v) { return num(v, 1); }).join(' × ') + ' mm (box, RAS x × y × z) · slices ' + (k0 + 1) + '–' + (k1 + 1) + ' of ' + V.n[2] + ', centre ' + (kc + 1), sizeMm: mm }));
    for (var k = k0; k <= k1; k++) { var r = V.ref(k); res.push(packResult(e, { id: r.imageId }, { id: sid + '.' + (k + 1), group: sid, vol: V.key, type: 'boundingBox', label: 'Lung nodule candidate ' + sid + ' (slice ' + (k + 1) + ')', score: d.s, frame: r.frame, box: bx.slice() })); }
    keyed.push(sid);
  });
  res.volKeys = [V.key];
  res.roiNote = L.roi;
  return res;
}

/* ---------------- Run, accept, UI pieces ---------------- */
async function run3dPack(e) {
  var R = v3(); R.cancel = false; R.progress = null;
  try { return e.pack.task === 'brain-mri-seg-3d' ? await runBrain(e) : await runLung(e); }
  finally { R.progress = null; }
}
function cancel3d() { var R = v3(); R.cancel = true; var e = packSel(); if (e) workerStop(e); scheduleRender(); }
function curVolKeys() { var img = curImg(); return img ? [img.vol ? img.id : img.seriesId] : []; }
function accept3d(r) {
  var vk = curVolKeys()[0], rows = S.ai.results.filter(function (x) { return x.group === r.id && !x.accepted && (x.vol === vk || r.vols.indexOf(vk) < 0); }), n = 0;
  if (r.vols.indexOf(vk) < 0) { var first = rows.length ? rows[0].vol : null; rows = rows.filter(function (x) { return x.vol === first; }); }
  rows.forEach(function (x) {
    var a = { id: 'A' + S.nextAnn++, imageId: x.imageId, frame: x.frame || 0, label: 'unknown', provenance: 'originally AI-derived, accepted by user', aiOrigin: { suggestion: x.id, model: x.model, label: r.label, score: x.score }, createdAt: isoNow(), note: '' };
    if (x.box) { a.type = 'rect'; a.points = [{ x: x.box[0], y: x.box[1] }, { x: x.box[2], y: x.box[3] }]; } else { a.type = 'mask'; a.points = []; a.mask = { key: x.mask.key + 'a', w: x.mask.w, h: x.mask.h, data: x.mask.data, bbox: x.mask.bbox }; }
    x.accepted = true; S.annotations.push(a); n++;
  });
  r.accepted = true; toast('Accepted as ' + n + ' user annotation(s), one per slice (originally AI-derived).'); scheduleRender();
}
function aiGoto(r) {
  if (!r || r.gotoFrame == null) return;
  var img = curImg(), vk = curVolKeys()[0];
  if (r.vols && r.vols.indexOf(vk) >= 0 && img && img.vol) { S.frame = r.gotoFrame; }
  else { var row = S.ai.results.find(function (x) { return x.group === r.id && (x.vol === vk || !vk) && (x.id.split('.').pop() | 0) === r.gotoFrame + 1; }) || S.ai.results.find(function (x) { return x.group === r.id; });
    if (row) { S.current = row.imageId; S.frame = row.frame || 0; } }
  scheduleRender();
}
function v3Ready(pk) {
  if (!is3dPack(pk)) return true;
  if (pk.pack.task === 'brain-mri-seg-3d') return !brainCheck(pk.pack);
  var est = lungEstimate(pk.pack); return !est.error;
}
function v3Panel(pk) {
  if (!is3dPack(pk)) return '';
  var P = pk.pack, R = v3(), cands = volCandidates();
  if (P.task === 'brain-mri-seg-3d') {
    brainAutoAssign(P);
    var err = brainCheck(P);
    return H`<fieldset class="oi-card"><legend class="oi-card-title">Brain MRI input: assign the four co-registered sequences</legend>
      ${cands.length ? '' : notice('warn', 'Load the four sequences first (Upload Image → NIfTI .nii/.nii.gz files such as BraTS, or DICOM series on the same grid).')}
      <div class="oi-grid-2">${brainChannels(P).map(function (c) { return H`<label class="oi-field"><span>${c}</span><select class="oi-input" data-change="v3-ch" data-ch="${c}"><option value="">— choose a volume —</option>${cands.map(function (x) { return H`<option value="${x.key}" ${R.ch[c] === x.key ? raw('selected') : ''}>${x.label} · ${x.n.join('×')}</option>`; })}</select></label>`; })}</div>
      ${err ? notice('warn', err) : notice('info', 'Model input: ' + brainChannels(P).join(' + ') + ' in that order, voxel order as stored, each normalised over its non-zero voxels. The browser runs ' + P.inferer.roi.join(' × ') + ' windows with ' + Math.round(P.inferer.overlap * 100) + '% overlap. Expect several minutes on a laptop.')}
      ${notice('warn', 'Use only skull-stripped, co-registered, ~1 mm isotropic volumes (BraTS-style). Raw scanner series give unreliable output.')}</fieldset>`;
  }
  var est = lungEstimate(P), img = curImg();
  return H`<fieldset class="oi-card"><legend class="oi-card-title">Chest CT input: region to analyse</legend>
    <p class="oi-small">Uses the CT series (or NIfTI volume) of the current image${img ? '' : ' — select a CT image first'}. The scan is resampled in memory to ${P.input.pixdimMm.join(' × ')} mm and analysed in ${P.inferer.tile.join(' × ')}-voxel windows.</p>
    <label class="oi-check"><input type="radio" name="oi-v3-roi" value="slab" data-change="v3-roi" ${R.roi === 'slab' ? raw('checked') : ''}><span><strong>Slab around the current slice</strong> (cropped to the body outline) ± <input type="number" class="oi-input" style="width:80px;display:inline-block" min="10" max="200" step="5" value="${R.slabMm}" data-change="v3-slab" aria-label="Half thickness in mm"> mm</span></label>
    <label class="oi-check"><input type="radio" name="oi-v3-roi" value="rect" data-change="v3-roi" ${R.roi === 'rect' ? raw('checked') : ''}><span><strong>Selected rectangle</strong> — draw a rectangle annotation around the region on a slice of this series, keep it selected; the same ± mm applies</span></label>
    <label class="oi-check"><input type="radio" name="oi-v3-roi" value="whole" data-change="v3-roi" ${R.roi === 'whole' ? raw('checked') : ''}><span><strong>Whole scan</strong> (cropped to the body outline) — slowest</span></label>
    ${est.error ? notice('warn', est.error === 'lung-rect' ? 'Select a rectangle annotation drawn on this series first.' : est.error === 'irregular' ? 'This series has irregular or duplicate slice positions; it cannot be assembled into a volume.' : est.error === 'no-spacing' ? 'This series has no pixel spacing.' : est.error === 'not-ct' ? 'The current image is not a CT in Hounsfield units. Select an image of the chest CT series or CT NIfTI volume.' : 'Select an image of a CT series (8 or more slices) or a NIfTI CT volume.')
      : notice('info', H`Region: about ${est.mm.map(function (v) { return num(v, 0); }).join(' × ')} mm → ${est.L.nwin} window(s). Estimated time in this browser: <strong>${fmtSec(est.sec)}</strong>${v3().secPerTile[P.id] ? ' (from your last run)' : ' (rough first estimate)'} using ${cpuThreads()} thread${cpuThreads() > 1 ? 's' : ''}${cpuThreads() > 1 ? '' : ' (this browser is not cross-origin isolated, so the model runs single-threaded)'}. For one nodule, a rectangle around it is fastest.${est.L.V.approx ? ' Slice positions are missing, so spacing comes from Slice Thickness (approximate).' : ''}`)}
    ${notice('warn', 'Region and slab modes give the model less context at the borders than the whole scan; nodules cut by the border can be missed.')}</fieldset>`;
}
function v3Progress() {
  var p = v3().progress; if (!p) return '';
  return H`<div class="oi-card" role="status"><p class="oi-row oi-small"><span class="oi-spinner"></span> ${p.phase} · ${p.total > 1 ? Math.round(100 * p.done / p.total) + '% · about ' + fmtSec(p.left) + ' left' : ''}</p><progress max="${p.total}" value="${p.done}" style="width:100%"></progress><div class="oi-card-foot"><button type="button" class="oi-btn oi-btn-sm" data-act="ai-cancel">Stop</button></div></div>`;
}
