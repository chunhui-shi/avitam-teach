import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { canManageCourse, getCurrentUser } from '@/lib/permissions';
import { Course } from '@/types';

export async function PUT(
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

    const { title, description, priceCents, imageUrl } = await req.json();
    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const course = await queryOne<Course>(`
      UPDATE courses
      SET title = $1, description = $2, price_cents = $3, image_url = $4
      WHERE id = $5
      RETURNING *
    `, [title.trim(), description.trim(), Number(priceCents) || 0, imageUrl?.trim() || null, courseId]);

    return NextResponse.json({ course });
  } catch (err) {
    console.error('Instructor course PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
