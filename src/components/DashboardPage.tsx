import { ArrowRight, BookOpen, Database, FileText, MessageSquare, BarChart3 } from 'lucide-react';
import type { AnalyticsSummary, DocumentRecord, PageRoute, SystemHealth } from '../types';
import { formatBytes, formatShortDate, getStatusLabel } from '../utils/format';

interface DashboardPageProps {
  health: SystemHealth | null;
  analytics: AnalyticsSummary | null;
  documents: DocumentRecord[];
  loading: boolean;
  onNavigate: (page: PageRoute) => void;
}

export function DashboardPage({
  health,
  analytics,
  documents,
  loading,
  onNavigate,
}: DashboardPageProps) {
  const totalDocs = analytics?.totalDocuments ?? documents.length;
  const indexedDocs = analytics?.indexedDocuments ?? documents.filter((d) => d.status === 'indexed').length;
  const totalChunks = analytics?.totalChunks ?? documents.reduce((s, d) => s + d.chunkCount, 0);
  const totalPages = analytics?.totalPages ?? documents.reduce((s, d) => s + d.pageCount, 0);
  const recentUploads = analytics?.recentUploads ?? documents.slice(0, 5);

  const repoStatusText = !health
    ? 'Checking'
    : totalDocs === 0
      ? 'Empty Repository'
      : indexedDocs > 0
        ? 'Ready & Indexed'
        : 'Needs Attention';

  return (
    <div className="space-y-8">
      {/* Hero Overview */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-medium text-blue-700 tracking-wide">
            Institutional Robotics RAG Platform
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
            AI-Powered Robotics Knowledge Assistant
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Upload, index, and query institutional robotics engineering materials—covering kinematics,
            sensors, Arduino and ESP32 firmware, motor control, ROS2 navigation, SLAM, and safety
            standards—with page-accurate source citations.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              Open AI Assistant
            </button>
            <button
              type="button"
              onClick={() => onNavigate('documents')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Manage Documents
            </button>
          </div>
        </div>
      </section>

      {/* Primary KPI Row */}
      <section aria-label="Repository overview metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Documents</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {loading ? '—' : totalDocs}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {indexedDocs} indexed · {totalPages} pages
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Indexed Chunks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {loading ? '—' : totalChunks}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics?.totalWords ?? 0} total words
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Repository Status</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{repoStatusText}</p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {health?.activeGenerator || 'Checking backend'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Search Queries Logged</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {loading ? '—' : (analytics?.totalSearches ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics?.knowledgeGaps.length ?? 0} knowledge gaps recorded
          </p>
        </div>
      </section>

      {/* Quick Navigation */}
      <section aria-label="Quick navigation" className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Quick Navigation</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-600 transition-colors group focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <div className="flex items-center justify-between">
              <MessageSquare className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 transition-colors" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">AI Robotics Assistant</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Ask technical questions and inspect cited page-level excerpts.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-600 transition-colors group focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <div className="flex items-center justify-between">
              <FileText className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 transition-colors" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Document Management</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Upload PDF, TXT, or DOCX files, track versions, or re-index.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('repository')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-600 transition-colors group focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <div className="flex items-center justify-between">
              <Database className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 transition-colors" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Knowledge Repository</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Test hybrid semantic and BM25 retrieval across stored chunks.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-600 transition-colors group focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <div className="flex items-center justify-between">
              <BarChart3 className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 transition-colors" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Knowledge Analytics</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Review real corpus coverage, search logs, and knowledge gaps.
            </p>
          </button>
        </div>
      </section>

      {/* Recent Uploads Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Institutional Materials</h2>
            <p className="text-xs text-slate-500">Latest documents indexed into the robotics repository</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
          >
            View all documents
          </button>
        </div>

        {recentUploads.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-700">No documents indexed yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload robotics PDFs, TXT notes, or DOCX guides in Document Management to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Document</th>
                  <th className="py-2.5 px-4">Domain</th>
                  <th className="py-2.5 px-4 text-right">Pages</th>
                  <th className="py-2.5 px-4 text-right">Chunks</th>
                  <th className="py-2.5 px-4 text-right">Size</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-6 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUploads.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-900 max-w-md">
                      <span className="truncate block">{doc.filename}</span>
                      <span className="text-xs font-normal font-mono text-slate-500">
                        {doc.fileType.toUpperCase()} · v{doc.version}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{doc.domain}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {doc.pageCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {doc.chunkCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 text-xs">
                      {formatBytes(doc.fileSize)}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">
                      <span
                        className={
                          doc.status === 'indexed'
                            ? 'text-emerald-700'
                            : doc.status === 'ocr_required'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }
                      >
                        {getStatusLabel(doc.status)}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {formatShortDate(doc.updatedAt)}
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
