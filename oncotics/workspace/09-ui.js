
/* ====================================================================
   UI FRAMEWORK: render scheduling, layers (drawer/modal), a11y helpers
   ==================================================================== */
var $ = function (sel, el) { return (el || ROOT).querySelector(sel); };
var MAIN = $('#ow-main'), RAIL = $('#ow-rail'), LAYER = $('#ow-layer'), STATUS = $('#ow-status');
var MODULES = [];            // module registry (order = rail order)
var MOD = {};                // id -> module
var ACTIONS = {};            // data-act handlers
var DETAIL = {};             // record type -> detail renderer

function registerModule(m) { MODULES.push(m); MOD[m.id] = m; }
function announce(msg, assertive) {
  var el = $(assertive ? '#ow-alert' : '#ow-live'); if (!el) return;
  el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 30);
}
var toastTimer = null;
function toast(msg) {
  var t = $('.ow-toast'); if (t) t.remove();
  t = document.createElement('div'); t.className = 'ow-toast'; t.setAttribute('role', 'status'); t.textContent = msg; ROOT.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.remove(); }, 3200);
}

/* ---- render scheduling (rAF-batched; preserves focus) ---- */
var renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(function () { renderQueued = false; renderAll(); }); }

/* ---- automatic live loading ----
   Every section requests its public source as soon as it is shown for the current search; there is
   no separate "try live" step. Each request starts at most once per search. If a source cannot be
   reached from this browser (CORS, network, rate limit), the section shows the official link-out. */
var AutoLive = { gen: -1, state: new Map() };
function autoRun(token, fn) {
  if (AutoLive.gen !== State.gen) { AutoLive.gen = State.gen; AutoLive.state = new Map(); }
  if (AutoLive.state.has(token)) return false;
  AutoLive.state.set(token, 'pending');
  var g = State.gen;
  setTimeout(function () {
    if (g !== State.gen) return;
    try { fn(); } catch (e) { /* the section falls back to its link-out */ }
    AutoLive.state.set(token, 'done'); scheduleRender();
  }, 0);
  return true;
}
function autoPending(token) { return AutoLive.gen === State.gen && AutoLive.state.get(token) === 'pending'; }
function actEl(attrs) { attrs = attrs || {}; return { getAttribute: function (n) { return attrs[n] != null ? String(attrs[n]) : null; } }; }
// Runs ACTIONS[act] automatically once per search. Shows a loading row meanwhile, or the link-outs when
// nothing could be requested (for example a required identifier is missing).
function autoAct(token, act, attrs, linkouts, what) {
  if (autoRun(token, function () { ACTIONS[act](actEl(attrs)); }) || autoPending(token)) return H`<p class="ow-row ow-muted" aria-busy="true"><span class="ow-spinner" aria-hidden="true"></span> Loading ${what || 'live data'}…</p>`;
  var lo2 = arr(linkouts);
  return H`<div class="ow-empty"><p>${what ? 'No live data available for ' + what + ' from this browser.' : 'No live data available from this browser.'}${lo2.length ? ' Open the official source:' : ''}</p>${lo2.length ? H`<div class="ow-card-foot">${lo2.map(function (l) { return extBtn(l.url, l.label); })}</div>` : ''}</div>`;
}
var Drafts = {};   // unsubmitted form edits (memory only), keyed by field id or name=value
function draftKey(el) { return el.id || (el.name ? el.name + '=' + el.value : null); }
function applyDrafts(scope) {
  Object.keys(Drafts).forEach(function (k) {
    var el = k.indexOf('=') > 0 ? scope.querySelector('input[name="' + k.split('=')[0] + '"][value="' + k.slice(k.indexOf('=') + 1) + '"]') : scope.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(k) : k));
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!Drafts[k]; else el.value = Drafts[k];
  });
}
function clearDrafts(form) {
  if (!form) { Drafts = {}; return; }
  Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (el) { var k = draftKey(el); if (k) delete Drafts[k]; });
}
function renderAll() {
  var ae = document.activeElement, focusId = ae && ROOT.contains(ae) && ae.id ? ae.id : null, selStart = null, selEnd = null;
  try { if (focusId && ae.setSelectionRange && typeof ae.selectionStart === 'number') { selStart = ae.selectionStart; selEnd = ae.selectionEnd; } } catch (e) { /* not a text field */ }
  ROOT.classList.toggle('ow-has-query', !!State.ctx);
  renderRail();
  renderMain();
  applyDrafts(MAIN);
  renderStatus();
  renderLayers();
  if (focusId) {
    var el = document.getElementById(focusId);
    if (el && el !== document.activeElement && ROOT.contains(el)) { try { el.focus({ preventScroll: true }); if (selStart != null && el.setSelectionRange) el.setSelectionRange(selStart, selEnd); } catch (e) { /* ignore */ } }
  }
}
function safeRender(fn, label) {
  try { return fn(); }
  catch (e) { return H`<div class="ow-notice ow-notice-bad">${icon('alert')}<div><strong>${label || 'This section'} could not be displayed.</strong> A source returned data in an unexpected shape. Other sections are unaffected.</div></div>`; }
}

