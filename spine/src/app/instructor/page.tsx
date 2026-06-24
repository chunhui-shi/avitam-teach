import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { Course } from '@/types';
import { InstructorDashboard } from '@/components/instructor/InstructorDashboard';

export const dynamic = 'force-dynamic';

export default async function InstructorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role !== 'instructor' && user.role !== 'admin') redirect('/dashboard');

  let courses: Course[] = [];
  try {
    if (user.role === 'admin') {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count
        FROM courses c LEFT JOIN lessons l ON l.course_id = c.id
        GROUP BY c.id ORDER BY c.created_at DESC
      `);
    } else {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count
        FROM courses c LEFT JOIN lessons l ON l.course_id = c.id
        WHERE c.instructor_id = $1
        GROUP BY c.id ORDER BY c.created_at DESC
      `, [user.id]);
    }
  } catch {
    // DB not available
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
        <p className="text-gray-600 mt-1">
          {user.role === 'admin' ? 'Managing all courses.' : 'Create and manage your courses.'}
        </p>
      </div>
      <InstructorDashboard initialCourses={courses} isAdmin={user.role === 'admin'} />
    </div>
  );
}
