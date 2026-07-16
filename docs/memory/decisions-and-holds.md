# Memory: Standing decisions, holds, and QA state (as of 2026-07-16)

## MCP is ON HOLD — do not build

The user stopped MCP mid-build on 2026-07-16: "MCP is still in discussion no need to
build that part." A full implementation had been started (api_keys table + migration,
pd_live_ bearer resolution in getUser, /api/v1/keys route, mcp/ workspace with
save_prompt/save_thread/search_prompts) and was **fully reverted**: files deleted,
tracked files restored, the api_keys table dropped, and the drizzle migration
bookkeeping row removed so `db:migrate` stays clean. Migration number 0012 was then
reused by the billing subscriptions table. Nothing MCP-related exists in the repo.
When MCP is approved, API-key gating would join billing's Pro gate.

## Standing user rules (learned the hard way, do not re-litigate)

- "All models" always means EVERY AI site, never just chatgpt/claude/gemini.
- Usage/limit numbers are estimates and every surface must say "estimated".
- Style facets are computed heuristics (`promptFacets`), NEVER a stored enum.
- Profile Backup/Export was removed permanently — never re-add import/export.
- The extension's "side panel" means the popup's own left sidebar column.
- Thread = recipe (ordered chain of saved prompts → final output), Project = shelf.
- One commit per chunk, lowercase conventional messages, push after each.
- Migrations are append-only: 0000–0012 (0010 thread visibility, 0011
  gallery_bookmarks, 0012 subscriptions).

## Final QA state (9d8b996)

- No horizontal overflow at 375px or 1920px on dashboard, gallery, teams, profile,
  and the public share pages; the mobile drawer (Menu button) exists at 375px.
- Zero console errors across the swept pages.
- Test suites: 27 web tests (permissions, facets, cloudinary, threads, billing) and
  10 extension tests (handoff, limits) — all green.
- Store zip refreshed via `bun run package:extension` (~87 KB).
- Production `next build` was NOT run because the dev server was serving (running
  next build while dev serves clobbers .next and breaks the dev server — recorded
  gotcha). Run it before deploying.

## Environment gotchas

- Postgres runs on port 5433 (user promptdiary / db promptdiary), docker compose.
- tailwind.config.ts changes require a dev-server restart (stale JIT config).
- Test account for design checks: design-check@test.local / password12345.
- Extension must be manually reloaded from extension/dist in chrome://extensions
  after builds that change the manifest or permissions.
