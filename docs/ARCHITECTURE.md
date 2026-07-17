# Architecture

Technical map for anyone (human or model) continuing this app. Companion to
the conventions in [/CLAUDE.md](../CLAUDE.md) and the visual system in
[/DESIGN.md](../DESIGN.md). Current as of commit `88507f9` (2026-07-17).

## Monorepo

```
web/         Next.js 15 App Router — dashboard, /api/v1, Better Auth, share pages
extension/   Chrome MV3 — launcher popup (React), content script, sync engine
shared/      Zod schemas + types imported by both (transpiled via transpilePackages)
```

Bun workspaces; ONE `.env` at the repo root (loaded by `web/next.config.ts`
and `drizzle.config.ts` via `process.loadEnvFile`). Postgres 5433 local
(Docker), Neon pooled in prod. Drizzle ORM; migrations in `web/drizzle/`.

## Web data layer (TanStack Query + RSC hydration)

The dashboard's perceived speed comes from four cooperating pieces:

1. **Server session gate** — `app/dashboard/layout.tsx` is a server
   component: `auth.api.getSession()` during SSR (cheap: 5-min signed
   cookieCache) redirects dead sessions before HTML ships. No client-side
   loading gate exists anymore.
2. **Server prefetch + hydration** — the same layout calls
   `prefetchApi([prompts, folders, projects, threads, teams])`
   (`lib/server-prefetch.tsx`): self-fetch of the REST endpoints with the
   caller's cookies, dehydrated into a `HydrationBoundary`. A hard load
   paints the sidebar AND list pages with data — zero skeletons, zero client
   API calls on arrival.
3. **`useApi<T>(path)`** (`lib/query.tsx`) — the one client data hook.
   queryKey = the API path string. 30s staleTime, focus refetch, 5-min gc.
   `QueryProvider` mounts at the root layout.
4. **Global invalidation invariant** — `api()` (`lib/client-api.ts`) is
   transport + one rule: any non-GET invalidates EVERY query. Post-write
   reads are always fresh with zero per-callsite bookkeeping. The legacy
   `FOLDERS_CHANGED_EVENT` still exists for emitters outside `api()`;
   Sidebar holds the single listener (→ invalidateQueries).

Optimistic writes patch the cache first (`setQueryData`): prompt delete,
copy-count bump, gallery bookmark flip, sidebar drag-reorder, thread step
drag-reorder. Row hover prefetches route chunk + detail payload.

**Deliberately non-reactive** (edit-safety): the thread draft
(`t/[id]/page.tsx`) and PromptEditor's initial load use one-shot
cache-first reads (`queryClient.fetchQuery`) — a background refetch must
never overwrite typing. Do not migrate these to `useApi`.

Public pages: gallery is a client page whose debounced filter state builds
the cache key (each filter combo cached independently); `/p/[id]` and
`/r/[id]` are pure server components (anonymous view = what the internet
sees), with the small kinetic chrome isolated in `components/ShareChrome.tsx`.

## Auth

Better Auth (`lib/auth.ts`): email+password (autoSignIn) + optional Google
OAuth. Sessions in Postgres, mirrored into a 5-min signed **cookieCache**
(this is what makes per-request `getSession` ~free — keep it). `bearer()`
plugin lets the extension authenticate with a token; Google users' extension
adopts the web cookie session instead (`tryCookieSession`). `trustedOrigins`:
extension-origin allowlist + dev localhost wildcard. When Upstash env vars
exist, Better Auth's brute-force limiter stores counters in Redis
(`secondaryStorage`, `rateLimit.storage: "secondary-storage"`,
`storeSessionInDatabase: true` keeps sessions in Postgres).

`middleware.ts` (edge): `/` → `/dashboard` redirect on cookie presence, and
credentialed CORS for the extension. `isAllowedExtensionOrigin()` FAILS
CLOSED in production when `EXTENSION_IDS` is unset — that env var (the
published extension id, comma-separated for several) is a deploy requirement.

## API surface

`/api/v1/*` route handlers, all through `guard(req)` (`lib/api.ts`): rate
limit (Upstash sliding window when configured, in-memory locally, fail-open)
then session/bearer resolution. Response envelope `{success, data, error}`
(`shared`). Authorization: ownership scoping in every WHERE; team access via
`isTeamMember`/`isTeamOwner`; the single `canAccessPrompt()` for prompt
reads/writes (tested matrix). PATCHes cherry-pick fields — never spread a
request body into a DB write. Threads: `POST /threads` accepts `projectId`
(extension REQUIRES it; a thread belongs in a project).

Billing: Polar. Webhook HMAC (Standard Webhooks) + constant-time compare +
5-minute timestamp tolerance (`lib/billing.ts`). Uploads: signed
direct-to-Cloudinary (`uploads/sign` pins `allowed_formats` to images;
destroy endpoint enforces the `prompt-diary/<userId>/` path prefix).

## Security headers / SEO

`next.config.ts`: nosniff, DENY framing, referrer policy, permissions
policy always; **CSP + HSTS in production only** (dev needs unsafe-eval).
SEO: root metadata (metadataBase from `BETTER_AUTH_URL`, OG/twitter, title
template), `robots.ts` (disallow /dashboard, /api, /login), `sitemap.ts`
(hourly-revalidated, DB-backed: public `/p` and `/r` catalog — the long-tail
surface), per-page metadata on gallery (via passthrough layout — the page is
client) and share pages (content-derived descriptions, canonicals, noindex
on missing).

## Extension

MV3, Vite+CRXJS. `popup/` is a launcher (search-first, arrow nav, Enter
inserts into the active chat's composer via `chrome.scripting`). Local-first
vault in `chrome.storage.local`; `lib/sync.ts` last-write-wins sync on popup
open. `content.ts` injects (closed shadow DOM): selection bubble, composer
save button, dark toast, draggable usage-limit widget — all Ink Glass with
hard solid fallbacks (host pages are uncontrolled; blur ≤16px, small fixed
elements only). Popup sidebar lists threads (click = set recording target)
and projects (click = open dashboard; its `+` starts a thread IN that
project — the only thread-creation path). Overlays are glass sheets
(inset 10px + 100vmax scrim ring); the 3 selects are the owned `GlassSelect`
listbox (no deps).

## Testing & verification

`web/tests/`: permission matrix, select SSR regression, webhook verification
(incl. replay), 33 total via `bun test` (needs the docker db).
`extension/`: 25 tests (parsing/limit logic). No E2E harness; behavioral
verification is done live against the running dev server (geometry probes,
synthetic events) — see the "UI landmines" list in CLAUDE.md for what must
be re-verified when touched.

## Design register (summary — DESIGN.md is authoritative)

Editorial Ink content + Ink Glass overlays + kinetic React Bits accents.
Marketing surfaces (landing, gallery, login, /p, /r) are kinetic (WebGL
strands, sticky-stack, PageVeil); dashboard + extension are calm tools
(150–200ms feedback, press scale 0.97, glass overlays — no scroll
choreography). Fonts: Bricolage Grotesque display (300–500 only) +
Instrument Sans UI + IBM Plex Mono for prompt bodies.
