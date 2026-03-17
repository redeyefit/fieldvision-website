/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per IP. Resets on server restart (acceptable for Vercel serverless).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited.
 * @returns null if allowed, or { retryAfter: seconds } if blocked.
 */
export function rateLimit(
  ip: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): { retryAfter: number } | null {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { retryAfter };
  }

  return null;
}
