# College Mini-Project Complete Report, PPT Content, Demo Script & Viva Q&A
## Project Title: AI-Powered Robotics Knowledge Assistant (ROBO KNOWLEDGE AI)

---

### 1. Abstract
Robotics engineering curricula span mechanical kinematics, embedded microcontrollers, power electronics, control theory, ROS2 middleware, SLAM, computer vision, and functional safety standards. Students frequently struggle to synthesize answers across fragmented PDFs, DOCX lab manuals, and text lecture notes. ROBO KNOWLEDGE AI implements a local-first Retrieval-Augmented Generation (RAG) platform that ingests institutional documents, preserves exact page references, indexes normalized embeddings alongside lexical BM25 terms, and delivers explainable, citation-backed answers with zero fabricated sources.

### 2. Introduction
General-purpose chatbots lack visibility into institution-specific lab assignments, hardware pinouts, and grading rubrics, and often hallucinate parameters. RAG bridges this gap by retrieving verified passages from a curated knowledge base before generating a grounded explanation.

### 3. Problem Statement
Students spend excessive time manually searching across dozens of static course handouts, while existing basic PDF chat demos fail on multi-document queries, lack duplicate/version control, omit page citations, and fabricate answers when topics are absent from uploaded materials.

### 4. Objectives
1. Support multi-format institutional document upload (PDF, TXT, DOCX) with validation and duplicate detection.
2. Preserve page-level references through paragraph-aware chunking.
3. Combine semantic vector search and BM25 keyword search in a persistent repository.
4. Deliver grounded RAG answers with expandable source evidence and strict insufficient-evidence handling.
5. Track real corpus coverage, search activity, and knowledge gaps via SQLite analytics.

### 5. Existing System
Traditional keyword Ctrl+F search fails on conceptual queries, whereas generic cloud AI tools risk hallucinating unverified equations and cannot operate over a private local institutional repository with versioned document lifecycle management.

### 6. Proposed System
ROBO KNOWLEDGE AI combines persistent vector/relational storage, hybrid retrieval, grounded synthesis, complete document lifecycle controls (upload, update, re-index, delete), and live analytics in a unified six-page academic interface.

### 7. Hardware Requirements
- Processor: Intel Core i5 / AMD Ryzen 5 (64-bit, 4+ cores) or equivalent
- RAM: 8 GB minimum (16 GB recommended when running local Ollama LLMs)
- Storage: 5 GB free SSD space for vector index, SQLite metadata, and local model weights

### 8. Software Requirements
- Live Web Workbench: Node.js 22+, TypeScript, React, Express, SQLite, `pdfjs-dist`, `mammoth`
- Python Reference Stack: Python 3.10+, Streamlit, ChromaDB, Sentence Transformers (`all-MiniLM-L6-v2`), Ollama, PyMuPDF, python-docx, Pandas, Pytest

### 9. System Architecture
Layered modular architecture separating Ingestion/Extraction, Chunking, Embedding, Persistent Vector/SQLite Storage, Hybrid Retrieval, Grounded RAG Engine, and Presentation UI (see `docs/architecture.md`).

### 10. Data Flow Diagram
`Upload -> Validate & Hash -> Extract Pages -> Chunk -> Embed -> Persist -> Query -> Hybrid Search -> Gate -> Generate -> Cite Sources -> Log Analytics`.

### 11. Module Description
1. Document Loader & Validator
2. Multi-Format Text Extractor
3. Paragraph-Aware Chunker
4. Embedding Manager
5. Persistent Vector Database
6. Semantic Search
7. Hybrid Search (Cosine + BM25)
8. RAG Engine
9. Source Manager
10. Document Lifecycle Manager
11. Analytics Engine

### 12. Methodology
Refer to `docs/methodology.md` for extraction, chunking overlap math, hybrid score fusion, and hallucination gating.

### 13. Implementation
Implemented across modular TypeScript/Express/React modules (`server/*`, `src/*`) and Python/Streamlit modules (`Robotics-Knowledge-Assistant/modules/*`, `pages/*`, `app.py`).

