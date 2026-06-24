import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export type Role = 'student' | 'instructor' | 'admin';

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  return queryOne<CurrentUser>(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [session.userId]
  );
}

export function canManageCourses(user: CurrentUser | null): user is CurrentUser {
  return user?.role === 'instructor' || user?.role === 'admin';
}

export function isAdmin(user: CurrentUser | null): user is CurrentUser {
  return user?.role === 'admin';
}

export async function canManageCourse(user: CurrentUser | null, courseId: number): Promise<boolean> {
  if (!canManageCourses(user)) return false;
  if (user.role === 'admin') return true;

  const course = await queryOne<{ id: number }>(
    'SELECT id FROM courses WHERE id = $1 AND instructor_id = $2',
    [courseId, user.id]
  );
  return !!course;
}

export async function canAccessLessonDiscussion(userId: number, courseId: number): Promise<boolean> {
  const access = await queryOne<{ allowed: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM enrollments
      WHERE user_id = $1 AND course_id = $2
    ) OR EXISTS (
      SELECT 1
      FROM courses
      WHERE id = $2 AND instructor_id = $1
    ) OR EXISTS (
      SELECT 1
      FROM users
      WHERE id = $1 AND role = 'admin'
    ) AS allowed
  `, [userId, courseId]);

  return !!access?.allowed;
}
