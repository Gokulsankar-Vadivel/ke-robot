# ROBO KNOWLEDGE AI — AI-Powered Robotics Knowledge Assistant

An institutional Retrieval-Augmented Generation (RAG) platform designed for robotics engineering students and faculty to upload, index, search, and query study materials with page-level source explainability.

## Repository Contents

1. **Live Full-Stack Web Application (Root Workspace)**
   - Built with **React, TypeScript, Tailwind CSS, Express, Node SQLite, `pdfjs-dist`, `mammoth`**, and multi-backend RAG synthesis (**Ollama** / **Server-Side Gemini** / **Grounded Extractive**).
   - Launch command: `npm run dev` (serves on `http://localhost:3000`).

2. **Python / Streamlit Reference Implementation (`Robotics-Knowledge-Assistant/`)**
   - Built with **Python 3.10+, Streamlit, ChromaDB, Sentence Transformers (`all-MiniLM-L6-v2`), Ollama, PyMuPDF, python-docx, Pandas, SQLite, and Pytest**.

## Local Python / Streamlit Installation & Launch Guide

```bash
cd Robotics-Knowledge-Assistant
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Ollama locally and pull an appropriate open-source model:
ollama pull llama3.2
ollama serve

# Run automated tests:
pytest -v

# Launch the Streamlit application:
streamlit run app.py
```

## Implemented Pages

1. **Home Dashboard** (`app.py`): Project overview, real document/chunk/page metrics, repository status, recent uploads, and quick navigation.
2. **AI Robotics Assistant** (`pages/1_AI_Assistant.py`): Conversational RAG Q&A, retrieval mode selection, domain filter, inline `[Source N]` citations, expandable source excerpts, and clear chat.
3. **Document Management** (`pages/2_Document_Management.py`): Multi-file PDF/TXT/DOCX upload, duplicate detection, scanned-PDF detection, versioned updates, and deletion.
4. **Knowledge Repository** (`pages/3_Knowledge_Repository.py`): ChromaDB/SQLite repository status, live semantic/keyword/hybrid search testing, and indexed metadata table.
5. **Analytics** (`pages/4_Analytics.py`): Real corpus statistics, file type distribution, search logs, and detected knowledge gaps.
6. **About Project** (`pages/5_About_Project.py`): Abstract, architecture, and technology stack.
