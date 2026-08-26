const EMBEDDING_DIMENSIONS = 256;
const DEFAULT_MODEL = 'text-embedding-3-small';

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for knowledge ingestion and retrieval');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || DEFAULT_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Embedding request failed (${response.status}): ${detail}`);
    }

    const body = await response.json() as {
      data?: { index: number; embedding: number[] }[];
    };
    const ordered = [...(body.data || [])].sort((a, b) => a.index - b.index);
    if (ordered.length !== texts.length) {
      throw new Error('Embedding provider returned an unexpected result count');
    }
    for (const item of ordered) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error('Embedding provider returned an unexpected vector dimension');
      }
    }
    return ordered.map(item => item.embedding);
  }
}

export const embeddingDimensions = EMBEDDING_DIMENSIONS;
export const embeddingProvider: EmbeddingProvider = new OpenAIEmbeddingProvider();
