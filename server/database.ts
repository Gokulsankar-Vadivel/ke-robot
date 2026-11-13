import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { APP_CONFIG } from './config';
import type { TextChunk } from './chunker';
import type { IndexedChunkRecord } from './retrieval';

export interface DocumentRecord {
  id: string;
  filename: string;
  fileType: 'pdf' | 'txt' | 'docx';
  fileSize: number;
  fileHash: string;
  domain: string;
  version: number;
  pageCount: number;
  chunkCount: number;
  status: 'indexed' | 'ocr_required' | 'failed';
  errorMessage: string | null;
  needsOcr: boolean;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Array<{
    citationIndex: number;
    docId: string;
    filename: string;
    domain: string;
    pageNumber: number;
    score: number;
    excerpt: string;
  }>;
  followUps: string[];
  insufficientEvidence: boolean;
  llmProvider?: string;
  createdAt: string;
}

export interface SearchLogRecord {
  id: number;
  query: string;
  mode: string;
  topScore: number;
  resultCount: number;
  hasGap: boolean;
  responseTimeMs: number;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalDocuments: number;
  indexedDocuments: number;
  ocrRequiredDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  totalPages: number;
  totalWords: number;
  fileTypeDistribution: Array<{ fileType: string; count: number; chunks: number }>;
  domainDistribution: Array<{ domain: string; count: number; chunks: number }>;
  recentUploads: DocumentRecord[];
  totalSearches: number;
  avgTopScore: number;
  recentSearches: SearchLogRecord[];
  knowledgeGaps: Array<{
    query: string;
    occurrences: number;
    bestScore: number;
    lastAskedAt: string;
  }>;
}

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(APP_CONFIG.dbDir, { recursive: true });
  fs.mkdirSync(APP_CONFIG.uploadDir, { recursive: true });

  const db = new DatabaseSync(APP_CONFIG.dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      domain TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      page_count INTEGER NOT NULL DEFAULT 0,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT,
      needs_ocr INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      embedding_json TEXT NOT NULL,
      doc_version INTEGER NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT NOT NULL DEFAULT '[]',
      follow_ups_json TEXT NOT NULL DEFAULT '[]',
      insufficient_evidence INTEGER NOT NULL DEFAULT 0,
      llm_provider TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      mode TEXT NOT NULL,
      top_score REAL NOT NULL,
      result_count INTEGER NOT NULL,
      has_gap INTEGER NOT NULL DEFAULT 0,
      response_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

function mapDocRow(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    filename: String(row.filename),
    fileType: String(row.file_type) as 'pdf' | 'txt' | 'docx',
    fileSize: Number(row.file_size),
    fileHash: String(row.file_hash),
    domain: String(row.domain),
    version: Number(row.version),
    pageCount: Number(row.page_count),
    chunkCount: Number(row.chunk_count),
    status: String(row.status) as 'indexed' | 'ocr_required' | 'failed',
    errorMessage: row.error_message ? String(row.error_message) : null,
    needsOcr: Boolean(row.needs_ocr),
    storagePath: row.storage_path ? String(row.storage_path) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listDocuments(): DocumentRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM documents ORDER BY updated_at DESC, filename ASC')
    .all() as Record<string, unknown>[];
  return rows.map(mapDocRow);
}

export function getDocumentById(id: string): DocumentRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapDocRow(row) : null;
}

export function findDuplicateByHash(fileHash: string, excludeDocId?: string): DocumentRecord | null {
  const db = getDatabase();
  const row = excludeDocId
    ? (db
        .prepare('SELECT * FROM documents WHERE file_hash = ? AND id != ? LIMIT 1')
        .get(fileHash, excludeDocId) as Record<string, unknown> | undefined)
    : (db.prepare('SELECT * FROM documents WHERE file_hash = ? LIMIT 1').get(fileHash) as
        | Record<string, unknown>
        | undefined);
  return row ? mapDocRow(row) : null;
}

