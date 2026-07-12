# Design System — "Ledger"

Light, archival, precise. A banker's ledger for prompts.

## Color (OKLCH-derived, committed green ink on paper-neutral)

| Token | Value | Use |
|---|---|---|
| `bg` | `#f4f6f4` | page background (true neutral, whisper of green) |
| `raised` | `#ffffff` | cards, panels, popup surface |
| `hover` | `#ecf1ed` | row/button hover |
| `line` | `#dde4de` | hairline rules, borders |
| `ink` | `#13271e` | primary text (green-black) |
| `dim` | `#5f6f65` | secondary text (≥4.5:1 on bg) |
| `accent` | `#1c6b4a` | bottle green: primary actions, selection, links, brand |
| `accent-deep` | `#14523a` | primary hover |
| `tint` | `#e7f0ea` | selected/active background |
| `amber` | `#8a5a06` | team visibility |
| `danger` | `#9f2d20` | destructive (oxblood) |

Dark mode: not shipped; single committed light theme is the identity.

## Typography

- **UI sans**: IBM Plex Sans (dashboard, via next/font) / system-ui (extension popup).
- **Prompt bodies**: IBM Plex Mono (dashboard) / ui-monospace (extension). Always. Prompts are artifacts.
- **Display**: Newsreader (serif) — wordmark and landing headline ONLY. Never in UI labels/buttons.
- Fixed rem scale, ratio ~1.2: 12 / 13 / 14 / 16 / 20 / 24 / 34.
- Tabular numerals for counts.

## Shape & Depth

- Radius: 6px controls, 10px panels. No pills except badges.
- Borders over shadows. One shadow tier for overlays only.
- Ledger rows: hairline `divide-y`, generous horizontal padding, hover = `hover` bg.

## Components

- **Primary button**: accent bg, white text, radius 6.
- **Secondary**: white bg, `line` border, ink text.
- **Visibility badge**: dot + lowercase label. private = dim, team = amber, public = accent.
- **Focus**: 2px accent ring, offset 2px, everywhere.
- **Empty states**: teach the flow ("highlight text → right-click → save").

## Motion

150–200ms, ease-out. State feedback only (hover, press scale 0.98, copy confirmation). No page-load choreography. `prefers-reduced-motion`: transitions off.
