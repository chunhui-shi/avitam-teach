export interface User {
  id: number;
  email: string;
  name: string;
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
