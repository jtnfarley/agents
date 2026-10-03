# Handoff: Poker Table UI (Spectator View)

## Overview
Spectator-facing UI for a persistent, ongoing Texas Hold'em game played by comedic personas based on historical/artistic/philosophical figures (Sappho, Nietzsche, Diogenes, Marie Curie, Frida Kahlo, with a bench of Mozart, Sun Tzu, Cleopatra, etc.). Visitors watch hands play out live, see every hole card (omniscient spectator view), and — when a persona busts — pick who fills the empty seat from a short candidate list.

This single connected screen combines three logical views:
1. **Table view** — live hand in progress (seats, stacks, hole cards, community board, pot)
2. **Dialogue log** — running theatrical transcript of persona lines and stage directions
3. **Seat picker** — a modal moment when a seat opens, letting the spectator choose the next persona

## About the Design Files
The file in this bundle (`Poker Table.dc.html`) is a **design reference built in HTML** — a high-fidelity prototype of look, layout, and interaction, not production code to copy directly. Recreate this design in the target codebase's actual framework (the brief mentions Next.js) using its existing component patterns, data layer, and live-update mechanism (Server-Sent Events) — do not ship the HTML file itself. `image-slot.js` is a prototyping-only placeholder component (drag-and-drop image filler) and has no equivalent needed in production — replace with real persona portrait assets/`<img>` tags.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy below are final for this round; recreate pixel-close using the target stack's styling approach (CSS-in-JS, Tailwind, CSS modules, etc.) rather than treating this as a rough wireframe.

## Screens / Views (all one connected screen)

### 1. Header bar
- Full-width flex row, `justify-content: space-between`, padding `18px 32px`, bottom border `1px solid oklch(0 0 0 / 0.08)`.
- Left: title "THE TABLE" — 14px, weight 700, uppercase, letter-spacing 0.16em. Subtitle below: "Texas Hold'em · Blinds $10 / $20" — 12px, muted color, 2px margin-top.
- Right: a secondary/outline button "Review Seat Opening" (11px uppercase, letter-spacing 0.06em, padding 8px 14px, 1px border, 4px radius) — opens the seat-picker modal. In production this should instead be driven by real game state (only actionable/visible when a seat is actually open).

### 2. Table area (main, flex: 1)
- Relative-positioned container, 40px padding, containing:
  - **Felt**: absolutely positioned circle (`inset: 40px`, `border-radius: 50%`), background `oklch(0.62 0.045 145)` (muted sage green), 1px border `oklch(0 0 0 / 0.1)`, inset shadow `0 0 60px oklch(0 0 0 / 0.2)` for depth.
  - **Community board**: centered absolutely in the felt — a row of 5 card slots (flex, gap 8px) above a "Pot · $340" label (11px uppercase muted label + bold value in text color). Undealt cards render as an empty bordered slot (`background: oklch(0 0 0 / 0.03)`).
  - **5 seats**, each absolutely positioned by percentage top/left around the felt in a pentagon layout, `transform: translate(-50%,-50%)`, width 158px:
    - Sappho: top 90%, left 50% (bottom-center, nearest spectator)
    - Frida Kahlo: top 68%, left 88% (bottom-right)
    - Marie Curie: top 14%, left 78% (top-right)
    - Diogenes: top 14%, left 22% (top-left) — **empty seat** in this reference state
    - Nietzsche: top 68%, left 12% (bottom-left)
  - **Occupied seat** contents (flex column, centered, gap 6px): 64px circular portrait (gold ring `0 0 0 3px oklch(0.62 0.13 70)` when the persona is the most recent actor), name (13px, weight 600), stack label ("$1,180" style, 11px muted), a row of 2 hole cards (26×36px white rounded-rect chips, colored rank+suit glyph, 1px border), then a stage-direction line (italic, serif, 11px, muted) and quoted dialogue line (serif, 12.5px, text color) below. Folded seats render at reduced opacity (0.55) — **hole cards stay visible even when folded**; spectators are omniscient by design.
  - **Empty seat**: dashed-border card (`1px dashed oklch(0 0 0 / 0.25)`), "SEAT OPEN" label (muted, uppercase) + "Choose a player →" prompt in accent color. Clicking it opens the seat-picker modal.

### 3. Dialogue log panel (right rail, 320px fixed width)
- Left border `1px solid oklch(0 0 0 / 0.08)`, flex column.
- Header: "TABLE TALK", 11px uppercase, letter-spacing 0.1em, muted, padding 16px 20px, bottom border.
- Scrollable list (flex:1, overflow-y:auto, padding 18px 20px, gap 18px between entries), two entry types:
  - **Narrator/system line**: centered italic serif, 12px, muted — used for scene-setting beats like busts and new arrivals.
  - **Persona line**: name (11px, bold, uppercase, letter-spacing 0.06em, accent color) → stage direction (italic serif, 12px, muted) → quoted dialogue (serif, 14px, text color, line-height 1.45).

