import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Lesson, Enrollment } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await getSession();
    const courseId = parseInt(params.courseId);

    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
    }

    // Check enrollment for paid courses
    const course = await queryOne<{ price_cents: number }>(
      'SELECT price_cents FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.price_cents > 0) {
      if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const enrollment = await queryOne<Enrollment>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      if (!enrollment) {
        return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
      }
    }

    let lessons: Lesson[];
    if (session) {
      lessons = await query<Lesson>(`
        SELECT l.*, lp.completed
        FROM lessons l
        LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
        WHERE l.course_id = $2
        ORDER BY l.position
      `, [session.userId, courseId]);
    } else {
      lessons = await query<Lesson>(
        'SELECT * FROM lessons WHERE course_id = $1 ORDER BY position',
        [courseId]
      );
    }

    return NextResponse.json({ lessons });
  } catch (err) {
    console.error('Lessons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
