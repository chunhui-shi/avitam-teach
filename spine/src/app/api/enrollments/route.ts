import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Course } from '@/types';

// Enroll in a free course
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const course = await queryOne<Course>(
      'SELECT * FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.price_cents > 0) {
      return NextResponse.json({ error: 'This is a paid course. Use checkout to enroll.' }, { status: 400 });
    }

    // Insert idempotently. The old code checked for an existing row and then
    // inserted: two concurrent free-enroll requests both passed the check and
    // then raced the UNIQUE(user_id, course_id) constraint, leaving the loser to
    // throw an unhandled error (a 500). ON CONFLICT DO NOTHING lets the database
    // settle the race in one statement — an empty RETURNING means a row already
    // existed, so the caller is simply already enrolled.
    const inserted = await query<{ id: number }>(
      `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING id`,
      [session.userId, courseId]
    );

    if (inserted.length === 0) {
      return NextResponse.json({ message: 'Already enrolled' });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Enrollment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get user's enrollments
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const enrollments = await query<Course>(`
      SELECT c.*, e.enrolled_at,
        COUNT(l.id)::int AS lesson_count,
        COUNT(lp.id) FILTER (WHERE lp.completed = true)::int AS completed_lessons
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
      WHERE e.user_id = $1
      GROUP BY c.id, e.enrolled_at
      ORDER BY e.enrolled_at DESC
    `, [session.userId]);

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error('Enrollments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
