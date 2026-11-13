"""Page 5: Real Knowledge Analytics."""

import pandas as pd
import streamlit as st

from app import get_services
from modules.analytics import compute_analytics


def main() -> None:
    st.set_page_config(page_title="Analytics", layout="wide")
    st.title("Knowledge Analytics")

    db, _, _ = get_services()
    stats = compute_analytics(db)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Documents", stats["total_documents"])
    c2.metric("Indexed Documents", stats["indexed_documents"])
    c3.metric("Total Chunks", stats["total_chunks"])
    c4.metric("Total Pages", stats["total_pages"])

    st.subheader("File Type Distribution")
    if stats["file_type_distribution"]:
        st.dataframe(pd.DataFrame(stats["file_type_distribution"]), use_container_width=True, hide_index=True)
    else:
        st.info("No file type records yet.")

    st.subheader("Knowledge Gaps")
    if stats["knowledge_gaps"]:
        st.dataframe(pd.DataFrame(stats["knowledge_gaps"]), use_container_width=True, hide_index=True)
    else:
        st.info("No low-confidence knowledge gaps logged.")

    st.subheader("Recent Search Activity")
    if stats["recent_searches"]:
        st.dataframe(pd.DataFrame(stats["recent_searches"]), use_container_width=True, hide_index=True)
    else:
        st.info("No searches logged yet.")


if __name__ == "__main__":
    main()
