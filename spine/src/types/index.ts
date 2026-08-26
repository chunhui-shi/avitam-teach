export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  published: boolean;
  instructor_id: number | null;
  created_at: string;
  lesson_count?: number;
  enrolled?: boolean;
}

export interface Lesson {
  id: number;
  course_id: number;
  title: string;
  slug: string;
  position: number;
  content: string;
  lesson_type: 'text' | 'quiz' | 'code';
  quiz_data: QuizQuestion[] | null;
  code_starter: string | null;
  code_solution: string | null;
  code_language: string;
  created_at: string;
  completed?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  // Optional because the student-facing lesson endpoint strips it: grading is
  // server-side (see the quiz/grade route). It is present in the database row
  // and on the server; it is never sent to the browser before grading.
  correct?: number;
}

// What the quiz/grade endpoint returns after checking the student's answers.
export interface QuizGradeResult {
  score: number; // percentage 0-100
  total: number;
  correctCount: number;
  results: { id: string; correctIndex: number; wasCorrect: boolean }[];
}

export interface Enrollment {
  id: number;
  user_id: number;
  course_id: number;
  stripe_payment_intent_id: string | null;
  enrolled_at: string;
}

export interface LessonProgress {
  id: number;
  user_id: number;
  lesson_id: number;
  completed: boolean;
  quiz_score: number | null;
  code_submission: string | null;
  completed_at: string | null;
}

export interface LessonComment {
  id: number;
  lesson_id: number;
  user_id: number;
  parent_id: number | null;
  body: string;
  created_at: string;
  // joined for display
  author_name?: string;
  author_avatar_url?: string | null;
}

export type MaterialStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface CourseMaterial {
  id: number;
  course_id: number;
  uploaded_by: number;
  title: string;
  filename: string;
  content_type: 'text/plain' | 'text/markdown' | 'application/pdf';
  status: MaterialStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
