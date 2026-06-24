import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/permissions';
import { User } from '@/types';

const roles = new Set(['student', 'instructor', 'admin']);

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const search = req.nextUrl.searchParams.get('q')?.trim() || '';
    const users = await query<User>(`
      SELECT id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
      FROM users
      WHERE $1 = ''
        OR email ILIKE '%' || $1 || '%'
        OR name ILIKE '%' || $1 || '%'
      ORDER BY created_at DESC
      LIMIT 100
    `, [search]);

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Admin users GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getCurrentUser();
    if (!isAdmin(admin)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !roles.has(role)) {
      return NextResponse.json({ error: 'Valid userId and role are required' }, { status: 400 });
    }

    const users = await query<User>(`
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
    `, [role, userId]);

    return NextResponse.json({ user: users[0] });
  } catch (err) {
    console.error('Admin users PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
