# Prompt Diary

A password-manager-style vault for your best AI prompts. Great prompts get
lost in chat history — Prompt Diary saves them, organizes them, syncs them
across devices, and lets you share them with your team or the world.

**Chrome extension** (save from any page, works offline) + **web dashboard**
(manage, teams, public gallery) + **self-hosted backend** (Next.js API,
Postgres).

## Features

- **Save from anywhere** — highlight text on ChatGPT, Claude, or any page → right-click → *Save to Prompt Diary*
- **Vault popup** — folders, tags, search, pin, one-click copy
- **Offline-first** — extension works fully without an account; local vault in `chrome.storage.local`
- **Accounts + sync** — email/password (Google OAuth ready), last-write-wins sync across devices
- **Visibility per prompt** — `private` (closed), `team` (shared with a team), `public` (open source)
- **Teams** — create teams, invite by email, shared team prompt library
- **Public gallery** — browse and search community prompts, add them to your own diary
- **Backup** — JSON export/import from the dashboard

## Stack

TypeScript everywhere · Bun workspaces · Chrome Extension MV3 (Vite + CRXJS + React) · Next.js 15 (dashboard + `/api/v1`) · Better Auth (cookie sessions + bearer tokens) · Drizzle ORM · PostgreSQL (Docker locally, Neon in prod)

```
extension/   Chrome extension (popup vault, context menu, sync engine)
web/         Next.js: dashboard pages + API routes + auth
shared/      Zod schemas + types used by both
```

## Getting started

Prereqs: [Bun](https://bun.sh), Docker, Chrome.

```bash
bun install

# 1. database
docker compose up -d                # postgres on localhost:5433
cp .env.example web/.env.local      # fill in BETTER_AUTH_SECRET
cd web && bun run db:migrate

# 2. web (dashboard + API) — http://localhost:3000
bun run dev

# 3. extension
cd ../extension && bun run build
# chrome://extensions → Developer mode → Load unpacked → extension/dist
```

Sign up on the dashboard or directly in the extension popup (*Sign in to
sync*). Same account everywhere.

### Deploying

- **Web**: deploy `web/` to Vercel. Set `DATABASE_URL` (Neon connection string), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your prod URL), and optionally Google OAuth credentials. Run `bunx drizzle-kit migrate` against Neon.
- **Extension**: point it at prod by setting `{ "apiUrl": "https://your-app.vercel.app" }` in its storage (and add the URL to `host_permissions` in `extension/manifest.config.ts`), rebuild, and submit `extension/dist` to the Chrome Web Store.

## Security model

Every prompt access goes through a single `canAccessPrompt()` in
`web/src/lib/permissions.ts`:

| | read | write |
|---|---|---|
| owner | ✓ | ✓ |
| team member | ✓ (team prompts) | ✗ |
| anyone | ✓ (public prompts) | ✗ |

The full permission matrix is tested in `web/tests/permissions.test.ts`
(`cd web && bun test`, needs the docker db running).

## Scripts

| Where | Command | What |
|---|---|---|
| root | `bun run db:up` | start local postgres |
| root | `bun run dev:web` / `bun run dev:extension` | dev servers |
| web | `bun run db:migrate` | apply migrations |
| web | `bun test` | permission matrix tests |
| web / extension / shared | `bun run typecheck` | strict TS |
