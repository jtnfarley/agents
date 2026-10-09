/**
 * Per-IP limit: 20 requests a minute and 200 a day (section 7).
 * In memory, so each serverless instance keeps its own count. Production needs a shared store.
 */
const MINUTE = 60_000;
const DAY = 86_400_000;
const PER_MINUTE = 20;
const PER_DAY = 200;
const MAX_KEYS = 5000;

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private now: () => number = Date.now) {}

  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < DAY);
    const lastMinute = recent.filter((x) => t - x < MINUTE).length;
    const allowed = lastMinute < PER_MINUTE && recent.length < PER_DAY;
    if (allowed) recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_KEYS) this.sweep(t);
    return allowed;
  }

  private sweep(t: number) {
    for (const [key, times] of this.hits) {
      if (times.every((x) => t - x >= DAY)) this.hits.delete(key);
    }
  }
}

export const limiter = new RateLimiter();
