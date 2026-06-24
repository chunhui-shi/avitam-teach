import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimited } from '@/lib/rate-limit';
import { LessonComment, Enrollment } from '@/types';

// Confirm the lesson exists in the course and the user may access it
// (free course, or enrolled). Returns null on success, or an error response.
async function checkAccess(userId: number, courseId: number, lessonId: number) {
  const course = await queryOne<{ price_cents: number }>(
    'SELECT price_cents FROM courses WHERE id = $1 AND published = true',
    [courseId]
  );
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const lesson = await queryOne<{ id: number }>(
    'SELECT id FROM lessons WHERE id = $1 AND course_id = $2',
    [lessonId, courseId]
  );
  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

  if (course.price_cents > 0) {
    const enrollment = await queryOne<Enrollment>(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (!enrollment) return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
  }
  return null;
}

// List the comments thread for a lesson.
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

    const denied = await checkAccess(session.userId, courseId, lessonId);
    if (denied) return denied;

    const comments = await query<LessonComment>(`
      SELECT lc.id, lc.lesson_id, lc.user_id, lc.parent_id, lc.body, lc.created_at,
        COALESCE(u.display_name, u.name) AS author_name,
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

// Post a comment or reply on a lesson.
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

    const denied = await checkAccess(session.userId, courseId, lessonId);
    if (denied) return denied;

    // Throttle comment posting per user to limit spam.
    const limited = rateLimited(`comments:${session.userId}`, 20, 60_000);
    if (limited) return limited;

    const { body, parent_id } = await req.json();
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }

    // If replying, the parent must belong to the same lesson.
    let parentId: number | null = null;
    if (parent_id !== undefined && parent_id !== null) {
      const parent = await queryOne<{ id: number }>(
        'SELECT id FROM lesson_comments WHERE id = $1 AND lesson_id = $2',
        [parent_id, lessonId]
      );
      if (!parent) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 400 });
      }
      parentId = parent.id;
    }

    const rows = await query<LessonComment>(`
      INSERT INTO lesson_comments (lesson_id, user_id, parent_id, body)
      VALUES ($1, $2, $3, $4)
      RETURNING id, lesson_id, user_id, parent_id, body, created_at
    `, [lessonId, session.userId, parentId, text.substring(0, 4000)]);

    return NextResponse.json({ comment: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Comments POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
