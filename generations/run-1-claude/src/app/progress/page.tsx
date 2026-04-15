import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessonCompletions,
  lessons,
  modules,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = Number((session.user as { id?: string }).id);

  const enrolled = await db
    .select({
      courseId: enrollments.courseId,
      slug: courses.slug,
      title: courses.title,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId));

  const completions = await db
    .select({ lessonId: lessonCompletions.lessonId })
    .from(lessonCompletions)
    .where(eq(lessonCompletions.userId, userId));
  const completedIds = new Set(completions.map((c) => c.lessonId));

  const allLessons = await db
    .select({ id: lessons.id, courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">My progress</h1>
      {enrolled.length === 0 && (
        <p className="text-neutral-500">
          You are not enrolled in any courses yet.{" "}
          <Link href="/courses" className="underline">
            Browse the catalog.
          </Link>
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {enrolled.map((c) => {
          const lessonsForCourse = allLessons.filter(
            (l) => l.courseId === c.courseId,
          );
          const total = lessonsForCourse.length;
          const done = lessonsForCourse.filter((l) =>
            completedIds.has(l.id),
          ).length;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          return (
            <li
              key={c.courseId}
              className="border rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center">
                <Link
                  href={`/courses/${c.slug}`}
                  className="font-semibold hover:underline"
                >
                  {c.title}
                </Link>
                <span className="text-sm text-neutral-600">
                  {done} / {total} lessons ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-neutral-200 rounded">
                <div
                  className="h-2 bg-neutral-900 rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
