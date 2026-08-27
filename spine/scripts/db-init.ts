import { readFile } from 'fs/promises';
import path from 'path';
import pool from '../src/lib/db';

async function main() {
  const schema = await readFile(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.end();
  console.log('Database schema applied');
}

main().catch(async err => {
  console.error('Database initialization failed:', err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
