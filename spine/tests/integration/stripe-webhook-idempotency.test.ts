import { describe, it, expect, beforeEach, vi } from 'vitest';

const stripeMock = {
  eventId: 'evt_test_idem_1',
  userId: 0,
  courseId: 0,
};

vi.mock('stripe', () => {
  class FakeStripe {
    webhooks = {
      constructEvent: (_b: string, _s: string, _sec: string) => {
        const event: unknown = {
          id: stripeMock.eventId,
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                userId: String(stripeMock.userId),
                courseId: String(stripeMock.courseId),
              },
              payment_status: 'paid',
              payment_intent: 'pi_test_idem_1',
            },
          },
        };
        return event;
      },
    };
    constructor(_k: string, _o?: unknown) {}
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
  stripeMock.eventId = 'evt_test_idem_' + Math.random().toString(36).slice(2, 10);
});

describe('Stripe webhook idempotency', () => {
  it('creates the enrollment only once when the same event is posted twice', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'idem-c' });
    stripeMock.userId = user.id;
    stripeMock.courseId = course.id;

    const send = () =>
      webhookPOST(
        makeRequest({
          body: JSON.stringify({ placeholder: true }),
          headers: { 'stripe-signature': 't=1,v1=x' },
        })
      );

    const first = await send();
    expect(first.status).toBe(200);

    const second = await send();
    expect(second.status).toBe(200);

    const db = await getTestDb();
    const { rows } = await db.query(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [user.id, course.id]
    );
    expect(rows).toHaveLength(1);

    // And the stripe_events table recorded the event exactly once.
    const evRes = await db.query(
      'SELECT id FROM stripe_events WHERE id = $1',
      [stripeMock.eventId]
    );
    expect(evRes.rows).toHaveLength(1);
  });
});
