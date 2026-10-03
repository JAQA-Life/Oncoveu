
/* ====================================================================
   OVERVIEW: GEOGRAPHIC ACTIVITY GLOBE
   --------------------------------------------------------------------
   Location schema (memory only; rebuilt from in-memory public records):
   GlobeLocation { id, kind, label, facility, city, state, country, countryCode,
     lat, lon, precision: site | state-centroid | country-centroid,
     count, status, recordType, recordId, recordKey, source, sourceName, url,
     category: 'globe-public-location-record' }
   Cluster { id, lat, lon, items[], kinds{}, count, label, category: 'globe-derived-cluster' }
   Allowed inputs: ClinicalTrials.gov site/country fields, openFDA recall /
   enforcement city/state/country, OpenAlex institution country codes (user-
   triggered). Never: patient addresses, participant locations, device
   geolocation, or anything derived from uploaded images.
   Rendering: a CesiumJS-based globe when self-hosted assets exist under
   CONFIG.globeAssetBase (credits container hidden; legal attribution in
   Session & Privacy > Technical credits), otherwise a built-in Canvas
   orthographic globe. No camera state is ever stored.
   ==================================================================== */
var US_STATES = { AL: ['Alabama', 32.8, -86.8], AK: ['Alaska', 64.7, -152.0], AZ: ['Arizona', 34.3, -111.7], AR: ['Arkansas', 34.9, -92.4], CA: ['California', 37.2, -119.4], CO: ['Colorado', 39.0, -105.5], CT: ['Connecticut', 41.6, -72.7], DE: ['Delaware', 39.0, -75.5], DC: ['District of Columbia', 38.9, -77.0],
  FL: ['Florida', 28.6, -82.4], GA: ['Georgia', 32.7, -83.4], HI: ['Hawaii', 20.8, -156.3], ID: ['Idaho', 44.4, -114.6], IL: ['Illinois', 40.0, -89.2], IN: ['Indiana', 39.9, -86.3], IA: ['Iowa', 42.1, -93.5], KS: ['Kansas', 38.5, -98.4], KY: ['Kentucky', 37.5, -85.3], LA: ['Louisiana', 31.1, -92.0],
  ME: ['Maine', 45.4, -69.2], MD: ['Maryland', 39.0, -76.8], MA: ['Massachusetts', 42.3, -71.8], MI: ['Michigan', 44.3, -85.4], MN: ['Minnesota', 46.3, -94.3], MS: ['Mississippi', 32.7, -89.7], MO: ['Missouri', 38.4, -92.5], MT: ['Montana', 47.0, -109.6], NE: ['Nebraska', 41.5, -99.8],
  NV: ['Nevada', 39.3, -116.6], NH: ['New Hampshire', 43.7, -71.6], NJ: ['New Jersey', 40.2, -74.7], NM: ['New Mexico', 34.4, -106.1], NY: ['New York', 42.9, -75.5], NC: ['North Carolina', 35.6, -79.4], ND: ['North Dakota', 47.5, -100.5], OH: ['Ohio', 40.3, -82.8], OK: ['Oklahoma', 35.6, -97.5],
  OR: ['Oregon', 43.9, -120.6], PA: ['Pennsylvania', 40.9, -77.8], RI: ['Rhode Island', 41.7, -71.5], SC: ['South Carolina', 33.9, -80.9], SD: ['South Dakota', 44.4, -100.2], TN: ['Tennessee', 35.9, -86.4], TX: ['Texas', 31.5, -99.3], UT: ['Utah', 39.3, -111.7], VT: ['Vermont', 44.1, -72.7],
  VA: ['Virginia', 37.5, -78.9], WA: ['Washington', 47.4, -120.5], WV: ['West Virginia', 38.6, -80.6], WI: ['Wisconsin', 44.6, -89.9], WY: ['Wyoming', 43.0, -107.6], PR: ['Puerto Rico', 18.2, -66.5] };
var US_STATE_BY_NAME = {}; Object.keys(US_STATES).forEach(function (k) { US_STATE_BY_NAME[US_STATES[k][0].toLowerCase()] = k; });
var COUNTRY_INDEX = (function () {
  var byName = {}, byCode = {};
  GEO_COUNTRIES.forEach(function (c) { var rec = { code: c[0], lat: c[1], lon: c[2], name: c[3].split('|')[0] }; if (c[0]) byCode[c[0]] = rec; c[3].split('|').forEach(function (n) { byName[n.toLowerCase()] = rec; }); });
  // Registry spellings used by ClinicalTrials.gov / openFDA.
  [['united states', 'US'], ['usa', 'US'], ['us', 'US'], ['korea, republic of', 'KR'], ['republic of korea', 'KR'], ['korea, democratic people\'s republic of', 'KP'], ['russian federation', 'RU'], ['iran, islamic republic of', 'IR'], ['taiwan', 'TW'], ['viet nam', 'VN'], ['czechia', 'CZ'], ['czech republic', 'CZ'],
   ['turkey', 'TR'], ['türkiye', 'TR'], ['moldova, republic of', 'MD'], ['macedonia, the former yugoslav republic of', 'MK'], ['north macedonia', 'MK'], ['syrian arab republic', 'SY'], ['tanzania', 'TZ'], ['united republic of tanzania', 'TZ'], ['lao people\'s democratic republic', 'LA'],
   ['congo, the democratic republic of the', 'CD'], ['côte d\'ivoire', 'CI'], ['cote d\'ivoire', 'CI'], ['hong kong', 'HK'], ['macao', 'MO'], ['puerto rico', 'PR'], ['united kingdom', 'GB'], ['england', 'GB'], ['scotland', 'GB'], ['wales', 'GB'], ['bolivia', 'BO'], ['venezuela', 'VE'], ['palestinian territory, occupied', 'PS'], ['brunei darussalam', 'BN']]
    .forEach(function (x) { var r = byCode[x[1]]; if (r) byName[x[0]] = r; });
  return { name: function (n) { return n ? byName[String(n).trim().toLowerCase()] || null : null; }, code: function (c) { return c ? byCode[String(c).trim().toUpperCase()] || null : null; } };
})();
var GLOBE_KINDS = {
  'trial-site': { label: 'Trial sites', color: '#14B8A6', shape: 'circle', src: 'ClinicalTrials.gov' },
  'trial-country': { label: 'Trial countries (centroid)', color: '#2DD4BF', shape: 'ring', src: 'ClinicalTrials.gov' },
  'vaccine-trial': { label: 'Vaccine studies', color: '#818CF8', shape: 'hex', src: 'ClinicalTrials.gov' },
  recall: { label: 'Device recalls / enforcement', color: '#FB7185', shape: 'triangle', src: 'openFDA device' },
  enforcement: { label: 'Drug enforcement / recalls', color: '#F59E0B', shape: 'triangle', src: 'openFDA drug' },
  'device-record': { label: 'Device records', color: '#C084FC', shape: 'square', src: 'openFDA device' },
  literature: { label: 'Literature institutions (country)', color: '#FDBA74', shape: 'diamond', src: 'OpenAlex' },
  cohort: { label: 'Public cohort projects', color: '#93C5FD', shape: 'ring', src: 'NCI GDC' }
};
var GlobeState = { hidden: new Set(), view: 'globe', imagery: false, engine: null, filter: null, popup: null, loadingCesium: false, cesiumFailed: null };
function resetGlobeState() { if (Globe.destroy) Globe.destroy(); GlobeState = { hidden: new Set(), view: 'globe', imagery: false, engine: null, filter: null, popup: null, loadingCesium: false, cesiumFailed: GlobeState.cesiumFailed }; }

