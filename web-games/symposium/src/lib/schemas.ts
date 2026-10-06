/** Zod schemas for the debate state. Used to validate what localStorage gives back. */
import { z } from "zod";
import type { Debate, Turn } from "./types";

const speakerId = z.enum(["A", "B"]);

const moveSchema = z.enum(["open", "argue", "rebut", "question", "concede", "reframe", "answer"]);

const turnSchema: z.ZodType<Turn> = z.discriminatedUnion("speaker", [
  z.object({
    id: z.string(),
    speaker: speakerId,
    move: moveSchema,
    target: z.enum(["A", "B", "user"]),
    text: z.string(),
    stance: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    speaker: z.literal("user"),
    target: z.enum(["A", "B", "both"]),
    text: z.string(),
  }),
  z.object({
    id: z.string(),
    speaker: z.literal("error"),
    text: z.string(),
  }),
]);

const ledgerSchema = z.object({
  agree: z.array(z.string()).max(4),
  split: z.array(z.string()).max(4),
  openQuestions: z.array(z.string()).max(3),
  updatedAfterTurn: z.number().int().nonnegative(),
});

export const debateSchema: z.ZodType<Debate> = z.object({
  id: z.string(),
  topic: z.string().max(140),
  philosophers: z.object({ A: z.string(), B: z.string() }),
  stances: z.object({ A: z.string().nullable(), B: z.string().nullable() }),
  turns: z.array(turnSchema),
  rollingSummary: z.string(),
  ledger: ledgerSchema.nullable(),
});

export const savedStateSchema = z.object({
  debates: z.record(z.string(), debateSchema),
  order: z.array(z.string()),
  currentId: z.string().nullable(),
});
