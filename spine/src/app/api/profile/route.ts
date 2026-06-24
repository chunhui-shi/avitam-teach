import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { User } from '@/types';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await queryOne<User>(`
      SELECT id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
      FROM users
      WHERE id = $1
    `, [session.userId]);

    return NextResponse.json({ user });
  } catch (err) {
    console.error('Profile GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { name, bio } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    const user = await queryOne<User>(`
      UPDATE users
      SET name = $1, bio = $2
      WHERE id = $3
      RETURNING id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
    `, [name.trim(), bio?.trim() || null, session.userId]);

    return NextResponse.json({ user });
  } catch (err) {
    console.error('Profile PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