/* ---- rail (module navigation, roving tabindex) ----
   Primary modules stay visible; secondary modules sit under "More" (expanded
   automatically when one of them is open). The Imaging Workbench is a link to
   a separate page, never loaded here. */
var RAIL_PRIMARY = ['overview', 'clinical-evidence', 'trials', 'drug-intelligence', 'vaccines-cancer-immunization', 'device-intelligence', 'onco-fertility', 'biology', 'literature', 'expert-knowledge'];
function renderRail() {
  var visible = MODULES.filter(function (m) { return !State.prefs.hiddenModules.has(m.id); });
  var moreOpen = !!ui('_rail').more || RAIL_PRIMARY.indexOf(State.module) < 0;
  var item = function (m) {
    var n = null; try { n = m.count ? m.count() : null; } catch (e) { n = null; }
    var sel = State.module === m.id;
    return H`<li role="presentation"><button type="button" role="tab" class="ow-tab" id="ow-tab-${m.id}" aria-selected="${sel ? 'true' : 'false'}" aria-controls="ow-main" tabindex="${sel ? '0' : '-1'}" data-act="tab" data-mod="${m.id}">${icon(m.icon)}<span>${m.label}</span>${n != null ? H`<span class="ow-count" aria-label="${num(n)} records">${n > 999 ? '999+' : n}</span>` : ''}</button></li>`;
  };
  var prim = visible.filter(function (m) { return RAIL_PRIMARY.indexOf(m.id) >= 0; }), sec = visible.filter(function (m) { return RAIL_PRIMARY.indexOf(m.id) < 0; });
  setHTML(RAIL, H`<ul class="ow-rail-list" role="tablist" aria-orientation="vertical" aria-label="Workspace modules">${prim.map(item)}
      <li role="presentation" class="ow-rail-sep"></li>
      <li role="presentation" class="ow-rail-more-li"><button type="button" class="ow-rail-more" data-act="rail-more" aria-expanded="${moreOpen ? 'true' : 'false'}">${icon('chevron', moreOpen ? 'ow-rot' : '')}<span>More modules</span><span class="ow-count">${sec.length}</span></button></li>
      ${moreOpen ? sec.map(item) : ''}</ul>
    <a class="ow-rail-imaging" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">${icon('scan')}<span>Imaging Workbench<small>Separate page · OHIF</small></span><span class="ow-sr"> (opens a separate page)</span></a>
    <div class="ow-rail-legal">Educational and research use only. Not medical advice.</div>`);
  MAIN.setAttribute('aria-labelledby', 'ow-tab-' + State.module);
}
function renderMain() {
  var m = MOD[State.module] || MODULES[0];
  setHTML(MAIN, safeRender(function () { return m.render(); }, m.label));
}

