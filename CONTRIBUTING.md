# Contributing

Thanks for your interest. This is a small, dependency-free project — please keep PRs in the same spirit.

## Development setup

There is no build step. Edit files directly and reload the extension at `chrome://extensions/`.

```
web-highlighter-ext/
├── manifest.json        # MV3 manifest
├── background.js        # Service worker (icon click + commands)
├── content.css          # Styles for toolbar, popup, sidebar
├── src/                 # Content script modules, loaded in numbered order
│   ├── 10-i18n.js       # I18N dictionary + t() + language detection
│   ├── 20-core.js       # Constants + cache + undo stack + UI refs
│   ├── 30-storage.js    # chrome.storage wrappers + per-page key
│   ├── 40-range.js      # Range/text-node ops + applyAppearance
│   ├── 50-theme.js      # Page-bg theme detection + watchers
│   ├── 60-mark.js       # Highlight / recolor / restyle / delete / undo / restore
│   ├── 70-ui.js         # buildUI + handlers + renderSidebar + relocalize
│   ├── 80-spa.js        # URL change handling + history patch + MutationObserver
│   └── 90-content.js    # Entry: install guard + listeners + boot
└── icons/               # 16/32/48/128 PNG icons
```

All modules share state through a `window.__wh` namespace (content scripts run
in an isolated world, so this does not pollute the host page). Load order is
declared in `manifest.json` `content_scripts.js` array.

## Pull request checklist

- [ ] Manually test the main flow: highlight, recolor, delete, note, undo, sidebar, drag, export
- [ ] If you touch the restore logic, verify on at least 3 structurally different sites (a static blog, a long-form article with nested inline elements, a documentation site)
- [ ] No new runtime dependencies (this is intentional)
- [ ] Match the existing code style: vanilla JS, no transpiler, no framework
- [ ] Update `CHANGELOG.md` under an `[Unreleased]` section

## Reporting bugs

Please include:

- Chrome version and OS
- The URL where the bug occurred (or a minimal reproduction page)
- Steps to reproduce
- Screenshots if visual

## Scope

This extension is intentionally small. Features that fit the core "select-to-highlight, persist, annotate" loop are welcome. Features that require a backend, an account, or third-party APIs are out of scope for the main repo — feel free to fork.
