// Core: constants, shared cache, undo stack, UI element refs, tiny utilities.
// Other modules read/write through window.__wh.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  wh.COLORS = ['#fff36b', '#a8e6a3', '#ffb3ba', '#bae1ff', '#e0bbff'];

  // Style preview strings are interpolated into inline `style="..."` attributes
  // in toolbar/popup templates (see 70-ui.js). `label` is the glyph rendered
  // inside the swatch button.
  wh.STYLES = [
    { key: 'bg',        label: 'A', preview: c => `background:${c};` },
    { key: 'underline', label: 'A', preview: c => `text-decoration:underline;text-decoration-color:${c};text-decoration-thickness:2px;text-underline-offset:2px;` },
    { key: 'strike',    label: 'A', preview: c => `text-decoration:line-through;text-decoration-color:${c};text-decoration-thickness:2px;` },
    { key: 'wavy',      label: 'A', preview: c => `text-decoration:underline wavy;text-decoration-color:${c};text-decoration-thickness:1.5px;text-underline-offset:2px;` },
  ];

  // In-memory mirror of chrome.storage.local. Hydrated by loadAll() in 30-storage.js.
  wh.cache = {
    pageMarks: [],
    lastColor: wh.COLORS[0],
    lastStyle: 'bg',
    enabled: true,
    toolbarPos: null,
    lang: wh.detectLang(),
  };

  // Undo stack: last 50 actions. Cleared on URL change (SPA).
  wh.undoStack = [];
  wh.UNDO_MAX = 50;
  wh.pushUndo = function pushUndo(a) {
    wh.undoStack.push(a);
    if (wh.undoStack.length > wh.UNDO_MAX) wh.undoStack.shift();
  };

  // UI element references (assigned by buildUI in 70-ui.js, may be re-attached
  // by ensureUIAttached after SPA navigation removes them from the body).
  wh.toolbar = null;
  wh.popup = null;
  wh.sidebar = null;
  // Currently-open mark in the inline popup (null when popup is closed).
  wh.activeMarkId = null;

  // HTML escape for user-controlled text rendered into innerHTML (sidebar items).
  wh.escapeHtml = function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  };
})();
