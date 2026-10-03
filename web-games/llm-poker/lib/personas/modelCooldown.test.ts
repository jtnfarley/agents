import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAllCooldowns, isModelInCooldown, markModelCooldown } from "./modelCooldown";

afterEach(() => {
  clearAllCooldowns();
  vi.useRealTimers();
});

describe("modelCooldown", () => {
  it("is not in cooldown before it's ever marked", () => {
    expect(isModelInCooldown("some/model:free")).toBe(false);
  });

  it("is in cooldown immediately after being marked", () => {
    markModelCooldown("some/model:free");
    expect(isModelInCooldown("some/model:free")).toBe(true);
  });

  it("expires after the default cooldown window", () => {
    vi.useFakeTimers();
    markModelCooldown("some/model:free");
    expect(isModelInCooldown("some/model:free")).toBe(true);
    vi.advanceTimersByTime(30_001);
    expect(isModelInCooldown("some/model:free")).toBe(false);
  });

  it("honors a provider-supplied retry-after hint", () => {
    vi.useFakeTimers();
    markModelCooldown("some/model:free", 5);
    vi.advanceTimersByTime(4_999);
    expect(isModelInCooldown("some/model:free")).toBe(true);
    vi.advanceTimersByTime(2);
    expect(isModelInCooldown("some/model:free")).toBe(false);
  });

  it("caps an excessive retry-after hint instead of trusting it blindly", () => {
    vi.useFakeTimers();
    markModelCooldown("some/model:free", 10_000);
    vi.advanceTimersByTime(90_001);
    expect(isModelInCooldown("some/model:free")).toBe(false);
  });

  it("does not shorten an existing cooldown when marked again with a smaller hint", () => {
    vi.useFakeTimers();
    markModelCooldown("some/model:free", 60);
    markModelCooldown("some/model:free", 5);
    vi.advanceTimersByTime(10_000);
    expect(isModelInCooldown("some/model:free")).toBe(true);
  });

  it("only cools down the model it was marked for", () => {
    markModelCooldown("model-a");
    expect(isModelInCooldown("model-b")).toBe(false);
  });
});
