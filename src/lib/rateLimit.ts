class RateLimit {
  private store: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.store = new Map();
  }

  async check(req: Request, limit: number, window: string): Promise<{ success: boolean; limit: number; remaining: number }> {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const windowMs = this.parseWindow(window);
    const now = Date.now();

    // Clean up expired entries
    Array.from(this.store.entries()).forEach(([key, value]) => {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    });

    const entry = this.store.get(ip);
    if (!entry) {
      this.store.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { success: true, limit, remaining: limit - 1 };
    }

    if (entry.resetTime < now) {
      this.store.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { success: true, limit, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
      return { success: false, limit, remaining: 0 };
    }

    entry.count += 1;
    return { success: true, limit, remaining: limit - entry.count };
  }

  private parseWindow(window: string): number {
    const [value, unit] = window.split(' ');
    const numValue = parseInt(value, 10);

    switch (unit.toLowerCase()) {
      case 's':
      case 'sec':
      case 'second':
      case 'seconds':
        return numValue * 1000;
      case 'm':
      case 'min':
      case 'minute':
      case 'minutes':
        return numValue * 60 * 1000;
      case 'h':
      case 'hr':
      case 'hour':
      case 'hours':
        return numValue * 60 * 60 * 1000;
      default:
        throw new Error('Invalid time unit');
    }
  }
}

export const rateLimit = new RateLimit();

// Default rate limit configuration
const DEFAULT_LIMIT = 5;

/**
 * Check rate limit for a given IP address
 * 
 * @param ip The IP address to check
 * @param actionType Action type for different rate limits (currently only used for key generation)
 * @param limit Optional custom limit
 * @param windowSeconds Optional window in seconds
 * @returns Rate limit information
 */
export async function checkRateLimit(
  ip: string, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  actionType: string = 'login', 
  limit: number = DEFAULT_LIMIT,
  windowSeconds: number = 15 * 60
): Promise<{ isBlocked: boolean; remainingAttempts: number; resetTime: number }> {
  const mockRequest = new Request('http://localhost', {
    headers: new Headers({
      'x-forwarded-for': ip
    })
  });

  // Create a key that includes the action
  const window = `${Math.floor(windowSeconds / 60)} min`;
  // Note: actionType param is kept for future use when we implement separate rate limiting by action
  
  const result = await rateLimit.check(mockRequest, limit, window);
  
  return {
    isBlocked: !result.success,
    remainingAttempts: result.remaining,
    resetTime: Date.now() + windowSeconds * 1000
  };
} 