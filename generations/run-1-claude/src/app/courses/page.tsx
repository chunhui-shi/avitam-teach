import Link from "next/link";
import { db } from "@/db";
import { courses } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const rows = await db.select().from(courses);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Course catalog</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((c) => (
          <li key={c.id} className="border rounded-lg p-5">
            <h2 className="text-xl font-semibold">
              <Link
                href={`/courses/${c.slug}`}
                className="hover:underline"
              >
                {c.title}
              </Link>
            </h2>
            <p className="text-neutral-600 text-sm mt-2">{c.description}</p>
            <p className="text-sm mt-3">
              {c.isFree ? (
                <span className="text-green-700 font-medium">Free</span>
              ) : (
                <span>${(c.priceCents / 100).toFixed(2)}</span>
              )}
            </p>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-neutral-500">
            No courses yet. Run <code>npm run db:seed</code>.
          </li>
        )}
      </ul>
    </div>
  );
}
