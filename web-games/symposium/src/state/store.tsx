"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { AUTOPLAY_MS, LIMITS, MOCK_DELAY_MS } from "@/lib/constants";
import { mockSummary, nextPhilosopherTurn, visitorTurns } from "@/lib/mockEngine";
import { drawPair, type Pair } from "@/lib/pairing";
import { ROSTER } from "@/lib/roster";
import { loadState, saveState, type SavedState } from "@/lib/storage";
import { shouldSummarize } from "@/lib/turnPolicy";
import type { Debate, Ledger, Target, Turn } from "@/lib/types";

export type Busy = "topic" | "turn" | "summary" | null;

export interface AppState extends SavedState {
  busy: Busy;
  autoplay: boolean;
  error: string | null;
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; saved: SavedState | null }
  | { type: "busy"; busy: Busy }
  | { type: "error"; message: string | null }
  | { type: "autoplay"; on: boolean }
  | { type: "create"; debate: Debate }
  | { type: "setPair"; id: string; pair: Pair }
  | { type: "appendTurns"; id: string; turns: Turn[] }
  | { type: "setSummary"; id: string; rollingSummary: string; ledger: Ledger }
  | { type: "newDebate" };

export const initialState: AppState = {
  debates: {},
  order: [],
  currentId: null,
  busy: null,
  autoplay: false,
  error: null,
  hydrated: false,
};

const ERROR_TEXT = "Something went wrong. Try again.";

export function currentDebate(state: Pick<AppState, "debates" | "currentId">): Debate | null {
  return state.currentId ? (state.debates[state.currentId] ?? null) : null;
}

function updateDebate(state: AppState, id: string, fn: (d: Debate) => Debate): AppState {
  const d = state.debates[id];
  if (!d) return state;
  return { ...state, debates: { ...state.debates, [id]: fn(d) } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      if (!action.saved) return { ...state, hydrated: true };
      return { ...state, ...action.saved, hydrated: true };
    case "busy":
      return { ...state, busy: action.busy };
    case "error":
      return { ...state, error: action.message };
    case "autoplay":
      return { ...state, autoplay: action.on };
    case "create":
      return {
        ...state,
        debates: { ...state.debates, [action.debate.id]: action.debate },
        order: [...state.order, action.debate.id],
        currentId: action.debate.id,
        error: null,
      };
    case "setPair":
      // The pair is locked once the first turn lands.
      return updateDebate(state, action.id, (d) =>
        d.turns.length > 0 ? d : { ...d, philosophers: action.pair },
      );
    case "appendTurns":
      return updateDebate(state, action.id, (d) => {
        const stances = { ...d.stances };
        for (const t of action.turns) {
          if ((t.speaker === "A" || t.speaker === "B") && t.stance) stances[t.speaker] = t.stance;
        }
        return { ...d, turns: [...d.turns, ...action.turns], stances };
      });
    case "setSummary":
      return updateDebate(state, action.id, (d) => ({
        ...d,
        rollingSummary: action.rollingSummary,
        ledger: action.ledger,
      }));
    case "newDebate":
      return { ...state, currentId: null, autoplay: false, error: null };
  }
}

export interface Actions {
  startDebate(topic: string): Promise<void>;
  reshuffle(): Promise<void>;
  takeTurn(visitor?: { text: string; target: Target }): Promise<void>;
  setAutoplay(on: boolean): void;
  newDebate(): void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = () => crypto.randomUUID();

export interface StoreValue {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const inFlight = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  });

  // Load once after mount. Rendering starts from the empty state, so server and client match.
  useEffect(() => {
    dispatch({ type: "hydrate", saved: loadState() });
  }, []);

  // Save after hydration only, so the empty first render never overwrites stored debates.
  useEffect(() => {
    if (!state.hydrated) return;
    saveState({ debates: state.debates, order: state.order, currentId: state.currentId });
  }, [state.hydrated, state.debates, state.order, state.currentId]);

  const actions = useMemo<Actions>(() => {
    // One request at a time. Clicks while busy are ignored.
    const run = async (busy: Busy, fn: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      dispatch({ type: "busy", busy });
      dispatch({ type: "error", message: null });
      try {
        await fn();
      } catch {
        dispatch({ type: "error", message: ERROR_TEXT });
      } finally {
        inFlight.current = false;
        dispatch({ type: "busy", busy: null });
      }
    };

    /** Runs the background summary when the turn count reaches a multiple of four. */
    const maybeSummarize = async (debate: Debate) => {
      if (!shouldSummarize(debate.turns)) return;
      dispatch({ type: "busy", busy: "summary" });
      await wait(MOCK_DELAY_MS);
      const { rollingSummary, ledger } = mockSummary(debate);
      dispatch({ type: "setSummary", id: debate.id, rollingSummary, ledger });
    };

    return {
      async startDebate(raw) {
        const topic = raw.trim().slice(0, LIMITS.topic);
        if (!topic) {
          dispatch({ type: "error", message: "Enter a topic to begin." });
          return;
        }
        await run("topic", async () => {
          await wait(MOCK_DELAY_MS);
          const last = stateRef.current.order.at(-1);
          const previous = last ? stateRef.current.debates[last] : undefined;
          const pair = drawPair(ROSTER, previous ? previous.philosophers : null);
          dispatch({
            type: "create",
            debate: {
              id: newId(),
              topic,
              philosophers: pair,
              stances: { A: null, B: null },
              turns: [],
              rollingSummary: "",
              ledger: null,
            },
          });
        });
      },

      async reshuffle() {
        const debate = currentDebate(stateRef.current);
        if (!debate || debate.turns.length > 0) return;
        await run("topic", async () => {
          await wait(MOCK_DELAY_MS);
          const pair = drawPair(ROSTER, debate.philosophers);
          dispatch({ type: "setPair", id: debate.id, pair });
        });
      },

      async takeTurn(visitor) {
        const debate = currentDebate(stateRef.current);
        if (!debate) return;
        await run("turn", async () => {
          await wait(MOCK_DELAY_MS);
          const turns = visitor
            ? visitorTurns(debate, visitor.text.slice(0, LIMITS.visitorText), visitor.target, newId)
            : [nextPhilosopherTurn(debate, newId)];
          dispatch({ type: "appendTurns", id: debate.id, turns });
          const after = { ...debate, turns: [...debate.turns, ...turns] };
          await maybeSummarize(after);
        });
      },

      setAutoplay(on) {
        dispatch({ type: "autoplay", on });
      },

      newDebate() {
        dispatch({ type: "newDebate" });
      },
    };
  }, []);

  // Auto-play: each turn schedules the next one after a short gap, until paused.
  const debate = currentDebate(state);
  const hasDebate = debate !== null;
  const turnCount = debate?.turns.length ?? 0;
  useEffect(() => {
    if (!state.autoplay || state.busy || !hasDebate) return;
    const timer = window.setTimeout(() => void actions.takeTurn(), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.autoplay, state.busy, hasDebate, turnCount, actions]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
