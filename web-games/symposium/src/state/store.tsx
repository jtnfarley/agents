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
import { api, type TurnStart } from "@/lib/apiClient";
import { AUTOPLAY_MS, LIMITS } from "@/lib/constants";
import { errorCodeOf, errorText } from "@/lib/errors";
import { loadState, saveState, type SavedState } from "@/lib/storage";
import { shouldSummarize } from "@/lib/turnPolicy";
import type { Debate, Ledger, Pair, Target, Turn } from "@/lib/types";

export type Busy = "topic" | "turn" | "summary" | null;

/** A turn that is still arriving. It becomes a real turn when the server finishes. */
export interface Draft extends TurnStart {
  text: string;
}

export interface AppState extends SavedState {
  busy: Busy;
  autoplay: boolean;
  error: string | null;
  draft: Draft | null;
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; saved: SavedState | null }
  | { type: "busy"; busy: Busy }
  | { type: "error"; message: string | null }
  | { type: "autoplay"; on: boolean }
  | { type: "draftStart"; start: TurnStart }
  | { type: "draftText"; text: string }
  | { type: "draftClear" }
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
  draft: null,
  hydrated: false,
};

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
    case "draftStart":
      return { ...state, draft: { ...action.start, text: "" } };
    case "draftText":
      return state.draft ? { ...state, draft: { ...state.draft, text: action.text } } : state;
    case "draftClear":
      return { ...state, draft: null };
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
      return updateDebate({ ...state, draft: null }, action.id, (d) => {
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
  /** Resolves true when the debate was created. */
  startDebate(topic: string): Promise<boolean>;
  reshuffle(): Promise<void>;
  /** Resolves true when the turn landed, so the composer can clear its text. */
  takeTurn(visitor?: { text: string; target: Target }): Promise<boolean>;
  setAutoplay(on: boolean): void;
  newDebate(): void;
}

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
    const run = async (busy: Busy, fn: () => Promise<void>): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      dispatch({ type: "busy", busy });
      dispatch({ type: "error", message: null });
      try {
        await fn();
        return true;
      } catch (e) {
        dispatch({ type: "error", message: errorText(errorCodeOf(e)) });
        return false;
      } finally {
        inFlight.current = false;
        dispatch({ type: "draftClear" });
        dispatch({ type: "busy", busy: null });
      }
    };

    /** Asks the server for a summary when the turn count reaches a multiple of four. */
    const maybeSummarize = async (debate: Debate) => {
      if (!shouldSummarize(debate.turns)) return;
      dispatch({ type: "busy", busy: "summary" });
      const { rollingSummary, ledger } = await api.summarize({ debate });
      dispatch({ type: "setSummary", id: debate.id, rollingSummary, ledger });
    };

    return {
      async startDebate(raw) {
        const topic = raw.trim().slice(0, LIMITS.topic);
        if (!topic) {
          dispatch({ type: "error", message: "Enter a topic to begin." });
          return false;
        }
        const last = stateRef.current.order.at(-1);
        const previous = last ? stateRef.current.debates[last] : undefined;
        return run("topic", async () => {
          const res = await api.start({
            topic,
            previousPair: previous ? previous.philosophers : undefined,
          });
          dispatch({
            type: "create",
            debate: {
              id: newId(),
              topic: res.topic,
              philosophers: { A: res.a, B: res.b },
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
          const res = await api.reshuffle({
            topic: debate.topic,
            currentPair: debate.philosophers,
            turnCount: debate.turns.length,
          });
          dispatch({ type: "setPair", id: debate.id, pair: { A: res.a, B: res.b } });
        });
      },

      async takeTurn(visitor) {
        const debate = currentDebate(stateRef.current);
        if (!debate) return false;
        return run("turn", async () => {
          const res = await api.turnStream(
            {
              debate,
              ...(visitor ? { userText: visitor.text.slice(0, LIMITS.visitorText), target: visitor.target } : {}),
            },
            {
              onStart: (start) => dispatch({ type: "draftStart", start }),
              onText: (text) => dispatch({ type: "draftText", text }),
            },
          );
          dispatch({ type: "appendTurns", id: debate.id, turns: res.turns });
          await maybeSummarize({ ...debate, turns: [...debate.turns, ...res.turns] });
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