function placeOf(city, state, country) {
  var c = COUNTRY_INDEX.name(country) || COUNTRY_INDEX.code(country);
  var isUS = c && c.code === 'US';
  if (isUS || (!c && state && (US_STATES[String(state).toUpperCase()] || US_STATE_BY_NAME[String(state).toLowerCase()]))) {
    var sk = US_STATES[String(state || '').toUpperCase()] ? String(state).toUpperCase() : US_STATE_BY_NAME[String(state || '').toLowerCase()];
    if (sk) return { lat: US_STATES[sk][1], lon: US_STATES[sk][2], precision: 'state-centroid', countryCode: 'US', country: 'United States', state: US_STATES[sk][0] };
  }
  if (c) return { lat: c.lat, lon: c.lon, precision: 'country-centroid', countryCode: c.code, country: c.name };
  return null;
}
// Build locations from in-memory records. Pure function of State.records.
function globeLocations() {
  var out = [], vaxCtx = State.ctx && State.ctx.type === 'vaccine';
  State.records.forEach(function (r) {
    var d = r.data || {};
    if (r.type === 'trial') {
      var kind = vaxCtx || /vaccin/i.test(arr(d.interventions).map(function (i) { return i.name + ' ' + i.type; }).join(' ')) ? 'vaccine-trial' : 'trial-site';
      var sites = arr(d.sites).length ? arr(d.sites) : arr(get(d, 'full.protocolSection.contactsLocationsModule.locations')).map(function (l) { var gp = l.geoPoint || {}; return { facility: l.facility, city: l.city, state: l.state, country: l.country, status: l.status, lat: typeof gp.lat === 'number' ? gp.lat : null, lon: typeof gp.lon === 'number' ? gp.lon : null }; });
      if (sites.length) {
        sites.forEach(function (s, i) {
          var pl = s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon, precision: 'site', country: s.country, countryCode: (COUNTRY_INDEX.name(s.country) || {}).code || null, state: s.state } : placeOf(s.city, s.state, s.country);
          if (!pl) return;
          out.push({ id: r.key + ':s' + i, kind: kind, facility: s.facility || null, city: s.city || null, state: s.state || pl.state || null, country: s.country || pl.country, countryCode: pl.countryCode, lat: pl.lat, lon: pl.lon, precision: pl.precision, count: 1, status: s.status ? humanEnum(s.status) : (d.status ? humanEnum(d.status) + ' (overall)' : null),
            recordType: 'Clinical trial site', recordId: d.nct, recordKey: r.key, source: 'ctgov', sourceName: 'ClinicalTrials.gov', url: LINK.ctStudy(d.nct), label: [s.facility, s.city, s.state, s.country].filter(Boolean).join(', ') });
        });
      } else arr(d.countries).forEach(function (cn, i) {
        var pl = placeOf(null, null, cn); if (!pl) return;
        out.push({ id: r.key + ':c' + i, kind: kind === 'vaccine-trial' ? 'vaccine-trial' : 'trial-country', country: pl.country, countryCode: pl.countryCode, lat: pl.lat, lon: pl.lon, precision: pl.precision, count: 1, status: d.status ? humanEnum(d.status) + ' (overall)' : null,
          recordType: 'Clinical trial (country listed)', recordId: d.nct, recordKey: r.key, source: 'ctgov', sourceName: 'ClinicalTrials.gov', url: LINK.ctStudy(d.nct), label: pl.country });
      });
    }
    if (r.type === 'device-recall' || r.type === 'drug-enforcement' || r.type === 'recall' || r.type === 'enforcement') {
      var pl2 = placeOf(d.city, d.state, d.country); if (!pl2) return;
      var k2 = r.source === 'openfda-drug' ? 'enforcement' : 'recall';
      out.push({ id: r.key + ':r', kind: k2, city: d.city || null, state: d.state || pl2.state || null, country: d.country || pl2.country, countryCode: pl2.countryCode, lat: pl2.lat, lon: pl2.lon, precision: pl2.precision, count: 1, status: d.status || d.classification || null,
        recordType: k2 === 'recall' ? 'Device recall / enforcement (recalling firm location)' : 'Drug enforcement (recalling firm location)', recordId: d.recallNumber || d.number || null, recordKey: r.key, source: r.source, sourceName: SRC[r.source] ? SRC[r.source].displayName : r.source, url: r.prov && r.prov.url, label: [d.city, d.state, d.country].filter(Boolean).join(', ') });
    }
  });
  var inst = slot('lit:institutions');
  if (inst.status === 'ok') {
    var byC = new Map();
    inst.data.items.forEach(function (w) { uniq(w.institutions.map(function (i) { return i.country; }).filter(Boolean)).forEach(function (cc) { if (!byC.has(cc)) byC.set(cc, []); byC.get(cc).push(w); }); });
    byC.forEach(function (works, cc) { var c = COUNTRY_INDEX.code(cc); if (!c) return; out.push({ id: 'oa:' + cc, kind: 'literature', country: c.name, countryCode: cc, lat: c.lat, lon: c.lon, precision: 'country-centroid', count: works.length, status: null, recordType: 'Papers with ≥1 author institution in this country (aggregate)', recordId: null, recordKey: null, source: 'openalex', sourceName: 'OpenAlex', url: linkout('openalex', ''), label: c.name }); });
  }
  out.forEach(function (x) { x.category = 'globe-public-location-record'; x.label = x.label || x.country || 'Location'; });
  return out;
}
function locFiltered(locs) { return locs.filter(function (l) { return !GlobeState.hidden.has(l.kind); }); }
// Simple greedy clustering in degrees (used for list/table + Canvas renderer at default zoom).
function clusterLocations(locs, cellDeg) {
  var cells = new Map();
  locs.forEach(function (l) {
    var k = Math.round(l.lat / cellDeg) + ':' + Math.round(l.lon / cellDeg);
    if (!cells.has(k)) cells.set(k, { id: 'cl' + k, items: [], latS: 0, lonS: 0 });
    var c = cells.get(k); c.items.push(l); c.latS += l.lat; c.lonS += l.lon;
  });
  return Array.from(cells.values()).map(function (c) {
    var kinds = {}; c.items.forEach(function (x) { kinds[x.kind] = (kinds[x.kind] || 0) + x.count; });
    var n = c.items.reduce(function (a, x) { return a + x.count; }, 0);
    var places = countBy(c.items, function (x) { return x.precision === 'site' ? [x.city, x.country].filter(Boolean).join(', ') : x.label; });
    return { id: c.id, lat: c.latS / c.items.length, lon: c.lonS / c.items.length, items: c.items, kinds: kinds, count: n, label: places.slice(0, 2).map(function (p) { return p[0]; }).join(' · ') + (places.length > 2 ? ' +' + (places.length - 2) : ''), category: 'globe-derived-cluster' };
  }).sort(function (a, b) { return b.count - a.count; });
}

