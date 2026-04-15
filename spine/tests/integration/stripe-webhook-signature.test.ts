import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stripe SDK mock must be installed BEFORE the route is imported.
// The route does `new Stripe(...)` at module load and calls
// stripe.webhooks.constructEvent(body, sig, secret) inside the handler.

const stripeMock = {
  constructEventImpl: (_body: string, _sig: string, _secret: string): unknown => {
    throw new Error('constructEvent not configured for this test');
  },
};

vi.mock('stripe', () => {
  class FakeStripe {
    webhooks = {
      constructEvent: (body: string, sig: string, secret: string) =>
        stripeMock.constructEventImpl(body, sig, secret),
    };
    constructor(_key: string, _opts?: unknown) {}
  }
  return { default: FakeStripe };
});

import { useTestDb } from '../helpers/db-setup';
import { getTestDb } from '../helpers/test-db';
import { makeRequest } from '../helpers/request';
import { createUser, createCourse } from '../helpers/fixtures';

import { POST as webhookPOST } from '@/app/api/stripe/webhook/route';

useTestDb();

beforeEach(() => {
  stripeMock.constructEventImpl = () => {
    throw new Error('constructEvent not configured for this test');
  };
});

describe('POST /api/stripe/webhook — signature verification', () => {
  it('returns 400 when constructEvent throws (invalid signature)', async () => {
    stripeMock.constructEventImpl = () => {
      const err = new Error('No signatures found matching expected signature');
      throw err;
    };

    const res = await webhookPOST(
      makeRequest({
        body: JSON.stringify({ fake: true }),
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('creates an enrollment on checkout.session.completed with a valid signature', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'stripe-c1' });

    stripeMock.constructEventImpl = () =>
      ({
        id: 'evt_test_valid_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: String(user.id), courseId: String(course.id) },
            payment_status: 'paid',
            payment_intent: 'pi_test_123',
          },
        },
      }) as unknown;

    const res = await webhookPOST(
      makeRequest({
        body: JSON.stringify({ placeholder: true }),
        headers: { 'stripe-signature': 't=1,v1=whatever' },
      })
    );
    expect(res.status).toBe(200);

    const db = await getTestDb();
    const { rows } = await db.query(
      'SELECT user_id, course_id, stripe_payment_intent_id FROM enrollments WHERE user_id = $1',
      [user.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].course_id).toBe(course.id);
    expect(rows[0].stripe_payment_intent_id).toBe('pi_test_123');
  });
});
