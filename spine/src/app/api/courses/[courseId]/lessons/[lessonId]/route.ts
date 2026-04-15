import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Lesson, Enrollment } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await getSession();
    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);

    if (isNaN(courseId) || isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

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

    const lesson = await queryOne<Lesson>(
      'SELECT * FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json({ lesson });
  } catch (err) {
    console.error('Lesson error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
