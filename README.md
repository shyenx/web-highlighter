# Web Highlighter

> A lightweight Chrome extension for highlighting and annotating any web page. Persistent, draggable, keyboard-friendly. No account, no cloud, no tracking.

**Languages:** [English](README.md) · [简体中文](README.zh-CN.md)
**Links:** [Changelog](CHANGELOG.md) · [License](LICENSE) · [Latest release](https://github.com/shyenx/web-highlighter/releases/latest)

![Web Highlighter — multiple highlights with toolbar](img/screenshot-20260515-132850.png)

## Screenshots

**v0.2.0 toolbar (4 mark styles)**

![Toolbar v0.2.0](img/screenshot-20260517-144328-v2.png)

| Toolbar (v0.1) | Multi-color highlights |
|---|---|
| ![Toolbar](img/screenshot-20260515-132726.png) | ![Highlights](img/screenshot-20260515-132850.png) |

## Features

- **Select-to-highlight** — Selecting text instantly applies the current color and style
- **4 mark styles** — Background, underline, strikethrough, wavy underline (switch on the fly)
- **5 preset colors** — Yellow / Green / Pink / Blue / Purple
- **Bilingual UI** — Toggle between English and 简体中文 from the toolbar
- **Persistent** — Saved per `host + path`, survives reload and browser restart
- **SPA-aware** — Toolbar and highlights survive client-side navigation on React / Vue / Next.js sites
- **Self-healing UI** — Toolbar automatically re-attaches if the host page removes it
- **Notes** — Attach a text note to any highlight, shown on hover
- **Sidebar TOC** — One-click panel listing all highlights on the page; click to scroll + flash
- **Undo** — `Cmd/Ctrl + Shift + Z` for the last 50 actions
- **Recolor / restyle / delete** — Click any highlight to open the inline editor
- **Draggable toolbar** — Position is remembered
- **JSON export** — Export all highlights and notes for the current page
- **Local-only** — All data stays in `chrome.storage.local`, no network calls

## Install (unpacked)

1. Download the latest [release zip](https://github.com/shyenx/web-highlighter/releases/latest), or `git clone` this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the extracted folder
5. Reload any web page; the toolbar appears in the bottom-right corner

## Usage

| Action | How |
|---|---|
| Highlight text | Select with the mouse — instant highlight on mouse-up |
| Change default color | Click a swatch in the toolbar |
| Change default style | Click a style button (`A`, `A̲`, `A̶`, `A̰`) |
| Recolor / restyle / delete a highlight | Click it (no drag) to open the inline editor |
| Add or edit a note | Click a highlight → type in the textarea → `Cmd/Ctrl + Enter` to save |
| Open sidebar list | Toolbar `☰` button |
| Undo | `Cmd/Ctrl + Shift + Z` or toolbar `↶` |
| Toggle toolbar visibility | Click the extension icon, or `Alt + H` |
| Drag the toolbar | Hold the `⋮⋮` handle on the left |
| Clear all highlights on this page | Toolbar **Clear** (undoable) |
| Export JSON | Toolbar **Export** |
| Pause highlight-on-select | Toolbar **Enabled / Disabled** |
| Switch UI language | Toolbar `EN / 中` button |

## Privacy

This extension makes **zero network requests**. All highlights, notes, and settings are stored in `chrome.storage.local` on your device only. The `<all_urls>` host permission exists solely to let you highlight on any page. Source code is fully open for audit.

## How it works

Highlights are implemented by splitting text nodes within the selection range and wrapping them in `<span class="wh-mark">`. For persistence, each mark stores the original text plus 20 characters of surrounding context; on page load, marks are restored by locating that text in the live DOM. SPA navigation is detected by patching `history.pushState` / `replaceState` and listening for `popstate` / `hashchange`. A `MutationObserver` re-attaches the toolbar if the page removes it. No external libraries; pure vanilla JS/CSS.

## Limitations

- Cannot inject into restricted pages (`chrome://`, Chrome Web Store, embedded PDF viewer)
- Highlights may fail to restore if the original page text changes significantly
- When the same text appears multiple times, restoration matches the first occurrence using context

## Roadmap

- [ ] Options page: cross-page highlight dashboard, grouped by host / date
- [ ] Markdown export / copy-as-blockquote
- [ ] Anchor fallback: XPath / CSS selector in addition to text matching
- [x] SPA route changes auto-restore (v0.3.0)
- [x] Bilingual UI (v0.4.0)
- [ ] Screenshot export (with highlights baked in)

## Contributing

Issues and PRs are welcome. Before submitting:

1. Manually run through the main flow on a clean Chrome profile
2. If touching the restore logic, verify on at least 3 structurally different sites
3. Match the existing code style: vanilla JS, no transpiler, no framework

## License

[MIT](LICENSE)
