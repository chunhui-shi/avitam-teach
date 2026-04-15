import { query, initializeDb } from '../lib/db';
import { createUser } from '../lib/auth';

async function seed() {
  console.log('Starting database initialization and seeding...');

  try {
    await initializeDb();

    // Create sample user
    const user = await createUser('demo@example.com', 'password123', 'Demo User');
    console.log('Created demo user:', user);

    // Create sample courses
    const course1Result = await query(
      'INSERT INTO courses (title, description, price_cents, is_free) VALUES ($1, $2, $3, $4) RETURNING id',
      ['JavaScript Basics', 'Learn the fundamentals of JavaScript programming', 0, true]
    );
    const course1Id = course1Result.rows[0].id;

    const course2Result = await query(
      'INSERT INTO courses (title, description, price_cents, is_free) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        'React Essentials',
        'Master React from beginner to intermediate level',
        9999,
        false,
      ]
    );
    const course2Id = course2Result.rows[0].id;

    // Create lessons for course 1
    const lesson1Result = await query(
      'INSERT INTO lessons (course_id, title, content, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        course1Id,
        'Introduction to Variables',
        'Learn how to declare and use variables in JavaScript',
        1,
      ]
    );
    const lesson1Id = lesson1Result.rows[0].id;

    // Create blocks for lesson 1
    await query(
      'INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index) VALUES ($1, $2, $3, $4)',
      [
        lesson1Id,
        'text',
        'Variables are containers for storing data values. In JavaScript, you can declare variables using var, let, or const.',
        1,
      ]
    );

    const quizBlockResult = await query(
      'INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        lesson1Id,
        'quiz',
        'Which keyword is recommended for declaring variables in modern JavaScript?',
        2,
      ]
    );
    const quizBlockId = quizBlockResult.rows[0].id;

    // Add quiz options
    await query(
      'INSERT INTO quiz_options (block_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)',
      [quizBlockId, 'var', false, 1]
    );
    await query(
      'INSERT INTO quiz_options (block_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)',
      [quizBlockId, 'let', true, 2]
    );
    await query(
      'INSERT INTO quiz_options (block_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)',
      [quizBlockId, 'const', true, 3]
    );

    // Add code block
    await query(
      'INSERT INTO lesson_blocks (lesson_id, block_type, content, order_index) VALUES ($1, $2, $3, $4)',
      [
        lesson1Id,
        'code',
        `// Try declaring variables with different keywords
let greeting = "Hello, World!";
const name = "Alice";
console.log(greeting + " " + name);`,
        3,
      ]
    );

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
