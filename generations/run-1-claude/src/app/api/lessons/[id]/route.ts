import { NextResponse } from "next/server";
import { db } from "@/db";
import { lessons, type LessonBlock } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { userHasAccessToLesson } from "@/lib/access";

export const dynamic = "force-dynamic";

// Strip correct-answer information from quiz blocks before returning to
// client, so the correct answer is not visible in the HTTP response.
function redactBlocks(blocks: LessonBlock[]): LessonBlock[] {
  return blocks.map((b) => {
    if (b.type === "quiz") {
      return {
        type: "quiz",
        question: b.question,
        options: b.options,
        // answerIndex omitted on purpose
        answerIndex: -1,
      };
    }
    return b;
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await userHasAccessToLesson(userId, id);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [row] = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    title: row.title,
    moduleId: row.moduleId,
    position: row.position,
    blocks: redactBlocks(row.blocks),
  });
}
