import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { lessons, type LessonBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { userHasAccessToLesson } from "@/lib/access";
import LessonView from "./LessonView";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return notFound();

  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = Number((session.user as { id?: string }).id);

  const access = await userHasAccessToLesson(userId, id);
  if (!access) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Locked</h1>
        <p className="mt-2 text-neutral-600">
          You need to enroll in this course to view this lesson.
        </p>
      </div>
    );
  }

  const [row] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!row) return notFound();

  // Redact correct answers before serialization to the client.
  const safeBlocks: LessonBlock[] = row.blocks.map((b) => {
    if (b.type === "quiz") {
      return {
        type: "quiz",
        question: b.question,
        options: b.options,
        answerIndex: -1,
      };
    }
    return b;
  });

  return <LessonView id={row.id} title={row.title} blocks={safeBlocks} />;
}
