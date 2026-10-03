
/* ====================================================================
   INSPECTOR: canvas viewer (memory only)
   Layers: 1 image · 2 AI suggestion overlay · 3-4 user measurements/contours
   · 5 key-image markers · 6 structured lesion labels.
   AI suggestions are never user annotations until explicitly accepted.
   ==================================================================== */
function curImg() { return S.current ? S.images.get(S.current) : null; }
function seriesOf(img) { var out = null; S.studies.forEach(function (st) { st.series.forEach(function (se) { if (se.id === img.seriesId) out = se; }); }); return out; }
function imgLabel(img) { if (!img) return ''; var se = seriesOf(img); var st = se && S.studies.find(function (x) { return x.series.indexOf(se) >= 0; }); return (st ? st.label + ' · ' : '') + (se ? se.label + ' · ' : '') + img.label + (img.frames.length > 1 ? ' · frame ' + (S.frame + 1) + '/' + img.frames.length : ''); }
function unitsOf(img) {
  if (!img.isDicom) return { name: '8-bit display value', calibrated: false, note: 'Non-DICOM image: values are display intensities, not calibrated measurements.' };
  if (img.kind === 'rgb') return { name: 'RGB display value', calibrated: false, note: 'Color image: no calibrated intensity.' };
  if (/^CT$/i.test(img.modality) && img.rescaled) return { name: 'HU', calibrated: true, note: 'Hounsfield units from DICOM rescale slope/intercept as source-reported in the file.' };
  return { name: 'stored value' + (img.unitsTag ? ' (' + img.unitsTag + ')' : ''), calibrated: false, note: /^PT$/i.test(img.modality) ? 'PET values are shown as rescaled stored values; SUV is not computed by Oncotics.' : 'Rescaled stored values; no calibration claim is made.' };
}
var Inspector = (function () {
  var el = document.createElement('div'); el.className = 'oi-stage';
  var canvas = document.createElement('canvas'); canvas.className = 'oi-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Image viewer. Arrow keys pan, plus and minus zoom, Page Up and Page Down change image, Escape cancels, Enter finishes a polygon, Delete removes the selected annotation. Measurements are listed in text beside the viewer.');
  el.appendChild(canvas);
  var view = { zoom: 1, px: 0, py: 0 }, cache = { key: null, canvas: document.createElement('canvas') }, drag = null, hover = null;
  function fitScale(img) { var w = el.clientWidth || 640, h = el.clientHeight || 480; return Math.min(w / img.w, h / img.h) * 0.96; }
  function T(img) { var s = fitScale(img) * view.zoom, w = el.clientWidth || 640, h = el.clientHeight || 480; return { s: s, ox: (w - img.w * s) / 2 + view.px, oy: (h - img.h * s) / 2 + view.py }; }
  function toImg(e, img) { var b = canvas.getBoundingClientRect(), t = T(img); return { x: (e.clientX - b.left - t.ox) / t.s, y: (e.clientY - b.top - t.oy) / t.s }; }
  function display(img) {
    var key = img.id + '|' + S.frame + '|' + (img.kind === 'gray' ? img.wl.c.toFixed(2) + '|' + img.wl.w.toFixed(2) : 'rgb');
    if (cache.key === key) return cache.canvas;
    var c = cache.canvas; c.width = img.w; c.height = img.h; var g = c.getContext('2d'), d = g.createImageData(img.w, img.h), out = d.data, src = img.frames[S.frame] || img.frames[0];
    if (img.kind === 'rgb') out.set(src);
    else {
      var lo = img.wl.c - img.wl.w / 2, k = 255 / Math.max(1e-6, img.wl.w), inv = img.invert;
      for (var i = 0, n = src.length; i < n; i++) { var v = (src[i] - lo) * k; v = v < 0 ? 0 : v > 255 ? 255 : v; if (inv) v = 255 - v; var o = i * 4; out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255; }
    }
    g.putImageData(d, 0, 0); cache.key = key; return c;
  }
  function measure(a, img) {
    var sp = img.spacing, sx = sp ? sp[1] : 1, sy = sp ? sp[0] : 1, unit = sp ? 'mm' : 'px';
    var dist = function (p, q) { return Math.hypot((q.x - p.x) * sx, (q.y - p.y) * sy); };
    var P = a.points, out = { unit: unit, spacingSource: img.spacingSource || null };
    if (a.type === 'length' && P.length >= 2) out.length = dist(P[0], P[1]);
    if (a.type === 'bidir' && P.length >= 2) { out.long = dist(P[0], P[1]); if (P.length >= 4) out.short = dist(P[2], P[3]); }
    if (a.type === 'angle' && P.length >= 3) { var v1 = { x: (P[0].x - P[1].x) * sx, y: (P[0].y - P[1].y) * sy }, v2 = { x: (P[2].x - P[1].x) * sx, y: (P[2].y - P[1].y) * sy }; out.angle = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)))) * 180 / Math.PI; }
    if ((a.type === 'rect' || a.type === 'ellipse' || a.type === 'polygon' || a.type === 'mask') && (P.length >= 2 || a.mask)) {
      var inside, x0, y0, x1, y1;
      if (a.type === 'mask') { var m = a.mask; x0 = m.bbox[0]; y0 = m.bbox[1]; x1 = m.bbox[2]; y1 = m.bbox[3]; inside = function (x, y) { var gx = Math.floor(x / img.w * m.w), gy = Math.floor(y / img.h * m.h); return m.data[gy * m.w + gx] === 1; }; }
      else if (a.type === 'polygon') { x0 = Math.min.apply(null, P.map(function (p) { return p.x; })); x1 = Math.max.apply(null, P.map(function (p) { return p.x; })); y0 = Math.min.apply(null, P.map(function (p) { return p.y; })); y1 = Math.max.apply(null, P.map(function (p) { return p.y; })); inside = function (x, y) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i].y > y) !== (P[j].y > y)) && (x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x)) c = !c; } return c; }; var per = 0; for (var q = 0; q < P.length; q++) per += dist(P[q], P[(q + 1) % P.length]); out.perimeter = per; }
      else { x0 = Math.min(P[0].x, P[1].x); x1 = Math.max(P[0].x, P[1].x); y0 = Math.min(P[0].y, P[1].y); y1 = Math.max(P[0].y, P[1].y); var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 || 1, ry = (y1 - y0) / 2 || 1; inside = a.type === 'rect' ? function () { return true; } : function (x, y) { var dx = (x - cx) / rx, dy = (y - cy) / ry; return dx * dx + dy * dy <= 1; }; }
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(img.w - 1, Math.ceil(x1)); y1 = Math.min(img.h - 1, Math.ceil(y1));
      var src = img.frames[a.frame || 0] || img.frames[0], n = 0, sum = 0, sq = 0, mn = Infinity, mx = -Infinity, step = (x1 - x0) * (y1 - y0) > 4e6 ? 2 : 1;
      for (var y = y0; y <= y1; y += step) for (var x = x0; x <= x1; x += step) { if (!inside(x + 0.5, y + 0.5)) continue; var v = img.kind === 'gray' ? src[y * img.w + x] : (src[4 * (y * img.w + x)] + src[4 * (y * img.w + x) + 1] + src[4 * (y * img.w + x) + 2]) / 3; n++; sum += v; sq += v * v; if (v < mn) mn = v; if (v > mx) mx = v; }
      n *= step * step;
      if (n) { var mean = sum / (n / (step * step)); out.mean = mean; out.sd = Math.sqrt(Math.max(0, sq / (n / (step * step)) - mean * mean)); out.min = mn; out.max = mx; out.area = n * sx * sy; out.areaUnit = sp ? 'mm²' : 'px²'; out.pixels = n; out.valueUnit = unitsOf(img).name; }
    }
    return out;
  }
  function fmtMeasure(m) {
    var u = m.unit, parts = [];
    if (m.length != null) parts.push('Length ' + num(m.length, 1) + ' ' + u);
    if (m.long != null) parts.push('Long axis ' + num(m.long, 1) + ' ' + u + (m.short != null ? ' · short axis ' + num(m.short, 1) + ' ' + u : ' · draw the short axis'));
    if (m.angle != null) parts.push('Angle ' + num(m.angle, 1) + '°');
    if (m.area != null) parts.push('Area ' + num(m.area, 1) + ' ' + m.areaUnit + ' · mean ' + num(m.mean, 1) + ' ± ' + num(m.sd, 1) + ' (' + m.valueUnit + ') · min ' + num(m.min, 1) + ' · max ' + num(m.max, 1));
    if (m.perimeter != null) parts.push('Perimeter ' + num(m.perimeter, 1) + ' ' + u);
    return parts.join(' · ');
  }
  function shapePath(g, a, t) {
    var P = a.points.map(function (p) { return { x: t.ox + p.x * t.s, y: t.oy + p.y * t.s }; });
    g.beginPath();
    if ((a.type === 'length' || a.type === 'bidir') && P.length >= 2) { g.moveTo(P[0].x, P[0].y); g.lineTo(P[1].x, P[1].y); if (P.length >= 4) { g.moveTo(P[2].x, P[2].y); g.lineTo(P[3].x, P[3].y); } }
    else if (a.type === 'rect' && P.length >= 2) g.rect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y);
    else if (a.type === 'ellipse' && P.length >= 2) g.ellipse((P[0].x + P[1].x) / 2, (P[0].y + P[1].y) / 2, Math.abs(P[1].x - P[0].x) / 2, Math.abs(P[1].y - P[0].y) / 2, 0, 0, 2 * Math.PI);
    else if ((a.type === 'polygon' || a.type === 'angle' || a.type === 'aipoly') && P.length) { g.moveTo(P[0].x, P[0].y); P.slice(1).forEach(function (p) { g.lineTo(p.x, p.y); }); if ((a.type === 'polygon' && a.closed) || a.type === 'aipoly') g.closePath(); }
    return P;
  }
  var maskCache = new Map();
  function maskCanvas(m, color, heat) {
    var k = m.key; if (maskCache.has(k)) return maskCache.get(k);
    var c = document.createElement('canvas'); c.width = m.w; c.height = m.h; var g = c.getContext('2d'), d = g.createImageData(m.w, m.h);
    for (var i = 0; i < m.w * m.h; i++) { var v = heat ? m.prob[i] : m.data[i]; if (!v) continue; var o = i * 4; if (heat) { var t = Math.max(0, Math.min(1, v)); d.data[o] = 255 * Math.min(1, 2 * t); d.data[o + 1] = 255 * Math.max(0, 1 - Math.abs(t - 0.5) * 2); d.data[o + 2] = 255 * Math.max(0, 1 - 2 * t); d.data[o + 3] = 200 * t; } else { d.data[o] = color[0]; d.data[o + 1] = color[1]; d.data[o + 2] = color[2]; d.data[o + 3] = 170; } }
    g.putImageData(d, 0, 0); maskCache.set(k, c); return c;
  }
  function draw() {
    var w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    var g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = (VIEWER_BG[DISPLAY.viewerBg] || VIEWER_BG.black)[1]; g.fillRect(0, 0, w, h);
    var img = curImg();
    if (!img) { g.fillStyle = viewerBgIsLight() ? '#334155' : '#94A3B8'; g.font = '14px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('No image loaded. Use Upload Image or Connect Source (after consent).', w / 2, h / 2); return; }
    var t = T(img); g.imageSmoothingEnabled = view.zoom < 3; g.drawImage(display(img), t.ox, t.oy, img.w * t.s, img.h * t.s);
    // Layer 2: AI suggestions (separate memory-only layer)
    if (S.layers.ai) {
      g.save(); g.globalAlpha = S.layers.aiOpacity;
      aiVisible().filter(function (r) { return r.imageId === img.id && (r.frame || 0) === S.frame; }).forEach(function (r) {
        g.strokeStyle = '#F0ABFC'; g.lineWidth = 2; g.setLineDash([6, 4]);
        if (r.mask) { g.globalAlpha = S.layers.aiOpacity; g.imageSmoothingEnabled = false; g.drawImage(maskCanvas(r.mask, r.color || [232, 121, 249], r.type === 'heatmap'), t.ox, t.oy, img.w * t.s, img.h * t.s); g.imageSmoothingEnabled = true; }
        if (r.box) { var b = r.box; g.strokeRect(t.ox + b[0] * t.s, t.oy + b[1] * t.s, (b[2] - b[0]) * t.s, (b[3] - b[1]) * t.s); }
        if (r.polygon) { shapePath(g, { type: 'aipoly', points: r.polygon }, t); g.stroke(); }
        if (r.point) { g.setLineDash([]); g.beginPath(); g.arc(t.ox + r.point.x * t.s, t.oy + r.point.y * t.s, 7, 0, 2 * Math.PI); g.stroke(); }
        var lp = r.box ? { x: r.box[0], y: r.box[1] } : r.polygon ? r.polygon[0] : r.point ? r.point : r.mask ? { x: r.mask.bbox[0], y: r.mask.bbox[1] } : null;
        if (lp) { g.setLineDash([]); g.globalAlpha = Math.min(1, S.layers.aiOpacity + 0.3); g.font = '600 11px system-ui,sans-serif'; var txt = 'AI suggestion ' + (r.group || r.id) + ' · ' + (r.score != null ? r.score.toFixed(2) : '—'); g.fillStyle = 'rgba(30,6,40,.85)'; g.fillRect(t.ox + lp.x * t.s, t.oy + lp.y * t.s - 17, g.measureText(txt).width + 10, 16); g.fillStyle = '#F5D0FE'; g.fillText(txt, t.ox + lp.x * t.s + 5, t.oy + lp.y * t.s - 5); }
      });
      g.restore();
    }
    // Layers 3-6: user annotations
    if (S.layers.ann) {
      g.save(); g.globalAlpha = S.layers.annOpacity;
      S.annotations.concat(S.pending ? [S.pending] : []).filter(function (a) { return a.imageId === img.id && (a.frame || 0) === S.frame; }).forEach(function (a) {
        var sel = S.selected === a.id, accepted = /AI-derived/.test(a.provenance || '');
        g.strokeStyle = sel ? '#FDE047' : accepted ? '#F0ABFC' : '#2DD4BF'; g.lineWidth = sel ? 2.5 : 2; g.setLineDash(a === S.pending ? [4, 3] : []);
        if (a.type === 'mask' && a.mask) { g.drawImage(maskCanvas(a.mask, [45, 212, 191], false), t.ox, t.oy, img.w * t.s, img.h * t.s); }
        var P = a.type === 'mask' ? [] : shapePath(g, a, t); if (a.type !== 'mask') g.stroke();
        P.forEach(function (p) { g.fillStyle = g.strokeStyle; g.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); });
        var anchor = a.type === 'mask' ? { x: t.ox + a.mask.bbox[0] * t.s, y: t.oy + a.mask.bbox[1] * t.s } : P[0];
        if (anchor && a !== S.pending) { var m = measure(a, img), label = a.id + ' · ' + a.label + (m.length != null ? ' · ' + num(m.length, 1) + ' ' + m.unit : m.long != null ? ' · ' + num(m.long, 1) + (m.short != null ? '×' + num(m.short, 1) : '') + ' ' + m.unit : m.area != null ? ' · ' + num(m.area, 0) + ' ' + m.areaUnit : m.angle != null ? ' · ' + num(m.angle, 1) + '°' : '');
          g.font = '600 11px system-ui,sans-serif'; var tw = g.measureText(label).width; g.fillStyle = 'rgba(4,12,24,.82)'; g.fillRect(anchor.x + 6, anchor.y - 20, tw + 10, 16); g.fillStyle = sel ? '#FDE047' : '#E6FFFA'; g.fillText(label, anchor.x + 11, anchor.y - 8); }
      });
      g.restore();
    }
    // Key-image marker
    if (S.keyImages.some(function (k) { return k.imageId === img.id && k.frame === S.frame; })) { g.fillStyle = '#FDE047'; g.font = '700 12px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('★ Key image', w - 10, 18); g.textAlign = 'left'; }
    g.fillStyle = viewerBgIsLight() ? 'rgba(15,23,42,.9)' : 'rgba(203,213,225,.9)'; g.font = '11px system-ui,sans-serif';
    g.fillText(imgLabel(img) + (img.kind === 'gray' ? ' · W ' + num(img.wl.w, 0) + ' / L ' + num(img.wl.c, 0) : '') + ' · ' + Math.round(view.zoom * 100) + '%', 10, h - 10);
    if (!img.isDicom) { g.fillStyle = '#FCD34D'; g.fillText(TEXT.nonDicom, 10, 18); }
    if (hover && S.tool !== 'pan' && S.tool !== 'wl') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([]); g.beginPath(); g.moveTo(hover.x - 8, hover.y); g.lineTo(hover.x + 8, hover.y); g.moveTo(hover.x, hover.y - 8); g.lineTo(hover.x, hover.y + 8); g.stroke(); }
  }
  function newAnn(type, p, img) { return { id: 'A' + S.nextAnn, type: type, imageId: img.id, frame: S.frame, points: [p], label: 'unknown', provenance: 'user-generated annotation', createdAt: isoNow(), note: '' }; }
  function commit(a) { S.nextAnn++; S.annotations.push(a); S.selected = a.id; S.pending = null; announce('Annotation ' + a.id + ' added: ' + fmtMeasure(measure(a, curImg()))); scheduleRender(); }
  canvas.addEventListener('pointerdown', function (e) {
    var img = curImg(); if (!img) return; canvas.focus(); var p = toImg(e, img); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (S.tool === 'pan') { drag = { kind: 'pan', x: e.clientX, y: e.clientY, px: view.px, py: view.py }; return; }
    if (S.tool === 'wl') { drag = { kind: 'wl', x: e.clientX, y: e.clientY, c: img.wl.c, w: img.wl.w }; return; }
    if (p.x < 0 || p.y < 0 || p.x > img.w || p.y > img.h) return;
    if (S.tool === 'aiclick') { aiClickAt(p); return; }   // AI click-to-segment (explicit user action)
    if (S.tool === 'angle' || S.tool === 'polygon') {
      if (!S.pending || S.pending.type !== S.tool) S.pending = newAnn(S.tool, p, img);
      else {
        var P = S.pending.points;
        if (S.tool === 'polygon' && P.length >= 3 && Math.hypot((P[0].x - p.x) * T(img).s, (P[0].y - p.y) * T(img).s) < 10) { S.pending.closed = true; commit(S.pending); return; }
        P.push(p); if (S.tool === 'angle' && P.length === 3) { commit(S.pending); return; }
      }
      draw(); return;
    }
    if (S.tool === 'bidir' && S.pending && S.pending.type === 'bidir' && S.pending.points.length === 2) { S.pending.points.push(p, p); drag = { kind: 'bidir2' }; return; }
    S.pending = newAnn(S.tool, p, img); S.pending.points.push(p); drag = { kind: 'shape' };
  });
  canvas.addEventListener('pointermove', function (e) {
    var img = curImg(); if (!img) return; var b = canvas.getBoundingClientRect(); hover = { x: e.clientX - b.left, y: e.clientY - b.top };
    if (!drag) { if (S.pending && (S.tool === 'polygon' || S.tool === 'angle')) draw(); else if (S.tool !== 'pan' && S.tool !== 'wl') draw(); return; }
    if (drag.kind === 'pan') { view.px = drag.px + e.clientX - drag.x; view.py = drag.py + e.clientY - drag.y; draw(); return; }
    if (drag.kind === 'wl') { var r = Math.max(1, img.range.max - img.range.min); img.wl.w = Math.max(1, drag.w + (e.clientX - drag.x) * r / 400); img.wl.c = drag.c - (e.clientY - drag.y) * r / 400; draw(); return; }
    var p = toImg(e, img); p.x = Math.max(0, Math.min(img.w, p.x)); p.y = Math.max(0, Math.min(img.h, p.y));
    if (drag.kind === 'shape' && S.pending) { S.pending.points[1] = p; draw(); }
    if (drag.kind === 'bidir2' && S.pending) { S.pending.points[3] = p; draw(); }
  });
  canvas.addEventListener('pointerup', function () {
    var d = drag; drag = null; var img = curImg(); if (!d || !img) return;
    if (d.kind === 'wl') { scheduleRender(); return; }
    if (d.kind === 'pan') return;
    var a = S.pending; if (!a) return;
    var s = T(img).s, P = a.points;
    if (d.kind === 'shape') {
      if (!P[1] || Math.hypot((P[1].x - P[0].x) * s, (P[1].y - P[0].y) * s) < 4) { S.pending = null; draw(); return; }
      if (a.type === 'bidir') { announce('Long axis drawn. Now drag the short axis.'); toast('Bidirectional: now drag the short axis (perpendicular).'); draw(); return; }
      commit(a); return;
    }
    if (d.kind === 'bidir2') { if (Math.hypot((P[3].x - P[2].x) * s, (P[3].y - P[2].y) * s) < 3) P.splice(2, 2); commit(a); }
  });
  canvas.addEventListener('dblclick', function () { if (S.pending && S.pending.type === 'polygon' && S.pending.points.length >= 3) { S.pending.closed = true; commit(S.pending); } });
  canvas.addEventListener('pointerleave', function () { hover = null; draw(); });
  canvas.addEventListener('wheel', function (e) { if (!curImg()) return; e.preventDefault(); var f = e.deltaY < 0 ? 1.15 : 1 / 1.15, b = canvas.getBoundingClientRect(), mx = e.clientX - b.left - (el.clientWidth / 2), my = e.clientY - b.top - (el.clientHeight / 2); var nz = Math.max(0.2, Math.min(40, view.zoom * f)); f = nz / view.zoom; view.px = mx - (mx - view.px) * f; view.py = my - (my - view.py) * f; view.zoom = nz; draw(); }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    var img = curImg(); if (!img) return; var k = e.key, h2 = true;
    if (k === 'ArrowLeft') view.px += 30; else if (k === 'ArrowRight') view.px -= 30; else if (k === 'ArrowUp') view.py += 30; else if (k === 'ArrowDown') view.py -= 30;
    else if (k === '+' || k === '=') view.zoom = Math.min(40, view.zoom * 1.2); else if (k === '-' || k === '_') view.zoom = Math.max(0.2, view.zoom / 1.2);
    else if (k === 'PageDown') step(1); else if (k === 'PageUp') step(-1);
    else if (k === 'Escape') { S.pending = null; } else if (k === 'Enter' && S.pending && S.pending.type === 'polygon' && S.pending.points.length >= 3) { S.pending.closed = true; commit(S.pending); }
    else if ((k === 'Delete' || k === 'Backspace') && S.selected) { removeAnn(S.selected); } else h2 = false;
    if (h2) { e.preventDefault(); e.stopPropagation(); draw(); }
  });
  if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(el);
  function step(dir) {
    var img = curImg(); if (!img) return;
    if (img.frames.length > 1) { S.frame = Math.max(0, Math.min(img.frames.length - 1, S.frame + dir)); scheduleRender(); return; }
    var se = seriesOf(img); if (!se) return; var i = se.images.indexOf(img.id) + dir; if (i >= 0 && i < se.images.length) { S.current = se.images[i]; S.frame = 0; scheduleRender(); }
  }
  function reset() { view = { zoom: 1, px: 0, py: 0 }; var img = curImg(); if (img && img.kind === 'gray') img.wl = { c: img.wl0.c, w: img.wl0.w }; draw(); }
  function renderToCanvas(img, withOverlays) {
    var c = document.createElement('canvas'); c.width = img.w; c.height = img.h; var g = c.getContext('2d'); g.drawImage(display(img), 0, 0);
    if (withOverlays) { var saved = view, sizeEl = { clientWidth: img.w, clientHeight: img.h }; var t = { s: 1, ox: 0, oy: 0 };
      if (S.layers.ai) aiVisible().filter(function (r) { return r.imageId === img.id && (r.frame || 0) === S.frame; }).forEach(function (r) { g.strokeStyle = '#E879F9'; g.lineWidth = Math.max(2, img.w / 400); g.setLineDash([6, 4]); if (r.mask) g.drawImage(maskCanvas(r.mask, r.color || [232, 121, 249], r.type === 'heatmap'), 0, 0, img.w, img.h); if (r.box) g.strokeRect(r.box[0], r.box[1], r.box[2] - r.box[0], r.box[3] - r.box[1]); if (r.polygon) { shapePath(g, { type: 'aipoly', points: r.polygon }, t); g.stroke(); } });
      if (S.layers.ann) S.annotations.filter(function (a) { return a.imageId === img.id && (a.frame || 0) === S.frame; }).forEach(function (a) { g.setLineDash([]); g.strokeStyle = '#2DD4BF'; g.lineWidth = Math.max(2, img.w / 400); if (a.type === 'mask') g.drawImage(maskCanvas(a.mask, [45, 212, 191], false), 0, 0, img.w, img.h); else { shapePath(g, a, t); g.stroke(); } });
      view = saved; void sizeEl; }
    return c;
  }
  return { el: el, canvas: canvas, draw: draw, reset: reset, step: step, measure: measure, fmtMeasure: fmtMeasure, display: display, renderToCanvas: renderToCanvas, clearCache: function () { cache.key = null; cache.canvas.width = cache.canvas.height = 0; maskCache.clear(); }, view: function () { return view; } };
})();
function removeAnn(id) { S.annotations = S.annotations.filter(function (a) { return a.id !== id; }); if (S.selected === id) S.selected = null; scheduleRender(); }
function aiVisible() { return S.ai.results.filter(function (r) { return !r.rejected && !r.accepted && (r.score == null || r.score >= S.ai.threshold); }); }
