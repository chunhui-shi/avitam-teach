import { query } from './db';
import { embeddingProvider } from './embedding-provider';

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 180;
const DEFAULT_MIN_SIMILARITY = 0.25;

export type KnowledgeSourceType = 'lesson' | 'material';

export interface KnowledgeHit {
  sourceType: KnowledgeSourceType;
  sourceId: number;
  title: string;
  content: string;
  similarity: number;
}

export function chunkText(input: string): string[] {
  const normalized = input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_CHARS, normalized.length);
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf('\n\n', end);
      const sentence = normalized.lastIndexOf('. ', end);
      const candidate = Math.max(paragraph, sentence);
      if (candidate > start + Math.floor(CHUNK_CHARS * 0.6)) {
        end = candidate + (candidate === sentence ? 1 : 0);
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

export function vectorLiteral(values: number[]): string {
  if (values.some(value => !Number.isFinite(value))) {
    throw new Error('Embedding contains a non-finite value');
  }
  return `[${values.join(',')}]`;
}

export async function retrieveCourseKnowledge(
  courseId: number,
  question: string,
  limit = 5
): Promise<KnowledgeHit[]> {
  const [embedding] = await embeddingProvider.embed([question]);
  const threshold = Number(process.env.RETRIEVAL_MIN_SIMILARITY || DEFAULT_MIN_SIMILARITY);
  const rows = await query<{
    source_type: KnowledgeSourceType;
    source_id: number;
    source_title: string;
    content: string;
    similarity: number;
  }>(`
    SELECT source_type, source_id, source_title, content,
           1 - (embedding <=> $2::vector) AS similarity
    FROM knowledge_chunks
    WHERE course_id = $1
      AND 1 - (embedding <=> $2::vector) >= $3
    ORDER BY embedding <=> $2::vector
    LIMIT $4
  `, [courseId, vectorLiteral(embedding), threshold, Math.min(Math.max(limit, 1), 10)]);

  return rows.map(row => ({
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.source_title,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}

export function evidencePrompt(hits: KnowledgeHit[]): string {
  return hits.map((hit, index) => {
    const safeTitle = hit.title.replace(/[\r\n]/g, ' ').slice(0, 200);
    const safeContent = hit.content.replace(/\[SOURCE/gi, '[REFERENCE');
    return `[SOURCE ${index + 1} BEGIN: ${safeTitle}]\n${safeContent}\n[SOURCE ${index + 1} END]`;
  }).join('\n\n');
}
