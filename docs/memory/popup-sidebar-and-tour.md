# Memory: Popup left sidebar + animated guided tour

**Shipped:** 2026-07-16, commit 285cf3f. Replaced the first discoverability attempt
(c526238: Record chip + static help overlay) after the user rejected it ("how it works
looks shit... bring back the side panel which it already had").

**Standing vocabulary decision:** when the user says the extension's "side panel"
they mean the popup's own left sidebar column — NOT chrome.sidePanel.

**Sidebar** (`extension/src/popup/App.tsx` + `styles.css`). The popup is now a
two-column `.app` row: a 148px `.sidebar` (brand wordmark, All prompts, ★ Pinned,
Folders section, auth-only Threads section) beside `.main` (search row, list, footer).

- Folder nav-items filter on click, delete on right-click (`onContextMenu` →
  `handleDeleteFolder`), "+ New folder" inline.
- Threads section: a ◉ Record nav-item (CircleDot) that opens the thread picker, turns
  `danger` red with the thread title while recording, and stops on click; "+ New
  thread" (creates + immediately starts recording it); "+ New project".
- `.nav-item.active` uses the tint background + 2px inset ink bar — the same
  selection vocabulary as the web dashboard.
- The old chip-row navigation, the ⋯ manage overlay, and the static help overlay were
  all DELETED.

**Guided tour.** Help is now a 7-step animated tour (TOUR array): save-from-AI-chats
intro, search + ↵ insert (interpolates the live hotkey), + New, folders, record/threads
as recipes, context transfer, usage meter. Each step:

- measures its real control via `document.querySelector('[data-tour="<target>"]')`
  and `getBoundingClientRect` (targets: search, new, folders, record, transfer),
- draws a pulsing `.tour-ring` around it and a bobbing ▼ `.tour-arrow` pointing at it
  (arrow flips below the target near the top edge so it never clips),
- shows a fixed-bottom `.tour-card` (slide-up animation, display-serif title, step
  dots, Back / Next / Done, × skip).

The tour auto-runs on first open (`helpSeen` flag in chrome.storage.local) and re-runs
from the HelpCircle button in the search row. All tour animations die under
`prefers-reduced-motion` (the reduced-motion block kills both transitions AND
animations).
