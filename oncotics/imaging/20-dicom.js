
/* ====================================================================
   DICOM: minimal Part-10 parser (memory only)
   Supported in the Oncotics Inspector: Implicit VR LE, Explicit VR LE,
   Explicit VR BE (uncompressed, 8/16-bit, MONOCHROME1/2, RGB, YBR_FULL),
   multi-frame, and JPEG Baseline (decoded by the browser, 8-bit display).
   Everything else is reported as "view in OHIF" and is not faked.
   Identity tags are separated into `identity`, hidden by default, and
   never exported.
   ==================================================================== */
var TS = { IMPLICIT_LE: '1.2.840.10008.1.2', EXPLICIT_LE: '1.2.840.10008.1.2.1', EXPLICIT_BE: '1.2.840.10008.1.2.2', DEFLATE: '1.2.840.10008.1.2.1.99', JPEG_BASELINE: '1.2.840.10008.1.2.4.50' };
var TS_NAMES = { '1.2.840.10008.1.2': 'Implicit VR Little Endian', '1.2.840.10008.1.2.1': 'Explicit VR Little Endian', '1.2.840.10008.1.2.2': 'Explicit VR Big Endian', '1.2.840.10008.1.2.1.99': 'Deflated Explicit VR LE', '1.2.840.10008.1.2.4.50': 'JPEG Baseline', '1.2.840.10008.1.2.4.51': 'JPEG Extended', '1.2.840.10008.1.2.4.57': 'JPEG Lossless', '1.2.840.10008.1.2.4.70': 'JPEG Lossless SV1', '1.2.840.10008.1.2.4.80': 'JPEG-LS Lossless', '1.2.840.10008.1.2.4.81': 'JPEG-LS Near-lossless', '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless', '1.2.840.10008.1.2.4.91': 'JPEG 2000', '1.2.840.10008.1.2.5': 'RLE Lossless', '1.2.840.10008.1.2.4.201': 'HTJ2K Lossless', '1.2.840.10008.1.2.4.203': 'HTJ2K' };
var LONG_VR = { OB: 1, OW: 1, OF: 1, SQ: 1, UT: 1, UN: 1, OD: 1, OL: 1, OV: 1, UC: 1, UR: 1, SV: 1, UV: 1 };
var T = {
  rows: '00280010', cols: '00280011', bitsAlloc: '00280100', bitsStored: '00280101', pixRep: '00280103', spp: '00280002', photo: '00280004', planar: '00280006', frames: '00280008',
  slope: '00281053', intercept: '00281052', wc: '00281050', ww: '00281051', spacing: '00280030', imagerSpacing: '00181164', thickness: '00180050', modality: '00080060', bodyPart: '00180015',
  study: '0020000D', series: '0020000E', seriesNo: '00200011', instNo: '00200013', sop: '00080016', manufacturer: '00080070', model: '00081090', burned: '00280301', rescaleType: '00281054', units: '00541001', pixel: '7FE00010'
};
var IMPLICIT_VR = {}; [[T.rows, 'US'], [T.cols, 'US'], [T.bitsAlloc, 'US'], [T.bitsStored, 'US'], [T.pixRep, 'US'], [T.spp, 'US'], [T.planar, 'US'], [T.frames, 'IS'], [T.slope, 'DS'], [T.intercept, 'DS'], [T.wc, 'DS'], [T.ww, 'DS'], [T.spacing, 'DS'], [T.imagerSpacing, 'DS'], [T.thickness, 'DS'], [T.photo, 'CS'], [T.modality, 'CS'], [T.bodyPart, 'CS'], [T.burned, 'CS'], [T.study, 'UI'], [T.series, 'UI'], [T.sop, 'UI'], [T.seriesNo, 'IS'], [T.instNo, 'IS'], [T.manufacturer, 'LO'], [T.model, 'LO'], [T.rescaleType, 'LO'], [T.units, 'CS'], [T.pixel, 'OW']].forEach(function (x) { IMPLICIT_VR[x[0]] = x[1]; });
// Identity / potentially identifying attributes: separated, hidden by default, never exported.
var IDENTITY_TAGS = { '00100010': 'Patient name', '00100020': 'Patient ID', '00100030': 'Birth date', '00100040': 'Sex', '00101010': 'Age', '00101000': 'Other patient IDs', '00101001': 'Other patient names', '00101040': 'Address', '00102154': 'Telephone', '00080020': 'Study date', '00080021': 'Series date', '00080022': 'Acquisition date', '00080023': 'Content date', '00080030': 'Study time',
  '00080050': 'Accession number', '00080080': 'Institution name', '00080081': 'Institution address', '00080090': 'Referring physician', '00081010': 'Station name', '00081030': 'Study description', '0008103E': 'Series description', '00081040': 'Department', '00081048': 'Physician of record', '00081050': 'Performing physician', '00081070': 'Operator', '00200010': 'Study ID', '00181000': 'Device serial number', '00181030': 'Protocol name', '00321032': 'Requesting physician', '00104000': 'Patient comments', '00204000': 'Image comments', '00380010': 'Admission ID' };
