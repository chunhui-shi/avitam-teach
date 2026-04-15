import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

interface EnrolledCourse {
  id: number;
  title: string;
  description: string;
  price_cents: number;
  enrolled_at: string;
  lesson_count: number;
  completed_lessons: number;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  let user: User | null = null;
  let enrolledCourses: EnrolledCourse[] = [];

  try {
    user = await queryOne<User>(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [session.userId]
    );

    enrolledCourses = await query<EnrolledCourse>(`
      SELECT c.id, c.title, c.description, c.price_cents, e.enrolled_at,
        COUNT(l.id)::int AS lesson_count,
        COUNT(lp.id) FILTER (WHERE lp.completed = true)::int AS completed_lessons
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN lessons l ON l.course_id = c.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
      WHERE e.user_id = $1
      GROUP BY c.id, e.enrolled_at
      ORDER BY e.enrolled_at DESC
    `, [session.userId]);
  } catch {
    // DB not available
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Learning</h1>
        {user && (
          <p className="text-gray-600 mt-1">Welcome back, {user.name}!</p>
        )}
      </div>

      {enrolledCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">You haven&apos;t enrolled in any courses yet.</p>
          <Link
            href="/courses"
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {enrolledCourses.map((course) => {
            const progress = course.lesson_count > 0
              ? Math.round((course.completed_lessons / course.lesson_count) * 100)
              : 0;

            return (
              <div key={course.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{course.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{course.description}</p>
                  </div>
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-indigo-600 text-sm font-medium hover:text-indigo-700 shrink-0 ml-4"
                  >
                    {progress === 100 ? 'Review' : 'Continue'} →
                  </Link>
                </div>
                <div>
                  <div className="flex justify-between text-sm text-gray-500 mb-1.5">
                    <span>{course.completed_lessons}/{course.lesson_count} lessons</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-indigo-600'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
