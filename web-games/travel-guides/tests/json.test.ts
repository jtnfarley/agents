import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"reply":"hi"}')).toEqual({ reply: "hi" });
  });

  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"reply":"hi"}\n```')).toEqual({ reply: "hi" });
    expect(extractJson("```\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("takes the object out of a chatty reply", () => {
    expect(extractJson('Sure! Here it is: {"reply":"hi","tip":""} Hope that helps.')).toEqual({ reply: "hi", tip: "" });
  });

  it("throws when there is no object", () => {
    expect(() => extractJson("no json at all")).toThrow();
    expect(() => extractJson("} backwards {")).toThrow();
  });

  it("throws on broken JSON", () => {
    expect(() => extractJson('{"reply": ')).toThrow();
  });
});
