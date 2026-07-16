# Memory: AI context transfer between chat models

**Shipped:** 2026-07-15, commit ef2795a (chunk 1 of the v2 backlog).

**What it is.** A user deep in a ChatGPT conversation can carry that conversation's
context to Claude or Gemini and continue where they left off. Local-only: no server,
no AI summarization, one handoff slot.

**How it works.**

- **Capture.** The popup shows a Transfer button (ArrowLeftRight icon) only when the
  active tab is chatgpt.com, chat.openai.com, claude.ai, or gemini.google.com. Clicking
  it sends a `capture-transcript` message to the content script.
- **Extraction** (`extension/src/content.ts`). Walks the per-site `MESSAGE_SELECTORS`
  in DOM order; dedupes nested matches with `accepted.some(a => a.contains(el))`;
  skips elements with `data-is-streaming='true'`; hides our injected Pd·Save buttons
  (`data-pd-btn` marker) before reading `innerText`. Per-site `roleOf(el)` resolves
  speaker roles: ChatGPT via `data-message-author-role`, Claude via
  `data-testid='user-message'` vs assistant classes, Gemini via `closest('user-query')`
  best-effort. Whole messages are truncated from the TOP at
  `MAX_HANDOFF_CHARS = 60_000` with a `truncated` flag.
- **Storage** (`extension/src/lib/handoff.ts`). A `Handoff` type
  `{site, url, title, capturedAt, messages[{role?, text}], charCount, truncated}` in a
  single chrome.storage slot keyed `"handoff"`, with 24-hour delete-on-read expiry.
- **Delivery** (`extension/src/popup/App.tsx`). A banner between the header and the
  list: Continue "title" (site · N messages) with Insert and dismiss. Insert runs
  `buildHandoffText` — a labeled template block with `User:`/`Assistant:` turns and a
  truncation note — through the shared `insertText(body)` cascade: content-script
  insert-prompt message → `chrome.scripting` `insertIntoFocusedField` (native value
  setter + input event for React inputs, execCommand for contenteditable) → clipboard
  fallback. The slot clears on successful insert.

**Key decision.** The user explicitly corrected an early misread: this is context
transfer BETWEEN MODELS ("one ai bot context needs to be transferred onto another
model"), not cross-window sync. Perplexity and Poe have no capture selectors — the
Transfer button hides there and capture returns `{ok:false}` gracefully.

**Tests:** extension/tests/handoff.test.ts.
