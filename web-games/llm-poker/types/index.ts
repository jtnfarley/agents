// Shared schema — mirror docs/SPEC.md exactly, don't let these drift apart.

// ---- Engine primitives ----

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

// ---- Engine state (deterministic, authoritative) ----

export interface GameState {
  handNumber: number;
  potTotal: number;
  board: Card[];
  seats: SeatState[];
  actingSeat: number;
  dealerSeat: number;
  bettingRound: "preflop" | "flop" | "turn" | "river" | "showdown";
}

export interface SeatState {
  seatId: number;
  personaId: string | null; // null = open seat
  stack: number;
  holeCards: Card[];
  status: "active" | "folded" | "all_in" | "eliminated";
}

export interface LegalAction {
  type: "fold" | "check" | "call" | "raise";
  minAmount?: number;
  maxAmount?: number;
}

// ---- Memory, two tiers ----

export interface PrivateMemoryEntry {
  type: "tell_noticed" | "self_correction" | "relationship";
  target: string | null;
  note: string;
  importance: 1 | 2 | 3 | 4 | 5; // pins against pruning once over the cap (6 entries)
}

export interface TableDigestEntry {
  note: string;
  handWritten: number; // drives the 4-hand decay window
  importance: 1 | 2 | 3 | 4 | 5; // display weight only — does NOT extend life
}

// ---- Assembled per-turn prompt context ----

// A same-hand-so-far record of what's been said and done, in order acted.
// Deliberately omits `reasoning` — that stays private to the persona who
// generated it (see CLAUDE.md on stripping `reasoning`); other personas only
// ever see the public action and dialogue, same as a spectator would.
export interface HandActionLogEntry {
  seatId: number;
  personaId: string;
  action: PersonaResponse["action"];
  amount: number;
  dialogue: string;
  bettingRound: GameState["bettingRound"];
}

// The table's current open-floor topic — a question, provocation, or
// debate one persona put to the others. Lives at the table level (set on
// TableStore, threaded through playHand), not per-hand: it survives across
// hands until a persona deliberately replaces it via
// PersonaResponse["newDiscussionTopic"]. Deliberately NOT part of GameState
// (engine state is deterministic; a discussion topic is arbitrary
// persona-generated text) and NOT part of the formal two-tier memory system
// (that's LLM-summarized and decay/importance-filtered; this needs to be
// exact and visible to every seat on every turn, not a recollection of it).
export interface DiscussionTopic {
  topic: string;
  raisedByPersonaId: string;
  handNumber: number; // hand in which this became the topic
}

export interface PersonaPromptContext {
  personaId: string;
  gameState: GameState;
  ownHoleCards: Card[];
  legalActions: LegalAction[];
  privateMemory: PrivateMemoryEntry[]; // pre-filtered to seats currently at the table
  tableDigest: TableDigestEntry[]; // pre-filtered to last 4 hands
  handActionLog: HandActionLogEntry[]; // this hand's actions/dialogue so far, in order acted
  discussionTopic: DiscussionTopic | null; // the table's current open-floor topic, if any
}

// ---- Persona's structured response ----

export interface PersonaResponse {
  reasoning: string; // generated, never broadcast
  action: "fold" | "check" | "call" | "raise";
  amount: number; // 0 for fold/check
  dialogue: string;
  gesture: string;
  // Non-null to pose a new table discussion topic or change the current
  // one; null to leave whatever's active (or inactive) unchanged.
  newDiscussionTopic: string | null;
}

// ---- Persona identity ----

export interface PersonaProfile {
  id: string;
  displayName: string;
  voice: string; // diction, era-flavored speech, verbal tics
  temperament: string; // how known personality translates to playstyle
}

// ---- Post-hand memory writer ----

export interface HandEvent {
  seatId: number;
  personaId: string;
  action: string;
  amount: number;
  reasoning: string;
  dialogue: string;
  bettingRound: GameState["bettingRound"];
}

export interface MemoryWriterInput {
  personaId: string;
  existingPrivateMemory: PrivateMemoryEntry[];
  handEventLog: HandEvent[];
}

export interface MemoryWriterOutput {
  updatedPrivateMemory: PrivateMemoryEntry[]; // capped at 6, lowest-importance pruned first
  newDigestEntries: TableDigestEntry[]; // written once per hand, shared by all
}

// ---- Post-hand winner celebration ----

// Assembled once per winning seat after a hand resolves (see
// lib/orchestrator/playHand.ts) and fed to getPersonaCelebration — a
// distinct persona interaction from a turn decision (no legal actions to
// choose among), so it gets its own context/response shape rather than
// overloading PersonaPromptContext/PersonaResponse.
export interface CelebrationPromptContext {
  personaId: string; // the winning seat's persona
  handNumber: number;
  board: Card[];
  ownHoleCards: Card[];
  potWon: number;
  wonAtShowdown: boolean; // false when every other seat folded instead
  opponentPersonaIds: string[]; // other personas who took part in this hand
}

export interface CelebrationResponse {
  dialogue: string;
  gesture: string;
}

// ---- SSE event payloads ----

export interface DialogueEventPayload {
  personaId: string;
  // "celebrate" marks a post-hand winner reaction (see
  // CelebrationPromptContext) rather than an in-hand turn decision.
  action: PersonaResponse["action"] | "celebrate";
  // raise-to total for "raise"; chips actually put in for "call"; 0 for
  // "fold"/"check"; pot amount won for "celebrate".
  amount: number;
  dialogue: string;
  gesture: string;
}

export interface SeatOpenEventPayload {
  seatId: number;
  candidates: PersonaProfile[];
}

export interface SeatFilledEventPayload {
  seatId: number;
  personaId: string;
}

export interface HandCompleteEventPayload {
  handNumber: number;
  winnerSeatId: number;
  potWon: number;
}

// ---- POST /api/table/seat request body ----

export interface SeatRequestBody {
  seatId: number;
  personaId: string;
}
