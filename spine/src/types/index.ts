export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  bio: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Course {
  id: number;
  instructor_id: number | null;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  published: boolean;
  created_at: string;
  lesson_count?: number;
  enrolled?: boolean;
  instructor_name?: string | null;
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
  correct: number;
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
  author_name: string;
  author_avatar_url: string | null;
}
