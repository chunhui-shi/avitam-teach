import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { authorizeCourseManagement } from '@/lib/authz';
import { slugify } from '@/lib/utils';
import { Lesson } from '@/types';
import { enqueueIngestion } from '@/lib/ingestion';

// List all lessons in a managed course (full rows, including unpublished/solution).
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

    const lessons = await query<Lesson>(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY position',
      [courseId]
    );
    return NextResponse.json({ lessons });
  } catch (err) {
    console.error('Manage lessons GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Add a lesson to a managed course.
export async function POST(
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

    const body = await req.json();
    const { title, content, lesson_type, code_starter, code_solution, code_language, quiz_data } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }
    const type = ['text', 'quiz', 'code'].includes(lesson_type) ? lesson_type : 'text';

    // Unique slug within the course.
    const base = slugify(title) || 'lesson';
    let slug = base;
    let n = 1;
    while (await queryOne('SELECT 1 FROM lessons WHERE course_id = $1 AND slug = $2', [courseId, slug])) {
      slug = `${base}-${n++}`;
    }

    // Append to the end.
    const max = await queryOne<{ max: number | null }>(
      'SELECT MAX(position) AS max FROM lessons WHERE course_id = $1',
      [courseId]
    );
    const position = (max?.max ?? 0) + 1;

    const lessons = await query<Lesson>(`
      INSERT INTO lessons
        (course_id, title, slug, position, content, lesson_type, code_starter, code_solution, code_language, quiz_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      courseId,
      title.trim(),
      slug,
      position,
      content,
      type,
      type === 'code' ? (code_starter ?? null) : null,
      type === 'code' ? (code_solution ?? null) : null,
      code_language || 'javascript',
      type === 'quiz' && quiz_data ? JSON.stringify(quiz_data) : null,
    ]);

    await enqueueIngestion(courseId, 'lesson', lessons[0].id);
    return NextResponse.json({ lesson: lessons[0] }, { status: 201 });
  } catch (err) {
    console.error('Manage lessons POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
