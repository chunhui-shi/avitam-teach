// Seed sample courses + lessons. Run: node scripts/seed.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadEnv() {
  try {
    const raw = await readFile(resolve(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const courses = [
  {
    slug: "js-fundamentals",
    title: "JavaScript Fundamentals",
    description: "A free introduction to variables, functions, and control flow.",
    price_cents: 0,
    lessons: [
      {
        slug: "variables",
        title: "Variables and Types",
        content: [
          {
            type: "text",
            markdown:
              "JavaScript has three ways to declare a variable: `let`, `const`, and the older `var`.\n\nUse `const` when the binding will never be reassigned, and `let` otherwise.",
          },
          {
            type: "quiz",
            question: "Which keyword creates a binding that cannot be reassigned?",
            options: ["var", "let", "const", "fixed"],
            answer_index: 2,
            explanation: "`const` prevents reassignment of the binding.",
          },
          {
            type: "code",
            prompt: "Declare a constant `greeting` holding the string 'hello' and log it.",
            starter: "// your code here\n",
            tests: [
              {
                name: "greeting is defined and equals 'hello'",
                code: "if (typeof greeting === 'undefined') throw new Error('greeting not defined'); if (greeting !== 'hello') throw new Error('wrong value');",
              },
            ],
          },
        ],
      },
      {
        slug: "functions",
        title: "Functions",
        content: [
          {
            type: "text",
            markdown:
              "Functions let you package up logic for reuse. You can declare them with `function` or as arrow functions.",
          },
          {
            type: "code",
            prompt: "Write a function `add(a, b)` that returns the sum.",
            starter: "function add(a, b) {\n  // ...\n}\n",
            tests: [
              { name: "add(2,3) === 5", code: "if (add(2,3) !== 5) throw new Error('expected 5');" },
              { name: "add(-1,1) === 0", code: "if (add(-1,1) !== 0) throw new Error('expected 0');" },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "advanced-js",
    title: "Advanced JavaScript Patterns",
    description: "Closures, higher-order functions, and async patterns. (Paid)",
    price_cents: 2900,
    lessons: [
      {
        slug: "closures",
        title: "Closures",
        content: [
          {
            type: "text",
            markdown:
              "A **closure** is a function that remembers the variables from the scope in which it was created.",
          },
          {
            type: "code",
            prompt: "Write `makeCounter()` that returns a function, each call of which increments and returns a count starting at 1.",
            starter: "function makeCounter() {\n  // ...\n}\n",
            tests: [
              {
                name: "Sequential calls return 1, 2, 3",
                code: "const c = makeCounter(); if (c() !== 1) throw new Error('expected 1'); if (c() !== 2) throw new Error('expected 2'); if (c() !== 3) throw new Error('expected 3');",
              },
              {
                name: "Independent counters",
                code: "const a = makeCounter(); const b = makeCounter(); a(); a(); if (b() !== 1) throw new Error('counters should be independent');",
              },
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  await loadEnv();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const c of courses) {
    const existing = await client.query("SELECT id FROM courses WHERE slug = $1", [c.slug]);
    let courseId;
    if (existing.rows.length > 0) {
      courseId = existing.rows[0].id;
      await client.query(
        "UPDATE courses SET title=$1, description=$2, price_cents=$3 WHERE id=$4",
        [c.title, c.description, c.price_cents, courseId]
      );
    } else {
      const r = await client.query(
        "INSERT INTO courses (slug, title, description, price_cents) VALUES ($1,$2,$3,$4) RETURNING id",
        [c.slug, c.title, c.description, c.price_cents]
      );
      courseId = r.rows[0].id;
    }
    // Reset lessons for simplicity.
    await client.query("DELETE FROM lessons WHERE course_id = $1", [courseId]);
    let pos = 1;
    for (const l of c.lessons) {
      await client.query(
        "INSERT INTO lessons (course_id, slug, title, position, content) VALUES ($1,$2,$3,$4,$5)",
        [courseId, l.slug, l.title, pos++, JSON.stringify(l.content)]
      );
    }
    console.log(`Seeded ${c.slug} (${c.lessons.length} lessons)`);
  }

  await client.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
