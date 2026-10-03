// In-memory, per-IP request limiter for api/start and api/turn — a spend
// control, since every request costs a paid LLM call. No external service
// for this first pass.
//
// Known limitation: on a serverless runtime, this Map is scoped to a single
// function instance and clears on cold start/redeploy, so the limit is
// per-instance, not truly global — acceptable for modest traffic. If usage
// grows, swap in Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`)
// behind the same `checkRateLimit` call site.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

// Once the bucket map gets large, opportunistically drop expired entries so
// a long-running process (e.g. `next dev`, or a warm serverless instance)
// doesn't accumulate one bucket per visitor forever.
const SWEEP_THRESHOLD = 500;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  if (buckets.size > SWEEP_THRESHOLD) sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
