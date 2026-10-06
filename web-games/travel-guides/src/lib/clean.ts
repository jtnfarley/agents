import { DEFAULT_PROMPTS, LIMITS, STANCE } from "./constants";
import { fit, str } from "./text";
import type {
  ChatReply,
  DestinationDraft,
  Guide,
  GuideDraft,
  Personality,
  Side,
  Stop,
  Trip,
  TripStop,
  TurnDraft,
} from "./types";

type Loose = Record<string, unknown>;

const obj = (v: unknown): Loose => (v && typeof v === "object" ? (v as Loose) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Cleans a personality. The trait is "" when the model gave none, so callers can decide. */
export function cleanPersonality(raw: unknown): Personality {
  const p = obj(raw);
  return { trait: str(p.trait, LIMITS.trait), how: fit(p.how, LIMITS.how) };
}

export function cleanGuide(raw: unknown, side: Side): GuideDraft {
  const g = obj(raw);
  const fallbackName = side === "local" ? "Local guide" : "Must-see guide";
  const personality = cleanPersonality(g.personality);
  return {
    name: str(g.name, LIMITS.guideName) || fallbackName,
    role: str(g.role, LIMITS.role) || "Guide",
    brief: fit(g.brief, LIMITS.brief) || "You know this place well.",
    personality: { trait: personality.trait || "Friendly", how: personality.how },
  };
}

/** Returns null when the model did not give both guides. */
export function cleanDestination(raw: unknown, input: string): DestinationDraft | null {
  const d = obj(raw);
  if (!d.local || !d.tourist) return null;
  const prompts = list(d.prompts)
    .map((p) => str(p, LIMITS.prompt))
    .filter(Boolean)
    .slice(0, 3);
  return {
    city: str(d.city, LIMITS.city) || input,
    tagline: str(d.tagline, LIMITS.tagline),
    prompts: prompts.length ? prompts : DEFAULT_PROMPTS,
    local: cleanGuide(d.local, "local"),
    tourist: cleanGuide(d.tourist, "tourist"),
  };
}

/** Returns null when either trait is missing. */
export function cleanReroll(raw: unknown): { local: Personality; tourist: Personality } | null {
  const r = obj(raw);
  const local = cleanPersonality(r.local);
  const tourist = cleanPersonality(r.tourist);
  if (!local.trait || !tourist.trait) return null;
  return { local, tourist };
}

export function cleanStops(raw: unknown, max: number): Stop[] {
  return list(raw)
    .map(obj)
    .map((s) => ({
      name: str(s.name, LIMITS.stopName),
      when: fit(s.when, LIMITS.stopWhen),
      note: str(s.note, LIMITS.stopNote),
    }))
    .filter((s) => s.name)
    .slice(0, max);
}

export function cleanChat(raw: Loose): ChatReply {
  if (raw.kind === "debate") {
    const turns: TurnDraft[] = list(raw.turns)
      .slice(0, 6)
      .map((t) => {
        const o = obj(t);
        return {
          speaker: o.speaker === "tourist" ? "tourist" : "local",
          text: str(o.text, LIMITS.chatText) || "...",
          stops: cleanStops(o.stops, 3),
        };
      });
    return { kind: "debate", turns, common_ground: str(raw.common_ground, LIMITS.commonGround) };
  }
  return {
    kind: "single",
    reply: str(raw.reply, LIMITS.chatText) || "...",
    stops: cleanStops(raw.stops, 5),
    tip: str(raw.tip, LIMITS.tip),
  };
}

/** Returns null when there are no days, which counts as bad output. */
export function cleanTrip(raw: unknown): Trip | null {
  const t = obj(raw);
  const days = list(t.days).map((d, i) => {
    const o = obj(d);
    const stops: TripStop[] = list(o.stops)
      .map(obj)
      .map((s) => ({
        time: str(s.time, LIMITS.tripTime),
        name: str(s.name, LIMITS.stopName),
        note: str(s.note, LIMITS.stopNote),
        from: s.from === "tourist" ? ("tourist" as const) : s.from === "local" ? ("local" as const) : undefined,
      }))
      .filter((s) => s.name);
    return { label: str(o.label, LIMITS.dayLabel) || `Day ${i + 1}`, stops };
  });
  if (!days.length) return null;
  return { title: str(t.title, LIMITS.tripTitle) || "Your itinerary", days };
}

/** Adds the stance and monogram the UI shows. */
export function toGuide(draft: GuideDraft, side: Side): Guide {
  return {
    ...draft,
    initials: draft.name.charAt(0).toUpperCase(),
    stance: STANCE[side],
  };
}
