import { query } from '../src/lib/db';
import { enqueueIngestion } from '../src/lib/ingestion';
import pool from '../src/lib/db';

async function main() {
  const lessons = await query<{ id: number; course_id: number }>(`
    SELECT l.id, l.course_id
    FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE c.published = true
    ORDER BY l.course_id, l.position
  `);
  for (const lesson of lessons) {
    await enqueueIngestion(lesson.course_id, 'lesson', lesson.id);
  }
  console.log(`[knowledge-backfill] queued ${lessons.length} published lessons`);
  await pool.end();
}

main().catch(err => {
  console.error('[knowledge-backfill] failed', err);
  process.exitCode = 1;
});
