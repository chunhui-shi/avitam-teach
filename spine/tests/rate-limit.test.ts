import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { rateLimit, resetRateLimits } from '@/lib/rate-limit';

vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from '@/lib/auth';
import { POST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/comments/route';
import { resetDb, seedUser, seedCourse, seedLesson } from './helpers/db';

describe('rateLimit (unit, deterministic clock)', () => {
  beforeEach(resetRateLimits);

  it('allows up to the limit, then blocks', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('k', 3, 1000, 0).ok).toBe(true);
    }
    const blocked = rateLimit('k', 3, 1000, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it('resets after the window elapses', () => {
    expect(rateLimit('k', 1, 1000, 0).ok).toBe(true);
    expect(rateLimit('k', 1, 1000, 500).ok).toBe(false); // same window
    expect(rateLimit('k', 1, 1000, 1000).ok).toBe(true); // new window
  });

  it('tracks keys independently', () => {
    expect(rateLimit('a', 1, 1000, 0).ok).toBe(true);
    expect(rateLimit('a', 1, 1000, 0).ok).toBe(false);
    expect(rateLimit('b', 1, 1000, 0).ok).toBe(true); // different key, own budget
  });
});

describe('rate limiting on the comments route (integration)', () => {
  beforeEach(resetDb);

  it('returns 429 once a user exceeds the per-minute comment budget', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({ course_id: course.id });
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: user.id,
      email: user.email,
    });

    const post = (n: number) =>
      POST(
        new NextRequest('http://localhost/api/comment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: `comment ${n}` }),
        }),
        { params: { courseId: String(course.id), lessonId: String(lesson.id) } }
      );

    // The limit is 20/min; the first 20 succeed.
    for (let i = 0; i < 20; i++) {
      expect((await post(i)).status).toBe(201);
    }
    // The 21st is throttled.
    expect((await post(20)).status).toBe(429);
  });
});