/* ---- status bar ---- */
function renderStatus() {
  var live = 0, down = 0, rate = 0, ok = 0, fail = 0;
  SOURCES.forEach(function (s) { var r = Runtime[s.id]; ok += r.ok; fail += r.fail; if (r.mode === 'live') live++; if (r.mode === 'unavailable') down++; if (r.mode === 'rate-limited') rate++; });
  var loading = loadingCount(), partial = partialFailure();
  setHTML(STATUS, H`<div class="ow-status-inner">
    <span class="ow-status-item">${loading ? H`<span class="ow-spinner" aria-hidden="true"></span> Loading ${loading} source${loading > 1 ? 's' : ''}…` : H`${icon('check')} Ready`}</span>
    <span class="ow-status-item ow-status-hide-sm" title="Provider status this session">${badge(live + ' live', 'good')}${down ? badge(down + ' unavailable', 'bad') : ''}${rate ? badge(rate + ' rate-limited', 'warn') : ''}</span>
    <span class="ow-status-item ow-status-hide-sm">Requests: ${num(ok)} ok · ${num(fail)} failed</span>
    ${State.lastFetch ? H`<span class="ow-status-item ow-status-hide-sm ow-status-hide-md">Last fetch ${timeStr(State.lastFetch)} (this session only)</span>` : ''}
    ${partial ? H`<span class="ow-status-item">${badge('Partial results', 'warn', 'Some sources failed; other results are still shown')}</span>` : ''}
    <span class="ow-spacer"></span>
    ${partial ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="retry">${icon('refresh')}Retry failed</button>` : ''}
    <button type="button" class="ow-btn ow-btn-sm ow-status-hide-sm" data-act="export-json">${icon('download')}Export JSON</button>
    <button type="button" class="ow-btn ow-btn-sm ow-status-hide-sm" data-act="export-csv">${icon('table')}Export CSV</button>
    <button type="button" class="ow-btn ow-btn-sm ow-status-hide-sm" data-act="tab" data-mod="coverage-console" aria-label="Coverage Console">${icon('console')}Console</button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="privacy">${icon('shield')}Privacy</button>
    <button type="button" class="ow-btn ow-btn-sm ow-btn-danger" data-act="clear-session">${icon('trash')}Clear Session</button>
  </div>`);
}

/* ---- header actions + pills ---- */
var PILLS = ['EGFR', 'BRAF V600E', 'KRAS G12C', 'BRCA1', 'Osimertinib', 'Pembrolizumab', 'Non-Small Cell Lung Cancer', 'Breast Cancer', 'NCT02296125', 'HPV vaccine', 'sipuleucel-T', 'mRNA cancer vaccine', 'fertility preservation', 'cyclophosphamide', 'tamoxifen pregnancy', 'companion diagnostic', 'breast MRI'];
function renderHeader() {
  var th = State.prefs.theme;
  setHTML($('#ow-header-actions'), H`
    <button type="button" class="ow-btn ow-btn-sm" data-act="cmd" aria-label="Open command palette (Ctrl or Cmd + K)">${icon('command')}<span class="ow-btn-label">Commands</span></button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="theme" aria-label="Theme: ${th}. Switch theme">${icon(th === 'dark' ? 'moon' : 'sun')}<span class="ow-btn-label">${th === 'system' ? 'Auto' : titleCase(th)}</span></button>
    <a class="ow-btn ow-btn-sm" href="${CONFIG.imagingUrl}" target="_blank" rel="noopener noreferrer">${icon('scan')}<span class="ow-btn-label">Imaging Workbench</span><span class="ow-sr"> (opens a separate page)</span></a>
    <button type="button" class="ow-btn ow-btn-sm" data-act="help">${icon('help')}<span class="ow-btn-label">Help</span></button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="privacy">${icon('shield')}<span class="ow-btn-label">Privacy Info</span></button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="disclaimer">${icon('info')}<span class="ow-btn-label">Medical disclaimer</span></button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="clear-session">${icon('trash')}<span class="ow-btn-label">Clear Session</span></button>`);
  setHTML($('#ow-pills'), PILLS.map(function (p) { return H`<button type="button" class="ow-pill" data-act="search" data-term="${p}">${p}</button>`; }));
  Array.prototype.forEach.call(ROOT.querySelectorAll('[data-ow-year]'), function (el) { el.textContent = String(YEAR); });
  setHTML($('#ow-footer-sources'), H`Live data from CIViC, ClinicalTrials.gov (NLM), openFDA (U.S. FDA), Ensembl, UniProt, Europe PMC (EMBL-EBI), MyGene.info, MyVariant.info, RxNorm (NLM), STRING, Reactome, AlphaFold DB, Open Targets, cBioPortal, GWAS Catalog, ChEMBL, PubChem and EBI OLS. Also live: OncoTree, NCI GDC, DGIdb, Complex Portal, QuickGO, PDBe, EBI Proteins, OpenAlex, Crossref and Semantic Scholar. Official link-outs for regulators, guidelines, vaccines, reproductive health, expert knowledge, patient education and imaging resources. openFDA device records may lag official FDA databases. ${LEGAL.independent}`);
}
function applyTheme() {
  if (State.prefs.theme === 'system') ROOT.removeAttribute('data-theme'); else ROOT.setAttribute('data-theme', State.prefs.theme);
  ROOT.classList.toggle('ow-compact', State.prefs.density === 'compact');
}

/* ====================================================================
   LAYERS: detail drawer + modal (focus trap, Escape, focus return)
   ==================================================================== */
var Layers = { drawer: null, modal: null };
function triggerSig(el) {
  if (!el || !el.getAttribute) return null;
  var parts = ['data-act', 'data-key', 'data-i', 'data-mod', 'data-mdr', 'data-tab'].filter(function (a) { return el.hasAttribute(a); }).map(function (a) { return '[' + a + '="' + String(el.getAttribute(a)).replace(/["\\]/g, '') + '"]'; });
  return parts.length ? parts.join('') : (el.id ? '#' + el.id : null);
}
function openDrawer(title, bodyFn, opts) {
  Layers.drawer = { title: title, body: bodyFn, trigger: document.activeElement, sig: triggerSig(document.activeElement), opts: opts || {} };
  renderLayers(true);
}
function openModal(title, bodyFn, opts) {
  Layers.modal = { title: title, body: bodyFn, trigger: document.activeElement, sig: triggerSig(document.activeElement), opts: opts || {} };
  renderLayers(true);
}
function closeLayer(which) {
  var l = which ? Layers[which] : (Layers.modal ? Layers.modal : Layers.drawer);
  var key = which || (Layers.modal ? 'modal' : 'drawer');
  if (!l) return;
  Layers[key] = null;
  if (l.opts.onClose) try { l.opts.onClose(); } catch (e) { /* ignore */ }
  renderLayers();
  var back = l.trigger && document.contains(l.trigger) ? l.trigger : null;
  if (!back && l.sig) { try { back = ROOT.querySelector(l.sig); } catch (e) { back = null; } }
  if (back) { try { back.focus(); } catch (e) { /* ignore */ } }
  else { var q = $('#ow-q'); if (q) q.focus(); }
}
function renderLayers(focusNew) {
  var html = '';
  var scrollD = $('.ow-drawer .ow-drawer-body'), scrollM = $('.ow-modal .ow-drawer-body');
  var sd = scrollD ? scrollD.scrollTop : 0, sm = scrollM ? scrollM.scrollTop : 0;
  if (Layers.drawer) {
    var d = Layers.drawer;
    html += val(H`<div class="ow-overlay" data-act="close-layer" data-layer="drawer"></div>
      <div class="ow-drawer" role="dialog" aria-modal="true" aria-labelledby="ow-drawer-title" data-layer="drawer">
        <div class="ow-drawer-head"><h2 id="ow-drawer-title" class="ow-break">${d.title}</h2><span class="ow-spacer"></span>
          <button type="button" class="ow-btn ow-btn-icon ow-btn-ghost" data-act="close-layer" data-layer="drawer" aria-label="Close details">${icon('x')}</button></div>
        <div class="ow-drawer-body">${safeRender(d.body, 'Details')}</div>
      </div>`);
  }
  if (Layers.modal) {
    var m = Layers.modal;
    html += val(H`<div class="ow-overlay ow-over-modal" data-act="close-layer" data-layer="modal"></div>
      <div class="ow-modal ${m.opts.small ? 'ow-modal-sm' : ''}" role="dialog" aria-modal="true" aria-labelledby="ow-modal-title" data-layer="modal">
        <div class="ow-drawer-head"><h2 id="ow-modal-title">${m.title}</h2><span class="ow-spacer"></span>
          <button type="button" class="ow-btn ow-btn-icon ow-btn-ghost" data-act="close-layer" data-layer="modal" aria-label="Close dialog">${icon('x')}</button></div>
        <div class="ow-drawer-body">${safeRender(m.body, 'Dialog')}</div>
        ${m.opts.foot ? H`<div class="ow-modal-foot">${m.opts.foot()}</div>` : ''}
      </div>`);
  }
  var active = document.activeElement, activeId = active && LAYER.contains(active) ? active.id : null;
  LAYER.innerHTML = html;
  var nd = $('.ow-drawer .ow-drawer-body'), nm = $('.ow-modal .ow-drawer-body');
  if (nd && !focusNew) nd.scrollTop = sd; if (nm && !focusNew) nm.scrollTop = sm;
  if (focusNew) {
    var top = $(Layers.modal ? '.ow-modal' : '.ow-drawer');
    if (top) { var f = top.querySelector('[autofocus]') || top.querySelector('input, select, textarea, button, a[href]'); if (f) f.focus(); }
  } else if (activeId) { var el = document.getElementById(activeId); if (el) el.focus({ preventScroll: true }); }
}
function trapFocus(e) {
  var top = $(Layers.modal ? '.ow-modal' : (Layers.drawer ? '.ow-drawer' : null) || '.__none');
  if (!top) return;
  var f = Array.prototype.filter.call(top.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
  if (!f.length) return;
  var firstEl = f[0], lastEl = f[f.length - 1];
  if (!top.contains(document.activeElement)) { e.preventDefault(); firstEl.focus(); return; }
  if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
  else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
}
function confirmDialog(title, bodyRaw, okLabel) {
  return new Promise(function (resolve) {
    var done = false;
    ACTIONS['confirm-ok'] = function () { done = true; Layers.modal = null; renderLayers(); resolve(true); };
    openModal(title, typeof bodyRaw === 'function' ? bodyRaw : function () { return bodyRaw; }, { small: true, onClose: function () { if (!done) resolve(false); },
      foot: function () { return H`<button type="button" class="ow-btn" data-act="close-layer" data-layer="modal">Cancel</button><button type="button" class="ow-btn ow-btn-primary" data-act="confirm-ok" autofocus>${okLabel || 'Continue'}</button>`; } });
  });
}

/* ====================================================================
   SHARED RENDER COMPONENTS
   ==================================================================== */
function det(key, summary, body, defaultOpen) {
  var open = ui('_open')[key];
  if (open == null) open = !!defaultOpen;
  return H`<details class="ow-details" data-ow-det="${key}" ${open ? raw('open') : ''}><summary>${summary}</summary><div class="ow-details-body">${body}</div></details>`;
}
function more(key, text, n) {
  text = String(text || ''); n = n || 360;
  if (text.length <= n) return H`<p class="ow-pre">${text}</p>`;
  var open = !!ui('_more')[key];
  return H`<p class="ow-pre">${open ? text : trunc(text, n)}</p><button type="button" class="ow-linkbtn ow-small" data-act="more" data-key="${key}" aria-expanded="${open ? 'true' : 'false'}">${open ? 'Show less' : 'Read more'}</button>`;
}
function skeleton(n) { var s = []; for (var i = 0; i < (n || 3); i++) s.push(H`<div class="ow-card" aria-hidden="true"><div class="ow-skel" style="width:55%"></div><div class="ow-skel" style="width:90%"></div><div class="ow-skel" style="width:75%"></div></div>`); return H`<div class="ow-stack" aria-busy="true">${s}<span class="ow-sr">Loading</span></div>`; }
function confBadge(c) { var k = { Exact: 'good', Likely: 'cyan', Possible: 'warn', Unresolved: 'outline', 'Manual review recommended': 'bad' }[c] || 'outline'; return badge('Match: ' + c, k, 'Match confidence: ' + c); }
function lagBadge() { return badge('May lag official FDA DB', 'lag', 'openFDA device records are derived from FDA databases and may lag the official record'); }
function provView(p) {
  if (!p) return '';
  var cat = { 'source-reported': 'Source-reported', normalized: 'Normalized by Oncotics', derived: 'Derived by Oncotics', linkout: 'Link-out only', unavailable: 'Unavailable', ambiguous: 'Ambiguous match' }[p.category] || p.category;
  return H`<div class="ow-prov"><span>${icon('info')} ${p.sourceName}</span><span>${p.endpoint}</span>${p.recordId ? H`<span class="ow-mono">${p.recordId}</span>` : ''}<span>Retrieved ${timeStr(p.retrievedAt)} (this session)</span>
    ${badge(cat, p.category === 'derived' ? 'derived' : 'outline')}${p.confidence ? confBadge(p.confidence) : ''}${p.mayLag ? lagBadge() : ''}${p.url ? ext(p.url, p.mayLag ? 'Official FDA record' : 'Official record') : ''}</div>`;
}
function bars(entries, opts) {
  opts = opts || {};
  entries = arr(entries).filter(function (e) { return e && e[1] > 0; });
  if (!entries.length) return H`<p class="ow-subtle">No data to chart.</p>`;
  var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
  var list = entries.slice(0, opts.max || 10);
  return H`<div class="ow-bars" role="list" aria-label="${opts.label || 'Distribution'}">${list.map(function (e) {
    return H`<div class="ow-bar-row" role="listitem"><span class="ow-bar-label" title="${e[0]}">${e[0]}</span><span class="ow-bar-track" aria-hidden="true"><span class="ow-bar-fill" style="width:${Math.max(2, Math.round(100 * e[1] / max))}%;${opts.color ? 'background:' + opts.color : ''}"></span></span><span class="ow-bar-val">${num(e[1])}</span></div>`;
  })}</div>`;
}
function stat(n, label, src) { return H`<div class="ow-stat"><div class="ow-stat-num">${n == null ? '—' : (typeof n === 'number' ? num(n) : n)}</div><div class="ow-stat-label">${label}</div>${src ? H`<div class="ow-stat-src">${src}</div>` : ''}</div>`; }
function viewToggle(mod) {
  var v = ui(mod).view || 'cards';
  return H`<div class="ow-seg" role="group" aria-label="View"><button type="button" aria-pressed="${v === 'cards' ? 'true' : 'false'}" data-act="view" data-mod="${mod}" data-view="cards">${icon('grid')} Cards</button><button type="button" aria-pressed="${v === 'table' ? 'true' : 'false'}" data-act="view" data-mod="${mod}" data-view="table">${icon('table')} Table</button></div>`;
}
function recActions(rec, opts) {
  opts = opts || {};
  if (!rec) return '';
  return H`<button type="button" class="ow-btn ow-btn-sm" data-act="open-rec" data-key="${rec.key}">View details</button>
    <button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="pin" data-key="${rec.key}" aria-label="Add ${rec.title} to Session Board">${icon('pin')}Board</button>
    ${opts.noCompare ? '' : H`<button type="button" class="ow-btn ow-btn-sm ow-btn-ghost" data-act="compare" data-key="${rec.key}" aria-label="Add ${rec.title} to comparison">${icon('compare')}Compare</button>`}`;
}
function table(cols, rows, caption) {
  return H`<div class="ow-table-wrap"><table class="ow-table">${caption ? H`<caption>${caption}</caption>` : ''}<thead><tr>${cols.map(function (c) { return H`<th scope="col">${c.label}</th>`; })}</tr></thead><tbody>${rows.map(function (r) { return H`<tr>${cols.map(function (c) { return H`<td>${c.render ? c.render(r) : r[c.key]}</td>`; })}</tr>`; })}</tbody></table></div>`;
}
function linkoutPanel(srcIds, query, title) {
  return H`<div class="ow-card"><div class="ow-card-title">${title || 'Open official sources'}</div><p class="ow-subtle">${SAFETY.coverage}</p><div class="ow-card-foot">${srcIds.map(function (id) { var s = SRC[id]; return s ? extBtn(linkout(id, query), s.displayName) : ''; })}</div></div>`;
}
function slotView(key, opts) {
  opts = opts || {};
  var s = slot(key);
  if (s.status === 'idle') return opts.idle || '';
  if (s.status === 'loading') return opts.skeleton === false ? H`<p class="ow-row ow-muted"><span class="ow-spinner" aria-hidden="true"></span> Loading from ${SRC[s.src] ? SRC[s.src].displayName : 'source'}…</p>` : skeleton(opts.skeleton || 2);
  var lo = opts.linkout ? H`<div class="ow-card-foot">${arr(opts.linkout).map(function (l) { return extBtn(l.url, l.label); })}</div>` : '';
  if (s.status === 'error' || s.status === 'unavailable' || s.status === 'ratelimited') {
    var wait = s.status === 'ratelimited' && s.error && s.error.retryAt ? Math.max(0, Math.ceil((s.error.retryAt - Date.now()) / 1000)) : 0;
    return H`<div class="ow-notice ${s.status === 'ratelimited' ? 'ow-notice-warn' : 'ow-notice-bad'}" role="status">${icon('alert')}<div><strong>${friendlyError(s.error)}</strong>${wait ? H` <span class="ow-subtle">Requests to this source resume in about ${wait} s.</span>` : ''}${lo}<div class="ow-card-foot"><button type="button" class="ow-btn ow-btn-sm" data-act="retry-slot" data-key="${key}">${icon('refresh')}Retry</button></div></div></div>`;
  }
  if (s.status === 'empty') return opts.empty ? opts.empty(s.data) : H`<div class="ow-empty"><h3>No records</h3><p>${opts.emptyMsg || 'This query returned no records from this source.'}</p>${lo}</div>`;
  return safeRender(function () { return opts.render(s.data); }, opts.label);
}
function sectionHead(title, srcIds, extra) {
  return H`<div class="ow-section-title"><h3>${title}</h3>${arr(srcIds).map(function (id) { return SRC[id] ? badge(SRC[id].displayName, 'outline') : ''; })}${extra || ''}</div>`;
}
function statusBadge(s) {
  var k = { RECRUITING: 'good', NOT_YET_RECRUITING: 'cyan', ENROLLING_BY_INVITATION: 'cyan', ACTIVE_NOT_RECRUITING: 'warn', COMPLETED: '', TERMINATED: 'bad', WITHDRAWN: 'bad', SUSPENDED: 'bad', UNKNOWN: 'outline', AVAILABLE: 'good', APPROVED_FOR_MARKETING: 'good' }[s];
  return s ? badge(humanEnum(s), k == null ? 'outline' : k) : '';
}
function phaseBadges(p) { return arr(p).map(function (x) { return badge(String(x).replace('EARLY_PHASE1', 'Early Phase 1').replace(/^PHASE(\d)$/, 'Phase $1').replace('NA', 'Phase N/A'), 'variant'); }); }
function levelBadge(l) { var k = { A: 'good', B: 'variant', C: 'warn', D: 'bad', E: 'outline' }[l]; return l ? badge('Level ' + l, k) : ''; }
function sigBadge(s) {
  if (!s) return '';
  var k = /SENSITIV/.test(s) ? 'good' : /RESIST|REDUCED/.test(s) ? 'bad' : /OUTCOME/.test(s) ? 'protein' : /POSITIVE|NEGATIVE/.test(s) ? 'cyan' : /PATHOGENIC|PREDISPOS/.test(s) ? 'warn' : /ONCOGEN/.test(s) ? 'lit' : 'outline';
  return badge(humanEnum(s.replace('SENSITIVITYRESPONSE', 'SENSITIVITY_RESPONSE')), k);
}
function typeBadge(t) { var map = { gene: ['Gene', 'gene'], variant: ['Variant', 'variant'], rsid: ['rsID', 'variant'], hgvs: ['HGVS', 'variant'], drug: ['Drug', 'good'], disease: ['Disease', 'warn'], nct: ['Trial ID', 'cyan'], regid: ['Registry ID', 'cyan'], pmid: ['PMID', 'lit'], doi: ['DOI', 'lit'], device: ['Device / Dx', 'device'], concept: ['Concept', 'outline'], uniprot: ['Protein', 'protein'], ensembl: ['Ensembl ID', 'gene'], rxcui: ['RxCUI', 'good'], ambiguous: ['Ambiguous', 'bad'] }[t] || [t, 'outline']; return badge(map[0], map[1]); }
function classBadge(c) { if (!c) return ''; var k = /III/.test(c) ? 'bad' : /II/.test(c) ? 'warn' : /Class I/.test(c) ? 'good' : 'outline'; return badge(c, k); }
function recallBadge(c) { if (!c) return badge('Recall class not reported', 'outline'); var k = /Class I$/.test(c) ? 'bad' : /Class II$/.test(c) ? 'warn' : 'outline'; return badge(c + (/Class I$/.test(c) ? ' — potential serious harm' : ''), k); }
function pathwayBadge(d) {
  if (!d) return '';
  if (d.pathway === 'PMA') return badge(d.decision && d.decision.verb === 'approved' ? 'FDA-approved (PMA)' : 'PMA record — ' + (d.decision ? d.decision.label : 'verify'), d.decision && d.decision.verb === 'approved' ? 'good' : 'outline');
  if (d.pathway === 'De Novo') return badge(d.decision && d.decision.verb === 'granted' ? 'De Novo classification granted' : 'De Novo — verify', 'cyan');
  return badge(d.decision && d.decision.verb === 'cleared' ? 'FDA-cleared (510(k))' : '510(k) — ' + (d.decision ? d.decision.label : 'verify'), d.decision && d.decision.verb === 'cleared' ? 'variant' : (d.decision && d.decision.kind === 'bad' ? 'bad' : 'outline'));
}
function idChip(kind, value) {
  if (!value) return '';
  return H`<button type="button" class="ow-badge ow-b-outline" style="cursor:pointer" data-act="search" data-term="${value}" title="Explore ${kind} ${value}">${kind} ${value}</button>`;
}
function pager(mod, info) {
  // info: { page, hasPrev, hasNext, total, pageSize, label }
  return H`<nav class="ow-pager" aria-label="Pagination">
    <button type="button" class="ow-btn ow-btn-sm" data-act="page" data-mod="${mod}" data-dir="first" ${info.hasPrev ? '' : raw('disabled')}>First</button>
    <button type="button" class="ow-btn ow-btn-sm" data-act="page" data-mod="${mod}" data-dir="prev" ${info.hasPrev ? '' : raw('disabled')}>${icon('back')}Previous</button>
    <span>Page ${info.page + 1}${info.total != null && info.pageSize ? ' of ' + num(Math.max(1, Math.ceil(info.total / info.pageSize))) : ''}${info.total != null ? ' · ' + num(info.total) + ' ' + (info.label || 'records') : ''}</span>
    <button type="button" class="ow-btn ow-btn-sm" data-act="page" data-mod="${mod}" data-dir="next" ${info.hasNext ? '' : raw('disabled')}>Next${icon('chevron')}</button>
    ${info.last ? H`<button type="button" class="ow-btn ow-btn-sm" data-act="page" data-mod="${mod}" data-dir="last" ${info.hasNext ? '' : raw('disabled')}>Last</button>` : ''}
  </nav>`;
}
function noQuery(what) {
  return H`<div class="ow-empty"><h3>Start with a search</h3><p>Search a gene, variant, drug, device, diagnostic, disease, or trial ID to populate ${what || 'this module'}.</p></div>`;
}

/* ---- capability / mode badges ---- */
Object.assign(ICON_PATHS, {
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><circle cx="12" cy="12" r="3.5"/><path d="M12 6.5v2M12 15.5v2M6.5 12h2M15.5 12h2"/>',
  syringe: '<path d="M18 2l4 4M15 5l4 4M17 7l-9.5 9.5-3-3L14 4M7.5 13.5l3 3M4.5 16.5L2 22l5.5-2.5"/>',
  seed: '<path d="M12 21c0-6 0-9 4-13 2-2 5-2.5 6-2.5 0 1-.5 4-2.5 6-4 4-7.5 4-7.5 4"/><path d="M12 21c0-4-1-6-3.5-8.5C6.5 10.5 4 10 3 10c0 1 .5 3.5 2.5 5.5C8 18 12 18 12 18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
});
var MODE_LABEL = { live: ['Live', 'good'], verify: ['Verify (live candidate)', 'warn'], linkout: ['Link-out', 'outline'], 'authenticated-optional': ['Authenticated (optional)', 'outline'], 'developer-reference': ['Developer reference', 'dev'], 'patient-education': ['Patient education', 'edu'], 'ai-derived-optional': ['AI-derived (verify-only)', 'ai'], 'imaging-source': ['Imaging page only', 'img'], unavailable: ['Unavailable', 'bad'], 'rate-limited': ['Rate-limited', 'warn'], download: ['Download', 'outline'] };
function modeBadge(id) { var m = Runtime[id] ? Runtime[id].mode : (SRC[id] || {}).defaultMode; var L = MODE_LABEL[m] || [titleCase(m || ''), 'outline']; return badge(L[0], L[1], (SRC[id] ? SRC[id].lastVerifiedNote : '') || ''); }
function flagBadges(s) { if (!s) return ''; return FLAG_DEFS.filter(function (f) { return s[f[0]] && !(f[0] === 'controlledAccessProhibited'); }).map(function (f) { return badge(f[1], f[2]); }).concat(s.mayLagOfficialDb && s.id !== 'openfda-device' ? [] : []); }
ACTIONS['rail-more'] = function () { ui('_rail').more = !(ui('_rail').more || RAIL_PRIMARY.indexOf(State.module) < 0); if (!ui('_rail').more && RAIL_PRIMARY.indexOf(State.module) < 0) setModule('overview', { quiet: true }); scheduleRender(); };
