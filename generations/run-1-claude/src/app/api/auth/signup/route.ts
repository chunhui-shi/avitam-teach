import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();
    if (!normalized.includes("@") || password.length < 6) {
      return NextResponse.json(
        { error: "Invalid email or password too short" },
        { status: 400 },
      );
    }
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({ email: normalized, passwordHash, tier: "free" })
      .returning();
    return NextResponse.json({ id: created.id, email: created.email });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
