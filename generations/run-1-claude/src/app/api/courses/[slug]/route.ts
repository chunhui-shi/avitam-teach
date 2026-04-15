import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, modules, lessons } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, params.slug))
    .limit(1);
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const courseModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.position));

  const allLessons = await db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      title: lessons.title,
      position: lessons.position,
    })
    .from(lessons)
    .orderBy(asc(lessons.position));

  return NextResponse.json({
    course,
    modules: courseModules.map((m) => ({
      ...m,
      lessons: allLessons.filter((l) => l.moduleId === m.id),
    })),
  });
}
