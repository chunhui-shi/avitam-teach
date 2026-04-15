import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { isEnrolled } from "@/lib/enrollment";
import { rateLimit } from "@/lib/rate-limit";
import type { LessonBlock } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  lessonId: z.number().int().positive(),
  message: z.string().min(1).max(2000),
});

const MAX_HISTORY = 20;

function lessonToText(title: string, content: LessonBlock[]): string {
  const parts: string[] = [`# ${title}`, ""];
  for (const b of content) {
    if (b.type === "text") {
      parts.push(b.markdown);
    } else if (b.type === "quiz") {
      parts.push(
        `Quiz: ${b.question}\nOptions:\n${b.options
          .map((o, i) => `  ${i}. ${o}`)
          .join("\n")}\nCorrect answer index: ${b.answer_index}`
      );
      if (b.explanation) parts.push(`Explanation: ${b.explanation}`);
    } else if (b.type === "code") {
      parts.push(
        `Exercise: ${b.prompt}\nStarter code:\n\`\`\`js\n${b.starter}\n\`\`\``
      );
    }
    parts.push("");
  }
  return parts.join("\n").slice(0, 8000);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`assistant:${user.id}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Lesson + enrollment gate.
  const lr = await query<{
    id: number;
    title: string;
    content: LessonBlock[];
    course_id: number;
  }>("SELECT id, title, content, course_id FROM lessons WHERE id = $1", [
    body.lessonId,
  ]);
  if (lr.rows.length === 0)
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  const lesson = lr.rows[0];

  const enrolled = await isEnrolled(user.id, lesson.course_id);
  if (!enrolled)
    return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  // Pull short prior history (per user+lesson).
  const hist = await query<{ role: string; content: string }>(
    `SELECT role, content FROM assistant_messages
     WHERE user_id = $1 AND lesson_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [user.id, lesson.id, MAX_HISTORY]
  );
  const priorMessages = hist.rows.reverse();

  const lessonText = lessonToText(
    lesson.title,
    Array.isArray(lesson.content) ? lesson.content : []
  );

  const systemPrompt = `You are the teaching assistant for the lesson below. Answer the student's questions about this lesson only. Be concise, encouraging, and Socratic — prefer hints and questions over full solutions when the student is working through an exercise. If asked about something unrelated to this lesson, politely redirect. Format short code snippets with markdown backticks.

=== LESSON CONTENT ===
${lessonText}
=== END LESSON ===`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-placeholder")) {
    // Stub reply so the UI is usable before the user wires a real key.
    const stub = `(Assistant offline — set ANTHROPIC_API_KEY in .env.local to enable real responses.)\n\nI got your question: "${body.message}". Once a real API key is configured, I'll answer it against this lesson's content.`;
    await query(
      "INSERT INTO assistant_messages (user_id, lesson_id, role, content) VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4)",
      [user.id, lesson.id, body.message, stub]
    );
    return NextResponse.json({ reply: stub });
  }

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...priorMessages.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user" as const, content: body.message },
      ],
    });
    const reply =
      resp.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "(no response)";

    await query(
      "INSERT INTO assistant_messages (user_id, lesson_id, role, content) VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4)",
      [user.id, lesson.id, body.message, reply]
    );

    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Assistant error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
