import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { isEnrolled } from "@/lib/enrollment";
import type { Course, Lesson } from "@/lib/types";
import LessonView from "./LessonView";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: { slug: string; lessonSlug: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const cr = await query<Course>(
    "SELECT id, slug, title, description, price_cents, stripe_price_id, is_published FROM courses WHERE slug = $1",
    [params.slug]
  );
  if (cr.rows.length === 0) return notFound();
  const course = cr.rows[0];

  if (!(await isEnrolled(user.id, course.id))) {
    redirect(`/courses/${course.slug}`);
  }

  const lr = await query<Lesson>(
    `SELECT id, course_id, slug, title, position, content
     FROM lessons WHERE course_id = $1 AND slug = $2`,
    [course.id, params.lessonSlug]
  );
  if (lr.rows.length === 0) return notFound();
  const lesson = lr.rows[0];

  // Prev/next lessons
  const siblings = await query<{ slug: string; title: string; position: number }>(
    "SELECT slug, title, position FROM lessons WHERE course_id = $1 ORDER BY position",
    [course.id]
  );
  const idx = siblings.rows.findIndex((l) => l.slug === lesson.slug);
  const prev = idx > 0 ? siblings.rows[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.rows.length - 1 ? siblings.rows[idx + 1] : null;

  // Past assistant messages for this user+lesson.
  const hist = await query<{ role: string; content: string; created_at: Date }>(
    "SELECT role, content, created_at FROM assistant_messages WHERE user_id = $1 AND lesson_id = $2 ORDER BY created_at",
    [user.id, lesson.id]
  );

  return (
    <div>
      <Link className="muted" href={`/courses/${course.slug}`}>
        &larr; {course.title}
      </Link>
      <h1 style={{ marginTop: 12 }}>
        {lesson.position}. {lesson.title}
      </h1>

      <LessonView
        lesson={{
          id: lesson.id,
          title: lesson.title,
          content: Array.isArray(lesson.content) ? lesson.content : [],
        }}
        initialMessages={hist.rows.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))}
      />

      <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}>
        {prev ? (
          <Link className="btn secondary" href={`/courses/${course.slug}/lessons/${prev.slug}`}>
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="btn" href={`/courses/${course.slug}/lessons/${next.slug}`}>
            {next.title} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
