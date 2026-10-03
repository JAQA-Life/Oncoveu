/** @type {AppTypes.Config} */
/*
 * Oncotics Imaging Workbench — OHIF configuration (privacy-hardened).
 *
 * Build:  oncotics/scripts/build-ohif.sh   (PUBLIC_URL=/assets/ohif/ APP_CONFIG=config/oncotics.js)
 * Host:   https://oncotics.com/assets/ohif/  — embedded only by https://oncotics.com/imaging/
 *         after the user clicks "Open OHIF".
 *
 * What this configuration guarantees (without modifying OHIF core):
 *  - Browser storage used by OHIF for preferences (hotkeys, tool bindings, worklist
 *    filters, series-description history, investigational-use acknowledgement) is
 *    replaced with an IN-MEMORY Storage shim for this frame, so nothing survives a reload.
 *  - Any previously registered service worker for this scope is unregistered; none is
 *    registered.
 *  - Data sources: "dicomlocal" (files you drop are read in browser memory) and, only when
 *    the parent Workbench hands one over, the user's own DICOMweb endpoint. The endpoint
 *    URL and optional Authorization value arrive through a ONE-TIME, SAME-ORIGIN, in-memory
 *    bridge (window.parent.OncoticsImaging.consumeOhifBridge) — never through a URL,
 *    query string, storage or network request.
 *  - STOW-RS / upload is disabled unless the user explicitly enabled it in the Workbench.
 *  - The OHIF investigational-use dialog is turned off because the Workbench shows its own
 *    consent, PHI and non-diagnostic warnings before this frame is ever loaded.
 *  - HTTP errors are not logged to the console (no URLs or identifiers in logs).
 */
(function oncoticsMemoryOnlyStorage() {
  function MemoryStorage() {
    var map = new Map();
    return {
      get length() { return map.size; },
      key: function (i) { return Array.from(map.keys())[i] || null; },
      getItem: function (k) { k = String(k); return map.has(k) ? map.get(k) : null; },
      setItem: function (k, v) { map.set(String(k), String(v)); },
      removeItem: function (k) { map.delete(String(k)); },
      clear: function () { map.clear(); },
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    try {
      Object.defineProperty(window, name, { configurable: true, enumerable: true, value: MemoryStorage() });
    } catch (e) {
      /* If the browser refuses, OHIF falls back to its own defensive defaults. */
    }
  });
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      });
    }
  } catch (e) {
    /* ignore */
  }
})();

window.config = function oncoticsConfig({ servicesManager }) {
  var bridge = null;
  try {
    if (
      window.parent &&
      window.parent !== window &&
      window.parent.location.origin === window.location.origin &&
      window.parent.OncoticsImaging &&
      typeof window.parent.OncoticsImaging.consumeOhifBridge === 'function'
    ) {
      bridge = window.parent.OncoticsImaging.consumeOhifBridge();
    }
  } catch (e) {
    bridge = null;
  }
  var isHttps = function (u) {
    try {
      var x = new URL(u);
      return x.protocol === 'https:' || (x.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(x.hostname));
    } catch (e) {
      return false;
    }
  };
  var hasEndpoint = !!(bridge && bridge.qidoRoot && isHttps(bridge.qidoRoot) && (!bridge.wadoRoot || isHttps(bridge.wadoRoot)));

  var dataSources = [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: { friendlyName: 'Local files (read in browser memory)' },
    },
  ];
  if (hasEndpoint) {
    dataSources.push({
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'oncotics-user-dicomweb',
      configuration: {
        friendlyName: 'Your DICOMweb endpoint (memory only)',
        name: 'oncotics-user-dicomweb',
        qidoRoot: bridge.qidoRoot,
        wadoRoot: bridge.wadoRoot || bridge.qidoRoot,
        wadoUriRoot: bridge.wadoRoot || bridge.qidoRoot,
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        supportsReject: false,
        supportsStow: !!bridge.stow,
        dicomUploadEnabled: !!bridge.stow,
        omitQuotationForMultipartRequest: true,
      },
    });
  }

  // Optional Authorization value: registered on the user authentication service once it
  // exists (services are registered right after this function returns). Memory only.
  if (hasEndpoint && bridge.authorization) {
    var header = String(bridge.authorization);
    var tries = 0;
    var install = function () {
      var svc = servicesManager && servicesManager.services && servicesManager.services.userAuthenticationService;
      if (svc && svc.setServiceImplementation) {
        svc.setServiceImplementation({ getAuthorizationHeader: function () { return { Authorization: header }; } });
        return;
      }
      if (tries++ < 250) setTimeout(install, 20);
    };
    setTimeout(install, 0);
  }

  return {
    name: 'config/oncotics.js',
    routerBasename: null,
    extensions: [],
    modes: [],
    customizationService: {},
    showStudyList: true,
    investigationalUseDialog: { option: 'never' },
    maxNumberOfWebWorkers: 3,
    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    showLoadingIndicator: true,
    strictZSpacingForVolumeViewport: true,
    groupEnabledModesFirst: true,
    allowMultiSelectExport: false,
    showErrorDetails: 'dev',
    maxNumRequests: { interaction: 100, thumbnail: 5, prefetch: 25 },
    defaultDataSourceName: hasEndpoint ? 'oncotics-user-dicomweb' : 'dicomlocal',
    dataSources: dataSources,
    // Do not log request errors (they can contain endpoint URLs or study identifiers).
    httpErrorHandler: function () {},
  };
};
