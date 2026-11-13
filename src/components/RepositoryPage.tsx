import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { searchRepository } from '../api';
import type { DocumentRecord, RetrievalResult, SearchMode, SystemHealth } from '../types';
import { formatScorePct, formatShortDate } from '../utils/format';

interface RepositoryPageProps {
  documents: DocumentRecord[];
  domains: string[];
  health: SystemHealth | null;
  onSearchLogged: () => void;
}

export function RepositoryPage({
  documents,
  domains,
  health,
  onSearchLogged,
}: RepositoryPageProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [topK, setTopK] = useState(5);
  const [domainFilter, setDomainFilter] = useState('all');
  const [docIdFilter, setDocIdFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const indexedDocs = documents.filter((d) => d.status === 'indexed');
  const totalChunks = indexedDocs.reduce((sum, d) => sum + d.chunkCount, 0);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a search query to test repository retrieval.');
      return;
    }

    setSearching(true);
    setErrorMsg(null);
    try {
      const res = await searchRepository({
        query: trimmed,
        mode,
        topK,
        domainFilter,
        docIdFilter,
        fileTypeFilter,
      });
      setResults(res.results);
      setLastLatency(res.responseTimeMs);
      setHasSearched(true);
      onSearchLogged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Repository search failed.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Vector Repository Status */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Vector Store Engine</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">Persistent SQLite Vector DB</p>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            {health?.databaseConnected ? 'Connected · WAL Mode' : 'Connecting'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Indexed Documents</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {indexedDocs.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            of {documents.length} total uploaded
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Stored Vector Chunks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {totalChunks}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">384-dim dense vectors</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Retrieval Strategy</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">Semantic + BM25 Hybrid</p>
          <p className="mt-1 text-xs text-slate-500">Metadata-filtered Top-K ranking</p>
        </div>
      </section>

      {/* Search Tester */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Repository Retrieval Tester</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect semantic similarity, BM25 keyword scoring, and metadata filtering directly against
            indexed vector chunks.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="repo-search-input" className="sr-only">
              Search repository chunks
            </label>
            <input
              id="repo-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Denavit-Hartenberg parameters, ESP32 PWM, Nav2 costmap..."
              className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              {searching ? 'Searching...' : 'Run Search'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-xs font-medium text-slate-600">
              Search Mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SearchMode)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="hybrid">Hybrid (Semantic + BM25)</option>
                <option value="semantic">Semantic Only</option>
                <option value="keyword">Keyword Only (BM25)</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Top-K Results
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={12}>Top 12</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Domain Filter
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="all">All Domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-600">
              Document Filter
              <select
                value={docIdFilter}
                onChange={(e) => setDocIdFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="all">All Documents</option>
                {indexedDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="font-medium">File Type:</span>
            {(['all', 'pdf', 'txt', 'docx'] as const).map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setFileTypeFilter(ft)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  fileTypeFilter === ft
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {ft === 'all' ? 'All Formats' : ft.toUpperCase()}
              </button>
            ))}
          </div>
        </form>

        {errorMsg && (
          <p role="alert" className="text-xs text-red-700 font-medium">
            {errorMsg}
          </p>
        )}

        {hasSearched && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Retrieved <strong className="text-slate-900 font-mono tabular-nums">{results.length}</strong> chunks
              </span>
              {lastLatency !== null && (
                <span className="font-mono tabular-nums">Search time: {lastLatency} ms</span>
              )}
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-slate-600 py-4">
                No matching chunks found for the current query and filter criteria.
              </p>
            ) : (
              <div className="space-y-3">
                {results.map((r, index) => (
                  <article
                    key={r.chunkId}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        #{index + 1} · {r.filename}
                        <span className="ml-2 font-normal text-slate-500 font-mono tabular-nums">
                          Page {r.pageNumber} · {r.domain} · v{r.docVersion}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-blue-700 font-medium">
                        Combined {formatScorePct(r.combinedScore)} · Semantic {formatScorePct(r.semanticScore)} · Keyword {formatScorePct(r.keywordScore)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {r.content}
                    </p>
                    {r.matchedTerms.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Matched terms: <span className="font-mono">{r.matchedTerms.join(', ')}</span>
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Indexed Document Metadata Inventory */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Indexed Repository Metadata</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-6">Document ID</th>
                <th className="py-2.5 px-4">Filename</th>
                <th className="py-2.5 px-4">Domain</th>
                <th className="py-2.5 px-4 text-right">Pages</th>
                <th className="py-2.5 px-4 text-right">Chunks</th>
                <th className="py-2.5 px-6 text-right">Last Indexed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {indexedDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-6 font-mono text-xs text-slate-500">{doc.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900 text-xs">{doc.filename}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{doc.domain}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">{doc.pageCount}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">{doc.chunkCount}</td>
                  <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-slate-500">
                    {formatShortDate(doc.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
