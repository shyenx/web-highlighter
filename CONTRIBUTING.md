# Contributing

Thanks for your interest. This is a small, dependency-free project — please keep PRs in the same spirit.

## Development setup

There is no build step. Edit files directly and reload the extension at `chrome://extensions/`.

```
web-highlighter-ext/
├── manifest.json     # MV3 manifest
├── background.js     # Service worker (icon click + commands)
├── content.js        # Main logic, injected into all pages
├── content.css       # Styles for toolbar, popup, sidebar
└── icons/            # 16/32/48/128 PNG icons
```

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
