# Design Language Elevation — Diagnosis & Execution Plan

**Status:** approved direction, not yet implemented. Each chunk below is one
implementation session, reviewable on its own before the next starts.
**Scope guard:** Editorial Ink (DESIGN.md) stays exactly as-is for the content
layer — page canvas, typography, cards, buttons, ledger rows. This pass adds a
SECOND material language for the floating layer only.

---

## Part 1 — Diagnosis: why the app reads competent, not premium

### 1. The overlay layer has no material identity
Everything that floats is drawn in the *content* layer's material — flat white
`bg-raised` + hairline + `shadow-soft` — or worse:

- [Dialog.tsx](../web/src/components/Dialog.tsx), [CommandPalette.tsx](../web/src/components/CommandPalette.tsx): flat white cards, indistinguishable in material from a prompt card sitting in the page.
- Row menus (dashboard `RowActions` ⋯ menu, [TreeSection](../web/src/components/TreeSection.tsx) node menu, projects-page header menu): plain white `absolute` spans. **Zero enter/exit animation, no transform-origin** — they snap into existence.
- Extension popup overlays (`.editor` in [styles.css](../extension/src/popup/styles.css) — PromptEditor, AccountView, ask/confirm, thread picker): **fully opaque `background: var(--bg)`** — a page-swap pretending to be an overlay. No scrim, no layering, no depth at all.
- Toast is the one intentional dark surface (correct per chronicle) but it's opaque and has no exit animation (unmount snap).

Editorial Ink's depth grammar has exactly one tier (hairline + `shadow-soft`,
deliberately quiet). That's right for the page — but it means the system has
no way to say "this floats above the page." That's the taste ceiling.

