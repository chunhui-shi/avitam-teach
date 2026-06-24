import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { User, UserRole } from '@/types';

const ROLES: UserRole[] = ['student', 'instructor', 'admin'];

// Admin-only: change a user's role.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await getCurrentUser();
    if (!admin) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (admin.role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const userId = parseInt(params.userId);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { role } = await req.json();
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const users = await query<User>(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role, display_name, avatar_url, created_at',
      [role, userId]
    );
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: users[0] });
  } catch (err) {
    console.error('Admin user PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
