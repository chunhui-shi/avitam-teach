import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { canManageCourse, getCurrentUser } from '@/lib/permissions';

export async function GET(
  req: Request,
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

    const enrollments = await query(`
      SELECT e.id, e.enrolled_at, u.id AS user_id, u.name, u.email, u.avatar_url
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = $1
      ORDER BY e.enrolled_at DESC
    `, [courseId]);

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error('Instructor enrollments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
