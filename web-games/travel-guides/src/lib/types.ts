export type Side = "local" | "tourist";
export type Target = Side | "both";
export type Pace = "Relaxed" | "Balanced" | "Packed";
export type Lean = "split" | "local" | "tourist";

export interface Personality {
  trait: string;
  how: string;
}

export interface Guide {
  name: string;
  initials: string;
  role: string;
  stance: string;
  brief: string;
  personality: Personality;
}

export interface Stop {
  name: string;
  when?: string;
  note?: string;
}

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "divider"; text: string }
  | { id: string; role: "guide"; side: Side; text: string; stops: Stop[]; tip?: string }
  | { id: string; role: "ground"; text: string }
  | { id: string; role: "error"; text: string };

export interface TripStop {
  time: string;
  name: string;
  note?: string;
  from?: Side;
}

export interface TripDay {
  label: string;
  stops: TripStop[];
}

export interface Trip {
  title: string;
  days: TripDay[];
}

export interface Destination {
  id: string;
  city: string;
  tagline: string;
  pal: number;
  prompts: string[];
  guides: Record<Side, Guide>;
  messages: Message[];
  trip: Trip | null;
}

export interface TripOptions {
  days: number;
  pace: Pace;
  lean: Lean;
  interests: string[];
}

/* Shapes returned by the API routes (section 7). The model output is cleaned into these. */

export interface GuideDraft {
  name: string;
  role: string;
  brief: string;
  personality: Personality;
}

export interface DestinationDraft {
  city: string;
  tagline: string;
  prompts: string[];
  local: GuideDraft;
  tourist: GuideDraft;
}

export interface TurnDraft {
  speaker: Side;
  text: string;
  stops: Stop[];
}

export type ChatReply =
  | { kind: "single"; reply: string; stops: Stop[]; tip: string }
  | { kind: "debate"; turns: TurnDraft[]; common_ground: string };

export type ErrorCode =
  | "not_a_place"
  | "bad_output"
  | "rate_limited"
  | "upstream_error"
  | "invalid_input"
  | "ai_disabled";

export interface ApiFailure {
  ok: false;
  code: ErrorCode;
  message: string;
}

export type ApiResponse<T> = ({ ok: true } & T) | ApiFailure;

/** What the client sends about a destination. The server builds prompts from it. */
export interface DestinationRef {
  city: string;
  guides: Record<Side, Guide>;
}
