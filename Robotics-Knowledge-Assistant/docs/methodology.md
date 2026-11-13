# Methodology — ROBO KNOWLEDGE AI

## 1. Document Ingestion & Page Preservation
- PDF files are parsed page-by-page (`1..N`) to preserve exact academic citation numbers.
- Scanned PDFs averaging fewer than 25 selectable characters per page are flagged as `OCR Required` rather than silently producing empty indexes.
- TXT and DOCX files are normalized and split into paragraph-aligned logical pages.

## 2. Paragraph-Aware Chunking
- Paragraphs (`\n\n`) are preserved intact whenever they fit within `chunk_size` (default 750 characters).
- Oversized paragraphs split at sentence boundaries (`[.!?]`), retaining configurable character overlap (default 130 characters) to preserve cross-boundary context.

## 3. Hybrid Retrieval
- **Dense Semantic Search:** L2-normalized 384-dimensional vectors capture conceptual similarity across robotics terminology.
- **BM25 Lexical Search:** Captures exact technical identifiers (`ESP32`, `ISO/TS 15066`, `Kp`, `Ki`, `Kd`, `TF2`, `RRT*`).
- **Score Fusion:** `combined = 0.58 * semantic + 0.42 * bm25_normalized`, filtered by optional domain, document, and file-type metadata.

## 4. Anti-Hallucination & Explainability
- If no retrieved chunk clears the relevance threshold, the system refuses to speculate and logs the query as a Knowledge Gap.
- Every grounded answer provides numbered `[Source N]` citations paired with expandable verbatim excerpts and page numbers.
