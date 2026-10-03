/* ====================================================================
   TRAINED CANCER AI MODEL PACKS (self-hosted; schema oncotics-model-pack/1)
   Folders in /assets/models/<pack-id>/ produced by oncotics/ai/build_model_packs.py
   (GitHub Actions "Oncotics AI model packs"): model.onnx converted from the
   authors' official weights + pack.json (model card, labels, pre/post-processing,
   SHA-256, verification against the original PyTorch model).
     cxr-xrv-densenet121       chest X-ray, 18 findings incl. Mass / Nodule / Lung Lesion + activation maps
     path-camelyon16-resnet18  H&E patch tumour detector (Camelyon16) -> tumour heatmap + regions
   Runs in ONNX Runtime Web (WebAssembly) in this browser; images never leave it.
   Never automatic: the user selects a pack, reviews its card and presses Run.
   ==================================================================== */
var PACK_IDS = ['cxr-xrv-densenet121', 'path-camelyon16-resnet18'];
var PACK_BASE = '/assets/models/';
var PACKS = { checked: false, map: {} };
function packsCheck() {
  if (PACKS.checked) return; PACKS.checked = true;
  PACK_IDS.forEach(function (id) {
    var e = PACKS.map[id] = { id: id, status: 'checking' };
    if (location.protocol === 'file:') { e.status = 'missing'; return; }
    fetch(PACK_BASE + id + '/pack.json', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { if (!r.ok || /text\/html/i.test(r.headers.get('content-type') || '')) throw new Error('missing'); return r.json(); }).then(function (p) {
      if (!p || p.schema !== 'oncotics-model-pack/1' || p.id !== id || !p.card || !p.model) throw new Error('invalid');
      e.pack = p; e.card = normCard({ card: p.card, output: { type: p.task === 'cxr-classification' ? 'classification' : 'heatmap' } }, 'local-browser'); e.status = 'available';
    }).catch(function () { e.status = 'missing'; }).then(scheduleRender);
  });
}
function packSel() { return S.ai.pack ? PACKS.map[S.ai.pack] : null; }
async function packLoad(id) {
  var e = PACKS.map[id]; if (!e || !e.pack || e.status === 'loading' || e.status === 'ready') return;
  e.status = 'loading'; e.error = null; scheduleRender(); announce('Loading ' + e.pack.card.name + ' from this site…');
  try {
    var ort = await loadOrt();
    var r = await fetch(PACK_BASE + id + '/' + e.pack.model, { credentials: 'same-origin' }); if (!r.ok) throw new Error('missing');
    var buf = await r.arrayBuffer();
    if (e.pack.sha256 && window.crypto && crypto.subtle) {
      var hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      if (hex !== e.pack.sha256) throw new Error('hash');
    }
    e.session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    e.ort = ort; e.status = 'ready'; announce(e.pack.card.name + ' loaded.');
  } catch (err) {
    e.status = 'error';
    e.error = err.message === 'hash' ? 'model.onnx does not match the checksum in pack.json (corrupted or wrong upload). Upload the pack folder again.' : err.message === 'missing' ? 'model.onnx is missing next to pack.json.' : err.message === 'runtime-unavailable' ? 'The inference runtime is not deployed on this site (/assets/ort/).' : 'This browser could not load the model.';
  }
  scheduleRender();
}
function sig(z) { return 1 / (1 + Math.exp(-z)); }
function packResult(e, img, x) { return Object.assign({ imageId: img.id, frame: S.frame, uncertainty: null, provenance: 'AI-derived experimental inference', calibrated: 'no', model: e.pack.card.name + ' · ' + e.pack.card.version }, x); }

