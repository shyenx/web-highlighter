// Range / text-node operations: wrapping a Range in <span class="wh-mark">,
// unwrapping, finding a range by text + context on restore.
//
// Known limitations (carry-over from earlier versions, to be revisited):
//  - contextOf uses body.innerText (whitespace-collapsed), findTextRange walks
//    raw text-node concatenation — context matching is best-effort.
//  - acceptNode in textNodesInRange does not reject .wh-mark, so highlighting
//    over an existing highlight can nest spans.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  // Apply color + style as inline styles + data attributes on a mark span.
  // Clears all decoration sub-properties first so style switches don't leave
  // stale values (e.g. wavy→underline should drop wavy thickness).
  wh.applyAppearance = function applyAppearance(el, color, style) {
    el.dataset.whStyle = style;
    el.dataset.whColor = color;
    el.style.background = '';
    el.style.textDecoration = '';
    el.style.textDecorationColor = '';
    el.style.textDecorationThickness = '';
    el.style.textUnderlineOffset = '';
    if (style === 'bg') {
      el.style.backgroundColor = color;
    } else if (style === 'underline') {
      el.style.textDecoration = 'underline';
      el.style.textDecorationColor = color;
      el.style.textDecorationThickness = '2px';
      el.style.textUnderlineOffset = '2px';
    } else if (style === 'strike') {
      el.style.textDecoration = 'line-through';
      el.style.textDecorationColor = color;
      el.style.textDecorationThickness = '2px';
    } else if (style === 'wavy') {
      el.style.textDecoration = 'underline wavy';
      el.style.textDecorationColor = color;
      el.style.textDecorationThickness = '1.5px';
      el.style.textUnderlineOffset = '2px';
    }
  };

  // Wrap each text node in `range` in a <span.wh-mark> with the given id/color/style/note.
  wh.wrapRange = function wrapRange(range, color, id, note, style) {
    const nodes = textNodesInRange(range);
    const st = style || 'bg';
    nodes.forEach(n => {
      const span = document.createElement('span');
      span.className = 'wh-mark';
      span.dataset.whId = id;
      wh.applyAppearance(span, color, st);
      if (note) { span.dataset.whNote = '1'; span.title = note; }
      n.parentNode.insertBefore(span, n);
      span.appendChild(n);
    });
  };

  function textNodesInRange(range) {
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      root.nodeType === 3 ? root.parentNode : root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest('#wh-toolbar,#wh-popup')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const out = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n === range.startContainer && range.startOffset > 0) {
        n = n.splitText(range.startOffset);
      }
      if (n === range.endContainer && range.endOffset < n.nodeValue.length) {
        n.splitText(range.endOffset - (range.startContainer === range.endContainer ? range.startOffset : 0));
      }
      out.push(n);
    }
    return out;
  }

  // Surrounding 20-char context for restoration lookups.
  wh.contextOf = function contextOf(text) {
    const body = document.body.innerText;
    const i = body.indexOf(text);
    if (i < 0) return null;
    return {
      before: body.slice(Math.max(0, i - 20), i),
      after:  body.slice(i + text.length, i + text.length + 20),
    };
  };

  // Unwrap a single mark span. Also calls normalize() — for bulk operations use
  // unwrapMarks() instead to dedupe parents.
  wh.unwrap = function unwrap(el) {
    const p = el.parentNode;
    if (!p) return;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
    p.normalize();
  };

  // Batched unwrap: deduplicate parents before normalize() so the cost stays O(N)
  // on pages with many highlights instead of O(N²).
  wh.unwrapMarks = function unwrapMarks(els) {
    const parents = new Set();
    els.forEach(el => {
      const p = el.parentNode;
      if (!p) return;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
      parents.add(p);
    });
    parents.forEach(p => p.normalize());
  };

  // Locate a Range for `text` in the live DOM, optionally validated against
  // surrounding context. Skips text inside existing marks and our own UI.
  wh.findTextRange = function findTextRange(text, ctx) {
    if (!text) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement.closest('#wh-toolbar,#wh-popup,.wh-mark')) continue;
      nodes.push(n);
    }
    let acc = '';
    const map = [];
    nodes.forEach(node => { map.push({ node, start: acc.length }); acc += node.nodeValue; });
    let from = 0;
    while (true) {
      const i = acc.indexOf(text, from);
      if (i < 0) return null;
      const before = acc.slice(Math.max(0, i - 20), i);
      const after  = acc.slice(i + text.length, i + text.length + 20);
      if (!ctx || before.endsWith(ctx.before.slice(-10)) || after.startsWith(ctx.after.slice(0, 10))) {
        return makeRange(map, i, i + text.length);
      }
      from = i + 1;
    }
  };

  function makeRange(map, start, end) {
    let sN, sO, eN, eO;
    for (let k = 0; k < map.length; k++) {
      const { node, start: s } = map[k];
      const e = s + node.nodeValue.length;
      if (sN == null && start >= s && start <= e) { sN = node; sO = start - s; }
      if (eN == null && end >= s && end <= e) { eN = node; eO = end - s; break; }
    }
    if (!sN || !eN) return null;
    const r = document.createRange();
    r.setStart(sN, sO);
    r.setEnd(eN, eO);
    return r;
  }
})();
