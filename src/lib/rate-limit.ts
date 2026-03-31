interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requests: Map<string, number[]> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(ip: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const timestamps = (this.requests.get(ip) ?? []).filter(
      (t) => t > windowStart
    );

    if (timestamps.length >= this.config.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);

    const remaining = this.config.maxRequests - timestamps.length;
    return { allowed: true, remaining };
  }
}
