import { db } from "@/db";
import { enrollments, lessons, modules } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function userHasAccessToLesson(
  userId: number,
  lessonId: number,
): Promise<boolean> {
  // lesson -> module -> course; then check enrollment.
  const rows = await db
    .select({ courseId: modules.courseId })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  const courseId = rows[0]?.courseId;
  if (!courseId) return false;
  const [enr] = await db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    )
    .limit(1);
  return !!enr;
}
