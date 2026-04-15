import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(courses);
  return NextResponse.json({ courses: rows });
}
