import { Pool } from 'pg';
import { readFileSync } from 'fs';
import path from 'path';

const CONN =
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:test@localhost:5432/avitam_test';

// Create the schema once before the suite runs. We load the table definitions
// from the app's own schema.sql (everything up to the seed block) so the test
// database always matches production's shape — then each test seeds the exact
// rows it needs.
export default async function setup() {
  const pool = new Pool({ connectionString: CONN });
  const full = readFileSync(
    path.resolve(__dirname, '../../src/lib/schema.sql'),
    'utf8'
  );
  const ddl = full.split('-- Seed: sample courses')[0];
  await pool.query(ddl);
  await pool.end();
}