### 14. Results
- Successfully indexes multi-page robotics modules across kinematics, sensors/MCUs, PID control, ROS2, SLAM, and ISO safety.
- Retrieves accurate page-cited passages for technical queries and rejects out-of-domain queries without hallucination.

### 15. Testing
Automated unit tests verify text cleaning, page preservation, vector normalization, hybrid ranking, duplicate hash rejection, versioned updates, deletion cascade, and Ollama failure messaging.

### 16. Advantages
- Explainable `[Source N]` citations with verbatim excerpts and page numbers.
- Zero-hallucination threshold gate and real knowledge-gap logging.
- Atomic document updates and duplicate prevention.

### 17. Limitations
- Scanned image-only PDFs are flagged as `OCR Required` and require an external OCR pre-pass before indexing.
- Local Ollama generation requires the Ollama service and model weights on the host machine.

### 18. Future Scope
- Built-in OCR pipeline for scanned engineering diagrams.
- Cross-encoder reranking and multi-user faculty/student permissions.

### 19. Conclusion
ROBO KNOWLEDGE AI demonstrates a complete, reliable, and academically rigorous RAG engineering platform ready for live faculty evaluation.

### 20. References
1. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS 2020.
2. Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond," Foundations and Trends in IR.
3. Reimers & Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks," EMNLP 2019.
4. ROS2 & Nav2 Documentation; ISO 10218 / ISO/TS 15066 Robotics Safety Standards.

---

## Project PPT Slide Outline (10 Slides)
1. Title Slide: AI-Powered Robotics Knowledge Assistant (`ROBO KNOWLEDGE AI`)
2. Problem Statement & Motivation
3. Objectives & Scope (21 Robotics Domains)
4. Existing vs. Proposed System
5. End-to-End RAG System Architecture
6. Document Ingestion, Page Preservation & Chunking
7. Hybrid Retrieval (Semantic Vectors + BM25)
8. Source Explainability & Anti-Hallucination Guardrails
9. Live Application Walkthrough (6 Pages + Real Analytics)
10. Testing Results, Limitations & Future Scope

## Live Demonstration Script (Faculty Evaluation)
1. **Home Dashboard**: Show real indexed document count, chunk count, and recent robotics modules.
2. **AI Robotics Assistant**: Ask *"How do Kp, Ki, and Kd affect PID motor control?"* -> Expand `[Source 1]` to show exact page number and verbatim excerpt. Then ask *"What is the recipe for chocolate cake?"* -> Show the Insufficient Evidence guardrail refusing to hallucinate.
3. **Document Management**: Upload a new `.txt`/`.pdf`/`.docx` file -> show chunk count increase -> upload the same file again to demonstrate duplicate detection -> update version or delete.
4. **Knowledge Repository**: Run a Hybrid vs. Keyword search with a Domain filter and inspect scores.
5. **Analytics**: Show real search logs, file type counts, and the newly logged Knowledge Gap from the unsupported question.

## Viva Questions & Answers
1. **Why use RAG instead of fine-tuning an LLM?** RAG allows instant document updates/deletions, preserves verifiable page citations, and avoids costly retraining.
2. **Why combine Semantic Search with BM25 (Hybrid Search)?** Dense vectors match conceptual phrasing, while BM25 ensures exact matches for robotics acronyms like `ESP32`, `TF2`, `RRT*`, and `ISO/TS 15066`.
3. **How do you prevent hallucinations?** By gating generation on minimum retrieval relevance scores, instructing the LLM to cite `[Source N]` strictly from context, and returning an explicit insufficient-evidence notice when no match qualifies.
4. **How do you preserve page numbers during chunking?** Extraction occurs per page (`1..N`) before chunking, and every chunk stores `page_number` in its metadata.
5. **How do you handle duplicate documents and updates?** Incoming files are hashed with SHA-256 to reject identical duplicates; updates increment `version` and atomically replace prior chunks in a transaction.
