import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { canManageCourses, getCurrentUser, isAdmin } from '@/lib/permissions';
import { Course } from '@/types';
import { slugify } from '@/lib/utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!canManageCourses(user)) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const courses = await query<Course>(`
      SELECT c.*,
        u.name AS instructor_name,
        COUNT(DISTINCT l.id)::int AS lesson_count,
        COUNT(DISTINCT e.id)::int AS enrollment_count
      FROM courses c
      LEFT JOIN users u ON u.id = c.instructor_id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE ($1::boolean = true OR c.instructor_id = $2)
      GROUP BY c.id, u.name
      ORDER BY c.created_at DESC
    `, [isAdmin(user), user.id]);

    return NextResponse.json({ courses });
  } catch (err) {
    console.error('Instructor courses GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canManageCourses(user)) {
      return NextResponse.json({ error: 'Instructor access required' }, { status: 403 });
    }

    const { title, description, priceCents, imageUrl, published } = await req.json();
    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const baseSlug = slugify(title);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const course = await queryOne<Course>(`
      INSERT INTO courses (instructor_id, slug, title, description, price_cents, image_url, published)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      user.id,
      slug,
      title.trim(),
      description.trim(),
      Number(priceCents) || 0,
      imageUrl?.trim() || null,
      isAdmin(user) ? !!published : false,
    ]);

    return NextResponse.json({ course }, { status: 201 });
  } catch (err) {
    console.error('Instructor courses POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
