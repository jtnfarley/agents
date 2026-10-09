/** The error contract (plan section 7). Codes are stable; messages are shown to the visitor. */
export type ErrorCode =
  | "invalid_input"
  | "off_topic"
  | "bad_output"
  | "upstream_error"
  | "rate_limited"
  | "ai_disabled";

export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Code for any thrown value. Anything unknown counts as an upstream error. */
export function errorCodeOf(e: unknown): ErrorCode {
  return e instanceof ApiError ? e.code : "upstream_error";
}

/** The text shown to the visitor for each code. */
export function errorText(code: ErrorCode): string {
  switch (code) {
    case "invalid_input":
      return "Check what you entered and try again.";
    case "off_topic":
      return "That topic is not one the philosophers can debate. Try a philosophical question.";
    case "bad_output":
      return "The philosophers could not answer that. Try again in a moment.";
    case "rate_limited":
      return "Too many requests. Wait a moment and try again.";
    case "ai_disabled":
      return "The philosophers are resting right now. Please come back later.";
    case "upstream_error":
    default:
      return "The philosophers could not answer. Try again in a moment.";
  }
}
