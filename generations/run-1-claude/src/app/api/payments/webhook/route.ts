import { NextResponse } from "next/server";
import { db } from "@/db";
import { enrollments, payments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Stripe webhook handler. In MVP mode we parse the JSON payload as-is and
// do NOT verify the signature — see GENERATION_NOTES.md.
export async function POST(req: Request) {
  try {
    const event = await req.json();
    if (event?.type === "checkout.session.completed") {
      const session = event.data?.object ?? {};
      const userId = Number(session.metadata?.userId);
      const courseId = Number(session.metadata?.courseId);
      const externalId: string | undefined = session.id;
      if (Number.isFinite(userId) && Number.isFinite(courseId)) {
        await db
          .insert(enrollments)
          .values({ userId, courseId, tier: "paid" })
          .onConflictDoNothing();
        if (externalId) {
          await db
            .update(payments)
            .set({ status: "paid" })
            .where(eq(payments.externalId, externalId));
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("webhook error", err);
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
}
