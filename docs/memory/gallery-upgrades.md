# Memory: Gallery — API upgrades + editorial redesign

**Shipped:** 2026-07-16, commits abf8f67 (chunk 5, API) and 127f516 (chunk 6, UI).

## API layer (abf8f67)

- Migration 0011: `gallery_bookmarks` table `(userId, promptId, createdAt,
  PK(userId, promptId))` — a bookmark is a reading list entry, NOT a copy ("add to my
  diary" clones; a bookmark just remembers).
- `/api/v1/gallery/bookmarks`: GET (my promptIds, newest first), POST {promptId}
  (idempotent via onConflictDoNothing; 404s non-public prompts), DELETE ?promptId=.
- Gallery GET params: `sort=copied|new` (copied = useCount desc, the old default),
  `bookmarked=1` (signed-out returns empty, not an error), `type=threads` (public
  recipes: title, authorName, stepCount subquery, finalOutput sliced to 280 chars).
  Facet filtering stays client-side — facets are computed heuristics
  (`promptFacets()`), never stored, so the server can't filter on them cheaply.
- Signed-in responses stamp each prompt with a `bookmarked` boolean so cards render
  the filled state without a second request.
- `GET /api/v1/prompts/[id]` gained `authorName` (additive join) so the gallery
  detail page gets a byline in one request.

## UI (127f516)

`/gallery` rebuilt in the editorial language: display-serif masthead, sticky 44px
search with a Most copied / Newest segmented toggle, one chip row
(Prompts / Recipes / ★ Bookmarked / divider / facet chips). Prompt cards are
manuscript cards — mono excerpt on #fafafa, facet + tag chips, byline, hover-reveal
Copy / Bookmark (brass fill when bookmarked) / +Add actions, optimistic bookmark
toggle with rollback on failure. Recipes render as two-line ledger rows (title,
N-steps chip, byline, mono final-output excerpt) linking to the public /r/[id] page.

`/gallery/[id]` is now a real route replacing the old fixed-overlay detail: ghost
back button, before/after proof panes, THE PROMPT manuscript surface, Copy /
Bookmark / Share (copies the /p/[id] link) / + Add to my diary.

**Known limitation, deliberate:** gallery copies don't increment useCount (PATCH is
owner-only), so "most copied" reflects the owner's own use counts.
