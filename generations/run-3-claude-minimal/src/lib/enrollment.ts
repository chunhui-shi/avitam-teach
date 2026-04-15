import { query } from "./db";

export async function isEnrolled(userId: number, courseId: number): Promise<boolean> {
  const { rows } = await query<{ id: number }>(
    "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
    [userId, courseId]
  );
  return rows.length > 0;
}

export async function enrollFree(userId: number, courseId: number) {
  await query(
    `INSERT INTO enrollments (user_id, course_id, status, source)
     VALUES ($1, $2, 'active', 'free')
     ON CONFLICT (user_id, course_id) DO UPDATE
       SET status = 'active', source = EXCLUDED.source`,
    [userId, courseId]
  );
}
