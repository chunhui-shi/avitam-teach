import Link from 'next/link';
import { notFound } from 'next/navigation';
import { queryOne, query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Course, Lesson, Enrollment } from '@/types';
import { formatPrice } from '@/lib/utils';
import { EnrollButton } from '@/components/course/EnrollButton';

export const dynamic = 'force-dynamic';

export default async function CourseDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  const courseId = parseInt(params.courseId);
  if (isNaN(courseId)) notFound();

  let course: Course | null = null;
  let lessons: Lesson[] = [];
  let enrolled = false;

  try {
    const session = await getSession();

    course = await queryOne<Course>(
      'SELECT * FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) notFound();

    if (session) {
      const enrollment = await queryOne<Enrollment>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      enrolled = !!enrollment;
    }

    if (enrolled || course.price_cents === 0) {
      const session2 = await getSession();
      if (session2) {
        lessons = await query<Lesson>(`
          SELECT l.*, lp.completed
          FROM lessons l
          LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
          WHERE l.course_id = $2
          ORDER BY l.position
        `, [session2.userId, courseId]);
      } else {
        lessons = await query<Lesson>(
          'SELECT * FROM lessons WHERE course_id = $1 ORDER BY position',
          [courseId]
        );
      }
    }
  } catch {
    // DB not available
  }

  if (!course) notFound();

  const completedCount = lessons.filter(l => l.completed).length;
  const progress = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Course header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            <p className="text-gray-600">{course.description}</p>
          </div>
          <span className={`text-2xl font-bold ${course.price_cents === 0 ? 'text-green-600' : 'text-indigo-600'}`}>
            {formatPrice(course.price_cents)}
          </span>
        </div>

        {enrolled && lessons.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{completedCount}/{lessons.length} lessons</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!enrolled && (
          <EnrollButton courseId={course.id} priceCents={course.price_cents} />
        )}
        {enrolled && (
          <span className="inline-flex items-center gap-2 text-green-600 font-medium">
            ✓ Enrolled
          </span>
        )}
      </div>

      {/* Lessons list */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="font-semibold text-gray-900">Lessons ({lessons.length})</h2>
        </div>
        {lessons.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            {course.price_cents > 0 && !enrolled
              ? 'Enroll to see lessons'
              : 'No lessons yet'}
          </div>
        )}
        {lessons.map((lesson, i) => {
          const canAccess = enrolled || course.price_cents === 0;
          const typeIcon = lesson.lesson_type === 'quiz' ? '📝' : lesson.lesson_type === 'code' ? '💻' : '📖';

          return (
            <div key={lesson.id} className="px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400 w-6">{i + 1}</span>
                <span className="text-lg">{typeIcon}</span>
                <div>
                  <p className="font-medium text-gray-900">{lesson.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{lesson.lesson_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {lesson.completed && (
                  <span className="text-green-500 text-sm">✓</span>
                )}
                {canAccess ? (
                  <Link
                    href={`/courses/${courseId}/lessons/${lesson.id}`}
                    className="text-indigo-600 text-sm hover:text-indigo-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {lesson.completed ? 'Review' : 'Start'} →
                  </Link>
                ) : (
                  <span className="text-gray-400 text-sm">🔒</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
