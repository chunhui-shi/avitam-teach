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

describe('GET /api/courses/[courseId]/lessons/[lessonId]', () => {
  it('returns 401 when unauthenticated and the course is paid', async () => {
    const course = await createCourse({ priceCents: 2900, slug: 'paid-1' });
    const lesson = await createLesson({
      courseId: course.id,
      title: 'Lesson 1',
    });

    const res = await lessonGET(makeRequest({ method: 'GET' }), {
      params: { courseId: String(course.id), lessonId: String(lesson.id) },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not enrolled in a paid course', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'paid-2' });
    const lesson = await createLesson({ courseId: course.id });

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const res = await lessonGET(makeRequest({ method: 'GET' }), {
      params: { courseId: String(course.id), lessonId: String(lesson.id) },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with the lesson body when authenticated and enrolled', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 2900, slug: 'paid-3' });
    const lesson = await createLesson({
      courseId: course.id,
      title: 'Enrolled Lesson',
      content: 'THE BODY',
    });
    await enroll(user.id, course.id);

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const res = await lessonGET(makeRequest({ method: 'GET' }), {
      params: { courseId: String(course.id), lessonId: String(lesson.id) },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lesson.title).toBe('Enrolled Lesson');
    expect(json.lesson.content).toContain('THE BODY');
  });
});
