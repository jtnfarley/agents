import { describe, expect, it } from "vitest";
import { cleanChat } from "@/lib/clean";

describe("cleanChat debate", () => {
  it("keeps one turn per guide, the first from each, even when the model sends four", () => {
    const out = cleanChat({
      kind: "debate",
      turns: [
        { speaker: "local", text: "Local one." },
        { speaker: "tourist", text: "Tourist one." },
        { speaker: "local", text: "Local two." },
        { speaker: "tourist", text: "Tourist two." },
      ],
      common_ground: "Mix them.",
    });
    expect(out.kind).toBe("debate");
    if (out.kind !== "debate") return;
    expect(out.turns.map((t) => [t.speaker, t.text])).toEqual([
      ["local", "Local one."],
      ["tourist", "Tourist one."],
    ]);
  });
});
