import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.metadata?.user_id);
    const courseId = Number(session.metadata?.course_id);
    if (userId && courseId && session.payment_status === "paid") {
      await query(
        `INSERT INTO enrollments (user_id, course_id, status, source, stripe_session_id)
         VALUES ($1, $2, 'active', 'stripe', $3)
         ON CONFLICT (user_id, course_id)
         DO UPDATE SET status = 'active', source = 'stripe', stripe_session_id = EXCLUDED.stripe_session_id`,
        [userId, courseId, session.id]
      );
    }
  }

  return NextResponse.json({ received: true });
}
