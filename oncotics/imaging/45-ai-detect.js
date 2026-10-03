/* ====================================================================
   AI DETECTION (built in; never automatic — every run is a click)
   Mode D  builtin: automatic candidate detection with a rule-based
           computer-vision method (difference-of-Gaussians blobs +
           connected components) on the displayed image. Instant, no
           download, no network request.
   Mode E  sam: AI detection & segmentation with the Segment Anything
           Model (SAM ViT-B, Meta AI, Apache-2.0), the same ONNX export
           the OHIF Viewer uses. The model files are self-hosted on this
           site (/assets/models/sam-b/, see scripts/fetch-ai-models.sh)
           and run in ONNX Runtime Web in this browser (WebGPU when
           available, otherwise WebAssembly). Images never leave the
           browser. "Detect & segment" refines the built-in candidates
           with SAM box prompts; "Click to segment" runs SAM at a point.
   Outputs are AI suggestions on the separate AI layer until accepted.
   ==================================================================== */
var BUILTIN_CARD = normCard({ card: {
  name: 'Built-in candidate detector', version: '1.0', source: 'Imaging Workbench page code (runs in your browser)', license: 'Part of this website',
  intendedUse: 'Research and education: highlights compact regions whose brightness differs from their surroundings on the displayed image (difference-of-Gaussians blob detection with connected components), so you can inspect them. It is a rule-based computer-vision method, not a trained AI model, and it does not decide whether a region is abnormal.',
  validationStatus: 'Not validated on any clinical dataset', modality: ['Any 2D image (uses the displayed window/level)'], imageTypes: ['DICOM', 'PNG', 'JPEG', 'WebP'],
  limitations: ['Finds any compact bright or dark spot: vessels, bowel, bone and artefacts are flagged too', 'Depends on the current window/level', 'Single 2D image; no 3D context', 'Regions touching the image edge are ignored'],
  failureModes: ['Misses lesions with little contrast to their surroundings', 'Splits or merges adjacent structures', 'Many false positives on noisy images'],
  calibrated: false, confidenceMeaning: 'Relative local contrast and compactness of the region (0–1). It is not a probability of disease.', regulatoryStatus: 'None', lastVerified: '2026-10-03'
}, output: { type: 'segmentation' } }, 'local-browser');
var SAM_CARD = normCard({ card: {
  name: 'Segment Anything Model (SAM) ViT-B', version: 'sam_vit_b_01ec64 · ONNX export (fp16 encoder) as used by the OHIF Viewer', source: 'Meta AI Segment Anything', link: 'https://github.com/facebookresearch/segment-anything', license: 'Apache-2.0',
  intendedUse: 'General-purpose promptable segmentation: outlines the object inside a box from the built-in detector or at a point you click. Trained on natural images (SA-1B), not on medical images; it does not decide whether a region is abnormal.',
  validationStatus: 'Not validated for medical imaging or diagnosis', modality: ['Any 2D image (uses the displayed window/level)'], imageTypes: ['DICOM', 'PNG', 'JPEG', 'WebP'],
  limitations: ['Trained on natural photographs, not radiology', 'Segments whatever is at the prompt; it does not detect disease', 'The image is resized to 1024 × 1024 for the model', 'Large download (about 200 MB) the first time it is loaded in a page'],
  failureModes: ['Leaks into neighbouring structures with similar intensity', 'Over- or under-segments low-contrast lesions', 'Fails on very small regions'],
  calibrated: false, confidenceMeaning: "The model's own predicted mask quality (IoU estimate, 0–1). It is not a probability of disease.", regulatoryStatus: 'None', lastVerified: '2026-10-03'
}, output: { type: 'segmentation' } }, 'local-browser');

// Suggestion IDs only ever increase within a session (S1, S2, …), so they never repeat.
function nextAiId() { S.ai.seq = (S.ai.seq || 0) + 1; return 'S' + S.ai.seq; }

