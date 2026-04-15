import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import LessonContent from "@/components/LessonContent";
import AIAssistant from "@/components/AIAssistant";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function LessonPage({
  params,
}: {
  params: { slug: string; lessonSlug: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const course = await db.course.findUnique({
    where: { slug: params.slug },
    include: {
      lessons: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: {
      enrollments: { where: { courseId: course.id } },
      subscriptions: { where: { status: "active" } },
    },
  });

  const isEnrolled = user && (user.enrollments.length > 0 || user.subscriptions.length > 0);

  if (!isEnrolled) {
    redirect(`/courses/${params.slug}`);
  }

  const lesson = await db.lesson.findUnique({
    where: {
      courseId_slug: {
        courseId: course.id,
        slug: params.lessonSlug,
      },
    },
    include: {
      mcq: true,
      codeExercise: true,
    },
  });

  if (!lesson) {
    notFound();
  }

  const currentIdx = course.lessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? course.lessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < course.lessons.length - 1 ? course.lessons[currentIdx + 1] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-900 truncate">
              {course.title}
            </h2>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {course.lessons.map((l) => (
              <Link
                key={l.id}
                href={`/courses/${course.slug}/lessons/${l.slug}`}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  l.id === lesson.id
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="truncate">{l.title}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
                <div className="flex space-x-2">
                  {prevLesson && (
                    <Link
                      href={`/courses/${course.slug}/lessons/${prevLesson.slug}`}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Link>
                  )}
                  {nextLesson && (
                    <Link
                      href={`/courses/${course.slug}/lessons/${nextLesson.slug}`}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Link>
                  )}
                </div>
              </div>

              <LessonContent lesson={lesson as any} />
            </div>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 bg-white">
          <AIAssistant lessonId={lesson.id} lessonTitle={lesson.title} lessonContent={lesson.content || ""} />
        </div>
      </div>
    </div>
  );
}
