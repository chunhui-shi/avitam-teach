import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { courses, enrollments, payments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user
    ? Number((session.user as { id?: string }).id)
    : null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const courseId = Number(body?.courseId);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ error: "Invalid courseId" }, { status: 400 });
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Already enrolled? Return success idempotently.
  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyEnrolled: true });
  }

  if (course.isFree) {
    await db
      .insert(enrollments)
      .values({ userId, courseId, tier: "free" })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true });
  }

  // Paid: create a Stripe Checkout Session in test mode.
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: course.title },
            unit_amount: course.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/courses/${course.slug}?paid=1`,
      cancel_url: `${appUrl}/courses/${course.slug}?canceled=1`,
      metadata: {
        userId: String(userId),
        courseId: String(course.id),
      },
    });
    await db.insert(payments).values({
      userId,
      courseId,
      amountCents: course.priceCents,
      provider: "stripe",
      status: "pending",
      externalId: checkout.id,
    });
    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (err) {
    console.error("stripe checkout error", err);
    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 },
    );
  }
}
