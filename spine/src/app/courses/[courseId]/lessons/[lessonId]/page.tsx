import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { queryOne, query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Lesson, Course, Enrollment } from '@/types';
import { CodeEditor } from '@/components/lesson/CodeEditor';
import { QuizWidget } from '@/components/lesson/QuizWidget';
import { AIAssistant } from '@/components/lesson/AIAssistant';
import { LessonComments } from '@/components/lesson/LessonComments';

export const dynamic = 'force-dynamic';

// Simple markdown to HTML for lesson content
function renderMarkdown(content: string): string {
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm font-mono">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim() && !c.trim().match(/^[-:]+$/));
      return '<tr>' + cells.map(c => `<td class="border border-gray-200 px-4 py-2 text-sm">${c.trim()}</td>`).join('') + '</tr>';
    })
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-4">');
}

export default async function LessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const courseId = parseInt(params.courseId);
  const lessonId = parseInt(params.lessonId);

  if (isNaN(courseId) || isNaN(lessonId)) notFound();

  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  let course: Course | null = null;
  let lesson: Lesson | null = null;
  let lessons: Lesson[] = [];
  let currentIndex = 0;

  try {
    course = await queryOne<Course>(
      'SELECT * FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) notFound();

    // Check enrollment for paid courses
    if (course.price_cents > 0) {
      const enrollment = await queryOne<Enrollment>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      if (!enrollment) {
        redirect(`/courses/${courseId}`);
      }
    }

    lesson = await queryOne<Lesson>(
      'SELECT * FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );

    if (!lesson) notFound();

    lessons = await query<Lesson>(
      'SELECT id, title, position, lesson_type FROM lessons WHERE course_id = $1 ORDER BY position',
      [courseId]
    );

    currentIndex = lessons.findIndex(l => l.id === lessonId);
  } catch {
    notFound();
  }

  if (!course || !lesson) notFound();

  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;
  const htmlContent = renderMarkdown(lesson.content);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-500 flex items-center gap-2">
        <Link href="/courses" className="hover:text-gray-700">Courses</Link>
        <span>›</span>
        <Link href={`/courses/${courseId}`} className="hover:text-gray-700">{course.title}</Link>
        <span>›</span>
        <span className="text-gray-900">{lesson.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: lesson list */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Course Lessons</h3>
            <div className="space-y-1">
              {lessons.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/courses/${courseId}/lessons/${l.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    l.id === lessonId
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-400 text-xs w-4">{i + 1}</span>
                  <span className="truncate">{l.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">
                {lesson.lesson_type === 'quiz' ? '📝' : lesson.lesson_type === 'code' ? '💻' : '📖'}
              </span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
                <p className="text-sm text-gray-500 capitalize">{lesson.lesson_type} lesson</p>
              </div>
            </div>

            {/* Lesson content */}
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: `<p class="text-gray-700 leading-relaxed mb-4">${htmlContent}</p>` }}
            />
          </div>

          {/* Quiz */}
          {lesson.lesson_type === 'quiz' && lesson.quiz_data && lesson.quiz_data.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quiz</h2>
              <QuizWidget
                questions={lesson.quiz_data}
                lessonId={lesson.id}
                courseId={courseId}
              />
            </div>
          )}

          {/* Code editor */}
          {lesson.lesson_type === 'code' && lesson.code_starter && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Code Exercise</h2>
              <CodeEditor
                initialCode={lesson.code_starter}
                language={lesson.code_language}
                lessonId={lesson.id}
                courseId={courseId}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {prevLesson ? (
              <Link
                href={`/courses/${courseId}/lessons/${prevLesson.id}`}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ← {prevLesson.title}
              </Link>
            ) : <div />}
            {nextLesson ? (
              <Link
                href={`/courses/${courseId}/lessons/${nextLesson.id}`}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {nextLesson.title} →
              </Link>
            ) : (
              <Link
                href={`/courses/${courseId}`}
                className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
              >
                ✓ Finish Course
              </Link>
            )}
          </div>

          <LessonComments courseId={courseId} lessonId={lessonId} />
        </div>
      </div>

      {/* AI Assistant (floating) */}
      <AIAssistant courseId={courseId} lessonId={lessonId} />
    </div>
  );
}
