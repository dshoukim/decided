interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

export class RateLimiter {
  private static cache = new Map<string, { count: number; resetTime: number }>();
  
  static async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    
    // Clean expired entries
    for (const [k, v] of this.cache.entries()) {
      if (v.resetTime < now) {
        this.cache.delete(k);
      }
    }
    
    const current = this.cache.get(key);
    if (!current || current.resetTime < now) {
      // First request in window
      const resetTime = now + config.windowMs;
      this.cache.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: config.max - 1, resetTime };
    }
    
    if (current.count >= config.max) {
      return { allowed: false, remaining: 0, resetTime: current.resetTime };
    }
    
    current.count++;
    return { allowed: true, remaining: config.max - current.count, resetTime: current.resetTime };
  }
  
  static generateKey(req: Request, prefix: string): string {
    // Try to get user ID from headers (set by auth middleware)
    const userId = req.headers.get('x-user-id');
    if (userId) {
      return `${prefix}:${userId}`;
    }
    
    // Fallback to IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
    return `${prefix}:${ip}`;
  }
}

// Rate limiting configurations
export const RATE_LIMITS = {
  ROOM_CREATION: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 rooms per 15 minutes
  TOURNAMENT_START: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 tournaments per hour
  BRACKET_PICKS: { windowMs: 60 * 1000, max: 30 }, // 30 picks per minute
  LLM_REQUESTS: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 LLM requests per hour
  ROOM_JOIN: { windowMs: 5 * 60 * 1000, max: 10 }, // 10 joins per 5 minutes
} as const;

// Middleware function for Next.js API routes
export async function withRateLimit(
  request: Request,
  config: RateLimitConfig,
  keyPrefix: string
) {
  const key = RateLimiter.generateKey(request, keyPrefix);
  const result = await RateLimiter.checkLimit(key, config);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      }),
      { 
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }
  
  return null; // No rate limit hit, continue
} 