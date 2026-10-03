import { describe, expect, it } from "vitest";
import type { PrivateMemoryEntry, TableDigestEntry } from "@/types";
import {
  filterPrivateMemoryForCurrentSeats,
  filterTableDigestRecent,
  TABLE_DIGEST_WINDOW_HANDS,
} from "./filters";

function privateEntry(overrides: Partial<PrivateMemoryEntry> = {}): PrivateMemoryEntry {
  return { type: "tell_noticed", target: null, note: "note", importance: 3, ...overrides };
}

function digestEntry(overrides: Partial<TableDigestEntry> = {}): TableDigestEntry {
  return { note: "note", handWritten: 1, importance: 3, ...overrides };
}

describe("filterPrivateMemoryForCurrentSeats", () => {
  it("keeps entries with no target regardless of who is seated", () => {
    const memory = [privateEntry({ target: null, note: "general observation" })];
    expect(filterPrivateMemoryForCurrentSeats(memory, [])).toEqual(memory);
  });

  it("keeps entries whose target is still at the table", () => {
    const memory = [privateEntry({ target: "nietzsche" })];
    expect(filterPrivateMemoryForCurrentSeats(memory, ["nietzsche", "sappho"])).toEqual(memory);
  });

  it("drops entries whose target has left the table", () => {
    const memory = [privateEntry({ target: "diogenes" })];
    expect(filterPrivateMemoryForCurrentSeats(memory, ["nietzsche", "sappho"])).toEqual([]);
  });
});

describe("filterTableDigestRecent", () => {
  it("keeps an entry written on the current hand", () => {
    const digest = [digestEntry({ handWritten: 5 })];
    expect(filterTableDigestRecent(digest, 5)).toEqual(digest);
  });

  it(`keeps an entry written up to ${TABLE_DIGEST_WINDOW_HANDS - 1} hands ago`, () => {
    const digest = [digestEntry({ handWritten: 1 })];
    expect(filterTableDigestRecent(digest, 1 + (TABLE_DIGEST_WINDOW_HANDS - 1))).toEqual(digest);
  });

  it(`drops an entry written ${TABLE_DIGEST_WINDOW_HANDS} hands ago, regardless of importance`, () => {
    const digest = [digestEntry({ handWritten: 1, importance: 5 })];
    expect(filterTableDigestRecent(digest, 1 + TABLE_DIGEST_WINDOW_HANDS)).toEqual([]);
  });
});
