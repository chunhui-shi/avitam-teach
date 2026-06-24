import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Delete a comment. Authors can delete their own; admins can delete any.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string; commentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const lessonId = parseInt(params.lessonId);
    const commentId = parseInt(params.commentId);
    if (isNaN(lessonId) || isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const comment = await queryOne<{ user_id: number }>(
      'SELECT user_id FROM lesson_comments WHERE id = $1 AND lesson_id = $2',
      [commentId, lessonId]
    );
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
    }

    // Replies cascade via the FK on parent_id.
    await query('DELETE FROM lesson_comments WHERE id = $1', [commentId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Comment DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
