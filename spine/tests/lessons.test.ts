import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from '@/lib/auth';
import { GET as getLessonRoute } from '@/app/api/courses/[courseId]/lessons/[lessonId]/route';
import { GET as listLessonsRoute } from '@/app/api/courses/[courseId]/lessons/route';
import { resetDb, seedCourse, seedLesson } from './helpers/db';

const getLesson = (courseId: number, lessonId: number) =>
  getLessonRoute(new NextRequest('http://localhost/api/lesson'), {
    params: { courseId: String(courseId), lessonId: String(lessonId) },
  });

const listLessons = (courseId: number) =>
  listLessonsRoute(new NextRequest('http://localhost/api/lessons'), {
    params: { courseId: String(courseId) },
  });

describe('GET /api/courses/[courseId]/lessons/[lessonId]', () => {
  beforeEach(async () => {
    await resetDb();
    // Free course, so no session is needed to read the lesson.
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('returns the lesson for a free course', async () => {
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({ course_id: course.id });

    const res = await getLesson(course.id, lesson.id);

    expect(res.status).toBe(200);
    const { lesson: payload } = await res.json();
    expect(payload.id).toBe(lesson.id);
  });

  // --- F10: the answer leak ----------------------------------------------
  // The student-facing lesson endpoint does SELECT *, which ships the grading
  // fields to the browser: a code lesson's reference solution and a quiz's
  // correct-answer indices. "Correct" for this endpoint means the student can
  // render the lesson without being handed the answers.
  it('does not leak a code lesson\'s reference solution', async () => {
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({
      course_id: course.id,
      lesson_type: 'code',
      code_solution: 'const greeting = "Hello, World!";',
    });

    const res = await getLesson(course.id, lesson.id);
    const { lesson: payload } = await res.json();

    expect(payload.code_solution).toBeUndefined();
  });

  // v4-designed un-skipped this: grading moved to the server (quiz/grade route),
  // so the lesson endpoint now strips the answer key before sending it.
  it('does not leak a quiz lesson\'s correct answers', async () => {
    const course = await seedCourse({ price_cents: 0 });
    const lesson = await seedLesson({
      course_id: course.id,
      lesson_type: 'quiz',
      quiz_data: [
        { id: 'q1', question: '2 + 2?', options: ['3', '4'], correct: 1 },
      ],
    });

    const res = await getLesson(course.id, lesson.id);
    const { lesson: payload } = await res.json();

    // The questions and options may ship; the correct index must not.
    const serialized = JSON.stringify(payload.quiz_data ?? null);
    expect(serialized).not.toContain('"correct"');
  });
});

describe('GET /api/courses/[courseId]/lessons', () => {
  beforeEach(async () => {
    await resetDb();
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('returns only the fields needed by the course outline', async () => {
    const course = await seedCourse({ price_cents: 0 });
    await seedLesson({
      course_id: course.id,
      lesson_type: 'code',
      code_solution: 'const answer = 42;',
    });

    const response = await listLessons(course.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0]).not.toHaveProperty('content');
    expect(body.lessons[0]).not.toHaveProperty('code_starter');
    expect(body.lessons[0]).not.toHaveProperty('code_solution');
    expect(body.lessons[0]).not.toHaveProperty('quiz_data');
  });
});
