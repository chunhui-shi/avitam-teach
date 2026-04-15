import Link from "next/link";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { rows } = await query<{
    id: number;
    slug: string;
    title: string;
    description: string;
  }>(
    `SELECT c.id, c.slug, c.title, c.description
     FROM courses c
     JOIN enrollments e ON e.course_id = c.id
     WHERE e.user_id = $1 AND e.status = 'active'
     ORDER BY e.created_at DESC`,
    [user.id]
  );

  return (
    <div>
      <h1>Your dashboard</h1>
      <p className="muted">Welcome back, {user.name}.</p>
      <h2>Your courses</h2>
      {rows.length === 0 ? (
        <p className="muted">
          No enrollments yet. <Link href="/courses">Browse courses</Link>.
        </p>
      ) : (
        <div className="grid">
          {rows.map((c) => (
            <div key={c.id} className="card">
              <h3 style={{ marginTop: 0 }}>
                <Link href={`/courses/${c.slug}`}>{c.title}</Link>
              </h3>
              <p className="muted" style={{ fontSize: 14 }}>{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
