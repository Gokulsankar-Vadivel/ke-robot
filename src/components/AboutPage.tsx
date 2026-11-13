const SYSTEM_MODULES = [
  {
    name: '01. Document Loader & Validator',
    desc: 'Enforces PDF, TXT, and DOCX file-type rules, 20 MB size limits, and SHA-256 duplicate hash checks.',
  },
  {
    name: '02. Multi-Format Text Extractor',
    desc: 'Extracts page-indexed text from PDFs, DOCX manuals, and TXT notes while detecting scanned PDFs needing OCR.',
  },
  {
    name: '03. Paragraph-Aware Text Chunker',
    desc: 'Splits extracted pages into configurable overlapping chunks with unique chunk IDs and page metadata.',
  },
  {
    name: '04. Embedding Manager',
    desc: 'Generates normalized 384-dimensional dense vectors locally (Sentence Transformers / deterministic projection) with caching.',
  },
  {
    name: '05. Persistent Vector Repository',
    desc: 'Stores vectors, text chunks, and document versions atomically across restarts without orphaned records.',
  },
  {
    name: '06. Hybrid Retrieval Engine',
    desc: 'Combines dense cosine semantic search with BM25 keyword scoring and metadata filtering.',
  },
  {
    name: '07. RAG Answer Generator',
    desc: 'Prepares ranked context windows for Ollama local LLMs, server-side Gemini, or grounded extractive synthesis.',
  },
  {
    name: '08. Source Explainability',
    desc: 'Maps every inline citation [Source N] to exact document filename, domain, page number, and supporting excerpt.',
  },
  {
    name: '09. Conversational Assistant',
    desc: 'Maintains persistent chat history, context-aware follow-up augmentation, and strict anti-hallucination guardrails.',
  },
  {
    name: '10. Document Lifecycle Manager',
    desc: 'Supports multi-file upload, versioned file replacement, chunk inspection, re-indexing, and safe deletion.',
  },
  {
    name: '11. Real-Time Knowledge Analytics',
    desc: 'Computes corpus coverage, file format shares, search activity latency, and unanswered knowledge gaps.',
  },
];

const SUPPORTED_TOPICS = [
  'Robotics Fundamentals',
  'Robot Components',
  'Sensors and Actuators',
  'Arduino',
  'ESP32',
  'Microcontrollers',
  'Motor Control',
  'Robotic Arms',
  'Mobile Robots',
  'Industrial Robotics',
  'Robot Kinematics',
  'Robot Dynamics',
  'ROS and ROS2',
  'AI in Robotics',
  'Machine Learning in Robotics',
  'Computer Vision',
  'Autonomous Navigation',
  'SLAM',
  'Robot Path Planning',
  'Robotics Safety',
  'Robotics Troubleshooting',
];

export function AboutPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Overview & Abstract */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          ROBO KNOWLEDGE AI — Project Overview & Architecture
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed">
          <strong>Abstract:</strong> Engineering students studying robotics work across fragmented lab
          manuals, microcontroller datasheets, kinematics lecture notes, ROS2 migration guides, and
          industrial safety standards. ROBO KNOWLEDGE AI is an institutional Retrieval-Augmented
          Generation (RAG) platform designed to unify these materials into a persistent, searchable
          knowledge repository that delivers explainable, citation-backed technical answers.
        </p>
        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Core Objectives</h2>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1.5">
              <li>Process multi-format institutional robotics documents (PDF, TXT, DOCX).</li>
              <li>Preserve exact page references and paragraph coherence during chunking.</li>
              <li>Combine semantic vector similarity and BM25 lexical matching via hybrid retrieval.</li>
              <li>Eliminate hallucinations by enforcing strict evidence thresholds and source citations.</li>
              <li>Provide full document lifecycle management, version tracking, and gap analytics.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Technology Stack</h2>
            <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1.5">
              <li>
                <strong>Live Web Workbench:</strong> React, TypeScript, Tailwind CSS, Express, Node SQLite,
                pdfjs-dist, Mammoth, Ollama &amp; Server-Side Gemini API.
              </li>
              <li>
                <strong>Python Reference Codebase:</strong> Python 3.10+, Streamlit, ChromaDB,
                Sentence-Transformers (<span className="font-mono text-xs">all-MiniLM-L6-v2</span>),
                Ollama, PyMuPDF, python-docx, Pandas, SQLite, and Pytest (located in{' '}
                <span className="font-mono text-xs">Robotics-Knowledge-Assistant/</span>).
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* RAG Architecture Pipeline */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">End-to-End RAG System Architecture</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="font-semibold text-slate-900">1. Ingestion &amp; Extraction</p>
            <p className="text-slate-600">
              File type/size validation, SHA-256 deduplication, page-preserving extraction, and scanned
              PDF detection.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="font-semibold text-slate-900">2. Chunking &amp; Embedding</p>
            <p className="text-slate-600">
              Paragraph-aware chunking with overlap, normalized 384-dim dense vector generation, and
              persistent SQLite storage.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="font-semibold text-slate-900">3. Hybrid Retrieval</p>
            <p className="text-slate-600">
              Blended cosine similarity and BM25 lexical scoring with domain, format, and document
              metadata filters.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="font-semibold text-slate-900">4. Grounded Generation</p>
            <p className="text-slate-600">
              Context-constrained LLM synthesis with inline [Source N] markers, expandable excerpts, and
              threshold guardrails.
            </p>
          </div>
        </div>
      </section>

      {/* 11 Project Modules */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">System Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_MODULES.map((mod) => (
            <div key={mod.name} className="border border-slate-200 rounded-lg p-4 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">{mod.name}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Domains & Future Enhancements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Supported Robotics Domains (21)</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {SUPPORTED_TOPICS.join(' · ')}
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Future Enhancements</h2>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 space-y-1.5">
            <li>Integrated Tesseract / PaddleOCR pipeline for scanned laboratory schematics.</li>
            <li>Cross-encoder neural reranking for large multi-semester curriculum repositories.</li>
            <li>Interactive URDF / DH-parameter visualizers linked from retrieved kinematics chunks.</li>
            <li>Multi-user faculty vs. student workspace roles for institutional deployment.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
