import { NextResponse } from 'next/server';

// A small in-memory fixed-window rate limiter.
//
// IMPORTANT LIMITATION: the counters live in this process's memory. That is fine
// for a single instance, but it does NOT work once the app runs as more than one
// replica — each replica would keep its own counts, so the real limit becomes
// (limit x number-of-replicas). Moving to a shared store (e.g. Redis) is the
// fix when we scale out; until then, one instance is the boundary.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// `now` is injectable so the window behaviour can be tested deterministically.
export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count, retryAfterSeconds: 0 };
}

// Convenience for route handlers: returns a ready 429 response when the caller is
// over budget, or null when the request may proceed.
export function rateLimited(
  key: string,
  max: number,
  windowMs: number
): NextResponse | null {
  const result = rateLimit(key, max, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}

// Derive a stable limiter key for an unauthenticated request (best-effort client
// IP from the proxy header; falls back to a constant when absent).
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}

// Test-only: clear all counters so each test starts from a clean slate.
export function resetRateLimits(): void {
  buckets.clear();
}