export function saveDocumentWithChunks(
  doc: Omit<DocumentRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
  chunksWithEmbeddings: Array<{ chunk: TextChunk; embedding: number[] }>,
): DocumentRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = getDocumentById(doc.id);
  const createdAt = existing?.createdAt ?? doc.createdAt ?? now;
  const updatedAt = doc.updatedAt ?? now;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(
      `INSERT INTO documents (
        id, filename, file_type, file_size, file_hash, domain, version,
        page_count, chunk_count, status, error_message, needs_ocr, storage_path,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        filename = excluded.filename,
        file_type = excluded.file_type,
        file_size = excluded.file_size,
        file_hash = excluded.file_hash,
        domain = excluded.domain,
        version = excluded.version,
        page_count = excluded.page_count,
        chunk_count = excluded.chunk_count,
        status = excluded.status,
        error_message = excluded.error_message,
        needs_ocr = excluded.needs_ocr,
        storage_path = excluded.storage_path,
        updated_at = excluded.updated_at`,
    ).run(
      doc.id,
      doc.filename,
      doc.fileType,
      doc.fileSize,
      doc.fileHash,
      doc.domain,
      doc.version,
      doc.pageCount,
      chunksWithEmbeddings.length,
      doc.status,
      doc.errorMessage,
      doc.needsOcr ? 1 : 0,
      doc.storagePath,
      createdAt,
      updatedAt,
    );

    db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(doc.id);

    const insertChunk = db.prepare(
      `INSERT INTO chunks (
        id, doc_id, chunk_index, page_number, content, word_count, embedding_json, doc_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const item of chunksWithEmbeddings) {
      insertChunk.run(
        item.chunk.id,
        doc.id,
        item.chunk.chunkIndex,
        item.chunk.pageNumber,
        item.chunk.content,
        item.chunk.wordCount,
        JSON.stringify(item.embedding),
        doc.version,
      );
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return getDocumentById(doc.id)!;
}

export function deleteDocumentById(id: string): boolean {
  const db = getDatabase();
  const doc = getDocumentById(id);
  if (!doc) return false;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  if (doc.storagePath && doc.storagePath.startsWith(APP_CONFIG.uploadDir)) {
    try {
      if (fs.existsSync(doc.storagePath)) fs.unlinkSync(doc.storagePath);
    } catch {
      // Ignore file unlink errors if already removed
    }
  }
  return true;
}

export function getAllIndexedChunks(): IndexedChunkRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT c.id, c.doc_id, d.filename, d.domain, d.file_type, c.doc_version,
              c.chunk_index, c.page_number, c.content, c.word_count, c.embedding_json
       FROM chunks c
       INNER JOIN documents d ON d.id = c.doc_id
       WHERE d.status = 'indexed'
       ORDER BY d.filename ASC, c.chunk_index ASC`,
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    docId: String(row.doc_id),
    filename: String(row.filename),
    domain: String(row.domain),
    fileType: String(row.file_type),
    docVersion: Number(row.doc_version),
    chunkIndex: Number(row.chunk_index),
    pageNumber: Number(row.page_number),
    content: String(row.content),
    wordCount: Number(row.word_count),
    embedding: JSON.parse(String(row.embedding_json)) as number[],
  }));
}

export function getChunksForDocument(docId: string): Array<{
  id: string;
  chunkIndex: number;
  pageNumber: number;
  wordCount: number;
  content: string;
}> {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT id, chunk_index, page_number, word_count, content FROM chunks WHERE doc_id = ? ORDER BY chunk_index ASC',
    )
    .all(docId) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    chunkIndex: Number(r.chunk_index),
    pageNumber: Number(r.page_number),
    wordCount: Number(r.word_count),
    content: String(r.content),
  }));
}

export function saveChatMessage(msg: ChatMessageRecord): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO chat_messages (
      id, session_id, role, content, sources_json, follow_ups_json,
      insufficient_evidence, llm_provider, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    msg.id,
    msg.sessionId,
    msg.role,
    msg.content,
    JSON.stringify(msg.sources),
    JSON.stringify(msg.followUps),
    msg.insufficientEvidence ? 1 : 0,
    msg.llmProvider ?? null,
    msg.createdAt,
  );
}

export function getChatHistory(sessionId = 'default'): ChatMessageRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    sessionId: String(r.session_id),
    role: String(r.role) as 'user' | 'assistant',
    content: String(r.content),
    sources: JSON.parse(String(r.sources_json || '[]')),
    followUps: JSON.parse(String(r.follow_ups_json || '[]')),
    insufficientEvidence: Boolean(r.insufficient_evidence),
    llmProvider: r.llm_provider ? String(r.llm_provider) : undefined,
    createdAt: String(r.created_at),
  }));
}

