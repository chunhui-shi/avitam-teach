// Logout is handled by NextAuth at /api/auth/signout. This alias is kept so
// the documented API surface matches the spec.
import { NextResponse } from "next/server";
import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
