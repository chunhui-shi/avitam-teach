import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Course, Enrollment, User } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-03-25.dahlia',
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const course = await queryOne<Course>(
      'SELECT * FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.price_cents === 0) {
      return NextResponse.json({ error: 'This is a free course. Use /api/enrollments to enroll.' }, { status: 400 });
    }

    const existing = await queryOne<Enrollment>(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [session.userId, courseId]
    );

    if (existing) {
      return NextResponse.json({ error: 'Already enrolled' }, { status: 409 });
    }

    const user = await queryOne<User>(
      'SELECT id, email, name, stripe_customer_id FROM users WHERE id = $1',
      [session.userId]
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await queryOne(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, user.id]
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description.substring(0, 255),
            },
            unit_amount: course.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/courses/${course.id}?enrolled=true`,
      cancel_url: `${appUrl}/courses/${course.id}?cancelled=true`,
      metadata: {
        userId: String(session.userId),
        courseId: String(courseId),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
