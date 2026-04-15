import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed by `${route}:${identifier}` (identifier is usually the client IP or
 * the authenticated user id). The store is a single Map of arrays of
 * request timestamps within the window. Each call sweeps expired timestamps,
 * counts what remains, and either accepts or rejects.
 *
 * This is intentionally simple — a single-process Map. It is the MVP for
 * v2-deployed. PRODUCTION NOTE: a multi-instance deployment must replace
 * this with Redis (or any shared store) because each Node process has its
 * own Map and attackers would scale around it by hitting different pods.
 * See also: no cross-process eviction, no cleanup of idle keys — memory
 * grows with active distinct clients. Acceptable for staging, not for real
 * production volumes.
 */

interface RateLimitConfig {
  /** Short identifier for the protected route, e.g. "auth:login". */
  route: string;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per identifier within the window. */
  max: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window after this call. */
  remaining: number;
  /** Seconds the caller should wait before retrying. */
  retryAfterSeconds: number;
}

// Module-level store. Survives for the lifetime of the Node process.
const store: Map<string, number[]> = new Map();

/**
 * Check and record a request against the given config.
 *
 * Returns `{ allowed: false }` if the caller has exceeded the limit; the
 * current request is NOT recorded in that case (so a 429 doesn't count
 * toward the window, which would otherwise permanently lock out a
 * saturated client).
 */
export function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): RateLimitResult {
  const now = Date.now();
  const key = `${config.route}:${identifier}`;
  const cutoff = now - config.windowMs;

  const timestamps = store.get(key) ?? [];
  // Drop timestamps that fall outside the current window.
  const fresh = timestamps.filter((t) => t > cutoff);

  if (fresh.length >= config.max) {
    store.set(key, fresh);
    const oldest = fresh[0];
    const retryAfterMs = Math.max(1, oldest + config.windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  fresh.push(now);
  store.set(key, fresh);
  return {
    allowed: true,
    remaining: Math.max(0, config.max - fresh.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Extract a best-effort client identifier from a NextRequest. Prefers the
 * `x-forwarded-for` header (first IP) so that requests behind a load
 * balancer are identified by the real client, falling back to
 * `x-real-ip`, then to a literal "unknown" bucket. In v2 we don't trust
 * these headers for security — they are for rate limiting, not auth.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Build the standard 429 response. Route handlers should `return` this
 * directly when `checkRateLimit` returns `{ allowed: false }`.
 */
export function rateLimitExceededResponse(
  retryAfterSeconds: number
): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Reset the store. Test-only helper; production code should never call this.
 */
export function __resetRateLimitStoreForTests(): void {
  store.clear();
}

// Pre-canned configurations for the v2-deployed routes. Keeping them here
// keeps the route handlers a one-liner at the call site and makes it easy
// to review all the caps in one place.
export const RATE_LIMITS = {
  authLogin: { route: 'auth:login', windowMs: 60_000, max: 10 },
  authRegister: { route: 'auth:register', windowMs: 60_000, max: 5 },
  assistant: { route: 'assistant', windowMs: 60_000, max: 20 },
  execute: { route: 'execute', windowMs: 60_000, max: 30 },
} as const;
