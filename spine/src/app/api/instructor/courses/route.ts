import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { Course } from '@/types';

// List courses the current instructor owns (admins see all).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'instructor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Instructor or admin role required' }, { status: 403 });
    }

    let courses: Course[];
    if (user.role === 'admin') {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
    } else {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        WHERE c.instructor_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `, [user.id]);
    }

    return NextResponse.json({ courses });
  } catch (err) {
    console.error('Instructor courses GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new course owned by the current instructor.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'instructor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Instructor or admin role required' }, { status: 403 });
    }

    const { title, description, price_cents } = await req.json();
    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    // Build a unique slug.
    const base = slugify(title) || 'course';
    let slug = base;
    let n = 1;
    while (await query('SELECT 1 FROM courses WHERE slug = $1', [slug]).then(r => r.length > 0)) {
      slug = `${base}-${n++}`;
    }

    const price = Number.isFinite(Number(price_cents)) ? Math.max(0, Math.round(Number(price_cents))) : 0;

    const courses = await query<Course>(`
      INSERT INTO courses (slug, title, description, price_cents, published, instructor_id)
      VALUES ($1, $2, $3, $4, false, $5)
      RETURNING *
    `, [slug, title.trim(), description.trim(), price, user.id]);

    return NextResponse.json({ course: courses[0] }, { status: 201 });
  } catch (err) {
    console.error('Instructor courses POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
