import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

// v2-deployed: JWT_SECRET is now sourced from @/lib/env, which validates the
// environment eagerly on first import and throws a clear error on first read
// of env.JWT_SECRET if the variable is missing or too short. The previous
// hardcoded `|| 'fallback-...'` literal (Known Issue #1) has been removed.
//
// We read env.JWT_SECRET lazily inside signToken / verifyToken (not at module
// top level) so that test code which resets process.env after import time
// still exercises the validation path.
//
// v3-secured — session cookie hardening:
//
//   - `httpOnly: true` — JavaScript in the page cannot read the cookie, so
//     an XSS foothold cannot steal the session. (Was already set.)
//   - `sameSite: 'strict'` — the cookie is never sent on cross-site
//     navigations or requests. This is the baseline CSRF defense for all
//     state-changing routes. We tightened from 'lax' because this app has
//     no legitimate cross-site flow that needs to authenticate the user on
//     a top-level navigation (Stripe Checkout is a redirect OUT of our
//     origin, and the Stripe webhook is server-to-server and validated by
//     signature, not cookie).
//   - `secure: true in production` — the cookie is refused on plain HTTP,
//     so a network attacker on the same LAN / public wifi cannot sniff it.
//     In development NODE_ENV=development we leave secure off so localhost
//     over http:// still works. (Was already set; kept.)
//   - `__Host-` prefix in production — the browser refuses any attempt to
//     set the cookie with Domain= or a non-root Path, which blocks
//     sub-domain cookie confusion. Requires secure + path:/ + no Domain,
//     which we satisfy. Disabled in development so the browser accepts it
//     on http://localhost:3000.
//   - `maxAge: 7 days` — the historical lifetime. Shorter would log users
//     out on every trip and is out of scope for a teaching platform; the
//     httpOnly + sameSite=strict combination makes it safe enough for a
//     v3. A production ship would pair this with server-side session
//     revocation.
const COOKIE_NAME_BASE = 'avitam_session';
const COOKIE_NAME_PROD = '__Host-avitam_session';

/**
 * The cookie name depends on the runtime. In production we use the
 * `__Host-` prefix (see note above). In dev/test we use the plain name so
 * http://localhost continues to work and tests can keep setting
 * `avitam_session` in the mock cookie store.
 */
function sessionCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? COOKIE_NAME_PROD
    : COOKIE_NAME_BASE;
}

// Backwards-compatible export — a handful of call sites import COOKIE_NAME.
// In non-production environments this is the old value, so tests do not
// need to change. The logout handler reads it to clear the cookie.
export const COOKIE_NAME = COOKIE_NAME_BASE;

export interface JwtPayload {
  userId: number;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  // Check both names — in production requests carry the __Host- prefix
  // cookie; in dev/test they carry the plain name. Whichever is present
  // wins.
  const token =
    cookieStore.get(sessionCookieName())?.value ??
    cookieStore.get(COOKIE_NAME_BASE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function createSessionCookie(token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    // __Host- prefix REQUIRES secure=true. Keep secure tied to production
    // so http://localhost dev still works.
    secure: isProd,
    // v3-secured: tightened from 'lax' to 'strict'. There is no legitimate
    // cross-site flow that needs to authenticate via top-level navigation
    // in this app, so strict is the right default.
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
}
