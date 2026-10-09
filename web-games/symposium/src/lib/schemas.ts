/**
 * Zod schemas. Three uses: the saved debate in localStorage, the request bodies the routes
 * accept, and the JSON the models must return. Anything from outside the server is validated here.
 */
import { z } from "zod";
import { LIMITS } from "./constants";
import { ROSTER } from "./roster";
import type { Debate, Turn } from "./types";

const ROSTER_IDS = new Set(ROSTER.map((p) => p.id));
const philosopherId = z.string().refine((id) => ROSTER_IDS.has(id), "unknown philosopher");
const speakerId = z.enum(["A", "B"]);
const moveSchema = z.enum(["open", "argue", "rebut", "question", "concede", "reframe", "answer"]);
const MAX_TURNS = 300;

export const pairSchema = z.object({ A: philosopherId, B: philosopherId });

const turnSchema: z.ZodType<Turn> = z.discriminatedUnion("speaker", [
  z.object({
    id: z.string(),
    speaker: speakerId,
    move: moveSchema,
    target: z.enum(["A", "B", "user"]),
    text: z.string().max(LIMITS.turnText),
    stance: z.string().max(240).optional(),
  }),
  z.object({
    id: z.string(),
    speaker: z.literal("user"),
    target: z.enum(["A", "B", "both"]),
    text: z.string().max(LIMITS.visitorText),
  }),
  z.object({
    id: z.string(),
    speaker: z.literal("error"),
    text: z.string().max(LIMITS.turnText),
  }),
]);

const ledgerSchema = z.object({
  agree: z.array(z.string()).max(4),
  split: z.array(z.string()).max(4),
  openQuestions: z.array(z.string()).max(3),
  updatedAfterTurn: z.number().int().nonnegative(),
});

export const debateSchema: z.ZodType<Debate> = z.object({
  id: z.string().min(1).max(64),
  topic: z.string().min(1).max(LIMITS.topic),
  philosophers: z.object({ A: philosopherId, B: philosopherId }),
  stances: z.object({ A: z.string().nullable(), B: z.string().nullable() }),
  turns: z.array(turnSchema).max(MAX_TURNS),
  rollingSummary: z.string().max(1200),
  ledger: ledgerSchema.nullable(),
});

export const savedStateSchema = z.object({
  debates: z.record(z.string(), debateSchema),
  order: z.array(z.string()),
  currentId: z.string().nullable(),
});

// ---- Request bodies -------------------------------------------------------

const topicField = z.string().trim().min(1).max(LIMITS.topic);

export const startRequest = z.object({
  topic: topicField,
  previousPair: pairSchema.optional(),
});

export const reshuffleRequest = z.object({
  topic: topicField,
  currentPair: pairSchema,
  /** The client sends the count so the server can enforce "locked after the first turn". */
  turnCount: z.number().int().nonnegative(),
});

export const turnRequest = z
  .object({
    debate: debateSchema,
    userText: z.string().trim().min(1).max(LIMITS.visitorText).optional(),
    target: z.enum(["A", "B", "both"]).optional(),
  })
  .refine((b) => (b.userText === undefined) === (b.target === undefined), {
    message: "userText and target go together",
  });

export const summarizeRequest = z.object({ debate: debateSchema });

// ---- Model outputs ----------------------------------------------------------
// Models overshoot length limits often. An over-long answer is clipped, not rejected, so one
// wordy reply doesn't cost a turn. Clipped text still satisfies the stored limits above.

/** Cuts text to the limit at the last sentence end before it, or at the limit if there is none. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (end > max / 2 ? cut.slice(0, end + 1) : cut).trim();
}

const clipped = (max: number) => z.string().trim().transform((s) => clip(s, max));

export const turnOutput = z.object({
  text: clipped(LIMITS.turnText).pipe(z.string().min(1)),
  stance: clipped(240).optional(),
});

const items = (max: number, count: number) => z.array(clipped(max)).transform((a) => a.slice(0, count));

export const summaryOutput = z.object({
  rollingSummary: clipped(1200),
  ledger: z.object({
    agree: items(240, 4),
    split: items(240, 4),
    openQuestions: items(240, 3),
  }),
});

export const topicOutput = z.object({
  allowed: z.boolean(),
  topic: clipped(LIMITS.topic),
});

export const suggestOutput = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(8),
});
