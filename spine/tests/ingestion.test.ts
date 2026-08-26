import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ bytes: Buffer.from('A closure retains access to lexical scope.') }));
const vector = vi.hoisted(() => Array.from({ length: 256 }, (_, i) => i === 0 ? 1 : 0));

vi.mock('@/lib/storage', () => ({
  storage: {
    save: async () => '/unused',
    read: async () => state.bytes,
    remove: async () => undefined,
  },
}));
vi.mock('@/lib/embedding-provider', () => ({
  embeddingProvider: { embed: async (texts: string[]) => texts.map(() => vector) },
}));

import { enqueueIngestion, processNextIngestionJob } from '@/lib/ingestion';
import { resetDb, seedCourse, seedUser, testPool } from './helpers/db';

describe('knowledge ingestion lifecycle', () => {
  beforeEach(resetDb);

  it('atomically replaces chunks when the same source is re-indexed', async () => {
    const instructor = await seedUser({ role: 'instructor' });
    const course = await seedCourse({ instructor_id: instructor.id });
    const { rows } = await testPool.query(`
      INSERT INTO course_materials
        (course_id, uploaded_by, title, filename, content_type, storage_key, content_sha256)
      VALUES ($1, $2, 'Closure notes', 'closures.txt', 'text/plain', 'materials/1', 'hash')
      RETURNING id
    `, [course.id, instructor.id]);
    const materialId = rows[0].id as number;

    await enqueueIngestion(course.id, 'material', materialId);
    expect(await processNextIngestionJob()).toBe(true);
    let result = await testPool.query(
      "SELECT content FROM knowledge_chunks WHERE source_type = 'material' AND source_id = $1",
      [materialId]
    );
    expect(result.rows).toHaveLength(1);

    state.bytes = Buffer.from('Replacement content about lexical environments.');
    await enqueueIngestion(course.id, 'material', materialId);
    expect(await processNextIngestionJob()).toBe(true);
    result = await testPool.query(
      "SELECT content FROM knowledge_chunks WHERE source_type = 'material' AND source_id = $1",
      [materialId]
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toContain('Replacement content');

    const material = await testPool.query('SELECT status FROM course_materials WHERE id = $1', [materialId]);
    expect(material.rows[0].status).toBe('ready');
  });
});
