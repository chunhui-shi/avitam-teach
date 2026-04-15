// Credential sign-in is handled by NextAuth at /api/auth/callback/credentials.
// This endpoint is kept as a thin alias documented in the API spec; it simply
// instructs clients to POST to the NextAuth callback with the same body.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Use POST /api/auth/callback/credentials (NextAuth) or the signIn() client helper.",
    },
    { status: 400 },
  );
}
