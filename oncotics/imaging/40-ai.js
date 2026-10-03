
/* ====================================================================
   EXPERIMENTAL AI DETECTION & INFERENCE (opt-in; never automatic)
   Mode A  local-browser: user-selected .onnx model + Oncotics model
           manifest (model card + pre/post-processing). Runs in ONNX
           Runtime Web (WebAssembly, single thread) self-hosted at
           CONFIG.ortBase. No network request is made for inference.
   Mode B  user-endpoint: disabled by default; separate consent; the
           current displayed image is POSTed directly from the browser to
           the endpoint the user typed (never prefilled, never proxied).
   Mode C  none (default): viewing, manual measurement and annotation only.
   Manifest schema "oncotics-model-manifest/1" is documented in
   docs/IMAGING-MODEL-MANIFEST.md.
   ==================================================================== */
var OUTPUT_TYPES = { classification: 1, segmentation: 1, heatmap: 1, boxes: 1, keypoints: 1 };
function validateManifest(m) {
  var errs = [];
  if (!m || typeof m !== 'object') return ['Manifest is not a JSON object.'];
  if (m.schema !== 'oncotics-model-manifest/1') errs.push('schema must be "oncotics-model-manifest/1".');
  var c = m.card || {}, i = m.input || {}, o = m.output || {};
  ['name', 'version', 'source', 'license', 'intendedUse', 'validationStatus'].forEach(function (k) { if (!c[k] || typeof c[k] !== 'string') errs.push('card.' + k + ' is required.'); });
  if (!(i.width > 0 && i.width <= 2048 && i.height > 0 && i.height <= 2048)) errs.push('input.width/height must be 1–2048.');
  if (i.channels !== 1 && i.channels !== 3) errs.push('input.channels must be 1 or 3.');
  if (i.layout && i.layout !== 'NCHW' && i.layout !== 'NHWC') errs.push('input.layout must be NCHW or NHWC.');
  if (!OUTPUT_TYPES[o.type]) errs.push('output.type must be one of classification, segmentation, heatmap, boxes, keypoints.');
  return errs;
}
function normCard(m, runtime) {
  var c = m.card || {}, reg = String(c.regulatoryStatus || '');
  var regClaim = /fda|cleared|approved|ce mark|510\(k\)|de novo/i.test(reg);
  return { name: c.name, version: c.version, source: c.source, license: c.license, intendedUse: c.intendedUse, modality: arr(c.modality), imageTypes: arr(c.imageTypes), outputType: (m.output || {}).type,
    validationStatus: c.validationStatus, limitations: arr(c.limitations), failureModes: arr(c.failureModes), calibrated: c.calibrated === true ? 'yes' : c.calibrated === false ? 'no' : 'unknown',
    confidenceMeaning: c.confidenceMeaning || 'Not described by the model author.', regulatoryStatus: regClaim ? reg + ' (claim made by the model author; not verified by Oncotics)' : (reg || 'unknown / not claimed'), regulatoryClaimUnverified: regClaim,
    community: /community|open-?source|github/i.test(String(c.source) + ' ' + String(c.validationStatus)), lastVerified: c.lastVerified || 'not provided', link: safeUrl(c.link || '') || null, runtime: runtime };
}
function modelCardView(card) {
  if (!card) return '';
  var row = function (k, v) { return H`<dt>${k}</dt><dd>${v == null || v === '' || (Array.isArray(v) && !v.length) ? H`<span class="oi-subtle">not provided</span>` : (Array.isArray(v) ? v.join('; ') : v)}</dd>`; };
  return H`<div class="oi-card oi-modelcard"><div class="oi-card-title">${icon('card')} Model card — ${card.name} ${card.version}</div>
    <dl class="oi-kv">${row('Source / repository', card.link ? ext(card.link, card.source) : card.source)}${row('License', card.license)}${row('Intended use', card.intendedUse)}${row('Input modality', card.modality)}${row('Supported image types', card.imageTypes)}${row('Output type', card.outputType)}${row('Validation status', card.validationStatus)}${row('Known limitations', card.limitations)}${row('Expected failure modes', card.failureModes)}${row('Calibrated scores', card.calibrated)}${row('Confidence score meaning', card.confidenceMeaning)}${row('Regulatory status', card.regulatoryStatus)}${row('Privacy mode', card.runtime === 'local-browser' ? 'Local browser (no network request for inference)' : 'User-supplied endpoint (image leaves your browser)')}${row('Last verified', card.lastVerified)}</dl>
    ${notice('warn', H`<strong>${TEXT.modelOut}</strong>`)}${card.community ? notice('warn', TEXT.community) : ''}${notice('info', TEXT.aiDerived)}${card.regulatoryClaimUnverified ? notice('bad', 'The model author states a regulatory status. Oncotics has not verified it and does not present this model as FDA-cleared or approved.') : ''}</div>`;
}
var ORT = null;
function loadOrt() {
  if (ORT) return Promise.resolve(ORT);
  if (location.protocol === 'file:') return Promise.reject(new Error('runtime-unavailable'));
  return import(CONFIG.ortBase + 'ort.wasm.min.mjs').then(function (mod) {
    var ort = mod && (mod.InferenceSession ? mod : mod.default);
    if (!ort || !ort.InferenceSession) throw new Error('runtime-unavailable');
    ort.env.wasm.wasmPaths = CONFIG.ortBase; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; if (ort.env.logLevel !== undefined) ort.env.logLevel = 'fatal';
    ORT = ort; return ort;
  }).catch(function () { throw new Error('runtime-unavailable'); });
}
// Build the model input from the displayed image (window/level applied), resized with the canvas.
function buildInput(img, inp) {
  var src = Inspector.display(img), c = document.createElement('canvas'); c.width = inp.width; c.height = inp.height;
  var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(src, 0, 0, inp.width, inp.height);
  var d = g.getImageData(0, 0, inp.width, inp.height).data; c.width = c.height = 0;
  var C = inp.channels, n = inp.width * inp.height, out = new Float32Array(n * C), scale = inp.scale != null ? inp.scale : 1 / 255, mean = arr(inp.mean).length ? arr(inp.mean) : [0], std = arr(inp.std).length ? arr(inp.std) : [1], nhwc = inp.layout === 'NHWC';
  for (var i = 0; i < n; i++) for (var ch = 0; ch < C; ch++) { var v = C === 1 ? (d[4 * i] * 0.299 + d[4 * i + 1] * 0.587 + d[4 * i + 2] * 0.114) : d[4 * i + ch]; v = (v * scale - (mean[ch] != null ? mean[ch] : mean[0])) / (std[ch] != null ? std[ch] : std[0]); out[nhwc ? i * C + ch : ch * n + i] = v; }
  return { data: out, dims: nhwc ? [1, inp.height, inp.width, C] : [1, C, inp.height, inp.width] };
}
function act(v, a) { return a === 'sigmoid' ? 1 / (1 + Math.exp(-v)) : v; }
function components(bin, w, h, minArea) {
  var lab = new Int32Array(w * h), out = [], stack = [];
  for (var s0 = 0; s0 < w * h; s0++) {
    if (!bin[s0] || lab[s0]) continue;
    var id = out.length + 1, px = [], x0 = w, y0 = h, x1 = 0, y1 = 0; stack.push(s0); lab[s0] = id;
    while (stack.length) { var p = stack.pop(), x = p % w, y = (p / w) | 0; px.push(p); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      [p - 1, p + 1, p - w, p + w].forEach(function (q, k) { if (q < 0 || q >= w * h) return; if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) return; if (bin[q] && !lab[q]) { lab[q] = id; stack.push(q); } }); }
    if (px.length >= minArea) out.push({ pixels: px, bbox: [x0, y0, x1 + 1, y1 + 1] });
  }
  return out;
}
function postprocess(o, data, dims, img, card) {
  var labels = arr(o.labels), res = [], keyBase = 'm' + Date.now();
  var mk = function (x) { return Object.assign({ imageId: img.id, frame: S.frame, provenance: 'AI-derived experimental inference', calibrated: card.calibrated, model: card.name + ' ' + card.version, uncertainty: null }, x); };
  if (o.type === 'classification') {
    var v = Array.prototype.slice.call(data); if (o.activation === 'softmax') { var mx = Math.max.apply(null, v), ex = v.map(function (z) { return Math.exp(z - mx); }), sm = ex.reduce(function (a, b) { return a + b; }, 0); v = ex.map(function (z) { return z / sm; }); } else v = v.map(function (z) { return act(z, o.activation); });
    v.forEach(function (s, i) { res.push(mk({ type: 'classification', label: labels[i] || 'class ' + i, score: s })); });
    return res.sort(function (a, b) { return b.score - a.score; });
  }
  if (o.type === 'segmentation' || o.type === 'heatmap') {
    var H2 = dims[dims.length - 2], W2 = dims[dims.length - 1], C2 = dims.length >= 3 ? (dims.length === 4 ? dims[1] : dims[0]) : 1; if (dims.length === 3 && dims[0] === 1) C2 = 1;
    if (!(H2 > 0 && W2 > 0) || data.length < H2 * W2) throw new Error('shape');
    var plane = H2 * W2, chans = [];
    if (o.activation === 'softmax' && C2 > 1) { var sm2 = []; for (var c2 = 0; c2 < C2; c2++) sm2.push(new Float32Array(plane)); for (var q = 0; q < plane; q++) { var m2 = -Infinity; for (c2 = 0; c2 < C2; c2++) m2 = Math.max(m2, data[c2 * plane + q]); var tot = 0; for (c2 = 0; c2 < C2; c2++) { var e2 = Math.exp(data[c2 * plane + q] - m2); sm2[c2][q] = e2; tot += e2; } for (c2 = 0; c2 < C2; c2++) sm2[c2][q] /= tot; } chans = sm2; }
    else for (var c3 = 0; c3 < C2; c3++) { var pl = new Float32Array(plane); for (var r = 0; r < plane; r++) pl[r] = act(data[c3 * plane + r], o.activation); chans.push(pl); }
    var startC = labels[0] && /background/i.test(labels[0]) && chans.length > 1 ? 1 : 0;
    for (var ci = startC; ci < chans.length; ci++) {
      var prob = chans[ci], label = labels[ci] || (o.type === 'heatmap' ? 'activation' : 'region ' + ci), thr = o.threshold != null ? o.threshold : 0.5;
      if (o.type === 'heatmap') { var mxv = 0; for (var z = 0; z < plane; z++) if (prob[z] > mxv) mxv = prob[z]; res.push(mk({ type: 'heatmap', label: label, score: mxv, mask: { key: keyBase + 'h' + ci, w: W2, h: H2, prob: prob, data: new Uint8Array(plane), bbox: [0, 0, img.w, img.h] } })); continue; }
      var bin = new Uint8Array(plane); for (var z2 = 0; z2 < plane; z2++) bin[z2] = prob[z2] >= Math.min(thr, 0.99) ? 1 : 0;
      components(bin, W2, H2, o.minArea || 4).forEach(function (cmp, k) {
        var md = new Uint8Array(plane), sum = 0; cmp.pixels.forEach(function (p) { md[p] = 1; sum += prob[p]; });
        var sx = img.w / W2, sy = img.h / H2;
        res.push(mk({ type: 'mask', label: label, score: sum / cmp.pixels.length, mask: { key: keyBase + 's' + ci + '_' + k, w: W2, h: H2, data: md, bbox: [cmp.bbox[0] * sx, cmp.bbox[1] * sy, cmp.bbox[2] * sx, cmp.bbox[3] * sy] } }));
      });
    }
    return res.sort(function (a, b) { return b.score - a.score; });
  }
  if (o.type === 'boxes' || o.type === 'keypoints') {
    var stride = dims[dims.length - 1], rows = data.length / stride; if (!(stride >= (o.type === 'boxes' ? 5 : 3))) throw new Error('shape');
    var norm = (o.boxFormat || 'xyxy-normalized') === 'xyxy-normalized', inW = o.inputWidth || 1, inH = o.inputHeight || 1;
    for (var i = 0; i < rows && i < 500; i++) {
      var b = Array.prototype.slice.call(data, i * stride, (i + 1) * stride);
      var X = function (v) { return norm ? v * img.w : v / inW * img.w; }, Y = function (v) { return norm ? v * img.h : v / inH * img.h; };
      if (o.type === 'boxes') { var sc = b[o.scoreIndex != null ? o.scoreIndex : 4], cl = o.classIndex != null ? b[o.classIndex] : 0; res.push(mk({ type: 'boundingBox', label: labels[cl | 0] || 'region', score: act(sc, o.activation), box: [X(b[0]), Y(b[1]), X(b[2]), Y(b[3])] })); }
      else res.push(mk({ type: 'keypoint', label: labels[0] || 'point', score: act(b[2], o.activation), point: { x: X(b[0]), y: Y(b[1]) } }));
    }
    return res.sort(function (a, b2) { return b2.score - a.score; });
  }
  throw new Error('shape');
}
async function runLocalInference() {
  var img = curImg(), m = S.ai.model; if (!img || !m) return;
  var ort = await loadOrt();
  if (!S.ai.session) S.ai.session = await ort.InferenceSession.create(S.ai.modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  var sess = S.ai.session, inp = Object.assign({}, m.input), x = buildInput(img, inp), feeds = {};
  feeds[inp.name || sess.inputNames[0]] = new ort.Tensor('float32', x.data, x.dims);
  var out = await sess.run(feeds), t = out[(m.output || {}).name || sess.outputNames[0]];
  if (!t || !t.data) throw new Error('shape');
  var o = Object.assign({ inputWidth: inp.width, inputHeight: inp.height }, m.output);
  return postprocess(o, t.data, t.dims, img, S.ai.card);
}
function imagePngBase64(img) { return new Promise(function (resolve, reject) { var c = document.createElement('canvas'); c.width = img.w; c.height = img.h; c.getContext('2d').drawImage(Inspector.display(img), 0, 0); c.toBlob(function (b) { c.width = c.height = 0; if (!b) return reject(new Error('encode')); var fr = new FileReader(); fr.onload = function () { resolve(String(fr.result).split(',')[1]); }; fr.onerror = function () { reject(new Error('encode')); }; fr.readAsDataURL(b); }, 'image/png'); }); }
async function runRemoteInference() {
  var img = curImg(), R = S.ai.remote; if (!img) return;
  var url = safeUrl(R.url); if (!url) throw new Error('bad-url');
  var b64 = await imagePngBase64(img);
  var headers = { 'Content-Type': 'application/json', Accept: 'application/json' }; if (R.token) headers.Authorization = R.token;
  var ctrl = new AbortController(), tm = setTimeout(function () { ctrl.abort(); }, 120000), res, body;
  try { res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify({ format: 'oncotics-inference-exchange/1', model: R.model || null, image: { mime: 'image/png', encoding: 'base64', data: b64, width: img.w, height: img.h }, modality: img.isDicom ? img.modality : 'non-DICOM' }), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: ctrl.signal }); body = await res.json(); }
  catch (e) { throw new Error('network'); } finally { clearTimeout(tm); b64 = null; }
  if (!res.ok) throw new Error('http-' + res.status);
  if (!body || !Array.isArray(body.outputs)) throw new Error('shape');
  var mc = body.model || {}; S.ai.card = normCard({ card: { name: mc.name || R.model || 'Remote model', version: mc.version || 'unknown', source: mc.source || 'user-supplied endpoint', license: mc.license || 'unknown', intendedUse: mc.intendedUse || 'not provided', validationStatus: mc.validationStatus || 'unknown', limitations: mc.limitations, failureModes: mc.failureModes, calibrated: mc.calibrated, confidenceMeaning: mc.confidenceMeaning, regulatoryStatus: mc.regulatoryStatus, link: mc.link }, output: { type: 'mixed' } }, 'user-endpoint');
  var fin = function (v) { return typeof v === 'number' && isFinite(v); };
  return body.outputs.slice(0, 300).map(function (o) {
    var r = { imageId: img.id, frame: S.frame, type: String(o.type || 'unknown').slice(0, 30), label: String(o.label || 'AI suggestion').slice(0, 80), score: fin(o.score) ? Math.max(0, Math.min(1, o.score)) : null, uncertainty: fin(o.uncertainty) ? o.uncertainty : null, provenance: 'AI-derived experimental inference', calibrated: S.ai.card.calibrated, model: S.ai.card.name };
    if (Array.isArray(o.box) && o.box.length === 4 && o.box.every(fin)) r.box = [o.box[0] * img.w, o.box[1] * img.h, o.box[2] * img.w, o.box[3] * img.h];
    if (Array.isArray(o.polygon) && o.polygon.length >= 3) r.polygon = o.polygon.filter(function (p) { return Array.isArray(p) && fin(p[0]) && fin(p[1]); }).slice(0, 2000).map(function (p) { return { x: p[0] * img.w, y: p[1] * img.h }; });
    if (Array.isArray(o.point) && o.point.length === 2 && o.point.every(fin)) r.point = { x: o.point[0] * img.w, y: o.point[1] * img.h };
    return r;
  });
}
async function runInference() {
  if (S.ai.running) { toast('One inference at a time.'); return; }
  if (!S.consent.phi || !S.consent.nondiag) { openConsent('ai'); return; }
  if (!curImg()) { toast('Load and select an image first.'); return; }
  if (S.ai.mode === 'none') { toast('Choose a model or inference source first.'); return; }
  if (!S.ai.reviewed) { toast('Review the model card and confirm before running.'); return; }
  if (S.ai.mode === 'remote' && (!S.ai.remote.enabled || !S.consent.remote)) { openConsent('remote'); return; }
  S.ai.running = true; S.ai.error = null; scheduleRender(); announce('Running experimental inference…');
  try {
    var out = S.ai.mode === 'packs' ? await runPack() : S.ai.mode === 'builtin' ? runBuiltin() : S.ai.mode === 'sam' ? await samDetect() : S.ai.mode === 'local' ? await runLocalInference() : await runRemoteInference();
    out.forEach(function (r) { r.id = nextAiId(); });
    S.ai.results = S.ai.results.filter(function (r) { return r.imageId !== S.current || r.accepted; }).concat(out);
    S.ai.lastRun = { at: isoNow(), imageId: S.current, count: out.length, runtime: S.ai.mode === 'remote' ? 'user-endpoint' : 'local-browser' };
    announce('Inference finished: ' + out.length + ' AI suggestions (experimental, not a diagnosis).');
  } catch (e) {
    var k = e && e.message;
    S.ai.error = k === 'pack-unavailable' ? ((packSel() && packSel().error) || 'The selected AI model pack is not available on this site.') : k === 'too-large' ? 'This image is too large for patch scoring in the browser (over 1,600 patches). Upload a smaller tile or region.' : k === 'sam-unavailable' ? (SAM.error || 'The AI model is not available on this site.') : k === 'runtime-unavailable' ? 'The local inference runtime is not deployed on this host (/assets/ort/). Ask the site operator to run scripts/fetch-vendor-assets.sh, or use a different mode.' : k === 'shape' ? 'The model output did not match the manifest (shape or type mismatch). Nothing was shown.' : /^http-/.test(k) ? 'The endpoint answered with ' + k.replace('http-', 'HTTP ') + '.' : k === 'bad-url' ? 'The endpoint URL must be https.' : k === 'network' ? 'The endpoint could not be reached (network or CORS). Nothing was sent to Oncotics.' : 'Inference failed: the model or image could not be processed.';
  } finally { S.ai.running = false; scheduleRender(); }
}
function scoreLabel(s) { return s == null ? 'not reported' : s >= 0.9 ? 'Very high' : s >= 0.75 ? 'High' : s >= 0.5 ? 'Medium' : 'Low'; }
function acceptSuggestion(id) {
  var r = S.ai.results.find(function (x) { return x.id === id; }); if (!r) return;
  var a = { id: 'A' + S.nextAnn++, imageId: r.imageId, frame: r.frame || 0, label: 'unknown', provenance: 'originally AI-derived, accepted by user', aiOrigin: { suggestion: r.id, model: r.model, label: r.label, score: r.score }, createdAt: isoNow(), note: '' };
  if (r.box) { a.type = 'rect'; a.points = [{ x: r.box[0], y: r.box[1] }, { x: r.box[2], y: r.box[3] }]; }
  else if (r.polygon) { a.type = 'polygon'; a.points = r.polygon.slice(); a.closed = true; }
  else if (r.point) { a.type = 'length'; a.points = [r.point, { x: r.point.x + 1, y: r.point.y }]; }
  else if (r.mask && r.type === 'mask') { a.type = 'mask'; a.points = []; a.mask = { key: r.mask.key + 'a', w: r.mask.w, h: r.mask.h, data: r.mask.data, bbox: r.mask.bbox }; }
  else { toast('This suggestion type (' + r.type + ') cannot become an annotation; it remains a model output.'); return; }
  r.accepted = true; S.annotations.push(a); S.selected = a.id; toast('Accepted as user annotation ' + a.id + ' (originally AI-derived).'); scheduleRender();
}
function rejectSuggestion(id) { S.ai.results = S.ai.results.filter(function (x) { return x.id !== id; }); scheduleRender(); }
