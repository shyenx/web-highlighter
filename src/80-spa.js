// SPA support: hook history.pushState/replaceState, listen for popstate/
// hashchange/our own 'wh:locationchange' event. On URL change, reload page
// marks under the new key and re-run restore.
//
// History-patch is intentionally one-shot (not re-patched on every URL change)
// because that was the cause of regressions in v0.5.1.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  // URL change handler. v0.3.0-style single-pass with I7 fix
  // (currentKey updated only after storage read succeeds).
  let urlChangeBusy = false;
  wh.onUrlChange = async function onUrlChange() {
    const newKey = wh.pageKey();
    if (newKey === wh.currentKey) return;
    if (urlChangeBusy) return;
    urlChangeBusy = true;
    try {
      // Refresh theme immediately to avoid a 300 ms light/dark flash.
      if (wh.toolbar) wh.refreshTheme();
      wh.undoStack.length = 0;
      wh.activeMarkId = null;
      if (wh.popup) wh.popup.style.display = 'none';
      const nextMarks = await wh.reloadPageMarksOnly(newKey);
      wh.currentKey = newKey;
      // Only unwrap marks whose id no longer exists in the new bucket — keeps
      // matching marks visible across navigation without an un-highlight flash.
      const keepIds = new Set(nextMarks.map(m => m.id));
      const stale = Array.from(document.querySelectorAll('.wh-mark'))
        .filter(el => !keepIds.has(el.dataset.whId));
      wh.unwrapMarks(stale);
      wh.cache.pageMarks = nextMarks;
      wh.ensureUIAttached();
      setTimeout(() => {
        const pending = wh.restore();
        if (pending > 0) setTimeout(wh.restore, 1500);
        wh.refreshTheme();
      }, 300);
    } finally {
      urlChangeBusy = false;
    }
  };

  // Patch history methods to emit a single 'wh:locationchange' event. One-shot:
  // if another extension or page script later overwrites these, we won't fight
  // back (that proved to cause regressions on some sites in v0.5.1).
  (function patchHistory() {
    const fire = () => window.dispatchEvent(new Event('wh:locationchange'));
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    try {
      history.pushState = function () {
        const r = origPush.apply(this, arguments);
        fire();
        return r;
      };
      history.replaceState = function () {
        const r = origReplace.apply(this, arguments);
        fire();
        return r;
      };
    } catch (e) {}
    window.addEventListener('popstate', fire);
    window.addEventListener('hashchange', fire);
  })();
  window.addEventListener('wh:locationchange', wh.onUrlChange);

  // Body observer: re-attach UI if a SPA host removes it, and re-run restore
  // (throttled) when large new content lands (lazy-loaded articles).
  let restoreThrottle = 0;
  wh.bodyObserver = new MutationObserver((mutations) => {
    let uiGone = false;
    let bigChange = false;
    for (const mu of mutations) {
      if (mu.removedNodes && mu.removedNodes.length) {
        for (const n of mu.removedNodes) {
          if (n === wh.toolbar || n === wh.popup || n === wh.sidebar) uiGone = true;
        }
      }
      if (mu.addedNodes && mu.addedNodes.length >= 3) bigChange = true;
    }
    if (uiGone) wh.ensureUIAttached();
    if (bigChange && wh.cache.pageMarks.length) {
      clearTimeout(restoreThrottle);
      restoreThrottle = setTimeout(() => wh.restore(), 800);
    }
  });
})();
