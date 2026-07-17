# Prompt Diary

A password-manager-style vault for your best AI prompts. Great prompts get
lost in chat history — Prompt Diary captures them in one click, organizes
them, syncs them across devices, and shares them on your terms.

**Chrome extension** (save & insert from any AI chat, works offline) +
**web dashboard** (organize, compare, teams, public gallery) +
**self-hosted backend** (Next.js API, Postgres).

## Features

### Chrome extension
- **One-click save everywhere** on ChatGPT, Claude, Gemini, Perplexity, Poe:
  - selection bubble (`Pd`) on any highlighted text
  - composer button — save your prompt before you even send it
  - `Pd · Save` button at the end of every finished chat message (with inline Saved ✓ / Already saved feedback)
  - right-click → *Save to Prompt Diary* on any site
- **Insert into chatbox** — press `Enter` in the popup and the prompt lands directly in the active chat's composer (falls back to copy elsewhere)
- **Global hotkey** `Alt+P` opens the popup (current binding shown in the footer, one click to Chrome's shortcut editor)
- **Launcher-style popup** — search is always focused (typing anywhere routes to it), `↑↓` navigate, `Enter` inserts, recents float to the top
- **Auto-tagging** — saves are tagged with their source site (`chatgpt`, `claude`, …)
- **Duplicate detection** — same text never saves twice
- **Offline-first** — full local vault, no account required; signs in via email/password or by adopting your web session (Google users)
- Auto-sync on popup open (last-write-wins, conflict-safe)

### Web dashboard
- **My Prompts** — folders as sidebar channels (Discord-style), pinned tab, live search (`/`), visibility filter, always-visible copy, entry counts
- **Prompt detail as a real route** (`/dashboard/p/[id]`) with **before/after output panes**: paste text or upload **screenshots** of model output next to the prompt itself
- **Autosave** — debounced, diff-only patches while you type, with Saving…/Saved ✓ indicator and `⌘Enter` / `Esc` to finish
- **Undo delete** — deletes are soft with an Undo toast
- **Command palette** `⌘K` — search prompts (Enter copies, ⇧Enter opens), jump folders, run actions
- **Visibility per prompt** — `private` and/or `team` and/or `public` (independent dials: a prompt can be team-shared *and* open source)
- **Teams** — invite by email, invitee accepts from their Teams page, shared library with per-prompt badges, WhatsApp-style cards
- **Public gallery** — browse open-source prompts with full before/after view, add-to-my-diary with dedupe (re-add restores after delete)
- **Profile** — avatar upload (Cloudinary), username, email verification, keyboard-shortcut reference, JSON export
- **Email verification gates** — publishing publicly, creating teams, and accepting invites require a verified email (Gmail SMTP, 2 env vars)
- Mobile responsive (hamburger sidebar), toasts, onboarding first-run, GSAP micro-interactions with `prefers-reduced-motion` support

### Security model
Every prompt access routes through one `canAccessPrompt()`
([permissions.ts](web/src/lib/permissions.ts)): owner ✓ read/write · team
member ✓ read · public ✓ read for anyone. The full matrix is tested in
[permissions.test.ts](web/tests/permissions.test.ts). Comparison images are
locked to our Cloudinary CDN (signed uploads pinned to image formats); auth
via Better Auth (cookie sessions + bearer tokens + 5-min cookie cache, brute
force limiter on Redis in prod); extension CORS fails closed without
`EXTENSION_IDS`; webhooks reject replays; prod ships CSP + HSTS; soft
deletes; rate-limited API. Full audit + fixes: 2026-07-17.

### Speed
Server-rendered dashboard with a TanStack Query layer: hard loads paint with
data (session gate + the 5 shared queries prefetched during SSR, hydrated —
zero skeletons, zero client API calls on arrival), revisits render from
cache, mutations invalidate globally, rows prefetch on hover, and frequent
actions (delete, bookmark, reorder) are optimistic. Details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

TypeScript everywhere · Bun workspaces · Chrome Extension MV3 (Vite + CRXJS + React) · Next.js 15 (dashboard + `/api/v1`) · Better Auth · Drizzle ORM · PostgreSQL (Docker locally, Neon in prod) · Cloudinary (signed direct uploads) · GSAP

```
extension/   popup vault, content scripts, sync engine
web/         Next.js: pages + API routes + auth
shared/      Zod schemas + types used by both
```

## Getting started

Prereqs: [Bun](https://bun.sh), Docker, Chrome.

```bash
bun install

# 1. database + env (ONE .env at the repo root feeds everything)
docker compose up -d                # postgres on localhost:5433
cp .env.example .env                # fill in BETTER_AUTH_SECRET (+ GMAIL_*, CLOUDINARY_*)
cd web && bun run db:migrate

# 2. web (dashboard + API) — http://localhost:3000
bun run dev

# 3. extension
cd ../extension && bun run build
# chrome://extensions → Developer mode → Load unpacked → extension/dist
```

## Deploying

**Deployed URL**: _<your Vercel URL>_

1. **Web → Vercel**: import the repo and — **critical** — set
   *Settings → Build and Deployment → Root Directory* to `web` (otherwise
   Vercel serves the extension bundle as the website). `web/vercel.json`
   pins Bun install and runs migrations during every build. Env vars:
   `DATABASE_URL` (Neon **pooled** string), `BETTER_AUTH_SECRET` (fresh one,
   not your dev value), `BETTER_AUTH_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   and optionally `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. **Also set
   `EXTENSION_IDS`** (your published extension's id) — extension CORS fails
   closed in production without it.
2. **Google OAuth** (if used): authorized redirect URI
   `https://<deployed-url>/api/auth/callback/google`.
3. **Extension store build**:
   ```bash
   VITE_API_URL=https://<deployed-url> bun run package:extension
   ```
   Produces `prompt-diary-extension.zip` — upload at the Chrome Web Store
   Developer Dashboard ($5 one-time). Privacy policy URL:
   `https://<deployed-url>/privacy`.

## Scripts

| Where | Command | What |
|---|---|---|
| root | `bun run db:up` / `db:migrate` | local postgres / apply migrations |
| root | `bun run dev:web` / `dev:extension` | dev servers |
| root | `bun run build` | build web + extension |
| root | `bun run package:extension` | store-ready zip (use with `VITE_API_URL`) |
| root | `bun test` | permission-matrix tests (needs docker db) |
