import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessonCompletions,
  lessons,
  modules,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .select({
      id: lessons.id,
      courseId: modules.courseId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id));

  const result = enrolled.map((c) => {
    const lessonsForCourse = allLessons.filter((l) => l.courseId === c.courseId);
    const total = lessonsForCourse.length;
    const done = lessonsForCourse.filter((l) => completedIds.has(l.id)).length;
    return {
      courseId: c.courseId,
      slug: c.slug,
      title: c.title,
      completed: done,
      total,
    };
  });

  return NextResponse.json({ courses: result });
}
