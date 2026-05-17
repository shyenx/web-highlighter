// i18n: dictionary, current-language detection, lookup helper.
// Strings are read at template-render time; for in-place language switches,
// `relocalize()` in 70-ui.js refreshes attributes/text without rebuilding UI.
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  wh.I18N = {
    zh: {
      enabled: '已开启', disabled: '已关闭',
      drag: '拖动', undo: '撤销 (⌘/Ctrl+Shift+Z)', list: '高亮列表',
      clear: '清除', export: '导出', hide: '隐藏', langToggle: 'EN',
      langSwitchTitle: '切换到 English',
      style_bg: '背景色', style_underline: '下划线', style_strike: '删除线', style_wavy: '波浪线',
      popup_del: '删除', popup_save: '保存笔记', popup_note_ph: '加一条笔记…',
      sidebar_title: '高亮列表', sidebar_close: '关闭', sidebar_empty: '还没有高亮',
      confirm_clear: '清除本页全部高亮?',
    },
    en: {
      enabled: 'Enabled', disabled: 'Disabled',
      drag: 'Drag', undo: 'Undo (⌘/Ctrl+Shift+Z)', list: 'Highlights',
      clear: 'Clear', export: 'Export', hide: 'Hide', langToggle: '中',
      langSwitchTitle: 'Switch to 中文',
      style_bg: 'Background', style_underline: 'Underline', style_strike: 'Strikethrough', style_wavy: 'Wavy',
      popup_del: 'Delete', popup_save: 'Save note', popup_note_ph: 'Add a note…',
      sidebar_title: 'Highlights', sidebar_close: 'Close', sidebar_empty: 'No highlights yet',
      confirm_clear: 'Clear all highlights on this page?',
    },
  };

  wh.detectLang = function detectLang() {
    return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  };

  // Reads wh.cache.lang at call time, set up by 20-core.js and 30-storage.js.
  wh.t = function t(key) {
    const lang = (wh.cache && wh.cache.lang) || 'en';
    return (wh.I18N[lang] || wh.I18N.en)[key] || key;
  };
})();
