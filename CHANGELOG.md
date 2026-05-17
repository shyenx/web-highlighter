# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.3] - 2026-05-17

### Changed
- **Options inside picker popovers select on hover** — slide the mouse
  over a swatch or style and it applies immediately. Click still works
  and additionally closes the popover. Moving the mouse away from both
  popover and trigger closes it after 200 ms (last hovered option is
  what stays selected).
- Hover-feedback CSS: swatches scale up slightly on hover; style buttons
  get a subtle background.

## [0.6.2] - 2026-05-17

### Changed
- **Picker popovers now open on hover** instead of requiring a click —
  mouse over the color or style button → popover appears; move away →
  it closes after 200 ms. The delay lets the cursor bridge the gap
  between button and popover without dismissing.
- Clicking still works for selection inside the popover (click a swatch
  or style to apply); the picker buttons themselves are no longer
  click-toggles.

## [0.6.1] - 2026-05-17

### Changed
- **Toolbar is much shorter now**: the 5 color swatches and 4 style
  buttons are replaced with two compact picker buttons that open
  popovers on click. Each picker shows the current selection inline
  (color dot / preview of current style). Saves ~180 px of toolbar
  width — much more comfortable on small windows and side-by-side
  layouts.
- The popovers respect the page-aware dark theme, dismiss on outside
  click, and auto-close on scroll / window resize.

## [0.6.0] - 2026-05-17

### Changed (refactor — no behaviour changes)
- **Split `content.js` into 9 modules under `src/`** loaded in order from
  the manifest (`10-i18n.js` through `90-content.js`). Each is an IIFE
  that shares state through a `window.__wh` namespace. Pre-split file
  was 900 lines in a single IIFE; new files are 50–280 lines each with
  clear boundaries (i18n / core state / storage / range ops / theme /
  mark operations / UI / SPA / entry point).
- Header comments at the top of each file explain its scope and any
  cross-module assumptions.

### Added
- **Sidebar items are keyboard-accessible** (`tabindex="0"`, `role="button"`,
  Enter/Space activate). Was M7 from code review.
- **Localized tooltip** on the EN/中 language toggle button (`Switch to
  中文` / `切换到 English`). Was M3.
- **CI workflow `privacy-check.yml`** greps shipped source for `fetch`,
  `XMLHttpRequest`, `WebSocket`, `sendBeacon`, native messaging — fails
  the build if any appear. Keeps the README's "zero network requests"
  promise honest going forward.

### Not yet in 0.6.0 (planned for 0.6.x)
- I5: parse modern color formats (`color(srgb …)`, `oklch(…)`) in theme detection
- I6: luminance deadband to avoid theme flicker on mid-gray pages
- C1–C4: SPA improvements that were rolled back in 0.5.2 — to be re-introduced
  one at a time with explicit testing on anthropic.com / heygen / GitHub

## [0.5.3] - 2026-05-17

### Fixed
- **Toolbar disappearing on smaller windows**: if the toolbar was
  previously dragged to a position that's now off-screen (e.g. on a
  laptop after using a larger monitor), `buildUI` would still apply the
  stored coordinates verbatim, leaving the toolbar invisible. Now
  clamps to the current viewport on startup, then re-clamps with real
  measured dimensions on the next animation frame. (Discovered when a
  user reported the toolbar missing from example.com but showing on
  GitHub — only difference was viewport size at the time of last drag.)

## [0.5.2] - 2026-05-17

### Fixed
- **Pages failing to load after installing v0.5.1**: rolled back the
  aggressive SPA-related changes (history re-patching on every URL
  change, MutationObserver re-binding on every URL change, the
  queued URL-change loop). Reverted to the simpler v0.3.0-style
  single-pass logic that proved stable.

### Kept (from v0.5.1)
- CSS transitions on theme switch (M4)
- Batched `unwrapMarks()` with parent dedup before normalize (M8)
- Toolbar viewport clamping in `ensureUIAttached` (I3)
- Storage isolation: `currentKey` set only after storage read
  succeeds (I7)
