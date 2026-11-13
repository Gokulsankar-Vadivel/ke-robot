import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';

import { APP_CONFIG, ROBOTICS_DOMAINS } from './server/config';
import { chunkPages, type PageText } from './server/chunker';
import { computeLocalEmbedding } from './server/embeddings';
import { extractDocumentContent } from './server/extractor';
import { retrieveChunks, type SearchMode } from './server/retrieval';
import {
  clearChatHistory,
  deleteDocumentById,
  findDuplicateByHash,
  getAllIndexedChunks,
  getAnalyticsSummary,
  getChatHistory,
  getChunksForDocument,
  getDatabase,
  getDocumentById,
  listDocuments,
  logSearchActivity,
  saveChatMessage,
  saveDocumentWithChunks,
} from './server/database';
import { getSystemHealth, runRagQuery, type LlmBackendMode } from './server/ragEngine';
import { seedSampleDocumentsIfEmpty } from './server/seed';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: APP_CONFIG.maxFileSizeBytes,
    files: 10,
  },
});

async function startServer() {
  getDatabase();
  const seeded = await seedSampleDocumentsIfEmpty();
  if (seeded > 0) {
    console.log(`[robo-knowledge-ai] Indexed ${seeded} sample robotics documents.`);
  }

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      const health = await getSystemHealth();
      const docs = listDocuments();
      res.json({
        ...health,
        totalDocuments: docs.length,
        indexedDocuments: docs.filter((d) => d.status === 'indexed').length,
        totalChunks: docs.reduce((s, d) => s + d.chunkCount, 0),
        domains: ROBOTICS_DOMAINS,
      });
    } catch (err) {
      console.error('[api/health] error:', err);
      res.status(500).json({ error: 'Unable to check repository health.' });
    }
  });

  app.get('/api/domains', (_req, res) => {
    res.json({ domains: ROBOTICS_DOMAINS });
  });

  app.get('/api/documents', (_req, res) => {
    try {
      res.json({ documents: listDocuments() });
    } catch (err) {
      console.error('[api/documents] error:', err);
      res.status(500).json({ error: 'Unable to load documents.' });
    }
  });

  app.get('/api/documents/:id/chunks', (req, res) => {
    try {
      const doc = getDocumentById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      const chunks = getChunksForDocument(doc.id);
      res.json({ document: doc, chunks });
    } catch (err) {
      console.error('[api/documents/:id/chunks] error:', err);
      res.status(500).json({ error: 'Unable to load document chunks.' });
    }
  });

  app.post('/api/documents/upload', upload.array('files', 10), async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Please select at least one PDF, TXT, or DOCX document.' });
      return;
    }

    const domain =
      typeof req.body?.domain === 'string' && req.body.domain.trim()
        ? req.body.domain.trim()
        : 'Robotics Fundamentals';
    const chunkSize = Number(req.body?.chunkSize) || APP_CONFIG.defaultChunkSize;
    const chunkOverlap = Number(req.body?.chunkOverlap) || APP_CONFIG.defaultChunkOverlap;

    const results: Array<{
      filename: string;
      status: 'indexed' | 'duplicate' | 'ocr_required' | 'failed';
      message: string;
      document?: ReturnType<typeof getDocumentById>;
    }> = [];

    for (const file of files) {
      const originalName = path.basename(file.originalname || 'untitled.txt');
      const extracted = await extractDocumentContent(originalName, file.buffer);

      const duplicate = findDuplicateByHash(extracted.fileHash);
      if (duplicate) {
        results.push({
          filename: originalName,
          status: 'duplicate',
          message: `Duplicate content detected. Identical to existing document "${duplicate.filename}" (v${duplicate.version}).`,
          document: duplicate,
        });
        continue;
      }

      const docId = `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      fs.mkdirSync(APP_CONFIG.uploadDir, { recursive: true });
      const safeDiskName = `${docId}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = path.join(APP_CONFIG.uploadDir, safeDiskName);

      if (!extracted.ok) {
        const failedStatus = extracted.needsOcr ? 'ocr_required' : 'failed';
        if (extracted.needsOcr) {
          fs.writeFileSync(storagePath, file.buffer);
        }
        const saved = saveDocumentWithChunks(
          {
            id: docId,
            filename: originalName,
            fileType: extracted.fileType,
            fileSize: file.size,
            fileHash: extracted.fileHash,
            domain,
            version: 1,
            pageCount: extracted.pageCount,
            chunkCount: 0,
            status: failedStatus,
            errorMessage: extracted.errorMessage || 'Document processing failed. Please try another file.',
            needsOcr: extracted.needsOcr,
            storagePath: extracted.needsOcr ? storagePath : null,
          },
          [],
        );

        results.push({
          filename: originalName,
          status: failedStatus,
          message:
            extracted.errorMessage || 'Document processing failed. Please try another file.',
          document: saved,
        });
        continue;
      }

      fs.writeFileSync(storagePath, file.buffer);
      const chunks = chunkPages(
        extracted.pages,
        {
          docId,
          filename: originalName,
          domain,
          fileType: extracted.fileType,
          docVersion: 1,
        },
        chunkSize,
        chunkOverlap,
      );

      const chunksWithEmbeddings = chunks.map((chunk) => ({
        chunk,
        embedding: computeLocalEmbedding(chunk.content),
      }));

      const saved = saveDocumentWithChunks(
        {
          id: docId,
          filename: originalName,
          fileType: extracted.fileType,
          fileSize: file.size,
          fileHash: extracted.fileHash,
          domain,
          version: 1,
          pageCount: extracted.pageCount,
          chunkCount: chunks.length,
          status: 'indexed',
          errorMessage: null,
          needsOcr: false,
          storagePath,
        },
        chunksWithEmbeddings,
      );

      results.push({
        filename: originalName,
        status: 'indexed',
        message: 'Document uploaded successfully.',
        document: saved,
      });
    }

    res.json({ results });
  });

  app.put('/api/documents/:id', upload.single('file'), async (req, res) => {
    try {
      const existing = getDocumentById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const nextDomain =
        typeof req.body?.domain === 'string' && req.body.domain.trim()
          ? req.body.domain.trim()
          : existing.domain;
      const chunkSize = Number(req.body?.chunkSize) || APP_CONFIG.defaultChunkSize;
      const chunkOverlap = Number(req.body?.chunkOverlap) || APP_CONFIG.defaultChunkOverlap;

      if (req.file) {
        const originalName = path.basename(req.file.originalname || existing.filename);
        const extracted = await extractDocumentContent(originalName, req.file.buffer);
        const dup = findDuplicateByHash(extracted.fileHash, existing.id);
        if (dup) {
          res.status(409).json({
            error: `Updated file matches another existing document ("${dup.filename}").`,
          });
          return;
        }
        if (!extracted.ok) {
          res.status(400).json({
            error:
              extracted.errorMessage || 'Document processing failed. Please try another file.',
          });
          return;
        }

        const nextVersion = existing.version + 1;
        fs.mkdirSync(APP_CONFIG.uploadDir, { recursive: true });
        const safeDiskName = `${existing.id}_v${nextVersion}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = path.join(APP_CONFIG.uploadDir, safeDiskName);
        fs.writeFileSync(storagePath, req.file.buffer);

        const chunks = chunkPages(
          extracted.pages,
          {
            docId: existing.id,
            filename: originalName,
            domain: nextDomain,
            fileType: extracted.fileType,
            docVersion: nextVersion,
          },
          chunkSize,
          chunkOverlap,
        );
        const chunksWithEmbeddings = chunks.map((chunk) => ({
          chunk,
          embedding: computeLocalEmbedding(chunk.content),
        }));

        const updated = saveDocumentWithChunks(
          {
            id: existing.id,
            filename: originalName,
            fileType: extracted.fileType,
            fileSize: req.file.size,
            fileHash: extracted.fileHash,
            domain: nextDomain,
            version: nextVersion,
            pageCount: extracted.pageCount,
            chunkCount: chunks.length,
            status: 'indexed',
            errorMessage: null,
            needsOcr: false,
            storagePath,
          },
          chunksWithEmbeddings,
        );

        res.json({ message: 'Document updated successfully.', document: updated });
        return;
      }

      // Metadata-only update (e.g., domain change): preserve existing pages via chunk reconstruction
      const currentChunks = getChunksForDocument(existing.id);
      const pageMap = new Map<number, string[]>();
      for (const c of currentChunks) {
        const list = pageMap.get(c.pageNumber) ?? [];
        list.push(c.content);
        pageMap.set(c.pageNumber, list);
      }

      let pages: PageText[] = [];
      if (existing.storagePath && fs.existsSync(existing.storagePath)) {
        const buf = fs.readFileSync(existing.storagePath);
        const extracted = await extractDocumentContent(existing.filename, buf);
        if (extracted.ok) pages = extracted.pages;
      }
      if (pages.length === 0) {
        pages = Array.from(pageMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([pageNumber, parts]) => ({ pageNumber, text: parts.join('\n\n') }));
      }

      const nextVersion = existing.version + 1;
      const chunks = chunkPages(
        pages,
        {
          docId: existing.id,
          filename: existing.filename,
          domain: nextDomain,
          fileType: existing.fileType,
          docVersion: nextVersion,
        },
        chunkSize,
        chunkOverlap,
      );
      const chunksWithEmbeddings = chunks.map((chunk) => ({
        chunk,
        embedding: computeLocalEmbedding(chunk.content),
      }));

      const updated = saveDocumentWithChunks(
        {
          ...existing,
          domain: nextDomain,
          version: nextVersion,
          chunkCount: chunks.length,
        },
        chunksWithEmbeddings,
      );

      res.json({ message: 'Document updated successfully.', document: updated });
    } catch (err) {
      console.error('[api/documents/:id PUT] error:', err);
      res.status(500).json({ error: 'Unable to update document.' });
    }
  });

  app.post('/api/documents/:id/reindex', async (req, res) => {
    try {
      const existing = getDocumentById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      const chunkSize = Number(req.body?.chunkSize) || APP_CONFIG.defaultChunkSize;
      const chunkOverlap = Number(req.body?.chunkOverlap) || APP_CONFIG.defaultChunkOverlap;

      let pages: PageText[] = [];
      if (existing.storagePath && fs.existsSync(existing.storagePath)) {
        const buf = fs.readFileSync(existing.storagePath);
        const extracted = await extractDocumentContent(existing.filename, buf);
        if (!extracted.ok) {
          res.status(400).json({
            error:
              extracted.errorMessage || 'Document processing failed. Please try another file.',
          });
          return;
        }
        pages = extracted.pages;
      } else {
        const currentChunks = getChunksForDocument(existing.id);
        const pageMap = new Map<number, string[]>();
        for (const c of currentChunks) {
          const arr = pageMap.get(c.pageNumber) ?? [];
          arr.push(c.content);
          pageMap.set(c.pageNumber, arr);
        }
        pages = Array.from(pageMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([pageNumber, parts]) => ({ pageNumber, text: parts.join('\n\n') }));
      }

      if (pages.length === 0) {
        res.status(400).json({ error: 'No readable content available to re-index.' });
        return;
      }

      const chunks = chunkPages(
        pages,
        {
          docId: existing.id,
          filename: existing.filename,
          domain: existing.domain,
          fileType: existing.fileType,
          docVersion: existing.version,
        },
        chunkSize,
        chunkOverlap,
      );
      const chunksWithEmbeddings = chunks.map((chunk) => ({
        chunk,
        embedding: computeLocalEmbedding(chunk.content),
      }));

      const updated = saveDocumentWithChunks(
        {
          ...existing,
          pageCount: pages.length,
          chunkCount: chunks.length,
          status: 'indexed',
          errorMessage: null,
          needsOcr: false,
        },
        chunksWithEmbeddings,
      );

      res.json({ message: 'Document re-indexed successfully.', document: updated });
    } catch (err) {
      console.error('[api/documents/:id/reindex] error:', err);
      res.status(500).json({ error: 'Re-indexing failed.' });
    }
  });

  app.delete('/api/documents/:id', (req, res) => {
    try {
      const deleted = deleteDocumentById(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }
      res.json({ message: 'Document deleted successfully.' });
    } catch (err) {
      console.error('[api/documents/:id DELETE] error:', err);
      res.status(500).json({ error: 'Unable to delete document.' });
    }
  });

  app.post('/api/search', (req, res) => {
    const start = Date.now();
    try {
      const query = String(req.body?.query || '').trim();
      if (!query) {
        res.status(400).json({ error: 'Please enter a search query.' });
        return;
      }

      const mode = (['hybrid', 'semantic', 'keyword'].includes(req.body?.mode)
        ? req.body.mode
        : 'hybrid') as SearchMode;
      const topK = Math.min(20, Math.max(1, Number(req.body?.topK) || 5));
      const domainFilter = typeof req.body?.domainFilter === 'string' ? req.body.domainFilter : 'all';
      const docIdFilter = typeof req.body?.docIdFilter === 'string' ? req.body.docIdFilter : 'all';
      const fileTypeFilter =
        typeof req.body?.fileTypeFilter === 'string' ? req.body.fileTypeFilter : 'all';

      const chunks = getAllIndexedChunks();
      const queryVec = computeLocalEmbedding(query);
      const results = retrieveChunks(query, chunks, queryVec, {
        mode,
        topK,
        domainFilter,
        docIdFilter,
        fileTypeFilter,
      });

      const topScore = results[0]?.combinedScore ?? 0;
      const relevantCount = results.filter((r) => r.combinedScore >= APP_CONFIG.minRelevanceThreshold).length;
      const elapsed = Date.now() - start;

      logSearchActivity({
        query,
        mode,
        topScore,
        resultCount: relevantCount,
        hasGap: relevantCount === 0,
        responseTimeMs: elapsed,
      });

      res.json({
        query,
        mode,
        topScore,
        responseTimeMs: elapsed,
        results,
      });
    } catch (err) {
      console.error('[api/search] error:', err);
      res.status(500).json({ error: 'Search failed.' });
    }
  });

  app.get('/api/chat/history', (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : 'default';
      res.json({ messages: getChatHistory(sessionId) });
    } catch (err) {
      console.error('[api/chat/history GET] error:', err);
      res.status(500).json({ error: 'Unable to load chat history.' });
    }
  });

  app.delete('/api/chat/history', (req, res) => {
    try {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : 'default';
      clearChatHistory(sessionId);
      res.json({ message: 'Chat history cleared.' });
    } catch (err) {
      console.error('[api/chat/history DELETE] error:', err);
      res.status(500).json({ error: 'Unable to clear chat history.' });
    }
  });

  app.post('/api/chat/ask', async (req, res) => {
    try {
      const question = String(req.body?.question || '').trim();
      if (!question) {
        res.status(400).json({ error: 'Please enter a robotics question.' });
        return;
      }

      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : 'default';
      const mode = (['hybrid', 'semantic', 'keyword'].includes(req.body?.mode)
        ? req.body.mode
        : 'hybrid') as SearchMode;
      const topK = Math.min(10, Math.max(1, Number(req.body?.topK) || APP_CONFIG.defaultTopK));
      const domainFilter = typeof req.body?.domainFilter === 'string' ? req.body.domainFilter : 'all';
      const llmMode = (['auto', 'ollama', 'gemini', 'extractive'].includes(req.body?.llmMode)
        ? req.body.llmMode
        : 'auto') as LlmBackendMode;

      const history = getChatHistory(sessionId);

      const userMsg = {
        id: `msg_${crypto.randomUUID()}`,
        sessionId,
        role: 'user' as const,
        content: question,
        sources: [],
        followUps: [],
        insufficientEvidence: false,
        createdAt: new Date().toISOString(),
      };
      saveChatMessage(userMsg);

      const rag = await runRagQuery({
        question,
        mode,
        topK,
        domainFilter,
        llmMode,
        history,
      });

      const assistantMsg = {
        id: `msg_${crypto.randomUUID()}`,
        sessionId,
        role: 'assistant' as const,
        content: rag.answer,
        sources: rag.sources,
        followUps: rag.followUps,
        insufficientEvidence: rag.insufficientEvidence,
        llmProvider: rag.llmProvider,
        createdAt: new Date().toISOString(),
      };
      saveChatMessage(assistantMsg);

      res.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        responseTimeMs: rag.responseTimeMs,
        topScore: rag.topScore,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate response.';
      console.error('[api/chat/ask] error:', err);
      res.status(503).json({ error: message });
    }
  });

  app.get('/api/analytics', (_req, res) => {
    try {
      res.json(getAnalyticsSummary());
    } catch (err) {
      console.error('[api/analytics] error:', err);
      res.status(500).json({ error: 'Unable to compute repository analytics.' });
    }
  });

  // Global multer error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist/index.html'));
  if (isProd) {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(APP_CONFIG.port, '0.0.0.0', () => {
    console.log(`[robo-knowledge-ai] Server running on http://0.0.0.0:${APP_CONFIG.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ROBO KNOWLEDGE AI server:', err);
  process.exit(1);
});
