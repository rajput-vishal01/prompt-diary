# Memory: On-page usage limit tracker (rebuilt)

**Shipped:** 2026-07-15. First version 8990620 (DOM observation) was rejected by the
user and REBUILT as a5e722a (send-event detection). The rebuild is the canonical design.

**Why the rebuild.** V1 observed rendered messages in the DOM and counted them locally.
Two fatal flaws the user hit immediately: a page refresh reset the count (hydration
grace race + storage-load race), and it only covered chatgpt/claude/gemini. Standing
user rule recorded from this: **"all models" always means every AI site** — build
multi-site from the start. And usage must persist to the database, not locally.

**How the rebuilt tracker works.**

- **Detection = send events, not DOM messages.** `extension/src/content.ts` listens
  capture-phase for Enter in a non-empty composer plus clicks on send buttons
  (`button[data-testid*='send' i], button[aria-label*='send' i], button[type='submit']`)
  with a 1.5-second debounce. Selector-free by design — any new AI site only needs a
  manifest match pattern plus an entry in `extension/src/lib/limits.ts` SITES.
- **12 sites** in the SITES map: chatgpt, claude, gemini, perplexity, poe, deepseek,
  grok, copilot, mistral, kimi, qwen, meta — 15 match patterns in
  `extension/manifest.config.ts`. `limitsFor()` falls back to conservative
  `DEFAULT_LIMITS` for sites without researched numbers.
- **Persistence = DB.** `usage_messages` table (migration 0009: id, userId cascade,
  site, at timestamp, index user_site_at) with 48-hour self-prune and future-clock
  rejection. Endpoints `POST/GET /api/v1/usage/messages` (batch push via
  `UsageEventsSchema`, GET returns last-24h epoch-ms array).
- **Background worker owns networking** (content scripts are blocked by page-origin
  CORS): `extension/src/background.ts` handles `usage-msg` (record + flush + cache
  bust) and `get-usage` (60-second server cache). Offline queue `usageEvents` flushes
  on events and on popup sync; a local log `usageLocalLog` covers signed-out users.
- **Widget.** A shadow-DOM `.pd-limit` box bottom-right on AI pages: count against the
  rolling window, a three-state bar (ok / warn at ≥70% / over), `resetEta` countdown,
  and a per-site plan selector (free / plus / pro) stored in chrome.storage
  `sitePlans`. Every number is labeled **estimated** — the honesty rule for all usage
  surfaces.

**Tests:** extension/tests/limits.test.ts (three states, site coverage, rolling window).
