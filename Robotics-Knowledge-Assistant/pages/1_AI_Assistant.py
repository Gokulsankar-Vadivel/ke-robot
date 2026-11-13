"""Page 2: AI Robotics Assistant with conversational RAG and source explainability."""

import streamlit as st

from app import get_services
from config import OLLAMA_DEFAULT_MODEL, ROBOTICS_DOMAINS
from modules.rag_engine import answer_question, check_ollama_available


def main() -> None:
    st.set_page_config(page_title="AI Robotics Assistant", layout="wide")
    st.title("AI Robotics Assistant")

    db, embedder, _ = get_services()

    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    with st.sidebar:
        mode = st.selectbox("Retrieval Mode", ["hybrid", "semantic", "keyword"])
        domain = st.selectbox("Domain Filter", ["all"] + ROBOTICS_DOMAINS)
        model_name = st.text_input("Ollama Model", value=OLLAMA_DEFAULT_MODEL)
        if st.button("Clear Chat"):
            st.session_state.chat_history = []
            st.rerun()

    if not check_ollama_available():
        st.warning("The AI model is not available. Please start Ollama before submitting queries.")

    for turn in st.session_state.chat_history:
        with st.chat_message(turn["role"]):
            st.write(turn["content"])
            for src in turn.get("sources", []):
                with st.expander(
                    f"[Source {src['citation_index']}] {src['filename']} — Page {src['page_number']} ({src['score']:.2f})"
                ):
                    st.write(src["excerpt"])

    question = st.chat_input("Ask a question about robotics engineering...")
    if question:
        st.session_state.chat_history.append({"role": "user", "content": question, "sources": []})
        with st.spinner("Retrieving evidence and generating answer..."):
            try:
                res = answer_question(
                    question,
                    db=db,
                    embedder=embedder,
                    mode=mode,
                    domain_filter=domain,
                    history=[
                        {"role": m["role"], "content": m["content"]}
                        for m in st.session_state.chat_history[:-1]
                    ],
                    ollama_model=model_name,
                )
                st.session_state.chat_history.append(
                    {"role": "assistant", "content": res["answer"], "sources": res["sources"]}
                )
            except RuntimeError as exc:
                st.error(str(exc))
        st.rerun()


if __name__ == "__main__":
    main()
