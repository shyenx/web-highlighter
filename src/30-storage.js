// Storage wrappers around chrome.storage.local.
// - currentKey tracks which page-bucket subsequent saveMarks() writes to.
// - safeSet wraps chrome.storage.local.set with try/catch + console.warn,
//   so quota errors don't silently corrupt state.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  wh.pageKey = function pageKey() {
    return 'wh::' + location.host + location.pathname;
  };
  wh.currentKey = wh.pageKey();

  wh.safeSet = function safeSet(obj) {
    try {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          console.warn('[web-highlighter] storage.set failed:', chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn('[web-highlighter] storage.set threw:', err);
    }
  };

  // Hydrate the whole cache (called once at startup).
  wh.loadAll = function loadAll() {
    return new Promise((resolve) => {
      const keys = [wh.currentKey, 'wh::lastColor', 'wh::lastStyle', 'wh::enabled', 'wh::toolbarPos', 'wh::lang'];
      chrome.storage.local.get(keys, (res) => {
        wh.cache.pageMarks  = res[wh.currentKey] || [];
        wh.cache.lastColor  = res['wh::lastColor']  || wh.COLORS[0];
        wh.cache.lastStyle  = res['wh::lastStyle']  || 'bg';
        wh.cache.enabled    = res['wh::enabled']    !== false;
        wh.cache.toolbarPos = res['wh::toolbarPos'] || null;
        wh.cache.lang       = res['wh::lang']       || wh.detectLang();
        resolve();
      });
    });
  };

  // Reload only the per-URL page marks (after SPA navigation). Does not touch
  // user preferences (color/style/lang/toolbarPos).
  wh.reloadPageMarksOnly = function reloadPageMarksOnly(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => resolve(res[key] || []));
    });
  };

  // saveMarks always writes to currentKey at call time, so it's safe to call
  // immediately after currentKey is updated on URL change.
  wh.saveMarks      = function () { wh.safeSet({ [wh.currentKey]: wh.cache.pageMarks }); };
  wh.saveLastColor  = function () { wh.safeSet({ 'wh::lastColor':  wh.cache.lastColor  }); };
  wh.saveLastStyle  = function () { wh.safeSet({ 'wh::lastStyle':  wh.cache.lastStyle  }); };
  wh.saveEnabled    = function () { wh.safeSet({ 'wh::enabled':    wh.cache.enabled    }); };
  wh.saveToolbarPos = function () { wh.safeSet({ 'wh::toolbarPos': wh.cache.toolbarPos }); };
  wh.saveLang       = function () { wh.safeSet({ 'wh::lang':       wh.cache.lang       }); };
})();
