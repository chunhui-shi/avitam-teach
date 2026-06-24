'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Course, User } from '@/types';

interface ManagedCourse extends Course {
  enrollment_count?: number;
}

interface AdminManagerProps {
  initialCourses: ManagedCourse[];
  initialUsers: User[];
}

export function AdminManager({ initialCourses, initialUsers }: AdminManagerProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePublished = async (course: ManagedCourse) => {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/courses/${course.id}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !course.published }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Publish update failed');
      return;
    }
    setCourses(courses.map(item => item.id === course.id ? { ...item, published: data.course.published } : item));
    setMessage(data.course.published ? 'Course published' : 'Course unpublished');
    router.refresh();
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'User search failed');
      return;
    }
    setUsers(data.users);
  };

  const updateRole = async (userId: number, role: string) => {
    setError(null);
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Role update failed');
      return;
    }
    setUsers(users.map(user => user.id === userId ? data.user : user));
    setMessage('Role updated');
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Course Publishing</h2>
          <a href="/instructor" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Manage course content</a>
        </div>
        <div className="divide-y divide-gray-100">
          {courses.map(course => (
            <div key={course.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium text-gray-900">{course.title}</p>
                <p className="text-sm text-gray-500">
                  {course.instructor_name || 'No instructor'} · {course.lesson_count || 0} lessons · {course.enrollment_count || 0} enrolled
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${course.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {course.published ? 'Published' : 'Draft'}
                </span>
                <Button type="button" variant={course.published ? 'secondary' : 'primary'} size="sm" onClick={() => togglePublished(course)}>
                  {course.published ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Users</h2>
        <form onSubmit={searchUsers} className="flex gap-3 mb-4">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name or email"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="divide-y divide-gray-100">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <select
                value={user.role}
                onChange={event => updateRole(user.id, event.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
