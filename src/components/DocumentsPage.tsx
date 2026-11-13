import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  Upload,
  RefreshCw,
  Trash2,
  Eye,
  FileEdit,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  deleteDocument,
  fetchDocumentChunks,
  reindexDocument,
  updateDocument,
  uploadDocuments,
} from '../api';
import type { DocumentChunkItem, DocumentRecord, UploadFileResult } from '../types';
import { formatBytes, formatShortDate, getStatusLabel } from '../utils/format';

interface DocumentsPageProps {
  documents: DocumentRecord[];
  domains: string[];
  onRefresh: () => Promise<void>;
}

export function DocumentsPage({ documents, domains, onRefresh }: DocumentsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadDomain, setUploadDomain] = useState(domains[0] || 'Robotics Fundamentals');
  const [chunkSize, setChunkSize] = useState(750);
  const [chunkOverlap, setChunkOverlap] = useState(130);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadFileResult[]>([]);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'ocr_required' | 'failed'>('all');

  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inspect chunks state
  const [inspectedDoc, setInspectedDoc] = useState<DocumentRecord | null>(null);
  const [inspectedChunks, setInspectedChunks] = useState<DocumentChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Update document state
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [editDomain, setEditDomain] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setSelectedFiles(list);
    setUploadResults([]);
    setActionNotice(null);
  }

  async function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setActionNotice({
        type: 'err',
        text: 'Please select one or more PDF, TXT, or DOCX files before uploading.',
      });
      return;
    }

    setUploading(true);
    setActionNotice(null);
    setUploadResults([]);

    try {
      const results = await uploadDocuments({
        files: selectedFiles,
        domain: uploadDomain,
        chunkSize,
        chunkOverlap,
      });
      setUploadResults(results);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onRefresh();
    } catch (err) {
      setActionNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Document processing failed. Please try another file.',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleReindex(doc: DocumentRecord) {
    setBusyDocId(doc.id);
    setActionNotice(null);
    try {
      const res = await reindexDocument(doc.id);
      setActionNotice({ type: 'ok', text: `${doc.filename}: ${res.message}` });
      await onRefresh();
    } catch (err) {
      setActionNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Re-indexing failed.',
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleDelete(doc: DocumentRecord) {
    setBusyDocId(doc.id);
    setActionNotice(null);
    try {
      const res = await deleteDocument(doc.id);
      setConfirmDeleteId(null);
      if (inspectedDoc?.id === doc.id) {
        setInspectedDoc(null);
        setInspectedChunks([]);
      }
      setActionNotice({ type: 'ok', text: `${doc.filename}: ${res.message}` });
      await onRefresh();
    } catch (err) {
      setActionNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to delete document.',
      });
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleInspectChunks(doc: DocumentRecord) {
    setInspectedDoc(doc);
    setLoadingChunks(true);
    try {
      const data = await fetchDocumentChunks(doc.id);
      setInspectedChunks(data.chunks);
    } catch (err) {
      setActionNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load chunks.',
      });
      setInspectedDoc(null);
    } finally {
      setLoadingChunks(false);
    }
  }

  function startEdit(doc: DocumentRecord) {
    setEditingDoc(doc);
    setEditDomain(doc.domain);
    setEditFile(null);
    setActionNotice(null);
  }

  async function handleSaveUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;
    setSavingUpdate(true);
    setActionNotice(null);
    try {
      const res = await updateDocument({
        id: editingDoc.id,
        domain: editDomain,
        file: editFile,
      });
      setActionNotice({ type: 'ok', text: `${res.document.filename}: ${res.message}` });
      setEditingDoc(null);
      setEditFile(null);
      await onRefresh();
    } catch (err) {
      setActionNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update document.',
      });
    } finally {
      setSavingUpdate(false);
    }
  }

  const filteredDocs = documents.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return doc.filename.toLowerCase().includes(q) || doc.domain.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Upload Institutional Robotics Documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Supports multiple PDF, TXT, and DOCX uploads (max 20 MB per file). Automatic duplicate hash
            verification and scanned-PDF OCR detection are enabled.
          </p>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label htmlFor="doc-upload-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Select Documents (.pdf, .txt, .docx)
              </label>
              <input
                ref={fileInputRef}
                id="doc-upload-input"
                type="file"
                multiple
                accept=".pdf,.txt,.docx"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
              />
              {selectedFiles.length > 0 && (
                <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                  {selectedFiles.length} file(s) selected
                </p>
              )}
            </div>

            <div>
              <label htmlFor="doc-domain-select" className="block text-xs font-medium text-slate-700 mb-1.5">
                Robotics Knowledge Domain
              </label>
              <select
                id="doc-domain-select"
                value={uploadDomain}
                onChange={(e) => setUploadDomain(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="chunk-size-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Chunk Size (chars)
                </label>
                <input
                  id="chunk-size-input"
                  type="number"
                  min={200}
                  max={2000}
                  step={10}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value) || 750)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>
              <div>
                <label htmlFor="chunk-overlap-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Overlap (chars)
                </label>
                <input
                  id="chunk-overlap-input"
                  type="number"
                  min={0}
                  max={500}
                  step={10}
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              {uploading ? 'Processing & Indexing...' : 'Upload & Index Documents'}
            </button>
          </div>
        </form>

        {/* Per-file upload results */}
        {uploadResults.length > 0 && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Upload & Processing Summary</p>
            <ul className="space-y-1.5">
              {uploadResults.map((res, idx) => (
                <li
                  key={`${res.filename}_${idx}`}
                  className="text-xs flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  {res.status === 'indexed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <span className="font-medium text-slate-900">{res.filename}</span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="text-slate-700">{res.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Action Notice */}
      {actionNotice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            actionNotice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setActionNotice(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Update Form Drawer */}
      {editingDoc && (
        <section className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Update Document: {editingDoc.filename} (Current v{editingDoc.version})
            </h3>
            <button
              type="button"
              onClick={() => setEditingDoc(null)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSaveUpdate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="edit-domain" className="block text-xs font-medium text-slate-700 mb-1">
                Domain Category
              </label>
              <select
                id="edit-domain"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-file" className="block text-xs font-medium text-slate-700 mb-1">
                Replace File (optional, increments version)
              </label>
              <input
                id="edit-file"
                type="file"
                accept=".pdf,.txt,.docx"
                onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-700"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={savingUpdate}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
              >
                {savingUpdate ? 'Saving Update...' : 'Save Version Update'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Document Inventory Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Document Inventory ({filteredDocs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Manage indexed robotics study materials, versions, and chunks
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="doc-search-filter" className="sr-only">
              Filter documents
            </label>
            <input
              id="doc-search-filter"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by filename or domain..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
            <select
              aria-label="Filter by indexing status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'indexed' | 'ocr_required' | 'failed')
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-700"
            >
              <option value="all">All Statuses</option>
              <option value="indexed">Indexed</option>
              <option value="ocr_required">OCR Required</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No documents match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Document</th>
                  <th className="py-2.5 px-4">Domain</th>
                  <th className="py-2.5 px-4 text-right">Ver</th>
                  <th className="py-2.5 px-4 text-right">Pages</th>
                  <th className="py-2.5 px-4 text-right">Chunks</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Updated</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-medium text-slate-900">{doc.filename}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSize)}
                      </p>
                      {doc.errorMessage && (
                        <p className="text-xs text-amber-800 mt-1">{doc.errorMessage}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{doc.domain}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      v{doc.version}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {doc.pageCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {doc.chunkCount}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium whitespace-nowrap">
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
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                      {formatShortDate(doc.updatedAt)}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Inspect chunks for ${doc.filename}`}
                          onClick={() => void handleInspectChunks(doc)}
                          disabled={doc.chunkCount === 0}
                          className="p-1.5 text-slate-600 hover:text-blue-700 disabled:opacity-30 rounded"
                          title="Inspect Chunks"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Update ${doc.filename}`}
                          onClick={() => startEdit(doc)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 rounded"
                          title="Update Document"
                        >
                          <FileEdit className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Re-index ${doc.filename}`}
                          onClick={() => void handleReindex(doc)}
                          disabled={busyDocId === doc.id}
                          className="p-1.5 text-slate-600 hover:text-blue-700 disabled:opacity-40 rounded"
                          title="Re-index Document"
                        >
                          <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        </button>
                        {confirmDeleteId === doc.id ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(doc)}
                            disabled={busyDocId === doc.id}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 whitespace-nowrap"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Delete ${doc.filename}`}
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="p-1.5 text-slate-600 hover:text-red-700 rounded"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Chunk Inspector Panel */}
      {inspectedDoc && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Indexed Chunks: {inspectedDoc.filename}
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                {inspectedChunks.length} chunks · Version {inspectedDoc.version}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInspectedDoc(null);
                setInspectedChunks([]);
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Close Inspector
            </button>
          </div>

          {loadingChunks ? (
            <p className="text-xs text-slate-500">Loading chunks...</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {inspectedChunks.map((chunk) => (
                <div key={chunk.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                    <span>
                      Chunk #{chunk.chunkIndex + 1} · Page {chunk.pageNumber}
                    </span>
                    <span>{chunk.wordCount} words</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
