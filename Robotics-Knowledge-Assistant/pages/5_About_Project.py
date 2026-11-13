"""Page 6: About Project."""

import streamlit as st


def main() -> None:
    st.set_page_config(page_title="About Project", layout="wide")
    st.title("About ROBO KNOWLEDGE AI")

    st.subheader("Abstract")
    st.write(
        "ROBO KNOWLEDGE AI is an institutional Retrieval-Augmented Generation (RAG) platform "
        "built with Python, Streamlit, ChromaDB, Sentence Transformers (all-MiniLM-L6-v2), and Ollama "
        "to help robotics students retrieve grounded, page-cited explanations from their course materials."
    )

    st.subheader("System Architecture")
    st.write(
        "Question -> Query Embedding -> Hybrid Retrieval (Semantic + BM25) -> Context Preparation -> "
        "Ollama Local LLM -> Grounded Answer + Page Citations."
    )

    st.subheader("Technology Stack")
    st.markdown(
        "- Frontend: Streamlit\n"
        "- Vector Repository: ChromaDB (persistent)\n"
        "- Embeddings: Sentence Transformers (`all-MiniLM-L6-v2`)\n"
        "- Local LLM: Ollama\n"
        "- Extraction: PyMuPDF, python-docx\n"
        "- Metadata & Analytics: SQLite, Pandas\n"
        "- Testing: Pytest"
    )


if __name__ == "__main__":
    main()