### 4. Seat picker modal
- Full-screen overlay (`position: fixed/absolute inset:0`), scrim `oklch(0 0 0 / 0.35)` + `backdrop-filter: blur(3px)`, centers a card.
- Card: 460px max-width 90vw, background `oklch(0.99 0.004 90)`, 1px border, 10px radius, 28px padding.
- Content: "A SEAT HAS OPENED" (11px uppercase muted) → italic serif subtitle naming whose chair opened → a list of 3 candidates, each row (flex, gap 14px, top border divider): 44px circular portrait, name (13px weight 600) + italic serif one-line flavor description (11.5px, muted), and a filled "SEAT" button (accent background, dark text, 11px bold uppercase, 4px radius) on the right.
- Clicking a candidate's "SEAT" button: closes the modal, fills the empty seat with that persona (fresh $1,000 stack, their starting hole cards), and appends two log entries — a narrator line ("<Name> takes the empty chair.") followed by their in-character greeting line.
- Clicking the scrim (outside the card) closes the modal without picking (dev/demo affordance — in production a seat opening likely should not be dismissible without a choice, since the game needs a seated persona to continue).

## Interactions & Behavior
- **Open picker**: header button OR clicking an empty seat.
- **Pick persona**: click a candidate row's "Seat" button → seat fills, modal closes, dialogue log appends narrator + greeting lines.
- **Close picker without picking**: click the dimmed backdrop (reference-build only, reconsider for production).
- No other interactivity in this reference (no raise/call/fold controls — the personas act autonomously per the brief; spectators are rail-birds only).
- Suggested production additions: live updates as each Claude-driven persona acts (new log lines streaming in via SSE, card reveals animating in, pot/stack values ticking), and disabling the "seat open" affordance except when a seat is genuinely empty.

## State Management (reference implementation)
- `seats`: array of 5 seat objects — `{ name, stack, cards: [{rank, suit}], folded, active (most-recent-actor flag), dir, line }` or `{ empty: true }`.
- `log`: ordered array of `{ isNarrator: true, text }` or `{ isLine: true, name, dir, text }` entries, always appended (never reordered/removed).
- `pickerOpen`: boolean.
- `candidates`: static bench list for the demo (Mozart, Sun Tzu, Cleopatra) — in production this should be a short, possibly randomized/curated subset of the full bench pool, sourced from the backend.
- In production, `seats`/`log`/pot/community cards should be driven by live server state (SSE) rather than local component state.

## Design Tokens

**Colors** (light palette, oklch):
- Background: `oklch(0.97 0.006 90)` (warm off-white)
- Primary text: `oklch(0.22 0.01 60)`
- Muted text (labels, stage directions, secondary): `oklch(0.45 0.01 60)` / `oklch(0.4 0.01 60)` / `oklch(0.35 0.01 60)` (used contextually for varying emphasis)
- Table felt: `oklch(0.62 0.045 145)` (muted sage)
- Card face background: `oklch(0.99 0.003 90)`, border `oklch(0 0 0 / 0.12)`
- Suit colors: red (hearts/diamonds) `oklch(0.48 0.18 25)`; black (spades/clubs) `oklch(0.22 0.01 60)`
- Accent (active-turn ring, names, buttons): `oklch(0.62 0.13 70)` (warm amber/bronze); button text on accent: `oklch(0.2 0.02 60)`
- Borders/dividers: `oklch(0 0 0 / 0.08)` to `oklch(0 0 0 / 0.12)`
- Modal scrim: `oklch(0 0 0 / 0.35)`; modal surface: `oklch(0.99 0.004 90)`

**Typography**
- Sans (UI/labels/names): **Inter**, weights 400/500/600/700
- Serif italic (stage directions + dialogue, theatrical feel): **Lora**, italic + upright, weights 400–600
- Scale: labels/eyebrows 11px uppercase letter-spaced; body/name 12–14px; dialogue quotes 12.5–15px

**Spacing/Radius**
- Panel/section padding: 16–32px
- Card radius: 4–5px (playing cards), 8–10px (seat cards, modal), 50% (portraits, felt)
- Gaps: 6–18px depending on density (seat internals tight, log entries looser)

## Assets
- Persona portraits: placeholder circular drag-and-drop slots in the prototype (`image-slot.js`, prototyping tool only) — production needs real illustrated portrait assets per persona (Sappho, Nietzsche, Diogenes, Marie Curie, Frida Kahlo, plus full bench: Mozart, Sun Tzu, Cleopatra, etc.), consistent illustration style, circular crop.
- No other external imagery. Playing cards are rendered as styled text (rank + suit glyph), not image assets.
- Google Fonts: Inter, Lora (loaded via `fonts.googleapis.com` in the prototype — use the codebase's normal font-loading approach instead).

## Screenshots
- `screenshots/01-seat-picker-modal.png` — seat picker modal open over the dimmed table (default/reference state).
- `screenshots/02-table-and-log.png` — table view + dialogue log with the seat empty, modal dismissed.

## Files
- `Poker Table.dc.html` — the full design reference (table view + dialogue log + seat picker, all states/logic in one file).
- `image-slot.js` — prototyping-only placeholder component referenced by the design file; not needed in production.
