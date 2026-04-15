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

import { GET as lessonGET } from '@/app/api/courses/[courseId]/lessons/[lessonId]/route';
import { signToken } from '@/lib/auth';

useTestDb();

beforeEach(() => {
  clearCookies();
});

/**
 * v1 KNOWN ISSUE #3 — `code_solution` leak.
 *
 * src/app/api/courses/[courseId]/lessons/[lessonId]/route.ts does
 *     SELECT * FROM lessons ...
 * and returns the full row to any caller that can read the lesson. For code
 * lessons this includes `code_solution`, which is the answer key the student
 * is supposed to be working toward.
 *
 * This test asserts the server NEVER sends code_solution to the client. The
 * v1 code does, so this test is EXPECTED TO FAIL until the fix lands.
 * Fix scheduled for v1-tested (Chapter 6) via explicit column list.
 */
describe('lesson GET does not leak code_solution', () => {
  it('omits code_solution from the response body', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'code-course' });
    const lesson = await createLesson({
      courseId: course.id,
      title: 'Variables',
      lessonType: 'code',
      codeStarter: '// write it',
      codeSolution: 'const answer = 42;',
    });
    await enroll(user.id, course.id);

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const res = await lessonGET(makeRequest({ method: 'GET' }), {
      params: { courseId: String(course.id), lessonId: String(lesson.id) },
    });
    expect(res.status).toBe(200);

    const text = await res.text();

    expect(
      text,
      'v1-tested: /api/courses/[cid]/lessons/[lid] GET leaks code_solution to ' +
        'the client. The route uses SELECT * on the lessons table. Fix scheduled ' +
        'for v1-tested column-list update (this chapter).'
    ).not.toContain('const answer = 42;');
  });
});
