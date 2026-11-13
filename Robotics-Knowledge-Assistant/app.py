"""Home Dashboard for ROBO KNOWLEDGE AI (Streamlit application entrypoint)."""

import pandas as pd
import streamlit as st

from config import APP_NAME, PROJECT_TITLE
from modules.analytics import compute_analytics
from modules.document_manager import DocumentManager
from modules.embedding_manager import EmbeddingManager
from modules.rag_engine import check_ollama_available
from modules.vector_database import VectorDatabase


@st.cache_resource
def get_services():
    db = VectorDatabase()
    embedder = EmbeddingManager()
    doc_mgr = DocumentManager(db=db, embedder=embedder)
    doc_mgr.seed_samples_if_empty()
    return db, embedder, doc_mgr


def main() -> None:
    st.set_page_config(page_title=APP_NAME, layout="wide")
    db, _, _ = get_services()
    stats = compute_analytics(db)
    ollama_ok = check_ollama_available()

    st.title(f"{APP_NAME} — {PROJECT_TITLE}")
    st.write(
        "Institutional Retrieval-Augmented Generation (RAG) platform for searching and "
        "understanding robotics course notes, lab manuals, and engineering datasheets."
    )

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Documents", stats["total_documents"])
    c2.metric("Indexed Chunks", stats["total_chunks"])
    c3.metric("Pages Processed", stats["total_pages"])
    c4.metric("Ollama LLM", "Available" if ollama_ok else "Not Running")

    st.subheader("Quick Navigation")
    n1, n2, n3 = st.columns(3)
    with n1:
        st.page_link("pages/1_AI_Assistant.py", label="Open AI Robotics Assistant")
    with n2:
        st.page_link("pages/2_Document_Management.py", label="Open Document Management")
    with n3:
        st.page_link("pages/3_Knowledge_Repository.py", label="Open Knowledge Repository")

    st.subheader("Recent Uploads")
    if stats["recent_uploads"]:
        df = pd.DataFrame(stats["recent_uploads"])[
            ["filename", "file_type", "domain", "version", "page_count", "chunk_count", "status"]
        ]
        st.dataframe(df, use_container_width=True, hide_index=True)
    else:
        st.info("No documents uploaded yet. Open Document Management to add study materials.")


if __name__ == "__main__":
    main()
