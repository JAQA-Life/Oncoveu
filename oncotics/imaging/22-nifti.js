/* ====================================================================
   NIfTI-1 (.nii / .nii.gz) reader (memory only)
   Reads the image matrix, voxel size and orientation (sform, else qform,
   else pixdim). Header text fields (descrip, aux_file, intent_name) are
   never read. Each 3D volume becomes one multi-frame image (one frame per
   slice along the third voxel axis), displayed radiologically when the
   affine allows it (patient right on screen left, anterior up).
   ==================================================================== */
async function gunzipBuffer(buf) {
  if (typeof DecompressionStream !== 'function') throw derr('no-decoder');
  var ds = new DecompressionStream('gzip'), out = new Response(new Blob([buf]).stream().pipeThrough(ds));
  return out.arrayBuffer();
}
function niftiAffine(dv, le, pixdim) {
  var f = function (o) { return dv.getFloat32(o, le); }, qcode = dv.getInt16(252, le), scode = dv.getInt16(254, le);
  if (scode > 0) return [[f(280), f(284), f(288), f(292)], [f(296), f(300), f(304), f(308)], [f(312), f(316), f(320), f(324)]];
  if (qcode > 0) {
    var b = f(256), c = f(260), d = f(264), a = Math.sqrt(Math.max(0, 1 - (b * b + c * c + d * d))), qfac = pixdim[0] < 0 ? -1 : 1;
    var R = [[a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)], [2 * (b * c + a * d), a * a + c * c - b * b - d * d, 2 * (c * d - a * b)], [2 * (b * d - a * c), 2 * (c * d + a * b), a * a + d * d - c * c - b * b]];
    var sp = [pixdim[1], pixdim[2], pixdim[3] * qfac];
    return [0, 1, 2].map(function (r) { return [R[r][0] * sp[0], R[r][1] * sp[1], R[r][2] * sp[2], f(268 + 4 * r)]; });
  }
  return [[pixdim[1], 0, 0, 0], [0, pixdim[2], 0, 0], [0, 0, pixdim[3], 0]];
}
async function parseNifti(buf) {
  var u8 = new Uint8Array(buf);
  if (u8[0] === 0x1f && u8[1] === 0x8b) { buf = await gunzipBuffer(buf); u8 = new Uint8Array(buf); }
  if (buf.byteLength < 352) throw derr('not-nifti');
  var dv = new DataView(buf), le = dv.getInt32(0, true) === 348;
  if (!le && dv.getInt32(0, false) !== 348) throw derr(dv.getInt32(0, true) === 540 || dv.getInt32(0, false) === 540 ? 'nifti2' : 'not-nifti');
  var magic = String.fromCharCode(u8[344], u8[345], u8[346]);
  if (magic !== 'n+1') throw derr(magic === 'ni1' ? 'nifti-pair' : 'not-nifti');
  var dim = []; for (var i = 0; i < 8; i++) dim.push(dv.getInt16(40 + 2 * i, le));
  var pixdim = []; for (i = 0; i < 8; i++) pixdim.push(dv.getFloat32(76 + 4 * i, le));
  var nx = dim[1], ny = Math.max(1, dim[2]), nz = dim[0] >= 3 ? Math.max(1, dim[3]) : 1, nt = dim[0] >= 4 ? Math.max(1, dim[4]) : 1;
  for (i = 5; i <= Math.min(7, dim[0]); i++) if (dim[i] > 1) throw derr('nifti-dims');
  if (!(nx > 0 && ny > 0) || nx * ny > CONFIG.maxImagePixels) throw derr('too-large');
  var dtype = dv.getInt16(70, le), off = Math.max(352, Math.round(dv.getFloat32(108, le)));
  var T = { 2: [1, 'getUint8'], 4: [2, 'getInt16'], 8: [4, 'getInt32'], 16: [4, 'getFloat32'], 64: [8, 'getFloat64'], 256: [1, 'getInt8'], 512: [2, 'getUint16'], 768: [4, 'getUint32'] }[dtype];
  if (!T) throw derr('nifti-type', String(dtype));
  var nv = nx * ny * nz, need = off + nv * nt * T[0];
  if (need > buf.byteLength) throw derr('corrupt', 'NIfTI data shorter than its header says');
  var slope = dv.getFloat32(112, le), inter = dv.getFloat32(116, le); if (!(slope !== 0 && isFinite(slope))) { slope = 1; inter = 0; } if (!isFinite(inter)) inter = 0;
  var aff = niftiAffine(dv, le, pixdim), sp = [0, 1, 2].map(function (a) { return Math.hypot(aff[0][a], aff[1][a], aff[2][a]) || Math.abs(pixdim[a + 1]) || 1; });
  var dirs = [0, 1, 2].map(function (a) { return [aff[0][a] / sp[a], aff[1][a] / sp[a], aff[2][a] / sp[a]]; });   // RAS world direction of each voxel axis
  // Radiological display: flip i if it runs toward patient right (+x), flip j if it runs toward anterior (+y).
  var dom = function (d) { var m = 0; for (var q = 1; q < 3; q++) if (Math.abs(d[q]) > Math.abs(d[m])) m = q; return m; };
  var flipX = dom(dirs[0]) === 0 && dirs[0][0] > 0, flipY = dom(dirs[1]) === 1 && dirs[1][1] > 0;
  var read = dv[T[1]].bind(dv), bs = T[0], vols = [];
  for (var t = 0; t < Math.min(nt, 8); t++) {
    var frames = [];
    for (var k = 0; k < nz; k++) {
      var fr = new Float32Array(nx * ny), base = off + ((t * nz + k) * nx * ny) * bs;
      for (var j = 0; j < ny; j++) { var y = flipY ? ny - 1 - j : j; for (var x0 = 0; x0 < nx; x0++) { var v = read(base + (j * nx + x0) * bs, le); fr[y * nx + (flipX ? nx - 1 - x0 : x0)] = v * slope + inter; } }
      frames.push(fr);
    }
    vols.push(frames);
  }
  return { vols: vols, nt: nt, n: [nx, ny, nz], sp: sp, dirs: dirs, origin: [aff[0][3], aff[1][3], aff[2][3]], flipX: flipX, flipY: flipY, dtype: dtype, sformCode: dv.getInt16(254, le), qformCode: dv.getInt16(252, le) };
}
// Sequence hint for the brain model's channel assignment. Only the hint is kept; the file name is not stored.
function seqHintFromName(name) {
  var n = String(name || '').toLowerCase();
  return /flair/.test(n) ? 'FLAIR' : /t1ce|t1c|t1gd|t1_?gd|t1\+c|t1post|post/.test(n) ? 'T1c' : /t2/.test(n) ? 'T2' : /t1/.test(n) ? 'T1' : /(^|[^a-z])(ct|chest|lung)([^a-z]|$)/.test(n) ? 'CT' : '';
}
var NIFTI_BATCH = { n: 0 };
async function ingestNifti(buf, name, batchKey) {
  var p = await parseNifti(buf), hint = seqHintFromName(name), n = p.n, recs = [];
  p.vols.forEach(function (frames, t) {
    // Window from robust volume statistics (the first slice is often empty).
    var smp = []; for (var k = 0; k < frames.length; k++) for (var q = k % 7; q < frames[k].length; q += 53) smp.push(frames[k][q]);
    smp.sort(function (a, b) { return a - b; }); var lo = smp[Math.floor(smp.length * 0.01)] || 0, hi = smp[Math.floor(smp.length * 0.995)] || 1; if (!(hi > lo)) hi = lo + 1;
    var rec = grayRecord(frames, n[0], n[1], { wc: [(lo + hi) / 2], ww: [hi - lo], isDicom: false, source: 'local-nifti', modality: hint === 'CT' ? 'CT (NIfTI)' : 'NIfTI', spacing: [p.sp[1], p.sp[0]], spacingSource: 'NIfTI voxel size', rescaled: true, unitsTag: '', seqHint: p.nt > 1 ? '' : hint,
      vol: { n: n.slice(), sp: p.sp.slice(), dirs: p.dirs, origin: p.origin, flipX: p.flipX, flipY: p.flipY, t: t, nt: p.nt },
      tech: { Format: 'NIfTI-1' + (p.nt > 1 ? ' (volume ' + (t + 1) + ' of ' + p.nt + ')' : ''), 'Matrix (voxels)': n.join(' × '), 'Voxel size (mm)': p.sp.map(function (v) { return num(v, 3); }).join(' × '), Orientation: p.sformCode > 0 ? 'sform' : p.qformCode > 0 ? 'qform' : 'voxel size only (no orientation in header)', 'Data type code': p.dtype, 'Sequence (from file name)': p.nt > 1 ? 'not detected' : (hint || 'not detected'), Note: 'NIfTI header text fields are not read. Frames are slices along the third voxel axis.' }, identity: {}, identityPresent: [] });
    delete rec.wc; delete rec.ww;
    var added = addImage(rec, 'nifti-study-' + batchKey, 'nifti-series-' + (++NIFTI_BATCH.n), 0);
    if (S.current === added.id && S.frame === 0) S.frame = Math.floor(n[2] / 2);   // open volumes on the middle slice
    recs.push(added);
  });
  return recs;
}
