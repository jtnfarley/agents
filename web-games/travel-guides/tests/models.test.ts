import { describe, expect, it } from "vitest";
import { modelFor, specForSlug } from "@/lib/models";

const env = {
  MODEL_DEFAULT: "a/one:free",
  MODEL_REASONING_OFF_SLUGS: "a/one:free",
  MODEL_JSON_MODE_SLUGS: "a/one:free",
} as unknown as NodeJS.ProcessEnv;

describe("reasoning setting per model", () => {
  it("turns reasoning off only for slugs listed in MODEL_REASONING_OFF_SLUGS", () => {
    expect(specForSlug("a/one:free", "trip", env).reasoning).toBe("off");
    expect(specForSlug("b/two:free", "trip", env).reasoning).toBe("low");
  });

  it("keeps the task's temperature and token cap", () => {
    const spec = modelFor("debate", undefined, env);
    expect(spec.maxTokens).toBe(2400);
    expect(spec.temperature).toBe(0.9);
  });
});
