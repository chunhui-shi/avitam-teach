import "dotenv/config";
import { db } from "./index";
import {
  courses,
  modules,
  lessons,
  type LessonBlock,
} from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Seeding database...");

  // Wipe dependent tables so seed is idempotent.
  await db.execute(sql`TRUNCATE TABLE
    lesson_completions,
    enrollments,
    payments,
    lessons,
    modules,
    courses RESTART IDENTITY CASCADE`);

  const [course] = await db
    .insert(courses)
    .values({
      slug: "modern-javascript-fundamentals",
      title: "Modern JavaScript Fundamentals",
      description:
        "Learn the JavaScript you actually need in modern web development: variables, functions, arrays, objects, async/await, and everyday problem-solving patterns.",
      priceCents: 0,
      isFree: true,
    })
    .returning();

  const moduleSpecs = [
    {
      title: "1. Values and Variables",
      lessons: [
        {
          title: "let, const, and why var is legacy",
          blocks: [
            {
              type: "text",
              markdown:
                "JavaScript has three ways to declare variables: `var`, `let`, and `const`.\n\nIn modern code you should default to `const`, use `let` when you need to reassign, and avoid `var` unless you have a specific reason.",
            },
            {
              type: "codebox",
              instructions:
                "Try changing `const` to `let` and see the difference.",
              starter: "const name = 'Ada';\nconsole.log('Hello,', name);",
            },
            {
              type: "quiz",
              question: "Which keyword creates a binding you can reassign?",
              options: ["const", "let", "final", "def"],
              answerIndex: 1,
            },
          ] as LessonBlock[],
        },
        {
          title: "Primitive types at a glance",
          blocks: [
            {
              type: "text",
              markdown:
                "JavaScript's primitive types are: string, number, boolean, null, undefined, bigint, and symbol.\n\nEverything else — arrays, functions, dates — is an object.",
            },
            {
              type: "codebox",
              instructions: "Print the typeof each value.",
              starter:
                "console.log(typeof 'hi');\nconsole.log(typeof 42);\nconsole.log(typeof true);\nconsole.log(typeof null);",
            },
            {
              type: "quiz",
              question: "What does `typeof null` evaluate to?",
              options: ["'null'", "'object'", "'undefined'", "'number'"],
              answerIndex: 1,
              explanation: "A famously old bug in JavaScript preserved for backward compatibility.",
            },
          ] as LessonBlock[],
        },
      ],
    },
    {
      title: "2. Functions",
      lessons: [
        {
          title: "Function declarations and arrow functions",
          blocks: [
            {
              type: "text",
              markdown:
                "You can write a function in two common ways:\n\n```\nfunction add(a, b) { return a + b; }\nconst add = (a, b) => a + b;\n```\n\nArrow functions are shorter and don't bind their own `this`.",
            },
            {
              type: "codebox",
              instructions: "Call the function and print its result.",
              starter:
                "const add = (a, b) => a + b;\nconsole.log(add(2, 3));",
            },
            {
              type: "quiz",
              question:
                "Which statement about arrow functions is true?",
              options: [
                "They always bind their own `this`",
                "They cannot take parameters",
                "They do not bind their own `this`",
                "They are slower than function declarations",
              ],
              answerIndex: 2,
            },
          ] as LessonBlock[],
        },
        {
          title: "Parameters, defaults, and rest",
          blocks: [
            {
              type: "text",
              markdown:
                "Modern JavaScript lets you give parameters default values and collect the remaining arguments into an array with `...rest`.",
            },
            {
              type: "codebox",
              instructions:
                "Modify greet so that when no name is passed, it says 'Hello, friend'.",
              starter:
                "function greet(name = 'friend') {\n  return `Hello, ${name}`;\n}\nconsole.log(greet());\nconsole.log(greet('Ada'));",
            },
          ] as LessonBlock[],
        },
      ],
    },
    {
      title: "3. Arrays and Objects",
      lessons: [
        {
          title: "Array methods you will actually use",
          blocks: [
            {
              type: "text",
              markdown:
                "The array methods you'll reach for most often are `map`, `filter`, and `reduce`.\n\n- `map` transforms each item.\n- `filter` keeps the items that pass a test.\n- `reduce` collapses the array into a single value.",
            },
            {
              type: "codebox",
              instructions:
                "Use map to double each number, then filter to keep only those greater than 4.",
              starter:
                "const nums = [1, 2, 3, 4, 5];\nconst doubled = nums.map(n => n * 2);\nconst big = doubled.filter(n => n > 4);\nconsole.log(big);",
            },
            {
              type: "quiz",
              question: "Which method collapses an array to a single value?",
              options: ["map", "filter", "reduce", "forEach"],
              answerIndex: 2,
            },
          ] as LessonBlock[],
        },
        {
          title: "Destructuring and spread",
          blocks: [
            {
              type: "text",
              markdown:
                "Destructuring lets you pull values out of arrays and objects into variables in a single step. The spread operator `...` copies them back out.",
            },
            {
              type: "codebox",
              instructions: "Destructure name and age from the object.",
              starter:
                "const user = { name: 'Ada', age: 36, city: 'London' };\nconst { name, age } = user;\nconsole.log(name, age);",
            },
          ] as LessonBlock[],
        },
      ],
    },
    {
      title: "4. Async JavaScript",
      lessons: [
        {
          title: "Promises and async/await",
          blocks: [
            {
              type: "text",
              markdown:
                "A Promise represents a value that will exist in the future. `async`/`await` is the modern syntax for working with them.\n\n```\nasync function load() {\n  const x = await somePromise();\n  return x;\n}\n```",
            },
            {
              type: "codebox",
              instructions: "Await the promise and print the resolved value.",
              starter:
                "async function main() {\n  const value = await Promise.resolve(42);\n  console.log('got', value);\n}\nmain();",
            },
            {
              type: "quiz",
              question:
                "What does `await` do inside an async function?",
              options: [
                "Blocks the entire Node.js process",
                "Waits for the Promise to settle and yields its value",
                "Converts a value into a Promise",
                "Throws an error",
              ],
              answerIndex: 1,
            },
          ] as LessonBlock[],
        },
      ],
    },
    {
      title: "5. Everyday patterns",
      lessons: [
        {
          title: "Error handling with try/catch",
          blocks: [
            {
              type: "text",
              markdown:
                "Wrap code that might throw in a `try { } catch (err) { }` block. Inside an async function, `await` calls that reject are caught the same way.",
            },
            {
              type: "codebox",
              instructions: "Trigger the catch branch by throwing.",
              starter:
                "try {\n  throw new Error('boom');\n} catch (err) {\n  console.log('caught', err.message);\n}",
            },
          ] as LessonBlock[],
        },
        {
          title: "Putting it together",
          blocks: [
            {
              type: "text",
              markdown:
                "You now have enough JavaScript to build real features. In the next course we'll apply this to building web apps.",
            },
            {
              type: "quiz",
              question: "Which of these is NOT a JavaScript primitive?",
              options: ["string", "number", "array", "boolean"],
              answerIndex: 2,
            },
          ] as LessonBlock[],
        },
      ],
    },
  ];

  for (let mi = 0; mi < moduleSpecs.length; mi++) {
    const spec = moduleSpecs[mi];
    const [mod] = await db
      .insert(modules)
      .values({
        courseId: course.id,
        title: spec.title,
        position: mi,
      })
      .returning();
    for (let li = 0; li < spec.lessons.length; li++) {
      const lesson = spec.lessons[li];
      await db.insert(lessons).values({
        moduleId: mod.id,
        title: lesson.title,
        position: mi * 100 + li,
        blocks: lesson.blocks,
      });
    }
  }

  // Also insert a paid course to exercise the Stripe path.
  await db.insert(courses).values({
    slug: "advanced-async-patterns",
    title: "Advanced Async Patterns",
    description:
      "A deeper tour of Promises, async iteration, cancellation, and concurrency. (Paid course — stub content.)",
    priceCents: 4900,
    isFree: false,
  });

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