/* ---------------- Built-in Canvas renderer ---------------- */
var LAND_RINGS = null;
function landRings() {
  if (LAND_RINGS) return LAND_RINGS;
  LAND_RINGS = GEO_LAND.map(function (s) { var a = s.split(',').map(Number), out = [], x = a[0], y = a[1]; out.push([x / 10, y / 10]); for (var i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out.push([x / 10, y / 10]); } return out; });
  return LAND_RINGS;
}
var D2R = Math.PI / 180;
function CanvasGlobe() {
  var self = this;
  this.el = document.createElement('div'); this.el.className = 'ow-globe-stage';
  this.canvas = document.createElement('canvas'); this.canvas.className = 'ow-globe-canvas';
  this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('tabindex', '0');
  this.canvas.setAttribute('aria-label', '3D globe of public location records. Use arrow keys to rotate, plus and minus to zoom. An accessible list of every location follows.');
  this.el.appendChild(this.canvas);
  this.rot = { lon: -20, lat: 20 }; this.zoom = 1; this.clusters = []; this.hit = []; this.dark = true; this.anim = null;
  var drag = null;
  this.canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, lon: self.rot.lon, lat: self.rot.lat, moved: false }; try { self.canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
  this.canvas.addEventListener('pointermove', function (e) {
    if (!drag) { self.hover(e); return; }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    self.dragging = true; var k = 0.35 / self.zoom; self.rot.lon = drag.lon - dx * k; self.rot.lat = Math.max(-85, Math.min(85, drag.lat + dy * k)); self.stop(); self.draw();
  });
  this.canvas.addEventListener('pointerup', function (e) { var d = drag; drag = null; self.dragging = false; if (d && !d.moved) self.click(e); else self.draw(); });
  this.canvas.addEventListener('pointerleave', function () { self.canvas.style.cursor = ''; });
  this.canvas.addEventListener('wheel', function (e) { e.preventDefault(); self.zoom = Math.max(0.8, Math.min(8, self.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); self.draw(); }, { passive: false });
  this.canvas.addEventListener('keydown', function (e) {
    var step = 8 / self.zoom, handled = true;
    if (e.key === 'ArrowLeft') self.rot.lon += step; else if (e.key === 'ArrowRight') self.rot.lon -= step;
    else if (e.key === 'ArrowUp') self.rot.lat = Math.min(85, self.rot.lat + step); else if (e.key === 'ArrowDown') self.rot.lat = Math.max(-85, self.rot.lat - step);
    else if (e.key === '+' || e.key === '=') self.zoom = Math.min(8, self.zoom * 1.25); else if (e.key === '-' || e.key === '_') self.zoom = Math.max(0.8, self.zoom / 1.25);
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); self.stop(); self.draw(); }
  });
  if (window.ResizeObserver) { this.ro = new ResizeObserver(function () { self.draw(); }); this.ro.observe(this.el); }
}
CanvasGlobe.prototype.kind = 'builtin';
CanvasGlobe.prototype.stop = function () { if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; } };
CanvasGlobe.prototype.flyTo = function (lat, lon, zoom) {
  var self = this, from = { lat: this.rot.lat, lon: this.rot.lon, z: this.zoom }, to = { lat: Math.max(-80, Math.min(80, lat)), lon: lon, z: zoom || this.zoom };
  var dl = ((to.lon - from.lon + 540) % 360) - 180;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.stop();
  if (reduce) { this.rot = { lat: to.lat, lon: from.lon + dl }; this.zoom = to.z; this.draw(); return; }
  var t0 = performance.now();
  var step = function (t) { var k = Math.min(1, (t - t0) / 700), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; self.rot.lat = from.lat + (to.lat - from.lat) * e; self.rot.lon = from.lon + dl * e; self.zoom = from.z + (to.z - from.z) * e; self.draw(); if (k < 1) self.anim = requestAnimationFrame(step); else self.anim = null; };
  this.anim = requestAnimationFrame(step);
};
CanvasGlobe.prototype.project = function (lat, lon, cx, cy, R) {
  var l0 = this.rot.lon * D2R, p0 = this.rot.lat * D2R, la = lat * D2R, lo = lon * D2R;
  var cosc = Math.sin(p0) * Math.sin(la) + Math.cos(p0) * Math.cos(la) * Math.cos(lo - l0);
  var x = R * Math.cos(la) * Math.sin(lo - l0), y = R * (Math.cos(p0) * Math.sin(la) - Math.sin(p0) * Math.cos(la) * Math.cos(lo - l0));
  return { x: cx + x, y: cy - y, vis: cosc >= 0, z: cosc };
};
CanvasGlobe.prototype.setData = function (locs) {
  this.locs = locs; this.draw();
};
CanvasGlobe.prototype.draw = function () {
  var c = this.canvas, w = this.el.clientWidth || 600, h = this.el.clientHeight || 380;
  if (!w || !h) return;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
  var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44 * this.zoom, self = this;
  var dark = this.dark;
  // Atmosphere glow + ocean
  var glow = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.12); glow.addColorStop(0, dark ? 'rgba(20,184,166,0.22)' : 'rgba(20,184,166,0.18)'); glow.addColorStop(1, 'rgba(20,184,166,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, 2 * Math.PI); g.fill();
  var ocean = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  ocean.addColorStop(0, dark ? '#1A3A63' : '#D9EEF5'); ocean.addColorStop(1, dark ? '#0B2545' : '#A9CFE0');
  g.fillStyle = ocean; g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.fill();
  this.drawRaster(g, cx, cy, R, w, h, dark);
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.clip();
  // Graticule
  g.strokeStyle = dark ? 'rgba(148,197,230,0.13)' : 'rgba(11,37,69,0.12)'; g.lineWidth = 0.7;
  var line = function (pts) { var on = false; g.beginPath(); pts.forEach(function (p) { var q = self.project(p[0], p[1], cx, cy, R); if (q.vis) { if (!on) { g.moveTo(q.x, q.y); on = true; } else g.lineTo(q.x, q.y); } else on = false; }); g.stroke(); };
  for (var la = -60; la <= 60; la += 30) { var p1 = []; for (var lo = -180; lo <= 180; lo += 4) p1.push([la, lo]); line(p1); }
  for (var lo2 = -180; lo2 < 180; lo2 += 30) { var p2 = []; for (var la2 = -88; la2 <= 88; la2 += 4) p2.push([la2, lo2]); line(p2); }
  g.restore();
  // Rim
  g.strokeStyle = dark ? 'rgba(45,212,191,0.6)' : 'rgba(11,37,69,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.stroke();
  // Markers: screen-space clustering
  var pts = []; arr(this.locs).forEach(function (l) { var q = self.project(l.lat, l.lon, cx, cy, R); if (q.vis) pts.push({ l: l, x: q.x, y: q.y, z: q.z }); });
  var clusters = []; var PX = 16;
  pts.sort(function (a, b) { return b.l.count - a.l.count; }).forEach(function (p) {
    var hitC = null; for (var i = 0; i < clusters.length; i++) { var cl = clusters[i]; if (Math.abs(cl.x - p.x) < PX && Math.abs(cl.y - p.y) < PX) { hitC = cl; break; } }
    if (hitC) { hitC.items.push(p.l); hitC.n += p.l.count; } else clusters.push({ x: p.x, y: p.y, z: p.z, items: [p.l], n: p.l.count });
  });
  this.hit = [];
  clusters.forEach(function (cl) {
    var kinds = countBy(cl.items, function (x) { return x.kind; }), main = kinds[0][0], K = GLOBE_KINDS[main] || GLOBE_KINDS['trial-site'];
    var r = Math.min(15, 4 + Math.sqrt(cl.n) * 1.6), a = 0.55 + 0.45 * cl.z;
    g.globalAlpha = a; drawShape(g, K.shape, cl.x, cl.y, r, K.color, dark);
    if (cl.n > 1) { g.fillStyle = dark ? '#0B2545' : '#ffffff'; g.font = '600 ' + (r > 9 ? 10 : 9) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cl.n > 99 ? '99+' : String(cl.n), cl.x, cl.y + 0.5); }
    g.globalAlpha = 1;
    self.hit.push({ x: cl.x, y: cl.y, r: Math.max(r, 9), items: cl.items });
  });
};
function drawShape(g, shape, x, y, r, color, dark) {
  g.fillStyle = color; g.strokeStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(11,37,69,0.9)'; g.lineWidth = 1.4;
  g.beginPath();
  if (shape === 'triangle') { g.moveTo(x, y - r); g.lineTo(x + r * 0.95, y + r * 0.75); g.lineTo(x - r * 0.95, y + r * 0.75); g.closePath(); }
  else if (shape === 'square') g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  else if (shape === 'diamond') { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  else if (shape === 'hex') { for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; if (i) g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); else g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
  else g.arc(x, y, r, 0, 2 * Math.PI);
  if (shape === 'ring') { g.lineWidth = 3; g.strokeStyle = color; g.stroke(); return; }
  g.fill(); g.stroke();
}
// Equirectangular land mask (built once from Natural Earth outlines) sampled per pixel with an
// inverse orthographic projection: correct at any rotation, no horizon clipping artifacts.
var LAND_MASK = null;
function landMask() {
  if (LAND_MASK) return LAND_MASK;
  var W = 1440, Hm = 720, c = document.createElement('canvas'); c.width = W; c.height = Hm;
  var g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, Hm); g.fillStyle = '#fff';
  landRings().forEach(function (ring) {
    // Unwrap longitudes across the antimeridian; close rings that circle a pole (e.g. Antarctica).
    var pts = [], off = 0;
    ring.forEach(function (p, i) { if (i) { var d = p[0] + off - pts[i - 1][0]; if (d > 180) off -= 360; else if (d < -180) off += 360; } pts.push([p[0] + off, p[1]]); });
    var span = pts[pts.length - 1][0] - pts[0][0];
    if (Math.abs(span) > 300) { var pole = pts.reduce(function (a, q) { return a + q[1]; }, 0) < 0 ? -90 : 90; pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole]); }
    [-360, 0, 360].forEach(function (shift) { g.beginPath(); pts.forEach(function (p, i) { var x = (p[0] + shift + 180) / 360 * W, y = (90 - p[1]) / 180 * Hm; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.fill('nonzero'); });
  });
  var d = g.getImageData(0, 0, W, Hm).data, m = new Uint8Array(W * Hm);
  for (var i = 0; i < m.length; i++) m[i] = d[i * 4];
  LAND_MASK = { w: W, h: Hm, m: m }; return LAND_MASK;
}
CanvasGlobe.prototype.drawRaster = function (g, cx, cy, R, w, h, dark) {
  var M = landMask(), scale = this.anim || this.dragging ? 0.5 : 1;
  var size = Math.ceil(2 * R * scale); if (size < 4) return;
  if (!this.buf || this.buf.width !== size) { this.buf = document.createElement('canvas'); this.buf.width = size; this.buf.height = size; this.bctx = this.buf.getContext('2d'); this.img = this.bctx.createImageData(size, size); }
  var px = this.img.data, half = size / 2, phi0 = this.rot.lat * D2R, lam0 = this.rot.lon * D2R, sp = Math.sin(phi0), cp = Math.cos(phi0);
  var land = dark ? [45, 196, 176] : [20, 132, 120], sea = dark ? [16, 44, 82] : [174, 214, 230], light = 0;
  for (var j = 0; j < size; j++) {
    var y = (half - j - 0.5) / half;
    for (var i = 0; i < size; i++) {
      var x = (i + 0.5 - half) / half, rho2 = x * x + y * y, k = (j * size + i) * 4;
      if (rho2 > 1) { px[k + 3] = 0; continue; }
      var rho = Math.sqrt(rho2), cz = Math.sqrt(1 - rho2), lat, lon;
      if (rho < 1e-9) { lat = phi0; lon = lam0; } else { lat = Math.asin(cz * sp + y * cp); lon = lam0 + Math.atan2(x, cz * cp - y * sp); }
      var u = ((lon / D2R + 540) % 360) / 360 * M.w | 0, v = (90 - lat / D2R) / 180 * M.h | 0;
      var isLand = M.m[(v < 0 ? 0 : v >= M.h ? M.h - 1 : v) * M.w + (u >= M.w ? M.w - 1 : u)] > 127;
      // Soft lighting from the upper left; limb darkening for depth.
      light = 0.62 + 0.38 * Math.max(0, cz * 0.78 + (-x * 0.35 + y * 0.45) * 0.6);
      var col = isLand ? land : sea, a = isLand ? 255 : 0;
      px[k] = col[0] * light; px[k + 1] = col[1] * light; px[k + 2] = col[2] * light; px[k + 3] = a;
    }
  }
  this.bctx.putImageData(this.img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(this.buf, cx - R, cy - R, 2 * R, 2 * R); g.restore();
};
CanvasGlobe.prototype.pick = function (e) {
  var b = this.canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, best = null, bd = 1e9;
  this.hit.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y); if (d <= h.r + 3 && d < bd) { bd = d; best = h; } });
  return best;
};
CanvasGlobe.prototype.hover = function (e) { this.canvas.style.cursor = this.pick(e) ? 'pointer' : 'grab'; };
CanvasGlobe.prototype.click = function (e) { var h = this.pick(e); if (h) Globe.openPopup(h.items); };
CanvasGlobe.prototype.reset = function () { var b = boundsCenter(this.locs); this.flyTo(Math.max(-35, Math.min(40, b.lat)), b.lon, 1); };
CanvasGlobe.prototype.destroy = function () { this.stop(); if (this.ro) this.ro.disconnect(); };
function boundsCenter(locs) {
  locs = arr(locs); if (!locs.length) return { lat: 20, lon: -20 };
  var x = 0, y = 0, z = 0; locs.forEach(function (l) { var la = l.lat * D2R, lo = l.lon * D2R; x += Math.cos(la) * Math.cos(lo) * l.count; y += Math.cos(la) * Math.sin(lo) * l.count; z += Math.sin(la) * l.count; });
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / D2R, lon: Math.atan2(y, x) / D2R };
}

