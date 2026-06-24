import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { User } from '@/types';

// Admin-only: list and search all users.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

    let users: User[];
    if (q) {
      users = await query<User>(`
        SELECT id, email, name, role, display_name, avatar_url, created_at
        FROM users
        WHERE name ILIKE $1 OR email ILIKE $1
        ORDER BY created_at DESC
        LIMIT 200
      `, [`%${q}%`]);
    } else {
      users = await query<User>(`
        SELECT id, email, name, role, display_name, avatar_url, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 200
      `);
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Admin users GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
