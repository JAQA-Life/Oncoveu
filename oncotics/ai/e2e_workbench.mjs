// End-to-end check of the real chest X-ray pack inside the built Imaging Workbench (headless Chromium).
// Usage: node e2e_workbench.mjs <serverRoot URL> <image path> <reference json path>
import { chromium } from 'playwright';
import fs from 'fs';
const [base, image, refPath] = process.argv.slice(2);
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const browser = await chromium.launch();
// bypassCSP only lets the test harness evaluate its checks; the page's own CSP is unchanged in production.
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, bypassCSP: true });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(base + '/imaging/index.html');
const W = ms => page.waitForTimeout(ms);
await page.click('[data-panel="consent"] >> nth=0'); await W(200);
await page.check('#oi-c-phi'); await page.check('#oi-c-nd'); await page.click('[data-act="consent-inline"]'); await W(200);
await page.click('[data-panel="upload"] >> nth=0'); await W(200);
await page.setInputFiles('#oi-file-img', [image]); await W(1500);
await page.click('[data-panel="ai"]'); await W(300);
await page.check('input[value="packs"]'); await W(1500);
await page.check('input[name="oi-ai-pack"][value="cxr-xrv-densenet121"]'); await W(200);
await page.click('[data-act="pack-load"][data-id="cxr-xrv-densenet121"]');
await page.waitForFunction(() => /checksum verified/.test(document.body.innerText), null, { timeout: 120000 });
await page.check('input[data-change="ai-reviewed"]'); await W(200);
await page.click('[data-act="ai-run"]');
// Show every finding: the results card (with its threshold slider) appears after the run.
await page.waitForSelector('input[data-change="ai-threshold"]', { timeout: 120000 });
await page.evaluate(() => { const r = document.querySelector('input[data-change="ai-threshold"]'); r.value = '0'; r.dispatchEvent(new Event('change', { bubbles: true })); }); await W(500);
await page.waitForFunction(() => document.querySelectorAll('#oi-main table tbody tr').length > 10, null, { timeout: 120000 });
const rows = await page.evaluate(() => [...document.querySelectorAll('#oi-main table tbody tr')].map(r => [...r.querySelectorAll('td')].map(td => td.innerText.trim())));
const got = {}; for (const r of rows) { if (r[1] !== 'classification') continue; const label = r[2].replace(' (oncology-relevant finding)', ''); got[label] = parseFloat(r[3]); }
let maxd = 0; const lines = [];
for (const k of Object.keys(ref)) { const d = Math.abs((got[k] ?? NaN) - ref[k]); maxd = Math.max(maxd, isNaN(d) ? 9 : d); lines.push(k.padEnd(28) + ' torch ' + ref[k].toFixed(3) + '  browser ' + (got[k] ?? NaN).toFixed(3)); }
console.log(lines.join('\n'));
const heat = rows.filter(r => r[1] === 'heatmap').map(r => r[2]);
console.log('activation maps:', heat.join(' | '));
console.log('max |browser - torch| =', maxd.toFixed(4), ' errors:', JSON.stringify(errors));
await browser.close();
// Small differences come from the browser's resize (amplified near the operating points);
// a pre/post-processing bug (wrong scaling, channel or crop) gives differences far above this.
if (maxd > 0.12 || errors.length) { console.error('E2E FAILED'); process.exit(1); }
console.log('E2E OK');
