import { Pool } from 'pg';
import { resetRateLimits } from '@/lib/rate-limit';

const CONN =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:test@localhost:5432/avitam_test';

// A pool the tests use directly to seed fixtures and check the database after
// a request. The route handlers use the app's own pool (@/lib/db); both point
// at the same test database.
export const testPool = new Pool({ connectionString: CONN });

let slugCounter = 0;

// Wipe every table and reset the id sequences so each test starts from a known,
// empty state with predictable ids.
export async function resetDb() {
  await testPool.query(
    `TRUNCATE users, courses, lessons, enrollments,
       lesson_progress, lesson_comments, stripe_events,
       course_materials, knowledge_chunks, ingestion_jobs
     RESTART IDENTITY CASCADE`
  );
  // Clear in-memory rate-limit counters too, so each test starts clean.
  resetRateLimits();
}

export async function seedUser(
  opts: { email?: string; name?: string; role?: string } = {}
) {
  const {
    email = `user${++slugCounter}@test.dev`,
    name = 'Test User',
    role = 'student',
  } = opts;
  const { rows } = await testPool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, 'x', $2, $3) RETURNING id, email, role`,
    [email, name, role]
  );
  return rows[0] as { id: number; email: string; role: string };
}

export async function seedCourse(
  opts: { price_cents?: number; published?: boolean; slug?: string; instructor_id?: number | null } = {}
) {
  const {
    price_cents = 0,
    published = true,
    slug = `course-${++slugCounter}`,
    instructor_id = null,
  } = opts;
  const { rows } = await testPool.query(
    `INSERT INTO courses (slug, title, description, price_cents, published, instructor_id)
     VALUES ($1, 'Test Course', 'A test course', $2, $3, $4) RETURNING id, price_cents`,
    [slug, price_cents, published, instructor_id]
  );
  return rows[0] as { id: number; price_cents: number };
}

export async function seedLesson(opts: {
  course_id: number;
  lesson_type?: string;
  code_solution?: string | null;
  quiz_data?: unknown;
  slug?: string;
}) {
  const {
    course_id,
    lesson_type = 'text',
    code_solution = null,
    quiz_data = null,
    slug = `lesson-${++slugCounter}`,
  } = opts;
  const { rows } = await testPool.query(
    `INSERT INTO lessons
       (course_id, title, slug, position, content, lesson_type, code_solution, quiz_data)
     VALUES ($1, 'Test Lesson', $2, 1, 'Lesson content', $3, $4, $5)
     RETURNING id`,
    [
      course_id,
      slug,
      lesson_type,
      code_solution,
      quiz_data === null ? null : JSON.stringify(quiz_data),
    ]
  );
  return rows[0] as { id: number };
}

export async function seedEnrollment(user_id: number, course_id: number) {
  await testPool.query(
    `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [user_id, course_id]
  );
}

export async function countEnrollments(user_id: number) {
  const { rows } = await testPool.query(
    'SELECT count(*)::int AS n FROM enrollments WHERE user_id = $1',
    [user_id]
  );
  return rows[0].n as number;
}
