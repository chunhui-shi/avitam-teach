import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { User } from '@/types';

// Update the current user's display name and bio.
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { display_name, bio } = await req.json();

    const users = await query<User>(`
      UPDATE users
      SET display_name = $1, bio = $2
      WHERE id = $3
      RETURNING id, email, name, role, display_name, bio, avatar_url, created_at
    `, [
      display_name ? String(display_name).trim().substring(0, 80) : null,
      bio ? String(bio).trim().substring(0, 500) : null,
      session.userId,
    ]);

    return NextResponse.json({ user: users[0] });
  } catch (err) {
    console.error('Profile PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
