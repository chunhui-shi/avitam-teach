import { describe, it, expect, beforeEach } from 'vitest';
import {
  installCookieMock,
  clearCookies,
  setCookie,
} from '../helpers/mock-next-cookies';

installCookieMock();

import { useTestDb } from '../helpers/db-setup';
import { getTestDb } from '../helpers/test-db';
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
 * v1 KNOWN ISSUE #4b — client-controlled quiz_score.
 *
 * The progress POST handler accepts `quiz_score` directly from the request
 * body and stores it. A malicious client can claim a perfect score for a
 * quiz they never answered — progress/completion tracking is meaningless.
 *
 * Desired behaviour: the server should compute quiz_score itself from the
 * user's submitted answers against the correct answer array in
 * lessons.quiz_data. Until the fix lands, this test FAILS.
 */
describe('progress POST does not trust client-supplied quiz_score', () => {
  it('recomputes quiz_score on the server (or rejects client quiz_score)', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 0, slug: 'quiz-course' });
    const lesson = await createLesson({
      courseId: course.id,
      lessonType: 'quiz',
      quizData: [
        { id: 'q1', question: '2+2?', options: ['3', '4'], correct: 1 },
        { id: 'q2', question: '3+3?', options: ['6', '7'], correct: 0 },
      ],
    });
    await enroll(user.id, course.id);

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    // Client claims a 100 without submitting any answers.
    await progressPOST(
      makeRequest({ body: { completed: true, quiz_score: 100 } }),
      {
        params: {
          courseId: String(course.id),
          lessonId: String(lesson.id),
        },
      }
    );

    const db = await getTestDb();
    const { rows } = await db.query(
      'SELECT quiz_score FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [user.id, lesson.id]
    );
    const stored = rows[0]?.quiz_score;

    expect(
      stored,
      'v1-tested: progress endpoint stores whatever quiz_score the client ' +
        'sends, so any student can claim 100% without answering. Fix scheduled ' +
        'for v1-tested: compute the score server-side from submitted answers.'
    ).not.toBe(100);
  });
});
