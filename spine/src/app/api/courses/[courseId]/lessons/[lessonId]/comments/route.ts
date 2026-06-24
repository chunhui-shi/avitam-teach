import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canAccessLessonDiscussion } from '@/lib/permissions';
import { LessonComment } from '@/types';

async function validateAccess(userId: number, courseId: number, lessonId: number) {
  const lesson = await queryOne<{ id: number }>(
    'SELECT id FROM lessons WHERE id = $1 AND course_id = $2',
    [lessonId, courseId]
  );
  if (!lesson) return false;
  return canAccessLessonDiscussion(userId, courseId);
}

export async function GET(
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

    if (!(await validateAccess(session.userId, courseId, lessonId))) {
      return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
    }

    const comments = await query<LessonComment>(`
      SELECT lc.*,
        u.name AS author_name,
        u.avatar_url AS author_avatar_url
      FROM lesson_comments lc
      JOIN users u ON u.id = lc.user_id
      WHERE lc.lesson_id = $1
      ORDER BY lc.created_at ASC
    `, [lessonId]);

    return NextResponse.json({ comments, currentUserId: session.userId });
  } catch (err) {
    console.error('Comments GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    if (!(await validateAccess(session.userId, courseId, lessonId))) {
      return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
    }

    const { body, parentId } = await req.json();
    if (!body?.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const comment = await queryOne<LessonComment>(`
      WITH inserted AS (
        INSERT INTO lesson_comments (lesson_id, user_id, parent_id, body)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      )
      SELECT inserted.*,
        u.name AS author_name,
        u.avatar_url AS author_avatar_url
      FROM inserted
      JOIN users u ON u.id = inserted.user_id
    `, [lessonId, session.userId, parentId || null, body.trim()]);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error('Comments POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
