import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { queryOne } from './db';
import type { User, UserRole } from '@/types';

const COOKIE_NAME = 'avitam_session';

// Read the signing secret at the point of use and refuse to operate without it.
// The old code fell back to a hard-coded default when JWT_SECRET was unset, which
// meant a misconfigured deploy would sign sessions with a secret that is public
// in the source — anyone could forge a token. Now it throws instead.
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to sign or verify sessions with an insecure default.'
    );
  }
  return secret;
}

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
  return jwt.sign(payload, jwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as JwtPayload;
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

// Load the full user record for the current session (role, profile, etc.)
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return queryOne<User>(
    `SELECT id, email, name, role, display_name, bio, avatar_url, stripe_customer_id, created_at
     FROM users WHERE id = $1`,
    [session.userId]
  );
}

export function hasRole(role: UserRole | undefined, ...allowed: UserRole[]): boolean {
  return !!role && allowed.includes(role);
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
