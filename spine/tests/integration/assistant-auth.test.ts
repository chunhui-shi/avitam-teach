import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  installCookieMock,
  clearCookies,
  setCookie,
} from '../helpers/mock-next-cookies';

installCookieMock();

// Mock the Anthropic SDK BEFORE importing the route so the route's
// `new Anthropic(...)` call uses our stub. This also records the last call
// for other tests to introspect.
export const __lastAnthropicCall: { args?: unknown } = {};

vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      create: async (args: unknown) => {
        __lastAnthropicCall.args = args;
        return {
          content: [{ type: 'text', text: 'stubbed answer' }],
        };
      },
    };
    constructor(_opts: unknown) {}
  }
  return {
    default: FakeAnthropic,
    Anthropic: FakeAnthropic,
  };
});

import { useTestDb } from '../helpers/db-setup';
import { makeRequest } from '../helpers/request';
import {
  createUser,
  createCourse,
  createLesson,
  enroll,
} from '../helpers/fixtures';

import { POST as assistantPOST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/ai-assistant/route';
import { signToken } from '@/lib/auth';

useTestDb();

beforeEach(() => {
  clearCookies();
});

describe('POST /api/courses/[cid]/lessons/[lid]/ai-assistant', () => {
  it('returns 401 without a session', async () => {
    const course = await createCourse({ priceCents: 2900, slug: 'ai-c1' });
    const lesson = await createLesson({ courseId: course.id });

    const res = await assistantPOST(
      makeRequest({ body: { question: 'help me' } }),
      { params: { courseId: String(course.id), lessonId: String(lesson.id) } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when logged in but not enrolled in a paid course', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'ai-c2' });
    const lesson = await createLesson({ courseId: course.id });

    setCookie(
      'avitam_session',
      signToken({ userId: user.id, email: user.email })
    );

    const res = await assistantPOST(
      makeRequest({ body: { question: 'help me' } }),
      { params: { courseId: String(course.id), lessonId: String(lesson.id) } }
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 with a stubbed answer when enrolled', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'ai-c3' });
    const lesson = await createLesson({ courseId: course.id });
    await enroll(user.id, course.id);

    setCookie(
      'avitam_session',
      signToken({ userId: user.id, email: user.email })
    );

    const res = await assistantPOST(
      makeRequest({ body: { question: 'What is a variable?' } }),
      { params: { courseId: String(course.id), lessonId: String(lesson.id) } }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe('stubbed answer');
  });
});
