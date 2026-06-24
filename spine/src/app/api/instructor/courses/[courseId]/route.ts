import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeCourseManagement } from '@/lib/authz';
import { Course } from '@/types';

// Edit a course. Publishing/unpublishing is admin-only.
export async function PATCH(
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

    const { title, description, price_cents, published } = await req.json();

    // Only admins may change publish state.
    if (published !== undefined && authz.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can publish or unpublish courses' }, { status: 403 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (title !== undefined) { sets.push(`title = $${i++}`); values.push(String(title).trim()); }
    if (description !== undefined) { sets.push(`description = $${i++}`); values.push(String(description).trim()); }
    if (price_cents !== undefined) {
      const price = Number.isFinite(Number(price_cents)) ? Math.max(0, Math.round(Number(price_cents))) : 0;
      sets.push(`price_cents = $${i++}`); values.push(price);
    }
    if (published !== undefined) { sets.push(`published = $${i++}`); values.push(!!published); }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(courseId);
    const courses = await query<Course>(
      `UPDATE courses SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return NextResponse.json({ course: courses[0] });
  } catch (err) {
    console.error('Course PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
