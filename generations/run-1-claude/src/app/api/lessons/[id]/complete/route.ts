import { NextResponse } from "next/server";
import { db } from "@/db";
import { lessonCompletions } from "@/db/schema";
import { auth } from "@/auth";
import { userHasAccessToLesson } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const lessonId = Number(params.id);
  if (!Number.isFinite(lessonId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await userHasAccessToLesson(userId, lessonId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await db
      .insert(lessonCompletions)
      .values({ userId, lessonId })
      .onConflictDoNothing();
  } catch (err) {
    console.error("complete error", err);
  }
  return NextResponse.json({ ok: true });
}
