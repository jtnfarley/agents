# SPEC — historical-figures poker table

Full architecture, data schema, and build plan. `CLAUDE.md` has the short version and the rules; this is the reference to work from phase by phase.

## Architecture in one paragraph

Four pieces, one direction of authority. The **game engine** is plain deterministic TypeScript — deck, betting, pot math, hand evaluation — and has never heard of an LLM. **Persona agents** are OpenRouter calls — most personas draw a random model per call from a rotating pool of free models (`lib/personas/openrouterModels.ts`'s `FREE_OPENROUTER_MODELS`), any persona not in that rotation falls back to a single fixed free model — that receive only what that character could plausibly know and return a structured decision plus in-character dialogue — they never touch game state directly. There is no direct Claude/Anthropic API call anywhere in the persona path; every persona, memory-writer, and celebration call goes through OpenRouter. The **orchestrator** is the only thing that talks to both engine and personas: it assembles each persona's prompt, validates whatever comes back against the engine's legal-actions list, applies it, and broadcasts the result. **Memory** is two tiers — private (per-persona, importance-pinned, survives indefinitely) and table digest (shared, recency-only, decays after 4 hands) — written by a separate cheap call after each hand resolves, off the critical path. Orthogonal to both: a persistent **table discussion topic** (a question/provocation any persona can raise or redirect, survives across hands until replaced) and a post-hand **celebration** line from each winning seat.

## MVP game parameters

- Texas Hold'em, no antes, blinds $10/$20
- 4 seats, $1,000 starting stack per persona
- Starting roster: 4 personas chosen at random from the full persona list (`lib/personas/profiles.ts`, expand freely) each time a table is created; everyone else starts on the bench for the seat-refill pool
- **Spectators are omniscient** — the frontend shows every seat's hole cards at all times, hole-card-cam style. This is deliberate: watching a persona bluff *knowing* what they're holding is more entertaining than mirroring a real player's blind spot. Persona prompts still only ever receive their own hole cards — the omniscience is a spectator-only broadcast decision, not a change to what any persona knows.

## Core types

```typescript
// ---- Engine state (deterministic, authoritative) ----

interface GameState {
  handNumber: number;
  potTotal: number;
  board: Card[];
  seats: SeatState[];
  actingSeat: number;
  dealerSeat: number;
  bettingRound: "preflop" | "flop" | "turn" | "river" | "showdown";
}

interface SeatState {
  seatId: number;
  personaId: string | null;        // null = open seat
  stack: number;
  holeCards: Card[];
  status: "active" | "folded" | "all_in" | "eliminated";
}

interface LegalAction {
  type: "fold" | "check" | "call" | "raise";
  minAmount?: number;
  maxAmount?: number;
}

// ---- Memory, two tiers ----

interface PrivateMemoryEntry {
  type: "tell_noticed" | "self_correction" | "relationship";
  target: string | null;
  note: string;
  importance: 1 | 2 | 3 | 4 | 5;   // pins against pruning once over the cap (6 entries)
}

interface TableDigestEntry {
  note: string;
  handWritten: number;             // drives the 4-hand decay window
  importance: 1 | 2 | 3 | 4 | 5;   // display weight only — does NOT extend life
}

// ---- Table discussion (open-floor talk, orthogonal to memory) ----

// A question, provocation, or debate one persona puts to the others. Lives
// on the table (threaded through playHand from the store), not per-hand —
// it survives across hands until a persona replaces it via
// PersonaResponse.newDiscussionTopic. Deliberately not part of GameState
// (that's deterministic engine state; this is arbitrary persona text) and
// not part of the two-tier memory system below (that's LLM-summarized and
// decay-filtered; every seat needs the exact live topic every turn).
interface DiscussionTopic {
  topic: string;
  raisedByPersonaId: string;
  handNumber: number;
}

// ---- Assembled per-turn prompt context ----

interface PersonaPromptContext {
  personaId: string;
  gameState: GameState;
  ownHoleCards: Card[];
  legalActions: LegalAction[];
  privateMemory: PrivateMemoryEntry[];   // pre-filtered to seats currently at the table
  tableDigest: TableDigestEntry[];       // pre-filtered to last 4 hands
  handActionLog: HandActionLogEntry[];   // this hand's actions/dialogue so far, in order acted
  discussionTopic: DiscussionTopic | null; // the table's current open-floor topic, if any
}

// ---- Persona's structured response ----

interface PersonaResponse {
  reasoning: string;    // generated, never broadcast
  action: "fold" | "check" | "call" | "raise";
  amount: number;        // 0 for fold/check
  dialogue: string;
  gesture: string;
  newDiscussionTopic: string | null; // non-null to pose or change the table's topic
}

// ---- Persona identity ----

interface PersonaProfile {
  id: string;
  displayName: string;
  voice: string;          // diction, era-flavored speech, verbal tics
  temperament: string;    // how known personality translates to playstyle
}

// ---- Post-hand memory writer ----

interface HandEvent {
  seatId: number;
  personaId: string;
  action: string;
  amount: number;
  reasoning: string;
  dialogue: string;
  bettingRound: GameState["bettingRound"];
}

interface MemoryWriterInput {
  personaId: string;
  existingPrivateMemory: PrivateMemoryEntry[];
  handEventLog: HandEvent[];
}

interface MemoryWriterOutput {
  updatedPrivateMemory: PrivateMemoryEntry[];   // capped at 6, lowest-importance pruned first
  newDigestEntries: TableDigestEntry[];         // written once per hand, shared by all
}

// ---- Post-hand winner celebration ----
// Assembled once per winning seat after a hand resolves and fed to
// getPersonaCelebration — a distinct persona interaction from a turn
// decision (no legal actions to choose among), so it gets its own
// context/response shape rather than overloading PersonaPromptContext/
// PersonaResponse.

interface CelebrationPromptContext {
  personaId: string;            // the winning seat's persona
  handNumber: number;
  board: Card[];
  ownHoleCards: Card[];
  potWon: number;
  wonAtShowdown: boolean;        // false when every other seat folded instead
  opponentPersonaIds: string[];  // other personas who took part in this hand
}

interface CelebrationResponse {
  dialogue: string;
  gesture: string;
}

// ---- SSE event payloads ----

interface DialogueEventPayload {
  personaId: string;
  action: PersonaResponse["action"] | "celebrate"; // "celebrate" = post-hand winner reaction
  amount: number;    // raise-to total / chips called / 0 / pot won for "celebrate"
  dialogue: string;
  gesture: string;
}

interface SeatOpenEventPayload {
  seatId: number;
  candidates: PersonaProfile[];
}

interface SeatFilledEventPayload {
  seatId: number;
  personaId: string;
}

interface HandCompleteEventPayload {
  handNumber: number;
  winnerSeatId: number;
  potWon: number;
}

// ---- POST /api/table/seat request body ----

interface SeatRequestBody {
  seatId: number;
  personaId: string;
}
```

## API / event contract

**`GET /api/table/stream`** — Server-Sent Events, one connection per spectator. Events:

| event         | payload                                              | when |
|---------------|-------------------------------------------------------|------|
| `state_update`| full current `GameState` (all hole cards included)     | after every applied action |
| `dialogue`    | `{ personaId, action, amount, dialogue, gesture }`      | after every applied action, alongside `state_update`; also once per winning seat right after a hand resolves, with `action: "celebrate"` and `amount` set to that seat's pot share (see `getPersonaCelebration`) |
| `seat_open`   | `{ seatId, candidates: PersonaProfile[] }`              | on elimination — pauses the loop |
| `seat_filled` | `{ seatId, personaId }`                                 | after a spectator picks |
| `hand_complete`| `{ handNumber, winnerSeatId, potWon }`                 | at showdown or when only one seat remains live |

**`POST /api/table/seat`** — body `{ seatId, personaId }`. Reject with 400 if the seat isn't currently open or `personaId` isn't in the broadcast candidate list. On success: seat that persona with a fresh $1,000 stack and empty private memory, emit `seat_filled`, resume the loop.

## Phased build plan

Work in order. Don't skip ahead — each phase assumes the last one is solid.

**Phase 0 — scaffold.** Next.js app, TypeScript strict mode, the folder layout from `CLAUDE.md`, all types above stubbed into `/types`. *Done when:* project builds and runs with an empty table page.

**Phase 1 — engine, standalone.** Deck/shuffle (seeded), betting state machine, side-pot math, hand evaluator. No orchestrator, no personas, no frontend yet. *Done when:* unit tests cover a full hand including an all-in side-pot scenario and a showdown, with no LLM involved anywhere.

**Phase 2 — orchestrator with stub personas.** Wire the turn loop: engine → orchestrator → a stub `getPersonaTurn` that picks randomly among legal actions with placeholder dialogue. Validate the illegal-action clamp path explicitly (feed it a stub that returns an over-large bet and confirm it gets capped). *Done when:* a full hand plays out end-to-end via stubs with correct pot math and no manual intervention.

**Phase 3 — real persona agents.** Replace the stub with real OpenRouter calls using the `PersonaPromptContext` → `PersonaResponse` contract, structured output enforced via tool calling (with a prompted-JSON fallback if the tool call comes back empty). Start with one seat live and the rest stubbed, then expand. *Done when:* dialogue is coherent with the action chosen, every time, across at least 20 hands. **Done** — see `lib/personas/openrouter.ts` / `fallbackModel.ts`, dispatched through `getPersonaTurn` (`lib/personas/index.ts`).

**Phase 4 — memory.** Implement the post-hand memory writer for both tiers, the retrieval-time filters (current seats only for private memory, last-4-hands for digest), and the seat-refill cold-start path (empty private memory, digest still populated). *Done when:* a persona's play measurably changes based on a private-memory entry from an earlier hand, and a newly seated persona's opening dialogue references the table digest, not any private memory. **Done** — see `lib/memory/writer.ts`, `filters.ts`, `dispatch.ts`.

**Phase 5 — SSE and frontend.** Build `/api/table/stream`, the table view (seats, stacks, board, pot), and the dialogue log. *Done when:* a browser tab shows live hands playing out with no manual refresh. **Done** — see `app/api/table/stream/route.ts`, `components/Table.tsx` + `DialogueLog.tsx`.

**Phase 6 — seat-refill UI.** `/api/table/seat`, the seat-picker component triggered by `seat_open`. *Done when:* a spectator can pick a bench persona and watch them get seated cold into an in-progress table. **Done** — see `app/api/table/seat/route.ts`, `components/SeatPickerModal.tsx`.

**Phase 7 — cost and polish.** Skip the full call on routine folds/checks (templated or omitted dialogue instead); add fallback behavior for a timed-out or malformed persona response (default to a random legal action, log it, don't stall the loop); pass on tone/visual polish. **Partially done:** timeout/malformed-response fallback to the stub is implemented (`getPersonaTurn`'s catch path in `lib/personas/index.ts`), as is a cross-call cooldown that steers retries away from a model that just hit a capacity error (`lib/personas/modelCooldown.ts`) — but there is no cost-skip on routine folds/checks yet; every live turn still makes a full LLM call. Visual polish (portraits, thinking-word animation, table layout) is ongoing but substantially built — see `components/Portrait.tsx`, `useThinkingWord.ts`, `design/README.md`.

**Beyond the original plan.** Two features exist that weren't in the original phased plan: a persistent **table discussion topic** (`DiscussionTopic`, threaded through `playHand`/`tableStore`, prompted for in `lib/personas/prompt.ts`) that lets personas raise or redirect an open-floor conversation across hands, and a post-hand **winner celebration** line (`CelebrationPromptContext`/`CelebrationResponse`, dispatched through `getPersonaCelebration`) fired once per winning seat after a hand resolves. Both follow the same engine/persona boundary and OpenRouter-routing rules as everything else.

## Notes for whoever (human or agent) picks this up mid-build

- If pot math and persona dialogue ever disagree (e.g. a broadcast dialogue line references a fold that isn't what actually got applied), the bug is almost certainly a `reasoning`/`action` ordering issue in phase 3's prompt, or a validation step that silently changed the action without regenerating the dialogue to match. Check the orchestrator's clamp path first.
- The two memory decay rules are different on purpose (see `CLAUDE.md`). Don't unify them without a reason — it was a deliberate choice, not an oversight.
