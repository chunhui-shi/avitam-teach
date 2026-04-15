import Link from "next/link";
import db from "@/lib/db";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);
  const courses = await db.course.findMany({
    where: { isPublished: true },
    include: {
      lessons: {
        select: { id: true },
      },
    },
  });

  let enrolledCourses: string[] = [];
  let isSubscribed = false;

  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        enrollments: true,
        subscriptions: {
          where: { status: "active" },
        },
      },
    });

    if (user) {
      enrolledCourses = user.enrollments.map((e) => e.courseId);
      isSubscribed = user.subscriptions.length > 0;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            All Courses
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse our collection of coding courses.
          </p>
        </div>
        {!isSubscribed && (
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link
              href="/subscribe"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Subscribe for $19.99/mo
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const isEnrolled = isSubscribed || enrolledCourses.includes(course.id);
          return (
            <div
              key={course.id}
              className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col"
            >
              <div className="p-5 flex-grow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 leading-6">
                      {course.title}
                    </h3>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-500 line-clamp-3">
                    {course.description}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-4 mt-auto">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    {course.price ? `$${course.price}` : "Free"}
                  </div>
                  {isEnrolled ? (
                    <Link
                      href={`/courses/${course.slug}`}
                      className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      View Course
                    </Link>
                  ) : (
                    <Link
                      href={`/courses/${course.slug}`}
                      className="inline-flex items-center text-sm font-medium text-gray-900 hover:text-gray-700"
                    >
                      Learn More →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
