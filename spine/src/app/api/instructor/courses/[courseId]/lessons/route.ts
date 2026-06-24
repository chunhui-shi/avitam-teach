import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { canManageCourse, getCurrentUser } from '@/lib/permissions';
import { Lesson } from '@/types';
import { slugify } from '@/lib/utils';

const lessonTypes = new Set(['text', 'quiz', 'code']);

export async function GET(
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

    const lessons = await query<Lesson>(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY position',
      [courseId]
    );
    return NextResponse.json({ lessons });
  } catch (err) {
    console.error('Instructor lessons GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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

    const body = await req.json();
    const lessonType = lessonTypes.has(body.lessonType) ? body.lessonType : 'text';
    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const nextPosition = await queryOne<{ position: number }>(
      'SELECT COALESCE(MAX(position), 0) + 1 AS position FROM lessons WHERE course_id = $1',
      [courseId]
    );

    const lesson = await queryOne<Lesson>(`
      INSERT INTO lessons (
        course_id, title, slug, position, content, lesson_type,
        quiz_data, code_starter, code_solution, code_language
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      courseId,
      body.title.trim(),
      `${slugify(body.title)}-${Date.now().toString(36)}`,
      nextPosition?.position || 1,
      body.content.trim(),
      lessonType,
      body.quizData || null,
      body.codeStarter || null,
      body.codeSolution || null,
      body.codeLanguage || 'javascript',
    ]);

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (err) {
    console.error('Instructor lessons POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
