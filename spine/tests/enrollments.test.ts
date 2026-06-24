import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The route reads the caller from a JWT cookie via getSession(). In a test we
// don't have a browser cookie, so we replace getSession with a stub we control.
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from '@/lib/auth';
import { POST } from '@/app/api/enrollments/route';
import {
  resetDb,
  seedUser,
  seedCourse,
  countEnrollments,
} from './helpers/db';

const asUser = (user: { id: number; email: string }) =>
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: user.id,
    email: user.email,
  });

const enroll = (courseId: number) =>
  POST(
    new NextRequest('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ courseId }),
    })
  );

describe('POST /api/enrollments', () => {
  beforeEach(resetDb);

  it('enrolls a logged-in user in a free course', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    asUser(user);

    const res = await enroll(course.id);

    expect(res.status).toBe(201);
    expect(await countEnrollments(user.id)).toBe(1);
  });

  it('is idempotent when the same user enrolls twice in sequence', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    asUser(user);

    await enroll(course.id);
    const second = await enroll(course.id);

    expect(second.status).toBe(200); // "Already enrolled"
    expect(await countEnrollments(user.id)).toBe(1);
  });

  it('rejects an unauthenticated request', async () => {
    const course = await seedCourse({ price_cents: 0 });
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await enroll(course.id);

    expect(res.status).toBe(401);
  });

  it('rejects enrolling in a paid course through the free path', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 2900 });
    asUser(user);

    const res = await enroll(course.id);

    expect(res.status).toBe(400);
    expect(await countEnrollments(user.id)).toBe(0);
  });

  // --- F9: the enrollment race -------------------------------------------
  // The handler does check-then-insert with no transaction and no ON CONFLICT.
  // Fire many enrollments for the same user and course at once. The UNIQUE
  // constraint guarantees the database never stores a duplicate — so the only
  // way the bug can surface is the loser of the race throwing an unhandled
  // unique-violation, which the catch turns into a 500. A correct handler
  // absorbs that collision and returns success.
  it('survives concurrent enrollment without a 500 (the race)', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    asUser(user);

    const responses = await Promise.all(
      Array.from({ length: 30 }, () => enroll(course.id))
    );
    const statuses = responses.map((r) => r.status);

    expect(statuses).not.toContain(500);
    expect(await countEnrollments(user.id)).toBe(1);
  });
});
