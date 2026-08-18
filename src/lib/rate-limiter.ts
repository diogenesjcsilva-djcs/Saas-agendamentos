import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Creates an in-memory sliding window rate limiter middleware.
 * @param windowMs Window duration in milliseconds (e.g. 60000 = 1 minute)
 * @param maxRequests Maximum allowed requests per window
 * @param message Custom message on rate limit exceeded
 */
export function createRateLimiter(
  windowMs: number = 60 * 1000,
  maxRequests: number = 20,
  message: string = "Muitas requisições. Por favor, aguarde antes de tentar novamente."
) {
  const ipStore = new Map<string, RateLimitRecord>();

  // Cleanup old entries every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      if (now > record.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // In production behind proxies, use X-Forwarded-For if available
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const record = ipStore.get(clientIp);

    if (!record || now > record.resetTime) {
      // First request in the new window
      ipStore.set(clientIp, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message,
        retryAfter: retryAfterSeconds
      });
    }

    record.count += 1;
    next();
  };
}
