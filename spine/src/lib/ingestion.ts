import { PDFParse } from 'pdf-parse';
import pool, { query, queryOne } from './db';
import { storage } from './storage';
import { chunkText, KnowledgeSourceType, vectorLiteral } from './knowledge';
import { embeddingProvider } from './embedding-provider';

const MAX_EXTRACTED_CHARS = 1_000_000;
const EMBEDDING_BATCH = 64;
const MAX_ATTEMPTS = 5;

interface IngestionJob {
  id: number;
  course_id: number;
  source_type: KnowledgeSourceType;
  source_id: number;
  attempts: number;
}

export async function enqueueIngestion(
  courseId: number,
  sourceType: KnowledgeSourceType,
  sourceId: number
): Promise<void> {
  await query(`
    INSERT INTO ingestion_jobs (course_id, source_type, source_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (source_type, source_id) DO UPDATE SET
      course_id = EXCLUDED.course_id,
      status = 'pending',
      attempts = 0,
      available_at = NOW(),
      locked_at = NULL,
      last_error = NULL,
      updated_at = NOW()
  `, [courseId, sourceType, sourceId]);

  if (sourceType === 'material') {
    await query(`
      UPDATE course_materials
      SET status = 'pending', error_message = NULL, updated_at = NOW()
      WHERE id = $1 AND course_id = $2
    `, [sourceId, courseId]);
  }
}

async function claimJob(): Promise<IngestionJob | null> {
  return queryOne<IngestionJob>(`
    WITH candidate AS (
      SELECT id
      FROM ingestion_jobs
      WHERE (status = 'pending' AND available_at <= NOW())
         OR (status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes')
      ORDER BY available_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE ingestion_jobs AS job
    SET status = 'processing', attempts = attempts + 1,
        locked_at = NOW(), updated_at = NOW()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.course_id, job.source_type, job.source_id, job.attempts
  `);
}

async function extractPdf(bytes: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function loadSource(job: IngestionJob): Promise<{ title: string; text: string } | null> {
  if (job.source_type === 'lesson') {
    const lesson = await queryOne<{ title: string; content: string; published: boolean }>(`
      SELECT l.title, l.content, c.published
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = $1 AND l.course_id = $2
    `, [job.source_id, job.course_id]);
    if (!lesson || !lesson.published) return null;
    return { title: lesson.title, text: lesson.content };
  }

  const material = await queryOne<{
    title: string;
    storage_key: string;
    content_type: string;
  }>(`
    SELECT title, storage_key, content_type
    FROM course_materials
    WHERE id = $1 AND course_id = $2
  `, [job.source_id, job.course_id]);
  if (!material) return null;

  const bytes = await storage.read(material.storage_key);
  const text = material.content_type === 'application/pdf'
    ? await extractPdf(bytes)
    : bytes.toString('utf8');
  return { title: material.title, text };
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
    all.push(...await embeddingProvider.embed(chunks.slice(i, i + EMBEDDING_BATCH)));
  }
  return all;
}

async function replaceChunks(
  job: IngestionJob,
  source: { title: string; text: string } | null
): Promise<void> {
  const chunks = source ? chunkText(source.text.slice(0, MAX_EXTRACTED_CHARS)) : [];
  const embeddings = await embedChunks(chunks);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM knowledge_chunks WHERE source_type = $1 AND source_id = $2',
      [job.source_type, job.source_id]
    );
    for (let i = 0; i < chunks.length; i++) {
      await client.query(`
        INSERT INTO knowledge_chunks
          (course_id, source_type, source_id, source_title, chunk_index, content, embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
      `, [
        job.course_id,
        job.source_type,
        job.source_id,
        source!.title,
        i,
        chunks[i],
        vectorLiteral(embeddings[i]),
      ]);
    }
    await client.query(`
      UPDATE ingestion_jobs
      SET status = 'complete', locked_at = NULL, last_error = NULL, updated_at = NOW()
      WHERE id = $1
    `, [job.id]);
    if (job.source_type === 'material') {
      await client.query(`
        UPDATE course_materials
        SET status = 'ready', error_message = NULL, updated_at = NOW()
        WHERE id = $1
      `, [job.source_id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function failJob(job: IngestionJob, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000);
  const retry = job.attempts < MAX_ATTEMPTS;
  await query(`
    UPDATE ingestion_jobs
    SET status = $2,
        available_at = CASE WHEN $2 = 'pending'
          THEN NOW() + ($3 * INTERVAL '30 seconds') ELSE available_at END,
        locked_at = NULL, last_error = $4, updated_at = NOW()
    WHERE id = $1
  `, [job.id, retry ? 'pending' : 'failed', job.attempts, message]);
  if (job.source_type === 'material') {
    await query(`
      UPDATE course_materials
      SET status = $2, error_message = $3, updated_at = NOW()
      WHERE id = $1
    `, [job.source_id, retry ? 'pending' : 'failed', message]);
  }
}

export async function processNextIngestionJob(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  try {
    if (job.source_type === 'material') {
      await query(`
        UPDATE course_materials
        SET status = 'processing', error_message = NULL, updated_at = NOW()
        WHERE id = $1
      `, [job.source_id]);
    }
    const source = await loadSource(job);
    await replaceChunks(job, source);
  } catch (err) {
    await failJob(job, err);
  }
  return true;
}
