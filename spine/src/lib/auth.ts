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
const COOKIE_NAME = 'avitam_session';

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
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function createSessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
}
