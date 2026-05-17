# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-05-17

### Fixed
- Click-vs-select on existing highlight: the editor popup no longer pops up while you're trying to drag-select text inside a marked region (uses click intent + selection check)
- Empty/whitespace-only selections no longer create zombie marks
- `findTextRange` guards against empty text (prevents potential infinite loop)
- Second restore pass only runs when the first pass left unresolved marks (saves wasted DOM walks)
- Cleared stale `text-decoration-thickness` / `text-underline-offset` when switching styles
- Storage writes are now wrapped in try/catch with a `console.warn` on failure (no more silent quota errors)

### Changed
- Dropped unused `scripting` permission from manifest (smaller install-warning footprint)

### Added
- Press `Esc` to close the inline popup
- When opening the popup on a mark with no existing note, the note textarea auto-focuses

## [0.2.0] - 2026-05-17

### Added
- **Line styles**: in addition to background highlight, you can now annotate with **underline**, **strikethrough**, or **wavy underline**
- Toolbar style picker (4 buttons, each previews in the current default color)
- Per-mark style editor in the inline popup (change style of any existing mark)
- Style changes are undoable
- Style preference (`lastStyle`) is persisted across sessions

### Changed
- Marks now have a `style` field (`'bg' | 'underline' | 'strike' | 'wavy'`); existing marks without it default to `'bg'`
- Inline appearance is applied via a unified `applyAppearance(el, color, style)` helper

## [0.1.0] - 2026-05-15

### Added
- Select-to-highlight with 5 preset colors
- Persistent storage per `host + path` via `chrome.storage.local`
- Inline editor on click: change color, delete, add note
- Notes with hover tooltip
- Sidebar list of all highlights on the page (click to scroll + flash)
- Undo for the last 50 actions (`Cmd/Ctrl + Shift + Z`)
- Draggable toolbar with remembered position
- JSON export of current page's highlights
- Toggle toolbar via extension icon or `Alt + H`
