"""Page 4: Knowledge Repository inspection and live retrieval tester."""

import pandas as pd
import streamlit as st

from app import get_services
from config import ROBOTICS_DOMAINS
from modules.hybrid_search import hybrid_search


def main() -> None:
    st.set_page_config(page_title="Knowledge Repository", layout="wide")
    st.title("Knowledge Repository")

    db, embedder, _ = get_services()
    docs = db.list_documents()
    total_chunks = sum(int(d["chunk_count"]) for d in docs)

    c1, c2, c3 = st.columns(3)
    c1.metric("ChromaDB Persistent Store", "Active" if db.chroma_active else "Fallback Mode")
    c2.metric("Indexed Documents", sum(1 for d in docs if d["status"] == "indexed"))
    c3.metric("Total Chunks", total_chunks)

    st.subheader("Search Testing")
    query = st.text_input("Enter search query")
    col1, col2, col3 = st.columns(3)
    mode = col1.selectbox("Mode", ["hybrid", "semantic", "keyword"])
    top_k = col2.slider("Top-K", min_value=1, max_value=15, value=5)
    domain = col3.selectbox("Domain", ["all"] + ROBOTICS_DOMAINS)

    if st.button("Search Repository") and query.strip():
        results = hybrid_search(query.strip(), db=db, embedder=embedder, top_k=top_k, mode=mode, domain_filter=domain)
        if not results:
            st.info("No relevant information was found in the uploaded documents.")
        for idx, r in enumerate(results, start=1):
            st.markdown(
                f"**#{idx} — {r['filename']} (Page {r['page_number']}, {r['domain']})** — Score: `{r['combined_score']:.3f}`"
            )
            st.write(r["content"])
            st.divider()

    if docs:
        st.subheader("Indexed Metadata")
        st.dataframe(
            pd.DataFrame(docs)[["id", "filename", "domain", "version", "page_count", "chunk_count", "updated_at"]],
            use_container_width=True,
            hide_index=True,
        )


if __name__ == "__main__":
    main()
