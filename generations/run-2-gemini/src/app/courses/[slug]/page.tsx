import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock, PlayCircle, CheckCircle } from "lucide-react";
import EnrollButton from "@/components/EnrollButton";

export default async function CourseDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await getServerSession(authOptions);
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

  let isEnrolled = false;
  let completedLessons: string[] = [];

  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        enrollments: {
          where: { courseId: course.id },
        },
        subscriptions: {
          where: { status: "active" },
        },
        progress: {
          where: { lesson: { courseId: course.id } },
        },
      },
    });

    if (user) {
      isEnrolled = user.enrollments.length > 0 || user.subscriptions.length > 0;
      completedLessons = user.progress.map((p) => p.lessonId);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="lg:grid lg:grid-cols-3 lg:gap-x-12">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-extrabold text-gray-900">{course.title}</h1>
          <p className="mt-4 text-lg text-gray-500">{course.description}</p>

          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Course Content</h2>
            <div className="space-y-4">
              {course.lessons.map((lesson) => {
                const isCompleted = completedLessons.includes(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="flex items-center">
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      ) : (
                        <PlayCircle className="h-5 w-5 text-gray-400 mr-3" />
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {lesson.title}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">
                          {lesson.type.toLowerCase()} lesson
                        </p>
                      </div>
                    </div>
                    {isEnrolled ? (
                      <Link
                        href={`/courses/${course.slug}/lessons/${lesson.slug}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        Start
                      </Link>
                    ) : (
                      <Lock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-12 lg:mt-0">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden sticky top-8">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900">
                {isEnrolled ? "You're enrolled!" : "Join this course"}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {isEnrolled
                  ? "Continue your learning journey."
                  : "Get lifetime access to this course and all its materials."}
              </p>
              {!isEnrolled && (
                <div className="mt-6">
                  <div className="text-3xl font-bold text-gray-900 mb-6">
                    ${course.price || "0.00"}
                  </div>
                  <EnrollButton courseId={course.id} />
                </div>
              )}
              {isEnrolled && course.lessons.length > 0 && (
                <Link
                  href={`/courses/${course.slug}/lessons/${course.lessons[0].slug}`}
                  className="mt-6 block w-full text-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Continue Learning
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
