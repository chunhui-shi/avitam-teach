import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tier: text("tier").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  isFree: boolean("is_free").notNull().default(true),
});

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
});

// A lesson block is one of:
//   { type: "text", markdown: string }
//   { type: "codebox", starter: string, instructions?: string }
//   { type: "quiz", question: string, options: string[], answerIndex: number, explanation?: string }
export type LessonBlock =
  | { type: "text"; markdown: string }
  | { type: "codebox"; starter: string; instructions?: string }
  | {
      type: "quiz";
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    };

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  blocks: jsonb("blocks").$type<LessonBlock[]>().notNull().default([]),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tier: text("tier").notNull().default("free"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userCourseUnique: uniqueIndex("enrollments_user_course_uq").on(
      t.userId,
      t.courseId,
    ),
  }),
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull().default(0),
  provider: text("provider").notNull().default("stripe"),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => ({
    userLessonUnique: uniqueIndex("lesson_completions_user_lesson_uq").on(
      t.userId,
      t.lessonId,
    ),
  }),
);
