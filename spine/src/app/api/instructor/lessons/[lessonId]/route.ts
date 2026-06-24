import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { canManageCourse, getCurrentUser } from '@/lib/permissions';
import { Lesson } from '@/types';

const lessonTypes = new Set(['text', 'quiz', 'code']);

async function getLessonCourseId(lessonId: number) {
  return queryOne<{ course_id: number }>(
    'SELECT course_id FROM lessons WHERE id = $1',
    [lessonId]
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  try {
    const lessonId = parseInt(params.lessonId);
    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
    }

    const lessonCourse = await getLessonCourseId(lessonId);
    if (!lessonCourse) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const user = await getCurrentUser();
    if (!(await canManageCourse(user, lessonCourse.course_id))) {
      return NextResponse.json({ error: 'Course access required' }, { status: 403 });
    }

    const body = await req.json();
    const lessonType = lessonTypes.has(body.lessonType) ? body.lessonType : 'text';
    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const lesson = await queryOne<Lesson>(`
      UPDATE lessons
      SET title = $1,
          position = $2,
          content = $3,
          lesson_type = $4,
          quiz_data = $5,
          code_starter = $6,
          code_solution = $7,
          code_language = $8
      WHERE id = $9
      RETURNING *
    `, [
      body.title.trim(),
      Number(body.position) || 0,
      body.content.trim(),
      lessonType,
      body.quizData || null,
      body.codeStarter || null,
      body.codeSolution || null,
      body.codeLanguage || 'javascript',
      lessonId,
    ]);

    return NextResponse.json({ lesson });
  } catch (err) {
    console.error('Instructor lesson PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  try {
    const lessonId = parseInt(params.lessonId);
    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
    }

    const lessonCourse = await getLessonCourseId(lessonId);
    if (!lessonCourse) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const user = await getCurrentUser();
    if (!(await canManageCourse(user, lessonCourse.course_id))) {
      return NextResponse.json({ error: 'Course access required' }, { status: 403 });
    }

    await query('DELETE FROM lessons WHERE id = $1', [lessonId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Instructor lesson DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
