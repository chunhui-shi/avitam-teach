import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, signToken, createSessionCookie } from '@/lib/auth';
import { rateLimited, clientIp } from '@/lib/rate-limit';

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

export async function POST(req: NextRequest) {
  try {
    // Throttle login attempts per client IP so the password endpoint can't be
    // used for credential stuffing or brute force.
    const limited = rateLimited(`login:${clientIp(req)}`, 10, 15 * 60_000);
    if (limited) return limited;

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await queryOne<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email });
    const cookieOptions = createSessionCookie(token);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(cookieOptions);
    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
