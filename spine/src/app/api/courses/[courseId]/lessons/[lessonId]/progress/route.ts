import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { QuizQuestion } from '@/types';

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

    // v1-tested fix for Known Issue #4a: verify the lesson actually belongs
    // to the given course AND that the user is enrolled (free courses: auto,
    // paid courses: explicit enrollment row).
    const course = await queryOne<{ price_cents: number }>(
      'SELECT price_cents FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const lesson = await queryOne<{
      id: number;
      lesson_type: string;
      quiz_data: QuizQuestion[] | null;
    }>(
      'SELECT id, lesson_type, quiz_data FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (course.price_cents > 0) {
      const enrollment = await queryOne<{ id: number }>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      if (!enrollment) {
        return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
      }
    }

    const { completed, quiz_answers, code_submission } = await req.json();

    // v1-tested fix for Known Issue #4b: compute quiz_score server-side from
    // `quiz_answers` (an array of submitted answer indices) against the
    // canonical `quiz_data.correct` field. Ignore any client-supplied
    // quiz_score entirely — it is a security input, not a state variable.
    let quizScore: number | null = null;
    if (lesson.lesson_type === 'quiz' && Array.isArray(lesson.quiz_data)) {
      if (Array.isArray(quiz_answers)) {
        const questions: QuizQuestion[] = lesson.quiz_data;
        const total = questions.length;
        let correct = 0;
        for (let i = 0; i < total; i++) {
          if (quiz_answers[i] === questions[i]?.correct) {
            correct++;
          }
        }
        quizScore = total > 0 ? Math.round((correct / total) * 100) : 0;
      } else {
        quizScore = 0;
      }
    }

    await query(
      `
      INSERT INTO lesson_progress (user_id, lesson_id, completed, quiz_score, code_submission, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        completed = EXCLUDED.completed,
        quiz_score = EXCLUDED.quiz_score,
        code_submission = EXCLUDED.code_submission,
        completed_at = EXCLUDED.completed_at
      `,
      [
        session.userId,
        lessonId,
        completed ?? false,
        quizScore,
        code_submission ? String(code_submission).substring(0, 10000) : null,
        completed ? new Date().toISOString() : null,
      ]
    );

    return NextResponse.json({ success: true, quiz_score: quizScore });
  } catch (err) {
    console.error('Progress error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
