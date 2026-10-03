// End-to-end check of the 3D packs inside the built Imaging Workbench (headless Chromium):
// NIfTI upload -> volume assembly -> brain segmentation / lung detection in the Web Worker,
// compared with the MONAI references from reference_3d.py.
// The page under test is the built Workbench plus one test-only line that exposes its state as
// window.__oiTest (added by the CI step with oncotics/ai/instrument_e2e.sh; never deployed).
// Usage: node e2e_workbench_3d.mjs <base URL> <data dir> <brain ref json> <lung ref json> <brain threshold> <lung score threshold> [CT DICOM series dir]
// With the DICOM directory, the lung model also runs on the same CT loaded as a (shuffled) DICOM series.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const [base, dataDir, brainRefPath, lungRefPath, brainThr, lungThr, dicomDir] = process.argv.slice(2);
const brainRef = JSON.parse(fs.readFileSync(brainRefPath, 'utf8')), lungRef = JSON.parse(fs.readFileSync(lungRefPath, 'utf8'));
const browser = await chromium.launch();
// bypassCSP only lets the harness evaluate its checks; the page's own CSP is unchanged in production.
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, bypassCSP: true });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const W = ms => page.waitForTimeout(ms);
const fail = msg => { console.error('E2E FAILED: ' + msg); process.exit(1); };
await page.goto(base + '/imaging/index.html');
await page.click('[data-panel="consent"] >> nth=0'); await W(200);
await page.check('#oi-c-phi'); await page.check('#oi-c-nd'); await page.click('[data-act="consent-inline"]'); await W(200);
await page.click('[data-panel="upload"] >> nth=0'); await W(200);
const files = ['t1ce', 't1', 't2', 'flair'].map(n => path.join(dataDir, 'synthetic_' + n + '.nii.gz')).concat([path.join(dataDir, 'synthetic_chest_ct.nii.gz')]);
await page.setInputFiles('#oi-file-dicom', files);
await page.waitForFunction(() => __oiTest.S.images.size === 5 && !__oiTest.S.loading, null, { timeout: 120000 });
console.log('volumes:', JSON.stringify(await page.evaluate(() => [...__oiTest.S.images.values()].map(r => [r.seqHint, r.vol.n.join('x')]))));
await page.click('[data-panel="ai"]'); await W(300);
await page.check('input[value="packs"]'); await W(1500);

async function runPack(id, setup) {
  await page.check('input[name="oi-ai-pack"][value="' + id + '"]'); await W(300);
  await page.click('[data-act="pack-load"][data-id="' + id + '"]');
  await page.waitForFunction(i => ['ready', 'error'].includes(__oiTest.PACKS.map[i].status), id, { timeout: 300000 });
  if (await page.evaluate(i => __oiTest.PACKS.map[i].status, id) !== 'ready') fail(id + ' did not load: ' + await page.evaluate(i => __oiTest.PACKS.map[i].error, id));
  await setup(); await W(300);
  await page.check('input[data-change="ai-reviewed"]'); await W(300);
  const t0 = Date.now();
  await page.click('[data-act="ai-run"]');
  await page.waitForFunction(() => __oiTest.S.ai.running, null, { timeout: 20000 });
  await page.waitForFunction(() => !__oiTest.S.ai.running, null, { timeout: 45 * 60000, polling: 2000 });
  const err = await page.evaluate(() => __oiTest.S.ai.error);
  if (err) fail(id + ': ' + err);
  console.log(id + ': ' + Math.round((Date.now() - t0) / 1000) + ' s in the browser');
}

// ---- Brain: channels are auto-assigned from the file-name hints
await runPack('brain-mri-brats-segresnet', async () => {
  await page.evaluate(t => { __oiTest.PACKS.map['brain-mri-brats-segresnet'].pack.output.threshold = t; __oiTest.scheduleRender(); }, parseFloat(brainThr));
  const ch = await page.evaluate(() => Object.keys(__oiTest.v3().ch).map(k => k + '=' + (__oiTest.S.images.get(__oiTest.v3().ch[k]) || {}).seqHint).join(' '));
  console.log('channel assignment:', ch);
});
const brain = await page.evaluate(() => __oiTest.S.ai.results.filter(r => r.type === 'segmentation-3d').map(r => ({ label: r.label.split(' — ')[0], voxels: r.voxels, score: r.score, slices: __oiTest.S.ai.results.filter(x => x.group === r.id).length })));
let bad = 0;
for (const b of brain) {
  const ref = brainRef[b.label]; if (!ref) fail('unknown brain label ' + b.label);
  const inBand = b.voxels >= ref.band[0] - 30 && b.voxels <= ref.band[1] + 30, ds = (b.score == null || ref.meanScore == null) ? (b.score === ref.meanScore ? 0 : 1) : Math.abs(b.score - ref.meanScore);
  console.log('brain ' + b.label.padEnd(16) + ' voxels browser ' + b.voxels + ' MONAI ' + ref.voxels + ' (' + ref.band[0] + '–' + ref.band[1] + ' if probabilities move by ±0.002) · mean score browser ' + (b.score == null ? '—' : b.score.toFixed(4)) + ' MONAI ' + (ref.meanScore == null ? '—' : ref.meanScore.toFixed(4)) + ' · per-slice masks ' + b.slices);
  if (!inBand || ds > 0.01) bad++;
}
if (brain.length !== Object.keys(brainRef).length || bad) fail('brain results differ from MONAI');

