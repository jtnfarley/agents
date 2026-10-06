import { describe, expect, it } from "vitest";
import { fit, hashStr, slug, str } from "@/lib/text";

describe("str", () => {
  it("trims, caps length and drops control characters", () => {
    expect(str("  hi\u0007 there  ", 20)).toBe("hi there");
    expect(str("abcdef", 3)).toBe("abc");
    expect(str(42, 10)).toBe("");
  });

  it("keeps newlines and tabs", () => {
    expect(str("a\nb\tc", 20)).toBe("a\nb\tc");
  });
});

describe("fit", () => {
  it("returns short text unchanged", () => {
    expect(fit("Short text.", 100)).toBe("Short text.");
  });

  it("cuts at a sentence end, never mid-sentence, when one is far enough in", () => {
    const text = "First sentence is here. Second sentence goes on and on and on and on.";
    expect(fit(text, 40)).toBe("First sentence is here.");
  });

  it("falls back to a word boundary with an ellipsis when there is no sentence end", () => {
    const out = fit("alpha beta gamma delta epsilon zeta eta theta iota kappa", 25);
    expect(out.endsWith("...")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(28);
    expect(out).not.toMatch(/\w$/);
  });
});

describe("slug", () => {
  it("lowercases, collapses separators and trims dashes", () => {
    expect(slug("  Mexico City!! ")).toBe("mexico-city");
    expect(slug("Saint-Germain, Paris")).toBe("saint-germain-paris");
    expect(slug("!!!")).toBe("");
  });
});

describe("hashStr", () => {
  it("is stable and spreads ids across the 8 palettes", () => {
    expect(hashStr("lisbon")).toBe(hashStr("lisbon"));
    const buckets = new Set(["lisbon", "kyoto", "oaxaca", "tokyo", "cairo", "lima", "rome", "oslo"].map((s) => hashStr(s) % 8));
    expect(buckets.size).toBeGreaterThan(2);
  });
});
