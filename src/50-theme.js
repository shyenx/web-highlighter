// Theme detection — follows the host page's actual rendered background, not
// the OS preference. Re-detects on prefers-color-scheme change and on
// html/body class/style/data-theme/data-color-mode attribute changes (covers
// .dark, data-theme="dark", etc. used by Tailwind / GitHub / Anthropic / etc.).
(function () {
  'use strict';
  const wh = (window.__wh = window.__wh || {});

  // Best-effort rgb parser. Returns null for non-rgb formats (e.g. color(srgb…),
  // oklch(…) — to be expanded in a later release).
  function parseRgb(str) {
    const m = /rgba?\(([^)]+)\)/i.exec(str || '');
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map(s => parseFloat(s));
    return { r, g, b, a };
  }

  // Simplified relative luminance (no gamma correction — good enough for
  // light/dark bucketing on real-world page backgrounds).
  function luminance({ r, g, b }) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  wh.detectPageTheme = function detectPageTheme() {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const rgb = parseRgb(getComputedStyle(el).backgroundColor);
      if (rgb && rgb.a > 0.1) return luminance(rgb) < 0.5 ? 'dark' : 'light';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  };

  wh.applyTheme = function applyTheme(theme) {
    [wh.toolbar, wh.popup, wh.sidebar, wh.colorPop, wh.stylePop].forEach(el => {
      if (el) el.dataset.whTheme = theme;
    });
  };

  let currentTheme = 'light';
  wh.refreshTheme = function refreshTheme() {
    const t = wh.detectPageTheme();
    if (t !== currentTheme) {
      currentTheme = t;
      wh.applyTheme(t);
    }
  };

  wh.watchTheme = function watchTheme() {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', wh.refreshTheme);
    } catch (e) {}
    let raf = 0;
    const themeObserver = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(wh.refreshTheme);
    });
    const filter = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] };
    themeObserver.observe(document.documentElement, filter);
    themeObserver.observe(document.body, filter);
  };
})();