- Theme refresh at top of `onUrlChange` to avoid 300 ms flash (I2)
- Only unwrap stale marks on navigation, not all marks (I1)

### Removed (will revisit in v0.6.0 with proper testing)
- Queue-based URL change loop (C1)
- `ensureHistoryPatched` re-patch on every URL change (C4)
- `rebindBodyObservers` / `rebindThemeObserver` on every URL change (C3)
- `uiReady` startup race guard (C2) — single-pass logic doesn't need it

## [0.5.1] - 2026-05-17

### Fixed
- **Rapid SPA navigation no longer drops events**: `onUrlChange` now
  queues with a request flag and re-runs after the in-flight pass
  finishes, so back-to-back A→B→C navigations always land on C
- **Startup race**: URL change events fired before the UI is built are
  now queued and replayed once `buildUI` completes
- **MutationObservers survive SPA root swaps**: `body` and theme
  observers re-attach on every URL change (covers Next.js / React
  replacing `#__next` / `#root`)
- **`history.pushState` / `replaceState` self-heal**: re-patched on
  every URL change if another extension or the page reassigned them
- **No more brief un-highlight flash on SPA navigation**: only marks
  whose id is absent from the new page's storage are unwrapped
  (previously all marks were stripped immediately)
- **No more 300 ms light/dark flash when navigating between pages of
  opposite themes**: `refreshTheme` runs at the top of `onUrlChange`
- **Storage isolation**: `currentKey` is now updated only after
  storage read succeeds, so a transient `chrome.storage.local` failure
  can no longer write the new page's marks under the old key
- **Toolbar clamped to viewport** after self-heal (handles window
  resize / mobile rotation while toolbar was hidden)
- **Theme transitions** are now 150 ms eased instead of instant snaps

### Performance
- `unwrapMarks()` deduplicates parent nodes before calling
  `normalize()`, dropping the O(N²) worst case to O(N) on pages with
  many highlights

## [0.5.0] - 2026-05-17

### Added
- **Page-aware dark theme**: toolbar, sidebar, and popup now follow the
  host page's actual background — not the OS — so they match sites that
  ship their own dark mode (or override the system preference).
- Detection reads the computed background color of `<body>` / `<html>`,
  computes luminance, and falls back to `prefers-color-scheme` if both
  are transparent.
- A `MutationObserver` watches `html` / `body` `class`, `style`,
  `data-theme`, `data-color-mode` attributes (covers the common
  toggle patterns: `.dark` class on html, `data-theme="dark"` on body,
  etc.), and re-detects on `prefers-color-scheme` change.
- Theme is re-applied after SPA navigation as well.

## [0.4.0] - 2026-05-17

### Added
- **Bilingual UI (English / 简体中文)**: every visible string in the
  toolbar, inline popup, sidebar, tooltips, placeholders, and the
  "clear all" confirm dialog is now translated
- Toolbar gains a **`EN / 中` toggle button**; click switches the UI
  language instantly without losing position or marks
- Language defaults to the browser's `navigator.language` on first run
  (Chinese variants → `zh`, everything else → `en`)
- Preference persists across sessions in `chrome.storage.local`

### Changed
- README split into separate `README.md` (English, primary) and
  `README.zh-CN.md` (Chinese), cross-linked at the top of each
- Toolbar `×` (hide) button now has a localized tooltip

## [0.3.0] - 2026-05-17

### Added
- **SPA support**: the toolbar and highlights now survive client-side
  navigation on React / Vue / Next.js sites. The extension patches
  `history.pushState` / `replaceState`, and listens for `popstate` /
  `hashchange`. On URL change it swaps the storage key, reloads marks
  for the new page, and re-runs restore.
- **Self-healing UI**: a `MutationObserver` on `document.body` re-attaches
  the toolbar / popup / sidebar if the host page removes them
- **Lazy content restore**: when the page injects significant new DOM
  (infinite scroll, lazy-loaded articles), a throttled re-restore runs
  so highlights inside newly-rendered content show up

### Fixed
- Toolbar disappearing on anthropic.com and other Next.js sites after
  client-side navigation

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
