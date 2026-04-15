import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { userHasAccessToLesson } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 2000;
const MAX_CONTEXT_CHARS = 8000;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const lessonId = Number(body?.lesson_id ?? body?.lessonId);
  const question: string = String(body?.question ?? "").slice(
    0,
    MAX_QUESTION_CHARS,
  );
  if (!Number.isFinite(lessonId) || !question.trim()) {
    return NextResponse.json(
      { error: "Missing lesson_id or question" },
      { status: 400 },
    );
  }

  const access = await userHasAccessToLesson(userId, lessonId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build a plaintext context from the lesson blocks. Include quiz answers
  // for the model (server-side only; does NOT leak to client).
  const contextParts: string[] = [`Lesson: ${lesson.title}`];
  for (const block of lesson.blocks) {
    if (block.type === "text") {
      contextParts.push(block.markdown);
    } else if (block.type === "codebox") {
      contextParts.push(
        `Code exercise${block.instructions ? ` — ${block.instructions}` : ""}:\n${block.starter}`,
      );
    } else if (block.type === "quiz") {
      contextParts.push(
        `Quiz: ${block.question}\nOptions: ${block.options.map((o, i) => `${i}: ${o}`).join("; ")}\nCorrect: ${block.answerIndex}`,
      );
    }
  }
  const lessonContext = contextParts.join("\n\n").slice(0, MAX_CONTEXT_CHARS);

  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey || apiKey.startsWith("sk-ant-placeholder")) {
    return NextResponse.json({
      answer:
        "(Assistant is not configured: set ANTHROPIC_API_KEY in .env.local)",
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 512,
      system:
        "You are a patient, concise teaching assistant for an online programming course. Use the provided lesson context to answer the student's question. If the question is outside the lesson scope, say so politely.",
      messages: [
        {
          role: "user",
          content: `LESSON CONTEXT:\n${lessonContext}\n\nSTUDENT QUESTION:\n${question}`,
        },
      ],
    });
    const answer = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n")
      .trim();
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("assistant error", err);
    return NextResponse.json(
      { error: "Assistant call failed" },
      { status: 500 },
    );
  }
}