export function clearChatHistory(sessionId = 'default'): void {
  const db = getDatabase();
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
}

export function logSearchActivity(entry: {
  query: string;
  mode: string;
  topScore: number;
  resultCount: number;
  hasGap: boolean;
  responseTimeMs: number;
}): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO search_logs (query, mode, top_score, result_count, has_gap, response_time_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.query,
    entry.mode,
    entry.topScore,
    entry.resultCount,
    entry.hasGap ? 1 : 0,
    entry.responseTimeMs,
    new Date().toISOString(),
  );
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const db = getDatabase();
  const docs = listDocuments();

  const totalDocuments = docs.length;
  const indexedDocuments = docs.filter((d) => d.status === 'indexed').length;
  const ocrRequiredDocuments = docs.filter((d) => d.status === 'ocr_required').length;
  const failedDocuments = docs.filter((d) => d.status === 'failed').length;
  const totalChunks = docs.reduce((sum, d) => sum + d.chunkCount, 0);
  const totalPages = docs.reduce((sum, d) => sum + d.pageCount, 0);

  const wordRow = db.prepare('SELECT COALESCE(SUM(word_count), 0) AS total_words FROM chunks').get() as {
    total_words: number;
  };

  const ftRows = db
    .prepare(
      `SELECT file_type, COUNT(*) AS count, COALESCE(SUM(chunk_count), 0) AS chunks
       FROM documents GROUP BY file_type ORDER BY count DESC`,
    )
    .all() as Array<{ file_type: string; count: number; chunks: number }>;

  const domRows = db
    .prepare(
      `SELECT domain, COUNT(*) AS count, COALESCE(SUM(chunk_count), 0) AS chunks
       FROM documents GROUP BY domain ORDER BY chunks DESC, count DESC`,
    )
    .all() as Array<{ domain: string; count: number; chunks: number }>;

  const searchAgg = db
    .prepare('SELECT COUNT(*) AS total, COALESCE(AVG(top_score), 0) AS avg_score FROM search_logs')
    .get() as { total: number; avg_score: number };

  const recentSearchRows = db
    .prepare('SELECT * FROM search_logs ORDER BY id DESC LIMIT 15')
    .all() as Record<string, unknown>[];

  const gapRows = db
    .prepare(
      `SELECT query, COUNT(*) AS occurrences, MAX(top_score) AS best_score, MAX(created_at) AS last_asked_at
       FROM search_logs
       WHERE has_gap = 1
       GROUP BY LOWER(TRIM(query))
       ORDER BY occurrences DESC, last_asked_at DESC
       LIMIT 10`,
    )
    .all() as Array<{
    query: string;
    occurrences: number;
    best_score: number;
    last_asked_at: string;
  }>;

  return {
    totalDocuments,
    indexedDocuments,
    ocrRequiredDocuments,
    failedDocuments,
    totalChunks,
    totalPages,
    totalWords: Number(wordRow?.total_words ?? 0),
    fileTypeDistribution: ftRows.map((r) => ({
      fileType: r.file_type.toUpperCase(),
      count: Number(r.count),
      chunks: Number(r.chunks),
    })),
    domainDistribution: domRows.map((r) => ({
      domain: r.domain,
      count: Number(r.count),
      chunks: Number(r.chunks),
    })),
    recentUploads: docs.slice(0, 6),
    totalSearches: Number(searchAgg?.total ?? 0),
    avgTopScore: Number(Number(searchAgg?.avg_score ?? 0).toFixed(3)),
    recentSearches: recentSearchRows.map((r) => ({
      id: Number(r.id),
      query: String(r.query),
      mode: String(r.mode),
      topScore: Number(r.top_score),
      resultCount: Number(r.result_count),
      hasGap: Boolean(r.has_gap),
      responseTimeMs: Number(r.response_time_ms),
      createdAt: String(r.created_at),
    })),
    knowledgeGaps: gapRows.map((g) => ({
      query: g.query,
      occurrences: Number(g.occurrences),
      bestScore: Number(Number(g.best_score).toFixed(3)),
      lastAskedAt: g.last_asked_at,
    })),
  };
}