// ---- Lung: whole scan of the CT volume (NIfTI, then optionally the same CT as a DICOM series)
async function lungStage(name, pick) {
  await page.evaluate(pick);
  if (name === 'NIfTI') await runPack('lung-ct-luna16-retinanet', async () => {
    await page.check('input[name="oi-v3-roi"][value="whole"]');
    await page.evaluate(t => { __oiTest.PACKS.map['lung-ct-luna16-retinanet'].pack.selector.scoreThresh = t; __oiTest.scheduleRender(); }, parseFloat(lungThr));
  });
  else { await page.click('[data-panel="ai"]'); await W(300); await page.check('input[data-change="ai-reviewed"]').catch(() => {}); await W(200); const t0 = Date.now(); await page.click('[data-act="ai-run"]'); await page.waitForFunction(() => __oiTest.S.ai.running, null, { timeout: 20000 }); await page.waitForFunction(() => !__oiTest.S.ai.running, null, { timeout: 45 * 60000, polling: 2000 }); const err = await page.evaluate(() => __oiTest.S.ai.error); if (err) fail('lung ' + name + ': ' + err); console.log('lung ' + name + ': ' + Math.round((Date.now() - t0) / 1000) + ' s in the browser'); }
  const cur = await page.evaluate(() => { const i = __oiTest.S.images.get(__oiTest.S.current); return i.vol ? i.id : i.seriesId; });
  const lung = await page.evaluate(k => __oiTest.S.ai.results.filter(r => r.type === 'detection-3d' && r.vols.indexOf(k) >= 0).map(r => ({ box: r.boxRas, score: r.score })).sort((a, b) => b.score - a.score), cur);
  const n = Math.min(20, lungRef.boxes.length);
  console.log('lung ' + name + ': MONAI ' + lungRef.boxes.length + ' boxes (windowed: ' + lungRef.windowed + ', size ' + lungRef.size.join('x') + '); browser shows the top ' + lung.length);
  if (lung.length < Math.min(50, lungRef.boxes.length)) fail('browser returned fewer lung boxes than MONAI (' + name + ')');
  let db = 0, ds = 0;
  for (let i = 0; i < n; i++) { ds = Math.max(ds, Math.abs(lung[i].score - lungRef.scores[i])); for (let q = 0; q < 6; q++) db = Math.max(db, Math.abs(lung[i].box[q] - lungRef.boxes[i][q])); }
  console.log('lung ' + name + ' top-' + n + ': max |box| ' + db.toFixed(3) + ' voxel, max |score| ' + ds.toFixed(5));
  for (let i = 0; i < Math.min(3, n); i++) console.log('  #' + (i + 1) + ' browser ' + lung[i].score.toFixed(4) + ' [' + lung[i].box.map(v => v.toFixed(1)).join(', ') + ']  MONAI ' + lungRef.scores[i].toFixed(4) + ' [' + lungRef.boxes[i].map(v => v.toFixed(1)).join(', ') + ']');
  if (db > 0.5 || ds > 0.005) fail('lung results differ from MONAI (' + name + ')');
}
await lungStage('NIfTI', () => { const r = [...__oiTest.S.images.values()].find(x => x.seqHint === 'CT'); __oiTest.S.current = r.id; __oiTest.S.frame = 0; __oiTest.scheduleRender(); });
if (dicomDir) {
  const before = await page.evaluate(() => __oiTest.S.images.size);
  await page.click('[data-panel="upload"] >> nth=0'); await W(200);
  const dfiles = fs.readdirSync(dicomDir).filter(f => f.endsWith('.dcm')).map(f => path.join(dicomDir, f));
  await page.setInputFiles('#oi-file-dicom', dfiles);
  await page.waitForFunction(n => __oiTest.S.images.size === n && !__oiTest.S.loading, before + dfiles.length, { timeout: 120000 });
  await lungStage('DICOM series', () => { const r = [...__oiTest.S.images.values()].find(x => x.isDicom && x.modality === 'CT'); __oiTest.S.current = r.id; __oiTest.S.frame = 0; __oiTest.scheduleRender(); });
}
await browser.close();
if (errors.length) fail('page errors ' + JSON.stringify(errors));
console.log('E2E 3D OK');
