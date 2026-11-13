import { cosineSimilarity, tokenizeText } from './embeddings';

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

export interface IndexedChunkRecord {
  id: string;
  docId: string;
  filename: string;
  domain: string;
  fileType: string;
  docVersion: number;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  wordCount: number;
  embedding: number[];
}

export interface RetrievalOptions {
  mode: SearchMode;
  topK: number;
  domainFilter?: string;
  docIdFilter?: string;
  fileTypeFilter?: string;
}

export interface RetrievalResult {
  chunkId: string;
  docId: string;
  filename: string;
  domain: string;
  fileType: string;
  docVersion: number;
  pageNumber: number;
  content: string;
  semanticScore: number;
  keywordScore: number;
  combinedScore: number;
  matchedTerms: string[];
}

/**
 * Computes BM25 score for a document chunk against query tokens.
 */
function computeBm25(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  docFreq: Map<string, number>,
  totalDocs: number,
): { score: number; matchedTerms: string[] } {
  if (queryTokens.length === 0 || docTokens.length === 0 || totalDocs === 0) {
    return { score: 0, matchedTerms: [] };
  }

  const k1 = 1.5;
  const b = 0.75;
  const tf = new Map<string, number>();
  for (const t of docTokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }

  let score = 0;
  const matched = new Set<string>();
  const uniqueQuery = Array.from(new Set(queryTokens));

  for (const qt of uniqueQuery) {
    const freq = tf.get(qt) ?? 0;
    if (freq === 0) continue;
    matched.add(qt);
    const df = docFreq.get(qt) ?? 0;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const denom = freq + k1 * (1 - b + b * (docTokens.length / Math.max(1, avgDocLen)));
    score += idf * ((freq * (k1 + 1)) / denom);
  }

  return { score, matchedTerms: Array.from(matched) };
}

/**
 * Executes semantic, keyword (BM25), or hybrid retrieval with metadata filtering.
 */
export function retrieveChunks(
  query: string,
  chunks: IndexedChunkRecord[],
  queryEmbedding: number[],
  options: RetrievalOptions,
): RetrievalResult[] {
  const filtered = chunks.filter((chunk) => {
    if (options.domainFilter && options.domainFilter !== 'all' && chunk.domain !== options.domainFilter) {
      return false;
    }
    if (options.docIdFilter && options.docIdFilter !== 'all' && chunk.docId !== options.docIdFilter) {
      return false;
    }
    if (options.fileTypeFilter && options.fileTypeFilter !== 'all' && chunk.fileType !== options.fileTypeFilter) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) return [];

  const queryTokens = tokenizeText(query);
  const tokenizedDocs = filtered.map((c) => tokenizeText(c.content));
  const docFreq = new Map<string, number>();
  let totalLen = 0;

  for (const tokens of tokenizedDocs) {
    totalLen += tokens.length;
    const seen = new Set(tokens);
    for (const t of seen) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }
  const avgDocLen = totalLen / filtered.length;

  const rawScored = filtered.map((chunk, idx) => {
    const sem = cosineSimilarity(queryEmbedding, chunk.embedding);
    const bm25 = computeBm25(queryTokens, tokenizedDocs[idx], avgDocLen, docFreq, filtered.length);
    return {
      chunk,
      sem,
      bm25Raw: bm25.score,
      matchedTerms: bm25.matchedTerms,
    };
  });

  const maxBm25 = rawScored.reduce((m, item) => Math.max(m, item.bm25Raw), 0);

  const results: RetrievalResult[] = rawScored.map((item) => {
    // Normalize BM25 relative to query coverage and top corpus match
    const coverage =
      queryTokens.length > 0
        ? item.matchedTerms.length / Math.max(1, new Set(queryTokens).size)
        : 0;
    const bm25Norm = maxBm25 > 0 ? (item.bm25Raw / maxBm25) * (0.4 + 0.6 * coverage) : 0;

    let combined = 0;
    if (options.mode === 'semantic') {
      combined = item.sem;
    } else if (options.mode === 'keyword') {
      combined = bm25Norm;
    } else {
      combined = 0.58 * item.sem + 0.42 * bm25Norm;
    }

    return {
      chunkId: item.chunk.id,
      docId: item.chunk.docId,
      filename: item.chunk.filename,
      domain: item.chunk.domain,
      fileType: item.chunk.fileType,
      docVersion: item.chunk.docVersion,
      pageNumber: item.chunk.pageNumber,
      content: item.chunk.content,
      semanticScore: Number(item.sem.toFixed(4)),
      keywordScore: Number(bm25Norm.toFixed(4)),
      combinedScore: Number(combined.toFixed(4)),
      matchedTerms: item.matchedTerms,
    };
  });

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results.slice(0, Math.max(1, options.topK));
}
