import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentUser, canManageCourses, isAdmin } from '@/lib/permissions';
import { Course } from '@/types';
import { InstructorManager } from '@/components/instructor/InstructorManager';

export const dynamic = 'force-dynamic';

interface ManagedCourse extends Course {
  enrollment_count: number;
}

export default async function InstructorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (!canManageCourses(user)) redirect('/dashboard');

  const courses = await query<ManagedCourse>(`
    SELECT c.*,
      u.name AS instructor_name,
      COUNT(DISTINCT l.id)::int AS lesson_count,
      COUNT(DISTINCT e.id)::int AS enrollment_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.instructor_id
    LEFT JOIN lessons l ON l.course_id = c.id
    LEFT JOIN enrollments e ON e.course_id = c.id
    WHERE ($1::boolean = true OR c.instructor_id = $2)
    GROUP BY c.id, u.name
    ORDER BY c.created_at DESC
  `, [isAdmin(user), user.id]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
        <p className="text-gray-600 mt-1">Create courses, manage lessons, and review enrollments.</p>
      </div>
      <InstructorManager initialCourses={courses} isAdmin={isAdmin(user)} />
    </div>
  );
}
