/**
 * The only place the UI talks to the API routes. Phase 1 answers from mocks.ts.
 * Phase 3 replaces the transport with fetch and keeps these signatures.
 */
import { ApiError } from "./errors";
import { mockRoute } from "./mocks";
import { cleanChat, cleanDestination, cleanReroll, cleanTrip } from "./clean";
import type {
  ApiResponse,
  ChatReply,
  DestinationDraft,
  DestinationRef,
  Message,
  Personality,
  Target,
  Trip,
  TripOptions,
} from "./types";

async function call<T extends object>(path: string, body: unknown): Promise<{ ok: true } & T> {
  const res = (await mockRoute(path, body)) as ApiResponse<T>;
  if (!res.ok) throw new ApiError(res.code, res.message);
  return res;
}

export interface ChatRequest {
  destination: DestinationRef;
  target: Target;
  text: string;
  history: Message[];
}

export interface TripRequest {
  destination: DestinationRef;
  options: TripOptions;
  history: Message[];
  currentTrip?: Trip;
  change?: string;
}

export const apiClient = {
  async destination(place: string): Promise<DestinationDraft> {
    const res = await call<{ destination: unknown }>("/api/destination", { place });
    const draft = cleanDestination(res.destination, place);
    if (!draft) throw new ApiError("bad_output", "Destination missing guides");
    return draft;
  },

  async reroll(req: {
    city: string;
    local: { name: string; role: string; trait: string };
    tourist: { name: string; role: string; trait: string };
  }): Promise<{ local: Personality; tourist: Personality }> {
    const res = await call<{ local: unknown; tourist: unknown }>("/api/reroll", req);
    const picks = cleanReroll(res);
    if (!picks) throw new ApiError("bad_output", "Reroll missing traits");
    return picks;
  },

  async chat(req: ChatRequest): Promise<ChatReply> {
    const res = await call<Record<string, unknown>>("/api/chat", req);
    return cleanChat(res);
  },

  async trip(req: TripRequest): Promise<Trip> {
    const res = await call<{ trip: unknown }>("/api/trip", req);
    const trip = cleanTrip(res.trip);
    if (!trip) throw new ApiError("bad_output", "Trip had no days");
    return trip;
  },
};
