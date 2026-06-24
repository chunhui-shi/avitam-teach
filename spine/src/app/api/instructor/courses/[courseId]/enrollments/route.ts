import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeCourseManagement } from '@/lib/authz';

interface EnrolleeRow {
  user_id: number;
  name: string;
  email: string;
  enrolled_at: string;
  completed_lessons: number;
}

// List who is enrolled in a course the caller manages.
export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const courseId = parseInt(params.courseId);
    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }

    const authz = await authorizeCourseManagement(courseId);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const enrollees = await query<EnrolleeRow>(`
      SELECT u.id AS user_id, u.name, u.email, e.enrolled_at,
        COUNT(lp.id) FILTER (WHERE lp.completed = true)::int AS completed_lessons
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN lessons l ON l.course_id = e.course_id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
      WHERE e.course_id = $1
      GROUP BY u.id, e.enrolled_at
      ORDER BY e.enrolled_at DESC
    `, [courseId]);

    return NextResponse.json({ enrollees });
  } catch (err) {
    console.error('Enrollees GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
