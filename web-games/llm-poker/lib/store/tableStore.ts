import { createRng, nextSeatWithStatus } from "@/lib/engine";
import { publish } from "@/lib/events";
import { createMemoryStore, type MemoryStore } from "@/lib/memory";
import { applyPostHandMemory, playHand } from "@/lib/orchestrator";
import { getPersonaCelebration } from "@/lib/personas";
import type { DiscussionTopic, GameState, SeatState } from "@/types";
import {
  benchCandidates,
  hasOpenSeats,
  initialSeats,
  openEliminatedSeats,
  reconcileSeatsAfterHand,
  STARTING_STACK,
} from "./roster";

const SMALL_BLIND = 10;
const BIG_BLIND = 20;

// Real-time pacing so a spectator can actually follow along — without it,
// a hand (or several) resolves before the browser finishes its first
// paint, since nothing else in the turn loop takes wall-clock time.
const DEFAULT_ACTION_DELAY_MS = 1400;
const DEFAULT_HAND_COMPLETE_DELAY_MS = 2500;

export interface TableStoreOptions {
  actionDelayMs?: number;
  handCompleteDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TableStore {
  getGameState(): GameState;
  // Kicks off the continuous hand loop if it isn't already running (e.g.
  // paused on an open seat, or never started). Safe to call repeatedly —
  // every SSE connection calls this on connect.
  start(): void;
  // Seats a spectator-picked persona into a currently open seat with a
  // fresh stack and empty private memory, then resumes the loop if it was
  // paused waiting for this. The HTTP surface for this (POST
  // /api/table/seat) is phase 6 — this is the store-level primitive it
  // will call.
  fillSeat(seatId: number, personaId: string): void;
  // Stops the loop after the in-flight hand finishes (it won't start
  // another). Mainly here so tests can bound an otherwise-continuous loop.
  pause(): void;
}

function initialGameState(seats: SeatState[]): GameState {
  return {
    handNumber: 0,
    potTotal: 0,
    board: [],
    seats,
    actingSeat: seats[0].seatId,
    dealerSeat: seats[0].seatId,
    bettingRound: "preflop",
  };
}

// Not exported as a hard singleton on its own — see the globalThis-backed
// export at the bottom, which is what the rest of the app imports. Kept as
// a factory so tests can spin up isolated instances.
export function createTableStore(options: TableStoreOptions = {}): TableStore {
  const actionDelayMs = options.actionDelayMs ?? DEFAULT_ACTION_DELAY_MS;
  const handCompleteDelayMs = options.handCompleteDelayMs ?? DEFAULT_HAND_COMPLETE_DELAY_MS;

  let seats = initialSeats();
  let dealerSeat = seats[0].seatId;
  let handNumber = 1;
  let gameState: GameState = initialGameState(seats);
  const memoryStore: MemoryStore = createMemoryStore();
  // Outlives any single hand — see PlayHandOptions.discussionTopic — so it's
  // held here at the table level, alongside seats/dealerSeat/handNumber,
  // rather than reset each time playHand is called.
  let discussionTopic: DiscussionTopic | null = null;
  let running = false;
  let paused = false;

  function setGameState(next: GameState) {
    gameState = next;
    publish({ type: "state_update", payload: gameState });
  }

  async function playNextHand(): Promise<void> {
    const rng = createRng(Date.now() + handNumber);
    const thisHandNumber = handNumber;

    const result = await playHand(
      { seats, handNumber: thisHandNumber, dealerSeat, smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND, rng },
      {
        memoryStore,
        discussionTopic,
        onBroadcast: async (payload, state) => {
          gameState = state;
          publish({ type: "state_update", payload: state });
          publish({ type: "dialogue", payload });
          await sleep(actionDelayMs);
        },
        getCelebration: getPersonaCelebration,
        onCelebration: async (payload) => {
          publish({ type: "dialogue", payload });
          await sleep(actionDelayMs);
        },
      },
    );

    seats = reconcileSeatsAfterHand(seats, result.state.game.seats);
    discussionTopic = result.discussionTopic;
    // Broadcast the reconciled seats, not result.state.game's — otherwise a
    // fill that landed mid-hand would flash back to "open" for spectators
    // until the next hand's own broadcasts caught it up.
    setGameState({ ...result.state.game, seats });

    for (const payout of result.payouts) {
      publish({
        type: "hand_complete",
        payload: { handNumber: thisHandNumber, winnerSeatId: payout.seatId, potWon: payout.amount },
      });
    }

    // Off the critical path by design (docs/SPEC.md): fire the memory
    // writer and move on rather than blocking the next hand's first
    // action on it.
    applyPostHandMemory(result.events, thisHandNumber, memoryStore).catch((err: unknown) => {
      console.error("applyPostHandMemory failed for hand", thisHandNumber, err);
    });

    await sleep(handCompleteDelayMs);

    const elimination = openEliminatedSeats(seats);
    if (elimination.eliminatedSeatIds.length > 0) {
      seats = elimination.seats;
      setGameState({ ...gameState, seats });
      for (const seatId of elimination.eliminatedSeatIds) {
        publish({ type: "seat_open", payload: { seatId, candidates: benchCandidates(seats) } });
      }
      paused = true;
      return;
    }

    dealerSeat = nextSeatWithStatus(seats, dealerSeat, ["active"]) ?? dealerSeat;
    handNumber += 1;
  }

  async function runLoop(): Promise<void> {
    if (running) return;
    running = true;
    paused = false;
    try {
      while (!paused) {
        const eligible = seats.filter((s) => s.personaId !== null && s.stack > 0);
        if (eligible.length < 2) {
          paused = true;
          break;
        }
        await playNextHand();
      }
    } catch (err) {
      console.error("table loop stopped on an unexpected error", err);
    } finally {
      running = false;
    }
  }

  return {
    getGameState() {
      return gameState;
    },
    start() {
      void runLoop();
    },
    fillSeat(seatId, personaId) {
      seats = seats.map((s) =>
        s.seatId === seatId
          ? { seatId, personaId, stack: STARTING_STACK, holeCards: [], status: "active" as const }
          : s,
      );
      memoryStore.resetPrivateMemory(personaId);
      setGameState({ ...gameState, seats });
      publish({ type: "seat_filled", payload: { seatId, personaId } });
      if (paused && !hasOpenSeats(seats)) void runLoop();
    },
    pause() {
      paused = true;
    },
  };
}

// Next.js dev can hot-reload this module; stash the singleton on
// globalThis so a reload doesn't spawn a second, competing game loop in
// the same process (see CLAUDE.md: single Node process, in-memory store).
const globalForStore = globalThis as unknown as { __tableStore?: TableStore };
export const tableStore = globalForStore.__tableStore ?? createTableStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.__tableStore = tableStore;
}
