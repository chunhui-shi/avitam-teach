import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Course } from '@/types';

export async function GET() {
  try {
    const session = await getSession();

    let courses: Course[];

    if (session) {
      // Include enrollment status for logged-in users
      courses = await query<Course>(`
        SELECT c.*,
          COUNT(l.id)::int AS lesson_count,
          CASE WHEN e.id IS NOT NULL THEN true ELSE false END AS enrolled
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
        WHERE c.published = true
        GROUP BY c.id, e.id
        ORDER BY c.created_at DESC
      `, [session.userId]);
    } else {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count, false AS enrolled
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        WHERE c.published = true
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
    }

    return NextResponse.json({ courses });
  } catch (err) {
    console.error('Courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