/* ---------------- CesiumJS adapter (self-hosted, unbranded) ---------------- */
function CesiumGlobe(Cesium) {
  this.C = Cesium; var self = this;
  this.el = document.createElement('div'); this.el.className = 'ow-globe-stage ow-globe-cesium';
  var credits = document.createElement('div'); credits.className = 'ow-globe-credits-hidden'; credits.setAttribute('aria-hidden', 'true');
  this.el.appendChild(credits);
  var host = document.createElement('div'); host.className = 'ow-globe-cesium-host'; this.el.appendChild(host);
  try { Cesium.Ion.defaultAccessToken = ''; } catch (e) { /* ignore */ }
  var base = Cesium.ImageryLayer.fromProviderAsync(Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')));
  this.viewer = new Cesium.Viewer(host, {
    baseLayer: base, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false,
    fullscreenButton: false, infoBox: false, selectionIndicator: false, creditContainer: credits, terrainProvider: new Cesium.EllipsoidTerrainProvider(), requestRenderMode: true, maximumRenderTimeChange: Infinity, skyBox: false, contextOptions: { webgl: { preserveDrawingBuffer: false } }
  });
  var sc = this.viewer.scene; sc.globe.enableLighting = false; sc.backgroundColor = Cesium.Color.fromCssColorString('#071A33'); sc.fog.enabled = false;
  if (sc.skyAtmosphere) sc.skyAtmosphere.show = true; if (sc.sun) sc.sun.show = false; if (sc.moon) sc.moon.show = false;
  this.viewer.canvas.setAttribute('aria-label', '3D globe of public location records. An accessible list of every location follows.'); this.viewer.canvas.setAttribute('role', 'img');
  this.ds = new Cesium.CustomDataSource('oncotics-locations'); this.viewer.dataSources.add(this.ds);
  this.ds.clustering.enabled = true; this.ds.clustering.pixelRange = 26; this.ds.clustering.minimumClusterSize = 2;
  this.icons = {};
  this.ds.clustering.clusterEvent.addEventListener(function (ids, cluster) {
    var kinds = countBy(ids.map(function (e) { return e.ow; }).filter(Boolean), function (x) { return x.kind; });
    var n = ids.reduce(function (a, e) { return a + (e.ow ? e.ow.count : 1); }, 0);
    cluster.label.show = false; cluster.billboard.show = true; cluster.billboard.image = self.icon(kinds[0] ? kinds[0][0] : 'trial-site', n);
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER; cluster.billboard.id = { owItems: ids.map(function (e) { return e.ow; }).filter(Boolean) };
  });
  var handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
  handler.setInputAction(function (m) {
    var p = self.viewer.scene.pick(m.position); if (!p) return;
    var items = p.id && p.id.owItems ? p.id.owItems : (p.id && p.id.ow ? [p.id.ow] : null);
    if (items && items.length) Globe.openPopup(items);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  this.handler = handler;
}
CesiumGlobe.prototype.kind = 'cesium';
CesiumGlobe.prototype.icon = function (kind, n) {
  var key = kind + ':' + (n > 99 ? 99 : n); if (this.icons[key]) return this.icons[key];
  var K = GLOBE_KINDS[kind] || GLOBE_KINDS['trial-site'], r = Math.min(15, 5 + Math.sqrt(n) * 1.6), s = Math.ceil(r * 2 + 6), c = document.createElement('canvas'); c.width = s; c.height = s;
  var g = c.getContext('2d'); drawShape(g, K.shape, s / 2, s / 2, r, K.color, true);
  if (n > 1) { g.fillStyle = '#0B2545'; g.font = '600 10px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n > 99 ? '99+' : String(n), s / 2, s / 2 + 0.5); }
  this.icons[key] = c.toDataURL(); return this.icons[key];
};
CesiumGlobe.prototype.setData = function (locs) {
  var C = this.C, self = this; this.locs = locs; this.ds.entities.removeAll();
  locs.forEach(function (l) { var e = self.ds.entities.add({ position: C.Cartesian3.fromDegrees(l.lon, l.lat), billboard: { image: self.icon(l.kind, l.count), verticalOrigin: C.VerticalOrigin.CENTER } }); e.ow = l; });
  this.viewer.scene.requestRender();
};
CesiumGlobe.prototype.flyTo = function (lat, lon, zoom) { var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; this.viewer.camera.flyTo({ destination: this.C.Cartesian3.fromDegrees(lon, lat, 2.2e7 / (zoom || 1)), duration: reduce ? 0 : 1.2 }); };
CesiumGlobe.prototype.reset = function () { var b = boundsCenter(this.locs); this.flyTo(Math.max(-35, Math.min(40, b.lat)), b.lon, 1); };
CesiumGlobe.prototype.setImagery = function (on) {
  var C = this.C, layers = this.viewer.imageryLayers;
  if (on && !this.osm) { this.osm = layers.addImageryProvider(new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })); }
  if (!on && this.osm) { layers.remove(this.osm, true); this.osm = null; }
  this.viewer.scene.requestRender();
};
CesiumGlobe.prototype.draw = function () { try { this.viewer.resize(); this.viewer.scene.requestRender(); } catch (e) { /* ignore */ } };
CesiumGlobe.prototype.destroy = function () { try { this.handler.destroy(); this.viewer.destroy(); } catch (e) { /* ignore */ } };

/* ---------------- Globe controller ---------------- */
var Globe = {
  engine: null,
  ensure: function () {
    if (Globe.engine) return Globe.engine;
    Globe.engine = new CanvasGlobe();
    Globe.tryCesium();
    return Globe.engine;
  },
  tryCesium: function () {
    if (!CONFIG.features.globeCesium || GlobeState.loadingCesium || GlobeState.cesiumFailed || isNullOrigin()) return;
    if (!window.WebGLRenderingContext) { GlobeState.cesiumFailed = 'WebGL unavailable'; return; }
    GlobeState.loadingCesium = true;
    // Self-hosted assets only (same origin). If they are not deployed, the built-in renderer stays.
    window.CESIUM_BASE_URL = CONFIG.globeAssetBase;
    import(CONFIG.globeAssetBase + 'index.js').then(function (Cesium) {
      GlobeState.loadingCesium = false;
      if (!Cesium || !Cesium.Viewer) throw new Error('shape');
      var old = Globe.engine, cg = new CesiumGlobe(Cesium);
      Globe.engine = cg; if (old) { if (old.el.parentNode) old.el.parentNode.replaceChild(cg.el, old.el); old.destroy(); }
      Globe.sync(true); scheduleRender();
    }).catch(function () { GlobeState.loadingCesium = false; GlobeState.cesiumFailed = 'Self-hosted globe assets are not deployed on this host; using the built-in renderer.'; scheduleRender(); });
  },
  sig: '',
  sync: function (force) {
    var e = Globe.engine; if (!e) return;
    var locs = locFiltered(globeLocations()), s = locs.length + '|' + Array.from(GlobeState.hidden).join(',') + '|' + (locs[0] ? locs[0].id : '') + '|' + (locs.length ? locs[locs.length - 1].id : '');
    e.dark = ROOT.getAttribute('data-theme') === 'dark' || (ROOT.getAttribute('data-theme') !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (force || s !== Globe.sig) { var first2 = !Globe.sig; Globe.sig = s; e.setData(locs); if (first2 || force) e.reset(); } else e.draw();
  },
  attach: function () {
    var mount = $('#ow-globe-mount'); if (!mount) return;
    var e = Globe.ensure();
    if (e.el.parentNode !== mount) mount.appendChild(e.el);
    Globe.sync(false);
  },
  openPopup: function (items) { GlobeState.popup = items.slice(0, 200); renderLayers(); scheduleRender(); },
  destroy: function () { if (Globe.engine) { Globe.engine.destroy(); if (Globe.engine.el.parentNode) Globe.engine.el.parentNode.removeChild(Globe.engine.el); } Globe.engine = null; Globe.sig = ''; }
};
function globeKindBadge(k) { var K = GLOBE_KINDS[k] || { label: k, color: '#94A3B8', shape: 'circle' }; return H`<span class="ow-gk"><span class="ow-gk-sw ow-gk-${K.shape}" style="--gk:${K.color}" aria-hidden="true"></span>${K.label}</span>`; }
function globePanel() {
  var all = globeLocations(), locs = locFiltered(all), kinds = countBy(all, function (l) { return l.kind; });
  var trialsLoaded = arr(slot('trials:list').data && slot('trials:list').data.items);
  var hasSitesBtn = trialsLoaded.length && !trialsLoaded.some(function (r) { return arr(r.data.sites).length; });
  var engine = Globe.engine ? Globe.engine.kind : null;
  var head = H`<div class="ow-card-head"><div><div class="ow-card-title">${icon('globe')} Geographic Activity Globe</div><div class="ow-card-sub">Public, non-PHI location fields from records already loaded in memory.</div></div>
    <div class="ow-toolbar">${all.length ? H`<div class="ow-seg" role="group" aria-label="Globe view"><button type="button" aria-pressed="${GlobeState.view === 'globe' ? 'true' : 'false'}" data-act="globe-view" data-view="globe">${icon('globe')} Globe</button><button type="button" aria-pressed="${GlobeState.view === 'list' ? 'true' : 'false'}" data-act="globe-view" data-view="list">${icon('table')} List</button></div>
      <button type="button" class="ow-btn ow-btn-sm" data-act="globe-reset">${icon('refresh')}Reset view</button><button type="button" class="ow-btn ow-btn-sm" data-act="globe-export">${icon('download')}Export locations</button><button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="globe-clear">Clear globe</button>` : ''}</div></div>`;
  var privacy = H`<div class="ow-globe-privacy">${icon('shield')}<span><strong>Globe Privacy:</strong> Locations shown are derived only from public records in memory. Oncotics does not use your device location and does not store globe state.</span></div>`;
  if (!all.length) {
    return H`<div class="ow-card ow-globe-card">${head}<div class="ow-empty" style="margin-top:10px"><h3>No public non-PHI location records were found for this query.</h3><p>Trial site/country fields, FDA recall/enforcement firm locations and literature institution countries appear here when the sources return them.</p>
      <div class="ow-card-foot" style="justify-content:center">${hasSitesBtn ? '' : ''}${slot('trials:list').status === 'ok' ? '' : H`<button type="button" class="ow-btn ow-btn-sm" data-act="tab" data-mod="trials">${icon('trial')}Open Trials</button>`}${slot('lit:list').status === 'ok' && slot('lit:institutions').status === 'idle' ? autoAct('lit:institutions', 'lit-institutions', {}, [], 'literature institution countries (OpenAlex)') : ''}</div></div>${privacy}</div>`;
  }
  var clusters = clusterLocations(locs, 3);
  var listView = H`<div class="ow-table-wrap ow-globe-list"><table class="ow-table"><caption>Location clusters (${clusters.length}) — every globe marker has a row here</caption><thead><tr><th scope="col">Location</th><th scope="col">Record types</th><th scope="col">Count</th><th scope="col">Precision</th><th scope="col">Source</th><th scope="col">Actions</th></tr></thead><tbody>${clusters.slice(0, 150).map(function (c) {
    return H`<tr><td><strong>${c.label}</strong></td><td>${Object.keys(c.kinds).map(function (k) { return H`<div>${globeKindBadge(k)} · ${c.kinds[k]}</div>`; })}</td><td>${num(c.count)}</td><td>${uniq(c.items.map(function (x) { return x.precision; })).join(', ')}</td><td>${uniq(c.items.map(function (x) { return x.sourceName; })).join(', ')}</td>
      <td><button type="button" class="ow-btn ow-btn-sm" data-act="globe-cluster" data-id="${c.id}">Details</button><button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="globe-fly" data-lat="${c.lat.toFixed(3)}" data-lon="${c.lon.toFixed(3)}">Show on globe</button></td></tr>`;
  })}</tbody></table></div>`;
  var legend = H`<div class="ow-globe-legend" role="group" aria-label="Marker types">${kinds.map(function (k) { var on = !GlobeState.hidden.has(k[0]); return H`<label class="ow-check ow-globe-toggle"><input type="checkbox" data-change="globe-kind" value="${k[0]}" ${on ? raw('checked') : ''}>${globeKindBadge(k[0])} <span class="ow-subtle">(${num(k[1])})</span></label>`; })}</div>`;
  var engineNote = engine === 'cesium' ? 'High-fidelity 3D renderer (self-hosted)' : GlobeState.loadingCesium ? 'Loading high-fidelity renderer from this site…' : 'Built-in 3D renderer' + (GlobeState.cesiumFailed ? ' (high-fidelity renderer unavailable on this host)' : '');
  var imagery = CONFIG.features.globeExternalImagery ? H`<label class="ow-check"><input type="checkbox" data-change="globe-imagery" ${GlobeState.imagery ? raw('checked') : ''} ${engine === 'cesium' ? '' : raw('disabled')}>Optional external map imagery${engine === 'cesium' ? '' : ' (high-fidelity renderer only)'}</label>${GlobeState.imagery ? H`<div class="ow-notice ow-notice-warn" style="margin-top:6px">${icon('alert')}<div>${SAFETY.externalTiles} Imagery: ${CONFIG.globeExternalImagery.attribution}.</div></div>` : ''}` : '';
  return H`<div class="ow-card ow-globe-card">${head}
    ${legend}
    ${GlobeState.view === 'globe' ? H`<div class="ow-globe-wrap"><div id="ow-globe-mount" class="ow-globe-mount"></div><div class="ow-globe-hint">${engineNote} · drag to rotate · scroll or +/− to zoom · select a marker for details</div></div>` : listView}
    ${GlobeState.view === 'globe' ? det('globe-list', H`${icon('table')} Accessible location list (${clusters.length} clusters, ${num(locs.reduce(function (a, l) { return a + l.count; }, 0))} records)`, listView, false) : ''}
    <div class="ow-row" style="margin-top:8px">${hasSitesBtn && slot('trials:sites').status === 'idle' ? autoAct('trials:sites', 'trial-sites', {}, [], 'site-level trial locations (ClinicalTrials.gov)') : ''}${slot('lit:list').status === 'ok' && slot('lit:institutions').status === 'idle' ? autoAct('lit:institutions', 'lit-institutions', {}, [], 'literature institution countries (OpenAlex)') : ''}${slotView('trials:sites', { skeleton: false })}${slotView('lit:institutions', { skeleton: false })}${imagery}</div>
    ${GlobeState.filter ? H`<div class="ow-notice ow-notice-info" style="margin-top:8px">${icon('filter')}<div>In-memory filter active: <strong>${GlobeState.filter.label}</strong> (${GlobeState.filter.keys.length} records). Trials and recalls lists show matching records first. <button type="button" class="ow-linkbtn" data-act="globe-unfilter">Remove filter</button></div></div>` : ''}
    ${privacy}<p class="ow-subtle" style="margin-top:6px">${SAFETY.globe} Marker size reflects record count only and does not imply clinical importance. State- and country-level markers are placed at approximate centroids.</p></div>`;
}
function globePopupBody() {
  var items = GlobeState.popup || [];
  var groups = countBy(items, function (x) { return x.kind; });
  return H`<div class="ow-stack"><p class="ow-subtle">${num(items.length)} public location record${items.length === 1 ? '' : 's'} at this marker (memory only).</p>
    <div class="ow-row">${groups.map(function (g) { return H`${globeKindBadge(g[0])} · ${g[1]}`; })}</div>
    ${table([{ label: 'Location', render: function (x) { return H`<strong>${x.label}</strong>${x.precision !== 'site' ? H`<div class="ow-subtle">${x.precision === 'state-centroid' ? 'State centroid (approximate)' : 'Country centroid (approximate)'}</div>` : ''}`; } },
      { label: 'Record type', render: function (x) { return H`${globeKindBadge(x.kind)}<div class="ow-small">${x.recordType}</div>`; } }, { label: 'Count', render: function (x) { return num(x.count); } }, { label: 'Status', render: function (x) { return x.status || '—'; } },
      { label: 'Record', render: function (x) { return H`${x.recordKey ? H`<button type="button" class="ow-linkbtn" data-act="open-rec" data-key="${x.recordKey}">${x.recordId || 'Open record'}</button>` : (x.recordId || '—')} ${x.url ? ext(x.url, 'Official') : ''}`; } },
      { label: 'Provenance', render: function (x) { return H`<span class="ow-small">${x.sourceName} · globe-public-location-record</span>`; } }], items.slice(0, 80))}
    ${items.length > 80 ? H`<p class="ow-subtle">${items.length - 80} more in the list view.</p>` : ''}
    <div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm ow-btn-primary" data-act="globe-filter">${icon('filter')}Filter results to this location</button><button type="button" class="ow-btn ow-btn-sm" data-act="globe-pin">${icon('pin')}Add cluster to Session Board</button></div>
    <div class="ow-disclaimer">${SAFETY.globe}</div></div>`;
}
function globeExportRows() {
  var locs = globeLocations();
  return { rows: locs, cols: [{ label: 'Kind', key: 'kind' }, { label: 'Location', key: 'label' }, { label: 'Facility (public)', key: 'facility' }, { label: 'City', key: 'city' }, { label: 'State', key: 'state' }, { label: 'Country', key: 'country' }, { label: 'Country code', key: 'countryCode' }, { label: 'Latitude', key: 'lat' }, { label: 'Longitude', key: 'lon' }, { label: 'Precision', key: 'precision' }, { label: 'Count', key: 'count' }, { label: 'Status', key: 'status' }, { label: 'Record type', key: 'recordType' }, { label: 'Record ID', key: 'recordId' }, { label: 'Source', key: 'sourceName' }, { label: 'Official link', key: 'url' }, { label: 'Data category', key: 'category' }] };
}
