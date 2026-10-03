# Story Forge Web — Build Procedure

Port of the `story-forge` chat skill (LLM game-master, dice-backed choices, no
pre-written branch tree) into a standalone, shareable Next.js app. This file
is the spec — follow it phase by phase; each phase should be independently
verifiable before moving to the next.

## Goals / non-goals

- **Goal:** public, shareable web app. Anyone can start a game with no login.
- **Goal:** stateless backend — the browser holds game state, the server never
  stores it. No database.
- **Goal:** genuine server-side randomness for dice, not the LLM picking a
  "narratively convenient" outcome.
- **Goal:** LLM provider swappable without rewriting call sites.
- **Non-goal (v1):** accounts, cross-device save/resume, persistent storage of
  any kind.
- **Optional (Phase 6):** AI-generated background art that evolves with the
  story. Build the app fully without this first; add it as a self-contained
  layer after Phase 5 is working and deployed.

## Tech stack

- Next.js (App Router), TypeScript
- Tailwind CSS
- Vercel AI SDK (`ai` package) + `zod` for structured LLM output
- Narration LLM: Claude via `@ai-sdk/anthropic`, swappable to any AI SDK provider
- Rate limiting (first pass): in-memory token bucket per IP, no external service — required before sharing the link publicly, since every turn costs a paid LLM call. Known limitation: resets on server restart/redeploy and isn't shared across serverless instances, so it caps abuse rather than guaranteeing a hard ceiling. Upgrade path to Upstash Redis noted in Phase 5 if usage grows.
- Optional (Phase 6) art model: Google `gemini-3.1-flash-lite-image` ("Nano Banana 2 Lite"), reachable through the same OpenRouter provider already used for narration (`lib/llm.ts`) — no separate gateway needed. Chosen over full Nano Banana 2 for cost (~$0.03/image vs ~$0.05-0.08) at similar edit-consistency quality; swapping to `gemini-3.1-flash-image` later is a one-line model-id change if quality disappoints.

## Architecture

Every turn is one stateless HTTP round trip:

```
client (holds full GameState in React state)
  → POST { state: GameState, action: string }
  ← { narration, choices, updatedState, roll?, ended, epilogue? }
client replaces its local state with updatedState and renders
```

### Turn flow (dice)

The model must never both set the difficulty and know the roll — that's how
the original skill keeps rolls honest, and it maps directly to a two-call
structure:

1. **Risk assessment call** (structured output): given `state` + `action`,
   the model returns whether the action is risky and, if so, a DC — before
   any roll exists.
2. **Server rolls**, in plain code, no LLM involved:
   `Math.floor(Math.random() * 20) + 1`. Resolve against the DC using the
   fixed table below. This is deterministic application logic, not a prompt.
3. **Narration call** (structured output): given `state`, `action`, and (if
   risky) the roll + outcome tier from step 2, the model returns the prose,
   the next two choices, and the rewritten `updatedState`.

Non-risky actions skip straight to step 3 with no roll.

**DC table:**

| Label | DC |
|---|---|
| Easy — low risk, sensible approach | 8 |
| Moderate — real risk, reasonable approach | 12 |
| Hard — dangerous, or attempted unprepared | 16 |
| Reckless — over their head, no real plan | 18+ |

**Resolution table** (pure code, given `roll` and `dc`):

| Condition | Outcome |
|---|---|
| `roll === 1` | Critical failure — worst plausible complication, often a genuinely new problem |
| `roll < dc` | Failure with a cost proportionate to the stakes |
| `roll >= dc && roll - dc <= 2` | Success, but with a complication |
| `roll - dc >= 3` | Clean success |
| `roll === 20` | Critical success — an unearned extra benefit, not just "no downside" |

Natural 1 and natural 20 override everything else, even below/above a DC.

Mechanics are hidden by default. `updatedState` and the response never expose
DC/roll to the client UI unless the player has toggled "show mechanics" on —
that's a pure client-side render decision, the server can just always include
`roll` in the payload and let the UI decide whether to show it.

## Data model