/* ---- (D) built-in candidate detection ---- */
function boxBlur(src, w, h, r) {
  var tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1, x, y, acc, row;
  for (y = 0; y < h; y++) { row = y * w; acc = 0; for (x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (x = 0; x < w; x++) { tmp[row + x] = acc / d; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; } }
  for (x = 0; x < w; x++) { acc = 0; for (y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (y = 0; y < h; y++) { out[y * w + x] = acc / d; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
function gaussApprox(src, w, h, r) { return boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r); }
function detectCandidates(img, opts) {
  opts = opts || {};
  var sc = Math.min(1, 256 / Math.max(img.w, img.h)), W = Math.max(16, Math.round(img.w * sc)), Hh = Math.max(16, Math.round(img.h * sc)), n = W * Hh;
  var c = document.createElement('canvas'); c.width = W; c.height = Hh; var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(Inspector.display(img), 0, 0, W, Hh);
  var px = g.getImageData(0, 0, W, Hh).data; c.width = c.height = 0;
  var L = new Float32Array(n), i; for (i = 0; i < n; i++) L[i] = (0.299 * px[4 * i] + 0.587 * px[4 * i + 1] + 0.114 * px[4 * i + 2]) / 255;
  var r1 = Math.max(1, Math.round(Math.min(W, Hh) / 170)), r2 = Math.max(4, Math.round(Math.min(W, Hh) / 40));
  var a = gaussApprox(L, W, Hh, r1), b = gaussApprox(L, W, Hh, r2), dog = new Float32Array(n), body = new Uint8Array(n), sum = 0, sq = 0, cnt = 0;
  for (i = 0; i < n; i++) { dog[i] = a[i] - b[i]; if (b[i] > 0.06) { body[i] = 1; sum += dog[i]; sq += dog[i] * dog[i]; cnt++; } }
  if (cnt < 50) return [];
  var mean = sum / cnt, sd = Math.sqrt(Math.max(0, sq / cnt - mean * mean)); if (sd < 1e-4) return [];
  var k = opts.k || 2.2, minA = Math.max(6, Math.round(n * 0.0004)), out = [];
  [1, -1].forEach(function (pol) {
    var bin = new Uint8Array(n); for (var j = 0; j < n; j++) if (body[j] && pol * (dog[j] - mean) > k * sd) bin[j] = 1;
    components(bin, W, Hh, minA).forEach(function (cmp) {
      var area = cmp.pixels.length, bb = cmp.bbox; if (area > n * 0.06) return;
      if (bb[0] <= 0 || bb[1] <= 0 || bb[2] >= W || bb[3] >= Hh) return;            // touches the image edge
      var bw = bb[2] - bb[0], bh = bb[3] - bb[1], fill = area / Math.max(1, bw * bh), ar = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
      if (fill < 0.3 || ar > 4) return;
      var s = 0; cmp.pixels.forEach(function (p) { s += pol * (dog[p] - mean); }); var z = s / area / sd;
      var score = Math.max(0.01, Math.min(0.99, (1 - Math.exp(-(z - k + 0.4) * 0.9)) * (0.6 + 0.4 * Math.min(1, fill / 0.6))));
      var md = new Uint8Array(n); cmp.pixels.forEach(function (p) { md[p] = 1; });
      out.push({ polarity: pol > 0 ? 'brighter' : 'darker', score: score, area: area / n, mask: { w: W, h: Hh, data: md, bbox: [bb[0] / W * img.w, bb[1] / Hh * img.h, bb[2] / W * img.w, bb[3] / Hh * img.h] } });
    });
  });
  return out.sort(function (x, y) { return y.score - x.score; }).slice(0, opts.max || 12);
}
function runBuiltin() {
  var img = curImg(); if (!img) return [];
  var key = 'b' + Date.now();
  return detectCandidates(img).map(function (c, i) {
    return { imageId: img.id, frame: S.frame, type: 'mask', label: 'Candidate region (' + c.polarity + ' than surroundings)', score: c.score, uncertainty: null, provenance: 'Rule-based experimental detection (not trained AI)', calibrated: 'no', model: BUILTIN_CARD.name + ' ' + BUILTIN_CARD.version, mask: Object.assign({ key: key + i }, c.mask) };
  });
}

/* ---- (E) SAM ViT-B: self-hosted AI segmentation ---- */
var SAM = { base: '/assets/models/sam-b/', encoder: 'encoder.onnx', decoder: 'decoder.onnx', status: 'unknown', sizeMB: null, error: null, provider: null, ort: null, enc: null, dec: null, emb: null, embKey: null };
function samCheck() {
  if (SAM.status !== 'unknown' || location.protocol === 'file:') { if (location.protocol === 'file:') SAM.status = 'missing'; return; }
  SAM.status = 'checking';
  var head = function (f) { return fetch(SAM.base + f, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }); };
  Promise.all([head(SAM.encoder), head(SAM.decoder)]).then(function (r) {
    var ok = r[0].ok && r[1].ok && !/text\/html/i.test(r[0].headers.get('content-type') || '');
    SAM.status = ok ? 'available' : 'missing';
    var len = Number(r[0].headers.get('content-length') || 0) + Number(r[1].headers.get('content-length') || 0); SAM.sizeMB = len ? len / 1048576 : null;
  }).catch(function () { SAM.status = 'missing'; }).then(scheduleRender);
}
function loadOrtSam(gpu) {
  if (!gpu) return loadOrt();
  return import(CONFIG.ortBase + 'ort.webgpu.min.mjs').then(function (mod) {
    var ort = mod && (mod.InferenceSession ? mod : mod.default); if (!ort || !ort.InferenceSession) throw new Error('runtime-unavailable');
    ort.env.wasm.wasmPaths = CONFIG.ortBase; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; if (ort.env.logLevel !== undefined) ort.env.logLevel = 'fatal';
    ort.__gpu = true; return ort;
  }).catch(function () { return loadOrt(); });
}
async function samLoad() {
  if (SAM.status === 'ready' || SAM.status === 'loading') return;
  SAM.status = 'loading'; SAM.error = null; scheduleRender(); announce('Loading the AI model from this site…');
  try {
    var ort = await loadOrtSam(!!navigator.gpu);
    var get = async function (f) { var r = await fetch(SAM.base + f, { credentials: 'same-origin' }); if (!r.ok) throw new Error('missing'); return new Uint8Array(await r.arrayBuffer()); };
    var create = async function (bytes) {
      if (ort.__gpu) { try { var sg = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' }); SAM.provider = 'WebGPU'; return sg; } catch (e) { /* fall back to WebAssembly */ } }
      var sw = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); SAM.provider = SAM.provider || 'WebAssembly (CPU)'; return sw;
    };
    SAM.enc = await create(await get(SAM.encoder));
    SAM.dec = await create(await get(SAM.decoder));
    SAM.ort = ort; SAM.status = 'ready'; announce('AI model ready (' + SAM.provider + ').');
  } catch (e) {
    SAM.status = 'error';
    SAM.error = e && e.message === 'runtime-unavailable' ? 'The inference runtime is not deployed on this site (/assets/ort/).' : e && e.message === 'missing' ? 'The AI model files are not deployed on this site.' : 'This browser could not load the AI model (it needs WebGPU or enough memory for WebAssembly).';
  }
  scheduleRender();
}
async function samEmbed(img) {
  var key = img.id + '|' + S.frame + '|' + (img.kind === 'gray' ? img.wl.c.toFixed(2) + '|' + img.wl.w.toFixed(2) + '|' + (img.invert ? 1 : 0) : 'rgb');
  if (SAM.embKey === key && SAM.emb) return SAM.emb;
  var c = document.createElement('canvas'); c.width = 1024; c.height = 1024; var g = c.getContext('2d'); g.drawImage(Inspector.display(img), 0, 0, 1024, 1024);
  var id = g.getImageData(0, 0, 1024, 1024); c.width = c.height = 0;
  var t = await SAM.ort.Tensor.fromImage(id), feed = {}; feed[SAM.enc.inputNames[0]] = t;
  var out = await SAM.enc.run(feed);
  SAM.emb = out.image_embeddings || out.embeddings || out[SAM.enc.outputNames[0]]; SAM.embKey = key;
  return SAM.emb;
}
async function samDecode(emb, points, labels) {
  var T = SAM.ort.Tensor, feed = {
    image_embeddings: new T(emb.type, emb.data, emb.dims), embeddings: new T(emb.type, emb.data, emb.dims),
    point_coords: new T('float32', new Float32Array(points), [1, points.length / 2, 2]), point_labels: new T('float32', new Float32Array(labels), [1, labels.length]),
    mask_input: new T('float32', new Float32Array(256 * 256), [1, 1, 256, 256]), has_mask_input: new T('float32', new Float32Array([0]), [1]), orig_im_size: new T('float32', new Float32Array([1024, 1024]), [2])
  }, f2 = {};
  SAM.dec.inputNames.forEach(function (nm) { if (feed[nm]) f2[nm] = feed[nm]; });
  var res = await SAM.dec.run(f2);
  var m = res.masks || res[SAM.dec.outputNames[0]], iou = res.iou_predictions || res.scores || null;
  if (!m || !m.dims || m.dims.length < 3) throw new Error('shape');
  var H2 = m.dims[m.dims.length - 2], W2 = m.dims[m.dims.length - 1], K = m.dims.length === 4 ? m.dims[1] : 1, best = 0;
  if (iou && iou.data && K > 1) for (var q = 1; q < K; q++) if (iou.data[q] > iou.data[best]) best = q;
  return { data: m.data, off: best * H2 * W2, H: H2, W: W2, iou: iou && iou.data ? Number(iou.data[best]) : null };
}
function samToMask(r, img, key) {
  var G = 256, md = new Uint8Array(G * G), x0 = G, y0 = G, x1 = -1, y1 = -1, area = 0;
  for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
    var sy = Math.min(r.H - 1, Math.floor((gy + 0.5) * r.H / G)), sx = Math.min(r.W - 1, Math.floor((gx + 0.5) * r.W / G));
    if (r.data[r.off + sy * r.W + sx] > 0) { md[gy * G + gx] = 1; area++; if (gx < x0) x0 = gx; if (gy < y0) y0 = gy; if (gx > x1) x1 = gx; if (gy > y1) y1 = gy; }
  }
  if (!area) return null;
  return { key: key, w: G, h: G, data: md, area: area / (G * G), bbox: [x0 / G * img.w, y0 / G * img.h, (x1 + 1) / G * img.w, (y1 + 1) / G * img.h] };
}
function samResult(img, mask, score, label) {
  return { imageId: img.id, frame: S.frame, type: 'mask', label: label, score: score != null ? Math.max(0, Math.min(1, score)) : null, uncertainty: null, provenance: 'AI-derived experimental inference', calibrated: 'no', model: SAM_CARD.name, mask: mask };
}
async function samDetect() {
  var img = curImg(); if (!img) return [];
  if (SAM.status !== 'ready') await samLoad(); if (SAM.status !== 'ready') throw new Error('sam-unavailable');
  var cands = detectCandidates(img, { max: 6 }), emb = await samEmbed(img), out = [], key = 's' + Date.now();
  for (var i = 0; i < cands.length; i++) {
    var b = cands[i].mask.bbox, px = (b[2] - b[0]) * 0.1, py = (b[3] - b[1]) * 0.1;
    var X0 = Math.max(0, b[0] - px), Y0 = Math.max(0, b[1] - py), X1 = Math.min(img.w, b[2] + px), Y1 = Math.min(img.h, b[3] + py);
    var r = await samDecode(emb, [X0 / img.w * 1024, Y0 / img.h * 1024, X1 / img.w * 1024, Y1 / img.h * 1024], [2, 3]);
    var m = samToMask(r, img, key + i); if (!m || m.area > 0.35) continue;      // empty or leaked into most of the image
    out.push(samResult(img, m, r.iou, 'AI-segmented candidate (' + cands[i].polarity + ' than surroundings)'));
  }
  return out;
}
async function aiClickAt(p) {
  var img = curImg(); if (!img) return;
  if (S.ai.mode !== 'sam') { toast('Choose “AI detection & segmentation (SAM)” in the AI panel first.'); return; }
  if (!consentState()) { openConsent('ai'); return; }
  if (!S.ai.reviewed) { toast('Review the model card and confirm before running.'); return; }
  if (S.ai.running) { toast('One inference at a time.'); return; }
  S.ai.running = true; S.ai.error = null; scheduleRender(); announce('Running AI segmentation at the clicked point…');
  try {
    if (SAM.status !== 'ready') await samLoad(); if (SAM.status !== 'ready') throw new Error('sam-unavailable');
    var emb = await samEmbed(img), r = await samDecode(emb, [p.x / img.w * 1024, p.y / img.h * 1024], [1]);
    var m = samToMask(r, img, 'c' + Date.now());
    if (!m) { toast('The AI model found no region at that point.'); }
    else { var res = samResult(img, m, r.iou, 'AI segmentation at your click'); res.id = nextAiId(); S.ai.results.push(res); S.ai.lastRun = { at: isoNow(), imageId: S.current, count: 1, runtime: 'local-browser' }; announce('AI suggestion ' + res.id + ' added (experimental, not a diagnosis).'); }
  } catch (e) { S.ai.error = e && e.message === 'sam-unavailable' ? (SAM.error || 'The AI model is not available on this site.') : 'AI segmentation failed on this image.'; }
  finally { S.ai.running = false; scheduleRender(); }
}
