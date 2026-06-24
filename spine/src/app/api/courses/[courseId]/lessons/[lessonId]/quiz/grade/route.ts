import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Lesson, QuizQuestion, QuizGradeResult, Enrollment } from '@/types';

// v4-designed: grade a quiz on the server. The previous design graded in the
// browser using the answer key shipped with the lesson — which both leaked the
// answers and let the client report any score it liked. Here the server holds
// the key, checks the student's answers, computes the score, stores it, and
// returns only the result. This is a design change to where the boundary sits,
// not a patch — the same move that fixed the code sandbox in Chapter 6.
export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);
    if (isNaN(courseId) || isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const course = await queryOne<{ price_cents: number }>(
      'SELECT price_cents FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (course.price_cents > 0) {
      const enrollment = await queryOne<Enrollment>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      if (!enrollment) {
        return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
      }
    }

    const lesson = await queryOne<Lesson>(
      'SELECT id, lesson_type, quiz_data FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );
    if (!lesson || lesson.lesson_type !== 'quiz' || !lesson.quiz_data) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const { answers } = await req.json();
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers is required' }, { status: 400 });
    }

    const questions = lesson.quiz_data as QuizQuestion[];
    const results = questions.map((q) => {
      const correctIndex = q.correct ?? -1;
      return { id: q.id, correctIndex, wasCorrect: answers[q.id] === correctIndex };
    });
    const correctCount = results.filter((r) => r.wasCorrect).length;
    const total = questions.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const completed = score >= 60;

    // Persist the SERVER-computed score, not a client-supplied one.
    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, quiz_score, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         completed = EXCLUDED.completed,
         quiz_score = EXCLUDED.quiz_score,
         completed_at = EXCLUDED.completed_at`,
      [session.userId, lessonId, completed, score, completed ? new Date().toISOString() : null]
    );

    const body: QuizGradeResult = { score, total, correctCount, results };
    return NextResponse.json(body);
  } catch (err) {
    console.error('Quiz grade error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
