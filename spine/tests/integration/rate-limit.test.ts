import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  installCookieMock,
  clearCookies,
  setCookie,
} from '../helpers/mock-next-cookies';

installCookieMock();

// Stub the Anthropic SDK before importing the assistant route so the rate
// limit test doesn't need a real API call.
vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      create: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic, Anthropic: FakeAnthropic };
});

import { useTestDb } from '../helpers/db-setup';
import { makeRequest } from '../helpers/request';
import { createUser, createCourse, createLesson, enroll } from '../helpers/fixtures';

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as assistantPOST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route';
import { signToken } from '@/lib/auth';
import { __resetRateLimitStoreForTests } from '@/lib/rate-limit';

useTestDb();

beforeEach(() => {
  clearCookies();
  __resetRateLimitStoreForTests();
});

/**
 * v2-deployed: rate limiting on expensive routes.
 *
 * These tests exercise two of the four protected routes and verify that the
 * configured cap is enforced per identifier. The limits live in
 * src/lib/rate-limit.ts (RATE_LIMITS.authLogin = 10/min per IP,
 * RATE_LIMITS.assistant = 20/min per user).
 */
describe('POST /api/auth/login rate limit', () => {
  it('returns 429 with Retry-After after the 10th login in a window', async () => {
    // All 10 pre-cap requests should return a normal auth response (401 with
    // bad credentials) — NOT 429. The 11th request should hit the cap.
    const requestFromIp = () =>
      makeRequest({
        body: { email: 'nope@example.com', password: 'wrongpassword' },
        headers: { 'x-forwarded-for': '203.0.113.42' },
      });

    for (let i = 0; i < 10; i++) {
      const res = await loginPOST(requestFromIp());
      expect(
        res.status,
        `login request ${i + 1} should not be rate-limited`
      ).not.toBe(429);
    }

    const limited = await loginPOST(requestFromIp());
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).not.toBeNull();
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);

    // A different IP should still be allowed — bucket is per-identifier.
    const otherIp = await loginPOST(
      makeRequest({
        body: { email: 'nope@example.com', password: 'wrongpassword' },
        headers: { 'x-forwarded-for': '198.51.100.7' },
      })
    );
    expect(otherIp.status).not.toBe(429);
  });
});

describe('POST /api/ai-assistant rate limit', () => {
  it('returns 429 for the 21st request from the same authenticated user', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 0, slug: 'rl-course' });
    const lesson = await createLesson({ courseId: course.id });
    await enroll(user.id, course.id);

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const params = { courseId: String(course.id), lessonId: String(lesson.id) };

    for (let i = 0; i < 20; i++) {
      const res = await assistantPOST(
        makeRequest({ body: { question: `q${i}` } }),
        { params }
      );
      expect(
        res.status,
        `assistant request ${i + 1} should not be rate-limited`
      ).not.toBe(429);
    }

    const limited = await assistantPOST(
      makeRequest({ body: { question: 'one too many' } }),
      { params }
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).not.toBeNull();
    const body = await limited.json();
    expect(body.error).toMatch(/too many/i);
  });
});
