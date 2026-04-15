import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { isEnrolled } from "@/lib/enrollment";
import type { Course, Lesson } from "@/lib/types";
import EnrollButton from "./EnrollButton";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const cr = await query<Course>(
    "SELECT id, slug, title, description, price_cents, stripe_price_id, is_published FROM courses WHERE slug = $1",
    [params.slug]
  );
  if (cr.rows.length === 0) return notFound();
  const course = cr.rows[0];

  const lr = await query<Lesson>(
    "SELECT id, course_id, slug, title, position FROM lessons WHERE course_id = $1 ORDER BY position",
    [course.id]
  );
  const lessons = lr.rows;

  const user = await currentUser();
  const enrolled = user ? await isEnrolled(user.id, course.id) : false;

  return (
    <div>
      <Link className="muted" href="/courses">&larr; All courses</Link>
      <h1 style={{ marginTop: 12 }}>{course.title}</h1>
      <p className="muted">{course.description}</p>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            {course.price_cents === 0 ? (
              <span className="badge free">Free</span>
            ) : (
              <span className="badge">${(course.price_cents / 100).toFixed(2)}</span>
            )}
            <span style={{ marginLeft: 12 }} className="muted">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
            </span>
          </div>
          <div>
            {!user ? (
              <Link className="btn" href="/login">
                Log in to enroll
              </Link>
            ) : enrolled ? (
              <span className="success">You&apos;re enrolled</span>
            ) : (
              <EnrollButton
                courseId={course.id}
                isFree={course.price_cents === 0}
              />
            )}
          </div>
        </div>
      </div>

      <h2>Lessons</h2>
      <ul className="lesson-list">
        {lessons.map((l) => (
          <li key={l.id}>
            <span>
              {l.position}. {l.title}
            </span>
            {enrolled ? (
              <Link href={`/courses/${course.slug}/lessons/${l.slug}`}>Open</Link>
            ) : (
              <span className="muted">Locked</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
