/**
 * The only place the UI talks to the API routes. Requests go to /api/* with fetch.
 * NEXT_PUBLIC_MOCK_AI=1 answers from mocks.ts instead, with no network call.
 * The flag is read at build time, so the mock module is left out of live bundles.
 */
import { cleanChat, cleanDestination, cleanReroll, cleanTrip } from "./clean";
import { ApiError } from "./errors";
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

const USE_MOCKS = process.env.NEXT_PUBLIC_MOCK_AI === "1";

/** Slightly longer than the server's 40 second model timeout, so the server's error arrives first. */
const CLIENT_TIMEOUT_MS = 45_000;

async function transport(path: string, body: unknown): Promise<unknown> {
  if (USE_MOCKS) {
    const { mockRoute } = await import("./mocks");
    return mockRoute(path, body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    try {
      return await res.json();
    } catch {
      // A non-JSON body means a framework error page or a proxy failure.
      throw new ApiError("upstream_error", `HTTP ${res.status} without a JSON body`);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("upstream_error", e instanceof Error && e.name === "AbortError" ? "timeout" : "network error");
  } finally {
    clearTimeout(timer);
  }
}

async function call<T extends object>(path: string, body: unknown): Promise<{ ok: true } & T> {
  const res = (await transport(path, body)) as ApiResponse<T> | null;
  if (!res || typeof res !== "object") throw new ApiError("upstream_error", "empty response");
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
