# Design System — "Editorial Ink"

Quietly editorial, like a print magazine that happens to be a tool. Off-white
canvas, warm near-black ink, pastel atmosphere. Based on the ElevenLabs
design analysis spec (v-alpha) — no saturated CTA color, no dark dev-tools
canvas; the ink pill IS the action color.

## Color

| Token | Value | Use |
|---|---|---|
| `bg` | `#f5f5f5` | canvas — off-white page floor |
| `raised` | `#ffffff` | cards, panels, popup surface |
| `hover` | `#efedec` | row/button hover |
| `line` | `#e7e5e4` | default 1px hairline |
| `line-strong` | `#d6d3d1` | input/outline-pill borders |
| `ink` | `#0c0a09` | display + primary text |
| `body` | `#4e4e4e` | running text (landing prose) |
| `dim` | `#57534e` | secondary text (≥4.5:1 on bg) |
| `accent` | `#292524` | ink primary: CTA pills, selection. Used scarcely |
| `accent-deep` | `#0c0a09` | press state |
| `tint` | `#f0efed` | surface-strong: selected bg, badges, chips |
| `amber` | `#8a5a06` | team visibility (semantic) |
| `danger` | `#dc2626` | destructive |
| `success` | `#16a34a` | confirmation |
| `orb-mint/peach/lavender/sky/rose` | pastels | atmospheric gradient orbs — landing decoration ONLY |

Rules: no saturated brand action color — the near-black pill is the only CTA.
Orb pastels never appear as button fills, text colors, or component
backgrounds. Dark mode: not shipped.

## Typography

- **Display**: Bricolage Grotesque **300–500** — landing headlines, wordmark,
  section heads. An editorial grotesque with real character; light for
  elegance, medium (500) only for the hero. Negative tracking (-0.01em to
  -0.03em by size). **Never 600+ display copy.**
- **UI sans**: Instrument Sans 400/500/600 (via next/font) / system-ui
  (extension popup). Deliberately not Inter — the ubiquitous default reads as
  template. Body carries +0.011em letter-spacing — the editorial dialect.
- **Prompt bodies**: IBM Plex Mono (dashboard) / ui-monospace (extension).
  Always. Prompts are artifacts.
- **Instrument density kept**: 13px UI type, 32px control height (`h-8`),
  11px metadata/badges, heading tracking -0.015em. The app reads as a tool.
- Tabular numerals for counts. `kbd` chips for every shortcut shown in UI.

## Shape & Depth

- **Pills for every CTA and badge** (`rounded-full`). Inputs 8px, panels
  12px, cards 16px, orb cards 24px.
- Elevation = hairline + one soft shadow tier (`shadow-soft`,
  `0 4px 16px rgba(0,0,0,0.04)`). Atmospheric depth comes from gradient orbs
  on the landing page, never from stacked shadows.
- Ledger rows stay: hairline `divide-y`, generous horizontal padding,
  hover = `hover` bg.

## Components

- **Primary button** (`.btn-primary`): ink pill — `accent` bg, white text,
  15px/500 on marketing, 13px/500 in-app.
- **Secondary** (`.btn`): transparent pill, 1px `line-strong` border, ink text.
- **Chip / badge** (`.chip`): `tint` pill, 11px ink text.
- **Visibility badge**: dot + lowercase label. private = dim, team = amber,
  public = ink.
- **Input**: white bg, `line-strong` border, 8px radius; focus = ink border.
- **Focus**: 2px ink outline, offset 2px, everywhere.
- **Empty states**: teach the flow ("highlight text → right-click → save").

## Overlay material — "Ink Glass"

A second material language for things that FLOAT above the content: nav
chrome, menus, dropdowns, command palette, dialogs, tooltips, popovers,
toasts. Never on the page canvas, cards, ledger rows, buttons, or inputs —
glass on content is the dated-glassmorphism failure mode.

- **`glass`** (light, default): warm-white translucency
  `linear-gradient(160deg, rgba(255,255,255,.78), rgba(255,255,255,.58))`
  + `backdrop-filter: blur(20px) saturate(160%)`, hairline border
  (`line-strong` @ 55%), specular top edge
  (`inset 0 1px 0 rgba(255,255,255,.65)`), one quiet warm shadow. Text on it:
  `ink`/`dim` only.
- **`glass-ink`** (dark): reserved for surfaces that are already the app's
  dark voice (toast, landing menu overlay). `rgba(12,10,9,.86)` + blur 16.
- **Fallbacks are part of the material**: no `backdrop-filter` support →
  solid; `prefers-reduced-transparency` → solid; `prefers-contrast: more` →
  solid + strong border. All three ship with the class, in globals.css.
- **Motion**: overlays *materialize* — scale .96→1 + blur resolve + fade,
  150–200ms `--ease-out-quart`; exits faster than entrances; menus/popovers
  scale from their trigger side, modals stay center-origin; keyboard-invoked
  surfaces (⌘K) get ≤100ms or nothing. Reduced motion → crossfade only.

## Landing (brand register)

64px nav (wordmark left, outline + ink pills right) · centered hero with
display serif over drifting pastel orbs (`.orb` + `.orb-drift`, 18–22s
ease-in-out, reduced-motion kills them) · the interactive diary specimen as
product imagery · hairline-ruled editorial story rows · CTA band · quiet
footer. 96px-ish section rhythm, content caps ~1152px.

## Motion

Dashboard: 150–200ms ease-out state feedback only (hover, press scale 0.97,
copy confirmation) — no page-load choreography. Landing: one orchestrated
GSAP entrance (hero copy → specimen rows) + orb drift. `prefers-reduced-motion`:
everything off.
