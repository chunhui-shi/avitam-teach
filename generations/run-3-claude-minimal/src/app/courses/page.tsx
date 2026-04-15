import Link from "next/link";
import { query } from "@/lib/db";
import type { Course } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  let courses: Course[] = [];
  try {
    const r = await query<Course>(
      "SELECT id, slug, title, description, price_cents, stripe_price_id, is_published FROM courses WHERE is_published = TRUE ORDER BY id"
    );
    courses = r.rows;
  } catch {
    courses = [];
  }

  return (
    <div>
      <h1>Courses</h1>
      {courses.length === 0 ? (
        <p className="muted">No courses yet. Run <code>npm run db:init &amp;&amp; npm run db:seed</code> to load sample data.</p>
      ) : (
        <div className="grid">
          {courses.map((c) => (
            <div key={c.id} className="card">
              <h3 style={{ marginTop: 0 }}>
                <Link href={`/courses/${c.slug}`}>{c.title}</Link>
              </h3>
              <p className="muted" style={{ fontSize: 14 }}>{c.description}</p>
              <div style={{ marginTop: 12 }}>
                {c.price_cents === 0 ? (
                  <span className="badge free">Free</span>
                ) : (
                  <span className="badge">${(c.price_cents / 100).toFixed(2)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
