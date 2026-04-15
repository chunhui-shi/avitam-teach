import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { enrollFree } from "@/lib/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ courseId: z.number().int().positive() });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { rows } = await query<{ id: number; price_cents: number }>(
    "SELECT id, price_cents FROM courses WHERE id = $1 AND is_published = TRUE",
    [body.courseId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (rows[0].price_cents !== 0) {
    return NextResponse.json({ error: "Paid course — use checkout" }, { status: 400 });
  }

  await enrollFree(user.id, body.courseId);
  return NextResponse.json({ ok: true });
}
