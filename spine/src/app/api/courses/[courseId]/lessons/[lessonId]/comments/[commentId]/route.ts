import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(
  req: Request,
  { params }: { params: { courseId: string; lessonId: string; commentId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);
    const commentId = parseInt(params.commentId);
    if (isNaN(courseId) || isNaN(lessonId) || isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const comment = await queryOne<{ id: number }>(`
      SELECT lc.id
      FROM lesson_comments lc
      JOIN lessons l ON l.id = lc.lesson_id
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN users u ON u.id = $4
      WHERE lc.id = $1
        AND lc.lesson_id = $2
        AND l.course_id = $3
        AND (lc.user_id = $4 OR c.instructor_id = $4 OR u.role = 'admin')
    `, [commentId, lessonId, courseId, session.userId]);

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    await query('DELETE FROM lesson_comments WHERE id = $1', [commentId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Comment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
