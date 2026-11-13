import { useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, Send, Trash2, AlertCircle, BookOpen } from 'lucide-react';
import { askAssistant, clearChatHistory } from '../api';
import type { ChatMessage, LlmBackendMode, SearchMode, SystemHealth } from '../types';
import { formatScorePct, formatTimestamp } from '../utils/format';

interface AssistantPageProps {
  messages: ChatMessage[];
  domains: string[];
  health: SystemHealth | null;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onQueryLogged: () => void;
}

const STARTER_QUESTIONS = [
  'How do Denavit-Hartenberg parameters define forward kinematics?',
  'Explain the role of Kp, Ki, and Kd gains and anti-windup in PID motor control.',
  'How does ROS2 differ from ROS1 in discovery and QoS policies?',
  'Compare A* and RRT* algorithms for robotics path planning.',
  'What safety modes are defined under ISO/TS 15066 for collaborative robots?',
];

function renderInlineFormatted(text: string) {
  // Clean inline LaTeX dollar-sign wrappers (e.g., $K_p$ -> Kp) and bold **...**
  const cleaned = text.replace(/\$([^$]+)\$/g, (_, expr: string) =>
    expr.replace(/_/g, '').replace(/\\([a-zA-Z]+)/g, '$1'),
  );
  const parts = cleaned.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1 py-0.5 text-xs font-mono bg-slate-200/70 rounded text-slate-900">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedProse({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-sm text-slate-800 leading-relaxed space-y-2">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;
        if (/^#{1,4}\s+/.test(line)) {
          const heading = line.replace(/^#{1,4}\s+/, '');
          return (
            <h4 key={idx} className="text-sm font-semibold text-slate-900 pt-1">
              {renderInlineFormatted(heading)}
            </h4>
          );
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-slate-400 select-none">•</span>
              <p className="flex-1">{renderInlineFormatted(line.replace(/^[-*]\s+/, ''))}</p>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="font-mono text-xs font-semibold text-slate-600 mt-0.5">{match[1]}</span>
                <p className="flex-1">{renderInlineFormatted(match[2])}</p>
              </div>
            );
          }
        }
        return <p key={idx}>{renderInlineFormatted(line)}</p>;
      })}
    </div>
  );
}

