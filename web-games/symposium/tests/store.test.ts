import { describe, expect, it } from "vitest";
import { initialState, reducer, type AppState } from "@/state/store";
import { debateSchema } from "@/lib/schemas";
import type { Debate, Turn } from "@/lib/types";

const debate: Debate = {
  id: "d1",
  topic: "Is it ever right to lie?",
  philosophers: { A: "socrates", B: "kant" },
  stances: { A: null, B: null },
  turns: [],
  rollingSummary: "",
  ledger: null,
};

const opening: Turn = {
  id: "t1",
  speaker: "A",
  move: "open",
  target: "B",
  text: "I begin from a commitment.",
  stance: "Virtue is a kind of knowledge.",
};
const reply: Turn = { id: "t2", speaker: "B", move: "rebut", target: "A", text: "That step fails." };

const withDebate = (): AppState => reducer(initialState, { type: "create", debate });

describe("store reducer", () => {
  it("creates a debate and makes it current", () => {
    const s = withDebate();
    expect(s.currentId).toBe("d1");
    expect(s.order).toEqual(["d1"]);
  });

  it("locks the pair once the first turn lands", () => {
    let s = withDebate();
    s = reducer(s, { type: "setPair", id: "d1", pair: { A: "mill", B: "hobbes" } });
    expect(s.debates.d1.philosophers).toEqual({ A: "mill", B: "hobbes" });

    s = reducer(s, { type: "appendTurns", id: "d1", turns: [opening] });
    s = reducer(s, { type: "setPair", id: "d1", pair: { A: "socrates", B: "kant" } });
    expect(s.debates.d1.philosophers).toEqual({ A: "mill", B: "hobbes" });
  });

  it("sets the stance from the opening turn", () => {
    const s = reducer(withDebate(), { type: "appendTurns", id: "d1", turns: [opening] });
    expect(s.debates.d1.stances).toEqual({ A: "Virtue is a kind of knowledge.", B: null });
  });

  it("appends a visitor message and the addressed answer in order", () => {
    let s = reducer(withDebate(), { type: "appendTurns", id: "d1", turns: [opening] });
    const visitor: Turn = { id: "u1", speaker: "user", target: "B", text: "What about the friend at the door?" };
    const answer: Turn = { id: "t3", speaker: "B", move: "answer", target: "user", text: "Still no." };
    s = reducer(s, { type: "appendTurns", id: "d1", turns: [visitor, answer] });
    expect(s.debates.d1.turns.map((t) => t.id)).toEqual(["t1", "u1", "t3"]);
  });

  it("leaves the current debate when a new one starts", () => {
    let s = withDebate();
    s = reducer(s, { type: "autoplay", on: true });
    s = reducer(s, { type: "newDebate" });
    expect(s.currentId).toBeNull();
    expect(s.autoplay).toBe(false);
    expect(s.debates.d1).toBeDefined();
  });

  it("stores the summary with its ledger", () => {
    let s = reducer(withDebate(), { type: "appendTurns", id: "d1", turns: [opening, reply] });
    s = reducer(s, {
      type: "setSummary",
      id: "d1",
      rollingSummary: "They disagree.",
      ledger: { agree: [], split: ["Lying"], openQuestions: [], updatedAfterTurn: 2 },
    });
    expect(s.debates.d1.ledger?.split).toEqual(["Lying"]);
  });
});

describe("saved debate schema", () => {
  it("accepts a debate with turns", () => {
    expect(debateSchema.safeParse({ ...debate, turns: [opening, reply] }).success).toBe(true);
  });

  it("rejects a debate with an unknown move", () => {
    const bad = { ...debate, turns: [{ ...reply, move: "shout" }] };
    expect(debateSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a philosopher id that is not on the roster", () => {
    const bad = { ...debate, philosophers: { A: "socrates", B: "nobody" } };
    expect(debateSchema.safeParse(bad).success).toBe(false);
  });
});
