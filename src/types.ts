export type PageRoute =
  | 'dashboard'
  | 'assistant'
  | 'documents'
  | 'repository'
  | 'analytics'
  | 'about';

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';
export type LlmBackendMode = 'auto' | 'ollama' | 'gemini' | 'extractive';

export interface SystemHealth {
  databaseConnected: boolean;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  geminiConfigured: boolean;
  activeGenerator: string;
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  domains: string[];
}

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
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkItem {
  id: string;
  chunkIndex: number;
  pageNumber: number;
  wordCount: number;
  content: string;
}

export interface UploadFileResult {
  filename: string;
  status: 'indexed' | 'duplicate' | 'ocr_required' | 'failed';
  message: string;
  document?: DocumentRecord;
}

export interface RagSourceReference {
  citationIndex: number;
  docId: string;
  filename: string;
  domain: string;
  pageNumber: number;
  score: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: RagSourceReference[];
  followUps: string[];
  insufficientEvidence: boolean;
  llmProvider?: string;
  createdAt: string;
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