// ---- Chest X-ray: 18 findings + class-activation maps
async function runCxrPack(e, img) {
  var P = e.pack, I = P.input, N = I.width, side = Math.min(img.w, img.h), sx = Math.floor((img.w - side) / 2), sy = Math.floor((img.h - side) / 2);
  var c = document.createElement('canvas'); c.width = N; c.height = N; var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (I.centerCrop) g.drawImage(Inspector.display(img), sx, sy, side, side, 0, 0, N, N); else { g.drawImage(Inspector.display(img), 0, 0, N, N); sx = 0; sy = 0; }
  var d = g.getImageData(0, 0, N, N).data; c.width = c.height = 0;
  var x = new Float32Array(N * N); for (var i = 0; i < N * N; i++) x[i] = (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]) * I.scale + I.offset;
  var feeds = {}; feeds[I.name] = new e.ort.Tensor('float32', x, [1, 1, N, N]);
  var out = await e.session.run(feeds), lg = out[P.output.logits].data, cam = out[P.output.cam], K = P.labels.length, ch = cam.dims[2], cw = cam.dims[3];
  var res = [], scores = [];
  for (var k = 0; k < K; k++) {
    if (!P.labels[k]) continue;
    var p = sig(lg[k]), t = P.opThresholds ? P.opThresholds[k] : null, s = t == null ? p : (p < t ? p / (2 * t) : 1 - (1 - p) / (2 * (1 - t)));
    scores.push([k, s]); res.push(packResult(e, img, { type: 'classification', label: P.labels[k] + (P.focusLabels && P.focusLabels.indexOf(P.labels[k]) >= 0 ? ' (oncology-relevant finding)' : ''), score: s }));
  }
  // Activation maps: every oncology-relevant finding at/above the operating point, plus the top finding.
  scores.sort(function (a, b) { return b[1] - a[1]; });
  var want = scores.filter(function (q) { return q[1] >= 0.5 && P.focusLabels && P.focusLabels.indexOf(P.labels[q[0]]) >= 0; });
  if (scores.length && want.every(function (q) { return q[0] !== scores[0][0]; })) want.push(scores[0]);
  var mw = 96, mh = Math.max(8, Math.round(96 * img.h / img.w)), key = 'x' + Date.now();
  want.forEach(function (q, n) {
    var k2 = q[0], off = k2 * ch * cw, mn = Infinity, mx = -Infinity, j;
    for (j = 0; j < ch * cw; j++) { var v = cam.data[off + j]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (!(mx - mn > 1e-6)) return;
    var prob = new Float32Array(mw * mh);
    for (var gy = 0; gy < mh; gy++) for (var gx = 0; gx < mw; gx++) {
      var X = (gx + 0.5) / mw * img.w, Y = (gy + 0.5) / mh * img.h; if (X < sx || Y < sy || X > sx + side || Y > sy + side) continue;
      var u = (X - sx) / side * cw - 0.5, w = (Y - sy) / side * ch - 0.5, u0 = Math.max(0, Math.min(cw - 1, Math.floor(u))), w0 = Math.max(0, Math.min(ch - 1, Math.floor(w))), u1 = Math.min(cw - 1, u0 + 1), w1 = Math.min(ch - 1, w0 + 1), fu = Math.max(0, Math.min(1, u - u0)), fw = Math.max(0, Math.min(1, w - w0));
      var val = (cam.data[off + w0 * cw + u0] * (1 - fu) + cam.data[off + w0 * cw + u1] * fu) * (1 - fw) + (cam.data[off + w1 * cw + u0] * (1 - fu) + cam.data[off + w1 * cw + u1] * fu) * fw;
      prob[gy * mw + gx] = (val - mn) / (mx - mn);
    }
    res.push(packResult(e, img, { type: 'heatmap', label: 'Activation map: ' + P.labels[k2] + ' (where the model looked; not a lesion outline)', score: q[1], mask: { key: key + n, w: mw, h: mh, prob: prob, data: new Uint8Array(mw * mh), bbox: [sx, sy, sx + side, sy + side] } }));
  });
  return res.sort(function (a, b) { return (b.type === 'heatmap') - (a.type === 'heatmap') || b.score - a.score; });
}

