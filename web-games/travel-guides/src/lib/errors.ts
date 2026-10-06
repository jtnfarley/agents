import type { ErrorCode } from "./types";

export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export type ErrorContext = "dest" | "reroll" | "other";

/** Code for any thrown value. Network failures count as upstream errors. */
export function errorCodeOf(e: unknown): ErrorCode {
  return e instanceof ApiError ? e.code : "upstream_error";
}

/** The UI text for each error code (section 7). Wording is fixed. */
export function errorText(code: ErrorCode, context: ErrorContext): string {
  switch (code) {
    case "not_a_place":
      return "That does not look like a place to travel to. Try a city or region.";
    case "bad_output":
      if (context === "dest") return "Could not set up guides for that place. Try again, or try a nearby city.";
      if (context === "reroll") return "Could not roll new personalities. Try again.";
      return "The guides could not answer. Try again in a moment.";
    case "rate_limited":
      return "Too many requests. Wait a moment and try again.";
    case "invalid_input":
      return "Check what you typed and try again.";
    case "ai_disabled":
      return "The guides are resting right now. Please come back later.";
    case "upstream_error":
    default:
      return "The guides could not answer. Try again in a moment.";
  }
}
