import { describe, expect, it } from "vitest";
import { chatRequest, destinationOutput, destinationRequest, tripRequest } from "@/lib/schemas";

const guide = {
  name: "Sam",
  role: "Baker",
  brief: "You bake.",
  personality: { trait: "Warm", how: "Kind." },
};
const destination = { city: "Lisbon", guides: { local: guide, tourist: { ...guide, name: "Priya" } } };

describe("request schemas", () => {
  it("rejects a destination longer than 60 characters", () => {
    expect(destinationRequest.safeParse({ place: "x".repeat(61) }).success).toBe(false);
    expect(destinationRequest.safeParse({ place: "Lisbon" }).success).toBe(true);
  });

  it("rejects an unknown chat target and an empty question", () => {
    const base = { destination, history: [] };
    expect(chatRequest.safeParse({ ...base, target: "everyone", text: "hi" }).success).toBe(false);
    expect(chatRequest.safeParse({ ...base, target: "both", text: "" }).success).toBe(false);
    expect(chatRequest.safeParse({ ...base, target: "both", text: "hi" }).success).toBe(true);
  });

  it("caps chat history at 12 items", () => {
    const history = Array.from({ length: 13 }, () => ({ role: "user", text: "hi" }));
    expect(chatRequest.safeParse({ destination, target: "local", text: "hi", history }).success).toBe(false);
  });

  it("rejects trip days outside 1 to 3 and unknown interests", () => {
    const options = { days: 4, pace: "Relaxed", lean: "split", interests: [] };
    expect(tripRequest.safeParse({ destination, options, history: [] }).success).toBe(false);
    const bad = { days: 1, pace: "Relaxed", lean: "split", interests: ["Bungee"] };
    expect(tripRequest.safeParse({ destination, options: bad, history: [] }).success).toBe(false);
  });
});

describe("model output schemas", () => {
  it("accepts the not_a_place reply", () => {
    expect(destinationOutput.safeParse({ error: "not_a_place" }).success).toBe(true);
  });

  it("rejects a destination reply missing a guide", () => {
    expect(destinationOutput.safeParse({ city: "Lisbon", tagline: "t", prompts: [], local: guide }).success).toBe(false);
  });
});