// ---- Pathology: patch tumour scores -> heatmap + regions
async function runPathPack(e, img) {
  var P = e.pack, I = P.input, ps = I.patch, cols = Math.ceil(img.w / ps), rows = Math.ceil(img.h / ps), N = cols * rows;
  if (N > 1600) throw new Error('too-large');
  var cv = Inspector.display(img), full = cv.getContext('2d').getImageData(0, 0, img.w, img.h).data, probs = new Float32Array(N), B = 8, plane = ps * ps;
  for (var b0 = 0; b0 < N; b0 += B) {
    var nb = Math.min(B, N - b0), x = new Float32Array(nb * 3 * plane);
    for (var j = 0; j < nb; j++) {
      var t = b0 + j, cx = t % cols, cy = (t / cols) | 0, base = j * 3 * plane;
      for (var py = 0; py < ps; py++) for (var px = 0; px < ps; px++) {
        var X = cx * ps + px, Y = cy * ps + py, inside = X < img.w && Y < img.h, o = (Y * img.w + X) * 4, q = py * ps + px;
        x[base + q] = (inside ? full[o] : 255) * I.scale + I.offset; x[base + plane + q] = (inside ? full[o + 1] : 255) * I.scale + I.offset; x[base + 2 * plane + q] = (inside ? full[o + 2] : 255) * I.scale + I.offset;
      }
    }
    var feeds = {}; feeds[I.name] = new e.ort.Tensor('float32', x, [nb, 3, ps, ps]);
    var out = await e.session.run(feeds), lg = out[P.output.logit].data;
    for (j = 0; j < nb; j++) probs[b0 + j] = sig(lg[j]);
    if (b0 % (B * 10) === 0) announce('Pathology AI: ' + Math.min(N, b0 + nb) + ' of ' + N + ' patches scored…');
  }
  var mw = Math.min(256, cols * 4), mh = Math.min(256, rows * 4), cellTile = new Int32Array(mw * mh), heat = new Float32Array(mw * mh), maxP = 0;
  for (var gy = 0; gy < mh; gy++) for (var gx = 0; gx < mw; gx++) {
    var X2 = (gx + 0.5) / mw * img.w, Y2 = (gy + 0.5) / mh * img.h, ti = Math.min(rows - 1, (Y2 / ps) | 0) * cols + Math.min(cols - 1, (X2 / ps) | 0);
    cellTile[gy * mw + gx] = ti; heat[gy * mw + gx] = probs[ti];
  }
  for (var k = 0; k < N; k++) if (probs[k] > maxP) maxP = probs[k];
  var key = 'p' + Date.now(), res = [];
  res.push(packResult(e, img, { type: 'classification', label: 'Highest patch tumour score (' + N + ' patches of ' + ps + ' px)', score: maxP }));
  res.push(packResult(e, img, { type: 'heatmap', label: 'Tumour heatmap (patch scores)', score: maxP, mask: { key: key + 'h', w: mw, h: mh, prob: heat, data: new Uint8Array(mw * mh), bbox: [0, 0, img.w, img.h] } }));
  var bin = new Uint8Array(N); for (k = 0; k < N; k++) bin[k] = probs[k] >= 0.5 ? 1 : 0;
  components(bin, cols, rows, 1).slice(0, 30).forEach(function (cmp, n) {
    var inC = new Uint8Array(N), sum = 0; cmp.pixels.forEach(function (p) { inC[p] = 1; sum += probs[p]; });
    var md = new Uint8Array(mw * mh); for (var z = 0; z < mw * mh; z++) if (inC[cellTile[z]]) md[z] = 1;
    var bb = cmp.bbox;
    res.push(packResult(e, img, { type: 'mask', label: 'Tumour-scored region (' + cmp.pixels.length + ' patch' + (cmp.pixels.length > 1 ? 'es' : '') + ')', score: sum / cmp.pixels.length, mask: { key: key + 'r' + n, w: mw, h: mh, data: md, bbox: [bb[0] * ps, bb[1] * ps, Math.min(img.w, bb[2] * ps), Math.min(img.h, bb[3] * ps)] } }));
  });
  return res;
}
async function runPack() {
  var e = packSel(), img = curImg(); if (!e || !img) return [];
  if (e.status !== 'ready') await packLoad(e.id); if (e.status !== 'ready') throw new Error('pack-unavailable');
  return e.pack.task === 'cxr-classification' ? runCxrPack(e, img) : runPathPack(e, img);
}
