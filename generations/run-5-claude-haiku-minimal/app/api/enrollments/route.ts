import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

const enrollmentSchema = z.object({
  userId: z.number().int().positive(),
  courseId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, courseId } = enrollmentSchema.parse(body);

    const courseResult = await query('SELECT is_free, price_cents FROM courses WHERE id = $1', [
      courseId,
    ]);

    if (courseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = courseResult.rows[0];

    if (course.is_free) {
      const enrollResult = await query(
        'INSERT INTO enrollments (user_id, course_id, enrollment_type) VALUES ($1, $2, $3) RETURNING id, user_id, course_id, enrollment_type, enrolled_at',
        [userId, courseId, 'free']
      );
      return NextResponse.json(enrollResult.rows[0], { status: 201 });
    }

    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_SECRET}/enrollment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_SECRET}/enrollment-cancel`,
      customer_email: userResult.rows[0].email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Course Enrollment`,
            },
            unit_amount: course.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId.toString(),
        courseId: courseId.toString(),
      },
    });

    return NextResponse.json(
      {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const result = await query('SELECT * FROM enrollments WHERE user_id = $1', [parseInt(userId)]);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Fetch enrollments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
