import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const lessonId = parseInt(params.lessonId);
    if (isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
    }

    const { completed, quiz_score, code_submission } = await req.json();

    await query(`
      INSERT INTO lesson_progress (user_id, lesson_id, completed, quiz_score, code_submission, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        completed = EXCLUDED.completed,
        quiz_score = EXCLUDED.quiz_score,
        code_submission = EXCLUDED.code_submission,
        completed_at = EXCLUDED.completed_at
    `, [
      session.userId,
      lessonId,
      completed ?? false,
      quiz_score ?? null,
      code_submission ? code_submission.substring(0, 10000) : null,
      completed ? new Date().toISOString() : null,
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Progress error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
