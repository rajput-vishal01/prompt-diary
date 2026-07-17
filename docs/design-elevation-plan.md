# Design Elevation — v2 plan (direction confirmed on the landing page)

**Status:** the design direction is locked as of the landing revamp
(`bffeb71`): Editorial Ink content + Ink Glass overlays + the kinetic React
Bits layer, with Bricolage Grotesque / Instrument Sans as the app-wide
voice. DESIGN.md's "Kinetic layer" section is the authority. This plan
sequences carrying that direction through the REST of the application.
Each chunk is one implementation session, reviewable on its own.

**Register rule that governs everything below:** marketing surfaces
(landing, gallery, login, share pages) are kinetic; the dashboard and
extension are calm tools — glass overlays and spring feedback yes, scroll
choreography / WebGL / veils no.

---

## Already shipped (foundation)

- Fonts app-wide: Bricolage Grotesque (display 300–500) + Instrument Sans.
- Ink Glass material (`.glass`, `.glass-ink`) with all three fallbacks.
- Vendored kit under `components/bits/`: GlassSurface, SpecularButton,
  Strands, GradualBlur, LogoLoop (+ loosely-typed barrel).
- `PageVeil` on landing, gallery, login, /p, /r.
- The landing itself: glass nav, menu droplet morph, split hero with
  floating product glass, feature stage, spring-pop capability previews,
  dwell sticky-stack, SVG-fitted footer wordmark.

## Chunk 1 — Select primitive; kill all 9 native `<select>`s
- `ui/Select.tsx` on Radix Select, skinned as Ink Glass: glass panel,
  origin-aware materialize (160ms in / 120ms out, scale .96 + blur resolve),
  check on selected, kbd navigation.
- Replace: dashboard visibility filter, web PromptEditor folder/visibility/
  team, thread page project/visibility. (Extension's 3 selects are chunk 6.)
- Review gate: the visibility filter opens as glass and is keyboard-clean at
  375px; zero native dropdown chrome anywhere on the web app.

## Chunk 2 — Re-materialize the overlay family (web app)
- DropdownMenu primitive (Radix) → dashboard row ⋯ menu, TreeSection node
  menu, projects-page menu. Origin-anchored materialize + real exits.
- Dialog → glass + center-origin materialize; CommandPalette → **GlassSurface**
  panel (the palette is the app's showpiece overlay), entrance ≤100ms
  (keyboard rule); Toast → `glass-ink` with interruptible same-path
  enter/exit; mobile sidebar drawer gets a glass scrim + eased slide.
- Review gate: every floating surface shares the material family; nothing
  unmount-snaps; ⌘K feels instant.

## Chunk 3 — Tooltip primitive; retire native `title=`
- Radix Tooltip as a glass chip: 300ms first-open delay, instant for
  neighbors, 125ms motion, never steals focus.
- Sweep icon-only controls (row actions, thread steps, copy buttons,
  sidebar). Redundant prose titles just drop.
- Review gate: hover a row's action cluster — instant neighbor tooltips, no
  browser-native tooltips left.

## Chunk 4 — Gallery: hierarchy + kinetic polish
- Filter row restructured into distinct genera: content-type segmented tabs
  (Prompts/Recipes) · sort segmented control · Bookmarked state-toggle
  (brass glyph when on) · facet chips as a separate hairline-ruled group.
  Same fix for the projects-page chip row (selector vs "looping" toggle).
- Kinetic register (gallery is public/marketing): card hover springs
  (framer-motion, scale 1.02 + shadow-soft), staggered card entrance on
  first load, facet-filter crossfade.
- Add `gallery/loading.tsx` + `gallery/error.tsx` (in-shell, StatusScreen
  compact) — errors must not blow away the sidebar.
- Review gate: the filter row reads as tabs / sort / toggle / tags at a
  glance; kill-the-server test shows the in-shell error boundary.

## Chunk 5 — Auth + share pages join the direction
- Login: the form becomes a glass card over the auth glow; SpecularButton
  submit; entrance materialize.
- /p and /r share pages: display-type pass for Bricolage metrics, a quiet
  Strands ribbon band behind the header (they're the product's public face),
  SpecularButton on the "Start your diary" footer CTA.
- Review gate: a logged-out visitor's whole journey (share page → gallery →
  login) speaks one language.

## Chunk 6 — Dashboard calm pass
- Typography audit for the new faces: Bricolage display sizes/tracking on
  page headings and stat numerals (metrics differ from Newsreader), Instrument
  Sans rhythm in rows and forms.
- Feedback audit: every pressable has press-scale; hover states per DESIGN.md;
  empty states reviewed under the new type.
- Explicitly NOT: veil, stack, WebGL, entrance choreography. The dashboard
  stays a tool.
- Review gate: side-by-side dashboard screens read as the same brand as the
  landing, without any of its motion.

## Chunk 7 — Extension popup
- `.editor` overlays (PromptEditor, AccountView, ask/confirm, thread picker):
  opaque page-swaps → glass sheets over a scrim-dimmed list, materialize in /
  fast out (values mirrored from globals, no shared file across bundles).
- The popup's 3 native selects → a small owned glass listbox (no new deps).
- Tour card + handoff banner → glass.
- Review gate: load unpacked; every overlay reads as a layer above the list;
  bundle delta noted.

## Chunk 8 — Content-script chrome (last, most external variables)
- Selection bubble, composer pill, per-message save button, limit widget,
  page toast → glass pills with hard solid fallbacks (blur ≤16px, warm tint),
  over arbitrary third-party sites, drag/position logic untouched.
- Perf guard: backdrop-filter only on small fixed elements; verify no jank on
  a long ChatGPT thread.

## Sequencing
1 → 2 → 3 are the primitive chain (each builds on the last's patterns).
4 and 5 are independent after 1. 6 after 2+3 (it consumes the primitives).
7 → 8 close out the extension. One commit-and-push per chunk, tests green,
review gate checked before the next chunk starts.

## Out of scope, permanently (unless re-decided)
- Glass on content surfaces (cards, rows, buttons, inputs, page canvas).
- Scroll choreography, veils, or WebGL inside the dashboard or popup list.
- Dark mode (not shipped product-wide).
- FluidGlass / ShapeBlur / SoftAurora (rejected: model assets, three.js
  weight, and overlap with Strands respectively).
