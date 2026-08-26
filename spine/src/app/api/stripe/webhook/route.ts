import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query, queryOne } from '@/lib/db';
import { stripeClient } from '@/lib/stripe-client';

// Disable body parsing — Stripe needs raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let stripe: Stripe;
  try {
    stripe = stripeClient();
  } catch (err) {
    console.error('Stripe is not configured:', err);
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });
  }
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, sig || '', webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM stripe_events WHERE id = $1',
    [event.id]
  );
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, courseId } = session.metadata || {};

      if (userId && courseId && session.payment_status === 'paid') {
        await query(
          `INSERT INTO enrollments (user_id, course_id, stripe_payment_intent_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, course_id) DO NOTHING`,
          [parseInt(userId), parseInt(courseId), session.payment_intent]
        );
      }
    }

    // Record event as processed
    await query(
      'INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [event.id, event.type]
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
