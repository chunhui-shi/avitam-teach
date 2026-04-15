import { getTestDb } from './test-db';
import bcrypt from 'bcryptjs';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string; // plaintext (test-only)
}

export async function createUser(opts: {
  email?: string;
  name?: string;
  password?: string;
} = {}): Promise<TestUser> {
  const db = await getTestDb();
  const email = opts.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const name = opts.name ?? 'Test User';
  const password = opts.password ?? 'supersecret123';
  // Use cost 4 for test fixtures — we only care about hash shape, not strength.
  const hash = await bcrypt.hash(password, 4);
  const res = await db.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email.toLowerCase(), hash, name]
  );
  const row = res.rows[0];
  return { id: row.id, email: row.email, name: row.name, password };
}

export interface TestCourse {
  id: number;
  slug: string;
  title: string;
  price_cents: number;
}

export async function createCourse(opts: {
  slug?: string;
  title?: string;
  priceCents?: number;
  published?: boolean;
} = {}): Promise<TestCourse> {
  const db = await getTestDb();
  const slug = opts.slug ?? `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = opts.title ?? 'Test Course';
  const price = opts.priceCents ?? 0;
  const published = opts.published ?? true;
  const res = await db.query(
    `INSERT INTO courses (slug, title, description, price_cents, published)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, slug, title, price_cents`,
    [slug, title, 'Test description', price, published]
  );
  return res.rows[0];
}

export interface TestLesson {
  id: number;
  course_id: number;
  title: string;
  slug: string;
  lesson_type: string;
  code_solution: string | null;
}

export async function createLesson(opts: {
  courseId: number;
  title?: string;
  slug?: string;
  position?: number;
  content?: string;
  lessonType?: 'text' | 'quiz' | 'code';
  codeStarter?: string | null;
  codeSolution?: string | null;
  quizData?: unknown;
}): Promise<TestLesson> {
  const db = await getTestDb();
  const title = opts.title ?? 'Test Lesson';
  const slug = opts.slug ?? `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const content = opts.content ?? 'Lesson body';
  const type = opts.lessonType ?? 'text';
  const res = await db.query(
    `INSERT INTO lessons (course_id, title, slug, position, content, lesson_type, code_starter, code_solution, quiz_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, course_id, title, slug, lesson_type, code_solution`,
    [
      opts.courseId,
      title,
      slug,
      opts.position ?? 1,
      content,
      type,
      opts.codeStarter ?? null,
      opts.codeSolution ?? null,
      opts.quizData ? JSON.stringify(opts.quizData) : null,
    ]
  );
  return res.rows[0];
}

export async function enroll(userId: number, courseId: number): Promise<void> {
  const db = await getTestDb();
  await db.query(
    'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, courseId]
  );
}

/** Build a signed session cookie string (using the same helper the app uses). */
export async function makeSessionCookie(user: TestUser): Promise<string> {
  const { signToken } = await import('@/lib/auth');
  const token = signToken({ userId: user.id, email: user.email });
  return `avitam_session=${token}`;
}
