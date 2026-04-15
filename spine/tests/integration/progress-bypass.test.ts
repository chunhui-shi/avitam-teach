import { describe, it, expect, beforeEach } from 'vitest';
import {
  installCookieMock,
  clearCookies,
  setCookie,
} from '../helpers/mock-next-cookies';

installCookieMock();

import { useTestDb } from '../helpers/db-setup';
import { makeRequest } from '../helpers/request';
import {
  createUser,
  createCourse,
  createLesson,
  enroll,
} from '../helpers/fixtures';

import { POST as progressPOST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/progress/route';
import { signToken } from '@/lib/auth';

useTestDb();

beforeEach(() => {
  clearCookies();
});

/**
 * v1 KNOWN ISSUE #4a — progress endpoint does not check enrollment.
 *
 * src/app/api/courses/[courseId]/lessons/[lessonId]/progress/route.ts
 * accepts any lessonId from any authenticated user and writes to
 * lesson_progress without asking whether that user is actually enrolled in
 * the course that owns the lesson.
 *
 * This test EXPECTS the request to be rejected with 403 (or 404). The v1
 * code accepts it. So the test FAILS until Chapter 6's enrollment-check fix.
 */
describe('progress POST rejects updates for unenrolled lessons', () => {
  it('returns 403/404 when the user is not enrolled in the course', async () => {
    const user = await createUser();

    // User is enrolled in a free course (so they have a valid session).
    const freeCourse = await createCourse({ priceCents: 0, slug: 'free-c' });
    await createLesson({ courseId: freeCourse.id });
    await enroll(user.id, freeCourse.id);

    // But they try to update progress on a PAID course they are NOT in.
    const paidCourse = await createCourse({ priceCents: 4900, slug: 'paid-c' });
    const paidLesson = await createLesson({
      courseId: paidCourse.id,
      title: 'Off-limits',
    });

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const res = await progressPOST(
      makeRequest({ body: { completed: true, quiz_score: 100 } }),
      {
        params: {
          courseId: String(paidCourse.id),
          lessonId: String(paidLesson.id),
        },
      }
    );

    expect(
      [403, 404],
      'v1-tested: progress endpoint accepts updates for unenrolled lessons. ' +
        'The POST handler checks authentication but not enrollment, so a ' +
        'signed-in user can mark any lesson complete across any course. Fix ' +
        'scheduled for v1-tested enrollment-check addition (this chapter).'
    ).toContain(res.status);
  });
});
