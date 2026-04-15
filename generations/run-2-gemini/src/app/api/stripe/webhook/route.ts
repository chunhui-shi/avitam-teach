import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import db from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    const err = error as Error;
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    const metadata = session.metadata;

    if (!metadata?.userId) {
      return new NextResponse("Webhook Error: No userId in metadata", { status: 400 });
    }

    if (metadata.type === "course_purchase") {
      const courseId = metadata.courseId;
      
      await db.purchase.create({
        data: {
          userId: metadata.userId,
          courseId: courseId,
          stripeSessionId: session.id,
        },
      });

      await db.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: metadata.userId,
            courseId: courseId,
          },
        },
        update: {},
        create: {
          userId: metadata.userId,
          courseId: courseId,
        },
      });
    } else if (metadata.type === "subscription") {
      const subscriptionId = session.subscription as string;
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

      await db.subscription.upsert({
        where: { userId: metadata.userId },
        update: {
          stripeSubscriptionId: subscriptionId,
          status: stripeSubscription.status,
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
        create: {
          userId: metadata.userId,
          stripeSubscriptionId: subscriptionId,
          status: stripeSubscription.status,
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const subscriptionId = session.subscription as string;
    if (subscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

      await db.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          status: stripeSubscription.status,
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });
    }
  }

  return new NextResponse(null, { status: 200 });
}
