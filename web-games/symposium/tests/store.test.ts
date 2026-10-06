import { describe, expect, it } from "vitest";
import { initialState, reducer, type AppState } from "@/state/store";
import { debateSchema } from "@/lib/schemas";
import { nextPhilosopherTurn, visitorTurns } from "@/lib/mockEngine";
import type { Debate } from "@/lib/types";

const debate: Debate = {
  id: "d1",
  topic: "Is it ever right to lie?",
  philosophers: { A: "socrates", B: "kant" },
  stances: { A: null, B: null },
  turns: [],
  rollingSummary: "",
  ledger: null,
};

let seq = 0;
const newId = () => `id${seq++}`;

const withDebate = (): AppState =>
  reducer(initialState, { type: "create", debate });

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

    const turn = nextPhilosopherTurn(s.debates.d1, newId);
    s = reducer(s, { type: "appendTurns", id: "d1", turns: [turn] });
    s = reducer(s, { type: "setPair", id: "d1", pair: { A: "socrates", B: "kant" } });
    expect(s.debates.d1.philosophers).toEqual({ A: "mill", B: "hobbes" });
  });

  it("sets each stance from the opening turn", () => {
    let s = withDebate();
    const opening = nextPhilosopherTurn(s.debates.d1, newId);
    expect(opening.speaker).toBe("A");
    s = reducer(s, { type: "appendTurns", id: "d1", turns: [opening] });
    expect(s.debates.d1.stances.A).toBeTruthy();
    expect(s.debates.d1.stances.B).toBeNull();
  });

  it("adds a visitor message and the addressed answer", () => {
    let s = withDebate();
    const turn = nextPhilosopherTurn(s.debates.d1, newId);
    s = reducer(s, { type: "appendTurns", id: "d1", turns: [turn] });
    const turns = visitorTurns(s.debates.d1, "But what about the friend at the door?", "B", newId);
    s = reducer(s, { type: "appendTurns", id: "d1", turns });
    const last = s.debates.d1.turns.at(-1);
    expect(last?.speaker).toBe("B");
    expect(last && "target" in last && last.target).toBe("user");
  });

  it("leaves the current debate when a new one starts", () => {
    let s = withDebate();
    s = reducer(s, { type: "autoplay", on: true });
    s = reducer(s, { type: "newDebate" });
    expect(s.currentId).toBeNull();
    expect(s.autoplay).toBe(false);
    expect(s.debates.d1).toBeDefined();
  });
});

describe("saved debate schema", () => {
  it("accepts a debate built by the engine", () => {
    const turn = nextPhilosopherTurn(debate, newId);
    const built = { ...debate, turns: [turn] };
    expect(debateSchema.safeParse(built).success).toBe(true);
  });

  it("rejects a debate with an unknown move", () => {
    const bad = { ...debate, turns: [{ id: "x", speaker: "A", move: "shout", target: "B", text: "hi" }] };
    expect(debateSchema.safeParse(bad).success).toBe(false);
  });
});
