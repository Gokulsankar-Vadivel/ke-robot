import { GoogleGenAI } from '@google/genai';
import { APP_CONFIG } from './config';
import { computeLocalEmbedding, tokenizeText } from './embeddings';
import { retrieveChunks, type RetrievalResult, type SearchMode } from './retrieval';
import { getAllIndexedChunks, logSearchActivity, type ChatMessageRecord } from './database';

export type LlmBackendMode = 'auto' | 'ollama' | 'gemini' | 'extractive';

export interface BackendHealthStatus {
  databaseConnected: boolean;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  geminiConfigured: boolean;
  activeGenerator: string;
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

export interface RagResponse {
  answer: string;
  sources: RagSourceReference[];
  followUps: string[];
  insufficientEvidence: boolean;
  llmProvider: string;
  topScore: number;
  responseTimeMs: number;
}

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

export async function checkOllamaHealth(): Promise<{ available: boolean; models: string[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const res = await fetch(`${APP_CONFIG.ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
    });
    if (!res.ok) return { available: false, models: [] };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function getSystemHealth(): Promise<BackendHealthStatus> {
  const ollama = await checkOllamaHealth();
  const geminiConfigured = hasValidGeminiKey();
  let activeGenerator = 'Grounded Extractive';
  if (ollama.available) {
    activeGenerator = `Ollama (${ollama.models[0] || APP_CONFIG.ollamaModel})`;
  } else if (geminiConfigured) {
    activeGenerator = 'Gemini 4 Hydrogen';
  }

  return {
    databaseConnected: true,
    ollamaAvailable: ollama.available,
    ollamaModels: ollama.models,
    geminiConfigured,
    activeGenerator,
  };
}

function buildContextPrompt(
  question: string,
  evidence: RetrievalResult[],
  history: ChatMessageRecord[],
): string {
  const contextBlocks = evidence
    .map(
      (item, idx) =>
        `[Source ${idx + 1}] Document: ${item.filename} | Page: ${item.pageNumber} | Domain: ${item.domain}\n${item.content}`,
    )
    .join('\n\n---\n\n');

  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are ROBO KNOWLEDGE AI, an institutional robotics engineering assistant.
Answer the student's question strictly and exclusively using the retrieved context below.
Rules:
1. Cite evidence inline using [Source 1], [Source 2], etc., matching the source numbers provided.
2. Do NOT fabricate facts, formulas, parameters, or citations outside the provided context.
3. If the context only partially answers the question, clearly state what is covered and what is missing.
4. Keep the explanation structured, precise, and helpful for robotics engineering students. Use plain readable symbols (e.g., Kp, Ki, Kd, u(t)) without LaTeX dollar-sign delimiters.

${recentHistory ? `Recent Conversation:\n${recentHistory}\n\n` : ''}Retrieved Institutional Context:
${contextBlocks}

Student Question: ${question}

Answer:`;
}

async function generateWithOllama(prompt: string, preferredModel?: string): Promise<string> {
  const ollama = await checkOllamaHealth();
  if (!ollama.available) {
    throw new Error('The AI model is not available. Please start Ollama.');
  }

  const modelToUse =
    preferredModel ||
    ollama.models.find((m) => m.includes(APP_CONFIG.ollamaModel)) ||
    ollama.models[0] ||
    APP_CONFIG.ollamaModel;

  const res = await fetch(`${APP_CONFIG.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelToUse,
      prompt,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    throw new Error('The AI model is not available. Please start Ollama.');
  }

  const data = (await res.json()) as { response?: string };
  if (!data.response?.trim()) {
    throw new Error('Ollama returned an empty response.');
  }
  return data.response.trim();
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!hasValidGeminiKey()) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: APP_CONFIG.geminiModel,
    contents: prompt,
    config: {
      systemInstruction:
        'You are an academic robotics engineering RAG assistant. Only state facts supported by the provided retrieved context and cite [Source N] markers accurately.',
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Empty response from Gemini.');
  }
  return text;
}

/**
 * Deterministic grounded extractive synthesizer used when no external LLM daemon is running.
 * Never fabricates information: formats top-ranked retrieved sentences with exact [Source N] citations.
 */
function synthesizeExtractiveAnswer(
  question: string,
  evidence: RetrievalResult[],
): string {
  const queryTerms = new Set(tokenizeText(question));
  const bullets: string[] = [];
  const usedSentences = new Set<string>();

  evidence.forEach((item, idx) => {
    const citationNum = idx + 1;
    const sentences = item.content
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    const scoredSentences = sentences
      .map((sentence) => {
        const toks = tokenizeText(sentence);
        let overlap = 0;
        for (const t of toks) {
          if (queryTerms.has(t)) overlap += 1;
        }
        return { sentence, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap);

    const topForChunk = scoredSentences.slice(0, 2);
    for (const s of topForChunk) {
      const key = s.sentence.toLowerCase();
      if (usedSentences.has(key)) continue;
      usedSentences.add(key);
      bullets.push(`- ${s.sentence} [Source ${citationNum}]`);
      if (bullets.length >= 6) break;
    }
  });

  if (bullets.length === 0) {
    return evidence
      .slice(0, 3)
      .map((e, i) => `- ${e.content.slice(0, 260).trim()}... [Source ${i + 1}]`)
      .join('\n');
  }

  return [
    'Based on the retrieved institutional robotics documents, here are the verified key points:',
    '',
    ...bullets,
  ].join('\n');
}

function generateFollowUps(question: string, evidence: RetrievalResult[]): string[] {
  const domains = Array.from(new Set(evidence.map((e) => e.domain)));
  const filenames = Array.from(new Set(evidence.map((e) => e.filename)));
  const qLower = question.toLowerCase();

  const suggestions: string[] = [];
  if (domains[0]) {
    suggestions.push(`What are the practical implementation considerations in ${domains[0]}?`);
  }
  if (!qLower.includes('troubleshoot') && !qLower.includes('safety')) {
    suggestions.push('What safety checks or common failure modes apply here?');
  }
  if (filenames.length > 1) {
    suggestions.push(`How does ${filenames[0]} relate to ${filenames[1]} for this topic?`);
  } else if (filenames[0]) {
    suggestions.push(`Summarize the key equations or parameters from ${filenames[0]}.`);
  }
  return suggestions.slice(0, 3);
}

export async function runRagQuery(params: {
  question: string;
  mode?: SearchMode;
  topK?: number;
  domainFilter?: string;
  llmMode?: LlmBackendMode;
  history?: ChatMessageRecord[];
}): Promise<RagResponse> {
  const start = Date.now();
  const question = params.question.trim();
  const mode = params.mode ?? 'hybrid';
  const topK = params.topK ?? APP_CONFIG.defaultTopK;
  const llmMode = params.llmMode ?? 'auto';
  const history = params.history ?? [];

  // Context-aware query augmentation for short follow-up questions
  let effectiveQuery = question;
  if (question.split(/\s+/).length <= 6 && history.length > 0) {
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      effectiveQuery = `${lastUser.content} ${question}`;
    }
  }

  const allChunks = getAllIndexedChunks();
  if (allChunks.length === 0) {
    const elapsed = Date.now() - start;
    logSearchActivity({
      query: question,
      mode,
      topScore: 0,
      resultCount: 0,
      hasGap: true,
      responseTimeMs: elapsed,
    });
    return {
      answer:
        'The knowledge repository is currently empty. Please upload and index robotics documents in Document Management before asking questions.',
      sources: [],
      followUps: [],
      insufficientEvidence: true,
      llmProvider: 'none',
      topScore: 0,
      responseTimeMs: elapsed,
    };
  }

  const queryVec = computeLocalEmbedding(effectiveQuery);
  const retrieved = retrieveChunks(effectiveQuery, allChunks, queryVec, {
    mode,
    topK,
    domainFilter: params.domainFilter,
  });

  const topScore = retrieved[0]?.combinedScore ?? 0;
  const relevantEvidence = retrieved.filter(
    (r) => r.combinedScore >= APP_CONFIG.minRelevanceThreshold && (r.matchedTerms.length > 0 || r.semanticScore >= 0.28),
  );

  // Guardrail against hallucinations when no relevant document evidence exists
  if (relevantEvidence.length === 0) {
    const elapsed = Date.now() - start;
    logSearchActivity({
      query: question,
      mode,
      topScore,
      resultCount: 0,
      hasGap: true,
      responseTimeMs: elapsed,
    });
    return {
      answer:
        'No relevant information was found in the uploaded documents. The current robotics knowledge base does not contain sufficient evidence to answer this question without speculation.',
      sources: [],
      followUps: [
        'Which robotics topics are covered in the current knowledge repository?',
        'How do I upload additional course PDFs or notes?',
      ],
      insufficientEvidence: true,
      llmProvider: 'grounded-guardrail',
      topScore,
      responseTimeMs: elapsed,
    };
  }

  // Deduplicate near-identical sources across the same doc + page
  const dedupedEvidence: RetrievalResult[] = [];
  const seenKeys = new Set<string>();
  for (const item of relevantEvidence) {
    const key = `${item.docId}_p${item.pageNumber}_${item.content.slice(0, 60)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dedupedEvidence.push(item);
    }
  }

  const sources: RagSourceReference[] = dedupedEvidence.map((item, idx) => ({
    citationIndex: idx + 1,
    docId: item.docId,
    filename: item.filename,
    domain: item.domain,
    pageNumber: item.pageNumber,
    score: item.combinedScore,
    excerpt: item.content,
  }));

  const prompt = buildContextPrompt(question, dedupedEvidence, history);
  let answer = '';
  let llmProvider = 'extractive-grounded';

  if (llmMode === 'ollama') {
    answer = await generateWithOllama(prompt);
    llmProvider = `Ollama (${APP_CONFIG.ollamaModel})`;
  } else if (llmMode === 'gemini') {
    answer = await generateWithGemini(prompt);
    llmProvider = `Gemini (${APP_CONFIG.geminiModel})`;
  } else if (llmMode === 'extractive') {
    answer = synthesizeExtractiveAnswer(question, dedupedEvidence);
    llmProvider = 'Grounded Extractive';
  } else {
    // Auto mode: Ollama -> Gemini -> Grounded Extractive
    const ollama = await checkOllamaHealth();
    if (ollama.available) {
      try {
        answer = await generateWithOllama(prompt);
        llmProvider = `Ollama (${ollama.models[0] || APP_CONFIG.ollamaModel})`;
      } catch {
        // Fallback below
      }
    }
    if (!answer && hasValidGeminiKey()) {
      try {
        answer = await generateWithGemini(prompt);
        llmProvider = `Gemini (${APP_CONFIG.geminiModel})`;
      } catch (err) {
        console.warn('[ragEngine] Gemini fallback error:', err);
      }
    }
    if (!answer) {
      answer = synthesizeExtractiveAnswer(question, dedupedEvidence);
      llmProvider = 'Grounded Extractive';
    }
  }

  const elapsed = Date.now() - start;
  logSearchActivity({
    query: question,
    mode,
    topScore,
    resultCount: sources.length,
    hasGap: false,
    responseTimeMs: elapsed,
  });

  return {
    answer,
    sources,
    followUps: generateFollowUps(question, dedupedEvidence),
    insufficientEvidence: false,
    llmProvider,
    topScore,
    responseTimeMs: elapsed,
  };
}
