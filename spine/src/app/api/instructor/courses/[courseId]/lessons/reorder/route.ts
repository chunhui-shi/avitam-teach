import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { canManageCourse, getCurrentUser } from '@/lib/permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const courseId = parseInt(params.courseId);
    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!(await canManageCourse(user, courseId))) {
      return NextResponse.json({ error: 'Course access required' }, { status: 403 });
    }

    const { lessonIds } = await req.json();
    if (!Array.isArray(lessonIds)) {
      return NextResponse.json({ error: 'lessonIds must be an array' }, { status: 400 });
    }

    for (let index = 0; index < lessonIds.length; index += 1) {
      await query(
        'UPDATE lessons SET position = $1 WHERE id = $2 AND course_id = $3',
        [index + 1, lessonIds[index], courseId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Instructor lesson reorder error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
