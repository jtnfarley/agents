import {
  advanceToNextRound,
  applyAction,
  getLegalActions,
  isBettingRoundComplete,
  isHandDecidedByFolds,
  resolveHand,
  startHand,
  type EngineState,
  type Payout,
  type StartHandParams,
} from "@/lib/engine";
import type { MemoryStore } from "@/lib/memory";
import { getPersonaTurn as defaultGetPersonaTurn } from "@/lib/personas";
import type {
  CelebrationPromptContext,
  CelebrationResponse,
  DialogueEventPayload,
  DiscussionTopic,
  GameState,
  HandActionLogEntry,
  HandEvent,
  PersonaPromptContext,
  PersonaResponse,
} from "@/types";
import { buildPersonaPromptContext, buildPersonaPromptContextWithMemory } from "./context";
import { resolveAction } from "./validateAction";

export interface PlayHandOptions {
  getPersonaTurn?: (context: PersonaPromptContext) => Promise<PersonaResponse>;
  onEvent?: (event: HandEvent) => void;
  // Fired right after each applied action with the full broadcast-shaped
  // payload (including `gesture`, which HandEvent deliberately omits — see
  // docs/SPEC.md's HandEvent vs DialogueEventPayload) and the post-action
  // GameState. This is what /lib/store wires into the SSE feed; onEvent
  // above stays HandEvent-shaped for the memory writer's hand log. Awaited
  // before the next turn, so a caller can pace the loop for spectators
  // (e.g. /lib/store adds a real-time delay here) without baking wall-clock
  // timing into this function itself.
  onBroadcast?: (payload: DialogueEventPayload, gameState: GameState) => void | Promise<void>;
  // When provided, each turn's prompt context is assembled with retrieval-
  // time memory filtering (see /lib/memory/filters.ts) instead of the
  // empty-memory default. Writing memory back after the hand resolves is a
  // separate step — see applyPostHandMemory — deliberately off this loop's
  // critical path.
  memoryStore?: MemoryStore;
  // The table's current open-floor discussion topic (if any) when this hand
  // starts. Carried in from — and, via PlayHandResult, carried back out to —
  // the caller (tableStore), since a discussion outlives any single hand
  // and only changes when a persona's response sets a new one.
  discussionTopic?: DiscussionTopic | null;
  // When provided, called once per winning seat after the hand resolves to
  // get a short in-character victory line (see CelebrationPromptContext).
  // Omitted entirely (rather than defaulted, unlike getPersonaTurn) so
  // callers that don't care about celebrations — most tests — don't need to
  // stub it out; production wiring (tableStore) always passes it.
  getCelebration?: (context: CelebrationPromptContext) => Promise<CelebrationResponse>;
  // Fired once per winning seat, right after getCelebration resolves for
  // that seat — same broadcast shape as onBroadcast (action: "celebrate"),
  // kept separate so turn broadcasts and celebration broadcasts don't have
  // to share one callback's assumptions (e.g. onBroadcast tests asserting a
  // fixed stub gesture).
  onCelebration?: (payload: DialogueEventPayload, gameState: GameState) => void | Promise<void>;
}

export interface PlayHandResult {
  state: EngineState;
  payouts: Payout[];
  events: HandEvent[];
  discussionTopic: DiscussionTopic | null;
}

