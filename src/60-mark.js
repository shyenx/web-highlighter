// Mark operations: create / recolor / restyle / annotate / delete + restore +
// undo. These mutate cache.pageMarks and persist via saveMarks().
// Sidebar re-render is the responsibility of the caller (most call sites
// already trigger renderSidebar() after these).
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  wh.applyHighlight = function applyHighlight(range, color, style) {
    if (!range || range.collapsed) return;
    const text = range.toString();
    if (!text.trim()) return;
    const id = 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    wh.wrapRange(range, color, id, '', style);
    wh.cache.pageMarks.push({ id, color, style, text, ctx: wh.contextOf(text), note: '' });
    wh.saveMarks();
    wh.pushUndo({ type: 'add', id });
    wh.renderSidebar();
  };

  wh.changeMarkColor = function changeMarkColor(id, color, skipUndo) {
    const m = wh.cache.pageMarks.find(x => x.id === id);
    const prev = m ? m.color : null;
    const style = m?.style || 'bg';
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      wh.applyAppearance(el, color, style);
    });
    if (m) { m.color = color; wh.saveMarks(); }
    if (!skipUndo && prev != null) wh.pushUndo({ type: 'recolor', id, prev });
  };

  wh.changeMarkStyle = function changeMarkStyle(id, style, skipUndo) {
    const m = wh.cache.pageMarks.find(x => x.id === id);
    const prev = m ? (m.style || 'bg') : null;
    const color = m?.color || wh.cache.lastColor;
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      wh.applyAppearance(el, color, style);
    });
    if (m) { m.style = style; wh.saveMarks(); }
    if (!skipUndo && prev != null) wh.pushUndo({ type: 'restyle', id, prev });
  };

  wh.removeMark = function removeMark(id, skipUndo) {
    const snapshot = wh.cache.pageMarks.find(x => x.id === id);
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(wh.unwrap);
    wh.cache.pageMarks = wh.cache.pageMarks.filter(x => x.id !== id);
    wh.saveMarks();
    if (!skipUndo && snapshot) wh.pushUndo({ type: 'remove', snapshot });
    wh.renderSidebar();
  };

  wh.setMarkNote = function setMarkNote(id, note) {
    const m = wh.cache.pageMarks.find(x => x.id === id);
    if (!m) return;
    const prev = m.note || '';
    m.note = note;
    wh.saveMarks();
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      if (note) {
        el.dataset.whNote = '1';
        el.title = note;
      } else {
        delete el.dataset.whNote;
        el.removeAttribute('title');
      }
    });
    wh.pushUndo({ type: 'note', id, prev });
  };

  wh.doUndo = function doUndo() {
    const a = wh.undoStack.pop();
    if (!a) return;
    if (a.type === 'add')      wh.removeMark(a.id, true);
    else if (a.type === 'recolor') wh.changeMarkColor(a.id, a.prev, true);
    else if (a.type === 'restyle') wh.changeMarkStyle(a.id, a.prev, true);
    else if (a.type === 'note')    wh.setMarkNote(a.id, a.prev);
    else if (a.type === 'remove') {
      const m = a.snapshot;
      const r = wh.findTextRange(m.text, m.ctx);
      if (r) wh.wrapRange(r, m.color, m.id, m.note, m.style);
      wh.cache.pageMarks.push(m);
      wh.saveMarks();
    } else if (a.type === 'clear') {
      wh.cache.pageMarks = a.marks.slice();
      wh.saveMarks();
      a.marks.forEach(m => {
        const r = wh.findTextRange(m.text, m.ctx);
        if (r) wh.wrapRange(r, m.color, m.id, m.note, m.style);
      });
    }
    wh.renderSidebar();
  };

  // Re-attach marks for the current page based on cache.pageMarks.
  // Returns count of marks that couldn't be located (caller may schedule a retry).
  wh.restore = function restore() {
    let pending = 0;
    wh.cache.pageMarks.forEach(m => {
      if (document.querySelector(`.wh-mark[data-wh-id="${m.id}"]`)) return;
      const r = wh.findTextRange(m.text, m.ctx);
      if (r) wh.wrapRange(r, m.color, m.id, m.note, m.style);
      else pending++;
    });
    wh.renderSidebar();
    return pending;
  };
})();
