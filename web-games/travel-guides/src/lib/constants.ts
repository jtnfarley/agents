import type { Lean, Pace, Side } from "./types";

export const STANCE: Record<Side, string> = {
  local: "Argues for local spots",
  tourist: "Argues for the big sights",
};

export const PACES: Pace[] = ["Relaxed", "Balanced", "Packed"];

export const LEANS: { value: Lean; label: string }[] = [
  { value: "split", label: "Half and half" },
  { value: "local", label: "Mostly local" },
  { value: "tourist", label: "Mostly must-see" },
];

export const INTERESTS = ["Food", "Neighborhoods", "Museums", "Offbeat", "Shopping", "Parks"];

export const DEFAULT_INTERESTS = ["Food"];

export const SUGGESTIONS = ["Lisbon", "Mexico City", "Marrakech", "Kyoto", "Cape Town"];

export const DEFAULT_PROMPTS = [
  "What should I do on my first day?",
  "Where should I eat on night one?",
  "Is the most famous sight worth the line?",
];

/** Field limits from section 8. Applied at the API boundary and in the store. */
export const LIMITS = {
  city: 40,
  tagline: 60,
  guideName: 40,
  role: 80,
  trait: 30,
  prompt: 70,
  brief: 500,
  how: 320,
  question: 500,
  chatText: 900,
  tip: 200,
  commonGround: 500,
  stopName: 80,
  stopWhen: 20,
  stopNote: 200,
  tripTitle: 80,
  dayLabel: 30,
  tripTime: 10,
  place: 60,
} as const;

export const sideName = (side: Side) => (side === "tourist" ? "Must-see" : "Local");
