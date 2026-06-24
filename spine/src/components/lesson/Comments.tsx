'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { LessonComment } from '@/types';

interface CommentsProps {
  courseId: number;
  lessonId: number;
}

// Minimal, safe formatting: escape HTML, then apply **bold**, *italic*,
// `code`, and line breaks. Returns markup for dangerouslySetInnerHTML.
function renderBody(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br />');
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: LessonComment;
  replies: LessonComment[];
  currentUserId: number | null;
  onReply: (parentId: number, body: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const name = comment.author_name || 'User';

  const submitReply = async () => {
    if (!replyText.trim() || busy) return;
    setBusy(true);
    await onReply(comment.id, replyText.trim());
    setReplyText('');
    setReplying(false);
    setBusy(false);
  };

  return (
    <div className="flex gap-3">
      {comment.author_avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comment.author_avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {initials(name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">{name}</span>
          <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
        </div>
        <div
          className="text-sm text-gray-700 mt-0.5 break-words"
          dangerouslySetInnerHTML={{ __html: renderBody(comment.body) }}
        />
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => setReplying(v => !v)}
            className="text-xs text-gray-500 hover:text-indigo-600"
          >
            Reply
          </button>
          {currentUserId === comment.user_id && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-2 flex gap-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              maxLength={4000}
              className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button onClick={submitReply} disabled={!replyText.trim()} loading={busy} size="sm">
              Reply
            </Button>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-3">
            {replies.map(r => (
              <div key={r.id} className="flex gap-3">
                {r.author_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.author_avatar_url} alt={r.author_name || 'User'} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {initials(r.author_name || 'User')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{r.author_name || 'User'}</span>
                    <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                  </div>
                  <div
                    className="text-sm text-gray-700 mt-0.5 break-words"
                    dangerouslySetInnerHTML={{ __html: renderBody(r.body) }}
                  />
                  {currentUserId === r.user_id && (
                    <button
                      onClick={() => onDelete(r.id)}
                      className="text-xs text-gray-500 hover:text-red-600 mt-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Comments({ courseId, lessonId }: CommentsProps) {
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const base = `/api/courses/${courseId}/lessons/${lessonId}/comments`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
        setCurrentUserId(data.currentUserId ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (parentId: number | null, body: string) => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, parent_id: parentId }),
    });
    if (res.ok) await load();
  };

  const submitTop = async () => {
    if (!input.trim() || posting) return;
    setPosting(true);
    await post(null, input.trim());
    setInput('');
    setPosting(false);
  };

  const remove = async (id: number) => {
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  };

  const topLevel = comments.filter(c => c.parent_id === null);
  const repliesFor = (id: number) => comments.filter(c => c.parent_id === id);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Discussion</h2>
      <p className="text-xs text-gray-500 mb-5">
        Supports <code className="bg-gray-100 px-1 rounded">**bold**</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">*italic*</code>, and{' '}
        <code className="bg-gray-100 px-1 rounded">`code`</code>.
      </p>

      <div className="flex gap-2 mb-6">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question or share a note…"
          rows={3}
          maxLength={4000}
          className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button onClick={submitTop} disabled={!input.trim()} loading={posting}>
          Post
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading comments…</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet. Be the first to start the discussion.</p>
      ) : (
        <div className="space-y-6">
          {topLevel.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesFor(c.id)}
              currentUserId={currentUserId}
              onReply={(pid, body) => post(pid, body)}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
