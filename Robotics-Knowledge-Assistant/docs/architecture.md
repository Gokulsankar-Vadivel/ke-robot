# System Architecture — ROBO KNOWLEDGE AI

## High-Level Data Flow

```text
[PDF / TXT / DOCX Upload]
        │
        ▼
[Document Loader & Validator] ──(SHA-256)──► [Duplicate Check]
        │
        ▼
[Text Extractor (Page-Preserving + OCR Check)]
        │
        ▼
[Paragraph-Aware Chunker (Chunk Size + Overlap + Metadata)]
        │
        ▼
[Embedding Engine (384-dim Normalized Vectors)]
        │
        ▼
[Persistent Repository (ChromaDB + SQLite metadata.db)]
        ▲
        │ (Top-K Hybrid Retrieval: Cosine + BM25)
[Student Question] ──► [Query Embedding] ──► [Relevance Threshold Gate]
                                                    │
                        ┌───────────────────────────┴───────────────────────────┐
                        ▼ (Score < Threshold)                                   ▼ (Evidence Found)
        [Insufficient Evidence Guardrail]                       [Context + History Prompt]
                                                                                │
                                                                                ▼
                                                                [Ollama LLM / Grounded Synthesis]
                                                                                │
                                                                                ▼
                                                                [Answer + [Source N] + Page Excerpts]
```

## Database Consistency Rules

- Every document record in `documents` links to `chunks` via `doc_id` with `ON DELETE CASCADE`.
- Versioned updates increment `version`, replace chunks atomically inside a transaction, and remove stale vector entries so orphaned chunks never appear in search results.
- Search queries log `top_score`, `result_count`, and `has_gap` to `search_logs` for real analytics.