### 2. Native browser chrome breaks the register at the moment of interaction
- **9 native `<select>` elements** in 5 files: dashboard visibility filter ([page.tsx:386](../web/src/app/dashboard/page.tsx)), web PromptEditor folder/visibility/team, thread page project/visibility ([t/[id]](../web/src/app/dashboard/t/[id]/page.tsx)), extension PromptEditor folder/visibility/team. The open dropdown is OS chrome — the exact moment a user interacts, the design language vanishes (user's screenshot confirms).
- **Native `title=` tooltips everywhere** (9 on the dashboard page alone, every icon button, every kbd hint) — slow, unstyled, browser-owned.

### 3. Motion gaps (per emil-design-eng framework)
- Menus/popovers: no animation at all; when added, must be origin-aware (scale from trigger), never center.
- Nothing in the app has an **exit** animation — every overlay unmount snaps.
- CommandPalette animates a **keyboard-initiated** action (⌘K, 180ms pop) — per the frequency rule this should be near-instant.
- Existing good bones: `.btn`/`.btn-primary` press `scale(0.97)` ✓, 150–200ms ease-out vocabulary ✓, reduced-motion global kill ✓. The dialect is right; it just doesn't cover the overlay layer.

### 4. Control-taxonomy flattening
- **Gallery filter row (worst):** content-type switch (Prompts/Recipes), bookmark toggle, and computed facet filters are all identical pills in one row; the sort control floats elsewhere. Three different kinds of control, one undifferentiated visual class.
- **Projects page (mild, same disease):** project-selector chips and the "looping" *filter* toggle share one pill row.
- Dashboard toolbar is acceptable (search / select / segmented view are already distinct genera) — fixing the select is enough there.

### 5. Route-segment special files
Root (`error`, `global-error`, `not-found`, `loading`) and dashboard
(`error`, `loading`) are deliberately designed via `StatusScreen`/`BrandLoading` ✓.
**Gallery has neither `loading.tsx` nor `error.tsx`** — a throw in the gallery
blows past the shell to the full-screen root boundary; `/p/[id]`, `/r/[id]`,
`login`, `privacy` acceptably inherit root fallbacks.

### 6. Content-script chrome (extension on AI sites)
Selection bubble, composer pill, per-message save button, limit widget, page
toast: solid white pills. Functional, but they're the brand's most visible
ambassador (rendered on top of ChatGPT/Claude) and read as generic browser-
extension furniture.

### A tension the direction must resolve
PRODUCT.md's anti-references explicitly reject "2025 dark + indigo +
glassmorphism," and impeccable bans "glassmorphism as default." Both are
compatible with this brief **only if** glass is (a) scoped to transient
floating surfaces, (b) warm/paper-tinted in the Editorial Ink palette — never
blue-white or dark-neon, (c) built on standard control semantics (principle 5:
no invented controls). Glass on cards/pages/buttons remains banned.

---

## Part 2 — Design direction: the "Ink Glass" material

The overlay dialect of Editorial Ink. Grounded in apple-design (materials &
depth), emil-design-eng (motion), design-taste-frontend Appendix C (honest web
approximation — this is web glassmorphism done in our palette, not official
Apple Liquid Glass).

### Material recipe (two variants only)

**`glass` (light — dropdowns, menus, palette, dialogs, tooltips, popovers):**
- Fill: warm-white translucency, gradient-weighted toward the top:
  `linear-gradient(160deg, rgba(255,255,255,.78), rgba(255,255,255,.58))`
  over `backdrop-filter: blur(20px) saturate(160%)`. Warm, never blue.
- Specular top edge: `inset 0 1px 0 rgba(255,255,255,.65)` — light catching
  the material.
- Border: `1px solid rgba(214,211,209,.55)` (line-strong at ~55%).
- Depth from the material itself: the blur/saturation contrast does the
  separation; shadow stays quiet and warm —
  `0 12px 40px rgba(12,10,9,.10)` (bigger surfaces = slightly deeper, per
  Apple "bigger reads thicker": dialog may go blur 24 / shadow .14).
- Radius follows the existing scale: menus/popovers 12px, dialogs 16px,
  tooltips 8px.

**`glass-ink` (dark — Toast only, preserving "the app's one dark surface"):**
- `rgba(12,10,9,.84)` + `backdrop-filter: blur(16px) saturate(140%)`,
  specular edge `inset 0 1px 0 rgba(255,255,255,.14)`.

**Non-negotiable fallbacks (all three, from day one):**
- `@supports not (backdrop-filter: blur(1px))` → solid `raised` + `line` border.
- `@media (prefers-reduced-transparency: reduce)` → solid fill, no blur.
- `@media (prefers-contrast: more)` → solid fill + `line-strong` border.
- Text on glass: `ink`/`dim` only (both already ≥4.5:1 on white; the ≥.58
  white floor keeps AA true over any page content). Never `text-dim/NN`.

**Where glass is banned:** page canvas, cards, ledger rows, buttons, inputs,
sidebar (desktop), landing page. The mobile sidebar *drawer* keeps its solid
panel (it IS the sidebar) — only its scrim/motion improve.

### Motion spec (authority: emil-design-eng; springs per apple-design)

Tokens: `--ease-out-quart: cubic-bezier(0.23, 1, 0.32, 1)` (entrances),
`--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1)` (on-screen morphs).

| Surface | Enter | Exit | Origin |
|---|---|---|---|
| Menu / dropdown / select popup | 160ms, scale .96→1 + blur 4→0 + fade | 120ms fade+scale .98 | **trigger-anchored** (`transform-origin` from side) |
| Tooltip | 125ms fade+scale .97; 300ms first-hover delay, **instant for neighbors** | 100ms fade | trigger-anchored |
| Dialog | 200ms scale .96 + blur 4→0 ("materialize, not fade") | 150ms | **center** (modals are exempt from origin rule) |
| Command palette (⌘K) | ≤100ms fade or none — keyboard-initiated, high-frequency | none | — |
| Toast | 250ms translateY+fade (transitions, not keyframes — interruptible) | 180ms same path (spatial consistency) | — |
| Scrims | 150ms fade | 120ms | — |

- Everything transform/opacity/filter only; blur ≤20px (Safari cost).
- `prefers-reduced-motion`: crossfade ≤120ms, zero translate/scale (the
  existing global kill remains the floor).
- "Morphs fluidly out of the trigger" = origin-aware scale + blur
  materialization. Full trigger-rect morphing (FLIP) is a later delight, not
  chunk-1 scope — origin-aware scale delivers 90% of the read.

### Component strategy
- **Web:** Radix primitives (`@radix-ui/react-select`, `dropdown-menu`,
  `tooltip`, `dialog`, `popover`) as the headless semantic layer — standard
  affordances done precisely (keyboard, ARIA, focus, collision-aware
  positioning, `--radix-*-transform-origin` for origin-aware motion) — skinned
  exclusively as Ink Glass. One primitive each, defined once in
  `web/src/components/ui/`. No second styling of the same primitive anywhere.
- **Extension popup:** no new deps. Glass via popup CSS; selects replaced by a
  small owned listbox styled as glass (popup has 3 selects, one surface).
- **Content script:** zero-dependency CSS in the shadow root; conservative
  blur (≤16px) + solid fallback, since it renders over arbitrary sites.

---

## Part 3 — Execution plan (chunks = one session each, in order)

### Chunk 1 — Foundation: Ink Glass material + motion tokens + reference surface
- `globals.css`: `.glass`, `.glass-ink`, scrim class, all three fallback
  blocks, ease/duration tokens, semantic z-index scale
  (dropdown < sticky < scrim < modal < toast < tooltip — replaces today's
  ad-hoc z-40/50/90/95/100).
- Popup `styles.css`: mirrored `--glass-*` custom properties (values copied,
  no shared file — different bundles).
- **Reference implementation:** dashboard `RowActions` ⋯ menu rebuilt on the
  DropdownMenu primitive with full enter/exit/origin motion — the one surface
  to review the material on.
- DESIGN.md: new "Overlay material — Ink Glass" + motion-table sections
  (the system document is the deliverable as much as the CSS).
- Gotcha: tailwind config changes need dev-server restart + `.next` wipe.
- **Review gate:** open any prompt row's ⋯ menu; judge material, motion,
  fallbacks (DevTools: emulate reduced-transparency/motion, disable
  backdrop-filter).

### Chunk 2 — Select/Combobox primitive; kill every native `<select>`
- `ui/Select.tsx` (Radix Select, glass panel, kbd-friendly, check-mark on
  selected, chevron affordance).
- Replace all 6 web instances: dashboard visibility filter, PromptEditor
  folder/visibility/team, thread page project/visibility. Delete `select`
  styling from `.input` usage.
- **Review gate:** the user's screenshot scenario — visibility filter opens as
  glass, keyboard navigable, correct on 375px.

### Chunk 3 — Re-materialize the existing overlay family (web)
- TreeSection node menu + projects-page menu → DropdownMenu primitive (kills
  the last hand-rolled menus).
- Dialog → glass + materialize motion + exit animation.
- CommandPalette → glass panel; entrance trimmed to ≤100ms (keyboard rule);
  list styling untouched.
- Toaster → `glass-ink` + enter/exit transitions (same-path, interruptible).
- Sidebar mobile drawer: glass scrim + eased slide (panel stays solid).
- **Review gate:** every floating surface in the dashboard shares one material
  family; nothing unmount-snaps.

### Chunk 4 — Tooltip primitive; retire native `title=`
- `ui/Tooltip.tsx` (glass chip, 300ms first-open delay, instant + no-anim for
  adjacent tooltips via provider, 125ms motion, never focus-stealing).
- Replace `title=` on icon-only/high-traffic controls (row actions, thread
  step actions, copy buttons, sidebar controls). Prose-bearing titles (row
  "Open" hints) simply drop — the affordance is already clear.
- **Review gate:** hover a row's action cluster — tooltips feel instant after
  the first; none of the old browser tooltips appear anywhere.

### Chunk 5 — Filter-row hierarchy: Gallery (and projects), + gallery special files
- Gallery: three visually distinct genera —
  1. **Content-type tabs** (Prompts / Recipes): segmented control, ink
     selection, the primary switch;
  2. **Sort** (Most copied / Newest) stays a segmented control, adjacent to search;
  3. **Bookmarked**: a toggle with the bookmark glyph, visually a state-pill
     (pressed = tint + brass glyph), separated from tabs;
  4. **Facet chips** stay quiet tint chips, hairline-separated group with a
     "style" caption label.
- Projects page: same treatment — project chips (selector) vs "looping"
  (filter toggle) get distinct genera.
- Add `gallery/loading.tsx` (in-shell skeleton) + `gallery/error.tsx`
  (compact StatusScreen) so gallery failures keep the shell.
- **Review gate:** the screenshot row reads as tabs / sort / toggle / tags at
  a glance; kill-the-dev-server error test shows the in-shell boundary.

### Chunk 6 — Extension popup overlay chrome
- `.editor` overlays (PromptEditor, AccountView, ask/confirm, thread picker):
  opaque page-swap → glass sheet over a scrim-dimmed list (popup finally has
  depth); materialize enter, fast exit, reduced-motion/transparency
  fallbacks mirrored from chunk 1 values.
- Popup's 3 native selects → owned glass listbox (small, no deps).
- Tour card + handoff banner → glass; tour ring/arrow unchanged.
- **Review gate:** load unpacked, open editor/account/tour over the list —
  popup reads as layered surfaces, not page swaps; bundle size delta noted.

### Chunk 7 — Content-script chrome on AI sites
- Selection bubble, composer pill, per-message save button, limit widget,
  page toast → glass pills (blur ≤16px, strong solid fallback, warm tint) so
  the brand's most public surface matches the system; drag/position logic
  untouched.
- Perf guard: backdrop-filter only on these small fixed elements, never on
  scroll containers; verify no jank on a long ChatGPT thread.
- **Review gate:** on chatgpt.com + claude.ai (light and dark site themes),
  widgets read premium and legible; limit widget still drags at 60fps.

### Dependencies & sequencing
1 → everything. 2/3/4 in any order after 1 (3 touches files 2 also touches —
run 2 before 3 to avoid churn in PromptEditor). 5 independent after 1.
6 → after 1 (copies values). 7 last (lowest risk tolerance, most external
variables). Every chunk ships its own commit(s), tests green, and a
before/after check on the review gate before the next chunk starts.

### Out of scope (explicitly)
- No glass on content surfaces, landing page, or buttons.
- No FLIP/shared-element trigger morphing in v1 (noted as a later delight).
- No dark mode (still not shipped product-wide).
- No changes to Editorial Ink tokens, typography, or page layouts beyond the
  surfaces named above.
