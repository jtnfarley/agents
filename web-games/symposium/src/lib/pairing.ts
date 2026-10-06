/**
 * Draws the two seats for a debate (plan section 2, open item 4).
 * Uniform over distinct pairs, excluding the pair from the previous debate or reshuffle,
 * with the seats (A or B) assigned at random.
 */
import type { Philosopher, SpeakerId } from "./types";

export type Pair = Record<SpeakerId, string>;

export function drawPair(roster: Philosopher[], previous: Pair | null, rng: () => number = Math.random): Pair {
  const banned = previous ? [previous.A, previous.B].sort().join("|") : null;
  const candidates: [string, string][] = [];
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const a = roster[i].id;
      const b = roster[j].id;
      if (banned && banned === [a, b].sort().join("|")) continue;
      candidates.push([a, b]);
    }
  }
  if (candidates.length === 0) throw new Error("Not enough philosophers to draw a new pair");

  const [a, b] = candidates[Math.floor(rng() * candidates.length)];
  return rng() < 0.5 ? { A: a, B: b } : { A: b, B: a };
}
