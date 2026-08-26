-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- student | instructor | admin
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill columns on existing installs (no-ops if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0, -- 0 = free
  image_url TEXT,
  published BOOLEAN DEFAULT false,
  instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill owning instructor on existing installs
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL, -- markdown/rich text
  lesson_type TEXT NOT NULL DEFAULT 'text', -- text | quiz | code
  -- For quiz lessons: JSON array of questions
  quiz_data JSONB,
  -- For code lessons: starter code + expected tests
  code_starter TEXT,
  code_solution TEXT,
  code_language TEXT DEFAULT 'javascript',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

-- Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Lesson progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  quiz_score INTEGER,
  code_submission TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- Stripe payment records
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY, -- Stripe event id
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson comments / discussion
CREATE TABLE IF NOT EXISTS lesson_comments (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES lesson_comments(id) ON DELETE CASCADE, -- null = top-level
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(lesson_id);

-- v5-evolved: course knowledge base. pgvector keeps retrieval in the same
-- database whose course and enrollment constraints already define authority.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS course_materials (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  content_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, content_sha256)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('lesson', 'material')),
  source_id INTEGER NOT NULL,
  source_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(256) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_course
  ON knowledge_chunks(course_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id BIGSERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('lesson', 'material')),
  source_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_claim
  ON ingestion_jobs(status, available_at, id);

-- Seed: sample courses
INSERT INTO courses (slug, title, description, price_cents, published) VALUES
  ('intro-javascript', 'Introduction to JavaScript', 'Learn the fundamentals of JavaScript from scratch. Variables, functions, loops, and more.', 0, true),
  ('async-javascript', 'Async JavaScript', 'Master promises, async/await, fetch API, and event-driven programming.', 2900, true),
  ('node-backend', 'Node.js Backend Development', 'Build REST APIs with Node.js, Express, and PostgreSQL.', 4900, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed: sample lessons for intro-javascript
INSERT INTO lessons (course_id, title, slug, position, content, lesson_type, code_starter, code_solution, code_language) VALUES
  (
    (SELECT id FROM courses WHERE slug = 'intro-javascript'),
    'Variables and Data Types',
    'variables-and-data-types',
    1,
    '## Variables and Data Types

In JavaScript, you can store values using **variables**. There are three ways to declare a variable:

- `var` (old way, avoid)
- `let` (block-scoped, can reassign)
- `const` (block-scoped, cannot reassign)

### Primitive Types

| Type | Example |
|------|---------|
| Number | `42`, `3.14` |
| String | `"hello"`, `''world''` |
| Boolean | `true`, `false` |
| null | `null` |
| undefined | `undefined` |

### Try It

In the code editor below, create a variable called `greeting` and set it to `"Hello, World!"`.
',
    'code',
    '// Create a variable called greeting\n// and set it to "Hello, World!"\n\n// Your code here:\n\nconsole.log(greeting);',
    'const greeting = "Hello, World!";\nconsole.log(greeting);',
    'javascript'
  ),
  (
    (SELECT id FROM courses WHERE slug = 'intro-javascript'),
    'Functions',
    'functions',
    2,
    '## Functions

A **function** is a reusable block of code that performs a specific task.

```javascript
function greet(name) {
  return "Hello, " + name + "!";
}

greet("Alice"); // "Hello, Alice!"
```

### Arrow Functions

Modern JavaScript also supports **arrow functions**:

```javascript
const greet = (name) => "Hello, " + name + "!";
```

Functions help you avoid repeating yourself (DRY principle).
',
    'quiz',
    NULL,
    NULL,
    'javascript'
  ),
  (
    (SELECT id FROM courses WHERE slug = 'intro-javascript'),
    'Loops and Iteration',
    'loops-and-iteration',
    3,
    '## Loops

Loops let you run a block of code multiple times.

### for loop

```javascript
for (let i = 0; i < 5; i++) {
  console.log(i);
}
```

### while loop

```javascript
let i = 0;
while (i < 5) {
  console.log(i);
  i++;
}
```

### forEach

```javascript
[1, 2, 3].forEach(n => console.log(n));
```
',
    'code',
    '// Use a for loop to print numbers 1 through 5\n// Store results in an array called "results"\n\nconst results = [];\n\n// Your loop here:\n\nconsole.log(results);',
    'const results = [];\nfor (let i = 1; i <= 5; i++) {\n  results.push(i);\n}\nconsole.log(results);',
    'javascript'
  )
ON CONFLICT DO NOTHING;

-- Seed quiz data for Functions lesson
UPDATE lessons
SET quiz_data = ''[
  {
    "id": "q1",
    "question": "Which keyword is used to define a function in JavaScript?",
    "options": ["func", "function", "def", "fn"],
    "correct": 1
  },
  {
    "id": "q2",
    "question": "What does a function return if no return statement is given?",
    "options": ["0", "null", "undefined", "''"],
    "correct": 2
  },
  {
    "id": "q3",
    "question": "Which of the following is a valid arrow function?",
    "options": [
      "const f = => x + 1",
      "const f = (x) => x + 1",
      "function f => (x) x + 1",
      "arrow f(x) { return x + 1 }"
    ],
    "correct": 1
  }
]''::jsonb
WHERE slug = ''functions'';
