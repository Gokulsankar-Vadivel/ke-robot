import type {
  AnalyticsSummary,
  ChatMessage,
  DocumentChunkItem,
  DocumentRecord,
  LlmBackendMode,
  RetrievalResult,
  SearchMode,
  SystemHealth,
  UploadFileResult,
} from './types';

async function handleJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch('/api/health');
  return handleJson<SystemHealth>(res);
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch('/api/documents');
  const data = await handleJson<{ documents: DocumentRecord[] }>(res);
  return data.documents;
}

export async function fetchDocumentChunks(
  docId: string,
): Promise<{ document: DocumentRecord; chunks: DocumentChunkItem[] }> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/chunks`);
  return handleJson<{ document: DocumentRecord; chunks: DocumentChunkItem[] }>(res);
}

export async function uploadDocuments(params: {
  files: File[];
  domain: string;
  chunkSize: number;
  chunkOverlap: number;
}): Promise<UploadFileResult[]> {
  const form = new FormData();
  for (const f of params.files) {
    form.append('files', f);
  }
  form.append('domain', params.domain);
  form.append('chunkSize', String(params.chunkSize));
  form.append('chunkOverlap', String(params.chunkOverlap));

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    body: form,
  });
  const data = await handleJson<{ results: UploadFileResult[] }>(res);
  return data.results;
}

export async function updateDocument(params: {
  id: string;
  domain: string;
  file?: File | null;
}): Promise<{ message: string; document: DocumentRecord }> {
  const form = new FormData();
  form.append('domain', params.domain);
  if (params.file) {
    form.append('file', params.file);
  }

  const res = await fetch(`/api/documents/${encodeURIComponent(params.id)}`, {
    method: 'PUT',
    body: form,
  });
  return handleJson<{ message: string; document: DocumentRecord }>(res);
}

export async function reindexDocument(id: string): Promise<{ message: string; document: DocumentRecord }> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleJson<{ message: string; document: DocumentRecord }>(res);
}

export async function deleteDocument(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return handleJson<{ message: string }>(res);
}

export async function searchRepository(params: {
  query: string;
  mode: SearchMode;
  topK: number;
  domainFilter: string;
  docIdFilter: string;
  fileTypeFilter: string;
}): Promise<{
  query: string;
  mode: SearchMode;
  topScore: number;
  responseTimeMs: number;
  results: RetrievalResult[];
}> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleJson(res);
}

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch('/api/chat/history');
  const data = await handleJson<{ messages: ChatMessage[] }>(res);
  return data.messages;
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE' });
  await handleJson(res);
}

export async function askAssistant(params: {
  question: string;
  mode: SearchMode;
  topK: number;
  domainFilter: string;
  llmMode: LlmBackendMode;
}): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  responseTimeMs: number;
  topScore: number;
}> {
  const res = await fetch('/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleJson(res);
}

export async function fetchAnalytics(): Promise<AnalyticsSummary> {
  const res = await fetch('/api/analytics');
  return handleJson<AnalyticsSummary>(res);
}
