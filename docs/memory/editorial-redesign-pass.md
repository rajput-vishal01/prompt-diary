# Memory: Editorial redesign pass — teams, profile, usage, palette/dialog/toast, motion

**Shipped:** 2026-07-16, commits 1044622 (teams), f6b5be9 (profile), 06beb9c (usage),
b702450 (palette/dialog/toast), ef640b4 (motion). All are restyles of separate files —
zero API changes except teams GET gaining `memberCount` (a count subquery).

**The shared vocabulary** (Editorial Ink, per DESIGN.md): display-serif Newsreader-300
headings (never bold), caption-uppercase section labels
(`text-xs font-semibold uppercase tracking-[0.08em] text-dim`), 64px two-line ledger
rows with #fafafa hover, 2px inset ink selection bars, pill buttons, hover-reveal
actions, inline confirms instead of modals. Brass #8B6F3E is reserved for exactly two
things app-wide: the active-row indicator and team role tags.

**Teams (1044622).** Card grid → 64px ledger rows (avatar circle, name, "N members",
brass RoleTag, →). Invites are a tint banner strip, not a card. Detail view keeps the
two-column structure: SHARED PROMPTS as manuscript rows with hover-reveal copy,
MEMBERS as 64px rows with hover-reveal remove/leave + inline confirm (no dialog),
TOKEN SPEND as a quiet stat block with a display-serif headline total.

**Profile (f6b5be9).** One column. Identity block: avatar with hover "Change" overlay,
borderless display-serif headline name input (blur-save, like the thread title), email
with verified/unverified badge. A reusable `Section` component (hairline top border +
caption label) was the point — account deletion and the Plan section later landed as
sections additively with no restyle.

**Usage (06beb9c).** Display heading + display-serif headline stat, caption axis
labels, the legend became chips, quiet empty state, and the "estimated from message
length (characters ÷ 4) — not billing data" honesty footnote.

**Palette / Dialog / Toast (b702450).** CommandPalette got the extension popup's
launcher language: 44px input, persistent ↑↓ ↵ kbd hint, 2px inset ink selection bar
(`shadow-[inset_2px_0_0_#0c0a09]` on #fafafa), source-dot chips on prompt items, and
Projects/Usage actions. Dialog titles went display-serif light. Toast is the app's one
dark surface: an ink pill with a green ✓ / red ✕ and a kbd-badge-styled action button.
Leftover green-tinted shadows rgba(19,39,30) were swapped to ink rgba(12,10,9).

**Motion (ef640b4).** State-conveying only, 150–200ms ease-out: `.anim-overlay`
(pd-fade 150ms) + `.anim-card` (pd-pop: 98% scale + 4px rise, 180ms) on Dialog and
CommandPalette, `.anim-toast` slide-up. Page fade-rise already existed via GSAP in
`dashboard/template.tsx` (template, not layout — remounts per navigation). Everything
dies under the global prefers-reduced-motion rule. List stagger was deliberately
skipped: filter-driven remounts would replay it on every keystroke.
