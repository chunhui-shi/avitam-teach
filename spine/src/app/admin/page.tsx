import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/permissions';
import { Course, User } from '@/types';
import { AdminManager } from '@/components/admin/AdminManager';

export const dynamic = 'force-dynamic';

interface ManagedCourse extends Course {
  enrollment_count: number;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (!isAdmin(user)) redirect('/dashboard');

  const courses = await query<ManagedCourse>(`
    SELECT c.*,
      u.name AS instructor_name,
      COUNT(DISTINCT l.id)::int AS lesson_count,
      COUNT(DISTINCT e.id)::int AS enrollment_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.instructor_id
    LEFT JOIN lessons l ON l.course_id = c.id
    LEFT JOIN enrollments e ON e.course_id = c.id
    GROUP BY c.id, u.name
    ORDER BY c.created_at DESC
  `);

  const users = await query<User>(`
    SELECT id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <p className="text-gray-600 mt-1">Publish courses and manage user roles.</p>
      </div>
      <AdminManager initialCourses={courses} initialUsers={users} />
    </div>
  );
}
