import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Default to a local throwaway database. Override with DATABASE_URL for CI.
const TEST_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://avitam:avitam@localhost:5432/avitam_teach_v1_test';

let client: Client | null = null;

export async function getTestDb(): Promise<Client> {
  if (client) return client;
  client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  return client;
}

export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

/**
 * Load and run schema.sql once at suite start. The schema file is idempotent
 * (CREATE TABLE IF NOT EXISTS) so re-running is safe.
 *
 * NOTE: schema.sql ships with seed INSERTs for courses/lessons. We do NOT want
 * those in test data (they collide with fixtures). We strip everything after
 * the first "-- Seed" comment and run only the CREATE TABLE block.
 */
export async function initSchema(): Promise<void> {
  const db = await getTestDb();
  const schemaPath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'lib',
    'schema.sql'
  );
  const fullSchema = fs.readFileSync(schemaPath, 'utf8');

  const seedIdx = fullSchema.indexOf('-- Seed');
  const ddlOnly = seedIdx === -1 ? fullSchema : fullSchema.slice(0, seedIdx);

  await db.query(ddlOnly);
}

/** Wipe every row from every application table. Run between tests. */
export async function truncateAll(): Promise<void> {
  const db = await getTestDb();
  // Order matters because of FK constraints, but TRUNCATE ... CASCADE handles it.
  await db.query(`
    TRUNCATE TABLE
      lesson_progress,
      enrollments,
      stripe_events,
      lessons,
      courses,
      users
    RESTART IDENTITY CASCADE
  `);
}