// Runs one hand start-to-finish through the orchestrator's turn loop: ask
// the acting seat's persona for a decision, validate/clamp it against the
// engine's legal-actions list, apply it, and repeat until the hand is
// decided by folds or reaches showdown. The engine and the persona function
// never touch each other directly — this loop is the only thing that talks
// to both.
export async function playHand(
  startParams: StartHandParams,
  options: PlayHandOptions = {},
): Promise<PlayHandResult> {
  const getTurn = options.getPersonaTurn ?? defaultGetPersonaTurn;
  const events: HandEvent[] = [];

  let state = startHand(startParams);
  // Public (reasoning-stripped) mirror of `events`, threaded into each
  // subsequent turn's prompt context so a persona can react to what the
  // seats before it this hand actually said and did — see HandActionLogEntry.
  const handActionLog: HandActionLogEntry[] = [];
  // The table's open-floor topic, carried across turns (and hands — see
  // PlayHandOptions.discussionTopic). Any turn can replace it via
  // response.newDiscussionTopic; otherwise it persists unchanged.
  let discussionTopic: DiscussionTopic | null = options.discussionTopic ?? null;

  while (state.game.bettingRound !== "showdown") {
    if (isHandDecidedByFolds(state)) break;

    if (isBettingRoundComplete(state)) {
      state = advanceToNextRound(state);
      continue;
    }

    const seatId = state.game.actingSeat;
    const legalActions = getLegalActions(state, seatId);
    if (legalActions.length === 0) {
      throw new Error(
        `playHand: seat ${seatId} is acting but has no legal actions — engine invariant violated`,
      );
    }

    const seat = state.game.seats.find((s) => s.seatId === seatId)!;
    const context = options.memoryStore
      ? buildPersonaPromptContextWithMemory(
          state,
          seatId,
          options.memoryStore,
          handActionLog,
          discussionTopic,
        )
      : buildPersonaPromptContext(state, seatId, undefined, undefined, handActionLog, discussionTopic);
    const response = await getTurn(context);
    const actionInput = resolveAction(response, legalActions);

    if (response.newDiscussionTopic) {
      discussionTopic = {
        topic: response.newDiscussionTopic,
        raisedByPersonaId: seat.personaId!,
        handNumber: state.game.handNumber,
      };
    }

    // Chips actually put in this action — the engine computes this same
    // figure internally (see applyAction's "call" case) but doesn't expose
    // it, so it's recomputed here from the pre-action state for broadcast
    // purposes. "raise" keeps its existing raise-to-total meaning instead
    // (see HandEvent/DialogueEventPayload) since that's more useful to both
    // personas and spectators than the chip increment.
    const callAmount =
      actionInput.type === "call"
        ? Math.min(state.currentBet - (state.roundContributions[seatId] ?? 0), seat.stack)
        : 0;

    const event: HandEvent = {
      seatId,
      personaId: seat.personaId!,
      action: actionInput.type,
      amount: actionInput.type === "raise" ? (actionInput.amount ?? 0) : callAmount,
      reasoning: response.reasoning,
      dialogue: response.dialogue,
      bettingRound: state.game.bettingRound,
    };
    events.push(event);
    options.onEvent?.(event);
    handActionLog.push({
      seatId: event.seatId,
      personaId: event.personaId,
      action: actionInput.type,
      amount: event.amount,
      dialogue: event.dialogue,
      bettingRound: event.bettingRound,
    });

    state = applyAction(state, seatId, actionInput);
    await options.onBroadcast?.(
      {
        personaId: event.personaId,
        action: actionInput.type,
        amount: event.amount,
        dialogue: response.dialogue,
        gesture: response.gesture,
      },
      state.game,
    );
  }

  const resolved = resolveHand(state);

  if (options.getCelebration) {
    const wonAtShowdown = !isHandDecidedByFolds(state);
    const participantPersonaIds = [...new Set(events.map((e) => e.personaId))];

    for (const payout of resolved.payouts) {
      const seat = resolved.state.game.seats.find((s) => s.seatId === payout.seatId);
      if (!seat?.personaId) continue;

      const celebrationContext: CelebrationPromptContext = {
        personaId: seat.personaId,
        handNumber: state.game.handNumber,
        board: resolved.state.game.board,
        ownHoleCards: seat.holeCards,
        potWon: payout.amount,
        wonAtShowdown,
        opponentPersonaIds: participantPersonaIds.filter((id) => id !== seat.personaId),
      };
      const response = await options.getCelebration(celebrationContext);
      await options.onCelebration?.(
        {
          personaId: seat.personaId,
          action: "celebrate",
          amount: payout.amount,
          dialogue: response.dialogue,
          gesture: response.gesture,
        },
        resolved.state.game,
      );
    }
  }

  return { state: resolved.state, payouts: resolved.payouts, events, discussionTopic };
}
