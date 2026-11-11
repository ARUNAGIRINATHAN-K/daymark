export interface RetryManagerOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
}

/** Exponential retry delay with bounded positive jitter. */
export class RetryManager {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;
  private readonly random: () => number;

  constructor(options: RetryManagerOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 5 * 60_000;
    this.jitterRatio = options.jitterRatio ?? 0.2;
    this.random = options.random ?? Math.random;
  }

  getDelay(attemptCount: number): number {
    const exponent = Math.max(0, Math.min(30, attemptCount - 1));
    const base = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** exponent);
    const randomValue = Math.max(0, Math.min(1, this.random()));
    const jitter = base * this.jitterRatio * randomValue;
    return Math.min(this.maxDelayMs, Math.round(base + jitter));
  }

  getNextRetryAt(attemptCount: number, now = Date.now()): number {
    return now + this.getDelay(attemptCount);
  }

  isDue(nextRetryAt: number | null | undefined, now = Date.now()): boolean {
    return nextRetryAt == null || nextRetryAt <= now;
  }
}

export const retryManager = new RetryManager();

