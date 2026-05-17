// Main entry: install guard, document-level listeners that aren't part of
// a specific module, message bridge to background.js, and the kick-off.
//
// Module load order is set in manifest.json content_scripts.js array:
//   10-i18n → 20-core → 30-storage → 40-range → 50-theme → 60-mark → 70-ui →
//   80-spa → 90-content
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  // Re-injection guard. Important because some sites cause content scripts to
  // be re-evaluated (e.g. extensive use of history.replaceState during boot).
  if (window.__whInstalled) return;
  window.__whInstalled = true;

  // ---------- Selection → highlight ----------
  document.addEventListener('mouseup', e => {
    if (!wh.cache.enabled) return;
    if (e.target.closest('#wh-toolbar') || e.target.closest('#wh-popup')) return;
    if (e.target.closest('.wh-mark')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      wh.applyHighlight(sel.getRangeAt(0), wh.cache.lastColor, wh.cache.lastStyle);
      sel.removeAllRanges();
    }, 0);
  });

  // ---------- Keyboard ----------
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    // Esc closes the popup.
    if (e.key === 'Escape' && wh.popup && wh.popup.style.display !== 'none') {
      wh.popup.style.display = 'none';
      wh.activeMarkId = null;
      return;
    }
    // ⌘/Ctrl + Enter in the note textarea saves.
    if (e.target && e.target.id === 'wh-popup-note' && mod && e.key === 'Enter') {
      e.preventDefault();
      const note = e.target.value.trim();
      if (wh.activeMarkId) wh.setMarkNote(wh.activeMarkId, note);
      wh.popup.style.display = 'none';
      wh.renderSidebar();
      return;
    }
    // ⌘/Ctrl + Shift + Z = undo (except inside form fields).
    if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      wh.doUndo();
    }
  }, true);

  // ---------- Bridge to background.js (toolbar icon click + keyboard command) ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (!wh.toolbar) return;
    if (msg.type === 'wh-toggle-toolbar') {
      wh.toolbar.style.display = (wh.toolbar.style.display === 'none') ? 'flex' : 'none';
    } else if (msg.type === 'wh-undo') {
      wh.doUndo();
    }
  });

  // ---------- Boot ----------
  wh.loadAll().then(() => {
    wh.buildUI();
    wh.bodyObserver.observe(document.body, { childList: true, subtree: false });
    if (document.body.firstElementChild) {
      wh.bodyObserver.observe(document.body.firstElementChild, { childList: true, subtree: true });
    }
    wh.watchTheme();
    setTimeout(() => {
      const pending = wh.restore();
      if (pending > 0) setTimeout(wh.restore, 1500);
      wh.refreshTheme();
    }, 300);
  });
})();