export function AssistantPage({
  messages,
  domains,
  health,
  onMessagesChange,
  onQueryLogged,
}: AssistantPageProps) {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [domainFilter, setDomainFilter] = useState('all');
  const [llmMode, setLlmMode] = useState<LlmBackendMode>('auto');
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const toggleSource = (key: string) => {
    setExpandedSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function submitQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await askAssistant({
        question: trimmed,
        mode,
        topK: 5,
        domainFilter,
        llmMode,
      });
      onMessagesChange([...messages, res.userMessage, res.assistantMessage]);
      setQuestion('');
      onQueryLogged();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach the AI assistant backend. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(question);
  }

  async function handleClearChat() {
    if (clearing || messages.length === 0) return;
    setClearing(true);
    setErrorMsg(null);
    try {
      await clearChatHistory();
      onMessagesChange([]);
      setExpandedSources({});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to clear chat history.');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Assistant Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Retrieval
            <select
              aria-label="Retrieval mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as SearchMode)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
            >
              <option value="hybrid">Hybrid (Semantic + BM25)</option>
              <option value="semantic">Semantic Vector</option>
              <option value="keyword">Keyword (BM25)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Domain
            <select
              aria-label="Filter by robotics domain"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700 max-w-[200px]"
            >
              <option value="all">All Robotics Domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Generator
            <select
              aria-label="Answer generator backend"
              value={llmMode}
              onChange={(e) => setLlmMode(e.target.value as LlmBackendMode)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
            >
              <option value="auto">
                Auto ({health?.ollamaAvailable ? 'Ollama Ready' : health?.geminiConfigured ? 'Gemini Ready' : 'Extractive Mode'})
              </option>
              <option value="ollama">Ollama Local LLM</option>
              {health?.geminiConfigured && <option value="gemini">Gemini Server-Side</option>}
              <option value="extractive">Grounded Extractive</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleClearChat()}
          disabled={messages.length === 0 || clearing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Clear Chat
        </button>
      </section>

      {/* Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-800"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <p className="font-medium">Assistant Request Notice</p>
            <p className="text-xs mt-0.5 text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 min-h-[420px] flex flex-col justify-between gap-6">
        {messages.length === 0 ? (
          <div className="py-8 max-w-2xl mx-auto text-center space-y-5">
            <BookOpen className="w-8 h-8 text-blue-700 mx-auto" aria-hidden="true" />
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">
                Ask the Robotics Knowledge Assistant
              </h2>
              <p className="text-sm text-slate-600">
                Every response is strictly grounded in your uploaded institutional robotics
                documents with expandable source citations and page numbers.
              </p>
            </div>

            <div className="space-y-2 text-left pt-2">
              <p className="text-xs font-medium text-slate-500">Suggested Study Questions</p>
              <div className="grid grid-cols-1 gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void submitQuestion(q)}
                    disabled={submitting}
                    className="text-left px-4 py-2.5 text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-600 hover:bg-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'ml-auto max-w-2xl bg-blue-700 text-white rounded-xl px-4 py-3'
                    : 'max-w-3xl space-y-3'
                }
              >
                {msg.role === 'user' ? (
                  <div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="mt-1.5 text-[11px] text-blue-100 font-mono tabular-nums">
                      You · {formatTimestamp(msg.createdAt)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-800">ROBO KNOWLEDGE AI</span>
                      <span className="font-mono tabular-nums">
                        {msg.llmProvider || 'Grounded RAG'} · {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>

                    {msg.insufficientEvidence && (
                      <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Insufficient Repository Evidence — No fabricated facts or sources were generated.
                      </p>
                    )}

                    <FormattedProse content={msg.content} />

                    {/* Source Explainability */}
                    {msg.sources.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Source References ({msg.sources.length})
                        </p>
                        <div className="space-y-2">
                          {msg.sources.map((src) => {
                            const toggleKey = `${msg.id}_${src.citationIndex}`;
                            const isOpen = Boolean(expandedSources[toggleKey]);
                            return (
                              <div
                                key={toggleKey}
                                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                              >
                                <button
                                  type="button"
                                  aria-expanded={isOpen}
                                  onClick={() => toggleSource(toggleKey)}
                                  className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left text-xs hover:bg-slate-50 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">
                                      [Source {src.citationIndex}] {src.filename}
                                    </p>
                                    <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                      Page {src.pageNumber} · {src.domain} · Relevance {formatScorePct(src.score)}
                                    </p>
                                  </div>
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                                  )}
                                </button>
                                {isOpen && (
                                  <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {src.excerpt}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Context-aware Follow-up Questions */}
                    {msg.followUps.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <p className="text-xs font-medium text-slate-500">Suggested Follow-up Questions</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.followUps.map((fq) => (
                            <button
                              key={fq}
                              type="button"
                              disabled={submitting}
                              onClick={() => void submitQuestion(fq)}
                              className="px-3 py-1.5 text-xs text-blue-700 bg-white border border-slate-200 rounded-lg hover:border-blue-600 transition-colors text-left"
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}

            {submitting && (
              <div className="max-w-xl bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
                Retrieving context chunks and synthesizing grounded response...
              </div>
            )}
          </div>
        )}

        {/* Question Input Form */}
        <form onSubmit={handleFormSubmit} className="pt-4 border-t border-slate-200 flex items-center gap-3">
          <label htmlFor="assistant-question-input" className="sr-only">
            Ask a robotics engineering question
          </label>
          <input
            id="assistant-question-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about kinematics, PID tuning, ROS2 QoS, SLAM, sensors, or safety..."
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
          />
          <button
            type="submit"
            disabled={submitting || !question.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {submitting ? 'Searching...' : 'Ask'}
          </button>
        </form>
      </section>
    </div>
  );
}
