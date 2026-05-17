(function () {
  'use strict';
  if (window.__whInstalled) return;
  window.__whInstalled = true;

  function pageKey() { return 'wh::' + location.host + location.pathname; }
  let currentKey = pageKey();
  const COLORS = ['#fff36b', '#a8e6a3', '#ffb3ba', '#bae1ff', '#e0bbff'];
  const STYLES = [
    { key: 'bg',        label: 'A', preview: c => `background:${c};` },
    { key: 'underline', label: 'A', preview: c => `text-decoration:underline;text-decoration-color:${c};text-decoration-thickness:2px;text-underline-offset:2px;` },
    { key: 'strike',    label: 'A', preview: c => `text-decoration:line-through;text-decoration-color:${c};text-decoration-thickness:2px;` },
    { key: 'wavy',      label: 'A', preview: c => `text-decoration:underline wavy;text-decoration-color:${c};text-decoration-thickness:1.5px;text-underline-offset:2px;` },
  ];

  // ---------- i18n ----------
  const I18N = {
    zh: {
      enabled: '已开启', disabled: '已关闭',
      drag: '拖动', undo: '撤销 (⌘/Ctrl+Shift+Z)', list: '高亮列表',
      clear: '清除', export: '导出', hide: '隐藏', langToggle: 'EN',
      style_bg: '背景色', style_underline: '下划线', style_strike: '删除线', style_wavy: '波浪线',
      popup_del: '删除', popup_save: '保存笔记', popup_note_ph: '加一条笔记…',
      sidebar_title: '高亮列表', sidebar_close: '关闭', sidebar_empty: '还没有高亮',
      confirm_clear: '清除本页全部高亮？',
    },
    en: {
      enabled: 'Enabled', disabled: 'Disabled',
      drag: 'Drag', undo: 'Undo (⌘/Ctrl+Shift+Z)', list: 'Highlights',
      clear: 'Clear', export: 'Export', hide: 'Hide', langToggle: '中',
      style_bg: 'Background', style_underline: 'Underline', style_strike: 'Strikethrough', style_wavy: 'Wavy',
      popup_del: 'Delete', popup_save: 'Save note', popup_note_ph: 'Add a note…',
      sidebar_title: 'Highlights', sidebar_close: 'Close', sidebar_empty: 'No highlights yet',
      confirm_clear: 'Clear all highlights on this page?',
    },
  };
  function detectLang() {
    return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  function t(key) { return (I18N[cache.lang] || I18N.en)[key] || key; }

  // ---------- 存储抽象（chrome.storage.local 是异步的，用内存缓存做同步访问） ----------
  const cache = {
    pageMarks: [],
    lastColor: COLORS[0],
    lastStyle: 'bg',
    enabled: true,
    toolbarPos: null,
    lang: detectLang(),
  };

  function loadAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get([currentKey, 'wh::lastColor', 'wh::lastStyle', 'wh::enabled', 'wh::toolbarPos', 'wh::lang'], (res) => {
        cache.pageMarks = res[currentKey] || [];
        cache.lastColor = res['wh::lastColor'] || COLORS[0];
        cache.lastStyle = res['wh::lastStyle'] || 'bg';
        cache.enabled = res['wh::enabled'] !== false;
        cache.toolbarPos = res['wh::toolbarPos'] || null;
        cache.lang = res['wh::lang'] || detectLang();
        resolve();
      });
    });
  }

  // 仅重载当前 URL 的标注（不动 lastColor / enabled / 工具栏位置 等）
  function reloadPageMarksOnly() {
    return new Promise((resolve) => {
      chrome.storage.local.get([currentKey], (res) => {
        cache.pageMarks = res[currentKey] || [];
        resolve();
      });
    });
  }
  function safeSet(obj) {
    try {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          console.warn('[web-highlighter] storage.set failed:', chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn('[web-highlighter] storage.set threw:', err);
    }
  }
  function saveMarks()       { safeSet({ [currentKey]: cache.pageMarks }); }
  function saveLastColor()   { safeSet({ 'wh::lastColor': cache.lastColor }); }
  function saveLastStyle()   { safeSet({ 'wh::lastStyle': cache.lastStyle }); }
  function saveEnabled()     { safeSet({ 'wh::enabled': cache.enabled }); }
  function saveToolbarPos()  { safeSet({ 'wh::toolbarPos': cache.toolbarPos }); }
  function saveLang()        { safeSet({ 'wh::lang': cache.lang }); }

  // ---------- 撤销栈 ----------
  const undoStack = [];
  const UNDO_MAX = 50;
  function pushUndo(a) { undoStack.push(a); if (undoStack.length > UNDO_MAX) undoStack.shift(); }

  // ---------- 工具栏 ----------
  let toolbar, popup, sidebar;
  let activeMarkId = null;

  function buildUI() {
    toolbar = document.createElement('div');
    toolbar.id = 'wh-toolbar';
    toolbar.innerHTML = `
      <div id="wh-drag" title="${t('drag')}">⋮⋮</div>
      ${COLORS.map(c => `<div class="wh-swatch" data-color="${c}" style="background:${c}"></div>`).join('')}
      <div class="wh-sep"></div>
      ${STYLES.map(s => `<button class="wh-style" data-style="${s.key}" title="${t('style_' + s.key)}"><span style="${s.preview(cache.lastColor)}">${s.label}</span></button>`).join('')}
      <div class="wh-sep"></div>
      <button id="wh-toggle"></button>
      <button id="wh-undo" title="${t('undo')}">↶</button>
      <button id="wh-list" title="${t('list')}">☰</button>
      <button id="wh-clear">${t('clear')}</button>
      <button id="wh-export">${t('export')}</button>
      <button id="wh-lang" title="EN / 中">${t('langToggle')}</button>
      <button id="wh-hide" title="${t('hide')}">×</button>
    `;
    document.body.appendChild(toolbar);

    if (cache.toolbarPos) {
      // 先钳到当前视口（修启动时位置可能在屏外的 bug）
      const w = Math.max(0, window.innerWidth - 280);  // 280 = toolbar 估算宽度
      const h = Math.max(0, window.innerHeight - 40);  // 40  = toolbar 估算高度
      const left = Math.max(0, Math.min(w, cache.toolbarPos.left));
      const top  = Math.max(0, Math.min(h, cache.toolbarPos.top));
      toolbar.style.left = left + 'px';
      toolbar.style.top  = top  + 'px';
      toolbar.style.right = 'auto';
      toolbar.style.bottom = 'auto';
      // UI 渲染完后再用真实尺寸精确钳一次
      requestAnimationFrame(() => ensureUIAttached());
    }

    popup = document.createElement('div');
    popup.id = 'wh-popup';
    popup.style.flexDirection = 'column';
    popup.style.alignItems = 'stretch';
    popup.innerHTML = `
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
    document.body.appendChild(popup);

    sidebar = document.createElement('div');
    sidebar.id = 'wh-sidebar';
    sidebar.innerHTML = `
      <div id="wh-sidebar-header">
        <span>${t('sidebar_title')} (<span id="wh-sidebar-count">0</span>)</span>
        <button id="wh-sidebar-close" title="${t('sidebar_close')}">×</button>
      </div>
      <div id="wh-sidebar-list"></div>
    `;
    document.body.appendChild(sidebar);

    refreshToolbar();
    setupToolbarHandlers();
    setupDrag();
    setupPopupHandlers();
    setupSidebarHandlers();
    refreshTheme();
  }

  function refreshToolbar() {
    toolbar.querySelectorAll('.wh-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === cache.lastColor);
    });
    // 样式按钮：active + 同步预览颜色为当前默认色
    toolbar.querySelectorAll('.wh-style').forEach(b => {
      b.classList.toggle('active', b.dataset.style === cache.lastStyle);
      const s = STYLES.find(x => x.key === b.dataset.style);
      const span = b.querySelector('span');
      if (span && s) span.setAttribute('style', s.preview(cache.lastColor));
    });
    const btn = toolbar.querySelector('#wh-toggle');
    btn.textContent = cache.enabled ? t('enabled') : t('disabled');
    btn.style.background = cache.enabled ? '#d4edda' : '#f8d7da';
  }

  // 给一个 span 应用色 + 样式
  function applyAppearance(el, color, style) {
    el.dataset.whStyle = style;
    el.dataset.whColor = color;
    // 清掉之前可能残留的内联
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
  }

  // ---------- 页面主题检测（light / dark） ----------
  function parseRgb(str) {
    // matches "rgb(r,g,b)" / "rgba(r,g,b,a)"
    const m = /rgba?\(([^)]+)\)/i.exec(str || '');
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map(s => parseFloat(s));
    return { r, g, b, a };
  }
  function luminance({ r, g, b }) {
    // 简化版相对亮度（不做 gamma 校正，够用了）
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function detectPageTheme() {
    // 取 body 背景，若透明就回退到 html，再回退到 prefers-color-scheme
    const targets = [document.body, document.documentElement];
    for (const el of targets) {
      if (!el) continue;
      const rgb = parseRgb(getComputedStyle(el).backgroundColor);
      if (rgb && rgb.a > 0.1) {
        return luminance(rgb) < 0.5 ? 'dark' : 'light';
      }
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  function applyTheme(theme) {
    [toolbar, popup, sidebar].forEach(el => {
      if (el) el.dataset.whTheme = theme;
    });
  }
  let currentTheme = 'light';
  function refreshTheme() {
    const t = detectPageTheme();
    if (t !== currentTheme) {
      currentTheme = t;
      applyTheme(t);
    }
  }

  // 切换语言后：把所有可见文案 / title / placeholder 重新刷一遍（保留位置和事件监听）
  function relocalize() {
    if (toolbar) {
      toolbar.querySelector('#wh-drag').title = t('drag');
      toolbar.querySelector('#wh-undo').title = t('undo');
      toolbar.querySelector('#wh-list').title = t('list');
      toolbar.querySelector('#wh-clear').textContent = t('clear');
      toolbar.querySelector('#wh-export').textContent = t('export');
      toolbar.querySelector('#wh-lang').textContent = t('langToggle');
      toolbar.querySelector('#wh-hide').title = t('hide');
      toolbar.querySelectorAll('.wh-style').forEach(b => {
        b.title = t('style_' + b.dataset.style);
      });
      refreshToolbar(); // 更新 enabled/disabled 文字
    }
    if (popup) {
      const del = popup.querySelector('#wh-popup-del');
      const save = popup.querySelector('#wh-popup-save');
      const note = popup.querySelector('#wh-popup-note');
      if (del) del.textContent = t('popup_del');
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
      renderSidebar();
    }
  }

  function setupToolbarHandlers() {
    toolbar.addEventListener('mousedown', e => {
      if (e.target.id === 'wh-drag') return; // 拖动单独处理
      e.stopPropagation();
      e.preventDefault();
      const sw = e.target.closest('.wh-swatch');
      if (sw) {
        cache.lastColor = sw.dataset.color;
        refreshToolbar();
        setTimeout(saveLastColor, 0);
        return;
      }
      const st = e.target.closest('.wh-style');
      if (st) {
        cache.lastStyle = st.dataset.style;
        refreshToolbar();
        setTimeout(saveLastStyle, 0);
        return;
      }
      if (e.target.id === 'wh-toggle') {
        cache.enabled = !cache.enabled;
        refreshToolbar();
        setTimeout(saveEnabled, 0);
      } else if (e.target.id === 'wh-undo') {
        doUndo();
      } else if (e.target.id === 'wh-list') {
        sidebar.classList.toggle('open');
        if (sidebar.classList.contains('open')) renderSidebar();
      } else if (e.target.id === 'wh-lang') {
        cache.lang = (cache.lang === 'zh') ? 'en' : 'zh';
        relocalize();
        setTimeout(saveLang, 0);
      } else if (e.target.id === 'wh-clear') {
        if (confirm(t('confirm_clear'))) {
          pushUndo({ type: 'clear', marks: cache.pageMarks.slice() });
          cache.pageMarks = [];
          saveMarks();
          document.querySelectorAll('.wh-mark').forEach(m => unwrap(m));
        }
      } else if (e.target.id === 'wh-export') {
        const blob = new Blob([JSON.stringify({ url: location.href, marks: cache.pageMarks }, null, 2)],
          { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'highlights-' + location.hostname + '.json';
        a.click();
      } else if (e.target.id === 'wh-hide') {
        toolbar.style.display = 'none';
      }
    });
  }

  function setupDrag() {
    const handle = toolbar.querySelector('#wh-drag');
    let sx, sy, sl, st, dragging = false;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const r = toolbar.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
      toolbar.style.left = sl + 'px';
      toolbar.style.top = st + 'px';
      toolbar.style.right = 'auto';
      toolbar.style.bottom = 'auto';
      dragging = true;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const nx = Math.max(0, Math.min(window.innerWidth - toolbar.offsetWidth, sl + e.clientX - sx));
      const ny = Math.max(0, Math.min(window.innerHeight - toolbar.offsetHeight, st + e.clientY - sy));
      toolbar.style.left = nx + 'px';
      toolbar.style.top = ny + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      cache.toolbarPos = { left: parseInt(toolbar.style.left, 10), top: parseInt(toolbar.style.top, 10) };
      saveToolbarPos();
    });
  }

  function setupPopupHandlers() {
    // 笔记 textarea 的输入要正常工作，不能 stopPropagation 文本事件
    popup.addEventListener('mousedown', e => {
      // textarea 不阻止默认（要能聚焦/选词）
      if (e.target.id === 'wh-popup-note') { e.stopPropagation(); return; }
      e.preventDefault();
      e.stopPropagation();
      if (e.target.id === 'wh-popup-del') {
        if (activeMarkId) removeMark(activeMarkId);
        popup.style.display = 'none';
        renderSidebar();
        return;
      }
      if (e.target.id === 'wh-popup-save') {
        if (!activeMarkId) return;
        const note = popup.querySelector('#wh-popup-note').value.trim();
        setMarkNote(activeMarkId, note);
        popup.style.display = 'none';
        renderSidebar();
        return;
      }
      const sw = e.target.closest('.wh-swatch');
      if (sw && activeMarkId) {
        changeMarkColor(activeMarkId, sw.dataset.color);
        // 同步 popup 内 style 按钮预览颜色
        const m = cache.pageMarks.find(x => x.id === activeMarkId);
        if (m) syncPopupStylePreview(m.color);
        renderSidebar();
        return;
      }
      const st = e.target.closest('.wh-style');
      if (st && activeMarkId) {
        changeMarkStyle(activeMarkId, st.dataset.style);
        popup.querySelectorAll('.wh-style').forEach(b => b.classList.toggle('active', b.dataset.style === st.dataset.style));
        renderSidebar();
        return;
      }
    });

    function syncPopupStylePreview(color) {
      popup.querySelectorAll('.wh-style').forEach(b => {
        const s = STYLES.find(x => x.key === b.dataset.style);
        const span = b.querySelector('span');
        if (span && s) span.setAttribute('style', s.preview(color) + 'color:#fff;');
      });
    }

    // 关闭 popup：mousedown 在 popup/工具栏/侧栏/任意 mark 之外时
    document.addEventListener('mousedown', e => {
      if (e.target.closest('#wh-popup') || e.target.closest('#wh-toolbar') || e.target.closest('#wh-sidebar') || e.target.closest('.wh-mark')) return;
      popup.style.display = 'none';
      activeMarkId = null;
    });

    // 打开 popup：用 click（mousedown→mouseup 同位置），且仅当没有正在选中的文字
    let downOn = null;
    document.addEventListener('mousedown', e => {
      const m = e.target.closest('.wh-mark');
      downOn = m ? { mark: m, x: e.clientX, y: e.clientY } : null;
    }, true);
    document.addEventListener('mouseup', e => {
      const start = downOn; downOn = null;
      if (!start) return;
      if (e.target.closest('#wh-popup') || e.target.closest('#wh-toolbar') || e.target.closest('#wh-sidebar')) return;
      // 拖动判定：移动超过 4px 视为框选，不弹
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) return;
      // 有非空选区也不弹（用户在标注内做选词）
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      // 必须 up 在同一个 mark 元素上
      const m = e.target.closest('.wh-mark');
      if (!m || m.dataset.whId !== start.mark.dataset.whId) return;

      activeMarkId = m.dataset.whId;
      const r = m.getBoundingClientRect();
      popup.style.display = 'flex';
      popup.style.top = (window.scrollY + r.bottom + 6) + 'px';
      popup.style.left = (window.scrollX + r.left) + 'px';
      const mark = cache.pageMarks.find(x => x.id === activeMarkId);
      const markColor = mark?.color || cache.lastColor;
      const markStyle = mark?.style || 'bg';
      popup.querySelectorAll('.wh-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === markColor);
      });
      popup.querySelectorAll('.wh-style').forEach(b => b.classList.toggle('active', b.dataset.style === markStyle));
      syncPopupStylePreview(markColor);
      const noteEl = popup.querySelector('#wh-popup-note');
      noteEl.value = mark?.note || '';
      // 没有笔记时自动聚焦，方便直接写
      if (!mark?.note) setTimeout(() => noteEl.focus(), 0);
    });
  }

  function setupSidebarHandlers() {
    sidebar.addEventListener('mousedown', e => e.stopPropagation());
    sidebar.querySelector('#wh-sidebar-close').addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
    sidebar.querySelector('#wh-sidebar-list').addEventListener('click', e => {
      const item = e.target.closest('.wh-item');
      if (!item) return;
      const id = item.dataset.id;
      const el = document.querySelector(`.wh-mark[data-wh-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(n => {
        n.classList.remove('wh-flash');
        // force reflow to restart animation
        void n.offsetWidth;
        n.classList.add('wh-flash');
      });
    });
  }

  function renderSidebar() {
    if (!sidebar) return;
    const list = sidebar.querySelector('#wh-sidebar-list');
    sidebar.querySelector('#wh-sidebar-count').textContent = cache.pageMarks.length;
    // 按页面顺序排序：用 DOM 出现顺序
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
      <div class="wh-item" data-id="${m.id}" style="border-left-color:${m.color};">
        <div class="wh-item-text">${escapeHtml(m.text)}</div>
        ${m.note ? `<div class="wh-item-note">${escapeHtml(m.note)}</div>` : ''}
      </div>
    `).join('') || `<div style="color:#999;padding:12px;text-align:center;">${t('sidebar_empty')}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function setMarkNote(id, note) {
    const m = cache.pageMarks.find(x => x.id === id);
    if (!m) return;
    const prev = m.note || '';
    m.note = note;
    saveMarks();
    // 给所有该 id 的 span 加属性 + tooltip
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      if (note) {
        el.dataset.whNote = '1';
        el.title = note;
      } else {
        delete el.dataset.whNote;
        el.removeAttribute('title');
      }
    });
    pushUndo({ type: 'note', id, prev });
  }

  // ---------- 选中即高亮 ----------
  document.addEventListener('mouseup', e => {
    if (!cache.enabled) return;
    if (e.target.closest('#wh-toolbar') || e.target.closest('#wh-popup')) return;
    if (e.target.closest('.wh-mark')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      applyHighlight(sel.getRangeAt(0), cache.lastColor, cache.lastStyle);
      sel.removeAllRanges();
    }, 0);
  });

  // ---------- 高亮核心 ----------
  function applyHighlight(range, color, style) {
    if (!range || range.collapsed) return;
    const text = range.toString();
    if (!text.trim()) return;
    const id = 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    wrapRange(range, color, id, '', style);
    cache.pageMarks.push({ id, color, style, text, ctx: contextOf(text), note: '' });
    saveMarks();
    pushUndo({ type: 'add', id });
    renderSidebar();
  }

  function wrapRange(range, color, id, note, style) {
    const nodes = textNodesInRange(range);
    const st = style || 'bg';
    nodes.forEach(n => {
      const span = document.createElement('span');
      span.className = 'wh-mark';
      span.dataset.whId = id;
      applyAppearance(span, color, st);
      if (note) { span.dataset.whNote = '1'; span.title = note; }
      n.parentNode.insertBefore(span, n);
      span.appendChild(n);
    });
  }

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

  function contextOf(text) {
    const body = document.body.innerText;
    const i = body.indexOf(text);
    if (i < 0) return null;
    return { before: body.slice(Math.max(0, i - 20), i), after: body.slice(i + text.length, i + text.length + 20) };
  }

  function unwrap(el) {
    const p = el.parentNode;
    while (el.firstChild) p.insertBefore(el.firstChild, el);
    p.removeChild(el);
    p.normalize();
  }

  function changeMarkColor(id, color, skipUndo) {
    const m = cache.pageMarks.find(x => x.id === id);
    const prev = m ? m.color : null;
    const style = m?.style || 'bg';
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      applyAppearance(el, color, style);
    });
    if (m) { m.color = color; saveMarks(); }
    if (!skipUndo && prev != null) pushUndo({ type: 'recolor', id, prev });
  }

  function changeMarkStyle(id, style, skipUndo) {
    const m = cache.pageMarks.find(x => x.id === id);
    const prev = m ? (m.style || 'bg') : null;
    const color = m?.color || cache.lastColor;
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(el => {
      applyAppearance(el, color, style);
    });
    if (m) { m.style = style; saveMarks(); }
    if (!skipUndo && prev != null) pushUndo({ type: 'restyle', id, prev });
  }

  function removeMark(id, skipUndo) {
    const snapshot = cache.pageMarks.find(x => x.id === id);
    document.querySelectorAll(`.wh-mark[data-wh-id="${id}"]`).forEach(unwrap);
    cache.pageMarks = cache.pageMarks.filter(x => x.id !== id);
    saveMarks();
    if (!skipUndo && snapshot) pushUndo({ type: 'remove', snapshot });
    renderSidebar();
  }

  function doUndo() {
    const a = undoStack.pop();
    if (!a) return;
    if (a.type === 'add') removeMark(a.id, true);
    else if (a.type === 'recolor') changeMarkColor(a.id, a.prev, true);
    else if (a.type === 'restyle') changeMarkStyle(a.id, a.prev, true);
    else if (a.type === 'note') setMarkNote(a.id, a.prev);
    else if (a.type === 'remove') {
      const m = a.snapshot;
      const r = findTextRange(m.text, m.ctx);
      if (r) wrapRange(r, m.color, m.id, m.note, m.style);
      cache.pageMarks.push(m);
      saveMarks();
    } else if (a.type === 'clear') {
      cache.pageMarks = a.marks.slice();
      saveMarks();
      a.marks.forEach(m => {
        const r = findTextRange(m.text, m.ctx);
        if (r) wrapRange(r, m.color, m.id, m.note, m.style);
      });
    }
    renderSidebar();
  }

  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    // Esc 关闭 popup
    if (e.key === 'Escape' && popup && popup.style.display !== 'none') {
      popup.style.display = 'none';
      activeMarkId = null;
      return;
    }
    // ⌘+Enter 在笔记框里 = 保存
    if (e.target && e.target.id === 'wh-popup-note' && mod && e.key === 'Enter') {
      e.preventDefault();
      const note = e.target.value.trim();
      if (activeMarkId) setMarkNote(activeMarkId, note);
      popup.style.display = 'none';
      renderSidebar();
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      doUndo();
    }
  }, true);

  // ---------- 还原 ----------
  function findTextRange(text, ctx) {
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
      const after = acc.slice(i + text.length, i + text.length + 20);
      if (!ctx || before.endsWith(ctx.before.slice(-10)) || after.startsWith(ctx.after.slice(0, 10))) {
        return makeRange(map, i, i + text.length);
      }
      from = i + 1;
    }
  }

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

  function restore() {
    let pending = 0;
    cache.pageMarks.forEach(m => {
      if (document.querySelector(`.wh-mark[data-wh-id="${m.id}"]`)) return;
      const r = findTextRange(m.text, m.ctx);
      if (r) wrapRange(r, m.color, m.id, m.note, m.style);
      else pending++;
    });
    renderSidebar();
    return pending;
  }

  // ---------- 来自 background 的消息 ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (!toolbar) return;
    if (msg.type === 'wh-toggle-toolbar') {
      toolbar.style.display = (toolbar.style.display === 'none') ? 'flex' : 'none';
    } else if (msg.type === 'wh-undo') {
      doUndo();
    }
  });

  // ---------- SPA / 自愈 ----------

  // 批量 unwrap 一组 mark span，按 parent 去重再 normalize（修 M8 的 O(N²)）
  function unwrapMarks(els) {
    const parents = new Set();
    els.forEach(el => {
      const p = el.parentNode;
      if (!p) return;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
      parents.add(p);
    });
    parents.forEach(p => p.normalize());
  }

  // 工具栏/弹窗/侧栏被外部 DOM 操作干掉后，自动重新挂回去 + 把 toolbar 钳回视口（修 I3）
  function ensureUIAttached() {
    if (toolbar && !document.body.contains(toolbar)) document.body.appendChild(toolbar);
    if (popup   && !document.body.contains(popup))   document.body.appendChild(popup);
    if (sidebar && !document.body.contains(sidebar)) document.body.appendChild(sidebar);
    if (toolbar && toolbar.style.left && toolbar.style.top) {
      const x = parseFloat(toolbar.style.left) || 0;
      const y = parseFloat(toolbar.style.top) || 0;
      const maxX = Math.max(0, window.innerWidth - toolbar.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - toolbar.offsetHeight);
      const nx = Math.max(0, Math.min(maxX, x));
      const ny = Math.max(0, Math.min(maxY, y));
      if (nx !== x || ny !== y) {
        toolbar.style.left = nx + 'px';
        toolbar.style.top  = ny + 'px';
      }
    }
  }

  // URL 改变时：换 key、重读标注、重 restore（v0.3.0 风格的简单逻辑 + I7 修复）
  let urlChangeBusy = false;
  async function onUrlChange() {
    const newKey = pageKey();
    if (newKey === currentKey) return;
    if (urlChangeBusy) return;
    urlChangeBusy = true;
    try {
      // 立刻刷主题（修 I2），避免 300ms 浅/深色闪
      if (toolbar) refreshTheme();
      // 上一页的撤销栈、活动 mark 失效
      undoStack.length = 0;
      activeMarkId = null;
      if (popup) popup.style.display = 'none';
      // 先 await，成功才换 key（修 I7：失败不污染存储桶）
      const nextMarks = await new Promise(resolve => {
        chrome.storage.local.get([newKey], r => resolve(r[newKey] || []));
      });
      currentKey = newKey;
      // 只 unwrap 新页 marks 中已不存在的旧 span（修 I1：避免闪一下）
      const keepIds = new Set(nextMarks.map(m => m.id));
      const stale = Array.from(document.querySelectorAll('.wh-mark'))
        .filter(el => !keepIds.has(el.dataset.whId));
      unwrapMarks(stale);
      cache.pageMarks = nextMarks;
      ensureUIAttached();
      setTimeout(() => {
        const pending = restore();
        if (pending > 0) setTimeout(restore, 1500);
        refreshTheme();
      }, 300);
    } finally {
      urlChangeBusy = false;
    }
  }

  // 拦截 history.pushState / replaceState，让它们派发可监听的事件（一次性，不重 patch）
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
  window.addEventListener('wh:locationchange', onUrlChange);

  // MutationObserver：看护 UI + 监测大块新内容时重试 restore（懒加载/无限滚动）
  let restoreThrottle = 0;
  const bodyObserver = new MutationObserver((mutations) => {
    let uiGone = false;
    let bigChange = false;
    for (const mu of mutations) {
      if (mu.removedNodes && mu.removedNodes.length) {
        for (const n of mu.removedNodes) {
          if (n === toolbar || n === popup || n === sidebar) uiGone = true;
        }
      }
      if (mu.addedNodes && mu.addedNodes.length >= 3) bigChange = true;
    }
    if (uiGone) ensureUIAttached();
    if (bigChange && cache.pageMarks.length) {
      clearTimeout(restoreThrottle);
      restoreThrottle = setTimeout(() => restore(), 800);
    }
  });

  // 监听页面主题变化
  function watchTheme() {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
    } catch (e) {}
    const themeObserver = new MutationObserver(() => {
      cancelAnimationFrame(themeObserver._raf || 0);
      themeObserver._raf = requestAnimationFrame(refreshTheme);
    });
    const filter = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] };
    themeObserver.observe(document.documentElement, filter);
    themeObserver.observe(document.body, filter);
  }

  // ---------- 启动 ----------
  loadAll().then(() => {
    buildUI();
    bodyObserver.observe(document.body, { childList: true, subtree: false });
    if (document.body.firstElementChild) {
      bodyObserver.observe(document.body.firstElementChild, { childList: true, subtree: true });
    }
    watchTheme();
    setTimeout(() => {
      const pending = restore();
      if (pending > 0) setTimeout(restore, 1500);
      refreshTheme();
    }, 300);
  });
})();
