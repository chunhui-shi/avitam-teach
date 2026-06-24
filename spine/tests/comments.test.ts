import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from '@/lib/auth';
import { POST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/comments/route';
import { resetDb, seedUser, seedCourse, seedLesson, testPool } from './helpers/db';

const asUser = (user: { id: number; email: string }) =>
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: user.id,
    email: user.email,
  });

const postComment = (
  courseId: number,
  lessonId: number,
  body: Record<string, unknown>
) =>
  POST(
    new NextRequest('http://localhost/api/comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { courseId: String(courseId), lessonId: String(lessonId) } }
  );

// These pin down business rules the v0 feature pass already got right. A test
// suite is not only a bug net — it is also the record of the rules you have
// decided are correct, so a later change (human or AI) can't quietly break them.
describe('POST comments', () => {
  beforeEach(resetDb);

  it('posts a top-level comment on a free-course lesson', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({ course_id: course.id });
    asUser(user);

    const res = await postComment(course.id, lesson.id, { body: 'First!' });

    expect(res.status).toBe(201);
  });

  it('rejects an empty comment', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({ course_id: course.id });
    asUser(user);

    const res = await postComment(course.id, lesson.id, { body: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a reply whose parent belongs to a different lesson', async () => {
    const user = await seedUser();
    const course = await seedCourse({ price_cents: 0 });
    const lessonA = await seedLesson({ course_id: course.id, slug: 'a' });
    const lessonB = await seedLesson({ course_id: course.id, slug: 'b' });
    asUser(user);

    // A real comment, but on lesson A.
    const { rows } = await testPool.query(
      `INSERT INTO lesson_comments (lesson_id, user_id, body)
       VALUES ($1, $2, 'parent') RETURNING id`,
      [lessonA.id, user.id]
    );
    const parentId = rows[0].id;

    // Try to reply to it from lesson B.
    const res = await postComment(course.id, lessonB.id, {
      body: 'reply',
      parent_id: parentId,
    });

    expect(res.status).toBe(400);
  });
});
