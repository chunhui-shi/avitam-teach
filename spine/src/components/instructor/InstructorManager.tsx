'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Course, Lesson } from '@/types';

interface ManagedCourse extends Course {
  enrollment_count?: number;
}

interface EnrollmentRow {
  id: number;
  enrolled_at: string;
  user_id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface InstructorManagerProps {
  initialCourses: ManagedCourse[];
  isAdmin?: boolean;
}

const emptyLesson = {
  title: '',
  lessonType: 'text',
  position: 0,
  content: '',
  quizDataText: '',
  codeStarter: '',
  codeSolution: '',
  codeLanguage: 'javascript',
};

export function InstructorManager({ initialCourses, isAdmin = false }: InstructorManagerProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(initialCourses[0]?.id || null);
  const selectedCourse = courses.find(course => course.id === selectedCourseId) || null;
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    priceCents: 0,
    imageUrl: '',
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCourseDetails = async (courseId: number) => {
    setSelectedCourseId(courseId);
    setError(null);
    const [lessonRes, enrollmentRes] = await Promise.all([
      fetch(`/api/instructor/courses/${courseId}/lessons`),
      fetch(`/api/instructor/courses/${courseId}/enrollments`),
    ]);
    if (lessonRes.ok) {
      const data = await lessonRes.json();
      setLessons(data.lessons);
    }
    if (enrollmentRes.ok) {
      const data = await enrollmentRes.json();
      setEnrollments(data.enrollments);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseDetails(selectedCourseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCourse = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch('/api/instructor/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseForm),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Course creation failed');
      return;
    }

    setCourses([data.course, ...courses]);
    setCourseForm({ title: '', description: '', priceCents: 0, imageUrl: '' });
    setMessage('Course created');
    router.refresh();
  };

  const updateCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCourse) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch(`/api/instructor/courses/${selectedCourse.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: selectedCourse.title,
        description: selectedCourse.description,
        priceCents: selectedCourse.price_cents,
        imageUrl: selectedCourse.image_url || '',
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Course update failed');
      return;
    }

    setCourses(courses.map(course => course.id === data.course.id ? data.course : course));
    setMessage('Course updated');
    router.refresh();
  };

  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCourseId) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    let quizData = null;
    if (lessonForm.quizDataText.trim()) {
      try {
        quizData = JSON.parse(lessonForm.quizDataText);
      } catch {
        setLoading(false);
        setError('Quiz data must be valid JSON');
        return;
      }
    }

    const payload = {
      title: lessonForm.title,
      lessonType: lessonForm.lessonType,
      position: lessonForm.position,
      content: lessonForm.content,
      quizData,
      codeStarter: lessonForm.codeStarter,
      codeSolution: lessonForm.codeSolution,
      codeLanguage: lessonForm.codeLanguage,
    };

    const res = await fetch(editingLessonId ? `/api/instructor/lessons/${editingLessonId}` : `/api/instructor/courses/${selectedCourseId}/lessons`, {
      method: editingLessonId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Lesson save failed');
      return;
    }

    if (editingLessonId) {
      setLessons(lessons.map(lesson => lesson.id === data.lesson.id ? data.lesson : lesson).sort((a, b) => a.position - b.position));
    } else {
      setLessons([...lessons, data.lesson].sort((a, b) => a.position - b.position));
    }
    setEditingLessonId(null);
    setLessonForm(emptyLesson);
    setMessage('Lesson saved');
    router.refresh();
  };

  const editLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      lessonType: lesson.lesson_type,
      position: lesson.position,
      content: lesson.content,
      quizDataText: lesson.quiz_data ? JSON.stringify(lesson.quiz_data, null, 2) : '',
      codeStarter: lesson.code_starter || '',
      codeSolution: lesson.code_solution || '',
      codeLanguage: lesson.code_language || 'javascript',
    });
  };

  const deleteLesson = async (lessonId: number) => {
    const res = await fetch(`/api/instructor/lessons/${lessonId}`, { method: 'DELETE' });
    if (res.ok) {
      setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      setMessage('Lesson deleted');
    }
  };

  const moveLesson = async (lessonId: number, direction: -1 | 1) => {
    const index = lessons.findIndex(lesson => lesson.id === lessonId);
    const targetIndex = index + direction;
    if (!selectedCourseId || targetIndex < 0 || targetIndex >= lessons.length) return;
    const reordered = [...lessons];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const updated = reordered.map((lesson, idx) => ({ ...lesson, position: idx + 1 }));
    setLessons(updated);
    await fetch(`/api/instructor/courses/${selectedCourseId}/lessons/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonIds: updated.map(lesson => lesson.id) }),
    });
  };

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}

      <form onSubmit={createCourse} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Course</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Title" value={courseForm.title} onChange={e => setCourseForm({ ...courseForm, title: e.target.value })} />
          <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Image URL" value={courseForm.imageUrl} onChange={e => setCourseForm({ ...courseForm, imageUrl: e.target.value })} />
          <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" type="number" min="0" placeholder="Price in cents" value={courseForm.priceCents} onChange={e => setCourseForm({ ...courseForm, priceCents: Number(e.target.value) })} />
          <textarea className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" rows={3} placeholder="Description" value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} />
        </div>
        <Button type="submit" loading={loading}>Create Course</Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Courses</h2>
          <div className="space-y-2">
            {courses.map(course => (
              <button
                key={course.id}
                type="button"
                onClick={() => loadCourseDetails(course.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedCourseId === course.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <span className="font-medium block">{course.title}</span>
                <span className="text-xs text-gray-500">{course.lesson_count || 0} lessons · {course.enrollment_count || 0} enrolled</span>
              </button>
            ))}
          </div>
        </div>

        {selectedCourse ? (
          <div className="space-y-6">
            <form onSubmit={updateCourse} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Course Details</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedCourse.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedCourse.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={selectedCourse.title} onChange={e => setCourses(courses.map(course => course.id === selectedCourse.id ? { ...course, title: e.target.value } : course))} />
              <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} value={selectedCourse.description} onChange={e => setCourses(courses.map(course => course.id === selectedCourse.id ? { ...course, description: e.target.value } : course))} />
              <div className="grid gap-4 md:grid-cols-2">
                <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" type="number" min="0" value={selectedCourse.price_cents} onChange={e => setCourses(courses.map(course => course.id === selectedCourse.id ? { ...course, price_cents: Number(e.target.value) } : course))} />
                <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={selectedCourse.image_url || ''} onChange={e => setCourses(courses.map(course => course.id === selectedCourse.id ? { ...course, image_url: e.target.value } : course))} placeholder="Image URL" />
              </div>
              <Button type="submit" loading={loading}>Save Course</Button>
            </form>

            <form onSubmit={saveLesson} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{editingLessonId ? 'Edit Lesson' : 'Add Lesson'}</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Lesson title" value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} />
                <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={lessonForm.lessonType} onChange={e => setLessonForm({ ...lessonForm, lessonType: e.target.value })}>
                  <option value="text">Text</option>
                  <option value="quiz">Quiz</option>
                  <option value="code">Code</option>
                </select>
              </div>
              <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" rows={8} placeholder="Markdown lesson content" value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} />
              {lessonForm.lessonType === 'quiz' && (
                <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" rows={6} placeholder="Quiz JSON array" value={lessonForm.quizDataText} onChange={e => setLessonForm({ ...lessonForm, quizDataText: e.target.value })} />
              )}
              {lessonForm.lessonType === 'code' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <textarea className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" rows={6} placeholder="Starter code" value={lessonForm.codeStarter} onChange={e => setLessonForm({ ...lessonForm, codeStarter: e.target.value })} />
                  <textarea className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" rows={6} placeholder="Solution code" value={lessonForm.codeSolution} onChange={e => setLessonForm({ ...lessonForm, codeSolution: e.target.value })} />
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" loading={loading}>{editingLessonId ? 'Update Lesson' : 'Add Lesson'}</Button>
                {editingLessonId && <Button type="button" variant="secondary" onClick={() => { setEditingLessonId(null); setLessonForm(emptyLesson); }}>Cancel</Button>}
              </div>
            </form>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Lessons</h2>
              <div className="divide-y divide-gray-100">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">{index + 1}. {lesson.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{lesson.lesson_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveLesson(lesson.id, -1)}>Up</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveLesson(lesson.id, 1)}>Down</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => editLesson(lesson)}>Edit</Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => deleteLesson(lesson.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {lessons.length === 0 && <p className="py-6 text-sm text-gray-500">No lessons yet.</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrolled Users</h2>
              <div className="divide-y divide-gray-100">
                {enrollments.map(enrollment => (
                  <div key={enrollment.id} className="py-3">
                    <p className="font-medium text-gray-900">{enrollment.name}</p>
                    <p className="text-sm text-gray-500">{enrollment.email}</p>
                  </div>
                ))}
                {enrollments.length === 0 && <p className="py-6 text-sm text-gray-500">No enrollments yet.</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Create or select a course.</div>
        )}
      </div>
    </div>
  );
}
