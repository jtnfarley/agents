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

import { partialText } from "@/lib/json";

describe("partialText", () => {
  it("is null until the text field starts", () => {
    expect(partialText('{"sta')).toBeNull();
  });
  it("returns what has arrived so far", () => {
    expect(partialText('{"text": "Hello wor')).toBe("Hello wor");
  });
  const BS = String.fromCharCode(92);
  it("decodes escapes and holds back a split one", () => {
    expect(partialText(`{"text":"a${BS}nb ${BS}"q${BS}" ${BS}u00e9`)).toBe('a'+String.fromCharCode(10)+'b "q" é');
    expect(partialText(`{"text":"a${BS}`)).toBe("a");
    expect(partialText(`{"text":"a${BS}u00`)).toBe("a");
  });
  it("stops at the closing quote", () => {
    expect(partialText('{"text":"done","stance":"x"}')).toBe("done");
  });
});
