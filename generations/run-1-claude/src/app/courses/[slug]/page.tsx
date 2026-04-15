import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { courses, modules, lessons, enrollments } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/auth";
import EnrollButton from "./EnrollButton";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, params.slug))
    .limit(1);
  if (!course) return notFound();

  const courseModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position));

  const allLessons = await db
    .select()
    .from(lessons)
    .orderBy(asc(lessons.position));

  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;

  let enrolled = false;
  if (userId) {
    const [row] = await db
      .select()
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, course.id)),
      )
      .limit(1);
    enrolled = !!row;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold">{course.title}</h1>
        <p className="text-neutral-600 mt-2">{course.description}</p>
        <p className="text-sm mt-3">
          {course.isFree ? "Free" : `$${(course.priceCents / 100).toFixed(2)}`}
        </p>
        <div className="mt-4">
          {enrolled ? (
            <span className="text-green-700 font-medium">Enrolled</span>
          ) : (
            <EnrollButton courseId={course.id} isFree={course.isFree} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {courseModules.map((m) => {
          const mLessons = allLessons.filter((l) => l.moduleId === m.id);
          return (
            <section key={m.id}>
              <h2 className="text-xl font-semibold">{m.title}</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {mLessons.map((l) => (
                  <li key={l.id}>
                    {enrolled ? (
                      <Link
                        href={`/lessons/${l.id}`}
                        className="hover:underline"
                      >
                        {l.title}
                      </Link>
                    ) : (
                      <span className="text-neutral-500">{l.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
