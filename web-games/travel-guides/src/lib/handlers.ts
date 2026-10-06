/** Business logic for the four routes. Routes stay thin: parse, call, respond. */
import type { z } from "zod";
import { cleanChat, cleanDestination, cleanGuide, cleanReroll, cleanTrip } from "./clean";
import { LIMITS, STANCE } from "./constants";
import { LlmError, callJson } from "./llm";
import {
  askPrompt,
  debatePrompt,
  destinationPrompt,
  pickTemps,
  rerollPrompt,
  tripPrompt,
  type GuideFacts,
} from "./prompts";
import { chatSingleOutput, debateOutput, destinationOutput, historyItem, rerollOutput, tripOutput } from "./schemas";
import { str } from "./text";
import type { DestinationDraft, Message, Side, Trip, TripOptions } from "./types";

export type HistoryInput = z.infer<typeof historyItem>[];

export interface GuideInput {
  name: string;
  role: string;
  brief: string;
  personality: { trait: string; how: string };
}

/**
 * Turns the client's history into messages for the prompt builder.
 * Dividers and errors are dropped, as the prototype's transcript did.
 */
export function normalizeHistory(history: HistoryInput): Message[] {
  const out: Message[] = [];
  for (const h of history) {
    const text = str(h.text, LIMITS.chatText);
    if (h.role === "user") out.push({ id: "", role: "user", text });
    else if (h.role === "guide") {
      out.push({
        id: "",
        role: "guide",
        side: h.side ?? "local",
        text,
        stops: (h.stops ?? []).map((s) => ({
          name: str(s.name, LIMITS.stopName),
          when: str(s.when, LIMITS.stopWhen),
          note: str(s.note, LIMITS.stopNote),
        })),
        tip: str(h.tip, LIMITS.tip),
      });
    } else if (h.role === "ground") out.push({ id: "", role: "ground", text });
  }
  return out;
}

/** Cleans both guides and attaches the stance each side argues for. */
function factsFor(guides: Record<Side, GuideInput>): Record<Side, GuideFacts> {
  const make = (g: GuideInput, side: Side): GuideFacts => {
    const c = cleanGuide(g, side);
    return { ...c, stance: STANCE[side] };
  };
  return { local: make(guides.local, "local"), tourist: make(guides.tourist, "tourist") };
}

export async function runDestination(place: string): Promise<{ destination: DestinationDraft }> {
  const input = str(place, LIMITS.place);
  if (!input) throw new LlmError("invalid_input");
  const out = await callJson({
    task: "destination",
    prompt: destinationPrompt(input, pickTemps([])),
    schema: destinationOutput,
  });
  if ("error" in out) throw new LlmError("not_a_place");
  const draft = cleanDestination(out, input);
  if (!draft) throw new LlmError("bad_output");
  return { destination: draft };
}

export interface RerollInput {
  city: string;
  local: { name: string; role: string; trait: string };
  tourist: { name: string; role: string; trait: string };
}

export async function runReroll(req: RerollInput) {
  const city = str(req.city, LIMITS.city);
  const local = {
    name: str(req.local.name, LIMITS.guideName),
    role: str(req.local.role, LIMITS.role),
    trait: str(req.local.trait, LIMITS.trait),
  };
  const tourist = {
    name: str(req.tourist.name, LIMITS.guideName),
    role: str(req.tourist.role, LIMITS.role),
    trait: str(req.tourist.trait, LIMITS.trait),
  };
  const temps = pickTemps([local.trait, tourist.trait]);
  const out = await callJson({
    task: "reroll",
    prompt: rerollPrompt(city, local, tourist, temps),
    schema: rerollOutput,
  });
  const picks = cleanReroll(out);
  if (!picks) throw new LlmError("bad_output");
  return picks;
}

export interface ChatInput {
  destination: { city: string; guides: { local: GuideInput; tourist: GuideInput } };
  target: "local" | "tourist" | "both";
  text: string;
  history: HistoryInput;
}

export async function runChat(input: ChatInput) {
  const city = str(input.destination.city, LIMITS.city);
  const guides = factsFor(input.destination.guides);
  const text = str(input.text, LIMITS.question);
  const history = normalizeHistory(input.history);

  if (input.target === "both") {
    const out = await callJson({
      task: "debate",
      prompt: debatePrompt(city, guides, text, history),
      schema: debateOutput,
    });
    return cleanChat({ kind: "debate", turns: out.turns, common_ground: out.common_ground ?? "" });
  }

  const side: Side = input.target;
  const out = await callJson({
    task: "chat",
    side,
    prompt: askPrompt(city, guides, side, text, history),
    schema: chatSingleOutput,
  });
  return cleanChat({ kind: "single", reply: out.reply, stops: out.stops ?? [], tip: out.tip ?? "" });
}

export interface TripInput {
  destination: { city: string; guides: { local: GuideInput; tourist: GuideInput } };
  options: TripOptions;
  history: HistoryInput;
  currentTrip?: Trip;
  change?: string;
}

export async function runTrip(input: TripInput) {
  const city = str(input.destination.city, LIMITS.city);
  const guides = factsFor(input.destination.guides);
  const history = normalizeHistory(input.history);
  const change = str(input.change ?? "", LIMITS.changeRequest);
  const out = await callJson({
    task: "trip",
    prompt: tripPrompt(city, guides, input.options, history, input.currentTrip ?? null, change),
    schema: tripOutput,
  });
  const trip = cleanTrip(out);
  if (!trip) throw new LlmError("bad_output");
  return { trip };
}
