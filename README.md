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
- **Accounts + sync** — email/password with auto sign-in on registration (Google OAuth ready), last-write-wins sync across devices
- **Visibility per prompt** — `private` (closed), `team` (shared with a team), `public` (open source)
- **Email verification gates** — only verified accounts can publish public prompts, create teams, or accept team invites (in dev the verification link is printed to the server console; wire Resend/SES for prod)
- **Teams** — invite by email; the invitee sees the invite on their Teams page and must accept before joining. Shared team prompt library per team
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

# 1. database + env (ONE .env at the repo root feeds everything)
docker compose up -d                # postgres on localhost:5433
cp .env.example .env                # fill in BETTER_AUTH_SECRET (+ GMAIL_* for emails)
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

**Deployed URL**: _<add your Vercel URL here after deploying — you'll need it below>_

1. **Web → Vercel**: import the repo and — **critical** — set
   *Settings → Build and Deployment → Root Directory* to `web`. Without it,
   Vercel builds the whole monorepo and serves the chrome extension's static
   build as the website (you'll see `chrome.storage ... undefined` errors).
   `web/vercel.json` pins the framework to Next.js and the install to Bun
   (npm can't resolve `workspace:*` deps). Env vars (from `.env.example`):
   `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the
   deployed URL itself), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and optionally
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
2. **Migrate Neon**: `cd web && DATABASE_URL=<neon-url> bunx drizzle-kit migrate`
   — and on Vercel use Neon's **pooled** connection string (host contains
   `-pooler`): serverless functions open many short-lived connections, and
   the pooler makes them fast and keeps Neon's connection limit safe.
3. **Google OAuth** (if used): in Google Cloud Console add the authorized
   redirect URI `https://<deployed-url>/api/auth/callback/google`.
4. **Extension store build**:
   ```bash
   VITE_API_URL=https://<deployed-url> bun run package:extension
   ```
   This bakes the prod URL into the API client + `host_permissions` and
   produces `prompt-diary-extension.zip` at the repo root — upload that zip
   to the Chrome Web Store Developer Dashboard.

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
