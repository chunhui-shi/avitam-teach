'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Course, CourseMaterial, Lesson } from '@/types';

interface CourseManagerProps {
  course: Course;
  isAdmin: boolean;
  onCourseChange: (course: Course) => void;
}

interface Enrollee {
  user_id: number;
  name: string;
  email: string;
  enrolled_at: string;
  completed_lessons: number;
}

type Tab = 'details' | 'lessons' | 'materials' | 'enrollees';

export function CourseManager({ course, isAdmin, onCourseChange }: CourseManagerProps) {
  const [tab, setTab] = useState<Tab>('details');
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['details', 'lessons', 'materials', 'enrollees'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm px-3 py-1.5 rounded-lg capitalize ${
              tab === t ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'details' && <DetailsTab course={course} isAdmin={isAdmin} onCourseChange={onCourseChange} />}
      {tab === 'lessons' && <LessonsTab courseId={course.id} />}
      {tab === 'materials' && <MaterialsTab courseId={course.id} />}
      {tab === 'enrollees' && <EnrolleesTab courseId={course.id} />}
    </div>
  );
}

function DetailsTab({ course, isAdmin, onCourseChange }: CourseManagerProps) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [priceDollars, setPriceDollars] = useState((course.price_cents / 100).toString());
  const [published, setPublished] = useState(course.published);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (overrides: Record<string, unknown> = {}) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/instructor/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price_cents: Math.round(parseFloat(priceDollars || '0') * 100),
          ...overrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save');
        return;
      }
      onCourseChange(data.course);
      setPublished(data.course.published);
      setMessage('Saved.');
    } catch {
      setError('Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = () => save({ published: !published });

  return (
    <div className="space-y-3 max-w-xl">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Price ($)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={priceDollars}
          onChange={e => setPriceDollars(e.target.value)}
          className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={() => save()} loading={saving} size="sm">Save details</Button>
        {isAdmin ? (
          <Button onClick={togglePublish} variant={published ? 'secondary' : 'outline'} size="sm">
            {published ? 'Unpublish' : 'Publish'}
          </Button>
        ) : (
          <span className="text-xs text-gray-400">
            {published ? 'Published' : 'Awaiting admin to publish'}
          </span>
        )}
      </div>
    </div>
  );
}

function LessonsTab({ courseId }: { courseId: number }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [lessonType, setLessonType] = useState<'text' | 'quiz' | 'code'>('text');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/lessons`);
      const data = await res.json();
      if (res.ok) setLessons(data.lessons || []);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const addLesson = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, lesson_type: lessonType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add lesson');
        return;
      }
      setTitle('');
      setContent('');
      setLessonType('text');
      await load();
    } finally {
      setAdding(false);
    }
  };

  const move = async (lesson: Lesson, dir: -1 | 1) => {
    const sorted = [...lessons].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(l => l.id === lesson.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    // Swap positions on the server.
    await Promise.all([
      fetch(`/api/instructor/courses/${courseId}/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: swapWith.position }),
      }),
      fetch(`/api/instructor/courses/${courseId}/lessons/${swapWith.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: lesson.position }),
      }),
    ]);
    await load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/instructor/courses/${courseId}/lessons/${id}`, { method: 'DELETE' });
    await load();
  };

  const sorted = [...lessons].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-gray-500">Loading lessons…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No lessons yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {sorted.map((l, i) => (
            <li key={l.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                <LessonRow courseId={courseId} lesson={l} onChange={load} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(l, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↑</button>
                <button onClick={() => move(l, 1)} disabled={i === sorted.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">↓</button>
                <button onClick={() => remove(l.id)} className="text-gray-400 hover:text-red-600 px-1 text-sm">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-gray-100 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">Add lesson</p>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Lesson title"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Lesson content (markdown)"
          rows={3}
          className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-3">
          <select
            value={lessonType}
            onChange={e => setLessonType(e.target.value as 'text' | 'quiz' | 'code')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="text">Text</option>
            <option value="quiz">Quiz</option>
            <option value="code">Code</option>
          </select>
          <Button onClick={addLesson} loading={adding} size="sm">Add lesson</Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function LessonRow({ courseId, lesson, onChange }: { courseId: number; lesson: Lesson; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);
  const [saving, setSaving] = useState(false);

  const icon = lesson.lesson_type === 'quiz' ? '📝' : lesson.lesson_type === 'code' ? '💻' : '📖';

  const save = async () => {
    setSaving(true);
    await fetch(`/api/instructor/courses/${courseId}/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    setSaving(false);
    setEditing(false);
    onChange();
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-2 min-w-0 text-left">
        <span>{icon}</span>
        <span className="text-sm text-gray-800 truncate">{lesson.title}</span>
      </button>
    );
  }

  return (
    <div className="flex-1 space-y-2 py-1">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        className="w-full resize-none border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <Button onClick={save} loading={saving} size="sm">Save</Button>
        <Button onClick={() => setEditing(false)} variant="ghost" size="sm">Cancel</Button>
      </div>
    </div>
  );
}

function MaterialsTab({ courseId }: { courseId: number }) {
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/materials`);
      const data = await res.json();
      if (res.ok) setMaterials(data.materials || []);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!materials.some(material => material.status === 'pending' || material.status === 'processing')) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [materials, load]);

  const upload = async () => {
    if (!file) {
      setError('Choose a text, Markdown, or PDF file.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('material', file);
      if (title.trim()) form.set('title', title.trim());
      const res = await fetch(`/api/instructor/courses/${courseId}/materials`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not upload material');
        return;
      }
      setFile(null);
      setTitle('');
      await load();
    } finally {
      setUploading(false);
    }
  };

  const retry = async (id: number) => {
    await fetch(`/api/instructor/courses/${courseId}/materials/${id}`, { method: 'PATCH' });
    await load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/instructor/courses/${courseId}/materials/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-lg p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Add course material</p>
          <p className="text-xs text-gray-500 mt-1">
            UTF-8 text, Markdown, or PDF up to 10 MB. The assistant uses ready material as cited evidence.
          </p>
        </div>
        <input
          type="text"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Display title (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="file"
          accept="text/plain,text/markdown,.md,.txt,application/pdf,.pdf"
          onChange={event => setFile(event.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-600"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={upload} loading={uploading} size="sm">Upload and index</Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading materials…</p>
      ) : materials.length === 0 ? (
        <p className="text-sm text-gray-500">No course materials yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {materials.map(material => (
            <li key={material.id} className="flex items-center justify-between px-3 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{material.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {material.filename} · {material.status}
                  {material.error_message ? ` · ${material.error_message}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {material.status === 'failed' && (
                  <Button onClick={() => retry(material.id)} variant="ghost" size="sm">Retry</Button>
                )}
                <Button onClick={() => remove(material.id)} variant="ghost" size="sm">Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnrolleesTab({ courseId }: { courseId: number }) {
  const [enrollees, setEnrollees] = useState<Enrollee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/instructor/courses/${courseId}/enrollments`);
        const data = await res.json();
        if (res.ok) setEnrollees(data.enrollees || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  if (loading) return <p className="text-sm text-gray-500">Loading enrollees…</p>;
  if (enrollees.length === 0) return <p className="text-sm text-gray-500">No one is enrolled yet.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-100">
          <th className="py-2 font-medium">Name</th>
          <th className="py-2 font-medium">Email</th>
          <th className="py-2 font-medium">Completed</th>
          <th className="py-2 font-medium">Enrolled</th>
        </tr>
      </thead>
      <tbody>
        {enrollees.map(e => (
          <tr key={e.user_id} className="border-b border-gray-50">
            <td className="py-2 text-gray-800">{e.name}</td>
            <td className="py-2 text-gray-500">{e.email}</td>
            <td className="py-2 text-gray-500">{e.completed_lessons} lessons</td>
            <td className="py-2 text-gray-500">{new Date(e.enrolled_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
