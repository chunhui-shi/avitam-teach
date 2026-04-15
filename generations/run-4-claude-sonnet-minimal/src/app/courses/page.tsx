import { CourseCard } from '@/components/course/CourseCard';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Course } from '@/types';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  let courses: Course[] = [];

  try {
    const session = await getSession();

    if (session) {
      courses = await query<Course>(`
        SELECT c.*,
          COUNT(l.id)::int AS lesson_count,
          CASE WHEN e.id IS NOT NULL THEN true ELSE false END AS enrolled
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
        WHERE c.published = true
        GROUP BY c.id, e.id
        ORDER BY c.created_at DESC
      `, [session.userId]);
    } else {
      courses = await query<Course>(`
        SELECT c.*, COUNT(l.id)::int AS lesson_count, false AS enrolled
        FROM courses c
        LEFT JOIN lessons l ON l.course_id = c.id
        WHERE c.published = true
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
    }
  } catch {
    // DB not connected
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Courses</h1>
        <p className="text-gray-600 mt-2">Learn at your own pace with our structured coding curriculum.</p>
      </div>

      {courses.length === 0 ? (
        <p className="text-gray-500">No courses available yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
