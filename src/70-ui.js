// UI: builds the toolbar / popup / sidebar; wires up all click & drag handlers;
// renders the sidebar; relocalize() refreshes in-place on language switch.
// ensureUIAttached() re-attaches UI to body if a SPA host removes them and
// clamps the toolbar back into the viewport.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  wh.buildUI = function buildUI() {
    const { t, COLORS, STYLES, cache } = wh;

    wh.toolbar = document.createElement('div');
    wh.toolbar.id = 'wh-toolbar';
    wh.toolbar.classList.add('wh-collapsed'); // 默认折叠成小图标，hover 展开
    wh.toolbar.innerHTML = `
      <div id="wh-collapsed-icon" title="Web Highlighter">
        <span id="wh-collapsed-dot" style="background:${cache.lastColor}"></span>
      </div>
      <div id="wh-drag" title="${t('drag')}">⋮⋮</div>
      <button id="wh-color-picker" class="wh-picker" title="${t('style_bg')}">
        <span id="wh-color-dot" class="wh-color-dot" style="background:${cache.lastColor}"></span>
        <span class="wh-caret">▾</span>
      </button>
      <button id="wh-style-picker" class="wh-picker" title="${t('style_' + cache.lastStyle)}">
        <span id="wh-style-glyph"><span>A</span></span>
        <span class="wh-caret">▾</span>
      </button>
      <div class="wh-sep"></div>
      <button id="wh-toggle"></button>
      <button id="wh-undo" title="${t('undo')}">↶</button>
      <button id="wh-list" title="${t('list')}">☰</button>
      <button id="wh-clear">${t('clear')}</button>
      <button id="wh-export">${t('export')}</button>
      <button id="wh-lang" title="${t('langSwitchTitle')}">${t('langToggle')}</button>
      <button id="wh-hide" title="${t('hide')}">×</button>
    `;
    document.body.appendChild(wh.toolbar);

    applyToolbarPos();

    wh.popup = document.createElement('div');
    wh.popup.id = 'wh-popup';
    wh.popup.style.flexDirection = 'column';
    wh.popup.style.alignItems = 'stretch';
    wh.popup.innerHTML = `
      <div style="display:flex;gap:4px;align-items:center;">
        ${COLORS.map(c => `<div class="wh-swatch" data-color="${c}" style="background:${c}"></div>`).join('')}
        <button id="wh-popup-del">${t('popup_del')}</button>
      </div>
      <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
        ${STYLES.map(s => `<button class="wh-style" data-style="${s.key}" title="${t('style_' + s.key)}"><span style="${s.preview('#fff')}color:#fff;">${s.label}</span></button>`).join('')}
      </div>
      <div class="wh-note-row">
        <textarea id="wh-popup-note" placeholder="${t('popup_note_ph')}"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button id="wh-popup-save">${t('popup_save')}</button>
      </div>
    `;
    document.body.appendChild(wh.popup);

    // Color picker popover
    wh.colorPop = document.createElement('div');
    wh.colorPop.id = 'wh-color-pop';
    wh.colorPop.className = 'wh-pop';
    wh.colorPop.innerHTML = COLORS.map(c =>
      `<div class="wh-swatch" data-color="${c}" style="background:${c}"></div>`
    ).join('');
    document.body.appendChild(wh.colorPop);

    // Style picker popover
    wh.stylePop = document.createElement('div');
    wh.stylePop.id = 'wh-style-pop';
    wh.stylePop.className = 'wh-pop';
    wh.stylePop.innerHTML = STYLES.map(s =>
      `<button class="wh-style" data-style="${s.key}" title="${t('style_' + s.key)}"><span style="${s.preview(cache.lastColor)}">${s.label}</span></button>`
    ).join('');
    document.body.appendChild(wh.stylePop);

    wh.sidebar = document.createElement('div');
    wh.sidebar.id = 'wh-sidebar';
    wh.sidebar.innerHTML = `
      <div id="wh-sidebar-header">
        <span>${t('sidebar_title')} (<span id="wh-sidebar-count">0</span>)</span>
        <button id="wh-sidebar-close" title="${t('sidebar_close')}">×</button>
      </div>
      <div id="wh-sidebar-list"></div>
    `;
    document.body.appendChild(wh.sidebar);

    wh.refreshToolbar();
    setupToolbarHandlers();
    setupDrag();
    setupPopupHandlers();
    setupSidebarHandlers();
    wh.refreshTheme();
  };

  // Apply the saved position (or the default of right-edge, vertically
  // centered) to the toolbar. Position is stored as {anchor, x, y} where
  // anchor is 'right' (x = distance from viewport right edge) or 'left'
  // (x = distance from viewport left edge). Legacy {left, top} also
  // accepted from older releases.
  function applyToolbarPos() {
    const p = wh.cache.toolbarPos;
    wh.toolbar.style.transform = '';
    if (!p) {
      // Default: stuck to the right edge, vertically centered.
      wh.toolbar.style.right = '0';
      wh.toolbar.style.left  = 'auto';
      wh.toolbar.style.top   = '50%';
      wh.toolbar.style.bottom = 'auto';
      wh.toolbar.style.transform = 'translateY(-50%)';
      return;
    }
    if (p.anchor === 'right') {
      wh.toolbar.style.right = p.x + 'px';
      wh.toolbar.style.left  = 'auto';
    } else if (p.anchor === 'left') {
      wh.toolbar.style.left  = p.x + 'px';
      wh.toolbar.style.right = 'auto';
    } else {
      // Legacy format: { left, top }
      wh.toolbar.style.left  = (p.left || 0) + 'px';
      wh.toolbar.style.right = 'auto';
    }
    wh.toolbar.style.top    = ((p.y != null) ? p.y : (p.top || 0)) + 'px';
    wh.toolbar.style.bottom = 'auto';
    requestAnimationFrame(() => wh.ensureUIAttached());
  }

  wh.refreshToolbar = function refreshToolbar() {
    const { t, STYLES, cache, toolbar, colorPop, stylePop } = wh;
    if (!toolbar) return;

    // Toolbar picker buttons reflect current selection.
    const dot = toolbar.querySelector('#wh-color-dot');
    if (dot) dot.style.background = cache.lastColor;
    const styleGlyph = toolbar.querySelector('#wh-style-glyph');
    const currentStyle = STYLES.find(s => s.key === cache.lastStyle);
    if (styleGlyph && currentStyle) {
      styleGlyph.innerHTML = `<span style="${currentStyle.preview(cache.lastColor)}">A</span>`;
    }
    const colorBtn = toolbar.querySelector('#wh-color-picker');
    if (colorBtn) colorBtn.title = t('style_bg'); // 一律展示 "颜色" 含义
    const styleBtn = toolbar.querySelector('#wh-style-picker');
    if (styleBtn) styleBtn.title = t('style_' + cache.lastStyle);

    // Sync popover internal active states + style previews.
    if (colorPop) {
      colorPop.querySelectorAll('.wh-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === cache.lastColor);
      });
    }
    if (stylePop) {
      stylePop.querySelectorAll('.wh-style').forEach(b => {
        b.classList.toggle('active', b.dataset.style === cache.lastStyle);
        const s = STYLES.find(x => x.key === b.dataset.style);
        const span = b.querySelector('span');
        if (span && s) span.setAttribute('style', s.preview(cache.lastColor));
      });
    }

    const btn = toolbar.querySelector('#wh-toggle');
    btn.textContent = cache.enabled ? t('enabled') : t('disabled');
    btn.style.background = cache.enabled ? '#d4edda' : '#f8d7da';

    // Collapsed-state dot mirrors the current default color.
    const collapsedDot = toolbar.querySelector('#wh-collapsed-dot');
    if (collapsedDot) collapsedDot.style.background = cache.lastColor;
  };

  // Refresh all visible strings / titles / placeholders in place. Used when the
  // user toggles the EN/中 button — preserves UI position and listeners.
  wh.relocalize = function relocalize() {
    const { t, toolbar, popup, sidebar, cache } = wh;
    if (toolbar) {
      toolbar.querySelector('#wh-drag').title = t('drag');
      toolbar.querySelector('#wh-undo').title = t('undo');
      toolbar.querySelector('#wh-list').title = t('list');
      toolbar.querySelector('#wh-clear').textContent = t('clear');
      toolbar.querySelector('#wh-export').textContent = t('export');
      toolbar.querySelector('#wh-lang').textContent = t('langToggle');
      toolbar.querySelector('#wh-lang').title = t('langSwitchTitle');
      toolbar.querySelector('#wh-hide').title = t('hide');
      // Picker buttons + style popover button titles.
      const colorBtn = toolbar.querySelector('#wh-color-picker');
      if (colorBtn) colorBtn.title = t('style_bg');
      const styleBtn = toolbar.querySelector('#wh-style-picker');
      if (styleBtn) styleBtn.title = t('style_' + cache.lastStyle);
      if (wh.stylePop) {
        wh.stylePop.querySelectorAll('.wh-style').forEach(b => {
          b.title = t('style_' + b.dataset.style);
        });
      }
      wh.refreshToolbar();
    }
    if (popup) {
      const del = popup.querySelector('#wh-popup-del');
      const save = popup.querySelector('#wh-popup-save');
      const note = popup.querySelector('#wh-popup-note');
      if (del)  del.textContent  = t('popup_del');
      if (save) save.textContent = t('popup_save');
      if (note) note.placeholder = t('popup_note_ph');
      popup.querySelectorAll('.wh-style').forEach(b => {
        b.title = t('style_' + b.dataset.style);
      });
    }
    if (sidebar) {
      const head = sidebar.querySelector('#wh-sidebar-header span');
      if (head) head.innerHTML = `${t('sidebar_title')} (<span id="wh-sidebar-count">${cache.pageMarks.length}</span>)`;
      const close = sidebar.querySelector('#wh-sidebar-close');
      if (close) close.title = t('sidebar_close');
      wh.renderSidebar();
    }
  };

  function positionPopAbove(pop, anchorBtn) {
    const r = anchorBtn.getBoundingClientRect();
    pop.style.display = 'flex';
    // Render once to measure, then position centered above the button.
    const popH = pop.offsetHeight || 36;
    const popW = pop.offsetWidth  || 200;
    const top  = window.scrollY + r.top - popH - 6;
    let left = window.scrollX + r.left + r.width / 2 - popW / 2;
    // Keep within viewport horizontally.
    left = Math.max(window.scrollX + 4, Math.min(window.scrollX + window.innerWidth - popW - 4, left));
    pop.style.top  = top  + 'px';
    pop.style.left = left + 'px';
  }

  function closeAllPickerPops() {
    if (wh.colorPop) wh.colorPop.style.display = 'none';
    if (wh.stylePop) wh.stylePop.style.display = 'none';
  }

  // Hover-based open/close with a small delay so the mouse can bridge the
  // gap between the trigger button and the popover.
  let hoverCloseTimer = 0;
  function openPopHover(pop, anchor) {
    clearTimeout(hoverCloseTimer);
    // If another picker pop is open, close it immediately.
    if (pop === wh.colorPop && wh.stylePop) wh.stylePop.style.display = 'none';
    if (pop === wh.stylePop && wh.colorPop) wh.colorPop.style.display = 'none';
    positionPopAbove(pop, anchor);
  }
  function schedulePopClose() {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = setTimeout(closeAllPickerPops, 200);
  }
  function cancelPopClose() {
    clearTimeout(hoverCloseTimer);
  }

  function setupToolbarHandlers() {
    wh.toolbar.addEventListener('mousedown', e => {
      if (e.target.id === 'wh-drag') return; // 拖动单独处理
      if (e.target.closest('#wh-collapsed-icon')) return; // 折叠图标也是拖动入口
      e.stopPropagation();
      e.preventDefault();

      // Picker button clicks are no-ops (hover handles open/close). The
      // closest('.wh-picker') guard keeps the mousedown from falling through
      // to the toggle / undo branches below if the user does click a picker.
      if (e.target.closest('.wh-picker')) return;

      if (e.target.id === 'wh-toggle') {
        wh.cache.enabled = !wh.cache.enabled;
        wh.refreshToolbar();
        setTimeout(wh.saveEnabled, 0);
      } else if (e.target.id === 'wh-undo') {
        wh.doUndo();
      } else if (e.target.id === 'wh-list') {
        wh.sidebar.classList.toggle('open');
        if (wh.sidebar.classList.contains('open')) wh.renderSidebar();
      } else if (e.target.id === 'wh-lang') {
        wh.cache.lang = (wh.cache.lang === 'zh') ? 'en' : 'zh';
        wh.relocalize();
        setTimeout(wh.saveLang, 0);
      } else if (e.target.id === 'wh-clear') {
        if (confirm(wh.t('confirm_clear'))) {
          wh.pushUndo({ type: 'clear', marks: wh.cache.pageMarks.slice() });
          wh.cache.pageMarks = [];
          wh.saveMarks();
          document.querySelectorAll('.wh-mark').forEach(m => wh.unwrap(m));
          wh.renderSidebar();
        }
      } else if (e.target.id === 'wh-export') {
        const blob = new Blob([JSON.stringify({ url: location.href, marks: wh.cache.pageMarks }, null, 2)],
          { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'highlights-' + location.hostname + '.json';
        a.click();
      } else if (e.target.id === 'wh-hide') {
        wh.toolbar.style.display = 'none';
      }
    });

    // Color picker popover: hover a swatch to apply (no click needed). Click
    // also works and closes the popover.
    wh.colorPop.addEventListener('mouseover', e => {
      const sw = e.target.closest('.wh-swatch');
      if (!sw) return;
      if (wh.cache.lastColor === sw.dataset.color) return;
      wh.cache.lastColor = sw.dataset.color;
      wh.refreshToolbar();
      setTimeout(wh.saveLastColor, 0);
    });
    wh.colorPop.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (!e.target.closest('.wh-swatch')) return;
      closeAllPickerPops();
    });

    // Style picker popover: hover to apply; click to apply + close.
    wh.stylePop.addEventListener('mouseover', e => {
      const st = e.target.closest('.wh-style');
      if (!st) return;
      if (wh.cache.lastStyle === st.dataset.style) return;
      wh.cache.lastStyle = st.dataset.style;
      wh.refreshToolbar();
      setTimeout(wh.saveLastStyle, 0);
    });
    wh.stylePop.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (!e.target.closest('.wh-style')) return;
      closeAllPickerPops();
    });

    // Hover-driven open / close for the two picker popovers.
    const colorBtn = wh.toolbar.querySelector('#wh-color-picker');
    const styleBtn = wh.toolbar.querySelector('#wh-style-picker');
    if (colorBtn) {
      colorBtn.addEventListener('mouseenter', () => openPopHover(wh.colorPop, colorBtn));
      colorBtn.addEventListener('mouseleave', schedulePopClose);
    }
    if (styleBtn) {
      styleBtn.addEventListener('mouseenter', () => openPopHover(wh.stylePop, styleBtn));
      styleBtn.addEventListener('mouseleave', schedulePopClose);
    }
    [wh.colorPop, wh.stylePop].forEach(pop => {
      pop.addEventListener('mouseenter', cancelPopClose);
      pop.addEventListener('mouseleave', schedulePopClose);
    });

    // Scroll / resize → close popovers (their absolute position would be stale).
    window.addEventListener('scroll', closeAllPickerPops, true);
    window.addEventListener('resize', closeAllPickerPops);

    // ---------- Collapse to icon / expand on hover ----------
    // The toolbar is collapsed by default. Hovering over it (or over an open
    // picker popover) keeps it expanded. After ~400ms with no hover anywhere
    // on toolbar + popovers, it collapses back. Drag still works on the icon.
    const hoverState = { toolbar: false, colorPop: false, stylePop: false };
    let collapseTimer = 0;
    function reevaluateCollapse() {
      clearTimeout(collapseTimer);
      const anyHovered = hoverState.toolbar || hoverState.colorPop || hoverState.stylePop;
      if (anyHovered) {
        wh.toolbar.classList.remove('wh-collapsed');
      } else {
        collapseTimer = setTimeout(() => {
          wh.toolbar.classList.add('wh-collapsed');
          closeAllPickerPops();
        }, 400);
      }
    }
    wh.toolbar.addEventListener('mouseenter', () => { hoverState.toolbar = true;  reevaluateCollapse(); });
    wh.toolbar.addEventListener('mouseleave', () => { hoverState.toolbar = false; reevaluateCollapse(); });
    wh.colorPop.addEventListener('mouseenter', () => { hoverState.colorPop = true;  reevaluateCollapse(); });
    wh.colorPop.addEventListener('mouseleave', () => { hoverState.colorPop = false; reevaluateCollapse(); });
    wh.stylePop.addEventListener('mouseenter', () => { hoverState.stylePop = true;  reevaluateCollapse(); });
    wh.stylePop.addEventListener('mouseleave', () => { hoverState.stylePop = false; reevaluateCollapse(); });
  }

  function setupDrag() {
    // Both the expanded drag handle and the collapsed icon initiate drag.
    const handles = [
      wh.toolbar.querySelector('#wh-drag'),
      wh.toolbar.querySelector('#wh-collapsed-icon'),
    ].filter(Boolean);
    let sx, sy, sl, st, dragging = false;
    handles.forEach(handle => {
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const r = wh.toolbar.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
        // Drag uses absolute left/top throughout; clear any default
        // right anchor and translateY centering.
        wh.toolbar.style.left = sl + 'px';
        wh.toolbar.style.top  = st + 'px';
        wh.toolbar.style.right = 'auto';
        wh.toolbar.style.bottom = 'auto';
        wh.toolbar.style.transform = '';
        dragging = true;
      });
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const nx = Math.max(0, Math.min(window.innerWidth  - wh.toolbar.offsetWidth,  sl + e.clientX - sx));
      const ny = Math.max(0, Math.min(window.innerHeight - wh.toolbar.offsetHeight, st + e.clientY - sy));
      wh.toolbar.style.left = nx + 'px';
      wh.toolbar.style.top  = ny + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      // Pick anchor based on which half of the viewport the toolbar landed in,
      // so it always expands toward the center (away from the nearest edge).
      const r = wh.toolbar.getBoundingClientRect();
      const midX = r.left + r.width / 2;
      const y = Math.max(0, r.top);
      if (midX > window.innerWidth / 2) {
        const rightOffset = Math.max(0, window.innerWidth - r.right);
        wh.toolbar.style.right = rightOffset + 'px';
        wh.toolbar.style.left  = 'auto';
        wh.cache.toolbarPos = { anchor: 'right', x: rightOffset, y };
      } else {
        const leftOffset = Math.max(0, r.left);
        wh.toolbar.style.left  = leftOffset + 'px';
        wh.toolbar.style.right = 'auto';
        wh.cache.toolbarPos = { anchor: 'left',  x: leftOffset,  y };
      }
      wh.toolbar.style.top = y + 'px';
      wh.toolbar.style.bottom = 'auto';
      wh.saveToolbarPos();
    });
  }

  function syncPopupStylePreview(color) {
    wh.popup.querySelectorAll('.wh-style').forEach(b => {
      const s = wh.STYLES.find(x => x.key === b.dataset.style);
      const span = b.querySelector('span');
      if (span && s) span.setAttribute('style', s.preview(color) + 'color:#fff;');
    });
  }

  function setupPopupHandlers() {
    wh.popup.addEventListener('mousedown', e => {
      // textarea 不阻止默认（要能聚焦/选词）
      if (e.target.id === 'wh-popup-note') { e.stopPropagation(); return; }
      e.preventDefault();
      e.stopPropagation();
      if (e.target.id === 'wh-popup-del') {
        if (wh.activeMarkId) wh.removeMark(wh.activeMarkId);
        wh.popup.style.display = 'none';
        wh.renderSidebar();
        return;
      }
      if (e.target.id === 'wh-popup-save') {
        if (!wh.activeMarkId) return;
        const note = wh.popup.querySelector('#wh-popup-note').value.trim();
        wh.setMarkNote(wh.activeMarkId, note);
        wh.popup.style.display = 'none';
        wh.renderSidebar();
        return;
      }
      const sw = e.target.closest('.wh-swatch');
      if (sw && wh.activeMarkId) {
        wh.changeMarkColor(wh.activeMarkId, sw.dataset.color);
        const m = wh.cache.pageMarks.find(x => x.id === wh.activeMarkId);
        if (m) syncPopupStylePreview(m.color);
        wh.renderSidebar();
        return;
      }
      const st = e.target.closest('.wh-style');
      if (st && wh.activeMarkId) {
        wh.changeMarkStyle(wh.activeMarkId, st.dataset.style);
        wh.popup.querySelectorAll('.wh-style').forEach(b => b.classList.toggle('active', b.dataset.style === st.dataset.style));
        wh.renderSidebar();
        return;
      }
    });

    // Close popup: mousedown anywhere outside popup / toolbar / sidebar / mark.
    document.addEventListener('mousedown', e => {
      if (e.target.closest('#wh-popup') || e.target.closest('#wh-toolbar') ||
          e.target.closest('#wh-sidebar') || e.target.closest('.wh-mark')) return;
      wh.popup.style.display = 'none';
      wh.activeMarkId = null;
    });

    // Open popup: click intent (mousedown→mouseup at the same spot, no drag-select).
    let downOn = null;
    document.addEventListener('mousedown', e => {
      const m = e.target.closest('.wh-mark');
      downOn = m ? { mark: m, x: e.clientX, y: e.clientY } : null;
    }, true);
    document.addEventListener('mouseup', e => {
      const start = downOn; downOn = null;
      if (!start) return;
      if (e.target.closest('#wh-popup') || e.target.closest('#wh-toolbar') || e.target.closest('#wh-sidebar')) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      const m = e.target.closest('.wh-mark');
      if (!m || m.dataset.whId !== start.mark.dataset.whId) return;

      wh.activeMarkId = m.dataset.whId;
      const r = m.getBoundingClientRect();
      wh.popup.style.display = 'flex';
      wh.popup.style.top  = (window.scrollY + r.bottom + 6) + 'px';
      wh.popup.style.left = (window.scrollX + r.left) + 'px';
      const mark = wh.cache.pageMarks.find(x => x.id === wh.activeMarkId);
      const markColor = mark?.color || wh.cache.lastColor;
      const markStyle = mark?.style || 'bg';
      wh.popup.querySelectorAll('.wh-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === markColor);
      });
      wh.popup.querySelectorAll('.wh-style').forEach(b => b.classList.toggle('active', b.dataset.style === markStyle));
      syncPopupStylePreview(markColor);
      const noteEl = wh.popup.querySelector('#wh-popup-note');
      noteEl.value = mark?.note || '';
      if (!mark?.note) setTimeout(() => noteEl.focus(), 0);
    });
  }

  function setupSidebarHandlers() {
    wh.sidebar.addEventListener('mousedown', e => e.stopPropagation());
    wh.sidebar.querySelector('#wh-sidebar-close').addEventListener('click', () => {
      wh.sidebar.classList.remove('open');
    });
    const list = wh.sidebar.querySelector('#wh-sidebar-list');
    list.addEventListener('click', e => {
      const item = e.target.closest('.wh-item');
      if (!item) return;
      const id = item.dataset.id;
      const el = document.querySelector(`.wh-mark[data-wh-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(n => {
        n.classList.remove('wh-flash');
        void n.offsetWidth; // restart animation
        n.classList.add('wh-flash');
      });
    });
    // Keyboard accessibility: Enter / Space activates the focused item.
    list.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.wh-item');
      if (!item) return;
      e.preventDefault();
      item.click();
    });
  }

  wh.renderSidebar = function renderSidebar() {
    const { sidebar, cache, t, escapeHtml } = wh;
    if (!sidebar) return;
    const list = sidebar.querySelector('#wh-sidebar-list');
    sidebar.querySelector('#wh-sidebar-count').textContent = cache.pageMarks.length;
    // Sort by DOM order (first occurrence of each id).
    const order = new Map();
    document.querySelectorAll('.wh-mark').forEach((el, idx) => {
      const id = el.dataset.whId;
      if (!order.has(id)) order.set(id, idx);
    });
    const sorted = cache.pageMarks.slice().sort((a, b) => {
      const oa = order.get(a.id), ob = order.get(b.id);
      if (oa == null && ob == null) return 0;
      if (oa == null) return 1;
      if (ob == null) return -1;
      return oa - ob;
    });
    list.innerHTML = sorted.map(m => `
      <div class="wh-item" data-id="${m.id}" tabindex="0" role="button" style="border-left-color:${m.color};">
        <div class="wh-item-text">${escapeHtml(m.text)}</div>
        ${m.note ? `<div class="wh-item-note">${escapeHtml(m.note)}</div>` : ''}
      </div>
    `).join('') || `<div style="color:#999;padding:12px;text-align:center;">${t('sidebar_empty')}</div>`;
  };

  // Re-attach UI elements if a SPA host removed them; clamp toolbar to viewport.
  // Handles both left-anchored (style.left set) and right-anchored
  // (style.right set) toolbars.
  wh.ensureUIAttached = function ensureUIAttached() {
    const { toolbar, popup, sidebar } = wh;
    if (toolbar && !document.body.contains(toolbar)) document.body.appendChild(toolbar);
    if (popup   && !document.body.contains(popup))   document.body.appendChild(popup);
    if (sidebar && !document.body.contains(sidebar)) document.body.appendChild(sidebar);
    if (!toolbar) return;

    const h = toolbar.offsetHeight || 36;
    const maxY = Math.max(0, window.innerHeight - h);

    // Vertical clamp (skip percentage-based defaults like top: 50%).
    if (toolbar.style.top && toolbar.style.top.endsWith('px')) {
      const y = parseFloat(toolbar.style.top) || 0;
      const ny = Math.max(0, Math.min(maxY, y));
      if (ny !== y) toolbar.style.top = ny + 'px';
    }

    // Horizontal clamp:
    if (toolbar.style.left && toolbar.style.left.endsWith('px')) {
      const w = toolbar.offsetWidth || 100;
      const maxX = Math.max(0, window.innerWidth - w);
      const x = parseFloat(toolbar.style.left) || 0;
      const nx = Math.max(0, Math.min(maxX, x));
      if (nx !== x) toolbar.style.left = nx + 'px';
    } else if (toolbar.style.right && toolbar.style.right.endsWith('px')) {
      const w = toolbar.offsetWidth || 100;
      const maxR = Math.max(0, window.innerWidth - w);
      const x = parseFloat(toolbar.style.right) || 0;
      const nx = Math.max(0, Math.min(maxR, x));
      if (nx !== x) toolbar.style.right = nx + 'px';
    }
  };
})();