```ts
// lib/schemas.ts
import { z } from "zod";

export const GameStateSchema = z.object({
  genre: z.string(),
  protagonist: z.object({
    name: z.string(),
    descriptor: z.string(),
    gender: z.enum(["woman", "man", "nonbinary", "unspecified"]),
  }),
  establishedFacts: z.array(z.string()),
  openThreads: z.array(z.string()),
  currentDecisionPoint: z.string(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const RiskAssessmentSchema = z.object({
  risky: z.boolean(),
  dc: z.number().min(8).max(20).optional(),
  reasoning: z.string().optional(),
});

export const TurnResponseSchema = z.object({
  narration: z.string(),
  choices: z.array(z.object({ id: z.string(), text: z.string() })).length(2),
  updatedState: GameStateSchema,
  roll: z
    .object({
      dc: z.number(),
      result: z.number(),
      outcomeTier: z.enum([
        "critFail",
        "fail",
        "successComplication",
        "cleanSuccess",
        "critSuccess",
      ]),
    })
    .optional(),
  endingOffered: z.boolean(),
  ended: z.boolean(),
  epilogue: z.string().optional(),
  // Phase 6 only — omit entirely until then:
  visualDescription: z.string().optional(),
  visualShift: z.enum(["none", "evolve", "cut"]).optional(),
});
```

## Routes

- `app/page.tsx` — genre (3 random from the pool below + "surprise me") and
  protagonist picks, Start button
- `app/play/page.tsx` — narration log, two choice buttons + free-text input,
  "show mechanics" toggle, End Story button
- `app/api/start/route.ts` — first scene from genre + protagonist choice
- `app/api/turn/route.ts` — the risk-assessment → roll → narration flow above
- `app/api/art/route.ts` — Phase 6 only

## System prompt source material

This is the condensed rule set to embed in the narration call's system
prompt. Put it in `lib/gameRules.ts` as exported constants so both API routes
can share it.

**Genre pool** (sample 3 at random + always offer "surprise me"):
fantasy adventure, horror/survival, space opera, cyberpunk, post-apocalyptic
survival, mystery/noir, heist thriller, wartime spy drama, high-seas piracy,
western frontier, fairy tale/fable, cosmic horror, historical intrigue,
political thriller, time-travel puzzle, ghost story, wilderness survival,
steampunk, urban fantasy, first-contact sci-fi, detective procedural,
swashbuckling adventure.

**Opening scene instructions:** invent a concrete, specific setting (not
generic), the protagonist's name and an immediate goal, and one obstacle that
forces a real decision. Keep it tight — a few short paragraphs. End every
turn with a prompt like "What does [name] do?" plus two concrete numbered
choices that push the story in genuinely different directions (the client
adds the standing third option, free text, automatically — the model only
needs to produce two).

**Prose style:** choices and narration should read like something is
happening to someone, not a report about it — cut justification clauses,
write the raw impulse. Avoid one-note solemnity; vary rhythm, let specific
concrete detail and the occasional bit of wit carry tension rather than
stating that something is dire.

**State discipline:** the model must rewrite `establishedFacts`,
`openThreads`, and `currentDecisionPoint` completely each turn (not append),
keeping only what's still true. This state is bookkeeping — never surface it
as visible narration text.

