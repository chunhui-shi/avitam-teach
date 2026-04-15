import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

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

  const { rows } = await query<{
    id: number;
    slug: string;
    title: string;
    price_cents: number;
    stripe_price_id: string | null;
  }>(
    "SELECT id, slug, title, price_cents, stripe_price_id FROM courses WHERE id = $1 AND is_published = TRUE",
    [body.courseId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const course = rows[0];
  if (course.price_cents === 0) {
    return NextResponse.json({ error: "Free course — use /api/enroll" }, { status: 400 });
  }

  // Create pending enrollment so we can link the Stripe session back to a user+course.
  await query(
    `INSERT INTO enrollments (user_id, course_id, status, source)
     VALUES ($1, $2, 'pending', 'stripe')
     ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'pending', source = 'stripe'`,
    [user.id, course.id]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: course.stripe_price_id
        ? [{ price: course.stripe_price_id, quantity: 1 }]
        : [
            {
              price_data: {
                currency: "usd",
                product_data: { name: course.title },
                unit_amount: course.price_cents,
              },
              quantity: 1,
            },
          ],
      metadata: {
        user_id: String(user.id),
        course_id: String(course.id),
      },
      success_url: `${appUrl}/courses/${course.slug}?checkout=success`,
      cancel_url: `${appUrl}/courses/${course.slug}?checkout=canceled`,
    });

    await query("UPDATE enrollments SET stripe_session_id = $1 WHERE user_id = $2 AND course_id = $3", [
      session.id,
      user.id,
      course.id,
    ]);

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
