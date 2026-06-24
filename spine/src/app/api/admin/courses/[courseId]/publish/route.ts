import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/permissions';
import { Course } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const admin = await getCurrentUser();
    if (!isAdmin(admin)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const courseId = parseInt(params.courseId);
    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }

    const { published } = await req.json();
    const course = await queryOne<Course>(
      'UPDATE courses SET published = $1 WHERE id = $2 RETURNING *',
      [!!published, courseId]
    );

    return NextResponse.json({ course });
  } catch (err) {
    console.error('Admin publish PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