**Actions outside established rules:** never refuse an off-script attempt
outright and never silently accommodate it either. Resolve it against what's
actually true in the story so far; if the premise doesn't hold, the attempt
fails without a roll (it's a matter of established fact, not chance) — but
the failure should still cost something real, never a free no-op.

**Ending triggers:** offer an ending when a critical roll lands (natural 1 or
20) or whenever the player asks to end, at any point. An ending should be a
genuine tone-matched epilogue resolving `establishedFacts`, not a trail-off.

## Build phases

### Phase 0 — Scaffold
`create-next-app` with TypeScript + Tailwind. Set up `lib/schemas.ts`,
`lib/gameRules.ts`. No LLM calls yet.

### Phase 1 — Start screen + mock turn
Build `/` and `/play` against a hardcoded fake `TurnResponse` so the UI/state
shape is validated before any API cost is involved.

### Phase 2 — Real narration, non-risky path only
Wire `api/start` and `api/turn` to the narration LLM via `generateObject` +
`TurnResponseSchema`. Skip the risk-assessment call for now — treat every
action as non-risky to get the core loop working end to end.

### Phase 3 — Dice-backed risky turns
Add the risk-assessment call and server-side roll. Wire the outcome tier into
the narration call's context. Add the "show mechanics" client toggle.

### Phase 4 — Ending flow
Critical-roll and player-requested ending triggers; epilogue rendering;
restart flow.

### Phase 5 — Rate limiting + deploy
Add an in-memory, per-IP token-bucket rate limiter (e.g. a simple `Map<ip,
{count, resetAt}>` in a module-scope singleton, checked at the top of
`api/start` and `api/turn`) — no external service for this first pass. Deploy
to Vercel. **Do this before sharing the link publicly** — this is a real
spend control, not a nice-to-have, once the app is reachable by anyone.

Known limitation: on Vercel's serverless runtime, in-memory state is scoped
to a single function instance and clears on cold start/redeploy, so the
limit is per-instance, not truly global — a burst of traffic across
instances can exceed the nominal cap. That's an acceptable tradeoff for a
first pass with modest traffic. If usage grows past that, swap in
Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`) for a real
shared/durable limit — same call site, just a different backing store.

### Phase 6 (Optional) — Evolving background art

Build only after Phase 5 is stable. Self-contained — the app should work
identically with this phase skipped.

1. **Style prefix:** at story start, derive a one-line style string from the
   genre (e.g. "moody painterly digital illustration, cinematic rim
   lighting, muted [genre-appropriate] palette"). Store it in `GameState`.
   Append it to every image prompt, generation or edit, for visual
   consistency across the whole session.
2. **Add `visualDescription` and `visualShift` to the narration call's
   output** (already in the schema above): a compact, prose-free scene
   description, and one of:
   - `"none"` — no image call this turn
   - `"cut"` — the `Setting`-equivalent changed → fresh text-to-image
     generation (`gemini-3.1-flash-lite-image` via OpenRouter, 16:9, style
     prefix + description)
   - `"evolve"` — same location, meaningful visual shift → image-to-image
     edit of the *current* background using the same model, with the prior
     image as reference
3. **Client holds the current background** as a data URL in React state and
   sends it back to `api/art` when `visualShift === "evolve"` (there's no
   server storage, so the reference has to travel with the request, same as
   the rest of state). Bias toward `"cut"` over long `"evolve"` chains — many
   consecutive edits of the same image tend to drift; a scene change is a
   natural reset point.
4. **Non-blocking:** fire `api/art` in parallel with rendering the turn's
   narration, not before it. Crossfade the new background in when it
   resolves. On failure or timeout, silently keep the previous background —
   never block the story on art.
5. **UI:** generate at 16:9 (or wider), render as a fixed background behind
   the narration panel with a dark gradient scrim for text legibility.
6. **Cost note:** images cost meaningfully more per call than the text turns.
   The in-memory limiter from Phase 5 caps turn *count*, not spend — if art
   is turned on, consider lowering the per-IP turn limit or moving to
   Upstash for a firmer ceiling before sharing widely.

## Environment variables

```
OPENROUTER_API_KEY=            # narration LLM (lib/llm.ts) and, from Phase 6, the art model — same provider, no separate key needed
# UPSTASH_REDIS_REST_URL=       # only if/when upgrading Phase 5's limiter off in-memory
# UPSTASH_REDIS_REST_TOKEN=     # only if/when upgrading Phase 5's limiter off in-memory
```

## Acceptance checklist per phase

- [ ] Phase 0: `next dev` runs, empty routes exist, schemas compile
- [ ] Phase 1: can click through a full mock turn with no network calls
- [ ] Phase 2: a real game plays start-to-finish with no risky turns ever failing to parse
- [ ] Phase 3: a forced risky action visibly resolves via a real roll (verify by logging `roll` server-side, not just trusting narration text)
- [ ] Phase 4: both ending triggers produce a real epilogue and a working restart
- [ ] Phase 5: exceeding the in-memory rate limit returns a clean error, not a crash; deployed URL is reachable
- [x] Phase 6: background updates on a "cut", updates on an "evolve", and the story stays fully playable if art generation fails for any reason (bad/missing key, timeout, rate limit) — verified via direct `api/art` calls exercising both `"cut"` and `"evolve"` (image-to-image edit correctly preserved the scene and added only the requested change); client treats any non-200 as "keep the previous background," never fatal to the turn
