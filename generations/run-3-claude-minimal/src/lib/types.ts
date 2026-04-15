export type TextBlock = { type: "text"; markdown: string };
export type QuizBlock = {
  type: "quiz";
  question: string;
  options: string[];
  answer_index: number;
  explanation?: string;
};
export type CodeBlock = {
  type: "code";
  prompt: string;
  starter: string;
  tests: { name: string; code: string }[];
};

export type LessonBlock = TextBlock | QuizBlock | CodeBlock;

export type Course = {
  id: number;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  stripe_price_id: string | null;
  is_published: boolean;
};

export type Lesson = {
  id: number;
  course_id: number;
  slug: string;
  title: string;
  position: number;
  content: LessonBlock[];
};

export type Enrollment = {
  id: number;
  user_id: number;
  course_id: number;
  status: "active" | "pending" | "canceled";
  source: "free" | "stripe";
};
