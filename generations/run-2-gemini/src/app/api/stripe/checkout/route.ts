import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !session.user.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { courseId, isSubscription } = await req.json();

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const metadata: Record<string, string> = { userId: user.id };

    if (isSubscription) {
      line_items = [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: "Site-wide Subscription",
              description: "Access to all courses on Aavitam Teach",
            },
            unit_amount: 1999, // $19.99
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ];
      metadata.type = "subscription";
    } else if (courseId) {
      const course = await db.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return new NextResponse("Course not found", { status: 404 });
      }

      line_items = [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: course.title,
              description: course.description || "",
            },
            unit_amount: Math.round((course.price || 0) * 100),
          },
          quantity: 1,
        },
      ];
      metadata.type = "course_purchase";
      metadata.courseId = courseId;
    } else {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const stripeSession = await stripe.checkout.sessions.create({
      customer_email: session.user.email,
      line_items,
      mode: isSubscription ? "subscription" : "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses?canceled=1`,
      metadata,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("[STRIPE_CHECKOUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
