'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Course } from '@/types';
import { formatPrice } from '@/lib/utils';
import { CourseManager } from './CourseManager';

interface InstructorDashboardProps {
  initialCourses: Course[];
  isAdmin: boolean;
}

export function InstructorDashboard({ initialCourses, isAdmin }: InstructorDashboardProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [expanded, setExpanded] = useState<number | null>(null);

  // New course form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceDollars, setPriceDollars] = useState('0');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCourse = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/instructor/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price_cents: Math.round(parseFloat(priceDollars || '0') * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create course');
        return;
      }
      setCourses(prev => [{ ...data.course, lesson_count: 0 }, ...prev]);
      setTitle('');
      setDescription('');
      setPriceDollars('0');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const updateCourse = (updated: Course) => {
    setCourses(prev => prev.map(c => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  return (
    <div className="space-y-8">
      {/* Create course */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">New course</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Course title"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
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
            <span className="text-xs text-gray-400">0 = free</span>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={createCourse} loading={creating}>
            Create course
          </Button>
        </div>
      </div>

      {/* Courses */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900">Your courses ({courses.length})</h2>
        {courses.length === 0 && (
          <p className="text-sm text-gray-500">No courses yet. Create one above.</p>
        )}
        {courses.map(course => (
          <div key={course.id} className="bg-white rounded-xl border border-gray-200">
            <div className="p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{course.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${course.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {course.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{course.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatPrice(course.price_cents)} · {course.lesson_count ?? 0} lessons
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(expanded === course.id ? null : course.id)}
              >
                {expanded === course.id ? 'Close' : 'Manage'}
              </Button>
            </div>
            {expanded === course.id && (
              <div className="border-t border-gray-100 p-5">
                <CourseManager course={course} isAdmin={isAdmin} onCourseChange={updateCourse} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
