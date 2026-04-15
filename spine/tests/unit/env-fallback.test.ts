import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * v1 KNOWN ISSUE #1 — hardcoded JWT_SECRET fallback.
 *
 * src/lib/auth.ts currently has:
 *   const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
 *
 * That means a production deploy with a missing env var silently falls back
 * to a publicly-known secret string. This test asserts the desired behaviour
 * (module import / signToken should refuse to proceed without a real secret),
 * which the v1 code does NOT yet implement, so this test is EXPECTED TO FAIL
 * until the fix lands in v2-deployed.
 */

describe('JWT_SECRET env var is required', () => {
  const realSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    if (realSecret !== undefined) {
      process.env.JWT_SECRET = realSecret;
    }
    vi.resetModules();
  });

  it('refuses to sign a token when JWT_SECRET is unset', async () => {
    // Fresh import with no cache so the module-level const re-evaluates.
    const auth = await import('@/lib/auth');

    let threw: unknown = null;
    try {
      auth.signToken({ userId: 1, email: 'x@y.com' });
    } catch (err) {
      threw = err;
    }

    expect(
      threw,
      'v1-tested: hardcoded JWT_SECRET fallback still present in src/lib/auth.ts. ' +
        'signToken() silently falls back to a literal string when JWT_SECRET is ' +
        "unset instead of throwing. Fix scheduled for v2-deployed via startup env validation."
    ).not.toBeNull();

    if (threw instanceof Error) {
      expect(threw.message).toMatch(/JWT_SECRET.*required/i);
    }
  });
});

/*
  EXPECTED FAILURE MESSAGE (v1-tested):

    v1-tested: hardcoded JWT_SECRET fallback still present in src/lib/auth.ts.
    Fix scheduled for v2-deployed via env validation.
*/