var TECH_LABELS = [[T.modality, 'Modality'], [T.bodyPart, 'Body part'], [T.rows, 'Rows'], [T.cols, 'Columns'], [T.frames, 'Frames'], [T.bitsAlloc, 'Bits allocated'], [T.bitsStored, 'Bits stored'], [T.pixRep, 'Pixel representation'], [T.spp, 'Samples per pixel'], [T.photo, 'Photometric interpretation'], [T.spacing, 'Pixel spacing (mm)'], [T.thickness, 'Slice thickness (mm)'], [T.slope, 'Rescale slope'], [T.intercept, 'Rescale intercept'], [T.rescaleType, 'Rescale type'], [T.wc, 'Window center'], [T.ww, 'Window width'], [T.manufacturer, 'Manufacturer'], [T.model, 'Model'], [T.burned, 'Burned-in annotation flag']];
function hex4(n) { return ('0000' + n.toString(16).toUpperCase()).slice(-4); }
function derr(kind, detail) { var e = new Error(kind); e.kind = kind; e.detail = detail || ''; return e; }
function DicomReader(buf) { this.buf = buf; this.dv = new DataView(buf); this.u8 = new Uint8Array(buf); this.len = buf.byteLength; }
DicomReader.prototype.element = function (off, explicit, little) {
  var dv = this.dv; if (off + 8 > this.len) return null;
  var g = dv.getUint16(off, little), e = dv.getUint16(off + 2, little), tag = hex4(g) + hex4(e), vr, len, hdr;
  if (g === 0xFFFE) { len = dv.getUint32(off + 4, little); return { tag: tag, vr: '', start: off + 8, len: len, next: off + 8 + (len === 0xFFFFFFFF ? 0 : len) }; }
  if (explicit) {
    vr = String.fromCharCode(this.u8[off + 4], this.u8[off + 5]);
    if (!/^[A-Z]{2}$/.test(vr)) throw derr('corrupt', 'Bad VR');
    if (LONG_VR[vr]) { if (off + 12 > this.len) throw derr('corrupt'); len = dv.getUint32(off + 8, little); hdr = 12; } else { len = dv.getUint16(off + 6, little); hdr = 8; }
  } else { vr = IMPLICIT_VR[tag] || 'UN'; len = dv.getUint32(off + 4, little); hdr = 8; }
  var start = off + hdr;
  if (len === 0xFFFFFFFF) { var end = this.skipUndefined(start, explicit, little); return { tag: tag, vr: vr === 'UN' ? 'SQ' : vr, start: start, len: -1, contentEnd: end.contentEnd, next: end.next, undefinedLength: true }; }
  if (start + len > this.len) throw derr('corrupt', 'Element exceeds file');
  return { tag: tag, vr: vr, start: start, len: len, next: start + len };
};
DicomReader.prototype.skipUndefined = function (p, explicit, little) {
  var dv = this.dv, guard = 0;
  while (p + 8 <= this.len && guard++ < 1e6) {
    var g = dv.getUint16(p, little), e = dv.getUint16(p + 2, little), l = dv.getUint32(p + 4, little);
    if (g === 0xFFFE && e === 0xE0DD) return { contentEnd: p, next: p + 8 };
    if (g === 0xFFFE && e === 0xE000) {
      if (l === 0xFFFFFFFF) {
        var q = p + 8;
        while (q + 8 <= this.len) { var g2 = dv.getUint16(q, little), e2 = dv.getUint16(q + 2, little); if (g2 === 0xFFFE && e2 === 0xE00D) { q += 8; break; } var el = this.element(q, explicit, little); if (!el) break; q = el.next; }
        p = q;
      } else p = p + 8 + l;
      continue;
    }
    throw derr('corrupt', 'Unexpected data inside a sequence');
  }
  return { contentEnd: p, next: this.len };
};
DicomReader.prototype.str = function (el) { if (!el || el.len <= 0) return ''; var s = ''; for (var i = el.start; i < el.start + el.len; i++) s += String.fromCharCode(this.u8[i]); return s.replace(/[\0\s]+$/, '').replace(/^\s+/, ''); };
DicomReader.prototype.us = function (el, little) { return el && el.len >= 2 ? this.dv.getUint16(el.start, little) : null; };
function parseDicom(buf) {
  var R = new DicomReader(buf);
  if (R.len < 136 || R.u8[128] !== 0x44 || R.u8[129] !== 0x49 || R.u8[130] !== 0x43 || R.u8[131] !== 0x4D) throw derr('not-dicom');
  var off = 132, meta = {};
  while (off + 8 <= R.len && R.dv.getUint16(off, true) === 0x0002) { var me = R.element(off, true, true); meta[me.tag] = me; off = me.next; }
  var ts = R.str(meta['00020010']) || TS.EXPLICIT_LE;
  if (ts === TS.DEFLATE) throw derr('unsupported-ts', ts);
  var explicit = ts !== TS.IMPLICIT_LE, little = ts !== TS.EXPLICIT_BE;
  var native = ts === TS.IMPLICIT_LE || ts === TS.EXPLICIT_LE || ts === TS.EXPLICIT_BE;
  var ds = {};
  while (off + 8 <= R.len) {
    var el = R.element(off, explicit, little); if (!el) break;
    if (el.tag.slice(0, 4) !== 'FFFE') ds[el.tag] = el;
    off = el.next;
    if (el.tag === T.pixel) break;
  }
  var g = function (t) { return ds[t]; }, s = function (t) { return R.str(ds[t]); }, us = function (t) { return R.us(ds[t], little); };
  var dsNum = function (t) { var v = s(t); if (!v) return null; var p = v.split('\\').map(parseFloat).filter(isFinite); return p.length ? p : null; };
  var info = {
    ts: ts, tsName: TS_NAMES[ts] || ts, native: native, little: little,
    rows: us(T.rows), cols: us(T.cols), bitsAlloc: us(T.bitsAlloc), bitsStored: us(T.bitsStored), pixRep: us(T.pixRep) || 0, spp: us(T.spp) || 1, planar: us(T.planar) || 0,
    frames: parseInt(s(T.frames) || '1', 10) || 1, photo: (s(T.photo) || 'MONOCHROME2').toUpperCase(), slope: (dsNum(T.slope) || [1])[0], intercept: (dsNum(T.intercept) || [0])[0],
    wc: dsNum(T.wc), ww: dsNum(T.ww), spacing: dsNum(T.spacing) || dsNum(T.imagerSpacing), spacingSource: dsNum(T.spacing) ? 'Pixel Spacing' : dsNum(T.imagerSpacing) ? 'Imager Pixel Spacing' : null,
    modality: s(T.modality) || 'unknown', bodyPart: s(T.bodyPart), studyUid: s(T.study), seriesUid: s(T.series), seriesNo: parseInt(s(T.seriesNo) || '0', 10) || 0, instNo: parseInt(s(T.instNo) || '0', 10) || 0,
    burnedIn: s(T.burned), rescaleType: s(T.rescaleType), units: s(T.units)
  };
  var tech = {}; TECH_LABELS.forEach(function (x) { var e2 = ds[x[0]]; if (e2) tech[x[1]] = e2.vr === 'US' ? R.us(e2, little) : R.str(e2); }); tech['Transfer syntax'] = info.tsName;
  var identity = {}, identityPresent = [];
  Object.keys(IDENTITY_TAGS).forEach(function (t) { var e3 = ds[t]; if (e3 && e3.len > 0) { var v = R.str(e3); if (v) { identity[IDENTITY_TAGS[t]] = v; identityPresent.push(IDENTITY_TAGS[t]); } } });
  if (!info.rows || !info.cols) throw derr('no-image');
  var px = ds[T.pixel]; if (!px) throw derr('no-pixels');
  return { R: R, info: info, tech: tech, identity: identity, identityPresent: identityPresent, pixel: px };
}
// Extract frames as display-ready data. Returns { kind:'gray'|'rgb', frames:[TypedArray], ... } or a Promise for JPEG.
function extractPixels(p) {
  var I = p.info, R = p.R, px = p.pixel, n = I.rows * I.cols;
  if (I.native) {
    if (I.bitsAlloc !== 8 && I.bitsAlloc !== 16) throw derr('unsupported-bits', String(I.bitsAlloc));
    if (I.photo === 'PALETTE COLOR') throw derr('unsupported-photo', I.photo);
    var bpp = I.bitsAlloc / 8, frameBytes = n * I.spp * bpp, frames = [], count = Math.min(I.frames, Math.floor(px.len / frameBytes));
    if (count < 1) throw derr('corrupt', 'Pixel data shorter than one frame');
    for (var f = 0; f < count; f++) {
      var start = px.start + f * frameBytes;
      if (I.spp === 1) {
        var out = new Float32Array(n), dv = R.dv, signed = I.pixRep === 1, shift = I.bitsStored && I.bitsStored < I.bitsAlloc ? I.bitsStored : 0;
        for (var i = 0; i < n; i++) {
          var v;
          if (bpp === 1) v = signed ? dv.getInt8(start + i) : R.u8[start + i];
          else { v = signed ? dv.getInt16(start + 2 * i, I.little) : dv.getUint16(start + 2 * i, I.little); if (shift && !signed) v = v & ((1 << shift) - 1); else if (shift && signed) { v = v & ((1 << shift) - 1); if (v & (1 << (shift - 1))) v -= (1 << shift); } }
          out[i] = v * I.slope + I.intercept;
        }
        frames.push(out);
      } else if (I.spp === 3 && bpp === 1) {
        var rgba = new Uint8ClampedArray(n * 4), ybr = /^YBR_FULL/.test(I.photo);
        for (var j = 0; j < n; j++) {
          var r, gg, b;
          if (I.planar === 1) { r = R.u8[start + j]; gg = R.u8[start + n + j]; b = R.u8[start + 2 * n + j]; } else { r = R.u8[start + 3 * j]; gg = R.u8[start + 3 * j + 1]; b = R.u8[start + 3 * j + 2]; }
          if (ybr) { var Y = r, Cb = gg - 128, Cr = b - 128; r = Y + 1.402 * Cr; gg = Y - 0.344136 * Cb - 0.714136 * Cr; b = Y + 1.772 * Cb; }
          rgba[4 * j] = r; rgba[4 * j + 1] = gg; rgba[4 * j + 2] = b; rgba[4 * j + 3] = 255;
        }
        frames.push(rgba);
      } else throw derr('unsupported-photo', I.photo + ' / ' + I.spp + ' samples');
    }
    return { kind: I.spp === 1 ? 'gray' : 'rgb', frames: frames, invert: I.photo === 'MONOCHROME1' };
  }
  if (I.ts === TS.JPEG_BASELINE && px.undefinedLength) {
    // Encapsulated: item 0 = basic offset table, then fragments. Single-frame: concatenate fragments.
    var frags = [], p2 = px.start, dv2 = R.dv;
    while (p2 + 8 <= px.contentEnd) { var g = dv2.getUint16(p2, true), e = dv2.getUint16(p2 + 2, true), l = dv2.getUint32(p2 + 4, true); if (g !== 0xFFFE || e !== 0xE000) break; frags.push([p2 + 8, l]); p2 += 8 + l; }
    frags = frags.slice(1).filter(function (x) { return x[1] > 0; });
    if (!frags.length) throw derr('corrupt', 'No JPEG fragments');
    if (I.frames > 1 && frags.length !== I.frames) throw derr('unsupported-ts', 'Multi-frame JPEG with fragmented frames');
    var groups = I.frames > 1 ? frags.map(function (x) { return [x]; }) : [frags];
    return Promise.all(groups.map(function (grp) {
      var blob = new Blob(grp.map(function (x) { return new Uint8Array(R.buf, x[0], x[1]); }), { type: 'image/jpeg' });
      return decodeBitmap(blob).then(function (d) { return d.rgba; });
    })).then(function (rgbas) {
      if (I.spp === 1) return { kind: 'gray', frames: rgbas.map(function (rgba) { var o = new Float32Array(n); for (var k = 0; k < n; k++) o[k] = rgba[4 * k] * I.slope + I.intercept; return o; }), invert: I.photo === 'MONOCHROME1', lossy: true };
      return { kind: 'rgb', frames: rgbas, lossy: true };
    });
  }
  throw derr('unsupported-ts', I.ts);
}
function decodeBitmap(blob) {
  if (!window.createImageBitmap) return Promise.reject(derr('no-decoder'));
  return createImageBitmap(blob).then(function (bmp) {
    if (bmp.width * bmp.height > CONFIG.maxImagePixels) { bmp.close(); throw derr('too-large'); }
    var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    var g = c.getContext('2d'); g.drawImage(bmp, 0, 0); var d = g.getImageData(0, 0, c.width, c.height); bmp.close(); c.width = c.height = 0;
    return { w: d.width, h: d.height, rgba: d.data };
  });
}
function grayStats(a) { var mn = Infinity, mx = -Infinity; for (var i = 0; i < a.length; i += a.length > 4e6 ? 7 : 1) { var v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; } return { min: mn, max: mx }; }
function dicomErrorText(e) {
  var k = e && e.kind;
  return { 'not-dicom': 'Not a DICOM Part-10 file (no “DICM” marker).', 'unsupported-ts': 'This transfer syntax (' + (TS_NAMES[e.detail] || e.detail) + ') is not decoded by the Oncotics Inspector. Open it in the OHIF Viewer instead.', 'unsupported-bits': 'Unsupported bits allocated (' + e.detail + ').', 'unsupported-photo': 'Unsupported photometric interpretation (' + e.detail + '). Try the OHIF Viewer.',
    corrupt: 'The file appears corrupted or truncated.', 'no-image': 'The DICOM object has no image matrix (it may be a report, structured report or other non-image object).', 'no-pixels': 'No pixel data found.', 'too-large': 'The image is too large for in-browser processing.', 'no-decoder': 'This browser cannot decode this image format.' }[k] || 'The file could not be read.';
}
/* DICOMweb multipart/related responses (WADO-RS instance retrieval) */
function parseMultipart(buf, contentType) {
  var m = /boundary="?([^";]+)"?/i.exec(contentType || ''); if (!m) return [new Uint8Array(buf)];
  var bd = '--' + m[1], u8 = new Uint8Array(buf), enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }, B = enc(bd), parts = [];
  var find = function (from, pat) { outer: for (var i = from; i <= u8.length - pat.length; i++) { for (var j = 0; j < pat.length; j++) if (u8[i + j] !== pat[j]) continue outer; return i; } return -1; };
  var pos = find(0, B), crlf2 = enc('\r\n\r\n');
  while (pos >= 0) {
    var hdrEnd = find(pos + B.length, crlf2); if (hdrEnd < 0) break;
    var next = find(hdrEnd + 4, B); if (next < 0) break;
    var end = next; if (u8[end - 2] === 13 && u8[end - 1] === 10) end -= 2;
    parts.push(u8.slice(hdrEnd + 4, end));
    pos = next;
    if (u8[next + B.length] === 45 && u8[next + B.length + 1] === 45) break;
  }
  return parts;
}
