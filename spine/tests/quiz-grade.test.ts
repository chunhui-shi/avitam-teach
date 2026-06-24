import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from '@/lib/auth';
import { POST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/quiz/grade/route';
import { resetDb, seedUser, seedCourse, seedLesson, testPool } from './helpers/db';

const QUIZ = [
  { id: 'q1', question: '2 + 2?', options: ['3', '4'], correct: 1 },
  { id: 'q2', question: 'Capital of France?', options: ['Paris', 'Rome'], correct: 0 },
];

async function setup() {
  const user = await seedUser();
  const course = await seedCourse({ price_cents: 0 });
  const lesson = await seedLesson({
    course_id: course.id,
    lesson_type: 'quiz',
    quiz_data: QUIZ,
  });
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: user.id,
    email: user.email,
  });
  return { user, course, lesson };
}

const grade = (courseId: number, lessonId: number, answers: Record<string, number>) =>
  POST(
    new NextRequest('http://localhost/api/grade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    }),
    { params: { courseId: String(courseId), lessonId: String(lessonId) } }
  );

describe('POST quiz/grade (server-side grading)', () => {
  beforeEach(resetDb);

  it('grades correct answers and persists the score on the server', async () => {
    const { user, course, lesson } = await setup();

    const res = await grade(course.id, lesson.id, { q1: 1, q2: 0 });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(100);
    expect(data.correctCount).toBe(2);

    const { rows } = await testPool.query(
      'SELECT quiz_score FROM lesson_progress WHERE user_id=$1 AND lesson_id=$2',
      [user.id, lesson.id]
    );
    expect(rows[0].quiz_score).toBe(100);
  });

  it('a student cannot inflate the score — wrong answers grade to 0', async () => {
    const { course, lesson } = await setup();
    const data = await (await grade(course.id, lesson.id, { q1: 0, q2: 1 })).json();
    expect(data.score).toBe(0);
  });

  it('computes partial credit on the server', async () => {
    const { course, lesson } = await setup();
    const data = await (await grade(course.id, lesson.id, { q1: 1, q2: 1 })).json();
    expect(data.score).toBe(50);
    expect(data.correctCount).toBe(1);
  });
});
