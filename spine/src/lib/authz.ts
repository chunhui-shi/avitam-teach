import { queryOne } from './db';
import { getCurrentUser } from './auth';
import type { User, Course } from '@/types';

// Result of a course-management authorization check.
export type CourseAuthz =
  | { ok: true; user: User; course: Course }
  | { ok: false; status: number; error: string };

// An instructor may manage their own courses; an admin may manage any course.
export async function authorizeCourseManagement(courseId: number): Promise<CourseAuthz> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: 'Authentication required' };

  if (user.role !== 'instructor' && user.role !== 'admin') {
    return { ok: false, status: 403, error: 'Instructor or admin role required' };
  }

  const course = await queryOne<Course>('SELECT * FROM courses WHERE id = $1', [courseId]);
  if (!course) return { ok: false, status: 404, error: 'Course not found' };

  if (user.role !== 'admin' && course.instructor_id !== user.id) {
    return { ok: false, status: 403, error: 'You do not own this course' };
  }

  return { ok: true, user, course };
}
