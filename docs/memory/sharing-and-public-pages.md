# Memory: Thread visibility + public share pages

**Shipped:** 2026-07-16, commit 208bcf9 (chunk 4). Schema and API landed before the
gallery redesign so the gallery was built once against final shapes.

**Data layer.**

- Migration 0010 adds `threads.visibility` (reuses the existing `visibilityEnum`,
  default `private`; threads only use private|public — no team tier for recipes).
- `ThreadSchema`/`ThreadUpdateSchema` in shared gained `visibility`
  (`z.enum(["private","public"]).catch("private")`).
- `canReadThread(userId, thread)` in `web/src/lib/permissions.ts` — deliberately pure
  and synchronous (owner or public), unlike the async team-aware `canAccessPrompt`.
- `loadThreadForViewer(id, userId)` in `web/src/lib/threads.ts` — the one loader both
  the API route and the public page share. It lives in lib, NOT in route.ts, because
  Next.js route files may only export HTTP handlers. Returns null for
  missing-or-unreadable (private reads as 404, never 403 — no existence leak).

**Per-step redaction — the security detail.** A public recipe may chain private
prompts. `loadThreadForViewer` checks every step's prompt through `canAccessPrompt`
for the viewer: readable steps return in full with `redacted: false`; private steps
return `{prompt: {id, title, tags: []}, redacted: true}` — title-only, body never
serialized. Tested in web/tests/threads.test.ts including a
`JSON.stringify(step)` does-not-contain-secret assertion.

**API.** `GET /api/v1/threads/[id]` became anonymous-tolerant (getUser + rateLimit
instead of guard, mirroring the prompts/[id] pattern). PATCH gained `visibility` with
the same `needsVerification()` gate as prompts: flipping to public requires a
verified email.

**Public pages** (server components, outside /dashboard so middleware ignores them):

- `/p/[id]` — public prompt manuscript: byline, tags, mono body on #fafafa, optional
  before/after panes, CopyButton, "Start your diary" CTA footer.
- `/r/[id]` — public recipe: numbered steps (private steps show a lock chip +
  "private step"), final-output surface, copy-whole-recipe over non-redacted steps.
- Both always render the ANONYMOUS view — what the owner sees at the share URL is
  exactly what the internet sees. `CopyButton` (`web/src/components/CopyButton.tsx`)
  exists because server components can't own copy state.

**Affordances.** Thread page: visibility select (patches then reloads, because
publishing can 403 on unverified email and the select must snap back) + Share button
when public. PromptEditor: Share link chip when visibility is public.
