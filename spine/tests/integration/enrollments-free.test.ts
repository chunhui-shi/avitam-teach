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
import { createUser, createCourse } from '../helpers/fixtures';

import { POST as enrollPOST } from '@/app/api/enrollments/route';
import { signToken } from '@/lib/auth';

useTestDb();

beforeEach(() => {
  clearCookies();
});

describe('POST /api/enrollments (free courses)', () => {
  it('lets an authenticated user enroll in a free course', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 0, slug: 'free-course' });

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const res = await enrollPOST(makeRequest({ body: { courseId: course.id } }));
    expect(res.status).toBe(201);

    const db = await getTestDb();
    const { rows } = await db.query(
      'SELECT user_id, course_id FROM enrollments WHERE user_id = $1',
      [user.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].course_id).toBe(course.id);
  });

  it('is idempotent on duplicate enrollment (no second row)', async () => {
    const user = await createUser();
    const course = await createCourse({ priceCents: 0, slug: 'free-course-2' });

    setCookie('avitam_session', signToken({ userId: user.id, email: user.email }));

    const first = await enrollPOST(makeRequest({ body: { courseId: course.id } }));
    expect(first.status).toBe(201);

    const second = await enrollPOST(makeRequest({ body: { courseId: course.id } }));
    // The v1 code returns 200 (default) with a message "Already enrolled".
    expect([200, 201]).toContain(second.status);

    const db = await getTestDb();
    const { rows } = await db.query(
      'SELECT id FROM enrollments WHERE user_id = $1',
      [user.id]
    );
    expect(rows).toHaveLength(1);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const course = await createCourse({ priceCents: 0, slug: 'free-course-3' });
    clearCookies();
    const res = await enrollPOST(makeRequest({ body: { courseId: course.id } }));
    expect(res.status).toBe(401);
  });
});
