
/* ====================================================================
   APPLICATION STATE (in memory only)
   ==================================================================== */
var State = {
  gen: 0,                 // search generation; stale responses are dropped
  entity: null,           // resolved entity for the current search
  ctx: null,              // normalized context used by modules
  slots: new Map(),       // key -> { status, data, error, src, at, promise }
  records: new Map(),     // key -> { key, type, title, source, data, prov }
  failed: new Map(),      // slot key -> { src, retry }
  board: [],              // pinned record snapshots
  compare: {},            // type -> [record snapshots]
  ui: {},                 // per-module view state (filters, pages, view mode)
  module: 'overview',
  prefs: { theme: 'system', density: 'comfortable', hiddenModules: new Set(), disabledSources: new Set() },
  keys: { openfda: '', s2: '', oncokb: '' },  // optional user-entered keys: memory only, never logged/exported
  interp: null,           // current Search Interpretation (memory only)
  nav: [], navIndex: -1,  // relationship explorer back/forward (memory only)
  searchCtrl: null,
  lastFetch: null,
  conflicts: []
};
function ui(mod) { return State.ui[mod] || (State.ui[mod] = {}); }

/* ====================================================================
   NET: request queue + concurrency manager + abort/timeout handling
   ==================================================================== */
function mkErr(kind, src, status, extra) { var e = new Error(kind); e.kind = kind; e.src = src; e.status = status || null; if (extra) Object.assign(e, extra); return e; }
var Net = (function () {
  var active = 0, queue = [], per = {}, memo = new Map(), timer = null;
  function ps(id) { return per[id] || (per[id] = { active: 0, lastStart: 0 }); }
  function pump() {
    timer = null;
    var now = Date.now(), wait = Infinity;
    for (var i = 0; i < queue.length; i++) {
      var w = queue[i];
      if (w.cancelled) { queue.splice(i--, 1); continue; }
      if (active >= CONFIG.globalConcurrency) break;
      var s = SRC[w.src], p = ps(w.src), rt = Runtime[w.src];
      if (p.active >= (s.concurrencyLimit || 1)) continue;
      var readyAt = Math.max(p.lastStart + (s.minIntervalMs || 0), rt.pausedUntil || 0);
      if (now < readyAt) { wait = Math.min(wait, readyAt - now); continue; }
      queue.splice(i--, 1); active++; p.active++; p.lastStart = now; w.start();
    }
    if (queue.length && !timer) timer = setTimeout(pump, isFinite(wait) ? Math.max(25, wait) : 100);
  }
  function acquire(src, signal) {
    return new Promise(function (resolve, reject) {
      var w = { src: src, started: false, cancelled: false };
      w.start = function () { w.started = true; resolve(); };
      if (signal) {
        if (signal.aborted) return reject(mkErr('aborted', src));
        signal.addEventListener('abort', function () { if (!w.started) { w.cancelled = true; reject(mkErr('aborted', src)); } }, { once: true });
      }
      queue.push(w); pump();
    });
  }
  function release(src) { active = Math.max(0, active - 1); ps(src).active = Math.max(0, ps(src).active - 1); pump(); }
  function note(src, kind, status, label) {
    var rt = Runtime[src]; if (!rt) return;
    rt.lastStatus = status || kind; rt.lastAt = Date.now();
    if (kind === 'ok') { rt.ok++; if (rt.mode !== 'linkout') rt.mode = 'live'; return; }
    rt.fail++;
    // Developer detail keeps only kind/status/endpoint label: never URLs or search terms.
    rt.errors.unshift({ kind: kind, status: status || null, endpoint: label || '', at: Date.now() });
    rt.errors.length = Math.min(rt.errors.length, 8);
    if (kind === 'network' || kind === 'server') rt.mode = 'unavailable';
  }
  async function request(src, url, opts) {
    opts = opts || {};
    var s = SRC[src], rt = Runtime[src];
    if (!s) throw mkErr('config', src);
    if (!FETCHABLE_MODES[rt.mode]) throw mkErr('linkout', src);
    // A source configured as "verify" (none by default) is called only from an explicit user action.
    if (rt.mode === 'verify' && !opts.tryVerify && !opts.force) { rt.skipped++; throw mkErr('verify', src); }
    if (State.prefs.disabledSources && State.prefs.disabledSources.has(src)) { rt.skipped++; throw mkErr('disabled', src); }
    if (rt.mode === 'unavailable' && !opts.force) { rt.skipped++; throw mkErr('unavailable', src); }
    var method = opts.method || 'GET';
    var body = opts.body != null ? JSON.stringify(opts.body) : undefined;
    var memoKey = method + ' ' + url + ' ' + (body || '');
    if (!opts.noCache && memo.has(memoKey)) return memo.get(memoKey);
    var finalUrl = url;
    if (/^openfda/.test(src) && State.keys.openfda) finalUrl += (url.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + encodeURIComponent(State.keys.openfda);
    await acquire(src, opts.signal);
    var ctrl = new AbortController(), timedOut = false;
    var tm = setTimeout(function () { timedOut = true; ctrl.abort(); }, opts.timeoutMs || s.timeoutMs);
    function onAbort() { ctrl.abort(); }
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });
    var headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (opts.headers) Object.keys(opts.headers).forEach(function (h) { if (opts.headers[h]) headers[h] = opts.headers[h]; });
    var res, text;
    try {
      res = await fetch(finalUrl, { method: method, headers: headers, body: body, signal: ctrl.signal, cache: 'no-store', credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', redirect: 'follow' });
      text = await res.text();
    } catch (e) {
      clearTimeout(tm); release(src);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      if (timedOut) { note(src, 'timeout', null, opts.label); throw mkErr('timeout', src); }
      if (opts.signal && opts.signal.aborted) throw mkErr('aborted', src);
      var kind = navigator.onLine === false ? 'offline' : 'network';
      note(src, kind, null, opts.label);
      throw mkErr(kind, src);
    }
    clearTimeout(tm); release(src);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    var st = res.status;
    if (st === 404 && opts.notFoundEmpty) { note(src, 'ok', st); if (!opts.noCache) memo.set(memoKey, null); return null; }
    if (st === 429 || (st === 503 && /ServerBusy|Too many requests/i.test(text || ''))) {
      var ra = parseInt(res.headers.get('Retry-After') || '', 10);
      rt.pausedUntil = Date.now() + (isFinite(ra) && ra > 0 ? ra * 1000 : 20000);
      rt.rate++; rt.mode = 'rate-limited'; rt.lastStatus = st; rt.lastAt = Date.now();
      throw mkErr('ratelimit', src, st, { retryAt: rt.pausedUntil });
    }
    if (st >= 500) { note(src, 'server', st, opts.label); throw mkErr('server', src, st); }
    if (st === 422 && src === 'civic' && isNullOrigin()) { note(src, 'http', st, opts.label); throw mkErr('nullorigin', src, st); }
    if (st < 200 || st >= 300) { note(src, 'http', st, opts.label); throw mkErr('http', src, st); }
    var data;
    if (opts.text) data = text;
    else {
      try { data = text ? JSON.parse(text) : null; } catch (e) { note(src, 'parse', st, opts.label); throw mkErr('parse', src, st); }
    }
    if (data && data.errors && Array.isArray(data.errors) && !data.data && opts.graphql) { note(src, 'http', st, opts.label); throw mkErr('graphql', src, st); }
    note(src, 'ok', st);
    State.lastFetch = Date.now();
    if (!opts.noCache) memo.set(memoKey, data);
    return data;
  }
  return {
    request: request,
    clearMemo: function () { memo.clear(); },
    cancelAll: function () { queue.forEach(function (w) { w.cancelled = true; }); queue = []; },
    stats: function () { return { active: active, queued: queue.length }; }
  };
})();
function isNullOrigin() { try { return location.protocol === 'file:' || window.origin === 'null' || location.origin === 'null'; } catch (e) { return true; } }

function friendlyError(e) {
  var k = e && e.kind;
  var name = e && e.src && SRC[e.src] ? SRC[e.src].displayName : 'This source';
  switch (k) {
    case 'ratelimit': return 'Request limit reached for ' + name + '. Please wait a moment and retry.';
    case 'timeout': return name + ' took too long to respond. You can retry or open the official source instead.';
    case 'offline': return 'You appear to be offline. Reconnect and retry.';
    case 'network': return 'Live request unavailable from this browser: ' + name + ' could not be reached (it may be temporarily down, rate-limiting, or blocking browser access). Open the source directly.';
    case 'unavailable': return name + ' is marked unavailable for this session after an earlier failure. Use Retry to try again, or open the official source.';
    case 'linkout': return 'This source is link-out only. Open the official source instead.';
    case 'verify': return name + ' is not called automatically in this configuration. Open the official source instead.';
    case 'auth': return name + ' needs a licensed token that you supply (kept in memory only). Open the official source instead.';
    case 'disabled': return 'You turned off live requests to ' + name + ' for this session (Coverage Console). Open the official source instead.';
    case 'server': return 'This source is temporarily unavailable. You can open the official source instead.';
    case 'nullorigin': return 'CIViC rejects pages opened as local files (file://) or in sandboxed frames. Serve the page from a web address (e.g. python3 -m http.server) and retry.';
    case 'parse': return 'This source returned a response Oncotics could not read. Other sources are still shown.';
    case 'graphql': case 'http': return 'This query was not accepted by ' + name + (e.status ? ' (HTTP ' + e.status + ')' : '') + '. Try a different query format or open the official source.';
    case 'shape': return 'Unavailable in the current public API response.';
    default: return 'Some results could not be loaded. Other sources are still shown.';
  }
}

/* ====================================================================
   SLOTS: keyed async loads (render reads slots; failures are isolated)
   ==================================================================== */
function slot(key) { return State.slots.get(key) || { status: 'idle' }; }
function load(key, src, fn, opts) {
  opts = opts || {};
  var cur = State.slots.get(key);
  if (cur && !opts.force && (cur.status === 'loading' || cur.status === 'ok' || cur.status === 'empty')) return cur.promise || Promise.resolve(cur.data);
  if (Runtime[src] && Runtime[src].mode === 'unavailable' && !opts.force) {
    Runtime[src].skipped++;
    State.slots.set(key, { status: 'unavailable', src: src, error: mkErr('unavailable', src) });
    State.failed.set(key, { src: src, retry: function () { return load(key, src, fn, { force: true }); } });
    scheduleRender(); return Promise.resolve(null);
  }
  if (opts.force && Runtime[src] && (Runtime[src].mode === 'unavailable' || Runtime[src].mode === 'rate-limited')) Runtime[src].mode = SRC[src].defaultMode === 'verify' && !Runtime[src].ok ? 'verify' : 'live';
  var gen = State.gen;
  var signal = State.searchCtrl ? State.searchCtrl.signal : undefined;
  var entry = { status: 'loading', src: src };
  State.slots.set(key, entry);
  scheduleRender();
  entry.promise = (async function () {
    try {
      var data = await fn(signal);
      if (gen !== State.gen) return null;
      var empty = data == null || data.empty === true;
      State.failed.delete(key);
      State.slots.set(key, { status: empty ? 'empty' : 'ok', data: data, src: src, at: Date.now() });
      scheduleRender();
      return data;
    } catch (e) {
      if (gen !== State.gen || (e && e.kind === 'aborted')) return null;
      var st = e && e.kind === 'ratelimit' ? 'ratelimited' : (e && (e.kind === 'unavailable' || e.kind === 'linkout' || e.kind === 'disabled' || e.kind === 'verify' || e.kind === 'auth') ? 'unavailable' : 'error');
      State.slots.set(key, { status: st, error: e, src: src });
      State.failed.set(key, { src: src, retry: function () { return load(key, src, fn, { force: true }); } });
      scheduleRender();
      announce(friendlyError(e), true);
      return null;
    }
  })();
  return entry.promise;
}
function retryFailed() {
  var items = Array.from(State.failed.values());
  if (!items.length) { toast('Nothing to retry.'); return; }
  items.forEach(function (f) { var rt = Runtime[f.src]; if (rt && FETCHABLE_MODES[rt.mode] && rt.mode !== 'verify') { rt.mode = SRC[f.src].defaultMode === 'verify' && !rt.ok ? 'verify' : 'live'; rt.pausedUntil = 0; } });
  State.failed.clear();
  items.forEach(function (f) { try { f.retry(); } catch (e) { /* isolated */ } });
  toast('Retrying ' + items.length + ' request' + (items.length > 1 ? 's' : '') + '…');
}
function slotsBy(prefix) { var out = []; State.slots.forEach(function (v, k) { if (k.indexOf(prefix) === 0) out.push([k, v]); }); return out; }
function partialFailure() { var n = 0; State.slots.forEach(function (v) { if (v.status === 'error' || v.status === 'unavailable' || v.status === 'ratelimited') n++; }); return n; }
function loadingCount() { var n = 0; State.slots.forEach(function (v) { if (v.status === 'loading') n++; }); return n; }

/* ====================================================================
   RECORDS (normalized entities with provenance; memory only)
   Provenance categories: source-reported | normalized | derived |
   linkout | unavailable | ambiguous | may-lag
   ==================================================================== */
function prov(src, endpoint, recordId, url, extra) {
  var p = { source: src, sourceName: SRC[src] ? SRC[src].displayName : src, runtimeMode: Runtime[src] ? Runtime[src].mode : null, endpoint: endpoint, recordId: recordId || null, url: safeUrl(url || '') || null, retrievedAt: isoNow(), category: 'source-reported', mayLag: !!(SRC[src] && SRC[src].mayLagOfficialDb && src === 'openfda-device') };
  if (extra) Object.assign(p, extra);
  return p;
}
function putRecord(type, title, src, data, p) {
  var key = uid('r');
  var rec = { key: key, type: type, title: String(title || 'Untitled'), source: src, data: data, prov: p };
  State.records.set(key, rec);
  return rec;
}
function snapshot(rec) { return JSON.parse(JSON.stringify({ key: rec.key, type: rec.type, title: rec.title, source: rec.source, data: rec.data, prov: rec.prov })); }
