'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LessonComment } from '@/types';

interface LessonCommentsProps {
  courseId: number;
  lessonId: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatComment(body: string) {
  return escapeHtml(body)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br />');
}

export function LessonComments({ courseId, lessonId }: LessonCommentsProps) {
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    setLoading(true);
    const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/comments`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Comments unavailable');
      return;
    }
    setComments(data.comments);
    setCurrentUserId(data.currentUserId);
    setError(null);
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId]);

  const rootComments = useMemo(
    () => comments.filter(comment => !comment.parent_id),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    return comments.reduce<Record<number, LessonComment[]>>((acc, comment) => {
      if (comment.parent_id) {
        acc[comment.parent_id] = [...(acc[comment.parent_id] || []), comment];
      }
      return acc;
    }, {});
  }, [comments]);

  const submitComment = async (event: FormEvent, parentId?: number) => {
    event.preventDefault();
    const text = parentId ? replyBody : body;
    if (!text.trim()) return;

    const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, parentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Comment failed');
      return;
    }
    setComments([...comments, data.comment]);
    setBody('');
    setReplyBody('');
    setReplyTo(null);
    setError(null);
  };

  const deleteComment = async (commentId: number) => {
    const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setComments(comments.filter(comment => comment.id !== commentId && comment.parent_id !== commentId));
    }
  };

  const renderComment = (comment: LessonComment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-12 border-l border-gray-200 pl-4' : ''} py-4`}>
      <div className="flex items-start gap-3">
        {comment.author_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border border-gray-200" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
            {comment.author_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-gray-900">{comment.author_name}</span>
            <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
          </div>
          <div
            className="text-sm text-gray-700 leading-relaxed mt-1"
            dangerouslySetInnerHTML={{ __html: formatComment(comment.body) }}
          />
          <div className="flex items-center gap-3 mt-2">
            {!isReply && (
              <button type="button" className="text-xs font-medium text-indigo-600 hover:text-indigo-700" onClick={() => setReplyTo(comment.id)}>
                Reply
              </button>
            )}
            {currentUserId === comment.user_id && (
              <button type="button" className="text-xs font-medium text-red-600 hover:text-red-700" onClick={() => deleteComment(comment.id)}>
                Delete
              </button>
            )}
          </div>
          {replyTo === comment.id && (
            <form onSubmit={(event) => submitComment(event, comment.id)} className="mt-3 space-y-2">
              <textarea
                value={replyBody}
                onChange={event => setReplyBody(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Write a reply..."
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">Post Reply</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setReplyTo(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Discussion</h2>
      <form onSubmit={(event) => submitComment(event)} className="space-y-3 mb-6">
        <textarea
          value={body}
          onChange={event => setBody(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Ask a question or share an insight..."
        />
        <Button type="submit">Post Comment</Button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading comments...</p>}
      {!loading && rootComments.length === 0 && !error && (
        <p className="text-sm text-gray-500">No comments yet.</p>
      )}
      <div className="divide-y divide-gray-100">
        {rootComments.map(comment => (
          <div key={comment.id}>
            {renderComment(comment)}
            {(repliesByParent[comment.id] || []).map(reply => renderComment(reply, true))}
          </div>
        ))}
      </div>
    </div>
  );
}
