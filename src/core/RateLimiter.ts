import { Logger } from './Logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private logger: Logger;
  private windowMs: number;
  private maxRequests: number;
  private enabled: boolean;

  constructor(
    windowMs: number = 60000, // 1 minute default
    maxRequests: number = 10,
    enabled: boolean = true
  ) {
    this.limits = new Map();
    this.logger = new Logger('RateLimiter');
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.enabled = enabled;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be rate limited
   * @param key Unique identifier (e.g., userId:commandName)
   * @returns true if rate limited, false if allowed
   */
  public isRateLimited(key: string): boolean {
    if (!this.enabled) return false;

    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // No entry or window expired, create new entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    if (entry.count >= this.maxRequests) {
      this.logger.debug(`Rate limit exceeded for ${key}`);
      return true;
    }

    // Increment count
    entry.count++;
    return false;
  }

  /**
   * Get remaining requests for a key
   */
  public getRemaining(key: string): number {
    if (!this.enabled) return this.maxRequests;

    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  public getResetTime(key: string): number {
    if (!this.enabled) return 0;

    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      return 0;
    }

    return Math.ceil((entry.resetTime - now) / 1000);
  }

  /**
   * Reset rate limit for a specific key
   */
  public reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get current stats
   */
  public getStats(): { totalEntries: number; enabled: boolean } {
    return {
      totalEntries: this.limits.size,
      enabled: this.enabled,
    };
  }
}
