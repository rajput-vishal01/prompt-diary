# Prompt Diary — agent context

> Read this before changing anything. It encodes decisions and landmines that
> are NOT obvious from the code. Same content lives in AGENTS.md.
> Deep dives: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (data/auth/security),
> [DESIGN.md](DESIGN.md) (visual system — authoritative), [PRODUCT.md](PRODUCT.md).

## What this is

Bun monorepo: `web/` (Next.js 15 App Router — dashboard + `/api/v1` + auth),
`extension/` (Chrome MV3, Vite+CRXJS+React launcher popup + content script),
`shared/` (Zod schemas + types both sides import). One `.env` at the REPO ROOT
feeds everything. Postgres on **port 5433** locally (Docker), Neon in prod.

## Commands

```bash
cd web && bun run dev        # turbopack; DON'T start if the user already runs one
cd web && bunx tsc --noEmit  # typecheck
cd web && bun test           # 33 tests (needs docker db on 5433)
cd web && bun run build      # writes to web/.next-prod — safe WHILE dev runs
cd extension && bun run typecheck && bun test && bun run build
```

`next build` and `next dev` are isolated (`.next-prod` vs `.next`) — if you
ever see phantom `PageNotFoundError`/`routes-manifest` errors, delete both
dirs and rebuild. Deleting a route while dev runs leaves stale types in
`.next/types` → same cure.

## Data layer (web) — the rules

- **`useApi<T>(path)`** (`web/src/lib/query.tsx`) is the ONE data hook.
  TanStack Query; the `/api/v1` path string IS the queryKey. 30s staleTime.
- **Invalidation invariant**: `api()` (`web/src/lib/client-api.ts`)
  auto-invalidates ALL queries after any non-GET. Never add per-callsite
  refetching — it's covered. New mutation = an `api()` call, nothing else.
- **Dashboard layout is a SERVER component** (`dashboard/layout.tsx`):
  getSession + redirect during SSR, then `prefetchApi([5 shared paths])`
  (`lib/server-prefetch.tsx`, self-fetch with forwarded cookies) →
  HydrationBoundary. Hard loads paint with data, zero skeletons, zero client
  API calls. NEVER re-add a client session gate or a `useEffect` fetch —
  that's how "loading loading loading" comes back. New dashboard-wide data →
  add its path to the layout prefetch list.
- **Deliberately NOT reactive** (do not "finish" migrating these): the thread
  draft in `t/[id]/page.tsx` and PromptEditor's load (cache-first one-shot
  `queryClient.fetchQuery`) — background refetches must never clobber
  in-progress edits.
- Hover = intent: rows prefetch the route chunk + detail payload on
  mouseenter (`prefetchPrompt`/`prefetchThread`).

## Domain rules

- **A thread is always born inside a project.** The extension enforces this
  at the type level (`createThread(title, projectId)` — required). The web
  still has two loose paths (projects page "+ New thread" with no chip
  selected; the chain-cluster banner) — user may want those closed too.
- Visibility dials are independent: a prompt can be private/team/public;
  `team` requires `teamId` (enforced in API layer, not DB).
- Every prompt access routes through `canAccessPrompt()`
  (`web/src/lib/permissions.ts`); matrix tested in `web/tests/permissions.test.ts`.
- Facets/tags in the sidebar are COMPUTED from prompt text (`promptFacets`),
  never stored. No enums for facets (settled decision).
- Soft deletes with Undo toast; restore endpoint exists.

## UI landmines (each cost a debugging round)

- **Sticky-stack (landing)**: cards are direct siblings with `sticky top-0` +
  empty dwell SPACERS after each. Never wrap a card in a taller div (sticky
  cages → pile-up dies) and never animate a card's own opacity (translucent
  card → the pile bleeds through). `.stack-shade` overlay does the dimming.
- **Radix poppers + hover-gated trays**: any tray that `display:none`s on
  hover-out while its portaled menu is open collapses the anchor to 0×0 →
  menu teleports to the viewport corner. Cure: `has-[[data-state=open]]:flex`
  on the tray. All Menu/Select/Tooltip content MUST stay portaled.
- **No inline `transform` left on ancestors** of fixed-position UI — GSAP
  tweens on layout wrappers need `clearProps`.
- **Radix Select SSRs a blank trigger** unless the label is derived from the
  options list (see `ui/Select.tsx` + `tests/select.test.tsx`).
- Register rule: marketing surfaces (landing, gallery, login, /p, /r) are
  kinetic; dashboard + extension are CALM tools — glass overlays and press
  feedback yes; scroll choreography / WebGL / veils no.
- Drag language is unified: grip handle (`GripVertical`, hover-reveal) +
  brass before/after indicator line — used by the sidebar tree AND thread
  step reordering (`t/[id]`). Reuse it for any new reordering.

## Security posture (audited 2026-07-17, fixes shipped)

- IDOR/SQLi/XSS/mass-assignment/secrets: audited clean. Keep it that way:
  every route scopes by userId/ownership, PATCHes cherry-pick fields (never
  spread request bodies into DB writes), Drizzle parameterized only.
- **`EXTENSION_IDS` env is REQUIRED in production** — extension CORS fails
  closed without it (any Chrome extension could otherwise ride the session).
- Polar webhooks reject >5min-old timestamps; Cloudinary uploads pin
  `allowed_formats`; prod gets CSP + HSTS (`next.config.ts`, prod-gated
  because dev needs unsafe-eval); Better Auth rate limiter uses Upstash as
  secondaryStorage when configured (sessions stay in Postgres).

## Operational gotchas

- Vercel Root Directory MUST be `web`. Migrations run in the build command.
- Extension store build: `VITE_API_URL=<prod-url> bun run package:extension`.
- Test account (local db): `design-check@test.local` / `password12345`.
- Commit style: lowercase `feat:`/`fix:` with a dense narrative body.
- Tailwind config changes need dev restart + `.next` wipe to take effect.
- A code knowledge graph lives in `graphify-out/` (gitignored) — query with
  `"C:/Users/Vishal/AppData/Local/Python/bin/python.exe" -m graphify explain "X"`.
- Never restart the user's dev server on :3000 without asking; production
  builds are safe to run alongside it.
