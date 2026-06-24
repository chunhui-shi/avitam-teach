import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { authorizeCourseManagement } from '@/lib/authz';
import { Lesson } from '@/types';

// Edit or reorder a lesson within a managed course.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);
    if (isNaN(courseId) || isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const authz = await authorizeCourseManagement(courseId);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const lesson = await queryOne<Lesson>(
      'SELECT * FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content, lesson_type, position, code_starter, code_solution, code_language, quiz_data } = body;

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (title !== undefined) { sets.push(`title = $${i++}`); values.push(String(title).trim()); }
    if (content !== undefined) { sets.push(`content = $${i++}`); values.push(String(content)); }
    if (lesson_type !== undefined && ['text', 'quiz', 'code'].includes(lesson_type)) {
      sets.push(`lesson_type = $${i++}`); values.push(lesson_type);
    }
    if (position !== undefined && Number.isFinite(Number(position))) {
      sets.push(`position = $${i++}`); values.push(Math.round(Number(position)));
    }
    if (code_starter !== undefined) { sets.push(`code_starter = $${i++}`); values.push(code_starter ?? null); }
    if (code_solution !== undefined) { sets.push(`code_solution = $${i++}`); values.push(code_solution ?? null); }
    if (code_language !== undefined) { sets.push(`code_language = $${i++}`); values.push(code_language || 'javascript'); }
    if (quiz_data !== undefined) {
      sets.push(`quiz_data = $${i++}`);
      values.push(quiz_data ? JSON.stringify(quiz_data) : null);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(lessonId);
    const lessons = await query<Lesson>(
      `UPDATE lessons SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return NextResponse.json({ lesson: lessons[0] });
  } catch (err) {
    console.error('Lesson PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a lesson from a managed course.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);
    if (isNaN(courseId) || isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const authz = await authorizeCourseManagement(courseId);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    const deleted = await query(
      'DELETE FROM lessons WHERE id = $1 AND course_id = $2 RETURNING id',
      [lessonId, courseId]
    );
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Lesson DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
