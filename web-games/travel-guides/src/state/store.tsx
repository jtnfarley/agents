"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/apiClient";
import { toGuide } from "@/lib/clean";
import { DEFAULT_INTERESTS, LIMITS } from "@/lib/constants";
import { errorCodeOf, errorText, type ErrorContext } from "@/lib/errors";
import { palIndex } from "@/lib/palette";
import { slug } from "@/lib/text";
import { historyOf } from "@/lib/transcript";
import type {
  Destination,
  DestinationDraft,
  DestinationRef,
  Message,
  Personality,
  Side,
  Target,
  Trip,
  TripOptions,
} from "@/lib/types";

export type AreaKey = "place" | "guides" | "trip";

export interface Busy {
  kind: "dest" | "chat" | "trip" | "reroll";
  destId: string;
  label: string;
}

export interface AppState {
  currentId: string | null;
  order: string[];
  destinations: Record<string, Destination>;
  target: Target;
  interests: string[];
  busy: Busy | null;
  messages: Record<AreaKey, string>;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A message before the store gives it an id. */
type NewMessage = DistributiveOmit<Message, "id">;

type Action =
  | { type: "select"; id: string }
  | { type: "setTarget"; target: Target }
  | { type: "toggleInterest"; name: string }
  | { type: "busyStart"; busy: Busy }
  | { type: "busyEnd" }
  | { type: "setMessage"; area: AreaKey; text: string }
  | { type: "addDestination"; dest: Destination }
  | { type: "appendMessages"; destId: string; messages: NewMessage[] }
  | { type: "setPersonalities"; destId: string; local: Personality; tourist: Personality }
  | { type: "setTrip"; destId: string; trip: Trip };

export const initialState: AppState = {
  currentId: null,
  order: [],
  destinations: {},
  target: "both",
  interests: [...DEFAULT_INTERESTS],
  busy: null,
  messages: { place: "", guides: "", trip: "" },
};

const withId = (m: NewMessage): Message => ({ ...m, id: crypto.randomUUID() }) as Message;

function updateDest(state: AppState, id: string, fn: (d: Destination) => Destination): AppState {
  const dest = state.destinations[id];
  if (!dest) return state;
  return { ...state, destinations: { ...state.destinations, [id]: fn(dest) } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "select":
      return {
        ...state,
        currentId: action.id,
        messages: { ...state.messages, guides: "", trip: "" },
      };
    case "setTarget":
      return { ...state, target: action.target };
    case "toggleInterest":
      return {
        ...state,
        interests: state.interests.includes(action.name)
          ? state.interests.filter((n) => n !== action.name)
          : [...state.interests, action.name],
      };
    case "busyStart":
      return { ...state, busy: action.busy };
    case "busyEnd":
      return { ...state, busy: null };
    case "setMessage":
      return { ...state, messages: { ...state.messages, [action.area]: action.text } };
    case "addDestination": {
      const id = action.dest.id;
      return {
        ...state,
        currentId: id,
        order: [...state.order, id],
        destinations: { ...state.destinations, [id]: action.dest },
        messages: { place: "", guides: "", trip: "" },
      };
    }
    case "appendMessages":
      return updateDest(state, action.destId, (d) => ({
        ...d,
        messages: [...d.messages, ...action.messages.map(withId)],
      }));
    case "setPersonalities":
      return updateDest(state, action.destId, (d) => ({
        ...d,
        guides: {
          local: { ...d.guides.local, personality: action.local },
          tourist: { ...d.guides.tourist, personality: action.tourist },
        },
      }));
    case "setTrip":
      return updateDest(state, action.destId, (d) => ({ ...d, trip: action.trip }));
  }
}

export function buildDestination(id: string, draft: DestinationDraft): Destination {
  return {
    id,
    city: draft.city,
    tagline: draft.tagline,
    pal: palIndex(id),
    prompts: draft.prompts,
    guides: { local: toGuide(draft.local, "local"), tourist: toGuide(draft.tourist, "tourist") },
    messages: [],
    trip: null,
  };
}

export function currentDestination(state: AppState): Destination | null {
  return state.currentId ? (state.destinations[state.currentId] ?? null) : null;
}

const refOf = (d: Destination): DestinationRef => ({ city: d.city, guides: d.guides });

export interface Actions {
  selectDestination(id: string): void;
  setTarget(target: Target): void;
  toggleInterest(name: string): void;
  /** Resolves true when the place is now the current destination, so the entry can clear. */
  addDestination(input: string): Promise<boolean>;
  reroll(): Promise<void>;
  sendChat(text: string): Promise<void>;
  draftTrip(options: TripOptions, change?: string): Promise<void>;
}

interface Deps {
  getState: () => AppState;
  dispatch: (a: Action) => void;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
}

/** Every async action runs through here. Only one request is in flight at a time. */
function createActions({ getState, dispatch, isBusy, setBusy }: Deps): Actions {
  const begin = (busy: Busy) => {
    if (isBusy()) return false;
    setBusy(true);
    dispatch({ type: "busyStart", busy });
    return true;
  };
  const end = () => {
    setBusy(false);
    dispatch({ type: "busyEnd" });
  };
  const failArea = (area: AreaKey, e: unknown, context: ErrorContext) =>
    dispatch({ type: "setMessage", area, text: errorText(errorCodeOf(e), context) });

  return {
    selectDestination(id) {
      dispatch({ type: "select", id });
    },

    setTarget(target) {
      dispatch({ type: "setTarget", target });
    },

    toggleInterest(name) {
      dispatch({ type: "toggleInterest", name });
    },

    async addDestination(raw) {
      const text = raw.trim().slice(0, LIMITS.place);
      const key = slug(text);
      if (!text || !key || isBusy()) return false;

      if (getState().destinations[key]) {
        dispatch({ type: "select", id: key });
        return true;
      }
      if (!begin({ kind: "dest", destId: key, label: `Finding guides in ${text}...` })) return false;
      dispatch({ type: "setMessage", area: "place", text: "" });
      try {
        const draft = await apiClient.destination(text);
        dispatch({ type: "addDestination", dest: buildDestination(key, draft) });
        return true;
      } catch (e) {
        failArea("place", e, "dest");
        return false;
      } finally {
        end();
      }
    },

    async reroll() {
      const dest = currentDestination(getState());
      if (!dest || !begin({ kind: "reroll", destId: dest.id, label: "Rerolling..." })) return;
      dispatch({ type: "setMessage", area: "guides", text: "" });
      const { local, tourist } = dest.guides;
      try {
        const picks = await apiClient.reroll({
          city: dest.city,
          local: { name: local.name, role: local.role, trait: local.personality.trait },
          tourist: { name: tourist.name, role: tourist.role, trait: tourist.personality.trait },
        });
        dispatch({ type: "setPersonalities", destId: dest.id, local: picks.local, tourist: picks.tourist });
      } catch (e) {
        failArea("guides", e, "reroll");
      } finally {
        end();
      }
    },

    async sendChat(raw) {
      const text = raw.trim().slice(0, LIMITS.question);
      const s = getState();
      const dest = currentDestination(s);
      if (!text || !dest) return;
      const target = s.target;
      const { guides } = dest;
      const label =
        target === "both"
          ? `${guides.local.name} and ${guides.tourist.name} are arguing...`
          : `${guides[target].name} is thinking...`;
      const request = { destination: refOf(dest), target, text, history: historyOf(dest) };
      if (!begin({ kind: "chat", destId: dest.id, label })) return;
      dispatch({ type: "appendMessages", destId: dest.id, messages: [{ role: "user", text }] });
      try {
        const reply = await apiClient.chat(request);
        if (reply.kind === "debate") {
          const out: NewMessage[] = [
            { role: "divider", text: `${guides.local.name} and ${guides.tourist.name} argue it out` },
            ...reply.turns.map((t) => ({ role: "guide" as const, side: t.speaker, text: t.text, stops: t.stops })),
          ];
          if (reply.common_ground) out.push({ role: "ground", text: reply.common_ground });
          dispatch({ type: "appendMessages", destId: dest.id, messages: out });
        } else {
          const side: Side = target === "tourist" ? "tourist" : "local";
          dispatch({
            type: "appendMessages",
            destId: dest.id,
            messages: [{ role: "guide", side, text: reply.reply, stops: reply.stops, tip: reply.tip }],
          });
        }
      } catch (e) {
        dispatch({
          type: "appendMessages",
          destId: dest.id,
          messages: [{ role: "error", text: errorText(errorCodeOf(e), "other") }],
        });
      } finally {
        end();
      }
    },

    async draftTrip(options, change) {
      const dest = currentDestination(getState());
      if (!dest) return;
      const label = `${dest.guides.local.name} and ${dest.guides.tourist.name} are drafting...`;
      if (!begin({ kind: "trip", destId: dest.id, label })) return;
      dispatch({ type: "setMessage", area: "trip", text: "" });
      try {
        const trip = await apiClient.trip({
          destination: refOf(dest),
          options,
          history: historyOf(dest),
          currentTrip: change && dest.trip ? dest.trip : undefined,
          change: change || undefined,
        });
        dispatch({ type: "setTrip", destId: dest.id, trip });
      } catch (e) {
        failArea("trip", e, "other");
      } finally {
        end();
      }
    },
  };
}

interface StoreValue {
  state: AppState;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * One session per provider. It holds the latest state for actions that run after an await,
 * and the single-request guard. Plain closure state, so it does not need refs.
 */
function createSession(dispatch: (a: Action) => void) {
  let latest = initialState;
  let busy = false;
  const actions = createActions({
    getState: () => latest,
    dispatch,
    isBusy: () => busy,
    setBusy: (value) => {
      busy = value;
    },
  });
  return {
    actions,
    sync(next: AppState) {
      latest = next;
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [session] = useState(() => createSession(dispatch));

  useEffect(() => {
    session.sync(state);
  }, [state, session]);

  const value = useMemo(() => ({ state, actions: session.actions }), [state, session]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
