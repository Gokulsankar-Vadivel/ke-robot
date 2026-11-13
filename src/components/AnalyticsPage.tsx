import type { AnalyticsSummary } from '../types';
import { formatScorePct, formatTimestamp } from '../utils/format';

interface AnalyticsPageProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

export function AnalyticsPage({ analytics, loading }: AnalyticsPageProps) {
  if (loading && !analytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
        Loading real-time repository analytics...
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
        Analytics data is currently unavailable.
      </div>
    );
  }

  const maxChunksByType = Math.max(
    1,
    ...analytics.fileTypeDistribution.map((f) => f.chunks),
  );
  const maxChunksByDomain = Math.max(
    1,
    ...analytics.domainDistribution.map((d) => d.chunks),
  );

  const indexHealthPct =
    analytics.totalDocuments > 0
      ? Math.round((analytics.indexedDocuments / analytics.totalDocuments) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Real Metric Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Indexed Coverage</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analytics.indexedDocuments} / {analytics.totalDocuments}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {indexHealthPct}% repository health
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Pages & Chunks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analytics.totalPages} <span className="text-sm font-normal text-slate-500">pages</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics.totalChunks} chunks · {analytics.totalWords} words
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Search Activity</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analytics.totalSearches}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Avg top relevance: {formatScorePct(analytics.avgTopScore)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Repository Attention Items</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {analytics.knowledgeGaps.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics.ocrRequiredDocuments} OCR pending · {analytics.failedDocuments} failed
          </p>
        </div>
      </section>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">File Type Distribution</h2>
            <p className="text-xs text-slate-500">Document count and chunk share by format</p>
          </div>
          {analytics.fileTypeDistribution.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No files uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.fileTypeDistribution.map((ft) => {
                const widthPct = Math.max(6, Math.round((ft.chunks / maxChunksByType) * 100));
                return (
                  <div key={ft.fileType} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900">{ft.fileType}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {ft.count} docs · {ft.chunks} chunks
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-700 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Robotics Domain Coverage</h2>
            <p className="text-xs text-slate-500">Real indexed chunk distribution across curriculum modules</p>
          </div>
          {analytics.domainDistribution.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No indexed domains yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.domainDistribution.map((dom) => {
                const widthPct = Math.max(6, Math.round((dom.chunks / maxChunksByDomain) * 100));
                return (
                  <div key={dom.domain} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900 truncate pr-2">{dom.domain}</span>
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {dom.count} docs · {dom.chunks} chunks
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Knowledge Gaps */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Detected Knowledge Gaps</h2>
          <p className="text-xs text-slate-500">
            Actual user queries where repository relevance fell below the grounding threshold
          </p>
        </div>
        {analytics.knowledgeGaps.length === 0 ? (
          <div className="p-6 text-xs text-slate-600">
            No knowledge gaps recorded yet. Queries without sufficient document support will appear here
            automatically to guide curriculum uploads.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Unanswered / Low-Confidence Query</th>
                  <th className="py-2.5 px-4 text-right">Occurrences</th>
                  <th className="py-2.5 px-4 text-right">Best Match</th>
                  <th className="py-2.5 px-6 text-right">Last Asked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.knowledgeGaps.map((gap) => (
                  <tr key={gap.query} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 text-xs font-medium text-slate-900">{gap.query}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {gap.occurrences}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-amber-700">
                      {formatScorePct(gap.bestScore)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-slate-500">
                      {formatTimestamp(gap.lastAskedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Search Activity Log */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Recent Search & Query Activity</h2>
          <p className="text-xs text-slate-500">Live retrieval telemetry recorded in SQLite</p>
        </div>
        {analytics.recentSearches.length === 0 ? (
          <div className="p-6 text-xs text-slate-600">
            No searches logged yet. Ask a question in AI Assistant or test retrieval in Knowledge Repository.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Query</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4 text-right">Top Score</th>
                  <th className="py-2.5 px-4 text-right">Hits</th>
                  <th className="py-2.5 px-4 text-right">Latency</th>
                  <th className="py-2.5 px-6 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.recentSearches.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-6 text-xs font-medium text-slate-900 max-w-md truncate">
                      {s.query}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 capitalize">{s.mode}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {formatScorePct(s.topScore)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {s.resultCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                      {s.responseTimeMs} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-slate-500">
                      {formatTimestamp(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
